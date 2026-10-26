// Runs only from a checksum-verified release archive, using its bundled runtime.
const fs = require("node:fs");
const path = require("node:path");
const [source, root, bin, hash, requested] = process.argv.slice(2);
const pkg = JSON.parse(
  fs.readFileSync(path.join(source, "package.json"), "utf8"),
);
if (
  !/^\d+\.\d+\.\d+(-rc\.\d+)?$/.test(pkg.version) ||
  (requested !== "latest" && requested !== "v" + pkg.version)
)
  throw Error("Release version mismatch");
if (pkg.platform !== process.platform || pkg.arch !== process.arch)
  throw Error("Release platform mismatch");
const versions = path.join(root, "versions");
if (fs.existsSync(versions) && fs.lstatSync(versions).isSymbolicLink())
  throw Error("Refusing symlink versions directory");
fs.mkdirSync(versions, { recursive: true });
const destination = path.join(
  versions,
  pkg.version +
    "-" +
    hash.slice(0, 16) +
    "-" +
    require("node:crypto").randomUUID(),
);
// Never reuse a possibly modified installation; activate the newly verified bytes.
fs.renameSync(source, destination);
const current = path.join(root, "current");
const previous = path.join(root, "previous");
function atomicLink(target, link) {
  if (fs.existsSync(link) && !fs.lstatSync(link).isSymbolicLink())
    throw Error("Refusing unmanaged path: " + link);
  const temp = link + ".next-" + process.pid;
  try {
    fs.symlinkSync(target, temp);
    fs.renameSync(temp, link);
  } finally {
    if (
      fs.existsSync(temp) ||
      (() => {
        try {
          return fs.lstatSync(temp).isSymbolicLink();
        } catch {
          return false;
        }
      })()
    )
      fs.unlinkSync(temp);
  }
}
if (fs.existsSync(current)) {
  if (!fs.lstatSync(current).isSymbolicLink())
    throw Error("Refusing unmanaged current directory");
  const old = fs.readlinkSync(current);
  if (old !== destination) atomicLink(old, previous);
}
const config = path.join(root, "install.json");
fs.writeFileSync(config + ".next", JSON.stringify({ bin }), {
  mode: 0o600,
  flag: "wx",
});
fs.renameSync(config + ".next", config);
atomicLink(destination, current);
atomicLink(path.join(root, "current/atlas"), path.join(bin, "atlas"));
