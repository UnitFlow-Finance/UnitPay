# Spec: Resolve Registry Contract Invalid Private Key Error

## Objective

Investigate and fix the cross-section registry contract error:

```text
invalid private key, expected hex or 32 bytes, got string
```

The error appears across sections that write metadata through the on-chain registry-backed store, including pods, P2P, payment-link pod metadata, tokens, cards, and arbitrators.

## Current Findings

- Registry-backed metadata writes are centralized in `lib/platform/store.ts`.
- The app reads `process.env.UNITPAY_METADATA_REGISTRY_PRIVATE_KEY` in `registryPrivateKey()`.
- The current implementation only prepends `0x` when missing, then passes the result to `privateKeyToAccount()`.
- `privateKeyToAccount()` expects a valid 32-byte private key as a hex string: `0x` followed by exactly 64 hex characters.
- The observed error likely occurs when the deployed secret is one of the following:
  - Wrapped in quotes that are preserved by the platform secret manager.
  - Contains whitespace, newline, or carriage return characters.
  - Contains an accidental label such as `PRIVATE_KEY=...`.
  - Contains a non-hex value, mnemonic, JSON key, or placeholder.
  - Contains an empty string or malformed value.
- Since all registry-backed sections share `readJsonFile()` / `updateJsonFile()`, one malformed signing secret breaks metadata creation/update everywhere.

## Requirements

1. Registry private-key parsing must be strict, deterministic, and safe.
2. The app must reject malformed registry signer secrets with a clear operational error before calling `privateKeyToAccount()`.
3. The app must not leak private-key contents in logs, API responses, or thrown messages.
4. The same fix must cover every section using the registry-backed platform store.
5. Registry reads must continue to work without a private key.
6. Registry writes must require a valid authorized signer unless an explicitly configured non-production test mode is active.
7. The committed `.env.example` must not include a raw private-key placeholder for application runtime.
8. The implementation must preserve the on-chain storage architecture and must not reintroduce filesystem storage.
9. Error responses from registry write APIs should be user-safe and actionable, for example:
   - `Registry signer secret is malformed. Configure UNITPAY_METADATA_REGISTRY_PRIVATE_KEY as a 32-byte hex private key.`
10. Tests must cover valid and invalid signer-secret formats.

## Constraints

- Do not implement during plan mode.
- Do not commit or print any real private key.
- Do not add file-backed storage fallback.
- Do not fall back to the generic `PRIVATE_KEY` env var in the app runtime.
- Do not expose signer details to the browser.
- Do not change public API shapes unless required for error handling.
- Keep compatibility with existing registry contract address and metadata schema.
- Contract deployment tooling may continue to use `contracts-workspace/.env.example` and `PRIVATE_KEY` for Hardhat deployments; this is separate from the Next app runtime.

## Architecture

### Affected Layer

The primary fix belongs in the platform store:

```text
lib/platform/store.ts
  readJsonFile()
  writeJsonFile()
  updateJsonFile()
  registryPrivateKey()
  getWalletClient()
```

All affected product modules already use this layer:

```text
lib/pods/store.ts
lib/p2p/store.ts
lib/cards/store.ts
lib/arbitration/store.ts
app/api/tokens/route.ts
```

Therefore, a centralized fix resolves the error across all registry-backed sections.

### Proposed Private-Key Normalization

Create a helper such as `normalizeRegistryPrivateKey(raw: string | undefined): Hex`.

Expected behavior:

1. Reject missing or empty values.
2. Trim whitespace.
3. Remove one matching pair of wrapping quotes if present.
4. Reject values that contain `=`, spaces inside the key, or newline characters after trimming.
5. Accept either:
   - `64` hex characters, or
   - `0x` plus `64` hex characters.
6. Return the normalized `0x${64 hex chars}` value.
7. Throw a sanitized app error for all invalid inputs.

The helper must never include the submitted secret in the thrown error.

