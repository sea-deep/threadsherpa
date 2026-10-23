import { ModelProvider } from './model-provider.interface.js';
import { traceAgentAction } from '../../utils/sentry.js';

/** Wrap raw HTTP providers so model, tool, and investigation spans share one trace. */
export function instrumentModelProvider(provider: ModelProvider, modelName: string, providerName: string): ModelProvider {
  const attributes = { 'gen_ai.request.model': modelName, 'gen_ai.provider.name': providerName };
  return {
    generateText: options => traceAgentAction('support.generate', 'agent.inference', attributes, () => provider.generateText(options)),
    generateStructured: options => traceAgentAction(options.schemaName || 'support.structured', 'agent.inference', attributes, () => provider.generateStructured(options)),
    generateEmbedding: text => traceAgentAction('support.embed', 'agent.inference', { 'gen_ai.provider.name': providerName, 'gen_ai.operation.name': 'embeddings' }, () => provider.generateEmbedding(text)),
    healthCheck: () => provider.healthCheck(),
  };
}
