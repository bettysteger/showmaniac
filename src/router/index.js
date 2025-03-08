import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PrivacyPolicyView from '../views/PrivacyPolicyView.vue'
import DisclaimerView from '../views/DisclaimerView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/tv/:id/:slug',
      name: 'tv',
      component: HomeView
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: PrivacyPolicyView
    },
    {
      path: '/disclaimer',
      name: 'disclaimer',
      component: DisclaimerView
    },

    // {
    //   path: '/popular/:page',
    //   name: 'popular',
    //  // route level code-splitting
    //  // this generates a separate chunk (About.[hash].js) for this route
    //  // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/PopularView.vue')
    // },
    // {
    //   path: '/search',
    //   name: 'search',
    //   component: () => import('../views/SearchView.vue')
    // }
  ]
})

export default router
