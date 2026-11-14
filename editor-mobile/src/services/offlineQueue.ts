import AsyncStorage from "@react-native-async-storage/async-storage";

export type OfflineActionKind = "score" | "event";

export type OfflineAction = {
  id: string;
  fixtureId: string;
  kind: OfflineActionKind;
  payload: Record<string, unknown>;
  createdAt: number;
  tries: number;
};

const STORAGE_KEY = "tactica_editor_offline_queue";

function isRetryableError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("network") || m.includes("fetch") || m.includes("failed to fetch") ||
    m.includes("offline") || m.includes("no connection") || m.includes("timeout") ||
    m.includes("load failed") || m.includes("reset by peer");
}

export async function isRetryableNetworkError(error: unknown): Promise<boolean> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return isRetryableError(message);
}

export async function readOfflineQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeOfflineQueue(queue: OfflineAction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineAction(action: OfflineAction): Promise<void> {
  const queue = await readOfflineQueue();
  queue.push(action);
  await writeOfflineQueue(queue);
}

export async function flushOfflineQueue(
  apply: (action: OfflineAction) => Promise<void>
): Promise<void> {
  const queue = await readOfflineQueue();
  if (queue.length === 0) return;

  const remaining: OfflineAction[] = [];
  for (const action of queue) {
    try {
      await apply(action);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (isRetryableError(message)) {
        remaining.push({ ...action, tries: (action.tries ?? 0) + 1 });
      }
    }
  }
  await writeOfflineQueue(remaining);
}
