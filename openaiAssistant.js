const { OpenAI } = require('openai');
const { Pool } = require('pg');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pool = new Pool({
  connectionString: process.env.RETOOL_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function logThreadStart(threadId, source = 'website') {
  await pool.query(`
    INSERT INTO chat_threads (thread_id, created_at, completed, source)
    VALUES ($1, NOW(), false, $2)
    ON CONFLICT (thread_id) DO NOTHING
  `, [threadId, source]);
}

async function logMessage(threadId, role, content) {
  await pool.query(`
    INSERT INTO chat_messages (thread_id, role, content, created_at)
    VALUES ($1, $2, $3, NOW())
  `, [threadId, role, content]);

  if (content.includes('[[END-CHAT]]')) {
    await pool.query(`
      UPDATE chat_threads
      SET completed = true, ended_at = NOW()
      WHERE thread_id = $1
    `, [threadId]);
  }
}

async function handleChatMessage({ userMessage, threadId }) {
  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    await logThreadStart(threadId);
  }

  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: userMessage
  });
  await logMessage(threadId, 'user', userMessage);

  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: process.env.ASSISTANT_ID
  });

  let runStatus = 'queued';
  while (runStatus !== 'completed') {
    await new Promise(r => setTimeout(r, 1000));
    const status = await openai.beta.threads.runs.retrieve(threadId, run.id);
    runStatus = status.status;
  }

  const messages = await openai.beta.threads.messages.list(threadId);
  const lastAssistantMessage = messages.data.find(m => m.role === 'assistant');

  const assistantReply = lastAssistantMessage?.content?.[0]?.text?.value || "I'm not sure how to respond.";
  await logMessage(threadId, 'assistant', assistantReply);

  return { threadId, reply: assistantReply };
}

module.exports = { handleChatMessage };
