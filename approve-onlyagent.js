import { ethers } from "ethers";
import "dotenv/config";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ONLYAGENT_CONTRACT = "0x0485c9867a3Ecac90380C335347eaF5791A0A776";
const TERRICLAW = "0x0457b3ded2ba9e56520b21735f4324f6533f93ff";
const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const REGISTRY_ABI = [
    "function setApprovalForAll(address operator, bool approved) external"
];

async function approve() {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const privKey = process.env.PRIVATE_KEY;
    const signer = new ethers.Wallet(privKey, provider);
    
    console.log("📝 Approving OnlyAgent as operator on ERC-8004");
    console.log("═".repeat(60));
    console.log("Registry:", IDENTITY_REGISTRY);
    console.log("Operator (OnlyAgent):", ONLYAGENT_CONTRACT);
    console.log("Agent (TerriClaw):", TERRICLAW);
    console.log("Signer:", signer.address);
    
    const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, signer);
    
    console.log("\n⏳ Submitting setApprovalForAll...");
    const tx = await registry.setApprovalForAll(ONLYAGENT_CONTRACT, true);
    console.log("TX Hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
}

approve().catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
});
