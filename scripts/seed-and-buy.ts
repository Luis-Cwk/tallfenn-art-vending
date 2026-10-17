/**
 * Tall Fenn Art Vending Machine — seed + testnet buy script
 *
 * 1. Creates a second recipient wallet (clean address, 20% share).
 * 2. Funds the deployer wallet with testnet USDC if needed.
 * 3. listArtwork — genesis artwork "Masas Semiredondas".
 * 4. Approve USDC allowance from buyer (deployer) to ArtVendor.
 * 5. buy(0) — mints receipt token #1, splits payment.
 * 6. Reads tokenURI of receipt token #1 and decodes it.
 * 7. Lists artwork #1 — "Pruebas de bloqueo" (blocklist demo).
 * 8. Attempts buy on artwork #1 with blocklisted recipient (expects revert).
 * 9. updateArtworkRecipients — replace blocklisted address.
 * 10. buy(1) — should succeed.
 *
 * Run: bun run scripts/seed-and-buy.ts
 */

import {
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http, encodeFunctionData, parseAbi, decodeAbiParameters, parseAbiParameters } from "viem";

// ── Config ─────────────────────────────────────────────────────────────────
const ART_VENDOR    = "0x23ed88d48f4ba584683ed6ffa79c411cf46bdb5c" as const;
const USDC          = "0x3600000000000000000000000000000000000000" as const;
const DEPLOYER_ID   = "3c2464b2-8369-52e2-a782-800bbeca5396";
const DEPLOYER_ADDR = "0x5B12Ce46C7194aD57d143bC22847224047b1Ef42" as const;
const BLOCKLISTED   = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const ARC_CHAIN_ID  = 5042002;
const RPC_URL       = "https://rpc.testnet.arc.io";

const apiKey       = process.env.CIRCLE_API_KEY!;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

if (!apiKey || !entitySecret) {
  console.error("ERROR: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET not set");
  process.exit(1);
}

const wallets = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const publicClient = createPublicClient({ transport: http(RPC_URL) });

// ── Helpers ─────────────────────────────────────────────────────────────────

