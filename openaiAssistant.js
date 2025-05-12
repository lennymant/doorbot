// openaiAssistant.js
require('dotenv').config();
const { OpenAI } = require('openai');
const { Pool } = require('pg');
const fetch = require('node-fetch');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Map bot types to assistant IDs
const BOT_ASSISTANTS = {
  default: process.env.ASSISTANT_ID_DEFAULT,
  candidate: process.env.ASSISTANT_ID_CANDIDATE
};

// Map bot types to bot names
const BOT_NAMES = {
  default: process.env.BOT_NAME_DEFAULT || 'Mac',
  candidate: process.env.BOT_NAME_CANDIDATE || 'Assistant'
};

// Store thread to bot type mapping
const threadBotTypes = new Map();

const pool = new Pool({
  connectionString: process.env.RETOOL_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// 🔁 Wait until any existing run completes before sending a new message
async function waitForRunCompletion(threadId) {
  const runs = await openai.beta.threads.runs.list(threadId);
  const activeRun = runs.data.find(run => run.status !== 'completed' && run.status !== 'failed' && run.status !== 'cancelled');

  if (activeRun) {
    console.log(`⏳ Waiting for run ${activeRun.id} to finish...`);
    let status = activeRun.status;

    while (!['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
      await new Promise(r => setTimeout(r, 1000));
      const runStatus = await openai.beta.threads.runs.retrieve(threadId, activeRun.id);
      status = runStatus.status;
      console.log(`⏱️ Run ${activeRun.id} status: ${status}`);
    }

    console.log(`✅ Previous run ${activeRun.id} completed.`);
  }
}

// Log a new chat thread to the DB
async function logThreadStart(threadId, source = 'website') {
  console.log(`🧵 Creating thread record for: ${threadId}`);
  await pool.query(
    `INSERT INTO chat_threads (thread_id, created_at, completed, source)
     VALUES ($1, NOW(), false, $2)
     ON CONFLICT (thread_id) DO NOTHING`,
    [threadId, source]
  );
}

// Log a single message to the DB and handle [[END-CHAT]]
async function logMessage(threadId, role, content, chatDuration) {
  console.log(`📝 Logging ${role} message to database:`, content);
  
  try {
    // Add duration to END-CHAT message if present
    if (content.includes('[[END-CHAT]]')) {
      console.log('⏱️ Adding duration to END-CHAT message:', chatDuration);
      content = `${content} [[DURATION:${chatDuration}]]`;
    }

    // Log message to database with timeout
    const messagePromise = pool.query(
      'INSERT INTO chat_messages (thread_id, role, content) VALUES ($1, $2, $3) RETURNING id',
      [threadId, role, content]
    );
    const messageResult = await Promise.race([
      messagePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      )
    ]);
    console.log('✅ Message logged to database');

    // Check for END-CHAT command
    if (role === 'user' && content.includes('[[END-CHAT]]')) {
      console.log('🔄 END-CHAT command detected, updating thread completion');
      
      // Update thread completion with timeout
      const updatePromise = pool.query(
        'UPDATE chat_threads SET completed = true, ended_at = NOW() WHERE thread_id = $1',
        [threadId]
      );
      await Promise.race([
        updatePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);
      console.log('✅ Thread marked as completed');

      // Trigger Retool workflow with timeout
      const workflowUrl = process.env.RETOOL_WORKFLOW_URL;
      const apiKey = process.env.RETOOL_API_KEY;

      if (!workflowUrl || !apiKey) {
        console.error('❌ Missing Retool configuration:', {
          hasWorkflowUrl: !!workflowUrl,
          hasApiKey: !!apiKey
        });
        return;
      }

      try {
        console.log('🔄 Triggering Retool workflow');
        console.log('Using workflow URL:', workflowUrl);
        
        // Use the exact API key format from the working curl command
        const fullApiKey = 'retool_wk_28d06c84031645d8b74225b3e75ae834';
        console.log('API Key format:', {
          key: fullApiKey.substring(0, 10) + '...' + fullApiKey.substring(fullApiKey.length - 4),
          length: fullApiKey.length
        });
        
        const headers = {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'X-Workflow-Api-Key': fullApiKey
        };
        
        // Log the exact request we're about to make
        console.log('Making request with:', {
          url: workflowUrl,
          method: 'POST',
          headers: {
            'Content-Type': headers['Content-Type'],
            'Accept': headers['Accept'],
            'Cache-Control': headers['Cache-Control'],
            'X-Workflow-Api-Key': headers['X-Workflow-Api-Key'] ? 'Present' : 'Missing'
          },
          body: {
            thread_id: threadId,
            message: content,
            chat_duration: chatDuration
          }
        });
        
        const webhookPromise = fetch(workflowUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            thread_id: threadId,
            message: content,
            chat_duration: chatDuration
          })
        });

        const response = await Promise.race([
          webhookPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Webhook timeout')), 10000)
          )
        ]);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No error details available');
          throw new Error(`Webhook failed with status ${response.status}. Details: ${errorText}`);
        }

        console.log('✅ Retool workflow triggered successfully');
      } catch (error) {
        console.error('❌ Failed to trigger Retool workflow:', error);
        console.error('Request details:', {
          url: workflowUrl,
          hasApiKey: !!apiKey,
          responseStatus: error.status || 'Unknown'
        });
      }
    }
  } catch (error) {
    console.error('❌ Error in logMessage:', error);
  }
}

