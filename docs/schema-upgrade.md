# Schema Upgrade

Preview changes:

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api --dry-run
```

Apply changes:

```bash
arxgen upgrade schema --from-sql ./schema.sql --project ./generated/api
```

The upgrade engine supports additive changes:

- new fields on existing entities
- new tables as new CRUD modules where supported
- route/module registration for generated projects

Safety rules:

- no automatic deletes
- no automatic renames
- destructive database changes require manual work

TypeScript Express receives the deepest upgrade path: entity, validation schema, create use case, Prisma schema, and new entity generation.
