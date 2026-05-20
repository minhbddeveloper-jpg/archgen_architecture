# arxgen Roadmap Status

Current package version: `1.5.0`.

This file tracks the current product status. Release-specific notes live in `docs/releases/`.

## Stable

- TypeScript Express project generation.
- TypeScript Express CRUD generation.
- TypeScript Express `add entity`, `add crud`, and `add usecase`.
- TypeScript Express additive schema upgrade.
- TypeScript Express Prisma-backed CRUD repositories.
- SQL import for common `CREATE TABLE` DDL.
- Cross-stack CRUD scaffold generation.
- Plugin capability reporting through `arxgen list plugins`.
- Generated TypeScript Express README with install, dev, build, database, migration, API examples, and environment sections.
- `arxgen doctor` environment checks.
- Generated Express app e2e test.
- Generated Express + Prisma + PostgreSQL e2e test, available with `npm run test:e2e:postgres` when Docker is installed.

## Partial

- Schema upgrade for NestJS, FastAPI, Django, Spring Boot, ASP.NET Core, Laravel, Gin, Rails, and Ktor.
- ORM integration artifacts outside TypeScript Express Prisma.
- Docker, Nginx, Redis, CI, OpenAPI, migration, seed, logging, and exception scaffolds.

## Scaffold

- JWT auth and RBAC scaffolds.
- Production infrastructure files.
- Generated test placeholders.

## Version Rules

- Every package version update must include a markdown file in `docs/releases/`.
- README must distinguish stable behavior from scaffold or partial behavior.
- Generated project execution tests must exist for flagship stacks before they are described as production-ready.
