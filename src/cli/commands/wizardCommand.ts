import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { GeneratorEngine } from "../../core/application/generatorEngine.js";
import { ProjectConfig } from "../../core/domain/projectConfig.js";
import { Logger } from "../../shared/logger.js";
import { toCreateProjectRequest } from "../parsers/configParser.js";
import { booleanOption, CliOptions } from "../parsers/optionParser.js";

export async function runWizardCommand(engine: GeneratorEngine, logger: Logger): Promise<void> {
  const options = await promptCreateOptions();
  const { config, outputRoot } = await toCreateProjectRequest(options);
  printProjectPreview(config, outputRoot);
  if (booleanOption(options, "save-config")) {
    await writeFile("arxgen.json", `${JSON.stringify({ ...config, out: outputRoot }, null, 2)}\n`, "utf8");
    logger.info("Saved arxgen.json");
  }
  const result = await engine.createProject(config, outputRoot, {
    dryRun: booleanOption(options, "dry-run"),
    overwrite: booleanOption(options, "force")
  });
  const action = result.dryRun ? "Would generate" : "Generated";
  logger.info(`${action} ${result.filesWritten} files in ${result.outputRoot}`);
}

async function promptCreateOptions(): Promise<CliOptions> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = await rl.question("Project name: ");
    const language = await rl.question("Language: ");
    const framework = await rl.question("Framework: ");
    const out = await rl.question("Output directory [.]: ");
    const database = await rl.question("Database [none/postgres/mysql/mongodb]: ");
    const orm = await rl.question("ORM [none/prisma/sqlalchemy/efcore/jpa/gorm/eloquent]: ");
    const validation = await rl.question("Validation [none/zod/class-validator/joi]: ");
    const auth = await rl.question("Auth [none/jwt]: ");
    const authMode = await rl.question("Auth mode [scaffold/production]: ");
    const saveConfig = await rl.question("Save arxgen.json? [y/N]: ");

    const options: CliOptions = {
      name,
      language,
      framework,
      out: out || "."
    };
    if (database && database !== "none") options.database = database;
    if (orm && orm !== "none") options.orm = orm;
    if (validation && validation !== "none") options.validation = validation;
    if (auth && auth !== "none") options.auth = auth;
    if (authMode && authMode !== "scaffold") options["auth-mode"] = authMode;
    if (saveConfig.toLowerCase() === "y" || saveConfig.toLowerCase() === "yes") options["save-config"] = true;
    return options;
  } finally {
    rl.close();
  }
}

function printProjectPreview(config: ProjectConfig, outputRoot: string): void {
  console.log("Project preview:");
  console.log(`${outputRoot}/${config.projectName}/`);
  console.log("  src/");
  console.log("    domain/");
  console.log("    application/");
  console.log("    infrastructure/");
  console.log("    presentation/");
  if (config.entities?.length) {
    console.log(`  entities: ${config.entities.map((entity) => entity.name).join(", ")}`);
  }
}
