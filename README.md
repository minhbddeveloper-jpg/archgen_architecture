# ArchGen

ArchGen is a TypeScript CLI generator for creating project starters across multiple languages, frameworks, and Clean Architecture-style layouts.

The project aims to:

- Generate starter projects for popular technology stacks.
- Let users choose the language, framework, versions, and output directory.
- Support JSON configuration for entities, fields, and basic CRUD generation.
- Keep generated code organized around `domain`, `application`, `infrastructure`, and `presentation` layers.

CRUD generation currently uses in-memory repositories. This provides a practical foundation for later database/ORM support such as Prisma, Spring Data JPA, EF Core, Django ORM, or Laravel Eloquent.

For the recommended architecture of each plugin, see [Standard Architecture Design](docs/standard-architecture-design.md).

For the long-term direction, see [Upgrade Roadmap](docs/upgrade-roadmap.md).

## Supported Platforms

| Language | Framework | Plugin | Notes |
| --- | --- | --- | --- |
| TypeScript | React | `typescript-react` | Frontend app with Vite |
| TypeScript | Express | `typescript-express` | Backend API with CRUD routes |
| TypeScript | NestJS | `typescript-nestjs` | NestJS API with module, Swagger, validation pipe, and Clean Architecture folders |
| Python | FastAPI | `python-fastapi` | Backend API with CRUD routes |
| Python | Django | `python-django` | Django starter |
| Java | Spring Boot | `java-spring` | Backend API with CRUD controllers |
| C# | ASP.NET Core | `csharp-aspnetcore` | Backend API starter |
| PHP | Laravel | `php-laravel` | Laravel starter |
| Go | Gin | `go-gin` | Backend API starter |
| Ruby | Rails | `ruby-rails` | Rails starter |
| Kotlin | Ktor | `kotlin-ktor` | Backend API starter |

## Usage

Requirements:

- Node.js `>=20`
- npm

Install from npm:

```bash
npm install -g arxgen
arxgen doctor
```

Install dependencies:

```bash
npm install
```

Build the CLI:

```bash
npm run build
```

Check the CLI:

```bash
npm start -- doctor
npm start -- list plugins
```

## Generate Projects

Generate a starter project without entities:

```bash
npm start -- create --name student-api --language java --framework spring --architecture clean --out ./generated
```

This creates the base project structure only. CRUD files are generated only when you provide entities.

Generate a project with CRUD entities directly from CLI options:

```bash
npm start -- create \
  --name student-api \
  --language typescript \
  --framework express \
  --entity student \
  --field student.name:string \
  --field student.email:string \
  --field student.age:number? \
  --out ./generated
```

Generate a production-oriented TypeScript Express API with DTOs, validation, pagination helpers, JWT auth, Prisma, and relations:

```bash
npm start -- create \
  --name course-api \
  --language typescript \
  --framework express \
  --entity student \
  --entity course \
  --field student.name:string \
  --field course.title:string \
  --database postgres \
  --orm prisma \
  --relation course.student:many-to-one \
  --validation zod \
  --auth jwt \
  --out ./generated
```

Generate a NestJS API:

```bash
npm start -- create \
  --name nest-school \
  --language typescript \
  --framework nestjs \
  --entity student \
  --field name:string \
  --out ./generated
```

Extend an existing generated TypeScript Express project:

```bash
cd generated/student-api
arxgen add entity course --field title:string --field credits:number --merge
arxgen add crud teacher --field name:string --field email:string --validation zod --merge
arxgen add usecase CreateEnrollment
```

Use the interactive wizard:

```bash
arxgen wizard
```

When only one entity is declared, fields can omit the entity prefix:

```bash
npm start -- create --name dotnet-api --language csharp --framework aspnetcore --entity student --field name:string --field email:string --out ./generated
```

Generate with explicit language and framework versions:

```bash
npm start -- create \
  --name dotnet-api \
  --language csharp \
  --framework aspnetcore \
  --languageVersion 8.0 \
  --frameworkVersion 8.0 \
  --out ./generated
```

