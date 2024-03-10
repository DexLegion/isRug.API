import axios from "axios";
import cheerio from "cheerio";
import { HttpsProxyAgent } from "https-proxy-agent";
import config from "../config";
const instance = axios.create({
  baseURL: "https://arbiscan.io/contractsVerified",
  httpsAgent: new HttpsProxyAgent(
    `http://${config.proxy.username}:${config.proxy.password}@${config.proxy.host}:${config.proxy.port}`
  ),
});

/**
 * Retrieves a list of verified contracts from the specified URL.
 * @returns {string[]} An array of verified contract addresses.
 */
async function getVerifList() {
  const response = await instance.get("https://arbiscan.io/contractsVerified");
  const $ = cheerio.load(response.data);
  const tableRows = $("table tr");
  const tableData = [];
  tableRows.each((_, row) => {
    $(row)
      .find("td")
      .each((_, cell) => {
        if ($(cell).text().trim().length == 42) tableData.push($(cell).text().trim());
      });
  });
  return tableData;
}

export { getVerifList };
