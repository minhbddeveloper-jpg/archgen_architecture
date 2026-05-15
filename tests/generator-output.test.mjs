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

test("adds a new TypeScript Express entity to an existing project and merges routes", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "archgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/archgen.js",
        "create",
        "--name",
        "school-api",
        "--language",
        "typescript",
        "--framework",
        "express",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "school-api");
    execFileSync(
      process.execPath,
      [
        join(process.cwd(), "dist/bin/archgen.js"),
        "add",
        "entity",
        "student",
        "--field",
        "name:string",
        "--field",
        "email:string",
        "--project",
        projectRoot,
        "--validation",
        "zod",
        "--merge"
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    assert.equal(existsSync(join(projectRoot, "src/domain/entities/Student.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/application/dtos/studentDto.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/validation/studentSchemas.ts")), true);

    const main = readFileSync(join(projectRoot, "src/main.ts"), "utf8");
    assert.match(main, /createStudentRouter/);
    assert.match(main, /app\.use\("\/students", createStudentRouter\(\)\)/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates auth, validation, pagination, and relation support for TypeScript Express", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "archgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/archgen.js",
        "create",
        "--name",
        "course-api",
        "--language",
        "typescript",
        "--framework",
        "express",
        "--entity",
        "student",
        "--entity",
        "course",
        "--field",
        "student.name:string",
        "--field",
        "course.title:string",
        "--database",
        "postgres",
        "--orm",
        "prisma",
        "--relation",
        "course.student:many-to-one",
        "--validation",
        "zod",
        "--auth",
        "jwt",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "course-api");
    assert.equal(existsSync(join(projectRoot, "src/presentation/routes/authRoutes.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/middleware/authMiddleware.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/application/dtos/studentDto.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/validation/studentSchemas.ts")), true);

    const schema = readFileSync(join(projectRoot, "prisma/schema.prisma"), "utf8");
    assert.match(schema, /studentId String/);
    assert.match(schema, /student Student @relation/);

    const main = readFileSync(join(projectRoot, "src/main.ts"), "utf8");
    assert.match(main, /app\.use\("\/auth", createAuthRouter\(\)\)/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates NestJS clean architecture module output", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "archgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/archgen.js",
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
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "nest-school");
    assert.equal(existsSync(join(projectRoot, "src/modules/students/students.module.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/modules/students/presentation/students.controller.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/modules/students/application/ports/studentRepository.ts")), true);

    const main = readFileSync(join(projectRoot, "src/main.ts"), "utf8");
    assert.match(main, /SwaggerModule/);
    assert.match(main, /ValidationPipe/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
