# Supported Stacks

| Stack | CRUD | Schema Upgrade | Notes |
| --- | --- | --- | --- |
| TypeScript Express | Stable | Stable additive | Strongest stack |
| TypeScript NestJS | Stable scaffold | Partial additive | Enterprise stack focus |
| Python FastAPI | Stable scaffold | Partial additive | Pydantic model patching |
| Python Django | Stable scaffold | Partial additive | Dataclass/service scaffold |
| Java Spring Boot | Stable scaffold | Partial additive | Entity patching |
| C# ASP.NET Core | Stable scaffold | Partial additive | Entity patching |
| PHP Laravel | Stable scaffold | Partial additive | Entity patching |
| Go Gin | Stable scaffold | Partial additive | Struct patching |
| Ruby Rails | Stable scaffold | Partial additive | Entity accessor patching |
| Kotlin Ktor | Stable scaffold | Partial additive | Data class patching |

`Stable scaffold` means arxgen consistently generates the expected files and routes. It does not mean the stack has full production database/auth hardening.
