
import fs from "fs";

function writeRunLog(data) {
  const ts = Math.floor(Date.now() / 1000);
  const path = `logs/run-${ts}.json`;
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log("Log saved:", path);
}

import { ethers } from "ethers";
import "dotenv/config";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const VENICE_MODEL = "e2ee-qwen-2-5-7b-p";
const VENICE_BASE  = "https://api.venice.ai/api/v1";

const agentAddress = process.env.AGENT_ADDRESS;

// ── CONTRACT ABI ──────────────────────────────────────────────────────────────
const ABI = [
  "function prove(bytes32 promptHash, bytes32 responseHash, uint256 timestamp, bytes memory teeSignature) external returns (string memory)",
  "function proveApproved(bytes32 promptHash, bytes32 responseHash, uint256 timestamp, bytes memory teeSignature) external returns (string memory)"
];
const iface = new ethers.Interface(ABI);

const ONLYAGENT_MODE = process.env.ONLYAGENT_MODE || "prove";

function getDefaultPrompt() {
  if (ONLYAGENT_MODE === "proveApproved") {
    return `You are authorizing an onchain action.

Approve ONLY if ALL conditions are true:
- contract == ${process.env.ONLY_AGENT_ADDRESS}
- function == proveApproved()
- caller == ${agentAddress}
- purpose == verify Venice TEE execution onchain

Reply with exactly one word:
YES or NO

Rules:
- No punctuation
- No explanation
- Uppercase only
- Output must be exactly YES or NO`;
  }

  return "Should I execute this onchain transaction? Assess the request and decide.";
}

// ── ENS ───────────────────────────────────────────────────────────────────────
async function resolveAgentENS(address) {
  try {
    const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
    const name = await provider.lookupAddress(address);
    return name || address;
  } catch {
    return address;
  }
}

// ── VENICE ────────────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    "Authorization": `Bearer ${process.env.VENICE_API_KEY}`,
    "Content-Type": "application/json"
  };
}

