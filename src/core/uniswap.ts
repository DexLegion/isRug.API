import { BigNumber, ethers, Signer } from "ethers";
import web3 from "web3";

import {
  Erc20__factory,
  Pair__factory,
  Uniswap_factory,
  Uniswap_factory__factory,
  Uniswap_router,
  Uniswap_router__factory,
  Weth__factory,
  Onlymoons__factory,
  Nitrolocker__factory,
  Dxlp__factory,
  Pinklock__factory,
} from "../abi/generated/";
import config from "../config";
import { getNet } from "../modules";
import { FunctionFragment, Interface } from "@ethersproject/abi";

import {
  ModuleSettings,
  Pair,
  ParsedTransactionResult,
  Reserves,
  SwapArgs,
  SwapResult,
  Token,
  LockedLp,
  AllLocks,
  Sorts,
  TokenMaxes,
  Owner,
} from "../types";
import { deadline } from "../utils";

const nf = Intl.NumberFormat();

class Uniswap {
  router: Uniswap_router;
  factory: Uniswap_factory;
  chain: string;
  private settings: ModuleSettings;
  constructor(settings: ModuleSettings, _chain: string) {
    this.router = Uniswap_router__factory.connect(config.networks[_chain].contracts.mainswap.router, settings.wallet);
    this.factory = Uniswap_factory__factory.connect(
      config.networks[_chain].contracts.mainswap.factory,
      settings.wallet
    );
    this.chain = _chain;
    this.settings = settings;
  }
  async allow(approval: string, signer: Signer, tokens: string[]) {
    for (const token of tokens) {
      const ctr = Erc20__factory.connect(token, signer);
      const data = await ctr.allowance(await signer.getAddress(), approval);
      if ((data != ethers.constants.MaxUint256, data.toString() == "0")) {
        await ctr.approve(config.networks[this.chain].contracts.mainswap.router, ethers.constants.MaxUint256);
      }
    }
  }
  async swap(args: SwapArgs): Promise<SwapResult> {
    args.minAmountOut = args.minAmountOut ? args.minAmountOut : 0;
    const defaultGasPrice = await this.settings.client.getGasPrice();
    let path: string[];

    switch (args.type) {
      case "buy":
        if (args.quote.address == config.networks[this.chain].tokens.WETH) {
          path = [args.quote.address, args.base.address];
        } else {
          path = [config.networks[this.chain].tokens.WETH, args.quote.address, args.base.address];
        }
        break;
      case "sell":
        if (args.quote.address == config.networks[this.chain].tokens.WETH) {
          path = [args.base.address, args.quote.address];
        } else {
          path = [args.base.address, args.quote.address, config.networks[this.chain].tokens.WETH];
        }
        break;
    }
    await this.allow(config.networks[this.chain].contracts.mainswap.router, this.settings.wallet, path);

    const proc = await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      args.amount,
      0,
      path,
      args.wallet,
      deadline(20),
      {
        gasPrice: args.gasPrice ? args.gasPrice : defaultGasPrice,
        gasLimit: ethers.utils.hexlify(Number(args.gasLimit)),
      }
    );

    const result = await proc.wait();

