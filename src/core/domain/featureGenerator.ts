import { GeneratedFile } from "./generatedFile.js";
import { ProjectConfig } from "./projectConfig.js";

export interface FeatureGenerationContext {
  config: ProjectConfig;
  root: string;
  fullstack?: boolean;
}

export interface FeatureGenerator {
  name: string;
  generate(context: FeatureGenerationContext): Promise<GeneratedFile[]> | GeneratedFile[];
}
