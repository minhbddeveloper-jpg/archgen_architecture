import { EntityConfig, EntityFieldConfig, FieldType } from "../../core/domain/projectConfig.js";
import { CliOptions, isRecord, stringListOption } from "./optionParser.js";

export function parseCliEntities(options: CliOptions): EntityConfig[] | undefined {
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

export function parseEntityFields(options: CliOptions): EntityFieldConfig[] {
  return stringListOption(options, "field").map((spec) => parseStandaloneFieldSpec(spec));
}

export function validateEntities(value: unknown): EntityConfig[] | undefined {
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

export function mergeEntities(base: EntityConfig[] | undefined, imported: EntityConfig[] | undefined): EntityConfig[] | undefined {
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
