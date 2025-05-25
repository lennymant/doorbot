require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const { handleChatMessage } = require('./openaiAssistant');
const getUpcomingEvents = require('./functions/getUpcomingEvents');

const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// --- BOT CONFIG ---
app.get('/api/v1/bot-config', (req, res) => {
  try {
    const botNamesMap = {
      default: process.env.BOT_NAME_DEFAULT || 'Mac',
      candidate: process.env.BOT_NAME_CANDIDATE || 'Mike S',
    };
    console.log('Sending bot config:', botNamesMap);
    res.json(botNamesMap);
  } catch (error) {
    console.error('Error fetching bot config:', error);
    res.status(500).json({ error: 'Failed to load bot configuration' });
  }
});

// --- CHATBOT URL ---
app.get('/api/v1/chatbot-url', (req, res) => {
  try {
    const chatbotUrl = process.env.CHATBOT_URL || 'https://sandbox.preview3.co.uk';
    res.json({ url: chatbotUrl });
  } catch (error) {
    console.error('Error fetching chatbot URL:', error);
    res.status(500).json({ error: 'Failed to load chatbot URL' });
  }
});

// --- WIDGET JS ---
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

// --- CHAT ENTRY POINT ---
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
      botType,
    });
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// --- TOOL CALL HANDLER ---
app.post('/api/v1/tool-call', async (req, res) => {
  const { tool_call_id, function_name, arguments: args, run_id, thread_id } = req.body;

  if (!tool_call_id || !function_name || !args || !run_id || !thread_id) {
    return res.status(400).json({ error: 'Missing required tool call parameters' });
  }

  console.log(`🔧 Tool call received: ${function_name}`, { args });

  try {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

    let output;
    switch (function_name) {
      case 'getUpcomingEvents':
        output = await getUpcomingEvents(parsedArgs);
        break;
      default:
        return res.status(400).json({ error: `Unknown function: ${function_name}` });
    }

    const toolOutput = {
      tool_outputs: [
        {
          tool_call_id,
          output: JSON.stringify(output)
        }
      ]
    };

    const response = await openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, toolOutput);
    console.log('✅ Tool output submitted:');
    res.json(response);

  } catch (err) {
    console.error('❌ Tool handler error:', err);
    res.status(500).json({ error: 'Failed to process tool call' });
  }
});

// Create a new event
app.post("/api/events", (req, res) => {
  const { name, date, maxDays, maxTickets, ticketPrice, type } = req.body;

  // Validate required fields
  if (!name || !date || !maxDays || !maxTickets || !ticketPrice || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const event = {
    id: Date.now().toString(),
    name,
    date,
    maxDays,
    maxTickets,
    ticketPrice,
    type,
    tickets: [],
  };

  events.push(event);
  res.status(201).json(event);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
