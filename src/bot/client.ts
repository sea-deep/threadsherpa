import {
  Client,
  Events,
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
  clientId?: string;
  devGuildId?: string;
  router: BotInteractionRouter;
}

export function createBotClient(options: BotClientOptions): Client {
  const client = new Client({
    allowedMentions: { parse: [], repliedUser: false },
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, id: c.user.id }, 'ThreadSherpa Discord bot connected and ready');

    // Register commands on ready
    try {
      await registerCommands({
        token: options.token,
        clientId: c.application.id,
        guildId: options.devGuildId || (c.guilds.cache.size === 1 ? c.guilds.cache.first()?.id : undefined),
      });
    } catch (err) {
      logger.warn({ err }, 'Command auto-registration failed during startup');
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await options.router.handleCommand(interaction);
      } else if (interaction.isMessageContextMenuCommand()) {
        await options.router.handleContextMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await options.router.handleModal(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await options.router.handleSelect(interaction);
      } else if (interaction.isButton()) {
        await options.router.handleButton(interaction);
      }
    } catch (err) {
      logger.error({ err, interactionId: interaction.id }, 'Unhandled error in interaction handler');
      if (interaction.isRepliable() && interaction.deferred) {
        await interaction.editReply({ content: 'Couldn’t finish. Try again.' }).catch(() => {});
      } else if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({ content: 'Couldn’t finish. Try again.', ephemeral: true }).catch(() => {});
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
