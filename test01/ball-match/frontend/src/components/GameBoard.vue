<template>
  <div class="game-board" :style="boardStyle">
    <div
      v-for="(cell, index) in flatBoard"
      :key="`${cell.row}-${cell.col}`"
      class="cell"
      :class="{
        selected: isSelected(cell.row, cell.col),
        matched: isMatched(cell.row, cell.col),
        hint: isHint(cell.row, cell.col)
      }"
      :style="cellStyle(cell)"
      @click="onCellClick(cell.row, cell.col)"
      @touchstart.prevent="onTouchStart($event, cell.row, cell.col)"
      @touchend.prevent="onTouchEnd($event, cell.row, cell.col)"
    >
      <div class="ball" :class="{ 'ball-pop': isMatched(cell.row, cell.col) }">
        <span class="ball-emoji">{{ getEmoji(cell.type) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BALL_EMOJIS, BALL_COLORS } from '../game/engine.js'

const props = defineProps({
  board: { type: Array, required: true },
  rows: { type: Number, default: 8 },
  cols: { type: Number, default: 8 },
  selected: { type: Object, default: null },
  matchedCells: { type: Array, default: () => [] },
  hintCells: { type: Array, default: () => [] }
})

const emit = defineEmits(['select', 'swap'])

const cellSize = computed(() => {
  const maxSize = Math.min(500, window.innerWidth - 40)
  return Math.floor(maxSize / props.cols)
})

const boardStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${props.cols}, ${cellSize.value}px)`,
  gridTemplateRows: `repeat(${props.rows}, ${cellSize.value}px)`,
  gap: '2px',
  padding: '10px',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '12px',
  border: '2px solid rgba(255,255,255,0.1)'
}))

const flatBoard = computed(() => {
  const cells = []
  for (let i = 0; i < props.rows; i++) {
    for (let j = 0; j < props.cols; j++) {
      cells.push({ row: i, col: j, type: props.board[i]?.[j] })
    }
  }
  return cells
})

function cellStyle(cell) {
  if (!cell.type) return { opacity: 0 }
  const color = BALL_COLORS[cell.type] || '#666'
  return {
    width: `${cellSize.value}px`,
    height: `${cellSize.value}px`
  }
}

function getEmoji(type) {
  return BALL_EMOJIS[type] || '❓'
}

function isSelected(row, col) {
  return props.selected && props.selected.row === row && props.selected.col === col
}

function isMatched(row, col) {
  return props.matchedCells.some(p => p.row === row && p.col === col)
}

function isHint(row, col) {
  return props.hintCells.some(p => p.row === row && p.col === col)
}

const touchStartPos = ref(null)

function onCellClick(row, col) {
  emit('select', { row, col })
}

function onTouchStart(event, row, col) {
  const touch = event.touches[0]
  touchStartPos.value = { x: touch.clientX, y: touch.clientY, row, col }
}

function onTouchEnd(event, row, col) {
  if (!touchStartPos.value) return
  const touch = event.changedTouches[0]
  const dx = touch.clientX - touchStartPos.value.x
  const dy = touch.clientY - touchStartPos.value.y
  const threshold = 30

  if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
    let targetRow = touchStartPos.value.row
    let targetCol = touchStartPos.value.col

    if (Math.abs(dx) > Math.abs(dy)) {
      targetCol += dx > 0 ? 1 : -1
    } else {
      targetRow += dy > 0 ? 1 : -1
    }

    emit('swap', {
      r1: touchStartPos.value.row,
      c1: touchStartPos.value.col,
      r2: targetRow,
      c2: targetCol
    })
  }
  touchStartPos.value = null
}
</script>

<style scoped>
.game-board {
  user-select: none;
  -webkit-user-select: none;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.15s ease, background 0.2s ease;
  background: rgba(255, 255, 255, 0.03);
}

.cell:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.cell.selected {
  background: rgba(255, 215, 0, 0.3);
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}

.cell.matched {
  animation: pulse 0.3s ease;
}

.cell.hint {
  animation: hintPulse 1s ease infinite;
}

.ball {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80%;
  height: 80%;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.ball-emoji {
  font-size: clamp(1.2rem, 4vw, 2rem);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.ball-pop {
  animation: pop 0.4s ease forwards;
}

@keyframes pop {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.8; }
  100% { transform: scale(0); opacity: 0; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.9); }
}

@keyframes hintPulse {
  0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
  50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.6); }
}
</style>
