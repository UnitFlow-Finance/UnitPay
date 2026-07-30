const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UnitPayMetadataRegistry", function () {
  let registry, owner, writer, stranger;
  const KIND = ethers.keccak256(ethers.toUtf8Bytes("unitpay.platform.store.v1"));

  beforeEach(async function () {
    [owner, writer, stranger] = await ethers.getSigners();

    const UnitPayMetadataRegistry = await ethers.getContractFactory("UnitPayMetadataRegistry");
    registry = await UnitPayMetadataRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("lets the owner upsert and read a metadata record", async function () {
    await expect(registry.upsert(KIND, "pods.json", '{"pods":[]}'))
      .to.emit(registry, "MetadataUpserted")
      .withArgs(KIND, "pods.json", owner.address, 11);

    const [data, updatedAt, exists] = await registry.getRecord(KIND, "pods.json");
    expect(data).to.equal('{"pods":[]}');
    expect(updatedAt).to.be.greaterThan(0);
    expect(exists).to.equal(true);
  });

  it("allows the owner to authorize a writer", async function () {
    await expect(registry.setWriter(writer.address, true))
      .to.emit(registry, "WriterUpdated")
      .withArgs(writer.address, true);

    await registry.connect(writer).upsert(KIND, "p2p.json", '{"offers":[]}');
    const [data, , exists] = await registry.getRecord(KIND, "p2p.json");
    expect(data).to.equal('{"offers":[]}');
    expect(exists).to.equal(true);
  });

  it("rejects writes from unauthorized accounts", async function () {
    await expect(
      registry.connect(stranger).upsert(KIND, "pods.json", '{"pods":[]}'),
    ).to.be.revertedWithCustomError(registry, "NotWriter");
  });

  it("rejects empty ids and empty payloads", async function () {
    await expect(registry.upsert(KIND, "", "{}")).to.be.revertedWithCustomError(
      registry,
      "EmptyId",
    );
    await expect(registry.upsert(KIND, "pods.json", "")).to.be.revertedWithCustomError(
      registry,
      "EmptyData",
    );
  });

  it("rejects oversized ids, oversized payloads, empty kind, and oversized pages", async function () {
    await expect(registry.upsert(ethers.ZeroHash, "pods.json", "{}")).to.be.revertedWithCustomError(
      registry,
      "EmptyKind",
    );
    await expect(registry.upsert(KIND, "a".repeat(97), "{}")).to.be.revertedWithCustomError(
      registry,
      "IdTooLong",
    );
    await expect(registry.upsert(KIND, "pods.json", "a".repeat(65536))).to.be.revertedWithCustomError(
      registry,
      "DataTooLong",
    );
    await expect(registry.listRecords(KIND, 0, 101)).to.be.revertedWithCustomError(
      registry,
      "PageTooLarge",
    );
  });

  it("lists records for a kind", async function () {
    await registry.upsert(KIND, "pods.json", '{"pods":[]}');
    await registry.upsert(KIND, "p2p.json", '{"offers":[]}');

    const [ids, data, , exists, total] = await registry.listRecords(KIND, 0, 10);
    expect(total).to.equal(2);
    expect(ids).to.deep.equal(["pods.json", "p2p.json"]);
    expect(data).to.deep.equal(['{"pods":[]}', '{"offers":[]}']);
    expect(exists).to.deep.equal([true, true]);
  });

  it("marks deleted records as not existing while preserving the index", async function () {
    await registry.upsert(KIND, "pods.json", '{"pods":[]}');
    await expect(registry.deleteRecord(KIND, "pods.json"))
      .to.emit(registry, "MetadataDeleted")
      .withArgs(KIND, "pods.json", owner.address);

    const [, , exists] = await registry.getRecord(KIND, "pods.json");
    expect(exists).to.equal(false);

    const [ids, data, , listExists, total] = await registry.listRecords(KIND, 0, 10);
    expect(total).to.equal(1);
    expect(ids).to.deep.equal(["pods.json"]);
    expect(data).to.deep.equal([""]);
    expect(listExists).to.deep.equal([false]);
  });
});
