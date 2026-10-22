import { KnowledgeRepository } from '../database/repositories/knowledge.repo.js';
import { AuditRepository } from '../database/repositories/audit.repo.js';
import { ModelProvider } from '../integrations/model/model-provider.interface.js';
import { KnowledgeCandidateExtractionSchema, KnowledgeCandidateExtraction } from '../agent/schemas.js';
import { KnowledgeItem } from '../domain/knowledge.js';
import { logger } from '../utils/logger.js';

export interface ProposedCandidateResult {
  candidate: KnowledgeItem;
  conflictingItems: KnowledgeItem[];
  extraction: KnowledgeCandidateExtraction;
}

export class LearningPipeline {
  constructor(
    private knowledgeRepo: KnowledgeRepository,
    private auditRepo: AuditRepository,
    private modelProvider: ModelProvider
  ) {}

  async proposeFromAdminMessage(options: {
    guildId: string;
    channelId: string;
    adminUserId: string;
    adminMessage: string;
    caseContext?: {
      title?: string;
      originalQuestion?: string;
      priorBotAnswer?: string;
    };
  }): Promise<ProposedCandidateResult> {
    const prompt = `You are ThreadSherpa's Knowledge Extraction Engine.
An authorized support administrator provided a verified answer, workaround, or correction to a support question.
Extract a structured, reusable knowledge item that can guide future users who ask similar questions.

Context:
${options.caseContext?.originalQuestion ? `Original User Question: "${options.caseContext.originalQuestion}"` : ''}
${options.caseContext?.priorBotAnswer ? `Prior Bot Answer: "${options.caseContext.priorBotAnswer}"` : ''}
Admin Resolution / Correction:
"${options.adminMessage}"

Extract:
1. Reusable question patterns (common ways users might ask this in the future).
2. Canonical answer (concise, clear, actionable, accurate).
3. Applies when (environment, version, or precondition).
4. Does not apply when (exceptions).
5. Change reason / notes.`;

    const extraction = await this.modelProvider.generateStructured({
      prompt,
      schema: KnowledgeCandidateExtractionSchema,
      schemaName: 'KnowledgeCandidateExtraction',
      timeoutMs: 40000,
    });

    const knowledgeId = `know_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Generate embedding for semantic search
    const textToEmbed = `${extraction.question_patterns.join(' ')} ${extraction.canonical_answer}`;
    let embedding: number[] | null = null;
    try {
      embedding = await this.modelProvider.generateEmbedding(textToEmbed);
    } catch (err) {
      logger.warn({ err }, 'Failed to generate embedding for knowledge candidate');
    }

    // Check for conflicting or similar existing approved items
    const conflictingItems: KnowledgeItem[] = [];

    if (embedding) {
      const similar = await this.knowledgeRepo.searchVector(options.guildId, embedding, 3, 0.7);
      for (const item of similar) {
        conflictingItems.push(item);
      }
    }

    // Save candidate
    const candidate = await this.knowledgeRepo.createCandidate({
      knowledge_id: knowledgeId,
      guild_id: options.guildId,
      question_patterns: extraction.question_patterns,
      canonical_answer: extraction.canonical_answer,
      applies_when: extraction.applies_when,
      does_not_apply_when: extraction.does_not_apply_when,
      authority: extraction.authority,
      source_refs: [
        `discord:guild/${options.guildId}/channel/${options.channelId}`,
      ],
      embedding,
      created_by: options.adminUserId,
    });

    // Record audit event
    await this.auditRepo.log({
      guild_id: options.guildId,
      actor_id: options.adminUserId,
      action: 'knowledge_candidate_proposed',
      target_type: 'knowledge',
      target_id: knowledgeId,
      metadata: {
        patterns: extraction.question_patterns,
        hasConflicts: conflictingItems.length > 0,
      },
    });

    logger.info({ knowledgeId, guildId: options.guildId }, 'Created knowledge candidate from admin input');

    const normalizedExtraction: KnowledgeCandidateExtraction = {
      question_patterns: extraction.question_patterns,
      canonical_answer: extraction.canonical_answer,
      applies_when: extraction.applies_when ?? null,
      does_not_apply_when: extraction.does_not_apply_when ?? null,
      authority: extraction.authority ?? 'approved_admin',
      change_reason: extraction.change_reason ?? null,
    };

    return {
      candidate,
      conflictingItems,
      extraction: normalizedExtraction,
    };
  }

  async approveCandidate(knowledgeId: string, reviewerId: string, notes?: string): Promise<KnowledgeItem | null> {
    const approved = await this.knowledgeRepo.approve(knowledgeId, reviewerId, notes);
    if (approved) {
      await this.auditRepo.log({
        guild_id: approved.guild_id,
        actor_id: reviewerId,
        action: 'knowledge_approved',
        target_type: 'knowledge',
        target_id: knowledgeId,
        metadata: { version: approved.current_version, notes },
      });
      logger.info({ knowledgeId, reviewerId }, 'Approved knowledge item');
    }
    return approved;
  }

  async rejectCandidate(knowledgeId: string, reviewerId: string, notes?: string): Promise<KnowledgeItem | null> {
    const rejected = await this.knowledgeRepo.reject(knowledgeId, reviewerId, notes);
    if (rejected) {
      await this.auditRepo.log({
        guild_id: rejected.guild_id,
        actor_id: reviewerId,
        action: 'knowledge_rejected',
        target_type: 'knowledge',
        target_id: knowledgeId,
        metadata: { notes },
      });
      logger.info({ knowledgeId, reviewerId }, 'Rejected knowledge candidate');
    }
    return rejected;
  }

  async correctAndSupersede(
    knowledgeId: string,
    correction: {
      canonical_answer: string;
      question_patterns?: string[];
      applies_when?: string | null;
      does_not_apply_when?: string | null;
      change_reason?: string;
    },
    reviewerId: string
  ): Promise<KnowledgeItem | null> {
    const updated = await this.knowledgeRepo.correctAndSupersede(knowledgeId, correction, reviewerId);
    if (updated) {
      await this.auditRepo.log({
        guild_id: updated.guild_id,
        actor_id: reviewerId,
        action: 'knowledge_superseded',
        target_type: 'knowledge',
        target_id: knowledgeId,
        metadata: { newVersion: updated.current_version, reason: correction.change_reason },
      });
      logger.info({ knowledgeId, newVersion: updated.current_version }, 'Superseded knowledge item with admin correction');
    }
    return updated;
  }
}
