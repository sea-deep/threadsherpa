import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  Message,
  ThreadChannel,
  ChannelType,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { GuildConfigRepository } from '../../database/repositories/guild-config.repo.js';
import { CaseRepository } from '../../database/repositories/case.repo.js';
import { EvidenceRepository } from '../../database/repositories/evidence.repo.js';
import { KnowledgeRepository } from '../../database/repositories/knowledge.repo.js';
import { AgentOrchestrator } from '../../agent/orchestrator.js';
import { LearningPipeline } from '../../memory/learner.js';
import { GitHubCopilot } from '../../agent/github-copilot.js';
import { IncidentDetector } from '../../agent/incident-detector.js';
import {
  buildCaseEmbed,
  buildCandidateReviewCard,
  buildIssueDraftCard,
  buildIncidentCard,
} from '../ui/embeds.js';
import { logger } from '../../utils/logger.js';

export class BotInteractionRouter {
  constructor(
    private guildRepo: GuildConfigRepository,
    private caseRepo: CaseRepository,
    private evidenceRepo: EvidenceRepository,
    private knowledgeRepo: KnowledgeRepository,
    private orchestrator: AgentOrchestrator,
    private learningPipeline: LearningPipeline,
    private githubCopilot: GitHubCopilot,
    private incidentDetector: IncidentDetector
  ) {}

