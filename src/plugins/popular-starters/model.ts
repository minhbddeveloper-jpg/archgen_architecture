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
  capabilities?: {
    entities?: boolean;
    crud?: boolean;
    dto?: boolean;
    validation?: boolean;
    pagination?: boolean;
    auth?: string[];
    orm?: string[];
    relations?: boolean;
    extendExistingProject?: boolean;
  };
  crudStyle?: CrudStyle;
}

export type CrudStyle =
  | "typescript-express"
  | "typescript-nestjs"
  | "python-fastapi"
  | "python-django"
  | "java-spring"
  | "csharp-aspnetcore"
  | "php-laravel"
  | "go-gin"
  | "ruby-rails"
  | "kotlin-ktor";
