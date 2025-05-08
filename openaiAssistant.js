// openaiAssistant.js
require('dotenv').config();
const { OpenAI } = require('openai');
const { Pool } = require('pg');
const fetch = require('node-fetch');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  console.log(`📝 Logging message to DB: ${role} | ${content} | Duration: ${chatDuration}s`);
  
  // Add duration to the message content if it's an END-CHAT message
  let messageContent = content;
  if ((content || '').toUpperCase().includes('[[END-CHAT]]')) {
    messageContent = `${content} [[DURATION:${chatDuration}]]`;
    console.log(`⏱️ Added duration to END-CHAT message: ${messageContent}`);
  }

  // Log the message to the database
  await pool.query(
    `INSERT INTO chat_messages (thread_id, role, content, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [threadId, role, messageContent]
  );

  // Check if this is an END-CHAT message from the user
  const isEndChat = role === 'user' && (content || '').toUpperCase().includes('[[END-CHAT]]');
  console.log(`🔍 Checking for END-CHAT: role=${role}, isEndChat=${isEndChat}`);

  if (isEndChat) {
    console.log(`🔚 END-CHAT detected for thread: ${threadId}`);

    try {
      // Update thread status
      await pool.query(
        `UPDATE chat_threads
         SET completed = true, ended_at = NOW()
         WHERE thread_id = $1`,
        [threadId]
      );
      console.log(`✅ Updated thread status for: ${threadId}`);

      // Trigger Retool Workflow webhook
      const workflowUrl = process.env.RETOOL_WORKFLOW_URL;
      const retoolKey = process.env.RETOOL_API_KEY;

      if (!workflowUrl || !retoolKey) {
        console.error('❌ Missing workflow configuration:', {
          hasUrl: !!workflowUrl,
          hasKey: !!retoolKey
        });
        return;
      }

      console.log('🚀 Triggering Retool webhook...');
      console.log('🔑 RETOOL_API_KEY present:', !!retoolKey);
      console.log('🌐 RETOOL_WORKFLOW_URL:', workflowUrl);

      const webhookRes = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workflow-Api-Key': retoolKey
        },
        body: JSON.stringify({
          thread_id: threadId,
          message: messageContent,
          chat_duration: chatDuration,
          triggered_at: new Date().toISOString()
        })
      });

      const responseText = await webhookRes.text();
      console.log(`✅ Retool webhook POST status: ${webhookRes.status}`);
      console.log(`📦 Retool webhook response: ${responseText}`);

      if (!webhookRes.ok) {
        console.error('❌ Retool webhook failed:', {
          status: webhookRes.status,
          response: responseText
        });
      }
    } catch (err) {
      console.error('❌ Failed to process END-CHAT:', err);
    }
  }
}

// Full assistant interaction
async function handleChatMessage({ userMessage, threadId, chatDuration }) {
  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    console.log(`✨ Created new OpenAI thread: ${threadId}`);
    await logThreadStart(threadId);
  }

  await waitForRunCompletion(threadId); // ✅ Ensure no active runs

  console.log(`📤 Sending user message to OpenAI thread: ${userMessage}`);
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: userMessage
  });
  await logMessage(threadId, 'user', userMessage, chatDuration);

  console.log(`⚙️ Starting assistant run on thread: ${threadId}`);
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: process.env.ASSISTANT_ID
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
          return { threadId, reply: assistantReply };
        }
      } catch (err) {
        console.error('❌ Failed to retrieve last message:', err);
      }
      
      return { 
        threadId, 
        reply: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment." 
      };
    }
  }

  if (attempts >= maxAttempts) {
    console.error(`❌ Run ${run.id} timed out after ${maxAttempts} seconds`);
    return { 
      threadId, 
      reply: "I apologize, but I'm taking longer than expected to respond. Please try again in a moment." 
    };
  }

  const messages = await openai.beta.threads.messages.list(threadId);
  const lastAssistantMessage = messages.data.find(m => m.role === 'assistant');
  const assistantReply = lastAssistantMessage?.content?.[0]?.text?.value || 'Sorry, I wasn\'t able to generate a response.';

  console.log(`🤖 Assistant replied: ${assistantReply}`);
  await logMessage(threadId, 'assistant', assistantReply, chatDuration);

  return { threadId, reply: assistantReply };
}

module.exports = { handleChatMessage };
