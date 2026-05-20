# arxgen

arxgen is a CLI generator for Clean Architecture-style project starters and schema-driven CRUD scaffolding.

It is strongest today for TypeScript Express, with growing support for NestJS and other backend stacks.

## Install

```bash
npm install -g arxgen
```

```bash
arxgen doctor
arxgen list plugins
```

## Quick Start

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

```bash
cd generated/student-api
npm install
npm run dev
```

## SQL First

Generate from an existing SQL schema:

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

Upgrade an existing generated project after schema changes:

```bash
arxgen upgrade schema \
  --from-sql ./schema.sql \
  --project ./generated/school-api \
  --dry-run
```

Remove `--dry-run` to apply the additive upgrade.

## Support Status

| Area | Status |
| --- | --- |
| TypeScript Express CRUD | Stable |
| TypeScript Express `add entity` | Stable |
| TypeScript Express schema upgrade | Stable for additive changes |
| TypeScript Express JWT auth | Scaffold, not production auth |
| TypeScript Express Prisma | Database-backed CRUD repositories with schema/migration/seed files |
| NestJS CRUD | Stable scaffold |
| NestJS schema upgrade | Partial additive support |
| Other backend CRUD stacks | Stable scaffold |
| Other backend schema upgrade | Partial additive model/entity support |
| Docker, Nginx, Redis, CI, logging, OpenAPI | Scaffold |

arxgen is explicit about generated scaffold versus production-ready implementation. Generated projects are intended as a strong starting point, not a replacement for security review, production database design, or framework-specific hardening.

## Supported Stacks

- TypeScript Express
- TypeScript NestJS
- TypeScript React
- Python FastAPI
- Python Django
- Java Spring Boot
- C# ASP.NET Core
- PHP Laravel
- Go Gin
- Ruby Rails
- Kotlin Ktor

## Stack Support Matrix

arxgen supports multiple stacks, but not every stack has the same production confidence level yet.

Status meaning:

- **Stable**: generated project is expected to build/run and has automated tests.
- **Beta**: core scaffolding works, but some advanced features are still partial.
- **Experimental**: basic scaffold exists, but generated output needs more validation before production use.
- **Planned**: not fully implemented yet.

| Stack | Create Project | CRUD | ORM / DB | Add Entity | SQL Import | Schema Upgrade | Generated App Test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TypeScript Express | Yes | Yes | Prisma-backed | Yes | Yes | Yes | Yes | Stable |
| TypeScript NestJS | Yes | Yes | Partial | Partial | Partial | Partial | Planned | Beta |
| TypeScript React | Yes | Partial | N/A | N/A | N/A | N/A | Planned | Beta |
| Python FastAPI | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| Python Django | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| Java Spring Boot | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| C# ASP.NET Core | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| Go Gin | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| PHP Laravel | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| Ruby Rails | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |
| Kotlin Ktor | Yes | Partial | Partial | Planned | Partial | Planned | Planned | Experimental |

### Recommended Production Path

For production-oriented usage, start with:

1. **TypeScript Express** - strongest current support.
2. **TypeScript NestJS** - recommended for structured backend projects, currently in beta.
3. **TypeScript React** - useful for frontend/fullstack scaffolding.

Other stacks are available as scaffolding targets, but should be treated as experimental until they have generated-app build/e2e validation.

### Promotion Rules

A stack can move from **Experimental** to **Beta** when:

- base project generation works;
- CRUD layers are generated consistently;
- DTO/request/response files are generated;
- validation files are generated;
- ORM/database artifacts are generated;
- snapshot tests exist.

A stack can move from **Beta** to **Stable** when:

- generated project builds successfully in CI;
- generated project can start successfully;
- generated CRUD endpoints are tested through HTTP/e2e tests;
- `add entity` does not break existing project structure;
- SQL import is validated for common table/foreign-key cases;
- schema upgrade has at least additive-change support;
- generated README includes stack-specific run commands.

## Useful Commands

```bash
arxgen create --preset saas --name my-api --entity student --field name:string
arxgen add entity course --field title:string --project ./generated/student-api --merge
arxgen add schema --from-sql ./schema.sql --project ./generated/student-api
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/student-api --dry-run
arxgen wizard
arxgen list plugins
```

## Development

```bash
npm install
npm run typecheck
npm test
```

Generated Express app execution test:

```bash
npm run test:e2e
```

This test generates an Express project, installs dependencies, builds it, starts the server, and calls CRUD endpoints.

Generated Express + Prisma + PostgreSQL execution test:

```bash
npm run test:e2e:postgres
```

This test requires Docker. It generates an Express Prisma project, starts PostgreSQL with Docker Compose, runs Prisma migration, builds the app, starts the server, and calls CRUD endpoints.

## Documentation

- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli-reference.md)
- [Supported Stacks](docs/supported-stacks.md)
- [SQL Import](docs/sql-import.md)
- [Schema Upgrade](docs/schema-upgrade.md)
- [Plugin Development](docs/plugin-development.md)
- [Production Readiness](docs/production-readiness.md)
- [Roadmap](docs/roadmap.md)
