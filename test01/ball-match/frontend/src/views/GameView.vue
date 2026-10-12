<template>
  <div class="game-view">
    <div class="game-container">
      <div class="sidebar">
        <ScorePanel :score="score" :combo="combo" :currentEffect="currentEffect" />
        <div class="controls">
          <button class="btn btn-new" @click="startNewGame">新游戏</button>
          <button class="btn btn-hint" @click="showHint">提示</button>
        </div>
        <div class="ball-legend">
          <h3>球类技能</h3>
          <div class="legend-item" v-for="ball in ballInfo" :key="ball.type">
            <span class="legend-emoji">{{ ball.emoji }}</span>
            <span class="legend-name">{{ ball.name }}</span>
            <span class="legend-skill">{{ ball.skill }}</span>
          </div>
        </div>
      </div>

      <div class="board-wrapper">
        <GameBoard
          :board="board"
          :rows="rows"
          :cols="cols"
          :selected="selected"
          :matchedCells="matchedCells"
          :hintCells="hintCells"
          @select="onSelect"
          @swap="onSwap"
        />
      </div>
    </div>

    <div class="effect-overlay" v-if="showEffectOverlay">
      <div class="effect-text">{{ effectOverlayText }}</div>
    </div>

    <div class="game-over-modal" v-if="showGameOver">
      <div class="modal-content">
        <h2>游戏结束</h2>
        <p class="final-score">最终得分: {{ score.toLocaleString() }}</p>
        <input v-model="playerName" placeholder="输入你的名字" class="name-input" />
        <button class="btn btn-submit" @click="submitAndRestart">提交分数</button>
        <button class="btn btn-restart" @click="startNewGame">再来一局</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import GameBoard from '../components/GameBoard.vue'
import ScorePanel from '../components/ScorePanel.vue'
import { ClientGameEngine, BALL_EMOJIS } from '../game/engine.js'
import { newGame, swap, submitScore, getLeaderboard } from '../game/api.js'

const rows = 8
const cols = 8
const engine = new ClientGameEngine(rows, cols)

const board = ref([])
const score = ref(0)
const combo = ref(0)
const selected = ref(null)
const matchedCells = ref([])
const hintCells = ref([])
const currentEffect = ref(null)
const showEffectOverlay = ref(false)
const effectOverlayText = ref('')
const showGameOver = ref(false)
const playerName = ref('')
const sessionId = ref('')
const isAnimating = ref(false)

const ballInfo = [
  { type: 'basketball', emoji: '🏀', name: '篮球', skill: '扣篮-清行' },
  { type: 'soccer', emoji: '⚽', name: '足球', skill: '射门-3×3' },
  { type: 'tennis', emoji: '🎾', name: '网球', skill: '弹跳-随机5' },
  { type: 'baseball', emoji: '⚾', name: '棒球', skill: '全垒打-清列' },
  { type: 'volleyball', emoji: '🏐', name: '排球', skill: '扣杀-十字' },
  { type: 'pingpong', emoji: '🏓', name: '乒乓', skill: '旋转-对角' }
]

onMounted(() => {
  startNewGame()
})

async function startNewGame() {
  showGameOver.value = false
  engine.initBoard()
  board.value = engine.board.map(row => [...row])
  score.value = 0
  combo.value = 0
  selected.value = null
  matchedCells.value = []
  hintCells.value = []
  currentEffect.value = null

  try {
    const data = await newGame(rows, cols)
    sessionId.value = data.sessionId
  } catch (e) {
    console.log('Offline mode - using client engine only')
  }
}

function onSelect(pos) {
  if (isAnimating.value) return

  if (!selected.value) {
    selected.value = pos
    return
  }

  const dr = Math.abs(selected.value.row - pos.row)
  const dc = Math.abs(selected.value.col - pos.col)

  if (dr + dc === 1) {
    performSwap(selected.value.row, selected.value.col, pos.row, pos.col)
  } else {
    selected.value = pos
  }
}

function onSwap({ r1, c1, r2, c2 }) {
  if (isAnimating.value) return
  performSwap(r1, c1, r2, c2)
}

