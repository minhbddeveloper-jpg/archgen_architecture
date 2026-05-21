import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseSqlSchema } from "../../core/application/sqlSchemaParser.js";
import { ProjectConfig, ValidationProvider } from "../../core/domain/projectConfig.js";
import { mergeEntities, parseCliEntities, validateEntities } from "./fieldParser.js";
import { booleanOption, CliOptions, CliValue, isRecord, optionalBoolean, optionalString, requireOption, stringOption } from "./optionParser.js";
import { mergeRelations, parseRelations } from "./relationParser.js";

interface CreateProjectRequest {
  config: ProjectConfig;
  outputRoot: string;
}

export async function toCreateProjectRequest(options: CliOptions): Promise<CreateProjectRequest> {
  const configPath = stringOption(options, "config");
  const fileConfig = configPath ? await readConfigFile(configPath) : {};
  const sqlSchema = await parseSqlSchemaOption(options);
  const presetConfig = parsePreset(options);
  const merged = { ...presetConfig, ...fileConfig, ...removeCliOnlyOptions(options) };
  const architecture = merged.architecture ?? "clean";
  const fullstack = parseFullstack(options, fileConfig);
  const cliEntities = parseCliEntities(options);
  const configEntities = validateEntities(merged.entities);
  const entities = mergeEntities(cliEntities ?? configEntities, sqlSchema?.entities);
  const relations = mergeRelations(parseRelations(merged), sqlSchema?.relations);

  if (architecture !== "clean" && architecture !== "hexagonal" && architecture !== "mvc") {
    throw new Error("architecture must be one of: clean, hexagonal, mvc");
  }

  return {
    config: {
      projectName: requireOption(merged, "name"),
      language: fullstack ? "fullstack" : requireOption(merged, "language"),
      framework: fullstack ? "fullstack" : requireOption(merged, "framework"),
      architecture,
      languageVersion: optionalString(merged, "languageVersion"),
      frameworkVersion: optionalString(merged, "frameworkVersion"),
      packageVersions: validateStringRecord(merged.packageVersions, "packageVersions"),
      database: optionalString(merged, "database"),
      orm: optionalString(merged, "orm"),
      auth: optionalString(merged, "auth"),
      validation: parseValidation(merged),
      relations,
      docker: optionalBoolean(merged, "docker") ?? booleanOption(options, "docker"),
      nginx: optionalBoolean(merged, "nginx") ?? booleanOption(options, "nginx"),
      redis: optionalBoolean(merged, "redis") ?? booleanOption(options, "redis"),
      fullstack,
      entities
    },
    outputRoot: stringOption(options, "out") ?? optionalString(fileConfig, "out") ?? optionalString(fileConfig, "outputDir") ?? "."
  };
}

async function parseSqlSchemaOption(options: CliOptions): Promise<ReturnType<typeof parseSqlSchema> | undefined> {
  const sqlPath = stringOption(options, "from-sql");
  if (!sqlPath) {
    return undefined;
  }
  return parseSqlSchemaFile(sqlPath);
}

export async function parseSqlSchemaFile(path: string): Promise<ReturnType<typeof parseSqlSchema>> {
  const raw = await readFile(resolve(path), "utf8");
  return parseSqlSchema(raw);
}

async function readConfigFile(path: string): Promise<Record<string, unknown>> {
  const raw = await readFile(resolve(path), "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("config file must contain a JSON object");
  }

  return parsed;
}

function removeCliOnlyOptions(options: CliOptions): Record<string, CliValue> {
  const { config: _config, out: _out, project: _project, preset: _preset, force: _force, merge: _merge, "save-config": _saveConfig, "dry-run": _dryRun, "from-sql": _fromSql, entity: _entity, field: _field, frontend: _frontend, backend: _backend, ...projectOptions } = options;
  return projectOptions;
}

function parseFullstack(options: CliOptions, fileConfig: Record<string, unknown>): ProjectConfig["fullstack"] {
  const cliFrontend = stringOption(options, "frontend");
  const cliBackend = stringOption(options, "backend");
  if (cliFrontend || cliBackend) {
    if (!cliFrontend || !cliBackend) {
      throw new Error("--frontend and --backend must be used together");
    }
    return {
      frontend: stackFromAlias(cliFrontend, "frontend"),
      backend: stackFromAlias(cliBackend, "backend")
    };
  }

  const value = fileConfig.fullstack;
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value) || !isRecord(value.frontend) || !isRecord(value.backend)) {
    throw new Error("fullstack must contain frontend and backend objects");
  }
  return {
    frontend: {
      language: requireOption(value.frontend, "language"),
      framework: requireOption(value.frontend, "framework")
    },
    backend: {
      language: requireOption(value.backend, "language"),
      framework: requireOption(value.backend, "framework")
    }
  };
}

function parsePreset(options: CliOptions): Record<string, unknown> {
  const preset = stringOption(options, "preset");
  if (!preset) {
    return {};
  }

  if (preset === "saas") {
    return {
      language: "typescript",
      framework: "express",
      architecture: "clean",
      database: "postgres",
      orm: "prisma",
      validation: "zod",
      auth: "jwt",
      redis: true,
      docker: true,
      nginx: true
    };
  }

  throw new Error(`Unknown preset: ${preset}`);
}

function stackFromAlias(value: string, kind: "frontend" | "backend"): { language: string; framework: string } {
  const aliases: Record<string, { language: string; framework: string }> = {
    react: { language: "typescript", framework: "react" },
    express: { language: "typescript", framework: "express" },
    fastapi: { language: "python", framework: "fastapi" },
    django: { language: "python", framework: "django" },
    spring: { language: "java", framework: "spring" },
    aspnetcore: { language: "csharp", framework: "aspnetcore" },
    laravel: { language: "php", framework: "laravel" },
    gin: { language: "go", framework: "gin" },
    rails: { language: "ruby", framework: "rails" },
    ktor: { language: "kotlin", framework: "ktor" }
  };
  const stack = aliases[value.toLowerCase()];
  if (!stack) {
    throw new Error(`Unknown ${kind} stack: ${value}`);
  }
  return stack;
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

export function parseValidation(options: Record<string, unknown>): ValidationProvider | undefined {
  const value = optionalString(options, "validation");
  if (value === undefined) {
    return undefined;
  }
  if (value !== "zod" && value !== "class-validator" && value !== "joi") {
    throw new Error("--validation must be one of: zod, class-validator, joi");
  }
  return value;
}
