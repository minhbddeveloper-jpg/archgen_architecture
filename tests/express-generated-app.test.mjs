import { execFileSync, spawn } from "node:child_process";
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error("Generated Express app did not become healthy");
}

test("generated TypeScript Express app installs, builds, starts, and handles CRUD", { skip: process.env.ARXGEN_RUN_GENERATED_E2E !== "1" }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-e2e-"));
  const port = 43137;
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
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "student-api");
    assert.equal(existsSync(join(projectRoot, "package.json")), true);

    runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: projectRoot, stdio: "pipe" });
    runNpm(["run", "build"], { cwd: projectRoot, stdio: "pipe" });

    server = spawnNpm(["run", "dev"], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe"
    });

    await waitForHealth(port);

    const created = await fetch(`http://127.0.0.1:${port}/students`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Minh" })
    });
    assert.equal(created.status, 201);
    const payload = await created.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.name, "Minh");

    const list = await fetch(`http://127.0.0.1:${port}/students`);
    assert.equal(list.status, 200);
    const listPayload = await list.json();
    assert.equal(listPayload.success, true);
    assert.equal(listPayload.data.data.length, 1);
  } finally {
    if (server) {
      server.kill();
      await wait(250);
    }
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
