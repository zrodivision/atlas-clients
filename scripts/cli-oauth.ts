/** Native CLI OAuth. Each profile owns its own refresh chain; never reads host credentials. */
import { constants } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  lstat,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  auth,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const hosted = "https://atlas-production-9abf.up.railway.app";
export async function oauthCli(
  command: string,
  name?: string,
  argument = "{}",
): Promise<boolean> {
  const dir = resolve(
    process.env.ATLAS_HOME ?? join(homedir(), ".config", "atlas"),
  );
  const profile = process.env.ATLAS_PROFILE ?? "default";
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(profile)) throw Error("Invalid profile");
  const path = join(dir, profile + ".json");
  const isAuth = command === "auth";
  if (!isAuth) {
    const probe = await lstat(path).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (!probe) return false;
    if (!probe.isFile() || probe.mode & 0o077)
      throw Error("Private profile required");
    if (JSON.parse(await readFile(path, "utf8")).kind !== "oauth") return false;
  }
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if ((await realpath(dir)) !== dir || (await lstat(dir)).mode & 0o077)
    throw Error("Private directory required");
  // Serialize all clients using this profile, including refresh and logout. Never steal a lock.
  const lock = await open(
    path + ".lock",
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    0o600,
  );
  let client: Client | undefined;
  let stop: (() => void) | undefined;
  try {
    let data: any;
    try {
      const f = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const st = await f.stat();
        if (
          !st.isFile() ||
          st.nlink !== 1 ||
          st.mode & 0o077 ||
          st.size > 32768
        )
          throw Error("Private profile required");
        data = JSON.parse(await f.readFile("utf8"));
      } finally {
        await f.close();
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (isAuth && name === "status") {
      console.log(
        JSON.stringify(
          {
            profile,
            configured: data?.kind === "oauth",
            url: data?.url,
            identity: data?.identity,
            identitySource:
              "cached at login; use whoami for current authorization",
          },
          null,
          2,
        ),
      );
      return true;
    }
    const url = new URL(data?.url ?? process.env.ATLAS_URL ?? hosted);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw Error("HTTPS Atlas origin required");
    if (
      process.env.ATLAS_URL &&
      new URL(process.env.ATLAS_URL).origin !== url.origin
    )
      throw Error("Profile origin mismatch");
    const safeFetch: typeof fetch = async (input, init) => {
      const address = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (address.origin !== url.origin) throw Error("OAuth origin mismatch");
      return fetch(input, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    };
    if (isAuth && name === "logout") {
      if (data?.kind !== "oauth") throw Error("OAuth profile required");
      const response = await safeFetch(url.origin + "/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: data.client.client_id,
          token: data.tokens.refresh_token ?? data.tokens.access_token,
        }),
      });
      if (!response.ok) throw Error("Revocation failed; credentials retained");
      await unlink(path);
      console.log(JSON.stringify({ profile, disconnected: true }));
      return true;
    }
    if (isAuth && name !== "login") throw Error("Use auth login|status|logout");
    if (isAuth && data)
      throw Error(
        "Profile exists; use whoami, or auth logout before replacing it. Select ATLAS_PROFILE for an independent connection.",
      );
    if (!isAuth && data?.kind !== "oauth") throw Error("Login required");
    const save = async () => {
      const temporary = path + "." + randomUUID() + ".tmp";
      const f = await open(
        temporary,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await f.writeFile(JSON.stringify(data));
        await f.sync();
      } finally {
        await f.close();
      }
      await rename(temporary, path);
    };
    let callback: Promise<string> | undefined;
    let verifier = "";
    const state = randomBytes(32).toString("hex");
    if (isAuth) {
      data = { kind: "oauth", url: url.origin };
      let accept!: (code: string) => void, reject!: (e: Error) => void;
      callback = new Promise((yes, no) => {
        accept = yes;
        reject = no;
      });
      void callback.catch(() => {});
      const server = createServer((req, res) => {
        res.setHeader("Cache-Control", "no-store");
        const u = new URL(req.url ?? "/", data.redirect);
        const received = u.searchParams.get("state") ?? "";
        if (
          req.method !== "GET" ||
          req.headers.host !== new URL(data.redirect).host ||
          u.pathname !== "/callback" ||
          !/^[a-f0-9]{64}$/.test(received) ||
          received.length !== state.length ||
          !timingSafeEqual(Buffer.from(received), Buffer.from(state)) ||
          u.searchParams.get("iss") !== url.origin
        ) {
          res.writeHead(400).end("Invalid callback");
          return;
        }
        if (u.searchParams.has("error")) {
          res.end("Connection declined.");
          reject(Error("Declined"));
        } else if (u.searchParams.get("code")) {
          res.end("Return to your terminal to complete Atlas setup.");
          accept(u.searchParams.get("code")!);
        } else {
          res.writeHead(400).end("Missing code");
          return;
        }
        stop?.();
      });
      await new Promise<void>((yes, no) => {
        server.once("error", no);
        server.listen(0, "127.0.0.1", yes);
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw Error("Callback unavailable");
      data.redirect = `http://127.0.0.1:${address.port}/callback`;
      const timer = setTimeout(() => {
        reject(Error("Authorization timed out"));
        stop?.();
      }, 600000);
      stop = () => {
        clearTimeout(timer);
        server.close();
        server.closeAllConnections();
      };
    }
    const provider: OAuthClientProvider = {
      redirectUrl: data.redirect,
      clientMetadata: {
        client_name: "Atlas CLI",
        redirect_uris: [data.redirect],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "atlas:mcp offline_access",
      },
      state: () => state,
      clientInformation: () => data.client,
      saveClientInformation: (info) => {
        data.client = info;
      },
      tokens: () => data.tokens,
      saveTokens: async (tokens) => {
        data.tokens = tokens;
        await save();
      },
      saveCodeVerifier: (v) => {
        verifier = v;
      },
      codeVerifier: () => verifier,
      redirectToAuthorization: async (address) => {
        if (!isAuth || address.origin !== url.origin)
          throw Error("Run auth login in a new profile to authorize");
        console.error(
          "Approve the Atlas connection in your browser. No credentials are printed.",
        );
        await new Promise<void>((yes, no) => {
          const p = spawn(
            process.platform === "darwin"
              ? "open"
              : process.platform === "win32"
                ? "rundll32"
                : "xdg-open",
            process.platform === "win32"
              ? ["url.dll,FileProtocolHandler", address.href]
              : [address.href],
            { stdio: "ignore" },
          );
          p.once("error", no);
          p.once("exit", (code) =>
            code === 0 ? yes() : no(Error("Cannot open browser")),
          );
        });
      },
      validateResourceURL: async (_server, resource) => {
        if (resource && resource !== url.origin + "/mcp")
          throw Error("Wrong OAuth audience");
        return new URL(url.origin + "/mcp");
      },
    };
    if (isAuth) {
      const outcome = await auth(provider, {
        serverUrl: url.origin + "/mcp",
        scope: "atlas:mcp offline_access",
        fetchFn: safeFetch,
      });
      if (outcome !== "REDIRECT") throw Error("Expected browser authorization");
      await auth(provider, {
        serverUrl: url.origin + "/mcp",
        authorizationCode: await callback!,
        fetchFn: safeFetch,
      });
    }
    client = new Client({ name: "atlas-cli", version: "0.6.0-rc.2" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url.origin + "/mcp"), {
        authProvider: provider,
        fetch: safeFetch,
      }),
    );
    let result: unknown;
    if (isAuth || command === "whoami") {
      const identity = await client.readResource({ uri: "atlas://me" });
      data.identity = identity;
      await save();
      result = { profile, identity };
    } else if (command === "list") result = await client.listTools();
    else if (command === "call" && name)
      result = await client.callTool({ name, arguments: JSON.parse(argument) });
    else if (command === "read" && name)
      result = await client.readResource({ uri: name });
    else throw Error("Unsupported command");
    console.log(JSON.stringify(result, null, 2));
    return true;
  } finally {
    stop?.();
    await client?.close().catch(() => {});
    await lock.close();
    await unlink(path + ".lock");
  }
}
