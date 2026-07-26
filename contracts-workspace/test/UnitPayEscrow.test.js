const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UnitPayEscrow", function () {
  let usdc, escrow, owner, payer, payee, arbiter, stranger;
  const ONE_USDC = 1_000_000n; // 6 decimals
  const TERMS_HASH = ethers.keccak256(ethers.toUtf8Bytes("build me a landing page"));

  beforeEach(async function () {
    [owner, payer, payee, arbiter, stranger] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const UnitPayEscrow = await ethers.getContractFactory("UnitPayEscrow");
    escrow = await UnitPayEscrow.deploy(await usdc.getAddress());
    await escrow.waitForDeployment();

    await usdc.mint(payer.address, 100n * ONE_USDC);
    await usdc.connect(payer).approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  it("deploys with the correct USDC address", async function () {
    expect(await escrow.usdc()).to.equal(await usdc.getAddress());
  });

  it("reverts deployment with a zero USDC address", async function () {
    const UnitPayEscrow = await ethers.getContractFactory("UnitPayEscrow");
    await expect(UnitPayEscrow.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      UnitPayEscrow,
      "ZeroAddress",
    );
  });

  describe("createEscrow", function () {
    it("locks funds and emits EscrowCreated", async function () {
      await expect(
        escrow
          .connect(payer)
          .createEscrow(payee.address, arbiter.address, 10n * ONE_USDC, TERMS_HASH, 0),
      )
        .to.emit(escrow, "EscrowCreated")
        .withArgs(0, payer.address, payee.address, arbiter.address, 10n * ONE_USDC, TERMS_HASH, 0);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(10n * ONE_USDC);
      expect(await usdc.balanceOf(payer.address)).to.equal(90n * ONE_USDC);

      const e = await escrow.escrows(0);
      expect(e.payer).to.equal(payer.address);
      expect(e.payee).to.equal(payee.address);
      expect(e.arbiter).to.equal(arbiter.address);
      expect(e.amount).to.equal(10n * ONE_USDC);
      expect(e.status).to.equal(0n); // Funded
    });

    it("allows creating without an arbiter (address(0))", async function () {
      await expect(
        escrow
          .connect(payer)
          .createEscrow(payee.address, ethers.ZeroAddress, ONE_USDC, TERMS_HASH, 0),
      ).to.emit(escrow, "EscrowCreated");
    });

    it("reverts on zero-address payee", async function () {
      await expect(
        escrow
          .connect(payer)
          .createEscrow(ethers.ZeroAddress, arbiter.address, ONE_USDC, TERMS_HASH, 0),
      ).to.be.revertedWithCustomError(escrow, "ZeroAddress");
    });

    it("reverts when payee equals payer", async function () {
      await expect(
        escrow
          .connect(payer)
          .createEscrow(payer.address, arbiter.address, ONE_USDC, TERMS_HASH, 0),
      ).to.be.revertedWithCustomError(escrow, "SamePayerAndPayee");
    });

    it("reverts when the payee is the escrow contract itself", async function () {
      await expect(
        escrow
          .connect(payer)
          .createEscrow(await escrow.getAddress(), arbiter.address, ONE_USDC, TERMS_HASH, 0),
      ).to.be.revertedWithCustomError(escrow, "SelfAddressPayee");
    });

    it("reverts when the arbiter is the payer (self-dealing arbiter)", async function () {
      await expect(
        escrow.connect(payer).createEscrow(payee.address, payer.address, ONE_USDC, TERMS_HASH, 0),
      ).to.be.revertedWithCustomError(escrow, "ArbiterMustBeIndependent");
    });

    it("reverts when the arbiter is the payee (self-dealing arbiter)", async function () {
      await expect(
        escrow.connect(payer).createEscrow(payee.address, payee.address, ONE_USDC, TERMS_HASH, 0),
      ).to.be.revertedWithCustomError(escrow, "ArbiterMustBeIndependent");
    });

    it("reverts on zero amount", async function () {
      await expect(
        escrow.connect(payer).createEscrow(payee.address, arbiter.address, 0, TERMS_HASH, 0),
      ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    });

    it("reverts when expiresIn exceeds MAX_EXPIRES_IN", async function () {
      const maxExpiresIn = await escrow.MAX_EXPIRES_IN();
      await expect(
        escrow
          .connect(payer)
          .createEscrow(payee.address, arbiter.address, ONE_USDC, TERMS_HASH, maxExpiresIn + 1n),
      ).to.be.revertedWithCustomError(escrow, "ExpiryTooFar");
    });

    it("reverts if payer has not approved enough allowance", async function () {
      await usdc.connect(payer).approve(await escrow.getAddress(), 0);
      await expect(
        escrow.connect(payer).createEscrow(payee.address, arbiter.address, ONE_USDC, TERMS_HASH, 0),
      ).to.be.reverted;
    });
  });

  describe("release", function () {
    beforeEach(async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, 10n * ONE_USDC, TERMS_HASH, 0);
    });

    it("lets the payer release funds to the payee", async function () {
      await expect(escrow.connect(payer).release(0))
        .to.emit(escrow, "EscrowReleased")
        .withArgs(0, payer.address);

      expect(await usdc.balanceOf(payee.address)).to.equal(10n * ONE_USDC);
      const e = await escrow.escrows(0);
      expect(e.status).to.equal(1n); // Released
    });

    it("reverts if a non-payer tries to release a funded (non-disputed) escrow", async function () {
      await expect(escrow.connect(payee).release(0)).to.be.revertedWithCustomError(
        escrow,
        "NotPayer",
      );
      await expect(escrow.connect(stranger).release(0)).to.be.revertedWithCustomError(
        escrow,
        "NotPayer",
      );
    });

    it("reverts on double release", async function () {
      await escrow.connect(payer).release(0);
      await expect(escrow.connect(payer).release(0)).to.be.revertedWithCustomError(
        escrow,
        "NotFunded",
      );
    });

    it("reverts for a nonexistent escrow", async function () {
      await expect(escrow.connect(payer).release(999)).to.be.revertedWithCustomError(
        escrow,
        "EscrowNotFound",
      );
    });
  });

  describe("refund", function () {
    beforeEach(async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, 10n * ONE_USDC, TERMS_HASH, 0);
    });

    it("lets the payee voluntarily refund the payer", async function () {
      await expect(escrow.connect(payee).refund(0))
        .to.emit(escrow, "EscrowRefunded")
        .withArgs(0, payee.address);

      expect(await usdc.balanceOf(payer.address)).to.equal(100n * ONE_USDC);
    });

    it("reverts if the payer tries to refund before expiry", async function () {
      await expect(escrow.connect(payer).refund(0)).to.be.revertedWithCustomError(
        escrow,
        "NotPayeeOrExpiredPayer",
      );
    });

    it("lets the payer reclaim funds once the escrow has expired", async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, 5n * ONE_USDC, TERMS_HASH, 60);

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");

      await expect(escrow.connect(payer).refund(1)).to.emit(escrow, "EscrowRefunded");
    });

    it("reverts for a stranger", async function () {
      await expect(escrow.connect(stranger).refund(0)).to.be.revertedWithCustomError(
        escrow,
        "NotPayeeOrExpiredPayer",
      );
    });
  });

  describe("dispute + arbiter resolution", function () {
    beforeEach(async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, 10n * ONE_USDC, TERMS_HASH, 0);
    });

    it("lets the payer raise a dispute", async function () {
      await expect(escrow.connect(payer).dispute(0))
        .to.emit(escrow, "EscrowDisputed")
        .withArgs(0, payer.address);

      const e = await escrow.escrows(0);
      expect(e.status).to.equal(3n); // Disputed
    });

    it("lets the payee raise a dispute", async function () {
      await expect(escrow.connect(payee).dispute(0)).to.emit(escrow, "EscrowDisputed");
    });

    it("reverts if a stranger tries to raise a dispute", async function () {
      await expect(escrow.connect(stranger).dispute(0)).to.be.revertedWithCustomError(
        escrow,
        "NotPartyToEscrow",
      );
    });

    it("reverts raising a dispute with no arbiter set", async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, ethers.ZeroAddress, ONE_USDC, TERMS_HASH, 0);
      await expect(escrow.connect(payer).dispute(1)).to.be.revertedWithCustomError(
        escrow,
        "ZeroAddress",
      );
    });

    it("lets the arbiter release to the payee after a dispute", async function () {
      await escrow.connect(payer).dispute(0);

      await expect(escrow.connect(arbiter).release(0))
        .to.emit(escrow, "EscrowReleased")
        .withArgs(0, arbiter.address)
        .and.to.emit(escrow, "EscrowDisputeResolved")
        .withArgs(0, true);

      expect(await usdc.balanceOf(payee.address)).to.equal(10n * ONE_USDC);
    });

    it("lets the arbiter refund the payer after a dispute", async function () {
      await escrow.connect(payee).dispute(0);

      await expect(escrow.connect(arbiter).refund(0))
        .to.emit(escrow, "EscrowRefunded")
        .withArgs(0, arbiter.address)
        .and.to.emit(escrow, "EscrowDisputeResolved")
        .withArgs(0, false);

      expect(await usdc.balanceOf(payer.address)).to.equal(100n * ONE_USDC);
    });

    it("reverts if a non-arbiter tries to release/refund a disputed escrow", async function () {
      await escrow.connect(payer).dispute(0);
      await expect(escrow.connect(payer).release(0)).to.be.revertedWithCustomError(
        escrow,
        "NotArbiter",
      );
      await expect(escrow.connect(payee).refund(0)).to.be.revertedWithCustomError(
        escrow,
        "NotArbiter",
      );
    });

    it("reverts disputing an already-disputed escrow", async function () {
      await escrow.connect(payer).dispute(0);
      await expect(escrow.connect(payer).dispute(0)).to.be.revertedWithCustomError(
        escrow,
        "NotFunded",
      );
    });
  });

  describe("resolveTimedOutDispute", function () {
    beforeEach(async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, 10n * ONE_USDC, TERMS_HASH, 0);
    });

    it("reverts if the escrow isn't disputed", async function () {
      await expect(escrow.connect(stranger).resolveTimedOutDispute(0)).to.be.revertedWithCustomError(
        escrow,
        "NotDisputed",
      );
    });

    it("reverts before DISPUTE_TIMEOUT has elapsed", async function () {
      await escrow.connect(payer).dispute(0);
      await expect(escrow.connect(stranger).resolveTimedOutDispute(0)).to.be.revertedWithCustomError(
        escrow,
        "DisputeNotTimedOut",
      );
    });

    it("lets anyone refund the payer once DISPUTE_TIMEOUT has elapsed, even if the arbiter never acts", async function () {
      await escrow.connect(payer).dispute(0);

      const timeout = await escrow.DISPUTE_TIMEOUT();
      await ethers.provider.send("evm_increaseTime", [Number(timeout) + 1]);
      await ethers.provider.send("evm_mine");

      await expect(escrow.connect(stranger).resolveTimedOutDispute(0))
        .to.emit(escrow, "EscrowRefunded")
        .withArgs(0, stranger.address)
        .and.to.emit(escrow, "EscrowDisputeResolved")
        .withArgs(0, false);

      expect(await usdc.balanceOf(payer.address)).to.equal(100n * ONE_USDC);
      const e = await escrow.escrows(0);
      expect(e.status).to.equal(2n); // Refunded
    });

    it("reverts double-resolving a timed-out dispute", async function () {
      await escrow.connect(payer).dispute(0);
      const timeout = await escrow.DISPUTE_TIMEOUT();
      await ethers.provider.send("evm_increaseTime", [Number(timeout) + 1]);
      await ethers.provider.send("evm_mine");

      await escrow.connect(stranger).resolveTimedOutDispute(0);
      await expect(escrow.connect(stranger).resolveTimedOutDispute(0)).to.be.revertedWithCustomError(
        escrow,
        "NotDisputed",
      );
    });

    it("still lets the arbiter resolve normally before the timeout elapses", async function () {
      await escrow.connect(payer).dispute(0);
      await expect(escrow.connect(arbiter).release(0)).to.emit(escrow, "EscrowReleased");
    });
  });

  describe("isExpired", function () {
    it("returns false when no expiry was set", async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, ONE_USDC, TERMS_HASH, 0);
      expect(await escrow.isExpired(0)).to.equal(false);
    });

    it("returns true once past expiresAt", async function () {
      await escrow
        .connect(payer)
        .createEscrow(payee.address, arbiter.address, ONE_USDC, TERMS_HASH, 60);
      expect(await escrow.isExpired(0)).to.equal(false);

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");

      expect(await escrow.isExpired(0)).to.equal(true);
    });

    it("reverts for a nonexistent escrow", async function () {
      await expect(escrow.isExpired(999)).to.be.revertedWithCustomError(escrow, "EscrowNotFound");
    });
  });
});
