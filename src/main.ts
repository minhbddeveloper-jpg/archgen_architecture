import { createCli } from "./cli/createCli.js";
import { GeneratorEngine } from "./core/application/generatorEngine.js";
import { SafeFileWriter } from "./core/infrastructure/safeFileWriter.js";
import { FileSystemTemplateRenderer } from "./core/infrastructure/fileSystemTemplateRenderer.js";
import { javaSpringPlugin } from "./plugins/java-spring/index.js";
import { consoleLogger } from "./shared/logger.js";

export async function main(argv: string[]): Promise<void> {
  const templateRenderer = new FileSystemTemplateRenderer();
  const fileWriter = new SafeFileWriter();
  const plugins = [javaSpringPlugin(templateRenderer)];
  const engine = new GeneratorEngine(plugins, fileWriter);
  const cli = createCli(engine, plugins, consoleLogger);

  await cli.run(argv.slice(2));
}
