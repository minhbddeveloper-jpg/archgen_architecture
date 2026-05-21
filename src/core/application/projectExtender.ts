import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import { GeneratedFile } from "../domain/generatedFile.js";
import { EntityConfig, EntityFieldConfig, FieldType, ValidationProvider } from "../domain/projectConfig.js";
import { FileWriter, WriteFilesOptions } from "./ports/fileWriter.js";
import { generateCrudFilesForStack } from "../../plugins/popular-starters/index.js";

export interface AddEntityRequest {
  entity: EntityConfig;
  validation?: ValidationProvider;
  merge?: boolean;
}

export interface AddUseCaseRequest {
  name: string;
}

export interface UpgradeSchemaRequest {
  entities: EntityConfig[];
  validation?: ValidationProvider;
}

export interface SchemaUpgradeFieldChange {
  name: string;
  from: string;
  to: string;
}

export interface SchemaUpgradeWarning {
  entity: string;
  field?: string;
  message: string;
  destructive: boolean;
}

export interface SchemaUpgradeChange {
  entity: string;
  addedFields: EntityFieldConfig[];
  removedFields: EntityFieldConfig[];
  typeChanges: SchemaUpgradeFieldChange[];
  nullableChanges: SchemaUpgradeFieldChange[];
  defaultChanges: SchemaUpgradeFieldChange[];
  created: boolean;
}

export interface ExtendProjectResult {
  projectRoot: string;
  framework: string;
  language: string;
  filesWritten: number;
  dryRun: boolean;
  updatedFiles: string[];
}

export interface UpgradeSchemaResult extends ExtendProjectResult {
  changes: SchemaUpgradeChange[];
  warnings: SchemaUpgradeWarning[];
}

interface ProjectDetection {
  language: string;
  framework: string;
}

export class ProjectExtender {
  constructor(private readonly fileWriter: FileWriter) {}

  async addEntity(projectRoot: string, request: AddEntityRequest, options: WriteFilesOptions = {}): Promise<ExtendProjectResult> {
    const root = resolve(projectRoot);
    const detection = await detectProject(root);
    if (detection.language === "typescript" && detection.framework === "nestjs") {
      const className = toPascalCase(request.entity.name);
      const entityPath = join(root, "src", "modules", pluralize(toKebabCase(request.entity.name)), "domain", `${className}.ts`);
      if ((await exists(entityPath)) && !options.overwrite) {
        throw new Error(`${className} already exists. Use --force to overwrite generated files or choose a different entity name.`);
      }
      const created = await createStackEntity(root, detection, request.entity, options, this.fileWriter);
      if (!created) {
        throw new Error("Unable to add NestJS entity to this generated project.");
      }
      const updatedFiles = [...created.updatedFiles];
      if (request.merge || options.overwrite) {
        const updatedPrismaSchema = await updatePrismaSchema(root, request.entity, Boolean(options.dryRun));
        if (updatedPrismaSchema) {
          updatedFiles.push("prisma/schema.prisma");
        }
      }
      return {
        projectRoot: root,
        framework: detection.framework,
        language: detection.language,
        filesWritten: created.filesWritten,
        dryRun: options.dryRun ?? false,
        updatedFiles
      };
    }
    ensureTypeScriptExpress(detection);
    const existingEntities = await detectExistingEntities(root);
    const className = toPascalCase(request.entity.name);
    if (existingEntities.includes(className) && !options.overwrite) {
      throw new Error(`${className} already exists. Use --force to overwrite generated files or choose a different entity name.`);
    }
    const files = await filterExistingSharedFiles(root, typescriptExpressEntityFiles(request.entity, request.validation), options);
    await this.fileWriter.writeFiles(root, files, options);

    const updatedFiles: string[] = [];
    if (request.merge || options.overwrite) {
      const updatedMain = await registerTypeScriptExpressRoute(root, request.entity, Boolean(options.dryRun));
      if (updatedMain) {
        updatedFiles.push("src/main.ts");
      }
      if (request.validation) {
        const updatedPackageJson = await ensureValidationDependency(root, request.validation, Boolean(options.dryRun));
        if (updatedPackageJson) {
          updatedFiles.push("package.json");
        }
      }
      const updatedPrismaSchema = await updatePrismaSchema(root, request.entity, Boolean(options.dryRun));
      if (updatedPrismaSchema) {
        updatedFiles.push("prisma/schema.prisma");
      }
      const updatedContainer = await updateContainer(root, request.entity, Boolean(options.dryRun));
      if (updatedContainer) {
        updatedFiles.push("src/infrastructure/container.ts");
      }
    }

    return {
      projectRoot: root,
      framework: detection.framework,
      language: detection.language,
      filesWritten: files.length,
      dryRun: options.dryRun ?? false,
      updatedFiles
    };
  }

  async addCrud(projectRoot: string, request: AddEntityRequest, options: WriteFilesOptions = {}): Promise<ExtendProjectResult> {
    return this.addEntity(projectRoot, request, options);
  }

  async addUseCase(projectRoot: string, request: AddUseCaseRequest, options: WriteFilesOptions = {}): Promise<ExtendProjectResult> {
    const root = resolve(projectRoot);
    const detection = await detectProject(root);
    ensureTypeScriptExpress(detection);
    const className = toPascalCase(request.name.endsWith("UseCase") ? request.name : `${request.name}UseCase`);
    const files: GeneratedFile[] = [
      {
        path: `src/application/use-cases/${toCamelCase(className)}.ts`,
        content: `export class ${className} {
  execute(): void {
    throw new Error("${className} is not implemented yet");
  }
}
`
      }
    ];
    await this.fileWriter.writeFiles(root, files, options);
    return {
      projectRoot: root,
      framework: detection.framework,
      language: detection.language,
      filesWritten: files.length,
      dryRun: options.dryRun ?? false,
      updatedFiles: []
    };
  }

