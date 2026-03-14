import hre from "hardhat";

async function main() {
  console.log("HRE keys:", Object.keys(hre));
  console.log("ethers:", hre.ethers);
}

main().catch(console.error);
