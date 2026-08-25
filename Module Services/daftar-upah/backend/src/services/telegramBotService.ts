import { Bot } from "grammy";
import { info, warn, error as logError } from "../utils/logger";

const CATEGORY = "Telegram";

export interface TelegramConfig {
  token: string;
  chatIds?: string[];
}

class TelegramBotService {
  private static instance: TelegramBotService;
  private bot: Bot | null = null;
  private config: TelegramConfig | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  initialize(config: TelegramConfig) {
    if (!config.token) {
      warn(CATEGORY, "No token provided, bot disabled");
      return;
    }

    this.config = config;
    this.bot = new Bot(config.token);

    // Handle /start command
    this.bot.command("start", (ctx) =>
      ctx.reply("Halo! Saya adalah bot notifikasi Daftar Upah Portal.")
    );

    // Handle /help command
    this.bot.command("help", (ctx) =>
      ctx.reply(
        "Perintah tersedia:\n" +
        "/start - Memulai bot\n" +
        "/help - Menampilkan bantuan\n" +
        "/status - Cek status sistem"
      )
    );

    // Handle /status command
    this.bot.command("status", (ctx) =>
      ctx.reply("Sistem berjalan normal ✓")
    );

    // Handle any message
    this.bot.on("message", (ctx) => {
      info(CATEGORY, "Received message:", ctx.message.text);
    });

    info(CATEGORY, "Bot initialized");
  }

  async sendMessage(message: string, parseMode?: "HTML" | "Markdown") {
    if (!this.bot || !this.config) {
      warn(CATEGORY, "Bot not initialized");
      return;
    }

    try {
      if (this.config.chatIds && this.config.chatIds.length > 0) {
        for (const chatId of this.config.chatIds) {
          await this.bot.api.sendMessage(chatId, message, {
            parse_mode: parseMode || "HTML",
          });
        }
      }
      info(CATEGORY, "Message sent successfully");
    } catch (error) {
      logError(CATEGORY, "Failed to send message:", error);
    }
  }

  async start() {
    if (!this.bot) {
      warn(CATEGORY, "Bot not initialized");
      return;
    }

    if (this.isRunning) {
      info(CATEGORY, "Bot already running");
      return;
    }

    this.isRunning = true;
    info(CATEGORY, "Bot started");

    // Start bot in background (non-blocking)
    this.bot.start({
      onStart: (botInfo) => {
        info(CATEGORY, `Bot @${botInfo.username} is running`);
      }
    });
  }

  stop() {
    if (this.bot) {
      this.bot.stop();
      this.isRunning = false;
      info(CATEGORY, "Bot stopped");
    }
  }
}

export const telegramBot = TelegramBotService.getInstance();

// Also export a simple notification function for easy use
export async function sendTelegramNotification(
  message: string,
  parseMode: "HTML" | "Markdown" = "HTML"
) {
  telegramBot.sendMessage(message, parseMode);
}
