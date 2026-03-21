# OnlyAgent

A permission layer for **verifiable private AI agents onchain** — bridging Venice private cognition to trusted public actions.

`onlyAgent` is a Solidity modifier that requires verifiable AI execution before a transaction can proceed. Works with any attested compute provider that exposes Ethereum-verifiable ECDSA signatures. The current Base Mainnet demo verifies signatures from Venice AI's live TEE signer directly onchain, while the agent runtime applies deterministic policy to the visible plaintext response before submission.

OnlyAgent turns AI inference into a **first-class onchain requirement**: contracts can require proof that a private Venice TEE execution occurred before allowing state changes.

---

## Venice Track Alignment

OnlyAgent wires **Venice private cognition to trustworthy onchain action**.

- **Private cognition** — Venice `e2ee-*` models execute inside TEE infrastructure with no data retention
- **No data exposure** — only `promptHash:responseHash` is surfaced; prompts and responses remain offchain
- **Trusted outputs** — Venice produces a `personal_sign(promptHash:responseHash)` signature, verified onchain
- **Public consequence** — smart contracts require a valid TEE execution proof before allowing state changes

This directly implements the Venice track requirement: connecting private inference to public systems where actions must be verifiable.

OnlyAgent does not interpret model outputs or reasoning onchain. It enforces that a Venice-backed execution occurred before an onchain action is permitted. The agent runtime can then apply deterministic decision policy to the visible plaintext response before deciding whether to submit the onchain action.

OnlyAgent defines the missing primitive: **execution-verifiable AI agents** that can act on public systems without exposing their reasoning.

**Example use case: Private treasury agent**

A treasury agent evaluates sensitive financial data using Venice private inference.  
The contract only allows transfers if a valid Venice TEE execution proof is provided.

---



## Final Architecture

OnlyAgent now has a clean separation of concerns:

- **Contract layer** — verifies Venice TEE execution provenance onchain
- **Agent layer** — reads the visible plaintext response and applies deterministic decision policy
- **Harness wallet** — submits only when the agent says `submit`

This means:
- the contract proves **execution truth**
- the agent enforces **decision truth**

This is the final architecture used in the current Base Mainnet demo.

---

## The Primitive

Any wallet can call any smart contract. There is no way to distinguish a human pressing a button, a bot blindly executing, or an autonomous AI agent that executed a TEE-attested model inference before acting.

`onlyAgent` is a Solidity modifier that changes this. Before a function executes, it verifies:

1. **ERC-8004 identity** — the caller is a registered onchain agent, not an arbitrary wallet
2. **TEE execution proof** — a TEE-signed payload proving a specific promptHash:responseHash pair was signed by a trusted TEE provider
3. **Freshness** — the proof was generated within the last 2 minutes, preventing replay

No proof, no access.

---

## What Gets Verified Onchain

Venice's enclave signs `personal_sign(promptHash:responseHash)` — proving a specific model execution occurred.

The contract receives `promptHash:responseHash`, verifies the signature using Ethereum `personal_sign` semantics, recovers the signer, and checks that the recovered signer matches a trusted TEE provider.

The contract enforces execution context separately:
- `msg.sender` must be an ERC-8004 registered agent
- `timestamp` must be within the freshness window

Venice proves that a specific model execution occurred inside a TEE. The contract enforces *who is acting and when*.

The contract does not read the prompt or response text — it sees hashes.

---



