import { GeneratedFile } from "../domain/generatedFile.js";
import { Plugin } from "../domain/plugin.js";
import { EntityConfig, EntityFieldConfig, FieldType, ProjectConfig } from "../domain/projectConfig.js";
import { FileWriter, WriteFilesOptions } from "./ports/fileWriter.js";

export interface CreateProjectResult {
  outputRoot: string;
  filesWritten: number;
  dryRun: boolean;
}

export class GeneratorEngine {
  constructor(
    private readonly plugins: Plugin[],
    private readonly fileWriter: FileWriter
  ) {}

  async createProject(
    config: ProjectConfig,
    outputRoot: string,
    options: WriteFilesOptions = {}
  ): Promise<CreateProjectResult> {
    if (config.fullstack) {
      const files = await this.generateFullstackFiles(config);
      await this.fileWriter.writeFiles(outputRoot, files, options);

      return {
        outputRoot,
        filesWritten: files.length,
        dryRun: options.dryRun ?? false
      };
    }

    const files = await this.generateStackFiles(config);
    files.push(...generateOrmFiles(config, config.projectName));
    files.push(...generateSetupFiles(config, config.projectName));
    await this.fileWriter.writeFiles(outputRoot, files, options);

    return {
      outputRoot,
      filesWritten: files.length,
      dryRun: options.dryRun ?? false
    };
  }

  private async generateStackFiles(config: ProjectConfig): Promise<GeneratedFile[]> {
    const plugin = this.plugins.find((candidate) => candidate.supports(config));

    if (!plugin) {
      throw new Error(`No plugin supports ${config.language}/${config.framework}/${config.architecture}`);
    }

    const files: GeneratedFile[] = [];
    for (const generator of plugin.getGenerators()) {
      files.push(...(await generator.generate(config)));
    }

    return files;
  }

  private async generateFullstackFiles(config: ProjectConfig): Promise<GeneratedFile[]> {
    if (!config.fullstack) {
      return [];
    }

    const frontendConfig: ProjectConfig = {
      ...config,
      projectName: "web",
      language: config.fullstack.frontend.language,
      framework: config.fullstack.frontend.framework,
      entities: undefined,
      fullstack: undefined
    };
    const backendConfig: ProjectConfig = {
      ...config,
      projectName: "api",
      language: config.fullstack.backend.language,
      framework: config.fullstack.backend.framework,
      fullstack: undefined
    };

    return [
      ...(await this.generateStackFiles(frontendConfig)).map((file) => prefixFile(config.projectName, file)),
      ...(await this.generateStackFiles(backendConfig)).map((file) => prefixFile(config.projectName, file)),
      ...generateOrmFiles(backendConfig, `${config.projectName}/api`),
      ...generateSetupFiles(config, config.projectName, true)
    ];
  }
}

function prefixFile(root: string, file: GeneratedFile): GeneratedFile {
  return {
    path: `${root}/${file.path}`,
    content: file.content
  };
}

function generateSetupFiles(config: ProjectConfig, root: string, fullstack = false): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (config.docker || config.database || config.redis) {
    files.push({
      path: `${root}/.env.example`,
      content: envExample(config)
    });
    files.push({
      path: `${root}/docker-compose.yml`,
      content: dockerCompose(config, fullstack)
    });
  }

  if (config.docker) {
    if (fullstack) {
      files.push({ path: `${root}/web/Dockerfile`, content: nodeDockerfile("npm run dev", "5173") });
      files.push({ path: `${root}/api/Dockerfile`, content: backendDockerfile(config.fullstack?.backend.framework ?? config.framework) });
    } else {
      files.push({ path: `${root}/Dockerfile`, content: backendDockerfile(config.framework) });
    }
  }

  if (config.nginx) {
    files.push({
      path: `${root}/nginx/default.conf`,
      content: nginxConfig(fullstack)
    });
  }

  return files;
}

function generateOrmFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  if (!config.orm || !config.entities?.length) {
    return [];
  }

  const orm = config.orm.toLowerCase();
  if (config.language === "typescript" && orm === "prisma") return prismaFiles(config, root);
  if (config.language === "python" && orm === "sqlalchemy") return sqlalchemyFiles(config, root);
  if (config.language === "csharp" && orm === "efcore") return efCoreFiles(config, root);
  if (config.language === "java" && orm === "jpa") return springJpaFiles(config, root);
  if (config.language === "go" && orm === "gorm") return gormFiles(config, root);
  if (config.language === "php" && orm === "eloquent") return eloquentFiles(config, root);
  return [
    {
      path: `${root}/ORM_NOT_SUPPORTED.md`,
      content: `# ORM not supported

The requested ORM \`${config.orm}\` is not currently mapped for ${config.language}/${config.framework}.
`
    }
  ];
}

function prismaFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  const provider = config.database === "mysql" ? "mysql" : config.database === "mongodb" ? "mongodb" : "postgresql";
  return [
    {
      path: `${root}/prisma/schema.prisma`,
      content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

${config.entities?.map(prismaModel).join("\n\n") ?? ""}
`
    }
  ];
}

function prismaModel(entity: EntityConfig): string {
  return `model ${pascal(entity.name)} {
  id String @id @default(uuid())
${entity.fields.map((field) => `  ${camel(field.name)} ${prismaType(field)}`).join("\n")}
}`;
}

function prismaType(field: EntityFieldConfig): string {
  const suffix = field.required === false ? "?" : "";
  if (field.type === "number") return `Float${suffix}`;
  if (field.type === "boolean") return `Boolean${suffix}`;
  if (field.type === "date") return `DateTime${suffix}`;
  return `String${suffix}`;
}

function sqlalchemyFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  return [
    {
      path: `${root}/app/infrastructure/database.py`,
      content: `import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass
`
    },
    ...(config.entities?.map((entity) => ({
      path: `${root}/app/infrastructure/models/${snake(entity.name)}_model.py`,
      content: `from sqlalchemy import Boolean, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database import Base


class ${pascal(entity.name)}Model(Base):
    __tablename__ = "${plural(snake(entity.name))}"

    id: Mapped[str] = mapped_column(String, primary_key=True)
${entity.fields.map(sqlalchemyColumn).join("\n")}
`
    })) ?? [])
  ];
}

function sqlalchemyColumn(field: EntityFieldConfig): string {
  const columnType = field.type === "number" ? "Float" : field.type === "boolean" ? "Boolean" : "String";
  return `    ${snake(field.name)}: Mapped[${pythonType(field.type)}] = mapped_column(${columnType}, nullable=${field.required === false ? "True" : "False"})`;
}

function efCoreFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  const projectName = pascal(config.projectName);
  return [
    {
      path: `${root}/Infrastructure/Persistence/AppDbContext.cs`,
      content: `namespace ${projectName}.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using ${projectName}.Domain.Entities;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

${config.entities?.map((entity) => `    public DbSet<${pascal(entity.name)}> ${plural(pascal(entity.name))} => Set<${pascal(entity.name)}>();`).join("\n") ?? ""}
}
`
    }
  ];
}

function springJpaFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  const packageName = `com.example.${kebab(config.projectName).replaceAll("-", ".")}`;
  const packagePath = packageName.replaceAll(".", "/");
  return config.entities?.map((entity) => ({
    path: `${root}/src/main/java/${packagePath}/infrastructure/repositories/${pascal(entity.name)}JpaRepository.java`,
    content: `package ${packageName}.infrastructure.repositories;

import ${packageName}.domain.entities.${pascal(entity.name)};
import org.springframework.data.jpa.repository.JpaRepository;

public interface ${pascal(entity.name)}JpaRepository extends JpaRepository<${pascal(entity.name)}, String> {
}
`
  })) ?? [];
}

function gormFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  return [
    {
      path: `${root}/internal/repository/database.go`,
      content: `package repository

import (
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func OpenDatabase() (*gorm.DB, error) {
	return gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
}
`
    },
    ...(config.entities?.map((entity) => ({
      path: `${root}/internal/repository/${snake(entity.name)}_model.go`,
      content: `package repository

type ${pascal(entity.name)}Model struct {
	ID string \`gorm:"primaryKey" json:"id"\`
${entity.fields.map((field) => `\t${pascal(field.name)} ${goType(field.type)} \`json:"${camel(field.name)}"\``).join("\n")}
}
`
    })) ?? [])
  ];
}

function eloquentFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  return config.entities?.flatMap((entity) => [
    {
      path: `${root}/app/Models/${pascal(entity.name)}.php`,
      content: `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class ${pascal(entity.name)} extends Model
{
    protected $fillable = [${entity.fields.map((field) => `'${snake(field.name)}'`).join(", ")}];
}
`
    },
    {
      path: `${root}/database/migrations/0000_00_00_000000_create_${plural(snake(entity.name))}_table.php`,
      content: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('${plural(snake(entity.name))}', function (Blueprint $table) {
            $table->uuid('id')->primary();
${entity.fields.map(eloquentColumn).join("\n")}
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('${plural(snake(entity.name))}');
    }
};
`
    }
  ]) ?? [];
}

