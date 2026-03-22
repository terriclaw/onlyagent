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

OnlyAgent demonstrates private financial decision-making inside a Venice TEE, where sensitive treasury data is processed offchain and only a verifiable execution proof is exposed onchain.

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
- the agent enforces **trust truth**
- the ValidationRegistry records **validation truth**

This is the final architecture used in the current Base Mainnet demo.

---


## V1 → V3 Evolution

OnlyAgent evolved into a four-layer enforcement system:

- **V1 — Execution Proof**
  - The contract verifies Venice TEE execution onchain via `prove()`
  - This proves that private AI execution actually occurred

- **V2 — Decision Policy**
  - The agent runtime reads the visible plaintext response
  - The agent only submits if the decision policy passes

- **V3 — Trust Policy**
- **V4 — Validation Signaling**
  - Successful executions emit ERC-8004-compatible validation events
  - The ValidationRegistry records that a TEE-backed execution was verified onchain
  - The agent runtime checks ERC-8004-linked reputation before submission
  - Even a valid `YES` decision can still be blocked if the acting identity is low-trust

Execution now requires:

- valid TEE execution
- approved decision
- trusted agent identity

This progression is the core OnlyAgent design:
- **V1 = execution truth**
- **V2 = decision truth**
- **V3 = trust truth**

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


## Trust Policy (ERC-8004)

OnlyAgent enforces **trust-gated execution** at the agent layer using real onchain reputation.

Before submitting a transaction, the agent evaluates `AgentReputation` and requires:

- `score >= 1`
- `uniqueContracts >= 1`
- `lastActionAt` within 10 days

If any trust condition fails, the runtime returns:

- `submissionRecommendation = do_not_submit`

and no transaction is submitted.

### Private cognition → verifiable action (Venice alignment)

OnlyAgent demonstrates a pattern where sensitive inputs remain private inside a Venice TEE, while the resulting action is provably tied to that execution onchain.

### Example: treasury decision

The agent evaluates a transfer using private financial state:

- Treasury balance: $4.2M  
- Monthly burn: $380k  
- Proposed transfer: $1.5M  
- Policy: maintain ≥ 6 months runway  

These inputs are **never exposed onchain**.

Inside the Venice enclave:
- the model evaluates the policy against private inputs
- produces a visible decision (`YES` or `NO`)
- signs `promptHash:responseHash`

Onchain:
- OnlyAgent verifies the Venice TEE signature
- verifies the agent identity (ERC-8004)
- enforces freshness + replay protection

At the agent layer:
- `YES` → submit transaction  
- `NO` → do not submit  

### Key property

This creates a new primitive:

> **Private state → AI decision → verifiable execution**

The chain proves:
- the execution happened
- the decision came from a TEE-backed model
- the action was taken by a trusted agent

But it never sees:
- the private inputs
- intermediate reasoning

### Why this fits Venice

Venice provides:
- encrypted inference (`e2ee-*`)
- attestation (Intel TDX)
- per-request signatures

OnlyAgent turns that into:
- **decision-gated execution**
- **trust-gated execution**
- **verifiable actions from private context**

This is strictly stronger than:
- oracles (no privacy)
- signatures (no execution provenance)
- offchain agents (no verifiability)


## Why this matters

A valid TEE proof is **not enough**.  
A visible `YES` decision is **not enough**.

Execution now requires all three layers:

1. execution is valid
2. decision is approved
3. agent identity is trusted

### Demonstrated behavior

In the canonical demo, a registered ERC-8004 agent with no reputation history produced a visible `YES` response and still got blocked.

That is the key trust property of the system:

**valid AI output does not override low agent trust.**

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

OnlyAgent exposes a key boundary in verifiable AI systems:

Execution can be proven onchain today.

Semantic equivalence between visible plaintext outputs and provider-defined response hashes cannot yet be enforced onchain.

OnlyAgent resolves this by:
- proving execution onchain
- enforcing decision policy at the agent layer

This is the correct architecture under current TEE signing semantics.


---

## Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| OnlyAgent (demo) | `0x0485c9867a3Ecac90380C335347eaF5791A0A776` |
| AgentReputation | `0xB5e35148d21C630faafB10eBF20AE455635B3aE1` |
| ValidationRegistry | `0xb28C303A15f50d5508c2101Dd6a08730BDF1FfE5` |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

