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
  const status = run("auth", "status");
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