  private isAuthorizedAdmin(interaction: ChatInputCommandInteraction | ButtonInteraction): boolean {
    const member = interaction.member as GuildMember | null;
    if (!member) return false;
    if (member.permissions && typeof member.permissions.has === 'function' && member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    const roleIds = member.roles?.cache
      ? Array.from(member.roles.cache.values()).map((r: any) => r.id || r)
      : [];
    return this.guildRepo.isAdmin(interaction.guildId || '', roleIds);
  }

  async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'ThreadSherpa commands can only be executed inside a Discord server.', ephemeral: true });
      return;
    }

    const { commandName } = interaction;
    logger.info({ commandName, guildId, user: interaction.user.tag }, 'Received slash command');

    switch (commandName) {
      case 'setup':
        await this.handleSetup(interaction);
        break;
      case 'ask':
        await this.handleAsk(interaction);
        break;
      case 'case':
        await this.handleCase(interaction);
        break;
      case 'teach':
        await this.handleTeach(interaction);
        break;
      case 'memory':
        await this.handleMemory(interaction);
        break;
      case 'issue':
        await this.handleIssue(interaction);
        break;
      case 'sources':
        await this.handleSources(interaction);
        break;
      default:
        await interaction.reply({ content: `Unknown command: ${commandName}`, ephemeral: true });
    }
  }

  private async handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isAuthorizedAdmin(interaction)) {
      await interaction.reply({ content: '❌ You do not have permission to configure ThreadSherpa. Requires Server Administrator or authorized role.', ephemeral: true });
      return;
    }

    const guildId = interaction.guildId!;
    const channel = interaction.options.getChannel('channel');
    const removeChannel = interaction.options.getChannel('remove_channel');
    const adminRole = interaction.options.getRole('admin_role');
    const allowedDomain = interaction.options.getString('allowed_domain');
    const repo = interaction.options.getString('repo');
    const autonomyMode = interaction.options.getString('autonomy_mode') as 'observe' | 'supervised' | 'auto' | null;

    const currentConfig = this.guildRepo.get(guildId);
    const supportChannels = new Set(currentConfig?.support_channel_ids || []);
    const adminRoles = new Set(currentConfig?.admin_role_ids || []);
    const allowedDomains = new Set(currentConfig?.allowed_domains || []);
    const connectedRepos = new Set(currentConfig?.connected_repos || []);

    if (channel) supportChannels.add(channel.id);
    if (removeChannel) supportChannels.delete(removeChannel.id);
    if (adminRole) adminRoles.add(adminRole.id);
    if (allowedDomain) allowedDomains.add(allowedDomain.toLowerCase().trim());
    if (repo) connectedRepos.add(repo.trim());

    const updated = this.guildRepo.upsert({
      guild_id: guildId,
      autonomy_mode: autonomyMode || currentConfig?.autonomy_mode || 'supervised',
      support_channel_ids: Array.from(supportChannels),
      admin_role_ids: Array.from(adminRoles),
      allowed_domains: Array.from(allowedDomains),
      connected_repos: Array.from(connectedRepos),
    });

    const isConfigured = updated.support_channel_ids.length > 0;
    const setupNotice = isConfigured
      ? '✅ **ThreadSherpa Active**: Monitoring configured support channels, forum channels, and threads.'
      : '⚠️ **Setup Incomplete**: No support channels designated. Add a channel with `/setup channel: #channel` before automatic scanning begins.';

    const summary = [
      '### ⚙️ ThreadSherpa Server Configuration',
      setupNotice,
      `• **Autonomy Mode**: \`${updated.autonomy_mode}\``,
      `• **Monitored Support Channels**: ${updated.support_channel_ids.map(id => `<#${id}>`).join(', ') || '*None*' }`,
      `• **Admin Roles**: ${updated.admin_role_ids.map(id => `<@&${id}>`).join(', ') || '*Server Admins only*' }`,
      `• **Allowed Doc Domains**: ${updated.allowed_domains.map(d => `\`${d}\``).join(', ') || '*None*' }`,
      `• **Connected Repositories**: ${updated.connected_repos.map(r => `\`${r}\``).join(', ') || '*None*' }`,
    ].join('\n');

    await interaction.reply({ content: summary, ephemeral: true });
  }

  private async handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const guildId = interaction.guildId!;

    // Defer reply immediately to satisfy Discord's 3-second deadline
    await interaction.deferReply();

    const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCase = this.caseRepo.create({
      case_id: caseId,
      guild_id: guildId,
      channel_id: interaction.channelId,
      message_id: interaction.id,
      requester_id: interaction.user.id,
      requester_username: interaction.user.username,
      category: 'general',
      title: question,
      status: 'new',
      summary: question,
    });

    // Check for potential shared incident
    const clusterResult = this.incidentDetector.detectCluster(newCase);

    // Run investigation
    const invResult = await this.orchestrator.investigateCase(caseId);
    const updatedCase = this.caseRepo.get(caseId)!;
    const evidence = this.evidenceRepo.getByCaseId(caseId);

    const embed = buildCaseEmbed(updatedCase, evidence);
    await interaction.editReply({ embeds: [embed] });

    // If an incident cluster was identified, notify
    if (clusterResult.clusterFound && clusterResult.incident && clusterResult.isNewIncident) {
      const card = buildIncidentCard(clusterResult.incident);
      await interaction.followUp({ embeds: [card.embed], components: [card.row] });
    }
  }

  private async handleCase(interaction: ChatInputCommandInteraction): Promise<void> {
    const caseIdOption = interaction.options.getString('case_id');
    const updateContext = interaction.options.getString('update_context');
    const action = interaction.options.getString('action');

    const isThread = interaction.channel?.isThread();
    const parentId = isThread ? interaction.channel.parentId : null;
    const threadId = isThread ? interaction.channelId : undefined;

    const caseId = caseIdOption || this.caseRepo.findActiveCase(parentId || interaction.channelId, threadId)?.case_id;

    if (!caseId) {
      await interaction.reply({ content: 'No active support case found in this channel or thread. Specify a `case_id`.', ephemeral: true });
      return;
    }

    let c = this.caseRepo.get(caseId);
    if (!c || c.guild_id !== interaction.guildId) {
      await interaction.reply({ content: `Case \`${caseId}\` not found.`, ephemeral: true });
      return;
    }

    // 1. If context update provided, update case summary and record evidence
    if (updateContext && updateContext.trim().length > 0) {
      const author = interaction.user.username;
      const note = `[Context Update from @${author}]: ${updateContext.trim()}`;
      const updatedSummary = `${c.summary || c.title}\n\n${note}`.slice(0, 3000);
      c = this.caseRepo.updateSummary(caseId, updatedSummary)!;

      this.evidenceRepo.add({
        evidence_id: `ev_ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        case_id: caseId,
        source_type: 'discord_message',
        source_url: `discord://interaction/${interaction.id}`,
        title: `Manual Context Update by ${author}`,
        excerpt: updateContext.trim().slice(0, 500),
        authority_score: 0.8,
        metadata: { subtype: 'user_context', updated_by: author },
      });
    }

    // 2. Perform requested action
    if (action === 'resolve') {
      c = this.caseRepo.updateStatus(caseId, 'resolved', 'Marked resolved via /case')!;
    } else if (action === 'close') {
      c = this.caseRepo.updateStatus(caseId, 'closed', 'Closed via /case')!;
    } else if (action === 'reinvestigate') {
      if (typeof interaction.deferReply === 'function') {
        await interaction.deferReply();
      }
      await this.orchestrator.investigateCase(caseId);
      c = this.caseRepo.get(caseId)!;
      const evidence = this.evidenceRepo.getByCaseId(caseId);
      const embed = buildCaseEmbed(c, evidence);
      if (typeof interaction.editReply === 'function') {
        await interaction.editReply({
          content: updateContext ? '📝 **Case Context Updated & Re-investigated**' : '🔄 **Case Re-investigated**',
          embeds: [embed],
        });
      }
      return;
    }

    const evidence = this.evidenceRepo.getByCaseId(caseId);
    const embed = buildCaseEmbed(c, evidence);
    await interaction.reply({
      content: updateContext ? '📝 **Case Context Successfully Updated**' : undefined,
      embeds: [embed],
    });
  }

  private async handleTeach(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isAuthorizedAdmin(interaction)) {
      await interaction.reply({ content: '❌ You must be an authorized support administrator to teach ThreadSherpa.', ephemeral: true });
      return;
    }

    const question = interaction.options.getString('question', true);
    const solution = interaction.options.getString('solution', true);
    const appliesWhen = interaction.options.getString('applies_when');

    await interaction.deferReply({ ephemeral: true });

    const result = await this.learningPipeline.proposeFromAdminMessage({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      adminUserId: interaction.user.id,
      adminMessage: solution,
      caseContext: { originalQuestion: question },
    });

    const card = buildCandidateReviewCard(result.candidate, result.conflictingItems);
    await interaction.editReply({
      content: '✅ Extracted structured knowledge candidate. Confirm review below:',
      embeds: [card.embed],
      components: [card.row],
    });
  }

  private async handleMemory(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === 'search') {
      const query = interaction.options.getString('query', true);
      await interaction.deferReply();
      const results = this.knowledgeRepo.searchLexical(guildId, query, 5);

      if (results.length === 0) {
        await interaction.editReply({ content: `No approved knowledge found matching "${query}".` });
        return;
      }

      const list = results.map((item, idx) => `**${idx + 1}. [v${item.current_version}] ${item.question_patterns[0]}**\n> ${item.canonical_answer.slice(0, 200)}...\n*ID: \`${item.knowledge_id}\`*`).join('\n\n');
      await interaction.editReply({ content: `### 🧠 Memory Search Results for "${query}"\n\n${list}` });
    } else if (subcommand === 'list') {
      const items = this.knowledgeRepo.getApproved(guildId);
      if (items.length === 0) {
        await interaction.reply({ content: 'No approved knowledge items stored yet. Teach the bot with `/teach` or resolve cases!', ephemeral: true });
        return;
      }

      const list = items.slice(0, 8).map(item => `• **${item.question_patterns[0]}** (v${item.current_version})\n  *Answer*: ${item.canonical_answer.slice(0, 100)}... (\`${item.knowledge_id}\`)`).join('\n');
      await interaction.reply({ content: `### 📚 Approved Knowledge Items (${items.length} total)\n\n${list}`, ephemeral: true });
    } else if (subcommand === 'pending') {
      const pending = this.knowledgeRepo.getPendingCandidates(guildId);
      if (pending.length === 0) {
        await interaction.reply({ content: 'No pending knowledge candidates awaiting review.', ephemeral: true });
        return;
      }

      const list = pending.map(p => `• **${p.knowledge_id}**: "${p.question_patterns[0]}"\n  *Proposed Answer*: ${p.canonical_answer.slice(0, 100)}...`).join('\n');
      await interaction.reply({ content: `### ⏳ Pending Knowledge Candidates (${pending.length})\n\n${list}`, ephemeral: true });
    } else if (subcommand === 'delete') {
      if (!this.isAuthorizedAdmin(interaction)) {
        await interaction.reply({ content: '❌ Only administrators can delete knowledge items.', ephemeral: true });
        return;
      }
      const knowledgeId = interaction.options.getString('knowledge_id', true);
      const deleted = this.knowledgeRepo.delete(knowledgeId);
      if (deleted) {
        await interaction.reply({ content: `✅ Knowledge item \`${knowledgeId}\` has been marked deleted and purged from active search indexes.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Knowledge item \`${knowledgeId}\` not found.`, ephemeral: true });
      }
    }
  }

  private async handleIssue(interaction: ChatInputCommandInteraction): Promise<void> {
    const caseIdOption = interaction.options.getString('case_id');
    const caseId = caseIdOption || this.caseRepo.findActiveCase(interaction.channelId)?.case_id;

    if (!caseId) {
      await interaction.reply({ content: 'No active support case found in this channel. Specify a `case_id`.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const { link } = await this.githubCopilot.prepareDraft(caseId, interaction.user.id);
      const card = buildIssueDraftCard(link);
      await interaction.editReply({ embeds: [card.embed], components: [card.row] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply({ content: `❌ Failed to prepare GitHub issue draft: ${msg}` });
    }
  }

  private async handleSources(interaction: ChatInputCommandInteraction): Promise<void> {
    const config = this.guildRepo.get(interaction.guildId!);
    const domains = config?.allowed_domains || [];
    const repos = config?.connected_repos || [];

    const text = [
      '### 🌐 Configured Documentation & Source Allowlist',
      `• **Allowed Documentation Domains**: ${domains.map(d => `\`${d}\``).join(', ') || '*None (web fetching disabled)*'}`,
      `• **Connected GitHub Repositories**: ${repos.map(r => `\`${r}\``).join(', ') || '*None connected*'}`,
    ].join('\n');

    await interaction.reply({ content: text, ephemeral: true });
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [action, targetId] = interaction.customId.split(':');
    logger.info({ action, targetId, user: interaction.user.tag }, 'Received button interaction');

    if (action === 'approve_know') {
      if (!this.isAuthorizedAdmin(interaction)) {
        await interaction.reply({ content: '❌ Only authorized support administrators can approve knowledge.', ephemeral: true });
        return;
      }
      const approved = this.learningPipeline.approveCandidate(targetId, interaction.user.id);
      if (approved) {
        await interaction.update({
          content: `✅ **Knowledge Approved & Indexed** by <@${interaction.user.id}>. This resolution is now part of ThreadSherpa's persistent memory and will be applied to future inquiries.`,
          components: [],
        });
      }
    } else if (action === 'reject_know') {
      if (!this.isAuthorizedAdmin(interaction)) {
        await interaction.reply({ content: '❌ Only authorized administrators can reject knowledge candidates.', ephemeral: true });
        return;
      }
      this.learningPipeline.rejectCandidate(targetId, interaction.user.id);
      await interaction.update({
        content: `❌ **Knowledge Candidate Rejected** by <@${interaction.user.id}>. Candidate will not be used in retrieval.`,
        components: [],
      });
    } else if (action === 'publish_gh') {
      if (!this.isAuthorizedAdmin(interaction)) {
        await interaction.reply({ content: '❌ Only authorized administrators can publish GitHub issues.', ephemeral: true });
        return;
      }
      await interaction.deferUpdate();
      try {
        const link = await this.githubCopilot.publishIssue(targetId, interaction.user.id);
        await interaction.editReply({
          content: `🎉 **GitHub Issue Successfully Created!**\nIssue #${link.issue_number}: [${link.draft_title}](${link.issue_url})`,
          components: [],
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.followUp({ content: `❌ Failed to publish GitHub issue: ${msg}`, ephemeral: true });
      }
    } else if (action === 'confirm_inc') {
      if (!this.isAuthorizedAdmin(interaction)) {
        await interaction.reply({ content: '❌ Only administrators can confirm incidents.', ephemeral: true });
        return;
      }
      this.incidentDetector.confirmIncident(targetId, interaction.user.id);
      await interaction.update({
        content: `🚨 **Incident Confirmed** by <@${interaction.user.id}>. Further similar reports will be grouped under this incident.`,
        components: [],
      });
    } else if (action === 'resolve_inc') {
      if (!this.isAuthorizedAdmin(interaction)) {
        await interaction.reply({ content: '❌ Only administrators can resolve incidents.', ephemeral: true });
        return;
      }
      this.incidentDetector.resolveIncident(targetId, interaction.user.id);
      await interaction.update({
        content: `✅ **Incident Marked Resolved** by <@${interaction.user.id}>.`,
        components: [],
      });
    }
  }

  async handleThreadCreate(thread: ThreadChannel): Promise<void> {
    if (!thread.guildId) return;

    // 1. One-time setup & support channel check:
    // Only monitor if this thread or its parent (Forum or Text channel) is in support_channel_ids
    if (!this.guildRepo.isSupportChannel(thread.guildId, thread.id, thread.parentId)) {
      return;
    }

    logger.info({ threadId: thread.id, parentId: thread.parentId, name: thread.name }, 'New support thread/forum post detected');

    // 2. Avoid duplicate cases if already registered
    const existingCase = this.caseRepo.getByThreadId(thread.id);
    if (existingCase) return;

    // 3. In Forum channels or text threads, fetch starter message if available
    let starterMessage = await thread.fetchStarterMessage().catch(() => null);
    if (!starterMessage) {
      await new Promise(r => setTimeout(r, 1000));
      starterMessage = await thread.fetchStarterMessage().catch(() => null);
    }

    const questionTitle = thread.name || starterMessage?.content?.slice(0, 100) || 'Support Inquiry';
    const questionContent = starterMessage?.content || thread.name || 'Support Inquiry';
    const requesterId = starterMessage?.author?.id || thread.ownerId || 'unknown_user';
    const requesterUsername = starterMessage?.author?.username || 'user';

    // 4. Create support case
    const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCase = this.caseRepo.create({
      case_id: caseId,
      guild_id: thread.guildId,
      channel_id: thread.parentId || thread.id,
      thread_id: thread.id,
      message_id: starterMessage?.id || thread.id,
      requester_id: requesterId,
      requester_username: requesterUsername,
      category: 'general',
      title: questionTitle,
      status: 'new',
      summary: questionContent,
    });

    // 5. Check incident clustering
    this.incidentDetector.detectCluster(newCase);

    // 6. Check autonomy mode
    const config = this.guildRepo.get(thread.guildId);
    if (config?.autonomy_mode === 'observe') {
      logger.info({ caseId, threadId: thread.id }, 'Observe mode active; skipping automated response in new thread');
      return;
    }

    // 7. Investigate and post response directly into the thread/forum post
    await this.orchestrator.investigateCase(caseId);
    const updated = this.caseRepo.get(caseId)!;
    const evidence = this.evidenceRepo.getByCaseId(caseId);
    const embed = buildCaseEmbed(updated, evidence);

    await Promise.resolve(thread.send({ embeds: [embed] })).catch(err => {
      logger.warn({ err, threadId: thread.id }, 'Failed to post investigation embed to thread');
    });
  }

  async handleMessage(message: Message): Promise<void> {
    // 1. Ignore bots and own messages
    if (message.author?.bot || message.system) return;
    if (!message.guildId) return;

    // 2. Only monitor configured support channels (requires one-time setup)
    const isThread = Boolean(message.channel && typeof message.channel.isThread === 'function' && message.channel.isThread());
    const parentId = isThread && message.channel && 'parentId' in message.channel ? (message.channel.parentId as string | null) : null;

    if (!this.guildRepo.isSupportChannel(message.guildId, message.channelId, parentId)) {
      return;
    }

    logger.debug({ channelId: message.channelId, isThread, author: message.author.tag }, 'Monitoring support channel message');

    const member = message.member;
    const roleIds = member?.roles?.cache
      ? Array.from(member.roles.cache.values()).map((r: any) => r.id || r)
      : [];
    const isAdmin = (member?.permissions && typeof member.permissions.has === 'function' && member.permissions.has(PermissionFlagsBits.Administrator)) || this.guildRepo.isAdmin(message.guildId, roleIds);

    // 3. Resolve active case (in thread or channel)
    const threadId = isThread ? message.channelId : (message.thread?.id || undefined);
    const activeCase = this.caseRepo.findActiveCase(parentId || message.channelId, threadId);

    // 4. Admin learning trigger: If admin replies in an active case, extract knowledge candidate!
    if (isAdmin && activeCase && activeCase.requester_id !== message.author.id && message.content.length > 20) {
      logger.info({ caseId: activeCase.case_id, admin: message.author.tag }, 'Admin response detected in active case — proposing knowledge candidate');

      const result = await this.learningPipeline.proposeFromAdminMessage({
        guildId: message.guildId,
        channelId: message.channelId,
        adminUserId: message.author.id,
        adminMessage: message.content,
        caseContext: {
          title: activeCase.title,
          originalQuestion: activeCase.summary || activeCase.title,
          priorBotAnswer: activeCase.last_answer || undefined,
        },
      });

      const card = buildCandidateReviewCard(result.candidate, result.conflictingItems);
      await message.reply({
        content: `💡 **ThreadSherpa Human-in-the-Loop Learning**\nDetected resolution from support admin <@${message.author.id}>. Review proposed knowledge below:`,
        embeds: [card.embed],
        components: [card.row],
      });

      return;
    }

    // 5. User follow-up in an existing active case -> Update case context!
    if (activeCase && !isAdmin && message.content.length > 5) {
      logger.info({ caseId: activeCase.case_id, author: message.author.tag }, 'User follow-up detected in active case — updating context');

      const authorTag = message.author.username;
      const note = `[Update from @${authorTag}]: ${message.content}`;
      const newSummary = `${activeCase.summary || activeCase.title}\n\n${note}`.slice(0, 3000);
      this.caseRepo.updateSummary(activeCase.case_id, newSummary);

      this.evidenceRepo.add({
        evidence_id: `ev_ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        case_id: activeCase.case_id,
        source_type: 'discord_message',
        source_url: message.url,
        title: `Follow-up from ${authorTag}`,
        excerpt: message.content.slice(0, 500),
        authority_score: 0.7,
        metadata: { subtype: 'user_context', updated_by: authorTag },
      });

      // Acknowledge context update with a reaction
      await message.react('📝').catch(() => {});

      // If the case was awaiting user input or the user asks a follow-up, re-investigate
      const config = this.guildRepo.get(message.guildId);
      const isAutoOrSupervised = config?.autonomy_mode === 'auto' || config?.autonomy_mode === 'supervised';
      const needsResponse = activeCase.status === 'awaiting_user' || activeCase.status === 'triaging' || message.content.includes('?');

      if (isAutoOrSupervised && needsResponse) {
        await this.orchestrator.investigateCase(activeCase.case_id);
        const updated = this.caseRepo.get(activeCase.case_id)!;
        const evidence = this.evidenceRepo.getByCaseId(activeCase.case_id);
        const embed = buildCaseEmbed(updated, evidence);
        await message.reply({ embeds: [embed] });
      }

      return;
    }

    // 6. User new question in support channel: auto-triage if autonomy mode permits
    const config = this.guildRepo.get(message.guildId);
    if (config?.autonomy_mode === 'observe') {
      return; // Do not send unsolicited answer in observe mode
    }

    if (!activeCase && message.content.length > 10) {
      // In a text channel, spawn a support thread if possible to keep channel tidy
      let targetThreadId: string | null = isThread ? message.channelId : null;
      let replyTarget: Message | ThreadChannel = message;

      if (!isThread && message.channel.type === ChannelType.GuildText && 'threads' in message.channel) {
        const spawnedThread = await (message.channel as any).threads?.create?.({
          name: message.content.slice(0, 80),
          autoArchiveDuration: 1440,
        }).catch(() => null);

        if (spawnedThread) {
          targetThreadId = spawnedThread.id;
          replyTarget = spawnedThread;
        }
      }

      // Create new case
      const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newCase = this.caseRepo.create({
        case_id: caseId,
        guild_id: message.guildId,
        channel_id: parentId || message.channelId,
        thread_id: targetThreadId,
        message_id: message.id,
        requester_id: message.author.id,
        requester_username: message.author.username,
        category: 'general',
        title: message.content.slice(0, 100),
        status: 'new',
        summary: message.content,
      });

      // Cluster check
      this.incidentDetector.detectCluster(newCase);

      // Investigate
      await this.orchestrator.investigateCase(caseId);
      const updated = this.caseRepo.get(caseId)!;
      const evidence = this.evidenceRepo.getByCaseId(caseId);

      const embed = buildCaseEmbed(updated, evidence);
      if (targetThreadId && !isThread && replyTarget !== (message as unknown)) {
        await (replyTarget as ThreadChannel).send({ embeds: [embed] });
      } else {
        await message.reply({ embeds: [embed] });
      }
    }
  }
}
