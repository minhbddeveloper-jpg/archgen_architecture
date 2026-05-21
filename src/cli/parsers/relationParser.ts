import { RelationConfig, RelationKind } from "../../core/domain/projectConfig.js";

export function parseRelations(options: Record<string, unknown>): RelationConfig[] | undefined {
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

export function mergeRelations(base: RelationConfig[] | undefined, imported: RelationConfig[] | undefined): RelationConfig[] | undefined {
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
