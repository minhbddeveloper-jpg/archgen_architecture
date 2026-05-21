import { GeneratorEngine } from "../core/application/generatorEngine.js";
import { ProjectExtender } from "../core/application/projectExtender.js";
import { Plugin } from "../core/domain/plugin.js";
import { Logger } from "../shared/logger.js";
import { runAddCommand } from "./commands/addCommand.js";
import { runCreateCommand } from "./commands/createCommand.js";
import { runDoctorCommand } from "./commands/doctorCommand.js";
import { runUpgradeSchemaCommand } from "./commands/upgradeSchemaCommand.js";
import { runWizardCommand } from "./commands/wizardCommand.js";
import { formatPlugin } from "./formatters/pluginFormatter.js";
import { parseOptions } from "./parsers/optionParser.js";

interface Cli {
  run(args: string[]): Promise<void>;
}

export function createCli(engine: GeneratorEngine, extender: ProjectExtender, plugins: Plugin[], logger: Logger): Cli {
  return {
    async run(args: string[]): Promise<void> {
      const [command, ...rest] = args;

      if (!command || command === "--help" || command === "-h") {
        printHelp(logger);
        return;
      }

      if (command === "create") {
        await runCreateCommand(engine, logger, parseOptions(rest));
        return;
      }

      if (command === "wizard") {
        await runWizardCommand(engine, logger);
        return;
      }

      if (command === "list" && rest[0] === "plugins") {
        for (const plugin of plugins) {
          logger.info(formatPlugin(plugin));
        }
        return;
      }

      if (command === "doctor") {
        await runDoctorCommand(plugins, logger, parseOptions(rest));
        return;
      }

      if (command === "upgrade") {
        const [target, ...upgradeArgs] = rest;
        if (target !== "schema") {
          throw new Error("Usage: arxgen upgrade schema --from-sql schema.sql [--project <dir>] [--validation zod] [--dry-run] [--force]");
        }
        await runUpgradeSchemaCommand(extender, logger, parseOptions(upgradeArgs));
        return;
      }

      if (command === "add") {
        await runAddCommand(extender, logger, rest);
        return;
      }

      throw new Error(`Unknown command: ${command}`);
    }
  };
}

function printHelp(logger: Logger): void {
  logger.info(`arxgen

Commands:
  create --name <name> --language <language> --framework <framework> [--entity <name>] [--field <entity.field:type>] [--from-sql schema.sql] [--database postgres] [--orm prisma] [--validation zod] [--auth jwt] [--relation course.student:many-to-one] [--redis] [--docker] [--nginx] [--architecture clean] [--config <file>] [--preset saas] [--out <dir>] [--force] [--dry-run]
  create --name <name> --frontend react --backend express [--database postgres] [--redis] [--docker] [--nginx] [--out <dir>]
  add entity <name> [--field name:type] [--project <dir>] [--validation zod] [--merge] [--force] [--dry-run]
  add crud <name> [--field name:type] [--project <dir>] [--validation zod] [--merge] [--force] [--dry-run]
  add schema --from-sql schema.sql [--project <dir>] [--validation zod] [--force] [--dry-run]
  upgrade schema --from-sql schema.sql [--project <dir>] [--validation zod] [--dry-run] [--force]
  add usecase <name> [--project <dir>] [--force] [--dry-run]
  wizard
  list plugins
  doctor`);
}
