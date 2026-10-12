const BALL_TYPES = ['basketball', 'soccer', 'tennis', 'baseball', 'volleyball', 'pingpong']

const BALL_EMOJIS = {
  basketball: '🏀',
  soccer: '⚽',
  tennis: '🎾',
  baseball: '⚾',
  volleyball: '🏐',
  pingpong: '🏓'
}

const BALL_COLORS = {
  basketball: '#ff6b35',
  soccer: '#2d3436',
  tennis: '#c8e618',
  baseball: '#d63031',
  volleyball: '#0984e3',
  pingpong: '#fdcb6e'
}

const SPECIAL_EFFECTS = {
  basketball: { name: 'slam_dunk', label: '扣篮！', desc: '清除整行' },
  soccer: { name: 'goal_shot', label: '射门！', desc: '清除3×3区域' },
  tennis: { name: 'bounce', label: '弹跳球！', desc: '随机消除5个球' },
  baseball: { name: 'home_run', label: '全垒打！', desc: '清除整列' },
  volleyball: { name: 'smash', label: '扣杀！', desc: '清除十字区域' },
  pingpong: { name: 'spin', label: '旋转球！', desc: '清除对角线' }
}

export { BALL_TYPES, BALL_EMOJIS, BALL_COLORS, SPECIAL_EFFECTS }

export class ClientGameEngine {
  constructor(rows = 8, cols = 8) {
    this.rows = rows
    this.cols = cols
    this.board = []
    this.score = 0
    this.combo = 0
  }

  initBoard() {
    this.board = []
    for (let i = 0; i < this.rows; i++) {
      this.board[i] = []
      for (let j = 0; j < this.cols; j++) {
        let type
        do {
          type = this.randomBall()
        } while (this.wouldMatch(i, j, type))
        this.board[i][j] = type
      }
    }
  }

  randomBall() {
    return BALL_TYPES[Math.floor(Math.random() * BALL_TYPES.length)]
  }

  wouldMatch(row, col, type) {
    if (col >= 2 && this.board[row][col - 1] === type && this.board[row][col - 2] === type)
      return true
    if (row >= 2 && this.board[row - 1]?.[col] === type && this.board[row - 2]?.[col] === type)
      return true
    return false
  }

