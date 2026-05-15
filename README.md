# arxgen

arxgen is a CLI project generator for creating Clean Architecture-style starters across popular languages and frameworks.

It can generate:

- Frontend, backend, and fullstack project starters
- Entity, CRUD, repository, controller, route, DTO, validation, and use-case files
- Entities and relations from an existing SQL schema file
- Environment config, logging, exception handling, OpenAPI, Docker, Nginx, Redis, database, ORM, JWT auth, RBAC/permission, migration, seeder, and CI scaffolding where supported
- Additional modules for an existing generated TypeScript Express project with `add` commands

## Installation

Requirements:

- Node.js `>=20`
- npm

Install globally:

```bash
npm install -g arxgen
```

Check the CLI:

```bash
arxgen doctor
arxgen list plugins
```

You can also run without installing globally:

```bash
npx arxgen@latest doctor
```

## Supported Stacks

| Language | Framework | Plugin |
| --- | --- | --- |
| TypeScript | React | `typescript-react` |
| TypeScript | Express | `typescript-express` |
| TypeScript | NestJS | `typescript-nestjs` |
| Python | FastAPI | `python-fastapi` |
| Python | Django | `python-django` |
| Java | Spring Boot | `java-spring` |
| C# | ASP.NET Core | `csharp-aspnetcore` |
| PHP | Laravel | `php-laravel` |
| Go | Gin | `go-gin` |
| Ruby | Rails | `ruby-rails` |
| Kotlin | Ktor | `kotlin-ktor` |

## Quick Start

Generate a TypeScript Express CRUD API:

```bash
arxgen create \
  --name student-api \
  --language typescript \
  --framework express \
  --entity student \
  --field name:string \
  --field email:string \
  --out ./generated
```

Run the generated project:

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

## Common Commands

Generate a React app:

```bash
arxgen create --name web-app --language typescript --framework react --out ./generated
```

Generate a NestJS API:

```bash
arxgen create \
  --name nest-school \
  --language typescript \
  --framework nestjs \
  --entity student \
  --field name:string \
  --out ./generated
```

Generate a C# ASP.NET Core API:

```bash
arxgen create \
  --name dotnet-api \
  --language csharp \
  --framework aspnetcore \
  --entity student \
  --field name:string \
  --field email:string \
  --out ./generated
```

Generate a fullstack React + Express project:

```bash
arxgen create \
  --name full-app \
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

Generate an Express API with Prisma, validation, JWT auth, and relations:

```bash
arxgen create \
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

This also generates production scaffolding for environment config, structured logging, exception handling, OpenAPI JSON, role/permission middleware, query helpers, Prisma migration/seed placeholders, unit/integration test placeholders, and a GitHub Actions CI workflow.

Generate entities from an existing SQL schema file:

```bash
arxgen create \
  --name school-api \
  --language typescript \
  --framework express \
  --database postgres \
  --orm prisma \
  --from-sql ./schema.sql \
  --out ./generated
```

Supported SQL import scope:

- `CREATE TABLE`
- Common SQL column types such as `varchar`, `text`, `int`, `decimal`, `boolean`, `uuid`, `date`, and `timestamp`
- `NOT NULL` detection for required fields
- Primary key `id` detection so generated entities do not duplicate the default `id`
- Foreign keys mapped to `many-to-one` relations

## Production Scaffold Coverage

| Capability | TypeScript Express | TypeScript NestJS |
| --- | --- | --- |
| Clean Architecture layout | Yes | Yes |
| DTO | Yes | Yes |
| Validation | Zod/Joi/class-validator scaffold | class-validator |
| Pagination | Yes | Yes |
| Filter/search/sort | Query helper | Query DTO scaffold |
| CRUD generator | Yes | Yes |
| Auth JWT | Yes | Guard scaffold |
| Role/permission | Middleware | Decorators and guard |
| Swagger/OpenAPI | OpenAPI JSON route | Swagger module/decorators |
| Environment config | Yes | Yes |
| Docker | Yes with `--docker` | Yes with `--docker` |
| CI/CD template | Yes | Yes |
| Logging | Structured logger | Logger service |
| Exception handling | Error middleware | Exception filter |
| Database migration | Prisma placeholder | Prisma placeholder when selected |
| Seeder | Prisma seed placeholder | Prisma seed placeholder when selected |
| Unit test | Placeholder | Placeholder |
| Integration/e2e test | Placeholder | Placeholder |

## Backend CRUD Coverage

When `--entity` or `--from-sql` is provided, arxgen generates CRUD layers for every supported backend stack.

| Stack | Generated CRUD layers |
| --- | --- |
| TypeScript Express | Entity, DTO, port, use cases, repository, controller, route |
| TypeScript NestJS | Module, domain model, DTO, repository provider, service, controller |
| Python FastAPI | Pydantic models, service, repository, router |
| Python Django | Domain model, serializer, service, repository, views, URLs |
| Java Spring Boot | Entity, service, repository, REST controller |
| C# ASP.NET Core | Entity, service, repository, controller, minimal API routes |
| PHP Laravel | Entity, service, repository, controller, API routes |
| Go Gin | Domain model, use case, repository, handler, registered routes |
| Ruby Rails | Entity, service object, repository, controller, resource routes |
| Kotlin Ktor | Entity, service, repository, route registration |

