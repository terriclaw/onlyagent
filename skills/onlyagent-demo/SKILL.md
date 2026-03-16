---
name: onlyagent-demo
description: Run the OnlyAgent demo and prove attested AI execution onchain. The agent performs a model inference, produces a TEE-signed execution commitment, and submits a prove() transaction to the OnlyAgent contract.
metadata: {"openclaw": {"emoji": "🤖"}}
---

# OnlyAgent Demo

## Base Mainnet (default)

Before running, ask the user for their Bankr EVM address if AGENT_ADDRESS is not set.

Run the full proof flow:
```bash
cd ~/onlyagent && AGENT_ADDRESS=<your-bankr-evm-address> node scripts/agent.js "<prompt>"
```

Save output as a log:
```bash
cd ~/onlyagent && mkdir -p logs && AGENT_ADDRESS=<your-bankr-evm-address> node scripts/agent.js "<prompt>" 2>&1 | tee logs/proof-$(date +%s).log
```

After running, report:
- Venice model output summary (2-3 sentences)
- Commitment hash
- Transaction hash with Basescan link
- Block number confirmed in

## Status Network Sepolia (gasless)

**Bankr does not work on Status Network.** The agent must have PRIVATE_KEY set directly in .env — the deployer wallet signs and submits the transaction.

Requires in .env:
- PRIVATE_KEY
- TEE_SIGNER_PRIVATE_KEY
- STATUS_ONLY_AGENT_ADDRESS=0xaea2e6252093b25dbe151F613696162908bE987a

Run:
```bash
cd ~/onlyagent && node scripts/prove-status.js
```

All transactions on Status Network are gasless (gasPrice: 0). No ETH balance required.

After running, report:
- Venice model output summary (2-3 sentences)
- Commitment hash
- Transaction hash with sepoliascan.status.network link
- Block number confirmed in
