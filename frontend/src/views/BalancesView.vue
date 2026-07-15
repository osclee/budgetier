<script setup lang="ts">
import { ref, watch } from "vue";
import { useUiStore } from "../stores/ui";
import { api } from "../lib/api";
import { money, monthLabel, shiftMonth } from "../lib/format";
import type { BalancesResponse, BalanceRow, Budget } from "../types";

const ui = useUiStore();
const data = ref<BalancesResponse | null>(null);
const loading = ref(false);
const error = ref("");
const copying = ref(false);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    data.value = await api.get<BalancesResponse>(`/balances?month=${ui.month}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load balances.";
  } finally {
    loading.value = false;
  }
}

watch(() => ui.month, load, { immediate: true });

async function copyLastMonthPlanned() {
  error.value = "";
  const prevMonth = shiftMonth(ui.month, -1);

  copying.value = true;
  let prevBudgets: Budget[];
  try {
    prevBudgets = await api.get<Budget[]>(`/budgets?month=${prevMonth}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load previous month's budgets.";
    copying.value = false;
    return;
  }

  if (prevBudgets.length === 0) {
    error.value = `No planned amounts found for ${monthLabel(prevMonth)} to copy.`;
    copying.value = false;
    return;
  }

  const proceed = confirm(
    `Copy planned amounts from ${monthLabel(prevMonth)} into ${monthLabel(
      ui.month
    )}? This will overwrite any planned amounts already set for ${monthLabel(ui.month)}.`
  );
  if (!proceed) {
    copying.value = false;
    return;
  }

  try {
    const results = await Promise.allSettled(
      prevBudgets.map((b) =>
        api.put("/budgets", { yearMonth: ui.month, categoryId: b.categoryId, planned: b.planned })
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      error.value = `Copied ${prevBudgets.length - failed} of ${prevBudgets.length} categories; ${failed} failed. Try again to retry the rest.`;
    }
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to copy planned amounts.";
  } finally {
    copying.value = false;
  }
}

// A diff is "good" (green) when income beats plan, or when spending is under plan.
function diffClass(row: BalanceRow): string {
  if (row.type === "spacer") return "";
  const diff = row.diff;
  if (Math.abs(diff) < 0.005) return "text-gray-400";
  const kind = row.type === "category" ? row.kind : derivedKindHint(row.key);
  const inflowLike = kind === "income";
  const good = inflowLike ? diff > 0 : diff < 0;
  return good ? "text-emerald-600" : "text-red-600";
}

// For derived rows, treat "more is better" only for net/remaining totals.
function derivedKindHint(key: string): string {
  if (key === "netDisposable" || key === "remaining") return "income";
  return "expense";
}

function isDerived(row: BalanceRow): boolean {
  return row.type === "derived";
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Balances</h1>
        <p class="text-sm text-gray-500">Planned vs actual for {{ monthLabel(ui.month) }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="copying || loading || !data"
        @click="copyLastMonthPlanned"
      >
        {{ copying ? "Copying…" : `Copy Planned from ${monthLabel(shiftMonth(ui.month, -1))}` }}
      </button>
    </div>

    <p v-if="error" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
    </p>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-brand-700 text-left text-white">
            <th class="px-4 py-2.5 font-semibold">Item</th>
            <th class="px-4 py-2.5 text-right font-semibold" style="width: 9rem">Planned</th>
            <th class="px-4 py-2.5 text-right font-semibold" style="width: 9rem">Actual</th>
            <th class="px-4 py-2.5 text-right font-semibold" style="width: 9rem">Diff</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !data">
            <td colspan="4" class="px-4 py-6 text-center text-gray-400">Loading…</td>
          </tr>
          <template v-else-if="data">
            <template v-for="(row, i) in data.rows" :key="i">
              <tr v-if="row.type === 'spacer'" class="h-3">
                <td colspan="4"></td>
              </tr>
              <tr
                v-else
                class="border-b border-gray-100"
                :class="isDerived(row) ? 'bg-gray-50 font-semibold text-gray-800' : ''"
              >
                <td class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <span
                      v-if="row.type === 'category'"
                      class="inline-block h-3 w-3 shrink-0 rounded-full"
                      :style="{ backgroundColor: row.color }"
                    ></span>
                    <span>{{ row.type === "category" ? row.name : row.label }}</span>
                  </div>
                </td>
                <td class="num px-4 py-2 text-gray-700">{{ money(row.planned) }}</td>
                <td class="num px-4 py-2 text-gray-700">{{ money(row.actual) }}</td>
                <td class="num px-4 py-2" :class="diffClass(row)">{{ money(row.diff) }}</td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-gray-400">
      Net Disposable, Remaining, and Discretionary are computed. Planned targets are set per
      category on the Categories tab.
    </p>
  </div>
</template>
