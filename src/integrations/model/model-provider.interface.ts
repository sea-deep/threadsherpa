import { z } from 'zod';

export interface TextGenerationOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface StructuredGenerationOptions<T> extends TextGenerationOptions {
  schema: z.ZodType<T, z.ZodTypeDef, any>;
  schemaName?: string;
}

export interface ModelHealthStatus {
  ok: boolean;
  models: string[];
  selectedModelAvailable: boolean;
  embeddingModelAvailable: boolean;
  error?: string;
}

export interface ModelProvider {
  generateText(options: TextGenerationOptions): Promise<string>;
  generateStructured<T>(options: StructuredGenerationOptions<T>): Promise<T>;
  generateEmbedding(text: string): Promise<number[]>;
  healthCheck(): Promise<ModelHealthStatus>;
}
