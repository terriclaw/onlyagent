# OnlyAgent

**A smart contract primitive that verifies an action was produced by a specific AI agent execution bound to a specific prompt and response.**

---

## The Primitive

Any wallet can call any smart contract. There is no way to distinguish a human pressing a button, a bot blindly executing, or an AI agent that genuinely deliberated before acting.

`onlyAgent` is a Solidity modifier that changes this. Before a function executes, it verifies:

1. **ERC-8004 identity** — the caller is a registered onchain agent, not an arbitrary wallet
2. **Reasoning commitment** — a TEE-signed hash binding this specific prompt and response to this specific agent, contract, and timestamp
3. **Freshness** — the proof was generated within the last 2 minutes, preventing replay

No proof, no access.

---

## What Gets Verified Onchain

The TEE signs a commitment hash:
```
keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp)
```

The contract verifies all five fields. This means the TEE is not just attesting *"an agent authorized this action"* — it is attesting *"this specific agent, reasoning from this specific prompt, produced this specific response, targeting this specific contract, at this specific time."*

The contract does not read the prompt or response text — it sees hashes. But those hashes are binding. Store the preimages offchain and you can prove to anyone exactly what reasoning produced the action. The chain commits to it.

---

## The Trust Chain
```
Venice AI — Intel TDX enclave
↓
signs keccak256(promptHash + responseHash + agentAddress + contractAddress + timestamp)
↓
ERC-8004 registered agent identity
↓
onlyAgent modifier:
  ✓ caller is ERC-8004 registered (balanceOf > 0)
  ✓ proof is fresh (within 2 minute window)
  ✓ TEE signature is from trusted provider
↓
function executes
↓
AgentReputation: score incremented, contract interaction logged
```

---

## A New EVM Permission Layer

`onlyAgent` adds a fourth actor to the EVM permission model:
```
onlyOwner   → human governance
onlyAgent   → verified autonomous AI execution
public      → open access
```

Protocols can treat autonomous agents differently from humans — with their own access tiers, reputation, and accountability — using nothing but a modifier.

---

## Use Cases

**AI-gated governance** — A DAO requires agents to deliberate on proposals before submitting them. Only an agent that produced a verified reasoning commitment can call `submitProposal()`.

**Agent-justified NFT minting** — An NFT can only be minted if an AI agent produced a signed reasoning commitment justifying the mint. No reasoning, no mint.

**Autonomous treasury execution** — Agents managing a protocol treasury must produce an attested commitment before executing transfers. Every fund movement is traceable to a specific AI output.

**Cross-chain risk guards** — Before funds are bridged, an AI risk agent must reason about the transfer and produce a signed commitment. The bridge contract verifies it before releasing funds.

---

## Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| OnlyAgent (demo) | `0x5158969E52dB9B919E995EBFeC468978435a3A57` |
| AgentReputation | `0x1BF485396e831B7c640Ef0152e3df88926F911D6` |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

---

## Live Demo

- 🏆 [Leaderboard](https://terriclaw.github.io/onlyagent/leaderboard/) — agents that have proved reasoning onchain
- 🔗 [Demo TX](https://basescan.org/tx/0x682010d81d9ed7ecb37233e99fe59c716836311699e46a54d0770d4a782a0bd2) — TerriClaw (terriclaw.terricola.eth) calling prove() on Base Mainnet

---

## Use In Your Own Contract

```solidity
import "./contracts/AgentGated.sol";

contract MyContract is AgentGated {
    constructor(
        address erc8004Registry,
        address reputation,
        address[] memory teeProviders
    ) AgentGated(erc8004Registry, reputation, teeProviders) {}

    function myAction(
        bytes32 promptHash,
        bytes32 responseHash,
        uint256 timestamp,
        bytes memory teeSignature
    )
        external
        onlyAgent(promptHash, responseHash, timestamp, teeSignature)
    {
        // only verified AI agents can reach here
    }
}
```

Every verified call increments the agent's score in AgentReputation, tracked by ERC-8004 identity across every contract that inherits AgentGated.

---

## Quickstart

```bash
git clone https://github.com/terriclaw/onlyagent
cd onlyagent
npm install
cp .env.example .env
node scripts/agent.js "Should I execute this transaction? Reason carefully."
```

---

## Venice TEE

OnlyAgent is built for Venice AI's TEE response signing (Intel TDX). Venice is the only mainstream LLM provider with Ethereum-compatible enclave signing — every TEE response includes a signing_address verifiable onchain via ecrecover.

The current deployment uses a mock TEE signer. When Venice TEE ships:

1. Swap model to tee-qwen3-235b-a22b-thinking-2507 in scripts/agent.js
2. Call addTEEProvider(veniceSigningAddress) on your contract

Zero other changes needed.

---

## Reputation

AgentReputation tracks per-agent, per-identity:

- Total actions
- Unique contracts interacted with
- First and last action timestamps

Reputation follows the ERC-8004 identity across every contract that uses AgentGated — not just OnlyAgent's demo contract.

---

## Project Structure

```
contracts/
  AgentGated.sol        # abstract base — inherit this in your contract
  AgentReputation.sol   # onchain reputation registry
  OnlyAgent.sol         # demo contract with prove()
scripts/
  agent.js              # end-to-end proof pipeline
  deploy.js             # deployment script
skills/
  onlyagent-demo/       # OpenClaw skill — lets TerriClaw run the demo
  onlyagent/            # OpenClaw SDK skill for other agents
leaderboard/            # live agent reputation UI (GitHub Pages)
```

---

## Environment Variables

```bash
VENICE_API_KEY=           # Venice API key
AGENT_ADDRESS=            # ERC-8004 registered agent wallet address
TEE_SIGNER_PRIVATE_KEY=   # mock only — replace with addTEEProvider(veniceSigningAddress) when TEE ships
ONLY_AGENT_ADDRESS=       # deployed OnlyAgent contract
AGENT_REPUTATION_ADDRESS= # deployed AgentReputation contract
BASE_RPC_URL=             # Base RPC (default: https://mainnet.base.org)
```

---

Built at [Synthesis](https://synthesis.computer) 2026.
