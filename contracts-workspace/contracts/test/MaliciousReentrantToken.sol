// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MaliciousReentrantToken
 * @notice Test-only ERC-20 that, when configured with `setReentry`,
 *         attempts to call back into an arbitrary target+calldata from
 *         within `transfer` and `transferFrom` — simulating a malicious or
 *         compromised token attempting to reenter a UnitPay contract
 *         mid-transfer (e.g. while the escrow/packet contract is calling
 *         safeTransfer/safeTransferFrom on it). Used solely to verify that
 *         `nonReentrant` on every fund-moving function actually blocks
 *         this. Never deployed to Arc Testnet or any live network.
 */
contract MaliciousReentrantToken is ERC20 {
    address public reentryTarget;
    bytes public reentryData;
    bool public reentryEnabled;

    constructor() ERC20("Malicious Reentrant Token", "EVIL") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryData = data;
        reentryEnabled = true;
    }

    function disableReentry() external {
        reentryEnabled = false;
    }

    function _attemptReentry() internal {
        if (!reentryEnabled) return;
        // Disable before the call so a *successful* reentrant call
        // doesn't itself trigger infinite recursion; a revert here means
        // nonReentrant did its job and the outer transfer should also
        // revert (SafeERC20 requires transfer/transferFrom to succeed).
        reentryEnabled = false;
        (bool ok, ) = reentryTarget.call(reentryData);
        require(ok, "reentry call failed");
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _attemptReentry();
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _attemptReentry();
        return super.transferFrom(from, to, amount);
    }
}
