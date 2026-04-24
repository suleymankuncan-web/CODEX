import "reflect-metadata";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";

const workspaceRoot = resolve(__dirname, "..", "..", "..");
const backendRoot = resolve(workspaceRoot, "backend", "nestjs");
const infraComposeFile = resolve(workspaceRoot, "infra", "docker-compose.live-e2e.yml");
const appPort = process.env.REHEARSAL_APP_PORT ?? "3100";
const smokeBaseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${appPort}/api`;
const composeProjectName =
  process.env.REHEARSAL_COMPOSE_PROJECT_NAME ?? "store-ops-live-rehearsal";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

type ManagedProcess = {
  child: ChildProcess;
  name: string;
};

const managedProcesses: ManagedProcess[] = [];

function createLogFile(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  return createWriteStream(path, { flags: "w" });
}

function toWindowsCommandInvocation(command: string, args: string[]) {
  const quoted = [command, ...args].map((part) => {
    const escaped = part.replace(/"/g, '\\"');
    return /[\s"]/u.test(part) ? `"${escaped}"` : escaped;
  });

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", quoted.join(" ")],
  };
}

function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: "inherit" | "pipe";
  },
) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const invocation =
      process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
        ? toWindowsCommandInvocation(command, args)
        : { command, args };

    const child = spawn(invocation.command, invocation.args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: options?.stdio ?? "inherit",
      windowsHide: true,
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? -1}`));
    });
  });
}

function startManagedProcess(input: {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdoutPath: string;
  stderrPath: string;
}) {
  const stdout = createLogFile(input.stdoutPath);
  const stderr = createLogFile(input.stderrPath);
  const invocation =
    process.platform === "win32" && input.command.toLowerCase().endsWith(".cmd")
      ? toWindowsCommandInvocation(input.command, input.args)
      : { command: input.command, args: input.args };
  const child = spawn(invocation.command, invocation.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);
  managedProcesses.push({ child, name: input.name });

  return child;
}

async function stopManagedProcesses() {
  for (const processHandle of managedProcesses.reverse()) {
    if (processHandle.child.exitCode !== null || processHandle.child.killed) {
      continue;
    }

    processHandle.child.kill("SIGTERM");
    await delay(1000);

    if (processHandle.child.exitCode === null && !processHandle.child.killed) {
      processHandle.child.kill("SIGKILL");
    }
  }

  managedProcesses.length = 0;
}

async function waitForHealth(url: string, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore retries until timeout.
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for health at ${url}`);
}

async function executeSqlFile(pool: Pool, path: string) {
  if (!existsSync(path)) {
    return;
  }

  const sql = readFileSync(path, "utf8");
  if (sql.trim()) {
    await pool.query(sql);
  }
}

async function waitForDatabase(databaseUrl: string, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const pool = new Pool({ connectionString: databaseUrl });

    try {
      await pool.query("SELECT 1");
      await pool.end();
      return;
    } catch {
      await pool.end().catch(() => undefined);
      await delay(1000);
    }
  }

  throw new Error(`Timed out waiting for database at ${databaseUrl}`);
}

async function resetAndSeedDatabase(databaseUrl: string) {
  await waitForDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query("DROP SCHEMA IF EXISTS audit CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS rpt CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS stg CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS ops CASCADE");

    await executeSqlFile(pool, resolve(workspaceRoot, "db", "schema.sql"));
    await executeSqlFile(pool, resolve(workspaceRoot, "db", "seeds", "001_reference_seed.sql"));
    await executeSqlFile(pool, resolve(workspaceRoot, "db", "jobs", "generate_snapshots.sql"));
  } finally {
    await pool.end();
  }
}

async function main() {
  const sharedEnv = {
    ...process.env,
    APP_PORT: appPort,
    AUTH_MODE: "mock",
    QUEUE_BACKEND: "bullmq",
    DATABASE_URL: "postgres://postgres:postgres@localhost:54329/store_ops_live",
    REDIS_URL: "redis://localhost:6389",
    QUEUE_IMPORT_NAME: "store-ops-import",
    QUEUE_SNAPSHOT_NAME: "store-ops-snapshot",
  };

  try {
    await runCommand(
      dockerCommand,
      ["compose", "-p", composeProjectName, "-f", infraComposeFile, "up", "-d"],
      {
        cwd: workspaceRoot,
      },
    );

    await resetAndSeedDatabase(sharedEnv.DATABASE_URL);

    await runCommand(npmCommand, ["run", "build"], {
      cwd: backendRoot,
      env: sharedEnv,
    });

    startManagedProcess({
      name: "release-rehearsal-worker",
      command: "node",
      args: ["dist/workers"],
      cwd: backendRoot,
      env: sharedEnv,
      stdoutPath: resolve(backendRoot, ".release-rehearsal-worker.log"),
      stderrPath: resolve(backendRoot, ".release-rehearsal-worker.err.log"),
    });

    startManagedProcess({
      name: "release-rehearsal-app",
      command: "node",
      args: ["--enable-source-maps", "dist/main"],
      cwd: backendRoot,
      env: sharedEnv,
      stdoutPath: resolve(backendRoot, ".release-rehearsal-app.log"),
      stderrPath: resolve(backendRoot, ".release-rehearsal-app.err.log"),
    });

    await waitForHealth(`${smokeBaseUrl}/health`);

    await runCommand(npmCommand, ["run", "smoke:release"], {
      cwd: backendRoot,
      env: {
        ...sharedEnv,
        SMOKE_BASE_URL: smokeBaseUrl,
      },
    });

    await runCommand(npmCommand, ["run", "smoke:store-me"], {
      cwd: backendRoot,
      env: {
        ...sharedEnv,
        SMOKE_BASE_URL: smokeBaseUrl,
      },
    });
  } finally {
    await stopManagedProcesses();

    await runCommand(
      dockerCommand,
      ["compose", "-p", composeProjectName, "-f", infraComposeFile, "down", "-v"],
      {
        cwd: workspaceRoot,
      },
    ).catch(() => undefined);
  }
}

void main();
