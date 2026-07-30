// Redeploy script for Arc Testnet ONLY — unproxied contracts that have no
// upgrade path (UnitPayEscrow, UnitPayPacket, UnitPayMetadataRegistry). Escrow
// and Packet were originally
// deployed via Circle's Smart Contract Platform SDK (see
// scripts/deploy-circle.js) when no funded private key was available;
// now that one is, a plain Hardhat deploy is simpler and produces an
// identical (unproxied) contract. Existing on-chain escrows/packets at
// the old addresses are unaffected and remain queryable there — this
// only affects where *new* escrows/packets get created going forward.
//
// Usage:
//   REDEPLOY_CONTRACT=UnitPayEscrow node scripts/... (via hardhat run)
const path = require("path");
const fs = require("fs");
const { ethers, network } = require("hardhat");

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

const DEPLOYMENT_KEY_BY_CONTRACT = {
  UnitPayEscrow: "unitPayEscrow",
  UnitPayPacket: "unitPayPacket",
  UnitPayMetadataRegistry: "unitPayMetadataRegistry",
};

async function main() {
  if (network.name !== "arcTestnet") {
    throw new Error(
      `This script only deploys to arcTestnet. Refusing to run on network "${network.name}".`,
    );
  }

  const contractName = process.env.REDEPLOY_CONTRACT;
  if (!contractName || !DEPLOYMENT_KEY_BY_CONTRACT[contractName]) {
    throw new Error(
      `Set REDEPLOY_CONTRACT to one of: ${Object.keys(DEPLOYMENT_KEY_BY_CONTRACT).join(", ")}`,
    );
  }

  const [signer] = await ethers.getSigners();
  console.log(`Deploying ${contractName} with signer ${signer.address}`);

  const Factory = await ethers.getContractFactory(contractName);
  const instance =
    contractName === "UnitPayMetadataRegistry"
      ? await Factory.deploy()
      : await Factory.deploy(ARC_TESTNET_USDC);
  await instance.waitForDeployment();
  const address = await instance.getAddress();
  const deployTx = instance.deploymentTransaction();

  console.log(`${contractName} deployed to ${address} (tx ${deployTx.hash})`);

  if (contractName !== "UnitPayMetadataRegistry") {
    const usdcOnChain = await instance.usdc();
    if (usdcOnChain.toLowerCase() !== ARC_TESTNET_USDC.toLowerCase()) {
      throw new Error(`Sanity check failed: usdc() returned ${usdcOnChain}`);
    }
    console.log(`Sanity check passed: usdc() == ${usdcOnChain}`);
  } else {
    const owner = await instance.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(`Sanity check failed: owner() returned ${owner}`);
    }
    console.log(`Sanity check passed: owner() == ${owner}`);
  }

  const deploymentsPath = path.join(__dirname, "..", "deployments.arcTestnet.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const key = DEPLOYMENT_KEY_BY_CONTRACT[contractName];

  deployments[`${key}PreviousAddress`] = deployments[key];
  deployments[key] = address;
  deployments[`${key}DeployMethod`] = "hardhat";
  deployments[`${key}DeployerAddress`] = signer.address;
  deployments[`${key}TxHash`] = deployTx.hash;
  deployments[`${key}DeployedAt`] = new Date().toISOString();
  // Circle SDK-specific metadata from the original deployment no longer
  // applies to the new address.
  delete deployments[`${key}ContractId`];
  delete deployments[`${key}DeployerWalletId`];

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2) + "\n");
  console.log(`Recorded new address in ${deploymentsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
