export interface AzureProviderConfig {
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
  embeddingDeploymentName?: string;
}

export interface OllamaProviderConfig {
  baseUrl?: string;
}

export interface AdvancedConfig {
  extendedThinking?: boolean;
  noCrystalSync?: boolean;
  maxConcurrentRepos?: number;
}

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'azure' | 'ollama';

export interface GeodesicConfig {
  provider: ProviderName;
  apiKey?: string;
  model?: string;
  analystId: string;
  crystalStoreRepo?: string;
  crystalStoreToken?: string;
  outputDir?: string;
  azure?: AzureProviderConfig;
  ollama?: OllamaProviderConfig;
  advanced?: AdvancedConfig;
}
