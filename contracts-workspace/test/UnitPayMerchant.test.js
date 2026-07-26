const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UnitPayMerchant", function () {
  let usdc, merchantContract, owner, settlement, payer, other;
  const ONE_USDC = 1_000_000n;

  beforeEach(async function () {
    [owner, settlement, payer, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const UnitPayMerchant = await ethers.getContractFactory("UnitPayMerchant");
    merchantContract = await UnitPayMerchant.deploy(await usdc.getAddress());
    await merchantContract.waitForDeployment();

    await usdc.mint(payer.address, 100n * ONE_USDC);
    await usdc.connect(payer).approve(await merchantContract.getAddress(), ethers.MaxUint256);
  });

  it("registers a merchant with an incrementing id and emits an event", async function () {
    await expect(merchantContract.connect(owner).registerMerchant(settlement.address))
      .to.emit(merchantContract, "MerchantRegistered")
      .withArgs(0n, owner.address, settlement.address);

    const m = await merchantContract.merchants(0);
    expect(m.owner).to.equal(owner.address);
    expect(m.settlementAddress).to.equal(settlement.address);
    expect(m.active).to.equal(true);
  });

  it("reverts registering with a zero settlement address", async function () {
    await expect(
      merchantContract.connect(owner).registerMerchant(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(merchantContract, "ZeroAddress");
  });

  it("reverts registering with the contract's own address as settlement (would permanently lock funds)", async function () {
    await expect(
      merchantContract.connect(owner).registerMerchant(await merchantContract.getAddress()),
    ).to.be.revertedWithCustomError(merchantContract, "SelfAddressSettlement");
  });

  it("reverts deployment with a zero USDC address", async function () {
    const UnitPayMerchant = await ethers.getContractFactory("UnitPayMerchant");
    await expect(UnitPayMerchant.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      UnitPayMerchant,
      "ZeroAddress",
    );
  });

  it("reverts paying with a memo longer than MAX_MEMO_LENGTH", async function () {
    await merchantContract.connect(owner).registerMerchant(settlement.address);
    const maxLen = await merchantContract.MAX_MEMO_LENGTH();
    const tooLong = "a".repeat(Number(maxLen) + 1);

    await expect(
      merchantContract.connect(payer).pay(0, ONE_USDC, tooLong),
    ).to.be.revertedWithCustomError(merchantContract, "MemoTooLong");
  });

  it("routes payment to the settlement address and emits an event", async function () {
    await merchantContract.connect(owner).registerMerchant(settlement.address);

    await expect(merchantContract.connect(payer).pay(0, 10n * ONE_USDC, "order #42"))
      .to.emit(merchantContract, "Payment")
      .withArgs(0n, payer.address, settlement.address, 10n * ONE_USDC, "order #42");

    expect(await usdc.balanceOf(settlement.address)).to.equal(10n * ONE_USDC);
    expect(await usdc.balanceOf(payer.address)).to.equal(90n * ONE_USDC);
  });

  it("reverts paying a non-existent merchant", async function () {
    await expect(
      merchantContract.connect(payer).pay(999, ONE_USDC, ""),
    ).to.be.revertedWithCustomError(merchantContract, "MerchantNotFound");
  });

  it("reverts paying with zero amount", async function () {
    await merchantContract.connect(owner).registerMerchant(settlement.address);
    await expect(
      merchantContract.connect(payer).pay(0, 0, ""),
    ).to.be.revertedWithCustomError(merchantContract, "ZeroAmount");
  });

  it("reverts paying a deactivated merchant", async function () {
    await merchantContract.connect(owner).registerMerchant(settlement.address);
    await merchantContract.connect(owner).deactivate(0);

    await expect(
      merchantContract.connect(payer).pay(0, ONE_USDC, ""),
    ).to.be.revertedWithCustomError(merchantContract, "MerchantInactive");
  });

  describe("updateSettlementAddress", function () {
    it("allows the owner to update the settlement address", async function () {
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await expect(merchantContract.connect(owner).updateSettlementAddress(0, other.address))
        .to.emit(merchantContract, "MerchantSettlementUpdated")
        .withArgs(0n, other.address);

      const m = await merchantContract.merchants(0);
      expect(m.settlementAddress).to.equal(other.address);
    });

    it("reverts when called by a non-owner", async function () {
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await expect(
        merchantContract.connect(other).updateSettlementAddress(0, other.address),
      ).to.be.revertedWithCustomError(merchantContract, "NotMerchantOwner");
    });

    it("reverts setting a zero settlement address", async function () {
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await expect(
        merchantContract.connect(owner).updateSettlementAddress(0, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(merchantContract, "ZeroAddress");
    });

    it("reverts setting the contract's own address as the new settlement address", async function () {
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await expect(
        merchantContract
          .connect(owner)
          .updateSettlementAddress(0, await merchantContract.getAddress()),
      ).to.be.revertedWithCustomError(merchantContract, "SelfAddressSettlement");
    });

    it("reverts updating a non-existent merchant", async function () {
      await expect(
        merchantContract.connect(owner).updateSettlementAddress(999, other.address),
      ).to.be.revertedWithCustomError(merchantContract, "MerchantNotFound");
    });
  });

  describe("deactivate", function () {
    it("allows the owner to deactivate", async function () {
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await expect(merchantContract.connect(owner).deactivate(0))
        .to.emit(merchantContract, "MerchantDeactivated")
        .withArgs(0n);

      const m = await merchantContract.merchants(0);
      expect(m.active).to.equal(false);
    });

    it("reverts when called by a non-owner", async function () {
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await expect(
        merchantContract.connect(other).deactivate(0),
      ).to.be.revertedWithCustomError(merchantContract, "NotMerchantOwner");
    });
  });
});
