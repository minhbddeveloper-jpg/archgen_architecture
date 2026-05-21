import { EntityConfig, EntityFieldConfig, FieldType, RelationConfig } from "../domain/projectConfig.js";

export interface ParsedSqlSchema {
  entities: EntityConfig[];
  relations: RelationConfig[];
}

interface TableColumn {
  name: string;
  sqlType: string;
  required: boolean;
  primaryKey: boolean;
  unique: boolean;
  indexed: boolean;
  defaultValue?: string;
  length?: number;
  precision?: number;
  scale?: number;
}

interface ForeignKey {
  sourceTable: string;
  sourceColumn?: string;
  targetTable: string;
}

export function parseSqlSchema(sql: string): ParsedSqlSchema {
  const normalized = stripComments(sql);
  const entities: EntityConfig[] = [];
  const relations: RelationConfig[] = [];

  const indexes = extractCreateIndexes(normalized);

  for (const table of extractCreateTables(normalized)) {
    const tableName = normalizeIdentifier(table.name.split(".").at(-1) ?? table.name);
    const body = table.body;
    const definitions = splitSqlDefinitions(body);
    const columns: TableColumn[] = [];
    const foreignKeys: ForeignKey[] = [];

    for (const definition of definitions) {
      const trimmed = definition.trim();
      if (!trimmed) {
        continue;
      }

      const tableForeignKey = parseTableForeignKey(tableName, trimmed);
      if (tableForeignKey) {
        foreignKeys.push(tableForeignKey);
        continue;
      }

      if (isTableConstraint(trimmed)) {
        applyTableConstraint(columns, trimmed);
        continue;
      }

      const column = parseColumn(trimmed);
      if (!column) {
        continue;
      }

      columns.push(column);
      const inlineForeignKey = parseInlineForeignKey(tableName, trimmed);
      if (inlineForeignKey) {
        foreignKeys.push(inlineForeignKey);
      }
    }

    for (const indexedColumn of indexes.get(tableName) ?? []) {
      const column = columns.find((candidate) => candidate.name === indexedColumn.name);
      if (column) {
        column.indexed = true;
        column.unique = column.unique || indexedColumn.unique;
      }
    }

    const manyToMany = detectManyToManyJoinTable(columns, foreignKeys);
    if (manyToMany) {
      relations.push({
        source: toEntityName(manyToMany.sourceTable),
        target: toEntityName(manyToMany.targetTable),
        kind: "many-to-many"
      });
      continue;
    }

    entities.push({
      name: toEntityName(tableName),
      fields: columns
        .filter((column) => !isGeneratedIdColumn(column))
        .map((column) => toEntityField(column))
    });

    relations.push(
      ...foreignKeys.flatMap((foreignKey) => [{
        source: toEntityName(foreignKey.sourceTable),
        target: toEntityName(foreignKey.targetTable),
        kind: "many-to-one" as const
      }, {
        source: toEntityName(foreignKey.targetTable),
        target: toEntityName(foreignKey.sourceTable),
        kind: "one-to-many" as const
      }])
    );
  }

  return {
    entities: dedupeEntities(entities),
    relations: dedupeRelations(relations)
  };
}

function extractCreateIndexes(sql: string): Map<string, Array<{ name: string; unique: boolean }>> {
  const indexes = new Map<string, Array<{ name: string; unique: boolean }>>();
  const pattern = /create\s+(unique\s+)?index\s+(?:if\s+not\s+exists\s+)?[`"\[]?[a-zA-Z_][\w$]*[`"\]]?\s+on\s+([`"\[]?[a-zA-Z_][\w$]*[`"\]]?(?:\.[`"\[]?[a-zA-Z_][\w$]*[`"\]]?)?)\s*\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sql)) !== null) {
    const tableName = normalizeIdentifier(match[2].split(".").at(-1) ?? match[2]);
    const columns = match[3].split(",").map((rawName) => normalizeIdentifier(rawName.trim().split(/\s+/)[0]));
    const existing = indexes.get(tableName) ?? [];
    existing.push(...columns.map((name) => ({ name, unique: Boolean(match?.[1]) })));
    indexes.set(tableName, existing);
  }

  return indexes;
}

