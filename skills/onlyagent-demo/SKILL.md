---
name: onlyagent-demo
description: Use to prove Venice TEE execution onchain via OnlyAgent. The agent performs private inference, verifies the Venice TEE signature, builds a gated transaction payload, and submits it using the harness wallet on Base.
metadata: {"openclaw": {"emoji": "🤖"}}
---

# ONLYAGENT — Verifiable AI execution onchain

You are executing an onchain action that must be backed by a **Venice TEE execution proof**.

This executes a real transaction on Base.

---

## What this does

- Calls a Venice `e2ee-*` model (TEE-backed, no data retention)
- Fetches attestation and per-request signature
- Verifies `personal_sign(promptHash:responseHash)`
- Builds a transaction payload for OnlyAgent on Base
- The harness submits the payload using its own wallet
- Only succeeds if the Venice TEE signer is trusted onchain

---

## Run the demo

If AGENT_ADDRESS is not set, ask the user for their agent wallet address.

Execute:

cd ~/onlyagent && AGENT_ADDRESS=<agent-address> node scripts/agent.js "<prompt>"

Immediately submit the returned `tx` payload with the harness wallet.

Do not wait between payload generation and submission. The proof expires after 2 minutes.

---

## Expected result

You must report:

- Venice model used (e.g. `e2ee-qwen-2-5-7b-p`)
- TEE verification status and signer address
- Prompt hash and response hash
- Transaction hash (BaseScan link)
- Confirmation that submission occurred within the freshness window

---

## Important constraints

- Venice signs `promptHash:responseHash` using `personal_sign`
- The contract verifies this signature directly onchain
- No valid TEE signature → transaction fails
- The proof must be submitted within 2 minutes of payload generation
- This is enforced by the `onlyAgent` modifier

## Why this matters

OnlyAgent enforces that an onchain action was backed by a Venice TEE execution proof.

The contract verifies:

- the Venice TEE signer produced a valid signature
- the submitted `promptHash` and `responseHash` match the signed payload
- the caller is a registered ERC-8004 agent
- the proof is fresh within the allowed time window

This creates an execution gate between private inference and onchain action.

---

## Mental model

Venice provides **private cognition**.

OnlyAgent enforces that cognition as a **condition for onchain execution**.

