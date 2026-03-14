---
name: onlyagent-demo
description: Demo the OnlyAgent primitive. Calls Venice AI for reasoning, builds a commitment hash, gets a TEE signature, and submits prove() to the OnlyAgent contract on Base mainnet. Use when asked to "run the OnlyAgent demo", "prove reasoning onchain", or "show OnlyAgent working".
metadata: {"openclaw": {"emoji": "🤖"}}
---

# OnlyAgent Demo

Before running, ask the user for their Bankr EVM address if AGENT_ADDRESS is not set.

Run the full proof flow:
```bash
cd ~/onlyagent && AGENT_ADDRESS=<your-bankr-evm-address> node scripts/agent.js "<reasoning prompt>"
```

Save output as a log:
```bash
cd ~/onlyagent && mkdir -p logs && AGENT_ADDRESS=<your-bankr-evm-address> node scripts/agent.js "<reasoning prompt>" 2>&1 | tee logs/proof-$(date +%s).log
```

After running, report:
- Venice reasoning summary (2-3 sentences)
- Commitment hash
- Transaction hash with Basescan link
- Block number confirmed in
