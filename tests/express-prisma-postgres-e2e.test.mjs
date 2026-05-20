import { execFileSync, spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function runNpm(args, options) {
  if (process.platform === "win32") {
    return execFileSync("cmd.exe", ["/c", "npm", ...args], options);
  }
  return execFileSync("npm", args, options);
}

function runNpx(args, options) {
  if (process.platform === "win32") {
    return execFileSync("cmd.exe", ["/c", "npx", ...args], options);
  }
  return execFileSync("npx", args, options);
}

function runDocker(args, options) {
  return execFileSync("docker", args, options);
}

function spawnNpm(args, options) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/c", "npm", ...args], options);
  }
  return spawn("npm", args, options);
}

function killProcessTree(childProcess) {
  if (!childProcess?.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill.exe", ["/pid", String(childProcess.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      // The process may already have exited.
    }
    return;
  }
  childProcess.kill();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await canConnect(port)) return;
    await wait(250);
  }
  throw new Error(`PostgreSQL did not become reachable on port ${port}`);
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error("Generated Prisma Express app did not become healthy");
}

test("generated TypeScript Express Prisma app migrates PostgreSQL and handles CRUD", { skip: process.env.ARXGEN_RUN_POSTGRES_E2E !== "1" }, async () => {
  runDocker(["compose", "version"], { cwd: process.cwd(), stdio: "pipe" });

  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-postgres-e2e-"));
  const apiPort = randomInt(43000, 48000);
  const postgresPort = randomInt(54000, 60000);
  const databaseUrl = `postgresql://arxgen:arxgen@127.0.0.1:${postgresPort}/arxgen`;
  const dockerEnv = { ...process.env, POSTGRES_PORT: String(postgresPort) };
  let server;

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
        "create",
        "--name",
        "student-api",
        "--language",
        "typescript",
        "--framework",
        "express",
        "--entity",
        "student",
        "--field",
        "name:string",
        "--field",
        "email:string",
        "--database",
        "postgres",
        "--orm",
        "prisma",
        "--docker",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "student-api");
    assert.equal(existsSync(join(projectRoot, "docker-compose.yml")), true);
    assert.equal(existsSync(join(projectRoot, "prisma/schema.prisma")), true);

    runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: projectRoot, stdio: "pipe" });
    runDocker(["compose", "up", "-d", "db"], { cwd: projectRoot, env: dockerEnv, stdio: "pipe" });
    await waitForPort(postgresPort);

    const appEnv = { ...process.env, DATABASE_URL: databaseUrl, PORT: String(apiPort) };
    runNpx(["prisma", "generate"], { cwd: projectRoot, env: appEnv, stdio: "pipe" });
    runNpx(["prisma", "migrate", "dev", "--name", "init", "--skip-seed"], { cwd: projectRoot, env: appEnv, stdio: "pipe" });
    runNpm(["run", "build"], { cwd: projectRoot, env: appEnv, stdio: "pipe" });

    server = spawnNpm(["run", "dev"], {
      cwd: projectRoot,
      env: appEnv,
      stdio: "pipe"
    });
    await waitForHealth(apiPort);

    const created = await fetch(`http://127.0.0.1:${apiPort}/students`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Minh", email: "minh@example.com" })
    });
    assert.equal(created.status, 201);
    const createdPayload = await created.json();
    assert.equal(createdPayload.success, true);
    assert.equal(createdPayload.data.email, "minh@example.com");
    const id = createdPayload.data.id;

    const list = await fetch(`http://127.0.0.1:${apiPort}/students`);
    assert.equal(list.status, 200);
    const listPayload = await list.json();
    assert.equal(listPayload.data.data.some((student) => student.id === id), true);

    const updated = await fetch(`http://127.0.0.1:${apiPort}/students/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Minh Bui" })
    });
    assert.equal(updated.status, 200);
    const updatedPayload = await updated.json();
    assert.equal(updatedPayload.data.name, "Minh Bui");
    assert.equal(updatedPayload.data.email, "minh@example.com");

    const deleted = await fetch(`http://127.0.0.1:${apiPort}/students/${id}`, { method: "DELETE" });
    assert.equal(deleted.status, 204);

    const afterDelete = await fetch(`http://127.0.0.1:${apiPort}/students/${id}`);
    assert.equal(afterDelete.status, 404);
  } finally {
    if (server) {
      killProcessTree(server);
      await wait(250);
    }
    try {
      runDocker(["compose", "down", "-v"], { cwd: join(outputRoot, "student-api"), env: dockerEnv, stdio: "pipe" });
    } catch {
      // Compose may not have started if setup failed early.
    }
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
