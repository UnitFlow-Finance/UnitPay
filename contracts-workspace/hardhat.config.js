require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");

// ---------------------------------------------------------------------------
// TESTNET ONLY. There is intentionally no mainnet network entry anywhere in
// this file — Arc mainnet does not publicly exist yet, and this project
// never targets any other chain's mainnet either. Network config mirrors
// UnitFlow-Finance's own established arcTestnet pattern (verified against
// UnitFlow-Finance/UnitFlowV4-contract's hardhat.config.js).
// ---------------------------------------------------------------------------

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Explicit even though it's solc 0.8.20's own default: avoids
      // accidentally emitting PUSH0 (introduced as the default target in
      // solc 0.8.24+/Shanghai) if this version is ever bumped without
      // first confirming Arc Testnet's EVM supports it.
      evmVersion: "paris",
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-hardhat",
    artifacts: "./artifacts",
  },

  networks: {
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    // Local-only network for running the test suite without any live RPC.
    hardhat: {},
  },

  etherscan: {
    apiKey: {
      arcTestnet: "no-api-key-needed",
    },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },

  sourcify: {
    enabled: false,
  },
};