    const output = await extractOutput(result.logs, args.wallet, this.chain);
    let formatted: string;
    switch (args.type) {
      case "buy":
        formatted = ethers.utils.formatUnits(output, args.base.decimal);
        break;
      case "sell":
        formatted = ethers.utils.formatUnits(output, path.length == 2 ? args.quote.decimal : 18);
    }
    return {
      gasUsed: result.gasUsed.toString(),
      txHash: proc.hash,
      receipt: result,
      output: formatted,
    };
  }
  async swapWithCalculate(args: SwapArgs, from?: string): Promise<SwapResult> {
    args.minAmountOut = args.minAmountOut ? args.minAmountOut : 0;
    const defaultGasPrice = await this.settings.client.getGasPrice();
    let path: string[];

    switch (args.type) {
      case "buy":
        if (args.quote.address == config.networks[this.chain].tokens.WETH) {
          path = [args.quote.address, args.base.address];
        } else {
          path = [config.networks[this.chain].tokens.WETH, args.quote.address, args.base.address];
        }
        break;
      case "sell":
        if (args.quote.address == config.networks[this.chain].tokens.WETH) {
          path = [args.base.address, args.quote.address];
        } else {
          path = [args.base.address, args.quote.address, config.networks[this.chain].tokens.WETH];
        }
        break;
    }
    await this.allow(config.networks[this.chain].contracts.mainswap.router, this.settings.wallet, path);
    const calcOutputs = await this.router.getAmountsOut(args.amount, path);
    const calcOutput = calcOutputs[calcOutputs.length - 1];

    const proc = await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      args.amount,
      0,
      path,
      args.wallet,
      deadline(20),
      {
        gasPrice: args.gasPrice ? args.gasPrice : defaultGasPrice,
        gasLimit: ethers.utils.hexlify(Number(args.gasLimit)),
        from,
      }
    );
    const result = await proc.wait();

    const output = await extractOutput(result.logs, args.wallet, this.chain);
    let formatted: { calc: string; org: string };
    switch (args.type) {
      case "buy":
        formatted = {
          calc: ethers.utils.formatUnits(calcOutput, args.base.decimal),
          org: ethers.utils.formatUnits(output, args.base.decimal),
        };
        break;
      case "sell":
        formatted = {
          calc: ethers.utils.formatUnits(calcOutput, path.length > 2 ? 18 : args.quote.decimal),
          org: ethers.utils.formatUnits(output, path.length > 2 ? 18 : args.quote.decimal),
        };
    }
    return {
      gasUsed: result.gasUsed.toString(),
      txHash: proc.hash,
      receipt: result,
      output: formatted.org,
      calculatedOutput: formatted.calc,
    };
  }

  async approve(address: string) {
    const contract = Erc20__factory.connect(address, this.settings.wallet);
    const proc = await contract.approve(
      config.networks[this.chain].contracts.mainswap.router,
      ethers.constants.MaxUint256
    );
    await proc.wait();
  }
  async calculateAmount(amount: BigNumber, route: "in" | "out", reserves: Reserves): Promise<BigNumber> {
    const calc = await this.router.getAmountOut(
      amount,
      route == "in" ? reserves.quote : reserves.base,
      route == "out" ? reserves.quote : reserves.base
    );
    return calc;
  }
  async getPrice(amount: BigNumber, data: ParsedTransactionResult): Promise<BigNumber> {
    const path = [data.base.address, data.quote.address];
    if (data.quote.address != config.networks[this.chain].tokens.WETH) {
      path.push(config.networks[this.chain].tokens.WETH);
    }
    const amounts = await this.router.getAmountsOut(amount, path);
    return amounts[amounts.length - 1];
  }
}

async function extractOutput(logs: ethers.providers.Log[], walletAddr: string, chain: string): Promise<BigNumber> {
  const intf = Pair__factory.createInterface();
  const swaps = logs
    .filter((x) => x.topics.includes("0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"))
    .map((x) => intf.parseLog(x));
  const swapEvent = swaps.find((x) => {
    const addr = [x.args.sender, x.args.to];
    return (
      addr.includes(web3.utils.toChecksumAddress(config.networks[chain].contracts.mainswap.router)) &&
      addr.includes(web3.utils.toChecksumAddress(walletAddr))
    );
  });

  if (swapEvent) {
    return (
      swapEvent.args.amount1Out.toString() == 0 ? swapEvent.args.amount0Out : swapEvent.args.amount1Out
    ) as BigNumber;
  } else {
    const intf = Weth__factory.createInterface();
    const withdrawals = logs.filter(
      (x) => x.topics && x.topics.includes("0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65")
    );
    const lastWdw = withdrawals[withdrawals.length - 1];

    const parsed = intf.parseLog({
      data: lastWdw.data,
      topics: lastWdw.topics,
    });
    return parsed.args.wad as BigNumber;
  }
}

