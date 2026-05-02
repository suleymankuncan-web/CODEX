import { SignJWT } from "jose";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

type ParsedArgs = {
  sub: string;
  employeeId?: string;
  roles: string[];
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  expiresInSeconds: number;
  state: string;
  printCallbackUrl: boolean;
};

const DEFAULTS: ParsedArgs = {
  sub: "local-dev-user",
  employeeId: undefined,
  roles: ["STORE_MANAGER"],
  companyIds: ["00000000-0000-0000-0000-000000000001"],
  regionIds: ["00000000-0000-0000-0000-000000000010"],
  storeIds: ["00000000-0000-0000-0000-000000000100"],
  expiresInSeconds: 3600,
  state: "/store",
  printCallbackUrl: true,
};

async function main() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const secret = process.env.JWT_SECRET;
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;

  if (!secret) {
    throw new Error("JWT_SECRET is required to generate a local HS256 token.");
  }

  if (!issuer) {
    throw new Error("JWT_ISSUER is required to generate a local HS256 token.");
  }

  if (!audience) {
    throw new Error("JWT_AUDIENCE is required to generate a local HS256 token.");
  }

  const token = await new SignJWT({
    roles: args.values.roles,
    company_ids: args.values.companyIds,
    region_ids: args.values.regionIds,
    store_ids: args.values.storeIds,
    ...(args.values.employeeId
      ? { employee_id: args.values.employeeId }
      : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.values.sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${args.values.expiresInSeconds}s`)
    .sign(new TextEncoder().encode(secret));

  const callbackUrl = `http://localhost:5173/auth/callback#access_token=${encodeURIComponent(
    token,
  )}&state=${encodeURIComponent(args.values.state)}`;

  console.log("Generated local JWT:");
  console.log(token);
  console.log("");
  console.log("Claims summary:");
  console.log(JSON.stringify(args.values, null, 2));

  if (args.values.printCallbackUrl) {
    console.log("");
    console.log("Callback URL:");
    console.log(callbackUrl);
  }
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  const values = { ...DEFAULTS };
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--help" || current === "-h") {
      help = true;
      continue;
    }

    const next = argv[index + 1];

    switch (current) {
      case "--sub":
        values.sub = requireValue(current, next);
        index += 1;
        break;
      case "--employee-id":
        values.employeeId = requireValue(current, next);
        index += 1;
        break;
      case "--roles":
        values.roles = parseList(requireValue(current, next));
        index += 1;
        break;
      case "--company-ids":
        values.companyIds = parseList(requireValue(current, next));
        index += 1;
        break;
      case "--region-ids":
        values.regionIds = parseList(requireValue(current, next));
        index += 1;
        break;
      case "--store-ids":
        values.storeIds = parseList(requireValue(current, next));
        index += 1;
        break;
      case "--expires-in":
        values.expiresInSeconds = Number(requireValue(current, next));
        index += 1;
        break;
      case "--state":
        values.state = requireValue(current, next);
        index += 1;
        break;
      case "--token-only":
        values.printCallbackUrl = false;
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  return {
    help,
    values,
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parseList(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelp() {
  console.log(`Usage:
  npm.cmd run auth:token -- [options]

Options:
  --sub <value>            Subject / user id
  --employee-id <value>    Optional employee id
  --roles <csv>            Role codes, default STORE_MANAGER
  --company-ids <csv>      Company scope ids
  --region-ids <csv>       Region scope ids
  --store-ids <csv>        Store scope ids
  --expires-in <seconds>   Token lifetime, default 3600
  --state <path>           Callback return path, default /store
  --token-only             Print token without callback URL
  --help                   Show this help
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
