# Human–Agent Collaboration Log

**Project:** OnlyAgent
**Hackathon:** The Synthesis 2026
**Human operator:** terricola
**Agent:** TerriClaw (`terriclaw.terricola.eth`) — OpenClaw harness
**AI systems used in development:** Claude (architecture + code), ChatGPT (design review + protocol reasoning), TerriClaw (onchain execution)

---

This document records the human–agent collaboration that produced OnlyAgent during The Synthesis hackathon. It captures design discussions, debugging steps, and the autonomous execution pipeline performed by the TerriClaw agent.

---

## Overview

OnlyAgent was developed collaboratively between a human operator and AI systems over the first days of the hackathon. The human led architecture decisions, deployment, and testing. Claude and ChatGPT assisted with design iteration, Solidity implementation, debugging, and documentation. TerriClaw executed the final onchain proof pipeline autonomously.

The project emerged from a question the human operator brought to the session: *is there a way for a smart contract to know that an AI agent actually reasoned before acting, rather than just blindly executing?*

---

## Session 1 — Idea, Architecture, and Deployment

**Human input:** Proposed the concept of AI-gated smart contracts. The initial framing was "prove reasoning before acting onchain."

**AI collaboration:**
- Claude helped refine the design question: the issue is not proving reasoning quality, it is proving execution provenance — that a specific AI execution happened and produced a specific output.
- The five-field commitment hash emerged from this discussion: `keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp)`. This binds a specific Venice reasoning event to a specific agent, contract, and timestamp.
- Claude drafted the initial `AgentGated.sol` abstract contract with the `onlyAgent` modifier, `AgentReputation.sol` for onchain score tracking, and `OnlyAgent.sol` as a demo contract.
- Venice AI TEE (Intel TDX) was identified as the signing primitive — the only mainstream LLM provider with Ethereum-compatible enclave signing.

**Key design decisions made:**
- Use a mock TEE signer keypair until Venice TEE ships publicly (announced arriving this week)
- ERC-8004 for agent identity — same registry address across all EVM chains
- `proofValidityWindow = 2 minutes` to prevent replay without being too tight

**Early pivot:** Initial agent.js design used a deployer private key as the agent wallet. Corrected after recognizing TerriClaw uses Bankr for signing — the agent never has access to its own private key. Rewrote to use `AGENT_ADDRESS` env var + `bankr prompt` for transaction submission.

---

## Session 2 — Contracts, Deployment, and Debugging

**Deployment:** Contracts deployed to Base Mainnet using a funded deployer wallet.

**First demo run — failed:**
The `onlyAgent` modifier called `IERC8004.isRegistered(msg.sender)` but the deployed ERC-8004 registry is an ERC-721 contract. The `isRegistered` function selector does not exist on the deployed contract, causing a revert.

**Debugging process:**
- Used direct `eth_call` to test the registry
- Confirmed `balanceOf(terriclaw_address)` returns `1` — TerriClaw IS registered
- Also confirmed TerriClaw was registered on ETH mainnet but not Base — registered on Base as well
- Root cause: interface mismatch. The IERC8004 interface in `AgentGated.sol` defined `isRegistered(address) returns (bool)` but the actual contract only exposes `balanceOf(address) returns (uint256)`

**Fix:** Updated IERC8004 interface to use `balanceOf` and changed the require check to `> 0`. Redeployed both contracts. Re-registered mock TEE signer on new OnlyAgent contract.

**Second demo run — failed:**
Same revert. TerriClaw was not yet registered on Base ERC-8004 (only Ethereum mainnet). The fix from run 1 was correct but ran before the Base registration was confirmed onchain.

**Third demo run — success:**
Full pipeline executed autonomously by TerriClaw:
1. Venice AI call with reasoning prompt
2. Prompt + response hashed
3. Commitment hash built
4. Mock TEE signed commitment
5. Transaction submitted via Bankr wallet
6. `prove()` confirmed on Base Mainnet

**Demo TX:** `0x682010d81d9ed7ecb37233e99fe59c716836311699e46a54d0770d4a782a0bd2`

The retries and debugging process are documented in `agent/agent_log.json`.

---

## Session 3 — ENS, Leaderboard, and Agent Identity

**Leaderboard build:**
A static HTML/JS leaderboard was created to read `AgentReputation` onchain and display agent scores. Initial version had JavaScript template literal escaping bugs. Fixed via Python string replacement.

**ENS integration — issues and fix:**
- TerriClaw's ENS name `terriclaw.terricola.eth` forward-resolves correctly
- Reverse record was not set — `lookupAddress()` returned null
- TerriClaw set the reverse record via the ENS reverse registrar on Ethereum mainnet using Bankr (initially attempted on Base by mistake — corrected to chainId 1)
- ethers v5 `lookupAddress` returned null in-browser even after reverse record confirmed. Switched leaderboard to `api.ensideas.com` ENS resolution API — resolved immediately

