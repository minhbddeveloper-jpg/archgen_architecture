import { Generator } from "./generator.js";
import { ProjectConfig } from "./projectConfig.js";

export interface PluginCapabilities {
  entities?: boolean;
  crud?: boolean;
  dto?: boolean;
  validation?: string[] | boolean;
  pagination?: boolean;
  auth?: string[];
  orm?: string[];
  relations?: boolean;
  extendExistingProject?: boolean;
  schemaUpgrade?: boolean | "partial";
  productionReady?: boolean;
}

export interface Plugin {
  name: string;
  language: string;
  framework: string;
  capabilities?: PluginCapabilities;
  supports(config: ProjectConfig): boolean;
  getGenerators(): Generator[];
}
