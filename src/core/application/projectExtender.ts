import { access, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import { GeneratedFile } from "../domain/generatedFile.js";
import { EntityConfig, EntityFieldConfig, FieldType, ValidationProvider } from "../domain/projectConfig.js";
import { FileWriter, WriteFilesOptions } from "./ports/fileWriter.js";

export interface AddEntityRequest {
  entity: EntityConfig;
  validation?: ValidationProvider;
  merge?: boolean;
}

export interface AddUseCaseRequest {
  name: string;
}

export interface ExtendProjectResult {
  projectRoot: string;
  framework: string;
  language: string;
  filesWritten: number;
  dryRun: boolean;
  updatedFiles: string[];
}

interface ProjectDetection {
  language: "typescript";
  framework: "express";
}

export class ProjectExtender {
  constructor(private readonly fileWriter: FileWriter) {}

  async addEntity(projectRoot: string, request: AddEntityRequest, options: WriteFilesOptions = {}): Promise<ExtendProjectResult> {
    const root = resolve(projectRoot);
    const detection = await detectProject(root);
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

  if (!(await exists(packageJsonPath)) || !(await exists(mainPath))) {
    throw new Error("Unable to detect a supported project. Run this command from a generated TypeScript Express project root or pass --project <dir>.");
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (!dependencies.express) {
    throw new Error("Only TypeScript Express project extension is supported in this release.");
  }

  return { language: "typescript", framework: "express" };
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
    const listenStatement = sourceFile.getStatements().find((statement) => statement.getText().startsWith("app.listen("));
    const insertionIndex = listenStatement ? sourceFile.getStatements().indexOf(listenStatement) : sourceFile.getStatements().length;
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

function pluralize(value: string): string {
  if (value.endsWith("y")) return `${value.slice(0, -1)}ies`;
  if (value.endsWith("s")) return `${value}es`;
  return `${value}s`;
}