### Error Handling

Add or reuse a server-side route error type so registry signer configuration failures return controlled 500 responses from API routes that call `updateJsonFile()`.

Preferred response shape:

```json
{
  "error": "Registry signer secret is malformed. Configure UNITPAY_METADATA_REGISTRY_PRIVATE_KEY as a 32-byte hex private key."
}
```

Do not return the lower-level `privateKeyToAccount()` message directly.

### Read vs Write Behavior

- `readJsonFile()` should not require the signer private key.
- `writeJsonFile()` and `updateJsonFile()` should require the signer private key.
- This keeps public discovery/listing pages functional even if the write signer is misconfigured.

### Optional Long-Term Improvement

The most secure long-term design is to avoid app-server private-key signing entirely:

- Use Circle User-Controlled Wallet contract execution challenges for registry writes.
- Or use an admin/relayer service with managed KMS/HSM signing.
- Or redesign the registry to support user-authored signed messages with EIP-712 verification and replay protection.

This plan focuses on resolving the current invalid-key runtime failure safely without changing the whole persistence model.

## Implementation Steps

1. Add Private-Key Normalization Helper
   - Implement `normalizeRegistryPrivateKey(raw)` in `lib/platform/store.ts` or a small server-only helper module.
   - Validate exact 32-byte hex format.
   - Sanitize all thrown messages.

2. Update Registry Signer Creation
   - Change `registryPrivateKey()` to use the normalization helper.
   - Ensure `privateKeyToAccount()` only receives validated `0x` + 64 hex input.

3. Improve Registry Write Errors
   - Wrap signer-configuration errors into a controlled route error or sanitized thrown error.
   - Ensure API routes using pods/P2P/tokens/cards/arbitrators return a clear message instead of raw library errors.

4. Preserve Read-Only Behavior
   - Confirm `readOnchainRecord()` does not call `registryPrivateKey()`.
   - Confirm discovery/list/read pages continue to operate without the write signer.

5. Add Tests
   - Unit test accepted formats:
     - `0x` + 64 hex chars.
     - 64 hex chars without prefix.
     - values with leading/trailing whitespace.
     - values wrapped once in quotes, if supported.
   - Unit test rejected formats:
     - empty string.
     - placeholder text.
     - `PRIVATE_KEY=...`.
     - too short or too long.
     - non-hex characters.
     - mnemonic words.
     - newline-contaminated values.

6. Verify All Registry-Backed Sections
   - Pods create/update/import/contribute metadata.
   - P2P offer/trade create/update metadata.
   - Payment link collaborative pod creation.
   - Custom token add.
   - Cards and arbitrator builder metadata.

7. Documentation
   - Update `.env.example` comments if needed without adding a private-key placeholder.
   - Add a short README note explaining the secret must be configured in deployment as a secure secret:
     - name: `UNITPAY_METADATA_REGISTRY_PRIVATE_KEY`
     - format: `0x` + 64 hex characters
     - never commit it.

## Success Criteria

- Malformed `UNITPAY_METADATA_REGISTRY_PRIVATE_KEY` no longer produces the raw viem/noble error.
- API responses return a sanitized, actionable configuration error.
- Valid 32-byte private keys work with and without `0x` prefix.
- Registry reads work without a signer secret.
- Registry writes work when a valid authorized signer secret is configured.
- No secret values are logged, committed, or returned to clients.
- No filesystem metadata storage is reintroduced.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Contract tests remain passing if contract files are untouched.

## Rollout Notes

- The deployment platform secret should be checked and corrected.
- The value must be a private key only, not a line like `UNITPAY_METADATA_REGISTRY_PRIVATE_KEY=...`.
- If the platform UI preserves quotes, the implementation should either strip one matching quote pair or reject with clear guidance.
- After deployment, test one write flow first, such as creating a private test pod, then verify P2P offer creation and collaborative payment-link pod creation.