  async upgradeSchema(projectRoot: string, request: UpgradeSchemaRequest, options: WriteFilesOptions = {}): Promise<UpgradeSchemaResult> {
    const root = resolve(projectRoot);
    const detection = await detectProject(root);
    if (detection.language !== "typescript" || detection.framework !== "express") {
      return upgradeSchemaForDetectedStack(root, detection, request, options, this.fileWriter);
    }
    const updatedFiles = new Set<string>();
    const changes: SchemaUpgradeChange[] = [];
    const warnings: SchemaUpgradeWarning[] = [];
    let filesWritten = 0;

    if (!options.overwrite && !options.dryRun) {
      const riskyWarnings = await collectRiskyTypeScriptExpressWarnings(root, request.entities);
      if (riskyWarnings.length > 0) {
        throw new Error("Schema upgrade contains risky changes. Run with --dry-run to inspect warnings or pass --force to apply additive changes while handling destructive changes manually.");
      }
    }

    for (const entity of request.entities) {
      const className = toPascalCase(entity.name);
      const entityPath = join(root, "src", "domain", "entities", `${className}.ts`);

      if (!(await exists(entityPath))) {
        const result = await this.addEntity(root, { entity, validation: request.validation, merge: true }, options);
        filesWritten += result.filesWritten;
        for (const file of result.updatedFiles) {
          updatedFiles.add(file);
        }
        changes.push({ entity: className, addedFields: entity.fields, removedFields: [], typeChanges: [], nullableChanges: [], defaultChanges: [], created: true });
        continue;
      }

      const currentFields = await readTypeScriptEntityFields(entityPath, className);
      const currentFieldNames = new Set(currentFields.map((field) => toCamelCase(field.name)));
      const nextFieldsByName = new Map(entity.fields.map((field) => [toCamelCase(field.name), field]));
      const addedFields = entity.fields.filter((field) => !currentFieldNames.has(toCamelCase(field.name)));
      const removedFields = currentFields.filter((field) => !nextFieldsByName.has(toCamelCase(field.name)));
      const typeChanges: SchemaUpgradeFieldChange[] = [];
      const nullableChanges: SchemaUpgradeFieldChange[] = [];
      const defaultChanges: SchemaUpgradeFieldChange[] = [];

      for (const currentField of currentFields) {
        const nextField = nextFieldsByName.get(toCamelCase(currentField.name));
        if (!nextField) continue;
        if (currentField.type !== nextField.type) {
          typeChanges.push({ name: toCamelCase(currentField.name), from: currentField.type, to: nextField.type });
        }
        const currentRequired = currentField.required ?? true;
        const nextRequired = nextField.required ?? true;
        if (currentRequired !== nextRequired) {
          nullableChanges.push({ name: toCamelCase(currentField.name), from: currentRequired ? "required" : "optional", to: nextRequired ? "required" : "optional" });
        }
        const currentDefault = currentField.defaultValue ?? "none";
        const nextDefault = nextField.defaultValue ?? "none";
        if (currentDefault !== nextDefault) {
          defaultChanges.push({ name: toCamelCase(currentField.name), from: currentDefault, to: nextDefault });
        }
      }

      warnings.push(...schemaWarnings(className, removedFields, typeChanges, nullableChanges, defaultChanges));

      if (addedFields.length === 0 && removedFields.length === 0 && typeChanges.length === 0 && nullableChanges.length === 0 && defaultChanges.length === 0) {
        continue;
      }

      if (addedFields.length > 0) {
        if (await patchTypeScriptEntity(entityPath, className, addedFields, Boolean(options.dryRun))) {
          updatedFiles.add(`src/domain/entities/${className}.ts`);
        }
        if (await patchCreateUseCase(root, entity, addedFields, Boolean(options.dryRun))) {
          updatedFiles.add(`src/application/use-cases/create${className}UseCase.ts`);
        }

        const validationPath = join(root, "src", "presentation", "validation", `${toCamelCase(entity.name)}Schemas.ts`);
        if (await exists(validationPath)) {
          if (await patchValidationSchema(validationPath, className, addedFields, Boolean(options.dryRun))) {
            updatedFiles.add(`src/presentation/validation/${toCamelCase(entity.name)}Schemas.ts`);
          }
        } else if (request.validation) {
          const mergedEntity: EntityConfig = { ...entity, fields: [...currentFields, ...addedFields] };
          if (!options.dryRun) {
            await writeFile(validationPath, validationSchema(toEntityView(mergedEntity), request.validation), "utf8");
          }
          updatedFiles.add(`src/presentation/validation/${toCamelCase(entity.name)}Schemas.ts`);
        }

        if (await patchPrismaModel(root, entity, addedFields, Boolean(options.dryRun))) {
          updatedFiles.add("prisma/schema.prisma");
        }
      }

      changes.push({ entity: className, addedFields, removedFields, typeChanges, nullableChanges, defaultChanges, created: false });
    }

    return {
      projectRoot: root,
      framework: detection.framework,
      language: detection.language,
      filesWritten,
      dryRun: options.dryRun ?? false,
      updatedFiles: [...updatedFiles],
      changes,
      warnings
    };
  }
}

async function collectRiskyTypeScriptExpressWarnings(root: string, entities: EntityConfig[]): Promise<SchemaUpgradeWarning[]> {
  const warnings: SchemaUpgradeWarning[] = [];
  for (const entity of entities) {
    const className = toPascalCase(entity.name);
    const entityPath = join(root, "src", "domain", "entities", `${className}.ts`);
    if (!(await exists(entityPath))) {
      continue;
    }

    const currentFields = await readTypeScriptEntityFields(entityPath, className);
    const nextFieldsByName = new Map(entity.fields.map((field) => [toCamelCase(field.name), field]));
    const removedFields = currentFields.filter((field) => !nextFieldsByName.has(toCamelCase(field.name)));
    const typeChanges: SchemaUpgradeFieldChange[] = [];
    const nullableChanges: SchemaUpgradeFieldChange[] = [];
    const defaultChanges: SchemaUpgradeFieldChange[] = [];

    for (const currentField of currentFields) {
      const nextField = nextFieldsByName.get(toCamelCase(currentField.name));
      if (!nextField) continue;
      if (currentField.type !== nextField.type) {
        typeChanges.push({ name: toCamelCase(currentField.name), from: currentField.type, to: nextField.type });
      }
      const currentRequired = currentField.required ?? true;
      const nextRequired = nextField.required ?? true;
      if (currentRequired !== nextRequired) {
        nullableChanges.push({ name: toCamelCase(currentField.name), from: currentRequired ? "required" : "optional", to: nextRequired ? "required" : "optional" });
      }
      const currentDefault = currentField.defaultValue ?? "none";
      const nextDefault = nextField.defaultValue ?? "none";
      if (currentDefault !== nextDefault) {
        defaultChanges.push({ name: toCamelCase(currentField.name), from: currentDefault, to: nextDefault });
      }
    }

    warnings.push(...schemaWarnings(className, removedFields, typeChanges, nullableChanges, defaultChanges).filter((warning) => warning.destructive));
  }
  return warnings;
}

function schemaWarnings(className: string, removedFields: EntityFieldConfig[], typeChanges: SchemaUpgradeFieldChange[], nullableChanges: SchemaUpgradeFieldChange[], defaultChanges: SchemaUpgradeFieldChange[]): SchemaUpgradeWarning[] {
  return [
    ...removedFields.map((field) => ({
      entity: className,
      field: toCamelCase(field.name),
      message: `Column ${toCamelCase(field.name)} is no longer present in the SQL schema. arxgen does not delete generated code automatically.`,
      destructive: true
    })),
    ...typeChanges.map((change) => ({
      entity: className,
      field: change.name,
      message: `Column ${change.name} type changed from ${change.from} to ${change.to}. Review generated code and database migration manually.`,
      destructive: true
    })),
    ...nullableChanges.map((change) => ({
      entity: className,
      field: change.name,
      message: `Column ${change.name} nullability changed from ${change.from} to ${change.to}.`,
      destructive: change.to === "required"
    })),
    ...defaultChanges.map((change) => ({
      entity: className,
      field: change.name,
      message: `Column ${change.name} default changed from ${change.from} to ${change.to}. Defaults are reported but not patched into generated code.`,
      destructive: false
    }))
  ];
}

async function filterExistingSharedFiles(root: string, files: GeneratedFile[], options: WriteFilesOptions): Promise<GeneratedFile[]> {
  if (options.overwrite) {
    return files;
  }

  const optionalSharedFiles = new Set(["src/shared/apiResponse.ts"]);
  const result: GeneratedFile[] = [];
  for (const file of files) {
    if (optionalSharedFiles.has(file.path) && (await exists(join(root, file.path)))) {
      continue;
    }
    result.push(file);
  }
  return result;
}

async function ensureValidationDependency(root: string, validation: ValidationProvider, dryRun: boolean): Promise<boolean> {
  const packageJsonPath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const dependencyName = validation;
  const version = validation === "zod" ? "^3.23.8" : validation === "joi" ? "^17.13.3" : "^0.14.1";

  packageJson.dependencies ??= {};
  if (packageJson.dependencies[dependencyName]) {
    return false;
  }

  packageJson.dependencies[dependencyName] = version;
  if (!dryRun) {
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  }
  return true;
}

