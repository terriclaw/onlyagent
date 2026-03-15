import { ethers } from "ethers";
import "dotenv/config";

const STATUS_RPC_URL = process.env.STATUS_SEPOLIA_RPC_URL || "https://public.sepolia.rpc.status.network";
const VENICE_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_MODEL = "qwen3-235b-a22b-thinking-2507";

const ABI = [
  "function prove(bytes32 promptHash, bytes32 responseHash, uint256 timestamp, bytes memory teeSignature) external returns (string memory)"
];

async function callVenice(prompt) {
  const res = await fetch(VENICE_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.VENICE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [{ role: "user", content: prompt }],
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: false }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Venice error: ${JSON.stringify(data.error)}`);
  return { response: data.choices[0].message.content, reasoning: data.choices[0].message.reasoning_content };
}

async function main() {
  if (!process.env.STATUS_ONLY_AGENT_ADDRESS) {
    console.error("STATUS_ONLY_AGENT_ADDRESS not set — run deploy-status.js first and add to .env");
    process.exit(1);
  }

  const provider    = new ethers.JsonRpcProvider(STATUS_RPC_URL);
  const agentWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const teeSigner   = new ethers.Wallet(process.env.TEE_SIGNER_PRIVATE_KEY);
  const network     = await provider.getNetwork();

  console.log("═══════════════════════════════════════");
  console.log("  OnlyAgent — Status Network Sepolia");
  console.log("═══════════════════════════════════════");
  console.log("Chain ID:    ", network.chainId.toString());
  console.log("Agent wallet:", agentWallet.address);
  console.log("Contract:    ", process.env.STATUS_ONLY_AGENT_ADDRESS);

  const prompt = "OnlyAgent: Should I execute a gasless prove() on Status Network Sepolia? Reason carefully about the significance of gasless AI agent execution onchain.";

  console.log("\n[1/5] Calling Venice...");
  const { response, reasoning } = await callVenice(prompt);
  console.log("Response:", response.slice(0, 100) + "...");
  if (reasoning) console.log("Reasoning:", reasoning.slice(0, 100) + "...");

  console.log("\n[2/5] Hashing...");
  const promptHash   = ethers.keccak256(ethers.toUtf8Bytes(prompt));
  const responseHash = ethers.keccak256(ethers.toUtf8Bytes(response));
  const timestamp    = Math.floor(Date.now() / 1000);
  console.log("Prompt hash:  ", promptHash);
  console.log("Response hash:", responseHash);
  console.log("Timestamp:    ", timestamp);

  console.log("\n[3/5] Building commitment...");
  const commitment = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32", "address", "address", "uint256"],
    [promptHash, responseHash, agentWallet.address, process.env.STATUS_ONLY_AGENT_ADDRESS, timestamp]
  );
  console.log("Commitment:", commitment);

  console.log("\n[4/5] TEE signing...");
  const teeSignature = await teeSigner.signMessage(ethers.getBytes(commitment));
  console.log("TEE Signature:", teeSignature);

  console.log("\n[5/5] Submitting gasless prove()...");
  const contract = new ethers.Contract(process.env.STATUS_ONLY_AGENT_ADDRESS, ABI, agentWallet);
  const tx = await contract.prove(promptHash, responseHash, timestamp, teeSignature, {
    gasPrice: 0,
    gasLimit: 500000
  });
  console.log("TX submitted:", tx.hash);
  const receipt = await tx.wait();

  console.log("\n═══════════════════════════════════════");
  console.log("  Gasless TX Confirmed ✓");
  console.log("═══════════════════════════════════════");
  console.log("TX Hash: ", tx.hash);
  console.log("Block:   ", receipt.blockNumber);
  console.log("Explorer: https://sepoliascan.status.network/tx/" + tx.hash);
  console.log("\n  ✓ Contract deployed on Status Sepolia");
  console.log("  ✓ 1 gasless prove() confirmed");
}

main().catch(console.error);
