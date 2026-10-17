/**
 * Tall Fenn Art Vending Machine — fund + seed + buy script
 *
 * Uses the DCW wallet (owner of the v2 contract) to:
 *  1. Fund itself with testnet USDC via requestTestnetTokens
 *  2. listArtwork #0 — "Masas Semiredondas" (genesis)
 *  3. approve USDC + buy(0) → receipt token #1
 *  4. listArtwork #1 — "Pruebas de bloqueo" (blocklist demo)
 *  5. approve USDC + attempt buy(1) → expects FAILED (blocklisted recipient on Arc)
 *  6. updateArtworkRecipients(1) → replace blocklisted addr
 *  7. approve USDC + buy(1) → receipt token #2 (recovery success)
 *
 * Run: bun run scripts/fund-and-seed.ts
 */

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http, parseAbi } from "viem";
import { writeFileSync } from "node:fs";

// ── Config ──────────────────────────────────────────────────────────────────
// v2 contract: owner = DCW wallet
const ART_VENDOR    = "0x10feb1dbcdf2e6ddcd2fe7a3209001c75e6509d0" as const;
const USDC          = "0x3600000000000000000000000000000000000000" as const;
// DCW wallet = owner of contract AND buyer wallet
const OWNER_WALLET_ID   = "0e9c3197-41fb-5be9-9ee8-6f725734fe7b";
const OWNER_ADDR        = "0x840448cb25148eac5b3a92b7d2372f8360943b03" as const;
// Second clean recipient — deployer platform wallet address (not callable as signer, fine as payee)
const SECOND_RECIPIENT  = "0x5B12Ce46C7194aD57d143bC22847224047b1Ef42" as const;
// Arc-documented blocklisted test address
const BLOCKLISTED       = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const RPC_URL           = "https://rpc.testnet.arc.io";

const apiKey       = process.env.CIRCLE_API_KEY!;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;
if (!apiKey || !entitySecret) { console.error("Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET"); process.exit(1); }

const wallets = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
const publicClient = createPublicClient({ transport: http(RPC_URL) });

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function pollTx(id: string, label: string, allowFail = false): Promise<{ hash: string; state: string }> {
  const TERMINAL = ["COMPLETE", "FAILED", "DENIED", "CANCELLED"];
  for (let i = 0; i < 80; i++) {
    await sleep(3000);
    const res = await wallets.getTransaction({ id });
    const tx = res.data?.transaction as any;
    const state: string = tx?.state ?? "UNKNOWN";
    if (TERMINAL.includes(state)) {
      const hash: string = tx?.txHash ?? tx?.transactionHash ?? "";
      console.log(`  ${label}: ${state}  hash=${hash}`);
      if (state !== "COMPLETE" && !allowFail) throw new Error(`${label} ended in state ${state} — ${tx?.errorReason ?? ""}`);
      return { hash, state };
    }
    process.stdout.write(".");
  }
  throw new Error(`${label}: timed out after 240s`);
}

