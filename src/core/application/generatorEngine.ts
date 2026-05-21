import { GeneratedFile } from "../domain/generatedFile.js";
import { Plugin } from "../domain/plugin.js";
import { EntityConfig, EntityFieldConfig, FieldType, ProjectConfig, ValidationProvider } from "../domain/projectConfig.js";
import { FileWriter, WriteFilesOptions } from "./ports/fileWriter.js";
import { GenerationPipeline } from "./generationPipeline.js";

export interface CreateProjectResult {
  outputRoot: string;
  filesWritten: number;
  dryRun: boolean;
}

export class GeneratorEngine {
  constructor(
    private readonly plugins: Plugin[],
    private readonly fileWriter: FileWriter,
    private readonly pipeline = createDefaultGenerationPipeline()
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

    const files = [
      ...(await this.generateStackFiles(config)),
      ...(await this.pipeline.run(config, config.projectName))
    ];
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
      ...(await this.pipeline.run(backendConfig, `${config.projectName}/api`, false, { skip: ["setup"] })),
      ...(await this.pipeline.run(config, config.projectName, true, { only: ["setup"] }))
    ];
  }
}

function createDefaultGenerationPipeline(): GenerationPipeline {
  return new GenerationPipeline([
    { name: "orm", generate: ({ config, root }) => generateOrmFiles(config, root) },
    { name: "api-quality", generate: ({ config, root }) => generateApiQualityFiles(config, root) },
    { name: "auth", generate: ({ config, root }) => generateAuthFiles(config, root) },
    { name: "relations", generate: ({ config, root }) => generateRelationSupportFiles(config, root) },
    { name: "production-scaffold", generate: ({ config, root }) => generateProductionScaffoldFiles(config, root) },
    { name: "setup", generate: ({ config, root, fullstack }) => generateSetupFiles(config, root, fullstack) }
  ]);
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

function generateApiQualityFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  if (config.language !== "typescript" || config.framework !== "express" || !config.entities?.length) {
    return [];
  }

  const files: GeneratedFile[] = [
    {
      path: `${root}/src/shared/apiResponse.ts`,
      content: `export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export function ok<T>(message: string, data: T): ApiResponse<T> {
  return { success: true, message, data };
}
`
    }
  ];

  for (const entity of config.entities) {
    const className = pascal(entity.name);
    const camelName = camel(entity.name);
    files.push({
      path: `${root}/src/application/dtos/${camelName}Dto.ts`,
      content: `import { ${className} } from "../../domain/entities/${className}.js";

export type Create${className}Dto = Omit<${className}, "id">;
export type Update${className}Dto = Partial<Create${className}Dto>;
export type ${className}ResponseDto = ${className};

export interface PaginationQueryDto {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
}

export interface FilterDto {
  field: string;
  value: string;
}

export interface SortDto {
  field: string;
  direction: "asc" | "desc";
}
`
    });

    if (config.validation) {
      files.push({
        path: `${root}/src/presentation/validation/${camelName}Schemas.ts`,
        content: validationSchemaFile(entity, config.validation)
      });
    }
  }

  return files;
}

function generateAuthFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  if (config.auth !== "jwt" || config.language !== "typescript" || config.framework !== "express") {
    return [];
  }

  const productionAuth = config.authMode === "production";
  const files: GeneratedFile[] = [
    {
      path: `${root}/src/domain/entities/User.ts`,
      content: `export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenId?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
}
`
    },
    {
      path: `${root}/src/application/ports/userRepositoryPort.ts`,
      content: `import { User } from "../../domain/entities/User.js";

export interface UserRepositoryPort {
  findByEmail(email: string): User | undefined;
  findById(id: string): User | undefined;
  save(user: User): User;
}
`
    },
    {
      path: `${root}/src/infrastructure/repositories/userRepository.ts`,
      content: `import { UserRepositoryPort } from "../../application/ports/userRepositoryPort.js";
import { User } from "../../domain/entities/User.js";

export class UserRepository implements UserRepositoryPort {
  private readonly users = new Map<string, User>();

  findByEmail(email: string): User | undefined {
    return [...this.users.values()].find((user) => user.email === email);
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  save(user: User): User {
    this.users.set(user.id, user);
    return user;
  }
}
`
    },
    {
      path: `${root}/src/infrastructure/security/passwordHasher.ts`,
      content: `import bcrypt from "bcryptjs";

export class PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
`
    },
    {
      path: `${root}/src/infrastructure/security/argon2PasswordHasher.ts`,
      content: `import { PasswordHasher } from "./passwordHasher.js";

export class Argon2PasswordHasher extends PasswordHasher {
  // bcryptjs is the default generated dependency. Replace this class with
  // a real argon2 implementation after adding the argon2 package.
}
`
    },
    {
      path: `${root}/src/infrastructure/security/jwtService.ts`,
      content: jwtServiceFile(productionAuth)
    },
    {
      path: `${root}/src/infrastructure/security/tokenProvider.ts`,
      content: `import { User } from "../../domain/entities/User.js";
import { AuthTokens, JwtService, VerifiedToken } from "./jwtService.js";

export interface TokenProvider {
  issue(user: User): AuthTokens;
  verify(token: string): VerifiedToken;
}

export class JwtTokenProvider extends JwtService implements TokenProvider {}
`
    },
    {
      path: `${root}/src/application/use-cases/registerUseCase.ts`,
      content: registerUseCaseFile(productionAuth)
    },
    {
      path: `${root}/src/application/use-cases/loginUseCase.ts`,
      content: loginUseCaseFile(productionAuth)
    },
    {
      path: `${root}/src/application/use-cases/refreshTokenUseCase.ts`,
      content: refreshTokenUseCaseFile(productionAuth)
    },
    {
      path: `${root}/src/application/use-cases/logoutUseCase.ts`,
      content: logoutUseCaseFile(productionAuth)
    },
    {
      path: `${root}/src/presentation/middleware/authMiddleware.ts`,
      content: `import { NextFunction, Request, Response } from "express";
import { JwtService } from "../../infrastructure/security/jwtService.js";

export function authMiddleware(tokens = new JwtService()) {
  return (request: Request, response: Response, next: NextFunction) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      response.sendStatus(401);
      return;
    }
    try {
      const verified = tokens.verify(token);
      response.locals.userId = verified.userId;
      response.locals.roles = [];
      response.locals.permissions = [];
      next();
    } catch {
      response.sendStatus(401);
    }
  };
}
`
    },
    {
      path: `${root}/src/presentation/routes/authRoutes.ts`,
      content: authRoutesFile(productionAuth)
    }
  ];

  if (productionAuth) {
    files.push(...productionAuthFiles(root));
  }

  return files;
}

function productionAuthFiles(root: string): GeneratedFile[] {
  return [
    {
      path: `${root}/src/shared/config/authConfig.ts`,
      content: `export interface AuthConfig {
  jwtSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
}

export function loadAuthConfig(): AuthConfig {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required when auth-mode is production");
  }

  return {
    jwtSecret,
    accessTokenTtl: process.env.JWT_EXPIRES ?? "15m",
    refreshTokenTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 7)
  };
}
`
    },
    {
      path: `${root}/src/application/ports/refreshTokenRepositoryPort.ts`,
      content: `import { RefreshToken } from "../../domain/entities/User.js";

export interface RefreshTokenRepositoryPort {
  findByHash(tokenHash: string): RefreshToken | undefined;
  save(token: RefreshToken): RefreshToken;
  revoke(tokenHash: string, replacedByTokenId?: string): boolean;
}
`
    },
    {
      path: `${root}/src/application/ports/accessControlRepositoryPort.ts`,
      content: `import { Permission, Role, RolePermission, UserRole } from "../../domain/entities/User.js";

export interface AccessControlRepositoryPort {
  listRoles(): Role[];
  listPermissions(): Permission[];
  listUserRoles(userId: string): UserRole[];
  listRolePermissions(roleId: string): RolePermission[];
}
`
    },
    {
      path: `${root}/src/infrastructure/repositories/refreshTokenRepository.ts`,
      content: `import { RefreshTokenRepositoryPort } from "../../application/ports/refreshTokenRepositoryPort.js";
import { RefreshToken } from "../../domain/entities/User.js";

export class RefreshTokenRepository implements RefreshTokenRepositoryPort {
  private readonly tokens = new Map<string, RefreshToken>();

  findByHash(tokenHash: string): RefreshToken | undefined {
    return this.tokens.get(tokenHash);
  }

  save(token: RefreshToken): RefreshToken {
    this.tokens.set(token.tokenHash, token);
    return token;
  }

  revoke(tokenHash: string, replacedByTokenId?: string): boolean {
    const current = this.tokens.get(tokenHash);
    if (!current) {
      return false;
    }
    this.tokens.set(tokenHash, { ...current, revokedAt: new Date(), replacedByTokenId });
    return true;
  }
}
`
    },
    {
      path: `${root}/src/infrastructure/repositories/accessControlRepository.ts`,
      content: `import { AccessControlRepositoryPort } from "../../application/ports/accessControlRepositoryPort.js";
import { Permission, Role, RolePermission, UserRole } from "../../domain/entities/User.js";

export class AccessControlRepository implements AccessControlRepositoryPort {
  private readonly permissions: Permission[] = [
    { id: "perm-read", name: "read" },
    { id: "perm-create", name: "create" },
    { id: "perm-update", name: "update" },
    { id: "perm-delete", name: "delete" },
    { id: "perm-manage", name: "manage" }
  ];
  private readonly roles: Role[] = [
    { id: "role-user", name: "user", permissions: this.permissions.filter((permission) => permission.name === "read") },
    { id: "role-admin", name: "admin", permissions: this.permissions }
  ];
  private readonly userRoles: UserRole[] = [];
  private readonly rolePermissions: RolePermission[] = this.roles.flatMap((role) => role.permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })));

  listRoles(): Role[] {
    return this.roles;
  }

  listPermissions(): Permission[] {
    return this.permissions;
  }

  listUserRoles(userId: string): UserRole[] {
    return this.userRoles.filter((role) => role.userId === userId);
  }

  listRolePermissions(roleId: string): RolePermission[] {
    return this.rolePermissions.filter((permission) => permission.roleId === roleId);
  }
}
`
    },
    {
      path: `${root}/src/infrastructure/security/tokenHash.ts`,
      content: `import { createHash } from "node:crypto";

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
`
    }
  ];
}

