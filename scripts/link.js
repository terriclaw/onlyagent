import { ethers } from "ethers";
import "dotenv/config";

const REP_ADDRESS = "0xB5e35148d21C630faafB10eBF20AE455635B3aE1";
const ONLYAGENT_ADDRESS = "0xED7d4E118f04335E3b2d9105FE1D8F83DD464C0D";
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
