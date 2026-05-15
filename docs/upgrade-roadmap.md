# arxgen v1 Roadmap Status

The v1 upgrade roadmap has been completed and cleared from this file so future work is not confused with already implemented scope.

## Completed in v1.0.0

- `arxgen create` for supported starter stacks.
- `arxgen create --preset saas`.
- `arxgen wizard` with project preview and optional `arxgen.json` saving.
- `arxgen add entity`, `arxgen add crud`, and `arxgen add usecase` for generated TypeScript Express projects.
- Existing TypeScript Express project detection.
- Existing entity conflict detection with `--force` support.
- AST-based TypeScript Express route registration.
- Validation dependency merge for generated TypeScript Express projects.
- Prisma schema update when adding entities to existing generated projects.
- Infrastructure container update when adding entities to existing generated projects.
- Clean Architecture TypeScript Express output with domain, application, ports, use cases, infrastructure, presentation, middleware, and shared kernel files.
- DTO generation with create, update, response, pagination, filter, and sort DTOs.
- Validation schema generation for supported providers.
- Pagination, filter/search, sorting, and standard API response helpers.
- JWT auth scaffolding with register, login, refresh token, logout, token provider, password hashing, auth middleware, role and permission domain types, and permission middleware.
- Relation metadata, ORM relation generation, nested relation DTOs, include query helpers, and circular-safe include helpers.
- NestJS Clean Architecture starter with modules, controllers, services, repositories, DTOs, guards, interceptors, validation pipe, Swagger, config, and test placeholders.
- NestJS plugin contract class with `generateEntity`, `generateUseCase`, and `generateController` capability methods.
- Environment config, Docker, Nginx, Redis, CI template, logging, exception handling, database migration placeholders, seed placeholders, unit test placeholders, and integration test placeholders for flagship TypeScript stacks.
- Clear plugin contract for extending framework support.
- Snapshot tests for generated Express and NestJS output.
- GitHub Actions CI for typecheck and tests.

## Next Roadmap

No active roadmap items are tracked here.

Create a new roadmap section only when a future feature is intentionally planned and not yet implemented.