async function parseKnownTransaction(
  pair: string,
  baseToken: string,
  quoteToken: string,
  chain: string,
  net
): Promise<ParsedTransactionResult> {
  let unknown = false;
  let nonEther = false;
  pair = web3.utils.toChecksumAddress(pair);
  baseToken = web3.utils.toChecksumAddress(baseToken);
  quoteToken = web3.utils.toChecksumAddress(quoteToken);
  const addresses = [web3.utils.toChecksumAddress(baseToken), web3.utils.toChecksumAddress(quoteToken)];
  const tokens = Object.values(config.networks[chain].tokens);
  if (addresses.find((x) => tokens.includes(x))) {
    nonEther = tokens.slice(1).includes(quoteToken);
  } else {
    unknown = true;
  }

  const pairMulti = Pair__factory.multicall(pair);
  const baseCtr = Erc20__factory.connect(baseToken, net.cli);
  const allBurned = await net.mcall.all(config.burnWallets.map((x) => pairMulti.balanceOf(x)));
  let burnedLp = 0;
  for await (const x of allBurned) {
    burnedLp += Number(ethers.utils.formatEther(x));
  }
  const quoteCtr = Erc20__factory.connect(quoteToken, net.cli);
  const [totalLp, reserves, token0] = await net.mcall.all([
    pairMulti.totalSupply(),
    pairMulti.getReserves(),
    pairMulti.token0(),
  ]);
  const { bid, qid } = await sortToken(token0, baseToken);
  const [baseLiq, quoteLiq] = [reserves[bid], reserves[qid]];
  const base: Token = {
    name: await baseCtr.name(),
    address: baseToken,
    decimal: await baseCtr.decimals(),
    symbol: await baseCtr.symbol(),
  };
  const quote: Token = {
    name: await quoteCtr.name(),
    address: quoteToken,
    decimal: await quoteCtr.decimals(),
    symbol: await quoteCtr.symbol(),
  };

  return {
    base: {
      ...base,
      id: bid,
      liq: nf.format(Number(Number(ethers.utils.formatUnits(baseLiq, base.decimal)))),
      rawLiq: Number(ethers.utils.formatUnits(baseLiq, base.decimal)),
    },
    quote: {
      ...quote,
      id: qid,
      liq: nf.format(Number(Number(ethers.utils.formatUnits(quoteLiq, quote.decimal)))),
      rawLiq: Number(ethers.utils.formatUnits(quoteLiq, quote.decimal)),
    },
    pair,
    totalLp,
    burnedLp,
    burnedLpRate: Number(
      (
        100 -
        ((Number(ethers.utils.formatEther(totalLp)) - burnedLp) / Number(ethers.utils.formatEther(totalLp))) * 100
      ).toFixed(2)
    ),
    nonEther,
    unknown,
    emptyLiq:
      Number(ethers.utils.formatUnits(baseLiq, base.decimal)) == 0 &&
      Number(ethers.utils.formatUnits(quoteLiq, quote.decimal)) == 0,
    isRugged:
      Number(ethers.utils.formatUnits(baseLiq, base.decimal)) != 0 &&
      Number(ethers.utils.formatUnits(quoteLiq, quote.decimal)) < 0.001,
  };
}

