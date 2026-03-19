import { ethers } from "ethers";
import { execSync } from "child_process";
import "dotenv/config";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const VENICE_MODEL = "e2ee-qwen-2-5-7b-p";
const VENICE_BASE  = "https://api.venice.ai/api/v1";

const agentAddress = process.env.AGENT_ADDRESS;

// ── CONTRACT ABI ──────────────────────────────────────────────────────────────
const ABI = [
  "function prove(bytes32 promptHash, bytes32 responseHash, uint256 timestamp, bytes memory teeSignature) external returns (string memory)"
];
const iface = new ethers.Interface(ABI);

// ── ENS ───────────────────────────────────────────────────────────────────────
async function resolveAgentENS(address) {
  try {
    const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
    const name = await provider.lookupAddress(address);
    return name || address;
  } catch { return address; }
}

// ── VENICE ────────────────────────────────────────────────────────────────────
function authHeaders() {
  return { "Authorization": `Bearer ${process.env.VENICE_API_KEY}`, "Content-Type": "application/json" };
}

async function callVenice(prompt) {
  const res = await fetch(`${VENICE_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [{ role: "user", content: prompt }],
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: false }
    })
  });
  const teeConfirmed = res.headers.get("x-venice-tee") === "true";
  const teeProvider  = res.headers.get("x-venice-tee-provider");
  const data = await res.json();
  if (data.error) throw new Error(`Venice error: ${JSON.stringify(data.error)}`);
  return {
    response:  data.choices[0].message.content,
    reasoning: data.choices[0].message.reasoning_content,
    requestId: data.id,
    teeConfirmed, teeProvider
  };
}

async function fetchAttestation() {
  const res = await fetch(`${VENICE_BASE}/tee/attestation?model=${VENICE_MODEL}`, { headers: authHeaders() });
  const data = await res.json();
  if (!data.signing_address) throw new Error(`Attestation failed: ${JSON.stringify(data)}`);
  return data;
}

async function fetchSignature(requestId) {
  const res = await fetch(`${VENICE_BASE}/tee/signature?model=${VENICE_MODEL}&request_id=${requestId}`, { headers: authHeaders() });
  const data = await res.json();
  if (!data.signature) throw new Error(`Signature fetch failed: ${JSON.stringify(data)}`);
  return data;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!agentAddress) { console.error("❌ AGENT_ADDRESS not set"); process.exit(1); }

  const prompt = process.argv[2] || "Should I execute this onchain transaction? Assess the request and decide.";

  console.log("═══════════════════════════════════════");
  console.log("  OnlyAgent — Proving AI Execution");
  console.log("═══════════════════════════════════════");
  const agentENS = await resolveAgentENS(agentAddress);
  console.log("Agent:    ", agentENS === agentAddress ? agentAddress : `${agentENS} (${agentAddress})`);
  console.log("Contract: ", process.env.ONLY_AGENT_ADDRESS);
  console.log("Model:    ", VENICE_MODEL);
  console.log("Prompt:   ", prompt);

  // 1. Venice completion
  console.log("\n[1/6] Calling Venice (e2ee TEE model)...");
  const { response, reasoning, requestId, teeConfirmed, teeProvider } = await callVenice(prompt);
  console.log("Request ID:   ", requestId);
  console.log("TEE confirmed:", teeConfirmed, teeProvider ? `(${teeProvider})` : "");
  console.log("Response:     ", response.slice(0, 120) + "...");
  if (reasoning) console.log("Reasoning:    ", reasoning.slice(0, 80) + "...");

  // 2. Attestation
  console.log("\n[2/6] Fetching Venice TEE attestation...");
  const attestation = await fetchAttestation();
  console.log("Signer:       ", attestation.signing_address);
  console.log("Hardware:     ", attestation.tee_hardware);
  console.log("Verified:     ", attestation.verified);

  // 3. Per-request signature
  console.log("\n[3/6] Fetching Venice request signature...");
  const sigPayload = await fetchSignature(requestId);
  console.log("Signed text:  ", sigPayload.text);

  // 4. Verify locally
  console.log("\n[4/6] Verifying Venice signature...");
  const recovered = ethers.verifyMessage(sigPayload.text, sigPayload.signature);
  if (recovered.toLowerCase() !== attestation.signing_address.toLowerCase()) {
    throw new Error(`Signer mismatch: recovered ${recovered}, attested ${attestation.signing_address}`);
  }
  console.log("✓ Signature verified:", recovered);

  // Extract hashes from Venice's signed text
  const [promptHashRaw, responseHashRaw] = sigPayload.text.split(":");
  const promptHash = `0x${promptHashRaw.replace(/^0x/, "")}`;
  const responseHash = `0x${responseHashRaw.replace(/^0x/, "")}`;
  console.log("Prompt hash:  ", promptHash);
  console.log("Response hash:", responseHash);

  // Sanity check: confirm Solidity will reconstruct the same text
  // Check if Venice text matches what _hexStringNoPrefix will produce in Solidity (no 0x, lowercase)
  const ph = promptHash.slice(2).toLowerCase();
  const rh = responseHash.slice(2).toLowerCase();
  const reconstructed = `${ph}:${rh}`;
  console.log("Venice text:    ", sigPayload.text);
  console.log("No-prefix recon:", reconstructed);
  console.log("Contract match: ", reconstructed === sigPayload.text ? "✓ _hexStringNoPrefix will verify" : "⚠ MISMATCH — Venice uses 0x prefix, swap to Strings.toHexString in contract");

  // 5. Timestamp
  console.log("\n[5/6] Preparing transaction...");
  const timestamp = Math.floor(Date.now() / 1000);
  console.log("Timestamp:    ", timestamp);

  // 6. Submit via Bankr — Venice signature goes straight to contract
  console.log("\n[6/6] Submitting via Bankr...");
  const calldata = iface.encodeFunctionData("prove", [promptHash, responseHash, timestamp, sigPayload.signature]);
  const bankrCmd = `bankr prompt "Submit this transaction on base: {\\"to\\": \\"${process.env.ONLY_AGENT_ADDRESS}\\", \\"data\\": \\"${calldata}\\", \\"value\\": \\"0\\", \\"chainId\\": 8453}"`;
  const result = execSync(bankrCmd).toString();
  console.log(result);

  console.log("\n👾 Venice TEE attested execution verified directly onchain. No adapter signer.");
}

main().catch((err) => {
  console.error("\n❌", err?.message || err);
  process.exit(1);
});
