# OnlyAgent

**A smart contract access control primitive that proves an AI agent genuinely reasoned before executing an onchain transaction.**

OnlyAgent combines ERC-8004 agent identity with Venice AI TEE response signing to create a new class of onchain permission: not just *who* is calling, but *that they actually thought about it*.

## The Problem

Any wallet can call any smart contract. There's no way to verify that an AI agent actually reasoned before acting — it could be a script, a bot, or a compromised agent blindly executing instructions.

## The Solution

The `onlyAgent` modifier requires three things before a transaction goes through:

1. **ERC-8004 registration** — the caller is a verified onchain agent identity
2. **Venice AI reasoning** — the agent called Venice and got a real response
3. **TEE signature** — the commitment is signed by a trusted execution environment, binding the reasoning to this specific agent, contract, and timestamp

No reasoning, no access.

## How It Works
```
Agent calls Venice AI with a prompt
        ↓
Venice TEE signs the response (Intel TDX enclave)
        ↓
Agent builds commitment:
  keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp)
        ↓
Smart contract verifies:
  ✓ ERC-8004 registered agent
  ✓ Proof not expired (2 min window)
  ✓ Commitment not replayed
  ✓ TEE signature from trusted provider
        ↓
Access granted — reputation incremented
```

## Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| OnlyAgent (demo) | `0x5158969E52dB9B919E995EBFeC468978435a3A57` |
| AgentReputation | `0x1BF485396e831B7c640Ef0152e3df88926F911D6` |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

## Quickstart
```bash
git clone https://github.com/terriclaw/onlyagent
cd onlyagent
npm install
cp .env.example .env  # fill in your keys
node scripts/agent.js "Should I execute this transaction? Reason carefully."
```

## Use In Your Own Contract
```solidity
import "./contracts/AgentGated.sol";

contract MyContract is AgentGated {
    constructor(address erc8004Registry, address reputation, address[] memory teeProviders)
        AgentGated(erc8004Registry, reputation, teeProviders) {}

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

## Reputation

Every verified call increments the agent's score in `AgentReputation`. The registry tracks:
- Total actions
- Unique contracts interacted with
- First and last action timestamps

Reputation is tied to the ERC-8004 identity — it follows the agent across every contract that uses `AgentGated`.

## Venice TEE

OnlyAgent is built for Venice AI's TEE response signing (Intel TDX). Venice is the only mainstream LLM provider with Ethereum-compatible enclave signing — every TEE response includes a `signing_address` you can verify onchain with `ecrecover`.

The current deployment uses a mock TEE signer. When Venice TEE goes public:
1. Swap model to `tee-qwen3-235b-a22b-thinking-2507` in `scripts/agent.js`
2. Call `addTEEProvider(veniceSigningAddress)` on your contract

Zero other changes needed.

## OpenClaw Skill

TerriClaw (an ERC-8004 registered agent) can demo OnlyAgent directly via the bundled OpenClaw skill in `skills/onlyagent-demo/`.

## Project Structure
```
contracts/
  AgentGated.sol        # abstract base — import this in your contract
  AgentReputation.sol   # onchain reputation registry
  OnlyAgent.sol         # demo contract
scripts/
  agent.js              # end-to-end proof flow
  deploy.js             # deployment script
skills/
  onlyagent-demo/       # OpenClaw skill for TerriClaw demo
  onlyagent/            # OpenClaw SDK skill for other agents
leaderboard/            # agent reputation leaderboard UI
agent/                  # TerriClaw ERC-8004 identity
```

## Environment Variables
```bash
VENICE_API_KEY=          # Venice API key
AGENT_ADDRESS=           # your ERC-8004 registered agent wallet address
TEE_SIGNER_PRIVATE_KEY=  # mock TEE signer only — when Venice TEE ships, use addTEEProvider(veniceSigningAddress) instead
ONLY_AGENT_ADDRESS=      # deployed OnlyAgent contract address
BASE_RPC_URL=            # Base RPC (default: https://mainnet.base.org)
```

## Hackathon

Built at [Synthesis](https://synthesis.computer) 2026.
Targeting Venice, Protocol Labs, and ENS prize tracks.
