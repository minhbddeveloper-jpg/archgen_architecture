import { GeneratedFile } from "./generatedFile.js";
import { ProjectConfig } from "./projectConfig.js";

export interface Generator {
  generate(config: ProjectConfig): Promise<GeneratedFile[]>;
}
