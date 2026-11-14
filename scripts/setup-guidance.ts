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
    schemaVersion: 1,
    authority: "guidance_only",
    target: "Persistent Atlas computer operated by the user's existing agent",
    status: "verify_current_server",
    tool: "atlas_computers",
    cli: "atlas call atlas_computers JSON",
    executableSetupCommand: null,
    discovery: { tool: "atlas_computers", arguments: { action: "describe" } },
    runtime: "Atlas-managed Fly Machines with API-funded Codex execution",
    credentials:
      "No personal model subscription, provider key, authenticated Fly CLI or host-private history transfers to the computer.",
    authorityRequirements: [
      "current authenticated installation and Line",
      "owner-approved computer, storage and task limits",
      "available Energy and current spending consent",
      "selected inputs and explicitly allowed connectors",
    ],
    stages: [
      {
        id: "describe",
        action: "describe",
        check:
          "Select a returned profile and region; inspect missing owner decisions and Energy.",
      },
      {
        id: "provision",
        action: "provision",
        fields: ["requestId", "spec"],
        spec: [
          "profileId",
          "region",
          "label",
          "volumeSizeGb",
          "autoBackupEnabled",
          "snapshotRetention",
        ],
        check: "Save full exact intent and one requestId before allocating.",
      },
      {
        id: "prepare",
        action: "prepare-task",
        fields: ["requestId", "text", "ttlSeconds"],
        check:
          "Retain authorized task input; no inference or spend occurs during preparation.",
      },
      {
        id: "claim",
        tool: "atlas_tasks",
        action: "report",
        state: "WORKING",
        check:
          "Use inspected metadata.atlasVersion as expectedVersion and retain the returned version.",
      },
      { id: "wake", action: "wake", fields: ["computerId", "requestId"] },
      {
        id: "run",
        action: "run",
        fields: ["computerId", "requestId", "taskId", "taskVersion"],
        check:
          "Run the retained claimed task, not an inline prompt or provider key.",
      },
      {
        id: "verify",
        action: "artifact",
        fields: ["computerId", "runRequestId"],
        check:
          "Read the artifact and verify useful work, not only provider admission.",
      },
      {
        id: "pause",
        action: "pause",
        fields: ["computerId", "requestId"],
        check:
          "Retained disk still incurs storage cost; pause is not deletion.",
      },
      {
        id: "continue",
        check:
          "Wake the same computer and run a newly prepared/claimed dependent task that reads retained files.",
      },
    ],
    energy: {
      reservationIsConsumption: false,
      resetCreatesCredit: false,
      meaning:
        "Compute, storage and inference contribute to Energy. Inspect available, reserved, consumed and refunded amounts separately. Reconciliation releases unused holds; do not claim an upstream refund before it is observed.",
    },
    lifetime:
      "Durable owner consent can have no arbitrary testing expiry. Task TTL, short-lived credentials, revocation and spending limits still apply. Reset does not renew expired or revoked consent.",
    recovery: {
      unknownEffect:
        "Inspect the same computer/request; no replacement allocation or fresh request to hide uncertainty.",
      admissionDenied:
        "Restore verified funding and current approval, then retry only identical provision intent.",
      deletion:
        "Delete retains storage. Permanent data cleanup requires separate authorization and a verified receipt.",
    },
    evidenceStates: ["PASS", "FAIL", "BLOCKED", "NOT_RUN"],
    evidenceRequired: [
      "account/installation/Line",
      "installed and served versions",
      "computer and volume identity",
      "current authority",
      "live task result",
      "readable artifact",
      "retained files across pause/wake",
      "Energy and recovery state",
    ],
    reporting:
      "Source, package, deployment, discovery and successful useful work are separate facts. Name the first missing gate; preserve verified progress.",
  };
}
