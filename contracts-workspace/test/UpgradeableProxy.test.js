const { expect } = require("chai");
const { ethers } = require("hardhat");

// Smoke test for the TransparentUpgradeableProxy deployment pattern used by
// scripts/deploy.js: deploys UnitPayTransfer's implementation behind a
// proxy + ProxyAdmin and confirms calls routed through the proxy behave
// identically to calling the implementation directly (in particular, that
// the `immutable usdc` address set in the constructor is correctly read
// through the proxy).
describe("UnitPayTransfer behind TransparentUpgradeableProxy", function () {
  let usdc, proxyAdmin, proxied, deployer, alice, bob;
  const ONE_USDC = 1_000_000n;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.waitForDeployment();

    const UnitPayTransfer = await ethers.getContractFactory("UnitPayTransfer");
    const impl = await UnitPayTransfer.deploy(await usdc.getAddress());
    await impl.waitForDeployment();

    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const proxy = await Proxy.deploy(
      await impl.getAddress(),
      await proxyAdmin.getAddress(),
      "0x",
    );
    await proxy.waitForDeployment();

    proxied = UnitPayTransfer.attach(await proxy.getAddress());

    await usdc.mint(alice.address, 100n * ONE_USDC);
    await usdc.connect(alice).approve(await proxy.getAddress(), ethers.MaxUint256);
  });

  it("reads the immutable usdc address correctly through the proxy", async function () {
    expect(await proxied.usdc()).to.equal(await usdc.getAddress());
  });

  it("executes transfer logic through the proxy", async function () {
    await expect(proxied.connect(alice).transfer(bob.address, 5n * ONE_USDC, "via proxy")).to.emit(
      proxied,
      "UnitPayTransferSent",
    );

    expect(await usdc.balanceOf(bob.address)).to.equal(5n * ONE_USDC);
  });

  it("ProxyAdmin is deployed and owned by the deployer", async function () {
    expect(await proxyAdmin.owner()).to.equal(deployer.address);
  });
});
