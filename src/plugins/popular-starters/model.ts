export interface TemplateFile {
  template: string;
  output: string;
}

export interface StarterDefinition {
  name: string;
  language: string;
  framework: string;
  templateDir: string;
  files: TemplateFile[];
  keepDirs: string[];
  crudStyle?: CrudStyle;
}

export type CrudStyle =
  | "typescript-express"
  | "python-fastapi"
  | "python-django"
  | "java-spring"
  | "csharp-aspnetcore"
  | "php-laravel"
  | "go-gin"
  | "ruby-rails"
  | "kotlin-ktor";
