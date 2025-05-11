<template>
    <div id="app">
        <h1>Web Media Recorder</h1>
        <div class="tabs">
            <button
                v-for="tab in tabs"
                :key="tab.path"
                :class="{ active: currentTab === tab.path }"
                @click="changeTab(tab.path)"
            >
                {{ tab.title }}
            </button>
        </div>
        <router-view />
    </div>
</template>

<script>
    export default {
        name: 'App',
        data() {
            return {
                tabs: [
                    { title: '录音机', path: '/audio' },
                    { title: '录像机', path: '/video' },
                ],
                currentTab: this.$route.path,
            }
        },
        methods: {
            changeTab(path) {
                this.currentTab = path
                this.$router.push(path)
            },
        },
    }
</script>

<style>
    #app {
        font-family: Avenir, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: center;
        color: #2c3e50;
        margin-top: 60px;
    }

    .tabs {
        display: flex;
        justify-content: center;
        margin-bottom: 20px;
        border-bottom: 2px solid #007bff;
    }

    .tabs button {
        padding: 12px 24px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        background-color: transparent;
        color: #2c3e50;
        border: none;
        border-radius: 4px 4px 0 0;
        margin-right: 5px;
        transition: all 0.3s ease;
    }

    .tabs button.active {
        background-color: #007bff;
        color: white;
        border-bottom: 2px solid #007bff;
    }
</style>
