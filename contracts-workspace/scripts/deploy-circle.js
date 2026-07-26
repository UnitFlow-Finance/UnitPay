// Deploys a UnitPay contract to Arc Testnet via Circle's Smart Contract
// Platform SDK, signing from a Circle Developer-Controlled Wallet instead
// of a raw private key.
//
// Why this path instead of scripts/deploy.js (ethers.js + Hardhat):
// This environment has no funded raw Arc Testnet private key. Circle's
// Contracts SDK deploys using a wallet it custodies (via the registered
// entity secret), so a raw key never needs to exist locally.
//
// Requires (see .env.local):
//   CIRCLE_API_KEY       - Circle Web3 Services API key
//   CIRCLE_ENTITY_SECRET - Entity secret registered via registerEntitySecretCiphertext()
//   CIRCLE_DEPLOYER_WALLET_ID - id of a Developer-Controlled wallet on Arc
//                               Testnet, funded with native USDC for gas.
//
// Usage:
//   node scripts/deploy-circle.js <ContractName> [constructorArg1 constructorArg2 ...]
//   node scripts/deploy-circle.js UnitPayEscrow 0x3600000000000000000000000000000000000000
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const { initiateSmartContractPlatformClient } = require("@circle-fin/smart-contract-platform");
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");

const ARC_TESTNET_BLOCKCHAIN = "ARC-TESTNET";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

async function pollContract(scpClient, contractId, { intervalMs = 4000, timeoutMs = 5 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await scpClient.getContract({ id: contractId });
    const contract = response.data.contract;
    console.log(`  status=${contract.status} txHash=${contract.txHash ?? "(pending)"}`);
    if (contract.status === "COMPLETE") {
      return contract;
    }
    if (contract.status === "FAILED") {
      throw new Error(
        `Contract deployment failed: ${contract.deploymentErrorReason ?? "unknown"} ${
          contract.deploymentErrorDetails ?? ""
        }`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for contract deployment to complete.");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function writeDeploymentRecord(contractName, contract, walletId, deployerAddress, contractId) {
  const outPath = path.join(__dirname, "..", "deployments.arcTestnet.json");
  const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
  const key = contractName.charAt(0).toLowerCase() + contractName.slice(1);
  const updated = {
    ...existing,
    [key]: contract.contractAddress,
    [`${key}DeployMethod`]: "circle-smart-contract-platform",
    [`${key}DeployerWalletId`]: walletId,
    [`${key}DeployerAddress`]: deployerAddress,
    [`${key}ContractId`]: contractId,
    [`${key}TxHash`]: contract.txHash,
    [`${key}DeployedAt`]: new Date().toISOString(),
  };
  fs.writeFileSync(outPath, JSON.stringify(updated, null, 2) + "\n");
  console.log(`Wrote deployment record to ${outPath}`);
}

async function main() {
  const [contractName, ...constructorArgs] = process.argv.slice(2);
  if (!contractName) {
    throw new Error("Usage: node scripts/deploy-circle.js <ContractName> [constructorArgs...]");
  }

  const apiKey = requireEnv("CIRCLE_API_KEY");
  const entitySecret = requireEnv("CIRCLE_ENTITY_SECRET");
  const walletId = requireEnv("CIRCLE_DEPLOYER_WALLET_ID");

  const scpClient = initiateSmartContractPlatformClient({ apiKey, entitySecret });
  const walletsClient = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletResponse = await walletsClient.getWallet({ id: walletId });
  const wallet = walletResponse.data.wallet;
  console.log(`Deploying from Circle wallet ${wallet.address} (id ${walletId}) on ${wallet.blockchain}`);
  if (wallet.blockchain !== ARC_TESTNET_BLOCKCHAIN) {
    throw new Error(`Wallet ${walletId} is on ${wallet.blockchain}, expected ${ARC_TESTNET_BLOCKCHAIN}.`);
  }

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    `${contractName}.sol`,
    `${contractName}.json`,
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Circle contract names must be unique per account, so re-running this
  // script (e.g. after a previous partial run) needs a fresh name — reuse
  // an existing COMPLETE deployment instead of re-deploying when possible.
  const existingList = await scpClient.listContracts({ blockchain: ARC_TESTNET_BLOCKCHAIN });
  const existing = (existingList.data.contracts ?? []).find(
    (c) => c.name.startsWith(contractName) && c.status === "COMPLETE" && !c.archived,
  );
  if (existing) {
    console.log(`Found existing deployed contract ${existing.name} (${existing.contractAddress}), reusing it.`);
    writeDeploymentRecord(contractName, existing, walletId, wallet.address, existing.id);
    return;
  }

  console.log(`Submitting ${contractName} deployment request to Circle...`);
  const deployResponse = await scpClient.deployContract({
    name: `${contractName}${Date.now()}`,
    description: `UnitPay contract: ${contractName}`,
    walletId,
    abiJson: JSON.stringify(artifact.abi),
    bytecode: artifact.bytecode,
    blockchain: ARC_TESTNET_BLOCKCHAIN,
    constructorParameters: constructorArgs,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const { contractId, transactionId } = deployResponse.data;
  console.log(`Deployment submitted. contractId=${contractId} transactionId=${transactionId}`);
  console.log("Polling for completion...");

  const contract = await pollContract(scpClient, contractId);
  console.log(`\nDeployed! contractAddress=${contract.contractAddress} txHash=${contract.txHash}`);

  writeDeploymentRecord(contractName, contract, walletId, wallet.address, contractId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
