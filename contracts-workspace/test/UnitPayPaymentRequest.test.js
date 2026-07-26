const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("UnitPayPaymentRequest", function () {
  let usdc, requestContract, requester, payer;
  const ONE_USDC = 1_000_000n;

  beforeEach(async function () {
    [requester, payer] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const UnitPayPaymentRequest = await ethers.getContractFactory("UnitPayPaymentRequest");
    requestContract = await UnitPayPaymentRequest.deploy(await usdc.getAddress());
    await requestContract.waitForDeployment();

    await usdc.mint(payer.address, 100n * ONE_USDC);
    await usdc.connect(payer).approve(await requestContract.getAddress(), ethers.MaxUint256);
  });

  it("creates a request with an incrementing id and emits an event", async function () {
    await expect(requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "invoice #1"))
      .to.emit(requestContract, "PaymentRequestCreated")
      .withArgs(0n, requester.address, 10n * ONE_USDC, 0n, "invoice #1");

    const req = await requestContract.requests(0);
    expect(req.requester).to.equal(requester.address);
    expect(req.amount).to.equal(10n * ONE_USDC);
    expect(req.status).to.equal(0); // Open
  });

  it("reverts creating a request with zero amount", async function () {
    await expect(
      requestContract.connect(requester).createRequest(0, 0, ""),
    ).to.be.revertedWithCustomError(requestContract, "ZeroAmount");
  });

  it("reverts deployment with a zero USDC address", async function () {
    const UnitPayPaymentRequest = await ethers.getContractFactory("UnitPayPaymentRequest");
    await expect(
      UnitPayPaymentRequest.deploy(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(UnitPayPaymentRequest, "ZeroAddress");
  });

  it("reverts creating a request with a memo longer than MAX_MEMO_LENGTH", async function () {
    const maxLen = await requestContract.MAX_MEMO_LENGTH();
    const tooLong = "a".repeat(Number(maxLen) + 1);
    await expect(
      requestContract.connect(requester).createRequest(ONE_USDC, 0, tooLong),
    ).to.be.revertedWithCustomError(requestContract, "MemoTooLong");
  });

  it("reverts creating a request with expiresIn beyond MAX_EXPIRES_IN", async function () {
    const maxExpiry = await requestContract.MAX_EXPIRES_IN();
    await expect(
      requestContract.connect(requester).createRequest(ONE_USDC, maxExpiry + 1n, ""),
    ).to.be.revertedWithCustomError(requestContract, "ExpiryTooFar");
  });

  it("fulfills an open request, transferring funds to the requester", async function () {
    await requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "invoice #1");

    await expect(requestContract.connect(payer).fulfill(0))
      .to.emit(requestContract, "PaymentRequestFulfilled")
      .withArgs(0n, payer.address, requester.address, 10n * ONE_USDC);

    expect(await usdc.balanceOf(requester.address)).to.equal(10n * ONE_USDC);
    const req = await requestContract.requests(0);
    expect(req.status).to.equal(1); // Fulfilled
  });

  it("reverts fulfilling an already-fulfilled request", async function () {
    await requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "");
    await requestContract.connect(payer).fulfill(0);

    await expect(requestContract.connect(payer).fulfill(0)).to.be.revertedWithCustomError(
      requestContract,
      "RequestNotOpen",
    );
  });

  it("reverts fulfilling a non-existent request", async function () {
    await expect(requestContract.connect(payer).fulfill(999)).to.be.revertedWithCustomError(
      requestContract,
      "RequestNotFound",
    );
  });

  it("reverts fulfilling an expired request", async function () {
    await requestContract.connect(requester).createRequest(10n * ONE_USDC, 60, "");
    await time.increase(61);

    await expect(requestContract.connect(payer).fulfill(0)).to.be.revertedWithCustomError(
      requestContract,
      "RequestExpired",
    );
  });

  it("allows the requester to cancel an open request", async function () {
    await requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "");

    await expect(requestContract.connect(requester).cancel(0))
      .to.emit(requestContract, "PaymentRequestCancelled")
      .withArgs(0n, requester.address);

    const req = await requestContract.requests(0);
    expect(req.status).to.equal(2); // Cancelled
  });

  it("reverts cancel from a non-requester", async function () {
    await requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "");

    await expect(requestContract.connect(payer).cancel(0)).to.be.revertedWithCustomError(
      requestContract,
      "NotRequester",
    );
  });

  it("reverts fulfilling a cancelled request", async function () {
    await requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "");
    await requestContract.connect(requester).cancel(0);

    await expect(requestContract.connect(payer).fulfill(0)).to.be.revertedWithCustomError(
      requestContract,
      "RequestNotOpen",
    );
  });

  describe("isExpired", function () {
    it("returns false for a request with no expiry", async function () {
      await requestContract.connect(requester).createRequest(10n * ONE_USDC, 0, "");
      expect(await requestContract.isExpired(0)).to.equal(false);
    });

    it("returns true once expiry has passed", async function () {
      await requestContract.connect(requester).createRequest(10n * ONE_USDC, 60, "");
      await time.increase(61);
      expect(await requestContract.isExpired(0)).to.equal(true);
    });

    it("reverts for a non-existent request", async function () {
      await expect(requestContract.isExpired(999)).to.be.revertedWithCustomError(
        requestContract,
        "RequestNotFound",
      );
    });
  });
});