async function execContract(sig: string, params: string[], label: string, allowFail = false) {
  console.log(`\n→ ${label}`);
  const res = await wallets.createContractExecutionTransaction({
    walletId: OWNER_WALLET_ID,
    contractAddress: ART_VENDOR,
    abiFunctionSignature: sig,
    abiParameters: params,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = res.data?.id;
  if (!id) throw new Error(`No tx id for ${label}: ${JSON.stringify(res.data)}`);
  return pollTx(id, label, allowFail);
}

async function execToken(contractAddr: string, sig: string, params: string[], label: string) {
  console.log(`\n→ ${label}`);
  const res = await wallets.createContractExecutionTransaction({
    walletId: OWNER_WALLET_ID,
    contractAddress: contractAddr,
    abiFunctionSignature: sig,
    abiParameters: params,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = res.data?.id;
  if (!id) throw new Error(`No tx id for ${label}: ${JSON.stringify(res.data)}`);
  return pollTx(id, label);
}

async function readUsdcBalance(addr: string): Promise<bigint> {
  return publicClient.readContract({
    address: USDC,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [addr as `0x${string}`],
  });
}

// ── Step 1: Fund DCW wallet with testnet USDC ────────────────────────────────
console.log("\n=== STEP 1: Fund DCW wallet with testnet USDC ===");
let bal = await readUsdcBalance(OWNER_ADDR);
console.log(`Current balance: ${bal} (6-dec units)`);
if (bal < 600_000n) {
  console.log("Requesting testnet USDC via requestTestnetTokens...");
  const faucetRes = await wallets.requestTestnetTokens({
    blockchain: "ARC-TESTNET",
    address: OWNER_ADDR,
    token: "USDC",
  } as any);
  console.log("Faucet response:", JSON.stringify(faucetRes.data ?? faucetRes));
  // Wait for funds to arrive
  for (let i = 0; i < 20; i++) {
    await sleep(4000);
    bal = await readUsdcBalance(OWNER_ADDR);
    if (bal >= 600_000n) break;
    process.stdout.write(".");
  }
}
console.log(`Balance after funding: ${bal}`);
if (bal < 510_000n) {
  console.error("ERROR: Still insufficient USDC. Aborting.");
  process.exit(1);
}

// ── Step 2: listArtwork #0 — Masas Semiredondas ─────────────────────────────
console.log("\n=== STEP 2: listArtwork #0 — Masas Semiredondas ===");
const list0 = await execContract(
  "listArtwork(uint256,uint32,string,string,address[],uint16[])",
  [
    "500000",
    "25",
    "masas|genesis|001",
    "Masas Semiredondas",
    JSON.stringify([OWNER_ADDR, SECOND_RECIPIENT]),
    JSON.stringify([8000, 2000]),
  ],
  "listArtwork #0",
);
console.log("listArtwork #0 tx:", list0.hash);

// ── Step 3: Approve USDC → ArtVendor ────────────────────────────────────────
console.log("\n=== STEP 3: Approve USDC for buy #0 ===");
const approve0 = await execToken(USDC, "approve(address,uint256)", [ART_VENDOR, "500000"], "approve #0");
console.log("approve #0 tx:", approve0.hash);

// ── Step 4: buy(0) ───────────────────────────────────────────────────────────
console.log("\n=== STEP 4: buy(artworkId=0) ===");
const buy0 = await execContract("buy(uint256)", ["0"], "buy #0");
console.log("buy #0 tx:", buy0.hash);

// ── Step 5: Read tokenURI of receipt #1 ─────────────────────────────────────
console.log("\n=== STEP 5: Read tokenURI(1) ===");
const tokenUri1 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function tokenURI(uint256) view returns (string)"]),
  functionName: "tokenURI",
  args: [1n],
});
const b64_1 = tokenUri1.replace("data:application/json;base64,", "");
const meta1 = JSON.parse(Buffer.from(b64_1, "base64").toString("utf-8"));
console.log("Receipt #1 name:   ", meta1.name);
console.log("Receipt #1 desc:   ", meta1.description);
console.log("Edition attr:      ", meta1.attributes?.find((a: any) => a.trait_type === "Edition")?.value);
console.log("Series attr:       ", meta1.attributes?.find((a: any) => a.trait_type === "Series")?.value);
console.log("Artwork ID attr:   ", meta1.attributes?.find((a: any) => a.trait_type === "Artwork ID")?.value);
const seedHashAttr = meta1.attributes?.find((a: any) => a.trait_type === "Seed Hash")?.value;
console.log("Seed Hash attr:    ", seedHashAttr);

// ── Step 6: listArtwork #1 — Pruebas de bloqueo ─────────────────────────────
console.log("\n=== STEP 6: listArtwork #1 — Pruebas de bloqueo ===");
const list1 = await execContract(
  "listArtwork(uint256,uint32,string,string,address[],uint16[])",
  [
    "10000",
    "3",
    "tallfenn|bloqueo|001",
    "Pruebas de bloqueo",
    JSON.stringify([OWNER_ADDR, BLOCKLISTED]),
    JSON.stringify([5000, 5000]),
  ],
  "listArtwork #1",
);
console.log("listArtwork #1 tx:", list1.hash);

// ── Step 7: Approve USDC for blocklist buy attempt ───────────────────────────
console.log("\n=== STEP 7: Approve USDC for blocklist buy ===");
const approve1a = await execToken(USDC, "approve(address,uint256)", [ART_VENDOR, "10000"], "approve for blocklist buy");
console.log("approve tx:", approve1a.hash);

// ── Step 8: Attempt buy(1) — expect FAILED (blocklisted recipient on Arc) ────
console.log("\n=== STEP 8: Attempt buy(artworkId=1) — expect FAILED ===");
const blocklistAttempt = await execContract("buy(uint256)", ["1"], "buy #1 (blocklist attempt)", true);
console.log("Blocklist attempt state:", blocklistAttempt.state, "hash:", blocklistAttempt.hash);
const blocklistReverted = blocklistAttempt.state !== "COMPLETE";
const blocklistOutcome = blocklistReverted
  ? `REVERTED — tx state: ${blocklistAttempt.state} (Arc blocked transfer to ${BLOCKLISTED})`
  : `COMPLETED (Arc did not revert — blocklist may not apply on this testnet endpoint)  tx: ${blocklistAttempt.hash}`;
console.log("Blocklist outcome:", blocklistOutcome);

// ── Step 9: updateArtworkRecipients(1) — replace blocklisted ─────────────────
console.log("\n=== STEP 9: updateArtworkRecipients(artworkId=1) ===");
const update1 = await execContract(
  "updateArtworkRecipients(uint256,address[],uint16[])",
  ["1", JSON.stringify([OWNER_ADDR, SECOND_RECIPIENT]), JSON.stringify([5000, 5000])],
  "updateArtworkRecipients #1",
);
console.log("updateArtworkRecipients tx:", update1.hash);

// ── Step 10: Approve USDC for recovery buy ───────────────────────────────────
console.log("\n=== STEP 10: Approve USDC for recovery buy ===");
const approve1b = await execToken(USDC, "approve(address,uint256)", [ART_VENDOR, "10000"], "approve for recovery buy");
console.log("approve tx:", approve1b.hash);

// ── Step 11: buy(1) after recovery ───────────────────────────────────────────
console.log("\n=== STEP 11: buy(artworkId=1) — recovery buy ===");
const buy1 = await execContract("buy(uint256)", ["1"], "buy #1 (recovery)");
console.log("buy #1 recovery tx:", buy1.hash);

// ── Step 12: Read tokenURI of receipt #2 ─────────────────────────────────────
console.log("\n=== STEP 12: Read tokenURI(2) ===");
const tokenUri2 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function tokenURI(uint256) view returns (string)"]),
  functionName: "tokenURI",
  args: [blocklistReverted ? 2n : 3n],  // if blocklist buy completed, token #2 was minted then, recovery = #3
});
const b64_2 = tokenUri2.replace("data:application/json;base64,", "");
const meta2 = JSON.parse(Buffer.from(b64_2, "base64").toString("utf-8"));
console.log("Recovery receipt name:", meta2.name);