async function detectProject(root: string): Promise<ProjectDetection> {
  const packageJsonPath = join(root, "package.json");
  const mainPath = join(root, "src", "main.ts");

  if ((await exists(packageJsonPath)) && (await exists(mainPath))) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (dependencies.express) return { language: "typescript", framework: "express" };
    if (dependencies["@nestjs/core"]) return { language: "typescript", framework: "nestjs" };
  }

  if ((await exists(join(root, "pyproject.toml"))) && (await exists(join(root, "app", "main.py")))) {
    return { language: "python", framework: "fastapi" };
  }
  if ((await exists(join(root, "manage.py"))) && (await exists(join(root, "config", "urls.py")))) {
    return { language: "python", framework: "django" };
  }
  if (await exists(join(root, "pom.xml"))) {
    return { language: "java", framework: "spring" };
  }
  if ((await exists(join(root, "Program.cs"))) && (await findFirstFile(root, ".csproj"))) {
    return { language: "csharp", framework: "aspnetcore" };
  }
  if ((await exists(join(root, "composer.json"))) && (await exists(join(root, "routes", "api.php")))) {
    return { language: "php", framework: "laravel" };
  }
  if ((await exists(join(root, "go.mod"))) && (await exists(join(root, "cmd", "api", "main.go")))) {
    return { language: "go", framework: "gin" };
  }
  if ((await exists(join(root, "Gemfile"))) && (await exists(join(root, "config", "routes.rb")))) {
    return { language: "ruby", framework: "rails" };
  }
  if ((await exists(join(root, "build.gradle.kts"))) && (await exists(join(root, "settings.gradle.kts")))) {
    return { language: "kotlin", framework: "ktor" };
  }

  throw new Error("Unable to detect a supported generated project. Pass --project <dir> pointing to a generated arxgen project.");
}

function ensureTypeScriptExpress(detection: ProjectDetection): void {
  if (detection.language !== "typescript" || detection.framework !== "express") {
    throw new Error("This add command currently supports generated TypeScript Express projects. Use `arxgen upgrade schema` for additive schema upgrades on other generated backend stacks.");
  }
}

async function detectExistingEntities(root: string): Promise<string[]> {
  const entityDir = join(root, "src", "domain", "entities");
  if (!(await exists(entityDir))) {
    return [];
  }

  const entries = await readdir(entityDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts")).map((entry) => entry.name.replace(/\.ts$/, ""));
}

async function upgradeSchemaForDetectedStack(root: string, detection: ProjectDetection, request: UpgradeSchemaRequest, options: WriteFilesOptions, fileWriter: FileWriter): Promise<UpgradeSchemaResult> {
  const updatedFiles = new Set<string>();
  const changes: SchemaUpgradeChange[] = [];
  let filesWritten = 0;

  for (const entity of request.entities) {
    const patch = await patchStackEntity(root, detection, entity, Boolean(options.dryRun));
    if (!patch) {
      const created = await createStackEntity(root, detection, entity, options, fileWriter);
      if (!created) {
        continue;
      }
      filesWritten += created.filesWritten;
      for (const file of created.updatedFiles) {
        updatedFiles.add(file);
      }
      changes.push({
        entity: toPascalCase(entity.name),
        addedFields: entity.fields,
        removedFields: [],
        typeChanges: [],
        nullableChanges: [],
        defaultChanges: [],
        created: true
      });
      continue;
    }

    if (patch.addedFields.length === 0) {
      continue;
    }

    for (const file of patch.updatedFiles) {
      updatedFiles.add(file);
    }
    changes.push({
      entity: toPascalCase(entity.name),
      addedFields: patch.addedFields,
      removedFields: [],
      typeChanges: [],
      nullableChanges: [],
      defaultChanges: [],
      created: false
    });
  }

  return {
    projectRoot: root,
    framework: detection.framework,
    language: detection.language,
    filesWritten,
    dryRun: options.dryRun ?? false,
    updatedFiles: [...updatedFiles],
    changes,
    warnings: []
  };
}

async function patchStackEntity(root: string, detection: ProjectDetection, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const className = toPascalCase(entity.name);
  const moduleName = toSnakeCase(entity.name);

  if (detection.framework === "nestjs") {
    return patchTypeScriptLikeFile(root, `src/modules/${pluralize(toKebabCase(entity.name))}/domain/${className}.ts`, entity, dryRun);
  }
  if (detection.framework === "fastapi") {
    return patchPythonFastApiModel(root, `app/domain/models/${moduleName}.py`, entity, dryRun);
  }
  if (detection.framework === "django") {
    return patchDjangoFiles(root, entity, dryRun);
  }
  if (detection.framework === "spring") {
    const entityPath = await findFirstFile(root, `${className}.java`, (path) => path.includes(`${join("domain", "entities")}`));
    return entityPath ? patchJavaEntity(root, entityPath, entity, dryRun) : undefined;
  }
  if (detection.framework === "aspnetcore") {
    return patchCSharpEntity(root, `Domain/Entities/${className}.cs`, entity, dryRun);
  }
  if (detection.framework === "laravel") {
    return patchPhpEntity(root, `app/Domain/Entities/${className}.php`, entity, dryRun);
  }
  if (detection.framework === "gin") {
    return patchGoEntity(root, `internal/domain/${moduleName}.go`, entity, dryRun);
  }
  if (detection.framework === "rails") {
    return patchRubyEntity(root, `app/domain/entities/${moduleName}.rb`, entity, dryRun);
  }
  if (detection.framework === "ktor") {
    const entityPath = await findFirstFile(root, `${className}.kt`, (path) => path.includes(`${join("domain", "entities")}`));
    return entityPath ? patchKotlinEntity(root, entityPath, entity, dryRun) : undefined;
  }

  return undefined;
}

async function createStackEntity(root: string, detection: ProjectDetection, entity: EntityConfig, options: WriteFilesOptions, fileWriter: FileWriter): Promise<{ filesWritten: number; updatedFiles: string[] } | undefined> {
  const pluginName = pluginNameForDetection(detection);
  if (!pluginName) {
    return undefined;
  }

  const projectName = basename(root);
  const files = generateCrudFilesForStack({
    projectName,
    language: detection.language,
    framework: detection.framework,
    architecture: "clean",
    entities: [entity]
  }, pluginName).map((file) => stripProjectPrefix(projectName, file));

  if (files.length === 0) {
    return undefined;
  }

  await fileWriter.writeFiles(root, files, options);
  const updatedFiles = await registerStackEntity(root, detection, entity, Boolean(options.dryRun));
  return { filesWritten: files.length, updatedFiles };
}

function pluginNameForDetection(detection: ProjectDetection): string | undefined {
  const key = `${detection.language}:${detection.framework}`;
  const names: Record<string, string> = {
    "typescript:nestjs": "typescript-nestjs",
    "python:fastapi": "python-fastapi",
    "python:django": "python-django",
    "java:spring": "java-spring",
    "csharp:aspnetcore": "csharp-aspnetcore",
    "php:laravel": "php-laravel",
    "go:gin": "go-gin",
    "ruby:rails": "ruby-rails",
    "kotlin:ktor": "kotlin-ktor"
  };
  return names[key];
}

function stripProjectPrefix(projectName: string, file: GeneratedFile): GeneratedFile {
  const prefix = `${toKebabCase(projectName)}/`;
  return {
    path: file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path,
    content: file.content
  };
}

async function registerStackEntity(root: string, detection: ProjectDetection, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  if (detection.framework === "nestjs") return registerNestJsModule(root, entity, dryRun);
  if (detection.framework === "fastapi") return registerFastApiRouter(root, entity, dryRun);
  if (detection.framework === "django") return registerDjangoUrls(root, entity, dryRun);
  if (detection.framework === "aspnetcore") return registerCSharpRoutes(root, entity, dryRun);
  if (detection.framework === "laravel") return registerLaravelRoutes(root, entity, dryRun);
  if (detection.framework === "gin") return registerGoGinRoutes(root, entity, dryRun);
  if (detection.framework === "rails") return registerRailsRoutes(root, entity, dryRun);
  if (detection.framework === "ktor") return registerKtorRoutes(root, entity, dryRun);
  return [];
}

async function registerNestJsModule(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const appModulePath = join(root, "src", "app.module.ts");
  if (!(await exists(appModulePath))) return [];
  const className = toPascalCase(entity.name);
  const routeName = pluralize(toKebabCase(entity.name));
  const moduleName = `${className}Module`;
  const importLine = `import { ${moduleName} } from "./modules/${routeName}/${routeName}.module";`;
  const current = await readFile(appModulePath, "utf8");
  let next = current.includes(importLine) ? current : `${importLine}\n${current}`;
  if (!new RegExp(`\\b${moduleName}\\b[\\s\\S]*\\]`).test(current.match(/imports:\s*\[[\s\S]*?\]/)?.[0] ?? "")) {
    next = next.replace(/(\n\s+AuthModule)(,?)/, `$1,\n    ${moduleName}$2`);
  }
  if (next !== current && !dryRun) await writeFile(appModulePath, next, "utf8");
  return next !== current ? ["src/app.module.ts"] : [];
}

async function registerFastApiRouter(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const mainPath = join(root, "app", "main.py");
  if (!(await exists(mainPath))) return [];
  const moduleName = toSnakeCase(entity.name);
  const importLine = `from app.presentation.routers.${moduleName}_router import router as ${moduleName}_router`;
  const includeLine = `app.include_router(${moduleName}_router)`;
  const current = await readFile(mainPath, "utf8");
  let next = current.includes(importLine) ? current : current.replace("from fastapi import FastAPI\n", `from fastapi import FastAPI\n${importLine}\n`);
  if (!next.includes(includeLine)) {
    next = next.replace(/app = FastAPI\([^\n]*\)\n/, (match: string) => `${match}${includeLine}\n`);
  }
  if (next !== current && !dryRun) await writeFile(mainPath, next, "utf8");
  return next !== current ? ["app/main.py"] : [];
}

async function registerDjangoUrls(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const urlsPath = join(root, "config", "urls.py");
  if (!(await exists(urlsPath))) return [];
  const moduleName = toSnakeCase(entity.name);
  const routeName = pluralize(toKebabCase(entity.name));
  const importLine = `from presentation.views.${moduleName}_views import ${moduleName}_collection, ${moduleName}_member`;
  const routeLines = `    path("${routeName}", ${moduleName}_collection),
    path("${routeName}/", ${moduleName}_collection),
    path("${routeName}/<str:record_id>", ${moduleName}_member),`;
  const current = await readFile(urlsPath, "utf8");
  let next = current.includes(importLine) ? current : current.replace("from django.urls import path\n", `from django.urls import path\n${importLine}\n`);
  if (!next.includes(`${moduleName}_collection`)) {
    next = next.replace(/\n\]/, `\n${routeLines}\n]`);
  }
  if (next !== current && !dryRun) await writeFile(urlsPath, next, "utf8");
  return next !== current ? ["config/urls.py"] : [];
}

