import { defineStore } from "pinia";
import { ref } from "vue";
import { currentMonth } from "../lib/format";

// Selected month shared across Transactions / Balances / Categories views.
export const useUiStore = defineStore("ui", () => {
  const stored = localStorage.getItem("budgetier.month");
  const month = ref<string>(stored ?? currentMonth());

  function setMonth(m: string): void {
    month.value = m;
    localStorage.setItem("budgetier.month", m);
  }

  return { month, setMonth };
});
