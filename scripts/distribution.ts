/** User-facing distribution commands; never read another harness's credentials. */
import {
  readFile,
  mkdir,
  lstat,
  realpath,
  writeFile,
  rename,
  copyFile,
  unlink,
} from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const version = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
).version as string;
export async function distribution(command: string, args: string[]) {
  if (command === "--version" || command === "version") {
    console.log(version);
    return true;
  }
  if (command === "skill") {
    if (
      args[0] !== "install" ||
      args.length !== 2 ||
      !["codex", "claude", "both"].includes(args[1])
    )
      throw Error("Use atlas skill install codex|claude|both");
    const targets = args[1] === "both" ? ["codex", "claude"] : [args[1]];
    const contents = (
      await readFile(join(root, "skills/atlas/SKILL.md"), "utf8")
    ).replace("name: atlas-local", "name: atlas");
    for (const target of targets) {
      const directory = join(
        homedir(),
        target === "codex" ? ".agents/skills/atlas" : ".claude/skills/atlas",
      );
      let ancestor = directory;
      while (
        !(await lstat(ancestor).catch((e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        }))
      )
        ancestor = resolve(ancestor, "..");
      if ((await realpath(ancestor)) !== ancestor)
        throw Error("Refusing symlink skill directory");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if ((await realpath(directory)) !== directory)
        throw Error("Refusing symlink skill directory");
      const path = join(directory, "SKILL.md");
      const stat = await lstat(path).catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
      if (stat && (!stat.isFile() || stat.nlink !== 1))
        throw Error("Refusing non-regular skill file");
      const existing = stat ? await readFile(path, "utf8") : null;
      if (existing !== contents) {
        if (existing !== null)
          await copyFile(
            path,
            path + ".backup-" + randomUUID(),
            constants.COPYFILE_EXCL,
          );
        const temporary = path + "." + randomUUID();
        try {
          await writeFile(temporary, contents, { mode: 0o600, flag: "wx" });
          await rename(temporary, path);
        } finally {
          await unlink(temporary).catch(() => {});
        }
      }
      console.log(
        `Atlas skill installed for ${target}: ${path}. Start a fresh chat to load it.`,
      );
    }
    return true;
  }
  if (command === "update") {
    if (args.length && (args.length !== 2 || args[0] !== "--version"))
      throw Error("Use atlas update [--version VERSION]");
    const installRoot = resolve(root, "../..");
    // Only native installs have this managed layout. npm users update through their package manager.
    const manifest = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    if (
      !manifest.native ||
      !root.startsWith(join(installRoot, "versions") + "/")
    )
      throw Error("Use the standalone installer to enable atlas update");
    let selected = args[1];
    if (!selected) {
      const preview = version.includes("-rc.");
      const response = await fetch(
        "https://api.github.com/repos/zrodivision/atlas-clients/releases" +
          (preview ? "?per_page=100" : "/latest"),
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        },
      );
      if (!response.ok) throw Error("Could not check Atlas releases");
      const json = await response.json();
      const release = preview
        ? json.find(
            (r: any) =>
              !r.draft && /^v\d+\.\d+\.\d+(-rc\.\d+)?$/.test(r.tag_name),
          )
        : json;
      if (!release) throw Error("No matching release available");
      selected = release.tag_name;
    }
    if (!/^v?\d+\.\d+\.\d+(-rc\.\d+)?$/.test(selected))
      throw Error("Invalid release version");
    const installed = JSON.parse(
      await readFile(join(installRoot, "install.json"), "utf8"),
    );
    const result = spawnSync(
      "sh",
      [join(root, "update.sh"), "--version", selected],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          ATLAS_INSTALL_DIR: installRoot,
          ATLAS_BIN_DIR: installed.bin,
        },
      },
    );
    if (result.status !== 0) throw Error("Atlas update did not complete");
    console.log(
      "CLI updated. Run atlas skill install again to refresh any standalone skills.",
    );
    return true;
  }
  return false;
}
