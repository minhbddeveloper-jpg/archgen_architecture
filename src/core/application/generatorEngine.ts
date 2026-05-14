import { GeneratedFile } from "../domain/generatedFile.js";
import { Plugin } from "../domain/plugin.js";
import { ProjectConfig } from "../domain/projectConfig.js";
import { FileWriter } from "./ports/fileWriter.js";

export interface CreateProjectResult {
  outputRoot: string;
  filesWritten: number;
}

export class GeneratorEngine {
  constructor(
    private readonly plugins: Plugin[],
    private readonly fileWriter: FileWriter
  ) {}

  async createProject(config: ProjectConfig, outputRoot: string): Promise<CreateProjectResult> {
    const plugin = this.plugins.find((candidate) => candidate.supports(config));

    if (!plugin) {
      throw new Error(`No plugin supports ${config.language}/${config.framework}/${config.architecture}`);
    }

    const files: GeneratedFile[] = [];
    for (const generator of plugin.getGenerators()) {
      files.push(...(await generator.generate(config)));
    }

    await this.fileWriter.writeFiles(outputRoot, files);

    return {
      outputRoot,
      filesWritten: files.length
    };
  }
}