async function registerCSharpRoutes(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const programPath = join(root, "Program.cs");
  if (!(await exists(programPath))) return [];
  const className = toPascalCase(entity.name);
  const camelName = toCamelCase(entity.name);
  const routeName = pluralize(toKebabCase(entity.name));
  const current = await readFile(programPath, "utf8");
  let next = current;
  const usingLines = [`using ${basename(root).replace(/[^a-zA-Z0-9]/g, "")}.Application.Services;`, `using ${basename(root).replace(/[^a-zA-Z0-9]/g, "")}.Domain.Entities;`];
  for (const line of usingLines) {
    if (!next.includes(line)) next = `${line}\n${next}`;
  }
  const serviceLine = `var ${camelName}Service = new ${className}Service();`;
  if (!next.includes(serviceLine)) next = next.replace("var app = builder.Build();", `var app = builder.Build();\n${serviceLine}`);
  const routeBlock = `app.MapGet("/${routeName}", () => Results.Ok(${camelName}Service.List()));
app.MapGet("/${routeName}/{id:guid}", (Guid id) =>
{
    var record = ${camelName}Service.Get(id);
    return record is null ? Results.NotFound() : Results.Ok(record);
});
app.MapPost("/${routeName}", (${className} record) => Results.Created($"/${routeName}/{record.Id}", ${camelName}Service.Create(record)));
app.MapPut("/${routeName}/{id:guid}", (Guid id, ${className} record) =>
{
    var updated = ${camelName}Service.Update(id, record);
    return updated is null ? Results.NotFound() : Results.Ok(updated);
});
app.MapDelete("/${routeName}/{id:guid}", (Guid id) => ${camelName}Service.Delete(id) ? Results.NoContent() : Results.NotFound());`;
  if (!next.includes(`app.MapGet("/${routeName}"`)) next = next.replace("\napp.Run();", `\n${routeBlock}\n\napp.Run();`);
  if (next !== current && !dryRun) await writeFile(programPath, next, "utf8");
  return next !== current ? ["Program.cs"] : [];
}

async function registerLaravelRoutes(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const routePath = join(root, "routes", "api.php");
  if (!(await exists(routePath))) return [];
  const className = toPascalCase(entity.name);
  const routeName = pluralize(toKebabCase(entity.name));
  const current = await readFile(routePath, "utf8");
  const importLine = `use App\\Http\\Controllers\\${className}Controller;`;
  let next = current.includes(importLine) ? current : current.replace("<?php\n", `<?php\n\n${importLine}\n`);
  const routeBlock = `Route::get('/${routeName}', [${className}Controller::class, 'index']);
Route::get('/${routeName}/{id}', [${className}Controller::class, 'show']);
Route::post('/${routeName}', [${className}Controller::class, 'store']);
Route::put('/${routeName}/{id}', [${className}Controller::class, 'update']);
Route::delete('/${routeName}/{id}', [${className}Controller::class, 'destroy']);`;
  if (!next.includes(`/${routeName}`)) next = `${next.trimEnd()}\n\n${routeBlock}\n`;
  if (next !== current && !dryRun) await writeFile(routePath, next, "utf8");
  return next !== current ? ["routes/api.php"] : [];
}

async function registerGoGinRoutes(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const mainPath = join(root, "cmd", "api", "main.go");
  if (!(await exists(mainPath))) return [];
  const className = toPascalCase(entity.name);
  const current = await readFile(mainPath, "utf8");
  let next = current;
  if (!next.includes(`Register${className}Routes`)) {
    next = next.replace(/\n\s*if err := router\.Run\(\);/, `\n\thandler.Register${className}Routes(router)\n\n\tif err := router.Run();`);
  }
  if (next !== current && !dryRun) await writeFile(mainPath, next, "utf8");
  return next !== current ? ["cmd/api/main.go"] : [];
}

async function registerRailsRoutes(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const routePath = join(root, "config", "routes.rb");
  if (!(await exists(routePath))) return [];
  const routeName = pluralize(toKebabCase(entity.name)).replace(/-/g, "_");
  const current = await readFile(routePath, "utf8");
  const line = `  resources :${routeName}`;
  const next = current.includes(line) ? current : current.replace(/\nend/, `\n${line}\nend`);
  if (next !== current && !dryRun) await writeFile(routePath, next, "utf8");
  return next !== current ? ["config/routes.rb"] : [];
}