function extractCreateTables(sql: string): Array<{ name: string; body: string }> {
  const tables: Array<{ name: string; body: string }> = [];
  const createTablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?([`"\[]?[a-zA-Z_][\w$]*[`"\]]?(?:\.[`"\[]?[a-zA-Z_][\w$]*[`"\]]?)?)\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = createTablePattern.exec(sql)) !== null) {
    const bodyStart = createTablePattern.lastIndex;
    let index = bodyStart;
    let depth = 1;
    let quote: string | undefined;

    while (index < sql.length && depth > 0) {
      const char = sql[index];
      if (quote) {
        if (char === quote) {
          quote = undefined;
        }
        index += 1;
        continue;
      }

      if (char === "'" || char === "\"") {
        quote = char;
        index += 1;
        continue;
      }

      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }
      index += 1;
    }

    if (depth === 0) {
      tables.push({
        name: match[1],
        body: sql.slice(bodyStart, index - 1)
      });
      createTablePattern.lastIndex = index;
    }
  }

  return tables;
}

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitSqlDefinitions(body: string): string[] {
  const definitions: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | undefined;

  for (const char of body) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(depth - 1, 0);
    }

    if (char === "," && depth === 0) {
      definitions.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    definitions.push(current);
  }

  return definitions;
}

function parseColumn(definition: string): TableColumn | undefined {
  const match = definition.match(/^([`"\[]?[a-zA-Z_][\w$]*[`"\]]?)\s+(.+)$/);
  if (!match) {
    return undefined;
  }

  const name = normalizeIdentifier(match[1]);
  const rest = match[2];
  const type = rest.match(/^([a-zA-Z][\w]*(?:\s*\([^)]*\))?)/)?.[1] ?? "text";
  const upper = rest.toUpperCase();

  return {
    name,
    sqlType: type,
    required: upper.includes("NOT NULL") || upper.includes("PRIMARY KEY"),
    primaryKey: upper.includes("PRIMARY KEY"),
    unique: upper.includes("UNIQUE"),
    indexed: false,
    defaultValue: rest.match(/\bdefault\s+([^,\s]+)/i)?.[1],
    ...parseTypeOptions(type)
  };
}

function parseTypeOptions(sqlType: string): Pick<TableColumn, "length" | "precision" | "scale"> {
  const match = sqlType.match(/\(([^)]+)\)/);
  if (!match) return {};
  const values = match[1].split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value));
  if (values.length === 1) return { length: values[0], precision: values[0] };
  if (values.length >= 2) return { precision: values[0], scale: values[1] };
  return {};
}

function applyTableConstraint(columns: TableColumn[], definition: string): void {
  const uniqueMatch = definition.match(/unique\s*\(([^)]+)\)/i);
  const indexMatch = definition.match(/(?:index|key)\s+[a-zA-Z_][\w$]*\s*\(([^)]+)\)/i);
  const primaryKeyMatch = definition.match(/primary\s+key\s*\(([^)]+)\)/i);
  const names = uniqueMatch?.[1] ?? indexMatch?.[1] ?? primaryKeyMatch?.[1];
  if (!names) return;

  for (const rawName of names.split(",")) {
    const name = normalizeIdentifier(rawName.trim());
    const column = columns.find((candidate) => candidate.name === name);
    if (column) {
      if (uniqueMatch) column.unique = true;
      if (indexMatch) column.indexed = true;
      if (primaryKeyMatch) {
        column.primaryKey = true;
        column.required = true;
      }
    }
  }
}

