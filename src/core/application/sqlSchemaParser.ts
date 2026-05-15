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
}

interface ForeignKey {
  sourceTable: string;
  targetTable: string;
}

export function parseSqlSchema(sql: string): ParsedSqlSchema {
  const normalized = stripComments(sql);
  const entities: EntityConfig[] = [];
  const relations: RelationConfig[] = [];

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

    entities.push({
      name: toEntityName(tableName),
      fields: columns
        .filter((column) => !isGeneratedIdColumn(column))
        .map((column) => toEntityField(column))
    });

    relations.push(
      ...foreignKeys.map((foreignKey) => ({
        source: toEntityName(foreignKey.sourceTable),
        target: toEntityName(foreignKey.targetTable),
        kind: "many-to-one" as const
      }))
    );
  }

  return {
    entities: dedupeEntities(entities),
    relations: dedupeRelations(relations)
  };
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
    primaryKey: upper.includes("PRIMARY KEY")
  };
}

function parseTableForeignKey(sourceTable: string, definition: string): ForeignKey | undefined {
  const match = definition.match(/foreign\s+key\s*\([^)]+\)\s+references\s+([`"\[]?[a-zA-Z_][\w$]*[`"\]]?(?:\.[`"\[]?[a-zA-Z_][\w$]*[`"\]]?)?)/i);
  if (!match) {
    return undefined;
  }

  return {
    sourceTable,
    targetTable: normalizeIdentifier(match[1].split(".").at(-1) ?? match[1])
  };
}

function parseInlineForeignKey(sourceTable: string, definition: string): ForeignKey | undefined {
  const match = definition.match(/\breferences\s+([`"\[]?[a-zA-Z_][\w$]*[`"\]]?(?:\.[`"\[]?[a-zA-Z_][\w$]*[`"\]]?)?)/i);
  if (!match) {
    return undefined;
  }

  return {
    sourceTable,
    targetTable: normalizeIdentifier(match[1].split(".").at(-1) ?? match[1])
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
    required: column.required ? undefined : false
  };
}

function mapSqlType(sqlType: string): FieldType {
  const normalized = sqlType.toLowerCase();
  if (normalized.includes("uuid")) return "uuid";
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
