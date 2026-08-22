const DB_NAME = "bakeops-test-data";
const DB_VERSION = 2;
const STORE_NAME = "responses";
const MUTATION_STORE_NAME = "mutations";

type StoredResponse = { key: string; value: unknown; updatedAt: number };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
      if (!request.result.objectStoreNames.contains(MUTATION_STORE_NAME)) {
        request.result.createObjectStore(MUTATION_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to open local test data."));
  });
}

export async function readTestResponse<T>(key: string): Promise<T | undefined> {
  if (typeof window === "undefined" || !window.indexedDB) return undefined;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as StoredResponse | undefined)?.value as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("Unable to read local test data."));
  });
}

export async function readTestResponsesByPrefix<T>(
  prefix: string,
): Promise<Array<{ key: string; value: T; updatedAt: number }>> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(
      (request.result as Array<{ key: string; value: T; updatedAt: number }>)
        .filter((item) => item.key.startsWith(prefix))
        .sort((left, right) => right.updatedAt - left.updatedAt),
    );
    request.onerror = () => reject(request.error ?? new Error("Unable to read local test data."));
  });
}

export type LocalMutation = { key: string; root: string; method: string; id: string | null; value: unknown; updatedAt: number };

export async function writeTestMutation(root: string, method: string, id: string | null, value: unknown): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const key = `${root}:${id ?? "new"}:${Date.now()}`;
    const request = database.transaction(MUTATION_STORE_NAME, "readwrite").objectStore(MUTATION_STORE_NAME).put({ key, root, method, id, value, updatedAt: Date.now() } satisfies LocalMutation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save local test mutation."));
  });
}

export async function writeTestMutations(
  mutations: Array<{ root: string; method: string; id: string | null; value: unknown }>,
): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB || mutations.length === 0) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MUTATION_STORE_NAME, "readwrite");
    const store = transaction.objectStore(MUTATION_STORE_NAME);
    const timestamp = Date.now();
    mutations.forEach((mutation, index) => {
      store.put({
        key: `${mutation.root}:${mutation.id ?? "new"}:${timestamp}:${index}`,
        ...mutation,
        updatedAt: timestamp + index,
      } satisfies LocalMutation);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save local test mutations."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Unable to save local test mutations."));
  });
}

export async function readTestMutations(root: string): Promise<LocalMutation[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(MUTATION_STORE_NAME, "readonly").objectStore(MUTATION_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as LocalMutation[]).filter((item) => item.root === root).sort((a, b) => a.updatedAt - b.updatedAt));
    request.onerror = () => reject(request.error ?? new Error("Unable to read local test mutations."));
  });
}

export async function writeTestResponse(key: string, value: unknown): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ key, value, updatedAt: Date.now() } satisfies StoredResponse);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save local test data."));
  });
}

export async function clearTestResponses(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to clear local test data."));
  });
}
