import { Plugin } from "../../core/domain/plugin.js";

export function formatPlugin(plugin: Plugin): string {
  const capabilities = plugin.capabilities;
  if (!capabilities) {
    return `${plugin.name} (${plugin.language}/${plugin.framework})`;
  }

  return [
    `${plugin.name} (${plugin.language}/${plugin.framework})`,
    `  CRUD: ${yesNo(capabilities.crud)}`,
    `  ORM: ${formatList(capabilities.orm)}`,
    `  Auth: ${formatList(capabilities.auth)}`,
    `  Validation: ${Array.isArray(capabilities.validation) ? capabilities.validation.join(", ") : yesNo(capabilities.validation)}`,
    `  Schema upgrade: ${capabilities.schemaUpgrade === "partial" ? "partial" : yesNo(capabilities.schemaUpgrade)}`,
    `  Production ready: ${yesNo(capabilities.productionReady)}`
  ].join("\n");
}

function formatList(value: string[] | undefined): string {
  return value?.length ? value.join(", ") : "none";
}

function yesNo(value: unknown): string {
  return value ? "yes" : "no";
}
