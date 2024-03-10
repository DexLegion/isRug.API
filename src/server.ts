import fastifyExpress from "@fastify/express";
import {
  ASTNode,
  BaseASTNode,
  ContractDefinition,
  FunctionDefinition,
  ModifierDefinition,
} from "@solidity-parser/parser/dist/src/ast-types";
import axios from "axios";
import cors from "cors";
import { ethers } from "ethers";
import { FunctionFragment, Interface } from "ethers/lib/utils";
import fastify from "fastify";
import Web3 from "web3";
import { Erc20__factory, Pair__factory } from "./abi/generated/";
import config from "./config";
import CodeInspector from "./core/codeInspector";
import { getViewFuncs, scanMethods } from "./core/scanner";
import Scraper from "./core/scraper";
import { findContracts, mapStorage } from "./core/storage";
import { findLockedLp, findPairs, getMaxes, getOwner, parseKnownTransaction } from "./core/uniswap";
import { getNet } from "./modules";
import SimulatorV1 from "./core/simulatorV1";
import { Function, Functions, Method, Modifiers, Owner, ScanResult, TokenMaxes } from "./types";
import { findKeyByValue } from "./utils";
import { getErc20, getOwnerBalances, getToken, getTokenSupply, isErc20, parseBytecode } from "./utils/contract";

/**
 * The Fastify api instance.
 */
const app = fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
      },
    },
  },
  trustProxy: true,
});

app.get("/tokens/liq", async (req, res) => {
  const address = req.query["addr"];
  const chain = req.query["chain"];
  if (address && chain) {
    const net = await getNet(chain);
    const pairs = await findPairs(address, chain);
    const liqs = [];
    const locks = {};
    //
    //NEED FIX
    //
    if (pairs.length > 0) {
      const firstPair = await parseKnownTransaction(pairs[0].pair, pairs[0].base, pairs[0].quote, chain, net);
      const locks = await findLockedLp(
        firstPair.base.address,
        firstPair.base.decimal,
        firstPair.pair,
        firstPair.totalLp,
        chain,
        net
      );
      liqs.push({
        name: firstPair.quote.symbol,
        baseLiq: firstPair.base.liq,
        quoteLiq: firstPair.quote.liq,
        baseAddress: firstPair.base.address,
        quoteAddress: firstPair.quote.address,
        pair: firstPair.pair,
        rawBaseLiq: firstPair.base.rawLiq,
        rawQuoteLiq: firstPair.quote.rawLiq,
        emptyLiq: firstPair.emptyLiq,
        isRugged: firstPair.isRugged,
        totalLp: Number(ethers.utils.formatEther(firstPair.totalLp.toHexString())),
        burnedLp: firstPair.burnedLp,
        burnedLpRate: firstPair.burnedLpRate,
        defi: pairs[0].defi,
      });
      pairs.shift();
      for await (const x of pairs) {
        const y = await parseKnownTransaction(x.pair, x.base, x.quote, chain, net);
        liqs.push({
          name: y.quote.symbol,
          baseLiq: y.base.liq,
          quoteLiq: y.quote.liq,
          baseAddress: y.base.address,
          quoteAddress: y.quote.address,
          pair: y.pair,
          rawBaseLiq: y.base.rawLiq,
          rawQuoteLiq: y.quote.rawLiq,
          emptyLiq: y.emptyLiq,
          isRugged: y.isRugged,
          totalLp: Number(ethers.utils.formatEther(y.totalLp)),
          burnedLp: y.burnedLp,
          burnedLpRate: y.burnedLpRate,
          defi: x.defi,
        });
      }
      return { liqs, locks };
    } else {
      return { liqs, locks };
    }
  } else {
    res.send({ error: "Missing params.", code: Errors.INVALID_PARAMS });
  }
});

