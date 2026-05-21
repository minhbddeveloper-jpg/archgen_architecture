# Production Readiness

arxgen generates scaffolds. Some scaffolds are intentionally placeholders.

## Stable

- TypeScript Express CRUD generation
- TypeScript Express Prisma-backed CRUD repositories
- TypeScript NestJS build/e2e verified CRUD scaffold
- TypeScript NestJS Prisma repository scaffold
- TypeScript Express additive schema upgrade
- TypeScript Express JWT auth production mode
- SQL import for common DDL
- Cross-stack CRUD file generation

## Scaffold

- ORM artifacts outside TypeScript Express Prisma
- Docker/Nginx/Redis setup
- OpenAPI documents
- CI templates
- migration and seed files

Before production use, review:

- real database persistence for stacks other than TypeScript Express Prisma
- production secrets
- authorization rules
- migrations
- integration tests
- rate limiting
