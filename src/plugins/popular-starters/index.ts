import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Generator } from "../../core/domain/generator.js";
import { GeneratedFile } from "../../core/domain/generatedFile.js";
import { Plugin } from "../../core/domain/plugin.js";
import { EntityConfig, EntityFieldConfig, FieldType, ProjectConfig } from "../../core/domain/projectConfig.js";
import { TemplateRenderer } from "../../core/application/ports/templateRenderer.js";
import { starterDefinitions } from "./definitions.js";
import { StarterDefinition } from "./model.js";
import { defaultVersions } from "./versionDefaults.js";

interface EntityView {
  name: string;
  className: string;
  camelName: string;
  pluralName: string;
  routeName: string;
  moduleName: string;
  fields: FieldView[];
}

interface FieldView {
  name: string;
  camelName: string;
  pascalName: string;
  snakeName: string;
  type: FieldType;
  required: boolean;
  tsType: string;
  pythonType: string;
  javaType: string;
  csharpType: string;
  goType: string;
  kotlinType: string;
}

export function popularStarterPlugins(templateRenderer: TemplateRenderer): Plugin[] {
  return starterDefinitions.map((definition) => createStarterPlugin(definition, templateRenderer));
}

export function generateCrudFilesForStack(config: ProjectConfig, pluginName: string): GeneratedFile[] {
  const definition = starterDefinitions.find((candidate) => candidate.name === pluginName);
  if (!definition) {
    return [];
  }

  return generateCrudFiles(definition, createTemplateContext(config, definition));
}

function createStarterPlugin(definition: StarterDefinition, templateRenderer: TemplateRenderer): Plugin {
  return {
    name: definition.name,
    language: definition.language,
    framework: definition.framework,
    supports(config: ProjectConfig): boolean {
      return (
        config.language.toLowerCase() === definition.language &&
        config.framework.toLowerCase() === definition.framework &&
        config.architecture === "clean"
      );
    },
    getGenerators(): Generator[] {
      return [new TemplateStarterGenerator(definition, templateRenderer)];
    }
  };
}

class TemplateStarterGenerator implements Generator {
  constructor(
    private readonly definition: StarterDefinition,
    private readonly templateRenderer: TemplateRenderer
  ) {}

  async generate(config: ProjectConfig): Promise<GeneratedFile[]> {
    const context = createTemplateContext(config, this.definition);
    const templateRoot = resolve(templateRootPath, this.definition.templateDir);
    const files: GeneratedFile[] = [];

    for (const file of this.definition.files) {
      files.push({
        path: renderPath(file.output, context),
        content: await this.templateRenderer.render(resolve(templateRoot, file.template), context)
      });
    }

    for (const dir of this.definition.keepDirs) {
      files.push({
        path: `${renderPath(dir, context)}/.gitkeep`,
        content: ""
      });
    }

    files.push(...generateCrudFiles(this.definition, context));

    return files;
  }
}

const templateRootPath = findTemplateRoot(dirname(fileURLToPath(import.meta.url)));

function findTemplateRoot(startPath: string): string {
  let current = startPath;

  while (true) {
    const candidate = join(current, "templates");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error("Unable to locate templates directory");
    }

    current = parent;
  }
}

function createTemplateContext(
  config: ProjectConfig,
  definition: StarterDefinition
): Record<string, unknown> {
  const projectSlug = toKebabCase(config.projectName);
  const className = toPascalCase(config.projectName);
  const moduleName = toSnakeCase(config.projectName);
  const packageName = toPackageName(config.projectName);
  const entities = (config.entities ?? []).map(toEntityView);
  const versions = resolveVersions(definition, config);

  return {
    ...config,
    ...versions,
    pluginName: definition.name,
    projectSlug,
    className,
    moduleName,
    packageName,
    packagePath: packageName.replaceAll(".", "/"),
    entities,
    hasEntities: entities.length > 0
  };
}

function resolveVersions(definition: StarterDefinition, config: ProjectConfig): Record<string, string> {
  const defaults = defaultVersions[definition.name] ?? {};
  const packageVersions = config.packageVersions ?? {};
  const versions = {
    ...defaults,
    ...packageVersions
  };

  if (config.languageVersion) {
    versions.languageVersion = config.languageVersion;
  }

  if (config.frameworkVersion) {
    versions.frameworkVersion = config.frameworkVersion;
  }

  return versions;
}

function generateCrudFiles(definition: StarterDefinition, context: Record<string, unknown>): GeneratedFile[] {
  if (!definition.crudStyle) {
    return [];
  }

  const entities = context.entities;
  if (!Array.isArray(entities) || entities.length === 0) {
    return [];
  }

  return entities.flatMap((entity) => {
    const view = entity as EntityView;
    switch (definition.crudStyle) {
      case "typescript-express":
        return typescriptExpressCrudFiles(context, view);
      case "typescript-nestjs":
        return typescriptNestJsCrudFiles(context, view);
      case "python-fastapi":
        return pythonFastApiCrudFiles(context, view);
      case "python-django":
        return pythonDjangoCrudFiles(context, view);
      case "java-spring":
        return javaSpringCrudFiles(context, view);
      case "csharp-aspnetcore":
        return csharpCrudFiles(context, view);
      case "php-laravel":
        return phpLaravelCrudFiles(context, view);
      case "go-gin":
        return goGinCrudFiles(context, view);
      case "ruby-rails":
        return rubyRailsCrudFiles(context, view);
      case "kotlin-ktor":
        return kotlinKtorCrudFiles(context, view);
      default:
        return [];
    }
  });
}

function renderPath(pathTemplate: string, context: Record<string, unknown>): string {
  return pathTemplate.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => {
    const value = context[key];
    return typeof value === "string" ? value : "";
  });
}

function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}

function toSnakeCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "app";
}

function toPackageName(projectName: string): string {
  const normalized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return `com.example.${normalized || "app"}`;
}

function toPascalCase(value: string): string {
  const words = value.match(/[a-zA-Z0-9]+/g) ?? ["App"];
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
}

