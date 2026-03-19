# OnlyAgent

A smart contract primitive for **verifiable AI agent execution onchain**.

`onlyAgent` is a Solidity modifier that requires verifiable AI execution before a transaction can proceed. Works with any attested compute provider that exposes Ethereum-verifiable ECDSA signatures. The current demo uses a mock TEE signer modeled on Venice AI's documented TEE signing flow.

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

Venice's enclave signs `personal_sign(promptHash:responseHash)` — proving a specific model execution occurred.

The offchain adapter verifies that signature against the attested signing address, extracts the confirmed hashes, then constructs the action-bound commitment:
```
keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp, chainId)
```

The contract verifies this commitment. Venice proves *what model ran*. The commitment proves *that execution was bound to this specific agent, contract, and moment in time*.

The contract does not read the prompt or response text — it sees hashes. Store the preimages offchain and you can prove exactly what model execution produced the action.

---

## The Trust Chain
```
Trusted TEE provider (mock signer in current deployment; Venice TEE target integration)
↓
signs an Ethereum-verifiable payload that is mapped into the OnlyAgent execution commitment
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

The enclave signs `personal_sign(promptHash:responseHash)` for the model execution itself.

The offchain adapter then binds those verified hashes to a specific onchain action by constructing:
```
keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp, chainId)
```

The contract verifies this action-bound commitment before executing the call.

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

OnlyAgent is built for Venice AI's TEE response signing. Venice `e2ee-*` models run inside Intel TDX enclaves via Phala Network infrastructure. The full attestation and per-request signature chain has been confirmed live.

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

**Signed payload format:**

Venice signs `promptHash:responseHash` — two 32-byte hex hashes joined by a colon. These are the enclave-reported hashes of the model input and output.

**What is already done:**
- `AgentGated` verifies ECDSA signatures from any address in `trustedTEEProviders`
- Live Venice signing address confirmed and ready for `addTEEProvider()`
- Full attestation chain verified: enclave → Intel TDX quote → signing address → per-request signature

**Remaining adapter work:**

Venice signs `personal_sign(promptHash:responseHash)`. OnlyAgent's current commitment binds six fields: prompt hash, response hash, agent address, contract address, timestamp, and chain ID. The offchain adapter in `scripts/agent.js` will:
1. Verify Venice's signature against the attested signing address
2. Extract `promptHash` and `responseHash` from Venice's signed text
3. Construct OnlyAgent's action-bound commitment using those hashes
4. Sign the full commitment for onchain verification

This layered model preserves OnlyAgent's stronger binding: Venice proves model execution, OnlyAgent proves that execution was tied to a specific onchain action.

**To activate live Venice TEE integration:**

1. Call `addTEEProvider(0xc4045be3413B0B30ad0295985fe5e037Dc0EeB0c)` on deployed contracts
2. Switch model to `e2ee-qwen-2-5-7b-p` (or any `e2ee-*` model) in `scripts/agent.js`
3. Finalize the offchain adapter that verifies Venice `personal_sign(promptHash:responseHash)` and binds those verified hashes into the OnlyAgent six-field commitment

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
TEE_SIGNER_PRIVATE_KEY=   # mock/offchain adapter signer during development
ONLY_AGENT_ADDRESS=       # deployed OnlyAgent contract
AGENT_REPUTATION_ADDRESS= # deployed AgentReputation contract
BASE_RPC_URL=             # Base RPC (default: https://mainnet.base.org)
```

---

Built at [Synthesis](https://synthesis.computer) 2026.
