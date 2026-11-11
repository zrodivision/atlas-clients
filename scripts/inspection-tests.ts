/** Synthetic MCP fixtures. No owner credentials, live data, provider or grant changes. */
import assert from "node:assert/strict";
import { version } from "./distribution.js";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  inspectWorkspace,
  parseInspectionSelection,
  inspectionHelp,
} from "./inspection.js";
const id = "11111111-1111-4111-8111-111111111111";
const vaultId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const secret = "fixture-private-content-must-not-be-published";
const root = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(
  await readFile(join(root, "contracts/mcp-catalog.json"), "utf8"),
);
const tools = catalog.tools.filter((tool: { name: string }) =>
  [
    "atlas_registration_inspect",
    "atlas_context_vaults",
    "atlas_signal_status",
  ].includes(tool.name),
);
assert.equal(tools.length, 3);
const workerTool = {
  name: "atlas_workers",
  inputSchema: {
    type: "object",
    $id: "urn:atlas:cloud-workers:candidate:1",
    properties: { action: { enum: ["create", "inspect", "run", "cancel"] } },
    oneOf: [
      {
        type: "object",
        properties: {
          action: { const: "inspect" },
          workerId: { $ref: "#/$defs/uuid" },
        },
        required: ["action", "workerId"],
        additionalProperties: false,
      },
    ],
    $defs: { uuid: { type: "string" } },
  },
  annotations: { readOnlyHint: false },
};
const replies: Record<string, Record<string, unknown>> = {
  atlas_registration_inspect: {
    connectionId: id,
    subscriberId: otherId,
    line: { id, name: "Synthetic line", secret },
    guide: { version: "0.14.2" },
    private: secret,
  },
  atlas_context_vaults: {
    vaultIdentityVersion: 2,
    writeProtocolVersion: 2,
    defaultRequiresGrant: true,
    vaults: [
      {
        vault_id: id,
        name: "Default",
        can_read: false,
        can_write: false,
        read_scope: "none",
        namespaces: [],
        secret,
      },
      {
        vault_id: vaultId,
        name: "Selected",
        can_read: true,
        can_write: false,
        read_scope: "current_subtrees",
        namespaces: ["research"],
        content: secret,
      },
      {
        vault_id: otherId,
        name: "Full",
        can_read: true,
        can_write: true,
        read_scope: "full",
        namespaces: null,
      },
    ],
    memories: [{ content: secret }],
  },
  atlas_signal_status: {
    signal: {
      schemaVersion: 1,
      viewKind: "archive_input_observation",
      authorization: "allowed",
      sourceSynchronization: "unknown",
      coverage: "unknown",
      factualConfidence: "not_assessed",
      selection: { kind: "discovery", returnedRecords: 0 },
      private: secret,
    },
    memories: [{ content: secret }],
  },
  atlas_workers: {
    worker: {
      workerId: id,
      lineId: otherId,
      label: "Synthetic worker",
      state: "UNCERTAIN",
      runtime: "codex-sdk",
      compute: "sprites",
      executionAvailable: false,
      handling: {
        schemaVersion: 1,
        stateMeaning: "persisted_lifecycle_intent_not_provider_execution",
        execution: "blocked",
        blocker: "protected_dispatch_unavailable",
        next: { action: "inspect", workerId: id, private: secret },
        retry: {
          mode: "inspect_before_retry",
          mutationRequestId: "reuse_only_for_identical_intent",
          revisionSource: "fresh_authorized_inspect",
          uncertainOutcome: "reconcile_do_not_replace_request_id",
          private: secret,
        },
        completionEvidence: "provider_and_runtime_verified_result_required",
        private: secret,
      },
      financialAuthorization: false,
      prompt: secret,
      providerToken: secret,
      currentTask: { prompt: secret },
    },
  },
};
// Mirror current discovery's per-vault Signal observations, while retaining an
// aggregate allowed value to test compatibility with an unfiltered response.
replies.atlas_signal_status.vaults = [
  {
    vault_id: id,
    signal: {
      ...(replies.atlas_signal_status.signal as object),
      authorization: "none",
    },
  },
  { vault_id: vaultId, signal: replies.atlas_signal_status.signal },
];
function fixture(
  pages: unknown[] = [{ tools }],
  options: {
    error?: string;
    throws?: string;
    text?: boolean;
    override?: Record<string, unknown>;
  } = {},
) {
  const calls: { name: string; arguments: unknown }[] = [];
  let page = 0;
  const client = {
    listTools: async () => pages[Math.min(page++, pages.length - 1)],
    callTool: async (args: { name: string; arguments: unknown }) => {
      calls.push(args);
      if (options.throws === args.name) throw Error(secret);
      const value =
        options.error === args.name
          ? { error: "forbidden", message: secret }
          : options.override && args.name in options.override
            ? options.override[args.name]
            : replies[args.name];
      return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        ...(options.text ? {} : { structuredContent: value }),
        ...(options.error === args.name ? { isError: true } : {}),
      };
    },
  } as unknown as Pick<Client, "listTools" | "callTool">;
  return { client, calls, pages: () => page };
}
for (const invalid of [
  "null",
  "[]",
  "",
  '{"workerId":"bad"}',
  '{"vaultId":null}',
  '{"action":"run"}',
  '{"workerId":"' + id + '","grant":true}',
  " ".repeat(4097),
]) {
  assert.throws(() => parseInspectionSelection(invalid), /Inspection/);
  const f = fixture();
  await assert.rejects(inspectWorkspace(f.client, invalid));
  assert.equal(f.pages(), 0, "invalid selection fails before discovery");
}
assert.deepEqual(parseInspectionSelection(), {});
const alphaId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
assert.deepEqual(
  parseInspectionSelection(
    JSON.stringify({
      workerId: alphaId.toUpperCase(),
      vaultId: alphaId.toUpperCase(),
    }),
  ),
  { workerId: alphaId, vaultId: alphaId },
);
const upper = fixture([{ tools: [...tools, workerTool] }], {
  override: {
    atlas_workers: { worker: { workerId: alphaId } },
    atlas_context_vaults: {
      vaultIdentityVersion: 2,
      vaults: [
        {
          vault_id: alphaId,
          can_read: false,
          can_write: false,
          read_scope: "none",
          namespaces: [],
        },
      ],
    },
  },
});
const upperReport = await inspectWorkspace(
  upper.client,
  JSON.stringify({
    workerId: alphaId.toUpperCase(),
    vaultId: alphaId.toUpperCase(),
  }),
);
assert.equal(upperReport.sections.computers.state, "inspected");
assert.equal((upperReport.sections.memory.data!.vaults as unknown[]).length, 1);
assert.deepEqual(upper.calls.at(-1)?.arguments, {
  action: "inspect",
  workerId: alphaId,
});

