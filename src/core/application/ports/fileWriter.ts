import { GeneratedFile } from "../../domain/generatedFile.js";

export interface WriteFilesOptions {
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface FileWriter {
  writeFiles(outputRoot: string, files: GeneratedFile[], options?: WriteFilesOptions): Promise<void>;
}
