import { randomUUID } from 'node:crypto';
import {
  ChatInputCommandInteraction, ButtonInteraction, MessageContextMenuCommandInteraction,
  ModalSubmitInteraction, StringSelectMenuInteraction, Message, ThreadChannel, ChannelType,
  PermissionFlagsBits, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder,
} from 'discord.js';
import { GuildConfigRepository } from '../../database/repositories/guild-config.repo.js';
import { CaseRepository } from '../../database/repositories/case.repo.js';
import { EvidenceRepository } from '../../database/repositories/evidence.repo.js';
import { KnowledgeRepository } from '../../database/repositories/knowledge.repo.js';
import { AgentOrchestrator } from '../../agent/orchestrator.js';
import { LearningPipeline } from '../../memory/learner.js';

import { KnowledgeItem } from '../../domain/knowledge.js';
import { SupportCase } from '../../domain/case.js';
import { answerFeedback } from '../../support/conversation.js';
import { groupWaitingQuestions } from '../../support/queue.js';
import { buildCaseEmbed, buildCaseActions } from '../ui/embeds.js';
import { MemoryPanel } from './memory-panel.js';
import { httpsSource } from '../../memory/faq-import.js';

type Interaction = ChatInputCommandInteraction | ButtonInteraction | MessageContextMenuCommandInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;
const id = () => `case_${randomUUID()}`;
const questionUrl = (c: SupportCase) => `https://discord.com/channels/${c.guild_id}/${c.thread_id || c.channel_id}/${c.message_id}`;
const safeText = (text: string) => text.replace(/[\[\]<>*_`]/g, '');

export class BotInteractionRouter {
  private pendingThreads = new Set<string>();
  private memoryPanel: MemoryPanel;
  constructor(private guildRepo: GuildConfigRepository, private caseRepo: CaseRepository,
    private evidenceRepo: EvidenceRepository, private knowledgeRepo: KnowledgeRepository,
    private orchestrator: AgentOrchestrator, private learningPipeline: LearningPipeline) {
    this.memoryPanel = new MemoryPanel(knowledgeRepo, guildRepo, learningPipeline);
  }

  private async isAuthorizedAdmin(interaction: Interaction): Promise<boolean> {
    const member = interaction.member as GuildMember | null;
    if (!member) return false;
    if (member.permissions && typeof member.permissions.has === 'function' && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    const roles = Array.isArray(member.roles) ? member.roles : member.roles?.cache ? [...member.roles.cache.keys()] : [];
    return this.guildRepo.isAdmin(interaction.guildId || '', roles);
  }
  private async moderatorOnly(i: Interaction): Promise<boolean> {
    if (await this.isAuthorizedAdmin(i)) return true;
    await i.reply({ content: 'Moderators only.', ephemeral: true });
    return false;
  }
  private async card(caseId: string) {
    const c = (await this.caseRepo.get(caseId))!;
    return { embeds: [buildCaseEmbed(c, await this.evidenceRepo.getByCaseId(caseId))], components: buildCaseActions(c) };
  }

  async handleCommand(i: ChatInputCommandInteraction): Promise<void> {
    if (!i.guildId) { await i.reply({ content: 'Use this in a server.', ephemeral: true }); return; }
    switch (i.commandName) {
      case 'setup': return this.handleSetup(i);
      case 'ask': {
        await i.deferReply();
        const question = i.options.getString('question', true);
        const reply = await i.fetchReply();
        const thread = i.channel?.isThread() ? i.channel : null;
        const c = await this.caseRepo.create({ case_id: id(), guild_id: i.guildId, channel_id: thread?.parentId || i.channelId,
          thread_id: thread?.id, message_id: reply.id, requester_id: i.user.id, requester_username: i.user.username,
          category: 'question', title: question, summary: question, status: 'new' });
        await this.orchestrator.investigateCase(c.case_id);
        await i.editReply(await this.card(c.case_id)); return;
      }
      case 'teach': return this.handleTeach(i);
      case 'memory': {
        if (await this.moderatorOnly(i)) await this.memoryPanel.open(i);
        return;
      }
      case 'answers': return this.handleAnswers(i);
      case 'queue': {
        if (!(await this.moderatorOnly(i))) return;
        await i.deferReply({ ephemeral: true });
        const visible = await this.visibleWaiting(i);
        if (!visible.length) {
          await i.editReply({ content: 'Nothing waiting.' }); return;
        }
        const groups = groupWaitingQuestions(visible);
        const repeated = groups.some(group => group.cases.length > 1);
        const menu = new StringSelectMenuBuilder().setCustomId(repeated ? 'open_queue_topic' : 'open_queue').setPlaceholder(repeated ? 'Choose an issue' : 'Open a question')
          .addOptions(groups.slice(0, 25).map(group => ({ label: group.question.title.slice(0, 80) + (group.cases.length > 1 ? ` · ${group.cases.length} questions` : ''), value: group.question.case_id })));
        await i.editReply({ content: `${visible.length}${visible.length === 50 ? '+' : ''} questions${repeated ? ` · ${groups.length} topic${groups.length === 1 ? '' : 's'}` : ''} need help.`,
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
        return;
      }
      case 'stats': {
        const s = await this.caseRepo.getImpact(i.guildId);
        await i.reply({ content: `${s.questions} questions · ${s.solved} solved · ${s.handoffs} need help`, ephemeral: true }); return;
      }
      case 'sources': {
        const config = await this.guildRepo.get(i.guildId);
        await i.reply({ content: config?.documentation_urls.length ? config.documentation_urls.map(u => `<${u}>`).join('\n') : 'No sources yet. Add one with /setup source_url.', ephemeral: true }); return;
      }
    }
  }

  private async handleSetup(i: ChatInputCommandInteraction) {
    if (!(await this.moderatorOnly(i))) return;
    const guildId = i.guildId!;
    let channel: { id: string } | null = i.options.getChannel('channel');
    const remove = i.options.getChannel('remove_channel');
    const role = i.options.getRole('admin_role');
    const source = i.options.getString('source_url');
    const mode = i.options.getString('autonomy_mode') as 'observe' | 'supervised' | 'auto' | null;
    const current = await this.guildRepo.get(guildId);
    const urls = new Set(current?.documentation_urls || []);
    const domains = new Set(current?.allowed_domains || []);
    if (source) {
      let url: URL;
      try { url = new URL(source); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { await i.reply({ content: 'Use an https documentation link.', ephemeral: true }); return; }
      if (urls.size >= 3 && !urls.has(source)) { await i.reply({ content: 'Three sources maximum.', ephemeral: true }); return; }
      urls.add(source); domains.add(url.hostname);
    }
    if (!channel && !remove && !role && !source && !current?.support_channel_ids.length) {
      if (i.channel?.isThread() && i.channel.parentId) channel = { id: i.channel.parentId };
      else if (i.channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(i.channel.type)) channel = { id: i.channelId };
    }
    const channels = new Set(current?.support_channel_ids || []);
    const roles = new Set(current?.admin_role_ids || []);
    if (channel) channels.add(channel.id);
    if (remove) channels.delete(remove.id);
    if (role) roles.add(role.id);
    const updated = await this.guildRepo.upsert({ guild_id: guildId, support_channel_ids: [...channels], admin_role_ids: [...roles],
      documentation_urls: [...urls], allowed_domains: [...domains], autonomy_mode: mode || current?.autonomy_mode || 'supervised' });
    await i.reply({ content: updated.support_channel_ids.length
      ? `${updated.support_channel_ids.map(c => `<#${c}>`).join(', ')} · ${updated.autonomy_mode === 'auto' ? 'Auto replies on' : updated.autonomy_mode === 'observe' ? 'Quiet mode' : 'Reply with /ask'}.`
      : 'Choose a support channel: /setup channel:#your-forum autonomy_mode:auto', ephemeral: true });
  }

  private async handleTeach(i: ChatInputCommandInteraction) {
    if (!(await this.moderatorOnly(i))) return;
    const solution = i.options.getString('solution', true);
    const source = i.options.getString('source_url') || undefined;
    if (solution.length > 3500 || (source && !/^https:\/\//i.test(source))) {
      await i.reply({ content: 'Use an answer of up to 3,500 characters and an https source link.', ephemeral: true }); return;
    }
    await i.deferReply({ ephemeral: true });
    const days = i.options.getInteger?.('valid_days');
    const result = await this.learningPipeline.saveAnswer({ guildId: i.guildId!, channelId: i.channelId,
      adminUserId: i.user.id, adminMessage: solution, sourceUrl: source, appliesWhen: i.options.getString('applies_when') || undefined,
      expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
      caseContext: { originalQuestion: i.options.getString('question', true) } });
    await i.editReply({ content: result.status === 'exists' ? 'Already saved.' : 'Saved.' });
  }

  async handleContextMenu(i: MessageContextMenuCommandInteraction): Promise<void> {
    if (!i.guildId || i.commandName !== 'Save this answer' || !(await this.moderatorOnly(i))) return;
    const message = i.targetMessage;
    if (message.author.bot || !message.content.trim() || message.content.length > 3500) {
      await i.reply({ content: 'Choose a human answer (up to 3,500 characters).', ephemeral: true }); return;
    }
    const thread = i.channel?.isThread() ? i.channel : null;
    if (!(await this.guildRepo.isSupportChannel(i.guildId, i.channelId, thread?.parentId))) {
      await i.reply({ content: 'Choose an answer in a configured support channel or forum post.', ephemeral: true }); return;
    }
    await i.deferReply({ ephemeral: true });
    let c = thread ? await this.caseRepo.getByThreadId(thread.id) : null;
    if (thread && !c) {
      const starter = await thread.fetchStarterMessage().catch(() => null);
      if (starter && starter.id !== message.id && !starter.author.bot) {
        c = await this.caseRepo.create({ case_id: id(), guild_id: i.guildId, channel_id: thread.parentId || thread.id,
          thread_id: thread.id, message_id: starter.id, requester_id: starter.author.id, requester_username: starter.author.username,
          category: 'question', title: thread.name, summary: starter.content, status: 'awaiting_admin' });
      }
    }
    if (!c && message.reference?.messageId) c = await this.caseRepo.getByMessageId(message.reference.messageId);
    if (!c || c.guild_id !== i.guildId || c.message_id === message.id) {
      await i.editReply({ content: 'Question unclear. Use /teach question:… solution:…' }); return;
    }
    const result = await this.learningPipeline.saveAnswer({ guildId: i.guildId, channelId: i.channelId,
      adminUserId: i.user.id, adminMessage: message.content, sourceUrl: message.url, originCaseId: c.case_id,
      caseContext: { originalQuestion: c.title.slice(0, 200), originalContext: [c.title, c.summary].filter(Boolean).join('\n') } });
    await this.caseRepo.markAnsweredIfWaiting(c.case_id, message.content);
    await i.editReply({ content: result.status === 'exists' ? 'Already saved.' : 'Saved.' });
  }

  private savedCard(item: KnowledgeItem) {
    const embed = new EmbedBuilder().setTitle(item.question_patterns[0].slice(0, 256))
      .setDescription(item.canonical_answer.slice(0, 3500)).setColor(0x2fa36b);
    embed.setFooter({ text: [`Version ${item.current_version}`, item.applies_when, item.expires_at ? `Until ${item.expires_at.slice(0, 10)}` : null].filter(Boolean).join(' · ').slice(0, 2048) });
    const source = item.source_refs.find(ref => /^https:\/\//i.test(ref) && ref.length <= 900);
    if (source) embed.addFields({ name: 'Original answer', value: `<${source}>` });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`correct_answer:${item.knowledge_id}`).setLabel('Edit').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`delete_answer:${item.knowledge_id}`).setLabel('Remove').setStyle(ButtonStyle.Danger));
    return { embeds: [embed], components: [row] };
  }
  private async handleAnswers(i: ChatInputCommandInteraction) {
    if (!(await this.moderatorOnly(i))) return;
    await i.deferReply({ ephemeral: true });
    const query = i.options.getString('query');
    const items = query ? await this.knowledgeRepo.searchLexical(i.guildId!, query, 25) : await this.knowledgeRepo.getApproved(i.guildId!);
    if (!items.length) { await i.editReply({ content: 'No saved answers.' }); return; }
    const menu = new StringSelectMenuBuilder().setCustomId('open_answer').setPlaceholder('Open a saved answer')
      .addOptions(items.slice(0, 25).map(item => ({ label: item.question_patterns[0].slice(0, 100), value: item.knowledge_id })));
    await i.editReply({ content: `${items.length} saved answer${items.length === 1 ? '' : 's'}.${items.length > 25 ? ' Search with /answers query.' : ''}`,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
  }

  private async visibleWaiting(i: Interaction): Promise<SupportCase[]> {
    const config = await this.guildRepo.get(i.guildId!);
    const waiting = await this.caseRepo.listWaiting(i.guildId!, 50);
    const visible: SupportCase[] = [];
    for (const c of waiting) {
      if ((config?.support_channel_ids.includes(c.channel_id) || config?.support_channel_ids.includes(c.thread_id || '')) && await this.accessibleChannel(i, c, false)) visible.push(c);
    }
    return visible;
  }

  private async accessibleChannel(i: Interaction, c: SupportCase, requireSend = true) {
    if (!i.guild || i.guildId !== c.guild_id) return null;
    try {
      const channel = await i.guild.channels.fetch(c.thread_id || c.channel_id);
      if (!channel || channel.type === ChannelType.PrivateThread || !channel.isTextBased() || !('send' in channel)) return null;
      const member = await i.guild.members.fetch(i.user.id);
      const bot = i.guild.members.me || await i.guild.members.fetchMe();
      if (!channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel) || !channel.permissionsFor(bot)?.has(PermissionFlagsBits.ViewChannel)) return null;
      if (requireSend && (!channel.permissionsFor(bot)?.has([PermissionFlagsBits.EmbedLinks, channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages]) || (channel.isThread() && (channel.archived || channel.locked)))) return null;
      return channel;
    } catch { return null; }
  }
  async handleSelect(i: StringSelectMenuInteraction): Promise<void> {
    if (!i.guildId || !(await this.moderatorOnly(i))) return;
    if (i.customId.startsWith('share_answers:')) {
      await i.reply({ content: 'Saved knowledge now helps new questions automatically.', ephemeral: true }); return;
    }
    if (i.customId === 'open_answer') {
      const item = await this.knowledgeRepo.get(i.values[0]);
      if (!item || item.guild_id !== i.guildId || item.approval_status !== 'approved') {
        await i.reply({ content: 'Answer unavailable.', ephemeral: true }); return;
      }
      await i.reply({ ...this.savedCard(item), ephemeral: true }); return;
    }
    if (i.customId === 'open_queue_topic') {
      await i.deferReply({ ephemeral: true });
      const group = groupWaitingQuestions(await this.visibleWaiting(i)).find(topic => topic.cases.some(c => c.case_id === i.values[0]));
      if (!group) { await i.editReply({ content: 'Already handled. Open /queue again.' }); return; }
      const menu = new StringSelectMenuBuilder().setCustomId('open_queue').setPlaceholder('Open a question')
        .addOptions(group.cases.slice(0, 25).map(c => ({ label: c.title.slice(0, 100), description: `Asked by ${c.requester_username}`.slice(0, 100), value: c.case_id })));
      await i.editReply({ content: `${group.cases.length} question${group.cases.length === 1 ? '' : 's'} with similar wording.`,
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] }); return;
    }
    if (i.customId === 'open_queue') {
      const c = await this.caseRepo.get(i.values[0]);
      if (!c || !(await this.guildRepo.isSupportChannel(i.guildId, c.channel_id, c.thread_id)) || !(await this.accessibleChannel(i, c, false))) {
        await i.reply({ content: 'Question unavailable.', ephemeral: true }); return;
      }
      const failed = (await this.evidenceRepo.getByCaseId(c.case_id)).find(e => e.metadata.feedback === 'failed');
      const context = failed ? `\n\nTried: ${safeText(String(failed.metadata.failed_answer)).slice(0, 220)}\nMember: ${safeText(failed.excerpt).slice(0, 220)}` : '';
      await i.reply({ content: `[${safeText(c.title).slice(0, 150)}](${questionUrl(c)})${context}`, ephemeral: true,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Open post').setStyle(ButtonStyle.Link).setURL(questionUrl(c)),
          new ButtonBuilder().setLabel('Solved').setStyle(ButtonStyle.Success).setCustomId(`solve_case:${c.case_id}`),
          new ButtonBuilder().setLabel('Retry').setStyle(ButtonStyle.Secondary).setCustomId(`retry_case:${c.case_id}`))] });
    }
  }

  private editModal(item: KnowledgeItem, correction: boolean) {
    const modal = new ModalBuilder().setCustomId(`${correction ? 'correct_answer' : 'edit_draft'}:${item.knowledge_id}:v${item.current_version}`).setTitle(correction ? 'Edit answer' : 'Review this answer');
    const fields = [
      new TextInputBuilder().setCustomId('question').setLabel('Question (one per line)').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(item.question_patterns.join('\n').slice(0, 1000)),
      new TextInputBuilder().setCustomId('answer').setLabel('Answer').setStyle(TextInputStyle.Paragraph).setMaxLength(3500).setValue(item.canonical_answer),
      new TextInputBuilder().setCustomId('scope').setLabel('Scope (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200).setValue(item.applies_when || ''),
    ];
    fields.push(correction
      ? new TextInputBuilder().setCustomId('expiry').setLabel('Expiry date (YYYY-MM-DD, blank for none)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(10).setValue(item.expires_at?.slice(0, 10) || '')
      : new TextInputBuilder().setCustomId('days').setLabel('Expires in days (optional, 1–365)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(3).setValue(item.expires_at ? String(Math.max(1, Math.ceil((Date.parse(item.expires_at) - Date.now()) / 86400000))) : ''));
    fields.push(new TextInputBuilder().setCustomId('source').setLabel('Original answer URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500).setValue((item.source_refs[0] || '').slice(0, 500)));
    return modal.addComponents(...fields.map(f => new ActionRowBuilder<TextInputBuilder>().addComponents(f)));
  }
  async handleModal(i: ModalSubmitInteraction): Promise<void> {
    if (!i.guildId || !(await this.moderatorOnly(i))) return;
    if (i.customId.startsWith('memory_')) { await this.memoryPanel.modal(i); return; }
    const [action, target, version] = i.customId.split(':');
    if (!['edit_draft', 'correct_answer'].includes(action)) return;
    const item = await this.knowledgeRepo.get(target);
    if (!item || item.guild_id !== i.guildId || version !== `v${item.current_version}` || (action === 'correct_answer' ? item.approval_status !== 'approved' : !['candidate', 'pending_review'].includes(item.approval_status))) {
      await i.reply({ content: 'Answer changed. Open /answers again.', ephemeral: true }); return;
    }
    const patterns = [...new Set(i.fields.getTextInputValue('question').split('\n').map(s => s.trim()).filter(Boolean))];
    const question = patterns[0];
    const answer = i.fields.getTextInputValue('answer');
    const scope = i.fields.getTextInputValue('scope').trim();
    const days = action === 'edit_draft' ? i.fields.getTextInputValue('days').trim() : '';
    // Modals opened before an update may not contain the newer optional fields.
    const optionalField = (name: string) => { try { return i.fields.getTextInputValue(name); } catch { return undefined; } };
    let source: string | undefined, expiry: string | null | undefined;
    try {
      const sourceText = optionalField('source');
      source = sourceText === undefined ? item.source_refs[0] : httpsSource(sourceText);
      if (action === 'correct_answer') {
        const date = optionalField('expiry')?.trim();
        if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Use an expiry date like 2026-10-26, or leave it blank.');
        expiry = date === undefined || date === item.expires_at?.slice(0, 10) ? item.expires_at
          : date ? `${date}T23:59:59.999Z` : null;
      }
    } catch (error) {
      await i.reply({ content: error instanceof Error ? error.message : 'Check the source and expiry.', ephemeral: true }); return;
    }
    if (!question || patterns.length > 5 || patterns.some(p => p.length > 200) || !answer.trim() || (days && (!/^\d+$/.test(days) || +days < 1 || +days > 365))) {
      await i.reply({ content: 'Add a question (up to 200 characters per line) and answer. Expiry: 1–365 days.', ephemeral: true }); return;
    }
    await i.deferReply({ ephemeral: true });
    if (action === 'correct_answer') {
      const updated = await this.learningPipeline.correctAndSupersede(target, { canonical_answer: answer, question_patterns: patterns, applies_when: scope || null,
        source_refs: source === item.source_refs[0] ? item.source_refs : source ? [source] : [], expires_at: expiry,
        change_reason: 'Corrected through Discord review form' }, i.user.id, item.current_version);
      await i.editReply({ content: updated ? 'Updated.' : 'Answer changed. Open /memory again.' }); return;
    }
    const result = await this.learningPipeline.saveAnswer({ guildId: i.guildId, channelId: i.channelId || 'unavailable', adminUserId: i.user.id,
      adminMessage: answer, sourceUrl: source, originCaseId: item.origin_case_id || undefined,
      appliesWhen: scope || undefined, expiresAt: days ? new Date(Date.now() + +days * 86400000).toISOString() : null,
      caseContext: { originalQuestion: question }, reviewedPatterns: patterns });
    await this.learningPipeline.rejectCandidate(target, i.user.id, 'Saved through the simplified flow');
    await i.editReply({ content: result.status === 'exists' ? 'Already saved.' : 'Saved.' });
  }

  async handleButton(i: ButtonInteraction): Promise<void> {
    if (i.customId.startsWith('memory_')) {
      if (i.guildId && await this.moderatorOnly(i)) await this.memoryPanel.button(i);
      return;
    }
    const [action, target] = i.customId.split(':');
    if (!i.guildId || !target) return;
    if (['solve_case', 'handoff_case', 'retry_case'].includes(action)) {
      const c = await this.caseRepo.get(target);
      if (!c || c.guild_id !== i.guildId || (c.requester_id !== i.user.id && !(await this.isAuthorizedAdmin(i)))) {
        await i.reply({ content: 'Only the asker or a moderator can do this.', ephemeral: true }); return;
      }
      if (['resolved', 'closed'].includes(c.status)) { await i.reply({ content: 'Already closed.', ephemeral: true }); return; }
      await i.deferUpdate();
      if (action === 'retry_case') await this.orchestrator.investigateCase(target);
      else await this.caseRepo.updateStatus(target, action === 'solve_case' ? 'resolved' : 'escalated', action === 'solve_case' ? (c.requester_id === i.user.id ? 'Member confirmed this helped' : 'Moderator marked solved') : 'Member requested moderator help');
      await i.editReply({ content: action === 'handoff_case' ? 'Queued for a moderator.' : action === 'solve_case' ? 'Marked solved.' : null, ...await this.card(target) }); return;
    }
    if (!(await this.moderatorOnly(i))) return;
    const item = await this.knowledgeRepo.get(target);
    if (!item || item.guild_id !== i.guildId) { await i.reply({ content: 'Answer unavailable in this server.', ephemeral: true }); return; }
    if (['approve_know', 'reject_know', 'edit_draft'].includes(action)) {
      if (!['candidate', 'pending_review'].includes(item.approval_status)) { await i.reply({ content: 'This draft was already reviewed.', ephemeral: true }); return; }
      if (action === 'edit_draft') { await i.showModal(this.editModal(item, false)); return; }
      await i.deferUpdate();
      if (action === 'reject_know') {
        await this.learningPipeline.rejectCandidate(target, i.user.id);
        await i.editReply({ content: 'Draft discarded.', embeds: [], components: [] }); return;
      }
      const saved = await this.learningPipeline.saveAnswer({ guildId: i.guildId, channelId: i.channelId, adminUserId: i.user.id,
        adminMessage: item.canonical_answer, sourceUrl: item.source_refs[0], originCaseId: item.origin_case_id || undefined,
        reviewedPatterns: item.question_patterns, appliesWhen: item.applies_when || undefined, expiresAt: item.expires_at });
      await this.learningPipeline.rejectCandidate(target, i.user.id, 'Saved through the simplified flow');
      await i.editReply({ content: saved.status === 'exists' ? 'Already saved.' : 'Saved.', embeds: [], components: [] });
    } else if (item.approval_status === 'approved') {
      if (action === 'correct_answer') { await i.showModal(this.editModal(item, true)); return; }
      if (action === 'delete_answer') {
        await i.reply({ content: 'Remove this saved answer?',
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`confirm_delete:${target}`).setLabel('Remove').setStyle(ButtonStyle.Danger))], ephemeral: true }); return;
      }
      if (action === 'confirm_delete') {
        await this.knowledgeRepo.delete(target);
        await i.update({ content: 'Removed.', components: [] }); return;
      }
      if (action === 'share_know') { await i.reply({ content: 'Saved knowledge now helps new questions automatically.', ephemeral: true }); }
    }
  }

  async handleThreadCreate(thread: ThreadChannel): Promise<void> {
    if (this.pendingThreads.has(thread.id) || thread.ownerId === thread.client?.user?.id) return;
    this.pendingThreads.add(thread.id);
    try {
      if (!(await this.guildRepo.isSupportChannel(thread.guildId, thread.id, thread.parentId)) || await this.caseRepo.getByThreadId(thread.id)) return;
      let starter = await thread.fetchStarterMessage().catch(() => null);
      if (!starter) {
        await new Promise(resolve => setTimeout(resolve, 750));
        starter = await thread.fetchStarterMessage().catch(() => null);
      }
      if (!starter || starter.author.bot) return;
      const c = await this.caseRepo.create({ case_id: id(), guild_id: thread.guildId, channel_id: thread.parentId || thread.id,
        thread_id: thread.id, message_id: starter.id, requester_id: starter.author.id, requester_username: starter.author.username,
        category: 'question', title: thread.name, summary: starter.content, status: 'new' });
      const config = await this.guildRepo.get(thread.guildId);
      if (config?.autonomy_mode !== 'auto') return;
      const result = await this.orchestrator.investigateCase(c.case_id);
      if (result.policyResult.action !== 'queue') await thread.send(await this.card(c.case_id));
    } finally { this.pendingThreads.delete(thread.id); }
  }

  async handleMessage(message: Message): Promise<void> {
    if (message.author?.bot || message.system || !message.guildId) return;
    const thread = message.channel?.isThread() ? message.channel : null;
    if (!(await this.guildRepo.isSupportChannel(message.guildId, message.channelId, thread?.parentId))) return;
    const config = await this.guildRepo.get(message.guildId);
    const roles = message.member?.roles?.cache ? [...message.member.roles.cache.keys()] : [];
    const c = thread ? await this.caseRepo.getByThreadId(thread.id) : message.reference?.messageId ? await this.caseRepo.getByMessageId(message.reference.messageId) : null;
    if (c?.message_id === message.id) return;
    const moderator = message.member?.permissions?.has(PermissionFlagsBits.Administrator) || await this.guildRepo.isAdmin(message.guildId, roles);
    if (moderator && (!c || c.requester_id !== message.author.id) && !message.content.trim().endsWith('?')) return;
    if (c) {
      if (c.guild_id !== message.guildId || c.requester_id !== message.author.id || c.status === 'closed') return;
      const feedback = answerFeedback(message.content);
      if (feedback === 'solved' && ['answered', 'awaiting_user'].includes(c.status)) {
        await this.caseRepo.updateSummary(c.case_id, `${c.summary || c.title}\n\nFollow-up: ${message.content}`.slice(-3000));
        await this.caseRepo.updateStatus(c.case_id, 'resolved', 'Member confirmed in conversation'); return;
      }
      if (feedback === 'failed' && c.last_answer && ['answered', 'awaiting_user', 'resolved', 'awaiting_admin', 'escalated'].includes(c.status)) {
        if (c.status === 'resolved') await this.caseRepo.reopen(c.case_id, 'Member reported the answer did not help');
        await this.caseRepo.updateSummary(c.case_id, `${c.summary || c.title}\n\nFollow-up: ${message.content}`.slice(-3000));
        await this.evidenceRepo.add({ evidence_id: `ev_${randomUUID()}`, case_id: c.case_id, source_type: 'discord_message', source_url: message.url,
          title: 'Answer did not help', excerpt: message.content.slice(0, 500), authority_score: 0.7,
          metadata: { subtype: 'user_context', feedback: 'failed', failed_answer: c.last_answer } });
        await this.caseRepo.updateStatus(c.case_id, 'awaiting_admin', 'Member reported the answer did not help'); return;
      }
      if (c.status === 'resolved' || message.content.length < 6) return;
      if (/^(thanks?|thank you|ty|ok(ay)?|got it|great|perfect)[!.\s]*$/i.test(message.content.trim())) return;
      await this.caseRepo.updateSummary(c.case_id, `${c.summary || c.title}\n\nFollow-up: ${message.content}`.slice(-3000));
      await this.evidenceRepo.add({ evidence_id: `ev_${randomUUID()}`, case_id: c.case_id, source_type: 'discord_message', source_url: message.url, title: 'Asker follow-up', excerpt: message.content.slice(0, 500), authority_score: 0.7, metadata: { subtype: 'user_context' } });
      if (config?.autonomy_mode === 'auto' || (config?.autonomy_mode === 'supervised' && c.status === 'awaiting_user')) {
        const result = await this.orchestrator.investigateCase(c.case_id);
        if (result.policyResult.action !== 'queue') await message.reply(await this.card(c.case_id));
      }
      return;
    }
    if (thread || config?.autonomy_mode !== 'auto' || message.content.length < 11 || await this.caseRepo.getByMessageId(message.id)) return;
    const created = await this.caseRepo.create({ case_id: id(), guild_id: message.guildId, channel_id: message.channelId,
      message_id: message.id, requester_id: message.author.id, requester_username: message.author.username,
      category: 'question', title: message.content.slice(0, 200), summary: message.content, status: 'new' });
    const result = await this.orchestrator.investigateCase(created.case_id);
    if (result.policyResult.action !== 'queue') await message.reply(await this.card(created.case_id));
  }
}
