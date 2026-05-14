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
      path: `${root}/src/infrastructure/repositories/${entity.camelName}Repository.ts`,
      content: `import { ${entity.className} } from "../../domain/entities/${entity.className}.js";

export class ${entity.className}Repository {
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
      path: `${root}/src/application/services/${entity.camelName}Service.ts`,
      content: `import { randomUUID } from "node:crypto";
import { Create${entity.className}Input, ${entity.className}, Update${entity.className}Input } from "../../domain/entities/${entity.className}.js";
import { ${entity.className}Repository } from "../../infrastructure/repositories/${entity.camelName}Repository.js";

export class ${entity.className}Service {
  constructor(private readonly repository = new ${entity.className}Repository()) {}

  list(): ${entity.className}[] {
    return this.repository.findAll();
  }

  get(id: string): ${entity.className} | undefined {
    return this.repository.findById(id);
  }

  create(input: Create${entity.className}Input): ${entity.className} {
    return this.repository.save({
      id: randomUUID(),
${defaultInput}
    });
  }

  update(id: string, input: Update${entity.className}Input): ${entity.className} | undefined {
    const current = this.repository.findById(id);
    if (!current) {
      return undefined;
    }

    return this.repository.save({ ...current, ...input, id });
  }

  delete(id: string): boolean {
    return this.repository.delete(id);
  }
}
`
    },
    {
      path: `${root}/src/presentation/controllers/${entity.camelName}Controller.ts`,
      content: `import { Router } from "express";
import { ${entity.className}Service } from "../../application/services/${entity.camelName}Service.js";

export function create${entity.className}Router(service = new ${entity.className}Service()): Router {
  const router = Router();

  router.get("/", (_request, response) => response.json(service.list()));
  router.get("/:id", (request, response) => {
    const record = service.get(request.params.id);
    return record ? response.json(record) : response.sendStatus(404);
  });
  router.post("/", (request, response) => response.status(201).json(service.create(request.body)));
  router.put("/:id", (request, response) => {
    const record = service.update(request.params.id, request.body);
    return record ? response.json(record) : response.sendStatus(404);
  });
  router.delete("/:id", (request, response) => {
    return service.delete(request.params.id) ? response.sendStatus(204) : response.sendStatus(404);
  });

  return router;
}
`
    }
  ];
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

  return [
    {
      path: `${root}/presentation/views/${entity.moduleName}_views.py`,
      content: `import json
from uuid import uuid4

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

records: dict[str, dict] = {}


def list_${entity.routeName}(_request: HttpRequest) -> JsonResponse:
    return JsonResponse(list(records.values()), safe=False)


def get_${entity.moduleName}(_request: HttpRequest, record_id: str) -> JsonResponse:
    record = records.get(record_id)
    if record is None:
        return JsonResponse({}, status=404)
    return JsonResponse(record)


@csrf_exempt
def create_${entity.moduleName}(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body or "{}")
    record = {"id": str(uuid4()), **payload}
    records[record["id"]] = record
    return JsonResponse(record, status=201)


@csrf_exempt
def update_${entity.moduleName}(request: HttpRequest, record_id: str) -> JsonResponse:
    if record_id not in records:
        return JsonResponse({}, status=404)
    payload = json.loads(request.body or "{}")
    records[record_id].update(payload)
    return JsonResponse(records[record_id])


