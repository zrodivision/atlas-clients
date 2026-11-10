/** SDK regression checks with synthetic state and injected fetch; no real OAuth. */
import assert from "node:assert/strict";
import {
  auth,
  refreshAuthorization,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
const issuer = "https://issuer.example";
const other = "https://other.example";
const serverUrl = "https://resource.example/mcp";
const metadata = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: origin + "/authorize",
  token_endpoint: origin + "/token",
  response_types_supported: ["code"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
});
let requests = 0;
const failFetch: typeof fetch = async () => {
  requests++;
  throw Error("No network allowed");
};
const provider: OAuthClientProvider = {
  redirectUrl: "http://127.0.0.1:4321/callback",
  clientMetadata: {
    redirect_uris: ["http://127.0.0.1:4321/callback"],
    token_endpoint_auth_method: "none",
  },
  clientInformation: () => ({ client_id: "synthetic-client", issuer }),
  tokens: () => ({
    access_token: "synthetic-access",
    refresh_token: "synthetic-refresh",
    token_type: "Bearer",
    issuer,
  }),
  saveTokens: () => {
    throw Error("Unexpected save");
  },
  redirectToAuthorization: () => {
    throw Error("Unexpected authorization");
  },
  saveCodeVerifier: () => {
    throw Error("Unexpected verifier");
  },
  codeVerifier: () => "synthetic-verifier",
  discoveryState: () => ({
    authorizationServerUrl: other,
    authorizationServerMetadata: metadata(other),
    resourceMetadata: { resource: serverUrl },
  }),
};
await assert.rejects(
  auth(provider, { serverUrl, fetchFn: failFetch }),
  /bound to authorization server/,
);
assert.equal(
  requests,
  0,
  "issuer-bound credentials cannot be sent to a different issuer",
);

let saved: unknown;
const sameIssuer: OAuthClientProvider = {
  ...provider,
  discoveryState: () => ({
    authorizationServerUrl: issuer,
    authorizationServerMetadata: metadata(issuer),
    resourceMetadata: { resource: serverUrl },
  }),
  saveTokens: (tokens) => {
    saved = JSON.parse(JSON.stringify(tokens));
  },
};
assert.equal(
  await auth(sameIssuer, {
    serverUrl,
    fetchFn: async (input, init) => {
      requests++;
      assert.equal(String(input), issuer + "/token");
      assert.equal(init?.redirect, "manual");
      assert.match(String(init?.body), /refresh_token=synthetic-refresh/);
      return new Response(
        JSON.stringify({
          access_token: "synthetic-new-access",
          refresh_token: "synthetic-new-refresh",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  }),
  "AUTHORIZED",
);
assert.deepEqual(saved, {
  access_token: "synthetic-new-access",
  refresh_token: "synthetic-new-refresh",
  token_type: "Bearer",
  issuer,
});
assert.equal(requests, 1);

let redirectedRequests = 0;
await assert.rejects(
  refreshAuthorization(issuer, {
    metadata: metadata(issuer),
    clientInformation: { client_id: "synthetic-client", issuer },
    refreshToken: "synthetic-refresh",
    fetchFn: async (input, init) => {
      redirectedRequests++;
      assert.equal(String(input), issuer + "/token");
      assert.equal(init?.redirect, "manual");
      return new Response(null, {
        status: 307,
        headers: { Location: other + "/collect" },
      });
    },
  }),
);
assert.equal(
  redirectedRequests,
  1,
  "a cross-origin redirect cannot forward the token body",
);
console.log(
  "PASS SDK issuer-bound credentials, persisted token issuer and cross-origin redirect refusal (synthetic, injected fetch only)",
);
