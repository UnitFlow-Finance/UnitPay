import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const queues = new Map<string, Promise<unknown>>();

function dataDir(): string {
  if (process.env.UNITPAY_DATA_DIR) return process.env.UNITPAY_DATA_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "unitpay-data");
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), ".unitpay-data");
}

export function dataFilePath(fileName: string): string {
  return path.join(dataDir(), fileName);
}

function cloneFallback<T>(fallback: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(fallback)
    : (JSON.parse(JSON.stringify(fallback)) as T);
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(dataFilePath(fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return cloneFallback(fallback);
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(dataFilePath(fileName), JSON.stringify(data, null, 2), "utf8");
}

export async function updateJsonFile<T, R>(
  fileName: string,
  fallback: T,
  updater: (data: T) => R | Promise<R>,
): Promise<R> {
  const run = async () => {
    const data = await readJsonFile(fileName, fallback);
    const result = await updater(data);
    await writeJsonFile(fileName, data);
    return result;
  };
  const previous = queues.get(fileName) ?? Promise.resolve();
  const next = previous.then(run, run);
  queues.set(fileName, next.catch(() => undefined));
  return next;
}
