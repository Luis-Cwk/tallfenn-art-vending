# Tall Fenn: Art Vending Machine

A generative art vending machine on [Arc](https://docs.arc.io), built with [Arc Studio](https://studio.arc.io). Buyers pay in USDC. Each purchase mints an edition receipt NFT and the payment is split instantly between the artist and collaborators. Buyers can be humans or AI agents.

Live app: https://tallfenn-art-vending.petrasynthetic.workers.dev

Artist: **Tall Fenn**.

## How it works

**The seed decides the work.** Every piece is born from a text string (`seedInput`) stored onchain. The app derives `sha256(seedInput + "|v1|tallfenn")` and renders from that hash, so the same seed always produces the same piece, on any device, at any time. The contract stores the seed hash, so the artwork is verifiable by anyone.

**Two rendering engines.**
- `masas|` seeds use the WebGL/p5 shader engine ("Masas semiredondas"): the seed decides mode (falling bodies or a dense field), palette, density, the section cuts and the choreography of falls and catches.
- Any other seed uses the deterministic SVG engine ("caidas" family).

**The money moves onchain.** `buy(artworkId)` pulls exactly `price` USDC from the buyer and forwards each recipient's share immediately (up to 4 recipients, basis points). No intermediary, no custody. The receipt NFT carries the series, seed and edition in its onchain metadata.

**USDC decimals, Arc specific.** Arc exposes the same USDC balance through two views: the ERC-20 interface at `0x3600000000000000000000000000000000000000` (6 decimals) and the native gas token (18 decimals). All contract amounts use the ERC-20 units.

## Stack

- Frontend: React 18, Vite, TypeScript, wagmi/viem, ConnectKit. White-cube gallery UI, English by default with an ES/EN switch.
- Contracts: Solidity 0.8.20, OpenZeppelin, Foundry. `via_ir = true`.
- Chain: Arc Testnet (chain id 5042002) and Arc mainnet (chain id 5042).

## Run locally

```bash
npm install --legacy-peer-deps
npm run dev
```

The `--legacy-peer-deps` flag is needed because `vite-plugin-node-polyfills` declares a Vite 5 peer while the project uses Vite 6.

Contracts:

```bash
forge build
forge test
```

## Deployed

| Network | ArtVendor | Explorer |
|---|---|---|
| Arc Testnet | `0xced7cd9590b112da9149d29176b17630ed022266` | [explorer](https://explorer.testnet.arc.io/address/0xced7cd9590b112da9149d29176b17630ed022266) |
| Arc mainnet | `0x53c933b651bc3ace7e5b6d948411e121111d10f1` | [explorer](https://explorer.arc.io/address/0x53c933b651bc3ace7e5b6d948411e121111d10f1) |

Mainnet reference transactions:
- Deploy (v5): [`0xaa6dcb12…`](https://explorer.arc.io/tx/0xaa6dcb128ba45d2b1cb132132e244693ba4422b50ac4c9b4c1280edb311294f1)
- List artwork (v5, premium 003): [`0x51bf84a0…`](https://explorer.arc.io/tx/0x51bf84a06911f0e2e58b6b3044e97dcea603f784af0127307c4068ea7f7438db)
- Agent buy (2 USDC, 80/20 split, edition 1): [`0x14b60996…`](https://explorer.arc.io/tx/0x14b6099684fe019038eaa5298656ad0a9de168f172ef5372b51e3e77a49ff8c4)

Testnet reference transactions:
- Deploy: [`0x5f366949â€¦`](https://explorer.testnet.arc.io/tx/0x5f366949e7ca840e26c31b862f12d4c2f1a1a30fc357444384e79daaa1aed57c)
- Genesis buy (0.5 USDC, split 80/20): [`0xe36283d9â€¦`](https://explorer.testnet.arc.io/tx/0xe36283d9b15341ca769668a3cf4cd19974fb0d950092c913e5317d8d594a1cac)
- Blocklist demo (a buy that reverts, then recipient replacement, then a successful buy): [`0x6c14ef55â€¦`](https://explorer.testnet.arc.io/tx/0x6c14ef559bcfc7c9fb64dd9c181355801523c332f84e5bf0c22c936f70f2b9ae), [`0x3253839câ€¦`](https://explorer.testnet.arc.io/tx/0x3253839ce370ef17c413a7ff29cdce29545c04ff6f6f3a8dab65f2be3f426bb3)

Contract behaviour was reviewed (security and functional passes) and covered by 35 Foundry tests, including the recovery path for a blocklisted recipient.

## Structure

```
contracts/            ArtVendor.sol, tests, deploy scripts, metadata
src/components/       Gallery, buy panel, splits ledger, artist panel
src/lib/tfEngine.ts   Masas shader engine (inlined GLSL) + trait derivation
src/lib/tfSvg.ts      Caidas SVG engine
src/hooks/            Onchain reads (artworks, payout logs)
scripts/              Operational scripts (seeding, funding)
NOTES.md              Deployment notes and transaction hashes
```
