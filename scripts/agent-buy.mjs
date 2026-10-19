/**
 * Agent buyer for the Tall Fenn Art Vending Machine (Arc mainnet).
 *
 * Reads the artwork onchain, approves USDC if needed, buys one edition and
 * prints the receipt. It only needs a private key with enough USDC on Arc.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... ARTWORK_ID=0 node scripts/agent-buy.mjs
 *
 * Optional: RPC_URL, EXPLORER_BASE.
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const ART_VENDOR = process.env.ART_VENDOR ?? '0x1d9e2dd8cb1a709c75e04278b58945a25a5677c0'
const USDC = '0x3600000000000000000000000000000000000000'
const CHAIN = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? 'https://rpc.mainnet.arc.io'] } },
}
const EXPLORER = process.env.EXPLORER_BASE ?? 'https://explorer.arc.io'

const pk = process.env.AGENT_PRIVATE_KEY
if (!pk || !pk.startsWith('0x')) {
  console.error('Set AGENT_PRIVATE_KEY=0x... (a wallet with USDC on Arc mainnet)')
  process.exit(1)
}

const artworkId = BigInt(process.env.ARTWORK_ID ?? '0')
const account = privateKeyToAccount(pk)
const pub = createPublicClient({ chain: CHAIN, transport: http() })
const wallet = createWalletClient({ account, chain: CHAIN, transport: http() })

const vendorAbi = parseAbi([
  'function artworks(uint256) view returns ((address artist, uint256 price, uint32 editions, uint32 sold, string seedInput, bytes32 seedHash, string seriesName, address[] recipients, uint16[] sharesBps))',
  'function buy(uint256 artworkId)',
])
const usdcAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

const art = await pub.readContract({ address: ART_VENDOR, abi: vendorAbi, functionName: 'artworks', args: [artworkId] })
const price = art.price
const editions = Number(art.editions)
const sold = Number(art.sold)

console.log('artwork', artworkId.toString(), 'series', art.seriesName, '| seed', art.seedInput)
console.log('price', formatUnits(price, 6), 'USDC | editions', sold + '/' + editions)
if (sold >= editions) {
  console.error('Sold out')
  process.exit(1)
}

const balance = await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [account.address] })
console.log('wallet', account.address, 'balance', formatUnits(balance, 6), 'USDC')
if (balance < price) {
  console.error('Not enough USDC')
  process.exit(1)
}

const allowance = await pub.readContract({ address: USDC, abi: usdcAbi, functionName: 'allowance', args: [account.address, ART_VENDOR] })
if (allowance < price) {
  console.log('approving USDC...')
  const approveHash = await wallet.writeContract({
    address: USDC, abi: usdcAbi, functionName: 'approve', args: [ART_VENDOR, price],
    gas: 300_000n, maxFeePerGas: 30n * 10n ** 9n, maxPriorityFeePerGas: 1n * 10n ** 9n,
  })
  const ar = await pub.waitForTransactionReceipt({ hash: approveHash })
  console.log('approve', ar.status, EXPLORER + '/tx/' + approveHash)
}

console.log('buying...')
const hash = await wallet.writeContract({
  address: ART_VENDOR, abi: vendorAbi, functionName: 'buy', args: [artworkId],
  gas: 1_000_000n, maxFeePerGas: 30n * 10n ** 9n, maxPriorityFeePerGas: 1n * 10n ** 9n,
})
const rc = await pub.waitForTransactionReceipt({ hash })
console.log('buy', rc.status, EXPLORER + '/tx/' + hash)

const soldLog = rc.logs.find((log) => log.topics.length === 4)
if (soldLog) console.log('receipt log topic0', soldLog.topics[0])
console.log('done. The receipt is an ERC-721 owned by', account.address)
