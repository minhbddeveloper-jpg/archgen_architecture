import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { GeneratedFile } from "../domain/generatedFile.js";
import { FileWriter } from "../application/ports/fileWriter.js";

export class SafeFileWriter implements FileWriter {
  async writeFiles(outputRoot: string, files: GeneratedFile[]): Promise<void> {
    const root = resolve(outputRoot);
    await mkdir(root, { recursive: true });

    for (const file of files) {
      const target = resolve(root, file.path);
      const relativeTarget = relative(root, target);

      if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
        throw new Error(`Refusing to write outside output root: ${file.path}`);
      }

      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
  }
}
