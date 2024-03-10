import "isomorphic-fetch";
import { BscScan } from "@jpmonette/bscscan";
import config from "../config";

import { Abi, Method } from "../types";
import { Interface } from "ethers/lib/utils";
import { sleepAsync } from "./index";

class Explorer {
  public client: BscScan;
  constructor(apikey?: string, baseUrl?: string) {
    this.client = new BscScan({ apikey, baseUrl });
  }

  async exportFrom(address: string) {
    try {
      const tokenTxList = await this.client.accounts.getTxList({
        address,
        endblock: 99999999,
        startblock: 0,
        offset: 500,
      });

      if (tokenTxList[0]) {
        return { from: tokenTxList[0].from, methodId: tokenTxList[0].input.slice(0, 10) };
      }
    } catch {
      return null;
    }
  }

  async exportTxs(address: string, count = 500) {
    try {
      const tokenTxList = await this.client.accounts.getTxList({
        address,
        endblock: 99999999,
        startblock: 0,
        offset: count,
      });

      if (tokenTxList.length > 0) {
        return tokenTxList;
      }
    } catch {
      return [];
    }
  }

  async getBnbPrice(): Promise<string> {
    const data = await this.client.stats.getBNBLastPrice();
    const bnbPrice = data.ethusd;
    return bnbPrice;
  }

  async getBnbBalance(address: string): Promise<string> {
    const balance = await this.client.accounts.getBalance({ address: address });
    return balance;
  }

  async getAbi(baseToken: string): Promise<Abi> {
    try {
      const abi = await this.client.contracts.getAbi({
        address: baseToken,
      });
      const abitf = new Interface(abi);
      return {
        abi: abitf,
        raw: abi,
      };
    } catch (err) {
      return null;
    }
  }
  async getSourceCode(addr: string) {
    let done = false;
    let trycount = 0;
    while (!done && trycount <= 4) {
      let source;
      trycount++;
      await this.client.contracts
        .getSourceCode({
          address: addr,
        })
        .then((x) => {
          source = x[x.length - 1];
          done = true;
        })
        .catch(async (ex) => {
          await sleepAsync(500);
        });
      return source;
    }
  }
  async getCirculatingSupply(token: string) {
    try {
      const supply = await this.client.query("stats", "tokenCsupply", {
        contractaddress: token,
      });

      return supply;
    } catch (ex) {
      console.error(ex);
      return null;
    }
  }
}

export { Explorer };
