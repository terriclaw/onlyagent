import hre from "hardhat";
import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Using:", deployer.address);

  const artifact = await hre.artifacts.readArtifact("OnlyAgent");
  const OnlyAgent = new ethers.Contract(
    "0x5158969E52dB9B919E995EBFeC468978435a3A57",
    artifact.abi,
    deployer
  );

  const tx = await OnlyAgent.addTEEProvider("0xa741Aff206168974362c911de580678fc4880542");
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("TEE provider registered!");
}

main().catch(console.error);
