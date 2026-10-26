#!/usr/bin/env node
/** Atlas CLI. Human consent stays in the browser; native MCP hosts own separate credentials. */
import { distribution, version } from "./distribution.js";
import { oauthCli } from "./cli-oauth.js";
import { installMcp } from "./mcp-install.js";
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
  const [command = "help", name, args = "{}"] = process.argv.slice(2);
  if (await distribution(command, process.argv.slice(3))) {
    // Distribution commands do not require an Atlas login.
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
        "skill install codex|claude|both",
        "auth login|status|logout (browser sign-in; no checkout required)",
        "setup",
        "install-mcp codex|claude [--name NAME] (browser sign-in)",
        "install (read owner-issued installation token from stdin)",
        "whoami",
        "list",
        "call TOOL JSON",
        "read URI",
      ],
      config: ["ATLAS_URL", "ATLAS_HOME", "ATLAS_PROFILE"],
      approval:
        "Use atlas auth login for browser approval. CLI and MCP credentials remain independent; human sessions are never agent credentials.",
    });
  } else if (command === "setup") {
    output({
      console: endpoint(
        process.env.ATLAS_URL ?? "https://atlas-production-9abf.up.railway.app",
      ),
      next: "Run atlas auth login to sign in or sign up in your browser and approve a line. Then run atlas whoami to verify the connection.",
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
    else if (command === "call" && name)
      output(await client.callTool({ name, arguments: JSON.parse(args) }));
    else if (command === "read" && name)
      output(await client.readResource({ uri: name }));
    else throw Error("Use help for supported commands");
  }
} catch (error) {
  if (["update", "skill", "version", "--version"].includes(process.argv[2])) {
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
