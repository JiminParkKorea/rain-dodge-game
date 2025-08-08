// ===== SERVER SIDE (Node.js + Express + Socket.IO) =====

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let players = {};
let raindrops = [];
let gameRunning = false;
let startTime = null;

const TICK_RATE = 1000 / 30;
const DROP_INTERVAL = 1000;
const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join', (data) => {
    if (Object.keys(players).length >= 12) return;
    players[socket.id] = {
      x: Math.random() * (FIELD_WIDTH - 50),
      alive: true,
      name: data.name || `Player-${socket.id.substring(0, 4)}`,
    };
    io.emit('players', players);
  });

  socket.on('move', (dir) => {
    if (!players[socket.id] || !players[socket.id].alive) return;
    const delta = dir === 'left' ? -10 : 10;
    players[socket.id].x = Math.max(0, Math.min(FIELD_WIDTH - 50, players[socket.id].x + delta));
  });

  socket.on('tilt', (x) => {
    if (!players[socket.id] || !players[socket.id].alive) return;
    players[socket.id].x = Math.max(0, Math.min(FIELD_WIDTH - 50, players[socket.id].x + x * 2));
  });

  socket.on('start', () => {
    if (!gameRunning) {
      raindrops = [];
      gameRunning = true;
      startTime = Date.now();
      setInterval(spawnRain, DROP_INTERVAL);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('players', players);
  });
});

function spawnRain() {
  if (!gameRunning) return;
  raindrops.push({ x: Math.random() * FIELD_WIDTH, y: 0 });
}

function update() {
  if (!gameRunning) return;

  for (let drop of raindrops) {
    drop.y += 5 + (Date.now() - startTime) / 10000;
    for (let id in players) {
      let p = players[id];
      if (
        p.alive &&
        drop.y > 550 && drop.y < 600 &&
        drop.x > p.x && drop.x < p.x + 50
      ) {
        p.alive = false;
      }
    }
  }

  raindrops = raindrops.filter((r) => r.y < FIELD_HEIGHT);

  const allDead = Object.values(players).every((p) => !p.alive);
  if (allDead) {
    gameRunning = false;
    io.emit('gameover', Date.now() - startTime);
  }

  io.emit('state', { players, raindrops });
}

setInterval(update, TICK_RATE);

app.use(express.static('public'));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});