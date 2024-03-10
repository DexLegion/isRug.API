import web3 from "web3";
import { Network } from "./types";

//https://onlymoons.gitbook.io/docs/supported-networks

const networks: Network = {
  ethereum: {
    name: "ethereum",
    rpc: "write-your-rpc",
    chainId: 1,
    contracts: {
      mainswap: {
        router: web3.utils.toChecksumAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"), //Uniswap
        factory: web3.utils.toChecksumAddress("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"), //Uniswap
      },
      sushiswap: {
        router: web3.utils.toChecksumAddress("0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f"),
        factory: web3.utils.toChecksumAddress("0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"),
      },
      shibaswap: {
        router: web3.utils.toChecksumAddress("0x03f7724180aa6b939894b5ca4314783b0b36b329"),
        factory: web3.utils.toChecksumAddress("0x115934131916C8b277DD010Ee02de363c09d037c"),
      },
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      onlymoons: web3.utils.toChecksumAddress("0x7BF2f06D65b5C9f146ea79a4eCC7C7cdFC01B613"),
      unicrypt: web3.utils.toChecksumAddress("0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214"),
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
      USDC: web3.utils.toChecksumAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
      USDT: web3.utils.toChecksumAddress("0xdac17f958d2ee523a2206206994597c13d831ec7"),
      BUSD: web3.utils.toChecksumAddress("0x4fabb145d64652a948d72533023f6e7a623c7c53"),
    },
    scanApi: "https://api.etherscan.io/api",
    // scanWeb: "https://etherscan.io/", // to not use etherscan
    scanApiKey: "write-your-api-key",
  },
  ethereumclassic: {
    name: "ethereumclassic",
    rpc: "https://geth-de.etc-network.info",
    chainId: 61,
    contracts: {
      mainswap: {
        factory: web3.utils.toChecksumAddress("0x09fafa5eecbc11c3e5d30369e51b7d9aab2f3f53"), //Hebeswap
        router: web3.utils.toChecksumAddress("0xEcBcF5C7aF4c323947CFE982940BA7c9fd207e2b"), //Hebeswap
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0x82A618305706B14e7bcf2592D4B9324A366b6dAd"),
      BUSDT: web3.utils.toChecksumAddress("0xCC48CD0B4a6f50b8f8bf0f9b80eD7881fA547968"),
      USDT: web3.utils.toChecksumAddress("0xE411107D661f722598B4956820292dc82eD1507C"),
      USDC: web3.utils.toChecksumAddress("0xC1Be9a4D5D45BeeACAE296a7BD5fADBfc14602C4"),
    },
    scanApi: "https://blockscout.com/etc/mainnet/api",
  },
  base: {
    name: "base",
    rpc: "write-your-rpc",
    chainId: 8453,
    contracts: {
      mainswap: {
        router: web3.utils.toChecksumAddress("0x327df1e6de05895d2ab08513aadd9313fe505d86"),
        factory: web3.utils.toChecksumAddress("0xfda619b6d20975be80a10332cd39b9a4b0faa8bb"),
      },
      // babyswap: {
      //   router: web3.utils.toChecksumAddress("0x8317c460c22a9958c27b4b6403b98d2ef4e2ad32"),
      //   factory: web3.utils.toChecksumAddress("0x86407bea2078ea5f5eb5a52b2caa963bc1f889da"),
      // },
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0x17e8c87d4de42fc143507B7c45Da2e6F2af7F24F"),
      dxtoken: web3.utils.toChecksumAddress("0x0dDdD88aff5b7082BEf86923cf19BAd1ffb4EC8C"),
      onlymoons: web3.utils.toChecksumAddress("0x77110f67C0EF3c98c43570BADe06046eF6549876"),
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0x4200000000000000000000000000000000000006"),
      // BUSD: web3.utils.toChecksumAddress("0xe9e7cea3dedca5984780bafc599bd69add087d56"),
      // USDT: web3.utils.toChecksumAddress("0x55d398326f99059fF775485246999027B3197955"),
      // USDC: web3.utils.toChecksumAddress("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"),
    },
    scanWeb: "https://basescan.org/",
    scanApiKey: "write-your-api-key",
  },

  bsc: {
    name: "bsc",

    rpc: "write-your-rpc",
    chainId: 56,
    contracts: {
      mainswap: {
        router: web3.utils.toChecksumAddress("0x10ed43c718714eb63d5aa57b78b54704e256024e"),
        factory: web3.utils.toChecksumAddress("0xca143ce32fe78f1f7019d7d551a6402fc5350c73"),
      },
      babyswap: {
        router: web3.utils.toChecksumAddress("0x8317c460c22a9958c27b4b6403b98d2ef4e2ad32"),
        factory: web3.utils.toChecksumAddress("0x86407bea2078ea5f5eb5a52b2caa963bc1f889da"),
      },
      apeswap: {
        router: web3.utils.toChecksumAddress("0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7"),
        factory: web3.utils.toChecksumAddress("0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6"),
      },
      biswap: {
        router: web3.utils.toChecksumAddress("0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8"),
        factory: web3.utils.toChecksumAddress("0x858e3312ed3a876947ea49d572a7c42de08af7ee"),
      },
      mdex: {
        router: web3.utils.toChecksumAddress("0x62c1a0d92b09d0912f7bb9c96c5ecdc7f2b87059"),
        factory: web3.utils.toChecksumAddress("0x3cd1c46068daea5ebb0d3f55f6915b10648062b8"),
      },
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      onlymoons: web3.utils.toChecksumAddress("0x016c1D8cf86f60A5382BA5c42D4be960CBd1b868"),
      unicrypt: web3.utils.toChecksumAddress("0xc765bddb93b0d1c1a88282ba0fa6b2d00e3e0c83"),
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"),
      BUSD: web3.utils.toChecksumAddress("0xe9e7cea3dedca5984780bafc599bd69add087d56"),
      USDT: web3.utils.toChecksumAddress("0x55d398326f99059fF775485246999027B3197955"),
      USDC: web3.utils.toChecksumAddress("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"),
    },
    scanWeb: "https://bscscan.com/",
    scanApiKey: "write-your-api-key",
  },
  dogechain: {
    name: "dogechain",
    rpc: "write-your-rpc",
    chainId: 2000,
    contracts: {
      mainswap: {
        factory: web3.utils.toChecksumAddress("0xD27D9d61590874Bf9ee2a19b27E265399929C9C3"),
        router: web3.utils.toChecksumAddress("0xa4EE06Ce40cb7e8c04E127c1F7D3dFB7F7039C81"),
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0xB7ddC6414bf4F5515b52D8BdD69973Ae205ff101"),
      BUSD: web3.utils.toChecksumAddress("0x332730a4F6E03D9C55829435f10360E13cfA41Ff"),
      USDT: web3.utils.toChecksumAddress("0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D"),
      USDC: web3.utils.toChecksumAddress("0x765277EebeCA2e31912C9946eAe1021199B39C61"),
    },
    lockers: {
      // dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      // dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      onlymoons: web3.utils.toChecksumAddress("0x016c1D8cf86f60A5382BA5c42D4be960CBd1b868"),
    },
    scanApi: "https://explorer.dogechain.dog/api",
  },

  avalanche: {
    name: "avalanche",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    chainId: 43114,
    contracts: {
      mainswap: {
        factory: web3.utils.toChecksumAddress("0x9ad6c38be94206ca50bb0d90783181662f0cfa10"), //TraderJoe
        router: web3.utils.toChecksumAddress("0x60ae616a2155ee3d9a68541ba4544862310933d4"), //TraderJoe
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"),
      USDT: web3.utils.toChecksumAddress("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"),
      USDTe: web3.utils.toChecksumAddress("0xc7198437980c041c805A1EDcbA50c1Ce5db95118"),
      USDC: web3.utils.toChecksumAddress("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"),
      USDCe: web3.utils.toChecksumAddress("0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"),
      MIM: web3.utils.toChecksumAddress("0x130966628846BFd36ff31a822705796e8cb8C18D"),
      DAI: web3.utils.toChecksumAddress("0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"),
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      onlymoons: web3.utils.toChecksumAddress("0x016c1D8cf86f60A5382BA5c42D4be960CBd1b868"),
    },
    scanApi: "https://api.snowtrace.io/api",
    scanWeb: "https://snowtrace.io/",
    scanApiKey: "write-your-api-key",
  },
  fantom: {
    name: "fantom",
    rpc: "https://rpcapi.fantom.network",
    chainId: 250,
    contracts: {
      mainswap: {
        factory: web3.utils.toChecksumAddress("0x152ee697f2e276fa89e96742e9bb9ab1f2e61be3"), //Spookyswap
        router: web3.utils.toChecksumAddress("0xf491e7b69e4244ad4002bc14e878a34207e38c29"), //Spookyswap
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83"),
      DAI: web3.utils.toChecksumAddress("0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E"),
      FUSDT: web3.utils.toChecksumAddress("0x049d68029688eAbF473097a2fC38ef61633A3C7A"),
      USDC: web3.utils.toChecksumAddress("0x04068DA6C83AFCFA0e13ba15A6696662335D5B75"),
      MIM: web3.utils.toChecksumAddress("0x82f0B8B456c1A451378467398982d4834b6829c1"),
      ETH: web3.utils.toChecksumAddress("0x74b23882a30290451A17c44f4F05243b6b58C76d"),
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
    },
    scanApi: "https://api.ftmscan.com/api",
    scanWeb: "https://ftmscan.com/",
    scanApiKey: "write-your-api-key",
  },
  cronos: {
    name: "cronos",
    rpc: "write-your-rpc",
    chainId: 25,
    contracts: {
      mainswap: {
        factory: web3.utils.toChecksumAddress("0xd590cC180601AEcD6eeADD9B7f2B7611519544f4"), //MMFinance
        router: web3.utils.toChecksumAddress("0x145677FC4d9b8F19B5D56d1820c48e0443049a30"), //MMFinance
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23"),
      // SVN: web3.utils.toChecksumAddress("0x654bAc3eC77d6dB497892478f854cF6e8245DcA9"),
      USDT: web3.utils.toChecksumAddress("0x66e428c3f67a68878562e79A0234c1F83c208770"),
      USDC: web3.utils.toChecksumAddress("0xc21223249CA28397B4B6541dfFaEcC539BfF0c59"),
      MUSD: web3.utils.toChecksumAddress("0x95aEaF383E2e86A47c11CffdE1F7944eCB2C38C2"),
      MMF: web3.utils.toChecksumAddress("0x97749c9B61F878a880DfE312d2594AE07AEd7656"),
      DAI: web3.utils.toChecksumAddress("0xF2001B145b43032AAF5Ee2884e456CCd805F677D"),
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      onlymoons: web3.utils.toChecksumAddress("0x016c1D8cf86f60A5382BA5c42D4be960CBd1b868"),
    },
    scanApi: "https://api.cronoscan.com/api",
    scanWeb: "https://cronoscan.com/",
    scanApiKey: "write-your-api-key",
  },
  polygon: {
    name: "polygon",
    rpc: "write-your-rpc",
    chainId: 137,
    contracts: {
      mainswap: {
        router: web3.utils.toChecksumAddress("0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff"), //Quickswap
        factory: web3.utils.toChecksumAddress("0x5757371414417b8c6caad45baef941abc7d3ab32"), //Quickswap
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"),
      USDC: web3.utils.toChecksumAddress("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"),
      USDT: web3.utils.toChecksumAddress("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
      ETH: web3.utils.toChecksumAddress("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"),
      DAI: web3.utils.toChecksumAddress("0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"),
    },
    lockers: {
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      onlymoons: web3.utils.toChecksumAddress("0x016c1D8cf86f60A5382BA5c42D4be960CBd1b868"),
    },
    scanApi: "https://api.polygonscan.com/api",
    scanWeb: "https://polygonscan.com/",
    scanApiKey: "write-your-api-key",
  },

  arbitrum: {
    name: "arbitrum",
    rpc: "write-your-rpc",
    ws: "write-your-ws",
    chainId: 42161,
    contracts: {
      mainswap: {
        router: web3.utils.toChecksumAddress("0x1b02da8cb0d097eb8d57a175b88c7d8b47997506"), //Sushiswap
        factory: web3.utils.toChecksumAddress("0xc35dadb65012ec5796536bd9864ed8773abc74c4"), //Sushiswap
      },
      // uniswapv2: {
      //   router: web3.utils.toChecksumAddress("0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"), //Uniswap
      //   factory: web3.utils.toChecksumAddress("0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f"), //Uniswap factory v2
      // },
      // uniswapv3: {
      //   router: web3.utils.toChecksumAddress("0xe592427a0aece92de3edee1f18e0157c05861564"), //Uniswap
      //   factory: web3.utils.toChecksumAddress("0x1f98431c8ad98523631ae4a59f267346ea31f984"), //Uniswap factory v2
      // },
      oreoswap: {
        router: web3.utils.toChecksumAddress("0x38eed6a71a4dda9d7f776946e3cfa4ec43781ae6"), //oreoswap
        factory: web3.utils.toChecksumAddress("0x20fafd2b0ba599416d75eb54f48cda9812964f46"), //oreoswap
      },
      camelot: {
        router: web3.utils.toChecksumAddress("0xc873fecbd354f5a56e00e710b90ef4201db2448d"), //camelot
        factory: web3.utils.toChecksumAddress("0x6eccab422d763ac031210895c81787e87b43a652"), //camelot
      },
      swapfish: {
        router: web3.utils.toChecksumAddress("0xcdaec65495fa5c0545c5a405224214e3594f30d8"), //fishswap
        factory: web3.utils.toChecksumAddress("0x71539d09d3890195dda87a6198b98b75211b72f3"), //fishswap
      },
    },
    tokens: {
      WETH: web3.utils.toChecksumAddress("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"),
      USDC: web3.utils.toChecksumAddress("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"),
      USDT: web3.utils.toChecksumAddress("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
      DAI: web3.utils.toChecksumAddress("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"),
    },
    lockers: {
      onlymoons: web3.utils.toChecksumAddress("0x016c1D8cf86f60A5382BA5c42D4be960CBd1b868"),
      nitro: web3.utils.toChecksumAddress("0xDE419671df0Fd20A2687192c1c55B33582136b19"),
      dxlp: web3.utils.toChecksumAddress("0xFEE2A3f4329e9A1828F46927bD424DB2C1624985"),
      dxtoken: web3.utils.toChecksumAddress("0x983b00a2C3d8925cEDfC9f3eb5Df1aE121Ff6B9F"),
      pinklock: web3.utils.toChecksumAddress("0xebb415084ce323338cfd3174162964cc23753dfd"),
    },
    scanApi: "https://api.arbiscan.io/api",
    scanWeb: "https://arbiscan.io/",
    scanApiKey: "write-your-api-key",
  },
};
const cfg = {
  networks,

  defaultGasLimit: "7000000", // 6721975;
  wlContracts: [
    "0x55d398326f99059ff775485246999027b3197955", //USDT
    "0x73feaa1eE314F8c655E354234017bE2193C9E24E", //Pancake Main Staking
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", //WBNB
    "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506", //Arbitrum sushiswap router
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", //Arbitrum WETH
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", //USDC Arbitrum
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", //Sushi router Arbitrum
    "0xd4d42F0b6DEF4CE0383636770eF773390d85c61A", //Sushi Token Arbitrum
  ],
  knownModifiers: [
    "onlyOwner",
    "view",
    "pure",
    "external",
    "internal",
    "public",
    "private",
    "override",
    "onlyToken",
    "payable",
    "virtual",
  ],

  burnWallets: [
    "0x000000000000000000000000000000000000dEaD",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
    "0x0000000000000000000000000000000000000003",
    "0x0000000000000000000000000000000000000004",
    "0x0000000000000000000000000000000000000005",
    "0x0000000000000000000000000000000000000006",
    "0x0000000000000000000000000000000000000007",
  ],
  topics: {
    mint: "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
    sync: "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
    pairCreated: "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9",
    creationOwnerhip: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
    ownershipTransfer: "0x04dba622d284ed0014ee4b9a6a68386be1a4c08a4913ae272de89199cc686163",
    transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    pinklock: "0x694af1cc8727cdd0afbdd53d9b87b69248bd490224e9dd090e788546506e076f",
    nitrolock: "0x49eaf4942f1237055eb4cfa5f31c9dfe50d5b4ade01e021f7de8be2fbbde557b",
    dxlock: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
    onlymoons: "0x531cba00a411ade37b4ca8175d92c94149f19536bd8e5a83d581aa7f040d192e",
  },
  blacklisted: {
    name: ["test", "dont", "do not", "donot", "scam", "honey", "honeypot", "rug", "wrapped", "dai", "usd"],
    methods: [
      "fee",
      "tax",
      "limit",
      "max",
      "percent",
      "tx",
      "lock",
      "black",
      "block",
      "sniper",
      "bot",
      "trade",
      "ban",
      "liquify",
      "scope",
      "enable",
      "remove",
      "sell",
      "buy",
      "liquidity",
      "switch",
    ],
  },
  blacklistedCodes: {
    _transfer: [
      "txCheck(sender, recipient, amount); checkTradingAllowed(sender, recipient); checkMaxWallet(sender, recipient, amount); checkSwapBack(sender, recipient); checkMaxTx(sender, recipient, amount); swapBack(sender, recipient, amount); uint256 amountReceived = burnAmount; _balances[sender] = _balances[sender].sub(amount); if (sender!=recipient || shouldTakeFee(sender, recipient))amountReceived = shouldTakeFee(sender, recipient) ? takeFee(sender, recipient, amount) : amount; _balances[recipient] = _balances[recipient].add(amountReceived); emit Transfer(sender, recipient, amountReceived);",
    ],
  },

  // Proxy for cloudflare bot protection pass
  proxy: {
    host: "write-your-host",
    port: 8899,
    username: "write-your-username",
    password: "write-your-password",
  },
};

export default cfg;
