// ====== BASIC CONFIG ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const UI_SIZE = document.getElementById("player-size");
const UI_SCORE = document.getElementById("player-score");
const restartBtn = document.getElementById("restart-btn");

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

const NUM_FOOD = 250;
const NUM_BOTS = 6;

const PLAYER_BASE_SPEED = 2.8;
const BOT_BASE_SPEED = 2.1;

// ====== INPUT ======
const keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

window.addEventListener("keydown", e => {
  if (["ArrowUp", "KeyW"].includes(e.code)) keys.up = true;
  if (["ArrowDown", "KeyS"].includes(e.code)) keys.down = true;
  if (["ArrowLeft", "KeyA"].includes(e.code)) keys.left = true;
  if (["ArrowRight", "KeyD"].includes(e.code)) keys.right = true;
});

window.addEventListener("keyup", e => {
  if (["ArrowUp", "KeyW"].includes(e.code)) keys.up = false;
  if (["ArrowDown", "KeyS"].includes(e.code)) keys.down = false;
  if (["ArrowLeft", "KeyA"].includes(e.code)) keys.left = false;
  if (["ArrowRight", "KeyD"].includes(e.code)) keys.right = false;
});

// ====== UTILITIES ======
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ====== ENTITY CLASSES ======
class BlackHole {
  constructor(x, y, radius, isPlayer = false, color = "#000") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.score = 0;
    this.isPlayer = isPlayer;
    this.color = color;
    this.dead = false;

