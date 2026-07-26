const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Adversarial reentrancy tests using a malicious ERC-20 (MaliciousReentrantToken)
 * that calls back into the UnitPay contract mid-transfer. Every fund-moving
 * function across all five contracts is `nonReentrant` — these tests prove
 * that guard actually holds against a hostile token, not just a well-behaved
 * mock. Real Arc Testnet USDC is not malicious, but a defense-in-depth audit
 * should not rely on that alone.
 */
describe("Reentrancy attacks (malicious token)", function () {
  const ONE = 1_000_000n; // 6 decimals

  async function deployEvilToken() {
    const MaliciousReentrantToken = await ethers.getContractFactory("MaliciousReentrantToken");
    const evil = await MaliciousReentrantToken.deploy();
    await evil.waitForDeployment();
    return evil;
  }

  describe("UnitPayEscrow.createEscrow", function () {
    it("reverts the whole call if the token tries to reenter createEscrow during safeTransferFrom", async function () {
      const [payer, payee, arbiter] = await ethers.getSigners();
      const evil = await deployEvilToken();

      const UnitPayEscrow = await ethers.getContractFactory("UnitPayEscrow");
      const escrow = await UnitPayEscrow.deploy(await evil.getAddress());
      await escrow.waitForDeployment();

      await evil.mint(payer.address, 100n * ONE);
      await evil.connect(payer).approve(await escrow.getAddress(), ethers.MaxUint256);

      const termsHash = ethers.keccak256(ethers.toUtf8Bytes("terms"));
      const reentrantCall = escrow.interface.encodeFunctionData("createEscrow", [
        payee.address,
        arbiter.address,
        1n * ONE,
        termsHash,
        0,
      ]);
      await evil.connect(payer).setReentry(await escrow.getAddress(), reentrantCall);

      // The reentrant inner call reverts with "ReentrancyGuard: reentrant
      // call", which the evil token's `_attemptReentry` require() then
      // bubbles up, reverting the entire outer createEscrow transaction —
      // no escrow is created, no funds move.
      await expect(
        escrow.connect(payer).createEscrow(payee.address, arbiter.address, 1n * ONE, termsHash, 0),
      ).to.be.reverted;

      expect(await escrow.nextEscrowId()).to.equal(0);
      expect(await evil.balanceOf(await escrow.getAddress())).to.equal(0);
    });
  });

  describe("UnitPayEscrow.release", function () {
    it("reverts if the token tries to reenter release during safeTransfer", async function () {
      const [payer, payee, arbiter] = await ethers.getSigners();
      const evil = await deployEvilToken();

      const UnitPayEscrow = await ethers.getContractFactory("UnitPayEscrow");
      const escrow = await UnitPayEscrow.deploy(await evil.getAddress());
      await escrow.waitForDeployment();

      await evil.mint(payer.address, 100n * ONE);
      await evil.connect(payer).approve(await escrow.getAddress(), ethers.MaxUint256);
      await escrow.connect(payer).createEscrow(payee.address, arbiter.address, 10n * ONE, ethers.ZeroHash, 0);

      const reentrantCall = escrow.interface.encodeFunctionData("release", [0]);
      await evil.connect(payer).setReentry(await escrow.getAddress(), reentrantCall);

      await expect(escrow.connect(payer).release(0)).to.be.reverted;

      // Escrow state must be unchanged — still Funded, not double-released.
      const e = await escrow.escrows(0);
      expect(e.status).to.equal(0n); // Funded
    });
  });

  describe("UnitPayPacket.claim", function () {
    it("reverts if the token tries to reenter claim during safeTransfer", async function () {
      const [creator, claimer] = await ethers.getSigners();
      const evil = await deployEvilToken();

      const UnitPayPacket = await ethers.getContractFactory("UnitPayPacket");
      const packet = await UnitPayPacket.deploy(await evil.getAddress());
      await packet.waitForDeployment();

      await evil.mint(creator.address, 1000n * ONE);
      await evil.connect(creator).approve(await packet.getAddress(), ethers.MaxUint256);
      await packet.connect(creator).createPacket(4, 40n * ONE, 0, 60n * 60n);

      const reentrantCall = packet.interface.encodeFunctionData("claim", [0]);
      await evil.setReentry(await packet.getAddress(), reentrantCall);

      await expect(packet.connect(claimer).claim(0)).to.be.reverted;

      const p = await packet.packets(0);
      expect(p.claimsMade).to.equal(0);
    });
  });

  describe("UnitPayTransfer.transfer", function () {
    it("reverts if the token tries to reenter transfer during safeTransferFrom", async function () {
      const [alice, bob] = await ethers.getSigners();
      const evil = await deployEvilToken();

      const UnitPayTransfer = await ethers.getContractFactory("UnitPayTransfer");
      const transfer = await UnitPayTransfer.deploy(await evil.getAddress());
      await transfer.waitForDeployment();

      await evil.mint(alice.address, 100n * ONE);
      await evil.connect(alice).approve(await transfer.getAddress(), ethers.MaxUint256);

      const reentrantCall = transfer.interface.encodeFunctionData("transfer", [
        bob.address,
        1n * ONE,
        "",
      ]);
      await evil.connect(alice).setReentry(await transfer.getAddress(), reentrantCall);

      await expect(transfer.connect(alice).transfer(bob.address, 1n * ONE, "")).to.be.reverted;
      expect(await evil.balanceOf(bob.address)).to.equal(0);
    });
  });

  describe("UnitPayMerchant.pay", function () {
    it("reverts if the token tries to reenter pay during safeTransferFrom", async function () {
      const [owner, settlement, payer] = await ethers.getSigners();
      const evil = await deployEvilToken();

      const UnitPayMerchant = await ethers.getContractFactory("UnitPayMerchant");
      const merchantContract = await UnitPayMerchant.deploy(await evil.getAddress());
      await merchantContract.waitForDeployment();
      await merchantContract.connect(owner).registerMerchant(settlement.address);

      await evil.mint(payer.address, 100n * ONE);
      await evil.connect(payer).approve(await merchantContract.getAddress(), ethers.MaxUint256);

      const reentrantCall = merchantContract.interface.encodeFunctionData("pay", [0, 1n * ONE, ""]);
      await evil.connect(payer).setReentry(await merchantContract.getAddress(), reentrantCall);

      await expect(merchantContract.connect(payer).pay(0, 1n * ONE, "")).to.be.reverted;
      expect(await evil.balanceOf(settlement.address)).to.equal(0);
    });
  });
});
