<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useRecurringStore } from "../stores/recurring";
import { useCategoriesStore } from "../stores/categories";
import { useUiStore } from "../stores/ui";
import { monthLabel } from "../lib/format";
import type { RecurringTransaction } from "../types";

const recurringStore = useRecurringStore();
const catStore = useCategoriesStore();
const ui = useUiStore();
const { items: recurring } = storeToRefs(recurringStore);
const { items: categories } = storeToRefs(catStore);

const error = ref("");
const applying = ref(false);
const applyMessage = ref("");

const newItem = ref<{ description: string; amount: string; categoryId: string; dayOfMonth: number }>(
  { description: "", amount: "", categoryId: "", dayOfMonth: 1 }
);

async function load() {
  error.value = "";
  try {
    await catStore.load();
    if (!newItem.value.categoryId && categories.value.length) {
      newItem.value.categoryId = categories.value[0].id;
    }
    await recurringStore.load(true);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load.";
  }
}
load();

function colorFor(categoryId: string): string {
  return catStore.byId.get(categoryId)?.color ?? "#94a3b8";
}

const canAdd = computed(
  () =>
    newItem.value.description.trim() &&
    newItem.value.amount !== "" &&
    !Number.isNaN(Number(newItem.value.amount)) &&
    newItem.value.categoryId &&
    newItem.value.dayOfMonth >= 1 &&
    newItem.value.dayOfMonth <= 31
);

async function addRecurring() {
  if (!canAdd.value) return;
  try {
    await recurringStore.create({
      description: newItem.value.description.trim(),
      amount: Number(newItem.value.amount),
      categoryId: newItem.value.categoryId,
      dayOfMonth: newItem.value.dayOfMonth,
      active: true,
    });
    newItem.value.description = "";
    newItem.value.amount = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not add recurring transaction.";
  }
}

async function patch(r: RecurringTransaction, patchVal: Partial<RecurringTransaction>) {
  error.value = "";
  try {
    await recurringStore.update(r.id, patchVal);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Update failed.";
  }
}

async function removeRecurring(r: RecurringTransaction) {
  if (!confirm(`Delete recurring "${r.description}"? This won't remove transactions already added.`))
    return;
  try {
    await recurringStore.remove(r.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Delete failed.";
  }
}

async function applyToCurrentMonth() {
  applying.value = true;
  applyMessage.value = "";
  error.value = "";
  try {
    const result = await recurringStore.apply(ui.month);
    if (result.created.length === 0) {
      applyMessage.value =
        result.skipped > 0
          ? `Already up to date — all ${result.skipped} active recurring item(s) were already added for ${monthLabel(ui.month)}.`
          : "No active recurring items to add.";
    } else {
      applyMessage.value = `Added ${result.created.length} transaction(s) to ${monthLabel(ui.month)}${result.skipped ? ` (${result.skipped} already present)` : ""}.`;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not apply recurring transactions.";
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Recurring</h1>
        <p class="text-sm text-gray-500">
          Templates for transactions that repeat every month — rent, paycheck, 401k, etc.
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="applying"
        @click="applyToCurrentMonth"
      >
        {{ applying ? "Adding…" : `Add to ${monthLabel(ui.month)}` }}
      </button>
    </div>

    <p v-if="error" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
    </p>
    <p v-if="applyMessage" class="mb-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
      {{ applyMessage }}
    </p>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <th class="px-3 py-2 font-semibold">Description</th>
            <th class="px-3 py-2 text-right font-semibold" style="width: 8rem">Amount</th>
            <th class="px-3 py-2 font-semibold" style="width: 14rem">Category</th>
            <th class="px-3 py-2 text-right font-semibold" style="width: 6rem">Day</th>
            <th class="px-3 py-2 text-center font-semibold" style="width: 5rem">Active</th>
            <th class="px-2 py-2" style="width: 2.5rem"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in recurring"
            :key="r.id"
            class="border-b border-gray-100 last:border-0 hover:bg-gray-50"
            :class="!r.active ? 'opacity-50' : ''"
          >
            <td class="px-3 py-1.5">
              <input
                :value="r.description"
                type="text"
                class="w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patch(r, { description: ($event.target as HTMLInputElement).value })"
              />
            </td>
            <td class="px-3 py-1.5">
              <input
                :value="r.amount"
                type="number"
                step="0.01"
                class="num w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patch(r, { amount: Number(($event.target as HTMLInputElement).value) })"
              />
            </td>
            <td class="px-3 py-1.5">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-3 w-3 shrink-0 rounded-full"
                  :style="{ backgroundColor: colorFor(r.categoryId) }"
                ></span>
                <select
                  :value="r.categoryId"
                  class="w-full rounded border border-transparent px-1 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                  @change="patch(r, { categoryId: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </td>
            <td class="px-3 py-1.5">
              <input
                :value="r.dayOfMonth"
                type="number"
                min="1"
                max="31"
                class="num w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patch(r, { dayOfMonth: Number(($event.target as HTMLInputElement).value) })"
              />
            </td>
            <td class="px-3 py-1.5 text-center">
              <input
                :checked="r.active"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-brand-600"
                @change="patch(r, { active: ($event.target as HTMLInputElement).checked })"
              />
            </td>
            <td class="px-2 py-1.5 text-center">
              <button
                title="Delete"
                class="rounded px-1.5 py-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                @click="removeRecurring(r)"
              >
                ✕
              </button>
            </td>
          </tr>

          <tr v-if="!recurring.length">
            <td colspan="6" class="px-3 py-6 text-center text-gray-400">
              No recurring transactions yet — add rent, paycheck, 401k, etc. below.
            </td>
          </tr>

          <!-- Add new recurring -->
          <tr class="bg-brand-50/40">
            <td class="px-3 py-2">
              <input
                v-model="newItem.description"
                type="text"
                placeholder="e.g. Rent"
                class="w-full rounded border border-gray-300 px-2 py-1"
                @keyup.enter="addRecurring"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-model="newItem.amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                class="num w-full rounded border border-gray-300 px-2 py-1"
                @keyup.enter="addRecurring"
              />
            </td>
            <td class="px-3 py-2">
              <select v-model="newItem.categoryId" class="w-full rounded border border-gray-300 px-2 py-1">
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </td>
            <td class="px-3 py-2">
              <input
                v-model.number="newItem.dayOfMonth"
                type="number"
                min="1"
                max="31"
                class="num w-full rounded border border-gray-300 px-2 py-1"
              />
            </td>
            <td class="px-3 py-2 text-center text-gray-400">—</td>
            <td class="px-2 py-2 text-center">
              <button
                :disabled="!canAdd"
                title="Add"
                class="rounded-md bg-brand-600 px-2 py-1 text-white hover:bg-brand-700 disabled:opacity-40"
                @click="addRecurring"
              >
                +
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
