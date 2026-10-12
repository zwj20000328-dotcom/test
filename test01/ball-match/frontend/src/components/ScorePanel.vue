<template>
  <div class="score-panel">
    <div class="score-section">
      <div class="score-label">得分</div>
      <div class="score-value" :class="{ 'score-bump': scoreBump }">{{ score.toLocaleString() }}</div>
    </div>
    <div class="combo-section" v-if="combo > 1">
      <div class="combo-badge" :class="`combo-${Math.min(combo, 5)}`">
        {{ combo }}x 连击！
      </div>
    </div>
    <div class="effect-display" v-if="currentEffect">
      <div class="effect-label">{{ currentEffect.label }}</div>
      <div class="effect-desc">{{ currentEffect.desc }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  score: { type: Number, default: 0 },
  combo: { type: Number, default: 0 },
  currentEffect: { type: Object, default: null }
})

const scoreBump = ref(false)

watch(() => props.score, () => {
  scoreBump.value = true
  setTimeout(() => { scoreBump.value = false }, 300)
})
</script>

<style scoped>
.score-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 15px 30px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 200px;
}

.score-section {
  text-align: center;
}

.score-label {
  font-size: 0.8rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.score-value {
  font-size: 2rem;
  font-weight: bold;
  background: linear-gradient(45deg, #feca57, #ff6b6b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: transform 0.3s ease;
}

.score-bump {
  transform: scale(1.2);
}

.combo-badge {
  padding: 5px 15px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1rem;
  animation: comboIn 0.3s ease;
}

.combo-2 { background: linear-gradient(45deg, #48dbfb, #0abde3); }
.combo-3 { background: linear-gradient(45deg, #feca57, #f39c12); }
.combo-4 { background: linear-gradient(45deg, #ff6b6b, #ee5a24); }
.combo-5 { background: linear-gradient(45deg, #ff9ff3, #f368e0); }

.effect-display {
  text-align: center;
  animation: effectIn 0.5s ease;
}

.effect-label {
  font-size: 1.2rem;
  font-weight: bold;
  color: #feca57;
}

.effect-desc {
  font-size: 0.8rem;
  color: #aaa;
}

@keyframes comboIn {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes effectIn {
  0% { transform: translateY(-20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
