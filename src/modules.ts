import { ethers } from "ethers";
import config from "./config";

import { MongoClient } from "mongodb";
import { FBFunc, Method, Whitelist, users } from "./types";
import { Explorer } from "./utils/explorer";
import { IMulticallProvider, initMulticallProvider } from "@hovoh/ethcall";

interface Cli {
  [key: string]: ethers.providers.JsonRpcProvider;
}
interface Exp {
  [key: string]: Explorer;
}
interface MCall {
  [key: string]: IMulticallProvider;
}
const networks = Object.entries(config.networks);
const netMem = {};
const getNet = async (
  net: string
): Promise<{ mcall: IMulticallProvider; explorer: Explorer; cli: ethers.providers.JsonRpcProvider }> => {
  const [key, val] = networks.find(([key, val]) => key == net);
  const cli = new ethers.providers.JsonRpcProvider(val.rpc);
  if (netMem[net]) {
    return netMem[net];
  } else {
    const netw = {
      mcall: await initMulticallProvider(cli, val.chainId),
      explorer: new Explorer(val.scanApiKey, val.scanApi),
      cli,
    };
    netMem[net] = netw;
    return netw;
  }
};

const mongocli = new MongoClient("write-your-mongodb-uri");
const mongodb = mongocli.db("isrug");
const fbyte = mongodb.collection<FBFunc>("4byte");
const wlfc = mongodb.collection<Whitelist>("wl_functions");
const dbstor = mongodb.collection<Method>("func_storage");

export { getNet, fbyte, dbstor, wlfc, mongocli, mongodb };
