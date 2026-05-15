# SQL Import

Use SQL import when you already have database DDL:

```bash
arxgen create --name school-api --language typescript --framework express --from-sql ./schema.sql
```

Supported:

- `CREATE TABLE`
- common scalar types
- nullable and `NOT NULL`
- primary `id` convention
- foreign keys as relation metadata
- basic unique/default/length/precision metadata parsing

SQL import is intentionally conservative. Complex DDL should be reviewed after generation.
