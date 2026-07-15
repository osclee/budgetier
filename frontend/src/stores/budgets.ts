import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../lib/api";
import type { Budget } from "../types";

export const useBudgetsStore = defineStore("budgets", () => {
  const month = ref<string | null>(null);
  const plannedByCat = ref<Record<string, number>>({});

  async function load(yearMonth: string): Promise<void> {
    month.value = yearMonth;
    const list = await api.get<Budget[]>(`/budgets?month=${yearMonth}`);
    const map: Record<string, number> = {};
    for (const b of list) map[b.categoryId] = b.planned;
    plannedByCat.value = map;
  }

  async function setPlanned(categoryId: string, planned: number): Promise<void> {
    if (!month.value) return;
    await api.put("/budgets", { yearMonth: month.value, categoryId, planned });
    plannedByCat.value = { ...plannedByCat.value, [categoryId]: planned };
  }

  return { month, plannedByCat, load, setPlanned };
});
