<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    await auth.login(username.value, password.value);
    const redirect = (route.query.redirect as string) || "/";
    router.push(redirect);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Sign in failed.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <div class="text-3xl font-bold text-brand-700">💰 Budgetier</div>
        <p class="mt-1 text-sm text-gray-500">Sign in to your budget</p>
      </div>
      <form
        class="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        @submit.prevent="submit"
      >
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Username</label>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            required
            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">Password</label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button
          type="submit"
          :disabled="busy"
          class="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {{ busy ? "Signing in…" : "Sign in" }}
        </button>
      </form>
    </div>
  </div>
</template>