Generate with multiple entities:

```bash
npm start -- create \
  --name school-api \
  --language typescript \
  --framework express \
  --entity student \
  --entity course \
  --field student.name:string \
  --field student.email:string \
  --field course.title:string \
  --field course.credits:number \
  --out ./generated
```

Generate backend infrastructure setup:

```bash
npm start -- create \
  --name api-test \
  --language typescript \
  --framework express \
  --entity student \
  --field name:string \
  --database postgres \
  --redis \
  --docker \
  --nginx \
  --out ./generated
```

Generate ORM models/repositories/migrations:

```bash
npm start -- create \
  --name student-api \
  --language typescript \
  --framework express \
  --entity student \
  --field name:string \
  --field email:string \
  --database postgres \
  --orm prisma \
  --out ./generated
```

Generate a fullstack project with frontend, backend, Docker, Nginx, Redis, and database services:

```bash
npm start -- create \
  --name full-test \
  --frontend react \
  --backend express \
  --entity student \
  --field name:string \
  --database postgres \
  --redis \
  --docker \
  --nginx \
  --out ./generated
```

Generate a React project:

```bash
npm start -- create --name web-app --language typescript --framework react --out ./generated
```

Generate a FastAPI project:

```bash
npm start -- create --name api --language python --framework fastapi --out ./generated
```

Generate a project from a config file:

```bash
npm start -- create --config ./examples/archgen.sample.json
```

Use config files for repeatable specs, dependency overrides, and larger domain models.

Override the output directory from the CLI:

```bash
npm start -- create --config ./examples/archgen.sample.json --out ./generated/custom
```

Preview generated files without writing them:

```bash
npm start -- create --config ./examples/archgen.sample.json --dry-run
```

Overwrite existing generated files:

```bash
npm start -- create --config ./examples/archgen.sample.json --force
```

Output directory rules:

- `--out` sets the output directory from the CLI.
- `out` or `outputDir` sets the output directory from the JSON config file.
- If both config and CLI provide an output directory, CLI `--out` takes precedence.
- Existing files are protected by default. Use `--force` to overwrite them.
- `--dry-run` validates generation and reports the file count without creating directories or files.

## CLI Options

| Option | Required | Description |
| --- | --- | --- |
| `--name <name>` | Yes, unless config provides `name` | Project name. Also used to derive folder names and class/module names. |
| `--language <language>` | Yes, unless config provides `language` | Target language, for example `typescript`, `python`, `java`, `csharp`, `go`. |
| `--framework <framework>` | Yes, unless config provides `framework` | Target framework, for example `express`, `fastapi`, `spring`, `aspnetcore`. |
| `--architecture <style>` | No | Architecture style. Defaults to `clean`. Supported: `clean`, `hexagonal`, `mvc`. |
| `--entity <name>` | No | Adds a CRUD entity. Can be repeated. |
| `--field <spec>` | No | Adds a field to an entity. Can be repeated. |
| `--frontend <stack>` | No | Creates a fullstack project frontend. Current alias: `react`. |
| `--backend <stack>` | No | Creates a fullstack project backend. Supported aliases include `express`, `fastapi`, `django`, `spring`, `aspnetcore`, `laravel`, `gin`, `rails`, `ktor`. |
| `--database <type>` | No | Adds database service setup. Common values: `postgres`, `mysql`, `mongodb`. |
| `--orm <orm>` | No | Generates ORM artifacts when supported by the selected stack. |
| `--validation <provider>` | No | Generates validation artifacts for supported stacks. Values: `zod`, `class-validator`, `joi`. |
| `--auth <provider>` | No | Generates auth artifacts where supported. Current value: `jwt` for TypeScript Express. |
| `--relation <spec>` | No | Adds ORM relation metadata. Current Prisma example: `course.student:many-to-one`. Can be repeated. |
| `--redis` | No | Adds Redis service setup and `REDIS_URL`. |
| `--docker` | No | Adds Dockerfile and Docker Compose setup. |
| `--nginx` | No | Adds Nginx reverse proxy config. |
| `--languageVersion <version>` | No | Overrides the language/runtime/compiler version used by templates. |
| `--frameworkVersion <version>` | No | Overrides the primary framework version used by templates. |
| `--config <file>` | No | Reads project settings from a JSON config file. |
| `--out <dir>` | No | Output directory. Overrides `out` or `outputDir` from config. |
| `--dry-run` | No | Validates and reports generated file count without writing files. |
| `--force` | No | Allows overwriting existing files. |

