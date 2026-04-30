import type { AIProvider, GeodeConfig } from '@geode/types';
import { ProviderError } from '@geode/types';

type ProviderFactory = (config: GeodeConfig) => AIProvider;

// Lazy-loaded adapter map — no provider SDK is imported at module load time
async function loadFactory(name: string): Promise<{ createProvider: ProviderFactory; createEchoProvider: ProviderFactory }> {
  switch (name) {
    case 'anthropic': return import('./anthropic.js');
    case 'openai':    return import('./openai.js');
    case 'gemini':    return import('./gemini.js');
    case 'azure':     return import('./azure.js');
    case 'ollama':    return import('./ollama.js');
    default:
      throw new ProviderError(name, 'UNKNOWN', `Unknown provider: "${name}". Valid: anthropic, openai, gemini, azure, ollama`, false);
  }
}

/**
 * Loads and instantiates the primary AIProvider from the given config.
 * The correct adapter module is loaded lazily — only the configured provider's
 * SDK dependency is imported.
 */
export async function loadProvider(config: GeodeConfig): Promise<AIProvider> {
  const mod = await loadFactory(config.provider);
  return mod.createProvider(config);
}

/**
 * Loads the Echo provider — cheapest adapter for the configured provider.
 * Used by the shadow/hint process.
 */
export async function loadEchoProvider(config: GeodeConfig): Promise<AIProvider> {
  const mod = await loadFactory(config.provider);
  return mod.createEchoProvider(config);
}
