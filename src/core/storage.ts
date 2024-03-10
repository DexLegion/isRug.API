import { BigNumber } from "ethers";

import { StorageContract } from "../types";
import config from "../config";
import Web3 from "web3";
import { Erc20__factory } from "../abi/generated/";

import { getNet } from "../modules";
import _ from "lodash";

/**
 * Finds contracts in the storage.
 *
 * @param stor - An array of strings representing the storage.
 * @param chain - A string representing the chain.
 * @returns A promise that resolves to an array of StorageContract objects.
 */
async function findContracts(stor: string[], chain: string): Promise<StorageContract[]> {
  const result: StorageContract[] = [];
  const filtered = await stor
    .filter((x) => BigNumber.from(x)._hex.length == 42)
    .map((x) => BigNumber.from(x)._hex)
    .filter((e, i, a) => a.indexOf(e) === i);
  const net = await getNet(chain);
  for await (const x of filtered) {
    const code = await net.cli.getCode(x);
    if (code != "0x" && !config.wlContracts.find((y) => x.toLowerCase().includes(y.toLowerCase()))) {
      console.log(`${x} has contract`);
      const abi = await net.explorer.getSourceCode(x);
      const erc20 = Erc20__factory.multicall(x);
      if (!abi || (abi && !abi.SourceCode)) {
        try {
          const [name, symbol] = await net.mcall.all([erc20.name(), erc20.symbol()]);
          result.push({
            address: x,
            unknown: true,
            name,
            symbol,
            type: "token",
          });
        } catch {
          console.log(`${x} has no source code`);
          result.push({
            address: x,
            unknown: true,
            type: "unknown",
          });
        }
      } else {
        try {
          const [name, symbol] = await net.mcall.all([erc20.name(), erc20.symbol()]);
          if (name.toLowerCase().includes("lp")) {
            result.push({
              address: x,
              unknown: false,
              name,
              symbol,
              type: "lp",
            });
            continue;
          } else {
            result.push({
              address: x,
              unknown: false,
              name,
              symbol,
              type: "token",
            });
            continue;
          }
        } catch {
          result.push({
            address: x,
            unknown: false,
          });
        }
      }
    }
  }
  return result;
}

/**
 * Maps the storage values at the specified address and slots on the given chain.
 * Returns an array of non-zero storage values.
 *
 * @param address - The address to map the storage values from.
 * @param includedSlots - The slots to include in the mapping.
 * @param chain - The chain to perform the mapping on.
 * @returns A promise that resolves to an array of non-zero storage values.
 */
async function mapStorage(address: string, includedSlots: string[], chain: string): Promise<string[]> {
  const net = await getNet(chain);
  return _.compact(
    await Promise.all(
      includedSlots.map(async (slot) => {
        const data = await net.cli.getStorageAt(Web3.utils.toChecksumAddress(address), BigNumber.from("0x" + slot));

        if (data != "0x0000000000000000000000000000000000000000000000000000000000000000") {
          return data;
        }
      })
    )
  );
}
export { findContracts, mapStorage };
