# arxgen Roadmap

This roadmap tracks planned work by release line. It uses plain ASCII so the file stays readable across terminals and editors.

## v1.5.0 - Database Confidence

Goal: make TypeScript Express database-backed generation more trustworthy.

Status: completed in the codebase. PostgreSQL e2e is available through `npm run test:e2e:postgres` and requires Docker.

- Express Prisma PostgreSQL e2e
  - Generate Express project with Prisma
  - Generate PostgreSQL docker-compose
  - Run npm install
  - Run Prisma generate/migrate flow
  - Run npm build
  - Start generated server
  - Test POST `/students`
  - Test GET `/students`
  - Test PUT `/students/:id`
  - Test DELETE `/students/:id`
- SQL import e2e
  - Create sample `schema.sql`
  - Parse tables, fields, primary keys, and foreign keys
  - Generate entities from SQL
  - Generate Prisma schema from SQL
  - Generate CRUD from SQL entities
  - Run generated API test
- Generated README
  - Generate `README.md` per project
  - Add install, dev, build, database setup, migration, API examples, and environment variables sections
- Doctor command
  - Check Node.js version
  - Check npm version
  - Check output folder permission
  - Check package manager
  - Check Docker availability
  - Check database config
  - Print actionable fix suggestions

## v1.6.0 - NestJS Serious Mode

Goal: promote NestJS from scaffold to serious beta/stable candidate.

Status: completed in the codebase. Generated NestJS e2e is available through `npm run test:e2e:nestjs`.

- NestJS build test
  - Generate NestJS project
  - Run npm install
  - Run npm build
  - Verify generated project compiles
- NestJS CRUD
  - Generate module per entity
  - Generate controller
  - Generate service
  - Generate repository interface
  - Generate repository implementation
  - Generate DTO files
  - Generate class-validator rules
  - Generate Swagger decorators
- NestJS Prisma
  - Generate Prisma schema
  - Generate PrismaService
  - Generate repository using Prisma
  - Generate migration docs
  - Add Prisma setup to package.json
- NestJS add entity
  - Detect existing NestJS project
  - Add new module/controller/service/repository
  - Update app module
  - Update Prisma schema if enabled
  - Preserve existing code
- NestJS e2e
  - Start generated NestJS app
  - Test health endpoint
  - Test CRUD endpoints
  - Validate response format

## v1.7.0 - Schema Upgrade

Goal: move schema upgrade beyond additive-only changes.

- Schema upgrade plan
  - Detect added tables and columns
  - Detect removed columns
  - Detect changed column types
  - Detect nullable changes
  - Detect default value changes
  - Print dry-run summary
- Relation detection
  - Detect many-to-one and one-to-many
  - Detect many-to-many join tables
  - Detect foreign key constraints
  - Generate relation metadata
- Safety warnings
  - Warn on dropped table/column
  - Warn on type changes
  - Warn on possible rename
  - Warn on destructive migrations
  - Require `--force` for risky changes
- SQL parser improvements
  - Support indexes and unique constraints
  - Support enum fields
  - Support decimal precision
  - Support varchar length
  - Support composite primary keys
  - Support `created_at` / `updated_at` conventions

## v1.8.0 - Core Refactor

Goal: split the generator into smaller feature modules.

- Split generator engine
  - Move ORM, auth, validation, Docker, OpenAPI, and relation generation into feature modules
  - Keep `GeneratorEngine` as orchestrator only
- Split project extender
  - Create project detector, route patcher, Prisma schema patcher, module patchers, package.json patcher, and schema upgrade patcher
- Feature pipeline
  - Define `FeatureGenerator` interface
  - Support feature ordering, only/skip, dependencies, and capability validation
- Template system
  - Move hard-coded templates out of generator
  - Add template renderer, variables, snapshot tests, and versioning

## v1.9.0 - Production Auth

Goal: replace auth scaffold with production-oriented generated auth.

- JWT production mode
  - Add `--auth-mode production`
  - Require `JWT_SECRET` in production
  - Generate auth config, middleware, and error handling
- User management
  - Generate users table/entity/repository
  - Generate register, login, and current user endpoints
- Password security
  - Use bcrypt or argon2
  - Hash password on register
  - Verify password on login
  - Never store plain password
- Refresh token
  - Generate refresh token storage
  - Store refresh token hash
  - Implement token rotation, revoke token, and logout
- RBAC
  - Generate roles, permissions, user_roles, and role_permissions tables
  - Generate roles and permissions guards

## v2.0.0 - Plugin SDK

Goal: stabilize external plugin APIs and multi-stack positioning.

- Stable plugin API
  - Define plugin metadata, capabilities, and generation contracts
- External plugin support
  - Load local and npm plugins
  - Validate plugin compatibility
  - Show plugin errors clearly
  - Document plugin lifecycle
- Plugin docs
  - Create plugin development guide
  - Create example plugin
  - Document template variables, capability matrix, and testing requirements
- Plugin tests
  - Add contract tests
  - Add fixture-based tests
  - Add generated output snapshot tests
  - Add compatibility tests

## Documentation And CI Quality

- Documentation
  - Keep README short
  - Add quick start, stack support matrix, production confidence note, and docs links
  - Add release notes for every version bump
- CI quality
  - Run typecheck, unit tests, snapshot tests, generated app e2e, and package publish dry-run
  - Test Node.js 20 and 22
  - Test Express basic, Express Prisma, NestJS basic, and SQL import
  - Block publish when typecheck, unit tests, or snapshot tests fail
