import { execFileSync, spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error("Generated NestJS app did not become healthy");
}

function responseData(payload) {
  return payload?.success === true && "data" in payload ? payload.data : payload;
}

test("generated TypeScript NestJS app installs, builds, starts, and handles CRUD", { skip: process.env.ARXGEN_RUN_NESTJS_E2E !== "1" }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-nestjs-e2e-"));
  const port = randomInt(43000, 48000);
  let server;

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
        "create",
        "--name",
        "nest-school",
        "--language",
        "typescript",
        "--framework",
        "nestjs",
        "--entity",
        "student",
        "--field",
        "name:string",
        "--field",
        "email:string",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "nest-school");
    assert.equal(existsSync(join(projectRoot, "package.json")), true);
    assert.equal(existsSync(join(projectRoot, "src/health.controller.ts")), true);

    runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: projectRoot, stdio: "pipe" });
    runNpm(["run", "build"], { cwd: projectRoot, stdio: "pipe" });

    server = spawnNpm(["run", "start"], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe"
    });
    await waitForHealth(port);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    assert.equal(responseData(await health.json()).status, "ok");

    const created = await fetch(`http://127.0.0.1:${port}/students`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Minh", email: "minh@example.com" })
    });
    assert.equal(created.status, 201);
    const createdPayload = responseData(await created.json());
    assert.equal(createdPayload.name, "Minh");
    const id = createdPayload.id;

    const list = await fetch(`http://127.0.0.1:${port}/students`);
    assert.equal(list.status, 200);
    const listPayload = responseData(await list.json());
    assert.equal(listPayload.data.some((student) => student.id === id), true);

    const updated = await fetch(`http://127.0.0.1:${port}/students/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Minh Bui" })
    });
    assert.equal(updated.status, 200);
    const updatedPayload = responseData(await updated.json());
    assert.equal(updatedPayload.name, "Minh Bui");
    assert.equal(updatedPayload.email, "minh@example.com");

    const deleted = await fetch(`http://127.0.0.1:${port}/students/${id}`, { method: "DELETE" });
    assert.equal(deleted.status, 200);

    const afterDelete = await fetch(`http://127.0.0.1:${port}/students/${id}`);
    assert.equal(afterDelete.status, 404);
  } finally {
    if (server) {
      killProcessTree(server);
      await wait(250);
    }
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
