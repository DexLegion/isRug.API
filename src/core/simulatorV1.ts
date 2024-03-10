import { BigNumber, Contract, ContractFactory, ethers, Wallet } from "ethers";
import ganache, { EthereumProvider } from "ganache";
import {
  Erc20,
  Erc20__factory,
  /*Isrug_router, Isrug_router__factory, Pair__factory,*/ Uniswap_router__factory,
  Weth__factory,
} from "../abi/generated";
import config from "../config";

import { SimulationResult, Token, Network } from "../types";
import { Uniswap } from "../core/uniswap";
import memdown from "memdown";
import { getNet } from "../modules";
import { getToken, parseBytecode } from "../utils/contract";
import Web3 from "web3";
import _ from "lodash";
import { deadline } from "../utils";
import { FunctionFragment } from "@ethersproject/abi";

class SimulatorV1 {
  public provider: EthereumProvider;

  public wallet1: Wallet;
  public uniswap1: Uniswap;
  public wallet2: Wallet;
  public uniswap2: Uniswap;

  public network: Network[string];
  public chain: string;
  public cli: ethers.providers.Web3Provider;
  public passphrase: string;

  constructor(_chain: string) {
    this.chain = _chain;
    this.network = config.networks[_chain];
    const wlt1 = Wallet.createRandom();
    const wlt2 = Wallet.createRandom();

    this.passphrase = btoa(wlt1.privateKey);
    this.provider = ganache.provider({
      fork: { url: config.networks[_chain].rpc },

      database: { db: memdown() },

      logging: { debug: false, quiet: true, verbose: false },
      chain: {
        asyncRequestProcessing: true,
        allowUnlimitedContractSize: true,
        vmErrorsOnRPCResponse: true,
        chainId: this.network.chainId,
        time: Date.now(),
      },
      coinbase: this.network.tokens.WETH,
      miner: {
        blockGasLimit: 20000000,
        callGasLimit: 10000000,
        defaultTransactionGasLimit: 1000000,
      },

      wallet: {
        unlockedAccounts: ["0x000000000000000000000000000000000000dead"],
      },
      accounts: [
        {
          secretKey: wlt1.privateKey,
          balance: ethers.utils.hexlify(ethers.utils.parseEther("10000")),
        },
        {
          secretKey: wlt2.privateKey,
          balance: ethers.utils.hexlify(ethers.utils.parseEther("10000")),
        },
      ],
    });

    this.cli = new ethers.providers.Web3Provider(this.provider);
    this.wallet1 = new ethers.Wallet(wlt1.privateKey, this.cli);
    this.wallet2 = new ethers.Wallet(wlt2.privateKey, this.cli);

    this.uniswap1 = new Uniswap({ client: this.cli, wallet: this.wallet1 }, this.chain);
    this.uniswap2 = new Uniswap({ client: this.cli, wallet: this.wallet2 }, this.chain);
  }