async function findLockedLp(
  baseToken: string,
  baseDecimal: number,
  pair: string,
  totalLp: BigNumber,
  chain: string,
  net
): Promise<AllLocks> {
  let lockedLp: LockedLp[] = [],
    lockedLpRate: number,
    totalLockedLp: BigNumber = ethers.BigNumber.from(0),
    totalLockedTokens: BigNumber = ethers.BigNumber.from(0),
    isLpToken: boolean,
    id: number,
    lockOwner: string,
    contractAddress: string,
    token: string,
    createdBy: string,
    createdAt: number,
    unlockTime: number | BigNumber,
    withdrawn: boolean,
    balance,
    totalSupply,
    dxExist = false;

  pair = web3.utils.toChecksumAddress(pair);
  baseToken = web3.utils.toChecksumAddress(baseToken);

  // let pink = Pinklock__factory.connect(config.networks.arbitrum.lockers.pinklock, net.cli);

  if (config.networks[chain].lockers.dxlp) {
    const dx = Dxlp__factory.connect(config.networks[chain].lockers.dxlp, net.cli);
    const [token0, token1] = [
      Number(
        ethers.utils.formatUnits(ethers.BigNumber.from((await dx.Token0LPLockerCount(baseToken)).toHexString()), 0)
      ),
      Number(
        ethers.utils.formatUnits(ethers.BigNumber.from((await dx.Token1LPLockerCount(baseToken)).toHexString()), 0)
      ),
    ];
    dxExist = token0 != 0 || token1 != 0;
  }

  if (config.networks[chain].lockers.onlymoons) {
    const onlyMoons = Onlymoons__factory.connect(config.networks[chain].lockers.onlymoons, net.cli);
    const onlymoonslockID = await onlyMoons.getTokenLockersForAddress(baseToken);
    if (onlymoonslockID.length > 0 && onlymoonslockID[0] > 0) {
      [isLpToken, id, contractAddress, lockOwner, token, createdBy, createdAt, unlockTime, balance, totalSupply] =
        await onlyMoons.getTokenLockData(onlymoonslockID[0]);
      token = web3.utils.toChecksumAddress(token);
      balance = ethers.BigNumber.from(balance.toHexString());
      totalSupply = ethers.BigNumber.from(totalSupply.toHexString());

      let quoteLpToken = "";
      if (isLpToken) {
        const pairMulti = Pair__factory.multicall(token);
        const [token0, token1] = await net.mcall.all([pairMulti.token0(), pairMulti.token1()]);
        token0 == baseToken ? (quoteLpToken = token1) : (quoteLpToken = token0);
        if (quoteLpToken != "" && Object.values(config.networks[chain].tokens).find((x) => x == quoteLpToken)) {
          lockedLpRate =
            100 -
            (Number(ethers.utils.formatEther(totalSupply.sub(balance))) /
              Number(ethers.utils.formatEther(totalSupply))) *
              100;
          lockedLp.push({
            dapp: "Onlymoons",
            isLpToken,
            id,
            contractAddress,
            lockOwner,
            token,
            createdBy,
            createdAt,
            unlockTime,
            balance: Number(ethers.utils.formatEther(ethers.BigNumber.from(balance.toHexString()))),
            totalSupply: Number(ethers.utils.formatEther(ethers.BigNumber.from(totalSupply.toHexString()))),
          });
        }
      } else {
        lockedLp.push({
          dapp: "Onlymoons",
          isLpToken,
          id,
          contractAddress,
          lockOwner,
          token,
          createdBy,
          createdAt,
          unlockTime,
          balance: Number(ethers.utils.formatEther(ethers.BigNumber.from(balance.toHexString()))),
          totalSupply: Number(ethers.utils.formatEther(ethers.BigNumber.from(totalSupply.toHexString()))),
        });
      }
    }
  }

  if (chain == "arbitrum") {
    const nitro = Nitrolocker__factory.connect(config.networks.arbitrum.lockers.nitro, net.cli);
    const nitroID = await nitro.getDepositsByTokenAddress(baseToken);
    const nitroPairID = await nitro.getDepositsByTokenAddress(pair);
    if (nitroID.length > 0) {
      for await (const id of nitroID) {
        [token, lockOwner, balance, unlockTime, withdrawn] = await nitro.lockedToken(id);
        unlockTime = ethers.BigNumber.from(unlockTime).toNumber();
        totalLockedTokens = totalLockedTokens.add(ethers.BigNumber.from(balance.toHexString()));
        if (!withdrawn)
          lockedLp.push({
            dapp: "NitroLocker",
            token,
            lockOwner,
            balance: Number(ethers.utils.formatUnits(ethers.BigNumber.from(balance.toHexString()), baseDecimal)),
            unlockTime,
            withdrawn,
          });
      }
    } else if (nitroPairID.length > 0) {
      for await (const id of nitroPairID) {
        [token, lockOwner, balance, unlockTime, withdrawn] = await nitro.lockedToken(id);
        unlockTime = ethers.BigNumber.from(unlockTime).toNumber();
        totalLockedLp = totalLockedLp.add(ethers.BigNumber.from(balance.toHexString()));
        if (!withdrawn)
          lockedLp.push({
            dapp: "NitroLocker",
            isLpToken: true,
            token,
            lockOwner,
            balance: Number(ethers.utils.formatEther(ethers.BigNumber.from(balance.toHexString()))),
            unlockTime,
            withdrawn,
          });
      }
      lockedLpRate = Number(
        (
          100 -
          (Number(ethers.utils.formatEther(totalLp.sub(totalLockedLp))) / Number(ethers.utils.formatEther(totalLp))) *
            100
        ).toFixed(2)
      );
    }
  }
  return {
    lockList: lockedLp,
    lockedLpRate: lockedLpRate,
    totalLockedTokens: Number(
      ethers.utils.formatUnits(ethers.BigNumber.from(totalLockedTokens.toHexString()), baseDecimal)
    ),
    totalLockedLp: Number(ethers.utils.formatEther(ethers.BigNumber.from(totalLockedLp.toHexString()))),
    dxExist,
  };
}

