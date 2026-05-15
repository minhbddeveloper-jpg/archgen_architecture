arxgen-next-work/
├── v1.5-database-confidence/
│   ├── express-prisma-postgresql-e2e/
│   │   ├── generate Express project with Prisma
│   │   ├── generate PostgreSQL docker-compose
│   │   ├── run npm install
│   │   ├── run prisma migrate
│   │   ├── run npm build
│   │   ├── start generated server
│   │   ├── test POST /students
│   │   ├── test GET /students
│   │   ├── test PUT /students/:id
│   │   └── test DELETE /students/:id
│   │
│   ├── sql-import-e2e/
│   │   ├── create sample schema.sql
│   │   ├── parse tables
│   │   ├── parse fields
│   │   ├── parse primary keys
│   │   ├── parse foreign keys
│   │   ├── generate entities from SQL
│   │   ├── generate Prisma schema from SQL
│   │   ├── generate CRUD from SQL entities
│   │   └── run generated API test
│   │
│   ├── generated-readme/
│   │   ├── generate README.md per project
│   │   ├── add install command
│   │   ├── add dev command
│   │   ├── add build command
│   │   ├── add database setup command
│   │   ├── add migration command
│   │   ├── add API examples
│   │   └── add environment variables section
│   │
│   └── doctor-command/
│       ├── check Node.js version
│       ├── check npm version
│       ├── check output folder permission
│       ├── check package manager
│       ├── check Docker availability
│       ├── check database config
│       └── print actionable fix suggestions
│
├── v1.6-nestjs-serious-mode/
│   ├── nestjs-build-test/
│   │   ├── generate NestJS project
│   │   ├── run npm install
│   │   ├── run npm build
│   │   └── verify generated project compiles
│   │
│   ├── nestjs-crud/
│   │   ├── generate module per entity
│   │   ├── generate controller
│   │   ├── generate service
│   │   ├── generate repository interface
│   │   ├── generate repository implementation
│   │   ├── generate DTO files
│   │   ├── generate class-validator rules
│   │   └── generate Swagger decorators
│   │
│   ├── nestjs-prisma/
│   │   ├── generate Prisma schema
│   │   ├── generate PrismaService
│   │   ├── generate repository using Prisma
│   │   ├── generate migration docs
│   │   └── add Prisma setup to package.json
│   │
│   ├── nestjs-add-entity/
│   │   ├── detect existing NestJS project
│   │   ├── add new module
│   │   ├── add controller/service/repository
│   │   ├── update app module
│   │   ├── update Prisma schema if enabled
│   │   └── preserve existing code
│   │
│   └── nestjs-e2e/
│       ├── start generated NestJS app
│       ├── test health endpoint
│       ├── test CRUD endpoints
│       └── validate response format
│
├── v1.7-schema-upgrade/
│   ├── schema-upgrade-plan/
│   │   ├── create upgrade plan object
│   │   ├── detect added tables
│   │   ├── detect added columns
│   │   ├── detect removed columns
│   │   ├── detect changed column types
│   │   ├── detect nullable changes
│   │   ├── detect default value changes
│   │   └── print dry-run summary
│   │
│   ├── relation-detection/
│   │   ├── detect many-to-one
│   │   ├── detect one-to-many
│   │   ├── detect many-to-many join tables
│   │   ├── detect foreign key constraints
│   │   └── generate relation metadata
│   │
│   ├── safety-warnings/
│   │   ├── warn on dropped table
│   │   ├── warn on dropped column
│   │   ├── warn on type change
│   │   ├── warn on possible rename
│   │   ├── warn on destructive migration
│   │   └── require --force for risky changes
│   │
│   └── sql-parser-improvements/
│       ├── support indexes
│       ├── support unique constraints
│       ├── support enum fields
│       ├── support decimal precision
│       ├── support varchar length
│       ├── support composite primary keys
│       └── support created_at / updated_at convention
│
├── v1.8-core-refactor/
│   ├── split-generator-engine/
│   │   ├── move ORM generation to features/orm
│   │   ├── move auth generation to features/auth
│   │   ├── move validation generation to features/validation
│   │   ├── move Docker generation to features/infrastructure
│   │   ├── move OpenAPI generation to features/openapi
│   │   ├── move relation generation to features/relations
│   │   └── keep GeneratorEngine as orchestrator only
│   │
│   ├── split-project-extender/
│   │   ├── create project detector
│   │   ├── create route patcher
│   │   ├── create Prisma schema patcher
│   │   ├── create NestJS module patcher
│   │   ├── create package.json patcher
│   │   └── create schema upgrade patcher
│   │
│   ├── feature-pipeline/
│   │   ├── define FeatureGenerator interface
│   │   ├── support feature ordering
│   │   ├── support only/skip
│   │   ├── support feature dependencies
│   │   └── support feature capability validation
│   │
│   └── template-system/
│       ├── move hard-coded templates out of generator
│       ├── add template renderer
│       ├── add template variables
│       ├── add snapshot tests for templates
│       └── add template versioning
│
├── v1.9-production-auth/
│   ├── jwt-production-mode/
│   │   ├── add --auth-mode production
│   │   ├── require JWT_SECRET in production
│   │   ├── generate auth config
│   │   ├── generate auth middleware
│   │   └── generate auth error handling
│   │
│   ├── user-management/
│   │   ├── generate users table
│   │   ├── generate user entity
│   │   ├── generate user repository
│   │   ├── generate register use case
│   │   ├── generate login use case
│   │   └── generate current user endpoint
│   │
│   ├── password-security/
│   │   ├── use bcrypt or argon2
│   │   ├── hash password on register
│   │   ├── verify password on login
│   │   └── never store plain password
│   │
│   ├── refresh-token/
│   │   ├── generate refresh_tokens table
│   │   ├── store refresh token hash
│   │   ├── implement token rotation
│   │   ├── implement revoke token
│   │   └── implement logout properly
│   │
│   └── rbac/
│       ├── generate roles table
│       ├── generate permissions table
│       ├── generate user_roles table
│       ├── generate role_permissions table
│       ├── generate RolesGuard
│       └── generate PermissionsGuard
│
├── v2.0-plugin-sdk/
│   ├── stable-plugin-api/
│   │   ├── define plugin metadata
│   │   ├── define plugin capabilities
│   │   ├── define generateProject contract
│   │   ├── define generateEntity contract
│   │   ├── define generateCrud contract
│   │   ├── define generateAuth contract
│   │   └── define generateOrm contract
│   │
│   ├── external-plugin-support/
│   │   ├── load local plugins
│   │   ├── load npm plugins
│   │   ├── validate plugin compatibility
│   │   ├── show plugin errors clearly
│   │   └── document plugin lifecycle
│   │
│   ├── plugin-docs/
│   │   ├── create plugin-development.md
│   │   ├── create example plugin
│   │   ├── document template variables
│   │   ├── document capability matrix
│   │   └── document testing requirements
│   │
│   └── plugin-tests/
│       ├── add plugin contract tests
│       ├── add fixture-based tests
│       ├── add generated output snapshot tests
│       └── add compatibility tests
│
├── documentation/
│   ├── docs-site/
│   │   ├── getting-started
│   │   ├── cli-reference
│   │   ├── config-reference
│   │   ├── supported-stacks
│   │   ├── sql-import
│   │   ├── schema-upgrade
│   │   ├── plugin-development
│   │   └── production-readiness
│   │
│   ├── readme-cleanup/
│   │   ├── keep README short
│   │   ├── add quick start
│   │   ├── add stack support matrix
│   │   ├── add production confidence note
│   │   └── link to docs
│   │
│   └── release-notes/
│       ├── add docs/releases/v1.5.0.md
│       ├── add docs/releases/v1.6.0.md
│       ├── add migration notes
│       └── add breaking changes section
│
└── ci-quality/
    ├── github-actions/
    │   ├── run typecheck
    │   ├── run unit tests
    │   ├── run snapshot tests
    │   ├── run generated app e2e
    │   └── run package publish dry-run
    │
    ├── test-matrix/
    │   ├── node 20
    │   ├── node 22
    │   ├── express basic
    │   ├── express prisma
    │   ├── nestjs basic
    │   └── sql import
    │
    └── release-safety/
        ├── block publish if typecheck fails
        ├── block publish if unit test fails
        ├── block publish if snapshot test fails
        ├── optionally block publish if e2e fails
        └── require release note for version bump



about another stack
v1.5.0
└── Make Express database-backed and trustworthy

v1.6.0
└── Promote NestJS to serious beta/stable candidate

v1.7.0
└── Build TypeScript fullstack path with React

v1.8.0
└── Add first non-TypeScript stack: FastAPI

v1.9.0
└── Add first enterprise stack: Spring Boot or ASP.NET Core

v2.0.0
└── Stable plugin API + serious multi-stack positioning