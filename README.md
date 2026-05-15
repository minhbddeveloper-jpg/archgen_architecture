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
| TypeScript Express Prisma | Scaffold with schema/migration/seed files |
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

## Documentation

- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli-reference.md)
- [Supported Stacks](docs/supported-stacks.md)
- [SQL Import](docs/sql-import.md)
- [Schema Upgrade](docs/schema-upgrade.md)
- [Plugin Development](docs/plugin-development.md)
- [Production Readiness](docs/production-readiness.md)
- [Roadmap](docs/upgrade-roadmap.md)