function jwtServiceFile(productionAuth: boolean): string {
  return `import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { User } from "../../domain/entities/User.js";
${productionAuth ? `import { loadAuthConfig } from "../../shared/config/authConfig.js";` : ""}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

export interface VerifiedToken {
  userId: string;
  tokenId?: string;
  type?: string;
}

export class JwtService {
  private readonly config = ${productionAuth ? "loadAuthConfig()" : "{ jwtSecret: requiredJwtSecret(), accessTokenTtl: process.env.JWT_EXPIRES ?? \"15m\" }"};

  issue(user: User): AuthTokens {
    const refreshTokenId = randomUUID();
    return {
      accessToken: jwt.sign({ sub: user.id, roles: user.roles, permissions: user.permissions }, this.config.jwtSecret, { expiresIn: this.config.accessTokenTtl }),
      refreshToken: jwt.sign({ sub: user.id, type: "refresh", jti: refreshTokenId }, this.config.jwtSecret, { expiresIn: process.env.JWT_REFRESH_EXPIRES ?? "7d" }),
      refreshTokenId
    };
  }

  verify(token: string): VerifiedToken {
    const payload = jwt.verify(token, this.config.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("Invalid token");
    }
    return {
      userId: payload.sub,
      tokenId: typeof payload.jti === "string" ? payload.jti : undefined,
      type: typeof payload.type === "string" ? payload.type : undefined
    };
  }
}

function requiredJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return secret ?? "dev-only-change-me";
}
`;
}

