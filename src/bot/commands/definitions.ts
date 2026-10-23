import {
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ChannelType,
} from 'discord.js';

export const setupCommand = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Choose a support channel and reply mode')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Support channel or forum')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement)
  )
  .addChannelOption(opt =>
    opt.setName('remove_channel')
      .setDescription('Stop helping in this channel')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement)
  )
  .addRoleOption(opt =>
    opt.setName('admin_role')
      .setDescription('Role allowed to manage saved answers')
  )
  .addStringOption(opt => opt.setName('source_url').setDescription('Official documentation link').setMaxLength(500))
  .addStringOption(opt =>
    opt.setName('autonomy_mode')
      .setDescription('Choose when the bot replies')
      .addChoices(
        { name: 'Quiet: record new posts, no replies', value: 'observe' },
        { name: 'On request: reply to commands and follow-ups', value: 'supervised' },
        { name: 'Automatic: answer new support questions', value: 'auto' }
      )
  );

export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask a question')
  .addStringOption(opt =>
    opt.setName('question')
      .setDescription('What do you need help with?')
      .setMaxLength(2000)
      .setRequired(true)
  );

export const teachCommand = new SlashCommandBuilder()
  .setName('teach')
  .setDescription('Save knowledge for future questions')
  .addStringOption(opt =>
    opt.setName('question')
      .setDescription('Question')
      .setMaxLength(200)
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('solution')
      .setDescription('Answer to learn from')
      .setMaxLength(3500)
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('applies_when')
      .setDescription('Scope, such as event or version (optional)')
      .setMaxLength(200)
      .setRequired(false)
  )
  .addStringOption(opt => opt.setName('source_url').setDescription('Link to the original answer or official source').setMaxLength(500))
  .addIntegerOption(opt => opt.setName('valid_days').setDescription('Expire after this many days').setMinValue(1).setMaxValue(365));

export const answersCommand = new SlashCommandBuilder().setName('answers').setDescription('Find or edit saved knowledge')
  .addStringOption(opt => opt.setName('query').setDescription('Search reviewed answers').setMaxLength(200));
export const memoryCommand = new SlashCommandBuilder().setName('memory').setDescription('Manage saved answers and import FAQs')
  .addStringOption(opt => opt.setName('query').setDescription('Find a saved question or answer').setMaxLength(200));

export const queueCommand = new SlashCommandBuilder().setName('queue').setDescription('See questions that need help');
export const sourcesCommand = new SlashCommandBuilder().setName('sources').setDescription('See documentation sources');
export const statsCommand = new SlashCommandBuilder().setName('stats').setDescription('See questions and solves');
export const saveAnswerCommand = new ContextMenuCommandBuilder().setName('Save this answer').setType(ApplicationCommandType.Message);
export const allCommands = [setupCommand, askCommand, teachCommand, answersCommand, memoryCommand, queueCommand, sourcesCommand, statsCommand, saveAnswerCommand];
