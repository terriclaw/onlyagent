import { ethers } from "ethers";
import "dotenv/config";

const REP_ADDRESS = "0xB5e35148d21C630faafB10eBF20AE455635B3aE1";
const ONLYAGENT_ADDRESS = "0x2248bb37821f8675B4de7786c8C5d1E15333E869";
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
