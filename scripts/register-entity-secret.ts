/**
 * One-time entity secret registration for Circle developer-controlled wallets.
 * Run once per Circle entity. Non-idempotent — running again invalidates the
 * previous secret and recovery file.
 *
 * Usage: bun run scripts/register-entity-secret.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey || apiKey.length < 10) {
  console.error("ERROR: CIRCLE_API_KEY is not set in .env");
  process.exit(1);
}

// Generate a 32-byte secret without printing it to stdout
const entitySecret = crypto.randomBytes(32).toString("hex");

// Ensure recovery dir exists under /home/user/app (user-downloadable)
const recoveryDir = "/home/user/app/.circle";
fs.mkdirSync(recoveryDir, { recursive: true });

console.log("Registering entity secret ciphertext with Circle...");

const response = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: recoveryDir,
});

if (!response.data) {
  console.error("ERROR: registration returned no data:", JSON.stringify(response));
  process.exit(1);
}

// Persist recovery file
const recoveryPath = path.join(recoveryDir, "recovery_file.dat");
if (response.data.recoveryFile) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile);
  console.log("Recovery file written to", recoveryPath);
} else {
  // Recovery file may have been written by SDK directly
  if (!fs.existsSync(recoveryPath)) {
    console.warn("WARNING: recovery file not returned by API and not found on disk");
  }
}

// Append CIRCLE_ENTITY_SECRET to .env (never echo the value)
const envPath = "/home/user/app/.env";
fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, "utf-8");
console.log("CIRCLE_ENTITY_SECRET written to .env");

// Verify registration with a read call
const { initiateDeveloperControlledWalletsClient } = await import(
  "@circle-fin/developer-controlled-wallets"
);
const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
await client.listWalletSets({ pageSize: 1 });
console.log("Registration verified: listWalletSets succeeded.");
console.log("DONE. Recovery file path:", recoveryPath);