@csrf_exempt
def delete_${entity.moduleName}(_request: HttpRequest, record_id: str) -> HttpResponse:
    if records.pop(record_id, None) is None:
        return JsonResponse({}, status=404)
    return HttpResponse(status=204)
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
    { path: `${root}/Application/Services/${entity.className}Service.cs`, content: `namespace ${projectClassName}.Application.Services;\n\nusing ${projectClassName}.Domain.Entities;\nusing ${projectClassName}.Infrastructure.Repositories;\n\npublic class ${entity.className}Service\n{\n    private readonly ${entity.className}Repository repository = new();\n    public IReadOnlyCollection<${entity.className}> List() => repository.List();\n    public ${entity.className}? Get(Guid id) => repository.Get(id);\n    public ${entity.className} Create(${entity.className} record) { record.Id = Guid.NewGuid(); return repository.Save(record); }\n    public ${entity.className}? Update(Guid id, ${entity.className} record) { if (repository.Get(id) is null) return null; record.Id = id; return repository.Save(record); }\n    public bool Delete(Guid id) => repository.Delete(id);\n}\n` }
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
    { path: `${root}/internal/domain/entities/${entity.moduleName}.go`, content: `package entities\n\ntype ${entity.className} struct {\n\tID string \`json:"id"\`\n${fields}\n}\n` },
    { path: `${root}/internal/infrastructure/repositories/${entity.moduleName}_repository.go`, content: `package repositories\n\nimport "sync"\nimport "{{moduleName}}/internal/domain/entities"\n\ntype ${entity.className}Repository struct { mu sync.RWMutex; records map[string]entities.${entity.className} }\nfunc New${entity.className}Repository() *${entity.className}Repository { return &${entity.className}Repository{records: map[string]entities.${entity.className}{}} }\nfunc (r *${entity.className}Repository) List() []entities.${entity.className} { r.mu.RLock(); defer r.mu.RUnlock(); out := []entities.${entity.className}{}; for _, record := range r.records { out = append(out, record) }; return out }\nfunc (r *${entity.className}Repository) Get(id string) (entities.${entity.className}, bool) { r.mu.RLock(); defer r.mu.RUnlock(); record, ok := r.records[id]; return record, ok }\nfunc (r *${entity.className}Repository) Save(record entities.${entity.className}) entities.${entity.className} { r.mu.Lock(); defer r.mu.Unlock(); r.records[record.ID] = record; return record }\nfunc (r *${entity.className}Repository) Delete(id string) bool { r.mu.Lock(); defer r.mu.Unlock(); if _, ok := r.records[id]; !ok { return false }; delete(r.records, id); return true }\n` },
    { path: `${root}/internal/application/services/${entity.moduleName}_service.go`, content: `package services\n\nimport (\n\t"crypto/rand"\n\t"encoding/hex"\n\n\t"{{moduleName}}/internal/domain/entities"\n\t"{{moduleName}}/internal/infrastructure/repositories"\n)\n\ntype ${entity.className}Service struct { repository *repositories.${entity.className}Repository }\nfunc New${entity.className}Service(repository *repositories.${entity.className}Repository) *${entity.className}Service { return &${entity.className}Service{repository: repository} }\nfunc (s *${entity.className}Service) List() []entities.${entity.className} { return s.repository.List() }\nfunc (s *${entity.className}Service) Get(id string) (entities.${entity.className}, bool) { return s.repository.Get(id) }\nfunc (s *${entity.className}Service) Create(record entities.${entity.className}) entities.${entity.className} { record.ID = randomID(); return s.repository.Save(record) }\nfunc (s *${entity.className}Service) Update(id string, record entities.${entity.className}) (entities.${entity.className}, bool) { if _, ok := s.repository.Get(id); !ok { return entities.${entity.className}{}, false }; record.ID = id; return s.repository.Save(record), true }\nfunc (s *${entity.className}Service) Delete(id string) bool { return s.repository.Delete(id) }\nfunc randomID() string { b := make([]byte, 16); _, _ = rand.Read(b); return hex.EncodeToString(b) }\n` },
    { path: `${root}/internal/presentation/handlers/${entity.moduleName}_handler.go`, content: `package handlers\n\nimport (\n\t"net/http"\n\n\t"github.com/gin-gonic/gin"\n\t"{{moduleName}}/internal/application/services"\n\t"{{moduleName}}/internal/domain/entities"\n\t"{{moduleName}}/internal/infrastructure/repositories"\n)\n\nfunc Register${entity.className}Routes(router *gin.Engine) {\n\tservice := services.New${entity.className}Service(repositories.New${entity.className}Repository())\n\trouter.GET("/${entity.routeName}", func(context *gin.Context) { context.JSON(http.StatusOK, service.List()) })\n\trouter.GET("/${entity.routeName}/:id", func(context *gin.Context) { record, ok := service.Get(context.Param("id")); if !ok { context.Status(http.StatusNotFound); return }; context.JSON(http.StatusOK, record) })\n\trouter.POST("/${entity.routeName}", func(context *gin.Context) {\n\t\tvar payload entities.${entity.className}\n\t\tif err := context.ShouldBindJSON(&payload); err != nil { context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }\n\t\tcontext.JSON(http.StatusCreated, service.Create(payload))\n\t})\n\trouter.PUT("/${entity.routeName}/:id", func(context *gin.Context) {\n\t\tvar payload entities.${entity.className}\n\t\tif err := context.ShouldBindJSON(&payload); err != nil { context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }\n\t\trecord, ok := service.Update(context.Param("id"), payload); if !ok { context.Status(http.StatusNotFound); return }; context.JSON(http.StatusOK, record)\n\t})\n\trouter.DELETE("/${entity.routeName}/:id", func(context *gin.Context) { if !service.Delete(context.Param("id")) { context.Status(http.StatusNotFound); return }; context.Status(http.StatusNoContent) })\n}\n` }
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
