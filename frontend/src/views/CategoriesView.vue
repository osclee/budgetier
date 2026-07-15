<script setup lang="ts">
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCategoriesStore } from "../stores/categories";
import { useBudgetsStore } from "../stores/budgets";
import { useUiStore } from "../stores/ui";
import { monthLabel } from "../lib/format";
import { CATEGORY_KINDS } from "../types";
import type { Category, CategoryKind } from "../types";

const catStore = useCategoriesStore();
const budgets = useBudgetsStore();
const ui = useUiStore();
const { items: categories } = storeToRefs(catStore);

const error = ref("");
const newCat = ref<{ name: string; kind: CategoryKind; color: string; countsAsInvestment: boolean }>({
  name: "",
  kind: "need",
  color: "#94a3b8",
  countsAsInvestment: false,
});

async function load() {
  error.value = "";
  try {
    await catStore.load(true);
    await budgets.load(ui.month);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load.";
  }
}
watch(() => ui.month, load, { immediate: true });

async function patchCat(c: Category, patch: Partial<Category>) {
  error.value = "";
  try {
    await catStore.update(c.id, patch);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Update failed.";
  }
}

async function setPlanned(categoryId: string, value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return;
  try {
    await budgets.setPlanned(categoryId, n);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not save target.";
  }
}

async function addCategory() {
  if (!newCat.value.name.trim()) return;
  const nextOrder = categories.value.length
    ? Math.max(...categories.value.map((c) => c.sortOrder)) + 10
    : 10;
  try {
    await catStore.create({ ...newCat.value, name: newCat.value.name.trim(), sortOrder: nextOrder });
    newCat.value = { name: "", kind: "need", color: "#94a3b8", countsAsInvestment: false };
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not add category.";
  }
}

async function removeCategory(c: Category) {
  if (!confirm(`Delete category "${c.name}"? Existing transactions keep their category id.`))
    return;
  try {
    await catStore.remove(c.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Delete failed.";
  }
}

// --- Drag-to-reorder ---
const draggingId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);

function onDragStart(id: string, e: DragEvent) {
  draggingId.value = id;
  // Firefox requires dataTransfer to carry data or the drag won't initiate.
  e.dataTransfer?.setData("text/plain", id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onDragEnd() {
  draggingId.value = null;
  dragOverId.value = null;
}

async function onDrop(targetId: string) {
  const dragId = draggingId.value;
  draggingId.value = null;
  dragOverId.value = null;
  if (!dragId || dragId === targetId) return;

  const ids = categories.value.map((c) => c.id);
  const fromIdx = ids.indexOf(dragId);
  const toIdx = ids.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, dragId);

  try {
    await catStore.reorder(ids);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not save new order.";
  }
}
</script>

<template>
  <div>
    <div class="mb-4">
      <h1 class="text-xl font-bold text-gray-800">Categories</h1>
      <p class="text-sm text-gray-500">
        Manage categories and set planned targets for {{ monthLabel(ui.month) }} · drag the
        handle to reorder
      </p>
    </div>

    <p v-if="error" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
    </p>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <th class="px-2 py-2" style="width: 2rem"></th>
            <th class="px-3 py-2 font-semibold" style="width: 3rem">Color</th>
            <th class="px-3 py-2 font-semibold">Name</th>
            <th class="px-3 py-2 font-semibold" style="width: 12rem">Kind</th>
            <th
              class="px-3 py-2 text-center font-semibold"
              style="width: 6rem"
              title="Also count this category toward Insights' invested totals — e.g. for 401k contributions, which are a deduction here but still real investing"
            >
              Invested?
            </th>
            <th class="px-3 py-2 text-right font-semibold" style="width: 8rem">Planned</th>
            <th class="px-2 py-2" style="width: 2.5rem"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in categories"
            :key="c.id"
            class="border-b border-gray-100 last:border-0 hover:bg-gray-50"
            :class="[
              dragOverId === c.id && draggingId && draggingId !== c.id
                ? 'bg-brand-50 outline outline-2 -outline-offset-2 outline-brand-300'
                : '',
              draggingId === c.id ? 'opacity-40' : '',
            ]"
            @dragover.prevent="dragOverId = c.id"
            @dragleave="dragOverId === c.id && (dragOverId = null)"
            @drop.prevent="onDrop(c.id)"
          >
            <td class="px-2 py-1.5 text-center text-gray-400">
              <span
                draggable="true"
                title="Drag to reorder"
                class="inline-block cursor-grab select-none px-1 text-base leading-none active:cursor-grabbing"
                @dragstart="onDragStart(c.id, $event)"
                @dragend="onDragEnd"
              >
                ⠿
              </span>
            </td>
            <td class="px-3 py-1.5">
              <input
                :value="c.color"
                type="color"
                class="h-7 w-9 cursor-pointer rounded border border-gray-300"
                @change="patchCat(c, { color: ($event.target as HTMLInputElement).value })"
              />
            </td>
            <td class="px-3 py-1.5">
              <input
                :value="c.name"
                type="text"
                class="w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patchCat(c, { name: ($event.target as HTMLInputElement).value })"
              />
            </td>
            <td class="px-3 py-1.5">
              <select
                :value="c.kind"
                class="w-full rounded border border-transparent px-1 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="patchCat(c, { kind: ($event.target as HTMLSelectElement).value as CategoryKind })"
              >
                <option v-for="k in CATEGORY_KINDS" :key="k.value" :value="k.value">
                  {{ k.label }}
                </option>
              </select>
            </td>
            <td class="px-3 py-1.5 text-center">
              <input
                :checked="c.countsAsInvestment"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-brand-600"
                title="Count toward Insights' invested totals"
                @change="patchCat(c, { countsAsInvestment: ($event.target as HTMLInputElement).checked })"
              />
            </td>
            <td class="px-3 py-1.5">
              <input
                :value="budgets.plannedByCat[c.id] ?? ''"
                type="number"
                step="0.01"
                placeholder="0.00"
                class="num w-full rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-brand-500 focus:outline-none"
                @change="setPlanned(c.id, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-2 py-1.5 text-center">
              <button
                title="Delete"
                class="rounded px-1.5 py-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                @click="removeCategory(c)"
              >
                ✕
              </button>
            </td>
          </tr>

          <!-- Add new category -->
          <tr class="bg-brand-50/40">
            <td class="px-2 py-2"></td>
            <td class="px-3 py-2">
              <input
                v-model="newCat.color"
                type="color"
                class="h-7 w-9 cursor-pointer rounded border border-gray-300"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-model="newCat.name"
                type="text"
                placeholder="New category…"
                class="w-full rounded border border-gray-300 px-2 py-1"
                @keyup.enter="addCategory"
              />
            </td>
            <td class="px-3 py-2">
              <select
                v-model="newCat.kind"
                class="w-full rounded border border-gray-300 px-1 py-1"
              >
                <option v-for="k in CATEGORY_KINDS" :key="k.value" :value="k.value">
                  {{ k.label }}
                </option>
              </select>
            </td>
            <td class="px-3 py-2 text-center">
              <input
                v-model="newCat.countsAsInvestment"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-brand-600"
              />
            </td>
            <td class="px-3 py-2 text-right text-gray-400">—</td>
            <td class="px-2 py-2 text-center">
              <button
                title="Add category"
                class="rounded-md bg-brand-600 px-2 py-1 text-white hover:bg-brand-700"
                @click="addCategory"
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