app.get("/tokens/scan:from", async function (req, res): Promise<ScanResult> {
  let address: string = req.query["addr"];
  const mode = req.query["mode"];
  const chain = req.query["chain"];
  let from = req.params["from"];
  if (address && mode && chain) {
    const net = await getNet(chain);
    const exp = net.explorer;
    address = Web3.utils.toChecksumAddress(address);
    let code = await net.cli.getCode(address, "latest");
    const eip1167 = isEip1167(code);
    if (eip1167) {
      address = eip1167;
      code = await net.cli.getCode(address, "latest");
    }

    if (mode == "basic") {
      const simulator = new SimulatorV1(chain);
      const result = await simulator.simulateToken(await getToken(address, chain));
      await simulator.destroy();
      return {
        result: result,
      };
    } else if (mode == "detailed") {
      const evm = await parseBytecode(code);
      const [std, token] = await Promise.all([mapStorage(address, evm.storageSlots, chain), getToken(address, chain)]);
      let sourceCode;
      let holders;
      const scraper = new Scraper(config.networks[chain].scanWeb, config.proxy);

      if (config.networks[chain].scanWeb) {
        holders = await scraper.getHolders(address, 10);
        sourceCode = await scraper.getContract(address);
      } else {
        sourceCode = await exp.getSourceCode(address);
      }

      let st = await findContracts([...std, ...evm.adrInCode], chain);
      st = st.filter((x) => x.symbol != token.symbol);

      let scn: Method[];
      let links: string[] = [];
      let hiddenMint = false;
      let hiddenOwner: Function[] = [];
      let balanceChange = false;
      let balanceChangeFunctions = [];
      let addresses: string[] = [];
      let viewFuncs: FunctionFragment[] = [];
      let maxes: TokenMaxes;
      let functions: FunctionDefinition[] = [];
      let mods: ModifierDefinition[] = [];
      let modifiers: Modifiers = {};
      let unknownModifiers: ModifierDefinition[] = [];
      let knownScammer: boolean;
      let afterRenounce: Function[] = [];
      let beforeRenounce: Function[] = [];
      let beforeUnknown: Function[] = [];
      let afterUnknown: Function[] = [];
      let findHid;
      let ownership: Owner;
      let balances = {
        wethBalance: 0,
        ethBalance: 0,
        usdcBalance: 0,
        tokenBalance: 0,
        contractBalance: 0,
      };
      let contractAge;
      let isBridged = false;
      let oldErc20: {}[] = [];
      let oldContracts: {}[] = [];

      if (sourceCode.SourceCode && sourceCode.ABI) {
        const intr = new Interface(JSON.parse(sourceCode.ABI));
        let contracts: ContractDefinition[] = [];
        let inspector: CodeInspector;
        if (sourceCode.multiSource) {
          contracts = Object.values(sourceCode.multiSource).flatMap((source: string) => {
            inspector = new CodeInspector(source);
            return inspector.getContracts();
          });
        } else {
          if (sourceCode.SourceCode.includes(`"sources":`)) {
            const sources = Object.values(
              JSON.parse(sourceCode.SourceCode.substring(1, sourceCode.SourceCode.length - 1)).sources
            );
            contracts = sources.flatMap((source: any) => {
              inspector = new CodeInspector(source.content);
              return inspector.getContracts();
            });
          } else {
            inspector = new CodeInspector(sourceCode.SourceCode);
            contracts = inspector.getContracts();
          }
        }
        //console.log(contracts);

        const filteredContracts = contracts.filter((contract) => contract.kind === "contract");

        const functionData = filteredContracts.flatMap((contract) =>
          contract.subNodes.filter(
            (node: FunctionDefinition): node is FunctionDefinition => node.type === "FunctionDefinition" && !!node.name
          )
        );
        [links, hiddenMint, mods, addresses, viewFuncs] = await Promise.all([
          inspector.extractLinks(),
          findHiddenMint(sourceCode.SourceCode),
          inspector.getModifiers(),
          extractAddress(sourceCode.SourceCode),
          getViewFuncs(intr),
        ]);

        [maxes, ownership] = await Promise.all([
          getMaxes(viewFuncs, intr, address, token.decimal, net),
          getOwner(address, net, viewFuncs, intr, true),
        ]);

        if (mods.length > 0) {
          const uModifiers = inspector.unknownModifiers(mods).filter((x) => x.hiddenOwner);
          unknownModifiers.push(...uModifiers);
          for (let mod of mods) {
            let name = mod.name;
            modifiers = {
              ...modifiers,
              [name]: {
                name,
                unknown: config.knownModifiers.find((x) => x == name) ? false : true,
                hiddenOwner: unknownModifiers.find((x) => x.name == name) ? true : false,
              },
            };
            findHid = Object.values(modifiers).find((x) => x.hiddenOwner);
          }
        }
        if (functionData.length > 0) {
          for (const func of functionData) {
            const name = func.name;
            const mods = func.modifiers;

            functions = {
              ...functions,
              [name]: {
                name,
                params: func.parameters.map((x) => x.name),
                modifiers: mods.map((x) => x.name),
              },
            };

            if (
              (func.visibility == "public" || func.visibility == "external") &&
              !(func.stateMutability == "pure" || func.stateMutability == "view")
            )
              if (!mods.find((x) => x.name == "onlyOwner")) {
                if (findHid && mods.some((y) => y.name === findHid.name)) {
                  hiddenOwner.push({
                    ...functions[name],
                    category: "Hidden Owner",
                  });
                } else
                  afterRenounce.push({
                    ...functions[name],
                    category: "After Renounce",
                  });
                if (mods.length > 0)
                  if (
                    mods.some((m) => {
                      const modifier = Object.values(modifiers).find((x) => x.name === m.name);
                      return modifier?.unknown && !modifier.hiddenOwner;
                    })
                  )
                    afterUnknown.push({
                      ...functions[name],
                      category: "Unknown After Renounce",
                    });
              } else {
                beforeRenounce.push({
                  ...functions[name],
                  category: "Before Renounce",
                });
                if (mods.length > 0)
                  if (
                    mods.some((m) => {
                      const modifier = Object.values(modifiers).find((x) => x.name === m.name);
                      return modifier?.unknown && !modifier.hiddenOwner;
                    })
                  )
                    beforeUnknown.push({
                      ...functions[name],
                      category: "Unknown Before Renounce",
                    });
              }

            const key = findKeyByValue(func.body, "+=");
            if (key) {
              const newKey = key.split(".").slice(0, -1).join(".");
              const obj = newKey.split(".").reduce((acc, cur) => acc[cur], func.body);
              const leftName = obj.left.name || obj.left.base?.name;
              const rightName = obj.right.name || obj.right.base?.name;
              func.parameters.some((x) => x.name == obj.left.name) ? (balanceChange = false) : (balanceChange = true);
              if (
                leftName &&
                rightName &&
                !leftName.toLowerCase().includes("balance") &&
                !leftName.toLowerCase().includes("towned") &&
                !rightName.toLowerCase().includes("fee") &&
                !rightName.toLowerCase().includes("amount")
              ) {
                balanceChange = true;
              } else {
                balanceChange = false;
              }
            }
          }
        }
        knownScammer = sourceCode.SourceCode?.includes(`revert("llllll")`);
        knownScammer = sourceCode.SourceCode?.includes(`uint256 private burnAmount = ( _totalSupply ) * 100000;`);
      } else {
        [scn, ownership] = await Promise.all([scanMethods(evm.methods), getOwner(address, net, null, null, false)]);
      }

      if (chain == "arbitrum" || chain == "bsc" || chain == "ethereum" || chain == "base") {
        let methodId;
        if (from) {
          from = Web3.utils.toChecksumAddress(from);
        } else {
          if (config.networks[chain].scanWeb) {
            const creation = await scraper.getCreation(address);
            from = creation.from;
            contractAge = creation.age;
          } else {
            const fromData = await exp.exportFrom(address);
            methodId = fromData.methodId;
            if (fromData) from = fromData.from;
          }
        }

        if (from) {
          if (!ownership) {
            //how we will understand is it renounced or not?
            ownership = {
              creator: from,
              renounced: false,
              fromMethod: methodId,
            };
          } else {
            if (ownership.renounced) {
              ownership.oldOwner = from;
              ownership.fromMethod = methodId;
            }
            if (ownership.oldOwner) {
              balances = await getOwnerBalances(ownership.oldOwner, address, token.decimal, chain);
            } else if (!ownership.renounced) {
              balances = await getOwnerBalances(ownership.owner, address, token.decimal, chain);
            }
          }

          const txs = await exp.exportTxs(from);
          const otherContracts = txs.filter((x) => x.input.startsWith("0x60806040" || "0x60001960" || "0x60a06040"));
          otherContracts.pop();

          await Promise.all(
            otherContracts.map(async (contract) => {
              const erc20 = await getErc20(contract.contractAddress, chain);
              if (contract.contractAddress.toLowerCase() != token.address.toLowerCase()) {
                if (erc20.isErc) {
                  oldErc20.push({
                    address: contract.contractAddress,
                    symbol: erc20.symbol,
                  });
                } else if (contract.contractAddress) {
                  oldContracts.push({ address: contract.contractAddress });
                }
              }
            })
          );
        }
      }

      return {
        isVerified: sourceCode.SourceCode ? true : false,
        links: links,
        contractAge: contractAge,
        contract: {
          storageScan: st,
          functions: sourceCode.SourceCode ? functions : scn,
          afterRenounce: afterRenounce,
          beforeRenounce: beforeRenounce,
          afterUnknown: afterUnknown,
          beforeUnknown: beforeUnknown,
          modifiers: modifiers,
          hiddenOwner: hiddenOwner,
          addresses: addresses,
        },
        warns: {
          hiddenMint: hiddenMint,
          balanceChange: balanceChange,
          knownScammer: knownScammer,
        },
        maxes: maxes,
        contractBalance: balances.contractBalance,
        ownership: {
          ...ownership,
          isBridged: isBridged,
          wethBalance: balances.wethBalance,
          ethBalance: balances.ethBalance,
          usdcBalance: balances.usdcBalance,
          tokenBalance: balances.tokenBalance,
          oldErc20: oldErc20,
          oldContracts: oldContracts,
        },
        holders: holders,
      };
    } else {
      res.send({ error: "Invalid mode", code: Errors.INVALID_PARAMS });
    }
  } else {
    res.send({
      error: "Required params: addr, mode, chain",
      code: Errors.INVALID_PARAMS,
    });
  }
});

