# Aegis — Polkadot Hub Deployment Verification

**Network:** Paseo Asset Hub (Chain ID: 420420417)  
**Block:** 6172055  
**Explorer:** https://blockscout-passet-hub.parity-testnet.parity.io  
**Verified:** 2026-03-09T02:14:14.974Z

## Contracts

| Contract | Address | Explorer |
|----------|---------|---------|
| MockUSDC | `0x3A5786F2CB62a8002544DA58F70eb23F17fdEFC5` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0x3A5786F2CB62a8002544DA58F70eb23F17fdEFC5) |
| AegisTreasury | `0x95c02D478522b1B7616f433A22B7CDcBa259CA50` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0x95c02D478522b1B7616f433A22B7CDcBa259CA50) |
| YieldOracle | `0xC7c40108FA72A9C696a277B3496025AefeBc33b6` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0xC7c40108FA72A9C696a277B3496025AefeBc33b6) |
| AegisGuard | `0x0F5FAd045798b5BC1Eada8650D09fEE05D4090c5` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0x0F5FAd045798b5BC1Eada8650D09fEE05D4090c5) |
| AegisVault | `0x5ef526DFe9474E66c439Ca8FF31526f755F7aaBd` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0x5ef526DFe9474E66c439Ca8FF31526f755F7aaBd) |
| MockLendingSource | `0x77D2198692c743f2D0B0d30B83310e666704Ca8A` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0x77D2198692c743f2D0B0d30B83310e666704Ca8A) |
| MockDEXSource | `0x7277eA9bb150b51b77984eDf84DaA5206be5Fb7f` | [view](https://blockscout-passet-hub.parity-testnet.parity.io/address/0x7277eA9bb150b51b77984eDf84DaA5206be5Fb7f) |

## Verification Method

Polkadot Asset Hub uses PVM (Polkadot Virtual Machine) bytecode compiled via `resolc`.  
Source-level verification is not yet supported by block explorers for PVM contracts.  
All contracts are verified by on-chain bytecode presence (PVM magic bytes `0x50564d`).

## Compiler

- **Compiler:** resolc v0.6.0 (revive)
- **Solc:** 0.8.28
- **Target:** PVM (PolkaVM)
- **Optimizer:** enabled, 200 runs
