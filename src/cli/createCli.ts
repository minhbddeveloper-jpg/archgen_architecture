import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GeneratorEngine } from "../core/application/generatorEngine.js";
import { EntityConfig, EntityFieldConfig, FieldType, ProjectConfig } from "../core/domain/projectConfig.js";
import { Plugin } from "../core/domain/plugin.js";
import { Logger } from "../shared/logger.js";

type CliOptions = Record<string, string | boolean>;

interface Cli {
  run(args: string[]): Promise<void>;
}

interface CreateProjectRequest {
  config: ProjectConfig;
  outputRoot: string;
}

export function createCli(engine: GeneratorEngine, plugins: Plugin[], logger: Logger): Cli {
  return {
    async run(args: string[]): Promise<void> {
      const [command, ...rest] = args;

      if (!command || command === "--help" || command === "-h") {
        printHelp(logger);
        return;
      }

      if (command === "create") {
        const options = parseOptions(rest);
        const { config, outputRoot } = await toCreateProjectRequest(options);
        const result = await engine.createProject(config, outputRoot, {
          dryRun: booleanOption(options, "dry-run"),
          overwrite: booleanOption(options, "force")
        });
        const action = result.dryRun ? "Would generate" : "Generated";
        logger.info(`${action} ${result.filesWritten} files in ${result.outputRoot}`);
        return;
      }

      if (command === "list" && rest[0] === "plugins") {
        for (const plugin of plugins) {
          logger.info(`${plugin.name} (${plugin.language}/${plugin.framework})`);
        }
        return;
      }

      if (command === "doctor") {
        logger.info(`archgen ok: ${plugins.length} plugin(s) available`);
        return;
      }

      if (command === "add") {
        throw new Error("add commands are reserved for the next implementation phase");
      }

      throw new Error(`Unknown command: ${command}`);
    }
  };
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key === "force" || key === "dry-run") {
      options[key] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for option --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

async function toCreateProjectRequest(options: CliOptions): Promise<CreateProjectRequest> {
  const configPath = stringOption(options, "config");
  const fileConfig = configPath ? await readConfigFile(configPath) : {};
  const merged = { ...fileConfig, ...removeCliOnlyOptions(options) };
  const architecture = merged.architecture ?? "clean";

  if (architecture !== "clean" && architecture !== "hexagonal" && architecture !== "mvc") {
    throw new Error("architecture must be one of: clean, hexagonal, mvc");
  }

  return {
    config: {
      projectName: requireOption(merged, "name"),
      language: requireOption(merged, "language"),
      framework: requireOption(merged, "framework"),
      architecture,
      languageVersion: optionalString(merged, "languageVersion"),
      frameworkVersion: optionalString(merged, "frameworkVersion"),
      packageVersions: validateStringRecord(merged.packageVersions, "packageVersions"),
      database: optionalString(merged, "database"),
      orm: optionalString(merged, "orm"),
      auth: optionalString(merged, "auth"),
      entities: validateEntities(merged.entities)
    },
    outputRoot: stringOption(options, "out") ?? optionalString(fileConfig, "out") ?? optionalString(fileConfig, "outputDir") ?? "."
  };
}

async function readConfigFile(path: string): Promise<Record<string, unknown>> {
  const raw = await readFile(resolve(path), "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("config file must contain a JSON object");
  }

  return parsed;
}

function removeCliOnlyOptions(options: CliOptions): Record<string, string | boolean> {
  const { config: _config, out: _out, force: _force, "dry-run": _dryRun, ...projectOptions } = options;
  return projectOptions;
}

function stringOption(options: CliOptions, key: string): string | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`--${key} requires a value`);
  }

  return value;
}

function booleanOption(options: CliOptions, key: string): boolean {
  const value = options[key];
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new Error(`--${key} does not accept a value`);
  }

  return value;
}

function requireOption(options: Record<string, unknown>, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function optionalString(options: Record<string, unknown>, key: string): string | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }

  return value;
}

function validateStringRecord(value: unknown, key: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${key} must be an object`);
  }

  const result: Record<string, string> = {};
  for (const [recordKey, recordValue] of Object.entries(value)) {
    if (typeof recordValue !== "string" || !recordValue) {
      throw new Error(`${key}.${recordKey} must be a non-empty string`);
    }
    result[recordKey] = recordValue;
  }

  return result;
}

function validateEntities(value: unknown): EntityConfig[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("entities must be an array");
  }

  return value.map((entity, index) => {
    if (!isRecord(entity) || typeof entity.name !== "string" || !entity.name) {
      throw new Error(`entities[${index}].name must be a non-empty string`);
    }

    if (!Array.isArray(entity.fields)) {
      throw new Error(`entities[${index}].fields must be an array`);
    }

    return {
      name: entity.name,
      fields: entity.fields.map((field, fieldIndex) => validateField(field, index, fieldIndex))
    };
  });
}

function validateField(value: unknown, entityIndex: number, fieldIndex: number): EntityFieldConfig {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name) {
    throw new Error(`entities[${entityIndex}].fields[${fieldIndex}].name must be a non-empty string`);
  }

  if (!isFieldType(value.type)) {
    throw new Error(`entities[${entityIndex}].fields[${fieldIndex}].type is invalid`);
  }

  return {
    name: value.name,
    type: value.type,
    required: typeof value.required === "boolean" ? value.required : undefined
  };
}

function isFieldType(value: unknown): value is FieldType {
  return value === "string" || value === "number" || value === "boolean" || value === "date" || value === "uuid" || value === "text";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printHelp(logger: Logger): void {
  logger.info(`archgen

Commands:
  create --name <name> --language <language> --framework <framework> [--architecture clean] [--config <file>] [--out <dir>] [--force] [--dry-run]
  list plugins
  doctor`);
}
