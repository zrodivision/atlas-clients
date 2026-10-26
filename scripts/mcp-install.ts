/** Native harness registration and login; each host owns its credentials. */
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
const hosted = "https://atlas-production-9abf.up.railway.app";
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", () => reject(Error(`Could not start ${command}`)));
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            Error(
              `${command} did not complete; rerun this install command to resume`,
            ),
          ),
    );
  });
}
export async function codexRpc<T>(
  action: (
    call: (method: string, params: unknown) => Promise<any>,
  ) => Promise<T>,
) {
  const child = spawn("codex", ["app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let seq = 0;
  const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  const fail = () => {
    for (const p of pending.values())
      p.reject(Error("Codex connection check failed"));
    pending.clear();
  };
  child.on("error", fail);
  child.on("exit", fail);
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const v = JSON.parse(line);
      const p = pending.get(v.id);
      if (p) {
        pending.delete(v.id);
        v.error ? p.reject(Error("Codex request failed")) : p.resolve(v.result);
      }
    } catch {}
  });
  const call = (method: string, params: unknown) =>
    new Promise<any>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  const timer = setTimeout(() => {
    fail();
    child.kill();
  }, 55_000);
  try {
    await call("initialize", {
      clientInfo: { name: "atlas_installer", version: "0.6.0-rc.2" },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
    return await action(call);
  } finally {
    clearTimeout(timer);
    lines.close();
    child.kill();
  }
}
async function verify(name: string) {
  return codexRpc(async (call) => {
    const statuses = await call("mcpServerStatus/list", { serverName: name });
    const status = statuses.data?.find((v: any) => v.name === name);
    if (
      !status ||
      status.authStatus !== "oAuth" ||
      !Object.keys(status.tools ?? {}).length
    )
      throw Error("Codex has not connected to Atlas yet");
    const identity = await call("mcpServer/resource/read", {
      server: name,
      uri: "atlas://me",
    });
    if (!identity.contents?.length)
      throw Error("Atlas identity verification failed");
    return Object.keys(status.tools).length;
  });
}
/** Configure the stable remote service; native host OAuth owns all credentials. */
export async function installMcp(target: string, args: string[]) {
  if (!["codex", "claude"].includes(target))
    throw Error("Choose codex or claude");
  if (args.length && (args.length !== 2 || args[0] !== "--name"))
    throw Error("Use --name NAME");
  const name = args[1] ?? "atlas";
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(name)) throw Error("Invalid MCP name");
  const base = new URL(process.env.ATLAS_URL ?? hosted);
  if (
    base.protocol !== "https:" ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    throw Error("HTTPS origin required");
  const url = base.origin + "/mcp";
  const existing = spawnSync(
    target,
    ["mcp", "get", name, ...(target === "codex" ? ["--json"] : [])],
    { encoding: "utf8", timeout: 30000 },
  );
  if (existing.error) throw Error("Install the native client CLI first");
  if (existing.status === 0) {
    const actual =
      target === "codex"
        ? JSON.parse(existing.stdout).transport?.url
        : claudeUrl(existing.stdout);
    if (actual !== url)
      throw Error("Existing MCP entry differs; choose another --name");
  } else {
    await run(
      target,
      target === "codex"
        ? ["mcp", "add", name, "--url", url]
        : ["mcp", "add", "--transport", "http", "--scope", "user", name, url],
    );
  }
  await run(target, [
    "mcp",
    "login",
    name,
    ...(target === "codex" ? ["--scopes", "atlas:mcp,offline_access"] : []),
  ]);
  if (target === "codex")
    console.log(
      `Connected: ${name} (${await verify(name)} tools; Atlas identity verified). Start a fresh chat.`,
    );
  else {
    const check = spawnSync("claude", ["mcp", "get", name], {
      encoding: "utf8",
      timeout: 30000,
    });
    if (
      check.status !== 0 ||
      claudeUrl(check.stdout) !== url ||
      !/Status:\s*(?:✓|✔)\s*Connected/.test(check.stdout)
    )
      throw Error("Claude connection not verified");
    console.log(
      "Claude reports connected. In a fresh chat read atlas://me to verify the selected line.",
    );
  }
}

export function claudeUrl(output: string) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "");
  const url = clean.match(/^\s*URL:\s*(https:\/\/\S+)\s*$/m)?.[1];
  if (!url)
    throw Error(
      "Cannot verify this Claude entry's URL; inspect it with claude mcp get before retrying",
    );
  return url;
}
