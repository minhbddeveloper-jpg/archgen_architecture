import { ProjectExtender } from "../../core/application/projectExtender.js";
import { Logger } from "../../shared/logger.js";
import { parseSqlSchemaFile, parseValidation } from "../parsers/configParser.js";
import { parseEntityFields } from "../parsers/fieldParser.js";
import { booleanOption, CliOptions, parseOptions, requireOption, stringOption } from "../parsers/optionParser.js";

export async function runAddCommand(extender: ProjectExtender, logger: Logger, rest: string[]): Promise<void> {
  const [target, name, ...addArgs] = rest;
  if (!target) {
    throw new Error("Usage: arxgen add <entity|crud|usecase|schema> <name> [--field name:type] [--project <dir>] [--merge] [--force] [--dry-run]");
  }
  const options = target === "schema" ? parseOptions(rest.slice(1)) : parseOptions(addArgs);
  const projectRoot = stringOption(options, "project") ?? ".";
  const writeOptions = {
    dryRun: booleanOption(options, "dry-run"),
    overwrite: booleanOption(options, "force")
  };

  if (target === "schema") {
    const sqlPath = requireOption(options, "from-sql");
    const schema = await parseSqlSchemaFile(sqlPath);
    const updatedFiles: string[] = [];
    let filesWritten = 0;
    for (const entity of schema.entities) {
      const result = await extender.addEntity(projectRoot, {
        entity,
        validation: parseValidation(options),
        merge: true
      }, writeOptions);
      filesWritten += result.filesWritten;
      updatedFiles.push(...result.updatedFiles);
    }
    logger.info(`${writeOptions.dryRun ? "Would add" : "Added"} schema from ${sqlPath}: ${schema.entities.length} entities, ${filesWritten} files${updatedFiles.length ? `, updated ${[...new Set(updatedFiles)].join(", ")}` : ""}`);
    return;
  }

  if (!name) {
    throw new Error("Usage: arxgen add <entity|crud|usecase> <name> [--field name:type] [--project <dir>] [--merge] [--force] [--dry-run]");
  }

  if (target === "entity" || target === "crud") {
    const entity = { name, fields: parseEntityFields(options) };
    const request = {
      entity,
      validation: parseValidation(options),
      merge: booleanOption(options, "merge")
    };
    const result = target === "crud"
      ? await extender.addCrud(projectRoot, request, writeOptions)
      : await extender.addEntity(projectRoot, request, writeOptions);
    logger.info(`${result.dryRun ? "Would add" : "Added"} ${target} ${name}: ${result.filesWritten} files${result.updatedFiles.length ? `, updated ${result.updatedFiles.join(", ")}` : ""}`);
    return;
  }

  if (target === "usecase") {
    const result = await extender.addUseCase(projectRoot, { name }, writeOptions);
    logger.info(`${result.dryRun ? "Would add" : "Added"} usecase ${name}: ${result.filesWritten} files`);
    return;
  }

  throw new Error(`Unknown add target: ${target}`);
}
