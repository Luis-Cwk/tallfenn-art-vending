/**
 * Tall Fenn Art Vending Machine — seed + buy via viem
 *
 * Uses the well-known Hardhat test account #0 (owner of the v3 contract,
 * pre-funded on Arc Testnet) for all operations.
 *
 * Run: bun run scripts/seed-viem.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  defineChain,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { writeFileSync } from "node:fs";

// ── Chain ─────────────────────────────────────────────────────────────────────
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
});

// ── Addresses ─────────────────────────────────────────────────────────────────
const ART_VENDOR  = "0xced7cd9590b112da9149d29176b17630ed022266" as const;
const USDC        = "0x3600000000000000000000000000000000000000" as const;
// Hardhat test account #0 — funded on Arc Testnet, owner of the contract
const OWNER_PK    = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const OWNER_ACCT  = privateKeyToAccount(OWNER_PK);
const OWNER_ADDR  = OWNER_ACCT.address; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// Second recipient (DCW wallet — receives 20% / 50% payouts; no signing needed)
const SECOND_RECIPIENT = "0x840448cb25148eac5b3a92b7d2372f8360943b03" as const;
// Arc-documented blocklisted test address (mnemonic index 1)
const BLOCKLISTED = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const walletClient = createWalletClient({ account: OWNER_ACCT, chain: arcTestnet, transport: http() });

// ── ABIs ──────────────────────────────────────────────────────────────────────
const VENDOR_ABI = parseAbi([
  "function listArtwork(uint256 price, uint32 editions, string calldata seedInput, string calldata seriesName, address[] calldata recipients, uint16[] calldata sharesBps) external returns (uint256)",
  "function buy(uint256 artworkId) external",
  "function updateArtworkRecipients(uint256 artworkId, address[] calldata recipients, uint16[] calldata sharesBps) external",
  "function artworkCount() external view returns (uint256)",
  "function soldOf(uint256 artworkId) external view returns (uint32)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "event ArtworkListed(uint256 indexed artworkId, address indexed artist, uint256 price, uint32 editions, string seriesName, bytes32 seedHash)",
  "event ArtworkSold(uint256 indexed artworkId, address indexed buyer, uint32 editionNumber, uint256 price, uint256 tokenId)",
  "event ArtworkRecipientsUpdated(uint256 indexed artworkId, address[] recipients, uint16[] sharesBps)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function waitReceipt(hash: `0x${string}`, label: string) {
  console.log(`  waiting for ${label}...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  console.log(`  ${label}: ${receipt.status}  block=${receipt.blockNumber}`);
  if (receipt.status === "reverted") throw new Error(`${label} REVERTED`);
  return receipt;
}

async function readBalance(addr: string): Promise<bigint> {
  return publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [addr as `0x${string}`] });
}

// ── Step 0: Verify state ──────────────────────────────────────────────────────
console.log("\n=== Preflight checks ===");
const decimals = await publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "decimals" });
console.log(`USDC decimals onchain: ${decimals}`);
if (decimals !== 6) { console.error("ERROR: expected 6 decimals"); process.exit(1); }

const ownerBal = await readBalance(OWNER_ADDR);
console.log(`Owner USDC balance: ${ownerBal} (need ≥ 510000)`);
if (ownerBal < 510_000n) { console.error("ERROR: insufficient USDC on owner wallet"); process.exit(1); }

// ── Step 1: listArtwork #0 — Masas Semiredondas ──────────────────────────────
console.log("\n=== STEP 1: listArtwork #0 (Masas Semiredondas) ===");
const list0Hash = await walletClient.writeContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "listArtwork",
  args: [500000n, 25, "masas|genesis|001", "Masas Semiredondas", [OWNER_ADDR, SECOND_RECIPIENT], [8000, 2000]],
});
console.log("  listArtwork #0 tx:", list0Hash);
await waitReceipt(list0Hash, "listArtwork #0");

// ── Step 2: Approve USDC + buy(0) ────────────────────────────────────────────
console.log("\n=== STEP 2: approve USDC + buy(artworkId=0) ===");
const approve0Hash = await walletClient.writeContract({
  address: USDC, abi: ERC20_ABI, functionName: "approve",
  args: [ART_VENDOR, 500000n],
});
console.log("  approve tx:", approve0Hash);
await waitReceipt(approve0Hash, "approve #0");

const buy0Hash = await walletClient.writeContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "buy",
  args: [0n],
});
console.log("  buy #0 tx:", buy0Hash);
const buy0Receipt = await waitReceipt(buy0Hash, "buy #0");

// ── Step 3: Read receipt #1 tokenURI ─────────────────────────────────────────
console.log("\n=== STEP 3: tokenURI(1) ===");
const tokenUri1 = await publicClient.readContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "tokenURI", args: [1n],
});
const meta1 = JSON.parse(Buffer.from(tokenUri1.replace("data:application/json;base64,", ""), "base64").toString());
console.log("Receipt #1 name:   ", meta1.name);
console.log("Receipt #1 desc:   ", meta1.description);
const editionAttr  = meta1.attributes?.find((a: any) => a.trait_type === "Edition")?.value;
const seriesAttr   = meta1.attributes?.find((a: any) => a.trait_type === "Series")?.value;
const artIdAttr    = meta1.attributes?.find((a: any) => a.trait_type === "Artwork ID")?.value;
const seedHashAttr = meta1.attributes?.find((a: any) => a.trait_type === "Seed Hash")?.value;
console.log("Edition attr:      ", editionAttr);
console.log("Series attr:       ", seriesAttr);
console.log("Artwork ID attr:   ", artIdAttr);
console.log("Seed Hash attr:    ", seedHashAttr);

// ── Step 4: listArtwork #1 — Pruebas de bloqueo ──────────────────────────────
console.log("\n=== STEP 4: listArtwork #1 (Pruebas de bloqueo) ===");
const list1Hash = await walletClient.writeContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "listArtwork",
  args: [10000n, 3, "tallfenn|bloqueo|001", "Pruebas de bloqueo", [OWNER_ADDR, BLOCKLISTED], [5000, 5000]],
});
console.log("  listArtwork #1 tx:", list1Hash);
await waitReceipt(list1Hash, "listArtwork #1");

// ── Step 5: Approve + attempt buy(1) — expect revert ─────────────────────────
console.log("\n=== STEP 5: approve + attempt buy(artworkId=1) — blocklisted recipient ===");
const approve1aHash = await walletClient.writeContract({
  address: USDC, abi: ERC20_ABI, functionName: "approve",
  args: [ART_VENDOR, 10000n],
});
await waitReceipt(approve1aHash, "approve for blocklist buy");

let blocklistReverted = false;
let blocklistTxHash = "";
let blocklistOutcome = "";

try {
  // Simulate first to check if it reverts
  await publicClient.simulateContract({
    address: ART_VENDOR, abi: VENDOR_ABI, functionName: "buy",
    args: [1n], account: OWNER_ACCT,
  });
  // Simulation succeeded — send it and report what happens
  const h = await walletClient.writeContract({
    address: ART_VENDOR, abi: VENDOR_ABI, functionName: "buy", args: [1n],
  });
  blocklistTxHash = h;
  const r = await publicClient.waitForTransactionReceipt({ hash: h, timeout: 60_000 });
  if (r.status === "reverted") {
    blocklistReverted = true;
    blocklistOutcome = `REVERTED onchain (tx=${h})`;
    console.log("  buy reverted onchain:", h);
  } else {
    blocklistOutcome = `COMPLETED (Arc did not revert for this address on testnet)  tx=${h}`;
    console.log("  buy completed (blocklist not active here):", h);
  }
} catch (e: any) {
  blocklistReverted = true;
  blocklistTxHash = "";
  blocklistOutcome = `REVERTED at simulation — ${e?.shortMessage ?? e?.message ?? String(e)}`;
  console.log("  buy reverted at simulation (expected):", blocklistOutcome);
}

// ── Step 6: updateArtworkRecipients(1) — replace blocklisted ─────────────────
console.log("\n=== STEP 6: updateArtworkRecipients(artworkId=1) ===");
const updateHash = await walletClient.writeContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "updateArtworkRecipients",
  args: [1n, [OWNER_ADDR, SECOND_RECIPIENT], [5000, 5000]],
});
console.log("  updateArtworkRecipients tx:", updateHash);
await waitReceipt(updateHash, "updateArtworkRecipients #1");

// ── Step 7: Approve + buy(1) after recovery ───────────────────────────────────
console.log("\n=== STEP 7: approve + buy(artworkId=1) — recovery ===");
const approve1bHash = await walletClient.writeContract({
  address: USDC, abi: ERC20_ABI, functionName: "approve",
  args: [ART_VENDOR, 10000n],
});
await waitReceipt(approve1bHash, "approve for recovery buy");

const buy1Hash = await walletClient.writeContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "buy", args: [1n],
});
console.log("  buy #1 (recovery) tx:", buy1Hash);
await waitReceipt(buy1Hash, "buy #1 recovery");

// ── Step 8: Read receipt for recovery buy ────────────────────────────────────
// If blocklist buy reverted, first buy of artwork #1 = token #2
// If it completed, that was token #2 and recovery = token #3
const recoveryTokenId = blocklistReverted ? 2n : 3n;
console.log(`\n=== STEP 8: tokenURI(${recoveryTokenId}) ===`);
const tokenUri2 = await publicClient.readContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "tokenURI", args: [recoveryTokenId],
});
const meta2 = JSON.parse(Buffer.from(tokenUri2.replace("data:application/json;base64,", ""), "base64").toString());
console.log("Recovery receipt name:", meta2.name);
const owner2 = await publicClient.readContract({
  address: ART_VENDOR, abi: VENDOR_ABI, functionName: "ownerOf", args: [recoveryTokenId],
}) as string;
console.log("Recovery receipt owner:", owner2);

// ── Final state ───────────────────────────────────────────────────────────────
console.log("\n=== Final contract state ===");
const artCount = await publicClient.readContract({ address: ART_VENDOR, abi: VENDOR_ABI, functionName: "artworkCount" });
const sold0v = await publicClient.readContract({ address: ART_VENDOR, abi: VENDOR_ABI, functionName: "soldOf", args: [0n] });
const sold1v = await publicClient.readContract({ address: ART_VENDOR, abi: VENDOR_ABI, functionName: "soldOf", args: [1n] });
const ownerBalAfter = await readBalance(OWNER_ADDR);
const secondBalAfter = await readBalance(SECOND_RECIPIENT);
console.log("artworkCount:", artCount.toString());
console.log("soldOf(0):", sold0v, "  soldOf(1):", sold1v);
console.log("Owner USDC balance after:", ownerBalAfter.toString());
console.log("Second recipient balance after:", secondBalAfter.toString());

// ── Summary ───────────────────────────────────────────────────────────────────
const EXPLORER = "https://explorer.testnet.arc.io/tx/";
console.log("\n════════════════════════════════════════════════════════════");
console.log("SUMMARY");
console.log("════════════════════════════════════════════════════════════");
console.log("ArtVendor (canonical): ", ART_VENDOR);
console.log("USDC ERC-20:           ", USDC, " (6 decimals, confirmed)");
console.log("Owner/buyer:           ", OWNER_ADDR);
console.log("Second recipient:      ", SECOND_RECIPIENT);
console.log("");
console.log("Artwork #0 — Masas Semiredondas:");
console.log("  listArtwork tx: ", list0Hash);
console.log("  explorer:       ", EXPLORER + list0Hash);
console.log("  buy tx:         ", buy0Hash);
console.log("  explorer:       ", EXPLORER + buy0Hash);
console.log("  receipt token:  #1  name:", meta1.name);
console.log("  seedHash:       ", seedHashAttr);
console.log("");
console.log("Artwork #1 — Pruebas de bloqueo:");
console.log("  listArtwork tx: ", list1Hash);
console.log("  blocklist buy:  ", blocklistOutcome);
console.log("  updateRecipients tx:", updateHash);
console.log("  recovery buy tx:   ", buy1Hash);
console.log("  explorer:          ", EXPLORER + buy1Hash);
console.log("  recovery receipt:  #" + recoveryTokenId + "  name:", meta2.name);
console.log("════════════════════════════════════════════════════════════");

// Persist for NOTES.md
writeFileSync("/tmp/seed-results.json", JSON.stringify({
  artVendorAddress: ART_VENDOR,
  deployTxHash: "0x5f366949e7ca840e26c31b862f12d4c2f1a1a30fc357444384e79daaa1aed57c",
  usdcAddress: USDC,
  usdcDecimalsOnchain: decimals,
  ownerAddress: OWNER_ADDR,
  secondRecipient: SECOND_RECIPIENT,
  blocklistedAddress: BLOCKLISTED,
  explorerBase: "https://explorer.testnet.arc.io",
  artwork0: {
    artworkId: 0,
    seriesName: "Masas Semiredondas",
    seedInput: "masas|genesis|001",
    editions: 25,
    price: 500000,
    listTxHash: list0Hash,
    buyTxHash: buy0Hash,
    receiptTokenId: 1,
    receiptName: meta1.name,
    seedHash: seedHashAttr,
  },
  artwork1: {
    artworkId: 1,
    seriesName: "Pruebas de bloqueo",
    seedInput: "tallfenn|bloqueo|001",
    editions: 3,
    price: 10000,
    listTxHash: list1Hash,
    blocklistBuyReverted: blocklistReverted,
    blocklistOutcome,
    blocklistTxHash,
    updateRecipientsTxHash: updateHash,
    recoveryBuyTxHash: buy1Hash,
    recoveryReceiptTokenId: Number(recoveryTokenId),
  },
}, null, 2));
console.log("\nResults saved to /tmp/seed-results.json");