async function performSwap(r1, c1, r2, c2) {
  if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) {
    selected.value = null
    return
  }

  isAnimating.value = true
  selected.value = null
  hintCells.value = []

  const result = engine.swap(r1, c1, r2, c2)

  if (!result.valid) {
    board.value = engine.board.map(row => [...row])
    isAnimating.value = false
    return
  }

  matchedCells.value = result.matched || []
  combo.value = result.combo || 0

  if (result.effects && result.effects.length > 0) {
    currentEffect.value = result.effects[result.effects.length - 1]
    showEffectOverlay.value = true
    effectOverlayText.value = currentEffect.value.label
    setTimeout(() => { showEffectOverlay.value = false }, 1000)
  }

  await nextTick()
  await sleep(400)

  board.value = engine.board.map(row => [...row])
  score.value = engine.score
  matchedCells.value = []

  try {
    await swap(sessionId.value, r1, c1, r2, c2)
  } catch (e) {}

  isAnimating.value = false

  if (!engine.hasValidMoves()) {
    showGameOver.value = true
  }
}

function showHint() {
  if (isAnimating.value) return

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (j + 1 < cols) {
        ;[engine.board[i][j], engine.board[i][j + 1]] = [engine.board[i][j + 1], engine.board[i][j]]
        const has = engine.findMatches().length > 0
        ;[engine.board[i][j], engine.board[i][j + 1]] = [engine.board[i][j + 1], engine.board[i][j]]
        if (has) {
          hintCells.value = [{ row: i, col: j }, { row: i, col: j + 1 }]
          setTimeout(() => { hintCells.value = [] }, 2000)
          return
        }
      }
      if (i + 1 < rows) {
        ;[engine.board[i][j], engine.board[i + 1][j]] = [engine.board[i + 1][j], engine.board[i][j]]
        const has = engine.findMatches().length > 0
        ;[engine.board[i][j], engine.board[i + 1][j]] = [engine.board[i + 1][j], engine.board[i][j]]
        if (has) {
          hintCells.value = [{ row: i, col: j }, { row: i + 1, col: j }]
          setTimeout(() => { hintCells.value = [] }, 2000)
          return
        }
      }
    }
  }
}

async function submitAndRestart() {
  try {
    await submitScore(sessionId.value, playerName.value || 'anonymous')
  } catch (e) {}
  startNewGame()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
</script>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.game-container {
  display: flex;
  gap: 30px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: center;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 180px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.btn-new {
  background: linear-gradient(45deg, #6c5ce7, #a29bfe);
}

.btn-hint {
  background: linear-gradient(45deg, #00b894, #55efc4);
}

.btn-submit {
  background: linear-gradient(45deg, #fdcb6e, #f39c12);
}

.btn-restart {
  background: linear-gradient(45deg, #e17055, #d63031);
}

.ball-legend {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ball-legend h3 {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 8px;
  text-align: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 0.75rem;
}

.legend-emoji {
  font-size: 1.1rem;
}

.legend-name {
  color: #ddd;
  min-width: 30px;
}

.legend-skill {
  color: #888;
  font-size: 0.7rem;
}

.board-wrapper {
  position: relative;
}

.effect-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  pointer-events: none;
}

.effect-text {
  font-size: 3rem;
  font-weight: bold;
  color: #feca57;
  text-shadow: 0 0 20px rgba(254, 202, 87, 0.8), 0 0 40px rgba(254, 202, 87, 0.4);
  animation: effectPop 1s ease forwards;
}

@keyframes effectPop {
  0% { transform: scale(0.5); opacity: 0; }
  30% { transform: scale(1.3); opacity: 1; }
  70% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0; }
}

.game-over-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-content {
  background: linear-gradient(135deg, #2d3436, #636e72);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
}

.modal-content h2 {
  font-size: 2rem;
  color: #feca57;
}

.final-score {
  font-size: 1.5rem;
  color: #fff;
}

.name-input {
  padding: 10px 15px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1rem;
  width: 200px;
  text-align: center;
}

.name-input::placeholder {
  color: #888;
}

@media (max-width: 768px) {
  .game-container {
    flex-direction: column;
    align-items: center;
  }

  .sidebar {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    min-width: auto;
  }

  .ball-legend {
    display: none;
  }
}
</style>
