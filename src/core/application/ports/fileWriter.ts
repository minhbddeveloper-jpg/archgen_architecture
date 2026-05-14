import { GeneratedFile } from "../../domain/generatedFile.js";

export interface FileWriter {
  writeFiles(outputRoot: string, files: GeneratedFile[]): Promise<void>;
}
