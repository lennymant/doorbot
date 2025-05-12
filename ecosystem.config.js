module.exports = {
    apps: [
      {
        name: 'chatbot',
        script: 'server.js',
        watch: ['.'],
        ignore_watch: ['node_modules', '.git', 'logs'],
        env: {
          PORT: 3000,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          ASSISTANT_ID: process.env.ASSISTANT_ID
        }
      }
    ]
  };
  