/**
 * Server-only Circle User-Controlled Wallets client.
 *
 * SECURITY: This module must never be imported from client components.
 * `CIRCLE_API_KEY` stays server-side; the browser only ever receives
 * short-lived `userToken` + `encryptionKey` pairs via our own API routes,
 * per the use-user-controlled-wallets skill's non-negotiable security rules.
 */
import "server-only";
import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;

if (!apiKey) {
  // Do not throw at import time in dev/test contexts where the route isn't
  // exercised, but calling code should always check `circleConfigured`.
  console.warn(
    "[circle] CIRCLE_API_KEY is not set. Circle Wallets API routes will fail until it is configured.",
  );
}

export const circleConfigured = Boolean(apiKey);

export const circleClient = initiateUserControlledWalletsClient({
  apiKey: apiKey ?? "unset",
});
