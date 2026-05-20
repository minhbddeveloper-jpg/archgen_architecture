# Production Readiness

arxgen generates scaffolds. Some scaffolds are intentionally placeholders.

## Stable

- TypeScript Express CRUD generation
- TypeScript Express Prisma-backed CRUD repositories
- TypeScript NestJS build/e2e verified CRUD scaffold
- TypeScript NestJS Prisma repository scaffold
- TypeScript Express additive schema upgrade
- SQL import for common DDL
- Cross-stack CRUD file generation

## Scaffold

- JWT auth
- RBAC/permission middleware
- ORM artifacts outside TypeScript Express Prisma
- Docker/Nginx/Redis setup
- OpenAPI documents
- CI templates
- migration and seed files

Before production use, review:

- real database persistence for stacks other than TypeScript Express Prisma
- auth storage and refresh-token revocation
- production secrets
- authorization rules
- migrations
- integration tests
- rate limiting