assert.deepEqual(
  parseInspectionSelection(JSON.stringify({ workerId: id, vaultId })),
  { workerId: id, vaultId },
);
const basic = fixture();
const report = await inspectWorkspace(basic.client);
assert.equal(report.sections.connection.state, "inspected");
assert.equal(report.sections.computers.state, "not_advertised");
assert.equal(report.sections.memory.state, "inspected");
assert.equal(report.sections.signal.state, "inspected");
assert.equal(report.partial, true);
assert.equal(report.sections.signal.data!.requiresComputer, false);
assert.equal(
  report.sections.signal.data!.representativeCallingReadiness,
  "not_assessed",
);
assert.deepEqual(
  basic.calls.map((c) => c.name),
  tools.map((t: { name: string }) => t.name),
);
assert.ok(!JSON.stringify(report).includes(secret));
assert.equal(
  (report.sections.memory.data!.vaults as Record<string, unknown>[])[2]
    .namespaces,
  null,
);
assert.equal(report.consistency, "independent_current_reads_not_atomic");
const selected = fixture([
  { tools: [tools[0]], nextCursor: "next" },
  { tools: [...tools.slice(1), workerTool] },
]);
const selectedReport = await inspectWorkspace(
  selected.client,
  JSON.stringify({ workerId: id, vaultId }),
);
assert.equal(selectedReport.partial, false);
assert.equal(selectedReport.sections.computers.data!.state, "UNCERTAIN");
assert.equal(selectedReport.sections.computers.data!.executionAvailable, false);
assert.equal(
  (selectedReport.sections.computers.data!.handling as Record<string, unknown>)
    .execution,
  "blocked",
);
assert.ok(!JSON.stringify(selectedReport).includes(secret));
for (const handling of [
  undefined,
  {},
  { schemaVersion: 2 },
  {
    ...((replies.atlas_workers.worker as Record<string, unknown>)
      .handling as object),
    execution: "ready",
  },
  {
    ...((replies.atlas_workers.worker as Record<string, unknown>)
      .handling as object),
    next: { action: "inspect", workerId: otherId },
  },
  {
    ...((replies.atlas_workers.worker as Record<string, unknown>)
      .handling as object),
    next: { action: "run", workerId: id },
  },
]) {
  const changed = fixture([{ tools: [...tools, workerTool] }], {
    override: {
      atlas_workers: {
        worker: { ...(replies.atlas_workers.worker as object), handling },
      },
    },
  });
  const observed = await inspectWorkspace(
    changed.client,
    JSON.stringify({ workerId: id }),
  );
  assert.equal(observed.sections.computers.data!.handling, null);
  assert.equal(
    observed.sections.computers.data!.runtimeReadiness,
    "not_verified_by_inspection",
  );
}

