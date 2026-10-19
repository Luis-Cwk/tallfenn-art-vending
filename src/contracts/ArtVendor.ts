/**
 * ArtVendor contract config: canonical Arc mainnet deployment (v5).
 * Address: 0x53c933b651bc3ace7e5b6d948411e121111d10f1
 */
import { arc } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'

export const ART_VENDOR_ADDRESS = '0x53c933b651bc3ace7e5b6d948411e121111d10f1' as const
export const ART_VENDOR_CHAIN_ID = arc.id  // 5042

const usdcFact = getUsdc(ART_VENDOR_CHAIN_ID)
if (!usdcFact) throw new Error('USDC not found on Arc mainnet')
export const USDC_ADDRESS = usdcFact.address as `0x${string}`
export const USDC_DECIMALS = usdcFact.decimals // 6

export const EXPLORER_BASE = 'https://explorer.arc.io'

/** Block at which the canonical ArtVendor was deployed on Arc mainnet (v5 deploy tx 0xaa6dcb12…). */
export const DEPLOY_BLOCK = 26848324n

export const ART_VENDOR_ABI = [
  {
    type: 'function', name: 'artworkCount',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'artworks',
    inputs: [{ name: 'artworkId', type: 'uint256' }],
    outputs: [{
      name: '', type: 'tuple',
      components: [
        { name: 'artist', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'editions', type: 'uint32' },
        { name: 'sold', type: 'uint32' },
        { name: 'seedInput', type: 'string' },
        { name: 'seedHash', type: 'bytes32' },
        { name: 'seriesName', type: 'string' },
        { name: 'recipients', type: 'address[]' },
        { name: 'sharesBps', type: 'uint16[]' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'soldOf',
    inputs: [{ name: 'artworkId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'owner',
    inputs: [], outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'paused',
    inputs: [], outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'buy',
    inputs: [{ name: 'artworkId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'listArtwork',
    inputs: [
      { name: 'price', type: 'uint256' },
      { name: 'editions', type: 'uint32' },
      { name: 'seedInput', type: 'string' },
      { name: 'seriesName', type: 'string' },
      { name: 'recipients', type: 'address[]' },
      { name: 'sharesBps', type: 'uint16[]' },
    ],
    outputs: [{ name: 'artworkId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'updateArtworkRecipients',
    inputs: [
      { name: 'artworkId', type: 'uint256' },
      { name: 'recipients', type: 'address[]' },
      { name: 'sharesBps', type: 'uint16[]' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'pause',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'unpause',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'event', name: 'ArtworkSold',
    inputs: [
      { name: 'artworkId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'editionNumber', type: 'uint32', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'PayoutSent',
    inputs: [
      { name: 'artworkId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ArtworkListed',
    inputs: [
      { name: 'artworkId', type: 'uint256', indexed: true },
      { name: 'artist', type: 'address', indexed: true },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'editions', type: 'uint32', indexed: false },
      { name: 'seriesName', type: 'string', indexed: false },
      { name: 'seedHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ArtworkRecipientsUpdated',
    inputs: [
      { name: 'artworkId', type: 'uint256', indexed: true },
      { name: 'recipients', type: 'address[]', indexed: false },
      { name: 'sharesBps', type: 'uint16[]', indexed: false },
    ],
  },
] as const
