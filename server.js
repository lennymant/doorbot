require('dotenv').config();
const express = require('express');
const { handleChatMessage } = require('./openaiAssistant');

const app = express();
app.use(express.json());

const path = require('path');

// Serve everything in /public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));


app.post('/chat', async (req, res) => {
  const { message, threadId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    const result = await handleChatMessage({ userMessage: message, threadId });
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