assert.deepEqual(selected.calls.at(-1), {
  name: "atlas_workers",
  arguments: { action: "inspect", workerId: id },
});
assert.deepEqual(selected.calls[2], {
  name: "atlas_signal_status",
  arguments: { vaultId },
});
assert.equal(
  (selectedReport.sections.memory.data!.vaults as unknown[]).length,
  1,
);
assert.ok(!JSON.stringify(selectedReport).includes(secret));
const mixed = fixture();
const selectedNone = await inspectWorkspace(
  mixed.client,
  JSON.stringify({ vaultId: id }),
);
assert.equal(selectedNone.sections.signal.data!.authorization, "none");
assert.deepEqual(selectedNone.sections.signal.data!.scope, {
  kind: "selected_vault",
  vaultId: id,
  visible: true,
});
const invisible = await inspectWorkspace(
  fixture().client,
  JSON.stringify({ vaultId: otherId }),
);
assert.equal(invisible.sections.signal.data!.authorization, "not_observed");
const invisibleWithWorker = await inspectWorkspace(
  fixture([{ tools: [...tools, workerTool] }]).client,
  JSON.stringify({ workerId: id, vaultId: otherId }),
);
assert.equal(
  invisibleWithWorker.partial,
  true,
  "unobserved selected Signal scope keeps the aggregate partial",
);

