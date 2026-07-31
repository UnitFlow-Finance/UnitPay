const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UnitPayP2PMarketplace", function () {
  async function deployFixture() {
    const [owner, merchant, buyer, arbitrator] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    await token.waitForDeployment();
    await token.mint(merchant.address, ethers.parseUnits("1000", 6));

    const Marketplace = await ethers.getContractFactory("UnitPayP2PMarketplace");
    const marketplace = await Marketplace.deploy(arbitrator.address);
    await marketplace.waitForDeployment();
    await token.connect(merchant).approve(await marketplace.getAddress(), ethers.parseUnits("1000", 6));
    return { token, marketplace, merchant, buyer, arbitrator };
  }

  it("locks seller assets and releases to buyer after payment", async function () {
    const { token, marketplace, merchant, buyer } = await deployFixture();
    await marketplace.connect(merchant).createOffer(
      await token.getAddress(),
      1,
      1,
      ethers.parseUnits("10", 6),
      ethers.parseUnits("100", 6),
      ethers.parseUnits("500", 6),
      900,
      ethers.ZeroHash,
    );

    await marketplace.connect(buyer).startTrade(0, ethers.parseUnits("25", 6));
    await marketplace.connect(buyer).markPaid(0, ethers.id("receipt"));
    await marketplace.connect(merchant).release(0);

    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits("25", 6));
  });

  it("allows arbitrator to refund seller in a dispute", async function () {
    const { token, marketplace, merchant, buyer, arbitrator } = await deployFixture();
    await marketplace.connect(merchant).createOffer(
      await token.getAddress(),
      1,
      1,
      ethers.parseUnits("10", 6),
      ethers.parseUnits("100", 6),
      ethers.parseUnits("500", 6),
      900,
      ethers.ZeroHash,
    );

    await marketplace.connect(buyer).startTrade(0, ethers.parseUnits("25", 6));
    await marketplace.connect(buyer).markPaid(0, ethers.id("receipt"));
    await marketplace.connect(merchant).openDispute(0, ethers.id("evidence"));
    await marketplace.connect(arbitrator).resolveDispute(0, false);

    expect(await token.balanceOf(merchant.address)).to.equal(ethers.parseUnits("1000", 6));
  });
});