**Leaderboard UX:**
Updated to ENS-first display: address hidden by default, visible on hover. Names replace addresses as the primary identifier.

**Agent manifests:**
Created `agent/agent.json` (capability manifest) and `agent/agent_log.json` (structured execution log) for Protocol Labs DevSpot compliance. Includes real hashes, real TX, retry history, and tool calls from the demo run.

**Venice TEE note:**
Venice announced publicly in the hackathon Telegram that TEE models are completing final review and will ship this week. The current deployment uses a mock TEE signer. When Venice TEE ships: swap model name to `tee-qwen3-235b-a22b-thinking-2507` and call `addTEEProvider(veniceSigningAddress)` — no other changes required.

---

## Session 4 — Status Network and Multi-chain Leaderboard

**Status Network Sepolia deployment:**
OnlyAgent was deployed to Status Network Sepolia (chainId 1660990954) to qualify for the Status Network prize track. Status Network is gasless at the protocol level — all transactions use `gasPrice: 0`.

**Technical challenge — EVM version mismatch:**
Initial deployment failed with `invalid opcode: PUSH0`. Status Network does not support the Shanghai EVM upgrade (EIP-3855). Solidity 0.8.20+ emits `PUSH0` by default. Root cause: `hardhat.config.ts` was taking precedence over `hardhat.config.js`, ignoring the `evmVersion: "paris"` override. Fixed by updating `hardhat.config.ts` directly to target `paris` EVM. Recompiled clean and deployment succeeded.

**MockERC8004:**
The real ERC-8004 registry (`0x8004...`) is not deployed on Status Network Sepolia. Deployed a `MockERC8004` contract that returns `1` for every `balanceOf` call, allowing the `onlyAgent` modifier to pass on testnet without a real agent registry.

**Gasless prove() TX:**
`0xe97812a3c165059c9d751a7b953d9c1c481cd3fd2c88dc64c5acea4252b1f5ad`

Note: Bankr does not work on Status Network. Transaction was submitted directly via ethers with the deployer private key. `prove-status.js` documents this distinction — agents running on Status Sepolia must bring a private key directly.

**Deployed contracts (Status Network Sepolia):**
- OnlyAgent: `0xBa9d89888F32Bce09D1Fc596FD25dc44ab7645C4`
- AgentReputation: `0xB45c1e0Dc6b5d07ecCEDb9F7953e38Bad8f4BB9F`
- MockERC8004: `0x5c83906a6d5BA16f60ca66a49c62e4586c86CBE6`

**Multi-chain leaderboard:**
Leaderboard updated to query AgentReputation on both Base Mainnet and Status Network Sepolia in parallel. Agents are merged by address — same identity on multiple chains gets a combined score. Chain badges show where each agent has been active. This makes the cross-chain nature of ERC-8004 identity visible: reputation follows the agent, not the network.

**Skill updated:**
`onlyagent-demo` skill updated to document both execution paths: Base Mainnet (via Bankr) and Status Network Sepolia (via direct private key signing).

---

## Tools Used

| Tool | Role |
|---|---|
| Claude | Architecture design, Solidity contracts, agent.js pipeline, debugging, documentation |
| ChatGPT | Protocol design review, framing, README critique |
| TerriClaw (OpenClaw) | Onchain execution, autonomous transaction submission, ENS setup |
| Venice AI | Reasoning model (`qwen3-235b-a22b-thinking-2507`), TEE signing (mock until Venice TEE ships) |
| Bankr | TerriClaw's EIP-7702 smart wallet — handles signing without private key exposure |
| Hardhat | Contract compilation and deployment |
| Base Mainnet | Deployment target (chainId 8453) |
| Status Network Sepolia | Gasless deployment target (chainId 1660990954) |

---

## Outcome

- `AgentGated.sol` — abstract Solidity primitive, inheritable by any contract
- `AgentReputation.sol` — onchain reputation registry, tracks score per ERC-8004 identity
- `OnlyAgent.sol` — demo contract with `prove()` function
- Live leaderboard: https://terriclaw.github.io/onlyagent/leaderboard/
- Demo TX: https://basescan.org/tx/0x682010d81d9ed7ecb37233e99fe59c716836311699e46a54d0770d4a782a0bd2
- Agent identity: `terriclaw.terricola.eth` — #1 on the leaderboard
- Status Network Sepolia deployment: gasless `prove()` TX confirmed
- Multi-chain leaderboard: Base Mainnet + Status Network Sepolia with chain badges

The project establishes a new EVM permission primitive:
```
onlyOwner  → human governance
onlyAgent  → verified autonomous AI execution
public     → open access
```

Any contract that inherits `AgentGated` can gate functions to ERC-8004 registered agents that have provably executed a Venice AI reasoning pipeline before acting.

---

## Session 5 — Security Audit, Hardening, and Redeployment