async function registerKtorRoutes(root: string, entity: EntityConfig, dryRun: boolean): Promise<string[]> {
  const appPath = await findFirstFile(root, "Application.kt");
  if (!appPath) return [];
  const className = toPascalCase(entity.name);
  const current = await readFile(appPath, "utf8");
  let next = current;
  if (!next.includes(`register${className}Routes`)) {
    const packageName = packageNameFromKotlinApplication(current);
    const importLine = `import ${packageName}.presentation.routes.register${className}Routes`;
    if (packageName && !next.includes(importLine)) next = next.replace(/\nimport /, `\n${importLine}\nimport `);
    next = next.replace(/routing\s*\{\n/, `routing {\n        register${className}Routes()\n`);
  }
  if (next !== current && !dryRun) await writeFile(appPath, next, "utf8");
  return next !== current ? [toRelativePath(root, appPath)] : [];
}

function packageNameFromKotlinApplication(content: string): string {
  return content.match(/^package\s+([^\n]+)/m)?.[1]?.trim() ?? "";
}

async function updatePrismaSchema(root: string, entity: EntityConfig, dryRun: boolean): Promise<boolean> {
  const schemaPath = join(root, "prisma", "schema.prisma");
  if (!(await exists(schemaPath))) {
    return false;
  }

  const className = toPascalCase(entity.name);
  const current = await readFile(schemaPath, "utf8");
  if (new RegExp(`model\\s+${className}\\b`).test(current)) {
    return false;
  }

  const model = `model ${className} {
  id String @id @default(uuid())
${entity.fields.map((field) => `  ${toCamelCase(field.name)} ${toPrismaType(field)}`).join("\n")}
}
`;
  if (!dryRun) {
    await writeFile(schemaPath, `${current.trimEnd()}\n\n${model}`, "utf8");
  }
  return true;
}

async function updateContainer(root: string, entity: EntityConfig, dryRun: boolean): Promise<boolean> {
  const containerPath = join(root, "src", "infrastructure", "container.ts");
  const view = toEntityView(entity);
  const importLine = `import { ${view.className}Repository } from "./repositories/${view.camelName}Repository.js";`;
  const registrationLine = `  ${view.camelName}Repository: new ${view.className}Repository(),`;

  if (!(await exists(containerPath))) {
    const content = `${importLine}

export const container = {
${registrationLine}
};
`;
    if (!dryRun) {
      await writeFile(containerPath, content, "utf8");
    }
    return true;
  }

  const current = await readFile(containerPath, "utf8");
  if (current.includes(registrationLine)) {
    return false;
  }

  const withImport = current.includes(importLine) ? current : `${importLine}\n${current}`;
  const next = withImport.replace(/export const container = \{\n/, `export const container = {\n${registrationLine}\n`);
  if (next === current) {
    return false;
  }
  if (!dryRun) {
    await writeFile(containerPath, next, "utf8");
  }
  return true;
}

async function readTypeScriptEntityFields(entityPath: string, className: string): Promise<EntityFieldConfig[]> {
  const project = new Project({
    manipulationSettings: {
      quoteKind: QuoteKind.Double
    }
  });
  const sourceFile = project.addSourceFileAtPath(entityPath);
  const declaration = sourceFile.getInterface(className);
  if (!declaration) {
    return [];
  }

  return declaration.getProperties()
    .filter((property) => property.getName() !== "id")
    .map((property) => ({
      name: property.getName(),
      type: fromTypeScriptType(property.getTypeNodeOrThrow().getText()),
      required: property.hasQuestionToken() ? false : undefined
    }));
}

async function patchTypeScriptEntity(entityPath: string, className: string, fields: EntityFieldConfig[], dryRun: boolean): Promise<boolean> {
  const project = new Project({
    manipulationSettings: {
      quoteKind: QuoteKind.Double
    }
  });
  const sourceFile = project.addSourceFileAtPath(entityPath);
  const declaration = sourceFile.getInterface(className);
  if (!declaration) {
    throw new Error(`Unable to find ${className} interface in ${entityPath}`);
  }

  for (const field of fields) {
    declaration.addProperty({
      name: toCamelCase(field.name),
      hasQuestionToken: field.required === false,
      type: toTypeScriptType(field.type)
    });
  }

  if (!dryRun) {
    await writeFile(entityPath, sourceFile.getFullText(), "utf8");
  }
  return true;
}

async function patchValidationSchema(schemaPath: string, className: string, fields: EntityFieldConfig[], dryRun: boolean): Promise<boolean> {
  const current = await readFile(schemaPath, "utf8");
  let next = current;

  if (current.includes('from "zod"')) {
    next = patchZodSchema(current, fields);
  } else if (current.includes('from "joi"')) {
    next = patchJoiSchema(current, fields);
  } else if (current.includes("class-validator")) {
    next = patchClassValidatorSchema(current, className, fields);
  }

  if (next === current) {
    return false;
  }

  if (!dryRun) {
    await writeFile(schemaPath, next, "utf8");
  }
  return true;
}

async function patchCreateUseCase(root: string, entity: EntityConfig, fields: EntityFieldConfig[], dryRun: boolean): Promise<boolean> {
  const className = toPascalCase(entity.name);
  const useCasePath = join(root, "src", "application", "use-cases", `create${className}UseCase.ts`);
  if (!(await exists(useCasePath))) {
    return false;
  }

  const current = await readFile(useCasePath, "utf8");
  const missingFields = fields.filter((field) => !current.includes(`${toCamelCase(field.name)}: input.${toCamelCase(field.name)}`));
  if (missingFields.length === 0) {
    return false;
  }

  const lines = missingFields.map((field) => `      ${toCamelCase(field.name)}: input.${toCamelCase(field.name)}`);
  const next = current.replace(/(\n\s+)([a-zA-Z0-9_]+: input\.[a-zA-Z0-9_]+)(\n\s+\}\);)/, (_match: string, indent: string, lastFieldLine: string, close: string) => {
    return `${indent}${lastFieldLine},\n${lines.join(",\n")}${close}`;
  });

  if (next === current) {
    const fallback = current.replace(/(\n\s+\}\);)/, `\n${lines.join(",\n")}$1`);
    if (fallback === current) {
      return false;
    }
    if (!dryRun) {
      await writeFile(useCasePath, fallback, "utf8");
    }
    return true;
  }

  if (!dryRun) {
    await writeFile(useCasePath, next, "utf8");
  }
  return true;
}

function patchZodSchema(content: string, fields: EntityFieldConfig[]): string {
  const insert = fields.map((field) => `  ${toCamelCase(field.name)}: ${zodType(field)}${field.required === false ? ".optional()" : ""},`).join("\n");
  if (!insert) {
    return content;
  }
  const prefix = /z\.object\(\{\s*\n\}\);/.test(content) ? "" : ",";
  return content.replace(/(\n\}\);\n\nexport const update)/, `${prefix}\n${insert}$1`);
}

function patchJoiSchema(content: string, fields: EntityFieldConfig[]): string {
  const insert = fields.map((field) => `  ${toCamelCase(field.name)}: ${joiType(field)}${field.required === false ? "" : ".required()"},`).join("\n");
  if (!insert) {
    return content;
  }
  const prefix = /Joi\.object\(\{\s*\n\}\);/.test(content) ? "" : ",";
  return content.replace(/(\n\}\);\n\nexport const update)/, `${prefix}\n${insert}$1`);
}

function patchClassValidatorSchema(content: string, className: string, fields: EntityFieldConfig[]): string {
  const insert = fields.map((field) => `  ${field.required === false ? "@IsOptional()\n  " : ""}${classValidatorDecorator(field.type)}
  ${toCamelCase(field.name)}!: ${toTypeScriptType(field.type)};`).join("\n\n");
  if (!insert) {
    return content;
  }
  return content.replace(new RegExp(`(export class Create${className}Dto \\{[\\s\\S]*?)(\\n\\})`), `$1\n\n${insert}$2`);
}

