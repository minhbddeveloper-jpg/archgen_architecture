export type ArchitectureStyle = "clean" | "hexagonal" | "mvc";

export interface ProjectConfig {
  projectName: string;
  language: string;
  framework: string;
  architecture: ArchitectureStyle;
  database?: string;
  orm?: string;
  auth?: string;
}