## Add Commands

`add` commands extend an existing generated project. The current implementation supports TypeScript Express projects.

```bash
arxgen add entity student --field name:string --field email:string --merge
arxgen add crud course --field title:string --validation zod --merge
arxgen add usecase CreateEnrollment
```

Useful flags:

| Option | Description |
| --- | --- |
| `--project <dir>` | Existing project root. Defaults to the current directory. |
| `--merge` | Updates integration points such as `src/main.ts` route registration. |
| `--force` | Allows overwriting generated files. |
| `--dry-run` | Reports what would be generated without writing files. |

Field syntax:

```text
--field entityName.fieldName:type
--field fieldName:type
--field fieldName:type?
--field fieldName:type:optional
```

Use `fieldName:type` only when one entity is declared. Use `entityName.fieldName:type` when multiple entities are declared.

## Project Configuration

ArchGen supports JSON configuration for project metadata, framework versions, output location, and CRUD entities.

You can configure CRUD through CLI flags or JSON. Use JSON for repeatable project specs and CLI flags for quick generation.

Example `archgen.json`:

```json
{
  "name": "student-api",
  "language": "typescript",
  "framework": "express",
  "architecture": "clean",
  "languageVersion": "5.4.2",
  "frameworkVersion": "4.18.3",
  "out": "./generated",
  "packageVersions": {
    "nodeTypesVersion": "20.11.30",
    "tsxVersion": "4.7.1"
  },
  "entities": [
    {
      "name": "student",
      "fields": [
        { "name": "name", "type": "string" },
        { "name": "email", "type": "string" },
        { "name": "age", "type": "number", "required": false },
        { "name": "active", "type": "boolean" }
      ]
    }
  ]
}
```

Run:

```bash
npm start -- create --config ./archgen.json
```

Supported field types:

| Type | Meaning |
| --- | --- |
| `string` | Short string |
| `text` | Long string |
| `number` | Numeric value |
| `boolean` | True/false value |
| `date` | Date/time value |
| `uuid` | UUID identifier |

Version fields:

| Field | Meaning |
| --- | --- |
| `languageVersion` | Language, runtime, compiler, or platform version, such as TypeScript, Python, Java, Go, Ruby, PHP, Kotlin, or .NET |
| `frameworkVersion` | Main framework version, such as React, Express, FastAPI, Django, Spring Boot, ASP.NET Core, Laravel, Gin, Rails, or Ktor |
| `packageVersions` | Optional dependency overrides used by templates, such as `viteVersion`, `uvicornVersion`, `nodeTypesVersion`, or `pumaVersion` |

Setup fields:

| Field | Meaning |
| --- | --- |
| `database` | Adds a database service and `DATABASE_URL`. Supported setup values: `postgres`, `mysql`, `mongodb`. |
| `orm` | Generates ORM models/repositories/migrations when supported. |
| `redis` | Adds Redis service and `REDIS_URL`. |
| `docker` | Adds Dockerfile and `docker-compose.yml`. |
| `nginx` | Adds `nginx/default.conf` and Nginx service in Docker Compose. |
| `fullstack` | Generates a frontend and backend together under one root project. |

Example with dependency overrides:

```json
{
  "name": "web-app",
  "language": "typescript",
  "framework": "react",
  "languageVersion": "5.4.2",
  "frameworkVersion": "18.2.0",
  "packageVersions": {
    "viteVersion": "5.2.0",
    "viteReactPluginVersion": "4.2.1",
    "reactDomVersion": "18.2.0"
  }
}
```

## Common Examples

