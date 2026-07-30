import { getChain } from "./config";

function toEnvSuffix(chainKey: string): string {
  return chainKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

export function rpcEnvVarName(chainKey: string): string {
  return `UNITPAY_RPC_URL_${toEnvSuffix(chainKey)}`;
}

export function rpcUrlForChain(chainKey: string): string {
  const envName = rpcEnvVarName(chainKey);
  const configured = process.env[envName]?.trim();
  return configured || getChain(chainKey).rpcUrl;
}
