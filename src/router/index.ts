import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

import { translate } from '@/i18n'

const history = import.meta.env.MODE === 'openwrt'
  ? createWebHashHistory()
  : createWebHistory(import.meta.env.BASE_URL)

export const router = createRouter({
  history,
  routes: [
    {
      path: '/',
      alias: ['/overview'],
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
      path: '/known-hosts',
      name: 'known-hosts',
      component: () => import('@/pages/KnownHostsPage.vue'),
      meta: { title: 'Host trust' },
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: () => import('@/pages/AlertsPage.vue'),
      meta: { title: 'Alerts' },
    },
    {
      path: '/audit',
      name: 'audit',
      component: () => import('@/pages/AuditPage.vue'),
      meta: { title: 'Audit' },
    },
    {
      path: '/configuration',
      name: 'configuration',
      component: () => import('@/pages/ConfigurationPage.vue'),
      meta: { title: 'Settings' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const titleKey = typeof to.meta.title === 'string' ? to.meta.title : 'Hop'
  const translated = translate(titleKey)
  document.title = translated === 'Hop' ? 'Hop' : `${translated} · Hop`
})
