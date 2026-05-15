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

export type ValidationProvider = "zod" | "class-validator" | "joi";

export type RelationKind = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

export interface RelationConfig {
  source: string;
  target: string;
  kind: RelationKind;
}

export interface StackConfig {
  language: string;
  framework: string;
}

export interface FullstackConfig {
  frontend: StackConfig;
  backend: StackConfig;
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
  validation?: ValidationProvider;
  relations?: RelationConfig[];
  docker?: boolean;
  nginx?: boolean;
  redis?: boolean;
  fullstack?: FullstackConfig;
  entities?: EntityConfig[];
}
