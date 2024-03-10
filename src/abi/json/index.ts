import { ethers } from "ethers";
import web3 from "web3";

const routerAbi = new ethers.utils.Interface(require("./uniswap-router.json"));
const factoryAbi = new ethers.utils.Interface(require("./uniswap-factory.json"));
const erc20Abi = new ethers.utils.Interface(require("./erc20.json"));
const pairAbi = new ethers.utils.Interface(require("./pair.json"));
const onlymoonsAbi = new ethers.utils.Interface(require("./onlymoons.json"));

export { factoryAbi, routerAbi, erc20Abi, pairAbi, onlymoonsAbi };
