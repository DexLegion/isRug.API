import { BigNumber, ethers, Signer, Wallet } from "ethers";
import {
  Erc20__factory,
  Isrug_router,
  Isrug_router__factory,
  Uniswap_factory__factory,
  Uniswap_router__factory,
} from "../abi/generated/";

import { Network, RouterLogs, Token } from "../types";
import config from "../config";
import { Isrug_routerInterface } from "../abi/generated/Isrug_router";
import Web3 from "web3";
type SwapArgsV2 = {
  token: Token;
  signer: Signer;
  amount: BigNumber;

  type: "buy" | "sell";
};
type SwapResultV2 = {
  gasUsed: string;
  txHash: string;
  tax: string;
  output: BigNumber;
  calculatedOutput: BigNumber;
};
class Router {
  address: string;
  network: Network[string];
  constructor(_address: string, _network: Network[string]) {
    this.address = _address;
    this.network = _network;
  }
  /**
   * Performs a swap operation using the specified arguments.
   * @param args - The swap arguments.
   * @returns A promise that resolves to the swap result.
   */
  async swap(args: SwapArgsV2): Promise<SwapResultV2> {
    const router = Isrug_router__factory.connect(this.address, args.signer);
    const fact = Uniswap_factory__factory.connect(this.network.contracts.mainswap.factory, args.signer);
    const pair = await fact.getPair(args.token.address, this.network.tokens.WETH);
    await this.approve(args.token.address, this.address, args.signer);
    await this.approve(this.network.tokens.WETH, this.address, args.signer);
    let tx: ethers.ContractTransaction;
    switch (args.type) {
      case "buy":
        tx = await router.buy([this.network.tokens.WETH, args.token.address], pair, {
          gasLimit: config.defaultGasLimit,
          value: args.amount,
        });
      case "sell":
        tx = await router.sell([args.token.address, this.network.tokens.WETH], pair, args.amount, {
          gasLimit: config.defaultGasLimit,
        });
    }

    const receipt = await tx.wait();
    const result = await extractRouterLogs(receipt.logs, router.interface);

    return {
      gasUsed: receipt.gasUsed.toString(),
      ...result,
      tax: calculateTax(result.calculatedOutput.toString(), result.output.toString()),
      txHash: tx.hash,
    };
  }
  /**
   * Performs a transfer check using the specified token, main signer, and transit signer.
   * @param args - The arguments for the transfer check.
   * @param args.token - The token to be used for the transfer check.
   * @param args.mainSigner - The main signer for the transfer check.
   * @param args.transitSigner - The transit signer for the transfer check.
   */
  async transferCheck(args: { token: Token; mainSigner: Signer; transitSigner: Signer }) {
    const router = Isrug_router__factory.connect(this.address, args.mainSigner);
    await this.approve(args.token.address, this.address, args.mainSigner);
    await this.approve(args.token.address, this.address, args.transitSigner);
    await router.transitTransferCheck(args.token.address, await args.transitSigner.getAddress(), {
      gasLimit: config.defaultGasLimit,
    });
  }
  async approve(token: string, target: string, signer: Signer) {
    const erc20 = Erc20__factory.connect(token, signer);

    return erc20.approve(Web3.utils.toChecksumAddress(target), ethers.constants.MaxUint256);
  }
}

/**
 * Calculates the tax based on the calculated and output values.
 *
 * @param calculated - The calculated value.
 * @param output - The output value.
 * @returns The calculated tax as a percentage, rounded to 3 decimal places.
 */
function calculateTax(calculated: string, output: string) {
  //@ts-ignore
  //UniV2 Default Fee
  return (((calculated - output) / calculated) * 100).toFixed(3);
}

/**
 * Extracts router logs and returns the relevant information.
 * @param logs - The array of logs to extract from.
 * @param intf - The Isrug_routerInterface instance used for parsing logs.
 * @returns A promise that resolves to a RouterLogs object containing the extracted information.
 */
async function extractRouterLogs(logs: ethers.providers.Log[], intf: Isrug_routerInterface): Promise<RouterLogs> {
  //Swap: 0x015fc8ee969fd902d9ebd12a31c54446400a2b512a405366fe14defd6081d220
  //Balance: 0x740f7e210cf19d27b8ab2cec1ebb61687bdc5f38f8bd56f0c8e5d22ed71854db
  const log0 = logs.find((x) =>
    x.topics.includes("0x015fc8ee969fd902d9ebd12a31c54446400a2b512a405366fe14defd6081d220")
  );
  const log1 = logs.find((x) =>
    x.topics.includes("0x740f7e210cf19d27b8ab2cec1ebb61687bdc5f38f8bd56f0c8e5d22ed71854db")
  );
  const [swap, balances] = await Promise.all([intf.parseLog(log0), intf.parseLog(log1)]);

  return {
    balances: {
      before: balances.args.bfBalance,
      after: balances.args.aftBalance,
    },
    calculatedOutput: swap.args.calculated,
    output: swap.args.output,
  };
}
export default Router;