**Security audit:**
ChatGPT performed a cold review of `AgentGated.sol` and identified four issues:

1. **No chain binding** — the commitment hash did not include `block.chainid`, making proofs replayable across EVM-compatible chains
2. **One-sided timestamp check** — only checked `block.timestamp <= timestamp + window`, not that `timestamp <= block.timestamp`, allowing future-dated proofs
3. **Raw ecrecover** — used inline assembly for signature recovery instead of OpenZeppelin ECDSA, which handles signature malleability and zero-address edge cases
4. **Redundant zero-address check** — `require(signer != address(0))` was unnecessary since OZ ECDSA already reverts on invalid signatures

**Fixes applied to `AgentGated.sol`:**
- Added `block.chainid` as the sixth field in the commitment hash: `keccak256(promptHash, responseHash, agentAddress, contractAddress, timestamp, block.chainid)`
- Added `require(timestamp <= block.timestamp, "OnlyAgent: proof from future")`
- Imported `@openzeppelin/contracts/utils/cryptography/ECDSA.sol`, switched to `ECDSA.recover()`
- Removed redundant assembly `recoverSigner()` function and zero-address check

**Redeployment to Base Mainnet:**
- AgentReputation: `0x7e765A6c3581e008fF91c0c7240c474b11E912a0`
- OnlyAgent: `0xa592d5605Cb5a03CF8cf1f80d7848e98939B6258`
- First prove() on hardened contract: `0x0f47d6109c1ad3cff2ed6b17ceeda65348edf61598172052c0a1fec6e8b2140f`

**Redeployment to Status Network Sepolia:**
Session 4 contracts were pre-audit. Redeployed with hardened AgentGated:
- OnlyAgent: `0x5158969E52dB9B919E995EBFeC468978435a3A57`
- AgentReputation: `0x1BF485396e831B7c640Ef0152e3df88926F911D6`
- MockERC8004: `0xD9d92232EBB9Fc748402800737222501245545A2`
- Gasless prove() TX: `0x860a5439d71544e8232eda8bfb2a1993987d3aefdb68ff472d8080238f42a7da`

**Scripts updated:**
- `scripts/agent.js` — commitment hash updated to 6 fields including `chainId`
- `scripts/prove-status.js` — commitment hash updated to match

**README precision pass (ChatGPT review):**
Three phrases corrected to avoid implying proof of reasoning quality:
- "executed a reasoning pipeline" → "executed an attested inference pipeline"
- "reasoning from this specific prompt" → "executing from this specific prompt"
- "what reasoning produced the action" → "what model execution produced the action"

The system proves execution provenance of an AI inference tied to a transaction — not reasoning correctness. The README now reflects this precisely.

**Leaderboard updated:**
Both chain addresses updated to post-audit deployments.

---

## Session 6 — AgentReputation Architecture Fix and Redeployment

**Issue identified:**
`AgentReputation.sol` had a structural limitation — only a single `agentGatedContract` address could write reputation scores. This contradicted the README claim that "reputation follows the ERC-8004 identity across every contract that uses AgentGated."

**Fixes applied to `AgentReputation.sol`:**
- Replaced `address public agentGatedContract` with `mapping(address => bool) public authorizedAgentGatedContracts`
- Added `addAgentGatedContract(address)` and `removeAgentGatedContract(address)` owner functions
- Updated `onlyAgentGated` modifier to check the mapping instead of a single address
- Replaced duplicate-prone `firstActionAt == 0` push guard with `knownAgents[agent]` check
- Removed `resetScore()` — semantically incomplete due to inability to clear nested mapping

**Redeployment to Base Mainnet:**
- AgentReputation: `0x92d48F5375a86484706549C9fD71Ac3C62E98eb9`
- OnlyAgent: `0x2367Ea8321bC461AAa3C156D92C4cAd73f89F4c5`
- prove() TX: `0x057f04dc79798dcbfc3edad464c60640cf6ddd7564eee5449e0d7e25c8cbc34b`

**Redeployment to Status Network Sepolia:**
- AgentReputation: `0xa592d5605Cb5a03CF8cf1f80d7848e98939B6258`
- OnlyAgent: `0xaea2e6252093b25dbe151F613696162908bE987a`
- MockERC8004: `0x7e765A6c3581e008fF91c0c7240c474b11E912a0`
- Gasless prove() TX: `0x85e744df745a9587fe27379ef8fb663117a1cf48baa8758cd2cc151df547e539`

**Scripts updated:**
- `scripts/deploy.js`, `scripts/deploy-status.js`, `scripts/link.js` — `setAgentGatedContract` → `addAgentGatedContract`

**Additional cleanup:**
- `agent.js` header banner updated: "Proving AI Reasoning" → "Proving AI Execution"
- `agent.js` footer updated: "genuinely reasoned before acting" → "executed an attested inference before acting"