## The Trust Chain
```
Trusted TEE provider (live Venice TEE signer in current Base deployment)
↓
signs an Ethereum-verifiable payload (`promptHash:responseHash`) that OnlyAgent verifies directly onchain
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

**Autonomous treasury execution** — Agents managing funds must produce a verified TEE execution proof before transfers.

**AI-gated governance** — Only agents with verified AI execution can submit proposals or actions.

---


## Private Inference → Verifiable Actions

OnlyAgent supports workflows where AI agents operate on sensitive data but must produce verifiable public actions.

A Venice TEE model can process private inputs without exposing the prompt or response publicly. The enclave signs `personal_sign(promptHash:responseHash)`, producing a verifiable execution artifact.

The contract verifies the signature onchain and enforces that:
- the signer is a trusted TEE provider
- the caller is a registered agent
- the proof is fresh

This allows protocols to accept actions derived from private inference while maintaining public verifiability of execution.

### Decision gating today

OnlyAgent currently proves Venice TEE execution onchain. Agent-layer decision gating is implemented by inspecting the visible plaintext response and only submitting `prove()` when a deterministic policy passes.

Direct onchain enforcement of specific visible response strings is currently blocked by provider-defined `responseHash` semantics from Venice's signature endpoint.

### Verifiable semantics (future work)

Today, decision gating happens at the agent layer because Venice defines `responseHash` in a provider-specific way.

A fully trustless design would require:
- canonical response encoding
- publicly recomputable response hashes
- or zk/TEE proofs over the visible plaintext

OnlyAgent exposes this gap clearly: execution can be proven onchain, but semantic correctness of outputs remains an open problem.


---

## Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| OnlyAgent (demo) | `0xED7d4E118f04335E3b2d9105FE1D8F83DD464C0D` |
| AgentReputation | `0xB5e35148d21C630faafB10eBF20AE455635B3aE1` |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

---

This repo demonstrates the full loop: private cognition → verifiable execution → gated onchain action.

## Demo Cases

The final demo consists of three cases:

1. **Execution Proof baseline**
   - default `prove` mode
   - payload is built and submitted
   - contract verifies Venice TEE execution onchain

2. **Decision mode — approved**
   - visible response is `YES`
   - agent returns `submit`
   - agent submits `prove()` onchain

3. **Decision mode — denied**
   - visible response is not `YES`
   - agent returns `do_not_submit`
   - no transaction is submitted

This demonstrates both:
- onchain execution provenance
- offchain deterministic decision gating

---

## Live Demo

- 🏆 [Leaderboard](https://terriclaw.github.io/onlyagent/leaderboard/) — agents that have proved execution provenance onchain
- 🔗 [Execution Proof TX](https://basescan.org/tx/0x27a3031e7306eb1d7e9f4f2f12a129693198f2fa944050e400c564f83403892d) — final baseline prove() demo on Base Mainnet
- 🔗 [Decision YES TX](https://basescan.org/tx/0x2d9053d7e838a2561fa8f62f1d3f44e76468f4c2e9393e57bc01b2e5398d7b8b) — final decision-approved demo on Base Mainnet

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
        // only registered agents with a valid trusted TEE execution proof can reach here
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


## Venice TEE Integration

OnlyAgent is built for Venice AI's TEE response signing. Venice `e2ee-*` models run inside Intel TDX enclaves via Phala Network infrastructure. The per-request signature flow is live, and the signer used by that flow has been confirmed via Venice's attestation endpoint.

**Confirmed integration path:**

1. Make a completion request to an `e2ee-*` model — response includes `x-venice-tee: true` and `x-venice-tee-provider: phala` headers confirming TEE execution
2. `GET /api/v1/tee/attestation?model=e2ee-qwen-2-5-7b-p` returns:
   - `signing_address`: `0xc4045be3413B0B30ad0295985fe5e037Dc0EeB0c` — Ethereum address of the enclave signer
   - `signing_public_key`: uncompressed ECDSA public key
   - `verified: true` — Venice server confirms attestation against Intel TDX quote
   - `tee_hardware: intel-tdx` — hardware enclave confirmed
3. `GET /api/v1/tee/signature?model=e2ee-qwen-2-5-7b-p&request_id=<id>` returns:
   - `text`: `promptHash:responseHash` — the exact bytes signed by the enclave
   - `signature`: ECDSA signature over `personal_sign(text)`
   - `signing_address`: matches attestation address

**Verified locally:**
```javascript
const recovered = ethers.verifyMessage(text, signature);
// recovered === "0xc4045be3413B0B30ad0295985fe5e037Dc0EeB0c" ✓
```


Venice uses standard Ethereum `personal_sign` semantics. The signature is fully verifiable onchain using OpenZeppelin's ECDSA library.

The Intel TDX attestation is verified offchain by Venice. The contract trusts the reported signing address and verifies signatures from that address.

**Signed payload format:**

Venice signs `promptHash:responseHash` — two 32-byte hex hashes joined by a colon. These are the enclave-reported hashes of the model input and output.

**What is already done:**
- `AgentGated` verifies ECDSA signatures from any address in `trustedTEEProviders`
- Live Venice signing address added to `trustedTEEProviders` in the current Base deployment
- Full attestation chain verified: enclave → Intel TDX quote → signing address → per-request signature


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
  agent.js              # proof pipeline + agent-layer decision gating
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
TEE_SIGNER_ADDRESS=       # live Venice signer for trustedTEEProviders (0xc4045be3413B0B30ad0295985fe5e037Dc0EeB0c)
ONLY_AGENT_ADDRESS=       # deployed OnlyAgent contract
AGENT_REPUTATION_ADDRESS= # deployed AgentReputation contract
BASE_RPC_URL=             # Base RPC (default: https://mainnet.base.org)
```

---

Built at [Synthesis](https://synthesis.computer) 2026.