  /**
   * Simulates the token transaction process.
   *
   * @param baseToken - The base token to be used in the transaction.
   * @param fncs - Optional array of function fragments.
   * @returns A promise that resolves to a SimulationResult object.
   */
  async simulateToken(baseToken: Token, fncs?: FunctionFragment[]): Promise<SimulationResult> {
    let state = "";
    try {
      const net = await getNet(this.chain);
      const simulationStarted = performance.now();
      await this.mine(500);
      const standardGas = "3000000"; // 6721975;
      state = "Prepare";
      const baseCtr = Erc20__factory.connect(baseToken.address, this.wallet1);
      const baseCtrMain = Erc20__factory.connect(baseToken.address, this.wallet2);
      const loadersEnded = performance.now();
      console.log(`Ganache Modules loaded in ${(loadersEnded - simulationStarted) / 1000} seconds.`);
      // console.log("Initializing UniV2 envirionment");
      // await this.initV2Env(baseToken.address).catch((x) => console.error(x, "V2 Init failed"));
      console.log("Wrapping bnb");

      const wethCtr = Weth__factory.connect(this.network.tokens.WETH, this.wallet1);
      const quoteToken = await getToken(wethCtr.address, this.chain);
      await wethCtr.deposit({ value: ethers.utils.parseEther("5000"), gasLimit: standardGas });

      state = "Buy";
      console.log("Buying");
      await this.mine(500);
      const buyResult = await this.uniswap1.swapWithCalculate({
        base: baseToken,
        quote: quoteToken,
        amount: ethers.utils.parseEther("0.000001"),
        type: "buy",
        gasLimit: standardGas,
        wallet: this.wallet1.address,
      });
      const buyAmount = await baseCtr.balanceOf(this.wallet1.address);

      state = "Approve";
      console.log("Approving");
      await baseCtr.approve(this.wallet1.address, ethers.constants.MaxUint256);
      await baseCtrMain.approve(this.wallet1.address, ethers.constants.MaxUint256);

      await this.mine(500);
      state = "Sell";
      console.log("Selling");
      const sellResult = await this.uniswap1.swapWithCalculate({
        base: baseToken,
        quote: quoteToken,
        amount: await baseCtr.balanceOf(this.wallet1.address),
        type: "sell",
        gasLimit: standardGas,
        wallet: this.wallet1.address,
      });

      await this.mine(500);
      state = "Second Buy";
      console.log("Buying");
      const secBuyResult = await this.uniswap1.swapWithCalculate({
        base: baseToken,
        quote: quoteToken,
        amount: ethers.utils.parseEther("0.000001"),
        type: "buy",
        gasLimit: standardGas,
        wallet: this.wallet1.address,
      });
      const secBuyAmount = await baseCtr.balanceOf(this.wallet1.address);

      await this.mine(500);
      let transferError = false;
      console.log("Transfering");
      await baseCtr
        .transferFrom(this.wallet1.address, this.wallet2.address, secBuyAmount.div(2), { gasLimit: standardGas })
        .catch(() => (transferError = true));
      await this.mine(500);
      const mBlc = await baseCtr.balanceOf(this.wallet2.address);

      await baseCtr
        .transferFrom(this.wallet2.address, this.wallet1.address, mBlc, {
          gasLimit: standardGas,
        })
        .catch(() => (transferError = true));
      const gasprice = await net.cli.getGasPrice();
      const simulationEnded = performance.now();
      console.log(`Simulation ended in ${(simulationEnded - simulationStarted) / 1000} seconds.`);
      const buyAmountFm = ethers.utils.formatUnits(buyAmount, baseToken.decimal);
      state = "";
      return {
        buyTax: Number(this.calculateTax(Number(buyResult.calculatedOutput), Number(buyAmountFm))).toFixed(2),
        sellTax: Number(this.calculateTax(Number(sellResult.calculatedOutput), Number(sellResult.output))).toFixed(2),
        isSellable: true,
        buyGas: Number((Number(buyResult.gasUsed) * Number(ethers.utils.formatEther(gasprice))).toFixed(5)),
        sellGas: Number((Number(sellResult.gasUsed) * Number(ethers.utils.formatEther(gasprice))).toFixed(5)),
        transferError: transferError,
      };
    } catch (ex) {
      console.error(ex);
      let err: string;
      if (ex.message.includes("VM Exception")) {
        err = ex.message.split(":").slice(1).join(":").trim();
      } else if (ex.message.includes("without")) {
        err = "Honeypot test failed without a reason";
      } else {
        err = "Honeypot test failed with a unknown reason";
      }
      return {
        isSellable: false,
        failedState: state,
        errorMessage: err,
      };
    }
  }
  async mine(blocks: number) {
    return Promise.all([
      this.provider.send("evm_mine", [{ blocks }]),
      this.provider.send("evm_increaseTime", [blocks * 5]),
    ]);
  }
  async initV2Env(contract: string) {
    const dsg = this.cli.getSigner("0x000000000000000000000000000000000000dead");
    const router = Uniswap_router__factory.connect(this.network.contracts.mainswap.router, dsg);
    const erc20 = Erc20__factory.connect(contract, dsg);
    let [decimals, tsup, code, tx] = await Promise.all([
      erc20.decimals(),
      erc20.totalSupply(),
      this.cli.getCode(contract),
      dsg.sendTransaction(await erc20.populateTransaction.balanceOf("0x000000000000000000000000000000000000dead")),
    ]);
    const parse = await parseBytecode(code);
    const [usedStors, calcStors] = await Promise.all([
      this.storageDiscovery(tx.hash),
      this.calculateAllSlots("0x000000000000000000000000000000000000dead", parse.storageSlots),
    ]);

    const match = await this.matchedHashes(usedStors, calcStors);
    const isRefl = match.length > 1;

    tsup.toString() == "0" ? (tsup = ethers.utils.parseUnits("500000000", decimals)) : null;

    const newBlc = isRefl ? await this.reflectionFromToken(tsup.div(2), tsup) : await tsup.div(2);
    const slot = match[match.length - 1];

    await this.setStorage(contract, slot, newBlc);

    await erc20.approve(config.networks[this.chain].contracts.mainswap.router, ethers.constants.MaxUint256);
    const liqTx = await router.addLiquidityETH(
      contract,
      tsup.div(4),
      0,
      0,
      "0x000000000000000000000000000000000000dead",
      deadline(30),
      {
        value: ethers.utils.parseEther("100"),
      }
    );
    await liqTx.wait();
  }

