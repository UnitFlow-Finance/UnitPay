import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".unitpay-data");
const queues = new Map<string, Promise<unknown>>();

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(DATA_DIR, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2), "utf8");
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