  findMatches() {
    const matches = []

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (!this.board[i][j]) continue

        let hLen = 1
        while (j + hLen < this.cols && this.board[i][j + hLen] === this.board[i][j]) hLen++
        if (hLen >= 3) {
          const positions = []
          for (let k = 0; k < hLen; k++) positions.push({ row: i, col: j + k })
          matches.push({ type: this.board[i][j], length: hLen, positions, direction: 'h' })
        }

        let vLen = 1
        while (i + vLen < this.rows && this.board[i + vLen]?.[j] === this.board[i][j]) vLen++
        if (vLen >= 3) {
          const positions = []
          for (let k = 0; k < vLen; k++) positions.push({ row: i + k, col: j })
          matches.push({ type: this.board[i][j], length: vLen, positions, direction: 'v' })
        }
      }
    }
    return matches
  }

  getSpecialEffect(match) {
    if (match.length >= 5) {
      return {
        name: 'super_combo',
        label: '超级连击！',
        desc: '清除所有同类球',
        affected: this.getAllOfType(match.type)
      }
    }

    if (match.length === 4) {
      const effect = SPECIAL_EFFECTS[match.type]
      if (!effect) return null

      const affected = []
      const center = match.positions[1]

      switch (match.type) {
        case 'basketball':
          for (let j = 0; j < this.cols; j++)
            affected.push({ row: center.row, col: j })
          break
        case 'soccer':
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const nr = center.row + dr, nc = center.col + dc
              if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols)
                affected.push({ row: nr, col: nc })
            }
          break
        case 'tennis': {
          const available = []
          for (let i = 0; i < this.rows; i++)
            for (let j = 0; j < this.cols; j++)
              if (this.board[i][j]) available.push({ row: i, col: j })
          const shuffled = available.sort(() => Math.random() - 0.5)
          affected.push(...shuffled.slice(0, 5))
          break
        }
        case 'baseball':
          for (let i = 0; i < this.rows; i++)
            affected.push({ row: i, col: match.positions[0].col })
          break
        case 'volleyball':
          for (let j = 0; j < this.cols; j++)
            affected.push({ row: center.row, col: j })
          for (let i = 0; i < this.rows; i++)
            if (i !== center.row) affected.push({ row: i, col: center.col })
          break
        case 'pingpong':
          for (let d = -3; d <= 3; d++) {
            const nr1 = center.row + d, nc1 = center.col + d
            const nr2 = center.row + d, nc2 = center.col - d
            if (nr1 >= 0 && nr1 < this.rows && nc1 >= 0 && nc1 < this.cols)
              affected.push({ row: nr1, col: nc1 })
            if (nr2 >= 0 && nr2 < this.rows && nc2 >= 0 && nc2 < this.cols && nc2 !== nc1)
              affected.push({ row: nr2, col: nc2 })
          }
          break
      }
      return { ...effect, affected }
    }
    return null
  }

  getAllOfType(type) {
    const positions = []
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < this.cols; j++)
        if (this.board[i][j] === type) positions.push({ row: i, col: j })
    return positions
  }

  swap(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2)
    if (dr + dc !== 1) return { valid: false, error: 'not_adjacent' }

    ;[this.board[r1][c1], this.board[r2][c2]] = [this.board[r2][c2], this.board[r1][c1]]

    const matches = this.findMatches()
    if (matches.length === 0) {
      ;[this.board[r1][c1], this.board[r2][c2]] = [this.board[r2][c2], this.board[r1][c1]]
      return { valid: false, error: 'no_match' }
    }

    const result = { valid: true, score: 0, combo: 0, effects: [], matched: [] }
    this.processCascades(result)

    if (!this.hasValidMoves()) {
      this.initBoard()
    }

    return {
      ...result,
      board: this.board.map(row => [...row]),
      totalScore: this.score
    }
  }

  processCascades(result) {
    this.combo = 0
    while (true) {
      const matches = this.findMatches()
      if (matches.length === 0) break

      this.combo++
      result.combo = this.combo

      const toRemove = new Set()
      for (const match of matches) {
        for (const pos of match.positions)
          toRemove.add(`${pos.row},${pos.col}`)

        if (match.length >= 4) {
          const effect = this.getSpecialEffect(match)
          if (effect) {
            for (const pos of effect.affected)
              toRemove.add(`${pos.row},${pos.col}`)
            result.effects.push({ name: effect.name, label: effect.label, desc: effect.desc })
          }
        }

        for (const pos of match.positions)
          result.matched.push(pos)
      }

      for (const key of toRemove) {
        const [r, c] = key.split(',').map(Number)
        this.board[r][c] = null
      }

      let baseScore = 0
      for (const match of matches) baseScore += match.length * 10
      result.score += baseScore * this.combo

      this.applyGravity()
      this.fillEmpty()
    }
    this.score += result.score
  }

  applyGravity() {
    for (let j = 0; j < this.cols; j++) {
      let writeRow = this.rows - 1
      for (let i = this.rows - 1; i >= 0; i--) {
        if (this.board[i][j]) {
          this.board[writeRow][j] = this.board[i][j]
          if (writeRow !== i) this.board[i][j] = null
          writeRow--
        }
      }
    }
  }

  fillEmpty() {
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < this.cols; j++)
        if (!this.board[i][j]) this.board[i][j] = this.randomBall()
  }

  hasValidMoves() {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (j + 1 < this.cols) {
          ;[this.board[i][j], this.board[i][j + 1]] = [this.board[i][j + 1], this.board[i][j]]
          const has = this.findMatches().length > 0
          ;[this.board[i][j], this.board[i][j + 1]] = [this.board[i][j + 1], this.board[i][j]]
          if (has) return true
        }
        if (i + 1 < this.rows) {
          ;[this.board[i][j], this.board[i + 1][j]] = [this.board[i + 1][j], this.board[i][j]]
          const has = this.findMatches().length > 0
          ;[this.board[i][j], this.board[i + 1][j]] = [this.board[i + 1][j], this.board[i][j]]
          if (has) return true
        }
      }
    }
    return false
  }
}
