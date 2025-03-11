import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ModalRoute from '../views/ModalRoute.vue'
import PrivacyPolicyView from '../views/PrivacyPolicyView.vue'
import DisclaimerView from '../views/DisclaimerView.vue'
import SearchView from '../views/SearchView.vue'
import PopularView from '../views/PopularView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      children: [{
        path: '/popular/:page?',
        component: ModalRoute, props: {size: 'lg'},
        children: [{
          path: '',
          name: 'popular',
          component: PopularView
        }]
      }]
    },
    {
      path: '/tv/:id/:slug',
      name: 'tv',
      component: HomeView
    },
    {
      path: '/search',
      name: 'search',
      component: SearchView
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
  ]
})

export default router