function toEntityView(entity: EntityConfig): EntityView {
  const className = toPascalCase(entity.name);
  const camelName = toCamelCase(entity.name);
  const routeName = toKebabCase(entity.name);

  return {
    name: entity.name,
    className,
    camelName,
    pluralName: pluralize(camelName),
    routeName: pluralize(routeName),
    moduleName: toSnakeCase(entity.name),
    fields: entity.fields.map(toFieldView)
  };
}

function toFieldView(field: EntityFieldConfig): FieldView {
  return {
    name: field.name,
    camelName: toCamelCase(field.name),
    pascalName: toPascalCase(field.name),
    snakeName: toSnakeCase(field.name),
    type: field.type,
    required: field.required ?? true,
    tsType: toTypeScriptType(field.type),
    pythonType: toPythonType(field.type),
    javaType: toJavaType(field.type),
    csharpType: toCSharpType(field.type),
    goType: toGoType(field.type),
    kotlinType: toKotlinType(field.type)
  };
}

function pluralize(value: string): string {
  if (value.endsWith("y")) {
    return `${value.slice(0, -1)}ies`;
  }

  if (value.endsWith("s")) {
    return `${value}es`;
  }

  return `${value}s`;
}

function toTypeScriptType(type: FieldType): string {
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  return "string";
}

function toPythonType(type: FieldType): string {
  if (type === "number") return "float";
  if (type === "boolean") return "bool";
  return "str";
}

function toJavaType(type: FieldType): string {
  if (type === "number") return "Double";
  if (type === "boolean") return "Boolean";
  return "String";
}

function toCSharpType(type: FieldType): string {
  if (type === "number") return "decimal";
  if (type === "boolean") return "bool";
  return "string";
}

function toGoType(type: FieldType): string {
  if (type === "number") return "float64";
  if (type === "boolean") return "bool";
  return "string";
}

function toKotlinType(type: FieldType): string {
  if (type === "number") return "Double";
  if (type === "boolean") return "Boolean";
  return "String";
}

function contextString(context: Record<string, unknown>, key: string): string {
  const value = context[key];
  return typeof value === "string" ? value : "";
}

