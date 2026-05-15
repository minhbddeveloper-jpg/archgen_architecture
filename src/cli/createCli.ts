import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { GeneratorEngine } from "../core/application/generatorEngine.js";
import { ProjectExtender } from "../core/application/projectExtender.js";
import { parseSqlSchema } from "../core/application/sqlSchemaParser.js";
import { EntityConfig, EntityFieldConfig, FieldType, ProjectConfig, RelationConfig, RelationKind, ValidationProvider } from "../core/domain/projectConfig.js";
import { Plugin } from "../core/domain/plugin.js";
import { Logger } from "../shared/logger.js";

type CliValue = string | boolean | string[];
type CliOptions = Record<string, CliValue>;

interface Cli {
  run(args: string[]): Promise<void>;
}

interface CreateProjectRequest {
  config: ProjectConfig;
  outputRoot: string;
}

export function createCli(engine: GeneratorEngine, extender: ProjectExtender, plugins: Plugin[], logger: Logger): Cli {
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

      if (command === "wizard") {
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
        return;
      }

      if (command === "list" && rest[0] === "plugins") {
        for (const plugin of plugins) {
          logger.info(`${plugin.name} (${plugin.language}/${plugin.framework})`);
        }
        return;
      }

      if (command === "doctor") {
        logger.info(`arxgen ok: ${plugins.length} plugin(s) available`);
        return;
      }

      if (command === "upgrade") {
        const [target, ...upgradeArgs] = rest;
        if (target !== "schema") {
          throw new Error("Usage: arxgen upgrade schema --from-sql schema.sql [--project <dir>] [--validation zod] [--dry-run]");
        }
        const options = parseOptions(upgradeArgs);
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
        return;
      }

      if (command === "add") {
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
    if (key === "force" || key === "dry-run" || key === "docker" || key === "nginx" || key === "redis" || key === "merge" || key === "save-config") {
      options[key] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for option --${key}`);
    }

    appendOption(options, key, value);
    index += 1;
  }

  return options;
}

function appendOption(options: CliOptions, key: string, value: string): void {
  const current = options[key];
  if (current === undefined) {
    options[key] = value;
    return;
  }

  if (typeof current === "string") {
    options[key] = [current, value];
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  throw new Error(`--${key} cannot be combined with a value`);
}

async function toCreateProjectRequest(options: CliOptions): Promise<CreateProjectRequest> {
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

async function parseSqlSchemaFile(path: string): Promise<ReturnType<typeof parseSqlSchema>> {
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

function stringListOption(options: CliOptions, key: string): string[] {
  const value = options[key];
  if (value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`--${key} requires a value`);
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

function optionalBoolean(options: Record<string, unknown>, key: string): boolean | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }

  return value;
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

function mergeEntities(base: EntityConfig[] | undefined, imported: EntityConfig[] | undefined): EntityConfig[] | undefined {
  if (!base?.length && !imported?.length) {
    return undefined;
  }

  const result = new Map<string, EntityConfig>();
  for (const entity of [...(base ?? []), ...(imported ?? [])]) {
    const current = result.get(entity.name);
    if (!current) {
      result.set(entity.name, { ...entity, fields: [...entity.fields] });
      continue;
    }

    const fields = new Map(current.fields.map((field) => [field.name, field]));
    for (const field of entity.fields) {
      fields.set(field.name, field);
    }
    result.set(entity.name, { ...current, fields: [...fields.values()] });
  }

  return [...result.values()];
}

function parseCliEntities(options: CliOptions): EntityConfig[] | undefined {
  const entityNames = stringListOption(options, "entity");
  const fieldSpecs = stringListOption(options, "field");

  if (entityNames.length === 0 && fieldSpecs.length === 0) {
    return undefined;
  }

  if (entityNames.length === 0) {
    throw new Error("--field requires at least one --entity");
  }

  const entities = new Map<string, EntityConfig>();
  for (const name of entityNames) {
    if (!name) {
      throw new Error("--entity must be a non-empty value");
    }
    entities.set(name, { name, fields: [] });
  }

  for (const spec of fieldSpecs) {
    const { entityName, field } = parseFieldSpec(spec, entityNames);
    const entity = entities.get(entityName);
    if (!entity) {
      throw new Error(`Field "${spec}" references unknown entity "${entityName}"`);
    }
    entity.fields.push(field);
  }

  return [...entities.values()];
}

function parseEntityFields(options: CliOptions): EntityFieldConfig[] {
  return stringListOption(options, "field").map((spec) => parseStandaloneFieldSpec(spec));
}

function parseStandaloneFieldSpec(spec: string): EntityFieldConfig {
  const [left, rawType, rawRequired] = spec.split(":");
  if (!left || !rawType) {
    throw new Error(`Invalid --field "${spec}". Use field:type`);
  }

  const fieldName = left.includes(".") ? left.split(".").at(-1) ?? "" : left;
  const optionalBySuffix = rawType.endsWith("?");
  const type = optionalBySuffix ? rawType.slice(0, -1) : rawType;

  if (!fieldName || !isFieldType(type)) {
    throw new Error(`Invalid --field "${spec}". Use field:type`);
  }

  return {
    name: fieldName,
    type,
    required: rawRequired === "optional" || optionalBySuffix ? false : undefined
  };
}

function parseFieldSpec(spec: string, entityNames: string[]): { entityName: string; field: EntityFieldConfig } {
  const [left, rawType, rawRequired] = spec.split(":");
  if (!left || !rawType) {
    throw new Error(`Invalid --field "${spec}". Use entity.field:type or field:type`);
  }

  const leftParts = left.split(".");
  const entityName = leftParts.length === 2 ? leftParts[0] : inferSingleEntity(entityNames, spec);
  const fieldName = leftParts.length === 2 ? leftParts[1] : leftParts[0];
  const optionalBySuffix = rawType.endsWith("?");
  const type = optionalBySuffix ? rawType.slice(0, -1) : rawType;

  if (!fieldName) {
    throw new Error(`Invalid field name in --field "${spec}"`);
  }

  if (!isFieldType(type)) {
    throw new Error(`Invalid field type in --field "${spec}"`);
  }

  return {
    entityName,
    field: {
      name: fieldName,
      type,
      required: rawRequired === "optional" || optionalBySuffix ? false : undefined
    }
  };
}

function inferSingleEntity(entityNames: string[], spec: string): string {
  if (entityNames.length !== 1) {
    throw new Error(`Field "${spec}" must use entity.field:type when multiple entities are declared`);
  }
  return entityNames[0];
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

function parseValidation(options: Record<string, unknown>): ValidationProvider | undefined {
  const value = optionalString(options, "validation");
  if (value === undefined) {
    return undefined;
  }
  if (value !== "zod" && value !== "class-validator" && value !== "joi") {
    throw new Error("--validation must be one of: zod, class-validator, joi");
  }
  return value;
}

function parseRelations(options: Record<string, unknown>): RelationConfig[] | undefined {
  const raw = options.relation;
  const values = raw === undefined ? [] : typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  if (values.length === 0) {
    return undefined;
  }

  return values.map((value) => {
    if (typeof value !== "string") {
      throw new Error("--relation requires a value");
    }
    const [left, rawKind] = value.split(":");
    const [source, target] = left?.split(".") ?? [];
    if (!source || !target || !isRelationKind(rawKind)) {
      throw new Error(`Invalid --relation "${value}". Use source.target:many-to-one`);
    }
    return { source, target, kind: rawKind };
  });
}

function mergeRelations(base: RelationConfig[] | undefined, imported: RelationConfig[] | undefined): RelationConfig[] | undefined {
  if (!base?.length && !imported?.length) {
    return undefined;
  }

  const result = new Map<string, RelationConfig>();
  for (const relation of [...(base ?? []), ...(imported ?? [])]) {
    result.set(`${relation.source}.${relation.target}:${relation.kind}`, relation);
  }
  return [...result.values()];
}

function isRelationKind(value: unknown): value is RelationKind {
  return value === "one-to-one" || value === "one-to-many" || value === "many-to-one" || value === "many-to-many" || value === "polymorphic" || value === "tree";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printHelp(logger: Logger): void {
  logger.info(`arxgen

Commands:
  create --name <name> --language <language> --framework <framework> [--entity <name>] [--field <entity.field:type>] [--from-sql schema.sql] [--database postgres] [--orm prisma] [--validation zod] [--auth jwt] [--relation course.student:many-to-one] [--redis] [--docker] [--nginx] [--architecture clean] [--config <file>] [--preset saas] [--out <dir>] [--force] [--dry-run]
  create --name <name> --frontend react --backend express [--database postgres] [--redis] [--docker] [--nginx] [--out <dir>]
  add entity <name> [--field name:type] [--project <dir>] [--validation zod] [--merge] [--force] [--dry-run]
  add crud <name> [--field name:type] [--project <dir>] [--validation zod] [--merge] [--force] [--dry-run]
  add schema --from-sql schema.sql [--project <dir>] [--validation zod] [--force] [--dry-run]
  upgrade schema --from-sql schema.sql [--project <dir>] [--validation zod] [--dry-run]
  add usecase <name> [--project <dir>] [--force] [--dry-run]
  wizard
  list plugins
  doctor`);
}

function formatSchemaUpgradeResult(sqlPath: string, result: Awaited<ReturnType<ProjectExtender["upgradeSchema"]>>): string {
  const action = result.dryRun ? "Schema upgrade preview" : "Schema upgraded";
  const lines = [
    `${action} from ${sqlPath}:`,
    `Project: ${result.projectRoot}`
  ];

  if (result.changes.length === 0) {
    lines.push("No schema changes detected.");
  } else {
    for (const change of result.changes) {
      lines.push(`${change.entity}${change.created ? " (created)" : ""}`);
      for (const field of change.addedFields) {
        lines.push(`  + ${field.name}:${field.type}${field.required === false ? "?" : ""}`);
      }
    }
  }

  if (result.updatedFiles.length) {
    lines.push(`Updated files: ${result.updatedFiles.join(", ")}`);
  }

  return lines.join("\n");
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
