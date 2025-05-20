// router.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/audio',
        name: 'AudioRecorder',
        component: () => import('../views/AudioRecorder.vue'),
    },
    {
        path: '/video',
        name: 'VideoRecorder',
        component: () => import('../views/VideoRecorder.vue'),
    },
    {
        path: '/',
        redirect: '/audio',
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router
