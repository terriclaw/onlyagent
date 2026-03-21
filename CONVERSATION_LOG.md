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

## Session 7 — Live Venice TEE Signature Verified Directly Onchain

**Major transition:**
The mock TEE signer was fully removed from the Base Mainnet path. OnlyAgent now verifies Venice's live per-request TEE signature directly onchain.

**What changed:**
- Venice `e2ee-*` models were confirmed live with `x-venice-tee: true`
- `GET /api/v1/tee/attestation?model=e2ee-qwen-2-5-7b-p` returned a live enclave signer:
  - `0xc4045be3413B0B30ad0295985fe5e037Dc0EeB0c`
- `GET /api/v1/tee/signature?model=e2ee-qwen-2-5-7b-p&request_id=<id>` returned:
  - `text = promptHash:responseHash`
  - `signature`
  - matching `signing_address`
- Local verification with `ethers.verifyMessage(text, signature)` recovered the attested signer exactly

**Contract architecture update:**
`AgentGated.sol` was rewritten to verify Venice's real payload format directly:
- reconstruct lowercase no-prefix `promptHash:responseHash`
- compute Ethereum signed-message hash over the raw text
- recover signer directly from Venice signature
- require signer is in `trustedTEEProviders`

This removed the old mock/offchain adapter signer from the Base execution path.

**Deployment:**
New Base Mainnet contracts were deployed:
- AgentReputation: `0xB5e35148d21C630faafB10eBF20AE455635B3aE1`
- OnlyAgent: `0xED7d4E118f04335E3b2d9105FE1D8F83DD464C0D`

`AgentReputation.addAgentGatedContract(OnlyAgent)` was linked manually after deployment due to a replacement-underpriced nonce error in the deploy script.

**Live proof run:**
TerriClaw executed the updated pipeline:
1. Call live Venice e2ee model
2. Fetch attestation
3. Fetch per-request signature
4. Verify signer locally
5. Submit `prove()` via Bankr
6. Contract verifies Venice signature directly onchain

**Live Base TX:**
`0xc356c1dba0cb5945ae4fcca77b3d56da2896bc7c952cb66e9ce840942912779a`

This is the first full end-to-end OnlyAgent proof using:
- live Venice TEE execution
- live Venice attestation
- live Venice per-request signing
- direct onchain signature verification
- real ERC-8004 agent identity
- real Bankr agent execution

At this point, OnlyAgent is no longer a mock TEE demo on Base Mainnet. The Venice-backed execution gate is live.

---

## Session 8 — Base-Only Cleanup and Repeat Live Venice Proof

**Project surface cleanup:**
After the live Venice TEE path was working on Base Mainnet, the active Status Network Sepolia path was removed from the project surface to simplify the system and keep the public story coherent.

**What changed:**
- Removed Status Network from active runtime configuration
- Removed Status chain config from `hardhat.config.js`
- Removed Status references from leaderboard runtime config
- Removed Status environment variables from active `.env`
- Deleted `MockERC8004.sol`
- Kept historical Status references in `agent_log.json` and this collaboration log for chronology integrity

**Reasoning:**
The live Venice-native Base Mainnet path had become the real system. Keeping a second inactive execution path in docs, runtime config, and UI added noise and made the trust model less clear. The project is now intentionally Base-only in its active surface area.

**README correction:**
The documentation was updated to remove stale "execution commitment" and adapter-binding language. The current Base system verifies a Venice TEE execution proof directly onchain:
- Venice signs `personal_sign(promptHash:responseHash)`
- the contract reconstructs the exact text
- the contract recovers the signer and checks it against trusted TEE providers
- ERC-8004 identity and timestamp freshness are enforced onchain

This shifted the language from "execution commitment" to the more accurate "TEE execution proof."

**Repeat live proof run:**
A second full end-to-end proof was executed on Base Mainnet using the live Venice path to confirm the system was stable across repeated runs.