async function patchPrismaModel(root: string, entity: EntityConfig, fields: EntityFieldConfig[], dryRun: boolean): Promise<boolean> {
  const schemaPath = join(root, "prisma", "schema.prisma");
  if (!(await exists(schemaPath))) {
    return false;
  }

  const className = toPascalCase(entity.name);
  const current = await readFile(schemaPath, "utf8");
  if (!new RegExp(`model\\s+${className}\\b`).test(current)) {
    return updatePrismaSchema(root, entity, dryRun);
  }

  const modelMatch = new RegExp(`model\\s+${className}\\s+\\{[\\s\\S]*?\\n\\}`, "m").exec(current);
  if (!modelMatch) {
    return false;
  }

  const model = modelMatch[0];
  const insertLines = fields
    .filter((field) => !new RegExp(`\\n\\s+${toCamelCase(field.name)}\\s+`).test(model))
    .map((field) => `  ${toCamelCase(field.name)} ${toPrismaType(field)}`);
  if (insertLines.length === 0) {
    return false;
  }

  const nextModel = model.replace(/\n\}$/, `\n${insertLines.join("\n")}\n}`);
  const next = current.replace(model, nextModel);
  if (!dryRun) {
    await writeFile(schemaPath, next, "utf8");
  }
  return true;
}

async function patchTypeScriptLikeFile(root: string, relativePath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const path = join(root, relativePath);
  if (!(await exists(path))) return undefined;
  const current = await readFile(path, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\n\\s+${toCamelCase(field.name)}[?:]`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const insert = addedFields.map((field) => `  ${toCamelCase(field.name)}${field.required === false ? "?" : ""}: ${toTypeScriptType(field.type)};`).join("\n");
  const next = current.replace(/\n\}/, `\n${insert}\n}`);
  if (!dryRun) await writeFile(path, next, "utf8");
  return { updatedFiles: [relativePath], addedFields };
}

async function patchPythonFastApiModel(root: string, relativePath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const path = join(root, relativePath);
  if (!(await exists(path))) return undefined;
  const current = await readFile(path, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\n\\s+${toSnakeCase(field.name)}:`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const createInsert = addedFields.map((field) => `    ${toSnakeCase(field.name)}: ${toPythonType(field)}${field.required === false ? " | None = None" : ""}`).join("\n");
  const updateInsert = addedFields.map((field) => `    ${toSnakeCase(field.name)}: ${toPythonType(field)} | None = None`).join("\n");
  let next = current.replace(/(\n\n\nclass [A-Za-z0-9]+Update\(BaseModel\):)/, `\n${createInsert}$1`);
  next = next.replace(/(\n\n\nclass [A-Za-z0-9]+\([A-Za-z0-9]+Create\):)/, `\n${updateInsert}$1`);
  if (!dryRun) await writeFile(path, next, "utf8");
  return { updatedFiles: [relativePath], addedFields };
}

async function patchDjangoFiles(root: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const modelPath = `domain/models/${toSnakeCase(entity.name)}.py`;
  const serializerPath = `presentation/serializers/${toSnakeCase(entity.name)}_serializer.py`;
  const modelFullPath = join(root, modelPath);
  if (!(await exists(modelFullPath))) return undefined;
  const currentModel = await readFile(modelFullPath, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\n\\s+${toSnakeCase(field.name)}:`).test(currentModel));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const modelInsert = addedFields.map((field) => `    ${toSnakeCase(field.name)}: ${toPythonType(field)}`).join("\n");
  if (!dryRun) await writeFile(modelFullPath, currentModel.replace(/\n$/, `\n${modelInsert}\n`), "utf8");
  const updatedFiles = [modelPath];
  const serializerFullPath = join(root, serializerPath);
  if (await exists(serializerFullPath)) {
    const serializer = await readFile(serializerFullPath, "utf8");
    const serializerInsert = addedFields.map((field) => `        "${toSnakeCase(field.name)}": record.get("${toSnakeCase(field.name)}")`).join(",\n");
    if (!dryRun) await writeFile(serializerFullPath, serializer.replace(/(\n\s+\})/, `,\n${serializerInsert}$1`), "utf8");
    updatedFiles.push(serializerPath);
  }
  return { updatedFiles, addedFields };
}

async function patchJavaEntity(root: string, entityPath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] }> {
  const current = await readFile(entityPath, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\b${toCamelCase(field.name)}\\b`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const fieldsInsert = addedFields.map((field) => `  private ${toJavaType(field)} ${toCamelCase(field.name)};`).join("\n");
  const accessorInsert = addedFields.map((field) => `  public ${toJavaType(field)} get${toPascalCase(field.name)}() { return ${toCamelCase(field.name)}; }
  public void set${toPascalCase(field.name)}(${toJavaType(field)} ${toCamelCase(field.name)}) { this.${toCamelCase(field.name)} = ${toCamelCase(field.name)}; }`).join("\n\n");
  let next = current.replace(/(\n\n\s+public String getId\(\))/, `\n${fieldsInsert}$1`);
  next = next.replace(/\n\}$/, `\n${accessorInsert}\n}`);
  if (!dryRun) await writeFile(entityPath, next, "utf8");
  return { updatedFiles: [toRelativePath(root, entityPath)], addedFields };
}

async function patchCSharpEntity(root: string, relativePath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const path = join(root, relativePath);
  if (!(await exists(path))) return undefined;
  const current = await readFile(path, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\b${toPascalCase(field.name)}\\b`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const insert = addedFields.map((field) => `    public ${toCSharpType(field)}${field.required === false && toCSharpType(field) === "string" ? "?" : ""} ${toPascalCase(field.name)} { get; set; }`).join("\n");
  const next = current.replace(/\n\}/, `\n${insert}\n}`);
  if (!dryRun) await writeFile(path, next, "utf8");
  return { updatedFiles: [relativePath], addedFields };
}

async function patchPhpEntity(root: string, relativePath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const path = join(root, relativePath);
  if (!(await exists(path))) return undefined;
  const current = await readFile(path, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\$${toCamelCase(field.name)}\\b`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const insert = addedFields.map((field) => `    public ${field.required === false ? "?" : ""}${toPhpType(field)} $${toCamelCase(field.name)} = null;`).join("\n");
  const next = current.replace(/(\n\s+public function __construct)/, `\n${insert}$1`);
  if (!dryRun) await writeFile(path, next, "utf8");
  return { updatedFiles: [relativePath], addedFields };
}

async function patchGoEntity(root: string, relativePath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const path = join(root, relativePath);
  if (!(await exists(path))) return undefined;
  const current = await readFile(path, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\b${toPascalCase(field.name)}\\b`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const insert = addedFields.map((field) => `\t${toPascalCase(field.name)} ${toGoType(field)} \`json:"${toCamelCase(field.name)}"\``).join("\n");
  const next = current.replace(/\n\}/, `\n${insert}\n}`);
  if (!dryRun) await writeFile(path, next, "utf8");
  return { updatedFiles: [relativePath], addedFields };
}

async function patchRubyEntity(root: string, relativePath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] } | undefined> {
  const path = join(root, relativePath);
  if (!(await exists(path))) return undefined;
  const current = await readFile(path, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`:${toSnakeCase(field.name)}\\b`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const next = current.replace(/attr_accessor ([^\n]+)/, (match: string) => `${match}, ${addedFields.map((field) => `:${toSnakeCase(field.name)}`).join(", ")}`);
  if (!dryRun) await writeFile(path, next, "utf8");
  return { updatedFiles: [relativePath], addedFields };
}

async function patchKotlinEntity(root: string, entityPath: string, entity: EntityConfig, dryRun: boolean): Promise<{ updatedFiles: string[]; addedFields: EntityFieldConfig[] }> {
  const current = await readFile(entityPath, "utf8");
  const addedFields = entity.fields.filter((field) => !new RegExp(`\\b${toCamelCase(field.name)}:`).test(current));
  if (addedFields.length === 0) return { updatedFiles: [], addedFields };
  const insert = addedFields.map((field) => `    val ${toCamelCase(field.name)}: ${toKotlinType(field)}${field.required === false ? "? = null" : ""}`).join(",\n");
  const next = current.replace(/\n\)/, `,\n${insert}\n)`);
  if (!dryRun) await writeFile(entityPath, next, "utf8");
  return { updatedFiles: [toRelativePath(root, entityPath)], addedFields };
}

