export type CliValue = string | boolean | string[];
export type CliOptions = Record<string, CliValue>;

export function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key === "force" || key === "dry-run" || key === "docker" || key === "nginx" || key === "redis" || key === "merge" || key === "save-config") {
      options[key] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for option --${key}`);
    }

    appendOption(options, key, value);
    index += 1;
  }

  return options;
}

function appendOption(options: CliOptions, key: string, value: string): void {
  const current = options[key];
  if (current === undefined) {
    options[key] = value;
    return;
  }

  if (typeof current === "string") {
    options[key] = [current, value];
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  throw new Error(`--${key} cannot be combined with a value`);
}

export function stringOption(options: CliOptions, key: string): string | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`--${key} requires a value`);
  }

  return value;
}

export function stringListOption(options: CliOptions, key: string): string[] {
  const value = options[key];
  if (value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`--${key} requires a value`);
}

export function booleanOption(options: CliOptions, key: string): boolean {
  const value = options[key];
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new Error(`--${key} does not accept a value`);
  }

  return value;
}

export function requireOption(options: Record<string, unknown>, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

export function optionalString(options: Record<string, unknown>, key: string): string | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }

  return value;
}

export function optionalBoolean(options: Record<string, unknown>, key: string): boolean | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }

  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
