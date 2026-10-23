import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type ChatInputCommandInteraction, type ModalSubmitInteraction } from 'discord.js';
import type { KnowledgeRepository } from '../../database/repositories/knowledge.repo.js';
import type { GuildConfigRepository } from '../../database/repositories/guild-config.repo.js';
import type { LearningPipeline } from '../../memory/learner.js';
import { isCurrentKnowledge } from '../../memory/matching.js';
import { parseFaq, httpsSource, type FaqEntry } from '../../memory/faq-import.js';

interface ImportDraft {
  id: string; entries: FaqEntry[]; source?: string; scope: string; expiresAt: string | null;
  next: number; saved: number; exists: number; busy: boolean;
}
interface Session {
  guild: string; user: string; channel: string; query: string; expires: number; draft?: ImportDraft;
}
type PanelInteraction = ButtonInteraction | ModalSubmitInteraction;
const short = (text: string, max: number) => text.length > max ? text.slice(0, max - 1) + '…' : text;
const row = (buttons: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
const field = (id: string, label: string, max: number, paragraph = false, required = true) =>
  new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label)
    .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setMaxLength(max).setRequired(required));

/** Router verifies moderator permissions on every entry point; sessions bind private UI to its owner and server. */
export class MemoryPanel {
  private sessions = new Map<string, Session>();
  constructor(private knowledge: KnowledgeRepository, private guilds: GuildConfigRepository, private learning: LearningPipeline) {}

  async open(i: ChatInputCommandInteraction) {
    await i.deferReply({ ephemeral: true });
    for (const [key, session] of this.sessions) if (session.expires < Date.now()) this.sessions.delete(key);
    if (this.sessions.size >= 200) { await i.editReply({ content: 'Too many open panels. Try again in a few minutes.' }); return; }
    const token = randomUUID();
    const session: Session = { guild: i.guildId!, user: i.user.id, channel: i.channelId,
      query: i.options.getString('query') || '', expires: Date.now() + 15 * 60_000 };
    this.sessions.set(token, session);
    await i.editReply(await this.payload(token, session, 0));
  }

