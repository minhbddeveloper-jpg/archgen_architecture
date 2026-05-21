import { ProjectExtender } from "../../core/application/projectExtender.js";
import { Logger } from "../../shared/logger.js";
import { formatSchemaUpgradeResult } from "../formatters/schemaUpgradeFormatter.js";
import { parseSqlSchemaFile, parseValidation } from "../parsers/configParser.js";
import { booleanOption, CliOptions, requireOption, stringOption } from "../parsers/optionParser.js";

export async function runUpgradeSchemaCommand(extender: ProjectExtender, logger: Logger, options: CliOptions): Promise<void> {
  const sqlPath = requireOption(options, "from-sql");
  const schema = await parseSqlSchemaFile(sqlPath);
  const projectRoot = stringOption(options, "project") ?? ".";
  const result = await extender.upgradeSchema(projectRoot, {
    entities: schema.entities,
    validation: parseValidation(options)
  }, {
    dryRun: booleanOption(options, "dry-run"),
    overwrite: booleanOption(options, "force")
  });
  logger.info(formatSchemaUpgradeResult(sqlPath, result));
}
