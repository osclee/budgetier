<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useTransactionsStore } from "../stores/transactions";
import { useCategoriesStore } from "../stores/categories";
import { useRecurringStore } from "../stores/recurring";
import { useUiStore } from "../stores/ui";
import { money, monthLabel, today } from "../lib/format";
import type { Transaction } from "../types";

const txStore = useTransactionsStore();
const catStore = useCategoriesStore();
const recurringStore = useRecurringStore();
const ui = useUiStore();

const { items, loading } = storeToRefs(txStore);
const { items: categories } = storeToRefs(catStore);

const error = ref("");
const applying = ref(false);
const applyMessage = ref("");

async function applyRecurring() {
  applying.value = true;
  applyMessage.value = "";
  error.value = "";
  try {
    const result = await recurringStore.apply(ui.month);
    await txStore.load(ui.month);
    applyMessage.value =
      result.created.length === 0
        ? result.skipped > 0
          ? `Already up to date for ${monthLabel(ui.month)}.`
          : "No active recurring items to add."
        : `Added ${result.created.length} recurring transaction(s) for ${monthLabel(ui.month)}.`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not add recurring transactions.";
  } finally {
    applying.value = false;
  }
}

// --- New transaction draft ---
const draft = ref({ date: today(), description: "", amount: "", categoryId: "" });
const adding = ref(false);

const canAdd = computed(
  () =>
    draft.value.date &&
    draft.value.description.trim() &&
    draft.value.amount !== "" &&
    !Number.isNaN(Number(draft.value.amount)) &&
    draft.value.categoryId
);

async function reload() {
  error.value = "";
  try {
    await catStore.load();
    if (!draft.value.categoryId && categories.value.length) {
      draft.value.categoryId = categories.value[0].id;
    }
    await txStore.load(ui.month);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load.";
  }
}

watch(() => ui.month, reload, { immediate: true });

async function addTransaction() {
  if (!canAdd.value || adding.value) return;
  adding.value = true;
  error.value = "";
  try {
    await txStore.add({
      date: draft.value.date,
      description: draft.value.description.trim(),
      amount: Number(draft.value.amount),
      categoryId: draft.value.categoryId,
    });
    // Keep date + category for fast repeated entry; clear description/amount.
    draft.value.description = "";
    draft.value.amount = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not add transaction.";
  } finally {
    adding.value = false;
  }
}

function colorFor(categoryId: string): string {
  return catStore.byId.get(categoryId)?.color ?? "#94a3b8";
}

function categoryName(categoryId: string): string {
  return catStore.byId.get(categoryId)?.name ?? "";
}

