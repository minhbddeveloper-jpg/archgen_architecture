# Plugin Development

arxgen plugins expose metadata, support checks, and generators.

The target contract is:

```ts
export interface FrameworkPlugin {
  metadata: PluginMetadata;
  capabilities: PluginCapabilities;
  supports(config: ProjectConfig): boolean;
  generateProject(config: ProjectConfig): Promise<GeneratedFile[]>;
  generateEntity?(context: EntityGenerationContext): Promise<GeneratedFile[]>;
  generateCrud?(context: CrudGenerationContext): Promise<GeneratedFile[]>;
  generateAuth?(context: AuthGenerationContext): Promise<GeneratedFile[]>;
  generateOrm?(context: OrmGenerationContext): Promise<GeneratedFile[]>;
}
```

Current built-in starters expose capability metadata through `arxgen list plugins`.
