import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

const STATUS_RPC_URL = process.env.STATUS_SEPOLIA_RPC_URL || "https://public.sepolia.rpc.status.network";

async function main() {
  const provider = new ethers.JsonRpcProvider(STATUS_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deploying with:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const gasOpts = { gasPrice: 0 };

  console.log("\nDeploying MockERC8004...");
  const mockArtifact = await hre.artifacts.readArtifact("MockERC8004");
  const MockERC8004 = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, deployer);
  const mockRegistry = await MockERC8004.deploy(gasOpts);
  await mockRegistry.waitForDeployment();
  const mockRegistryAddress = await mockRegistry.getAddress();
  console.log("MockERC8004:", mockRegistryAddress);

  console.log("\nDeploying AgentReputation...");
  const repArtifact = await hre.artifacts.readArtifact("AgentReputation");
  const AgentReputation = new ethers.ContractFactory(repArtifact.abi, repArtifact.bytecode, deployer);
  const reputation = await AgentReputation.deploy(gasOpts);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("AgentReputation:", reputationAddress);

  console.log("\nDeploying OnlyAgent...");
  const onlyArtifact = await hre.artifacts.readArtifact("OnlyAgent");
  const OnlyAgent = new ethers.ContractFactory(onlyArtifact.abi, onlyArtifact.bytecode, deployer);
  const onlyAgent = await OnlyAgent.deploy(
    mockRegistryAddress,
    reputationAddress,
    [process.env.TEE_SIGNER_ADDRESS],
    gasOpts
  );
  await onlyAgent.waitForDeployment();
  const onlyAgentAddress = await onlyAgent.getAddress();
  console.log("OnlyAgent:", onlyAgentAddress);

  console.log("\nLinking contracts...");
  const rep = new ethers.Contract(reputationAddress, repArtifact.abi, deployer);
  const linkTx = await rep.setAgentGatedContract(onlyAgentAddress, gasOpts);
  await linkTx.wait();
  console.log("Linked!");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("STATUS_MOCK_ERC8004=" + mockRegistryAddress);
  console.log("STATUS_REPUTATION_ADDRESS=" + reputationAddress);
  console.log("STATUS_ONLY_AGENT_ADDRESS=" + onlyAgentAddress);
  console.log("\nExplorer: https://sepoliascan.status.network/address/" + onlyAgentAddress);
  console.log("Next: node scripts/prove-status.js");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
