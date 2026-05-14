import { GeneratorEngine } from "../core/application/generatorEngine.js";
import { ProjectConfig } from "../core/domain/projectConfig.js";
import { Plugin } from "../core/domain/plugin.js";
import { Logger } from "../shared/logger.js";

interface Cli {
  run(args: string[]): Promise<void>;
}

export function createCli(engine: GeneratorEngine, plugins: Plugin[], logger: Logger): Cli {
  return {
    async run(args: string[]): Promise<void> {
      const [command, ...rest] = args;

      if (!command || command === "--help" || command === "-h") {
        printHelp(logger);
        return;
      }

      if (command === "create") {
        const options = parseOptions(rest);
        const config = toProjectConfig(options);
        const outputRoot = options.out ?? ".";
        const result = await engine.createProject(config, outputRoot);
        logger.info(`Generated ${result.filesWritten} files in ${result.outputRoot}`);
        return;
      }

      if (command === "list" && rest[0] === "plugins") {
        for (const plugin of plugins) {
          logger.info(`${plugin.name} (${plugin.language}/${plugin.framework})`);
        }
        return;
      }

      if (command === "doctor") {
        logger.info(`archgen ok: ${plugins.length} plugin(s) available`);
        return;
      }

      if (command === "add") {
        throw new Error("add commands are reserved for the next implementation phase");
      }

      throw new Error(`Unknown command: ${command}`);
    }
  };
}

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for option --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function toProjectConfig(options: Record<string, string>): ProjectConfig {
  const architecture = options.architecture ?? "clean";

  if (architecture !== "clean" && architecture !== "hexagonal" && architecture !== "mvc") {
    throw new Error("architecture must be one of: clean, hexagonal, mvc");
  }

  return {
    projectName: requireOption(options, "name"),
    language: requireOption(options, "language"),
    framework: requireOption(options, "framework"),
    architecture,
    database: options.database,
    orm: options.orm,
    auth: options.auth
  };
}

function requireOption(options: Record<string, string>, key: string): string {
  const value = options[key];
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function printHelp(logger: Logger): void {
  logger.info(`archgen

Commands:
  create --name <name> --language <language> --framework <framework> [--architecture clean] [--out <dir>]
  list plugins
  doctor`);
}