// Full assistant interaction
async function handleChatMessage({ userMessage, threadId, chatDuration, botType }) {
  // Get or store bot type for this thread
  if (!threadId && botType) {
    // New thread - store the bot type
    console.log(`New thread with bot type: ${botType}`);
  } else if (threadId && !threadBotTypes.has(threadId) && botType) {
    // Existing thread but no stored type - store it
    console.log(`Storing bot type ${botType} for thread ${threadId}`);
    threadBotTypes.set(threadId, botType);
  }
  
  // Get the bot type for this thread
  const currentBotType = threadId ? (threadBotTypes.get(threadId) || 'default') : (botType || 'default');
  console.log(`Using bot type: ${currentBotType} for thread: ${threadId}`);
  
  const assistantId = BOT_ASSISTANTS[currentBotType] || BOT_ASSISTANTS.default;
  const botName = BOT_NAMES[currentBotType] || BOT_NAMES.default;
  
  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    console.log(`✨ Created new OpenAI thread: ${threadId}`);
    // Store the bot type for new thread
    if (botType) {
      threadBotTypes.set(threadId, botType);
    }
    await logThreadStart(threadId);
  }

  await waitForRunCompletion(threadId); // ✅ Ensure no active runs

  console.log(`📤 Sending user message to OpenAI thread: ${userMessage}`);
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: userMessage
  });
  await logMessage(threadId, 'user', userMessage, chatDuration);

  console.log(`⚙️ Starting assistant run on thread: ${threadId} with assistant: ${assistantId}`);
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId
  });

  let runStatus = 'queued';
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds timeout

  while (runStatus !== 'completed' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await openai.beta.threads.runs.retrieve(threadId, run.id);
    runStatus = status.status;
    attempts++;
    
    console.log(`⏱️ Assistant run status: ${runStatus} (Attempt ${attempts}/${maxAttempts})`);
    
    if (runStatus === 'expired' || runStatus === 'failed') {
      console.error(`❌ Run ${run.id} ${runStatus}. Last status:`, status);
      
      // Try to get the last message even if the run expired
      try {
        const messages = await openai.beta.threads.messages.list(threadId);
        const lastAssistantMessage = messages.data.find(m => m.role === 'assistant');
        if (lastAssistantMessage) {
          const assistantReply = lastAssistantMessage?.content?.[0]?.text?.value;
          console.log(`📝 Found last assistant message despite ${runStatus}:`, assistantReply);
          await logMessage(threadId, 'assistant', assistantReply, chatDuration);
          return { 
            threadId, 
            reply: assistantReply,
            botName,
            assistantId,
            botType: currentBotType
          };
        }
      } catch (err) {
        console.error('❌ Failed to retrieve last message:', err);
      }
      
      return { 
        threadId, 
        reply: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        botName,
        assistantId,
        botType: currentBotType
      };
    }
  }

  if (attempts >= maxAttempts) {
    console.error(`❌ Run ${run.id} timed out after ${maxAttempts} seconds`);
    return { 
      threadId, 
      reply: "I apologize, but I'm taking longer than expected to respond. Please try again in a moment.",
      botName,
      assistantId,
      botType: currentBotType
    };
  }

  const messages = await openai.beta.threads.messages.list(threadId);
  const lastAssistantMessage = messages.data.find(m => m.role === 'assistant');
  const assistantReply = lastAssistantMessage?.content?.[0]?.text?.value || 'Sorry, I wasn\'t able to generate a response.';

  console.log(`🤖 Assistant replied: ${assistantReply}`);
  await logMessage(threadId, 'assistant', assistantReply, chatDuration);

  return { 
    threadId, 
    reply: assistantReply,
    botName,
    assistantId,
    botType: currentBotType
  };
}

module.exports = { handleChatMessage };
