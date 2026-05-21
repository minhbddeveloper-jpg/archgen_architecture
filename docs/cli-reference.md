# CLI Reference

## Create

```bash
arxgen create --name <name> --language <language> --framework <framework>
```

Useful options:

- `--entity <name>`
- `--field <name:type>`
- `--from-sql <file>`
- `--database postgres|mysql|mongodb`
- `--orm prisma|sqlalchemy|efcore|jpa|gorm|eloquent`
- `--validation zod|joi|class-validator`
- `--auth jwt`
- `--docker`
- `--nginx`
- `--redis`
- `--out <dir>`
- `--dry-run`
- `--force`

## Add

```bash
arxgen add entity course --field title:string --project ./generated/api --merge
arxgen add schema --from-sql ./schema.sql --project ./generated/api
```

`add entity` is stable for generated TypeScript Express projects and beta for generated TypeScript NestJS projects.

## Upgrade

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api --dry-run
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api --force
```

Schema upgrade applies additive changes and reports risky differences such as removed fields, type changes, nullability changes, and default changes. It does not delete, rename, or rewrite existing fields automatically. Risky apply runs require `--force`.