function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function typescriptExpressCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const validation = contextString(context, "validation");
  const fieldLines = entity.fields.map((field) => `  ${field.camelName}${field.required ? "" : "?"}: ${field.tsType};`).join("\n");
  const defaultInput = entity.fields.map((field) => `      ${field.camelName}: input.${field.camelName}`).join(",\n");

  return [
    {
      path: `${root}/src/domain/entities/${entity.className}.ts`,
      content: `export interface ${entity.className} {
  id: string;
${fieldLines}
}

export type Create${entity.className}Input = Omit<${entity.className}, "id">;
export type Update${entity.className}Input = Partial<Create${entity.className}Input>;
`
    },
    {
      path: `${root}/src/application/ports/${entity.camelName}RepositoryPort.ts`,
      content: `import { ${entity.className} } from "../../domain/entities/${entity.className}.js";

export interface ${entity.className}RepositoryPort {
  findAll(): ${entity.className}[];
  findById(id: string): ${entity.className} | undefined;
  save(record: ${entity.className}): ${entity.className};
  delete(id: string): boolean;
}
`
    },
    {
      path: `${root}/src/infrastructure/repositories/${entity.camelName}Repository.ts`,
      content: `import { ${entity.className}RepositoryPort } from "../../application/ports/${entity.camelName}RepositoryPort.js";
import { ${entity.className} } from "../../domain/entities/${entity.className}.js";

export class ${entity.className}Repository implements ${entity.className}RepositoryPort {
  private readonly records = new Map<string, ${entity.className}>();

  findAll(): ${entity.className}[] {
    return [...this.records.values()];
  }

  findById(id: string): ${entity.className} | undefined {
    return this.records.get(id);
  }

  save(record: ${entity.className}): ${entity.className} {
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
      path: `${root}/src/application/use-cases/list${entity.className}sUseCase.ts`,
      content: `import { ${entity.className}RepositoryPort } from "../ports/${entity.camelName}RepositoryPort.js";
import { PaginationQueryDto } from "../dtos/${entity.camelName}Dto.js";
import { PaginatedResponse } from "../../shared/apiResponse.js";
import { ${entity.className} } from "../../domain/entities/${entity.className}.js";

export class List${entity.className}sUseCase {
  constructor(private readonly repository: ${entity.className}RepositoryPort) {}

  execute(query: PaginationQueryDto = {}): PaginatedResponse<${entity.className}> {
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
      path: `${root}/src/application/use-cases/get${entity.className}UseCase.ts`,
      content: `import { ${entity.className}RepositoryPort } from "../ports/${entity.camelName}RepositoryPort.js";
import { ${entity.className} } from "../../domain/entities/${entity.className}.js";

export class Get${entity.className}UseCase {
  constructor(private readonly repository: ${entity.className}RepositoryPort) {}

  execute(id: string): ${entity.className} | undefined {
    return this.repository.findById(id);
  }
}
`
    },
    {
      path: `${root}/src/application/use-cases/create${entity.className}UseCase.ts`,
      content: `import { randomUUID } from "node:crypto";
import { ${entity.className}RepositoryPort } from "../ports/${entity.camelName}RepositoryPort.js";
import { Create${entity.className}Input, ${entity.className} } from "../../domain/entities/${entity.className}.js";

export class Create${entity.className}UseCase {
  constructor(private readonly repository: ${entity.className}RepositoryPort) {}

  execute(input: Create${entity.className}Input): ${entity.className} {
    return this.repository.save({
      id: randomUUID(),
${defaultInput}
    });
  }
}
`
    },
    {
      path: `${root}/src/application/use-cases/update${entity.className}UseCase.ts`,
      content: `import { ${entity.className}RepositoryPort } from "../ports/${entity.camelName}RepositoryPort.js";
import { ${entity.className}, Update${entity.className}Input } from "../../domain/entities/${entity.className}.js";

export class Update${entity.className}UseCase {
  constructor(private readonly repository: ${entity.className}RepositoryPort) {}

  execute(id: string, input: Update${entity.className}Input): ${entity.className} | undefined {
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
      path: `${root}/src/application/use-cases/delete${entity.className}UseCase.ts`,
      content: `import { ${entity.className}RepositoryPort } from "../ports/${entity.camelName}RepositoryPort.js";

export class Delete${entity.className}UseCase {
  constructor(private readonly repository: ${entity.className}RepositoryPort) {}

  execute(id: string): boolean {
    return this.repository.delete(id);
  }
}
`
    },
    {
      path: `${root}/src/presentation/controllers/${entity.camelName}Controller.ts`,
      content: `import { Router } from "express";
import { Create${entity.className}UseCase } from "../../application/use-cases/create${entity.className}UseCase.js";
import { Delete${entity.className}UseCase } from "../../application/use-cases/delete${entity.className}UseCase.js";
import { Get${entity.className}UseCase } from "../../application/use-cases/get${entity.className}UseCase.js";
import { List${entity.className}sUseCase } from "../../application/use-cases/list${entity.className}sUseCase.js";
import { Update${entity.className}UseCase } from "../../application/use-cases/update${entity.className}UseCase.js";
import { ${entity.className}Repository } from "../../infrastructure/repositories/${entity.camelName}Repository.js";
import { ok } from "../../shared/apiResponse.js";
${validation ? `import { create${entity.className}Schema, update${entity.className}Schema } from "../validation/${entity.camelName}Schemas.js";` : ""}

export function create${entity.className}Router(repository = new ${entity.className}Repository()): Router {
  const router = Router();
  const list${entity.className}s = new List${entity.className}sUseCase(repository);
  const get${entity.className} = new Get${entity.className}UseCase(repository);
  const create${entity.className} = new Create${entity.className}UseCase(repository);
  const update${entity.className} = new Update${entity.className}UseCase(repository);
  const delete${entity.className} = new Delete${entity.className}UseCase(repository);

  router.get("/", (request, response) => response.json(ok("${entity.className} list loaded", list${entity.className}s.execute({
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 10),
    q: typeof request.query.q === "string" ? request.query.q : undefined
  }))));
  router.get("/:id", (request, response) => {
    const record = get${entity.className}.execute(request.params.id);
    return record ? response.json(ok("${entity.className} loaded", record)) : response.sendStatus(404);
  });
  router.post("/", (request, response) => {
    const payload = ${validation ? `create${entity.className}Schema.parse(request.body)` : "request.body"};
    return response.status(201).json(ok("${entity.className} created", create${entity.className}.execute(payload)));
  });
  router.put("/:id", (request, response) => {
    const payload = ${validation ? `update${entity.className}Schema.parse(request.body)` : "request.body"};
    const record = update${entity.className}.execute(request.params.id, payload);
    return record ? response.json(ok("${entity.className} updated", record)) : response.sendStatus(404);
  });
  router.delete("/:id", (request, response) => {
    return delete${entity.className}.execute(request.params.id) ? response.sendStatus(204) : response.sendStatus(404);
  });

  return router;
}
`
    },
    {
      path: `${root}/src/presentation/routes/${entity.camelName}Routes.ts`,
      content: `export { create${entity.className}Router } from "../controllers/${entity.camelName}Controller.js";
`
    }
  ];
}

function typescriptNestJsCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const fields = entity.fields.map((field) => `  ${field.camelName}: ${field.tsType};`).join("\n");
  const dtoFields = entity.fields.map((field) => `  @ApiProperty({ required: ${field.required ? "true" : "false"} })
  ${field.required ? "" : "@IsOptional()\n  "}${nestjsValidator(field.type)}
  ${field.camelName}!: ${field.tsType};`).join("\n\n");
  const moduleRoot = `${root}/src/modules/${entity.routeName}`;

  return [
    {
      path: `${moduleRoot}/domain/${entity.className}.ts`,
      content: `export interface ${entity.className} {
  id: string;
${fields}
}
`
    },
    {
      path: `${moduleRoot}/application/ports/${entity.camelName}Repository.ts`,
      content: `import { ${entity.className} } from "../../domain/${entity.className}";

export const ${entity.className.toUpperCase()}_REPOSITORY = Symbol("${entity.className}Repository");

export interface ${entity.className}Repository {
  findAll(): ${entity.className}[];
  findById(id: string): ${entity.className} | undefined;
  save(record: ${entity.className}): ${entity.className};
  delete(id: string): boolean;
}
`
    },
    {
      path: `${moduleRoot}/application/dto/${entity.camelName}.dto.ts`,
      content: `import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiProperty, PartialType } from "@nestjs/swagger";

export class Create${entity.className}Dto {
${dtoFields || "  @ApiProperty()\n  name!: string;"}
}

export class Update${entity.className}Dto extends PartialType(Create${entity.className}Dto) {}

export class ${entity.className}QueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  q?: string;
}

export type ${entity.className}ResponseDto = {
  id: string;
${fields}
};

export interface Paginated${entity.className}ResponseDto {
  data: ${entity.className}ResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
`
    },
    {
      path: `${moduleRoot}/application/${entity.camelName}.service.ts`,
      content: `import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ${entity.className} } from "../domain/${entity.className}";
import { Create${entity.className}Dto, Paginated${entity.className}ResponseDto, ${entity.className}QueryDto, Update${entity.className}Dto } from "./dto/${entity.camelName}.dto";
import { ${entity.className}Repository, ${entity.className.toUpperCase()}_REPOSITORY } from "./ports/${entity.camelName}Repository";

@Injectable()
export class ${entity.className}Service {
  constructor(@Inject(${entity.className.toUpperCase()}_REPOSITORY) private readonly repository: ${entity.className}Repository) {}

  findAll(query: ${entity.className}QueryDto = {}): Paginated${entity.className}ResponseDto {
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

  findById(id: string): ${entity.className} | undefined {
    return this.repository.findById(id);
  }

  create(input: Create${entity.className}Dto): ${entity.className} {
    return this.repository.save({ id: randomUUID(), ...input });
  }

  update(id: string, input: Update${entity.className}Dto): ${entity.className} | undefined {
    const current = this.repository.findById(id);
    return current ? this.repository.save({ ...current, ...input, id }) : undefined;
  }

  delete(id: string): boolean {
    return this.repository.delete(id);
  }
}
`
    },
    {
      path: `${moduleRoot}/infrastructure/${entity.camelName}.memoryRepository.ts`,
      content: `import { ${entity.className}Repository } from "../application/ports/${entity.camelName}Repository";
import { ${entity.className} } from "../domain/${entity.className}";

export class ${entity.className}MemoryRepository implements ${entity.className}Repository {
  private readonly records = new Map<string, ${entity.className}>();

  findAll(): ${entity.className}[] {
    return [...this.records.values()];
  }

  findById(id: string): ${entity.className} | undefined {
    return this.records.get(id);
  }

  save(record: ${entity.className}): ${entity.className} {
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
      path: `${moduleRoot}/presentation/${entity.routeName}.controller.ts`,
      content: `import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { ${entity.className}Service } from "../application/${entity.camelName}.service";
import { Create${entity.className}Dto, ${entity.className}QueryDto, Update${entity.className}Dto } from "../application/dto/${entity.camelName}.dto";

@ApiTags("${entity.routeName}")
@Controller("${entity.routeName}")
export class ${entity.className}Controller {
  constructor(private readonly service: ${entity.className}Service) {}

  @Get()
  @ApiResponse({ status: 200 })
  findAll(@Query() query: ${entity.className}QueryDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    const record = this.service.findById(id);
    if (!record) throw new NotFoundException();
    return record;
  }

  @Post()
  create(@Body() input: Create${entity.className}Dto) {
    return this.service.create(input);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() input: Update${entity.className}Dto) {
    const record = this.service.update(id, input);
    if (!record) throw new NotFoundException();
    return record;
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    if (!this.service.delete(id)) throw new NotFoundException();
  }
}
`
    },
    {
      path: `${moduleRoot}/${entity.routeName}.module.ts`,
      content: `import { Module } from "@nestjs/common";
import { ${entity.className}Service } from "./application/${entity.camelName}.service";
import { ${entity.className.toUpperCase()}_REPOSITORY } from "./application/ports/${entity.camelName}Repository";
import { ${entity.className}MemoryRepository } from "./infrastructure/${entity.camelName}.memoryRepository";
import { ${entity.className}Controller } from "./presentation/${entity.routeName}.controller";

@Module({
  controllers: [${entity.className}Controller],
  providers: [
    ${entity.className}Service,
    {
      provide: ${entity.className.toUpperCase()}_REPOSITORY,
      useClass: ${entity.className}MemoryRepository
    }
  ]
})
export class ${entity.className}Module {}
`
    }
  ];
}

function nestjsValidator(type: FieldType): string {
  if (type === "number") return "@IsNumber()";
  if (type === "boolean") return "@IsBoolean()";
  return "@IsString()";
}

function pythonFastApiCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const fields = entity.fields.map((field) => `    ${field.snakeName}: ${field.pythonType}`).join("\n");
  const updateFields = entity.fields.map((field) => `    ${field.snakeName}: ${field.pythonType} | None = None`).join("\n");

  return [
    {
      path: `${root}/app/domain/models/${entity.moduleName}.py`,
      content: `from pydantic import BaseModel


class ${entity.className}Create(BaseModel):
${fields || "    pass"}


class ${entity.className}Update(BaseModel):
${updateFields || "    pass"}


class ${entity.className}(${entity.className}Create):
    id: str
`
    },
    {
      path: `${root}/app/infrastructure/repositories/${entity.moduleName}_repository.py`,
      content: `from app.domain.models.${entity.moduleName} import ${entity.className}


class ${entity.className}Repository:
    def __init__(self) -> None:
        self._records: dict[str, ${entity.className}] = {}

    def list(self) -> list[${entity.className}]:
        return list(self._records.values())

    def get(self, record_id: str) -> ${entity.className} | None:
        return self._records.get(record_id)

    def save(self, record: ${entity.className}) -> ${entity.className}:
        self._records[record.id] = record
        return record

    def delete(self, record_id: str) -> bool:
        return self._records.pop(record_id, None) is not None
`
    },
    {
      path: `${root}/app/application/services/${entity.moduleName}_service.py`,
      content: `from uuid import uuid4

from app.domain.models.${entity.moduleName} import ${entity.className}, ${entity.className}Create, ${entity.className}Update
from app.infrastructure.repositories.${entity.moduleName}_repository import ${entity.className}Repository


class ${entity.className}Service:
    def __init__(self, repository: ${entity.className}Repository | None = None) -> None:
        self.repository = repository or ${entity.className}Repository()

    def list(self) -> list[${entity.className}]:
        return self.repository.list()

    def get(self, record_id: str) -> ${entity.className} | None:
        return self.repository.get(record_id)

    def create(self, payload: ${entity.className}Create) -> ${entity.className}:
        return self.repository.save(${entity.className}(id=str(uuid4()), **payload.model_dump()))

    def update(self, record_id: str, payload: ${entity.className}Update) -> ${entity.className} | None:
        current = self.repository.get(record_id)
        if current is None:
            return None
        data = current.model_dump()
        data.update(payload.model_dump(exclude_unset=True))
        return self.repository.save(${entity.className}(**data))

    def delete(self, record_id: str) -> bool:
        return self.repository.delete(record_id)
`
    },
    {
      path: `${root}/app/presentation/routers/${entity.moduleName}_router.py`,
      content: `from fastapi import APIRouter, HTTPException, Response, status

from app.application.services.${entity.moduleName}_service import ${entity.className}Service
from app.domain.models.${entity.moduleName} import ${entity.className}, ${entity.className}Create, ${entity.className}Update

router = APIRouter(prefix="/${entity.routeName}", tags=["${entity.routeName}"])
service = ${entity.className}Service()


@router.get("", response_model=list[${entity.className}])
def list_${entity.moduleName}() -> list[${entity.className}]:
    return service.list()


@router.get("/{record_id}", response_model=${entity.className})
def get_${entity.moduleName}(record_id: str) -> ${entity.className}:
    record = service.get(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="${entity.className} not found")
    return record


@router.post("", response_model=${entity.className}, status_code=status.HTTP_201_CREATED)
def create_${entity.moduleName}(payload: ${entity.className}Create) -> ${entity.className}:
    return service.create(payload)


@router.put("/{record_id}", response_model=${entity.className})
def update_${entity.moduleName}(record_id: str, payload: ${entity.className}Update) -> ${entity.className}:
    record = service.update(record_id, payload)
    if record is None:
        raise HTTPException(status_code=404, detail="${entity.className} not found")
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_${entity.moduleName}(record_id: str) -> Response:
    if not service.delete(record_id):
        raise HTTPException(status_code=404, detail="${entity.className} not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
`
    }
  ];
}

function pythonDjangoCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const fields = entity.fields.map((field) => `    ${field.snakeName}: ${field.pythonType}`).join("\n");
  const serializerFields = entity.fields.map((field) => `        "${field.snakeName}": record.get("${field.snakeName}")`).join(",\n");

  return [
    {
      path: `${root}/domain/models/${entity.moduleName}.py`,
      content: `from dataclasses import dataclass


@dataclass
class ${entity.className}:
    id: str
${fields || "    pass"}
`
    },
    {
      path: `${root}/infrastructure/repositories/${entity.moduleName}_repository.py`,
      content: `class ${entity.className}Repository:
    def __init__(self) -> None:
        self._records: dict[str, dict] = {}

    def list(self) -> list[dict]:
        return list(self._records.values())

    def get(self, record_id: str) -> dict | None:
        return self._records.get(record_id)

    def save(self, record: dict) -> dict:
        self._records[record["id"]] = record
        return record

    def delete(self, record_id: str) -> bool:
        return self._records.pop(record_id, None) is not None
`
    },
    {
      path: `${root}/application/services/${entity.moduleName}_service.py`,
      content: `from uuid import uuid4

from infrastructure.repositories.${entity.moduleName}_repository import ${entity.className}Repository


class ${entity.className}Service:
    def __init__(self, repository: ${entity.className}Repository | None = None) -> None:
        self.repository = repository or ${entity.className}Repository()

    def list(self) -> list[dict]:
        return self.repository.list()

    def get(self, record_id: str) -> dict | None:
        return self.repository.get(record_id)

    def create(self, payload: dict) -> dict:
        return self.repository.save({"id": str(uuid4()), **payload})

    def update(self, record_id: str, payload: dict) -> dict | None:
        current = self.repository.get(record_id)
        if current is None:
            return None
        current.update(payload)
        return self.repository.save(current)

    def delete(self, record_id: str) -> bool:
        return self.repository.delete(record_id)
`
    },
    {
      path: `${root}/presentation/serializers/${entity.moduleName}_serializer.py`,
      content: `def serialize_${entity.moduleName}(record: dict) -> dict:
    return {
        "id": record.get("id")${serializerFields ? ",\n" + serializerFields : ""}
    }
`
    },
    {
      path: `${root}/presentation/views/${entity.moduleName}_views.py`,
      content: `import json

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from application.services.${entity.moduleName}_service import ${entity.className}Service
from presentation.serializers.${entity.moduleName}_serializer import serialize_${entity.moduleName}

service = ${entity.className}Service()

@csrf_exempt
def ${entity.moduleName}_collection(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return JsonResponse([serialize_${entity.moduleName}(record) for record in service.list()], safe=False)
    if request.method == "POST":
        payload = json.loads(request.body or "{}")
        return JsonResponse(serialize_${entity.moduleName}(service.create(payload)), status=201)
    return JsonResponse({}, status=405)


@csrf_exempt
def ${entity.moduleName}_member(request: HttpRequest, record_id: str) -> JsonResponse | HttpResponse:
    if request.method == "GET":
        record = service.get(record_id)
        return JsonResponse(serialize_${entity.moduleName}(record), status=200) if record else JsonResponse({}, status=404)
    if request.method == "PUT":
        payload = json.loads(request.body or "{}")
        record = service.update(record_id, payload)
        return JsonResponse(serialize_${entity.moduleName}(record), status=200) if record else JsonResponse({}, status=404)
    if request.method == "DELETE":
        return HttpResponse(status=204) if service.delete(record_id) else JsonResponse({}, status=404)
    return JsonResponse({}, status=405)
`
    }
  ];
}

function javaSpringCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const packageName = contextString(context, "packageName");
  const packagePath = contextString(context, "packagePath");
  const fieldLines = entity.fields.map((field) => `  private ${field.javaType} ${field.camelName};`).join("\n");
  const accessorLines = entity.fields.map((field) => `  public ${field.javaType} get${field.pascalName}() { return ${field.camelName}; }
  public void set${field.pascalName}(${field.javaType} ${field.camelName}) { this.${field.camelName} = ${field.camelName}; }`).join("\n\n");

  return [
    {
      path: `${root}/src/main/java/${packagePath}/domain/entities/${entity.className}.java`,
      content: `package ${packageName}.domain.entities;

public class ${entity.className} {
  private String id;
${fieldLines}

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

${accessorLines}
}
`
    },
    {
      path: `${root}/src/main/java/${packagePath}/infrastructure/repositories/${entity.className}Repository.java`,
      content: `package ${packageName}.infrastructure.repositories;

import ${packageName}.domain.entities.${entity.className};
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Repository;

@Repository
public class ${entity.className}Repository {
  private final Map<String, ${entity.className}> records = new ConcurrentHashMap<>();

  public List<${entity.className}> findAll() { return new ArrayList<>(records.values()); }
  public Optional<${entity.className}> findById(String id) { return Optional.ofNullable(records.get(id)); }
  public ${entity.className} save(${entity.className} record) { records.put(record.getId(), record); return record; }
  public boolean deleteById(String id) { return records.remove(id) != null; }
}
`
    },
    {
      path: `${root}/src/main/java/${packagePath}/application/services/${entity.className}Service.java`,
      content: `package ${packageName}.application.services;

import ${packageName}.domain.entities.${entity.className};
import ${packageName}.infrastructure.repositories.${entity.className}Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ${entity.className}Service {
  private final ${entity.className}Repository repository;

  public ${entity.className}Service(${entity.className}Repository repository) {
    this.repository = repository;
  }

  public List<${entity.className}> list() { return repository.findAll(); }
  public Optional<${entity.className}> get(String id) { return repository.findById(id); }
  public ${entity.className} create(${entity.className} record) { record.setId(UUID.randomUUID().toString()); return repository.save(record); }
  public Optional<${entity.className}> update(String id, ${entity.className} record) {
    if (repository.findById(id).isEmpty()) return Optional.empty();
    record.setId(id);
    return Optional.of(repository.save(record));
  }
  public boolean delete(String id) { return repository.deleteById(id); }
}
`
    },
    {
      path: `${root}/src/main/java/${packagePath}/presentation/controllers/${entity.className}Controller.java`,
      content: `package ${packageName}.presentation.controllers;

import ${packageName}.application.services.${entity.className}Service;
import ${packageName}.domain.entities.${entity.className};
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/${entity.routeName}")
public class ${entity.className}Controller {
  private final ${entity.className}Service service;

  public ${entity.className}Controller(${entity.className}Service service) {
    this.service = service;
  }

  @GetMapping
  public List<${entity.className}> list() { return service.list(); }

  @GetMapping("/{id}")
  public ResponseEntity<${entity.className}> get(@PathVariable String id) {
    return service.get(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  public ResponseEntity<${entity.className}> create(@RequestBody ${entity.className} record) {
    return ResponseEntity.status(201).body(service.create(record));
  }

  @PutMapping("/{id}")
  public ResponseEntity<${entity.className}> update(@PathVariable String id, @RequestBody ${entity.className} record) {
    return service.update(id, record).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    return service.delete(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
  }
}
`
    }
  ];
}

function csharpCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const projectClassName = contextString(context, "className");
  const properties = entity.fields.map((field) => `    public ${field.csharpType}${field.csharpType === "string" ? "?" : ""} ${field.pascalName} { get; set; }`).join("\n");
  return [
    { path: `${root}/Domain/Entities/${entity.className}.cs`, content: `namespace ${projectClassName}.Domain.Entities;\n\npublic class ${entity.className}\n{\n    public Guid Id { get; set; }\n${properties}\n}\n` },
    { path: `${root}/Infrastructure/Repositories/${entity.className}Repository.cs`, content: `namespace ${projectClassName}.Infrastructure.Repositories;\n\nusing ${projectClassName}.Domain.Entities;\n\npublic class ${entity.className}Repository\n{\n    private readonly Dictionary<Guid, ${entity.className}> records = new();\n    public IReadOnlyCollection<${entity.className}> List() => records.Values.ToList();\n    public ${entity.className}? Get(Guid id) => records.GetValueOrDefault(id);\n    public ${entity.className} Save(${entity.className} record) { records[record.Id] = record; return record; }\n    public bool Delete(Guid id) => records.Remove(id);\n}\n` },
    { path: `${root}/Application/Services/${entity.className}Service.cs`, content: `namespace ${projectClassName}.Application.Services;\n\nusing ${projectClassName}.Domain.Entities;\nusing ${projectClassName}.Infrastructure.Repositories;\n\npublic class ${entity.className}Service\n{\n    private readonly ${entity.className}Repository repository = new();\n    public IReadOnlyCollection<${entity.className}> List() => repository.List();\n    public ${entity.className}? Get(Guid id) => repository.Get(id);\n    public ${entity.className} Create(${entity.className} record) { record.Id = Guid.NewGuid(); return repository.Save(record); }\n    public ${entity.className}? Update(Guid id, ${entity.className} record) { if (repository.Get(id) is null) return null; record.Id = id; return repository.Save(record); }\n    public bool Delete(Guid id) => repository.Delete(id);\n}\n` },
    { path: `${root}/Presentation/Controllers/${entity.className}Controller.cs`, content: `namespace ${projectClassName}.Presentation.Controllers;\n\nusing ${projectClassName}.Application.Services;\nusing ${projectClassName}.Domain.Entities;\nusing Microsoft.AspNetCore.Mvc;\n\n[ApiController]\n[Route("${entity.routeName}")]\npublic class ${entity.className}Controller : ControllerBase\n{\n    private readonly ${entity.className}Service service = new();\n\n    [HttpGet]\n    public ActionResult<IReadOnlyCollection<${entity.className}>> List() => Ok(service.List());\n\n    [HttpGet("{id:guid}")]\n    public ActionResult<${entity.className}> Get(Guid id)\n    {\n        var record = service.Get(id);\n        return record is null ? NotFound() : Ok(record);\n    }\n\n    [HttpPost]\n    public ActionResult<${entity.className}> Create(${entity.className} record)\n    {\n        var created = service.Create(record);\n        return Created($"/${entity.routeName}/{created.Id}", created);\n    }\n\n    [HttpPut("{id:guid}")]\n    public ActionResult<${entity.className}> Update(Guid id, ${entity.className} record)\n    {\n        var updated = service.Update(id, record);\n        return updated is null ? NotFound() : Ok(updated);\n    }\n\n    [HttpDelete("{id:guid}")]\n    public IActionResult Delete(Guid id) => service.Delete(id) ? NoContent() : NotFound();\n}\n` }
  ];
}

function phpLaravelCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  return [
    { path: `${root}/app/Domain/Entities/${entity.className}.php`, content: `<?php\n\nnamespace App\\Domain\\Entities;\n\nclass ${entity.className}\n{\n    public function __construct(public string $id, public array $attributes = []) {}\n}\n` },
    { path: `${root}/app/Infrastructure/Repositories/${entity.className}Repository.php`, content: `<?php\n\nnamespace App\\Infrastructure\\Repositories;\n\nuse App\\Domain\\Entities\\${entity.className};\n\nclass ${entity.className}Repository\n{\n    private array $records = [];\n    public function list(): array { return array_values($this->records); }\n    public function get(string $id): ?${entity.className} { return $this->records[$id] ?? null; }\n    public function save(${entity.className} $record): ${entity.className} { $this->records[$record->id] = $record; return $record; }\n    public function delete(string $id): bool { if (!isset($this->records[$id])) return false; unset($this->records[$id]); return true; }\n}\n` },
    { path: `${root}/app/Application/Services/${entity.className}Service.php`, content: `<?php\n\nnamespace App\\Application\\Services;\n\nuse App\\Domain\\Entities\\${entity.className};\nuse App\\Infrastructure\\Repositories\\${entity.className}Repository;\n\nclass ${entity.className}Service\n{\n    public function __construct(private ${entity.className}Repository $repository = new ${entity.className}Repository()) {}\n    public function list(): array { return $this->repository->list(); }\n    public function get(string $id): ?${entity.className} { return $this->repository->get($id); }\n    public function create(array $attributes): ${entity.className} { return $this->repository->save(new ${entity.className}((string) str()->uuid(), $attributes)); }\n    public function update(string $id, array $attributes): ?${entity.className} { $record = $this->repository->get($id); if (!$record) return null; $record->attributes = array_merge($record->attributes, $attributes); return $this->repository->save($record); }\n    public function delete(string $id): bool { return $this->repository->delete($id); }\n}\n` },
    { path: `${root}/app/Http/Controllers/${entity.className}Controller.php`, content: `<?php\n\nnamespace App\\Http\\Controllers;\n\nuse App\\Application\\Services\\${entity.className}Service;\nuse Illuminate\\Http\\JsonResponse;\nuse Illuminate\\Http\\Request;\n\nclass ${entity.className}Controller\n{\n    public function __construct(private ${entity.className}Service $service) {}\n    public function index(): JsonResponse { return response()->json($this->service->list()); }\n    public function show(string $id): JsonResponse { $record = $this->service->get($id); return $record ? response()->json($record) : response()->json(null, 404); }\n    public function store(Request $request): JsonResponse { return response()->json($this->service->create($request->all()), 201); }\n    public function update(Request $request, string $id): JsonResponse { $record = $this->service->update($id, $request->all()); return $record ? response()->json($record) : response()->json(null, 404); }\n    public function destroy(string $id): JsonResponse { return $this->service->delete($id) ? response()->json(null, 204) : response()->json(null, 404); }\n}\n` }
  ];
}

function goGinCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const fields = entity.fields.map((field) => `\t${field.pascalName} ${field.goType} \`json:"${field.camelName}"\``).join("\n");
  return [
    { path: `${root}/internal/domain/${entity.moduleName}.go`, content: `package domain\n\ntype ${entity.className} struct {\n\tID string \`json:"id"\`\n${fields}\n}\n` },
    { path: `${root}/internal/repository/${entity.moduleName}_repository.go`, content: `package repository\n\nimport "sync"\nimport "{{moduleName}}/internal/domain"\n\ntype ${entity.className}Repository struct { mu sync.RWMutex; records map[string]domain.${entity.className} }\nfunc New${entity.className}Repository() *${entity.className}Repository { return &${entity.className}Repository{records: map[string]domain.${entity.className}{}} }\nfunc (r *${entity.className}Repository) List() []domain.${entity.className} { r.mu.RLock(); defer r.mu.RUnlock(); out := []domain.${entity.className}{}; for _, record := range r.records { out = append(out, record) }; return out }\nfunc (r *${entity.className}Repository) Get(id string) (domain.${entity.className}, bool) { r.mu.RLock(); defer r.mu.RUnlock(); record, ok := r.records[id]; return record, ok }\nfunc (r *${entity.className}Repository) Save(record domain.${entity.className}) domain.${entity.className} { r.mu.Lock(); defer r.mu.Unlock(); r.records[record.ID] = record; return record }\nfunc (r *${entity.className}Repository) Delete(id string) bool { r.mu.Lock(); defer r.mu.Unlock(); if _, ok := r.records[id]; !ok { return false }; delete(r.records, id); return true }\n` },
    { path: `${root}/internal/usecase/${entity.moduleName}_usecase.go`, content: `package usecase\n\nimport (\n\t"crypto/rand"\n\t"encoding/hex"\n\n\t"{{moduleName}}/internal/domain"\n\t"{{moduleName}}/internal/repository"\n)\n\ntype ${entity.className}UseCase struct { repository *repository.${entity.className}Repository }\nfunc New${entity.className}UseCase(repository *repository.${entity.className}Repository) *${entity.className}UseCase { return &${entity.className}UseCase{repository: repository} }\nfunc (u *${entity.className}UseCase) List() []domain.${entity.className} { return u.repository.List() }\nfunc (u *${entity.className}UseCase) Get(id string) (domain.${entity.className}, bool) { return u.repository.Get(id) }\nfunc (u *${entity.className}UseCase) Create(record domain.${entity.className}) domain.${entity.className} { record.ID = randomID(); return u.repository.Save(record) }\nfunc (u *${entity.className}UseCase) Update(id string, record domain.${entity.className}) (domain.${entity.className}, bool) { if _, ok := u.repository.Get(id); !ok { return domain.${entity.className}{}, false }; record.ID = id; return u.repository.Save(record), true }\nfunc (u *${entity.className}UseCase) Delete(id string) bool { return u.repository.Delete(id) }\nfunc randomID() string { b := make([]byte, 16); _, _ = rand.Read(b); return hex.EncodeToString(b) }\n` },
    { path: `${root}/internal/handler/${entity.moduleName}_handler.go`, content: `package handler\n\nimport (\n\t"net/http"\n\n\t"github.com/gin-gonic/gin"\n\t"{{moduleName}}/internal/domain"\n\t"{{moduleName}}/internal/repository"\n\t"{{moduleName}}/internal/usecase"\n)\n\nfunc Register${entity.className}Routes(router *gin.Engine) {\n\tuseCase := usecase.New${entity.className}UseCase(repository.New${entity.className}Repository())\n\trouter.GET("/${entity.routeName}", func(context *gin.Context) { context.JSON(http.StatusOK, useCase.List()) })\n\trouter.GET("/${entity.routeName}/:id", func(context *gin.Context) { record, ok := useCase.Get(context.Param("id")); if !ok { context.Status(http.StatusNotFound); return }; context.JSON(http.StatusOK, record) })\n\trouter.POST("/${entity.routeName}", func(context *gin.Context) {\n\t\tvar payload domain.${entity.className}\n\t\tif err := context.ShouldBindJSON(&payload); err != nil { context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }\n\t\tcontext.JSON(http.StatusCreated, useCase.Create(payload))\n\t})\n\trouter.PUT("/${entity.routeName}/:id", func(context *gin.Context) {\n\t\tvar payload domain.${entity.className}\n\t\tif err := context.ShouldBindJSON(&payload); err != nil { context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }\n\t\trecord, ok := useCase.Update(context.Param("id"), payload); if !ok { context.Status(http.StatusNotFound); return }; context.JSON(http.StatusOK, record)\n\t})\n\trouter.DELETE("/${entity.routeName}/:id", func(context *gin.Context) { if !useCase.Delete(context.Param("id")) { context.Status(http.StatusNotFound); return }; context.Status(http.StatusNoContent) })\n}\n` }
  ].map((file) => ({ ...file, content: renderPath(file.content, context) }));
}

function rubyRailsCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const controllerClassName = toPascalCase(entity.routeName);
  return [
    { path: `${root}/app/domain/entities/${entity.moduleName}.rb`, content: `class ${entity.className}\n  attr_accessor :id, :attributes\n\n  def initialize(id:, attributes: {})\n    @id = id\n    @attributes = attributes\n  end\nend\n` },
    { path: `${root}/app/infrastructure/repositories/${entity.moduleName}_repository.rb`, content: `class ${entity.className}Repository\n  def initialize\n    @records = {}\n  end\n\n  def list = @records.values\n  def get(id) = @records[id]\n  def save(record)\n    @records[record.id] = record\n    record\n  end\n  def delete(id) = !@records.delete(id).nil?\nend\n` },
    { path: `${root}/app/application/services/${entity.moduleName}_service.rb`, content: `require "securerandom"\n\nclass ${entity.className}Service\n  def initialize(repository = ${entity.className}Repository.new)\n    @repository = repository\n  end\n\n  def list = @repository.list\n  def get(id) = @repository.get(id)\n  def create(attributes)\n    @repository.save(${entity.className}.new(id: SecureRandom.uuid, attributes: attributes))\n  end\n  def update(id, attributes)\n    record = @repository.get(id)\n    return nil unless record\n    record.attributes = record.attributes.merge(attributes)\n    @repository.save(record)\n  end\n  def delete(id) = @repository.delete(id)\nend\n` },
    { path: `${root}/app/controllers/${entity.routeName}_controller.rb`, content: `class ${controllerClassName}Controller < ActionController::API\n  def initialize\n    @service = ${entity.className}Service.new\n  end\n\n  def index\n    render json: @service.list\n  end\n\n  def show\n    record = @service.get(params[:id])\n    record ? render(json: record) : head(:not_found)\n  end\n\n  def create\n    render json: @service.create(params.to_unsafe_h), status: :created\n  end\n\n  def update\n    record = @service.update(params[:id], params.to_unsafe_h)\n    record ? render(json: record) : head(:not_found)\n  end\n\n  def destroy\n    @service.delete(params[:id]) ? head(:no_content) : head(:not_found)\n  end\nend\n` }
  ];
}

function kotlinKtorCrudFiles(context: Record<string, unknown>, entity: EntityView): GeneratedFile[] {
  const root = contextString(context, "projectSlug");
  const packageName = contextString(context, "packageName");
  const packagePath = contextString(context, "packagePath");
  const fields = entity.fields.map((field) => `    val ${field.camelName}: ${field.kotlinType}`).join(",\n");
  return [
    { path: `${root}/src/main/kotlin/${packagePath}/domain/entities/${entity.className}.kt`, content: `package ${packageName}.domain.entities\n\nimport java.util.UUID\nimport kotlinx.serialization.Serializable\n\n@Serializable\ndata class ${entity.className}(\n    val id: String = UUID.randomUUID().toString()${fields ? ",\n" + fields : ""}\n)\n` },
    { path: `${root}/src/main/kotlin/${packagePath}/infrastructure/repositories/${entity.className}Repository.kt`, content: `package ${packageName}.infrastructure.repositories\n\nimport ${packageName}.domain.entities.${entity.className}\n\nclass ${entity.className}Repository {\n    private val records = linkedMapOf<String, ${entity.className}>()\n    fun list(): List<${entity.className}> = records.values.toList()\n    fun get(id: String): ${entity.className}? = records[id]\n    fun save(record: ${entity.className}): ${entity.className} { records[record.id] = record; return record }\n    fun delete(id: String): Boolean = records.remove(id) != null\n}\n` },
    { path: `${root}/src/main/kotlin/${packagePath}/application/services/${entity.className}Service.kt`, content: `package ${packageName}.application.services\n\nimport ${packageName}.domain.entities.${entity.className}\nimport ${packageName}.infrastructure.repositories.${entity.className}Repository\n\nclass ${entity.className}Service(private val repository: ${entity.className}Repository = ${entity.className}Repository()) {\n    fun list(): List<${entity.className}> = repository.list()\n    fun get(id: String): ${entity.className}? = repository.get(id)\n    fun create(record: ${entity.className}): ${entity.className} = repository.save(record)\n    fun update(id: String, record: ${entity.className}): ${entity.className}? {\n        if (repository.get(id) == null) return null\n        return repository.save(record.copy(id = id))\n    }\n    fun delete(id: String): Boolean = repository.delete(id)\n}\n` },
    { path: `${root}/src/main/kotlin/${packagePath}/presentation/routes/${entity.className}Routes.kt`, content: `package ${packageName}.presentation.routes\n\nimport ${packageName}.application.services.${entity.className}Service\nimport ${packageName}.domain.entities.${entity.className}\nimport io.ktor.http.HttpStatusCode\nimport io.ktor.server.application.call\nimport io.ktor.server.request.receive\nimport io.ktor.server.response.respond\nimport io.ktor.server.routing.Route\nimport io.ktor.server.routing.delete\nimport io.ktor.server.routing.get\nimport io.ktor.server.routing.post\nimport io.ktor.server.routing.put\nimport io.ktor.server.routing.route\n\nfun Route.register${entity.className}Routes(service: ${entity.className}Service = ${entity.className}Service()) {\n    route("/${entity.routeName}") {\n        get { call.respond(service.list()) }\n        get("{id}") {\n            val record = service.get(call.parameters["id"].orEmpty())\n            if (record == null) call.respond(HttpStatusCode.NotFound) else call.respond(record)\n        }\n        post { call.respond(HttpStatusCode.Created, service.create(call.receive<${entity.className}>())) }\n        put("{id}") {\n            val record = service.update(call.parameters["id"].orEmpty(), call.receive<${entity.className}>())\n            if (record == null) call.respond(HttpStatusCode.NotFound) else call.respond(record)\n        }\n        delete("{id}") {\n            if (service.delete(call.parameters["id"].orEmpty())) call.respond(HttpStatusCode.NoContent) else call.respond(HttpStatusCode.NotFound)\n        }\n    }\n}\n` }
  ];
}
