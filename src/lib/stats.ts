import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export type AnalyzeStats = {
  analyzes: number;
  persistence: "volume" | "temporary";
};

type StatsStore = AnalyzeStats & {
  filePath: string;
};

const VOLUME_DIR = "/data";
const TEMPORARY_DIR = "/tmp/diffjury";
let storePromise: Promise<StatsStore> | undefined;
let operationQueue = Promise.resolve();

async function readCount(filePath: string): Promise<number> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as {
      analyzes?: unknown;
    };
    return typeof parsed.analyzes === "number" &&
      Number.isSafeInteger(parsed.analyzes) &&
      parsed.analyzes >= 0
      ? parsed.analyzes
      : 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("diffjury_stats_read_error", error);
    }
    return 0;
  }
}

async function openDirectory(
  directory: string,
  persistence: AnalyzeStats["persistence"],
): Promise<StatsStore> {
  await mkdir(directory, { recursive: true });
  await access(directory, constants.W_OK);
  const filePath = path.join(directory, "stats.json");
  return {
    analyzes: await readCount(filePath),
    persistence,
    filePath,
  };
}

async function initializeStore(): Promise<StatsStore> {
  try {
    return await openDirectory(VOLUME_DIR, "volume");
  } catch {
    try {
      return await openDirectory(TEMPORARY_DIR, "temporary");
    } catch {
      return { analyzes: 0, persistence: "temporary", filePath: "" };
    }
  }
}

function getStore(): Promise<StatsStore> {
  storePromise ??= initializeStore();
  return storePromise;
}

async function writeStore(store: StatsStore): Promise<void> {
  if (!store.filePath) {
    return;
  }
  const temporaryPath = `${store.filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify({ analyzes: store.analyzes })}\n`,
    "utf8",
  );
  await rename(temporaryPath, store.filePath);
}

async function moveToTemporary(analyzes: number): Promise<StatsStore> {
  const store = await openDirectory(TEMPORARY_DIR, "temporary");
  store.analyzes = Math.max(store.analyzes, analyzes);
  await writeStore(store);
  storePromise = Promise.resolve(store);
  return store;
}

export async function getAnalyzeStats(): Promise<AnalyzeStats> {
  await operationQueue;
  const { analyzes, persistence } = await getStore();
  return { analyzes, persistence };
}

export async function incrementAnalyzeCount(): Promise<AnalyzeStats> {
  let result: AnalyzeStats | undefined;

  operationQueue = operationQueue.then(async () => {
    let store = await getStore();
    store.analyzes += 1;

    try {
      await writeStore(store);
    } catch (error) {
      console.error("diffjury_stats_write_error", error);
      try {
        store = await moveToTemporary(store.analyzes);
      } catch (fallbackError) {
        console.error("diffjury_stats_fallback_error", fallbackError);
        store.persistence = "temporary";
      }
    }

    result = {
      analyzes: store.analyzes,
      persistence: store.persistence,
    };
  });

  await operationQueue;
  return result!;
}