async function registerTypeScriptExpressRoute(root: string, entity: EntityConfig, dryRun: boolean): Promise<boolean> {
  const mainPath = join(root, "src", "main.ts");
  const className = toPascalCase(entity.name);
  const camelName = toCamelCase(entity.name);
  const routeName = pluralize(toKebabCase(entity.name));
  const importPath = `./presentation/routes/${camelName}Routes.js`;
  const importName = `create${className}Router`;
  const appUseText = `app.use("/${routeName}", ${importName}());`;

  const project = new Project({
    manipulationSettings: {
      quoteKind: QuoteKind.Double
    }
  });
  const sourceFile = project.addSourceFileAtPath(mainPath);

  const hasImport = sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === importPath);
  if (!hasImport) {
    sourceFile.addImportDeclaration({
      namedImports: [importName],
      moduleSpecifier: importPath
    });
  }

  const hasRouteRegistration = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => call.getText() === appUseText);
  if (!hasRouteRegistration) {
    const statements = sourceFile.getStatements();
    const notFoundStatement = statements.find((statement) => statement.getText().startsWith("app.use(notFoundHandler"));
    const listenStatement = statements.find((statement) => statement.getText().startsWith("app.listen("));
    const anchorStatement = notFoundStatement ?? listenStatement;
    const insertionIndex = anchorStatement ? statements.indexOf(anchorStatement) : statements.length;
    sourceFile.insertStatements(insertionIndex, appUseText);
  }

  if (hasImport && hasRouteRegistration) {
    return false;
  }

  if (!dryRun) {
    await writeFile(mainPath, sourceFile.getFullText(), "utf8");
  }
  return true;
}

function typescriptExpressEntityFiles(entity: EntityConfig, validation?: ValidationProvider): GeneratedFile[] {
  const view = toEntityView(entity);
  const fieldLines = entity.fields.map((field) => `  ${toCamelCase(field.name)}${field.required === false ? "?" : ""}: ${toTypeScriptType(field.type)};`).join("\n");
  const defaultInput = entity.fields.map((field) => `      ${toCamelCase(field.name)}: input.${toCamelCase(field.name)}`).join(",\n");
  const files: GeneratedFile[] = [
    {
      path: `src/domain/entities/${view.className}.ts`,
      content: `export interface ${view.className} {
  id: string;
${fieldLines}
}

export type Create${view.className}Input = Omit<${view.className}, "id">;
export type Update${view.className}Input = Partial<Create${view.className}Input>;
`
    },
    {
      path: `src/application/dtos/${view.camelName}Dto.ts`,
      content: `import { ${view.className} } from "../../domain/entities/${view.className}.js";

export type Create${view.className}Dto = Omit<${view.className}, "id">;
export type Update${view.className}Dto = Partial<Create${view.className}Dto>;
export type ${view.className}ResponseDto = ${view.className};

export interface PaginationQueryDto {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
}

export interface FilterDto {
  field: string;
  value: string;
}

export interface SortDto {
  field: string;
  direction: "asc" | "desc";
}

export interface PaginatedResponseDto<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
`
    },
    {
      path: `src/shared/apiResponse.ts`,
      content: `export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export function ok<T>(message: string, data: T): ApiResponse<T> {
  return { success: true, message, data };
}
`
    },
    {
      path: `src/application/ports/${view.camelName}RepositoryPort.ts`,
      content: `import { ${view.className} } from "../../domain/entities/${view.className}.js";

export interface ${view.className}RepositoryPort {
  findAll(): ${view.className}[];
  findById(id: string): ${view.className} | undefined;
  save(record: ${view.className}): ${view.className};
  delete(id: string): boolean;
}
`
    },
    {
      path: `src/infrastructure/repositories/${view.camelName}Repository.ts`,
      content: `import { ${view.className}RepositoryPort } from "../../application/ports/${view.camelName}RepositoryPort.js";
import { ${view.className} } from "../../domain/entities/${view.className}.js";

export class ${view.className}Repository implements ${view.className}RepositoryPort {
  private readonly records = new Map<string, ${view.className}>();

  findAll(): ${view.className}[] {
    return [...this.records.values()];
  }

  findById(id: string): ${view.className} | undefined {
    return this.records.get(id);
  }

  save(record: ${view.className}): ${view.className} {
    this.records.set(record.id, record);
    return record;
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }
}
`
    },
    {
      path: `src/application/use-cases/list${view.className}sUseCase.ts`,
      content: `import { ${view.className}RepositoryPort } from "../ports/${view.camelName}RepositoryPort.js";
import { PaginatedResponseDto, PaginationQueryDto } from "../dtos/${view.camelName}Dto.js";
import { ${view.className} } from "../../domain/entities/${view.className}.js";

export class List${view.className}sUseCase {
  constructor(private readonly repository: ${view.className}RepositoryPort) {}

  execute(query: PaginationQueryDto = {}): PaginatedResponseDto<${view.className}> {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(Number(query.limit ?? 10), 1);
    const q = query.q?.toLowerCase();
    const records = this.repository.findAll().filter((record) => !q || JSON.stringify(record).toLowerCase().includes(q));
    const start = (page - 1) * limit;

    return {
      data: records.slice(start, start + limit),
      meta: { page, limit, total: records.length }
    };
  }
}
`
    },
    {
      path: `src/application/use-cases/get${view.className}UseCase.ts`,
      content: `import { ${view.className}RepositoryPort } from "../ports/${view.camelName}RepositoryPort.js";
import { ${view.className} } from "../../domain/entities/${view.className}.js";

export class Get${view.className}UseCase {
  constructor(private readonly repository: ${view.className}RepositoryPort) {}

  execute(id: string): ${view.className} | undefined {
    return this.repository.findById(id);
  }
}
`
    },
    {
      path: `src/application/use-cases/create${view.className}UseCase.ts`,
      content: `import { randomUUID } from "node:crypto";
import { ${view.className}RepositoryPort } from "../ports/${view.camelName}RepositoryPort.js";
import { Create${view.className}Input, ${view.className} } from "../../domain/entities/${view.className}.js";

export class Create${view.className}UseCase {
  constructor(private readonly repository: ${view.className}RepositoryPort) {}

  execute(input: Create${view.className}Input): ${view.className} {
    return this.repository.save({
      id: randomUUID(),
${defaultInput}
    });
  }
}
`
    },
    {
      path: `src/application/use-cases/update${view.className}UseCase.ts`,
      content: `import { ${view.className}RepositoryPort } from "../ports/${view.camelName}RepositoryPort.js";
import { ${view.className}, Update${view.className}Input } from "../../domain/entities/${view.className}.js";

export class Update${view.className}UseCase {
  constructor(private readonly repository: ${view.className}RepositoryPort) {}

  execute(id: string, input: Update${view.className}Input): ${view.className} | undefined {
    const current = this.repository.findById(id);
    if (!current) {
      return undefined;
    }

    return this.repository.save({ ...current, ...input, id });
  }
}
`
    },
    {
      path: `src/application/use-cases/delete${view.className}UseCase.ts`,
      content: `import { ${view.className}RepositoryPort } from "../ports/${view.camelName}RepositoryPort.js";

export class Delete${view.className}UseCase {
  constructor(private readonly repository: ${view.className}RepositoryPort) {}

  execute(id: string): boolean {
    return this.repository.delete(id);
  }
}
`
    },
    {
      path: `src/presentation/controllers/${view.camelName}Controller.ts`,
      content: `import { Router } from "express";
import { Create${view.className}UseCase } from "../../application/use-cases/create${view.className}UseCase.js";
import { Delete${view.className}UseCase } from "../../application/use-cases/delete${view.className}UseCase.js";
import { Get${view.className}UseCase } from "../../application/use-cases/get${view.className}UseCase.js";
import { List${view.className}sUseCase } from "../../application/use-cases/list${view.className}sUseCase.js";
import { Update${view.className}UseCase } from "../../application/use-cases/update${view.className}UseCase.js";
import { ${view.className}Repository } from "../../infrastructure/repositories/${view.camelName}Repository.js";
import { ok } from "../../shared/apiResponse.js";
${validation ? `import { create${view.className}Schema, update${view.className}Schema } from "../validation/${view.camelName}Schemas.js";` : ""}

export function create${view.className}Router(repository = new ${view.className}Repository()): Router {
  const router = Router();
  const list${view.className}s = new List${view.className}sUseCase(repository);
  const get${view.className} = new Get${view.className}UseCase(repository);
  const create${view.className} = new Create${view.className}UseCase(repository);
  const update${view.className} = new Update${view.className}UseCase(repository);
  const delete${view.className} = new Delete${view.className}UseCase(repository);

  router.get("/", (request, response) => response.json(ok("${view.className} list loaded", list${view.className}s.execute({
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 10),
    q: typeof request.query.q === "string" ? request.query.q : undefined
  }))));
  router.get("/:id", (request, response) => {
    const record = get${view.className}.execute(request.params.id);
    return record ? response.json(ok("${view.className} loaded", record)) : response.sendStatus(404);
  });
  router.post("/", (request, response) => {
    const payload = ${validation ? `create${view.className}Schema.parse(request.body)` : "request.body"};
    return response.status(201).json(ok("${view.className} created", create${view.className}.execute(payload)));
  });
  router.put("/:id", (request, response) => {
    const payload = ${validation ? `update${view.className}Schema.parse(request.body)` : "request.body"};
    const record = update${view.className}.execute(request.params.id, payload);
    return record ? response.json(ok("${view.className} updated", record)) : response.sendStatus(404);
  });
  router.delete("/:id", (request, response) => {
    return delete${view.className}.execute(request.params.id) ? response.sendStatus(204) : response.sendStatus(404);
  });

  return router;
}
`
    },
    {
      path: `src/presentation/routes/${view.camelName}Routes.ts`,
      content: `export { create${view.className}Router } from "../controllers/${view.camelName}Controller.js";
`
    }
  ];

  if (validation) {
    files.push({
      path: `src/presentation/validation/${view.camelName}Schemas.ts`,
      content: validationSchema(view, validation)
    });
  }

  return files;
}

