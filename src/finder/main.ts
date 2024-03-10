import { InterceptingCall } from "@grpc/grpc-js";
import { ethers } from "ethers";
import web3 from "web3";
import { WebSocketServer } from "ws";
import {
  Dxlp__factory,
  Nitrolocker__factory,
  Onlymoons__factory,
  Pair__factory,
  Pinklock__factory,
  Uniswap_factory__factory,
} from "../abi/generated";
import config from "../config";
import { parseTransaction } from "../core/uniswap";
import { getErc20 } from "../utils/contract";
import { getVerifList } from "./axios";

(async () => {
  const client = new web3(
    new web3.providers.WebsocketProvider(config.networks.arbitrum.ws, {
      reconnect: {
        auto: true,
        delay: 300,
        maxAttempts: 1000,
        onTimeout: false,
      },
    })
  );
  const ecli = new ethers.providers.WebSocketProvider(config.networks.arbitrum.ws);
  const wsc = new WebSocketServer({ port: 9094 });
  wsc.on("connection", (ws) => {
    ws.setMaxListeners(1);
    console.log("New connection");
  });
  const broadcast = (data) => {
    wsc.clients.forEach((client) => {
      if (client.readyState == 1) {
        client.send(data);
      }
    });
  };

  const svcLog = await client.eth.subscribe(
    "logs",
    {
      topics: [
        [
          config.topics.mint,
          // config.topics.sync,
          // config.topics.creationOwnerhip,
          // config.topics.pairCreated,
          // config.topics.transfer,
          config.topics.nitrolock,
          config.topics.onlymoons,
          config.topics.pinklock,
          config.topics.nitrolock,
        ],
      ],
    },
    async (err, log) => {
      try {
        if (!err && log) {
          const tx = await ecli.getTransaction(log.transactionHash);
          if (tx) {
            const txReceipt = await tx.wait();
            if (tx.data.includes("0xe8e33700") || tx.data.includes("0xf305d719")) {
              const mintLog = txReceipt.logs.find((x) => x.topics.includes(config.topics.mint));
              const syncLog = txReceipt.logs.find((x) => x.topics.includes(config.topics.sync));
              const pairLog = txReceipt.logs.find((x) => x.topics.includes(config.topics.pairCreated));
              if (mintLog && syncLog) {
                const pairIntf = Pair__factory.createInterface();
                const mint = pairIntf.parseLog({
                  data: mintLog.data,
                  topics: mintLog.topics,
                });
                const sync = pairIntf.parseLog({
                  data: syncLog.data,
                  topics: syncLog.topics,
                });
                let token = "";
                if (pairLog) {
                  const factoryIntf = Uniswap_factory__factory.createInterface();
                  const parsed = factoryIntf.parseLog({
                    data: pairLog.data,
                    topics: pairLog.topics,
                  });
                  const isQuote = Object.values(config.networks.arbitrum.tokens).find((x) => x != parsed.args.token0);

                  token = isQuote ? parsed.args.token0 : parsed.args.token1;
                }
                const pair = syncLog.address;
                if (
                  mint.args.amount0.toString() == sync.args.reserve0.toString() &&
                  mint.args.amount1.toString() == sync.args.reserve1.toString()
                ) {
                  const data = await parseTransaction(pair, config.networks.arbitrum.name);
                  if (!config.blacklisted.name.find((x) => data.base.symbol.toLowerCase().includes(x))) {
                    console.log("New liquidity tx detected", data.base.address);
                    broadcast(JSON.stringify({ baseToken: data.base.address, type: "lp", from: tx.from }));
                  }
                }
              }
            } else if (
              tx.data.includes("0x60001960") ||
              tx.data.includes("0x60806040") ||
              tx.data.includes("0x60058054") ||
              tx.data.includes("0x60c06040") ||
              tx.data.includes("0x60008054") ||
              tx.data.includes("0x60098054") ||
              tx.data.includes("0xc6f6f44a")
            ) {
              const logs = txReceipt.logs.filter((x) => x.topics.includes(config.topics.transfer));
              console.log(logs);
              console.log("-------TOPICS----------");
              console.log(log.topics[0]);
              console.log(log.topics[1]);
              const ownerTransfer = txReceipt.logs.find((x) => x.topics.includes(config.topics.creationOwnerhip));
              console.log("Contract creation tx found.");
              if (ownerTransfer.address) {
                broadcast(JSON.stringify({ baseToken: ownerTransfer.address, type: "creation" }));
                return;
              }
              for await (log of logs) {
                if (
                  log.topics[0] == tx.from
                    ? log.topics[1] == "0x0000000000000000000000000000000000000000000000000000000000000000"
                    : log.topics[0] == "0x0000000000000000000000000000000000000000000000000000000000000000"
                ) {
                  console.log("New contract created", log.address);
                  broadcast(JSON.stringify({ baseToken: log.address, type: "creation" }));
                  break;
                }
              }
            }
            // else if (tx.data.includes("0x715018a6")) {
            //   let log = txReceipt.logs.find((x) => x.topics.includes(config.topics.creationOwnerhip));
            //   let log2 = txReceipt.logs.find((x) => x.topics.includes(config.topics.ownershipTransfer));
            //   if (log2.address) {
            //     console.log("Token renounced the ownership", log.address);
            //     broadcast(JSON.stringify({ baseToken: log2.address, type: "renounce" }));
            //   }
            //   if (log.address) {
            //     console.log("Token renounced the ownership", log.address);
            //     broadcast(JSON.stringify({ baseToken: log.address, type: "renounce" }));
            //   }
            // }
            else if (tx.data.includes("0x07279357")) {
              const log = txReceipt.logs.find((x) => x.topics.includes(config.topics.pinklock));
              const intf = Pinklock__factory.createInterface();
              const parsed = intf.parseLog({
                data: log.data,
                topics: log.topics,
              });

              const pairCtr = Pair__factory.connect(parsed.args.token, ecli);
              const [token0, token1] = [await pairCtr.token0(), await pairCtr.token1()];
              const token = Object.values(config.networks.arbitrum.tokens).find((x) => x == token0) ? token1 : token0;
              console.log("New pinksale LP locked detected!", parsed.args.token);
              broadcast(
                JSON.stringify({
                  baseToken: token,
                  pair: parsed.args.token,
                  type: "lock",
                  dapp: "pinksale",
                  id: parsed.args.id,
                  amount: parsed.args.amount,
                  unlockTime: parsed.args.unlockDate,
                  from: tx.from,
                })
              );
            } else if (tx.data.includes("0x7d533c1e")) {
              const log = txReceipt.logs.find((x) => x.topics.includes(config.topics.nitrolock));
              const intf = Nitrolocker__factory.createInterface();
              const parsed = intf.parseLog({
                data: log.data,
                topics: log.topics,
              });

              const pairCtr = Pair__factory.connect(parsed.args.token, ecli);
              const [token0, token1] = [await pairCtr.token0(), await pairCtr.token1()];
              const token = Object.values(config.networks.arbitrum.tokens).find((x) => x == token0) ? token1 : token0;
              console.log("New nitro LP locked detected!", parsed.args.token);
              broadcast(
                JSON.stringify({
                  baseToken: token,
                  pair: parsed.args.token,
                  type: "lock",
                  dapp: "nitroLocker",
                  id: parsed.args.id,
                  amount: parsed.args.amount,
                  from: tx.from,
                })
              );
            } else if (tx.data.includes("0xcde7cced")) {
              const log = txReceipt.logs.find((x) => x.topics.includes(config.topics.nitrolock));
              const intf = Onlymoons__factory.createInterface();
              const parsed = intf.parseLog({
                data: log.data,
                topics: log.topics,
              });

              const pairCtr = Pair__factory.connect(parsed.args.token, ecli);
              const [token0, token1] = [await pairCtr.token0(), await pairCtr.token1()];
              const token = Object.values(config.networks.arbitrum.tokens).find((x) => x == token0) ? token1 : token0;
              console.log("New onlymoons LP locked detected!", parsed.args.token);
              broadcast(
                JSON.stringify({
                  baseToken: token,
                  pair: parsed.args.token,
                  type: "lock",
                  dapp: "onlyMoons",
                  id: parsed.args.id,
                  amount: parsed.args.balance,
                  unlockTime: parsed.args.unlockTime,
                  from: tx.from,
                })
              );
            } else if (tx.data.includes("0xb1f74cdf")) {
              const log = txReceipt.logs.find((x) => x.topics.includes(config.topics.nitrolock));
              const intf = Dxlp__factory.createInterface();
              const parsed = intf.parseLog({
                data: log.data,
                topics: log.topics,
              });
              console.log("DxLockFound");
              console.log(parsed);
            }
          }
        }
      } catch (ex) {
        console.log(ex);
      }
    }
  );
  svcLog.on("connected", (x) => console.log(`Service (Log Listener) connected. SID: ${x}`));
  let veriflist = await getVerifList();
  setInterval(async () => {
    try {
      let newList = await getVerifList();
      for await (let token of newList.filter((x) => {
        if (!(veriflist.find((y) => y == x) != undefined)) return x;
      })) {
        let erc20 = await getErc20(token, "arbitrum");
        if (erc20.isErc) {
          if (!config.blacklisted.name.find((x) => erc20.symbol.toLowerCase().includes(x))) {
            console.log("Token verified the contract", token);
            broadcast(JSON.stringify({ baseToken: token, type: "verify" }));
          }
        }
      }
      veriflist = newList;
    } catch (ex) {
      console.log("Arbiscan data fetch failed", ex.code);
    }
  }, 20000);
})();
