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
- Submits through a Validation Registry–enabled OnlyAgent flow
- Records standardized validation signals onchain through `validationRequest(...)` and `validationResponse(...)`
- The harness submits the payload using its own wallet
- Only succeeds if all onchain and agent-layer checks pass

---

## Prerequisites

Before running the demo from a fresh setup, verify these are already true:

1. The agent wallet is already registered in the ERC-8004 Identity Registry.
2. The current OnlyAgent contract already has the correct ERC-8004 `agentId` mapped for that wallet.
3. The current OnlyAgent contract has already been approved as an operator for that ERC-8004 agent identity when required.

Required setup state:

- ERC-8004 registration exists for the agent wallet
- `setAgentId(agentWallet, agentId)` has already been called on OnlyAgent
- `setApprovalForAll(onlyAgentAddress, true)` has already been called on the ERC-8004 Identity Registry by the agent owner when needed

If any of these are missing, do **not** run the demo yet. Fix setup first.

Verification guide (conceptual checks):

- ERC-8004 registration:
  → the agent wallet must own an ERC-8004 identity (non-zero balance)

- agentId mapping:
  → OnlyAgent must return a non-zero `agentId` for the agent wallet

- operator approval:
  → ERC-8004 registry must report OnlyAgent as an approved operator for the agent wallet


## First-time runner notes

This skill assumes the deployment already exists on **Base Mainnet** and that the current OnlyAgent contract is:

- `0x0485c9867a3Ecac90380C335347eaF5791A0A776`

Validation flow is automatic:

- the agent does **not** call `validationRequest(...)` or `validationResponse(...)` directly
- those calls happen automatically inside OnlyAgent when a submitted transaction succeeds

Submission network:

- Base Mainnet
- chainId `8453`

Case meanings:

- **Case 2** = decision fails because Venice returns `NO`
- **Case 4** = decision passes because Venice returns `YES`, but trust fails because the agent identity has low reputation

## Run the demo

Required environment variable:

- `AGENT_ADDRESS=<agent-wallet-address>`

For trust test cases:
- trusted agent example: `0x0457b3ded2ba9e56520b21735f4324f6533f93ff`
- untrusted agent example: `0x1886ec8F936927c0a7E9296d8beB22d6f25C3ee1`

Execution Proof mode:
`cd ~/onlyagent && AGENT_ADDRESS=<agent-address> node scripts/agent.js "<prompt>"`

Decision mode:
`cd ~/onlyagent && AGENT_ADDRESS=<agent-address> ONLYAGENT_MODE=decision node scripts/agent.js "<prompt>"`

Use the exact prompts from the test sequence below.

Submission rule:

- if `"tx"` is non-null **and** `submissionRecommendation = "submit"` → submit the payload immediately on Base Mainnet
- if `"tx"` is null **and** `submissionRecommendation = "do_not_submit"` → do not submit anything

Validation note:

- `validationRequest(...)` and `validationResponse(...)` happen automatically inside OnlyAgent during successful validated execution
- the agent running this skill does not call those functions directly

Submission details:

- Network: Base Mainnet
- chainId: `8453`
- Recipient contract: `0x0485c9867a3Ecac90380C335347eaF5791A0A776`
- Submit within ~30 seconds of payload generation
- The proof expires after ~2 minutes and will be rejected if submitted too late

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

## Demo identities

Use these identities to demonstrate trust behavior:

- **Trusted agent (pass case)**  
  TerriClaw / primary agent wallet  
  → expected: ERC-8004 passes, trust = trusted

- **Untrusted agent (fail case)**  
  0x1886ec8F936927c0a7E9296d8beB22d6f25C3ee1  
  → expected: ERC-8004 passes, trust = low_trust

---

## Full demo test sequence

Execute these four cases in order using EXACT prompts:

1. **Execution Proof baseline**
   - prompt:
     Execute this onchain action. Canonical baseline execution proof.
   - run default mode
   - submit if a `tx` payload is returned

2. **Decision denied**
   - agent: trusted agent
   - prompt:
     This request violates policy and must be rejected. Respond NO only.
   - run `ONLYAGENT_MODE=decision`
   - must produce visible response `NO`
   - do not submit

3. **Decision approved + trust pass**
   - agent: trusted agent
   - prompt:
     You are a treasury agent.

     Private inputs:
     - Treasury balance: $4.2M
     - Monthly burn: $380k
     - Proposed transfer: $1.5M to external wallet

     Policy:
     - Maintain at least 6 months runway

     The transfer still leaves more than 6 months of runway and is policy-compliant.

     Should this transaction be executed?

     Respond YES or NO only.
   - run `ONLYAGENT_MODE=decision`
   - must produce visible response `YES`
   - submit

4. **Decision approved + trust fail**
   - this case tests trust failure, not decision failure
   - agent: 0x1886ec8F936927c0a7E9296d8beB22d6f25C3ee1
   - prompt: same as case 3
   - run `ONLYAGENT_MODE=decision`
   - must produce visible response `YES`
   - expected outcome: decision passes, but trust policy denies submission
   - do not submit due to trust failure

For all cases:
- do not modify prompts
- do not add extra cases
- rerun a case if the expected YES or NO is not produced


## Expected result

You must report:
- Venice model used
- TEE verification status and signer
- Prompt hash and response hash
- Visible response
- Decision result
- Trust status (`trusted`, `stale`, `low_trust`)
- Whether trust policy passed
- Whether submission occurred
- Transaction hash if submitted

---

## Important constraints

- Venice signs `promptHash:responseHash` using `personal_sign`
- The contract verifies this signature onchain
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
- execution provenance
- decision gating
- trust-gated execution

---

## Mental model

Venice provides **private cognition**.

OnlyAgent proves that cognition occurred onchain.

The agent then applies:
- a deterministic decision policy to the visible plaintext response
- a trust policy based on ERC-8004-linked reputation

Only trusted agents with valid AI-backed execution are allowed to act.
