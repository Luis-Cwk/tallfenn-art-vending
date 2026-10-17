# DoraHacks submission draft (Arc Microgrants: Built with Arc Studio)

## Project name

Tall Fenn: Art Vending Machine

## One-liner

A generative art vending machine on Arc: pay in USDC, get an onchain edition receipt, and the payment splits itself between the artist and collaborators.

## Description

Tall Fenn is a small gallery with a vending machine inside. Each artwork is a generative piece born from a seed string stored onchain: the browser hashes the seed and renders the work deterministically, so the same seed always produces the same image. Two engines ship with the app: a WebGL shader engine ("Masas semiredondas", where the seed decides the mode, palette, density, cuts and choreography) and a deterministic SVG engine.

Buying is one transaction. `buy(artworkId)` pulls exactly the price in USDC and forwards each recipient's share immediately (up to four recipients, basis points), then mints an edition receipt whose onchain metadata carries the series, seed and edition number. There is no intermediary and no custody. Buyers can be humans or AI agents; the contract does not distinguish.

The app was built end to end in Arc Studio: contract, tests and frontend. Contract behaviour was reviewed and covered by 35 Foundry tests, including a recovery path for blocklisted payout addresses (verified on Arc testnet with the documented blocklisted test address). The frontend is a white-cube gallery in English and Spanish, with live rendering, a splits ledger read from `PayoutSent` events, and an artist panel for listing works and updating recipients.

## Links

- Live app: https://tallfenn-art-vending.petrasynthetic.workers.dev
- Repository: https://github.com/Luis-Cwk/tallfenn-art-vending
- Contract (Arc mainnet): https://explorer.arc.io/address/0x4c6723ff8538cdaeb808f8baf352cd53bb051119
- Deploy tx: https://explorer.arc.io/tx/0xa2d3f4ad662bb24c78d5c84d78b2c4b26badec9f1495d3845e5aaaa97a3ee8e1
- Buy tx (0.5 USDC, 80/20 split): https://explorer.arc.io/tx/0xd0ff393bf417ed7bcf698490f0bda2e20a979d1ed8bd2a56c89d192f0e96bcc3
- Arc Studio project: https://studio.arc.io/app/b65c7764-ac57-4914-ab49-035ed4bc1491

## What's next

List a short series with gallery pricing (a 1/1 or a small edition), add a dedicated page per artwork, and open the vending machine to agent buyers with an x402 endpoint so services can purchase without a human in the loop.

## Notes for the form

- Tracks: software-to-software payments, payment splitting, AI agent buyers.
- The mainnet transaction above moves real USDC through the contract and the app.
- Everything in the repo builds with `npm install --legacy-peer-deps && npm run dev` (frontend) and `forge build && forge test` (contracts).