function parseTableForeignKey(sourceTable: string, definition: string): ForeignKey | undefined {
  const match = definition.match(/foreign\s+key\s*\(([^)]+)\)\s+references\s+([`"\[]?[a-zA-Z_][\w$]*[`"\]]?(?:\.[`"\[]?[a-zA-Z_][\w$]*[`"\]]?)?)/i);
  if (!match) {
    return undefined;
  }

  return {
    sourceTable,
    sourceColumn: normalizeIdentifier(match[1].split(",")[0].trim()),
    targetTable: normalizeIdentifier(match[2].split(".").at(-1) ?? match[2])
  };
}

function parseInlineForeignKey(sourceTable: string, definition: string): ForeignKey | undefined {
  const match = definition.match(/\breferences\s+([`"\[]?[a-zA-Z_][\w$]*[`"\]]?(?:\.[`"\[]?[a-zA-Z_][\w$]*[`"\]]?)?)/i);
  if (!match) {
    return undefined;
  }

  return {
    sourceTable,
    sourceColumn: normalizeIdentifier(definition.split(/\s+/)[0]),
    targetTable: normalizeIdentifier(match[1].split(".").at(-1) ?? match[1])
  };
}

function detectManyToManyJoinTable(columns: TableColumn[], foreignKeys: ForeignKey[]): { sourceTable: string; targetTable: string } | undefined {
  if (foreignKeys.length !== 2) return undefined;
  const foreignKeyColumns = new Set(foreignKeys.map((foreignKey) => foreignKey.sourceColumn).filter(Boolean));
  const dataColumns = columns.filter((column) => !isGeneratedIdColumn(column));
  if (dataColumns.length !== foreignKeyColumns.size) return undefined;
  if (!dataColumns.every((column) => foreignKeyColumns.has(column.name))) return undefined;
  return {
    sourceTable: foreignKeys[0].targetTable,
    targetTable: foreignKeys[1].targetTable
  };
}

function isTableConstraint(definition: string): boolean {
  return /^(constraint|primary\s+key|unique|key|index|foreign\s+key|check)\b/i.test(definition);
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^[`"\[]|[`"\]]$/g, "");
}

function isGeneratedIdColumn(column: TableColumn): boolean {
  return column.primaryKey && column.name.toLowerCase() === "id";
}

function toEntityField(column: TableColumn): EntityFieldConfig {
  return {
    name: toFieldName(column.name),
    type: mapSqlType(column.sqlType),
    required: column.required ? undefined : false,
    unique: column.unique || undefined,
    indexed: column.indexed || undefined,
    defaultValue: column.defaultValue,
    length: column.length,
    precision: column.precision,
    scale: column.scale
  };
}

function mapSqlType(sqlType: string): FieldType {
  const normalized = sqlType.toLowerCase();
  if (normalized.includes("uuid")) return "uuid";
  if (normalized.startsWith("enum")) return "string";
  if (normalized.includes("text") || normalized.includes("clob")) return "text";
  if (normalized.includes("bool")) return "boolean";
  if (normalized.includes("date") || normalized.includes("time")) return "date";
  if (normalized.includes("int") || normalized.includes("decimal") || normalized.includes("numeric") || normalized.includes("float") || normalized.includes("double") || normalized.includes("real")) return "number";
  return "string";
}

function toEntityName(tableName: string): string {
  return singularize(toCamelName(tableName));
}

function toFieldName(columnName: string): string {
  return toCamelName(columnName);
}

function toCamelName(value: string): string {
  const words = value.match(/[a-zA-Z0-9]+/g) ?? ["entity"];
  const [first = "entity", ...rest] = words;
  return `${first.toLowerCase()}${rest.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("")}`;
}

function singularize(value: string): string {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.endsWith("ses")) {
    return value.slice(0, -1);
  }
  if (value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
}

function dedupeEntities(entities: EntityConfig[]): EntityConfig[] {
  const result = new Map<string, EntityConfig>();
  for (const entity of entities) {
    if (!result.has(entity.name)) {
      result.set(entity.name, entity);
    }
  }
  return [...result.values()];
}

function dedupeRelations(relations: RelationConfig[]): RelationConfig[] {
  const result = new Map<string, RelationConfig>();
  for (const relation of relations) {
    result.set(`${relation.source}.${relation.target}:${relation.kind}`, relation);
  }
  return [...result.values()];
}