assert.deepEqual(invisible.sections.signal.data!.scope, {
  kind: "selected_vault",
  vaultId: otherId,
  visible: false,
});
const noSelection = fixture([{ tools: [...tools, workerTool] }]);
assert.equal(
  (await inspectWorkspace(noSelection.client)).sections.computers.state,
  "not_selected",
);
assert.equal(noSelection.calls.length, 3);
for (const pages of [
  [{ tools: [...tools, tools[0]] }],
  [
    { tools, nextCursor: "repeat" },
    { tools: [], nextCursor: "repeat" },
  ],
  Array.from({ length: 20 }, (_, i) => ({
    tools: i === 0 ? tools : [],
    nextCursor: String(i + 1),
  })),
]) {
  const f = fixture(pages);
  await assert.rejects(inspectWorkspace(f.client), /discovery/);
  assert.equal(
    f.calls.length,
    0,
    "incomplete/ambiguous discovery sends no reads",
  );
}
const brokenDiscovery = fixture();
brokenDiscovery.client.listTools = async () => {
  throw Error(secret);
};
await assert.rejects(
  inspectWorkspace(brokenDiscovery.client),
  (error) => error instanceof Error && !error.message.includes(secret),
);
for (const name of [
  "atlas_registration_inspect",
  "atlas_context_vaults",
  "atlas_signal_status",
  "atlas_workers",
]) {
  const f = fixture([{ tools: [...tools, workerTool] }], { error: name });
  const r = await inspectWorkspace(f.client, JSON.stringify({ workerId: id }));
  const section = {
    atlas_registration_inspect: "connection",
    atlas_context_vaults: "memory",
    atlas_signal_status: "signal",
    atlas_workers: "computers",
  }[name] as keyof typeof r.sections;
  assert.equal(r.sections[section].state, "denied");
  assert.equal(f.calls.length, name === "atlas_registration_inspect" ? 1 : 4);
  assert.ok(!JSON.stringify(r).includes(secret));
}
const absent = fixture([{ tools: tools.slice(1) }]);
assert.equal(
  (await inspectWorkspace(absent.client)).sections.memory.state,
  "blocked",
);
assert.equal(absent.calls.length, 0);
const malformed = fixture([{ tools }], {
  override: { atlas_registration_inspect: { connectionId: id } },
});
assert.equal(
  (await inspectWorkspace(malformed.client)).sections.signal.state,
  "blocked",
);
assert.equal(malformed.calls.length, 1);
const dropped = fixture([{ tools }], { throws: "atlas_context_vaults" });
assert.equal(
  (await inspectWorkspace(dropped.client)).sections.signal.state,
  "inspected",
);
assert.equal(
  dropped.calls.filter((c) => c.name === "atlas_context_vaults").length,
  1,
);
const text = fixture([{ tools }], { text: true });
assert.equal(
  (await inspectWorkspace(text.client)).sections.memory.state,
  "inspected",
);
const oversized = fixture([{ tools }], {
  override: {
    atlas_signal_status: {
      ...replies.atlas_signal_status,
      private: "x".repeat(256 * 1024),
    },
  },
});
assert.equal(
  (await inspectWorkspace(oversized.client)).sections.signal.state,
  "failed",
);
for (const candidate of [
  {
    ...workerTool,
    inputSchema: {
      type: "object",
      properties: { action: { enum: ["inspect"] } },
    },
  },
  { ...workerTool, inputSchema: { ...workerTool.inputSchema, $id: "unknown" } },
  {
    ...workerTool,
    inputSchema: {
      ...workerTool.inputSchema,
      oneOf: [
        { ...workerTool.inputSchema.oneOf[0], additionalProperties: true },
      ],
    },
  },
]) {
  const f = fixture([{ tools: [...tools, candidate] }]);
  assert.equal(
    (await inspectWorkspace(f.client, JSON.stringify({ workerId: id })))
      .sections.computers.state,
    "unsupported_contract",
  );
  assert.equal(f.calls.length, 3);
}
const wrongWorker = fixture([{ tools: [...tools, workerTool] }], {
  override: { atlas_workers: { worker: { workerId: otherId } } },
});
assert.equal(
  (await inspectWorkspace(wrongWorker.client, JSON.stringify({ workerId: id })))
    .sections.computers.state,
  "failed",
);
const mutable = fixture([
  {
    tools: tools.map((t: { name: string }) =>
      t.name === "atlas_signal_status"
        ? { ...t, annotations: { readOnlyHint: false } }
        : t,
    ),
  },
]);
assert.equal(
  (await inspectWorkspace(mutable.client)).sections.signal.state,
  "unsupported_contract",
);
assert.equal(mutable.calls.length, 2);