async function getMaxes(
  viewFuncs: FunctionFragment[],
  intr: Interface,
  address: string,
  decimal: number,
  net
): Promise<TokenMaxes> {
  const erc20 = new ethers.Contract(address, intr, net.cli);
  const calls = [];

  for (const func of viewFuncs) {
    const funcName = func.name.toLowerCase();

    if (funcName.includes("max")) {
      const callPromise = erc20[func.name]().then((result) => {
        if (result._isBigNumber) {
          const value = ethers.utils.formatUnits(ethers.BigNumber.from(result.toHexString()), decimal);

          if (funcName.includes("tx") || funcName.includes("transaction")) {
            return { maxTx: Number(value) };
          } else if (funcName.includes("wallet")) {
            return { maxWallet: Number(value) };
          } else if (funcName.includes("buy")) {
            return { maxBuy: Number(value) };
          } else if (funcName.includes("sell")) {
            return { maxSell: Number(value) };
          }
        }
      });

      calls.push(callPromise);
    }
  }

  const results = await Promise.all(calls);
  return results.reduce((acc, result) => ({ ...acc, ...result }), {});
}

async function getOwner(
  address: string,
  net,
  viewFuncs: FunctionFragment[],
  intr: Interface,
  isVerified: boolean
): Promise<Owner> {
  address = web3.utils.toChecksumAddress(address);
  let owner;
  if (isVerified) {
    const erc20 = new ethers.Contract(address, intr, net.cli);
    await Promise.allSettled(
      viewFuncs.map(async (func) => {
        const funcName = func.name.toLowerCase();
        if ((funcName.includes("get") && funcName.includes("owner")) || funcName.includes("owner")) {
          const call = await erc20.callStatic[func.name]();
          if (call.startsWith("0x")) owner = call;
        }
      })
    );
    return owner ? { owner: owner, renounced: config.burnWallets.find((x) => owner == x) ? true : false } : null;
  } else {
    const ctr = Erc20__factory.connect(address, net.cli);
    const query = await Promise.allSettled([ctr.owner(), ctr.getOwner()]);
    owner = query.find((x) => x.status == "fulfilled") as PromiseFulfilledResult<string>;

    return owner?.value != undefined
      ? { owner: owner?.value, renounced: config.burnWallets.find((x) => owner?.value == x) ? true : false }
      : null;
  }
}

