# Tall Fenn Art Vending Machine — Deployment Notes

## Canonical Contract

| Item | Value |
|---|---|
| Contract | `ArtVendor` |
| Address (Arc Testnet) | `0xced7cd9590b112da9149d29176b17630ed022266` |
| Deploy tx | `0x5f366949e7ca840e26c31b862f12d4c2f1a1a30fc357444384e79daaa1aed57c` |
| Explorer | https://explorer.testnet.arc.io/address/0xced7cd9590b112da9149d29176b17630ed022266 |
| Chain | Arc Testnet (Chain ID 5042002) |
| Deployed at | 2026-10-17T05:20:00Z |

> Two earlier deployments exist on-chain (0x23ed…bdb5c and 0x10fe…09d0) from wallet owner-wiring iterations; only the canonical address above is seeded and active.

## USDC Token

| Item | Value |
|---|---|
| Address | `0x3600000000000000000000000000000000000000` |
| `decimals()` (confirmed onchain) | **6** |
| Interface used by contract | ERC-20 (`safeTransferFrom` / `safeTransfer`) |
| Note | Native gas-token view uses 18 decimals (same underlying balance); all contract prices are in 6-decimal ERC-20 units |

## Wallets

| Role | Address |
|---|---|
| Owner / buyer (Hardhat test #0, pre-funded) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Second recipient (DCW wallet, 20%/50% share) | `0x840448cb25148eac5b3a92b7d2372f8360943b03` |
| Arc blocklisted test address (mnemonic index 1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |

## Artwork #0 — Masas Semiredondas (Genesis)

| Item | Value |
|---|---|
| Artwork ID | 0 |
| seriesName | Masas Semiredondas |
| seedInput | `masas\|genesis\|001` |
| Editions | 25 |
| Price | 500000 (0.5 USDC at 6 decimals) |
| Recipients / shares | owner 80%, second recipient 20% |
| `listArtwork` tx | `0x619f6946ee0d6b234c793fb601803b2bbf94fea31c4fabbb8a7e3aa3cd338b51` |
| `listArtwork` explorer | https://explorer.testnet.arc.io/tx/0x619f6946ee0d6b234c793fb601803b2bbf94fea31c4fabbb8a7e3aa3cd338b51 |
| `buy` tx | `0xe36283d9b15341ca769668a3cf4cd19974fb0d950092c913e5317d8d594a1cac` |
| `buy` explorer | https://explorer.testnet.arc.io/tx/0xe36283d9b15341ca769668a3cf4cd19974fb0d950092c913e5317d8d594a1cac |
| Receipt token | #1 |
| Receipt name | `Tall Fenn - Masas Semiredondas #1` |
| seedHash (onchain, sha256) | `0x3ce78f1c128f10a8e445f356e4ff9b0bc7312e2c3e6b76f4cde2e56d7547fc83` |

## Artwork #1 — Pruebas de bloqueo (Blocklist Demo)

| Item | Value |
|---|---|
| Artwork ID | 1 |
| seriesName | Pruebas de bloqueo |
| seedInput | `tallfenn\|bloqueo\|001` |
| Editions | 3 |
| Price | 10000 (0.01 USDC at 6 decimals) |
| `listArtwork` tx | `0x24bb170c3c4b1a507f286c931d5f4d4d2d09a50d53feafab65ec4c2b84851d4f` |
| `listArtwork` explorer | https://explorer.testnet.arc.io/tx/0x24bb170c3c4b1a507f286c931d5f4d4d2d09a50d53feafab65ec4c2b84851d4f |

### Blocklist demo sequence

1. **Listed** with recipients `[owner, 0x70997970…79C8]` (the Arc-documented blocklisted address).
2. **Buy attempt** (`buy(1)`) — reverted at simulation with revert reason `"Blocked address"` (Arc testnet runtime enforces the blocklist before any gas is spent). No on-chain tx hash (simulation catches it client-side).
3. **`updateArtworkRecipients`** tx: `0x6c14ef559bcfc7c9fb64dd9c181355801523c332f84e5bf0c22c936f70f2b9ae`  
   Explorer: https://explorer.testnet.arc.io/tx/0x6c14ef559bcfc7c9fb64dd9c181355801523c332f84e5bf0c22c936f70f2b9ae  
   Replaced blocklisted address with second recipient `0x840448cb25148eac5b3a92b7d2372f8360943b03`.
4. **Recovery buy** (`buy(1)`) tx: `0x3253839ce370ef17c413a7ff29cdce29545c04ff6f6f3a8dab65f2be3f426bb3`  
   Explorer: https://explorer.testnet.arc.io/tx/0x3253839ce370ef17c413a7ff29cdce29545c04ff6f6f3a8dab65f2be3f426bb3  
   Succeeded. Receipt token #2 minted: `Tall Fenn - Pruebas de bloqueo #1`. Owner: `0xf39Fd…2266`.

**Result: push-payout brick + recovery path works end-to-end on Arc Testnet.**

## Balance Verification After All Buys

| Address | USDC balance (6-dec units) | Expected |
|---|---|---|
| Owner (after paying 500000 + 10000) | 4,627,590 | started at 4,756,785 → spent 510,000 on buys + gas |
| Second recipient | 105,000 | 100,000 (20% of 500k) + 5,000 (50% of 10k) = 105,000 ✓ |

Split math verified: 500,000 × 20% = 100,000 to second recipient; 10,000 × 50% = 5,000 to second recipient. Total received = 105,000 ✓

## Security Review Summary (balanced preset)

- Solidity-auditor: no material findings (2 passes)
- Functional-auditor: 2 Highs found and fixed (seed hash now derived onchain; JSON string injection guard added); 1 High (push-payout brick) resolved by adding `updateArtworkRecipients`; final pass clean
- Slither: 0 findings on final build
- Unit tests: 35/35 passing

## Key Files

| Path | Description |
|---|---|
| `contracts/ArtVendor.sol` | Main contract (ERC-721 + Ownable + Pausable + SafeERC20) |
| `contracts/test/ArtVendor.t.sol` | Foundry unit tests (35 tests) |
| `contracts/contract-metadata/ArtVendor.json` | Deployment metadata (canonical address, tx hash, ABI) |
| `scripts/seed-viem.ts` | Seeding + buy script (viem, no Circle SDK needed) |
