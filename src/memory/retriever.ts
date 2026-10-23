import { KnowledgeRepository } from '../database/repositories/knowledge.repo.js';
import { CaseRepository } from '../database/repositories/case.repo.js';
import { ModelProvider } from '../integrations/model/model-provider.interface.js';
import { ScoredKnowledgeItem } from '../domain/knowledge.js';
import { SupportCase } from '../domain/case.js';
import { logger } from '../utils/logger.js';

export interface HybridSearchResult {
  knowledge: ScoredKnowledgeItem[];
  similarCases: SupportCase[];
}

export class MemoryRetriever {
  constructor(
    private knowledgeRepo: KnowledgeRepository,
    private caseRepo: CaseRepository,
    private modelProvider: ModelProvider
  ) {}

  async search(guildId: string, query: string, limit: number = 5): Promise<HybridSearchResult> {
    logger.debug({ guildId }, 'Initiating hybrid memory search');

    // An exact question can skip embedding retrieval; answering still uses the LLM.
    const exact = await this.knowledgeRepo.searchExact(guildId, query);
    if (exact.length) return { knowledge: exact.slice(0, limit), similarCases: [] };

    // Generate embedding for query
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await this.modelProvider.generateEmbedding(query);
    } catch (err) {
      logger.warn({ err }, 'Could not generate query embedding, proceeding with lexical-only search');
    }

    // Hybrid search approved knowledge
    const knowledge = await this.knowledgeRepo.searchHybrid(guildId, query, queryEmbedding, limit);

    // Search similar historical cases
    const similarCases = await this.caseRepo.searchSimilarCases(guildId, query, limit);

    return {
      knowledge,
      similarCases,
    };
  }
}
