# ArchGen Upgrade Roadmap

This roadmap defines the next major upgrades for ArchGen. The main direction is to evolve ArchGen from a project starter generator into an architecture evolution tool that can safely extend existing projects.

Current implementation status:

- `archgen add entity`, `archgen add crud`, and `archgen add usecase` are available for generated TypeScript Express projects.
- TypeScript Express generation supports DTO artifacts, validation schema artifacts, JWT auth scaffolding, pagination DTOs, standard API response helpers, and Prisma relation metadata.
- NestJS starter generation is available with module, controller, service, provider, Swagger, config, and validation pipe scaffolding.
- `archgen wizard` provides a basic interactive terminal flow.
- Multi-framework AST merge support, full RBAC, refresh token persistence, and advanced relation types remain future work.

## 1. Add Commands for Existing Projects

Priority: Very high

Goal: Allow users to extend an already generated project instead of creating a new project from scratch.

Example commands:

```bash
archgen add entity student
archgen add crud student
archgen add usecase CreateStudent
```

### 1.1 Parse Existing Project Structure

The CLI should detect:

- Framework
- Language
- Architecture structure
- Existing entities and modules

Example structure:

```text
src/
  domain/
  application/
  infrastructure/
```

### 1.2 Generate Entity Files

Example:

```bash
archgen add entity student \
  --field name:string \
  --field email:string \
  --field age:number
```

Expected generated files:

```text
Student.ts
StudentRepository.ts
CreateStudentUseCase.ts
StudentController.ts
StudentRoutes.ts
```

### 1.3 Update Existing Files Automatically

ArchGen should update integration points such as:

- Route index files
- Dependency injection containers
- ORM schemas

Example route registration:

```ts
app.use("/students", studentRoutes);
```

Example DI registration:

```ts
container.register(StudentRepository);
```

Example ORM schema update:

```prisma
model Student {
}
```

### 1.4 Conflict Resolver

ArchGen should handle conflicts such as an entity that already exists.

Supported options:

- `--force`: overwrite conflicting files.
- `--merge`: merge generated code into the existing project when possible.

### 1.5 AST-Based Code Modification

ArchGen should avoid fragile string replacement when modifying existing code.

Recommended tools:

- `ts-morph`
- `recast`
- Babel parser

## 2. DTO, Validation, and Pagination

Priority: Very high

Goal: Generate production-ready APIs instead of toy CRUD examples.

### 2.1 DTO Generation

Generate:

- `CreateStudentDto`
- `UpdateStudentDto`
- `StudentResponseDto`

### 2.2 Validation

Supported validation options:

```bash
--validation zod
--validation class-validator
--validation joi
```

Example Zod schema:

```ts
const createStudentSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});
```

### 2.3 Query DTOs

Generate:

- `PaginationQueryDto`
- `FilterDto`
- `SortDto`

### 2.4 Pagination Support

Generated APIs should support:

```text
?page=1&limit=10
```

Standard response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

### 2.5 Search Support

Generated APIs should support:

```text
?q=minh
```

### 2.6 Standard API Response

Generated APIs should return a consistent response shape:

```json
{
  "success": true,
  "message": "Student created",
  "data": {}
}
```

## 3. JWT Authentication

Priority: High

Goal: Generate a complete authentication system.

### 3.1 Auth Domain

Generate:

- `User`
- `Role`
- `Permission`
- `RefreshToken`

### 3.2 Auth Use Cases

Generate:

- `RegisterUseCase`
- `LoginUseCase`
- `RefreshTokenUseCase`
- `LogoutUseCase`

### 3.3 Token and Password Services

Generate:

- `JwtService`
- `TokenProvider`
- `PasswordHasher`

### 3.4 Middleware and Guards

Generate:

- `AuthMiddleware`
- `RoleGuard`
- `PermissionGuard`

### 3.5 Password Hashing

Supported hashing options:

- `bcrypt`
- `argon2`

### 3.6 Refresh Token Flow

Generate:

- Access token
- Refresh token

### 3.7 RBAC Support

Generate role-based access control support.

Example:

```ts
@Roles("admin")
```

### 3.8 Auth Config

Generate environment variables:

```env
JWT_SECRET=
JWT_EXPIRES=
```

MVP scope:

- Register
- Login
- Current user endpoint, for example `/me`

RBAC can be added after the MVP.

## 4. Relation Support

Priority: High

Goal: Support real database relationships.

### 4.1 Relation Definition

Example:

```bash
--relation course.student:many-to-one
```

### 4.2 Generate ORM Relations

Example Prisma relation:

```prisma
model Course {
  studentId String
  student Student @relation(fields: [studentId], references: [id])
}
```

### 4.3 Generate Domain Relations

Example:

```ts
student?: Student;
courses?: Course[];
```

### 4.4 Nested DTOs

Example:

```json
{
  "student": {
    "id": ""
  }
}
```

### 4.5 Include Queries

Example:

```ts
include: {
  student: true;
}
```

### 4.6 Circular Dependency Handling

ArchGen should handle relationship cycles such as:

```text
Student -> Course -> Student
```

Future relation types:

- Many-to-many
- Polymorphic relation
- Tree structure

## 5. NestJS Plugin

Priority: High

Goal: Support NestJS as a popular enterprise TypeScript backend framework.

### 5.1 Plugin Architecture

Create:

```ts
NestJsPlugin
```

Implement:

- `generateEntity()`
- `generateUseCase()`
- `generateController()`

### 5.2 Module Generation

Generate:

- `students.module.ts`
- `students.controller.ts`
- `students.service.ts`

### 5.3 Clean Architecture Inside NestJS

Recommended structure:

```text
src/modules/students/
  domain/
  application/
  infrastructure/
  presentation/
```

### 5.4 Dependency Injection

Generate providers:

```ts
providers: [
  {
    provide: STUDENT_REPOSITORY,
  },
];
```

### 5.5 Swagger

Generate:

- `@ApiTags()`
- `@ApiResponse()`

### 5.6 Validation Pipe

Generate:

```ts
ValidationPipe
```

### 5.7 Config Module

Generate:

```ts
ConfigModule.forRoot()
```

## 6. Interactive Wizard

Priority: Medium

Goal: Let users generate projects through a terminal UI instead of manually writing all command options.

### 6.1 CLI Prompts

Recommended libraries:

- `@clack/prompts`
- `inquirer`

### 6.2 Project Questions

Ask:

- Project name
- Language
- Framework
- ORM
- Database

### 6.3 Dynamic Question Flow

Example:

If the user selects NestJS, ask NestJS-specific questions:

- Swagger?
- Guards?
- Validation?

### 6.4 Live Preview

Show a project structure preview before generation.

### 6.5 Save Config

Generate:

```text
archgen.json
```

### 6.6 Presets

Example:

```bash
archgen create --preset saas
```

## Final Direction

ArchGen should use a unified semantic architecture model internally. Concepts such as Entity, Repository, UseCase, DTO, Service, Controller, Relation, AuthPolicy, and ValidationSchema should map into framework-specific templates.

This keeps the generator scalable and makes it easier to support new languages, frameworks, and advanced project evolution features.