Use the interactive wizard:

```bash
arxgen wizard
```

## Extend an Existing Project

`add` commands currently support generated TypeScript Express projects.

```bash
cd generated/student-api

arxgen add entity course \
  --field title:string \
  --field credits:number \
  --merge

arxgen add crud teacher \
  --field name:string \
  --field email:string \
  --validation zod \
  --merge

arxgen add usecase CreateEnrollment
```

Add entities from a SQL schema file to an existing generated Express project:

```bash
arxgen add schema \
  --from-sql ./schema.sql \
  --project ./generated/student-api \
  --validation zod
```

Upgrade an existing generated Express project after the SQL schema changes:

```bash
arxgen upgrade schema \
  --from-sql ./schema.sql \
  --project ./generated/student-api \
  --dry-run
```

When the preview looks correct, run it without `--dry-run`:

```bash
arxgen upgrade schema \
  --from-sql ./schema.sql \
  --project ./generated/student-api
```

Schema upgrade currently performs safe additive changes for generated backend projects:

- Detects new fields from the SQL schema
- Patches backend entity/model files for Express, NestJS, FastAPI, Django, Spring Boot, ASP.NET Core, Laravel, Gin, Rails, and Ktor
- For TypeScript Express, also patches Zod/Joi/class-validator validation schemas when present
- For TypeScript Express, also patches create use cases so new fields are copied from input
- For TypeScript Express, also patches Prisma models when `prisma/schema.prisma` exists
- For TypeScript Express, creates new entities if the SQL schema contains new tables
- Does not delete or rename existing fields automatically

Useful flags:

| Flag | Description |
| --- | --- |
| `--project <dir>` | Existing project root. Defaults to current directory. |
| `--merge` | Updates integration points such as route registration. |
| `--force` | Allows overwriting existing generated files. |
| `--dry-run` | Shows what would be generated without writing files. |

## CLI Options

| Option | Description |
| --- | --- |
| `--name <name>` | Project name. |
| `--language <language>` | Target language, for example `typescript`, `python`, `java`, `csharp`, `go`. |
| `--framework <framework>` | Target framework, for example `express`, `nestjs`, `fastapi`, `spring`, `aspnetcore`. |
| `--frontend <stack>` | Fullstack frontend alias. Current value: `react`. |
| `--backend <stack>` | Fullstack backend alias, for example `express`, `fastapi`, `spring`, `aspnetcore`. |
| `--entity <name>` | Adds a CRUD entity. Can be repeated. |
| `--field <spec>` | Adds an entity field. Can be repeated. |
| `--from-sql <file>` | Imports entities and relations from a SQL schema file. |
| `--database <type>` | Adds database setup. Supported setup values: `postgres`, `mysql`, `mongodb`. |
| `--orm <orm>` | Generates ORM artifacts when supported. |
| `--validation <provider>` | Generates validation artifacts. Values: `zod`, `class-validator`, `joi`. |
| `--auth <provider>` | Generates auth artifacts where supported. Current value: `jwt`. |
| `--relation <spec>` | Adds relation metadata, for example `course.student:many-to-one`. |
| `--redis` | Adds Redis setup. |
| `--docker` | Adds Dockerfile and Docker Compose setup. |
| `--nginx` | Adds Nginx reverse proxy setup. |
| `--languageVersion <version>` | Overrides language/runtime/compiler version. |
| `--frameworkVersion <version>` | Overrides framework version. |
| `--config <file>` | Reads options from a JSON config file. |
| `--out <dir>` | Output directory. Defaults to current directory. |
| `--dry-run` | Validates generation without writing files. |
| `--force` | Allows overwriting existing files. |

Release note rule:

- Every version update must include a markdown file under `docs/releases/`.

Field syntax:

```text
--field fieldName:type
--field fieldName:type?
--field fieldName:type:optional
--field entityName.fieldName:type
```

Supported field types:

```text
string, text, number, boolean, date, uuid
```

## ORM Support

| Language | Framework | ORM value | Generated artifacts |
| --- | --- | --- | --- |
| TypeScript | Express | `prisma` | `prisma/schema.prisma` |
| Python | FastAPI | `sqlalchemy` | SQLAlchemy database and model files |
| C# | ASP.NET Core | `efcore` | EF Core `AppDbContext` |
| Java | Spring Boot | `jpa` | Spring Data JPA repository interfaces |
| Go | Gin | `gorm` | GORM database helper and model files |
| PHP | Laravel | `eloquent` | Eloquent models and migration files |

## Config File

You can use a JSON config for repeatable project generation.

```json
{
  "name": "student-api",
  "language": "typescript",
  "framework": "express",
  "architecture": "clean",
  "out": "./generated",
  "database": "postgres",
  "orm": "prisma",
  "entities": [
    {
      "name": "student",
      "fields": [
        { "name": "name", "type": "string" },
        { "name": "email", "type": "string" },
        { "name": "age", "type": "number", "required": false }
      ]
    }
  ]
}
```

Run:

```bash
arxgen create --config ./arxgen.json
```

## Local Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run from source:

```bash
npm run dev -- create --name student-api --language typescript --framework express --out ./generated
```

## More Docs

- [Standard Architecture Design](docs/standard-architecture-design.md)
- [Upgrade Roadmap](docs/upgrade-roadmap.md)
