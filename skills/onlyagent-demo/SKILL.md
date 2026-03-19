---
name: onlyagent-demo
description: Use to prove Venice TEE execution onchain via OnlyAgent. The agent performs private inference, verifies the Venice TEE signature, and executes a gated transaction on Base.
metadata: {"openclaw": {"emoji": "🤖"}}
---

# ONLYAGENT — Verifiable AI execution onchain

You are executing an onchain action that must be backed by a **Venice TEE execution proof**.

This is not a simulation. The output must result in a real transaction on Base.

---

## What this does

- Calls a Venice `e2ee-*` model (TEE-backed, no data retention)
- Fetches attestation and per-request signature
- Verifies `personal_sign(promptHash:responseHash)`
- Submits a transaction to OnlyAgent on Base
- Only succeeds if the Venice TEE signer is trusted onchain

---

## Run the demo

If AGENT_ADDRESS is not set, ask the user for their Bankr EVM address.

Execute:

cd ~/onlyagent && AGENT_ADDRESS=<bankr-address> node scripts/agent.js "<prompt>"

---

## Expected result

You must report:

- Venice model used (e.g. `e2ee-qwen-2-5-7b-p`)
- TEE verification status and signer address
- Prompt hash and response hash
- Transaction hash (BaseScan link)

---

## Important constraints

- Venice signs `promptHash:responseHash` using `personal_sign`
- The contract verifies this signature directly onchain
- No valid TEE signature → transaction fails
- This is enforced by the `onlyAgent` modifier

---

## Mental model

Venice provides **private cognition**.

OnlyAgent enforces that cognition as a **condition for onchain execution**.