function validationSchema(entity: ReturnType<typeof toEntityView>, validation: ValidationProvider): string {
  if (validation === "zod") {
    return `import { z } from "zod";

export const create${entity.className}Schema = z.object({
${entity.fields.map((field) => `  ${field.camelName}: ${zodType(field)}${field.required === false ? ".optional()" : ""}`).join(",\n")}
});

export const update${entity.className}Schema = create${entity.className}Schema.partial();
`;
  }

  if (validation === "joi") {
    return `import Joi from "joi";

export const create${entity.className}Schema = Joi.object({
${entity.fields.map((field) => `  ${field.camelName}: ${joiType(field)}${field.required ? ".required()" : ""}`).join(",\n")}
});

export const update${entity.className}Schema = create${entity.className}Schema.fork(Object.keys(create${entity.className}Schema.describe().keys ?? {}), (schema) => schema.optional());
`;
  }

  return `import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class Create${entity.className}Dto {
${entity.fields.map((field) => `  ${field.required ? "" : "@IsOptional()\n  "}${classValidatorDecorator(field.type)}\n  ${field.camelName}!: ${field.tsType};`).join("\n\n")}
}

export class Update${entity.className}Dto extends Create${entity.className}Dto {}

export const create${entity.className}Schema = {
  parse: (value: unknown) => value as Create${entity.className}Dto
};

export const update${entity.className}Schema = {
  parse: (value: unknown) => value as Partial<Create${entity.className}Dto>
};
`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findFirstFile(root: string, fileNameOrExtension: string, predicate?: (path: string) => boolean): Promise<string | undefined> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
        continue;
      }
      const nested = await findFirstFile(path, fileNameOrExtension, predicate);
      if (nested) return nested;
      continue;
    }

    const matches = fileNameOrExtension.startsWith(".")
      ? entry.name.endsWith(fileNameOrExtension)
      : entry.name === fileNameOrExtension;
    if (matches && (!predicate || predicate(path))) {
      return path;
    }
  }
  return undefined;
}

function toRelativePath(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function toEntityView(entity: EntityConfig) {
  const className = toPascalCase(entity.name);
  return {
    className,
    camelName: toCamelCase(entity.name),
    routeName: pluralize(toKebabCase(entity.name)),
    fields: entity.fields.map((field) => ({
      ...field,
      camelName: toCamelCase(field.name),
      tsType: toTypeScriptType(field.type),
      required: field.required ?? true
    }))
  };
}

function zodType(field: EntityFieldConfig): string {
  if (field.type === "number") return "z.number()";
  if (field.type === "boolean") return "z.boolean()";
  if (field.type === "date") return "z.coerce.date()";
  return "z.string()";
}

function joiType(field: EntityFieldConfig): string {
  if (field.type === "number") return "Joi.number()";
  if (field.type === "boolean") return "Joi.boolean()";
  if (field.type === "date") return "Joi.date()";
  return "Joi.string()";
}

function classValidatorDecorator(type: FieldType): string {
  if (type === "number") return "@IsNumber()";
  if (type === "boolean") return "@IsBoolean()";
  return "@IsString()";
}

function toTypeScriptType(type: FieldType): string {
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "date") return "Date";
  return "string";
}

function fromTypeScriptType(type: string): FieldType {
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "Date") return "date";
  return "string";
}

function toPrismaType(field: EntityFieldConfig): string {
  const suffix = field.required === false ? "?" : "";
  if (field.type === "number") return `Float${suffix}`;
  if (field.type === "boolean") return `Boolean${suffix}`;
  if (field.type === "date") return `DateTime${suffix}`;
  return `String${suffix}`;
}

function toPascalCase(value: string): string {
  const words = value.match(/[a-zA-Z0-9]+/g) ?? ["App"];
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
}

function toCamelCase(value: string): string {
  const name = toPascalCase(value);
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function toKebabCase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
}

function toSnakeCase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
}

function pluralize(value: string): string {
  if (value.endsWith("y")) return `${value.slice(0, -1)}ies`;
  if (value.endsWith("s")) return `${value}es`;
  return `${value}s`;
}

function toPythonType(field: EntityFieldConfig): string {
  if (field.type === "number") return "float";
  if (field.type === "boolean") return "bool";
  return "str";
}

function toJavaType(field: EntityFieldConfig): string {
  if (field.type === "number") return "Double";
  if (field.type === "boolean") return "Boolean";
  return "String";
}

function toCSharpType(field: EntityFieldConfig): string {
  if (field.type === "number") return "decimal";
  if (field.type === "boolean") return "bool";
  return "string";
}

function toGoType(field: EntityFieldConfig): string {
  if (field.type === "number") return "float64";
  if (field.type === "boolean") return "bool";
  return "string";
}

function toKotlinType(field: EntityFieldConfig): string {
  if (field.type === "number") return "Double";
  if (field.type === "boolean") return "Boolean";
  return "String";
}

function toPhpType(field: EntityFieldConfig): string {
  if (field.type === "number") return "float";
  if (field.type === "boolean") return "bool";
  return "string";
}
