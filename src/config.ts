/**
 * wagmi configuration
 * Built with Arc Studio: https://studio.arc.io
 */

import { http, createConfig, fallback } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, arc.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arc, mainnet], // mainnet kept for ENS resolution
  connectors: [injected()],
  transports: {
    [arc.id]: fallback([
      http('https://rpc.mainnet.arc.io'),
      http('https://rpc.blockdaemon.mainnet.arc.io'),
      http('https://rpc.quicknode.mainnet.arc.io'),
    ]),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
