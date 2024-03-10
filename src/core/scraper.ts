import axios, { AxiosInstance } from "axios";
import cio from "cheerio";
import { HttpsProxyAgent } from "https-proxy-agent";
export default class Scraper {
  axios: AxiosInstance;
  paths: { [key: string]: string };
  newDesign = false;
  constructor(url: string, proxy) {
    this.axios = axios.create({
      baseURL: url,
      httpsAgent: proxy
        ? new HttpsProxyAgent(`http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`)
        : undefined,
    });

    if (url == "https://etherscan.io/" || url == "https://bscscan.com/") {
      this.paths = {
        holders: "#ContentPlaceHolder1_resultrows > table > tbody",
        totalHolders:
          "#ctl00 > div.container.space-bottom-2.mt-4 > div.card > div.card-header.py-4 > div > div:nth-child(2) > span",
        circulatingSupply:
          "#ctl00 > div.container.space-bottom-2.mt-4 > div.card > div.card-header.py-4 > div > div:nth-child(1) > span",
        source: "#editor",
        multiSource: "#editor1",
        abi: "#js-copytextarea2",
        bytecode: "#verifiedbytecode2",
        hash: "#ContentPlaceHolder1_divTransactions > div.table-responsive > table > tbody > tr > td:nth-child(2) > div > span > a",
        age: "#ContentPlaceHolder1_divTransactions > div.table-responsive > table > tbody > tr > td.showAge > span",
        from: "#ContentPlaceHolder1_divTransactions > div.table-responsive > table > tbody > tr > td:nth-child(7) > div > a.js-clipboard.link-secondary",
      };
      this.newDesign = true;
    } else {
      this.paths = {
        holders: "#ContentPlaceHolder1_resultrows > table > tbody",
        totalHolders:
          "#ctl00 > div.container.space-bottom-2.mt-4 > div.card > div.card-header.py-4 > div > div:nth-child(2) > span",
        circulatingSupply:
          "#ctl00 > div.container.space-bottom-2.mt-4 > div.card > div.card-header.py-4 > div > div:nth-child(1) > span",
        source: "#editor",
        multiSource: "#editor1",
        abi: "#js-copytextarea2",
        bytecode: "#verifiedbytecode2",
        hash: "#paywall_mask > table > tbody > tr > td:nth-child(2) > span > a",
        age: "#paywall_mask > table > tbody > tr > td:nth-child(6) > span",
        from: "#paywall_mask > table > tbody > tr > td:nth-child(7) > span > a",
      };
    }
  }
  /**
   * Retrieves the holders of a token at a given address.
   * @param address - The address of the token.
   * @param range - The range of holders to retrieve (default: 10).
   * @returns An object containing the holders, total number of holders, and circulating supply.
   */
  async getHolders(address: string, range = 10) {
    const { data } = await this.axios.get(`token/tokenholderchart/${address}?range=${range}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      },
    });
    if (!data.includes("Maintenance")) {
      const scr = cio.load(data);
      const holders = scr(this.paths.holders)
        .children()
        .toArray()
        .map((el) => {
          if (this.newDesign) {
            return {
              address: scr(el).children().eq(1).children("div").children(".js-clipboard").attr("data-clipboard-text"),
              balance: scr(el).children().eq(2).text(),
              percent: scr(el).children().eq(3).text(),
            };
          } else {
            return {
              address: scr(el).children().eq(1).text(),
              balance: scr(el).children().eq(2).text(),
              percent: scr(el).children().eq(3).text(),
            };
          }
        });
      const totalHolders = scr(this.paths.totalHolders).text().split(":")[1]?.trim();
      const csupply = scr(this.paths.circulatingSupply).text().split(" Tokens")[0].replace("(", "")?.trim();
      //etherscan new design fix
      console.log("Consumed data", data.length / 1024, "KB");
      return { holders, totalHolders: totalHolders, circulatingSupply: csupply };
    } else {
      console.log("Rate limit");
    }
  }

  /**
   * Retrieves contract information for a given address.
   * @param address - The address of the contract.
   * @returns An object containing the contract's source code, multi-source code (if available), ABI, and bytecode.
   */
  async getContract(address: string) {
    const { data } = await this.axios.get(`token/${address}#code`);
    const splCtr = {};
    if (!data.includes("Maintenance")) {
      const scr = cio.load(data);
      let source: string;
      if (scr(this.paths.multiSource).length > 0) {
        const files = scr(".js-sourcecopyarea")
          .toArray()
          .map((x) => x.attribs["id"]);
        files.pop();
        const titles = scr(".justify-content-between")
          .toArray()
          .filter((x) => x.attribs["class"] == "d-flex justify-content-between")
          .map((x) => scr(x).text())
          .filter((x) => x != "Settings")
          .map((x) => x.split(":")[1]?.trim());

        for (let i = 0; i < files.length; i++) {
          splCtr[titles[i]] = scr(`#${files[i].trim()}`).text();
          source += scr(`#${files[i].trim()}\n`).text();
        }
      } else {
        source = scr(this.paths.source).text();
      }
      if (source?.startsWith("undefined")) source = source.split("undefined")[1];
      const abi = scr(this.paths.abi).text();
      const bytecode = scr(this.paths.bytecode).text();
      console.log("Consumed data", data.length / 1024, "KB");
      return {
        SourceCode: source,
        multiSource: Object.keys(splCtr).length >= 2 ? splCtr : null,
        ABI: abi,
        bytecode: bytecode,
      };
    } else {
      console.log("Rate limit");
    }
  }

  /**
   * Retrieves the creation transaction of a contract at a given address.
   * @param address - The address of the contract.
   * @returns An object containing the transaction hash, age, and from address.
   */
  async getCreation(address: string) {
    const { data } = await this.axios.get(`txs?a=${address}&f=5`, { proxy: false });
    if (!data.includes("Maintenance")) {
      const scr = cio.load(data);
      const hash = scr(this.paths.hash).text();
      const age = scr(this.paths.age).text();
      let from = "";
      if (this.newDesign) {
        from = scr(this.paths.from).attr("data-clipboard-text");
      } else {
        from = scr(this.paths.from).text();
      }

      console.log("Consumed data", data.length / 1024, "KB");

      return { hash, age, from };
    } else {
      console.log("Rate limit");
    }
  }
}
