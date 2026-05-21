# Schema Upgrade

Preview changes:

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api --dry-run
```

Apply additive changes:

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api
```

Apply additive changes while accepting that risky changes must be handled manually:

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api --force
```

The upgrade engine supports:

- new fields on existing entities
- new tables as new CRUD modules where supported
- route/module registration for generated projects
- dry-run summaries for added, removed, changed, nullable, and defaulted fields
- relation metadata from foreign keys and many-to-many join tables
- SQL metadata for indexes, unique constraints, enum fields, decimal precision, varchar length, and composite primary keys

Safety rules:

- no automatic deletes
- no automatic renames
- no automatic type rewrites for existing fields
- risky changes are reported during `--dry-run`
- risky apply runs require `--force`
- destructive database changes require manual migration work

TypeScript Express receives the deepest upgrade path: entity, validation schema, create use case, Prisma schema, and new entity generation.
