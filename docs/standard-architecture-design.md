# Standard Architecture Design for ArchGen Plugins

This document defines the recommended Clean Architecture structures for supported languages and frameworks in the ArchGen project generator.

## Supported Plugins

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

## TypeScript + React

Recommended structure:

```text
src/
  app/
  features/
  components/
  services/
  hooks/
  shared/
  routes/
  main.tsx
```

Recommended stack:

- Vite
- React Router
- Axios
- Zustand or Redux Toolkit

## TypeScript + Express

Recommended structure:

```text
src/
  domain/
  application/
    use-cases/
    ports/
  infrastructure/
    repositories/
  presentation/
    controllers/
    routes/
  main.ts
```

Recommended stack:

- Express
- TypeScript
- Prisma or TypeORM

## Python + FastAPI

Recommended structure:

```text
app/
  domain/
  application/
  infrastructure/
  presentation/
  main.py
```

Recommended stack:

- FastAPI
- SQLAlchemy
- Pydantic

## Python + Django

Recommended structure:

```text
project/
  apps/
  core/
  config/
  manage.py
```

Recommended stack:

- Django
- Django REST Framework

## Java + Spring Boot

Recommended structure:

```text
src/main/java/com/example/
  domain/
  application/
  infrastructure/
  presentation/
```

Recommended stack:

- Spring Boot
- Spring Data JPA
- Lombok

## C# + ASP.NET Core

Recommended structure:

```text
src/
  Domain/
  Application/
  Infrastructure/
  WebAPI/
```

Recommended stack:

- ASP.NET Core
- Entity Framework Core

## PHP + Laravel

Recommended structure:

```text
app/
  Domain/
  Services/
  Repositories/
  Http/
  Models/
```

Recommended stack:

- Laravel
- Eloquent ORM

## Go + Gin

Recommended structure:

```text
internal/
  domain/
  usecase/
  repository/
  handler/
  server/
```

Recommended stack:

- Gin
- GORM

## Ruby + Rails

Recommended structure:

```text
app/
  models/
  controllers/
  services/
  repositories/
  views/
```

Recommended stack:

- Rails
- ActiveRecord

## Kotlin + Ktor

Recommended structure:

```text
src/main/kotlin/
  domain/
  application/
  infrastructure/
  presentation/
```

Recommended stack:

- Ktor
- Exposed ORM
- Kotlin Coroutines

## Final Recommendation

ArchGen should internally use a unified semantic architecture model that maps concepts such as `Entity`, `Repository`, `UseCase`, `DTO`, `Service`, and `Controller` into framework-specific templates.

This architecture keeps the generator scalable and makes it easier to support new languages and frameworks without rewriting the core generation flow.
