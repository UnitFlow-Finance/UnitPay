const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const SplitMode = { Equal: 0, Random: 1 };

describe("UnitPayPacket", function () {
  let usdc, packet, creator, claimer1, claimer2, claimer3, stranger;
  const ONE_USDC = 1_000_000n; // 6 decimals
  const HOUR = 60n * 60n;

  beforeEach(async function () {
    [creator, claimer1, claimer2, claimer3, stranger] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const UnitPayPacket = await ethers.getContractFactory("UnitPayPacket");
    packet = await UnitPayPacket.deploy(await usdc.getAddress());
    await packet.waitForDeployment();

    await usdc.mint(creator.address, 1000n * ONE_USDC);
    await usdc.connect(creator).approve(await packet.getAddress(), ethers.MaxUint256);
  });

  it("deploys with the correct USDC address", async function () {
    expect(await packet.usdc()).to.equal(await usdc.getAddress());
  });

  it("reverts deployment with a zero USDC address", async function () {
    const UnitPayPacket = await ethers.getContractFactory("UnitPayPacket");
    await expect(UnitPayPacket.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      UnitPayPacket,
      "ZeroAddress",
    );
  });

  describe("createPacket", function () {
    it("locks funds and emits PacketCreated", async function () {
      await expect(
        packet.connect(creator).createPacket(5, 10n * ONE_USDC, SplitMode.Equal, HOUR),
      ).to.emit(packet, "PacketCreated");

      expect(await usdc.balanceOf(await packet.getAddress())).to.equal(10n * ONE_USDC);

      const p = await packet.packets(0);
      expect(p.creator).to.equal(creator.address);
      expect(p.totalAmount).to.equal(10n * ONE_USDC);
      expect(p.remainingAmount).to.equal(10n * ONE_USDC);
      expect(p.maxClaims).to.equal(5);
      expect(p.claimsMade).to.equal(0);
      expect(p.splitMode).to.equal(SplitMode.Equal);
    });

    it("reverts with zero maxClaims", async function () {
      await expect(
        packet.connect(creator).createPacket(0, 10n * ONE_USDC, SplitMode.Equal, HOUR),
      ).to.be.revertedWithCustomError(packet, "ZeroClaims");
    });

    it("reverts with too many claims", async function () {
      await expect(
        packet.connect(creator).createPacket(201, 1000n * ONE_USDC, SplitMode.Equal, HOUR),
      ).to.be.revertedWithCustomError(packet, "TooManyClaims");
    });

    it("reverts with zero amount", async function () {
      await expect(
        packet.connect(creator).createPacket(5, 0, SplitMode.Equal, HOUR),
      ).to.be.revertedWithCustomError(packet, "ZeroAmount");
    });

    it("reverts if amount is less than maxClaims (can't guarantee >=1 unit per share)", async function () {
      await expect(
        packet.connect(creator).createPacket(10, 5, SplitMode.Equal, HOUR),
      ).to.be.revertedWithCustomError(packet, "AmountTooSmall");
    });

    it("reverts with expiry below the minimum", async function () {
      await expect(
        packet.connect(creator).createPacket(5, 10n * ONE_USDC, SplitMode.Equal, 60),
      ).to.be.revertedWithCustomError(packet, "ExpiryOutOfRange");
    });

    it("reverts with expiry above the maximum", async function () {
      await expect(
        packet
          .connect(creator)
          .createPacket(5, 10n * ONE_USDC, SplitMode.Equal, 366n * 24n * HOUR),
      ).to.be.revertedWithCustomError(packet, "ExpiryOutOfRange");
    });
  });

  describe("claim — equal split", function () {
    beforeEach(async function () {
      await packet.connect(creator).createPacket(4, 40n * ONE_USDC, SplitMode.Equal, HOUR);
    });

    it("pays each claimer an equal share", async function () {
      await expect(packet.connect(claimer1).claim(0))
        .to.emit(packet, "PacketClaimed")
        .withArgs(0, claimer1.address, 10n * ONE_USDC, 1);
      expect(await usdc.balanceOf(claimer1.address)).to.equal(10n * ONE_USDC);
    });

    it("gives the final claimer any integer-division remainder", async function () {
      // 40_000_000 base units / 3 = 13_333_333.33 -> 13_333_333 per share
      // via integer division, with the last claim absorbing the leftover
      // 13_333_334 so the packet drains to exactly zero.
      await packet.connect(creator).createPacket(3, 40n * ONE_USDC, SplitMode.Equal, HOUR);
      const packetId = 1;
      const shareEach = (40n * ONE_USDC) / 3n; // 13_333_333

      const bal1Before = await usdc.balanceOf(claimer1.address);
      await packet.connect(claimer1).claim(packetId);
      expect((await usdc.balanceOf(claimer1.address)) - bal1Before).to.equal(shareEach);

      await packet.connect(claimer2).claim(packetId);

      const balBefore = await usdc.balanceOf(claimer3.address);
      await packet.connect(claimer3).claim(packetId);
      const received = (await usdc.balanceOf(claimer3.address)) - balBefore;

      expect(received).to.equal(40n * ONE_USDC - shareEach * 2n);

      const p = await packet.packets(packetId);
      expect(p.remainingAmount).to.equal(0);
    });

    it("marks the packet fully drained after all claims", async function () {
      await packet.connect(claimer1).claim(0);
      await packet.connect(claimer2).claim(0);
      await packet.connect(claimer3).claim(0);
      await packet.connect(stranger).claim(0);

      const p = await packet.packets(0);
      expect(p.remainingAmount).to.equal(0);
      expect(p.claimsMade).to.equal(4);
    });

    it("reverts on a second claim from the same address", async function () {
      await packet.connect(claimer1).claim(0);
      await expect(packet.connect(claimer1).claim(0)).to.be.revertedWithCustomError(
        packet,
        "AlreadyClaimed",
      );
    });

    it("reverts once all claims are exhausted", async function () {
      await packet.connect(claimer1).claim(0);
      await packet.connect(claimer2).claim(0);
      await packet.connect(claimer3).claim(0);
      await packet.connect(stranger).claim(0);
      const [, , , , fifthSigner] = await ethers.getSigners();
      await expect(packet.connect(fifthSigner).claim(0)).to.be.revertedWithCustomError(
        packet,
        "FullyClaimed",
      );
    });

    it("reverts claiming a nonexistent packet", async function () {
      await expect(packet.connect(claimer1).claim(999)).to.be.revertedWithCustomError(
        packet,
        "PacketNotFound",
      );
    });

    it("reverts claiming after expiry", async function () {
      await time.increase(Number(HOUR) + 60);
      await expect(packet.connect(claimer1).claim(0)).to.be.revertedWithCustomError(
        packet,
        "PacketExpired",
      );
    });

    it("reverts a claim made through a wrapper contract (msg.sender != tx.origin)", async function () {
      const MaliciousPacketClaimer = await ethers.getContractFactory("MaliciousPacketClaimer");
      const wrapper = await MaliciousPacketClaimer.deploy();
      await wrapper.waitForDeployment();

      await expect(
        wrapper.connect(claimer1).claimVia(await packet.getAddress(), 0),
      ).to.be.revertedWithCustomError(packet, "ContractsCannotClaim");
    });

    it("blocks the reroll-until-favorable-draw attack pattern on a random-split packet", async function () {
      // Random-mode packet so there's an actual draw to try to reroll.
      await packet
        .connect(creator)
        .createPacket(4, 40n * ONE_USDC, SplitMode.Random, HOUR);
      const randomPacketId = 1;

      const MaliciousPacketClaimer = await ethers.getContractFactory("MaliciousPacketClaimer");
      const wrapper = await MaliciousPacketClaimer.deploy();
      await wrapper.waitForDeployment();

      // Even asking for an obviously-always-satisfiable minimum (0), the
      // call still reverts at the tx.origin check before ever reaching
      // _computeShare — so there is no draw to inspect, no state written,
      // and nothing to reroll no matter how many times this is retried
      // across however many blocks.
      await expect(
        wrapper.connect(claimer1).greedyClaim(await packet.getAddress(), randomPacketId, 0),
      ).to.be.revertedWithCustomError(packet, "ContractsCannotClaim");

      const p = await packet.packets(randomPacketId);
      expect(p.claimsMade).to.equal(0);
      expect(await packet.hasClaimed(randomPacketId, claimer1.address)).to.equal(false);
    });
  });

  describe("claim — random split", function () {
    beforeEach(async function () {
      await packet.connect(creator).createPacket(4, 40n * ONE_USDC, SplitMode.Random, HOUR);
    });

    it("pays out random shares that sum to the total, each >= 1 unit", async function () {
      const claimers = [claimer1, claimer2, claimer3, stranger];
      let total = 0n;
      for (const c of claimers) {
        const before = await usdc.balanceOf(c.address);
        await packet.connect(c).claim(0);
        const received = (await usdc.balanceOf(c.address)) - before;
        expect(received).to.be.gte(1n);
        total += received;
      }
      expect(total).to.equal(40n * ONE_USDC);

      const p = await packet.packets(0);
      expect(p.remainingAmount).to.equal(0);
      expect(p.claimsMade).to.equal(4);
    });

    it("produces varying (not identical) share sizes across claims", async function () {
      // Not a strict guarantee of randomness (draws could coincidentally
      // match), but with a reasonably large packet split many ways this
      // pins down that _computeShare isn't just returning a fixed value.
      await packet.connect(creator).createPacket(20, 200n * ONE_USDC, SplitMode.Random, HOUR);
      const packetId = 1;
      const receivedAmounts = [];

      // Hardhat's default signer set is small; derive 20 fresh wallets so
      // every claim comes from a distinct address (claim() allows one
      // claim per address).
      const wallets = Array.from({ length: 20 }, () =>
        ethers.Wallet.createRandom().connect(ethers.provider),
      );
      for (const w of wallets) {
        await creator.sendTransaction({ to: w.address, value: ethers.parseEther("1") });
      }

      for (const w of wallets) {
        const before = await usdc.balanceOf(w.address);
        await packet.connect(w).claim(packetId);
        receivedAmounts.push((await usdc.balanceOf(w.address)) - before);
      }

      const distinctValues = new Set(receivedAmounts.map((a) => a.toString()));
      expect(distinctValues.size).to.be.greaterThan(1);

      const total = receivedAmounts.reduce((sum, a) => sum + a, 0n);
      expect(total).to.equal(200n * ONE_USDC);
    });
  });

  describe("reclaim", function () {
    beforeEach(async function () {
      await packet.connect(creator).createPacket(4, 40n * ONE_USDC, SplitMode.Equal, HOUR);
    });

    it("reverts before expiry", async function () {
      await expect(packet.connect(stranger).reclaim(0)).to.be.revertedWithCustomError(
        packet,
        "PacketNotExpired",
      );
    });

    it("returns the unclaimed remainder to the creator after expiry", async function () {
      await packet.connect(claimer1).claim(0);
      await time.increase(Number(HOUR) + 60);

      const before = await usdc.balanceOf(creator.address);
      await expect(packet.connect(stranger).reclaim(0))
        .to.emit(packet, "PacketReclaimed")
        .withArgs(0, 30n * ONE_USDC);
      const after = await usdc.balanceOf(creator.address);
      expect(after - before).to.equal(30n * ONE_USDC);

      const p = await packet.packets(0);
      expect(p.remainingAmount).to.equal(0);
      expect(p.reclaimed).to.equal(true);
    });

    it("is callable by anyone but always pays the creator", async function () {
      await time.increase(Number(HOUR) + 60);
      const creatorBefore = await usdc.balanceOf(creator.address);
      await packet.connect(stranger).reclaim(0);
      expect(await usdc.balanceOf(creator.address)).to.equal(creatorBefore + 40n * ONE_USDC);
    });

    it("reverts reclaiming twice", async function () {
      await time.increase(Number(HOUR) + 60);
      await packet.connect(stranger).reclaim(0);
      await expect(packet.connect(stranger).reclaim(0)).to.be.revertedWithCustomError(
        packet,
        "NothingToReclaim",
      );
    });

    it("reverts reclaiming a fully-claimed packet", async function () {
      const signers = await ethers.getSigners();
      await packet.connect(claimer1).claim(0);
      await packet.connect(claimer2).claim(0);
      await packet.connect(claimer3).claim(0);
      await packet.connect(stranger).claim(0);
      await time.increase(Number(HOUR) + 60);
      await expect(packet.connect(signers[5]).reclaim(0)).to.be.revertedWithCustomError(
        packet,
        "NothingToReclaim",
      );
    });
  });

  describe("view helpers", function () {
    it("remainingClaims reflects claims made so far", async function () {
      await packet.connect(creator).createPacket(4, 40n * ONE_USDC, SplitMode.Equal, HOUR);
      expect(await packet.remainingClaims(0)).to.equal(4);
      await packet.connect(claimer1).claim(0);
      expect(await packet.remainingClaims(0)).to.equal(3);
    });

    it("isExpired flips after the expiry window", async function () {
      await packet.connect(creator).createPacket(4, 40n * ONE_USDC, SplitMode.Equal, HOUR);
      expect(await packet.isExpired(0)).to.equal(false);
      await time.increase(Number(HOUR) + 60);
      expect(await packet.isExpired(0)).to.equal(true);
    });

    it("reverts view calls for a nonexistent packet", async function () {
      await expect(packet.remainingClaims(999)).to.be.revertedWithCustomError(
        packet,
        "PacketNotFound",
      );
      await expect(packet.isExpired(999)).to.be.revertedWithCustomError(
        packet,
        "PacketNotFound",
      );
    });
  });
});
