import { describe, it, expect, vi } from 'vitest';
import { MongoKnowledgeRepository } from '../../src/database/mongo/knowledge.mongo.js';
import { MongoCaseRepository } from '../../src/database/mongo/case.mongo.js';
import type { Db } from 'mongodb';

describe('MongoDB Repositories', () => {
  describe('MongoKnowledgeRepository', () => {
    it('creates candidate, retrieves, approves, and performs vector cosine search', async () => {
      const itemsMap = new Map<string, any>();
      const versionsMap = new Map<string, any>();
      const reviewsList: any[] = [];

      const mockCollection = {
        insertOne: vi.fn(async (doc: any) => {
          itemsMap.set(doc.knowledge_id, { ...doc });
          return { insertedId: doc.knowledge_id };
        }),
        findOne: vi.fn(async (filter: any) => {
          return itemsMap.get(filter.knowledge_id) || null;
        }),
        updateOne: vi.fn(async (filter: any, update: any) => {
          const item = itemsMap.get(filter.knowledge_id);
          if (item && update.$set) {
            Object.assign(item, update.$set);
          }
          return { modifiedCount: 1 };
        }),
        find: vi.fn((filter: any) => ({
          toArray: async () => {
            return Array.from(itemsMap.values()).filter(doc => {
              if (filter.guild_id && doc.guild_id !== filter.guild_id) return false;
              if (filter.approval_status && doc.approval_status !== filter.approval_status) return false;
              return true;
            });
          },
          sort: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        })),
        aggregate: vi.fn(() => ({
          toArray: async () => {
            throw new Error('$vectorSearch not supported on local standalone mock');
          },
        })),
      };

      const mockVersionsCollection = {
        insertOne: vi.fn(async (doc: any) => {
          versionsMap.set(doc.version_id, { ...doc });
          return { insertedId: doc.version_id };
        }),
        updateOne: vi.fn(async (filter: any, update: any) => {
          for (const ver of versionsMap.values()) {
            if (ver.knowledge_id === filter.knowledge_id && ver.version === filter.version) {
              Object.assign(ver, update.$set);
            }
          }
          return { modifiedCount: 1 };
        }),
        find: vi.fn(() => ({
          sort: vi.fn(() => ({
            toArray: async () => Array.from(versionsMap.values()),
          })),
        })),
      };

      const mockReviewsCollection = {
        insertOne: vi.fn(async (doc: any) => {
          reviewsList.push(doc);
          return { insertedId: doc.review_id };
        }),
      };

      const mockDb = {
        collection: (name: string) => {
          if (name === 'knowledge_items') return mockCollection;
          if (name === 'knowledge_versions') return mockVersionsCollection;
          if (name === 'knowledge_reviews') return mockReviewsCollection;
          throw new Error(`Unexpected collection: ${name}`);
        },
      } as unknown as Db;

      const repo = new MongoKnowledgeRepository(mockDb);

      // 1. Create candidate
      const candidate = await repo.createCandidate({
        knowledge_id: 'k_mongo_1',
        guild_id: 'guild_123',
        question_patterns: ['How do I fix node 26 sqlite build?'],
        canonical_answer: 'Use node:sqlite standard module.',
        created_by: 'user_admin',
        embedding: [1, 0, 0],
      });

      expect(candidate.knowledge_id).toBe('k_mongo_1');
      expect(candidate.approval_status).toBe('candidate');

      // 2. Approve
      const approved = await repo.approve('k_mongo_1', 'admin_reviewer', 'Looks accurate');
      expect(approved?.approval_status).toBe('approved');
      expect(reviewsList).toHaveLength(1);
      expect(reviewsList[0].decision).toBe('approve');

      // 3. Search vector fallback
      const searchResults = await repo.searchVector('guild_123', [1, 0, 0], 5, 0.5);
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].knowledge_id).toBe('k_mongo_1');
      expect(searchResults[0].similarity).toBeCloseTo(1.0, 3);
      expect(searchResults[0].canonical_answer).toBe('Use node:sqlite standard module.');

      // 4. Supersede with new version
      const updated = await repo.correctAndSupersede(
        'k_mongo_1',
        {
          canonical_answer: 'Node 26 built-in node:sqlite has zero compilation overhead.',
        },
        'admin_reviewer'
      );
      expect(updated?.current_version).toBe(2);
      expect(updated?.canonical_answer).toContain('zero compilation overhead');
    });
  });

  describe('MongoCaseRepository', () => {
    it('creates, retrieves, and updates support cases', async () => {
      const casesMap = new Map<string, any>();

      const mockCollection = {
        insertOne: vi.fn(async (doc: any) => {
          casesMap.set(doc.case_id, { ...doc });
          return { insertedId: doc.case_id };
        }),
        findOne: vi.fn(async (filter: any) => {
          if (filter.case_id) return casesMap.get(filter.case_id) || null;
          if (filter.thread_id) {
            for (const c of casesMap.values()) {
              if (c.thread_id === filter.thread_id && c.status !== 'closed') return c;
            }
          }
          return null;
        }),
        updateOne: vi.fn(async (filter: any, update: any) => {
          const item = casesMap.get(filter.case_id);
          if (item && update.$set) {
            Object.assign(item, update.$set);
          }
          return { modifiedCount: 1 };
        }),
      };

      const mockDb = {
        collection: () => mockCollection,
      } as unknown as Db;

      const repo = new MongoCaseRepository(mockDb);

      const newCase = await repo.create({
        case_id: 'case_mongo_1',
        guild_id: 'guild_123',
        channel_id: 'chan_456',
        thread_id: 'thread_789',
        message_id: 'msg_001',
        requester_id: 'user_dev',
        requester_username: 'devuser',
        category: 'install',
        title: 'Compilation failed on macOS',
        status: 'open',
      });

      expect(newCase.case_id).toBe('case_mongo_1');
      expect(newCase.status).toBe('open');

      const found = await repo.findActiveCase('chan_456', 'thread_789');
      expect(found?.case_id).toBe('case_mongo_1');

      const resolved = await repo.updateStatus('case_mongo_1', 'resolved', 'Fixed via node:sqlite');
      expect(resolved?.status).toBe('resolved');
      expect(resolved?.resolution_outcome).toBe('Fixed via node:sqlite');
    });
  });
});