function eloquentColumn(field: EntityFieldConfig): string {
  const nullable = field.required === false ? "->nullable()" : "";
  if (field.type === "number") return `            $table->decimal('${snake(field.name)}')${nullable};`;
  if (field.type === "boolean") return `            $table->boolean('${snake(field.name)}')${nullable};`;
  if (field.type === "date") return `            $table->timestamp('${snake(field.name)}')${nullable};`;
  if (field.type === "text") return `            $table->text('${snake(field.name)}')${nullable};`;
  return `            $table->string('${snake(field.name)}')${nullable};`;
}

function envExample(config: ProjectConfig): string {
  const database = config.database ?? "postgres";
  return [
    "APP_ENV=development",
    "API_PORT=3000",
    "WEB_PORT=5173",
    database === "postgres" ? "DATABASE_URL=postgres://archgen:archgen@db:5432/archgen" : undefined,
    database === "mysql" ? "DATABASE_URL=mysql://archgen:archgen@db:3306/archgen" : undefined,
    database === "mongodb" ? "DATABASE_URL=mongodb://db:27017/archgen" : undefined,
    config.redis ? "REDIS_URL=redis://redis:6379" : undefined
  ].filter(Boolean).join("\n") + "\n";
}

function dockerCompose(config: ProjectConfig, fullstack: boolean): string {
  const services: string[] = [];
  if (fullstack) {
    services.push(`  web:
    build: ./web
    env_file: .env.example
    ports:
      - "\${WEB_PORT:-5173}:5173"
    depends_on:
      - api`);
    services.push(`  api:
    build: ./api
    env_file: .env.example
    ports:
      - "\${API_PORT:-3000}:3000"`);
  } else {
    services.push(`  app:
    build: .
    env_file: .env.example
    ports:
      - "\${API_PORT:-3000}:3000"`);
  }
  if (config.database) services.push(databaseService(config.database));
  if (config.redis) services.push(`  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"`);
  if (config.nginx) services.push(`  nginx:
    image: nginx:1.27-alpine
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "8080:80"
    depends_on:
      - ${fullstack ? "web\n      - api" : "app"}`);
  return `services:\n${services.join("\n")}\n`;
}

function databaseService(database: string): string {
  if (database === "mysql") {
    return `  db:
    image: mysql:8
    environment:
      MYSQL_DATABASE: archgen
      MYSQL_USER: archgen
      MYSQL_PASSWORD: archgen
      MYSQL_ROOT_PASSWORD: archgen
    ports:
      - "3306:3306"`;
  }
  if (database === "mongodb") {
    return `  db:
    image: mongo:7
    ports:
      - "27017:27017"`;
  }
  return `  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: archgen
      POSTGRES_USER: archgen
      POSTGRES_PASSWORD: archgen
    ports:
      - "5432:5432"`;
}

function nodeDockerfile(command: string, port: string): string {
  return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE ${port}
CMD ${JSON.stringify(command.split(" "))}
`;
}

function backendDockerfile(framework: string): string {
  if (framework === "aspnetcore") {
    return `FROM mcr.microsoft.com/dotnet/sdk:10.0
WORKDIR /app
COPY . .
RUN dotnet restore
EXPOSE 3000
CMD ["dotnet", "run", "--urls", "http://0.0.0.0:3000"]
`;
  }
  if (framework === "fastapi") {
    return `FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install -e .
EXPOSE 3000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
`;
  }
  return nodeDockerfile("npm run dev", "3000");
}

function nginxConfig(fullstack: boolean): string {
  if (fullstack) {
    return `server {
  listen 80;
  location /api/ {
    proxy_pass http://api:3000/;
  }
  location / {
    proxy_pass http://web:5173;
  }
}
`;
  }

  return `server {
  listen 80;
  location / {
    proxy_pass http://app:3000;
  }
}
`;
}

function pascal(value: string): string {
  return (value.match(/[a-zA-Z0-9]+/g) ?? ["App"]).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join("");
}

function camel(value: string): string {
  const name = pascal(value);
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function snake(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "app";
}

function kebab(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
}

function plural(value: string): string {
  if (value.endsWith("y")) return `${value.slice(0, -1)}ies`;
  if (value.endsWith("s")) return `${value}es`;
  return `${value}s`;
}

function pythonType(type: FieldType): string {
  if (type === "number") return "float";
  if (type === "boolean") return "bool";
  return "str";
}

function goType(type: FieldType): string {
  if (type === "number") return "float64";
  if (type === "boolean") return "bool";
  return "string";
}
