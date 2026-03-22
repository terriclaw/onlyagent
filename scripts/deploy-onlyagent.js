import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Deploying OnlyAgent with:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const reputationAddress = process.env.AGENT_REPUTATION_ADDRESS;
  const validationRegistryAddress = process.env.VALIDATION_REGISTRY_ADDRESS;

  if (!reputationAddress) {
    throw new Error("Missing AGENT_REPUTATION_ADDRESS in .env");
  }
  if (!validationRegistryAddress) {
    throw new Error("Missing VALIDATION_REGISTRY_ADDRESS in .env");
  }

  // Deploy OnlyAgent
  console.log("\nDeploying OnlyAgent...");
  const onlyArtifact = await hre.artifacts.readArtifact("OnlyAgent");
  const OnlyAgent = new ethers.ContractFactory(
    onlyArtifact.abi,
    onlyArtifact.bytecode,
    deployer
  );

  const onlyAgent = await OnlyAgent.deploy(
    process.env.ERC8004_IDENTITY_REGISTRY,
    reputationAddress,
    validationRegistryAddress,
    [process.env.TEE_SIGNER_ADDRESS]
  );

  await onlyAgent.waitForDeployment();
  const onlyAgentAddress = await onlyAgent.getAddress();
  console.log("OnlyAgent deployed to:", onlyAgentAddress);

  // Link to existing reputation
  console.log("\nLinking to existing AgentReputation...");
  const repArtifact = await hre.artifacts.readArtifact("AgentReputation");
  const rep = new ethers.Contract(reputationAddress, repArtifact.abi, deployer);

  const tx = await rep.addAgentGatedContract(onlyAgentAddress);
  await tx.wait();
  console.log("Linked!");

  console.log("\n--- DONE ---");
  console.log("ONLY_AGENT_ADDRESS=" + onlyAgentAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
