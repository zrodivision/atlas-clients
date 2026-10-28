import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { officialNodeArchive } from "./node-runtime.js";
const root = await mkdtemp(join(tmpdir(), "atlas-node-download-"));
const bytes = Buffer.from("synthetic official archive bytes");
const name = "node-v22.23.1-darwin-arm64.tar.gz";
const checksum = createHash("sha256").update(bytes).digest("hex");
const cache = join(root, "cache");
let generation = 0;
async function exercise(mode: string, targetCache = cache) {
  const scratch = join(root, String(generation++));
  await mkdir(scratch);
  const calls: string[][] = [];
  let archiveAttempts = 0;
  const result = officialNodeArchive(
    "22.23.1",
    "darwin",
    "arm64",
    targetCache,
    scratch,
    (args) => {
      calls.push(args);
      assert.ok(args.includes("--max-time") && args.includes("300"));
      assert.ok(args.includes("--connect-timeout") && args.includes("20"));
      assert.ok(args.includes("--speed-time") && args.includes("30"));
      const url = args.find((v) => v.startsWith("https:"))!;
      assert.ok(url.startsWith("https://nodejs.org/dist/v22.23.1/"));
      assert.ok(!args.includes("-k") && !args.includes("--insecure"));
      const out = args[args.indexOf("-o") + 1];
      if (mode === "unavailable") return { status: 28, stderr: "timeout" };
      if (mode === "forbidden") return { status: 22, stderr: "403" };
      if (url.endsWith("SHASUMS256.txt")) {
        writeFileSync(
          out,
          mode === "missing-checksum"
            ? "no matching archive"
            : `${checksum}  ${name}\n`,
        );
        return { status: 0, stderr: "" };
      }
      archiveAttempts++;
      assert.ok(args.includes("--continue-at"));
      if (
        (mode === "resume" || mode === "range-rejected") &&
        archiveAttempts === 1
      ) {
        writeFileSync(out, bytes.subarray(0, 8));
        return { status: 28, stderr: "partial timeout" };
      }
      if (mode === "resume" && archiveAttempts === 2)
        assert.deepEqual(readFileSync(out), bytes.subarray(0, 8));
      if (mode === "range-rejected" && archiveAttempts === 2)
        return { status: 33, stderr: "range unsupported" };
      if (mode === "range-rejected" && archiveAttempts === 3)
        assert.equal(
          existsSync(out),
          false,
          "Range rejection discards partial bytes",
        );
      writeFileSync(out, mode === "corrupt" ? "corrupt" : bytes);
      return { status: 0, stderr: "" };
    },
  );
  return {
    result,
    calls,
    get archiveAttempts() {
      return archiveAttempts;
    },
  };
}
try {
  const resumed = await exercise("resume");
  assert.deepEqual(await readFile(await resumed.result), bytes);
  assert.equal(resumed.archiveAttempts, 2);
  const cached = await exercise("normal");
  await cached.result;
  assert.equal(
    cached.calls.length,
    1,
    "Cache reuse still downloads the official checksum manifest",
  );
  assert.equal(cached.archiveAttempts, 0);
  await writeFile(join(cache, name), "corrupt cache");
  const repaired = await exercise("normal");
  await repaired.result;
  assert.equal(repaired.archiveAttempts, 1);
  assert.deepEqual(await readFile(join(cache, name)), bytes);
  const ranged = await exercise("range-rejected", join(root, "range-cache"));
  await ranged.result;
  assert.equal(ranged.archiveAttempts, 3);
  const corruptCache = join(root, "corrupt-cache");
  const corrupt = await exercise("corrupt", corruptCache);
  await assert.rejects(corrupt.result, /checksum mismatch/);
  assert.equal(
    existsSync(join(corruptCache, name)),
    false,
    "Never cache unverified bytes",
  );
  const missing = await exercise("missing-checksum");
  await assert.rejects(missing.result, /checksum missing/);
  assert.equal(
    missing.archiveAttempts,
    0,
    "Missing checksum cannot trust cached bytes",
  );
  const unavailable = await exercise("unavailable");
  await assert.rejects(unavailable.result, /timeout/);
  assert.equal(unavailable.calls.length, 3, "Retries are bounded");
  const forbidden = await exercise("forbidden");
  await assert.rejects(forbidden.result, /403/);
  assert.equal(
    forbidden.calls.length,
    1,
    "Do not retry authorization/HTTP errors",
  );
  console.log(
    "PASS official source/pin, bounded retries/resume, Range fallback, reverified cache and fail-closed checksums",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