app.get("/tokens/info", async function (req, res) {
  const address = req.query["addr"];
  const chain = req.query["chain"];
  const token = await getToken(address, chain);
  return token;
});

app.get("/tokens/supply", async function (req, res) {
  const address = req.query["addr"];
  const chain = req.query["chain"];
  const supply = await getTokenSupply(address, chain);
  return supply;
});

app.get("/chains", async function (req, res) {
  const address = req.query["addr"];
  const chains = await getChains(address);
  return chains;
});

app.get("/3rd/tokenList/cmc", async (req, res) => {
  const address = req.query["addr"];
  const url = "https://tokens.pancakeswap.finance/cmc.json";
  const data = (await axios.get(url)).data;
  return data.tokens.find((x) => x.address.toLowerCase() == address.toLowerCase()) ? true : false;
});

function isEip1167(code: string) {
  return code.length == 92 ? "0x" + code.substring(22, 62) : null;
}

async function findHiddenMint(text: string) {
  const regex = new RegExp("uint256\\s+private\\s+\\w+\\s*=\\s*\\d+\\s*\\*\\s*1e\\d+\\s*\\*\\s*10\\*\\*\\w+;", "gm");
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    matches.push(match[0]);
  }
  return matches.length > 0 ? true : false;
}

async function extractAddress(text: string) {
  const regex = new RegExp("0x[0-9A-Fa-f]{40}", "gi");
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (
      !config.burnWallets.find((x) => x == match[0]) &&
      !config.wlContracts.find((x) => x == match[0]) &&
      !matches.find((x) => x == match[0])
    )
      matches.push(match[0]);
  }
  return matches;
}

