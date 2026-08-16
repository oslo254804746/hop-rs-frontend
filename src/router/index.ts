import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

const history = import.meta.env.MODE === 'openwrt'
  ? createWebHashHistory()
  : createWebHistory(import.meta.env.BASE_URL)

export const router = createRouter({
  history,
  routes: [
    {
      path: '/',
      name: 'overview',
      component: () => import('@/pages/OverviewPage.vue'),
      meta: { title: 'Overview' },
    },
    {
      path: '/assets',
      name: 'assets',
      component: () => import('@/pages/AssetsPage.vue'),
      meta: { title: 'Assets' },
    },
    {
      path: '/credentials',
      name: 'credentials',
      component: () => import('@/pages/CredentialsPage.vue'),
      meta: { title: 'Credentials' },
    },
    {
      path: '/access',
      name: 'access',
      component: () => import('@/pages/AccessPage.vue'),
      meta: { title: 'Access' },
    },
    {
      path: '/sessions',
      name: 'sessions',
      component: () => import('@/pages/SessionsPage.vue'),
      meta: { title: 'Sessions' },
    },
    {
      path: '/configuration',
      name: 'configuration',
      component: () => import('@/pages/ConfigurationPage.vue'),
      meta: { title: 'Configuration' },
    },
  ],
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false
    return { top: 0 }
  },
})
