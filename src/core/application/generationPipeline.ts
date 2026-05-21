import { FeatureGenerationContext, FeatureGenerator } from "../domain/featureGenerator.js";
import { GeneratedFile } from "../domain/generatedFile.js";
import { ProjectConfig } from "../domain/projectConfig.js";

export class GenerationPipeline {
  private readonly features: FeatureGenerator[];
  private readonly featureNames: Set<string>;
  private readonly capabilities: Set<string>;

  constructor(features: FeatureGenerator[]) {
    this.features = orderFeatures(validateFeatures(features));
    this.featureNames = new Set(this.features.map((feature) => feature.name));
    this.capabilities = new Set(this.features.flatMap((feature) => feature.capabilities ?? []));
  }

  async run(config: ProjectConfig, root: string, fullstack = false, options: { only?: string[]; skip?: string[]; requiredCapabilities?: string[] } = {}): Promise<GeneratedFile[]> {
    this.validateRunOptions(options);
    const context: FeatureGenerationContext = { config, root, fullstack };
    const files: GeneratedFile[] = [];
    const only = new Set(options.only ?? []);
    const skip = new Set(options.skip ?? []);

    for (const feature of this.features) {
      if ((only.size > 0 && !only.has(feature.name)) || skip.has(feature.name)) {
        continue;
      }
      if (feature.canGenerate && !feature.canGenerate(context)) {
        continue;
      }
      files.push(...(await feature.generate(context)));
    }

    return files;
  }

  private validateRunOptions(options: { only?: string[]; skip?: string[]; requiredCapabilities?: string[] }): void {
    for (const name of [...(options.only ?? []), ...(options.skip ?? [])]) {
      if (!this.featureNames.has(name)) {
        throw new Error(`Unknown generation feature: ${name}`);
      }
    }

    for (const capability of options.requiredCapabilities ?? []) {
      if (!this.capabilities.has(capability)) {
        throw new Error(`Generation pipeline does not provide required capability: ${capability}`);
      }
    }
  }
}

function validateFeatures(features: FeatureGenerator[]): FeatureGenerator[] {
  const names = new Set<string>();
  for (const feature of features) {
    if (names.has(feature.name)) {
      throw new Error(`Duplicate generation feature: ${feature.name}`);
    }
    names.add(feature.name);
  }

  for (const feature of features) {
    for (const dependency of feature.dependsOn ?? []) {
      if (!names.has(dependency)) {
        throw new Error(`Generation feature ${feature.name} depends on unknown feature: ${dependency}`);
      }
    }
  }

  return features;
}

function orderFeatures(features: FeatureGenerator[]): FeatureGenerator[] {
  const byName = new Map(features.map((feature) => [feature.name, feature]));
  const ordered: FeatureGenerator[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(feature: FeatureGenerator): void {
    if (visited.has(feature.name)) return;
    if (visiting.has(feature.name)) {
      throw new Error(`Circular generation feature dependency: ${feature.name}`);
    }

    visiting.add(feature.name);
    for (const dependency of feature.dependsOn ?? []) {
      visit(byName.get(dependency)!);
    }
    visiting.delete(feature.name);
    visited.add(feature.name);
    ordered.push(feature);
  }

  for (const feature of features) {
    visit(feature);
  }

  return ordered;
}
