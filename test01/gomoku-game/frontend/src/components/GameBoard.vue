<template>
  <div class="game-container">
    <h1 class="title">五子棋</h1>

    <div class="controls">
      <div class="mode-selector">
        <button
          :class="['mode-btn', { active: mode === 'ai' }]"
          @click="setMode('ai')"
        >
          人机对战
        </button>
        <button
          :class="['mode-btn', { active: mode === 'pvp' }]"
          @click="setMode('pvp')"
        >
          双人对战
        </button>
      </div>

      <div class="status">
        <div v-if="gameState.gameOver" class="status-text winner">
          {{ gameState.winner === 0 ? '平局！' : (gameState.winner === 1 ? '⚫ 黑棋胜！' : '⚪ 白棋胜！') }}
        </div>
        <div v-else class="status-text">
          <span class="current-player" :class="gameState.currentPlayer === 1 ? 'black' : 'white'">
            {{ gameState.currentPlayer === 1 ? '⚫ 黑棋' : '⚪ 白棋' }}
          </span>
          <span> 落子</span>
          <span v-if="mode === 'ai' && gameState.currentPlayer === 2" class="thinking"> (AI思考中...)</span>
        </div>
      </div>

      <div class="action-buttons">
        <button class="action-btn undo-btn" @click="undo" :disabled="gameState.moveCount === 0">
          悔棋
        </button>
        <button class="action-btn reset-btn" @click="resetGame">
          重新开始
        </button>
      </div>
    </div>

    <div class="board-wrapper">
      <div class="board" :style="boardStyle">
        <svg :width="boardPixelSize" :height="boardPixelSize" class="board-svg">
          <rect width="100%" height="100%" fill="#DEB887"/>
          <line
            v-for="i in BOARD_SIZE" :key="'h'+i"
            :x1="padding" :y1="padding + (i-1) * cellSize"
            :x2="padding + (BOARD_SIZE-1) * cellSize" :y2="padding + (i-1) * cellSize"
            stroke="#8B7355" stroke-width="1"
          />
          <line
            v-for="i in BOARD_SIZE" :key="'v'+i"
            :x1="padding + (i-1) * cellSize" :y1="padding"
            :x2="padding + (i-1) * cellSize" :y2="padding + (BOARD_SIZE-1) * cellSize"
            stroke="#8B7355" stroke-width="1"
          />
          <circle
            v-for="star in starPoints" :key="'s'+star[0]+'-'+star[1]"
            :cx="padding + star[1] * cellSize"
            :cy="padding + star[0] * cellSize"
            r="3.5" fill="#8B7355"
          />
          <g v-for="(row, r) in gameState.board" :key="'r'+r">
            <g v-for="(cell, c) in row" :key="'c'+r+'-'+c">
              <circle
                v-if="cell !== 0"
                :cx="padding + c * cellSize"
                :cy="padding + r * cellSize"
                :r="stoneRadius"
                :fill="cell === 1 ? '#111' : '#f5f5f5'"
                :stroke="cell === 1 ? '#000' : '#ccc'"
                stroke-width="1"
                class="stone"
              />
              <circle
                v-if="cell !== 0 && isLastMove(r, c)"
                :cx="padding + c * cellSize"
                :cy="padding + r * cellSize"
                r="4"
                :fill="cell === 1 ? '#ff4444' : '#ff4444'"
                class="last-move-indicator"
              />
            </g>
          </g>
          <rect
            v-for="(row, r) in gameState.board" :key="'click-r'+r"
            v-for-unused=""
          />
          <g v-for="r in BOARD_SIZE" :key="'click-row-'+r">
            <rect
              v-for="c in BOARD_SIZE" :key="'click-'+r+'-'+c"
              :x="padding + (c-1) * cellSize - cellSize/2"
              :y="padding + (r-1) * cellSize - cellSize/2"
              :width="cellSize" :height="cellSize"
              fill="transparent"
              class="click-area"
              :class="{ 'clickable': gameState.board[r-1][c-1] === 0 && !gameState.gameOver }"
              @click="handleClick(r-1, c-1)"
            />
          </g>
        </svg>
      </div>
    </div>

    <div class="move-count">
      第 {{ gameState.moveCount }} 手
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'

const BOARD_SIZE = 15
const API_BASE = ''