function registerUseCaseFile(productionAuth: boolean): string {
  return `import { randomUUID } from "node:crypto";
import { UserRepositoryPort } from "../ports/userRepositoryPort.js";
import { PasswordHasher } from "../../infrastructure/security/passwordHasher.js";
import { JwtService, AuthTokens } from "../../infrastructure/security/jwtService.js";
${productionAuth ? `import { RefreshTokenRepositoryPort } from "../ports/refreshTokenRepositoryPort.js";
import { tokenHash } from "../../infrastructure/security/tokenHash.js";` : ""}

export class RegisterUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly tokens: JwtService${productionAuth ? `,
    private readonly refreshTokens: RefreshTokenRepositoryPort` : ""}
  ) {}

  async execute(input: { email: string; password: string }): Promise<AuthTokens> {
    if (this.users.findByEmail(input.email)) {
      throw new Error("User already exists");
    }
    const user = this.users.save({
      id: randomUUID(),
      email: input.email,
      passwordHash: await this.hasher.hash(input.password),
      roles: ["user"],
      permissions: ["read"]
    });
    const issued = this.tokens.issue(user);
    ${productionAuth ? `this.refreshTokens.save({
      id: issued.refreshTokenId,
      userId: user.id,
      tokenHash: tokenHash(issued.refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });` : ""}
    return issued;
  }
}
`;
}

function loginUseCaseFile(productionAuth: boolean): string {
  return `import { UserRepositoryPort } from "../ports/userRepositoryPort.js";
import { PasswordHasher } from "../../infrastructure/security/passwordHasher.js";
import { JwtService, AuthTokens } from "../../infrastructure/security/jwtService.js";
${productionAuth ? `import { RefreshTokenRepositoryPort } from "../ports/refreshTokenRepositoryPort.js";
import { tokenHash } from "../../infrastructure/security/tokenHash.js";` : ""}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly tokens: JwtService${productionAuth ? `,
    private readonly refreshTokens: RefreshTokenRepositoryPort` : ""}
  ) {}

  async execute(input: { email: string; password: string }): Promise<AuthTokens> {
    const user = this.users.findByEmail(input.email);
    if (!user || !(await this.hasher.compare(input.password, user.passwordHash))) {
      throw new Error("Invalid credentials");
    }
    const issued = this.tokens.issue(user);
    ${productionAuth ? `this.refreshTokens.save({
      id: issued.refreshTokenId,
      userId: user.id,
      tokenHash: tokenHash(issued.refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });` : ""}
    return issued;
  }
}
`;
}

function refreshTokenUseCaseFile(productionAuth: boolean): string {
  return `import { UserRepositoryPort } from "../ports/userRepositoryPort.js";
import { AuthTokens, JwtService } from "../../infrastructure/security/jwtService.js";
${productionAuth ? `import { RefreshTokenRepositoryPort } from "../ports/refreshTokenRepositoryPort.js";
import { tokenHash } from "../../infrastructure/security/tokenHash.js";` : ""}

export class RefreshTokenUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly tokens: JwtService${productionAuth ? `,
    private readonly refreshTokens: RefreshTokenRepositoryPort` : ""}
  ) {}

  execute(refreshToken: string): AuthTokens {
    const verified = this.tokens.verify(refreshToken);
    ${productionAuth ? `const currentHash = tokenHash(refreshToken);
    const stored = this.refreshTokens.findByHash(currentHash);
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new Error("Invalid refresh token");
    }` : ""}
    const user = this.users.findById(verified.userId);
    if (!user) {
      throw new Error("Invalid refresh token");
    }
    const issued = this.tokens.issue(user);
    ${productionAuth ? `this.refreshTokens.revoke(currentHash, issued.refreshTokenId);
    this.refreshTokens.save({
      id: issued.refreshTokenId,
      userId: user.id,
      tokenHash: tokenHash(issued.refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });` : ""}
    return issued;
  }
}
`;
}

function logoutUseCaseFile(productionAuth: boolean): string {
  if (!productionAuth) {
    return `export class LogoutUseCase {
  execute(_refreshToken?: string): { revoked: boolean } {
    return { revoked: true };
  }
}
`;
  }

  return `import { RefreshTokenRepositoryPort } from "../ports/refreshTokenRepositoryPort.js";
import { tokenHash } from "../../infrastructure/security/tokenHash.js";

export class LogoutUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepositoryPort) {}

  execute(refreshToken?: string): { revoked: boolean } {
    return { revoked: refreshToken ? this.refreshTokens.revoke(tokenHash(refreshToken)) : false };
  }
}
`;
}

function authRoutesFile(productionAuth: boolean): string {
  return `import { Router } from "express";
import { LoginUseCase } from "../../application/use-cases/loginUseCase.js";
import { LogoutUseCase } from "../../application/use-cases/logoutUseCase.js";
import { RefreshTokenUseCase } from "../../application/use-cases/refreshTokenUseCase.js";
import { RegisterUseCase } from "../../application/use-cases/registerUseCase.js";
${productionAuth ? `import { RefreshTokenRepository } from "../../infrastructure/repositories/refreshTokenRepository.js";` : ""}
import { UserRepository } from "../../infrastructure/repositories/userRepository.js";
import { JwtService } from "../../infrastructure/security/jwtService.js";
import { PasswordHasher } from "../../infrastructure/security/passwordHasher.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export function createAuthRouter(): Router {
  const router = Router();
  const users = new UserRepository();
  ${productionAuth ? "const refreshTokens = new RefreshTokenRepository();" : ""}
  const hasher = new PasswordHasher();
  const tokens = new JwtService();
  const register = new RegisterUseCase(users, hasher, tokens${productionAuth ? ", refreshTokens" : ""});
  const login = new LoginUseCase(users, hasher, tokens${productionAuth ? ", refreshTokens" : ""});
  const refresh = new RefreshTokenUseCase(users, tokens${productionAuth ? ", refreshTokens" : ""});
  const logout = new LogoutUseCase(${productionAuth ? "refreshTokens" : ""});

  router.post("/register", async (request, response) => {
    try {
      response.status(201).json(await register.execute(request.body));
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : "Registration failed" });
    }
  });
  router.post("/login", async (request, response) => {
    try {
      response.json(await login.execute(request.body));
    } catch {
      response.sendStatus(401);
    }
  });
  router.post("/refresh", (request, response) => {
    try {
      response.json(refresh.execute(request.body.refreshToken));
    } catch {
      response.sendStatus(401);
    }
  });
  router.post("/logout", (request, response) => {
    response.json(logout.execute(request.body.refreshToken));
  });
  router.get("/me", authMiddleware(tokens), (_request, response) => {
    response.json({ id: response.locals.userId });
  });

  return router;
}
`;
}

function generateRelationSupportFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  if (config.language !== "typescript" || !config.relations?.length) {
    return [];
  }

  const relations = config.relations.map((relation) => ({
    source: relation.source,
    target: relation.target,
    kind: relation.kind
  }));

  return [
    {
      path: `${root}/src/domain/relations.ts`,
      content: `export type RelationKind = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" | "polymorphic" | "tree";

export interface RelationDefinition {
  source: string;
  target: string;
  kind: RelationKind;
}

export const relationDefinitions: RelationDefinition[] = ${JSON.stringify(relations, null, 2)};

export function getRelationsFor(entityName: string): RelationDefinition[] {
  return relationDefinitions.filter((relation) => relation.source.toLowerCase() === entityName.toLowerCase());
}
`
    },
    {
      path: `${root}/src/application/dtos/relationDto.ts`,
      content: `export interface NestedRelationDto {
  id: string;
  type?: string;
  children?: NestedRelationDto[];
}

export interface IncludeQueryDto {
  include?: string[];
}

export function parseIncludeQuery(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
`
    },
    {
      path: `${root}/src/infrastructure/repositories/includeOptions.ts`,
      content: `import { relationDefinitions } from "../../domain/relations.js";

export function createCircularSafeInclude(entityName: string, requested: string[]): Record<string, true> {
  const allowed = new Set(
    relationDefinitions
      .filter((relation) => relation.source.toLowerCase() === entityName.toLowerCase())
      .map((relation) => relation.target.toLowerCase())
  );

  return requested.reduce<Record<string, true>>((include, relationName) => {
    const normalized = relationName.toLowerCase();
    if (allowed.has(normalized) && !include[normalized]) {
      include[normalized] = true;
    }
    return include;
  }, {});
}
`
    }
  ];
}

function generateProductionScaffoldFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  if (config.language !== "typescript") {
    return [];
  }

  if (config.framework === "express") {
    return expressProductionFiles(config, root);
  }

  if (config.framework === "nestjs") {
    return nestJsProductionFiles(config, root);
  }

  return [];
}

function expressProductionFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  return [
    {
      path: `${root}/src/shared/config/environment.ts`,
      content: `export interface EnvironmentConfig {
  appEnv: string;
  port: number;
  databaseUrl?: string;
  redisUrl?: string;
  jwtSecret: string;
  jwtExpires: string;
  jwtRefreshExpires: string;
}

export function loadEnvironment(): EnvironmentConfig {
  if (process.env.APP_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production");
  }

  return {
    appEnv: process.env.APP_ENV ?? "development",
    port: Number(process.env.PORT ?? process.env.API_PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
    jwtExpires: process.env.JWT_EXPIRES ?? "15m",
    jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "7d"
  };
}
`
    },
    {
      path: `${root}/src/shared/logger.ts`,
      content: `type LogContext = Record<string, unknown>;

export const logger = {
  info(message: string, context: LogContext = {}): void {
    console.log(JSON.stringify({ level: "info", message, ...context }));
  },
  warn(message: string, context: LogContext = {}): void {
    console.warn(JSON.stringify({ level: "warn", message, ...context }));
  },
  error(message: string, context: LogContext = {}): void {
    console.error(JSON.stringify({ level: "error", message, ...context }));
  }
};
`
    },
    {
      path: `${root}/src/shared/errors/appError.ts`,
      content: `export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly code = "APP_ERROR",
    readonly details?: unknown
  ) {
    super(message);
  }
}
`
    },
    {
      path: `${root}/src/shared/query/queryOptions.ts`,
      content: `export interface QueryOptions {
  page: number;
  limit: number;
  q?: string;
  sort?: string;
  filters: Record<string, string>;
}

export function parseQueryOptions(query: Record<string, unknown>): QueryOptions {
  const filters = Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => key.startsWith("filter.") && typeof value === "string")
      .map(([key, value]) => [key.slice("filter.".length), value as string])
  );

  return {
    page: Math.max(Number(query.page ?? 1), 1),
    limit: Math.min(Math.max(Number(query.limit ?? 10), 1), 100),
    q: typeof query.q === "string" ? query.q : undefined,
    sort: typeof query.sort === "string" ? query.sort : undefined,
    filters
  };
}

export function applyQueryOptions<T extends Record<string, unknown>>(records: T[], options: QueryOptions): T[] {
  const searched = options.q
    ? records.filter((record) => JSON.stringify(record).toLowerCase().includes(options.q!.toLowerCase()))
    : records;

  const filtered = searched.filter((record) => {
    return Object.entries(options.filters).every(([key, value]) => String(record[key] ?? "") === value);
  });

  const sorted = options.sort
    ? [...filtered].sort((left, right) => String(left[options.sort!] ?? "").localeCompare(String(right[options.sort!] ?? "")))
    : filtered;

  const start = (options.page - 1) * options.limit;
  return sorted.slice(start, start + options.limit);
}
`
    },
    {
      path: `${root}/src/domain/auth/accessControl.ts`,
      content: `export type Role = "admin" | "user";
export type Permission = "read" | "create" | "update" | "delete" | "manage";

export interface AuthPrincipal {
  id: string;
  roles: Role[];
  permissions: Permission[];
}

export function hasRole(principal: AuthPrincipal, role: Role): boolean {
  return principal.roles.includes(role);
}

export function hasPermission(principal: AuthPrincipal, permission: Permission): boolean {
  return principal.permissions.includes(permission) || principal.permissions.includes("manage");
}
`
    },
    {
      path: `${root}/src/presentation/middleware/errorHandler.ts`,
      content: `import { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/appError.js";
import { logger } from "../../shared/logger.js";

export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({
    success: false,
    message: \`Route \${request.method} \${request.path} not found\`
  });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details
    });
    return;
  }

  logger.error("Unhandled error", { error: error instanceof Error ? error.message : String(error) });
  response.status(500).json({
    success: false,
    message: "Internal server error"
  });
}
`
    },
    {
      path: `${root}/src/presentation/middleware/requestLogger.ts`,
      content: `import { NextFunction, Request, Response } from "express";
import { logger } from "../../shared/logger.js";

export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = Date.now();
  response.on("finish", () => {
    logger.info("http_request", {
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt
    });
  });
  next();
}
`
    },
    {
      path: `${root}/src/presentation/middleware/permissionMiddleware.ts`,
      content: `import { NextFunction, Request, Response } from "express";
import { Permission, Role } from "../../domain/auth/accessControl.js";

export function requireRole(role: Role) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const roles = (response.locals.roles ?? []) as string[];
    if (!roles.includes(role)) {
      response.sendStatus(403);
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const permissions = (response.locals.permissions ?? []) as string[];
    if (!permissions.includes(permission) && !permissions.includes("manage")) {
      response.sendStatus(403);
      return;
    }
    next();
  };
}
`
    },
    {
      path: `${root}/src/presentation/openapi/openapiDocument.ts`,
      content: `export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "${config.projectName}",
    version: "0.1.0"
  },
  paths: {
    "/health": {
      get: {
        responses: {
          "200": {
            description: "Service health"
          }
        }
      }
    }
  }
};
`
    },
    {
      path: `${root}/src/presentation/routes/openApiRoutes.ts`,
      content: `import { Router } from "express";
import { openApiDocument } from "../openapi/openapiDocument.js";

export function createOpenApiRouter(): Router {
  const router = Router();
  router.get("/openapi.json", (_request, response) => response.json(openApiDocument));
  return router;
}
`
    },
    {
      path: `${root}/src/infrastructure/events/eventBus.ts`,
      content: `export type EventHandler<TEvent> = (event: TEvent) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  subscribe<TEvent>(eventName: string, handler: EventHandler<TEvent>): void {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler as EventHandler<unknown>);
    this.handlers.set(eventName, handlers);
  }

  async publish<TEvent>(eventName: string, event: TEvent): Promise<void> {
    const handlers = this.handlers.get(eventName) ?? [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}
`
    },
    {
      path: `${root}/src/infrastructure/cache/redisCache.ts`,
      content: `export interface CacheStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryCacheStore implements CacheStore {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}
`
    },
    {
      path: `${root}/src/infrastructure/queue/taskQueue.ts`,
      content: `export interface TaskQueue {
  enqueue(name: string, payload: unknown): Promise<void>;
}

export class InMemoryTaskQueue implements TaskQueue {
  readonly tasks: Array<{ name: string; payload: unknown }> = [];

  async enqueue(name: string, payload: unknown): Promise<void> {
    this.tasks.push({ name, payload });
  }
}
`
    },
    {
      path: `${root}/src/presentation/websocket/websocketServer.ts`,
      content: `export function registerWebSocketServer(): void {
  // Add ws or socket.io integration here when realtime features are needed.
}
`
    },
    {
      path: `${root}/src/presentation/uploads/uploadMiddleware.ts`,
      content: `import { NextFunction, Request, Response } from "express";

export function fileUploadPlaceholder(_request: Request, _response: Response, next: NextFunction): void {
  // Add multer or busboy integration here when file uploads are needed.
  next();
}
`
    },
    {
      path: `${root}/tests/unit/generated.test.ts`,
      content: `import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("generated unit test", () => {
  it("keeps the test runner wired", () => {
    assert.equal(true, true);
  });
});
`
    },
    {
      path: `${root}/tests/integration/http.test.ts`,
      content: `import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("generated integration test", () => {
  it("reserves a place for HTTP integration tests", () => {
    assert.ok("integration");
  });
});
`
    },
    {
      path: `${root}/.github/workflows/ci.yml`,
      content: generatedCiWorkflow()
    },
    {
      path: `${root}/.prettierrc`,
      content: `{
  "printWidth": 120,
  "semi": true,
  "singleQuote": false
}
`
    },
    {
      path: `${root}/.eslintrc.cjs`,
      content: `module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  env: {
    es2022: true,
    node: true
  }
};
`
    },
    {
      path: `${root}/.lintstagedrc.json`,
      content: `{
  "*.{ts,tsx,js,json,md}": [
    "prettier --write"
  ]
}
`
    },
    ...(config.orm === "prisma" ? prismaOperationalFiles(root) : [])
  ];
}

