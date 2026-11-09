/** Local fixtures only. No provider, owner credentials or worker computer is used. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  parseWorkerRequest,
  validateWorkerIntent,
  readWorkerArgument,
  workerCommand,
} from "./worker-cli.js";

const workerId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const lineId = "33333333-3333-4333-8333-333333333333";
const intent = { workerId, requestId, lineId, label: "Research worker" };
const argumentsText = JSON.stringify(intent);
const actions = ["create", "inspect", "run", "cancel", "checkpoint", "restore"];
const tool = {
  name: "atlas_workers",
  inputSchema: {
    type: "object" as const,
    properties: { action: { enum: actions } },
  },
};
const calls: unknown[] = [];
let discoveries = 0;
function fixture(pages: unknown[], failure?: Error) {
  let index = 0;
  return {
    listTools: async (args: unknown) => {
      discoveries++;
      calls.push({ discovery: args });
      return pages[Math.min(index++, pages.length - 1)];
    },
    callTool: async (args: unknown) => {
      calls.push(args);
      if (failure) throw failure;
      return {
        content: [{ type: "text", text: "fixture only" }],
        structuredContent: { state: "UNCERTAIN" },
      };
    },
  } as Pick<Client, "listTools" | "callTool">;
}

assert.deepEqual(parseWorkerRequest("create", argumentsText), {
  action: "create",
  ...intent,
});
for (const action of actions) {
  const value: Record<string, unknown> = { workerId };
  if (action !== "inspect") value.requestId = requestId;
  if (action !== "inspect" && action !== "create") value.expectedRevision = 1;
  if (action === "create") Object.assign(value, { lineId, label: "Worker" });
  if (action === "run")
    Object.assign(value, {
      taskId: lineId,
      taskVersion: 1,
      prompt: "Inspect the selected files.",
    });
  if (action === "restore") value.checkpointId = "v1";
  assert.deepEqual(parseWorkerRequest(action, JSON.stringify(value)), {
    action,
    ...value,
  });
}
for (const bad of [
  "null",
  "[]",
  "not json",
  JSON.stringify({ ...intent, action: "run" }),
  JSON.stringify({ ...intent, credentials: "secret" }),
  JSON.stringify({ ...intent, requestId: "" }),
  JSON.stringify({ ...intent, label: " " }),
  JSON.stringify({ workerId }),
  " ".repeat(65537),
]) {
  await assert.rejects(
    workerCommand(fixture([{ tools: [tool] }]), "create", bad),
  );
}
assert.equal(discoveries, 0, "invalid arguments never reach discovery");
assert.throws(() =>
  parseWorkerRequest(
    "run",
    JSON.stringify({
      workerId,
      requestId,
      expectedRevision: 0,
      taskId: lineId,
      taskVersion: 1,
      prompt: "x",
    }),
  ),
);
assert.throws(() =>
  parseWorkerRequest("inspect", JSON.stringify({ workerId, requestId })),
);
assert.throws(() => parseWorkerRequest("remove", "{}"));

// The same public request refinements apply before both CLI and MCP dispatch.
for (const badId of [
  workerId + "\n",
  workerId + "\r",
  workerId + "\u2028",
  " " + workerId,
  "11111111-1111-0111-8111-111111111111",
  "11111111-1111-9111-8111-111111111111",
  "11111111-1111-4111-7111-111111111111",
])
  for (const key of ["workerId", "requestId", "lineId"])
    assert.throws(() =>
      parseWorkerRequest("create", JSON.stringify({ ...intent, [key]: badId })),
    );
for (const label of ["x".repeat(81), "💻".repeat(41), "bad\0label", "\uFEFF"])
  assert.throws(() =>
    parseWorkerRequest("create", JSON.stringify({ ...intent, label })),
  );
for (const label of ["x".repeat(80), "💻".repeat(40), "\u0085"])
  assert.equal(
    parseWorkerRequest("create", JSON.stringify({ ...intent, label })).label,
    label,
  );
const runIntent = {
  workerId,
  requestId,
  expectedRevision: 1,
  taskId: lineId,
  taskVersion: 1,
  prompt: "Inspect files.",
};
for (const prompt of [
  "x".repeat(32769),
  "💻".repeat(8193),
  "bad\0prompt",
  "\uFEFF",
])
  assert.throws(() =>
    parseWorkerRequest("run", JSON.stringify({ ...runIntent, prompt })),
  );
for (const prompt of ["x".repeat(32768), "💻".repeat(8192)])
  assert.equal(
    parseWorkerRequest("run", JSON.stringify({ ...runIntent, prompt })).prompt,
    prompt,
  );
for (const checkpointId of [
  "checkpoint-1",
  "v",
  "../v1",
  "v1\n",
  "v1\r",
  "v1\u2028",
  "v" + "1".repeat(21),
])
  assert.throws(() =>
    parseWorkerRequest(
      "restore",
      JSON.stringify({
        workerId,
        requestId,
        expectedRevision: 1,
        checkpointId,
      }),
    ),
  );
assert.equal(
  parseWorkerRequest(
    "restore",
    JSON.stringify({
      workerId,
      requestId,
      expectedRevision: 1,
      checkpointId: "v" + "1".repeat(20),
    }),
  ).checkpointId,
  "v" + "1".repeat(20),
);
assert.deepEqual(validateWorkerIntent("create", argumentsText), {
  valid: true,
  action: "create",
  contract: "urn:atlas:cloud-workers:candidate:1",
  serverChecked: false,
  operationSent: false,
  message:
    "Local candidate request validation only. Server discovery, current authority and runtime readiness still require verification.",
});

assert.deepEqual(
  await workerCommand(fixture([{ tools: [] }]), "capabilities"),
  {
    available: false,
    tool: "atlas_workers",
    advertisedActions: [],
    runtimeReadiness: "unknown",
    message:
      "This server does not advertise atlas_workers. No worker operation was sent.",
  },
);
await assert.rejects(
  workerCommand(fixture([{ tools: [] }]), "create", argumentsText),
  /does not advertise/,
);
await assert.rejects(
  workerCommand(
    fixture([{ tools: [{ ...tool, inputSchema: { type: "object" } }] }]),
    "create",
    argumentsText,
  ),
  /does not advertise/,
);
await assert.rejects(
  workerCommand(fixture([{ tools: [tool, tool] }]), "create", argumentsText),
  /ambiguous/,
);
await assert.rejects(
  workerCommand(
    fixture([{ tools: [tool], nextCursor: "repeated" }]),
    "create",
    argumentsText,
  ),
  /ambiguous|incomplete/,
);
assert.ok(
  calls.every((entry) => "discovery" in (entry as object)),
  "unsupported/incomplete discovery never mutates",
);
calls.length = 0;
const nested = {
  ...tool,
  inputSchema: {
    type: "object",
    oneOf: actions.map((action) => ({
      properties: { action: { const: action } },
    })),
  },
};
const result = await workerCommand(
  fixture([{ tools: [], nextCursor: "page2" }, { tools: [nested] }]),
  "create",
  argumentsText,
);
assert.deepEqual(calls, [
  { discovery: {} },
  { discovery: { cursor: "page2" } },
  { name: "atlas_workers", arguments: { action: "create", ...intent } },
]);
assert.deepEqual(
  result,
  {
    content: [{ type: "text", text: "fixture only" }],
    structuredContent: { state: "UNCERTAIN" },
  },
  "uncertain runtime state is not reinterpreted as success",
);
calls.length = 0;
await assert.rejects(
  workerCommand(
    fixture([{ tools: [tool] }], Error("lost reply")),
    "create",
    argumentsText,
  ),
  /lost reply/,
);
assert.equal(
  calls.filter((entry) => "name" in (entry as object)).length,
  1,
  "lost response is never replayed",
);

const root = resolve(import.meta.dirname, "..");
const scratch = await mkdtemp(join(tmpdir(), "atlas-workers-"));
const serverCalls: { name: string; arguments: unknown }[] = [];
let advertise = false;
let toolError = false;
const secret = "atl_fixture_worker_secret";
const server = createServer(async (req, res) => {
  assert.equal(req.headers.authorization, "Bearer " + secret);
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
  let result: unknown;
  if (message.method === "initialize")
    result = {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "worker-fixture", version: "0" },
    };
  else if (message.method === "tools/list")
    result = { tools: advertise ? [tool] : [] };
  else if (message.method === "tools/call") {
    serverCalls.push(message.params);
    result = {
      content: [
        { type: "text", text: "Controlled fixture, not a live worker." },
      ],
      ...(toolError
        ? { isError: true }
        : { structuredContent: { state: "UNCERTAIN" } }),
    };
  } else throw Error("Unexpected fixture request");
  res
    .writeHead(200, { "Content-Type": "application/json" })
    .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
});
try {
  const path = join(scratch, "request.json");
  await writeFile(path, argumentsText);
  assert.equal(await readWorkerArgument("@" + path), argumentsText);
  assert.equal(await readWorkerArgument(argumentsText), argumentsText);
  await symlink(path, path + ".link");
  await assert.rejects(readWorkerArgument("@" + path + ".link"));
  await assert.rejects(readWorkerArgument("@" + scratch), /regular file/);
  await writeFile(path + ".big", "x".repeat(65537));
  await assert.rejects(readWorkerArgument("@" + path + ".big"), /64 KiB/);
  await writeFile(path + ".invalid", Buffer.from([0xff]));
  await assert.rejects(readWorkerArgument("@" + path + ".invalid"), /UTF-8/);
  await new Promise<void>((yes) => server.listen(0, "127.0.0.1", yes));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const home = join(scratch, "profiles");
  await mkdir(home, { mode: 0o700 });
  const run = (...args: string[]) =>
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
              ATLAS_PROFILE: "fixture",
              ATLAS_URL: "",
              npm_config_cache: join(scratch, "npm"),
            },
          },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (data) => (stdout += data));
        child.stderr.on("data", (data) => (stderr += data));
        child.once("error", no);
        child.once("exit", (code) => yes({ code, stdout, stderr }));
      },
    );
  const help = await run("workers", "help");
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /Optional client interface/);
  // No profile exists: local validation must not try authentication or connect.
  const validated = await run("workers", "validate", "create", "@" + path);
  assert.equal(validated.code, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).valid, true);
  assert.equal(JSON.parse(validated.stdout).serverChecked, false);
  assert.equal(JSON.parse(validated.stdout).operationSent, false);
  assert.ok(
    !validated.stdout.includes(intent.label),
    "validation does not echo request contents",
  );
  for (const args of [
    ["workers", "validate"],
    ["workers", "validate", "create"],
    ["workers", "validate", "create", "@" + path, "extra"],
    ["workers", "validate", "run", argumentsText],
  ]) {
    const rejected = await run(...args);
    assert.equal(rejected.code, 1, JSON.stringify(args));
  }
  await writeFile(
    join(home, "fixture.json"),
    JSON.stringify({ url: `http://127.0.0.1:${address.port}`, token: secret }),
    { mode: 0o600 },
  );
  const capabilities = await run("workers", "capabilities");
  assert.equal(capabilities.code, 0, capabilities.stderr);
  assert.equal(JSON.parse(capabilities.stdout).available, false);
  const unsupported = await run("workers", "create", "@" + path);
  assert.equal(unsupported.code, 1);
  assert.match(unsupported.stderr, /does not advertise/);
  assert.equal(serverCalls.length, 0);
  advertise = true;
  const created = await run("workers", "create", "@" + path);
  assert.equal(created.code, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).structuredContent.state, "UNCERTAIN");
  assert.deepEqual(serverCalls, [
    { name: "atlas_workers", arguments: { action: "create", ...intent } },
  ]);
  toolError = true;
  const rejected = await run(
    "workers",
    "inspect",
    JSON.stringify({ workerId }),
  );
  assert.equal(rejected.code, 1, "tool-level errors fail the command");
  assert.equal(serverCalls.length, 2);
  const invalid = await run(
    "workers",
    "create",
    argumentsText,
    "ignored-extra",
  );
  assert.equal(invalid.code, 1);
  assert.equal(
    serverCalls.length,
    2,
    "trailing arguments cannot be silently ignored",
  );
  for (const output of [
    help,
    validated,
    capabilities,
    unsupported,
    created,
    rejected,
    invalid,
  ])
    assert.ok(!(output.stdout + output.stderr).includes(secret));
  assert.equal(
    await readFile(path, "utf8"),
    argumentsText,
    "saved intent is unchanged",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((yes) => server.close(() => yes()));
  await rm(scratch, { recursive: true, force: true });
}
console.log(
  "PASS worker argument validation, bounded files, discovery gates, exact single-call dispatch, lost replies and real CLI loopback fixtures; no live workers or OAuth host acceptance claimed",
);
