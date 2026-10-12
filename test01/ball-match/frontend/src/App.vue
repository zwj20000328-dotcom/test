<template>
  <div class="app">
    <header class="header">
      <h1 class="title">球球消消乐</h1>
      <p class="subtitle">Sports Ball Match</p>
    </header>
    <GameView />
  </div>
</template>

<script setup>
import GameView from './views/GameView.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  color: #fff;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 20px;
}

.title {
  font-size: 2.5rem;
  background: linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 30px rgba(255, 107, 107, 0.3);
}

.subtitle {
  font-size: 0.9rem;
  color: #888;
  margin-top: 5px;
}
</style>
