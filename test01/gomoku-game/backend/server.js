const http = require('http');
const fs = require('fs');
const path = require('path');

const BOARD_SIZE = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;

class GomokuGame {
  constructor() { this.reset(); }

  reset() {
    this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    this.currentPlayer = BLACK;
    this.gameOver = false;
    this.winner = 0;
    this.history = [];
  }

  isValid(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.board[r][c] === EMPTY && !this.gameOver;
  }

  makeMove(r, c) {
    if (!this.isValid(r, c)) return false;
    this.board[r][c] = this.currentPlayer;
    this.history.push({ row: r, col: c });
    if (this.checkWin(r, c, this.currentPlayer)) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
    } else if (this.history.length === BOARD_SIZE * BOARD_SIZE) {
      this.gameOver = true;
      this.winner = 0;
    } else {
      this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
    }
    return true;
  }

  checkWin(r, c, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const nr = r + dr*i, nc = c + dc*i;
        if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && this.board[nr][nc]===player) count++;
        else break;
      }
      for (let i = 1; i < 5; i++) {
        const nr = r - dr*i, nc = c - dc*i;
        if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && this.board[nr][nc]===player) count++;
        else break;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  toJson() {
    return {
      board: this.board,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner,
      moveCount: this.history.length
    };
  }
}

class GomokuAI {
  static getBestMove(game) {
    const aiPlayer = game.currentPlayer;
    const oppPlayer = aiPlayer === BLACK ? WHITE : BLACK;
    const candidates = [];

    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (game.board[i][j] === EMPTY && this.hasNeighbor(game.board, i, j, 2)) {
          const score = this.evaluatePosition(game.board, i, j, aiPlayer, oppPlayer);
          candidates.push({ score, row: i, col: j });
        }
      }
    }

    if (candidates.length === 0) {
      return { row: Math.floor(BOARD_SIZE/2), col: Math.floor(BOARD_SIZE/2) };
    }

    candidates.sort((a, b) => b.score - a.score);
    return { row: candidates[0].row, col: candidates[0].col };
  }

  static hasNeighbor(board, r, c, dist) {
    for (let i = r - dist; i <= r + dist; i++) {
      for (let j = c - dist; j <= c + dist; j++) {
        if (i >= 0 && i < BOARD_SIZE && j >= 0 && j < BOARD_SIZE && board[i][j] !== EMPTY) return true;
      }
    }
    return false;
  }

  static evaluatePosition(board, r, c, ai, opp) {
    const attack = this.evaluateForPlayer(board, r, c, ai);
    const defense = this.evaluateForPlayer(board, r, c, opp);
    return Math.floor(attack * 11 / 10) + defense;
  }

  static evaluateForPlayer(board, r, c, player) {
    let totalScore = 0;
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];

    for (const [dr, dc] of dirs) {
      let count = 1, openEnds = 0, blocked = 0;

      let i = 1;
      while (i < 5) {
        const nr = r + dr*i, nc = c + dc*i;
        if (nr<0 || nr>=BOARD_SIZE || nc<0 || nc>=BOARD_SIZE) { blocked++; break; }
        if (board[nr][nc] === player) { count++; i++; }
        else if (board[nr][nc] === EMPTY) { openEnds++; break; }
        else { blocked++; break; }
      }
      if (i >= 5 || (r+dr*i<0||r+dr*i>=BOARD_SIZE||c+dc*i<0||c+dc*i>=BOARD_SIZE)) blocked++;

      i = 1;
      while (i < 5) {
        const nr = r - dr*i, nc = c - dc*i;
        if (nr<0 || nr>=BOARD_SIZE || nc<0 || nc>=BOARD_SIZE) { blocked++; break; }
        if (board[nr][nc] === player) { count++; i++; }
        else if (board[nr][nc] === EMPTY) { openEnds++; break; }
        else { blocked++; break; }
      }
      if (i >= 5 || (r-dr*i<0||r-dr*i>=BOARD_SIZE||c-dc*i<0||c-dc*i>=BOARD_SIZE)) blocked++;

      totalScore += this.getPatternScore(count, openEnds, blocked);
    }
    return totalScore;
  }

  static getPatternScore(count, openEnds, blocked) {
    if (count >= 5) return 1000000;
    if (blocked === 2) return 0;
    if (count === 4) {
      if (openEnds === 2) return 500000;
      if (openEnds === 1) return 50000;
    }
    if (count === 3) {
      if (openEnds === 2) return 10000;
      if (openEnds === 1) return 1000;
    }
    if (count === 2) {
      if (openEnds === 2) return 500;
      if (openEnds === 1) return 100;
    }
    if (count === 1) {
      if (openEnds === 2) return 10;
      if (openEnds === 1) return 1;
    }
    return 0;
  }
}

const game = new GomokuGame();
let vsAI = true;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath);
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendJson(res, data, code = 200) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

const DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    sendJson(res, game.toJson());
    return;
  }

  if (pathname === '/api/move' && req.method === 'POST') {
    const { row, col } = await parseBody(req);
    if (game.makeMove(row, col)) {
      if (vsAI && !game.gameOver && game.currentPlayer === WHITE) {
        const aiMove = GomokuAI.getBestMove(game);
        if (aiMove.row >= 0) game.makeMove(aiMove.row, aiMove.col);
      }
      sendJson(res, game.toJson());
    } else {
      sendJson(res, { error: 'invalid move' }, 400);
    }
    return;
  }

  if (pathname === '/api/reset' && req.method === 'POST') {
    game.reset();
    sendJson(res, game.toJson());
    return;
  }

  if (pathname === '/api/mode' && req.method === 'POST') {
    const { mode } = await parseBody(req);
    vsAI = mode === 'ai';
    game.reset();
    sendJson(res, { mode: vsAI ? 'ai' : 'pvp' });
    return;
  }

  if (pathname === '/api/undo' && req.method === 'POST') {
    if (game.history.length > 0 && !game.gameOver) {
      const undoCount = vsAI ? 2 : 1;
      for (let u = 0; u < undoCount && game.history.length > 0; u++) {
        const last = game.history[game.history.length - 1];
        game.board[last.row][last.col] = EMPTY;
        game.history.pop();
        game.currentPlayer = game.currentPlayer === BLACK ? WHITE : BLACK;
      }
    }
    sendJson(res, game.toJson());
    return;
  }

  let filePath = pathname === '/' ? '/index.html' : pathname;
  let fullPath = path.join(DIST_DIR, filePath);

  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath);
      res.writeHead(200, { 'Content-Type': getMimeType(fullPath) });
      res.end(content);
    } else {
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found - Run "npm run build" in frontend first');
      }
    }
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

const PORT = process.argv[2] || 8080;
server.listen(PORT, () => {
  console.log('=======================================');
  console.log(`  Gomoku Server running on port ${PORT}`);
  console.log(`  Open http://localhost:${PORT}`);
  console.log('=======================================');
});
