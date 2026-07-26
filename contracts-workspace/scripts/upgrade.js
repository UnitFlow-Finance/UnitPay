// Upgrade script for Arc Testnet ONLY.
//
// Deploys a new implementation for a given contract and points its
// existing TransparentUpgradeableProxy at it via the shared ProxyAdmin,
// keeping the proxy's address (and therefore every already-recorded
// escrow/request/merchant reference to it) unchanged.
//
// Safe by construction here because none of UnitPayTransfer/
// UnitPayPaymentRequest/UnitPayMerchant write any mutable storage in their
// constructors (only an `immutable usdc` address, inlined into the new
// implementation's bytecode) — there is no storage-layout migration to
// reason about, and no `initialize()` call is needed after upgrading.
//
// Usage:
//   node scripts/upgrade.js <ContractName>
//
// Requires PRIVATE_KEY in .env to be the ProxyAdmin's owner.
const path = require("path");
const fs = require("fs");
const { ethers, network } = require("hardhat");

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

const PROXY_KEY_BY_CONTRACT = {
  UnitPayTransfer: "unitPayTransfer",
  UnitPayPaymentRequest: "unitPayPaymentRequest",
  UnitPayMerchant: "unitPayMerchant",
};

async function main() {
  if (network.name !== "arcTestnet") {
    throw new Error(
      `This script only upgrades contracts on arcTestnet. Refusing to run on network "${network.name}".`,
    );
  }

  // `hardhat run` doesn't support passing extra positional args through to
  // the script (HH305), so the target contract is read from an env var
  // instead: UPGRADE_CONTRACT=UnitPayTransfer npx hardhat run scripts/upgrade.js --network arcTestnet
  const contractName = process.env.UPGRADE_CONTRACT;
  if (!contractName || !PROXY_KEY_BY_CONTRACT[contractName]) {
    throw new Error(
      `Set UPGRADE_CONTRACT to one of: ${Object.keys(PROXY_KEY_BY_CONTRACT).join(", ")}`,
    );
  }

  const deploymentsPath = path.join(__dirname, "..", "deployments.arcTestnet.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const proxyKey = PROXY_KEY_BY_CONTRACT[contractName];
  const proxyAddress = deployments[proxyKey];
  const proxyAdminAddress = deployments.proxyAdmin;
  if (!proxyAddress || !proxyAdminAddress) {
    throw new Error(`Missing ${proxyKey} or proxyAdmin in ${deploymentsPath}`);
  }

  const [signer] = await ethers.getSigners();
  console.log(`Upgrading ${contractName} (proxy ${proxyAddress}) with signer ${signer.address}`);

  const Impl = await ethers.getContractFactory(contractName);
  const newImpl = await Impl.deploy(ARC_TESTNET_USDC);
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log(`New ${contractName} implementation deployed to ${newImplAddress}`);

  const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress, signer);
  const tx = await proxyAdmin.upgrade(proxyAddress, newImplAddress);
  const receipt = await tx.wait();
  console.log(`ProxyAdmin.upgrade() confirmed in tx ${receipt.hash}`);

  // Sanity check: read the immutable usdc address back through the proxy
  // with the new implementation's ABI, confirming the upgrade landed and
  // the proxy is still functional.
  const proxied = Impl.attach(proxyAddress);
  const usdcOnChain = await proxied.usdc();
  if (usdcOnChain.toLowerCase() !== ARC_TESTNET_USDC.toLowerCase()) {
    throw new Error(
      `Post-upgrade sanity check failed: usdc() returned ${usdcOnChain}, expected ${ARC_TESTNET_USDC}`,
    );
  }
  console.log(`Post-upgrade sanity check passed: usdc() == ${usdcOnChain}`);

  deployments[`${proxyKey}Implementation`] = newImplAddress;
  deployments[`${proxyKey}UpgradedAt`] = new Date().toISOString();
  deployments[`${proxyKey}UpgradeTxHash`] = receipt.hash;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2) + "\n");
  console.log(`Recorded new implementation address in ${deploymentsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
