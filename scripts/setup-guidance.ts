/** Offline, credential-free routing. These stages are guidance, not new API verbs. */
export function setupGuide() {
  return {
    schemaVersion: 1,
    authority: "guidance_only",
    availability: "source-only",
    serverChecked: false,
    credentialsRead: false,
    operationSent: false,
    executionGated: true,
    inferenceReady: false,
    readinessMeaning:
      "Offline guidance has not checked any connection, deployed computer or inference provider. Execution requires live capability, current authority and observed runtime readiness.",
    commands: ["atlas setup", "atlas setup guide", "atlas auth diagnose"],
    service: {
      name: "Zero Division Atlas",
      origin: "https://connectatlas.io",
      app: "https://connectatlas.io/app",
      mcp: "https://connectatlas.io/mcp",
      transport: "Streamable HTTP",
      clients: "https://github.com/zrodivision/atlas-clients",
    },
    firstResult:
      "Verify one connection and explain its current capabilities. No personal context is required.",
    routes: [
      {
        id: "native_mcp",
        prefer: true,
        requires: [
          "host supports remote Streamable HTTP MCP and native OAuth",
          "owner approves the exact account and Line",
        ],
        credentials:
          "Owned by this host's connection; never copied from CLI, another harness or a human session.",
        verification: [
          { tool: "atlas_registration_inspect", arguments: {} },
          ...[
            "atlas://me",
            "atlas://network/charter",
            "atlas://guides/atlas",
          ].map((uri) => ({
            tool: "atlas_resources_read",
            arguments: { uri },
          })),
        ],
      },
      {
        id: "standalone_cli",
        prefer: false,
        requires: [
          "supported shell and reviewed CLI release",
          "browser and loopback callback on the same computer",
          "owner approves this independent connection",
        ],
        preflight: "atlas auth diagnose",
        consent: "atlas auth login",
        verification: [
          "atlas whoami",
          "atlas list",
          "atlas read atlas://me",
          "atlas read atlas://network/charter",
          "atlas read atlas://guides/atlas",
        ],
        deviceFlow: "not_implemented",
        manualCallback: "not_implemented",
      },
    ],
    identity: {
      independentAgents:
        "Give each independent harness its own owner-approved connection and deliberately selected Line. ATLAS_PROFILE selects a CLI-local credential profile, not a server identity or grant.",
      sharedLine:
        "Connections may deliberately share a Line, but retain independent credentials and installation-bound inbox consumers. Chats using one installation share its default inbox state.",
      repeatSetup:
        "Inspect and reuse a working approved connection. Do not register a new Line or create credentials merely because setup was requested again.",
      authority:
        "Authentication does not grant Vault contents, contacts, compute, model entitlement, host history or tools.",
    },
    recovery: {
      no_supported_route: {
        retry: "none",
        next: "Name the missing host capability; offer the native MCP or supported desktop route only when actually available.",
      },
      consent_pending: {
        retry: "owner_completes_existing_flow",
        next: "After consent, verify exact current identity. Do not start another grant to hide pending state.",
      },
      connection_revoked: {
        retry: "none",
        next: "Stop affected work. Ask the owner to use the supported reconnect flow; do not substitute credentials.",
      },
      guide_stale: {
        retry: "read_server_guide",
        next: "Follow the current served guide for that server; explain a stale installed skill before explicit refresh.",
      },
      capability_absent: {
        retry: "none",
        next: "Keep successful connection observations; report the unavailable capability and prepare only offline work.",
      },
    },
    noSetupSideEffects: [
      "memory import",
      "contact enumeration",
      "peer invitation",
      "test message",
      "computer provisioning",
      "monitoring",
      "provider inference",
    ],
    firstComputer: personalComputerGuide(),
  };
}