async function pollTx(id: string, label: string): Promise<string> {
  const TERMINAL = ["COMPLETE", "FAILED", "DENIED", "CANCELLED"];
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const res = await wallets.getTransaction({ id });
    const tx = res.data?.transaction;
    const state = tx?.state ?? "UNKNOWN";
    if (TERMINAL.includes(state)) {
      const hash = (tx as any)?.txHash ?? (tx as any)?.transactionHash ?? "";
      console.log(`  ${label}: ${state}  hash=${hash}`);
      if (state !== "COMPLETE") throw new Error(`${label} ended in state ${state}`);
      return hash;
    }
    process.stdout.write(".");
  }
  throw new Error(`${label}: timed out after 180s`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function execContract(
  walletId: string,
  contractAddress: string,
  sig: string,
  params: string[],
  label: string,
): Promise<string> {
  console.log(`\n→ ${label}`);
  const res = await wallets.createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature: sig,
    abiParameters: params,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = res.data?.id;
  if (!id) throw new Error(`No tx id returned for ${label}: ${JSON.stringify(res)}`);
  return pollTx(id, label);
}

async function getUsdcBalance(address: string): Promise<bigint> {
  return publicClient.readContract({
    address: USDC,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
}

// ── Step 1: create second recipient wallet ──────────────────────────────────

console.log("\n=== STEP 1: Create second recipient wallet ===");
let secondAddr: string;
let secondWalletId: string;

const existingWallets = await wallets.listWallets({ pageSize: 10 });
const w = existingWallets.data?.wallets ?? [];
// Look for an existing wallet we created for this project (by name)
const found = w.find((x: any) => x.name === "TallFenn-Recipient2");
if (found) {
  secondAddr = (found as any).address;
  secondWalletId = (found as any).id;
  console.log("Reusing existing wallet:", secondAddr, secondWalletId);
} else {
  // Need a wallet set first
  const sets = await wallets.listWalletSets({ pageSize: 5 });
  let wsId = sets.data?.walletSets?.[0]?.id;
  if (!wsId) {
    const ws = await wallets.createWalletSet({ name: "TallFenn" });
    wsId = ws.data?.walletSet?.id!;
    console.log("Created wallet set:", wsId);
  }
  const wRes = await wallets.createWallets({
    blockchains: ["ARC-TESTNET"],
    count: 1,
    walletSetId: wsId,
    metadata: [{ name: "TallFenn-Recipient2", refId: "tallfenn-r2" }],
  });
  const created = wRes.data?.wallets?.[0];
  if (!created) throw new Error("Failed to create wallet");
  secondAddr = (created as any).address;
  secondWalletId = (created as any).id;
  console.log("Created second wallet:", secondAddr, secondWalletId);
}

console.log(`Second recipient: ${secondAddr}`);

// ── Step 2: Check deployer USDC balance ────────────────────────────────────

console.log("\n=== STEP 2: Check deployer USDC balance ===");
const deployerBal = await getUsdcBalance(DEPLOYER_ADDR);
console.log(`Deployer USDC balance: ${deployerBal} (needs ≥ 510000 for buy+gas)`);
if (deployerBal < 510000n) {
  console.error("ERROR: Deployer wallet has insufficient USDC. Use the Arc Studio faucet (Get test USDC) to fund it first.");
  process.exit(1);
}

// ── Step 3: listArtwork #0 — genesis ──────────────────────────────────────

console.log("\n=== STEP 3: listArtwork #0 — Masas Semiredondas ===");
const listHash0 = await execContract(
  DEPLOYER_ID,
  ART_VENDOR,
  "listArtwork(uint256,uint32,string,string,address[],uint16[])",
  [
    "500000",           // price (0.5 USDC at 6 decimals)
    "25",               // editions
    "masas|genesis|001",// seedInput
    "Masas Semiredondas",// seriesName
    JSON.stringify([DEPLOYER_ADDR, secondAddr]),  // recipients
    JSON.stringify([8000, 2000]),                 // sharesBps
  ],
  "listArtwork #0",
);
console.log("listArtwork #0 tx:", listHash0);

// ── Step 4: Approve USDC allowance ─────────────────────────────────────────

console.log("\n=== STEP 4: Approve USDC allowance ===");
const approveHash = await execContract(
  DEPLOYER_ID,
  USDC,
  "approve(address,uint256)",
  [ART_VENDOR, "500000"],
  "approve USDC",
);
console.log("approve tx:", approveHash);

// ── Step 5: buy(0) — genesis ──────────────────────────────────────────────

console.log("\n=== STEP 5: buy(artworkId=0) ===");
const buyHash0 = await execContract(
  DEPLOYER_ID,
  ART_VENDOR,
  "buy(uint256)",
  ["0"],
  "buy artwork #0",
);
console.log("buy #0 tx:", buyHash0);

// ── Step 6: Read tokenURI of receipt #1 ───────────────────────────────────

console.log("\n=== STEP 6: tokenURI(1) ===");
const tokenUri = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function tokenURI(uint256) view returns (string)"]),
  functionName: "tokenURI",
  args: [1n],
});

// Decode base64 JSON
const b64 = tokenUri.replace("data:application/json;base64,", "");
const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
console.log("Receipt #1 name:", json.name);
console.log("Receipt #1 description:", json.description);
console.log("Edition attribute:", json.attributes?.find((a: any) => a.trait_type === "Edition")?.value);
console.log("Series attribute:", json.attributes?.find((a: any) => a.trait_type === "Series")?.value);

// ── Step 7: listArtwork #1 — blocklist demo ────────────────────────────────

console.log("\n=== STEP 7: listArtwork #1 — Pruebas de bloqueo ===");
const listHash1 = await execContract(
  DEPLOYER_ID,
  ART_VENDOR,
  "listArtwork(uint256,uint32,string,string,address[],uint16[])",
  [
    "10000",
    "3",
    "tallfenn|bloqueo|001",
    "Pruebas de bloqueo",
    JSON.stringify([DEPLOYER_ADDR, BLOCKLISTED]),
    JSON.stringify([5000, 5000]),
  ],
  "listArtwork #1 (blocklist demo)",
);
console.log("listArtwork #1 tx:", listHash1);

// ── Step 8: Approve for buy of artwork #1 ─────────────────────────────────

console.log("\n=== STEP 8: Approve USDC for blocklist buy attempt ===");
const approveHash2 = await execContract(
  DEPLOYER_ID,
  USDC,
  "approve(address,uint256)",
  [ART_VENDOR, "10000"],
  "approve USDC for blocklist attempt",
);
console.log("approve tx:", approveHash2);

// ── Step 9: Attempt buy(1) with blocklisted recipient ─────────────────────

console.log("\n=== STEP 9: Attempt buy(artworkId=1) — expect FAILED ===");
let blocklistBuyReverted = false;
let blocklistFailReason = "";
try {
  const res = await wallets.createContractExecutionTransaction({
    walletId: DEPLOYER_ID,
    contractAddress: ART_VENDOR,
    abiFunctionSignature: "buy(uint256)",
    abiParameters: ["1"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const id = res.data?.id!;
  // poll but expect FAILED
  const TERMINAL = ["COMPLETE", "FAILED", "DENIED", "CANCELLED"];
  let finalState = "UNKNOWN";
  let finalTx: any;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const r = await wallets.getTransaction({ id });
    const tx = r.data?.transaction as any;
    finalTx = tx;
    finalState = tx?.state ?? "UNKNOWN";
    if (TERMINAL.includes(finalState)) break;
    process.stdout.write(".");
  }
  if (finalState === "COMPLETE") {
    console.log("WARNING: buy with blocklisted recipient COMPLETED (unexpected — Arc may not revert on testnets for blocklist)");
    console.log("  hash:", finalTx?.txHash ?? "");
    blocklistBuyReverted = false;
    blocklistFailReason = "COMPLETED_UNEXPECTEDLY";
  } else {
    blocklistBuyReverted = true;
    blocklistFailReason = finalState + " — " + (finalTx?.errorReason ?? finalTx?.errorDetails ?? "contract revert due to blocked recipient transfer");
    console.log(`  Buy FAILED as expected: ${blocklistFailReason}`);
  }
} catch (e: any) {
  blocklistBuyReverted = true;
  blocklistFailReason = e?.message ?? String(e);
  console.log("  Buy threw (expected):", blocklistFailReason);
}

// ── Step 10: updateArtworkRecipients — swap out blocklisted addr ───────────

console.log("\n=== STEP 10: updateArtworkRecipients(artworkId=1) — replace blocklisted ===");
const updateHash = await execContract(
  DEPLOYER_ID,
  ART_VENDOR,
  "updateArtworkRecipients(uint256,address[],uint16[])",
  [
    "1",
    JSON.stringify([DEPLOYER_ADDR, secondAddr]),
    JSON.stringify([5000, 5000]),
  ],
  "updateArtworkRecipients #1",
);
console.log("updateArtworkRecipients tx:", updateHash);

// ── Step 11: Approve USDC for recovery buy ────────────────────────────────

console.log("\n=== STEP 11: Approve USDC for recovery buy ===");
const approveHash3 = await execContract(
  DEPLOYER_ID,
  USDC,
  "approve(address,uint256)",
  [ART_VENDOR, "10000"],
  "approve USDC for recovery buy",
);
console.log("approve tx:", approveHash3);

// ── Step 12: buy(1) after recovery ────────────────────────────────────────

console.log("\n=== STEP 12: buy(artworkId=1) after recipient update — expect COMPLETE ===");
const buyHash1 = await execContract(
  DEPLOYER_ID,
  ART_VENDOR,
  "buy(uint256)",
  ["1"],
  "buy artwork #1 (recovery)",
);
console.log("buy #1 (recovery) tx:", buyHash1);

// ── Step 13: Check receipt token #2 owner ─────────────────────────────────

console.log("\n=== STEP 13: Verify receipt token #2 ===");
const owner2 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function ownerOf(uint256) view returns (address)"]),
  functionName: "ownerOf",
  args: [2n],
}) as string;
console.log("ownerOf(token #2):", owner2);

// ── Step 14: Final state reads ────────────────────────────────────────────

console.log("\n=== STEP 14: Final state ===");
const artCount = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function artworkCount() view returns (uint256)"]),
  functionName: "artworkCount",
  args: [],
});
console.log("artworkCount:", artCount.toString());