  private async payload(token: string, session: Session, page: number) {
    const library = await this.knowledge.listSaved(session.guild, session.query, page);
    const config = await this.guilds.get(session.guild);
    const embed = new EmbedBuilder().setTitle('Saved answers').setColor(0x2fa36b)
      .setDescription(library.total ? `${library.total} saved answer${library.total === 1 ? '' : 's'}. Choose one to read or edit.${session.query ? `\nSearch: ${short(session.query, 200)}` : ''}`
        : session.query ? 'No answers match this search.' : 'No saved answers yet. Add one or import your FAQs.')
      .setFooter({ text: `Page ${library.page + 1} of ${library.lastPage + 1} · Only visible to you` });
    for (const item of library.items) embed.addFields({ name: short(item.question_patterns[0] || 'Saved answer', 200),
      value: `${isCurrentKnowledge(item) ? 'Current' : item.approval_status === 'stale' ? 'Needs review' : 'Expired'} · Version ${item.current_version}\n${short(item.canonical_answer, 220)}` });
    config?.documentation_urls.forEach((url, index) => embed.addFields({ name: `Documentation ${index + 1}`, value: `<${url}>` }));
    const components: (ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>)[] = [];
    if (library.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('open_answer').setPlaceholder('Read or edit an answer')
        .addOptions(library.items.map(item => ({ label: short(item.question_patterns[0] || 'Saved answer', 100), value: item.knowledge_id })))));
    components.push(row([
      new ButtonBuilder().setCustomId(`memory_page:${token}:${library.page - 1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(library.page === 0),
      new ButtonBuilder().setCustomId(`memory_page:${token}:${library.page + 1}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(library.page === library.lastPage),
      new ButtonBuilder().setCustomId(`memory_add:${token}`).setLabel('Add answer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`memory_import:${token}`).setLabel('Import FAQs').setStyle(ButtonStyle.Primary),
    ]));
    return { content: '', embeds: [embed], components, allowedMentions: { parse: [] as never[] } };
  }

  private async session(i: PanelInteraction, token: string): Promise<Session | null> {
    const session = this.sessions.get(token);
    if (!session || session.expires < Date.now() || session.guild !== i.guildId || session.user !== i.user.id) {
      await i.reply({ content: 'This panel expired or belongs to someone else. Open /memory again.', ephemeral: true });
      return null;
    }
    return session;
  }

  async button(i: ButtonInteraction) {
    const [action, token, page] = i.customId.split(':');
    if (!['memory_page', 'memory_add', 'memory_import', 'memory_cancel_import', 'memory_confirm_import'].includes(action)) {
      await i.reply({ content: 'Open /memory again.', ephemeral: true }); return;
    }
    const session = await this.session(i, token);
    if (!session) return;
    if (action === 'memory_page') {
      await i.deferUpdate();
      await i.editReply(await this.payload(token, session, Number(page) || 0));
    } else if (action === 'memory_add' || action === 'memory_import') {
      const importing = action === 'memory_import';
      const modal = new ModalBuilder().setCustomId(`${importing ? 'memory_import_form' : 'memory_add_form'}:${token}`)
        .setTitle(importing ? 'Import FAQs' : 'Add answer');
      if (importing) modal.addComponents(field('faq', 'FAQs: ## Question, then its answer', 4000, true));
      else modal.addComponents(field('question', 'Question', 200), field('answer', 'Answer', 3500, true));
      modal.addComponents(field('scope', 'Applies when (optional)', 200, false, false),
        field('source', 'Source URL (optional)', 500, false, false),
        field('days', 'Expires in days (optional, 1–365)', 3, false, false));
      await i.showModal(modal);
    } else if (action === 'memory_cancel_import') {
      if (!session.draft || session.draft.id !== page) { await i.reply({ content: 'This import preview is out of date. Open /memory again.', ephemeral: true }); return; }
      if (session.draft.busy) { await i.reply({ content: 'Import is already running.', ephemeral: true }); return; }
      session.draft = undefined;
      await i.update({ content: 'Import cancelled.', embeds: [], components: [] });
    } else if (action === 'memory_confirm_import') {
      const draft = session.draft;
      if (!draft || draft.id !== page) { await i.reply({ content: 'Import already handled. Open /memory for the saved answers.', ephemeral: true }); return; }
      if (draft.busy) { await i.reply({ content: 'Import is already running.', ephemeral: true }); return; }
      draft.busy = true;
      try {
        await i.deferUpdate();
        while (draft.next < draft.entries.length) {
          const result = await this.save(session, draft.entries[draft.next], draft);
          if (result.status === 'saved') draft.saved++; else draft.exists++;
          draft.next++;
        }
        session.draft = undefined;
        await i.editReply({ content: `${draft.saved} saved${draft.exists ? ` · ${draft.exists} already saved` : ''}. Open /memory to view them.`, embeds: [], components: [] });
      } catch {
        await i.editReply({ content: `${draft.saved} saved. Import stopped before answer ${draft.next + 1}. Retry to continue.`, embeds: [],
          components: [row([new ButtonBuilder().setCustomId(`memory_confirm_import:${token}:${draft.id}`).setLabel('Retry import').setStyle(ButtonStyle.Primary)])] });
      } finally { draft.busy = false; }
    }
  }

  private save(session: Session, entry: FaqEntry, options: { source?: string; scope: string; expiresAt: string | null }) {
    return this.learning.saveAnswer({ guildId: session.guild, channelId: session.channel, adminUserId: session.user,
      adminMessage: entry.answer, sourceUrl: options.source, appliesWhen: options.scope || undefined,
      expiresAt: options.expiresAt, reviewedPatterns: [entry.question], caseContext: { originalQuestion: entry.question } });
  }

  async modal(i: ModalSubmitInteraction) {
    const [action, token] = i.customId.split(':');
    if (!['memory_add_form', 'memory_import_form'].includes(action)) {
      await i.reply({ content: 'Open /memory again.', ephemeral: true }); return;
    }
    const session = await this.session(i, token);
    if (!session) return;
    let entries: FaqEntry[], source: string | undefined, days: string;
    try {
      source = httpsSource(i.fields.getTextInputValue('source'));
      days = i.fields.getTextInputValue('days').trim();
      if (days && (!/^\d+$/.test(days) || +days < 1 || +days > 365)) throw new Error('Expiry must be 1–365 days.');
      entries = action === 'memory_import_form' ? parseFaq(i.fields.getTextInputValue('faq'))
        : [{ question: i.fields.getTextInputValue('question').trim(), answer: i.fields.getTextInputValue('answer').trim() }];
      if (entries.some(entry => !entry.question || entry.question.length > 200 || !entry.answer || entry.answer.length > 3500)) throw new Error('Add a question and answer within the shown limits.');
    } catch (error) {
      await i.reply({ content: error instanceof Error ? error.message : 'Check the fields and try again.', ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    const draft: ImportDraft = { id: randomUUID(), entries, source, scope: i.fields.getTextInputValue('scope').trim(),
      expiresAt: days ? new Date(Date.now() + +days * 86400_000).toISOString() : null, next: 0, saved: 0, exists: 0, busy: false };
    await i.deferReply({ ephemeral: true });
    if (action === 'memory_add_form') {
      const result = await this.save(session, entries[0], draft);
      await i.editReply({ content: result.status === 'saved' ? 'Saved. Open /memory to view it.' : 'Already saved.' });
      return;
    }
    if (session.draft?.busy) { await i.editReply({ content: 'An import is running. Wait for it to finish.' }); return; }
    session.draft = draft;
    const embed = new EmbedBuilder().setTitle(`Import ${entries.length} answer${entries.length === 1 ? '' : 's'}?`)
      .setColor(0xf2a03d).setDescription(entries.map(entry => `**${entry.question}**\n${entry.answer}`).join('\n\n'))
      .setFooter({ text: 'Nothing saved yet. Existing answers are kept; duplicate saves are skipped.' });
    if (source || draft.scope || draft.expiresAt) embed.setFooter({ text: short([draft.scope, draft.expiresAt ? `Until ${draft.expiresAt.slice(0, 10)}` : '', source].filter(Boolean).join(' · '), 1000) });
    await i.editReply({ embeds: [embed], components: [row([
      new ButtonBuilder().setCustomId(`memory_confirm_import:${token}:${draft.id}`).setLabel('Save answers').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`memory_cancel_import:${token}:${draft.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    ])], allowedMentions: { parse: [] } });
  }
}
