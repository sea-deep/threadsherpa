import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  ChannelType,
} from 'discord.js';

export const setupCommand = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure ThreadSherpa support channels, admin roles, and integrations')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Designate a channel as an official support channel')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
  )
  .addRoleOption(opt =>
    opt.setName('admin_role')
      .setDescription('Authorize a role to approve memory, review candidates, and publish issues')
  )
  .addStringOption(opt =>
    opt.setName('allowed_domain')
      .setDescription('Permit an official documentation domain for investigation fetching (e.g. docs.github.com)')
  )
  .addStringOption(opt =>
    opt.setName('repo')
      .setDescription('Connect a GitHub repository for issues (e.g. owner/repo)')
  )
  .addStringOption(opt =>
    opt.setName('autonomy_mode')
      .setDescription('Set bot autonomy mode')
      .addChoices(
        { name: 'Observe (Listen and recommend only)', value: 'observe' },
        { name: 'Supervised (Investigate on invocation, human oversight)', value: 'supervised' },
        { name: 'Bounded Auto (Answer routine questions automatically)', value: 'auto' }
      )
  );

export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask ThreadSherpa to investigate a technical question or issue')
  .addStringOption(opt =>
    opt.setName('question')
      .setDescription('The question, error message, or troubleshooting report')
      .setRequired(true)
  );

export const caseCommand = new SlashCommandBuilder()
  .setName('case')
  .setDescription('Inspect support case status, findings, and verified evidence')
  .addStringOption(opt =>
    opt.setName('case_id')
      .setDescription('Specific Case ID to inspect (defaults to current thread/channel case)')
      .setRequired(false)
  );

export const teachCommand = new SlashCommandBuilder()
  .setName('teach')
  .setDescription('Teach ThreadSherpa a verified solution or procedure')
  .addStringOption(opt =>
    opt.setName('question')
      .setDescription('Typical question or problem pattern')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('solution')
      .setDescription('Verified canonical answer or troubleshooting steps')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('applies_when')
      .setDescription('Environment, framework, or version precondition (e.g. Node 26, macOS)')
      .setRequired(false)
  );

export const memoryCommand = new SlashCommandBuilder()
  .setName('memory')
  .setDescription('Inspect, search, and manage approved memory')
  .addSubcommand(sub =>
    sub.setName('search')
      .setDescription('Search approved server memory using hybrid retrieval')
      .addStringOption(opt => opt.setName('query').setDescription('Search terms or error string').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List currently approved knowledge items')
  )
  .addSubcommand(sub =>
    sub.setName('pending')
      .setDescription('View knowledge candidates awaiting administrator review')
  )
  .addSubcommand(sub =>
    sub.setName('delete')
      .setDescription('Admin only: remove a knowledge item from memory and search indexes')
      .addStringOption(opt => opt.setName('knowledge_id').setDescription('ID of knowledge item to remove').setRequired(true))
  );

export const issueCommand = new SlashCommandBuilder()
  .setName('issue')
  .setDescription('Prepare a structured GitHub issue draft from a support case')
  .addStringOption(opt =>
    opt.setName('case_id')
      .setDescription('Case ID to draft issue from (defaults to current thread/channel case)')
      .setRequired(false)
  );

export const sourcesCommand = new SlashCommandBuilder()
  .setName('sources')
  .setDescription('View permitted documentation domains and connected GitHub repositories');

export const allCommands = [
  setupCommand,
  askCommand,
  caseCommand,
  teachCommand,
  memoryCommand,
  issueCommand,
  sourcesCommand,
];