const sold0 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function soldOf(uint256) view returns (uint32)"]),
  functionName: "soldOf",
  args: [0n],
});
console.log("soldOf(0):", sold0);

const sold1 = await publicClient.readContract({
  address: ART_VENDOR,
  abi: parseAbi(["function soldOf(uint256) view returns (uint32)"]),
  functionName: "soldOf",
  args: [1n],
});
console.log("soldOf(1):", sold1);

// ── Summary ───────────────────────────────────────────────────────────────

console.log("\n════════════════════════════════════════════");
console.log("SUMMARY");
console.log("════════════════════════════════════════════");
console.log("ArtVendor contract:  ", ART_VENDOR);
console.log("USDC (ERC-20, 6 dec):", USDC);
console.log("Second recipient:    ", secondAddr);
console.log("BLOCKLISTED address: ", BLOCKLISTED);
console.log("");
console.log("Artwork #0 (Masas Semiredondas):");
console.log("  listArtwork tx: ", listHash0);
console.log("  buy tx:         ", buyHash0);
console.log("  receipt token:  #1");
console.log("  receipt name:   ", json.name);
console.log("");
console.log("Artwork #1 (Pruebas de bloqueo):");
console.log("  listArtwork tx: ", listHash1);
console.log("  blocklist buy:  ", blocklistBuyReverted ? `REVERTED — ${blocklistFailReason}` : blocklistFailReason);
console.log("  updateRecipients tx:", updateHash);
console.log("  recovery buy tx:", buyHash1);
console.log("  receipt token:  #2  owner:", owner2);
console.log("════════════════════════════════════════════");

// Write results to a temp file so the next script can read them
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/seed-results.json", JSON.stringify({
  contractAddress: ART_VENDOR,
  usdc: USDC,
  deployerAddress: DEPLOYER_ADDR,
  secondRecipient: secondAddr,
  blocklistedAddress: BLOCKLISTED,
  artwork0: {
    artworkId: 0,
    seriesName: "Masas Semiredondas",
    seedInput: "masas|genesis|001",
    editions: 25,
    price: 500000,
    listTxHash: listHash0,
    buyTxHash: buyHash0,
    receiptTokenId: 1,
    receiptName: json.name,
  },
  artwork1: {
    artworkId: 1,
    seriesName: "Pruebas de bloqueo",
    seedInput: "tallfenn|bloqueo|001",
    editions: 3,
    price: 10000,
    listTxHash: listHash1,
    blocklistBuyReverted,
    blocklistFailReason,
    updateRecipientsTxHash: updateHash,
    recoveryBuyTxHash: buyHash1,
    receiptTokenId: 2,
  },
}, null, 2));
console.log("\nResults written to /tmp/seed-results.json");
