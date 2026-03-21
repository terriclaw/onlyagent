---
name: onlyagent-demo
description: Use to prove Venice TEE execution onchain and enforce AI decision-gated execution at the agent layer via OnlyAgent. The agent performs private inference, verifies the Venice TEE signature, builds a transaction payload, and submits it using the harness wallet on Base.
metadata: {"openclaw": {"emoji": "🤖"}}
---

# ONLYAGENT — Verifiable AI execution onchain

You are executing an onchain action backed by a **Venice TEE execution proof**.

This produces a real transaction on Base.

---

## Demo modes

This skill supports two modes:

### 1. Execution Proof (`prove`)
- Verifies that a Venice TEE-backed inference occurred
- Any valid Venice-signed response is accepted
- Demonstrates execution provenance onchain

### 2. Decision-Gated Execution (`decision`)
- Requires the visible model output to be exactly `YES`
- Enforces AI authorization at the agent layer
- Submits `prove()` onchain only when the visible decision is approved

---

## What this does

- Calls a Venice `e2ee-*` model (TEE-backed, no data retention)
- Fetches attestation and per-request signature
- Verifies `personal_sign(promptHash:responseHash)`
- Logs the visible plaintext response and decision outcome
- Builds a transaction payload for OnlyAgent on Base
- The harness submits the payload using its own wallet
- Only succeeds if all onchain checks pass

---

## Run the demo

If AGENT_ADDRESS is not set, ask the user for their agent wallet address.

Execution Proof mode:
cd ~/onlyagent && AGENT_ADDRESS=<agent-address> node scripts/agent.js

Decision mode:
cd ~/onlyagent && ONLYAGENT_MODE=decision AGENT_ADDRESS=<agent-address> node scripts/agent.js

Immediate submission is required only when the script returns a non-null `tx` payload.

If decision mode returns `submissionRecommendation = do_not_submit`, skip submission and report the denied outcome.

---

## Decision policy (decision mode)

The agent must evaluate a policy and respond with exactly:

YES
or
NO

Constraints:
- Output must be exactly `YES` or `NO`
- No punctuation
- No explanation
- Uppercase only

Agent-layer enforcement:
- visible response `YES` → submit `prove()`
- any other visible response → do not submit

Onchain enforcement:
- the contract still verifies Venice TEE execution provenance via `prove()`

---

## Full demo test sequence

For a full demo run, execute these three cases in order:

1. **Execution Proof baseline**
   - run default mode
   - submit if a `tx` payload is returned
   - report transaction result

2. **Decision mode — approved case**
   - run `ONLYAGENT_MODE=decision`
   - use a prompt that should produce visible response `YES`
   - submit only if `submissionRecommendation` is `submit`
   - report visible response, decision result, and transaction result

3. **Decision mode — denied case**
   - run `ONLYAGENT_MODE=decision`
   - use a prompt that should produce visible response other than `YES`
   - if `submissionRecommendation` is `do_not_submit`, do not submit
   - report visible response and denied outcome

For all three cases:
- log prompt
- log visible response
- log prompt hash and response hash
- log whether submission occurred
- log transaction hash if submitted

---

## Expected result

You must report:
- Venice model used (e.g. `e2ee-qwen-2-5-7b-p`)
- TEE verification status and signer address
- Prompt hash and response hash
- Visible response text
- Whether the decision was approved at the agent layer
- Transaction hash (BaseScan link) if submitted

---

## Important constraints

- Venice signs `promptHash:responseHash` using `personal_sign`
- The contract verifies this signature directly onchain
- The proof must be submitted within 2 minutes
- Replay protection is enforced
- Agent identity is verified via ERC-8004
- Venice `responseHash` is provider-defined and is not assumed to equal `keccak256(visible response text)`

---

## Why this matters

OnlyAgent enforces that an onchain action was backed by a Venice TEE execution.

In decision mode, the agent additionally enforces a deterministic visible-output policy before submission.

This creates:
- execution provenance onchain
- decision gating at the agent layer

---

## Mental model

Venice provides **private cognition**.

OnlyAgent proves that cognition occurred onchain.

The agent can then apply a deterministic policy to the visible plaintext response before deciding whether to submit the onchain action.
