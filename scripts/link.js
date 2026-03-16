import { ethers } from "ethers";
import "dotenv/config";

const REP_ADDRESS = "0x7e765A6c3581e008fF91c0c7240c474b11E912a0";
const ONLYAGENT_ADDRESS = "0xa592d5605Cb5a03CF8cf1f80d7848e98939B6258";
const ABI = ["function setAgentGatedContract(address _agentGated) external"];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const rep = new ethers.Contract(REP_ADDRESS, ABI, deployer);
  console.log("Linking...");
  const tx = await rep.setAgentGatedContract(ONLYAGENT_ADDRESS);
  await tx.wait();
  console.log("Linked! TX:", tx.hash);
}

main().catch(console.error);
