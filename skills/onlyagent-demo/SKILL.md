---
name: onlyagent-demo
description: Use to prove Venice TEE execution onchain and enforce AI decision-gated execution via OnlyAgent. The agent performs private inference, verifies the Venice TEE signature, builds a transaction payload, and submits it using the harness wallet on Base.
metadata: {"openclaw": {"emoji": "🤖"}}
---

# ONLYAGENT — Verifiable AI execution + decision gating onchain

You are executing an onchain action backed by a **Venice TEE execution proof**.

This produces a real transaction on Base.

---

## Demo modes

This skill supports two modes:

### 1. Execution Proof (`prove`)
- Verifies that a Venice TEE-backed inference occurred
- Any valid Venice-signed response is accepted
- Demonstrates execution provenance

### 2. Decision-Gated Execution (`proveApproved`)
- Requires the model to return exactly `YES`
- Enforces AI authorization onchain
- Demonstrates AI-controlled execution

---

## What this does

- Calls a Venice `e2ee-*` model (TEE-backed, no data retention)
- Fetches attestation and per-request signature
- Verifies `personal_sign(promptHash:responseHash)`
- Builds a transaction payload for OnlyAgent on Base
- The harness submits the payload using its own wallet
- Only succeeds if all onchain checks pass

---

## Run the demo

If AGENT_ADDRESS is not set, ask the user for their agent wallet address.

Execution Proof mode:
cd ~/onlyagent && AGENT_ADDRESS=<agent-address> node scripts/agent.js

Decision-Gated mode:
cd ~/onlyagent && ONLYAGENT_MODE=proveApproved AGENT_ADDRESS=<agent-address> node scripts/agent.js

Immediately submit the returned `tx` payload with the harness wallet.

Do not wait. The proof expires after 2 minutes.

---

## Decision policy (proveApproved)

The agent must evaluate a policy and respond with exactly:

YES
or
NO

Constraints:
- Output must be exactly `YES` or `NO`
- No punctuation
- No explanation
- Uppercase only

Onchain enforcement:
- `responseHash == keccak256("YES")` → success
- otherwise → revert (`OnlyAgent: decision denied`)

---

## Optional: Denied case

To demonstrate rejection:
- modify one condition in the prompt (for example, use the wrong contract address)
- the model should return `NO` (any response other than `YES` will revert onchain)
- the transaction should revert

---

## Expected result

You must report:
- Venice model used (e.g. `e2ee-qwen-2-5-7b-p`)
- TEE verification status and signer address
- Prompt hash and response hash
- Transaction hash (BaseScan link)
- Whether the execution was:
  - execution proof (`prove`)
  - decision approved (`proveApproved`)
  - decision denied (reverted)

---

## Important constraints

- Venice signs `promptHash:responseHash` using `personal_sign`
- The contract verifies this signature directly onchain
- The proof must be submitted within 2 minutes
- Replay protection is enforced
- Agent identity is verified via ERC-8004

---

## Why this matters

OnlyAgent enforces that an onchain action was backed by a Venice TEE execution.

In decision-gated mode, it additionally enforces that the model explicitly approved the action.

This creates:
- execution provenance (`prove`)
- AI authorization (`proveApproved`)

---

## Mental model

Venice provides **private cognition**.

OnlyAgent enforces:
- that cognition occurred
- and optionally that cognition **approved the action**

This creates a bridge between AI decisions and onchain execution.
