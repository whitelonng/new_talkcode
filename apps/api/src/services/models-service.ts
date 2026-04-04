import type { ModelConfig, ModelsConfiguration, ModelVersionResponse } from '@talkcody/shared';
import modelsConfig from '@talkcody/shared/data/models-config.json';

export class ModelsService {
  getVersion(): ModelVersionResponse {
    return {
      version: (modelsConfig as ModelsConfiguration).version,
    };
  }

  getConfigs(): ModelsConfiguration {
    return modelsConfig as ModelsConfiguration;
  }

  getModel(modelKey: string): ModelConfig | null {
    const config = modelsConfig as ModelsConfiguration;
    return config.models[modelKey] || null;
  }

  getModelKeys(): string[] {
    const config = modelsConfig as ModelsConfiguration;
    return Object.keys(config.models);
  }

  getModelsCount(): number {
    const config = modelsConfig as ModelsConfiguration;
    return Object.keys(config.models).length;
  }
}

// Export singleton instance
export const modelsService = new ModelsService();
