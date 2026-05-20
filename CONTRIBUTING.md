# Contributing

Thank you for considering a contribution to arxgen.

## Development Setup

```bash
npm install
npm run typecheck
npm test
```

Generated app e2e tests:

```bash
npm run test:e2e
npm run test:e2e:nestjs
```

PostgreSQL e2e requires Docker:

```bash
npm run test:e2e:postgres
```

## Pull Requests

- Keep changes focused.
- Add or update tests for generator behavior.
- Update docs and release notes when behavior changes.
- Run `npm run typecheck` and `npm test` before opening a PR.

## Reporting Issues

Please include:

- arxgen version
- Node.js version
- operating system
- command or config used
- expected result and actual result
