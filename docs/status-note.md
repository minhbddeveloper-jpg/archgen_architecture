# arxgen Roadmap Status

Current package version: `1.4.0`.

This file tracks the current product status. Release-specific notes live in `docs/releases/`.

## Stable

- TypeScript Express project generation.
- TypeScript Express CRUD generation.
- TypeScript Express `add entity`, `add crud`, and `add usecase`.
- TypeScript Express additive schema upgrade.
- SQL import for common `CREATE TABLE` DDL.
- Cross-stack CRUD scaffold generation.
- Plugin capability reporting through `arxgen list plugins`.

## Partial

- Schema upgrade for NestJS, FastAPI, Django, Spring Boot, ASP.NET Core, Laravel, Gin, Rails, and Ktor.
- ORM integration artifacts.
- Docker, Nginx, Redis, CI, OpenAPI, migration, seed, logging, and exception scaffolds.

## Scaffold

- JWT auth and RBAC scaffolds.
- Production infrastructure files.
- Generated test placeholders.

## Version Rules

- Every package version update must include a markdown file in `docs/releases/`.
- README must distinguish stable behavior from scaffold or partial behavior.
- Generated project execution tests must exist for flagship stacks before they are described as production-ready.
