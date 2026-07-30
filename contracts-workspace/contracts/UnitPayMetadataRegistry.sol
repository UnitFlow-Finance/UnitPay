// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UnitPayMetadataRegistry
 * @notice Contract-backed metadata store for UnitPay product records that were
 *         previously held in server-side JSON files: pods, P2P offers/trades,
 *         custom tokens, and collaborative payment-link metadata.
 *
 * @dev This contract deliberately stores opaque JSON strings. Product-specific
 *      invariants still live in the application layer, while this contract
 *      provides durable, append-indexed, on-chain persistence with a small
 *      authorization surface. Only the owner or approved writers can mutate
 *      records; everyone can read them.
 */
contract UnitPayMetadataRegistry is Ownable {
    uint256 public constant MAX_ID_LENGTH = 96;
    uint256 public constant MAX_DATA_LENGTH = 65535;
    uint256 public constant MAX_PAGE_SIZE = 100;

    struct MetadataRecord {
        string id;
        string data;
        uint64 updatedAt;
        bool exists;
    }

    mapping(address => bool) public writers;
    mapping(bytes32 => MetadataRecord) private records;
    mapping(bytes32 => string[]) private idsByKind;
    mapping(bytes32 => mapping(string => bool)) private idIndexedByKind;

    event WriterUpdated(address indexed writer, bool allowed);
    event MetadataUpserted(
        bytes32 indexed kind,
        string indexed id,
        address indexed writer,
        uint256 byteLength
    );
    event MetadataDeleted(bytes32 indexed kind, string indexed id, address indexed writer);

    error NotWriter();
    error EmptyKind();
    error EmptyId();
    error IdTooLong();
    error EmptyData();
    error DataTooLong();
    error PageTooLarge();
    error RecordNotFound();

    modifier onlyWriter() {
        if (msg.sender != owner() && !writers[msg.sender]) revert NotWriter();
        _;
    }

    function setWriter(address writer, bool allowed) external onlyOwner {
        writers[writer] = allowed;
        emit WriterUpdated(writer, allowed);
    }

    function upsert(bytes32 kind, string calldata id, string calldata data) external onlyWriter {
        if (kind == bytes32(0)) revert EmptyKind();
        if (bytes(id).length == 0) revert EmptyId();
        if (bytes(id).length > MAX_ID_LENGTH) revert IdTooLong();
        if (bytes(data).length == 0) revert EmptyData();
        if (bytes(data).length > MAX_DATA_LENGTH) revert DataTooLong();

        bytes32 key = _recordKey(kind, id);
        if (!idIndexedByKind[kind][id]) {
            idsByKind[kind].push(id);
            idIndexedByKind[kind][id] = true;
        }

        records[key] = MetadataRecord({
            id: id,
            data: data,
            updatedAt: uint64(block.timestamp),
            exists: true
        });

        emit MetadataUpserted(kind, id, msg.sender, bytes(data).length);
    }

    function deleteRecord(bytes32 kind, string calldata id) external onlyWriter {
        if (kind == bytes32(0)) revert EmptyKind();
        if (bytes(id).length == 0) revert EmptyId();
        if (bytes(id).length > MAX_ID_LENGTH) revert IdTooLong();
        bytes32 key = _recordKey(kind, id);
        if (!records[key].exists) revert RecordNotFound();
        delete records[key];
        emit MetadataDeleted(kind, id, msg.sender);
    }

    function getRecord(
        bytes32 kind,
        string calldata id
    ) external view returns (string memory data, uint64 updatedAt, bool exists) {
        if (kind == bytes32(0)) revert EmptyKind();
        if (bytes(id).length == 0) revert EmptyId();
        if (bytes(id).length > MAX_ID_LENGTH) revert IdTooLong();
        MetadataRecord storage record = records[_recordKey(kind, id)];
        return (record.data, record.updatedAt, record.exists);
    }

    function countRecords(bytes32 kind) external view returns (uint256) {
        if (kind == bytes32(0)) revert EmptyKind();
        return idsByKind[kind].length;
    }

    function listRecords(
        bytes32 kind,
        uint256 offset,
        uint256 limit
    )
        external
        view
        returns (
            string[] memory ids,
            string[] memory data,
            uint64[] memory updatedAt,
            bool[] memory exists,
            uint256 total
        )
    {
        if (kind == bytes32(0)) revert EmptyKind();
        if (limit > MAX_PAGE_SIZE) revert PageTooLarge();
        total = idsByKind[kind].length;
        if (offset >= total) {
            return (new string[](0), new string[](0), new uint64[](0), new bool[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 length = end - offset;

        ids = new string[](length);
        data = new string[](length);
        updatedAt = new uint64[](length);
        exists = new bool[](length);

        for (uint256 i = 0; i < length; i += 1) {
            string storage id = idsByKind[kind][offset + i];
            MetadataRecord storage record = records[_recordKey(kind, id)];
            ids[i] = id;
            data[i] = record.data;
            updatedAt[i] = record.updatedAt;
            exists[i] = record.exists;
        }
    }

    function _recordKey(bytes32 kind, string memory id) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(kind, id));
    }
}
