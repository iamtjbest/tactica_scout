// src/services/base.ts — where the backend lives.
//
// Same resolution scout-mobile uses: an env default, overridable at
// runtime and remembered, so the app can be pointed at a laptop running
// the backend without a rebuild.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "tactica_editor_api_url";

let active =
  process.env.EXPO_PUBLIC_API_URL || "https://tactica-scout-api.onrender.com";

export async function getApiBase(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) active = saved;
  } catch {
    // Storage can fail on a fresh install or in a restricted context.
    // Falling back to the default is correct: the app still works.
  }
  return active;
}

export async function setApiBase(url: string): Promise<void> {
  active = url;
  await AsyncStorage.setItem(STORAGE_KEY, url);
}
