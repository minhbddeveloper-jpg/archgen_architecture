import { StarterDefinition } from "./model.js";

export const starterDefinitions: StarterDefinition[] = [
  {
    name: "typescript-react",
    language: "typescript",
    framework: "react",
    templateDir: "typescript-react",
    files: [
      { template: "package.json.hbs", output: "{{projectSlug}}/package.json" },
      { template: "tsconfig.json.hbs", output: "{{projectSlug}}/tsconfig.json" },
      { template: "vite.config.ts.hbs", output: "{{projectSlug}}/vite.config.ts" },
      { template: "index.html.hbs", output: "{{projectSlug}}/index.html" },
      { template: "src/App.tsx.hbs", output: "{{projectSlug}}/src/App.tsx" },
      { template: "src/main.tsx.hbs", output: "{{projectSlug}}/src/main.tsx" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/src/app",
      "{{projectSlug}}/src/features",
      "{{projectSlug}}/src/components",
      "{{projectSlug}}/src/services",
      "{{projectSlug}}/src/hooks",
      "{{projectSlug}}/src/shared",
      "{{projectSlug}}/src/routes"
    ]
  },
  {
    name: "typescript-express",
    language: "typescript",
    framework: "express",
    templateDir: "typescript-express",
    files: [
      { template: "package.json.hbs", output: "{{projectSlug}}/package.json" },
      { template: "tsconfig.json.hbs", output: "{{projectSlug}}/tsconfig.json" },
      { template: "src/main.ts.hbs", output: "{{projectSlug}}/src/main.ts" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/src/domain/entities",
      "{{projectSlug}}/src/application/use-cases",
      "{{projectSlug}}/src/application/ports",
      "{{projectSlug}}/src/infrastructure/repositories",
      "{{projectSlug}}/src/presentation/controllers",
      "{{projectSlug}}/src/presentation/routes"
    ],
    capabilities: {
      entities: true,
      crud: true,
      dto: true,
      validation: true,
      pagination: true,
      auth: ["jwt"],
      orm: ["prisma"],
      relations: true,
      extendExistingProject: true,
      schemaUpgrade: true,
      productionReady: false
    },
    crudStyle: "typescript-express"
  },
  {
    name: "typescript-nestjs",
    language: "typescript",
    framework: "nestjs",
    templateDir: "typescript-nestjs",
    files: [
      { template: "package.json.hbs", output: "{{projectSlug}}/package.json" },
      { template: "tsconfig.json.hbs", output: "{{projectSlug}}/tsconfig.json" },
      { template: "src/main.ts.hbs", output: "{{projectSlug}}/src/main.ts" },
      { template: "src/app.module.ts.hbs", output: "{{projectSlug}}/src/app.module.ts" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/src/modules",
      "{{projectSlug}}/src/shared/config",
      "{{projectSlug}}/src/shared/auth"
    ],
    capabilities: {
      entities: true,
      crud: true,
      dto: true,
      validation: true,
      pagination: true,
      orm: ["prisma"],
      auth: ["jwt"],
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "typescript-nestjs"
  },
  {
    name: "python-fastapi",
    language: "python",
    framework: "fastapi",
    templateDir: "python-fastapi",
    files: [
      { template: "pyproject.toml.hbs", output: "{{projectSlug}}/pyproject.toml" },
      { template: "app/main.py.hbs", output: "{{projectSlug}}/app/main.py" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/app/domain/models",
      "{{projectSlug}}/app/application/services",
      "{{projectSlug}}/app/infrastructure/repositories",
      "{{projectSlug}}/app/presentation/routers"
    ],
    capabilities: {
      entities: true,
      crud: true,
      dto: true,
      validation: true,
      pagination: true,
      orm: ["sqlalchemy"],
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "python-fastapi"
  },
  {
    name: "python-django",
    language: "python",
    framework: "django",
    templateDir: "python-django",
    files: [
      { template: "requirements.txt.hbs", output: "{{projectSlug}}/requirements.txt" },
      { template: "manage.py.hbs", output: "{{projectSlug}}/manage.py" },
      { template: "config/settings.py.hbs", output: "{{projectSlug}}/config/settings.py" },
      { template: "config/urls.py.hbs", output: "{{projectSlug}}/config/urls.py" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/domain/models",
      "{{projectSlug}}/application/services",
      "{{projectSlug}}/infrastructure/repositories",
      "{{projectSlug}}/presentation/views"
    ],
    capabilities: {
      entities: true,
      crud: true,
      dto: true,
      validation: true,
      pagination: true,
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "python-django"
  },
  {
    name: "java-spring",
    language: "java",
    framework: "spring",
    templateDir: "java-spring",
    files: [
      { template: "pom.xml.hbs", output: "{{projectSlug}}/pom.xml" },
      { template: "Application.java.hbs", output: "{{projectSlug}}/src/main/java/{{packagePath}}/{{className}}Application.java" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/src/main/java/{{packagePath}}/domain/entities",
      "{{projectSlug}}/src/main/java/{{packagePath}}/application/services",
      "{{projectSlug}}/src/main/java/{{packagePath}}/infrastructure/repositories",
      "{{projectSlug}}/src/main/java/{{packagePath}}/presentation/controllers"
    ],
    capabilities: {
      entities: true,
      crud: true,
      orm: ["jpa"],
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "java-spring"
  },
  {
    name: "csharp-aspnetcore",
    language: "csharp",
    framework: "aspnetcore",
    templateDir: "csharp-aspnetcore",
    files: [
      { template: "Api.csproj.hbs", output: "{{projectSlug}}/{{className}}.Api.csproj" },
      { template: "Program.cs.hbs", output: "{{projectSlug}}/Program.cs" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/Domain/Entities",
      "{{projectSlug}}/Application/Services",
      "{{projectSlug}}/Infrastructure/Repositories",
      "{{projectSlug}}/Presentation/Controllers"
    ],
    capabilities: {
      entities: true,
      crud: true,
      orm: ["efcore"],
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "csharp-aspnetcore"
  },
  {
    name: "php-laravel",
    language: "php",
    framework: "laravel",
    templateDir: "php-laravel",
    files: [
      { template: "composer.json.hbs", output: "{{projectSlug}}/composer.json" },
      { template: "routes/api.php.hbs", output: "{{projectSlug}}/routes/api.php" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/app/Domain/Entities",
      "{{projectSlug}}/app/Application/Services",
      "{{projectSlug}}/app/Infrastructure/Repositories",
      "{{projectSlug}}/app/Http/Controllers"
    ],
    capabilities: {
      entities: true,
      crud: true,
      orm: ["eloquent"],
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "php-laravel"
  },
  {
    name: "go-gin",
    language: "go",
    framework: "gin",
    templateDir: "go-gin",
    files: [
      { template: "go.mod.hbs", output: "{{projectSlug}}/go.mod" },
      { template: "cmd/api/main.go.hbs", output: "{{projectSlug}}/cmd/api/main.go" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/internal/domain",
      "{{projectSlug}}/internal/usecase",
      "{{projectSlug}}/internal/repository",
      "{{projectSlug}}/internal/handler",
      "{{projectSlug}}/internal/server"
    ],
    capabilities: {
      entities: true,
      crud: true,
      orm: ["gorm"],
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "go-gin"
  },
  {
    name: "ruby-rails",
    language: "ruby",
    framework: "rails",
    templateDir: "ruby-rails",
    files: [
      { template: "Gemfile.hbs", output: "{{projectSlug}}/Gemfile" },
      { template: "config.ru.hbs", output: "{{projectSlug}}/config.ru" },
      { template: "config/routes.rb.hbs", output: "{{projectSlug}}/config/routes.rb" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/app/domain/entities",
      "{{projectSlug}}/app/application/services",
      "{{projectSlug}}/app/infrastructure/repositories",
      "{{projectSlug}}/app/controllers"
    ],
    capabilities: {
      entities: true,
      crud: true,
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "ruby-rails"
  },
  {
    name: "kotlin-ktor",
    language: "kotlin",
    framework: "ktor",
    templateDir: "kotlin-ktor",
    files: [
      { template: "settings.gradle.kts.hbs", output: "{{projectSlug}}/settings.gradle.kts" },
      { template: "build.gradle.kts.hbs", output: "{{projectSlug}}/build.gradle.kts" },
      { template: "src/main/kotlin/{{packagePath}}/Application.kt.hbs", output: "{{projectSlug}}/src/main/kotlin/{{packagePath}}/Application.kt" },
      { template: "README.md.hbs", output: "{{projectSlug}}/README.md" }
    ],
    keepDirs: [
      "{{projectSlug}}/src/main/kotlin/{{packagePath}}/domain/entities",
      "{{projectSlug}}/src/main/kotlin/{{packagePath}}/application/services",
      "{{projectSlug}}/src/main/kotlin/{{packagePath}}/infrastructure/repositories",
      "{{projectSlug}}/src/main/kotlin/{{packagePath}}/presentation/routes"
    ],
    capabilities: {
      entities: true,
      crud: true,
      schemaUpgrade: "partial",
      productionReady: false
    },
    crudStyle: "kotlin-ktor"
  }
];
