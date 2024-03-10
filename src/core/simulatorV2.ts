// beta do not use

import { BigNumber, Contract, ContractFactory, ethers, Wallet } from "ethers";
import ganache, { EthereumProvider } from "ganache";
import {
  Erc20,
  Erc20__factory,
  Isrug_router,
  Isrug_router__factory,
  Pair__factory,
  Uniswap_router__factory,
  Weth__factory,
} from "../abi/generated";
import config from "../config";

import fs from "fs";
import _ from "lodash";
import memdown from "memdown";
import Web3 from "web3";
import { getNet } from "../modules";
import { Network, SimulationResult, Token } from "../types";
import { deadline } from "../utils";
import { getToken, parseBytecode } from "../utils/contract";
import Router from "./router";
import { Uniswap } from "./uniswap";
class Simulator {
  public provider: EthereumProvider;
  public wallet1: Wallet;
  public wallet2: Wallet;
  public router: Router;
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
      fork: { url: this.network.rpc },

      database: { db: memdown() },

      logging: { debug: false, quiet: false, verbose: false },
      chain: {
        asyncRequestProcessing: true,
        allowUnlimitedContractSize: true,
        vmErrorsOnRPCResponse: true,
        chainId: this.network.chainId,
      },
      coinbase: this.network.tokens.WETH,
      miner: {
        blockGasLimit: 50000000,
        callGasLimit: 30000000,
        defaultTransactionGasLimit: 6000000,
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
  }

  async simulateToken(baseToken: Token): Promise<SimulationResult> {
    let state = "";
    try {
      const simulationStarted = performance.now();
      await this.mine(250);
      const mnet = await getNet(this.chain);
      state = "Prepare";
      const baseCtr = Erc20__factory.connect(baseToken.address, this.wallet1);

      const loadersEnded = performance.now();
      console.log(`Ganache Modules loaded in ${(loadersEnded - simulationStarted) / 1000} seconds.`);
      console.log("Initializing UniV2 envirionment");
      await this.initV2Env(baseToken.address).catch((x) => console.error(x, "V2 Init failed"));

      console.log("Buying");
      state = "Buy";
      await this.mine(250);
      const buyResult = await this.router.swap({
        amount: ethers.utils.parseEther("1"),
        signer: this.wallet1,
        token: baseToken,
        type: "buy",
      });

      state = "TransferCheck";
      console.log("Transfering");
      await this.mine(250);

      await this.router.transferCheck({ token: baseToken, mainSigner: this.wallet1, transitSigner: this.wallet2 });
      state = "SellCheck";
      console.log("Selling");
      await this.mine(250);
      const sellResult = await this.router.swap({
        amount: await baseCtr.balanceOf(this.wallet1.address),
        signer: this.wallet1,
        token: baseToken,
        type: "sell",
      });
      const gasprice = await mnet.cli.getGasPrice();
      const simulationEnded = performance.now();
      console.log(`Simulation ended in ${(simulationEnded - simulationStarted) / 1000} seconds.`);

      state = "";
      return {
        buyTax: buyResult.tax,
        sellTax: sellResult.tax,
        isSellable: true,
        buyGas: Number((Number(buyResult.gasUsed) * Number(ethers.utils.formatEther(gasprice))).toFixed(5)),
        sellGas: Number((Number(sellResult.gasUsed) * Number(ethers.utils.formatEther(gasprice))).toFixed(5)),
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
  async deployRouter() {
    const abi = JSON.parse(fs.readFileSync("src/abi/json/isrug_router.json", "utf-8"));
    const [intf, bytecode] = [Isrug_router__factory.createInterface(), abi.bytecode];
    const fact = new ContractFactory(intf, bytecode, this.wallet2);
    const dep = await fact.deploy(this.network.contracts.factory, this.network.tokens.WETH);
    console.log("Router deployed this address:", dep.address);
    this.router = new Router(dep.address, this.network);

    return dep as Isrug_router;
  }
  async mine(blocks: number) {
    return Promise.all([
      this.provider.send("evm_mine", [{ blocks }]),
      this.provider.send("evm_increaseTime", [blocks * 5]),
    ]);
  }
  async matchedHashes(stor1: string[], stor2: string[]) {
    return stor1.filter((x) => stor2.find((y) => x == y));
  }
  async storageDiscovery(hash: string) {
    const trace = await this.provider.send("debug_traceTransaction", [hash, { disableMemory: true }]);
    const sloads = Object.values(trace.structLogs).filter((x) => x.op == "SLOAD");

    return Object.keys(sloads[sloads.length - 1].storage).map((x) => "0x" + x);
  }
  async calculateAllSlots(address: string, slots: string[]) {
    return Promise.all(slots.map(async (x) => await this.encodeMappingSlot(address, x)));
  }
  async setStorage(address: string, slot: string, value: BigNumber) {
    return this.provider.send("evm_setAccountStorageAt", [
      Web3.utils.toChecksumAddress(address),
      slot,
      value.toHexString(),
    ]);
  }
  async encodeMappingSlot(address: string, slot: string) {
    return ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [Web3.utils.toChecksumAddress(address), BigNumber.from("0x" + slot)]
    );
  }
  async tokenFromReflection(rAmount: BigNumber, tTotal: BigNumber): Promise<BigNumber> {
    const rTotal = ethers.constants.MaxUint256.sub(ethers.constants.MaxUint256.mod(tTotal));

    const rate = rTotal.div(tTotal);

    return rAmount.div(rate);
  }
  async reflectionFromToken(tAmount: BigNumber, tTotal: BigNumber) {
    const rTotal = ethers.constants.MaxUint256.sub(ethers.constants.MaxUint256.mod(tTotal));

    const rate = rTotal.div(tTotal);

    return tAmount.mul(rate);
  }
  async unlockAccount(address: string) {
    const add = await this.provider.send("evm_addAccount", [Web3.utils.toChecksumAddress(address), this.passphrase]);
    const unlck = await this.provider.send("personal_unlockAccount", [
      Web3.utils.toChecksumAddress(address),
      this.passphrase,
      0,
    ]);
    return add && unlck;
  }
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
export default Simulator;