const mode = ref('ai')
const gameState = reactive({
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
  currentPlayer: 1,
  gameOver: false,
  winner: 0,
  moveCount: 0
})

const cellSize = 36
const padding = 24
const stoneRadius = cellSize * 0.43
const boardPixelSize = padding * 2 + (BOARD_SIZE - 1) * cellSize

const boardStyle = computed(() => ({
  width: boardPixelSize + 'px',
  height: boardPixelSize + 'px',
}))

const starPoints = [
  [3, 3], [3, 7], [3, 11],
  [7, 3], [7, 7], [7, 11],
  [11, 3], [11, 7], [11, 11]
]

const lastMove = ref(null)

function isLastMove(r, c) {
  return lastMove.value && lastMove.value.row === r && lastMove.value.col === c
}

async function fetchState() {
  try {
    const res = await fetch(API_BASE + '/api/state')
    const data = await res.json()
    Object.assign(gameState, data)
  } catch (e) {
    console.error('Failed to fetch state:', e)
  }
}

async function handleClick(r, c) {
  if (gameState.gameOver || gameState.board[r][c] !== 0) return
  if (mode.value === 'ai' && gameState.currentPlayer === 2) return

  try {
    const res = await fetch(API_BASE + '/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: r, col: c })
    })
    const data = await res.json()
    Object.assign(gameState, data)
    lastMove.value = { row: r, col: c }
    if (mode.value === 'ai' && !data.gameOver && data.currentPlayer === 2) {
      setTimeout(fetchState, 300)
    }
  } catch (e) {
    console.error('Failed to make move:', e)
  }
}

async function resetGame() {
  try {
    const res = await fetch(API_BASE + '/api/reset', { method: 'POST' })
    const data = await res.json()
    Object.assign(gameState, data)
    lastMove.value = null
  } catch (e) {
    console.error('Failed to reset:', e)
  }
}

async function setMode(newMode) {
  mode.value = newMode
  try {
    const res = await fetch(API_BASE + '/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    })
    const data = await res.json()
    await fetchState()
    lastMove.value = null
  } catch (e) {
    console.error('Failed to set mode:', e)
  }
}

async function undo() {
  try {
    const res = await fetch(API_BASE + '/api/undo', { method: 'POST' })
    const data = await res.json()
    Object.assign(gameState, data)
    lastMove.value = null
  } catch (e) {
    console.error('Failed to undo:', e)
  }
}

onMounted(fetchState)
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e0e0e0;
}

.title {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 16px;
  background: linear-gradient(90deg, #e2b96f, #f0d090);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 8px;
}

.controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.mode-selector {
  display: flex;
  gap: 8px;
}

.mode-btn {
  padding: 8px 24px;
  border: 2px solid #e2b96f;
  background: transparent;
  color: #e2b96f;
  border-radius: 24px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.3s;
}

.mode-btn:hover {
  background: rgba(226, 185, 111, 0.15);
}

.mode-btn.active {
  background: #e2b96f;
  color: #1a1a2e;
  font-weight: 600;
}

.status {
  text-align: center;
}

.status-text {
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-text.winner {
  font-size: 1.3rem;
  font-weight: 700;
  color: #ff6b6b;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.current-player.black {
  color: #fff;
  text-shadow: 0 0 8px rgba(255,255,255,0.5);
}

.current-player.white {
  color: #f5f5f5;
}

.thinking {
  color: #aaa;
  font-size: 0.9rem;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 6px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.undo-btn {
  background: #4a5568;
  color: #e0e0e0;
}

.undo-btn:hover:not(:disabled) {
  background: #5a6578;
}

.undo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reset-btn {
  background: #e2b96f;
  color: #1a1a2e;
  font-weight: 600;
}

.reset-btn:hover {
  background: #f0c97f;
}

.board-wrapper {
  display: flex;
  justify-content: center;
}

.board {
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
  overflow: hidden;
}

.board-svg {
  display: block;
}

.stone {
  filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.3));
}

.last-move-indicator {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; r: 0; }
  to { opacity: 1; }
}

.click-area {
  cursor: default;
}

.click-area.clickable {
  cursor: pointer;
}

.click-area.clickable:hover {
  fill: rgba(0,0,0,0.08);
}

.move-count {
  margin-top: 12px;
  font-size: 0.9rem;
  color: #888;
}
</style>
