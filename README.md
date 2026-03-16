# OnlyAgent

A smart contract primitive for **verifiable AI agent execution onchain**.

`onlyAgent` is a Solidity modifier that requires verifiable AI execution before a transaction can proceed. Works with any attested compute provider — currently implemented with Venice AI's Intel TDX TEE signing.

---

## The Primitive

Any wallet can call any smart contract. There is no way to distinguish a human pressing a button, a bot blindly executing, or an autonomous AI agent that executed an attested inference pipeline before acting.

`onlyAgent` is a Solidity modifier that changes this. Before a function executes, it verifies:

1. **ERC-8004 identity** — the caller is a registered onchain agent, not an arbitrary wallet
2. **Execution commitment** — a TEE-signed hash binding this specific prompt and response to this specific agent, contract, and timestamp
3. **Freshness** — the proof was generated within the last 2 minutes, preventing replay

No proof, no access.

---

## What Gets Verified Onchain

The TEE signs a commitment hash:
```
keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp, chainId)
```

The contract verifies all six fields. This means the TEE is not just attesting *"an agent authorized this action"* — it is attesting *"this specific agent, executing a model inference over this specific prompt, produced this specific response, targeting this specific contract, at this specific time, on this specific chain."*

The contract does not read the prompt or response text — it sees hashes. But those hashes are binding. Store the preimages offchain and you can prove to anyone exactly what model execution produced the action. The chain commits to it.

---

## The Trust Chain
```
Venice AI (Intel TDX enclave)
↓
signs keccak256(promptHash + responseHash + agentAddress + contractAddress + timestamp + chainId)
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

`onlyAgent` adds a new actor to the EVM permission model:
```
onlyOwner   → human governance
onlyAgent   → verified autonomous AI execution
public      → open access
```

Protocols can treat autonomous agents differently from humans — with their own access tiers, reputation, and accountability — using nothing but a modifier.

---

## Use Cases

**AI-gated governance** — A DAO requires agents to deliberate on proposals before submitting them. Only an agent that produced a verified execution commitment can call `submitProposal()`.

**Agent-justified NFT minting** — An NFT can only be minted if an AI agent produced a signed execution commitment justifying the mint. No reasoning, no mint.

**Autonomous treasury execution** — Agents managing a protocol treasury must produce an attested commitment before executing transfers. Every fund movement is traceable to a specific AI output.

**Cross-chain risk guards** — Before funds are bridged, an AI risk agent must reason about the transfer and produce a signed commitment. The bridge contract verifies it before releasing funds.

---

## ENS Agent Identity

OnlyAgent uses ENS names to represent autonomous agents onchain.

Each agent wallet resolves to an ENS name, allowing humans and protocols to recognize trusted agents without interacting with raw hex addresses:

```
terriclaw.terricola.eth  →  autonomous agent identity
0x0457B3DED2BA9E56520B21735f4324F6533F93ff  →  underlying wallet
```

The leaderboard resolves ENS names for every registered agent, turning wallet addresses into human-readable identities. As the OnlyAgent ecosystem grows, the leaderboard becomes a directory of trusted autonomous agents — discoverable by name, not address.

---

## Private Cognition → Public Action

OnlyAgent is designed for systems where AI agents reason over sensitive data but must produce trustworthy public actions.

A Venice TEE model can analyze private information — financial data, governance discussions, negotiation details, or risk signals — without exposing the prompt or reasoning publicly.

The enclave signs a commitment binding the prompt and response to a specific onchain action:

```
keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp, chainId)
```

The contract verifies this commitment before executing the action.

This allows protocols to accept decisions derived from private inference while still enforcing public accountability onchain.

---

## Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| OnlyAgent (demo) | `0x2367Ea8321bC461AAa3C156D92C4cAd73f89F4c5` |
| AgentReputation | `0x92d48F5375a86484706549C9fD71Ac3C62E98eb9` |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

---

## Contracts (Status Network Sepolia)

| Contract | Address |
|---|---|
| OnlyAgent | `0xaea2e6252093b25dbe151F613696162908bE987a` |
| AgentReputation | `0xa592d5605Cb5a03CF8cf1f80d7848e98939B6258` |

Deployed with `gasPrice: 0` — Status Network is gasless at the protocol level.

---

## Live Demo

- 🏆 [Leaderboard](https://terriclaw.github.io/onlyagent/leaderboard/) — agents that have proved execution provenance onchain
- 🔗 [Demo TX](https://basescan.org/tx/0x057f04dc79798dcbfc3edad464c60640cf6ddd7564eee5449e0d7e25c8cbc34b) — TerriClaw (terriclaw.terricola.eth) calling prove() on Base Mainnet
- ⛽ [Gasless TX](https://sepoliascan.status.network/tx/0x85e744df745a9587fe27379ef8fb663117a1cf48baa8758cd2cc151df547e539) — prove() on Status Network Sepolia with gasPrice: 0

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
node scripts/agent.js "Should I execute this transaction? Assess the request and decide."
```

---

## Bankr Autonomous Execution

TerriClaw executes transactions using the Bankr wallet system.

The agent does not hold a private key. Instead, execution requests are routed through Bankr, which manages signing and transaction submission on Base Mainnet.

This allows autonomous agents to safely execute onchain actions without exposing private keys while maintaining a verifiable execution history tied to their ERC-8004 identity.

---

## Venice TEE Integration

OnlyAgent is built for Venice AI's TEE response signing (Intel TDX). Venice is the only mainstream LLM provider with Ethereum-compatible enclave signing — every TEE response includes a `signing_address` verifiable onchain via `ecrecover`.

**Current status:** The deployed contracts use a mock TEE signer to simulate the enclave. The onchain verification logic is complete — `AgentGated` verifies ECDSA signatures from any address in `trustedTEEProviders`.

**What is already done:**
- Contract verifies TEE signatures from any trusted provider address
- Mock signer stands in for the enclave during development
- `trustedTEEProviders` mapping is designed to accept the Venice enclave signing address

**What remains:**
- Venice TEE response signing ships → enclave produces a `signing_address` per response
- Map the Venice response signature to the OnlyAgent commitment format
- Call `addTEEProvider(veniceSigningAddress)` on the deployed contract

Zero contract changes needed. The primitive is complete — the production enclave signer is the only missing piece.

When Venice TEE ships:

1. Swap model to `tee-qwen3-235b-a22b-thinking-2507` in `scripts/agent.js`
2. Call `addTEEProvider(veniceSigningAddress)` on your contract

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
