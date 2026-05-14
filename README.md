# ArchGen

ArchGen is a TypeScript CLI generator for creating project starters across multiple languages, frameworks, and Clean Architecture-style layouts.

The project aims to:

- Generate starter projects for popular technology stacks.
- Let users choose the language, framework, versions, and output directory.
- Support JSON configuration for entities, fields, and basic CRUD generation.
- Keep generated code organized around `domain`, `application`, `infrastructure`, and `presentation` layers.

CRUD generation currently uses in-memory repositories. This provides a practical foundation for later database/ORM support such as Prisma, Spring Data JPA, EF Core, Django ORM, or Laravel Eloquent.

## Supported Platforms

| Language | Framework | Plugin | Notes |
| --- | --- | --- | --- |
| TypeScript | React | `typescript-react` | Frontend app with Vite |
| TypeScript | Express | `typescript-express` | Backend API with CRUD routes |
| Python | FastAPI | `python-fastapi` | Backend API with CRUD routes |
| Python | Django | `python-django` | Django starter |
| Java | Spring Boot | `java-spring` | Backend API with CRUD controllers |
| C# | ASP.NET Core | `csharp-aspnetcore` | Backend API starter |
| PHP | Laravel | `php-laravel` | Laravel starter |
| Go | Gin | `go-gin` | Backend API starter |
| Ruby | Rails | `ruby-rails` | Rails starter |
| Kotlin | Ktor | `kotlin-ktor` | Backend API starter |

## Usage

Requirements:

- Node.js `>=20`
- npm

Install dependencies:

```bash
npm install
```

Build the CLI:

```bash
npm run build
```

Check the CLI:

```bash
npm start -- doctor
npm start -- list plugins
```

Generate a project directly from CLI options:

```bash
npm start -- create --name student-api --language java --framework spring --architecture clean --out ./generated
```

Generate a React project:

```bash
npm start -- create --name web-app --language typescript --framework react --out ./generated
```

Generate a FastAPI project:

```bash
npm start -- create --name api --language python --framework fastapi --out ./generated
```

Generate a project from a config file:

```bash
npm start -- create --config ./examples/archgen.sample.json
```

Override the output directory from the CLI:

```bash
npm start -- create --config ./examples/archgen.sample.json --out ./generated/custom
```

Preview generated files without writing them:

```bash
npm start -- create --config ./examples/archgen.sample.json --dry-run
```

Overwrite existing generated files:

```bash
npm start -- create --config ./examples/archgen.sample.json --force
```

Output directory rules:

- `--out` sets the output directory from the CLI.
- `out` or `outputDir` sets the output directory from the JSON config file.
- If both config and CLI provide an output directory, CLI `--out` takes precedence.
- Existing files are protected by default. Use `--force` to overwrite them.
- `--dry-run` validates generation and reports the file count without creating directories or files.

## Project Configuration

ArchGen supports JSON configuration for project metadata, framework versions, output location, and CRUD entities.

Example `archgen.json`:

```json
{
  "name": "student-api",
  "language": "typescript",
  "framework": "express",
  "architecture": "clean",
  "languageVersion": "5.4.2",
  "frameworkVersion": "4.18.3",
  "out": "./generated",
  "packageVersions": {
    "nodeTypesVersion": "20.11.30",
    "tsxVersion": "4.7.1"
  },
  "entities": [
    {
      "name": "student",
      "fields": [
        { "name": "name", "type": "string" },
        { "name": "email", "type": "string" },
        { "name": "age", "type": "number", "required": false },
        { "name": "active", "type": "boolean" }
      ]
    }
  ]
}
```

Run:

```bash
npm start -- create --config ./archgen.json
```

Supported field types:

| Type | Meaning |
| --- | --- |
| `string` | Short string |
| `text` | Long string |
| `number` | Numeric value |
| `boolean` | True/false value |
| `date` | Date/time value |
| `uuid` | UUID identifier |

Version fields:

| Field | Meaning |
| --- | --- |
| `languageVersion` | Language, runtime, compiler, or platform version, such as TypeScript, Python, Java, Go, Ruby, PHP, Kotlin, or .NET |
| `frameworkVersion` | Main framework version, such as React, Express, FastAPI, Django, Spring Boot, ASP.NET Core, Laravel, Gin, Rails, or Ktor |
| `packageVersions` | Optional dependency overrides used by templates, such as `viteVersion`, `uvicornVersion`, `nodeTypesVersion`, or `pumaVersion` |

## Visual Example

Input config:

```json
{
  "name": "student-api",
  "language": "typescript",
  "framework": "express",
  "out": "./generated",
  "entities": [
    {
      "name": "student",
      "fields": [
        { "name": "name", "type": "string" },
        { "name": "email", "type": "string" }
      ]
    }
  ]
}
```

Command:

```bash
npm start -- create --config ./archgen.json
```

Generated output:

```text
generated/
  student-api/
    package.json
    tsconfig.json
    README.md
    src/
      main.ts
      domain/
        entities/
          Student.ts
      application/
        services/
          studentService.ts
      infrastructure/
        repositories/
          studentRepository.ts
      presentation/
        controllers/
          studentController.ts
```

Run the generated TypeScript Express project:

```bash
cd generated/student-api
npm install
npm run dev
```

Generated endpoints:

```text
GET    /health
GET    /students
GET    /students/:id
POST   /students
PUT    /students/:id
DELETE /students/:id
```

Example request:

```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Jane Doe\",\"email\":\"jane@example.com\"}"
```

## Development Commands

Run the TypeScript source directly:

```bash
npm run dev -- create --name student-api --language java --framework spring --architecture clean
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

## Folder Structure

```text
bin/
src/
  cli/
  core/
    domain/
    application/
    infrastructure/
  plugins/
  shared/
templates/
examples/
tests/
```
