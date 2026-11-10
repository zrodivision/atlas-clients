#!/usr/bin/env node
/** Atlas CLI. Human consent stays in the browser; native MCP hosts own separate credentials. */
import { distribution, version } from "./distribution.js";
import { LoginReadinessError, oauthCli } from "./cli-oauth.js";
import { installMcp } from "./mcp-install.js";
import {
  workerActionHelp,
  workerContract,
  workerGuide,
} from "./worker-guidance.js";
import {
  WorkerCommandError,
  workerHelp,
  workerCommand,
  readWorkerArgument,
  parseWorkerRequest,
  validateWorkerIntent,
} from "./worker-cli.js";
import {
  InspectionError,
  inspectionHelp,
  inspectWorkspace,
  parseInspectionSelection,
} from "./inspection.js";
import { memoryGuide, memoryExamples } from "./memory-guidance.js";
import { setupGuide } from "./setup-guidance.js";
import { constants } from "node:fs";
import { mkdir, open, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const directory = resolve(
  process.env.ATLAS_HOME ?? join(homedir(), ".config", "atlas"),
);
const profile = process.env.ATLAS_PROFILE ?? "default";
let token = "";
let client: Client | undefined;
function endpoint(raw: string) {
  const u = new URL(raw);
  if (
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
      )) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw Error(
      "Use an HTTPS Atlas origin, or HTTP loopback for local development",
    );
  return u.origin;
}
async function privateDirectory() {
  if (
    (await realpath(directory)) !== directory ||
    (await stat(directory)).mode & 0o077
  )
    throw Error("Private profile directory without symlinks required");
}
function output(value: unknown) {
  const text = JSON.stringify(value, null, 2);
  console.log(token ? text.split(token).join("[REDACTED]") : text);
}
try {
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(profile))
    throw Error("Invalid profile name");
  const path = join(directory, profile + ".json");
  const [rawCommand = "help", rawName, rawArgs = "{}", ...extra] =
    process.argv.slice(2);
  const command = ["--help", "-h"].includes(rawCommand) ? "help" : rawCommand;
  const name = rawName && ["--help", "-h"].includes(rawName) ? "help" : rawName;
  let args = rawArgs;
  let validation: ReturnType<typeof validateWorkerIntent> | undefined;
  const actionHelp =
    command === "workers"
      ? name === "validate" &&
        extra.length === 1 &&
        ["--help", "-h"].includes(extra[0])
        ? workerActionHelp(rawArgs)
        : name && extra.length === 0 && ["--help", "-h"].includes(rawArgs)
          ? workerActionHelp(name)
          : undefined
      : undefined;
  if (
    command === "memory" &&
    (process.argv.length > 4 ||
      (name && !["help", "guide", "examples"].includes(name)))
  )
    throw new InspectionError(
      "memory_guidance_invalid",
      "Use atlas memory guide or atlas memory examples. Both are offline; no sync command is installed.",
    );
  if (
    command === "setup" &&
    (process.argv.length > 4 || (name && !["guide", "help"].includes(name)))
  )
    throw new InspectionError(
      "setup_guidance_invalid",
      "Use atlas setup or atlas setup guide. Guidance is offline and does not create access.",
    );
  if (command === "inspect") {
    if (process.argv.length > 4)
      throw new InspectionError(
        "inspection_request_invalid",
        "Use atlas inspect with at most one JSON argument or request file.",
      );
    if (name !== "help") {
      args = await readWorkerArgument(rawName ?? "{}");
      parseInspectionSelection(args);
    }
  }
  if (command === "workers") {
    if (actionHelp) {
      // Action help is offline and never interpreted as request JSON.
    } else if (name === "validate") {
      if (extra.length !== 1)
        throw new WorkerCommandError(
          "Use atlas workers validate ACTION JSON|@request.json.",
        );
      validation = validateWorkerIntent(
        rawArgs,
        await readWorkerArgument(extra[0]),
      );
    } else if (
      extra.length ||
      (["help", "capabilities", "contract", "guide"].includes(name) &&
        process.argv.length > 4)
    )
      throw new WorkerCommandError(
        "Use atlas workers help for supported commands.",
      );
    if (
      !actionHelp &&
      name &&
      !["help", "capabilities", "contract", "guide", "validate"].includes(name)
    ) {
      args = await readWorkerArgument(rawArgs);
      parseWorkerRequest(name, args);
    }
  }
  if (await distribution(command, process.argv.slice(3))) {
    // Distribution commands do not require an Atlas login.
  } else if (command === "setup" && name) {
    output(setupGuide());
  } else if (command === "memory") {
    output(name === "examples" ? memoryExamples() : memoryGuide());
  } else if (command === "inspect" && name === "help") {
    output(inspectionHelp);
  } else if (command === "workers" && (!name || name === "help")) {
    output(workerHelp);
  } else if (validation) {
    output(validation);
  } else if (actionHelp) {
    output(actionHelp);
  } else if (command === "workers" && name === "contract") {
    output(workerContract());
  } else if (command === "workers" && name === "guide") {
    output(workerGuide());
  } else if (command === "auth" && (!name || name === "help")) {
    output({
      commands: ["auth diagnose", "auth login", "auth status", "auth logout"],
      next: "Use auth diagnose before attempting login on a remote or cloud computer. CLI and native MCP credentials are independent.",
      flow: "Browser authorization-code PKCE with a callback on this computer. Device flow and manual callback are not implemented.",
    });
  } else if (
    command !== "help" &&
    command !== "install" &&
    command !== "install-mcp" &&
    command !== "setup" &&
    (await oauthCli(command, name, args))
  ) {
    // The OAuth provider owns credential refresh and profile serialization.
  } else if (command === "install-mcp") {
    await installMcp(name ?? "codex", process.argv.slice(4));
  } else if (command === "help") {
    output({
      commands: [
        "--version",
        "update [--version VERSION]",
        "skill install codex|claude|cursor|both",
        "auth login|status|logout (browser sign-in; no checkout required)",
        "auth diagnose (offline browser-login readiness; reads no credentials)",
        "setup [guide] (offline connection routes and Personal Computer acceptance gates)",
        "install-mcp codex|claude|cursor [--name NAME] (native sign-in or Cursor setup handoff)",
        "install (read owner-issued installation token from stdin)",
        "whoami",
        "inspect [JSON|@request.json] (connection, computer settings, memory access and Signal)",
        "list",
        "call TOOL JSON",
        "read URI",
        "workers help (optional, discovery-gated worker interface)",
        "memory guide|examples (offline Vault mirror mapping and recovery)",
      ],
      config: ["ATLAS_URL", "ATLAS_HOME", "ATLAS_PROFILE"],
      approval:
        "Use atlas auth login for browser approval. CLI and MCP credentials remain independent; human sessions are never agent credentials.",
    });
  } else if (command === "setup") {
    output({
      console: `${endpoint(process.env.ATLAS_URL ?? "https://connectatlas.io")}/app`,
      next: "Run atlas setup guide for supported routes. Before CLI login, run atlas auth diagnose; then use atlas auth login for owner approval and atlas whoami to verify the connection.",
    });
  } else {
    let url: string;
    if (command === "install") {
      url = endpoint(process.env.ATLAS_URL ?? "http://127.0.0.1:8080");
      for await (const chunk of process.stdin) {
        token += chunk;
        if (token.length > 8192) throw Error("Invalid installation credential");
      }
      token = token.trim();
      if (!/^atl_[A-Za-z0-9_-]+$/.test(token))
        throw Error(
          "An Atlas installation credential is required, not a Clerk human token",
        );
    } else {
      await privateDirectory();
      const f = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const s = await f.stat();
        if (!s.isFile() || s.nlink !== 1 || s.mode & 0o077 || s.size > 16384)
          throw Error("Private mode-0600 profile required");
        const stored = JSON.parse(await f.readFile("utf8"));
        url = endpoint(stored.url);
        token = stored.token;
        if (typeof token !== "string" || !token.startsWith("atl_"))
          throw Error("Invalid installation profile");
        if (process.env.ATLAS_URL && endpoint(process.env.ATLAS_URL) !== url)
          throw Error(
            "Profile origin mismatch; credentials are never forwarded to a new origin",
          );
      } finally {
        await f.close();
      }
    }
    client = new Client({
      name: "atlas-cli",
      version,
    });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url + "/mcp"), {
        requestInit: {
          headers: { Authorization: "Bearer " + token },
          redirect: "error",
        },
      }),
    );
    if (command === "install") {
      const identity = await client.callTool({
        name: "atlas_registration_inspect",
        arguments: {},
      });
      if (identity.isError) throw Error("Installation not accepted");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await privateDirectory();
      const f = await open(
        path,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await f.writeFile(JSON.stringify({ url, token }));
        await f.sync();
      } finally {
        await f.close();
      }
      output({ installed: true, profile, url, identity });
    } else if (command === "whoami")
      output(
        await client.callTool({
          name: "atlas_registration_inspect",
          arguments: {},
        }),
      );
    else if (command === "list") output(await client.listTools());
    else if (command === "inspect")
      output(await inspectWorkspace(client, args));
    else if (command === "workers" && name)
      output(await workerCommand(client, name, args));
    else if (command === "call" && name)
      output(await client.callTool({ name, arguments: JSON.parse(args) }));
    else if (command === "read" && name)
      output(await client.readResource({ uri: name }));
    else throw Error("Use help for supported commands");
  }
} catch (error) {
  if (error instanceof InspectionError) {
    console.error(
      JSON.stringify({ error: error.code, message: error.message }, null, 2),
    );
    process.exitCode = 1;
  } else if (error instanceof LoginReadinessError) {
    console.error(
      JSON.stringify({ error: error.code, ...error.readiness }, null, 2),
    );
    process.exitCode = 1;
  } else if (error instanceof WorkerCommandError) {
    console.error(
      JSON.stringify(
        {
          error: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } else if (
    ["update", "skill", "version", "--version"].includes(process.argv[2])
  ) {
    console.error(
      error instanceof Error
        ? error.message
        : "Atlas distribution command failed",
    );
    process.exitCode = 1;
  } else {
    // SDK/provider errors may include headers/body. Keep CLI failures credential-free.
    console.error(
      "Atlas command failed. Check endpoint, private profile permissions, credential expiry/revocation and tool arguments. Use Console for owner approval or a replacement installation.",
    );
    process.exitCode = 1;
  }
} finally {
  await client?.close().catch(() => {});
}
