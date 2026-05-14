import { Generator } from "./generator.js";
import { ProjectConfig } from "./projectConfig.js";

export interface Plugin {
  name: string;
  language: string;
  framework: string;
  supports(config: ProjectConfig): boolean;
  getGenerators(): Generator[];
}
