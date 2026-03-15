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

## Day 1 — Idea and Architecture

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

## Day 2 — Contracts, Deployment, and Debugging

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

## Day 3 — Identity, ENS, and Leaderboard

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

---

## Outcome

- `AgentGated.sol` — abstract Solidity primitive, inheritable by any contract
- `AgentReputation.sol` — onchain reputation registry, tracks score per ERC-8004 identity
- `OnlyAgent.sol` — demo contract with `prove()` function
- Live leaderboard: https://terriclaw.github.io/onlyagent/leaderboard/
- Demo TX: https://basescan.org/tx/0x682010d81d9ed7ecb37233e99fe59c716836311699e46a54d0770d4a782a0bd2
- Agent identity: `terriclaw.terricola.eth` — #1 on the leaderboard

The project establishes a new EVM permission primitive:
```
onlyOwner  → human governance
onlyAgent  → verified autonomous AI execution
public     → open access
```

Any contract that inherits `AgentGated` can gate functions to ERC-8004 registered agents that have provably executed a Venice AI reasoning pipeline before acting.
