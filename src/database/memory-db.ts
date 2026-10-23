import type { Db, Collection, Document, Filter, UpdateFilter, Sort, FindOptions } from 'mongodb';

export class MemoryCollection<T extends Document = Document> {
  private docs: Map<string, T> = new Map();
  private autoInc = 1;

  constructor(public readonly collectionName: string) {}

  private getDocId(doc: Record<string, unknown>): string {
    if (doc._id) return String(doc._id);
    if (doc.version_id) return String(doc.version_id);
    if (doc.review_id) return String(doc.review_id);
    if (doc.evidence_id) return String(doc.evidence_id);
    if (doc.event_id) return String(doc.event_id);
    if (doc.run_id) return String(doc.run_id);
    if (doc.case_id && this.collectionName === 'support_cases') return String(doc.case_id);
    if (doc.knowledge_id && this.collectionName === 'knowledge_items') return String(doc.knowledge_id);
    if (doc.delivery_id && this.collectionName === 'answer_deliveries') return String(doc.delivery_id);
    if (doc.preview_id && this.collectionName === 'share_previews') return String(doc.preview_id);
    if (doc.guild_id && this.collectionName === 'guild_configs') return String(doc.guild_id);
    return `mem_${this.autoInc++}`;
  }

  async insertOne(doc: T): Promise<{ insertedId: string; acknowledged: boolean }> {
    const cloned = JSON.parse(JSON.stringify(doc)) as T;
    const id = this.getDocId(cloned);
    if (this.collectionName === 'answer_deliveries' && this.docs.has(id)) {
      throw Object.assign(new Error('Duplicate delivery'), { code: 11000 });
    }
    if (!(cloned as Record<string, unknown>)._id) {
      (cloned as Record<string, unknown>)._id = id;
    }
    this.docs.set(id, cloned);
    return { insertedId: id, acknowledged: true };
  }

  async insertMany(docs: T[]): Promise<{ insertedCount: number; insertedIds: Record<number, string>; acknowledged: boolean }> {
    const ids: Record<number, string> = {};
    for (let i = 0; i < docs.length; i++) {
      const res = await this.insertOne(docs[i]);
      ids[i] = res.insertedId;
    }
    return { insertedCount: docs.length, insertedIds: ids, acknowledged: true };
  }

  async findOne(filter: Filter<T> = {}, options?: FindOptions): Promise<T | null> {
    const cursor = this.find(filter, options);
    if (options?.sort) cursor.sort(options.sort as Sort);
    const list = await cursor.toArray();
    return list.length > 0 ? list[0] : null;
  }