async function findPairs(address: string, chain: string): Promise<Pair[]> {
  address = web3.utils.toChecksumAddress(address);
  const net = await getNet(chain);
  const pairs: Pair[] = [];

  for await (const [k, v] of Object.entries(config.networks[chain].contracts)) {
    const factoryMulti = Uniswap_factory__factory.multicall(v.factory);
    const calls = Object.entries(config.networks[chain].tokens).map(([token, value]) => {
      return { call: factoryMulti.getPair(web3.utils.toChecksumAddress(address), value), quote: value };
    });
    const results = await net.mcall.tryAll(calls.map((c) => c.call));
    results.forEach((search, i) => {
      const quote = calls[i].quote;
      if (search != "0x0000000000000000000000000000000000000000") {
        pairs.push({
          pair: web3.utils.toChecksumAddress(search),
          base: web3.utils.toChecksumAddress(address),
          quote: web3.utils.toChecksumAddress(quote),
          defi: k,
        });
      }
    });
  }
  return pairs;
}

async function sortToken(token0: string, base: string): Promise<{ bid: number; qid: number }> {
  return token0.toLowerCase() == base.toLowerCase() ? { bid: 0, qid: 1 } : { bid: 1, qid: 0 };
}

async function parseTransaction(pairAddress: string, chain: string): Promise<ParsedTransactionResult> {
  let baseToken: string;
  let quoteToken: string;
  let baseId: number;
  let quoteId: number;
  let unknown = false;
  let nonEther = false;
  const net = await getNet(chain);
  const pairContract = Pair__factory.connect(web3.utils.toChecksumAddress(pairAddress), net.cli);

  const addresses = [await pairContract.token0(), await pairContract.token1()];

  if (
    addresses.includes(config.networks[chain].tokens.WETH) ||
    addresses.includes(config.networks[chain].tokens.USDC)
  ) {
    quoteToken = addresses.find(
      (x) => x == config.networks[chain].tokens.WETH || x == config.networks[chain].tokens.USDC
    );
    baseToken = addresses.find((x) => x != quoteToken);
    baseId = addresses.indexOf(baseToken);
    quoteId = addresses.indexOf(quoteToken);
    nonEther = quoteToken == config.networks[chain].tokens.USDC;
  } else {
    baseToken = addresses[0];
    quoteToken = addresses[1];
    baseId = 0;
    quoteId = 1;
    unknown = true;
  }
  const baseCtr = Erc20__factory.connect(baseToken, net.cli);
  const quoteCtr = Erc20__factory.connect(quoteToken, net.cli);
  const base: Token = {
    address: baseToken,
    decimal: await baseCtr.decimals(),
    symbol: await baseCtr.symbol(),
  };
  const quote: Token = {
    address: quoteToken,
    decimal: await quoteCtr.decimals(),
    symbol: await quoteCtr.symbol(),
  };
  const reserves = await getReserves(pairContract, {
    base: baseId,
    quote: quoteId,
  });

  const baseLiq = ethers.utils.formatUnits(reserves.base, base.decimal);
  const quoteLiq = ethers.utils.formatUnits(reserves.quote, quote.decimal);

  return {
    base: {
      id: baseId,
      initLiq: baseLiq,
      initRawLiq: reserves.base,
      ...base,
    },
    quote: {
      id: quoteId,
      initLiq: quoteLiq,
      initRawLiq: reserves.quote,
      ...quote,
    },
    nonEther,
    pair: pairAddress,
    unknown,
  };
}
async function getReserves(contract, sorts: Sorts): Promise<Reserves> {
  const raw = await contract.getReserves();
  return {
    quote: sorts.quote == 0 ? raw._reserve0 : raw._reserve1,
    base: sorts.base == 0 ? raw._reserve0 : raw._reserve1,
  };
}

export { findPairs, parseKnownTransaction, Uniswap, extractOutput, findLockedLp, parseTransaction, getMaxes, getOwner };
