import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api } from "../lib/api";
import type { Category, CategoryKind } from "../types";

export const useCategoriesStore = defineStore("categories", () => {
  const items = ref<Category[]>([]);
  const loaded = ref(false);

  const byId = computed(() => {
    const map = new Map<string, Category>();
    for (const c of items.value) map.set(c.id, c);
    return map;
  });

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return;
    items.value = await api.get<Category[]>("/categories");
    loaded.value = true;
  }

  async function create(input: {
    name: string;
    kind: CategoryKind;
    color: string;
    sortOrder: number;
    countsAsInvestment?: boolean;
  }): Promise<void> {
    const created = await api.post<Category>("/categories", input);
    items.value.push(created);
    items.value.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function update(id: string, patch: Partial<Category>): Promise<void> {
    const updated = await api.put<Category>(`/categories/${id}`, patch);
    const idx = items.value.findIndex((c) => c.id === id);
    if (idx !== -1) items.value[idx] = updated;
    items.value.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function remove(id: string): Promise<void> {
    await api.del(`/categories/${id}`);
    items.value = items.value.filter((c) => c.id !== id);
  }

  /**
   * Reassigns sortOrder by position (spaced by 10) to match `orderedIds`, applies it
   * optimistically, then persists only the categories whose sortOrder actually changed.
   */
  async function reorder(orderedIds: string[]): Promise<void> {
    const previous = new Map(items.value.map((c) => [c.id, c.sortOrder]));
    const byId2 = new Map(items.value.map((c) => [c.id, c]));

    const reordered = orderedIds
      .map((id, i) => {
        const c = byId2.get(id);
        return c ? { ...c, sortOrder: (i + 1) * 10 } : null;
      })
      .filter((c): c is Category => c !== null);

    items.value = reordered;

    const changed = reordered.filter((c) => previous.get(c.id) !== c.sortOrder);
    await Promise.all(
      changed.map((c) => api.put<Category>(`/categories/${c.id}`, { sortOrder: c.sortOrder }))
    );
  }

  return { items, loaded, byId, load, create, update, remove, reorder };
});
