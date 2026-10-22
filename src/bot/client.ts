import {
  Client,
  GatewayIntentBits,
  Partials,
  Interaction,
  Message,
  ThreadChannel,
} from 'discord.js';
import { BotInteractionRouter } from './handlers/router.js';
import { registerCommands } from './commands/register.js';
import { logger } from '../utils/logger.js';

export interface BotClientOptions {
  token: string;
  clientId: string;
  devGuildId?: string;
  router: BotInteractionRouter;
}

export function createBotClient(options: BotClientOptions): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.once('ready', async (c) => {
    logger.info({ tag: c.user.tag, id: c.user.id }, 'ThreadSherpa Discord bot connected and ready');

    // Register commands on ready
    try {
      await registerCommands({
        token: options.token,
        clientId: options.clientId,
        guildId: options.devGuildId,
      });
    } catch (err) {
      logger.warn({ err }, 'Command auto-registration failed during startup');
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await options.router.handleCommand(interaction);
      } else if (interaction.isButton()) {
        await options.router.handleButton(interaction);
      }
    } catch (err) {
      logger.error({ err, interactionId: interaction.id }, 'Unhandled error in interaction handler');
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An unexpected internal error occurred while processing this interaction.', ephemeral: true }).catch(() => {});
      }
    }
  });

  client.on('messageCreate', async (message: Message) => {
    try {
      await options.router.handleMessage(message);
    } catch (err) {
      logger.error({ err, messageId: message.id }, 'Unhandled error in message monitoring handler');
    }
  });

  client.on('threadCreate', async (thread: ThreadChannel) => {
    try {
      await options.router.handleThreadCreate(thread);
    } catch (err) {
      logger.error({ err, threadId: thread.id }, 'Unhandled error in thread create handler');
    }
  });

  return client;
}
