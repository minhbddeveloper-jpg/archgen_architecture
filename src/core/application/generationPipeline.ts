import { FeatureGenerationContext, FeatureGenerator } from "../domain/featureGenerator.js";
import { GeneratedFile } from "../domain/generatedFile.js";
import { ProjectConfig } from "../domain/projectConfig.js";

export class GenerationPipeline {
  constructor(private readonly features: FeatureGenerator[]) {}

  async run(config: ProjectConfig, root: string, fullstack = false, options: { only?: string[]; skip?: string[] } = {}): Promise<GeneratedFile[]> {
    const context: FeatureGenerationContext = { config, root, fullstack };
    const files: GeneratedFile[] = [];
    const only = new Set(options.only ?? []);
    const skip = new Set(options.skip ?? []);

    for (const feature of this.features) {
      if ((only.size > 0 && !only.has(feature.name)) || skip.has(feature.name)) {
        continue;
      }
      files.push(...(await feature.generate(context)));
    }

    return files;
  }
}
