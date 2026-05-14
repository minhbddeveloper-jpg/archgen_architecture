import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { TemplateRenderer } from "../application/ports/templateRenderer.js";

export class FileSystemTemplateRenderer implements TemplateRenderer {
  async render(templatePath: string, context: Record<string, unknown>): Promise<string> {
    const absolutePath = resolve(templatePath);
    const source = await readFile(absolutePath, "utf8");
    const template = Handlebars.compile(source, { noEscape: true });

    return template(context);
  }
}
