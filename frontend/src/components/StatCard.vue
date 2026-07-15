<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "good" | "bad";
  }>(),
  { tone: "default" }
);
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ label }}</div>
    <div
      class="mt-1 text-2xl font-bold"
      :class="{
        'text-gray-800': tone === 'default',
        'text-emerald-600': tone === 'good',
        'text-red-600': tone === 'bad',
      }"
    >
      {{ value }}
    </div>
    <div v-if="hint" class="mt-1 text-xs text-gray-400">{{ hint }}</div>
  </div>
</template>
