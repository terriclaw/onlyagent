---
name: onlyagent-demo
description: Use to prove Venice TEE execution onchain and enforce AI decision-gated and trust-gated execution at the agent layer via OnlyAgent using ERC-8004 reputation.
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
- Enforces trust-gated execution using ERC-8004-linked reputation
- Submits `prove()` onchain only when both decision and trust checks pass

---

## What this does

- Calls a Venice `e2ee-*` model (TEE-backed, no data retention)
- Fetches attestation and per-request signature
- Verifies `personal_sign(promptHash:responseHash)`
- Logs the visible plaintext response and decision outcome
- Evaluates ERC-8004-linked reputation (score, recency, contract diversity)
- Builds a transaction payload for OnlyAgent on Base
- The harness submits the payload using its own wallet
- Only succeeds if all onchain and agent-layer checks pass

---

## Run the demo

If AGENT_ADDRESS is not set, ask the user for their agent wallet address.

Execution Proof mode:
cd ~/onlyagent && AGENT_ADDRESS=<agent-address> node scripts/agent.js

Decision mode:
cd ~/onlyagent && ONLYAGENT_MODE=decision AGENT_ADDRESS=<agent-address> node scripts/agent.js

Immediate submission is required only when the script returns a non-null `tx` payload.

If `submissionRecommendation = do_not_submit`, skip submission and report the denied outcome.

---

## Decision policy

The agent must evaluate a policy and respond with exactly:

YES
or
NO

Constraints:
- Output must be exactly `YES` or `NO`
- No punctuation
- No explanation
- Uppercase only

Decision enforcement:
- visible response `YES` → decision passes
- any other visible response → decision fails

---

## Trust policy (ERC-8004)

Before submitting any transaction, the agent must evaluate the trustworthiness of the agent identity using ERC-8004-linked reputation.

Trust conditions:
- score ≥ 1
- uniqueContracts ≥ 1
- lastActionAt within 10 days

Trust enforcement:
- trust conditions met → trust passes
- trust conditions not met → trust fails

Submission rule:
- decision = YES AND trust = valid → submit
- decision = NO → do not submit
- trust = invalid → do not submit

---

## Full demo test sequence

Execute these four cases in order:

1. **Execution Proof baseline**
   - run default mode
   - submit if a `tx` payload is returned
   - report transaction result

2. **Decision denied**
   - run `ONLYAGENT_MODE=decision`
   - use a prompt that should produce visible response other than `YES`
   - trust is not the reason for denial
   - do not submit
   - report visible response and denied outcome

3. **Decision approved + trust pass**
   - run `ONLYAGENT_MODE=decision`
   - use a prompt that should produce visible response `YES`
   - use an agent identity that satisfies trust policy
   - submit only if `submissionRecommendation` is `submit`
   - report visible response, trust status, decision result, and transaction result

4. **Decision approved + trust fail**
   - run `ONLYAGENT_MODE=decision`
   - use a prompt that should produce visible response `YES`
   - use an agent identity with low or stale reputation
   - if `submissionRecommendation` is `do_not_submit`, do not submit
   - report visible response, trust failure, and denied outcome

For all four cases:
- log prompt
- log visible response
- log prompt hash and response hash
- log trust status
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
- Trust status (`trusted`, `stale`, or `low_trust`)
- Whether trust policy passed
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

OnlyAgent enforces that an onchain action:
- was backed by a Venice TEE execution
- was explicitly approved by the agent
- originates from a trusted agent identity with recent verifiable history

This creates:
- execution provenance onchain
- decision gating at the agent layer
- trust-gated execution using ERC-8004-linked reputation

---

## Mental model

Venice provides **private cognition**.

OnlyAgent proves that cognition occurred onchain.

The agent then applies:
- a deterministic decision policy to the visible plaintext response
- a trust policy based on ERC-8004-linked reputation

Only trusted agents with valid AI-backed execution are allowed to act.
