import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { GeneratedFile } from "../domain/generatedFile.js";
import { FileWriter, WriteFilesOptions } from "../application/ports/fileWriter.js";

export class SafeFileWriter implements FileWriter {
  async writeFiles(outputRoot: string, files: GeneratedFile[], options: WriteFilesOptions = {}): Promise<void> {
    const root = resolve(outputRoot);
    if (!options.dryRun && !(await exists(root))) {
      await mkdir(root, { recursive: true });
    }

    for (const file of files) {
      const target = resolve(root, file.path);
      const relativeTarget = relative(root, target);

      if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
        throw new Error(`Refusing to write outside output root: ${file.path}`);
      }

      if (!options.dryRun && !options.overwrite && (await exists(target))) {
        throw new Error(`Refusing to overwrite existing file: ${file.path}. Use --force to overwrite.`);
      }

      if (options.dryRun) {
        continue;
      }

      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
