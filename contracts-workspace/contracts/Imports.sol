// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Forces Hardhat to compile + generate artifacts for these OpenZeppelin
// contracts, which are only referenced from scripts/deploy.js (not from any
// UnitPay contract's Solidity source) but are needed there via
// `ethers.getContractFactory`.
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
