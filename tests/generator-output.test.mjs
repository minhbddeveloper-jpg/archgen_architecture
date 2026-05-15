import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function readNormalized(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

test("generates TypeScript Express clean architecture output with ports and specific use cases", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

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

    const controller = readNormalized(join(projectRoot, "src/presentation/controllers/studentController.ts"));
    assert.match(controller, /CreateStudentUseCase/);
    assert.match(controller, /ListStudentsUseCase/);
    assert.doesNotMatch(controller, /StudentService/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates setup and ORM artifacts when requested", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

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
    assert.equal(existsSync(join(projectRoot, "prisma/migrations/README.md")), true);
    assert.equal(existsSync(join(projectRoot, "prisma/seed.ts")), true);
    assert.equal(existsSync(join(projectRoot, "docker-compose.yml")), true);
    assert.equal(existsSync(join(projectRoot, ".env.example")), true);
    assert.equal(existsSync(join(projectRoot, "nginx/default.conf")), true);
    assert.equal(existsSync(join(projectRoot, ".github/workflows/ci.yml")), true);
    assert.equal(existsSync(join(projectRoot, "src/shared/config/environment.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/middleware/errorHandler.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/routes/openApiRoutes.ts")), true);
    assert.equal(existsSync(join(projectRoot, "tests/unit/generated.test.ts")), true);
    assert.equal(existsSync(join(projectRoot, "tests/integration/http.test.ts")), true);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("adds a new TypeScript Express entity to an existing project and merges routes", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
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
        join(process.cwd(), "dist/bin/arxgen.js"),
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

    const main = readNormalized(join(projectRoot, "src/main.ts"));
    assert.match(main, /createStudentRouter/);
    assert.match(main, /app\.use\("\/students", createStudentRouter\(\)\)/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates auth, validation, pagination, and relation support for TypeScript Express", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
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

    const schema = readNormalized(join(projectRoot, "prisma/schema.prisma"));
    assert.match(schema, /studentId String/);
    assert.match(schema, /student Student @relation/);

    const main = readNormalized(join(projectRoot, "src/main.ts"));
    assert.match(main, /app\.use\("\/auth", createAuthRouter\(\)\)/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates NestJS clean architecture module output", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

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
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "nest-school");
    assert.equal(existsSync(join(projectRoot, "src/modules/students/students.module.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/modules/students/presentation/students.controller.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/modules/students/application/ports/studentRepository.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/common/filters/http-exception.filter.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/common/interceptors/response.interceptor.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/auth/permissions.guard.ts")), true);
    assert.equal(existsSync(join(projectRoot, ".github/workflows/ci.yml")), true);

    const main = readNormalized(join(projectRoot, "src/main.ts"));
    assert.match(main, /SwaggerModule/);
    assert.match(main, /ValidationPipe/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generated file snapshots stay stable for core Express and NestJS outputs", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
        "create",
        "--name",
        "course-api",
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
        "--validation",
        "zod",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

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

    const comparisons = [
      ["course-api/src/presentation/controllers/studentController.ts", "express-student-controller.ts.snap"],
      ["course-api/src/application/use-cases/listStudentsUseCase.ts", "express-list-students-usecase.ts.snap"],
      ["nest-school/src/modules/students/presentation/students.controller.ts", "nestjs-students-controller.ts.snap"],
      ["nest-school/src/modules/students/application/student.service.ts", "nestjs-student-service.ts.snap"]
    ];

    for (const [generated, snapshot] of comparisons) {
      assert.equal(
        readNormalized(join(outputRoot, generated)),
        readNormalized(join(process.cwd(), "tests", "snapshots", snapshot)),
        `${generated} should match ${snapshot}`
      );
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("add entity route merge snapshot stays stable", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
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
        join(process.cwd(), "dist/bin/arxgen.js"),
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

    assert.equal(
      readNormalized(join(projectRoot, "src/main.ts")),
      readNormalized(join(process.cwd(), "tests", "snapshots", "add-entity-main.ts.snap"))
    );
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