**Flow:**
1. Call live Venice `e2ee-qwen-2-5-7b-p`
2. Fetch attestation
3. Fetch per-request signature
4. Verify signer locally with `ethers.verifyMessage`
5. Submit `prove()` via Bankr
6. Verify success onchain

**Result:**
- Venice TEE confirmed: `intel-tdx`
- Live signer: `0xc4045be3413B0B30ad0295985fe5e037Dc0EeB0c`
- Base transaction succeeded
- No mock signer
- No adapter signer
- Direct onchain verification path remained stable on repeated execution

**Second live Base TX:**
`0x242698ffe3bc6e6f53da3b9ba4efe6c85f7d8b4aca57a9809accf6d20a258d1e`

At this point, OnlyAgent has:
- a live Venice-native Base Mainnet path
- a simplified single-network active surface
- repeated successful proofs using direct onchain verification of Venice TEE execution proofs


### Additional Validation — Third Consecutive Live Venice Proof

A third full Base Mainnet proof was executed using the same prompt as the prior run.

Notable result:
- the prompt hash remained identical
- the response hash changed
- the Venice signature changed accordingly
- the onchain proof still succeeded

This confirms that OnlyAgent is verifying unique execution instances, not just prompt inputs. Repeated runs over the same prompt still produce distinct, valid proofs when the model output differs.

**Third live Base TX:**
`0x658c0f6aef71cfef606f72079809acdd408d3cd47b6026172ac77c3441c53567`


## Session 8 — Terminology Correction: Execution vs Reasoning

**Key realization:**
Earlier iterations of OnlyAgent described the system as proving "AI reasoning." This was incorrect.

The system does not verify:
- reasoning quality
- correctness of outputs
- internal chain-of-thought

It verifies:
- that a specific execution occurred (`promptHash:responseHash`)
- that the execution was signed by a trusted TEE provider
- that the caller is a registered agent
- that the proof is fresh

**Correction applied:**
- Replaced "execution commitment" → "TEE execution proof"
- Removed "reasoning" and "justification" language from README
- Clarified that Venice signs execution artifacts, not decisions
- Clarified that the contract verifies signatures, not attestation itself

**Resulting model:**
OnlyAgent enforces execution provenance, not reasoning validity.

This aligns the documentation with actual contract behavior and removes overclaims.


---

## Session 9 — Wallet-Agnostic Payload Flow and End-to-End Skill Execution

**Architecture cleanup:**
The original live Base path used a Bankr-specific submission flow inside `scripts/agent.js`. This worked, but it mixed two concerns:
- generating a Venice-backed TEE execution proof
- choosing and using a specific wallet surface for transaction submission

This was refactored so that `scripts/agent.js` now performs only proof generation and transaction payload construction.

**New separation of responsibilities:**
- `scripts/agent.js` now:
  - calls the Venice `e2ee-*` model
  - fetches attestation
  - fetches per-request signature
  - verifies the Venice signer locally
  - builds a wallet-agnostic Base transaction payload for `OnlyAgent.prove()`
- the harness now:
  - chooses the wallet surface
  - submits the transaction payload immediately within the 2-minute freshness window

This made the flow wallet-agnostic without changing the onchain verification model.

**Skill update:**
`onlyagent-demo` was rewritten to reflect the new architecture:
- no execution commitment language
- no Bankr hardcoding
- explicit explanation of why the proof matters
- explicit requirement to immediately submit the payload before freshness expiry

**Freshness constraint observed in practice:**
A first attempt built a correct payload but did not submit it quickly enough. The contract rejected the proof after the 2-minute window elapsed. This validated the freshness check and showed that proof generation and submission must be orchestrated back-to-back.

**End-to-end skill execution:**
After the skill was updated, TerriClaw executed the full flow successfully:
1. build Venice-backed TEE proof payload
2. immediately submit payload with the harness wallet
3. confirm success on Base Mainnet

**Skill-based Base TX:**
`0xde0e70ff0f11cdc773bd843497843532fdda313ce0687bca644f4823e77df290`