// ── Step 13: Verify final state ───────────────────────────────────────────────
console.log("\n=== STEP 13: Final contract state ===");
const artCount = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function artworkCount() view returns (uint256)"]),
  functionName: "artworkCount",
});
const sold0 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function soldOf(uint256) view returns (uint32)"]),
  functionName: "soldOf",
  args: [0n],
});
const sold1 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function soldOf(uint256) view returns (uint32)"]),
  functionName: "soldOf",
  args: [1n],
});
console.log("artworkCount:", artCount.toString());
console.log("soldOf(0):", sold0, "soldOf(1):", sold1);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════════════════");
console.log("SUMMARY");
console.log("════════════════════════════════════════════════════");
console.log("ArtVendor v2:         ", ART_VENDOR);
console.log("USDC (ERC-20, 6 dec): ", USDC);
console.log("Owner/buyer wallet:   ", OWNER_ADDR);
console.log("Second recipient:     ", SECOND_RECIPIENT);
console.log("Blocklisted addr:     ", BLOCKLISTED);
console.log("");
console.log("Artwork #0 (Masas Semiredondas):");
console.log("  listArtwork tx:", list0.hash);
console.log("  buy tx:        ", buy0.hash);
console.log("  receipt token: #1");
console.log("  receipt name:  ", meta1.name);
console.log("  seedHash:      ", seedHashAttr);
console.log("");
console.log("Artwork #1 (Pruebas de bloqueo):");
console.log("  listArtwork tx:", list1.hash);
console.log("  blocklist buy: ", blocklistOutcome);
console.log("  updateRecipients tx:", update1.hash);
console.log("  recovery buy tx:   ", buy1.hash);
console.log("  recovery receipt:  ", meta2.name);
console.log("════════════════════════════════════════════════════");

// Save results
writeFileSync("/tmp/seed-results.json", JSON.stringify({
  artVendorV1: "0x23ed88d48f4ba584683ed6ffa79c411cf46bdb5c",
  artVendorV2: ART_VENDOR,
  usdc: USDC,
  usdcDecimalsOnchain: 6,
  ownerWallet: OWNER_ADDR,
  secondRecipient: SECOND_RECIPIENT,
  blocklistedAddress: BLOCKLISTED,
  artwork0: {
    artworkId: 0, seriesName: "Masas Semiredondas", seedInput: "masas|genesis|001",
    editions: 25, price: 500000,
    listTxHash: list0.hash, buyTxHash: buy0.hash,
    receiptTokenId: 1, receiptName: meta1.name, seedHash: seedHashAttr,
  },
  artwork1: {
    artworkId: 1, seriesName: "Pruebas de bloqueo", seedInput: "tallfenn|bloqueo|001",
    editions: 3, price: 10000,
    listTxHash: list1.hash,
    blocklistBuyReverted: blocklistReverted,
    blocklistOutcome,
    updateRecipientsTxHash: update1.hash,
    recoveryBuyTxHash: buy1.hash,
  },
}, null, 2));
console.log("\nResults written to /tmp/seed-results.json");
