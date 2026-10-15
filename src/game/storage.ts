import {
  ballSkinOptions,
  fieldSkinOptions,
  goalSkinOptions,
  type BallSkinId,
  type FieldSkinId,
  type GameSkins,
  type GoalSkinId,
  type SkinTarget,
} from "./skins";
import type { GameConfig } from "./types";

const settingsKey = "tanqiu-workshop-settings";
const skinsKey = "tanqiu-workshop-skins";
const dbName = "tanqiu-workshop";
const dbVersion = 1;
const imageStore = "skin-images";

export function loadSettings(fallback: GameConfig): GameConfig {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(settingsKey);
  if (!stored) return fallback;

  try {
    return { ...fallback, ...(JSON.parse(stored) as Partial<GameConfig>) };
  } catch (error) {
    console.warn("恢复设置失败", error);
    return fallback;
  }
}

export function saveSettings(value: GameConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(settingsKey, JSON.stringify(value));
}

const isBallSkin = (value: unknown): value is BallSkinId => ballSkinOptions.some((item) => item.id === value);
const isGoalSkin = (value: unknown): value is GoalSkinId => goalSkinOptions.some((item) => item.id === value);
const isFieldSkin = (value: unknown): value is FieldSkinId => fieldSkinOptions.some((item) => item.id === value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function loadSkins(fallback: GameSkins): GameSkins {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(skinsKey);
  if (!stored) return fallback;

  try {
    const parsed = JSON.parse(stored) as Partial<GameSkins>;
    const value: GameSkins = {
      ball: isBallSkin(parsed.ball) ? parsed.ball : fallback.ball,
      goal: isGoalSkin(parsed.goal) ? parsed.goal : fallback.goal,
      field: isFieldSkin(parsed.field) ? parsed.field : fallback.field,
      fieldImageOpacity: clamp(Number(parsed.fieldImageOpacity ?? fallback.fieldImageOpacity), 0, 90),
    };
    return value;
  } catch (error) {
    console.warn("恢复皮肤失败", error);
    return fallback;
  }
}

export function saveSkins(value: GameSkins) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(skinsKey, JSON.stringify(value));
}

let databasePromise: Promise<IDBDatabase | null> | undefined;

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(dbName, dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(imageStore)) {
        db.createObjectStore(imageStore, { keyPath: "target" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("无法打开本地图片数据库", request.error);
      resolve(null);
    };
  });

  return databasePromise;
}

export async function readSkinImage(target: SkinTarget): Promise<Blob | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(imageStore, "readonly");
    const store = transaction.objectStore(imageStore);
    const request = store.get(target);

    request.onsuccess = () => {
      const result = request.result as { target: SkinTarget; blob: Blob } | undefined;
      resolve(result?.blob);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function writeSkinImage(target: SkinTarget, blob?: Blob) {
  const database = await openDatabase();
  if (!database) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(imageStore, "readwrite");
    const store = transaction.objectStore(imageStore);
    if (blob) {
      store.put({ target, blob });
    } else {
      store.delete(target);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
