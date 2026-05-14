export type ArchitectureStyle = "clean" | "hexagonal" | "mvc";

export type FieldType = "string" | "number" | "boolean" | "date" | "uuid" | "text";

export interface EntityFieldConfig {
  name: string;
  type: FieldType;
  required?: boolean;
}

export interface EntityConfig {
  name: string;
  fields: EntityFieldConfig[];
}

export interface ProjectConfig {
  projectName: string;
  language: string;
  framework: string;
  architecture: ArchitectureStyle;
  languageVersion?: string;
  frameworkVersion?: string;
  packageVersions?: Record<string, string>;
  database?: string;
  orm?: string;
  auth?: string;
  entities?: EntityConfig[];
}
