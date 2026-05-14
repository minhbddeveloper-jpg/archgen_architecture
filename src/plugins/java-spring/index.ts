import { resolve } from "node:path";
import { Generator } from "../../core/domain/generator.js";
import { GeneratedFile } from "../../core/domain/generatedFile.js";
import { Plugin } from "../../core/domain/plugin.js";
import { ProjectConfig } from "../../core/domain/projectConfig.js";
import { TemplateRenderer } from "../../core/application/ports/templateRenderer.js";

export function javaSpringPlugin(templateRenderer: TemplateRenderer): Plugin {
  return {
    name: "java-spring",
    language: "java",
    framework: "spring",
    supports(config: ProjectConfig): boolean {
      return (
        config.language.toLowerCase() === "java" &&
        config.framework.toLowerCase() === "spring" &&
        config.architecture === "clean"
      );
    },
    getGenerators(): Generator[] {
      return [new JavaSpringCleanGenerator(templateRenderer)];
    }
  };
}

class JavaSpringCleanGenerator implements Generator {
  constructor(private readonly templateRenderer: TemplateRenderer) {}

  async generate(config: ProjectConfig): Promise<GeneratedFile[]> {
    const packageName = toPackageName(config.projectName);
    const className = toPascalCase(config.projectName);
    const templateRoot = resolve("templates/java-spring");
    const context = {
      ...config,
      packageName,
      className
    };

    return [
      {
        path: `${config.projectName}/pom.xml`,
        content: await this.templateRenderer.render(resolve(templateRoot, "pom.xml.hbs"), context)
      },
      {
        path: `${config.projectName}/src/main/java/${packageName.replaceAll(".", "/")}/domain/.gitkeep`,
        content: ""
      },
      {
        path: `${config.projectName}/src/main/java/${packageName.replaceAll(".", "/")}/application/.gitkeep`,
        content: ""
      },
      {
        path: `${config.projectName}/src/main/java/${packageName.replaceAll(".", "/")}/infrastructure/.gitkeep`,
        content: ""
      },
      {
        path: `${config.projectName}/src/main/java/${packageName.replaceAll(".", "/")}/presentation/.gitkeep`,
        content: ""
      },
      {
        path: `${config.projectName}/src/main/java/${packageName.replaceAll(".", "/")}/${className}Application.java`,
        content: await this.templateRenderer.render(resolve(templateRoot, "Application.java.hbs"), context)
      },
      {
        path: `${config.projectName}/README.md`,
        content: await this.templateRenderer.render(resolve(templateRoot, "README.md.hbs"), context)
      }
    ];
  }
}

function toPackageName(projectName: string): string {
  const normalized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return `com.example.${normalized || "app"}`;
}

function toPascalCase(value: string): string {
  const words = value.match(/[a-zA-Z0-9]+/g) ?? ["App"];
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
}
