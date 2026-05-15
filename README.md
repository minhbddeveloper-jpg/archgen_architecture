# arxgen

arxgen is a CLI project generator for creating Clean Architecture-style starters across popular languages and frameworks.

It can generate:

- Frontend, backend, and fullstack project starters
- Entity, CRUD, repository, controller, route, DTO, validation, and use-case files
- Docker, Nginx, Redis, database, ORM, JWT auth, and relation scaffolding where supported
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
