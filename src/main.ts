import { createCli } from "./cli/createCli.js";
import { GeneratorEngine } from "./core/application/generatorEngine.js";
import { ProjectExtender } from "./core/application/projectExtender.js";
import { SafeFileWriter } from "./core/infrastructure/safeFileWriter.js";
import { FileSystemTemplateRenderer } from "./core/infrastructure/fileSystemTemplateRenderer.js";
import { popularStarterPlugins } from "./plugins/popular-starters/index.js";
import { consoleLogger } from "./shared/logger.js";

export async function main(argv: string[]): Promise<void> {
  const templateRenderer = new FileSystemTemplateRenderer();
  const fileWriter = new SafeFileWriter();
  const plugins = popularStarterPlugins(templateRenderer);
  const engine = new GeneratorEngine(plugins, fileWriter);
  const extender = new ProjectExtender(fileWriter);
  const cli = createCli(engine, extender, plugins, consoleLogger);

  await cli.run(argv.slice(2));
}
