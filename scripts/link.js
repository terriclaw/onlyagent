import { ethers } from "ethers";
import "dotenv/config";

const REP_ADDRESS = "0x92d48F5375a86484706549C9fD71Ac3C62E98eb9";
const ONLYAGENT_ADDRESS = "0x2367Ea8321bC461AAa3C156D92C4cAd73f89F4c5";
const ABI = ["function addAgentGatedContract(address _agentGated) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const rep = new ethers.Contract(REP_ADDRESS, ABI, deployer);
  console.log("Linking...");
  const tx = await rep.addAgentGatedContract(ONLYAGENT_ADDRESS);
  await tx.wait();
  console.log("Linked! TX:", tx.hash);
}

main().catch(console.error);
