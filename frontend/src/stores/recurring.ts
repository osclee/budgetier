import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../lib/api";
import type { RecurringApplyResult, RecurringTransaction } from "../types";

export const useRecurringStore = defineStore("recurring", () => {
  const items = ref<RecurringTransaction[]>([]);
  const loaded = ref(false);

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return;
    items.value = await api.get<RecurringTransaction[]>("/recurring");
    loaded.value = true;
  }

  async function create(input: {
    description: string;
    amount: number;
    categoryId: string;
    dayOfMonth: number;
    active: boolean;
  }): Promise<void> {
    const created = await api.post<RecurringTransaction>("/recurring", input);
    items.value.push(created);
    items.value.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  }

  async function update(id: string, patch: Partial<RecurringTransaction>): Promise<void> {
    const updated = await api.put<RecurringTransaction>(`/recurring/${id}`, patch);
    const idx = items.value.findIndex((r) => r.id === id);
    if (idx !== -1) items.value[idx] = updated;
    items.value.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  }

  async function remove(id: string): Promise<void> {
    await api.del(`/recurring/${id}`);
    items.value = items.value.filter((r) => r.id !== id);
  }

  async function apply(yearMonth: string): Promise<RecurringApplyResult> {
    return api.post<RecurringApplyResult>("/recurring/apply", { yearMonth });
  }

  return { items, loaded, load, create, update, remove, apply };
});
