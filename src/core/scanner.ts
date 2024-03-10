import { dbstor, fbyte, wlfc } from "../modules";
import { Method } from "../types";
import { parseBytecode } from "../utils/contract";
import _ from "lodash";
import config from "../config";
import { FunctionFragment, Interface } from "@ethersproject/abi";

/**
 * Scans the methods with the given method IDs and returns an array of Method objects.
 * If an ABI is provided, it uses the ABI to retrieve the method details.
 * If an ABI is not provided, it directly retrieves the method details.
 * The returned array of methods is sorted by category: Suspicious, Unknown, Known Method.
 *
 * @param methodids - An array of method IDs to scan.
 * @param abi - Optional ABI object to retrieve method details.
 * @returns An array of Method objects.
 */
async function scanMethods(methodids: string[], abi?: Interface): Promise<Method[]> {
  const functions: Method[] = [];
  if (abi) {
    const abiMethods = await getMethods(abi);
    for await (const id of methodids) {
      const method = abiMethods.find((x) => x.methodId == id);
      if (method) {
        functions.push(await getMethodWithoutDb(method.name, method.methodId));
      } else {
        functions.push(await getMethod(id));
      }
    }
  } else {
    for await (const id of methodids) {
      functions.push(await getMethod(id));
    }
  }
  return [
    ...functions.filter((x) => x.category == "Suspicious"),
    ...functions.filter((x) => x.category == "Unknown"),
    ...functions.filter((x) => x.category == "Known Method"),
  ];
}

/**
 * Retrieves the methods from the given ABI interface.
 * @param abi - The ABI interface.
 * @returns A promise that resolves to an array of Method objects.
 */
async function getMethods(abi: Interface): Promise<Method[]> {
  const methods: Method[] = [];
  for (const key of Object.entries(abi.functions)) {
    methods.push({
      name: key[0],
      methodId: await abi.getSighash(key[0]),
    });
  }
  return methods;
}

/**
 * Retrieves a Method object based on the provided methodId.
 * If the method is found in the cache, it is returned.
 * Otherwise, it searches for the method in the database collections and returns the corresponding Method object.
 * If the method is not found in the database collections, it returns a Method object with "Unknown" category and "Method is Unknown" name.
 * If the method is found in the database collections and is blacklisted, it returns a Method object with "Suspicious" category and the method's text signature as the name.
 * If the method is found in the database collections and is not blacklisted, it returns a Method object with "Known Method" category and the method's text signature as the name.
 *
 * @param methodId - The ID of the method to retrieve.
 * @returns A Promise that resolves to a Method object.
 */
async function getMethod(methodId: string): Promise<Method> {
  const cache = await dbstor.findOne({ methodId });
  if (cache) {
    return cache;
  } else {
    const wl = await wlfc.findOne({ methodId });
    const method = await fbyte.findOne({ hex_signature: methodId });
    if (method) {
      const bl = config.blacklisted.methods.filter((x) => method.text_signature.toLowerCase().includes(x));
      return {
        methodId,
        category: bl.length > 0 && !wl ? "Suspicious" : "Known Method",
        categoryTags: bl,
        name: method.text_signature,
      };
    } else {
      return { methodId, category: "Unknown", name: "Method is Unknown" };
    }
  }
}

/**
 * Retrieves a method without using the database.
 *
 * @param name - The name of the method.
 * @param methodId - The ID of the method.
 * @returns A Promise that resolves to the retrieved method.
 */
async function getMethodWithoutDb(name: string, methodId: string): Promise<Method> {
  const cache = await dbstor.findOne({ methodId });
  if (cache) {
    return cache;
  } else {
    const wl = await wlfc.findOne({ methodId });
    const bl = config.blacklisted.methods.filter((x) => name.toLowerCase().includes(x));
    const mh = { methodId, category: bl.length > 0 && !wl ? "Suspicious" : "Known Method", categoryTags: bl, name };
    await dbstor.insertOne(mh);
    return mh;
  }
}

/**
 * Retrieves all the view functions from the given ABI.
 * @param abi - The ABI (Application Binary Interface) object.
 * @returns A promise that resolves to an array of FunctionFragment objects representing the view functions.
 */
async function getViewFuncs(abi: Interface): Promise<FunctionFragment[]> {
  const fncs: FunctionFragment[] = [];
  for (const key of Object.entries(abi.functions)) {
    if (key[1].type == "function" && key[1].stateMutability == "view" && key[1].inputs.length == 0) {
      fncs.push(await abi.getFunction(key[0]));
    }
  }
  return fncs;
}
export { scanMethods, getViewFuncs };