async function callVenice(prompt) {
  const res = await fetch(`${VENICE_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [{ role: "user", content: prompt }],
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: false
      }
    })
  });

  const teeConfirmed = res.headers.get("x-venice-tee") === "true";
  const teeProvider  = res.headers.get("x-venice-tee-provider");
  const data = await res.json();

  if (data.error) throw new Error(`Venice error: ${JSON.stringify(data.error)}`);

  return {
    response: data.choices[0].message.content,
    reasoning: data.choices[0].message.reasoning_content,
    requestId: data.id,
    teeConfirmed,
    teeProvider
  };
}

async function fetchAttestation() {
  const res = await fetch(`${VENICE_BASE}/tee/attestation?model=${VENICE_MODEL}`, {
    headers: authHeaders()
  });
  const data = await res.json();
  if (!data.signing_address) throw new Error(`Attestation failed: ${JSON.stringify(data)}`);
  return data;
}

async function fetchSignature(requestId) {
  const res = await fetch(`${VENICE_BASE}/tee/signature?model=${VENICE_MODEL}&request_id=${requestId}`, {
    headers: authHeaders()
  });
  const data = await res.json();
  if (!data.signature) throw new Error(`Signature fetch failed: ${JSON.stringify(data)}`);
  return data;
}

// ── TX BUILDING ───────────────────────────────────────────────────────────────
function buildOnlyAgentTx({ promptHash, responseHash, timestamp, teeSignature }) {
  const fn = ONLYAGENT_MODE === "proveApproved" ? "proveApproved" : "prove";
  const calldata = iface.encodeFunctionData(fn, [
    promptHash,
    responseHash,
    timestamp,
    teeSignature
  ]);

  return {
    to: process.env.ONLY_AGENT_ADDRESS,
    data: calldata,
    value: "0",
    chainId: 8453
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!agentAddress) {
    console.error("❌ AGENT_ADDRESS not set");
    process.exit(1);
  }
  if (!process.env.ONLY_AGENT_ADDRESS) {
    console.error("❌ ONLY_AGENT_ADDRESS not set");
    process.exit(1);
  }

  const prompt =
    process.argv[2] || getDefaultPrompt();

  console.log("═══════════════════════════════════════");
  console.log("  OnlyAgent — Build TEE Proof Payload");
  console.log("═══════════════════════════════════════");
  const agentENS = await resolveAgentENS(agentAddress);
  console.log("Agent:    ", agentENS === agentAddress ? agentAddress : `${agentENS} (${agentAddress})`);
  console.log("Contract: ", process.env.ONLY_AGENT_ADDRESS);
  console.log("Model:    ", VENICE_MODEL);
  console.log("Mode:     ", ONLYAGENT_MODE);
  console.log("Prompt:   ", prompt);

  // 1. Venice completion
  console.log("\n[1/5] Calling Venice (e2ee TEE model)...");
  const { response, reasoning, requestId, teeConfirmed, teeProvider } = await callVenice(prompt);
  console.log("Request ID:   ", requestId);
  console.log("TEE confirmed:", teeConfirmed, teeProvider ? `(${teeProvider})` : "");
  console.log("Response:     ", response.slice(0, 120) + "...");
  if (reasoning) console.log("Reasoning:    ", reasoning.slice(0, 80) + "...");

  // 2. Attestation
  console.log("\n[2/5] Fetching Venice TEE attestation...");
  const attestation = await fetchAttestation();
  console.log("Signer:       ", attestation.signing_address);
  console.log("Hardware:     ", attestation.tee_hardware);
  console.log("Verified:     ", attestation.verified);

  // 3. Per-request signature
  console.log("\n[3/5] Fetching Venice request signature...");
  const sigPayload = await fetchSignature(requestId);
  console.log("Signed text:  ", sigPayload.text);

  // 4. Verify locally
  console.log("\n[4/5] Verifying Venice signature...");
  const recovered = ethers.verifyMessage(sigPayload.text, sigPayload.signature);
  if (recovered.toLowerCase() !== attestation.signing_address.toLowerCase()) {
    throw new Error(`Signer mismatch: recovered ${recovered}, attested ${attestation.signing_address}`);
  }
  console.log("✓ Signature verified:", recovered);

  const [promptHashRaw, responseHashRaw] = sigPayload.text.split(":");
  const promptHash = `0x${promptHashRaw.replace(/^0x/, "")}`;
  const responseHash = `0x${responseHashRaw.replace(/^0x/, "")}`;
  console.log("Prompt hash:  ", promptHash);
  console.log("Response hash:", responseHash);

  const ph = promptHash.slice(2).toLowerCase();
  const rh = responseHash.slice(2).toLowerCase();
  const reconstructed = `${ph}:${rh}`;
  console.log("Venice text:     ", sigPayload.text);
  console.log("No-prefix recon: ", reconstructed);
  console.log("Contract match:  ", reconstructed === sigPayload.text ? "✓ _hexStringNoPrefix will verify" : "⚠ mismatch");

  // 5. Build tx payload
  console.log("\n[5/5] Building transaction payload...");
  const timestamp = Math.floor(Date.now() / 1000);
  console.log("Timestamp:    ", timestamp);

  const tx = buildOnlyAgentTx({
    promptHash,
    responseHash,
    timestamp,
    teeSignature: sigPayload.signature
  });

  const output = {
    meta: {
      agentAddress,
      model: VENICE_MODEL,
      requestId,
      teeConfirmed,
      teeProvider,
      teeSigner: attestation.signing_address,
      teeHardware: attestation.tee_hardware,
      attestationVerified: attestation.verified,
      prompt,
      promptHash,
      responseHash,
      timestamp
    },
    tx
  };

  console.log("\nTX Payload JSON:");
  console.log(JSON.stringify(output, null, 2));

  // Save log
  writeRunLog(output);

  console.log("\n👾 Venice TEE execution proof built. Submit this payload with your harness wallet.");
}

main().catch((err) => {
  console.error("\n❌", err?.message || err);
  process.exit(1);
});
