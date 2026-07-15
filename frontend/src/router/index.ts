import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { guest: true },
    },
    {
      path: "/",
      component: () => import("../components/AppLayout.vue"),
      children: [
        { path: "", redirect: { name: "transactions" } },
        {
          path: "transactions",
          name: "transactions",
          component: () => import("../views/TransactionsView.vue"),
        },
        {
          path: "balances",
          name: "balances",
          component: () => import("../views/BalancesView.vue"),
        },
        {
          path: "categories",
          name: "categories",
          component: () => import("../views/CategoriesView.vue"),
        },
        {
          path: "recurring",
          name: "recurring",
          component: () => import("../views/RecurringView.vue"),
        },
        {
          path: "insights",
          name: "insights",
          component: () => import("../views/InsightsView.vue"),
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: { name: "transactions" } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.checkSession();

  if (!to.meta.guest && !auth.username) {
    return { name: "login", query: to.fullPath !== "/" ? { redirect: to.fullPath } : undefined };
  }
  if (to.meta.guest && auth.username) {
    return { name: "transactions" };
  }
  return true;
});

export default router;
