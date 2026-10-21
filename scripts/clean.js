const fs = require("node:fs/promises");
const path = require("node:path");

const buildDir = path.join(__dirname, "..", "build");

async function main() {
  await fs.rm(buildDir, { recursive: true, force: true });
  console.log("Removed build/");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
