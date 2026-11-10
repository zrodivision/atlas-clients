/** Cold-start and independent-agent loopback fixtures; no real login or inference. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js";
import { setupGuide, personalComputerGuide } from "./setup-guidance.js";

const root = resolve(import.meta.dirname, "..");
const guide = setupGuide();
assert.equal(guide.credentialsRead, false);
assert.equal(guide.operationSent, false);
assert.equal(guide.executionGated, true);
assert.equal(guide.inferenceReady, false);
assert.equal(guide.firstComputer.executableSetupCommand, null);
assert.deepEqual(guide.firstComputer, personalComputerGuide());
assert.equal(guide.routes[0].id, "native_mcp");
assert.equal(guide.recovery.connection_revoked.retry, "none");
assert.match(
  guide.identity.independentAgents,
  /not a server identity or grant/,
);
assert.match(
  guide.firstComputer.pairing.hostedEligibility,
  /not automatically/,
);
assert.match(guide.firstComputer.pairing.unsupported, /Do not silently switch/);
const catalog = JSON.parse(
  await readFile(join(root, "contracts/mcp-catalog.json"), "utf8"),
);
for (const call of guide.routes[0].verification) {
  assert.ok(typeof call === "object");
  const tool = catalog.tools.find(
    (entry: { name: string }) => entry.name === call.tool,
  );
  assert.ok(tool);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(
    new AjvJsonSchemaValidator().getValidator(tool.inputSchema)(call.arguments)
      .valid,
    true,
  );
}

const scratch = await realpath(await mkdtemp(join(tmpdir(), "atlas-setup-")));
const calls: { profile: string; method: string; tool?: string }[] = [];
const secrets = {
  alpha: "atl_synthetic_agent_alpha",
  beta: "atl_synthetic_agent_beta",
};
const identities = {
  alpha: {
    connectionId: "11111111-1111-4111-8111-111111111111",
    line: { id: "33333333-3333-4333-8333-333333333333" },
  },
  beta: {
    connectionId: "22222222-2222-4222-8222-222222222222",
    line: { id: "44444444-4444-4444-8444-444444444444" },
  },
};
const server = createServer(async (req, res) => {
  const profile = (Object.keys(secrets) as (keyof typeof secrets)[]).find(
    (key) => req.headers.authorization === `Bearer ${secrets[key]}`,
  );
  if (!profile) {
    res.writeHead(401).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const message = JSON.parse(body);
  if (message.id === undefined) {
    res.writeHead(202).end();
    return;
  }
  calls.push({
    profile,
    method: message.method,
    ...(message.params?.name ? { tool: message.params.name } : {}),
  });
  let result: unknown;
  if (message.method === "initialize")
    result = {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "independent-agent-fixture", version: "0" },
    };
  else if (
    message.method === "tools/call" &&
    message.params.name === "atlas_registration_inspect"
  )
    result = {
      content: [{ type: "text", text: "Synthetic fixture only." }],
      structuredContent: identities[profile],
    };
  else {
    res.writeHead(400).end();
    return;
  }
  res
    .writeHead(200, { "Content-Type": "application/json" })
    .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
});
const run = (
  home: string,
  profile: string,
  args: string[],
  overrides: Record<string, string> = {},
) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (yes, no) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/atlas.ts", ...args],
        {
          cwd: root,
          env: {
            ...process.env,
            ATLAS_HOME: home,
            ATLAS_PROFILE: profile,
            ATLAS_URL: "",
            ATLAS_TOKEN: "synthetic-unused-secret",
            ...overrides,
          },
        },
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data;
      });
      child.stderr.on("data", (data) => {
        stderr += data;
      });
      child.once("error", no);
      child.once("exit", (code) => yes({ code, stdout, stderr }));
    },
  );
try {
  await new Promise<void>((yes) => server.listen(0, "127.0.0.1", yes));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const missing = join(scratch, "no-profile-created");
  for (const args of [
    ["setup", "guide"],
    ["setup", "--help"],
    ["setup", "-h"],
  ]) {
    const result = await run(missing, "fresh", args, { ATLAS_URL: origin });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), guide);
    assert.equal(result.stdout.includes("synthetic-unused-secret"), false);
  }
  await assert.rejects(access(missing), { code: "ENOENT" });
  assert.equal(calls.length, 0, "cold-start guidance sends no network request");
  for (const args of [
    ["setup", "guide", "extra"],
    ["setup", "pair"],
    ["setup", '{"token":"synthetic-secret"}'],
  ]) {
    const result = await run(missing, "fresh", args);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stderr).error, "setup_guidance_invalid");
    assert.equal(result.stderr.includes("synthetic-secret"), false);
  }
  const home = join(scratch, "profiles");
  await mkdir(home, { mode: 0o700 });
  // Invalid existing state must not be read, repaired or replaced by guidance.
  const poison = join(home, "poison.json");
  await writeFile(poison, "synthetic-invalid-private-profile", { mode: 0o600 });
  assert.equal((await run(home, "poison", ["setup", "guide"])).code, 0);
  assert.equal(
    await readFile(poison, "utf8"),
    "synthetic-invalid-private-profile",
  );
  const snapshots: Record<string, string> = {};
  for (const profile of ["alpha", "beta"] as const) {
    snapshots[profile] = JSON.stringify({
      url: origin,
      token: secrets[profile],
    });
    await writeFile(join(home, profile + ".json"), snapshots[profile], {
      mode: 0o600,
    });
  }
  for (const profile of ["alpha", "beta", "alpha"] as const) {
    const result = await run(home, profile, ["whoami"]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).structuredContent,
      identities[profile],
    );
    for (const secret of [...Object.values(secrets), "synthetic-unused-secret"])
      assert.equal((result.stdout + result.stderr).includes(secret), false);
  }
  assert.deepEqual(
    calls.filter((call) => call.tool).map((call) => [call.profile, call.tool]),
    [
      ["alpha", "atlas_registration_inspect"],
      ["beta", "atlas_registration_inspect"],
      ["alpha", "atlas_registration_inspect"],
    ],
  );
  for (const profile of ["alpha", "beta"] as const)
    assert.equal(
      await readFile(join(home, profile + ".json"), "utf8"),
      snapshots[profile],
      "verification preserves each independent credential",
    );
  const before = calls.length;
  const absent = await run(home, "unconnected", ["whoami"]);
  assert.equal(absent.code, 1);
  assert.equal(
    calls.length,
    before,
    "missing profile cannot borrow another agent's connection",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((yes) => server.close(() => yes()));
  await rm(scratch, { recursive: true, force: true });
}
console.log(
  "PASS offline setup, schema-checked verification examples, independent profile routing and repeat verification; no real OAuth, computer deployment or Codex pairing claimed",
);