---

This repo demonstrates the full loop: private cognition → verifiable execution → gated onchain action.


## Protocol Labs — Trusted Agents (ERC-8004)

OnlyAgent is a **trust-gated autonomous agent system** built around ERC-8004 identity and reputation.

### Real ERC-8004 integration

OnlyAgent uses real ERC-8004-linked agent identity onchain:

- agent identity is registered on Base
- execution is tied to a persistent agent/operator model
- reputation is accumulated in `AgentReputation`

### Autonomous execution loop

The runtime performs a full loop:

- discover → receive task
- plan → choose Venice TEE execution + onchain proof flow
- execute → run private inference
- verify → check attestation, signature, and transaction parameters
- decide → apply visible-output policy
- trust-check → apply ERC-8004 reputation policy
- submit → only if all checks pass

These steps are recorded in `agent_log.json`.

### Onchain verifiability

OnlyAgent produces real, inspectable transactions on Base:

- Venice execution is proven onchain via `prove()`
- agent actions update onchain reputation
- success and refusal cases are both documented with raw logs

### ERC-8004 Validation Registry

OnlyAgent now records TEE-backed execution validation through an ERC-8004-compatible `ValidationRegistry`.

For a validated execution:

- `validationRequest(...)` is created for the acting `agentId`
- OnlyAgent verifies the Venice TEE proof onchain
- `validationResponse(..., 100, ..., "tee-attestation")` is recorded on success

This makes OnlyAgent not just an execution gate, but a **TEE validator** that publishes standardized validation signals onchain.

### What makes this an ERC-8004 project

OnlyAgent does not just register an agent identity.  
It uses ERC-8004 identity as the anchor for agent trust.

Reputation is defined and enforced by OnlyAgent via the `AgentReputation` contract, not by the ERC-8004 protocol itself.

This creates a clean separation:
- ERC-8004 → identity (who the agent is)
- OnlyAgent → trust policy (whether the agent is allowed to act)


In the final demo:

- a trusted agent can execute
- a low-trust registered agent is blocked
- both outcomes are determined from real onchain identity + reputation state

### DevSpot compatibility

The project includes:

- `agent.json` — machine-readable manifest
- `agent_log.json` — structured autonomous execution logs
- onchain transactions — public receipts
- canonical raw demo logs — reproducible evidence

This makes OnlyAgent not just an AI demo, but a **verifiable trusted-agent system**.

---


- 🏆 [Leaderboard](https://terriclaw.github.io/onlyagent/leaderboard/) — agents that have proved execution provenance onchain
- 🔗 [Validated Execution TX](https://basescan.org/tx/0x8a7ca9ece3213b1ccde2383f49fce484083e657ba4b7e92cef2b6da134bf981a) — TEE-verified execution + ERC-8004 validation recorded onchain
- 🔗 [Operator Approval TX](https://basescan.org/tx/0x220653b6ff0bce785f7b9f53f31aaf0a70086edbcdf5738ac436bd2bbaf9d249) — OnlyAgent approved as operator for ERC-8004 agent
- 🔗 [Decision YES TX](https://basescan.org/tx/0x1a17fd5550584c4abeba9676a868153941781f2e1edd94b08d8b92fde8b858e2) — final decision-approved demo on Base Mainnet
- 🔗 [Trust Fail Case (Raw Logs)](https://github.com/terriclaw/onlyagent/tree/master/logs) — decision YES but execution blocked due to low ERC-8004 reputation
- 📄 Logs — full 4-case demo including trust pass + trust fail (`logs/`)

---

## Use In Your Own Contract

```solidity
import "./contracts/AgentGated.sol";

contract MyContract is AgentGated {
    constructor(
        address erc8004Registry,
        address reputation,
        address validationRegistry,
        address[] memory teeProviders
    ) AgentGated(erc8004Registry, reputation, validationRegistry, teeProviders) {}

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
  ValidationRegistry.sol # ERC-8004 validation signaling
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
VALIDATION_REGISTRY_ADDRESS= # deployed ValidationRegistry contract
BASE_RPC_URL=             # Base RPC (default: https://mainnet.base.org)
```

---

Built at [Synthesis](https://synthesis.computer) 2026.