  find(filter: Filter<T> = {}, options?: FindOptions) {
    let results = Array.from(this.docs.values()).filter(doc => this.matchesFilter(doc, filter));

    let sortSpec: Sort | null = null;
    let limitVal: number | null = null;
    let skipVal = 0;

    const cursor = {
      sort: (spec: Sort) => {
        sortSpec = spec;
        return cursor;
      },
      limit: (n: number) => {
        limitVal = n;
        return cursor;
      },
      skip: (n: number) => {
        skipVal = n;
        return cursor;
      },
      project: () => cursor,
      toArray: async (): Promise<T[]> => {
        let output = [...results];

        if (sortSpec) {
          const keys = Object.keys(sortSpec);
          output.sort((a, b) => {
            for (const key of keys) {
              const dir = (sortSpec as Record<string, number>)[key] >= 0 ? 1 : -1;
              const valA = (a as Record<string, unknown>)[key];
              const valB = (b as Record<string, unknown>)[key];
              if (valA === valB) continue;
              if (valA === undefined || valA === null) return 1;
              if (valB === undefined || valB === null) return -1;
              return valA > valB ? dir : -dir;
            }
            return 0;
          });
        }

        if (skipVal > 0) {
          output = output.slice(skipVal);
        }

        if (limitVal !== null && limitVal >= 0) {
          output = output.slice(0, limitVal);
        }

        return JSON.parse(JSON.stringify(output)) as T[];
      },
    };

    return cursor;
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>, options?: { upsert?: boolean }): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount: number; upsertedId?: string }> {
    // Match and mutate in one synchronous section, like MongoDB single-document updates.
    const existing = [...this.docs.values()].find(doc => this.matchesFilter(doc, filter));
    if (!existing) {
      if (options?.upsert) {
        const newDoc = { ...(filter as Record<string, unknown>) } as T;
        this.applyUpdate(newDoc, update);
        const res = await this.insertOne(newDoc);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: res.insertedId };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }

    const id = this.getDocId(existing);
    const target = this.docs.get(id);
    if (target) {
      this.applyUpdate(target, update);
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  async updateMany(filter: Filter<T>, update: UpdateFilter<T>): Promise<{ matchedCount: number; modifiedCount: number }> {
    const matches = Array.from(this.docs.values()).filter(doc => this.matchesFilter(doc, filter));
    let modified = 0;
    for (const doc of matches) {
      const id = this.getDocId(doc);
      const target = this.docs.get(id);
      if (target) {
        this.applyUpdate(target, update);
        modified++;
      }
    }
    return { matchedCount: matches.length, modifiedCount: modified };
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const doc = await this.findOne(filter);
    if (!doc) return { deletedCount: 0 };
    const id = this.getDocId(doc);
    const deleted = this.docs.delete(id);
    return { deletedCount: deleted ? 1 : 0 };
  }

  async deleteMany(filter: Filter<T> = {}): Promise<{ deletedCount: number }> {
    const matches = Array.from(this.docs.values()).filter(doc => this.matchesFilter(doc, filter));
    let count = 0;
    for (const doc of matches) {
      const id = this.getDocId(doc);
      if (this.docs.delete(id)) {
        count++;
      }
    }
    return { deletedCount: count };
  }

  async countDocuments(filter: Filter<T> = {}): Promise<number> {
    const list = Array.from(this.docs.values()).filter(doc => this.matchesFilter(doc, filter));
    return list.length;
  }

  async createIndex(spec: unknown, options?: unknown): Promise<string> {
    return `index_${JSON.stringify(spec)}_${JSON.stringify(options || {})}`;
  }

  aggregate(pipeline: unknown[] = []) {
    return {
      toArray: async (): Promise<unknown[]> => {
        // If vector search stage is present, throw error to simulate standalone MongoDB / trigger cosine fallback
        for (const stage of pipeline) {
          if (stage && typeof stage === 'object' && '$vectorSearch' in (stage as Record<string, unknown>)) {
            throw new Error('$vectorSearch not configured on standalone memory store; falling back to cosine search');
          }
        }
        return Array.from(this.docs.values());
      },
    };
  }

  private applyUpdate(target: T, update: UpdateFilter<T>): void {
    const u = update as Record<string, unknown>;
    if (u.$set && typeof u.$set === 'object') {
      for (const [key, value] of Object.entries(u.$set as Record<string, unknown>)) {
        const parts = key.split('.');
        let record = target as Record<string, unknown>;
        for (const part of parts.slice(0, -1)) {
          if (!record[part] || typeof record[part] !== 'object') record[part] = {};
          record = record[part] as Record<string, unknown>;
        }
        record[parts.at(-1)!] = value;
      }
    }
    if (u.$inc && typeof u.$inc === 'object') {
      for (const [key, incVal] of Object.entries(u.$inc as Record<string, number>)) {
        const current = (target as Record<string, unknown>)[key];
        (target as Record<string, unknown>)[key] = (typeof current === 'number' ? current : 0) + incVal;
      }
    }
    if (u.$push && typeof u.$push === 'object') {
      for (const [key, pushVal] of Object.entries(u.$push as Record<string, unknown>)) {
        const current = (target as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current.push(pushVal);
        } else {
          (target as Record<string, unknown>)[key] = [pushVal];
        }
      }
    }
  }

  private matchesFilter(doc: T, filter: Filter<T>): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;
    const docObj = doc as Record<string, unknown>;
    const fObj = filter as Record<string, unknown>;

    if (Array.isArray(fObj.$or)) {
      const matchesOr = fObj.$or.some(subFilter => this.matchesFilter(doc, subFilter as Filter<T>));
      if (!matchesOr) return false;
    }

    if (Array.isArray(fObj.$and)) {
      const matchesAnd = fObj.$and.every(subFilter => this.matchesFilter(doc, subFilter as Filter<T>));
      if (!matchesAnd) return false;
    }

    if (fObj.$text && typeof fObj.$text === 'object') {
      const searchStr = String((fObj.$text as Record<string, unknown>).$search || '').toLowerCase();
      const words = searchStr.split(/\s+/).filter(Boolean);
      const jsonStr = JSON.stringify(docObj).toLowerCase();
      const hasWord = words.some(w => jsonStr.includes(w));
      if (!hasWord) return false;
    }

    for (const [key, expected] of Object.entries(fObj)) {
      if (key === '$or' || key === '$and' || key === '$text') continue;

      const actual = docObj[key];
      if (expected === null && actual === undefined) continue;

      if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof RegExp)) {
        const expObj = expected as Record<string, unknown>;

        if ('$ne' in expObj) {
          if (actual === expObj.$ne) return false;
        }
        if ('$eq' in expObj) {
          if (actual !== expObj.$eq) return false;
        }
        if ('$in' in expObj) {
          const list = expObj.$in as unknown[];
          if (!list.includes(actual)) return false;
        }
        if ('$nin' in expObj) {
          const list = expObj.$nin as unknown[];
          if (list.includes(actual)) return false;
        }
        if ('$regex' in expObj) {
          const regex = expObj.$regex instanceof RegExp ? expObj.$regex : new RegExp(String(expObj.$regex), 'i');
          if (!regex.test(String(actual || ''))) return false;
        }
        if ('$exists' in expObj) {
          const exists = actual !== undefined;
          if (exists !== Boolean(expObj.$exists)) return false;
        }
      } else if (expected instanceof RegExp) {
        if (!expected.test(String(actual || ''))) return false;
      } else if (Array.isArray(actual)) {
        if (Array.isArray(expected)) {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) return false;
        } else {
          if (!actual.includes(expected)) return false;
        }
      } else {
        if (actual !== expected) return false;
      }
    }

    return true;
  }
}

export class MemoryMongoDb {
  private collections: Map<string, MemoryCollection> = new Map();

  collection<T extends Document = Document>(name: string): Collection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MemoryCollection(name));
    }
    return this.collections.get(name)! as unknown as Collection<T>;
  }

  async dropDatabase(): Promise<boolean> {
    this.collections.clear();
    return true;
  }
}

const memoryDbRegistry = new Map<string, MemoryMongoDb>();

export function createMemoryMongoDb(): Db {
  return new MemoryMongoDb() as unknown as Db;
}

export function getOrCreateMemoryMongoDb(name: string = 'threadsherpa'): Db {
  if (!memoryDbRegistry.has(name)) {
    memoryDbRegistry.set(name, new MemoryMongoDb());
  }
  return memoryDbRegistry.get(name)! as unknown as Db;
}

export function clearMemoryDatabases(): void {
  memoryDbRegistry.clear();
}
