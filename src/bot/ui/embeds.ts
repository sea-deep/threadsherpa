import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SupportCase, CaseEvidence } from '../../domain/case.js';
import { KnowledgeItem } from '../../domain/knowledge.js';
import { GitHubLink } from '../../domain/github.js';
import { Incident } from '../../domain/incident.js';

export function buildCaseEmbed(c: SupportCase, evidence: CaseEvidence[] = []): EmbedBuilder {
  const statusColors: Record<string, number> = {
    new: 0x3498db, // Blue
    investigating: 0xf39c12, // Orange
    answered: 0x2ecc71, // Green
    awaiting_user: 0x9b59b6, // Purple
    escalated: 0xe74c3c, // Red
    resolved: 0x27ae60, // Dark Green
    closed: 0x7f8c8d, // Grey
  };

  const color = statusColors[c.status] || 0x3498db;

  const embed = new EmbedBuilder()
    .setTitle(`Support Case #${c.case_id.slice(-6).toUpperCase()}: ${c.title}`)
    .setColor(color)
    .addFields(
      { name: 'Status', value: `\`${c.status.toUpperCase()}\``, inline: true },
      { name: 'Category', value: c.category, inline: true },
      { name: 'Requester', value: `<@${c.requester_id}>`, inline: true }
    );

  if (c.summary) {
    embed.addFields({ name: 'Investigation Summary', value: c.summary.slice(0, 1024) });
  }

  if (c.last_answer) {
    embed.addFields({ name: 'Latest Guidance', value: c.last_answer.slice(0, 1024) });
  }

  if (evidence.length > 0) {
    const evidenceList = evidence.slice(0, 4).map(e => `• **[${e.source_type}]** ${e.title || e.source_url || 'ref'}: *${e.excerpt.slice(0, 100)}...*`).join('\n');
    embed.addFields({ name: 'Verified Evidence', value: evidenceList.slice(0, 1024) });
  }

  embed.setFooter({ text: 'ThreadSherpa • Continuous Learning Support Copilot' });
  embed.setTimestamp(new Date(c.updated_at));

  return embed;
}

export function buildCandidateReviewCard(
  candidate: KnowledgeItem,
  conflicts: KnowledgeItem[] = []
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle('📚 Proposed Knowledge Candidate (Review Required)')
    .setColor(0xf1c40f) // Gold
    .setDescription('An administrator resolution was detected. Review this structured knowledge candidate to make it permanent and retrievable for future support inquiries.')
    .addFields(
      { name: 'Target Question Patterns', value: candidate.question_patterns.map(p => `• "${p}"`).join('\n').slice(0, 1024) },
      { name: 'Proposed Canonical Answer', value: candidate.canonical_answer.slice(0, 1024) },
      { name: 'Applies When', value: candidate.applies_when || 'Any standard environment', inline: true },
      { name: 'Authority Level', value: `\`${candidate.authority}\``, inline: true }
    );

  if (conflicts.length > 0) {
    embed.addFields({
      name: '⚠️ Potential Overlap / Conflict Detected',
      value: conflicts.map(c => `• **${c.knowledge_id}**: ${c.canonical_answer.slice(0, 120)}...`).join('\n').slice(0, 1024),
    });
  }

  embed.setFooter({ text: `ID: ${candidate.knowledge_id}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_know:${candidate.knowledge_id}`)
      .setLabel('Approve & Index')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject_know:${candidate.knowledge_id}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
  );

  return { embed, row };
}

export function buildIssueDraftCard(
  link: GitHubLink
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle(`🐙 GitHub Issue Draft for ${link.repo_owner}/${link.repo_name}`)
    .setColor(0x24292e)
    .setDescription(`**Title**: ${link.draft_title}\n\n${link.draft_body.slice(0, 1800)}`)
    .setFooter({ text: `Link ID: ${link.link_id} • Target: ${link.repo_owner}/${link.repo_name}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`publish_gh:${link.link_id}`)
      .setLabel('Approve & Create Issue')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cancel_gh:${link.link_id}`)
      .setLabel('Discard Draft')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

export function buildIncidentCard(
  incident: Incident
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle(`🚨 Shared Incident Alert: ${incident.title}`)
    .setColor(0xe74c3c)
    .setDescription(`ThreadSherpa detected multiple support threads reporting similar symptoms.\n\n**Symptom Cluster**: \`${incident.symptom_cluster}\`\n**Affected Cases**: ${incident.affected_case_count}\n**Verification State**: \`${incident.verification_state.toUpperCase()}\``)
    .setFooter({ text: `Incident ID: ${incident.incident_id}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_inc:${incident.incident_id}`)
      .setLabel('Confirm Outage/Incident')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`resolve_inc:${incident.incident_id}`)
      .setLabel('Mark Resolved')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}