This established the final demo architecture for OnlyAgent:
- Venice private cognition
- wallet-agnostic proof payload generation
- harness-supplied wallet submission
- direct onchain signature verification
- ERC-8004 agent identity gate
- freshness enforcement

At this point, the demo is no longer tied to a single wallet implementation. OnlyAgent generates a proof payload; the agent harness supplies the submitting wallet.


---

## Session 10 — Onchain Decision-Binding Attempt, Venice Hash Semantics Discovery, and Final Agent-Layer Decision Gating

**Initial goal:**
Strengthen OnlyAgent beyond execution provenance by enforcing a semantic AI decision onchain. The attempted design added `proveApproved()` to `OnlyAgent.sol`, intending to require that the TEE-backed response was exactly `YES`.

**Experimental contract path:**
A new Base Mainnet `OnlyAgent` contract was deployed at:
- `0x2248bb37821f8675B4de7786c8C5d1E15333E869`

This version added:
- `YES_HASH = keccak256("YES")`
- `proveApproved()`
- onchain check: `responseHash == YES_HASH`

The goal was:
- Venice says `YES`
- the contract enforces that approval directly onchain

**What was tested:**
Multiple decision-mode runs were executed using `e2ee-qwen-2-5-7b-p` with prompts instructing the model to answer exactly `YES` or `NO`.

Observed results:
- visible plaintext response could be exactly `YES`
- local `keccak256("YES")` matched the expected hash
- but Venice `/tee/signature` returned a different `responseHash`
- `proveApproved()` reverted with `OnlyAgent: decision denied`

**Critical investigation:**
The raw Venice API surfaces were tested directly:
1. `/chat/completions`
2. `/tee/attestation`
3. `/tee/signature`

This confirmed:
- `choices[0].message.content` could be `"YES"`
- `reasoning_content` could be `null`
- reasoning could be explicitly disabled
- yet `responseHash` from `/tee/signature` still did **not** equal `keccak256(message.content)`

Venice's signature endpoint itself states:

> treat request/response hashes as provider-reported values unless you can independently recompute them from a documented canonical format.

**Conclusion:**
This was not a bug in OnlyAgent. It was a provider semantics boundary.

Venice provides:
- verifiable execution provenance
- signer authenticity
- attested TEE execution

But Venice does **not** currently expose a documented canonical mapping from visible plaintext response → `responseHash`.

That means:
- direct onchain enforcement of a visible response string like `YES`
- using `responseHash == keccak256("YES")`

is not valid under current Venice signature semantics.

**Architectural decision:**
The project was deliberately reverted back to the live v1 Base contract:
- OnlyAgent: `0xED7d4E118f04335E3b2d9105FE1D8F83DD464C0D`

`OnlyAgent.sol` was restored to a single execution-proof entrypoint:
- `prove()`

The stronger design was preserved by moving semantic enforcement to the agent runtime rather than the contract.

**Final architecture after the revert:**
- **Contract layer** — verifies Venice TEE execution provenance onchain via `prove()`
- **Agent layer** — reads the visible plaintext response and applies deterministic policy
- **Harness wallet** — submits only if the agent says `submit`

So the system now cleanly separates:
- cryptographic proof of execution (onchain)
- policy interpretation of visible output (agent layer)

**Final demo run — all three cases succeeded under the new architecture:**

### Case 1 — Execution Proof baseline
- mode: `prove`
- prompt: `Execute this onchain action. Execution proof baseline.`
- result: payload built and submitted
- Base TX: `0x27a3031e7306eb1d7e9f4f2f12a129693198f2fa944050e400c564f83403892d`
- block: `43634747`

### Case 2 — Decision mode approved
- mode: `decision`
- prompt: `Should I execute this transfer? The request is valid and approved by policy. Respond YES or NO only.`
- visible response: `YES`
- agent-layer decision: `submit`
- payload built against `prove()`
- Base TX: `0x2d9053d7e838a2561fa8f62f1d3f44e76468f4c2e9393e57bc01b2e5398d7b8b`
- block: `43634754`