  /**
   * Returns an array of matched hashes between two arrays.
   * @param stor1 - The first array of strings.
   * @param stor2 - The second array of strings.
   * @returns An array of matched hashes.
   */
  async matchedHashes(stor1: string[], stor2: string[]) {
    return stor1.filter((x) => stor2.find((y) => x == y));
  }

  /**
   * Discovers the storage keys accessed during the execution of a transaction.
   * @param hash The hash of the transaction.
   * @returns An array of storage keys accessed during the transaction.
   */
  async storageDiscovery(hash: string) {
    const trace = await this.provider.send("debug_traceTransaction", [hash, { disableMemory: true }]);
    const sloads = Object.values(trace.structLogs).filter((x) => x.op == "SLOAD");

    return Object.keys(sloads[sloads.length - 1].storage).map((x) => "0x" + x);
  }

  /**
   * Calculates the mapping slots for the given address and slots.
   * @param address The address to calculate the mapping slots for.
   * @param slots The array of slots to calculate.
   * @returns A promise that resolves to an array of encoded mapping slots.
   */
  async calculateAllSlots(address: string, slots: string[]) {
    return Promise.all(slots.map(async (x) => await this.encodeMappingSlot(address, x)));
  }

  /**
   * Sets the storage value at a specific slot for a given address.
   * @param address - The address of the account.
   * @param slot - The storage slot.
   * @param value - The value to be set.
   * @returns A promise that resolves when the storage value is successfully set.
   */
  async setStorage(address: string, slot: string, value: BigNumber) {
    return this.provider.send("evm_setAccountStorageAt", [
      Web3.utils.toChecksumAddress(address),
      slot,
      value.toHexString(),
    ]);
  }

  /**
   * Encodes the mapping slot using the given address and slot.
   * @param address The address to encode.
   * @param slot The slot to encode.
   * @returns The encoded mapping slot.
   */
  async encodeMappingSlot(address: string, slot: string) {
    return ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [Web3.utils.toChecksumAddress(address), BigNumber.from("0x" + slot)]
    );
  }

  /**
   * Calculates the token amount from the reflection amount.
   *
   * @param rAmount The reflection amount.
   * @param tTotal The total token supply.
   * @returns The token amount.
   */
  async tokenFromReflection(rAmount: BigNumber, tTotal: BigNumber): Promise<BigNumber> {
    const rTotal = ethers.constants.MaxUint256.sub(ethers.constants.MaxUint256.mod(tTotal));

    const rate = rTotal.div(tTotal);

    return rAmount.div(rate);
  }

  /**
   * Calculates the reflection amount from a given token amount and total token supply.
   * @param tAmount The token amount.
   * @param tTotal The total token supply.
   * @returns The reflection amount.
   */
  async reflectionFromToken(tAmount: BigNumber, tTotal: BigNumber) {
    const rTotal = ethers.constants.MaxUint256.sub(ethers.constants.MaxUint256.mod(tTotal));

    const rate = rTotal.div(tTotal);

    return tAmount.mul(rate);
  }

  /**
   * Unlocks the specified Ethereum account.
   * @param address - The address of the account to unlock.
   * @returns A boolean indicating whether the account was successfully unlocked.
   */
  async unlockAccount(address: string) {
    const add = await this.provider.send("evm_addAccount", [Web3.utils.toChecksumAddress(address), this.passphrase]);
    const unlck = await this.provider.send("personal_unlockAccount", [
      Web3.utils.toChecksumAddress(address),
      this.passphrase,
      0,
    ]);
    return add && unlck;
  }

  /**
   * Locks the specified account.
   * @param address - The address of the account to be locked.
   * @returns A boolean indicating whether the account was successfully locked.
   */
  async lockAccount(address: string) {
    const lock = await this.provider.send("personal_lockAccount", [Web3.utils.toChecksumAddress(address)]);
    const rem = await this.provider.send("evm_removeAccount", [Web3.utils.toChecksumAddress(address), this.passphrase]);
    return lock && rem;
  }
  async destroy() {
    await this.provider.disconnect();
  }
  private calculateTax(calculated: number, real: number): string {
    return (((calculated - real) / calculated) * 100).toFixed(3);
  }
}
export default SimulatorV1;
