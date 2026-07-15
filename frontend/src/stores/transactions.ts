import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../lib/api";
import type { Transaction } from "../types";

type TxInput = {
  date: string;
  description: string;
  amount: number;
  categoryId: string;
};

export const useTransactionsStore = defineStore("transactions", () => {
  const items = ref<Transaction[]>([]);
  const month = ref<string | null>(null);
  const loading = ref(false);

  async function load(yearMonth: string): Promise<void> {
    loading.value = true;
    month.value = yearMonth;
    try {
      items.value = await api.get<Transaction[]>(`/transactions?month=${yearMonth}`);
    } finally {
      loading.value = false;
    }
  }

  async function add(input: TxInput): Promise<void> {
    const created = await api.post<Transaction>("/transactions", input);
    // Only show it in the current view if it belongs to the loaded month.
    if (created.yearMonth === month.value) {
      items.value.unshift(created);
      sort();
    }
  }

  async function update(id: string, patch: Partial<TxInput>): Promise<void> {
    const updated = await api.put<Transaction>(`/transactions/${id}`, patch);
    const idx = items.value.findIndex((t) => t.id === id);
    if (updated.yearMonth !== month.value) {
      // Moved out of the current month.
      if (idx !== -1) items.value.splice(idx, 1);
    } else if (idx !== -1) {
      items.value[idx] = updated;
      sort();
    }
  }

  async function remove(id: string): Promise<void> {
    await api.del(`/transactions/${id}`);
    items.value = items.value.filter((t) => t.id !== id);
  }

  function sort(): void {
    items.value.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  return { items, month, loading, load, add, update, remove };
});
