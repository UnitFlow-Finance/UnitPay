// Deploy script for Arc Testnet ONLY.
//
// Deploys each UnitPay contract behind an OpenZeppelin
// TransparentUpgradeableProxy, with a single shared ProxyAdmin owning all
// three proxies. This lets the contracts be upgraded later (e.g. adding fee
// splitting to UnitPayMerchant) without changing their addresses.
//
// Note on immutables + proxies: each contract's constructor only sets an
// `immutable usdc` address — no mutable storage is written in the
// constructor. Immutable values are inlined into the implementation
// contract's bytecode at deploy time (not stored in the proxy's storage
// slots), so they work correctly when called through a proxy. There is no
// `initialize()` step because there is no mutable state to initialize.
//
// Usage:
//   npm run deploy:arcTestnet
//
// Requires PRIVATE_KEY set in .env (a funded Arc Testnet key — see
// .env.example). Never point this script at a mainnet RPC or USDC address.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// Verified Arc Testnet USDC address — matches lib/chains/config.ts in the
// Next.js app (the canonical, cross-checked list of testnet addresses).
// Confirmed on-chain before deployment: this address's contract code
// responds to decimals()/symbol()/name()/balanceOf() as a standard ERC-20
// (Arc's native-gas USDC precompile also exposes the ERC-20 interface).
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

async function deployBehindProxy(name, proxyAdminAddress, usdcAddress, deployer) {
  const Impl = await ethers.getContractFactory(name);
  const impl = await Impl.deploy(usdcAddress);
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log(`${name} implementation deployed to ${implAddress}`);

  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await Proxy.deploy(implAddress, proxyAdminAddress, "0x");
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`${name} proxy deployed to ${proxyAddress}`);

  // Return the proxy address wrapped with the implementation's ABI so
  // callers can interact with it as if it were the implementation.
  return Impl.attach(proxyAddress);
}

async function main() {
  if (network.name !== "arcTestnet") {
    throw new Error(
      `This script only deploys to arcTestnet. Refusing to run on network "${network.name}".`,
    );
  }
  if (ARC_TESTNET_USDC.includes("TODO")) {
    throw new Error(
      "Set ARC_TESTNET_USDC in scripts/deploy.js to the verified Arc Testnet USDC address before deploying.",
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy();
  await proxyAdmin.waitForDeployment();
  const proxyAdminAddress = await proxyAdmin.getAddress();
  console.log(`ProxyAdmin deployed to ${proxyAdminAddress}`);

  const transfer = await deployBehindProxy(
    "UnitPayTransfer",
    proxyAdminAddress,
    ARC_TESTNET_USDC,
    deployer,
  );
  const paymentRequest = await deployBehindProxy(
    "UnitPayPaymentRequest",
    proxyAdminAddress,
    ARC_TESTNET_USDC,
    deployer,
  );
  const merchant = await deployBehindProxy(
    "UnitPayMerchant",
    proxyAdminAddress,
    ARC_TESTNET_USDC,
    deployer,
  );

  const summary = {
    network: "arcTestnet",
    chainId: 5042002,
    usdcAddress: ARC_TESTNET_USDC,
    deployer: deployer.address,
    proxyAdmin: proxyAdminAddress,
    unitPayTransfer: await transfer.getAddress(),
    unitPayPaymentRequest: await paymentRequest.getAddress(),
    unitPayMerchant: await merchant.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  console.log("\nDeployment summary (Arc Testnet):");
  console.log(summary);

  const outPath = path.join(__dirname, "..", "deployments.arcTestnet.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n");
  console.log(`\nWrote deployment addresses to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
