<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useUiStore } from "../stores/ui";
import { monthLabel, shiftMonth } from "../lib/format";

const ui = useUiStore();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const browseYear = ref(currentYear());

function currentYear(): number {
  return Number(ui.month.slice(0, 4));
}

function toggle() {
  if (!open.value) browseYear.value = currentYear();
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function pick(monthIdx: number) {
  const mm = String(monthIdx + 1).padStart(2, "0");
  ui.setMonth(`${browseYear.value}-${mm}`);
  close();
}

function isSelected(monthIdx: number): boolean {
  const [y, m] = ui.month.split("-").map(Number);
  return y === browseYear.value && m === monthIdx + 1;
}

function isCurrentRealMonth(monthIdx: number): boolean {
  const now = new Date();
  return browseYear.value === now.getFullYear() && monthIdx === now.getMonth();
}

function prev() {
  ui.setMonth(shiftMonth(ui.month, -1));
}
function next() {
  ui.setMonth(shiftMonth(ui.month, 1));
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close();
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="root" class="relative flex items-center gap-0.5">
    <button
      class="rounded-md px-2 py-1 text-brand-50 hover:bg-white/15"
      title="Previous month"
      @click="prev"
    >
      &lsaquo;
    </button>

    <button
      class="min-w-[7rem] rounded-md px-2 py-1 text-sm font-semibold text-white hover:bg-white/15"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ monthLabel(ui.month) }}
    </button>

    <button
      class="rounded-md px-2 py-1 text-brand-50 hover:bg-white/15"
      title="Next month"
      @click="next"
    >
      &rsaquo;
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-3 text-gray-800 shadow-lg"
    >
      <div class="mb-2 flex items-center justify-between">
        <button
          class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          title="Previous year"
          @click="browseYear -= 1"
        >
          &lsaquo;
        </button>
        <span class="text-sm font-semibold">{{ browseYear }}</span>
        <button
          class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          title="Next year"
          @click="browseYear += 1"
        >
          &rsaquo;
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="(m, i) in MONTHS"
          :key="m"
          class="rounded-md py-1.5 text-sm hover:bg-brand-50"
          :class="[
            isSelected(i)
              ? 'bg-brand-600 font-semibold text-white hover:bg-brand-600'
              : 'text-gray-700',
            !isSelected(i) && isCurrentRealMonth(i) ? 'ring-1 ring-inset ring-brand-300' : '',
          ]"
          @click="pick(i)"
        >
          {{ m }}
        </button>
      </div>
    </div>
  </div>
</template>
