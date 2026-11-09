/** Credential-free local OAuth preflight. Never logs in or contacts an issuer. */
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loginReadiness, LoginReadinessError, oauthCli } from "./cli-oauth.js";

const scratch = await mkdtemp(join(tmpdir(), "atlas-login-readiness-"));
const originalEnv = process.env;
const originalFetch = globalThis.fetch;
const originalLog = console.log;
let networkCalls = 0;
globalThis.fetch = async () => {
  networkCalls++;
  throw Error("No network permitted in readiness tests");
};
try {
  const bin = join(scratch, "bin");
  await mkdir(bin);
  // A launcher must only be inspected, never executed by the diagnosis.
  await writeFile(join(bin, "xdg-open"), "#!/bin/sh\nexit 99\n", {
    mode: 0o700,
  });
  const headless = await loginReadiness({ PATH: bin }, "linux");
  assert.equal(headless.status, "local_browser_login_blocked");
  assert.deepEqual(headless.blockers, ["local_browser_display_unavailable"]);
  const missing = await loginReadiness({ PATH: "", DISPLAY: ":0" }, "linux");
  assert.deepEqual(missing.blockers, ["browser_launcher_unavailable"]);
  const desktop = await loginReadiness({ PATH: bin, DISPLAY: ":0" }, "linux");
  assert.equal(desktop.status, "local_browser_login_possible");
  assert.equal(desktop.browserLaunchChecked, false);
  assert.equal(desktop.serverChecked, false);
  assert.equal(desktop.networkChecked, false);
  assert.equal(desktop.credentialsRead, false);
  assert.equal(desktop.authorizationCreated, false);
  assert.equal(desktop.deviceFlow, "not_implemented");
  assert.equal(desktop.manualCallback, "not_implemented");
  const remote = await loginReadiness(
    { PATH: bin, WAYLAND_DISPLAY: "wayland-0", SSH_TTY: "synthetic" },
    "linux",
  );
  assert.equal(
    remote.canAttemptLocalBrowserLogin,
    true,
    "SSH alone must not block an intentional GUI setup",
  );
  assert.deepEqual(remote.warnings, ["remote_session_loopback_unverified"]);
  assert.equal(JSON.stringify(remote).includes("synthetic"), false);
  const handler = await loginReadiness(
    { PATH: bin, BROWSER: "synthetic-private-handler" },
    "linux",
  );
  assert.equal(handler.canAttemptLocalBrowserLogin, true);
  assert.equal(handler.checks.displayAvailable, false);
  assert.deepEqual(handler.warnings, ["browser_handler_unverified"]);
  assert.equal(
    JSON.stringify(handler).includes("synthetic-private-handler"),
    false,
  );
  const directoryBin = join(scratch, "directory-bin");
  await mkdir(join(directoryBin, "xdg-open"), { recursive: true });
  assert.equal(
    (await loginReadiness({ PATH: directoryBin, DISPLAY: ":0" }, "linux"))
      .checks.launcherFound,
    false,
  );
  // Diagnose does not read even an invalid profile or create ATLAS_HOME.
  const home = join(scratch, "not-created");
  process.env = {
    PATH: "",
    ATLAS_HOME: home,
    ATLAS_PROFILE: "../invalid",
    ATLAS_TOKEN: "synthetic-secret",
  };
  let report = "";
  console.log = (value: string) => {
    report = value;
  };
  assert.equal(await oauthCli("auth", "diagnose"), true);
  assert.equal(JSON.parse(report).credentialsRead, false);
  assert.equal(report.includes("synthetic-secret"), false);
  process.env.ATLAS_PROFILE = "independent";
  await assert.rejects(
    oauthCli("auth", "login"),
    (error: unknown) =>
      error instanceof LoginReadinessError &&
      error.code === "ATLAS_LOCAL_BROWSER_LOGIN_BLOCKED",
  );
  await assert.rejects(access(home), { code: "ENOENT" });
  assert.equal(networkCalls, 0);
} finally {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
  console.log = originalLog;
  await rm(scratch, { recursive: true, force: true });
}
console.log(
  "CLI OAuth readiness tests passed (no credentials, browser, or network).",
);
