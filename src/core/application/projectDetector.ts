import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ProjectDetection {
  language: string;
  framework: string;
}

export async function detectProject(root: string): Promise<ProjectDetection> {
  const packageJsonPath = join(root, "package.json");
  const mainPath = join(root, "src", "main.ts");

  if ((await exists(packageJsonPath)) && (await exists(mainPath))) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (dependencies.express) return { language: "typescript", framework: "express" };
    if (dependencies["@nestjs/core"]) return { language: "typescript", framework: "nestjs" };
  }

  if ((await exists(join(root, "pyproject.toml"))) && (await exists(join(root, "app", "main.py")))) {
    return { language: "python", framework: "fastapi" };
  }
  if ((await exists(join(root, "manage.py"))) && (await exists(join(root, "config", "urls.py")))) {
    return { language: "python", framework: "django" };
  }
  if (await exists(join(root, "pom.xml"))) {
    return { language: "java", framework: "spring" };
  }
  if ((await exists(join(root, "Program.cs"))) && (await findFirstFile(root, ".csproj"))) {
    return { language: "csharp", framework: "aspnetcore" };
  }
  if ((await exists(join(root, "composer.json"))) && (await exists(join(root, "routes", "api.php")))) {
    return { language: "php", framework: "laravel" };
  }
  if ((await exists(join(root, "go.mod"))) && (await exists(join(root, "cmd", "api", "main.go")))) {
    return { language: "go", framework: "gin" };
  }
  if ((await exists(join(root, "Gemfile"))) && (await exists(join(root, "config", "routes.rb")))) {
    return { language: "ruby", framework: "rails" };
  }
  if ((await exists(join(root, "build.gradle.kts"))) && (await exists(join(root, "settings.gradle.kts")))) {
    return { language: "kotlin", framework: "ktor" };
  }

  throw new Error("Unable to detect a supported generated project. Pass --project <dir> pointing to a generated arxgen project.");
}

export function ensureTypeScriptExpress(detection: ProjectDetection): void {
  if (detection.language !== "typescript" || detection.framework !== "express") {
    throw new Error("This add command currently supports generated TypeScript Express projects. Use `arxgen upgrade schema` for additive schema upgrades on other generated backend stacks.");
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findFirstFile(root: string, fileNameOrExtension: string, predicate?: (path: string) => boolean): Promise<string | undefined> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
        continue;
      }
      const nested = await findFirstFile(path, fileNameOrExtension, predicate);
      if (nested) return nested;
      continue;
    }

    const matches = fileNameOrExtension.startsWith(".")
      ? entry.name.endsWith(fileNameOrExtension)
      : entry.name === fileNameOrExtension;
    if (matches && (!predicate || predicate(path))) {
      return path;
    }
  }
  return undefined;
}