// Real installation-profile CLI with loopback MCP transport and fully synthetic server.
const scratch = await realpath(
  await mkdtemp(join(tmpdir(), "atlas-inspection-")),
);
const networkCalls: { name: string; arguments: unknown }[] = [];
let denyMemory = false;
const server = createServer(async (req, res) => {
  assert.equal(req.headers.authorization, "Bearer atl_synthetic_inspection");
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let body = "";
  for await (const part of req) body += part;
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
      serverInfo: { name: "inspection-fixture", version: "0" },
    };
  else if (message.method === "tools/list")
    result = { tools: [...tools, workerTool] };
  else if (message.method === "tools/call") {
    networkCalls.push(message.params);
    result =
      denyMemory && message.params.name === "atlas_context_vaults"
        ? {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "forbidden", message: secret }),
              },
            ],
          }
        : { content: [], structuredContent: replies[message.params.name] };
  } else throw Error("Unexpected MCP method");
  res
    .writeHead(200, { "Content-Type": "application/json" })
    .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
});
try {
  const home = join(scratch, "profiles");
  await mkdir(home, { mode: 0o700 });
  const run = (args: string[], preload?: string) =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (yes, no) => {
        const child = spawn(
          process.execPath,
          [
            ...(preload ? ["--import", preload] : []),
            "--import",
            "tsx",
            "scripts/atlas.ts",
            ...args,
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              ATLAS_HOME: home,
              ATLAS_PROFILE: "fixture",
              ATLAS_URL: "",
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
  for (const alias of ["--help", "-h", "help"]) {
    const r = await run(["inspect", alias]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), inspectionHelp);
  }
  const invalid = await run(["inspect", '{"action":"create"}']);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /inspection_request_invalid/);
  const trailing = await run(["inspect", "{}", "ignored"]);
  assert.equal(trailing.code, 1);
  await new Promise<void>((yes) => server.listen(0, "127.0.0.1", yes));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const profile = join(home, "fixture.json");
  await writeFile(
    profile,
    JSON.stringify({
      url: `http://127.0.0.1:${address.port}`,
      token: "atl_synthetic_inspection",
    }),
    { mode: 0o600 },
  );
  const request = join(scratch, "request.json");
  await writeFile(request, JSON.stringify({ workerId: id, vaultId }));
  const before = await readFile(profile, "utf8");
  const installed = await run(["inspect", "@" + request]);
  assert.equal(installed.code, 0, installed.stderr);
  assert.equal(JSON.parse(installed.stdout).partial, false);
  assert.equal(networkCalls.length, 4);
  assert.deepEqual(networkCalls.at(-1), {
    name: "atlas_workers",
    arguments: { action: "inspect", workerId: id },
  });
  assert.equal(
    await readFile(profile, "utf8"),
    before,
    "inspection never modifies installation profile",
  );
  denyMemory = true;
  const partial = await run(["inspect"]);
  assert.equal(partial.code, 0);
  assert.equal(JSON.parse(partial.stdout).sections.memory.state, "denied");
  assert.equal(JSON.parse(partial.stdout).sections.signal.state, "inspected");
  for (const r of [installed, partial])
    assert.ok(!(r.stdout + r.stderr).includes(secret));

  // The actual OAuth CLI path and SDK use a strict same-origin, in-process fetch fixture.
  // This is transport-shim verification, not a browser OAuth or live hosted acceptance claim.
  const oauthToken = "ato_synthetic_inspection";
  await writeFile(
    profile,
    JSON.stringify({
      kind: "oauth",
      url: "https://atlas.example.test",
      redirect: "http://127.0.0.1:12345/callback",
      client: { client_id: "synthetic" },
      tokens: {
        access_token: oauthToken,
        token_type: "Bearer",
        expires_in: 3600,
      },
    }),
    { mode: 0o600 },
  );
  const shim = join(scratch, "oauth-fixture.mjs"),
    log = join(scratch, "oauth-calls.jsonl");
  await writeFile(
    shim,
    `import {appendFileSync} from 'node:fs';\nconst tools=${JSON.stringify([...tools, workerTool])}; const replies=${JSON.stringify(replies)};\nglobalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.href!=='https://atlas.example.test/mcp')throw Error('Unexpected fixture origin'); if(new Headers(init.headers).get('authorization')!=='Bearer ${oauthToken}')throw Error('Unexpected fixture credential'); if(init.method!=='POST')return new Response(null,{status:405}); const message=JSON.parse(init.body); if(message.method==='initialize' && message.params.clientInfo.version!==${JSON.stringify(version)})throw Error('Wrong client version'); if(message.id===undefined)return new Response(null,{status:202}); let result;if(message.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'0'}};else if(message.method==='tools/list')result={tools};else if(message.method==='tools/call'){appendFileSync(${JSON.stringify(log)},JSON.stringify(message.params)+'\\n');result={content:[],structuredContent:replies[message.params.name]};}else throw Error('Unexpected method');return new Response(JSON.stringify({jsonrpc:'2.0',id:message.id,result}),{status:200,headers:{'content-type':'application/json'}});};`,
  );
  const oauthBefore = await readFile(profile, "utf8");
  const oauth = await run(["inspect", JSON.stringify({ workerId: id })], shim);
  assert.equal(oauth.code, 0, oauth.stderr);
  assert.equal(JSON.parse(oauth.stdout).partial, false);
  assert.ok(!(oauth.stdout + oauth.stderr).includes(oauthToken));
  assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 4);
  assert.equal(
    await readFile(profile, "utf8"),
    oauthBefore,
    "no OAuth token/identity rewrite or refresh needed",
  );
  console.log(
    "PASS inspection selection, bounded discovery, least-privilege projections, partial failures, no replay, installation-profile loopback MCP and OAuth transport-shim CLI",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((yes) => server.close(() => yes()));
  await rm(scratch, { recursive: true, force: true });
}
