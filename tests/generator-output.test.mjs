import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
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

    const compose = readNormalized(join(projectRoot, "docker-compose.yml"));
    assert.match(compose, /\$\{POSTGRES_PORT:-5432\}:5432/);

    const repository = readNormalized(join(projectRoot, "src/infrastructure/repositories/studentRepository.ts"));
    assert.match(repository, /PrismaClient/);
    assert.match(repository, /prisma\.student\.findMany/);
    assert.match(repository, /prisma\.student\.upsert/);

    const controller = readNormalized(join(projectRoot, "src/presentation/controllers/studentController.ts"));
    assert.match(controller, /await listStudents\.execute/);

    const readme = readNormalized(join(projectRoot, "README.md"));
    assert.match(readme, /npx prisma generate/);
    assert.match(readme, /npx prisma migrate dev --name init/);
    assert.match(readme, /API Examples/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("doctor reports actionable environment checks", () => {
  const output = execFileSync(
    process.execPath,
    ["dist/bin/arxgen.js", "doctor"],
    { cwd: process.cwd(), stdio: "pipe", encoding: "utf8" }
  );

  assert.match(output, /arxgen doctor/);
  assert.match(output, /Node\.js version/);
  assert.match(output, /npm version/);
  assert.match(output, /Output folder permission/);
  assert.match(output, /Docker availability/);
  assert.match(output, /Database config/);
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
    assert.equal(existsSync(join(projectRoot, "src/application/use-cases/refreshTokenUseCase.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/application/use-cases/logoutUseCase.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/infrastructure/security/tokenProvider.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/domain/relations.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/application/dtos/relationDto.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/infrastructure/repositories/includeOptions.ts")), true);
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

test("add entity updates Prisma schema and infrastructure container when merging", () => {
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
        "--entity",
        "student",
        "--field",
        "name:string",
        "--database",
        "postgres",
        "--orm",
        "prisma",
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
        "course",
        "--field",
        "title:string",
        "--project",
        projectRoot,
        "--merge"
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const schema = readNormalized(join(projectRoot, "prisma/schema.prisma"));
    assert.match(schema, /model Course/);
    assert.match(schema, /title String/);

    const container = readNormalized(join(projectRoot, "src/infrastructure/container.ts"));
    assert.match(container, /CourseRepository/);
    assert.match(container, /courseRepository/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("creates a SaaS preset without requiring language and framework flags", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));

  try {
    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
        "create",
        "--preset",
        "saas",
        "--name",
        "preset-api",
        "--entity",
        "student",
        "--field",
        "name:string",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "preset-api");
    assert.equal(existsSync(join(projectRoot, "src/domain/entities/Student.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/routes/authRoutes.ts")), true);
    assert.equal(existsSync(join(projectRoot, "prisma/schema.prisma")), true);
    assert.equal(existsSync(join(projectRoot, "docker-compose.yml")), true);
    assert.equal(existsSync(join(projectRoot, "nginx/default.conf")), true);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates entities and relations from a SQL schema file", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));
  const sqlPath = join(outputRoot, "schema.sql");

  try {
    writeFileSync(sqlPath, `CREATE TABLE students (
  id uuid primary key,
  name varchar(120) not null,
  email varchar(180),
  age int
);

CREATE TABLE courses (
  id uuid primary key,
  title text not null,
  student_id uuid not null,
  foreign key (student_id) references students(id)
);
`, "utf8");

    execFileSync(
      process.execPath,
      [
        "dist/bin/arxgen.js",
        "create",
        "--name",
        "sql-api",
        "--language",
        "typescript",
        "--framework",
        "express",
        "--database",
        "postgres",
        "--orm",
        "prisma",
        "--from-sql",
        sqlPath,
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const projectRoot = join(outputRoot, "sql-api");
    assert.equal(existsSync(join(projectRoot, "src/domain/entities/Student.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/domain/entities/Course.ts")), true);

    const student = readNormalized(join(projectRoot, "src/domain/entities/Student.ts"));
    assert.match(student, /name: string/);
    assert.match(student, /email\?: string/);
    assert.match(student, /age\?: number/);

    const schema = readNormalized(join(projectRoot, "prisma/schema.prisma"));
    assert.match(schema, /model Course/);
    assert.match(schema, /studentId String/);
    assert.match(schema, /student Student @relation/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("adds entities from a SQL schema file to an existing Express project", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));
  const sqlPath = join(outputRoot, "schema.sql");

  try {
    writeFileSync(sqlPath, `CREATE TABLE teachers (
  id uuid primary key,
  full_name varchar(120) not null,
  active boolean not null
);
`, "utf8");

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
        "--database",
        "postgres",
        "--orm",
        "prisma",
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
        "schema",
        "--from-sql",
        sqlPath,
        "--project",
        projectRoot,
        "--validation",
        "zod"
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    assert.equal(existsSync(join(projectRoot, "src/domain/entities/Teacher.ts")), true);
    assert.equal(existsSync(join(projectRoot, "src/presentation/validation/teacherSchemas.ts")), true);

    const main = readNormalized(join(projectRoot, "src/main.ts"));
    assert.match(main, /createTeacherRouter/);
    assert.match(main, /app\.use\("\/teachers", createTeacherRouter\(\)\)/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("upgrades an existing Express project from a changed SQL schema", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));
  const sqlPath = join(outputRoot, "schema.sql");

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
        "--validation",
        "zod",
        "--out",
        outputRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    writeFileSync(sqlPath, `CREATE TABLE students (
  id uuid primary key,
  name varchar(120) not null,
  email varchar(180) not null,
  phone varchar(40),
  age int
);
`, "utf8");

    const projectRoot = join(outputRoot, "school-api");
    const dryRunOutput = execFileSync(
      process.execPath,
      [
        join(process.cwd(), "dist/bin/arxgen.js"),
        "upgrade",
        "schema",
        "--from-sql",
        sqlPath,
        "--project",
        projectRoot,
        "--dry-run"
      ],
      { cwd: process.cwd(), stdio: "pipe", encoding: "utf8" }
    );
    assert.match(dryRunOutput, /Schema upgrade preview/);
    assert.match(dryRunOutput, /\+ phone:string\?/);
    assert.doesNotMatch(readNormalized(join(projectRoot, "src/domain/entities/Student.ts")), /phone/);

    execFileSync(
      process.execPath,
      [
        join(process.cwd(), "dist/bin/arxgen.js"),
        "upgrade",
        "schema",
        "--from-sql",
        sqlPath,
        "--project",
        projectRoot
      ],
      { cwd: process.cwd(), stdio: "pipe" }
    );

    const entity = readNormalized(join(projectRoot, "src/domain/entities/Student.ts"));
    assert.match(entity, /phone\?: string/);
    assert.match(entity, /age\?: number/);

    const schema = readNormalized(join(projectRoot, "src/presentation/validation/studentSchemas.ts"));
    assert.match(schema, /phone: z\.string\(\)\.optional\(\)/);
    assert.match(schema, /age: z\.number\(\)\.optional\(\)/);

    const createUseCase = readNormalized(join(projectRoot, "src/application/use-cases/createStudentUseCase.ts"));
    assert.match(createUseCase, /phone: input\.phone/);
    assert.match(createUseCase, /age: input\.age/);

    const prismaSchema = readNormalized(join(projectRoot, "prisma/schema.prisma"));
    assert.match(prismaSchema, /phone String\?/);
    assert.match(prismaSchema, /age Float\?/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("upgrades existing generated backend entities from a changed SQL schema", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));
  const sqlPath = join(outputRoot, "schema.sql");
  const cases = [
    {
      name: "nestjs-api",
      language: "typescript",
      framework: "nestjs",
      file: "src/modules/students/domain/Student.ts",
      expected: [/phone\?: string/, /age\?: number/],
      createdFile: "src/modules/courses/domain/Course.ts",
      registrationFile: "src/app.module.ts",
      registrationExpected: /CoursesModule/
    },
    {
      name: "fastapi-api",
      language: "python",
      framework: "fastapi",
      file: "app/domain/models/student.py",
      expected: [/phone: str \| None = None/, /age: float \| None = None/],
      createdFile: "app/domain/models/course.py",
      registrationFile: "app/main.py",
      registrationExpected: /course_router/
    },
    {
      name: "django-api",
      language: "python",
      framework: "django",
      file: "domain/models/student.py",
      expected: [/phone: str/, /age: float/],
      createdFile: "domain/models/course.py",
      registrationFile: "config/urls.py",
      registrationExpected: /course_collection/
    },
    {
      name: "spring-api",
      language: "java",
      framework: "spring",
      file: "src/main/java/com/example/spring/api/domain/entities/Student.java",
      expected: [/private String phone/, /private Double age/],
      createdFile: "src/main/java/com/example/spring/api/domain/entities/Course.java"
    },
    {
      name: "dotnet-api",
      language: "csharp",
      framework: "aspnetcore",
      file: "Domain/Entities/Student.cs",
      expected: [/public string\? Phone/, /public decimal Age/],
      createdFile: "Domain/Entities/Course.cs",
      registrationFile: "Program.cs",
      registrationExpected: /courseService/
    },
    {
      name: "laravel-api",
      language: "php",
      framework: "laravel",
      file: "app/Domain/Entities/Student.php",
      expected: [/public \?string \$phone/, /public \?float \$age/],
      createdFile: "app/Domain/Entities/Course.php",
      registrationFile: "routes/api.php",
      registrationExpected: /CourseController/
    },
    {
      name: "gin-api",
      language: "go",
      framework: "gin",
      file: "internal/domain/student.go",
      expected: [/Phone string `json:"phone"`/, /Age float64 `json:"age"`/],
      createdFile: "internal/domain/course.go",
      registrationFile: "cmd/api/main.go",
      registrationExpected: /RegisterCourseRoutes/
    },
    {
      name: "rails-api",
      language: "ruby",
      framework: "rails",
      file: "app/domain/entities/student.rb",
      expected: [/:phone/, /:age/],
      createdFile: "app/domain/entities/course.rb",
      registrationFile: "config/routes.rb",
      registrationExpected: /resources :courses/
    },
    {
      name: "ktor-api",
      language: "kotlin",
      framework: "ktor",
      file: "src/main/kotlin/com/example/ktor/api/domain/entities/Student.kt",
      expected: [/val phone: String\? = null/, /val age: Double\? = null/],
      createdFile: "src/main/kotlin/com/example/ktor/api/domain/entities/Course.kt",
      registrationFile: "src/main/kotlin/com/example/ktor/api/Application.kt",
      registrationExpected: /registerCourseRoutes/
    }
  ];

  try {
    writeFileSync(sqlPath, `CREATE TABLE students (
  id uuid primary key,
  name varchar(120) not null,
  phone varchar(40),
  age int
);

CREATE TABLE courses (
  id uuid primary key,
  title varchar(160) not null
);
`, "utf8");

    for (const stack of cases) {
      execFileSync(
        process.execPath,
        [
          "dist/bin/arxgen.js",
          "create",
          "--name",
          stack.name,
          "--language",
          stack.language,
          "--framework",
          stack.framework,
          "--entity",
          "student",
          "--field",
          "name:string",
          "--out",
          outputRoot
        ],
        { cwd: process.cwd(), stdio: "pipe" }
      );

      const projectRoot = join(outputRoot, stack.name);
      const preview = execFileSync(
        process.execPath,
        [
          join(process.cwd(), "dist/bin/arxgen.js"),
          "upgrade",
          "schema",
          "--from-sql",
          sqlPath,
          "--project",
          projectRoot,
          "--dry-run"
        ],
        { cwd: process.cwd(), stdio: "pipe", encoding: "utf8" }
      );
      assert.match(preview, /Schema upgrade preview/);
      assert.match(preview, /\+ phone:string\?/);

      execFileSync(
        process.execPath,
        [
          join(process.cwd(), "dist/bin/arxgen.js"),
          "upgrade",
          "schema",
          "--from-sql",
          sqlPath,
          "--project",
          projectRoot
        ],
        { cwd: process.cwd(), stdio: "pipe" }
      );

      const content = readNormalized(join(projectRoot, stack.file));
      for (const expected of stack.expected) {
        assert.match(content, expected, `${stack.framework} should patch ${stack.file}`);
      }
      assert.equal(existsSync(join(projectRoot, stack.createdFile)), true, `${stack.framework} should create ${stack.createdFile}`);
      if (stack.registrationFile && stack.registrationExpected) {
        assert.match(readNormalized(join(projectRoot, stack.registrationFile)), stack.registrationExpected);
      }
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("generates full CRUD layers for all backend stacks", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "arxgen-test-"));
  const cases = [
    {
      name: "fastapi-api",
      language: "python",
      framework: "fastapi",
      files: [
        "app/domain/models/student.py",
        "app/application/services/student_service.py",
        "app/infrastructure/repositories/student_repository.py",
        "app/presentation/routers/student_router.py"
      ]
    },
    {
      name: "django-api",
      language: "python",
      framework: "django",
      files: [
        "domain/models/student.py",
        "application/services/student_service.py",
        "infrastructure/repositories/student_repository.py",
        "presentation/serializers/student_serializer.py",
        "presentation/views/student_views.py"
      ]
    },
    {
      name: "spring-api",
      language: "java",
      framework: "spring",
      files: [
        "src/main/java/com/example/spring/api/domain/entities/Student.java",
        "src/main/java/com/example/spring/api/application/services/StudentService.java",
        "src/main/java/com/example/spring/api/infrastructure/repositories/StudentRepository.java",
        "src/main/java/com/example/spring/api/presentation/controllers/StudentController.java"
      ]
    },
    {
      name: "dotnet-api",
      language: "csharp",
      framework: "aspnetcore",
      files: [
        "Domain/Entities/Student.cs",
        "Application/Services/StudentService.cs",
        "Infrastructure/Repositories/StudentRepository.cs",
        "Presentation/Controllers/StudentController.cs"
      ]
    },
    {
      name: "laravel-api",
      language: "php",
      framework: "laravel",
      files: [
        "app/Domain/Entities/Student.php",
        "app/Application/Services/StudentService.php",
        "app/Infrastructure/Repositories/StudentRepository.php",
        "app/Http/Controllers/StudentController.php"
      ]
    },
    {
      name: "gin-api",
      language: "go",
      framework: "gin",
      files: [
        "internal/domain/student.go",
        "internal/usecase/student_usecase.go",
        "internal/repository/student_repository.go",
        "internal/handler/student_handler.go"
      ]
    },
    {
      name: "rails-api",
      language: "ruby",
      framework: "rails",
      files: [
        "app/domain/entities/student.rb",
        "app/application/services/student_service.rb",
        "app/infrastructure/repositories/student_repository.rb",
        "app/controllers/students_controller.rb"
      ]
    },
    {
      name: "ktor-api",
      language: "kotlin",
      framework: "ktor",
      files: [
        "src/main/kotlin/com/example/ktor/api/domain/entities/Student.kt",
        "src/main/kotlin/com/example/ktor/api/application/services/StudentService.kt",
        "src/main/kotlin/com/example/ktor/api/infrastructure/repositories/StudentRepository.kt",
        "src/main/kotlin/com/example/ktor/api/presentation/routes/StudentRoutes.kt"
      ]
    }
  ];

  try {
    for (const stack of cases) {
      execFileSync(
        process.execPath,
        [
          "dist/bin/arxgen.js",
          "create",
          "--name",
          stack.name,
          "--language",
          stack.language,
          "--framework",
          stack.framework,
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

      const projectRoot = join(outputRoot, stack.name);
      for (const file of stack.files) {
        assert.equal(existsSync(join(projectRoot, file)), true, `${stack.framework} should generate ${file}`);
      }
    }
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
