import { GeneratorEngine } from "../../core/application/generatorEngine.js";
import { Logger } from "../../shared/logger.js";
import { toCreateProjectRequest } from "../parsers/configParser.js";
import { booleanOption, CliOptions } from "../parsers/optionParser.js";

export async function runCreateCommand(engine: GeneratorEngine, logger: Logger, options: CliOptions): Promise<void> {
  const { config, outputRoot } = await toCreateProjectRequest(options);
  const result = await engine.createProject(config, outputRoot, {
    dryRun: booleanOption(options, "dry-run"),
    overwrite: booleanOption(options, "force")
  });
  const action = result.dryRun ? "Would generate" : "Generated";
  logger.info(`${action} ${result.filesWritten} files in ${result.outputRoot}`);
}
