# Atlas clients 0.12.0 (historical)

This historical release note is not current production guidance. Cellular workflows are retired; follow the maintained native-only skill and deployed discovery. Do not use these old publication instructions for the current candidate.

This release aligns the canonical skill and generated host plugins with Atlas service 0.12.0: account-only conversations, explicitly bounded call delegation, captured human speech versus remote evidence, and durable task continuation/recovery. Existing CLI/MCP authentication remains unchanged. Contacts and call consent never grant vault or connector authority.

Publish through the existing manually dispatched GitHub release workflow after main checks pass. It builds and verifies four native archives and checksums; it neither publishes npm nor deploys the service. The target tag is `v0.12.0`. Reconnect hosts after explicitly updating an installed client; source merge alone does not update installations.

Controlled contract/package/browser tests do not establish physical audio, native-host rendering or live Agents API acceptance. The server release coordinates additive migrations and operator flags separately. Mobile and experimental SDK/platform work are excluded.
