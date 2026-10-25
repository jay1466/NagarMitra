import TelegramBot from 'node-telegram-bot-api';
import Complaint from '../models/Complaint.js';

let bot = null;

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('⚠️ Telegram bot token not found. Bot is disabled.');
    return null;
  }

  try {
    // Set polling to true to receive incoming messages
    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Telegram bot initialized on polling mode');

    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const resp = `Welcome to NagarMitra, ${msg.from.first_name || 'Citizen'}!\n\nI am your civic assistant. You can use me to directly interact with our smart city platform.\n\nType /help to see what I can do.`;
      bot.sendMessage(chatId, resp);
    });

    bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const resp = `Here are the available commands:\n/start - Start the bot\n/help - Show this help message\n/report - Raise a new civic complaint\n/status - Check your complaint status\n\nVisit our app for the full experience!`;
      bot.sendMessage(chatId, resp);
    });

    bot.onText(/\/report/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, `To report an issue, please reply to this message with a photo of the problem and a short description, or use our mobile app!`);
    });

    bot.onText(/\/(status|track)(?: (.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const complaintId = match[2];
      
      if (!complaintId) {
        return bot.sendMessage(chatId, `Please provide a complaint ID.\nExample: /track NM-W-01-20260321-0001`);
      }

      try {
        const complaint = await Complaint.findOne({ reportId: complaintId.trim() });
        
        if (!complaint) {
          return bot.sendMessage(chatId, `❌ Sorry, I couldn't find any complaint with the ID: ${complaintId}`);
        }

        const statusEmoji = {
          'submitted': '📝',
          'acknowledged': '👀',
          'in_progress': '🚧',
          'resolved': '✅',
          'rejected': '❌'
        }[complaint.status] || '📌';

        const statusString = complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1).replace('_', ' ');

        const resp = `*Complaint Status*\n\n` +
          `*ID:* ${complaint.reportId}\n` +
          `*Category:* ${complaint.category}\n` +
          `*Status:* ${statusEmoji} ${statusString}\n` +
          `*Priority:* ${complaint.priority}\n\n` +
          `*Description:* ${complaint.description}`;
          
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Error fetching complaint status via Telegram:', err);
        bot.sendMessage(chatId, `An error occurred while fetching the status. Please try again later.`);
      }
    });

    bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      // Don't reply to commands again
      if (msg.text && msg.text.startsWith('/')) return;
      
      bot.sendMessage(chatId, `I received your message! However, I am still learning to understand free text. Use /help to see what I can do or visit the main NagarMitra app.`);
    });
    
    // Add error handler so polling errors don't crash the server
    bot.on('polling_error', (error) => {
      console.error('Telegram Polling Error:', error.message);
    });

  } catch (error) {
    console.error('Failed to initialize Telegram bot:', error);
  }

  return bot;
};

export const getBot = () => bot;
