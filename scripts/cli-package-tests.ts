/** Exercise the actual release tarball outside the source checkout. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  realpath,
  mkdir,
  writeFile,
  symlink,
  rm,
  readFile,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const release = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/package-release.ts"],
  { cwd: root, encoding: "utf8" },
);
assert.equal(release.status, 0, release.stderr);
const { tarball } = JSON.parse(
  release.stdout.slice(release.stdout.indexOf("{")),
);
const scratch = await realpath(
  await mkdtemp(join(tmpdir(), "atlas-cli-test-")),
);
try {
  const install = spawnSync(
    "npm",
    [
      "install",
      "--prefix",
      scratch,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarball,
    ],
    { encoding: "utf8" },
  );
  assert.equal(install.status, 0, install.stderr);
  const home = join(scratch, "profiles");
  await mkdir(home, { mode: 0o700 });
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [join(scratch, "node_modules/@zrodivision/atlas/dist/atlas.js"), ...args],
      {
        cwd: scratch,
        env: {
          ...process.env,
          ATLAS_HOME: home,
          ATLAS_PROFILE: "test",
          ATLAS_TOKEN: "",
        },
        encoding: "utf8",
      },
    );
  const help = run("help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /auth/);
  for (const alias of ["--help", "-h"]) {
    const result = run(alias);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), JSON.parse(help.stdout));
    assert.equal(run("workers", alias).status, 0);
    const authHelp = run("auth", alias);
    assert.equal(authHelp.status, 0, authHelp.stderr);
    assert.ok(JSON.parse(authHelp.stdout).commands.includes("auth diagnose"));
  }
  const setup = run("setup");
  assert.equal(setup.status, 0, setup.stderr);
  assert.equal(
    JSON.parse(setup.stdout).console,
    `${new URL(process.env.ATLAS_URL ?? "https://connectatlas.io").origin}/app`,
  );
  const inspection = run("inspect", "--help");
  assert.equal(inspection.status, 0, inspection.stderr);
  assert.deepEqual(JSON.parse(inspection.stdout).optionalFields, [
    "workerId",
    "vaultId",
  ]);
  assert.equal(run("inspect", '{"action":"create"}').status, 1);
  const workers = run("workers", "help");
  assert.equal(workers.status, 0, workers.stderr);
  assert.match(workers.stdout, /Optional client interface/);
  for (const action of [
    "create",
    "inspect",
    "run",
    "cancel",
    "checkpoint",
    "restore",
  ]) {
    const actionHelp = run("workers", action, "--help");
    assert.equal(actionHelp.status, 0, actionHelp.stderr);
    const details = JSON.parse(actionHelp.stdout);
    assert.equal(details.action, action);
    assert.equal(details.authority, "guidance_only");
    assert.ok(details.cliFields.includes("workerId"));
    const validationHelp = run("workers", "validate", action, "-h");
    assert.equal(validationHelp.status, 0, validationHelp.stderr);
    assert.deepEqual(JSON.parse(validationHelp.stdout), details);
  }
  const validated = run(
    "workers",
    "validate",
    "inspect",
    JSON.stringify({
      workerId: "11111111-1111-4111-8111-111111111111",
    }),
  );
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).operationSent, false);
  assert.equal(JSON.parse(validated.stdout).serverChecked, false);
  const cursor = run("install-mcp", "cursor");
  assert.equal(cursor.status, 0, cursor.stderr);
  assert.equal(
    JSON.parse(cursor.stdout).status,
    "manual_configuration_required",
  );
  assert.equal(
    JSON.parse(cursor.stdout).config.mcpServers.atlas.url,
    "https://connectatlas.io/mcp",
  );
  const status = run("auth", "status");
  for (const command of ["contract", "guide"]) {
    const result = run("workers", command);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).authority, "guidance_only");
    assert.equal(JSON.parse(result.stdout).availability, "source-only");
  }
  const diagnosis = run("auth", "diagnose");
  assert.equal(diagnosis.status, 0, diagnosis.stderr);
  assert.equal(JSON.parse(diagnosis.stdout).credentialsRead, false);
  assert.equal(JSON.parse(diagnosis.stdout).networkChecked, false);
  const blockedHome = join(scratch, "blocked-login-profile");
  const blockedLogin = spawnSync(
    process.execPath,
    [
      join(scratch, "node_modules/@zrodivision/atlas/dist/atlas.js"),
      "auth",
      "login",
    ],
    {
      cwd: scratch,
      encoding: "utf8",
      env: {
        ...process.env,
        ATLAS_HOME: blockedHome,
        ATLAS_PROFILE: "test",
        PATH: "",
        DISPLAY: "",
        WAYLAND_DISPLAY: "",
        BROWSER: "",
        ATLAS_TOKEN: "synthetic-secret-must-not-leak",
      },
    },
  );
  assert.equal(blockedLogin.status, 1);
  const blocked = JSON.parse(blockedLogin.stderr);
  assert.equal(blocked.error, "ATLAS_LOCAL_BROWSER_LOGIN_BLOCKED");
  assert.equal(blocked.authorizationCreated, false);
  assert.equal(blocked.networkChecked, false);
  assert.ok(!blockedLogin.stderr.includes("synthetic-secret"));
  await assert.rejects(access(blockedHome), { code: "ENOENT" });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).configured, false);
  const profile = join(home, "test.json");
  const secret = "test-secret-must-not-be-displayed";
  await writeFile(
    profile,
    JSON.stringify({
      kind: "oauth",
      url: "https://example.com",
      tokens: { access_token: secret },
    }),
    { mode: 0o600 },
  );
  const cached = run("auth", "status");
  assert.equal(JSON.parse(cached.stdout).configured, true);
  assert.ok(!cached.stdout.includes(secret));
  await writeFile(profile + ".lock", "", { mode: 0o600 });
  assert.notEqual(run("auth", "status").status, 0);
  assert.ok((await readFile(profile, "utf8")).includes(secret));
  await rm(profile + ".lock");
  await rm(profile);
  const target = join(scratch, "unrelated.json");
  await writeFile(target, "{}", { mode: 0o600 });
  await symlink(target, profile);
  assert.notEqual(run("auth", "status").status, 0);
  assert.equal(await readFile(target, "utf8"), "{}");
  console.log(
    "Standalone CLI tarball: help, private status, secret redaction, lock and symlink checks passed",
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
