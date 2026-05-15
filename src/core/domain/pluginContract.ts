import { GeneratedFile } from "./generatedFile.js";
import { EntityConfig, ProjectConfig } from "./projectConfig.js";

export interface GenerationContext {
  config: ProjectConfig;
  entity?: EntityConfig;
}

export interface StackCapability {
  entities?: boolean;
  crud?: boolean;
  dto?: boolean;
  validation?: boolean;
  pagination?: boolean;
  auth?: string[];
  orm?: string[];
  relations?: boolean;
  extendExistingProject?: boolean;
}

export interface StackPluginContract {
  name: string;
  language: string;
  framework: string;
  capabilities: StackCapability;
  generateProject(config: ProjectConfig): Promise<GeneratedFile[]>;
}
