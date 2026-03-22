import { ethers } from "ethers";

const ONLYAGENT_CONTRACT = "0x0485c9867a3Ecac90380C335347eaF5791A0A776";

const iface = new ethers.Interface([
    "function setApprovalForAll(address operator, bool approved) external"
]);

const calldata = iface.encodeFunctionData("setApprovalForAll", [ONLYAGENT_CONTRACT, true]);
console.log("Encoded setApprovalForAll calldata:");
console.log(calldata);