async function isPair(address: string, chain: string) {
  try {
    const net = await getNet(chain);
    const ctr = Pair__factory.connect(address, net.cli);
    await ctr.factory();
    return true;
  } catch (ex) {
    return false;
  }
}

async function checkChain(chain: string) {
  try {
    const net = await getNet(chain);
    await net.cli.getNetwork();

    return true;
  } catch (ex) {
    console.error(ex);

    return false;
  }
}

async function getChains(address: string) {
  try {
    const res = await Promise.all(
      Object.values(config.networks).map(async (x) => {
        if (x.name == "ethereum" || x.name == "bsc" || x.name == "arbitrum" || x.name == "base") {
          let isCode: boolean;
          const provider = new ethers.providers.JsonRpcProvider(x.rpc);
          await provider
            .getCode(address)
            .then((c) => {
              if (c != "0x") {
                console.log("Contract founded");
                return (isCode = true);
              }
            })
            .catch((ex) => {
              console.log(x.name + "Error - Chain is not accessible." + ex);
            });
          if (isCode) return x.name;
        }
      })
    );
    return res.filter((x) => x !== undefined);
  } catch (ex) {
    console.log(ex);
  }
}

enum PointScanType {
  Length,
  Storage,
  Tax,
  Gas,
  TotalFunction,
  Verified,
}
function toPoint(scanType: PointScanType, data, point: number): number {
  switch (scanType) {
    case PointScanType.Length:
      return data.length * point;

    case PointScanType.Storage:
      return data.filter((x) => x.unknown).length * point;

    case PointScanType.Tax:
      return data > 30 ? data * 1 : data * 0.3;
    case PointScanType.Gas:
      return data > 0.004 ? 3 : 0;
    case PointScanType.TotalFunction:
      return data.length > 50 ? 10 : 0;
    case PointScanType.Verified:
      return !data ? 50 : 0;
  }
}
async function loadApp() {
  await app.register(fastifyExpress);
  // await app.use(
  //   slowDown({
  //     windowMs: 1 * 60 * 1000, // 15 minutes
  //     delayAfter: 1000, // allow 100 requests per 15 minutes, then...
  //     delayMs: 5000,
  //     maxDelayMs: 60000,
  //     // onLimitReached(req, res, optionsUsed) {
  //     //   console.log(req.ip);
  //     //   res.status(429).send("Too Many Requests");
  //     // },
  //   })
  // );

  await app.use(
    cors({
      origin: "*",
    })
  );
  app.use("*", async (req, res, next) => {
    const userAgent = req.headers["user-agent"];
    const ip = req.socket.remoteAddress;
    if (ip == "localhost" || ip == "127.0.0.1" || ip == "::1" || userAgent.startsWith("Mozilla/5.0")) {
      next();
    } else {
      console.log("Anormal request detected from:", ip, "user-agent:", userAgent);
      //next();
      return res.send({ error: "Invalid request", code: "SERVER_CANT_HANDLE_THIS_REQUEST" });
    }
  });
  console.log("Starting server...");
  await app.listen({ port: 6457 });
  app.use("/token*", async function (req, res, next) {
    let address = req.query["addr"];

    let chain = req.query["chain"];
    if (address && chain) {
      try {
        address = address.toString().trim();
        chain = chain.toString().trim();
        if (config.networks[chain]) {
          const isact = await checkChain(chain);
          if (isact) {
            const caddr = Web3.utils.toChecksumAddress(address);
            const ispair = await isPair(caddr, chain);
            const iserc20 = await isErc20(caddr, chain);

            iserc20 && !ispair
              ? next()
              : res.send({
                  error: "Address is not ERC20 token",
                  code: Errors.NOT_ERC20,
                });
          } else {
            res.send({
              error: "Unable to access chain",
              code: Errors.CHAIN_NOT_ACCESSIBLE,
            });
          }
        } else {
          res.send({ error: "Invalid chain", code: Errors.INVALID_PARAMS });
        }
      } catch (ex) {
        console.error(ex);
        res.send({
          error: `Invalid address: ${address}`,
          code: Errors.INVALID_PARAMS,
        });
      }
    } else {
      res.send({
        error: "Missing address and chain",
        code: Errors.INVALID_PARAMS,
      });
    }
  });
}
enum Errors {
  INVALID_PARAMS = 101,
  CHAIN_NOT_ACCESSIBLE = 100,
  NOT_ERC20 = 102,
}
loadApp();
// if (cluster.isPrimary) {
//   for (let i = 0; i <= os.cpus().length; i++) {
//     cluster.fork();
//   }
//   cluster.on("exit", function (worker) {
//     console.log("Worker", worker.id, " has exited.");
//   });
// } else {
//   loadApp();
// }
