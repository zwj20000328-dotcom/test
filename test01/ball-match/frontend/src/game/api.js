import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 5000
})

export async function newGame(rows = 8, cols = 8) {
  const res = await api.post('/new-game', { rows, cols })
  return res.data
}

export async function swap(sessionId, r1, c1, r2, c2) {
  const res = await api.post('/swap', { sessionId, r1, c1, r2, c2 })
  return res.data
}

export async function getState(sessionId) {
  const res = await api.get(`/state/${sessionId}`)
  return res.data
}

export async function submitScore(sessionId, player) {
  const res = await api.post('/score', { sessionId, player })
  return res.data
}

export async function getLeaderboard() {
  const res = await api.get('/leaderboard')
  return res.data
}
