const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("UnitPayTransfer", function () {
  let usdc, transfer, owner, alice, bob;
  const ONE_USDC = 1_000_000n; // 6 decimals

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const UnitPayTransfer = await ethers.getContractFactory("UnitPayTransfer");
    transfer = await UnitPayTransfer.deploy(await usdc.getAddress());
    await transfer.waitForDeployment();

    await usdc.mint(alice.address, 100n * ONE_USDC);
    await usdc.connect(alice).approve(await transfer.getAddress(), ethers.MaxUint256);
  });

  it("deploys with the correct USDC address", async function () {
    expect(await transfer.usdc()).to.equal(await usdc.getAddress());
  });

  it("reverts deployment with a zero USDC address", async function () {
    const UnitPayTransfer = await ethers.getContractFactory("UnitPayTransfer");
    await expect(UnitPayTransfer.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      UnitPayTransfer,
      "ZeroAddress",
    );
  });

  it("reverts a transfer with a memo longer than MAX_MEMO_LENGTH", async function () {
    const maxLen = await transfer.MAX_MEMO_LENGTH();
    const tooLong = "a".repeat(Number(maxLen) + 1);
    await expect(
      transfer.connect(alice).transfer(bob.address, ONE_USDC, tooLong),
    ).to.be.revertedWithCustomError(transfer, "MemoTooLong");
  });

  it("transfers USDC from sender to recipient and emits an event", async function () {
    await expect(transfer.connect(alice).transfer(bob.address, 5n * ONE_USDC, "lunch"))
      .to.emit(transfer, "UnitPayTransferSent")
      .withArgs(alice.address, bob.address, 5n * ONE_USDC, "lunch", anyValue);

    expect(await usdc.balanceOf(bob.address)).to.equal(5n * ONE_USDC);
    expect(await usdc.balanceOf(alice.address)).to.equal(95n * ONE_USDC);
  });

  it("reverts on zero amount", async function () {
    await expect(
      transfer.connect(alice).transfer(bob.address, 0, ""),
    ).to.be.revertedWithCustomError(transfer, "ZeroAmount");
  });

  it("reverts on zero-address recipient", async function () {
    await expect(
      transfer.connect(alice).transfer(ethers.ZeroAddress, ONE_USDC, ""),
    ).to.be.revertedWithCustomError(transfer, "ZeroAddressRecipient");
  });

  it("reverts sending to the contract's own address (would permanently lock funds)", async function () {
    await expect(
      transfer.connect(alice).transfer(await transfer.getAddress(), ONE_USDC, ""),
    ).to.be.revertedWithCustomError(transfer, "SelfAddressRecipient");
  });

  it("reverts if sender has not approved enough allowance", async function () {
    await usdc.connect(alice).approve(await transfer.getAddress(), 0);
    await expect(transfer.connect(alice).transfer(bob.address, ONE_USDC, "")).to.be.reverted;
  });

  describe("batchTransfer", function () {
    it("sends to multiple recipients and emits per-recipient + summary events", async function () {
      const recipients = [bob.address, owner.address];
      const amounts = [2n * ONE_USDC, 3n * ONE_USDC];

      await expect(transfer.connect(alice).batchTransfer(recipients, amounts)).to.emit(
        transfer,
        "UnitPayBatchTransferSent",
      );

      expect(await usdc.balanceOf(bob.address)).to.equal(2n * ONE_USDC);
      expect(await usdc.balanceOf(owner.address)).to.equal(3n * ONE_USDC);
    });

    it("reverts on empty batch", async function () {
      await expect(transfer.connect(alice).batchTransfer([], [])).to.be.revertedWithCustomError(
        transfer,
        "EmptyBatch",
      );
    });

    it("reverts on mismatched array lengths", async function () {
      await expect(
        transfer.connect(alice).batchTransfer([bob.address], [1n, 2n]),
      ).to.be.revertedWithCustomError(transfer, "ArrayLengthMismatch");
    });

    it("reverts when the batch exceeds MAX_BATCH_SIZE", async function () {
      const maxSize = Number(await transfer.MAX_BATCH_SIZE());
      const recipients = Array(maxSize + 1).fill(bob.address);
      const amounts = Array(maxSize + 1).fill(1n);

      await expect(
        transfer.connect(alice).batchTransfer(recipients, amounts),
      ).to.be.revertedWithCustomError(transfer, "BatchTooLarge");
    });

    it("reverts if any recipient in the batch is the contract's own address", async function () {
      const recipients = [bob.address, await transfer.getAddress()];
      const amounts = [1n * ONE_USDC, 1n * ONE_USDC];

      await expect(
        transfer.connect(alice).batchTransfer(recipients, amounts),
      ).to.be.revertedWithCustomError(transfer, "SelfAddressRecipient");
    });
  });
});
