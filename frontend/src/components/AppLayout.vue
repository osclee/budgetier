<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import MonthSelector from "./MonthSelector.vue";

const auth = useAuthStore();
const router = useRouter();

const tabs = [
  { name: "transactions", label: "Transactions" },
  { name: "balances", label: "Balances" },
  { name: "categories", label: "Categories" },
  { name: "recurring", label: "Recurring" },
  { name: "insights", label: "Insights" },
];

async function logout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="min-h-full">
    <header class="bg-brand-700 text-white shadow">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div class="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span>💰 Budgetier</span>
        </div>
        <nav class="flex gap-1">
          <RouterLink
            v-for="t in tabs"
            :key="t.name"
            :to="{ name: t.name }"
            class="rounded-md px-3 py-1.5 text-sm font-medium text-brand-50 hover:bg-brand-600"
            active-class="bg-brand-800 text-white"
          >
            {{ t.label }}
          </RouterLink>
        </nav>
        <div class="ml-auto flex items-center gap-4">
          <MonthSelector />
          <button
            class="text-sm font-medium text-brand-50 hover:text-white"
            @click="logout"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