async function patch(t: Transaction, field: keyof Transaction, value: string) {
  error.value = "";
  try {
    if (field === "amount") {
      const n = Number(value);
      if (Number.isNaN(n)) return;
      if (n === t.amount) return;
      await txStore.update(t.id, { amount: n });
    } else if (field === "description") {
      if (value.trim() === t.description) return;
      await txStore.update(t.id, { description: value.trim() });
    } else if (field === "date") {
      if (value === t.date) return;
      await txStore.update(t.id, { date: value });
    } else if (field === "categoryId") {
      if (value === t.categoryId) return;
      await txStore.update(t.id, { categoryId: value });
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Update failed.";
  }
}

async function remove(t: Transaction) {
  if (!confirm(`Delete "${t.description}"?`)) return;
  try {
    await txStore.remove(t.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Delete failed.";
  }
}

const monthTotal = computed(() => items.value.reduce((s, t) => s + t.amount, 0));

// --- Temporary sort/filter (client-side only, resets per session — not persisted) ---
type SortKey = "date" | "description" | "amount" | "category";
const sortKey = ref<SortKey>("date");
const sortDir = ref<"asc" | "desc">("desc");
const filterCategoryId = ref<string>("");
const search = ref("");

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = key === "description" || key === "category" ? "asc" : "desc";
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return "";
  return sortDir.value === "asc" ? "▲" : "▼";
}

const hasActiveFilter = computed(
  () => filterCategoryId.value !== "" || search.value.trim() !== ""
);
const isDefaultSort = computed(() => sortKey.value === "date" && sortDir.value === "desc");

function resetView() {
  filterCategoryId.value = "";
  search.value = "";
  sortKey.value = "date";
  sortDir.value = "desc";
}

const displayedItems = computed(() => {
  let list = items.value;

  if (filterCategoryId.value) {
    list = list.filter((t) => t.categoryId === filterCategoryId.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter((t) => t.description.toLowerCase().includes(q));
  }

  const dir = sortDir.value === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (sortKey.value) {
      case "date":
        return dir * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      case "description":
        return dir * a.description.localeCompare(b.description);
      case "amount":
        return dir * (a.amount - b.amount);
      case "category":
        return dir * categoryName(a.categoryId).localeCompare(categoryName(b.categoryId));
      default:
        return 0;
    }
  });
});
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Transactions</h1>
        <p class="text-sm text-gray-500">
          <template v-if="hasActiveFilter">
            {{ displayedItems.length }} of {{ items.length }} entries ·
          </template>
          <template v-else> {{ items.length }} entries · </template>
          total {{ money(monthTotal) }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="applying"
        @click="applyRecurring"
      >
        {{ applying ? "Adding…" : "Add Recurring" }}
      </button>
    </div>

    <p v-if="error" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
    </p>
    <p v-if="applyMessage" class="mb-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
      {{ applyMessage }}
    </p>

    <!-- Sort/filter toolbar -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <input
        v-model="search"
        type="search"
        placeholder="Search description…"
        class="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <select
        v-model="filterCategoryId"
        class="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <button
        v-if="hasActiveFilter || !isDefaultSort"
        class="rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
        @click="resetView"
      >
        Reset view
      </button>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <th class="p-0" style="width: 8.5rem">
              <button
                class="flex w-full items-center gap-1 px-3 py-2 font-semibold hover:bg-gray-100"
                @click="toggleSort('date')"
              >
                Date <span class="text-[0.65rem] text-brand-600">{{ sortIndicator("date") }}</span>
              </button>
            </th>
            <th class="p-0">
              <button
                class="flex w-full items-center gap-1 px-3 py-2 font-semibold hover:bg-gray-100"
                @click="toggleSort('description')"
              >
                Description
                <span class="text-[0.65rem] text-brand-600">{{
                  sortIndicator("description")
                }}</span>
              </button>
            </th>
            <th class="p-0" style="width: 8rem">
              <button
                class="flex w-full items-center justify-end gap-1 px-3 py-2 font-semibold hover:bg-gray-100"
                @click="toggleSort('amount')"
              >
                <span class="text-[0.65rem] text-brand-600">{{ sortIndicator("amount") }}</span>
                Amount
              </button>
            </th>
            <th class="p-0" style="width: 14rem">
              <button
                class="flex w-full items-center gap-1 px-3 py-2 font-semibold hover:bg-gray-100"
                @click="toggleSort('category')"
              >
                Category
                <span class="text-[0.65rem] text-brand-600">{{
                  sortIndicator("category")
                }}</span>
              </button>
            </th>
            <th class="px-2 py-2" style="width: 2.5rem"></th>
          </tr>
        </thead>
        <tbody>
          <!-- Add row -->
          <tr class="border-b border-gray-200 bg-brand-50/40">
            <td class="px-3 py-2">
              <input
                v-model="draft.date"
                type="date"
                class="w-full rounded border border-gray-300 px-1.5 py-1"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-model="draft.description"
                type="text"
                placeholder="Add a transaction…"
                class="w-full rounded border border-gray-300 px-2 py-1"
                @keyup.enter="addTransaction"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-model="draft.amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                class="num w-full rounded border border-gray-300 px-2 py-1"
                @keyup.enter="addTransaction"
              />
            </td>
            <td class="px-3 py-2">
              <select
                v-model="draft.categoryId"
                class="w-full rounded border border-gray-300 px-2 py-1"
              >
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </td>
            <td class="px-2 py-2 text-center">
              <button
                :disabled="!canAdd || adding"
                title="Add"
                class="rounded-md bg-brand-600 px-2 py-1 text-white hover:bg-brand-700 disabled:opacity-40"
                @click="addTransaction"
              >
                +
              </button>
            </td>
          </tr>

          <!-- Existing rows -->
          <tr v-if="loading && !items.length">
            <td colspan="5" class="px-3 py-6 text-center text-gray-400">Loading…</td>
          </tr>
          <tr v-else-if="!items.length">
            <td colspan="5" class="px-3 py-6 text-center text-gray-400">
              No transactions this month yet.
            </td>
          </tr>
          <tr v-else-if="!displayedItems.length">
            <td colspan="5" class="px-3 py-6 text-center text-gray-400">
              No transactions match your search/filter.
            </td>
          </tr>
          <tr
            v-for="t in displayedItems"
            :key="t.id"
            class="border-b border-gray-100 last:border-0 hover:bg-gray-50"
          >
            <td class="px-3 py-1.5">
              <input
                :value="t.date"
                type="date"
                class="w-full rounded border border-transparent px-1.5 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patch(t, 'date', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-1.5">
              <div class="flex items-center gap-1.5">
                <span v-if="t.recurringId" title="Added from a recurring template" class="shrink-0 text-xs">🔁</span>
                <input
                  :value="t.description"
                  type="text"
                  class="w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                  @change="patch(t, 'description', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </td>
            <td class="px-3 py-1.5">
              <input
                :value="t.amount"
                type="number"
                step="0.01"
                class="num w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patch(t, 'amount', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-1.5">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-3 w-3 shrink-0 rounded-full"
                  :style="{ backgroundColor: colorFor(t.categoryId) }"
                ></span>
                <select
                  :value="t.categoryId"
                  class="w-full rounded border border-transparent px-1 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                  @change="patch(t, 'categoryId', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </td>
            <td class="px-2 py-1.5 text-center">
              <button
                title="Delete"
                class="rounded px-1.5 py-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                @click="remove(t)"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
