import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Plugin } from "../../core/domain/plugin.js";
import { Logger } from "../../shared/logger.js";
import { DoctorCheck, formatDoctorCheck } from "../formatters/doctorFormatter.js";
import { CliOptions, stringOption } from "../parsers/optionParser.js";

export async function runDoctorCommand(plugins: Plugin[], logger: Logger, options: CliOptions): Promise<void> {
  logger.info(await runDoctor(plugins, options));
}

async function runDoctor(plugins: Plugin[], options: CliOptions): Promise<string> {
  const outputRoot = resolve(stringOption(options, "out") ?? ".");
  const projectRoot = resolve(stringOption(options, "project") ?? ".");
  const checks = [
    checkNodeVersion(),
    checkCommand("npm", ["--version"], "npm version", "Install npm with Node.js 20+ or use a supported package manager."),
    await checkWritable(outputRoot),
    checkPackageManager(projectRoot),
    checkCommand("docker", ["--version"], "Docker availability", "Install Docker Desktop or run database services manually."),
    await checkDatabaseConfig(projectRoot)
  ];

  const lines = [
    "arxgen doctor",
    `Plugins: ${plugins.length}`,
    ...checks.map(formatDoctorCheck)
  ];
  const failed = checks.filter((check) => check.status !== "ok");
  lines.push(failed.length === 0 ? "Status: ok" : `Status: ${failed.length} issue(s) need attention`);
  return lines.join("\n");
}

function checkNodeVersion(): DoctorCheck {
  const major = Number(process.versions.node.split(".")[0]);
  return major >= 20
    ? { name: "Node.js version", status: "ok", detail: process.versions.node }
    : { name: "Node.js version", status: "warn", detail: process.versions.node, fix: "Install Node.js 20 or newer." };
}

function checkCommand(command: string, args: string[], name: string, fix: string): DoctorCheck {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });
  if (result.status === 0) {
    return { name, status: "ok", detail: (result.stdout || result.stderr).trim().split(/\r?\n/)[0] ?? "available" };
  }
  return { name, status: "warn", detail: "not available", fix };
}

async function checkWritable(outputRoot: string): Promise<DoctorCheck> {
  try {
    await access(outputRoot, constants.W_OK);
    return { name: "Output folder permission", status: "ok", detail: outputRoot };
  } catch {
    return {
      name: "Output folder permission",
      status: "warn",
      detail: outputRoot,
      fix: "Create the output folder or choose a writable path with --out <dir>."
    };
  }
}

function checkPackageManager(projectRoot: string): DoctorCheck {
  const packageManager = process.env.npm_config_user_agent?.split(" ")[0] ?? "npm";
  return { name: "Package manager", status: "ok", detail: `${packageManager} for ${projectRoot}` };
}

async function checkDatabaseConfig(projectRoot: string): Promise<DoctorCheck> {
  if (process.env.DATABASE_URL) {
    return { name: "Database config", status: "ok", detail: "DATABASE_URL is set" };
  }
  try {
    const envExample = await readFile(resolve(projectRoot, ".env.example"), "utf8");
    if (envExample.includes("DATABASE_URL=")) {
      return { name: "Database config", status: "ok", detail: ".env.example contains DATABASE_URL" };
    }
  } catch {
    // Fall through to a warning with a concrete fix.
  }
  return {
    name: "Database config",
    status: "warn",
    detail: "DATABASE_URL not found",
    fix: "Set DATABASE_URL or generate a database-backed project with --database postgres --orm prisma."
  };
}
