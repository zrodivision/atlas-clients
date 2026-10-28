/** Official pinned Node archives only; cache bytes are untrusted until reverified. */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";

type Curl = (args: string[]) => { status: number | null; stderr: string };
const curl: Curl = (args) => spawnSync("curl", args, { encoding: "utf8" });
const retryable = new Set([6, 7, 18, 28, 33, 35, 52, 56]);
export async function officialNodeArchive(
  runtime: string,
  platform: string,
  arch: string,
  cache: string,
  scratch: string,
  transfer: Curl = curl,
) {
  if (
    !/^\d+\.\d+\.\d+$/.test(runtime) ||
    !["darwin", "linux"].includes(platform) ||
    !["arm64", "x64"].includes(arch)
  )
    throw Error("Invalid Node runtime identity");
  const filename = `node-v${runtime}-${platform}-${arch}.tar.gz`;
  const base = `https://nodejs.org/dist/v${runtime}`;
  async function download(file: string, path: string, resume: boolean) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = transfer([
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--tlsv1.2",
        "--connect-timeout",
        "20",
        "--max-time",
        "300",
        "--speed-limit",
        "16384",
        "--speed-time",
        "30",
        "-fsSL",
        ...(resume ? ["--continue-at", "-"] : []),
        `${base}/${file}`,
        "-o",
        path,
      ]);
      if (result.status === 0) return;
      if (attempt === 2 || !retryable.has(result.status ?? -1))
        throw Error(`Official Node download failed: ${result.stderr}`);
      // A server rejecting Range gets one fresh attempt instead of a corrupt append.
      if (result.status === 33 || !resume) await rm(path, { force: true });
    }
  }
  const manifest = join(scratch, "node-SHASUMS256.txt");
  await download("SHASUMS256.txt", manifest, false);
  const expected = (await readFile(manifest, "utf8"))
    .split("\n")
    .find((line) => line.trim().split(/\s+/)[1] === filename)
    ?.trim()
    .split(/\s+/)[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected))
    throw Error("Official Node checksum missing or malformed");
  const archive = join(scratch, filename),
    cached = join(cache, filename);
  const valid = async (path: string) =>
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex") === expected;
  try {
    // Verify an isolated copy, then extract that exact copy; never trust a cache hit.
    await copyFile(cached, archive);
    if (await valid(archive)) return archive;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await rm(archive, { force: true });
  await download(filename, archive, true);
  if (!(await valid(archive))) throw Error("Node runtime checksum mismatch");
  await mkdir(cache, { recursive: true });
  const staged = join(cache, `${filename}.${randomUUID()}.tmp`);
  try {
    await copyFile(archive, staged);
    await rename(staged, cached);
  } finally {
    await rm(staged, { force: true });
  }
  return archive;
}