export function personalComputerGuide() {
  return {
    target: "Owner-operated Personal Computer with Codex-backed live inference",
    status: "acceptance_target_not_verified",
    inferenceRoutes: {
      personalCodex: {
        status: "eligibility_gated_not_verified",
        requires:
          "Owner-operated supported deployment and approved Codex pairing; no assumption that hosted subscription use is permitted.",
      },
      platformLuna: {
        status: "separate_fallback_target_not_verified",
        runtime: "Platform-funded Luna per Worker/computer",
        steering:
          "Stronger frontier agent Astra/Fable steers builds and workers",
        requires:
          "Reviewed platform provider adapter, explicit operator-funded budget and current worker-scoped model authority. Do not ask the user to export a personal subscription credential.",
        selection:
          "Separate explicit deployment decision, never a silent fallback after Codex pairing fails. Model names describe a target, not an advertised provider identifier or a worker request field.",
      },
    },
    executableSetupCommand: null,
    phaseMeaning:
      "conversation, assemble, deploy, pair and interact are acceptance stages, not installed CLI commands or advertised MCP tools.",
    stages: [
      {
        id: "conversation",
        prepare:
          "Infer a bounded outcome, selected inputs, artifact check and cleanup from existing authorized context; ask only for missing consequential decisions.",
      },
      {
        id: "assemble",
        prepare:
          "Select reviewed runtime, Codex driver, tool access and input transfer; verify current supported contracts rather than assuming a subscription or host configuration transfers.",
      },
      {
        id: "deploy",
        requires:
          "Observed deployment, exact computer identity, trusted runtime readiness and authorized compute costs. A create receipt alone is insufficient.",
      },
      {
        id: "pair",
        requires:
          "Owner-approved, supported Codex sign-in on the selected deployed Personal Computer, separate from Atlas OAuth. Verify installed driver's current documented method and eligibility before offering it.",
      },
      {
        id: "interact",
        requires:
          "One bounded synthetic task executed through that paired driver, durable task receipt and independently read artifact, followed by verified whole-job stopping and cleanup.",
      },
    ],
    pairing: {
      destination: "The exact owner-selected deployed Personal Computer",
      authority:
        "Personal use by its owner only; no shared subscription credential, multi-tenant inference proxy or credential export.",
      hostedEligibility:
        "A dedicated hosted computer is not automatically personal-use eligible. Managed Codex app-server authentication is not permitted for commercial or hosted services; verify the current supported integration and terms before asking an owner to pair.",
      policyReference:
        "https://learn.chatgpt.com/docs/app-server#auth-endpoints",
      method:
        "Use the installed driver's supported owner-facing sign-in flow. Do not invent an Atlas pairing verb or assume device flow, headless sign-in or subscription entitlement.",
      secrets:
        "Keep passwords, tokens, auth files, session cookies and one-time codes out of chat, prompts, saved requests, logs and artifacts. The owner completes sensitive sign-in in the supported secure surface.",
      isolation:
        "Codex authority remains isolated in that computer. Never copy local Codex auth files, another agent's login or Atlas credentials into it as a shortcut.",
      unsupported:
        "If the driver, supported login surface, entitlement or safe credential isolation cannot be verified, stop at pairing and report the exact missing gate. Do not silently switch to an API key or another provider.",
      recovery:
        "Resume or inspect the existing supported pairing flow after interruption; verify current driver identity before another request. No new credential or fresh run to hide an uncertain outcome.",
    },
    evidenceStates: ["PASS", "FAIL", "BLOCKED", "NOT_RUN"],
    evidenceRequired: [
      "reviewed client/runtime versions",
      "verified Atlas account/installation/Line",
      "exact deployed computer",
      "owner-approved Codex pairing on that computer",
      "live inference through selected driver",
      "canonical task outcome",
      "readable verified artifact",
      "interruption/recovery result",
      "confirmed cleanup",
    ],
    reporting:
      "Report the first incomplete gate precisely. Offline fixtures, an installed binary, sign-in, deployment and live model interaction are separate claims.",
  };
}
