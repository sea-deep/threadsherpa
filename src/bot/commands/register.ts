import { REST, Routes } from 'discord.js';
import { allCommands } from './definitions.js';
import { logger } from '../../utils/logger.js';

export async function registerCommands(options: {
  token: string;
  clientId: string;
  guildId?: string;
}): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(options.token);
  const commandData = allCommands.map(cmd => cmd.toJSON());

  try {
    logger.info({ count: commandData.length, guildId: options.guildId }, 'Registering Discord slash commands');

    if (options.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(options.clientId, options.guildId),
        { body: commandData }
      );
      logger.info({ guildId: options.guildId }, 'Successfully registered guild slash commands');
    } else {
      await rest.put(
        Routes.applicationCommands(options.clientId),
        { body: commandData }
      );
      logger.info('Successfully registered global slash commands');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to register Discord slash commands');
    throw err;
  }
}
