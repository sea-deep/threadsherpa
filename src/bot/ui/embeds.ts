import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SupportCase, CaseEvidence } from '../../domain/case.js';

export function buildCaseEmbed(c: SupportCase, evidence: CaseEvidence[] = []): EmbedBuilder {
  const colors: Record<string, number> = { answered: 0x2FA36B, resolved: 0x25875A,
    awaiting_user: 0xF2A03D, awaiting_admin: 0xF2A03D, escalated: 0xF2A03D, closed: 0x7C8A99 };
  // Keep provenance available without repeating the question or exposing review bookkeeping.
  let source: { url: string; label: string } | undefined;
  for (const item of evidence.filter(e => e.metadata.used_in_answer === true)) {
    const refs = item.source_type === 'memory' && Array.isArray(item.metadata.source_refs)
      ? item.metadata.source_refs.map(String) : [item.source_url];
    for (const ref of refs) {
      try {
        const url = new URL(ref || '');
        if (url.protocol !== 'https:' || url.href.length > 1000) continue;
        source = { url: url.href.replace(/\(/g, '%28').replace(/\)/g, '%29'), label: item.source_type === 'memory' ? 'Original answer' : 'Source' };
        break;
      } catch { /* A malformed or internal memory reference is not a public link. */ }
    }
    if (source) break;
  }
  const link = source ? `\n\n[${source.label}](${source.url})` : '';
  const answer = (c.last_answer || 'Waiting for a moderator.').slice(0, Math.min(3800, 4096 - link.length));
  return new EmbedBuilder().setColor(colors[c.status] || 0x3D8BD4).setDescription(answer + link);
}

export function buildCaseActions(c: SupportCase): ActionRowBuilder<ButtonBuilder>[] {
  if (['resolved', 'closed'].includes(c.status)) return [];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`solve_case:${c.case_id}`).setLabel('Solved').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`handoff_case:${c.case_id}`).setLabel(['escalated', 'awaiting_admin'].includes(c.status) ? 'Queued' : 'Need help').setStyle(ButtonStyle.Secondary)
      .setDisabled(['escalated', 'awaiting_admin'].includes(c.status)),
  )];
}
