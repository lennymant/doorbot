require('dotenv').config();
const express = require('express');
const { handleChatMessage } = require('./openaiAssistant');

const app = express();
app.use(express.json());

const path = require('path');

// Serve everything in /public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// --- NEW: API Endpoint for Bot Configuration ---
app.get('/api/v1/bot-config', (req, res) => {
  try {
    // Construct the map from environment variables
    // IMPORTANT: Add keys here for *all* your bot types (e.g., 'mikes')
    // and ensure corresponding BOT_NAME_... variables exist in .env
    const botNamesMap = {
      default: process.env.BOT_NAME_DEFAULT || 'Mac', // Fallback if env var missing
      candidate: process.env.BOT_NAME_CANDIDATE || 'Assistant', // Fallback
      // mikes: process.env.BOT_NAME_MIKES || 'Mike S', // Keep this commented if Mike S is not one of the two
    };
    console.log('Sending bot config:', botNamesMap); // Log for debugging
    res.json(botNamesMap);
  } catch (error) {
    console.error('Error fetching bot config:', error);
    res.status(500).json({ error: 'Failed to load bot configuration' });
  }
});

// Add endpoint to serve chatbot URL
app.get('/api/v1/chatbot-url', (req, res) => {
  try {
    const chatbotUrl = process.env.CHATBOT_URL || 'https://doorbot.onrender.com';
    res.json({ url: chatbotUrl });
  } catch (error) {
    console.error('Error fetching chatbot URL:', error);
    res.status(500).json({ error: 'Failed to load chatbot URL' });
  }
});

// Add route for widget.js
app.get("/widget.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Access-Control-Allow-Origin", "*"); // Allow any website to use the widget
  res.sendFile(path.join(__dirname, "public", "widget.js"));
});

app.post('/chat', async (req, res) => {
  const { message, threadId, chatDuration, botType } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    const result = await handleChatMessage({ 
      userMessage: message, 
      threadId,
      chatDuration,
      botType 
    });
    console.log('Chat response:', result); // Debug log
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
