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
- `--auth-mode scaffold|production`
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

## Production Auth

```bash
arxgen create --name secure-api --language typescript --framework express --auth jwt --auth-mode production --database postgres --orm prisma --entity user --field email:string
```

`--auth-mode production` generates JWT config, refresh-token hash storage, token rotation, logout, RBAC metadata, and Prisma auth models. Generated apps require `JWT_SECRET` at runtime in this mode.
