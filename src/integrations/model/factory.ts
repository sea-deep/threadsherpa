import { AppConfig } from '../../config/env.js';
import { ModelProvider } from './model-provider.interface.js';
import { OllamaProvider } from './ollama.provider.js';
import { OpenAICompatibleProvider } from './openai.provider.js';
import { logger } from '../../utils/logger.js';

export function createModelProvider(config: AppConfig): ModelProvider {
  switch (config.MODEL_PROVIDER) {
    case 'paper':
    case 'paperinstruments': {
      const apiKey = config.PAPER_INSTRUMENTS_API_KEY || config.PAPERINSTRUMENTS_API_KEY || config.OPENAI_API_KEY || '';
      const baseUrl = config.OPENAI_BASE_URL || 'https://api.paperinstruments.com/v1';
      const model = config.PAPER_MODEL || config.OPENAI_MODEL || 'ultramarine-1-flash';
      const embeddingModel = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

      logger.info({ provider: 'Paper Instruments', model, baseUrl }, 'Initializing Paper Instruments Ultramarine model provider');
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model,
        embeddingModel,
        defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
      });
    }

    case 'gemini': {
      const apiKey = config.GEMINI_API_KEY || config.OPENAI_API_KEY || '';
      const baseUrl = config.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
      const model = config.OPENAI_MODEL || 'gemini-2.0-flash';
      const embeddingModel = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-004';

      logger.info({ provider: 'Google Gemini', model, baseUrl }, 'Initializing Gemini cloud model provider');
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model,
        embeddingModel,
        defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
      });
    }

    case 'groq': {
      const apiKey = config.GROQ_API_KEY || config.OPENAI_API_KEY || '';
      const baseUrl = config.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
      const model = config.OPENAI_MODEL || 'llama-3.3-70b-versatile';
      const embeddingModel = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

      logger.info({ provider: 'Groq Cloud', model, baseUrl }, 'Initializing Groq cloud model provider');
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model,
        embeddingModel,
        defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
      });
    }

    case 'openrouter': {
      const apiKey = config.OPENAI_API_KEY || '';
      const baseUrl = config.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
      const model = config.OPENAI_MODEL || 'google/gemini-2.0-flash-001';
      const embeddingModel = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

      logger.info({ provider: 'OpenRouter', model, baseUrl }, 'Initializing OpenRouter cloud model provider');
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model,
        embeddingModel,
        defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
      });
    }

    case 'openai': {
      const apiKey = config.OPENAI_API_KEY || '';
      const baseUrl = config.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const model = config.OPENAI_MODEL || 'gpt-4o-mini';
      const embeddingModel = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

      logger.info({ provider: 'OpenAI', model, baseUrl }, 'Initializing OpenAI cloud model provider');
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl,
        model,
        embeddingModel,
        defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
      });
    }

    case 'ollama':
    default: {
      logger.info({
        provider: 'Ollama Local',
        model: config.OLLAMA_MODEL,
        baseUrl: config.OLLAMA_BASE_URL,
      }, 'Initializing Ollama local model provider');

      return new OllamaProvider({
        baseUrl: config.OLLAMA_BASE_URL,
        model: config.OLLAMA_MODEL,
        embeddingModel: config.OLLAMA_EMBEDDING_MODEL,
        defaultTimeoutMs: config.OLLAMA_TIMEOUT_MS,
      });
    }
  }
}
