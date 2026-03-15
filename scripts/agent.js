import { ethers } from "ethers";
import { execSync } from "child_process";
import "dotenv/config";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const VENICE_MODEL    = "qwen3-235b-a22b-thinking-2507"; // → tee- prefix when Venice TEE ships
const VENICE_URL      = "https://api.venice.ai/api/v1/chat/completions";

// ── AGENT ADDRESS (no private key needed — Bankr handles signing) ─────────────
const agentAddress = process.env.AGENT_ADDRESS;
const teeSigner    = new ethers.Wallet(process.env.TEE_SIGNER_PRIVATE_KEY);

async function resolveAgentENS(address) {
  try {
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const name = await provider.lookupAddress(address);
    return name || address;
  } catch {
    return address;
  }
}

// ── CONTRACT ABI ──────────────────────────────────────────────────────────────
const ABI = [
  "function prove(bytes32 promptHash, bytes32 responseHash, uint256 timestamp, bytes memory teeSignature) external returns (string memory)"
];
const iface = new ethers.Interface(ABI);

// ── VENICE CALL ───────────────────────────────────────────────────────────────
async function callVenice(prompt) {
  const res = await fetch(VENICE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.VENICE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [{ role: "user", content: prompt }],
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: false
      }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Venice error: ${JSON.stringify(data.error)}`);
  return {
    response: data.choices[0].message.content,
    reasoning: data.choices[0].message.reasoning_content,
    requestId: data.id
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!agentAddress) {
    console.error("❌ AGENT_ADDRESS not set — set it to your Bankr EVM address");
    process.exit(1);
  }

  const prompt = process.argv[2] || "Should I execute this onchain transaction? Reason carefully.";

  console.log("═══════════════════════════════════════");
  console.log("  OnlyAgent — Proving AI Reasoning");
  console.log("═══════════════════════════════════════");
  const agentENS = await resolveAgentENS(agentAddress);
  console.log("Agent:        ", agentENS === agentAddress ? agentAddress : `${agentENS} (${agentAddress})`);
  console.log("TEE signer:   ", teeSigner.address);
  console.log("Contract:     ", process.env.ONLY_AGENT_ADDRESS);
  console.log("Model:        ", VENICE_MODEL);
  console.log("Prompt:       ", prompt);

  // 1. Call Venice
  console.log("\n[1/5] Calling Venice...");
  const { response, reasoning, requestId } = await callVenice(prompt);
  console.log("Request ID:", requestId);
  console.log("Response:", response.slice(0, 100) + "...");
  if (reasoning) console.log("Reasoning:", reasoning.slice(0, 100) + "...");

  // 2. Hash prompt + response
  console.log("\n[2/5] Hashing prompt + response...");
  const promptHash   = ethers.keccak256(ethers.toUtf8Bytes(prompt));
  const responseHash = ethers.keccak256(ethers.toUtf8Bytes(response));
  const timestamp    = Math.floor(Date.now() / 1000);
  console.log("Prompt hash:  ", promptHash);
  console.log("Response hash:", responseHash);
  console.log("Timestamp:    ", timestamp);

  // 3. Build commitment
  console.log("\n[3/5] Building commitment hash...");
  const commitment = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32", "address", "address", "uint256"],
    [promptHash, responseHash, agentAddress, process.env.ONLY_AGENT_ADDRESS, timestamp]
  );
  console.log("Commitment:", commitment);

  // 4. TEE signer signs commitment
  console.log("\n[4/5] TEE signing commitment...");
  const teeSignature = await teeSigner.signMessage(ethers.getBytes(commitment));
  console.log("TEE Signature:", teeSignature);

  // 5. Encode calldata and submit via Bankr
  console.log("\n[5/5] Submitting via Bankr...");
  const calldata = iface.encodeFunctionData("prove", [promptHash, responseHash, timestamp, teeSignature]);
  const bankrCmd = `bankr prompt "Submit this transaction on base: {\\"to\\": \\"${process.env.ONLY_AGENT_ADDRESS}\\", \\"data\\": \\"${calldata}\\", \\"value\\": \\"0\\", \\"chainId\\": 8453}"`;
  const result = execSync(bankrCmd).toString();
  console.log(result);
  console.log("\n👾 Proof: this agent genuinely reasoned before acting.");
}

main().catch(console.error);
