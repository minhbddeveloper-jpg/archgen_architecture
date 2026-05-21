# Changelog

## 1.9.0

- Added `--auth-mode production` for generated TypeScript Express JWT auth.
- Added production auth config that requires `JWT_SECRET`.
- Added refresh-token hash storage, rotation, revoke, refresh, and logout support.
- Added generated RBAC repository contracts and Prisma auth models for users, refresh tokens, roles, permissions, user roles, and role permissions.
- Added production auth test coverage.

## 1.8.0

- Refactored CLI command routing into command, parser, and formatter modules.
- Added generation pipeline dependency ordering, duplicate detection, unknown feature validation, circular dependency detection, and capability checks.
- Extracted generated project detection from `ProjectExtender` into a dedicated project detector module.
- Added focused generation pipeline tests.

## 1.7.0

- Added v1.7 schema upgrade warnings for removed fields, type changes, nullability changes, and default changes.
- Added `--force` safety behavior for risky schema upgrades.
- Improved SQL parsing for indexes, unique indexes, enum fields, composite primary keys, and many-to-many join tables.
- Added tests for v1.7 SQL metadata parsing and risky schema upgrade previews.

## 1.6.1

- Added security policy, Dependabot, CI build step, issue templates, PR template, contributing guide, code of conduct, and npm metadata.
- Added README badges and package documentation links.
- Prepared package metadata for public npm release.

## 1.6.0

- Added generated NestJS health endpoint.
- Added generated NestJS e2e coverage through `npm run test:e2e:nestjs`.
- Added NestJS Prisma repository generation.
- Added NestJS `add entity` support.
- Improved docs, release notes, and package metadata.

## 1.5.1

- Completed v1.5 documentation cleanup and roadmap status updates.
- Added PostgreSQL-backed Express + Prisma e2e coverage through `npm run test:e2e:postgres`.
- Added configurable generated Docker Compose database ports.

## 1.5.0

- Added Prisma-backed TypeScript Express CRUD repositories.
- Improved SQL import support for entities, relations, and Prisma schema output.
- Added generated README sections for setup, database, migration, API examples, and environment variables.
- Improved `arxgen doctor` environment checks.

## 1.4.0

- Added generated Express app e2e test coverage.
- Improved production readiness docs and generated app validation.

## 1.3.0

- Added multi-stack scaffolding support.
- Added NestJS scaffold generation.
