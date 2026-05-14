# ArchGen

ArchGen is a TypeScript CLI foundation for generating projects from architecture plugins and templates.

## Current base

- CLI command routing
- Core generator contracts
- Plugin selection
- Handlebars template rendering
- Safe file writing
- Java Spring Clean Architecture starter plugin

## Commands

```bash
npm install
npm run build
npm start -- create --name student-api --language java --framework spring --architecture clean --out ./generated
npm start -- list plugins
npm start -- doctor
```

During development:

```bash
npm run dev -- create --name student-api --language java --framework spring --architecture clean
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
    presentation/
  plugins/
  shared/
templates/
tests/
```

## Roadmap

1. Expand Java Spring generators for entities, CRUD, persistence, and auth.
2. Add Node Express and .NET Clean Architecture plugins.
3. Add config file support and richer validation.
4. Add tests around plugin matching, rendering, and file writing.
