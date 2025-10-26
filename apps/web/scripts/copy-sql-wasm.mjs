import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function locateSqlWasm() {
  try {
    const resolved = import.meta.resolve("sql.js-fts5/dist/sql-wasm.wasm");
    return fileURLToPath(resolved);
  } catch (error) {
    console.warn(
      "[copy-sql-wasm] Unable to resolve sql.js-fts5/dist/sql-wasm.wasm:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function main() {
  const sourcePath = await locateSqlWasm();
  if (!sourcePath) {
    return;
  }

  try {
    await access(sourcePath, constants.F_OK);
  } catch {
    console.warn("[copy-sql-wasm] sql-wasm.wasm not found at", sourcePath);
    return;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const targetPath = resolve(scriptDir, "../public/vendor/sql-wasm.wasm");

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);

  console.log("[copy-sql-wasm] Copied sql-wasm.wasm to", targetPath);
}

main().catch((error) => {
  console.error("[copy-sql-wasm] Failed to copy sql-wasm.wasm:", error);
});
