import { defineStore } from "pinia";
import { ref } from "vue";
import { api, ApiError } from "../lib/api";

export const useAuthStore = defineStore("auth", () => {
  const username = ref<string | null>(null);
  const ready = ref(false); // becomes true after the initial /me check

  async function checkSession(): Promise<void> {
    try {
      const me = await api.get<{ username: string }>("/auth/me");
      username.value = me.username;
    } catch {
      username.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(user: string, password: string): Promise<void> {
    try {
      const res = await api.post<{ username: string }>("/auth/login", {
        username: user,
        password,
      });
      username.value = res.username;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw new Error("Invalid username or password.");
      }
      if (err instanceof ApiError && err.status === 429) {
        throw new Error("Too many attempts. Please wait a few minutes.");
      }
      throw new Error("Could not sign in. Please try again.");
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } finally {
      username.value = null;
    }
  }

  return { username, ready, checkSession, login, logout };
});