    // For bots movement
    this.targetX = randRange(0, WORLD_WIDTH);
    this.targetY = randRange(0, WORLD_HEIGHT);
    this.changeTargetCooldown = randRange(2, 5); // seconds
  }

  get speed() {
    // Slight slowdown as you grow
    const sizeFactor = Math.max(0.4, 1 - this.radius / 400);
    return (this.isPlayer ? PLAYER_BASE_SPEED : BOT_BASE_SPEED) * sizeFactor;
  }

  update(dt, foods, blackHoles) {
    if (this.dead) return;

    if (this.isPlayer) {
      this.updatePlayerMovement(dt);
    } else {
      this.updateBotMovement(dt, foods, blackHoles);
    }

    // Clamp to world
    this.x = Math.max(this.radius, Math.min(WORLD_WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(WORLD_HEIGHT - this.radius, this.y));

    // Eat food
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dist = distance(this.x, this.y, f.x, f.y);
      if (dist < this.radius) {
        this.eatFood(f);
        foods.splice(i, 1);
      }
    }

    // Eat other black holes
    for (const other of blackHoles) {
      if (other === this || other.dead) continue;
      const dist = distance(this.x, this.y, other.x, other.y);
      if (dist < this.radius && this.radius > other.radius * 1.1) {
        // This one eats the other
        this.eatBlackHole(other);
        other.dead = true;
      }
    }
  }

  updatePlayerMovement(dt) {
    let dx = 0;
    let dy = 0;

    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
    }
  }

  updateBotMovement(dt, foods, blackHoles) {
    // Occasionally pick a new random target
    this.changeTargetCooldown -= dt;
    if (this.changeTargetCooldown <= 0) {
      this.targetX = randRange(0, WORLD_WIDTH);
      this.targetY = randRange(0, WORLD_HEIGHT);
      this.changeTargetCooldown = randRange(2, 5);
    }

    // Very simple "AI": move toward nearest smaller food cluster / occasionally avoid bigger holes
    let targetX = this.targetX;
    let targetY = this.targetY;

    // Slight preference for nearest food
    let closestFood = null;
    let closestFoodDist = Infinity;
    for (const f of foods) {
      const d = distance(this.x, this.y, f.x, f.y);
      if (d < closestFoodDist) {
        closestFoodDist = d;
        closestFood = f;
      }
    }
    if (closestFood && closestFoodDist < 400) {
      targetX = closestFood.x;
      targetY = closestFood.y;
    }

    // Avoid much bigger black holes
    for (const other of blackHoles) {
      if (other === this || other.dead) continue;
      const d = distance(this.x, this.y, other.x, other.y);
      if (other.radius > this.radius * 1.3 && d < 300) {
        // Move away
        const ax = this.x - other.x;
        const ay = this.y - other.y;
        const len = Math.sqrt(ax * ax + ay * ay) || 1;
        const nx = ax / len;
        const ny = ay / len;
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        return;
      }
    }

    // Move toward target
    const vx = targetX - this.x;
    const vy = targetY - this.y;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    const nx = vx / len;
    const ny = vy / len;
    this.x += nx * this.speed * dt;
    this.y += ny * this.speed * dt;
  }

  eatFood(food) {
    const growth = food.value * 0.35;
    this.radius += growth;
    this.score += food.value;
  }

  eatBlackHole(other) {
    // Absorb their area
    const myArea = Math.PI * this.radius * this.radius;
    const theirArea = Math.PI * other.radius * other.radius;
    const newArea = myArea + theirArea * 0.9;
    this.radius = Math.sqrt(newArea / Math.PI);
    this.score += Math.floor(other.score * 1.2) + 20;
  }

  draw(viewX, viewY) {
    if (this.dead) return;

    const screenX = this.x - viewX;
    const screenY = this.y - viewY;

    // Outer glow
    const gradient = ctx.createRadialGradient(
      screenX, screenY, this.radius * 0.2,
      screenX, screenY, this.radius * 1.3
    );
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(0.4, this.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Event horizon (inner core)
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Small highlight
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(screenX - this.radius * 0.3, screenY - this.radius * 0.3, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Food {
  constructor(x, y, value, color) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.color = color;
  }

  draw(viewX, viewY) {
    const screenX = this.x - viewX;
    const screenY = this.y - viewY;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 4 + this.value * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ====== GAME STATE ======
let player;
let blackHoles = [];
let foods = [];
let lastTime = 0;
let gameOver = false;

function initGame() {
  blackHoles = [];
  foods = [];
  gameOver = false;

  // Player in middle of world
  player = new BlackHole(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 30, true, "#3355ff");
  blackHoles.push(player);

  // Bots
  for (let i = 0; i < NUM_BOTS; i++) {
    const x = randRange(100, WORLD_WIDTH - 100);
    const y = randRange(100, WORLD_HEIGHT - 100);
    const r = randRange(22, 38);
    const hue = Math.floor(randRange(0, 360));
    const color = `hsl(${hue}, 70%, 55%)`;
    const bot = new BlackHole(x, y, r, false, color);
    blackHoles.push(bot);
  }

  // Food
  for (let i = 0; i < NUM_FOOD; i++) {
    spawnFood();
  }
}

function spawnFood() {
  const x = randRange(0, WORLD_WIDTH);
  const y = randRange(0, WORLD_HEIGHT);
  const value = Math.random() < 0.85 ? 1 : 3; // some rarer, bigger food
  const color = value === 1 ? "#ffaa33" : "#ff33aa";
  foods.push(new Food(x, y, value, color));
}

// ====== MAIN LOOP ======
function update(dt) {
  if (gameOver) return;

  // Refill food
  while (foods.length < NUM_FOOD) {
    spawnFood();
  }

  // Update all black holes
  for (const bh of blackHoles) {
    bh.update(dt, foods, blackHoles);
  }

  // Check if player is dead
  if (player.dead) {
    gameOver = true;
  }

  // Update UI
  UI_SIZE.textContent = player.radius.toFixed(1);
  UI_SCORE.textContent = player.score.toString();
}

function draw() {
  // Camera centered on player
  const viewX = player.x - canvas.width / 2;
  const viewY = player.y - canvas.height / 2;

  // Background stars / grid
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(viewX, viewY);

  // Draw food
  for (const f of foods) {
    f.draw(viewX, viewY);
  }

  // Draw black holes
  for (const bh of blackHoles) {
    bh.draw(viewX, viewY);
  }

  if (gameOver) {
    drawGameOver();
  }
}

function drawBackground(viewX, viewY) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  const gridSize = 100;
  const startX = -((viewX % gridSize) + gridSize);
  const startY = -((viewY % gridSize) + gridSize);

  for (let x = startX; x < canvas.width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y < canvas.height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Some random static stars
  for (let i = 0; i < 60; i++) {
    const sx = (i * 37 + Math.floor(viewX * 0.3)) % canvas.width;
    const sy = (i * 53 + Math.floor(viewY * 0.3)) % canvas.height;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.restore();
}

function drawGameOver() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "40px Arial";
  ctx.textAlign = "center";
  ctx.fillText("You were consumed!", canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = "20px Arial";
  ctx.fillText("Press the Restart button to play again", canvas.width / 2, canvas.height / 2 + 20);

  ctx.restore();
}

// ====== GAME LOOP SETUP ======
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 16.67; // roughly 60fps units
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// Restart button
restartBtn.addEventListener("click", () => {
  initGame();
});

// Start
initGame();
requestAnimationFrame(gameLoop);
