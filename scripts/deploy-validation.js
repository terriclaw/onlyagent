import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Deploying ValidationRegistry with:", deployer.address);

  const artifact = await hre.artifacts.readArtifact("ValidationRegistry");
  const Factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  const validation = await Factory.deploy(process.env.ERC8004_IDENTITY_REGISTRY);
  await validation.waitForDeployment();

  const addr = await validation.getAddress();
  console.log("VALIDATION_REGISTRY_ADDRESS=" + addr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