### Case 3 — Decision mode denied
- mode: `decision`
- prompt: `Should I execute this transfer? The recipient address looks suspicious. Respond YES or NO only.`
- visible response: `NO`
- agent-layer decision: `do_not_submit`
- no transaction was submitted
- run correctly terminated at the agent layer

**Log artifacts:**
- `logs/run-1774058833.json` — execution-proof baseline
- `logs/run-1774058847.json` — decision approved and submitted
- `logs/run-1774058867.json` — decision denied with no submission

**Resulting model:**
OnlyAgent now has a stable and honest architecture:

- Venice TEE proves that a model execution occurred
- the contract proves that execution provenance onchain
- the agent uses the visible plaintext response to decide whether to submit

This is a real level-up from execution-only v1, while staying aligned with the actual semantics exposed by the Venice API.

---

## Session 11 — Canonical 4-Case Demo with ERC-8004 Trust-Gated Execution

**Final architecture extension:**
After establishing the stable Venice execution-proof + agent-layer decision architecture in Session 10, the system was extended with a third gate: ERC-8004-linked trust policy.

This created three independent layers:

- **Identity** — the acting wallet must be ERC-8004 registered
- **Execution** — Venice TEE execution must be verified onchain
- **Trust** — the acting agent identity must have sufficient onchain reputation history

**Trust policy implemented:**
The agent runtime now evaluates `AgentReputation` before submission using:

- `score >= 1`
- `uniqueContracts >= 1`
- `lastActionAt` within 10 days

This policy is computed from real onchain reputation state and surfaced both:
- in the agent runtime
- on the leaderboard as a trust classification

**Why this matters:**
This changed OnlyAgent from an execution-verification primitive into a trust-gated execution system.

A valid TEE proof is no longer sufficient by itself.  
A visible `YES` decision is no longer sufficient by itself.  
The acting identity must also be trusted.

**Canonical 4-case demo completed successfully:**

### Case 1 — Execution Proof baseline
- trusted agent: `0x0457B3DED2BA9E56520B21735f4324F6533F93ff`
- mode: `prove`
- result: submitted and confirmed
- Base TX: `0xc8ab0440ba0e064e588621fdec780cb2823b8666310cdc240da0cdd963b40f46`
- block: `43644497`

### Case 2 — Decision denied
- trusted agent: `0x0457B3DED2BA9E56520B21735f4324F6533F93ff`
- mode: `decision`
- visible response: `NO`
- result: `do_not_submit`
- no transaction submitted

### Case 3 — Decision approved + trust pass
- trusted agent: `0x0457B3DED2BA9E56520B21735f4324F6533F93ff`
- mode: `decision`
- visible response: `YES`
- trust status: `trusted`
- result: submitted and confirmed
- Base TX: `0x8234019d5a4506a6a53bc32c46d6088936542b127aaa7f9e127a8484d77d3dcc`
- block: `43644510`

### Case 4 — Decision approved + trust fail
- registered but untrusted agent: `0x1886ec8F936927c0a7E9296d8beB22d6f25C3ee1`
- mode: `decision`
- visible response: `YES`
- trust score: `0`
- trust status: `low_trust`
- result: `do_not_submit`
- no transaction submitted

**Critical result:**
Case 4 proved the full trust system works as intended.

The agent identity was ERC-8004 registered.  
The Venice execution was valid.  
The model decision was `YES`.  
But the action was still blocked because the acting identity lacked sufficient reputation history.

This is the strongest current expression of the OnlyAgent design:

- private cognition via Venice
- execution provenance verified onchain
- deterministic decision policy at the agent layer
- trust-gated submission using ERC-8004-linked reputation

**Canonical log artifacts (Session 11):**
- `logs/demo-case1-execution.json`
- `logs/demo-case2-decision-deny.json`
- `logs/demo-case3-trust-pass.json`
- `logs/demo-case4-trust-fail.json`

These files are the canonical raw receipts for hackathon submission.
