<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import StatCard from "../components/StatCard.vue";
import { api } from "../lib/api";
import { money, monthLabel } from "../lib/format";
import type { BadgeFamily, InsightsResponse } from "../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const MONTH_OPTIONS = [3, 6, 12] as const;
const months = ref<3 | 6 | 12>(6);
const data = ref<InsightsResponse | null>(null);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    data.value = await api.get<InsightsResponse>(`/insights?months=${months.value}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load insights.";
  } finally {
    loading.value = false;
  }
}
watch(months, load, { immediate: true });

const chartData = computed(() => {
  const trend = data.value?.trend ?? [];
  return {
    labels: trend.map((t) => monthLabel(t.yearMonth)),
    datasets: [
      { label: "Income", data: trend.map((t) => t.incomeActual), borderColor: "#1e5540", backgroundColor: "#1e5540", tension: 0.25 },
      { label: "Discretionary", data: trend.map((t) => t.discretionaryActual), borderColor: "#dc2626", backgroundColor: "#dc2626", tension: 0.25 },
      { label: "Discretionary Planned", data: trend.map((t) => t.discretionaryPlanned), borderColor: "#fca5a5", backgroundColor: "#fca5a5", borderDash: [6, 4], pointRadius: 0, tension: 0.25 },
      { label: "Invested", data: trend.map((t) => t.investmentActual), borderColor: "#059669", backgroundColor: "#059669", tension: 0.25 },
      { label: "Invested Planned", data: trend.map((t) => t.investmentPlanned), borderColor: "#6ee7b7", backgroundColor: "#6ee7b7", borderDash: [6, 4], pointRadius: 0, tension: 0.25 },
      { label: "Needs", data: trend.map((t) => t.needsActual), borderColor: "#9ca3af", backgroundColor: "#9ca3af", tension: 0.25 },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: { y: { ticks: { callback: (v: string | number) => money(Number(v)) } } },
};

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

// GitHub-contribution-style grid: pad leading cells so the first real day lands on
// its correct weekday row (grid flows column-by-column, 7 rows = Sun..Sat).
const heatmapCells = computed(() => {
  const days = data.value?.zeroSpend.days ?? [];
  if (!days.length) return [];
  const blanks = Array.from({ length: dayOfWeek(days[0].date) }, () => null);
  return [...blanks, ...days];
});

function progressPct(b: BadgeFamily): number {
  if (!b.nextTier) return 100;
  const prevThreshold = [...b.tiers].reverse().find((t) => t.unlocked)?.threshold ?? 0;
  const span = b.nextTier.threshold - prevThreshold;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((b.current - prevThreshold) / span) * 100));
}

function formatBadgeAmount(b: BadgeFamily, n: number): string {
  const rounded = Math.round(n);
  if (b.unit === "dollars") return money(n);
  if (b.unit === "days") return `${rounded} day${rounded === 1 ? "" : "s"}`;
  return `${rounded} month${rounded === 1 ? "" : "s"}`;
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-800">Insights</h1>
        <p class="text-sm text-gray-500">
          Your money over the last {{ months }} months — spending, investing, and streaks.
        </p>
      </div>
      <div class="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
        <button
          v-for="m in MONTH_OPTIONS"
          :key="m"
          class="rounded px-3 py-1 text-sm font-medium"
          :class="months === m ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'"
          @click="months = m"
        >
          {{ m }}mo
        </button>
      </div>
    </div>

    <p v-if="error" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
    </p>
    <p v-if="loading && !data" class="text-sm text-gray-400">Loading…</p>

    <template v-if="data">
      <!-- Headline stat cards -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Invested" :value="money(data.headline.totalInvestedWindow)" hint="This window" />
        <StatCard label="Saved" :value="money(data.headline.totalSavedWindow)" hint="This window" />
        <StatCard label="Invested All-Time" :value="money(data.allTime.totalInvested)" />
        <StatCard
          label="Savings Rate"
          :value="data.headline.savingsRatePct !== null ? `${data.headline.savingsRatePct}%` : '—'"
          :tone="data.headline.savingsRatePct !== null && data.headline.savingsRatePct >= 20 ? 'good' : 'default'"
          hint="Invested + saved / income"
        />
        <StatCard
          label="Avg Discretionary"
          :value="money(data.headline.avgMonthlyDiscretionaryActual)"
          :hint="`Planned ${money(data.headline.avgMonthlyDiscretionaryPlanned)}`"
          :tone="data.headline.avgMonthlyDiscretionaryActual <= data.headline.avgMonthlyDiscretionaryPlanned ? 'good' : 'bad'"
        />
        <StatCard label="Total Spent" :value="money(data.headline.totalDiscretionaryWindow)" hint="Discretionary, this window" />
      </div>

      <!-- Zero-spend gamification block -->
      <div class="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">🔥 Zero-Spend Days</h2>
        <div class="mb-4 grid grid-cols-3 gap-4">
          <StatCard
            label="Current Streak"
            :value="`${data.zeroSpend.currentStreak}d`"
            :tone="data.zeroSpend.currentStreak > 0 ? 'good' : 'default'"
          />
          <StatCard label="Best Streak" :value="`${data.zeroSpend.bestStreak}d`" />
          <StatCard
            label="Zero-Spend Rate"
            :value="data.zeroSpend.zeroSpendRatePct !== null ? `${data.zeroSpend.zeroSpendRatePct}%` : '—'"
            :hint="`${data.zeroSpend.zeroSpendDays} of ${data.zeroSpend.trackedDays} days`"
          />
        </div>
        <div v-if="heatmapCells.length" class="overflow-x-auto pb-1">
          <div
            class="grid gap-[3px]"
            style="grid-auto-flow: column; grid-template-rows: repeat(7, 0.75rem); grid-auto-columns: 0.75rem"
          >
            <div
              v-for="(cell, i) in heatmapCells"
              :key="i"
              class="h-3 w-3 rounded-sm"
              :class="cell === null ? 'bg-transparent' : cell.zeroSpend ? 'bg-brand-500' : 'bg-gray-200'"
              :title="cell ? `${cell.date}: ${cell.zeroSpend ? 'Zero-spend day' : 'Spent'}` : undefined"
            ></div>
          </div>
        </div>
        <p v-else class="text-xs text-gray-400">No activity yet in this window.</p>
      </div>

      <!-- Trend chart -->
      <div class="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">Income, Spending &amp; Investing Over Time</h2>
        <div class="h-72">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Streaks & badges -->
      <div class="mt-6">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">Streaks &amp; Badges</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="b in data.badges"
            :key="b.id"
            class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div class="font-semibold text-gray-800">{{ b.label }}</div>
            <div class="text-xs text-gray-500">{{ b.description }}</div>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="t in b.tiers"
                :key="t.tier"
                class="rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="t.unlocked ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'"
              >
                {{ t.label }}
              </span>
            </div>
            <div v-if="b.nextTier" class="mt-3">
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div class="h-full rounded-full bg-brand-500" :style="{ width: progressPct(b) + '%' }"></div>
              </div>
              <div class="mt-1 text-xs text-gray-400">
                {{ formatBadgeAmount(b, b.nextTier.remaining) }} to next tier
              </div>
            </div>
            <div v-else class="mt-3 text-xs font-medium text-emerald-600">All tiers unlocked 🎉</div>
          </div>
        </div>
      </div>

      <!-- Best/worst month callouts -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-emerald-700">Best Month</div>
          <template v-if="data.headline.bestDiscretionaryMonth">
            <div class="mt-1 text-lg font-bold text-emerald-800">
              {{ monthLabel(data.headline.bestDiscretionaryMonth.yearMonth) }}
            </div>
            <div class="text-sm text-emerald-700">
              Only {{ money(data.headline.bestDiscretionaryMonth.actual) }} in discretionary spend
            </div>
          </template>
          <div v-else class="mt-1 text-sm text-gray-500">Not enough data yet.</div>
        </div>
        <div class="rounded-xl border border-red-200 bg-red-50 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-red-700">Room to Improve</div>
          <template v-if="data.headline.worstDiscretionaryMonth">
            <div class="mt-1 text-lg font-bold text-red-800">
              {{ monthLabel(data.headline.worstDiscretionaryMonth.yearMonth) }}
            </div>
            <div class="text-sm text-red-700">
              {{ money(data.headline.worstDiscretionaryMonth.actual) }} in discretionary spend
            </div>
          </template>
          <div v-else class="mt-1 text-sm text-gray-500">Not enough data yet.</div>
        </div>
      </div>
    </template>
  </div>
</template>
