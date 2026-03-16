import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Deploying with:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // 1. Deploy AgentReputation
  console.log("\nDeploying AgentReputation...");
  const repArtifact = await hre.artifacts.readArtifact("AgentReputation");
  const AgentReputation = new ethers.ContractFactory(repArtifact.abi, repArtifact.bytecode, deployer);
  const reputation = await AgentReputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("AgentReputation deployed to:", reputationAddress);

  // 2. Deploy OnlyAgent
  console.log("\nDeploying OnlyAgent...");
  const onlyArtifact = await hre.artifacts.readArtifact("OnlyAgent");
  const OnlyAgent = new ethers.ContractFactory(onlyArtifact.abi, onlyArtifact.bytecode, deployer);
  const onlyAgent = await OnlyAgent.deploy(
    process.env.ERC8004_IDENTITY_REGISTRY,
    reputationAddress,
    [process.env.TEE_SIGNER_ADDRESS]
  );
  await onlyAgent.waitForDeployment();
  const onlyAgentAddress = await onlyAgent.getAddress();
  console.log("OnlyAgent deployed to:", onlyAgentAddress);

  // 3. Link AgentReputation to OnlyAgent
  console.log("\nLinking contracts...");
  const rep = new ethers.Contract(reputationAddress, repArtifact.abi, deployer);
  await rep.addAgentGatedContract(onlyAgentAddress);
  console.log("Linked!");

  console.log("\n--- DEPLOYMENT COMPLETE ---");
  console.log("AgentReputation:", reputationAddress);
  console.log("OnlyAgent:", onlyAgentAddress);
  console.log("\nAdd to .env:");
  console.log("AGENT_REPUTATION_ADDRESS=" + reputationAddress);
  console.log("ONLY_AGENT_ADDRESS=" + onlyAgentAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
