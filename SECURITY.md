# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

Please report security issues by opening a GitHub Security Advisory or contacting the maintainer.

Do not disclose security vulnerabilities publicly until a fix is available.

## Maintainer Checks

```bash
npm run security:audit
snyk auth
npm run security:snyk
```
