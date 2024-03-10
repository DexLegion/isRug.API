import axios from "axios";

function deadline(time: number) {
  //return Math.floor(Date.now() / 1000) + time;
  return Date.now() + 30000 * 60;
}
async function sleepAsync(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
function secConverter(ms) {
  var ms = ms,
    sec = (ms / 1000).toFixed(4);
  return sec;
}
async function getSymbolPrice(symbol: string): Promise<number> {
  const price = axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`).then((res) => res.data.price);
  return Number(price);
}

function findKeyByValue(obj: any, value: string, currentKey = ""): string | null {
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      const result = findKeyByValue(obj[key], value, `${currentKey}${key}.`);
      if (result) {
        return result;
      }
    } else if (typeof obj[key] === "string" && obj[key].includes(value)) {
      return `${currentKey}${key}`;
    }
  }
  return null;
}
export { deadline, sleepAsync, secConverter, getSymbolPrice, findKeyByValue };
