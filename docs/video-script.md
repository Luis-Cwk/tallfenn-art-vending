# Video walkthrough (2 minutes)

Record with OBS at 1080p, 30 fps. Narration in English if you can; Spanish with English subtitles also works.
Keep it under 2:10. Do not show wallet balances, private keys or emails.

## 0:00 - 0:08  Opening

Show the live app gallery with the piece moving:
https://tallfenn-art-vending.petrasynthetic.workers.dev

Say: "This is Tall Fenn, a generative art vending machine on Arc. Buyers pay in USDC, and every sale splits automatically."

## 0:08 - 0:30  Arc Studio (Petra's session)

Open your Arc Studio project:
https://studio.arc.io/app/b65c7764-ac57-4914-ab49-035ed4bc1491

Show, in this order: the chat history where the contract was built, the file tree (contracts/ArtVendor.sol, contracts/test, src/), and the preview panel.

Say: "Everything here was built in Arc Studio: the ArtVendor contract, its 35 Foundry tests, and the frontend. Studio generated and tested the contracts; the same artifact was deployed to Arc mainnet."

## 0:30 - 0:55  The work

Back to the live app. Move the mouse over the artwork so it is clear it is animated. Point at the museum label and at the minted editions list below it.

Say: "Each artwork is born from a seed string stored onchain. The browser hashes it and renders deterministically, so the same seed always produces the same piece. This is Masas semiredondas, edition 2 of 25, and the list below reads every minted edition straight from the chain."

Optional beat if you list a work on camera (Artist panel, needs the project wallet in MetaMask): "The artist panel lists new works with their price, editions and the payout split, all in one transaction."

## 0:55 - 1:25  The payment (mainnet)

Show the successful purchase. Pick one:

Option A (preferred): record a buy in the app with a wallet.
Option B: open the explorer transaction:
https://explorer.arc.io/tx/0x5f52ad02d2ae5390f7a4db1e29674cfca35f87e539f6a8472e76f3be07a69928

Then open your receipt on the explorer (the token page shows the image):
https://explorer.arc.io/token/0x3217cfcd92b683d66038093ec39f0034179467b3

Say: "A buy pulls exactly the price in USDC and splits it instantly: 80 percent to the artist wallet, 20 percent to the collaborator. It also mints an onchain receipt with the seed hash inside its metadata."

## 1:25 - 1:50  Splits

Open the Splits tab. The table shows 0.40 USDC and 0.10 USDC.

Say: "This ledger reads the payout events straight from the chain. No intermediary, no custody."

## 1:50 - 2:00  Closing

Show the contract address and the repo:
https://github.com/Luis-Cwk/tallfenn-art-vending

Say: "Contract 0x3217cfcd92b683d66038093ec39f0034179467b3 on Arc mainnet. Code on GitHub. Built with Arc Studio."

## Upload

YouTube, visibility "Unlisted". Title: "Tall Fenn: Art Vending Machine on Arc (demo)".
Then paste the link to Petra's agent so it can complete the DoraHacks submission.
