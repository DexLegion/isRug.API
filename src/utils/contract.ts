import { ethers, BigNumber } from "ethers";
import { EVM } from "evm";
import Web3 from "web3";
import { Erc20__factory } from "../abi/generated/";
import { getNet } from "../modules";
import { Supply, Token } from "../types";
import config from "../config";
import { Contract } from "@hovoh/ethcall";
import { Interface } from "@ethersproject/abi";

async function parseBytecode(code: string): Promise<{ methods: string[]; storageSlots: string[]; adrInCode: string[] }> {
  const evm = new EVM(code);
  const opcodes = evm.getOpcodes();
  const methods = Array.from(
    new Set(
      opcodes
        .filter((x) => x.opcode == 99)
        .map((x) => x.pushData.toString("hex"))
        .filter((x) => x != "ffffffff")
        .map((x) => "0x" + x)
    )
  );
  const storageSlots = Array.from(new Set(opcodes.filter((x) => x.opcode == 127 || x.opcode == 96).map((x) => x.pushData.toString("hex"))));
  const adrInCode = Array.from(
    new Set(
      opcodes
        .filter((x) => x.opcode == 115)
        .map((x) => "0x" + x.pushData.toString("hex"))
        .filter((x) => x != "0xffffffffffffffffffffffffffffffffffffffff")
    )
  );
  return { methods, storageSlots, adrInCode };
}

async function getToken(address: string, chain): Promise<Token> {
  const net = await getNet(chain);
  address = Web3.utils.toChecksumAddress(address);
  const erc20 = Erc20__factory.multicall(address);
  const [decimal, name, symbol] = await net.mcall.all([erc20.decimals(), erc20.name(), erc20.symbol()]);
  return {
    address: address,
    decimal,
    name,
    symbol,
  };
}
async function getTokenSupply(address: string, chain: string): Promise<Supply> {
  const tokenCtr = Erc20__factory.multicall(address);
  const net = await getNet(chain);
  try {
    const [tsup, decimals] = await net.mcall.all([tokenCtr.totalSupply(), tokenCtr.decimals()]);
    const totalSupply = Number(ethers.utils.formatUnits(tsup, decimals));
    const allBurned = await net.mcall.all(Object.values(config.burnWallets).map((x) => tokenCtr.balanceOf(x)));
    let burnedSupply: BigNumber = ethers.BigNumber.from(0);
    for await (const x of allBurned) {
      burnedSupply = burnedSupply.add(x);
    }
    return {
      totalSupply: totalSupply.toFixed(0),
      burnedSupply: Number(ethers.utils.formatUnits(burnedSupply, decimals)).toFixed(0),
      burnedRate: (100 - ((totalSupply - Number(ethers.utils.formatUnits(burnedSupply, decimals))) / totalSupply) * 100).toFixed(1),
      circulationSupply: (totalSupply - Number(ethers.utils.formatUnits(burnedSupply, decimals))).toFixed(0),
    };
  } catch (ex) {
    console.log(ex);
    return {
      totalSupply: "NaN",
      burnedSupply: "NaN",
      burnedRate: "NaN",
      circulationSupply: "NaN",
    };
  }
}

async function getOwnerBalances(owner: string, baseToken: string, baseDecimal: number, chain: string) {
  try {
    owner = Web3.utils.toChecksumAddress(owner);
    baseToken = Web3.utils.toChecksumAddress(baseToken);
    const net = await getNet(chain);
    const tokenCtr = Erc20__factory.multicall(baseToken);
    const usdcCtr = Erc20__factory.multicall(config.networks[chain].tokens.USDC);
    const wethCtr = Erc20__factory.multicall(config.networks[chain].tokens.WETH);
    const ethBalance = await net.cli.getBalance(owner);
    const [tokenBalance, usdcBalance, wethBalance, contractBalance] = await net.mcall.tryAll([
      tokenCtr.balanceOf(owner),
      usdcCtr.balanceOf(owner),
      wethCtr.balanceOf(owner),
      tokenCtr.balanceOf(baseToken),
    ]);

    return {
      tokenBalance: tokenBalance ? Number(ethers.utils.formatUnits(ethers.BigNumber.from(tokenBalance.toHexString()), baseDecimal)) : 0,
      usdcBalance: usdcBalance ? Number(ethers.utils.formatUnits(ethers.BigNumber.from(usdcBalance.toHexString()), 6)) : 0,
      wethBalance: wethBalance ? Number(ethers.utils.formatEther(ethers.BigNumber.from(wethBalance.toHexString()))) : 0,
      ethBalance: ethBalance ? Number(ethers.utils.formatEther(ethers.BigNumber.from(ethBalance.toHexString()))) : 0,
      contractBalance: contractBalance ? Number(ethers.utils.formatUnits(ethers.BigNumber.from(contractBalance.toHexString()), baseDecimal)) : 0,
    };
  } catch (ex) {
    console.log(ex);
  }
}

async function isErc20(address: string, chain: string) {
  try {
    const net = await getNet(chain);
    const ctr = Erc20__factory.connect(address, net.cli);
    await ctr.symbol();
    return true;
  } catch (ex) {
    return false;
  }
}
async function getErc20(address: string, chain: string) {
  try {
    address = Web3.utils.toChecksumAddress(address);
    const net = await getNet(chain);
    const ctr = Erc20__factory.connect(address, net.cli);
    return { symbol: await ctr.symbol(), isErc: true };
  } catch (ex) {
    return { symbol: "", isErc: false };
  }
}
export { parseBytecode, getToken, getTokenSupply, isErc20, getErc20, getOwnerBalances };
