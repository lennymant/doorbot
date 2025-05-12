#!/bin/bash
# deploy.sh — Pull latest code, install deps, and restart chatbot

cd /var/www/chatbot || exit
echo "running deploy.sh."

echo "🚀 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "♻️ Restarting chatbot with PM2..."
pm2 restart chatbot

echo "✅ Deployment complete."
