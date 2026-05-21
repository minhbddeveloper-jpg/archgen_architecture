import { ProjectExtender } from "../../core/application/projectExtender.js";

export function formatSchemaUpgradeResult(sqlPath: string, result: Awaited<ReturnType<ProjectExtender["upgradeSchema"]>>): string {
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
      for (const field of change.removedFields) {
        lines.push(`  - ${field.name}:${field.type}${field.required === false ? "?" : ""}`);
      }
      for (const field of change.typeChanges) {
        lines.push(`  ~ ${field.name}: type ${field.from} -> ${field.to}`);
      }
      for (const field of change.nullableChanges) {
        lines.push(`  ~ ${field.name}: nullable ${field.from} -> ${field.to}`);
      }
      for (const field of change.defaultChanges) {
        lines.push(`  ~ ${field.name}: default ${field.from} -> ${field.to}`);
      }
    }
  }

  if (result.warnings.length) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  ${warning.destructive ? "!" : "-"} ${warning.entity}${warning.field ? `.${warning.field}` : ""}: ${warning.message}`);
    }
  }

  if (result.updatedFiles.length) {
    lines.push(`Updated files: ${result.updatedFiles.join(", ")}`);
  }

  return lines.join("\n");
}
