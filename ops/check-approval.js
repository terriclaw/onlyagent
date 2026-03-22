import { ethers } from "ethers";
import "dotenv/config";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ONLYAGENT_CONTRACT = "0x0485c9867a3Ecac90380C335347eaF5791A0A776";
const TERRICLAW = "0x0457b3ded2ba9e56520b21735f4324f6533f93ff";
const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const REGISTRY_ABI = [
    "function isApprovedForAll(address owner, address operator) external view returns (bool)"
];

async function check() {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, provider);
    
    const approved = await registry.isApprovedForAll(TERRICLAW, ONLYAGENT_CONTRACT);
    console.log("Is OnlyAgent approved for TerriClaw?", approved);
}

check().catch(err => console.error("Error:", err.message));