function prismaOperationalFiles(root: string): GeneratedFile[] {
  return [
    {
      path: `${root}/prisma/migrations/README.md`,
      content: `# Prisma migrations

Create migrations with:

\`\`\`bash
npx prisma migrate dev --name init
\`\`\`
`
    },
    {
      path: `${root}/prisma/seed.ts`,
      content: `async function main(): Promise<void> {
  console.log("Seed placeholder: add initial records here.");
}

void main();
`
    }
  ];
}

function nestJsProductionFiles(config: ProjectConfig, root: string): GeneratedFile[] {
  return [
    {
      path: `${root}/src/common/config/environment.ts`,
      content: `export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  jwtSecret: string;
}

export function environment(): EnvironmentConfig {
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production");
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me"
  };
}
`
    },
    {
      path: `${root}/src/common/filters/http-exception.filter.ts`,
      content: `import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    response.status(status).json({
      success: false,
      message: exception instanceof Error ? exception.message : "Internal server error"
    });
  }
}
`
    },
    {
      path: `${root}/src/common/interceptors/response.interceptor.ts`,
      content: `import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
`
    },
    {
      path: `${root}/src/common/logging/app-logger.service.ts`,
      content: `import { ConsoleLogger, Injectable } from "@nestjs/common";

@Injectable()
export class AppLogger extends ConsoleLogger {}
`
    },
    {
      path: `${root}/src/auth/roles.decorator.ts`,
      content: `import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
`
    },
    {
      path: `${root}/src/auth/permissions.decorator.ts`,
      content: `import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
`
    },
    {
      path: `${root}/src/auth/jwt-auth.guard.ts`,
      content: `import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
`
    },
    {
      path: `${root}/src/auth/permissions.guard.ts`,
      content: `import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    return !required?.length;
  }
}
`
    },
    {
      path: `${root}/src/auth/auth.module.ts`,
      content: `import { Module } from "@nestjs/common";

@Module({})
export class AuthModule {}
`
    },
    {
      path: `${root}/src/database/prisma.service.ts`,
      content: config.orm === "prisma" ? `import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
` : `export class PrismaService {
  transaction<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}
`
    },
    {
      path: `${root}/test/app.e2e-spec.ts`,
      content: `import test from "node:test";
import assert from "node:assert/strict";

test("${config.projectName} e2e wiring", () => {
  assert.equal(true, true);
});
`
    },
    {
      path: `${root}/test/repository.mock.spec.ts`,
      content: `import test from "node:test";
import assert from "node:assert/strict";

test("mocked repository wiring", () => {
  assert.ok("repository mock");
});
`
    },
    {
      path: `${root}/.github/workflows/ci.yml`,
      content: generatedCiWorkflow()
    },
    ...(config.orm === "prisma" ? prismaOperationalFiles(root) : [])
  ];
}

function generatedCiWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
`;
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

${[
  ...(config.entities?.map((entity) => prismaModel(entity, config)) ?? []),
  ...(config.auth === "jwt" && config.authMode === "production" ? [authPrismaModels()] : [])
].join("\n\n")}
`
    }
  ];
}

function authPrismaModels(): string {
  return `model User {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String
  refreshTokens RefreshToken[]
  userRoles    UserRole[]
}

model RefreshToken {
  id                String    @id @default(uuid())
  userId            String
  tokenHash         String    @unique
  expiresAt         DateTime
  revokedAt         DateTime?
  replacedByTokenId String?
  user              User      @relation(fields: [userId], references: [id])
}

model Role {
  id              String           @id @default(uuid())
  name            String           @unique
  userRoles       UserRole[]
  rolePermissions RolePermission[]
}

model Permission {
  id              String           @id @default(uuid())
  name            String           @unique
  rolePermissions RolePermission[]
}

model UserRole {
  userId String
  roleId String
  user   User   @relation(fields: [userId], references: [id])
  role   Role   @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
}`;
}

function prismaModel(entity: EntityConfig, config: ProjectConfig): string {
  const relations = config.relations ?? [];
  const relationFieldNames = new Set(
    relations
      .filter((relation) => relation.source.toLowerCase() === entity.name.toLowerCase())
      .filter((relation) => relation.kind === "many-to-one" || relation.kind === "one-to-one")
      .map((relation) => `${camel(relation.target)}Id`)
  );
  const relationLines = relations.flatMap((relation) => {
    if (relation.source.toLowerCase() !== entity.name.toLowerCase()) {
      return [];
    }
    const target = pascal(relation.target);
    const targetField = camel(relation.target);
    if (relation.kind === "many-to-one" || relation.kind === "one-to-one") {
      return [`  ${targetField}Id String`, `  ${targetField} ${target} @relation(fields: [${targetField}Id], references: [id])`];
    }
    if (relation.kind === "one-to-many" || relation.kind === "many-to-many") {
      return [`  ${plural(targetField)} ${target}[]`];
    }
    if (relation.kind === "polymorphic") {
      return [`  ${targetField}OwnerId String?`, `  ${targetField}OwnerType String?`];
    }
    if (relation.kind === "tree") {
      const treeName = `Tree${pascal(entity.name)}`;
      return [
        `  parentId String?`,
        `  parent ${pascal(entity.name)}? @relation("${treeName}", fields: [parentId], references: [id])`,
        `  children ${pascal(entity.name)}[] @relation("${treeName}")`
      ];
    }
    return [];
  });
  return `model ${pascal(entity.name)} {
  id String @id @default(uuid())
${entity.fields.filter((field) => !relationFieldNames.has(camel(field.name))).map((field) => `  ${camel(field.name)} ${prismaType(field)}`).join("\n")}
${relationLines.join("\n")}
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

function validationSchemaFile(entity: EntityConfig, validation: ValidationProvider): string {
  const className = pascal(entity.name);
  if (validation === "zod") {
    return `import { z } from "zod";

export const create${className}Schema = z.object({
${entity.fields.map((field) => `  ${camel(field.name)}: ${zodType(field)}${field.required === false ? ".optional()" : ""}`).join(",\n")}
});

export const update${className}Schema = create${className}Schema.partial();
`;
  }

  if (validation === "joi") {
    return `import Joi from "joi";

export const create${className}Schema = Joi.object({
${entity.fields.map((field) => `  ${camel(field.name)}: ${joiType(field)}${field.required === false ? "" : ".required()"}`).join(",\n")}
});

export const update${className}Schema = create${className}Schema.fork(Object.keys(create${className}Schema.describe().keys ?? {}), (schema) => schema.optional());
`;
  }

  return `import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class Create${className}Dto {
${entity.fields.map((field) => `  ${field.required === false ? "@IsOptional()\n  " : ""}${classValidatorDecorator(field.type)}\n  ${camel(field.name)}!: ${typeScriptType(field.type)};`).join("\n\n")}
}

export class Update${className}Dto extends Create${className}Dto {}
`;
}

function zodType(field: EntityFieldConfig): string {
  if (field.type === "number") return "z.number()";
  if (field.type === "boolean") return "z.boolean()";
  if (field.type === "date") return "z.coerce.date()";
  return "z.string()";
}

function joiType(field: EntityFieldConfig): string {
  if (field.type === "number") return "Joi.number()";
  if (field.type === "boolean") return "Joi.boolean()";
  if (field.type === "date") return "Joi.date()";
  return "Joi.string()";
}

function classValidatorDecorator(type: FieldType): string {
  if (type === "number") return "@IsNumber()";
  if (type === "boolean") return "@IsBoolean()";
  return "@IsString()";
}

function envExample(config: ProjectConfig): string {
  const database = config.database ?? "postgres";
  return [
    "APP_ENV=development",
    "API_PORT=3000",
    "WEB_PORT=5173",
    database === "postgres" ? "DATABASE_URL=postgres://arxgen:arxgen@db:5432/arxgen" : undefined,
    database === "mysql" ? "DATABASE_URL=mysql://arxgen:arxgen@db:3306/arxgen" : undefined,
    database === "mongodb" ? "DATABASE_URL=mongodb://db:27017/arxgen" : undefined,
    config.redis ? "REDIS_URL=redis://redis:6379" : undefined,
    config.auth === "jwt" ? "JWT_SECRET=replace-with-a-long-random-secret" : undefined,
    config.auth === "jwt" ? "JWT_EXPIRES=15m" : undefined,
    config.auth === "jwt" ? "JWT_REFRESH_EXPIRES=7d" : undefined
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
      MYSQL_DATABASE: arxgen
      MYSQL_USER: arxgen
      MYSQL_PASSWORD: arxgen
      MYSQL_ROOT_PASSWORD: arxgen
    ports:
      - "\${MYSQL_PORT:-3306}:3306"`;
  }
  if (database === "mongodb") {
    return `  db:
    image: mongo:7
    ports:
      - "\${MONGO_PORT:-27017}:27017"`;
  }
  return `  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: arxgen
      POSTGRES_USER: arxgen
      POSTGRES_PASSWORD: arxgen
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"`;
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

function typeScriptType(type: FieldType): string {
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "date") return "Date";
  return "string";
}

function goType(type: FieldType): string {
  if (type === "number") return "float64";
  if (type === "boolean") return "bool";
  return "string";
}
