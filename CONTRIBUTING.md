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

## Release Checklist

Every new version must keep user-facing commands in sync.

For every release:

- Update `package.json` and `package-lock.json`.
- Update `CHANGELOG.md`.
- Add or update `docs/releases/vX.Y.Z.md`.
- Review `README.md` and update install, quick start, SQL, upgrade, useful commands, support status, and documentation links when behavior changes.
- Review `docs/cli-reference.md` when CLI flags or command syntax changes.
- Run `npm run security:audit`, `npm run typecheck`, `npm test`, and `npm pack --dry-run`.

For every `X.Y.0` release:

- Create and push the git tag, for example `v1.8.0`.
- Create the GitHub Release with GitHub CLI using the release note file:

```bash
gh release create vX.Y.0 --title "arxgen vX.Y.0" --notes-file docs/releases/vX.Y.0.md
```

Do not publish or tag a release until README commands have been checked against the current CLI behavior.

## Reporting Issues

Please include:

- arxgen version
- Node.js version
- operating system
- command or config used
- expected result and actual result
