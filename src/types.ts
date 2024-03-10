import ethers, { BigNumber, ContractReceipt } from "ethers";
import { FunctionFragment, Interface } from "ethers/lib/utils";
import { Explorer } from "./utils/explorer";
import { ASTNode, ContractDefinition, FunctionDefinition, ModifierDefinition } from "@solidity-parser/parser/dist/src/ast-types";

type Pairs = {
  [key: string]: ParsedTransactionResult;
};

type ParsedTransactionResult = {
  pair?: string;
  unknown: boolean;
  base: ParsedToken;
  quote: ParsedToken;
  nonEther: boolean;
  emptyLiq?: boolean;
  isRugged?: boolean;
  totalLp?: BigNumber;
  burnedLp?: number;
  burnedLpRate?: number;
};

type AllLocks = {
  lockList: LockedLp[];
  lockedLpRate: number;
  totalLockedTokens: number;
  totalLockedLp: number;
  dxExist: boolean;
};

type LockedLp = {
  dapp: string;
  isLpToken?: boolean;
  id?: number;
  lockOwner: string;
  contractAddress?: string;
  token: string;
  createdBy?: string;
  createdAt?: number;
  unlockTime: number;
  balance: number;
  totalSupply?: number;
  withdrawn?: boolean;
};

type SwapArgs = {
  base: Token;
  quote: Token;
  amount: BigNumber;
  wallet: string;
  gasLimit: string;
  type: "buy" | "sell";
  minAmountOut?: number;
  gasPrice?: BigNumber;
};
type Abi = {
  abi: Interface;
  raw: string;
};
type SwapResult = {
  gasUsed: string;
  txHash: string;
  receipt: ContractReceipt;
  output: string;
  calculatedOutput?: string;
};
type ModuleSettings = {
  client: ethers.providers.Provider;
  wallet: ethers.Signer;
};
type Token = {
  name?: string;
  address: string;
  symbol: string;
  decimal: number;
};

type TokenMaxes = {
  maxTx?: number;
  maxWallet?;
  maxSell?: number;
  maxBuy?: number;
  maxTransfer?: number;
};

type Supply = {
  totalSupply?: string;
  burnedSupply?: string;
  burnedRate?: string;
  circulationSupply?: string;
};
interface ParsedToken extends Token {
  id?: number;
  liq?: string;
  rawLiq?: any;
  numLiq?: number;
  initLiq?: string;
  initRawLiq?: any;
}
type Pair = {
  pair: string;
  base: string;
  quote: string;
  defi?: string;
};

type Reserves = {
  base: BigNumber;
  quote: BigNumber;
};
type SimulationResult = {
  isSellable: boolean;
  failedState?: string;
  errorMessage?: string;
  sellTax?: string;
  buyTax?: string;
  buyGas?: number;
  sellGas?: number;
  transferError?: boolean;
};
type Method = { name: string; methodId: string; category?: string; categoryTags?: string[] };

type DetailedResult = {
  functions: Method[];
  storageScan: StorageContract[];
};
type ScanResult = {
  result?: SimulationResult;
  contract?: {
    storageScan: StorageContract[];
    functions: Method[] | FunctionDefinition[];
    afterRenounce?: Function[];
    beforeRenounce?: Function[];
    afterUnknown?: Function[];
    beforeUnknown?: Function[];
    modifiers?: Modifiers;
    hiddenOwner?: Function[];
    addresses?: string[];
  };
  warns?: {
    hiddenMint?: boolean;
    balanceChange?: boolean;
    knownScammer?: boolean;
  };
  isVerified?: boolean;
  links?: string[];
  maxes?: TokenMaxes;
  ownership?: Owner;
  contractBalance?: number;
  contractAge?: string;
  holders?: {};
};
type Functions = {
  [key: string]: Function;
};
type Function = {
  name: string;
  params?: any;
  modifiers?: string[];
  code?: any;
  category?: string;
};
type Modifiers = {
  [key: string]: {
    name: string;
    unknown: boolean;
    hiddenOwner: boolean;
    // body: any;
  };
};
type Owner = {
  owner?: string;
  creator?: string;
  oldOwner?: string;
  renounced: boolean;
  tokenBalance?: number;
  ethBalance?: number;
  wethBalance?: number;
  usdcBalance?: number;
  isBridged?: boolean;
  oldErc20?: {}[];
  oldContracts?: {}[];
  fromMethod?: string;
};
type StorageContract = {
  unknown: boolean;
  address: string;
  name?: string;
  symbol?: string;
  type?: string;
};
interface FBFunc {
  id: number;
  created_at: Date;
  text_signature: string;
  hex_signature: string;
  bytes_signature: string;
}
interface Whitelist {
  name: string;
  methodId: string;
  contract: string;
}
interface Blacklist {
  name: string;
  methodId: string;
  contract: string;
}

interface users {
  email: string;
  apiKey: string;
  active: true;
}
interface Network {
  [key: string]: {
    name: string;
    rpc: string;
    ws?: string;
    chainId: number;
    tokens: {
      WETH?: string;
      USDT?: string;
      USDC?: string;
      [key: string]: string;
    };
    contracts: {
      [key: string]: {
        factory: string;
        router: string;
      };
    };
    lockers?: {
      [key: string]: string;
    };
    scanApiKey?: string;
    scanApi?: string;
    scanWeb?: string;
  };
}
interface Chains {
  [key: string]: {
    tokens: {
      [key: string]: {
        info: ParsedToken;
        pairs: Pairs;
        locks: AllLocks;
        supply: Supply;
        scan: ScanResult;
        contractScan: DetailedResult;
      };
    };
  };
}
type RouterLogs = {
  balances: {
    before: BigNumber;
    after: BigNumber;
  };
  calculatedOutput: BigNumber;
  output: BigNumber;
};
type Sorts = {
  base: number;
  quote: number;
};
export {
  SwapResult,
  FBFunc,
  Whitelist,
  SwapArgs,
  ModuleSettings,
  ParsedTransactionResult,
  LockedLp,
  AllLocks,
  Reserves,
  SimulationResult,
  Token,
  TokenMaxes,
  Supply,
  ParsedToken,
  Method,
  Abi,
  StorageContract,
  ScanResult,
  Pair,
  Network,
  RouterLogs,
  Owner,
  Sorts,
  Functions,
  Function,
  Modifiers,
  users,
};
