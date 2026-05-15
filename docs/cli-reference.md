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

`add` commands are stable for generated TypeScript Express projects.

## Upgrade

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api --dry-run
```

Schema upgrade is additive. It does not delete or rename fields automatically.
