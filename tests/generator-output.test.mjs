import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

test("generates TypeScript Express clean architecture output with ports and specific use cases", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "archgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/archgen.js",
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
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "student-api");
    const expectedFiles = [
      "src/domain/entities/Student.ts",
      "src/application/ports/studentRepositoryPort.ts",
      "src/application/use-cases/listStudentsUseCase.ts",
      "src/application/use-cases/getStudentUseCase.ts",
      "src/application/use-cases/createStudentUseCase.ts",
      "src/application/use-cases/updateStudentUseCase.ts",
      "src/application/use-cases/deleteStudentUseCase.ts",
      "src/infrastructure/repositories/studentRepository.ts",
      "src/presentation/controllers/studentController.ts",
      "src/presentation/routes/studentRoutes.ts"
    ];

    for (const file of expectedFiles) {
      assert.equal(existsSync(join(projectRoot, file)), true, `Expected ${file} to exist`);
    }

    const controller = readFileSync(join(projectRoot, "src/presentation/controllers/studentController.ts"), "utf8");
    assert.match(controller, /CreateStudentUseCase/);
    assert.match(controller, /ListStudentsUseCase/);
    assert.doesNotMatch(controller, /StudentService/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates setup and ORM artifacts when requested", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "archgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/archgen.js",
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
        "--database",
        "postgres",
        "--orm",
        "prisma",
        "--redis",
        "--docker",
        "--nginx",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "student-api");
    assert.equal(existsSync(join(projectRoot, "prisma/schema.prisma")), true);
    assert.equal(existsSync(join(projectRoot, "docker-compose.yml")), true);
    assert.equal(existsSync(join(projectRoot, ".env.example")), true);
    assert.equal(existsSync(join(projectRoot, "nginx/default.conf")), true);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
