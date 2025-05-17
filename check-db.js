require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.RETOOL_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkThreads() {
  try {
    console.log('Environment variables:', {
      ASSISTANT_ID_DEFAULT: process.env.ASSISTANT_ID_DEFAULT,
      ASSISTANT_ID_CANDIDATE: process.env.ASSISTANT_ID_CANDIDATE,
      DB_URL: process.env.RETOOL_DB_URL ? 'Set' : 'Not set'
    });

    const result = await pool.query(
      'SELECT thread_id, assistant_id, created_at FROM chat_threads ORDER BY created_at DESC LIMIT 5'
    );
    console.log('Recent threads:', result.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkThreads(); 