TypeScript Express CRUD API:

```bash
npm start -- create --name student-api --language typescript --framework express --entity student --field name:string --field email:string --out ./generated
```

C# ASP.NET Core starter without CRUD:

```bash
npm start -- create --name dotnet-api --language csharp --framework aspnetcore --out ./generated
```

C# ASP.NET Core CRUD API:

```bash
npm start -- create --name dotnet-api --language csharp --framework aspnetcore --entity student --field name:string --field email:string --out ./generated
```

Go Gin CRUD API:

```bash
npm start -- create --name go-api --language go --framework gin --entity student --field name:string --field age:number? --out ./generated
```

React app with explicit versions:

```bash
npm start -- create --name web-app --language typescript --framework react --languageVersion 5.4.2 --frameworkVersion 18.2.0 --out ./generated
```

Fullstack React + Express with Postgres, Redis, Docker, and Nginx:

```bash
npm start -- create --name full-test --frontend react --backend express --entity student --field name:string --database postgres --redis --docker --nginx --out ./generated
```

Generated setup files include:

```text
full-test/
  .env.example
  docker-compose.yml
  nginx/
    default.conf
  web/
    Dockerfile
  api/
    Dockerfile
```

The generated Docker Compose setup provides service wiring and environment variables. Database/Redis application code integration is intentionally left to framework-specific ORM templates such as Prisma, SQLAlchemy, Spring Data JPA, EF Core, Eloquent, or GORM.

## ORM Support

| Language | Framework | ORM value | Generated artifacts |
| --- | --- | --- | --- |
| TypeScript | Express | `prisma` | `prisma/schema.prisma` |
| Python | FastAPI | `sqlalchemy` | SQLAlchemy base/session and model files |
| C# | ASP.NET Core | `efcore` | EF Core `AppDbContext` |
| Java | Spring Boot | `jpa` | Spring Data JPA repository interfaces |
| Go | Gin | `gorm` | GORM database helper and model files |
| PHP | Laravel | `eloquent` | Eloquent models and migration files |

Example commands:

```bash
npm start -- create --name api --language python --framework fastapi --entity student --field name:string --database postgres --orm sqlalchemy --out ./generated
npm start -- create --name api --language csharp --framework aspnetcore --entity student --field name:string --database postgres --orm efcore --out ./generated
npm start -- create --name api --language go --framework gin --entity student --field name:string --database postgres --orm gorm --out ./generated
```

## Visual Example

Input config:

```json
{
  "name": "student-api",
  "language": "typescript",
  "framework": "express",
  "out": "./generated",
  "entities": [
    {
      "name": "student",
      "fields": [
        { "name": "name", "type": "string" },
        { "name": "email", "type": "string" }
      ]
    }
  ]
}
```

Command:

```bash
npm start -- create --config ./archgen.json
```

Generated output:

```text
generated/
  student-api/
    package.json
    tsconfig.json
    README.md
    src/
      main.ts
      domain/
        entities/
          Student.ts
      application/
        ports/
          studentRepositoryPort.ts
        use-cases/
          listStudentsUseCase.ts
          getStudentUseCase.ts
          createStudentUseCase.ts
          updateStudentUseCase.ts
          deleteStudentUseCase.ts
      infrastructure/
        repositories/
          studentRepository.ts
      presentation/
        controllers/
          studentController.ts
        routes/
          studentRoutes.ts
```

Run the generated TypeScript Express project:

```bash
cd generated/student-api
npm install
npm run dev
```

Generated endpoints:

```text
GET    /health
GET    /students
GET    /students/:id
POST   /students
PUT    /students/:id
DELETE /students/:id
```

Example request:

```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Jane Doe\",\"email\":\"jane@example.com\"}"
```

## Development Commands

Run the TypeScript source directly:

```bash
npm run dev -- create --name student-api --language java --framework spring --architecture clean
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

## Folder Structure

```text
bin/
src/
  cli/
  core/
    domain/
    application/
    infrastructure/
  plugins/
  shared/
templates/
examples/
tests/
```
