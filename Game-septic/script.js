const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const minimapCanvas = document.getElementById('minimapCanvas');
const mctx = minimapCanvas.getContext('2d');
const MM_W = minimapCanvas.width;
const MM_H = minimapCanvas.height;

// Utility shade color for 3D faces
function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;
    R = Math.max(0, R);
    G = Math.max(0, G);
    B = Math.max(0, B);

    return "#" + (R.toString(16).padStart(2, '0')) + (G.toString(16).padStart(2, '0')) + (B.toString(16).padStart(2, '0'));
}

// UI Elements
const startScreen = document.getElementById('start-screen');
const winScreen = document.getElementById('win-screen');
const levelScreen = document.getElementById('level-screen');
const loseScreen = document.getElementById('lose-screen');
const hud = document.getElementById('hud');
const mobileControls = document.getElementById('mobile-controls');
const actionBtn = document.getElementById('action-btn');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const retryBtn = document.getElementById('retry-btn');
const nextLevelBtn = document.getElementById('next-level-btn');

const levelEl = document.getElementById('level-display');
const scoreEl = document.getElementById('score');
const totalScoreEl = document.getElementById('total-score');
const moneyEl = document.getElementById('money-display');
const timeEl = document.getElementById('time-display');

const smellBarFill = document.getElementById('smell-bar-fill');

const wsTime = document.getElementById('ws-time');
const wsScore = document.getElementById('ws-score');
const wsMoney = document.getElementById('ws-money');

const lsTime = document.getElementById('ls-time');
const lsMoney = document.getElementById('ls-money');

const loseReason = document.getElementById('lose-reason');

// Game State
let gameState = 'START'; // START, PLAYING, LEVEL_WIN, WIN, LOSE
let currentLevel = 1;
let maxLevels = 3;
let score = 0;
let money = 0;
let timeLeft = 120; // 2 minutes
let animationId;
let gameTime = 0;
let lastFrameTime = 0;

let upgrades = { speed: 1, time: 1, install: 1 };
const upgCosts = { speed: [300000, 600000, 1000000], time: [350000, 700000, 1200000], install: [450000, 900000, 1500000] };

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'fix') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'win') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueCurveAtTime([400, 600, 800, 1200], audioCtx.currentTime, 0.6);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.8);
    } else if (type === 'lose') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueCurveAtTime([300, 200, 100, 50], audioCtx.currentTime, 0.8);
        gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 1.2);
    } else if (type === 'step') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(120, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'cash') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.2);
    }
}

// Map dimensions
let mapWidth = 2600;
let mapHeight = 2000;
const ROAD_Y = mapHeight / 2;

// Camera
const camera = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };

// Controls Input
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, e: false, ' ': false };
const joypad = { x: 0, y: 0, active: false };

window.addEventListener('keydown', (e) => {
    let key = e.key;
    if (key.length === 1) key = key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (e.key.startsWith('Arrow')) keys[e.key] = true;
    if (e.key === ' ') { keys[' '] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
    let key = e.key;
    if (key.length === 1) key = key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
    if (e.key.startsWith('Arrow')) keys[e.key] = false;
    if (e.key === ' ') keys[' '] = false;
});

// Mobile Joystick Logic
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');

function handleTouchMove(e) {
    if (!joypad.active) return;
    e.preventDefault(); // prevent scroll
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === joypad.id) touch = e.touches[i];
    }
    if (!touch) return;

    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2 - joystickStick.offsetWidth / 2;

    if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
    }

    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joypad.x = dx / maxRadius;
    joypad.y = dy / maxRadius;
}

joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joypad.active = true;
    joypad.id = touch.identifier;
    handleTouchMove(e);
}, { passive: false });

joystickZone.addEventListener('touchmove', handleTouchMove, { passive: false });

const endJoystick = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joypad.id) {
            joypad.active = false;
            joypad.x = 0; joypad.y = 0;
            joystickStick.style.transform = `translate(-50%, -50%)`;
        }
    }
};
joystickZone.addEventListener('touchend', endJoystick);
joystickZone.addEventListener('touchcancel', endJoystick);

actionBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.e = true; });
actionBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.e = false; });

// Check mobile on resize
function isMobileDevice() {
    return window.innerWidth <= 900 ||
        ('ontouchstart' in window) ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
}

function updateMobileControlsVisibility() {
    if (!mobileControls) return;

    if (isMobileDevice() && gameState === 'PLAYING') {
        mobileControls.classList.remove('hidden');
        mobileControls.style.display = 'block';
        mobileControls.style.visibility = 'visible';
        mobileControls.style.opacity = '1';
        mobileControls.style.pointerEvents = 'auto';
    } else {
        mobileControls.classList.add('hidden');
        mobileControls.style.display = '';
        mobileControls.style.visibility = '';
        mobileControls.style.opacity = '';
        mobileControls.style.pointerEvents = '';
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width;
    camera.height = canvas.height;
    mapWidth = Math.max(2600, canvas.width);
    mapHeight = Math.max(2000, canvas.height);

    updateMobileControlsVisibility();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
    setTimeout(resize, 50);
    setTimeout(resize, 250);
});
window.addEventListener('load', () => {
    setTimeout(resize, 50);
    setTimeout(resize, 250);
});
window.addEventListener('pageshow', () => {
    setTimeout(resize, 50);
    setTimeout(resize, 250);
});

// Player
const player = {
    x: mapWidth / 2, y: mapHeight / 2, radius: 12, speed: 380,
    walkAnim: 0, direction: 'down', lastStepTime: 0
};

// World Data
const houses = [];
const problems = [];
const particles = [];
const trees = [];
const bushes = [];
const stones = [];
const trucks = [];
const npcs = [];
const dogs = [];
let rewardsQueue = [];

const houseColors = ['#FAFAFA', '#FFE0B2', '#BBDEFB', '#C8E6C9', '#E1BEE7', '#FFCCBC', '#FFF9C4', '#D7CCC8'];
const roofColors = ['#37474F', '#4E342E', '#455A64', '#5D4037', '#78909C', '#8D6E63', '#607D8B', '#795548'];
const septicNames = ["Топас-5", "Волгарь-3", "Тверь", "Тополь-4"];

function initLevel() {
    houses.length = 0; problems.length = 0; particles.length = 0;
    trees.length = 0; bushes.length = 0; stones.length = 0; trucks.length = 0; npcs.length = 0; dogs.length = 0; rewardsQueue.length = 0;

    // Only reset money on completely fresh start
    if (currentLevel === 1) money = 0;

    score = 0; timeLeft = 120 + (upgrades.time - 1) * 30; gameTime = 0;

    levelEl.innerText = `Уровень: ${currentLevel}`;
    moneyEl.innerText = money;
    updateTimeDisplay();
    lastFrameTime = performance.now();

    // Create houses
    let numHouses = 10;
    if (currentLevel === 2) numHouses = 16;
    if (currentLevel === 3) numHouses = 22;
    for (let i = 0; i < numHouses; i++) {
        let yardWidth = 280 + Math.random() * 80;
        let yardHeight = 240 + Math.random() * 80;

        // Level 2 is denser, smaller yards
        if (currentLevel === 2) {
            yardWidth = 240 + Math.random() * 60;
            yardHeight = 200 + Math.random() * 60;
        }

        const yardX = 200 + Math.random() * (mapWidth - yardWidth - 400);
        const yardY = 200 + Math.random() * (mapHeight - yardHeight - 400);

        // Prevent overlaps
        let overlap = false;
        for (const h of houses) {
            // Smaller overlap cushion on upper levels
            let cushion = 80;
            if (currentLevel === 2) cushion = 40;
            if (currentLevel === 3) cushion = 30;
            if (yardX < h.yardX + h.yardWidth + cushion && yardX + yardWidth + cushion > h.yardX && yardY < h.yardY + h.yardHeight + cushion && yardY + yardHeight + cushion > h.yardY) overlap = true;
        }
        if (Math.abs((yardY + yardHeight / 2) - ROAD_Y) < 170) overlap = true;
        if (overlap) { i--; continue; }

        const w = 100 + Math.random() * 50, d = 90 + Math.random() * 30, z = 80 + Math.random() * 20;
        const houseX = yardX + yardWidth / 2 - w / 2, houseY = yardY + 45;

        houses.push({
            yardX, yardY, yardWidth, yardHeight, houseX, houseY, w, d, z,
            colorFront: houseColors[Math.floor(Math.random() * houseColors.length)],
            colorRoof: roofColors[Math.floor(Math.random() * roofColors.length)],
            pathOffset: (Math.random() - 0.5) * 20
        });

        // Add Problem
        const probX = houseX + w / 2 + (Math.random() > 0.5 ? 70 : -70);
        const probY = yardY + yardHeight - 70;
        problems.push({
            x: probX, y: probY, size: 22, fixed: false, animOffset: Math.random() * Math.PI * 2,
            labelName: septicNames[Math.floor(Math.random() * septicNames.length)], installTimer: 0
        });

        // Add NPCs to some houses
        if (Math.random() > (currentLevel === 1 ? 0.4 : 0.2)) {
            npcs.push({
                x: yardX + Math.random() * (yardWidth - 40) + 20,
                y: yardY + Math.random() * (yardHeight - 40) + 20,
                baseX: yardX + yardWidth / 2, baseY: yardY + yardHeight / 2,
                anim: Math.random() * Math.PI, state: 'idle', timer: 0,
                color: `hsl(${Math.random() * 360}, 60%, 50%)`
            });
        }

        // Bushes
        for (let j = 0; j < 3; j++) bushes.push({ x: yardX + 20 + Math.random() * (yardWidth - 40), y: yardY + 20 + Math.random() * (yardHeight - 40), size: 0.6 + Math.random() * 0.4, type: Math.floor(Math.random() * 3) });

    }

    // Add Guard Dogs to exactly 2 or 3 random yards
    const numDogs = Math.random() > 0.5 ? 2 : 3;
    const shuffledHouses = [...houses].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(numDogs, shuffledHouses.length); i++) {
        const h = shuffledHouses[i];
        dogs.push({
            x: h.yardX + h.yardWidth / 2, y: h.yardY + h.yardHeight / 2,
            baseX: h.yardX + h.yardWidth / 2, baseY: h.yardY + h.yardHeight / 2,
            minX: h.yardX + 20, maxX: h.yardX + h.yardWidth - 20,
            minY: h.yardY + 20, maxY: h.yardY + h.yardHeight - 20,
            vx: 0, vy: 0, state: 'patrol', timer: 0, anim: Math.random() * Math.PI,
            barkTimer: 0, recentBark: 0
        });
    }

    // Decor
    for (let i = 0; i < 90; i++) {
        const tx = Math.random() * mapWidth, ty = Math.random() * mapHeight;
        let valid = true;
        for (const h of houses) if (tx > h.yardX - 40 && tx < h.yardX + h.yardWidth + 40 && ty > h.yardY - 40 && ty < h.yardY + h.yardHeight + 40) valid = false;
        if (Math.abs(ty - ROAD_Y) < 90) valid = false;
        if (valid) trees.push({ x: tx, y: ty, size: 0.7 + Math.random() * 0.6 });
    }
    for (let i = 0; i < 70; i++) stones.push({ x: Math.random() * mapWidth, y: Math.random() * mapHeight, size: 0.4 + Math.random() * 0.6 });

    totalScoreEl.innerText = problems.length;
    scoreEl.innerText = score;
    updateSmellMeter();

    // safe start
    player.x = 200; player.y = ROAD_Y; player.walkAnim = 0;
}

function updateTimeDisplay() {
    const m = Math.floor(Math.max(0, timeLeft) / 60);
    const s = Math.floor(Math.max(0, timeLeft) % 60);
    timeEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (timeLeft <= 30) timeEl.style.color = '#ef4444'; else timeEl.style.color = '#1e293b';
}

function updateSmellMeter() {
    // 0 = completely fixed, 1 = perfectly broken. Width shrinks down.
    const ratio = (problems.length - score) / problems.length;

    // As width shrinks, the background position holds the green part so it feels like revealing nature
    smellBarFill.style.width = `${ratio * 100}%`;
    smellBarFill.style.backgroundPosition = `100% 0`;
}

function spawnRewardPopup(x, y, amount) {
    const rdiv = document.createElement('div');
    rdiv.className = 'floating-reward';
    rdiv.innerText = `+${amount} ₽`;
    // Attach to game-container but project world pos to screen pos roughly
    document.getElementById('game-container').appendChild(rdiv);

    // We update its pos in screen space during render
    rewardsQueue.push({ el: rdiv, wx: x, wy: y, life: 1.5 });

    money += amount;
    moneyEl.innerText = money;
}

// Particle System
function createParticles(x, y, color, count = 30, speed = 12, glow = false) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = Math.random() * speed;
        particles.push({
            x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 4,
            life: 1, decay: 0.02 + Math.random() * 0.03, size: 3 + Math.random() * 6, color: color, glow: glow
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.vy += 0.3 * dt * 60; p.life -= p.decay * dt * 60;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function getCollisions(x, y, radius) {
    if (x < radius || x > mapWidth - radius || y < radius || y > mapHeight - radius) return true;
    for (let h of houses) {
        if (x > h.houseX - radius && x < h.houseX + h.w + radius && y > h.houseY - radius && y < h.houseY + h.d + radius) return true;
    }
    for (let prob of problems) {
        if (Math.hypot(x - prob.x, y - prob.y) < radius + (prob.fixed ? 15 : 12)) return true;
    }
    return false;
}

function updateTrucks(dt) {
    const truckCap = currentLevel === 1 ? 3 : 5;
    const spawnRate = currentLevel === 1 ? 0.3 : 0.6;

    // Spawn frequently to be an actual hazard
    if (Math.random() < dt * spawnRate && trucks.length < truckCap) {
        const fromLeft = Math.random() > 0.5;
        // Lane positioning
        const laneOffset = fromLeft ? -25 : 25;
        trucks.push({
            x: fromLeft ? -150 : mapWidth + 150,
            y: ROAD_Y + laneOffset,
            vx: (fromLeft ? 1 : -1) * (200 + Math.random() * 100), // very fast hazard
            direction: fromLeft ? 'right' : 'left', bounce: 0,
            w: 80, h: 30
        });
    }

    for (let i = trucks.length - 1; i >= 0; i--) {
        const tr = trucks[i];
        tr.x += tr.vx * dt;
        tr.bounce += dt * 15;

        // Fatal Collision Detection Outline Check (AABB mostly)
        const trLeft = tr.x - tr.w / 2, trRight = tr.x + tr.w / 2, trTop = tr.y - tr.h / 2, trBot = tr.y + tr.h / 2;
        if (player.x > trLeft && player.x < trRight && player.y > trTop && player.y < trBot) {
            triggerLose("Вас сбила ассенизаторская машина!");
            return;
        }

        if (tr.x < -200 || tr.x > mapWidth + 200) trucks.splice(i, 1);
    }
}

function updateNPCs(dt) {
    npcs.forEach(npc => {
        npc.timer -= dt;
        npc.anim += dt * 4;

        if (npc.timer <= 0) {
            npc.state = Math.random() > 0.5 ? 'wander' : 'idle';
            npc.timer = 1 + Math.random() * 3;
            if (npc.state === 'wander') {
                const ang = Math.random() * Math.PI * 2;
                npc.vx = Math.cos(ang) * 30; npc.vy = Math.sin(ang) * 30;
            }
        }

        if (npc.state === 'wander') {
            const nx = npc.x + npc.vx * dt;
            const ny = npc.y + npc.vy * dt;
            // soft tether to base
            if (Math.hypot(nx - npc.baseX, ny - npc.baseY) < 100 && !getCollisions(nx, ny, 8)) {
                npc.x = nx; npc.y = ny;
            } else {
                npc.state = 'idle';
            }
        }
    });
}

function triggerLose(reasonMsg) {
    gameState = 'LOSE';
    playSound('lose');
    loseReason.innerText = reasonMsg;
    // clear mobile
    joypad.active = false; joystickStick.style.transform = `translate(-50%, -50%)`;
    hud.classList.add('hidden'); mobileControls.classList.add('hidden');
    loseScreen.classList.remove('hidden');
}

function update(dt) {
    if (gameState !== 'PLAYING') return;
    gameTime += dt;
    player.speed = 380 + (upgrades.speed - 1) * 80;

    // Timer
    timeLeft -= dt;
    updateTimeDisplay();
    if (timeLeft <= 0) {
        triggerLose("Время вышло! Деревня пропиталась ужасным запахом.");
        return;
    }

    // Input collection
    let dx = 0, dy = 0;

    // Keyboard
    if (keys.w || keys.ArrowUp) { dy -= 1; player.direction = 'up'; }
    if (keys.s || keys.ArrowDown) { dy += 1; player.direction = 'down'; }
    if (keys.a || keys.ArrowLeft) { dx -= 1; player.direction = 'left'; }
    if (keys.d || keys.ArrowRight) { dx += 1; player.direction = 'right'; }

    // Joystick override
    if (joypad.active) {
        dx = joypad.x; dy = joypad.y;
        if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? 'right' : 'left';
        else player.direction = dy > 0 ? 'down' : 'up';
    }

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / length) * player.speed * dt;
        dy = (dy / length) * player.speed * dt;

        // speed up anim based on input strength (useful for analog joypad)
        player.walkAnim += 20 * dt * length;

        if (player.walkAnim - player.lastStepTime > Math.PI) {
            playSound('step'); player.lastStepTime = player.walkAnim;
            createParticles(player.x, player.y + 4, 'rgba(121, 85, 72, 0.4)', 1, 1);
        }
    } else {
        player.walkAnim = 0; player.lastStepTime = 0;
    }

    // Slide/Collide X
    if (dx !== 0 && !getCollisions(player.x + dx, player.y, player.radius)) player.x += dx;
    else if (dx !== 0) {
        const slideDy = (dy === 0) ? ((player.y % 10 < 5) ? -1 : 1) : 0;
        if (slideDy !== 0 && !getCollisions(player.x, player.y + slideDy, player.radius)) player.y += slideDy;
    }

    // Slide/Collide Y
    if (dy !== 0 && !getCollisions(player.x, player.y + dy, player.radius)) player.y += dy;
    else if (dy !== 0) {
        const slideDx = (dx === 0) ? ((player.x % 10 < 5) ? -1 : 1) : 0;
        if (slideDx !== 0 && !getCollisions(player.x + slideDx, player.y, player.radius)) player.x += slideDx;
    }

    // Camera follow loosely
    const targX = player.x - camera.width / 2;
    const targY = player.y - camera.height / 2;
    camera.x += (targX - camera.x) * (dt * 6);
    camera.y += (targY - camera.y) * (dt * 6);
    if (camera.x < 0) camera.x = 0; if (camera.y < 0) camera.y = 0;
    if (camera.x > mapWidth - camera.width) camera.x = mapWidth - camera.width;
    if (camera.y > mapHeight - camera.height) camera.y = mapHeight - camera.height;

    // Interactions (Hold E to install)
    if (keys.e || keys[' ']) {
        for (const prob of problems) {
            if (!prob.fixed && Math.hypot(player.x - prob.x, player.y - prob.y) < 65) {
                const reqTime = 0.6 / (1 + (upgrades.install - 1) * 0.4);
                prob.installTimer += dt;

                // Sparks while installing
                if (Math.random() < 0.2) createParticles(prob.x, prob.y, '#FFD54F', 1, 3);

                if (prob.installTimer >= reqTime) {
                    prob.fixed = true;
                    score++; scoreEl.innerText = score;
                    updateSmellMeter();
                    playSound('fix');
                    setTimeout(() => playSound('cash'), 400); // delay cash sound slightly

                    createParticles(prob.x, prob.y - 10, '#4CAF50', 50, 15, true);
                    createParticles(prob.x, prob.y - 10, '#FFF', 20, 8); // white flash

                    // Money Reward
                    const payment = 75000 + Math.floor(Math.random() * 15) * 5000;
                    spawnRewardPopup(prob.x, prob.y, payment);

                    if (score >= problems.length) {
                        keys.e = false; keys[' '] = false;
                        if (currentLevel < maxLevels) setTimeout(completeLevel, 1500);
                        else setTimeout(winGame, 1500);
                    }
                }
                break; // Only interact with one at a time
            }
        }
    }

    // Passive updates & Dog Updates
    problems.forEach(p => {
        if (!p.fixed) {
            // SMELL particles (brown/greenish small bubbles)
            if (Math.random() < 0.05) {
                const px = p.x + (Math.random() - 0.5) * 20; const py = p.y - 15 + (Math.random() - 0.5) * 5;
                createParticles(px, py, 'rgba(139, 69, 19, 0.4)', 1, 3);
                createParticles(px, py, 'rgba(104, 159, 56, 0.5)', 1, 2); // green stink vibe
            }
            // Reset timer if player moves away or stops holding E
            if (!(keys.e || keys[' ']) || Math.hypot(player.x - p.x, player.y - p.y) >= 65) {
                p.installTimer = 0;
            }
        }
    });

    dogs.forEach(d => {
        d.anim += 15 * dt * (Math.abs(d.vx) + Math.abs(d.vy)) / 100;

        // Agro check
        const inYard = player.x >= d.minX && player.x <= d.maxX && player.y >= d.minY && player.y <= d.maxY;

        if (inYard) {
            if (d.state !== 'agro') {
                d.state = 'agro';
                d.recentBark = 1.0; // Show bark alert for 1 second
                playSound('bark'); // Assuming bark is either gracefully ignored or exists
            }
            if (d.recentBark > 0) d.recentBark -= dt;

            // Move toward player
            const angle = Math.atan2(player.y - d.y, player.x - d.x);
            d.vx = Math.cos(angle) * 250;
            d.vy = Math.sin(angle) * 250;

            // Bite
            if (Math.hypot(player.x - d.x, player.y - d.y) < 20) {
                const dmg = Math.floor(15000 * dt);
                if (money >= dmg) {
                    money -= dmg;
                    moneyEl.innerText = money;
                    d.barkTimer += dt;
                    if (d.barkTimer > 0.4) {
                        spawnFloatingPenalty(player.x, player.y - 30, `-${dmg} ₽`);
                        d.barkTimer = 0;
                    }
                }
            }
        } else {
            if (d.state === 'agro') {
                d.state = 'patrol';
                d.timer = 0;
            }
            // Patrol wander
            d.timer -= dt;
            if (d.timer <= 0) {
                d.timer = 1 + Math.random();
                d.vx = (Math.random() - 0.5) * 100;
                d.vy = (Math.random() - 0.5) * 100;
            }
        }

        // Move & Clamp
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < d.minX) { d.x = d.minX; d.vx *= -1; }
        if (d.x > d.maxX) { d.x = d.maxX; d.vx *= -1; }
        if (d.y < d.minY) { d.y = d.minY; d.vy *= -1; }
        if (d.y > d.maxY) { d.y = d.maxY; d.vy *= -1; }
    });

    // Update screen pos for DOM rewards
    for (let i = rewardsQueue.length - 1; i >= 0; i--) {
        const r = rewardsQueue[i];
        r.life -= dt;
        if (r.life <= 0) {
            if (r.el.parentNode) r.el.parentNode.removeChild(r.el);
            rewardsQueue.splice(i, 1);
        } else {
            const screenX = r.wx - camera.x;
            const screenY = r.wy - camera.y;
            r.el.style.left = screenX + 'px';
            r.el.style.top = screenY + 'px';
        }
    }

    updateParticles(dt);
    updateTrucks(dt);
    updateNPCs(dt);
}

function spawnFloatingPenalty(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-penalty';
    el.innerText = text;
    document.body.appendChild(el);
    rewardsQueue.push({ el, wx: x, wy: y, life: 1 });
}

// ----- Drawing Engine (Canvas Rendering) -----

// Draw Base Roads (same logic, refactored for brevity)
function drawRoads(ctx) {
    ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 100; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(30, ROAD_Y); ctx.lineTo(mapWidth - 30, ROAD_Y); ctx.stroke();
    ctx.strokeStyle = '#A1887F'; ctx.lineWidth = 86; ctx.stroke();

    // Line strips / detail
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 4; ctx.setLineDash([20, 30]);
    ctx.beginPath(); ctx.moveTo(60, ROAD_Y); ctx.lineTo(mapWidth - 60, ROAD_Y); ctx.stroke(); ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(109, 76, 65, 0.15)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(30, ROAD_Y - 22); ctx.lineTo(mapWidth - 30, ROAD_Y - 22);
    ctx.moveTo(30, ROAD_Y + 22); ctx.lineTo(mapWidth - 30, ROAD_Y + 22); ctx.stroke();

    houses.forEach(h => {
        const hx = h.yardX + h.yardWidth / 2 + h.pathOffset, hy = h.yardY + h.yardHeight;
        ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(hx, hy - 10); ctx.lineTo(hx, ROAD_Y); ctx.stroke();
        ctx.strokeStyle = '#A1887F'; ctx.lineWidth = 36; ctx.stroke();
        ctx.strokeStyle = 'rgba(109, 76, 65, 0.15)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(hx - 8, hy - 10); ctx.lineTo(hx - 8, ROAD_Y); ctx.moveTo(hx + 8, hy - 10); ctx.lineTo(hx + 8, ROAD_Y); ctx.stroke();
    });
}

function drawYard(ctx, h) {
    ctx.fillStyle = '#7CB342'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(h.yardX, h.yardY, h.yardWidth, h.yardHeight, 15); else ctx.fillRect(h.yardX, h.yardY, h.yardWidth, h.yardHeight); ctx.fill();
    ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 4; ctx.strokeRect(h.yardX, h.yardY, h.yardWidth, h.yardHeight);

    const gapCenter = h.yardX + h.yardWidth / 2 + h.pathOffset;
    ctx.fillStyle = '#7CB342'; ctx.fillRect(gapCenter - 25, h.yardY + h.yardHeight - 5, 50, 10);

    const doorX = h.houseX + h.w / 2, doorY = h.houseY + h.d;
    ctx.fillStyle = '#BCAAA4'; let py = doorY + 10;
    while (py < h.yardY + h.yardHeight) {
        const px = doorX + (gapCenter - doorX) * ((py - doorY) / (h.yardY + h.yardHeight - doorY));
        ctx.beginPath(); ctx.ellipse(px, py, 12, 6, Math.random() * 0.5, 0, Math.PI * 2); ctx.fill(); py += 18;
    }
}

function drawHouse(ctx, h) {
    const { houseX: x, houseY: y, w, d, z, colorFront, colorRoof } = h;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + w / 2 + 10, y + d - 5, w * 0.55, d * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeColor(colorFront, -20); ctx.fillRect(x, y - z, w, d + z);
    ctx.fillStyle = colorFront; ctx.fillRect(x, y + d - z, w, z);

    ctx.fillStyle = '#64B5F6'; ctx.fillRect(x + 12, y + d - z + 18, 16, 22); ctx.fillRect(x + w - 28, y + d - z + 18, 16, 22);
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3; ctx.strokeRect(x + 12, y + d - z + 18, 16, 22); ctx.strokeRect(x + w - 28, y + d - z + 18, 16, 22);

    const dw = 22, dh = 32, dx = x + w / 2 - dw / 2, dy = y + d - dh;
    ctx.fillStyle = '#5D4037'; ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.arc(dx + dw - 5, dy + dh / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeColor(colorRoof, -10); ctx.beginPath(); ctx.moveTo(dx - 5, dy - 5); ctx.lineTo(dx + dw + 5, dy - 5); ctx.lineTo(dx + dw + 2, dy - 12); ctx.lineTo(dx - 2, dy - 12); ctx.fill();

    const rx = x - 10, ry = y - z - 5, rw = w + 20, rd = d + 15, ridgeY = ry + rd / 2.5;
    ctx.fillStyle = colorRoof; ctx.beginPath(); ctx.moveTo(rx, ry + rd); ctx.lineTo(rx + rw, ry + rd); ctx.lineTo(rx + rw - 24, ridgeY); ctx.lineTo(rx + 24, ridgeY); ctx.fill();
    ctx.fillStyle = shadeColor(colorRoof, -35); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw - 24, ridgeY); ctx.lineTo(rx + 24, ridgeY); ctx.fill();
    ctx.fillStyle = shadeColor(colorRoof, -15); ctx.beginPath(); ctx.moveTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + rd); ctx.lineTo(rx + rw - 24, ridgeY); ctx.fill();
    ctx.fillStyle = shadeColor(colorRoof, 10); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + rd); ctx.lineTo(rx + 24, ridgeY); ctx.fill();
}

function drawPyramid(ctx, p) {
    const floatY = Math.sin(gameTime * 4 + p.animOffset) * 6, dY = p.y + floatY;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, p.size * 1.2 * (1 - (floatY + 6) / 20), p.size * 0.6 * (1 - (floatY + 6) / 20), 0, 0, Math.PI * 2); ctx.fill();

    // Stink wave effect
    ctx.strokeStyle = `rgba(104, 159, 56, ${0.3 + Math.sin(gameTime * 6) * 0.2})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, p.size * 1.8, p.size * 0.9, 0, 0, Math.PI * 2); ctx.stroke();

    const h = p.size * 1.6, tX = p.x, tY = dY - h, blX = p.x - p.size, blY = dY + p.size * 0.4, brX = p.x + p.size, brY = dY + p.size * 0.4, cX = p.x, cY = dY + p.size;
    ctx.fillStyle = '#D84315'; ctx.beginPath(); ctx.moveTo(tX, tY); ctx.lineTo(blX, blY); ctx.lineTo(cX, cY); ctx.fill();
    ctx.fillStyle = '#BF360C'; ctx.beginPath(); ctx.moveTo(tX, tY); ctx.lineTo(cX, cY); ctx.lineTo(brX, brY); ctx.fill();
    ctx.strokeStyle = '#5A1B04'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(tX, tY); ctx.lineTo(cX, cY); ctx.stroke(); ctx.beginPath(); ctx.moveTo(blX, blY); ctx.lineTo(cX, cY); ctx.lineTo(brX, brY); ctx.stroke();
}

function drawSepticTank(ctx, p) {
    let scale = 1;
    if (p.installTimer < 0.4) {
        const t = p.installTimer / 0.4; scale = Math.sin((t * Math.PI * (0.2 + 2.5 * t ** 3)) + Math.PI / 2) * (1 - t) + t;
        scale = 1 + Math.sin(t * Math.PI) * 0.3;
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 4, p.size * 1.3, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6D4C41'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 2, p.size * 1.2, p.size * 0.6, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#78909C'; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.9, p.size * 0.45, 0, 0, Math.PI * 2); ctx.ellipse(0, -8, p.size * 0.9, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#B0BEC5'; ctx.beginPath(); ctx.ellipse(0, -8, p.size * 0.9, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.ellipse(0, -9, p.size * 0.6, p.size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.ellipse(0, -11, p.size * 0.65, p.size * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#558B2F'; ctx.beginPath(); ctx.arc(10, -13, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00FF00'; ctx.beginPath(); ctx.arc(10, -14, 1.5, 0, Math.PI * 2); ctx.fill(); // glow
    ctx.restore();
}

function drawLabel(ctx, p) {
    if (!p.fixed || p.installTimer < 0.2) return;
    const alpha = Math.min(1, (p.installTimer - 0.2) / 0.5);
    ctx.save(); ctx.translate(p.x, p.y - 40 - (alpha * 15)); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-70, -20, 140, 40, 8); else ctx.fillRect(-70, -20, 140, 40); ctx.fill();
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '600 11px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText("Установлен", 0, -8);
    ctx.fillStyle = '#10b981'; ctx.font = '800 13px Poppins, sans-serif'; ctx.fillText(p.labelName, 0, 8);
    ctx.restore();
}

function drawTruck(ctx, tr) {
    ctx.save();
    const bounceY = Math.abs(Math.sin(gameTime * 15 + tr.x)) * 3;
    ctx.translate(tr.x, tr.y - bounceY);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 18 + bounceY, 55, 14, 0, 0, Math.PI * 2); ctx.fill();
    if (tr.direction === 'left') ctx.scale(-1, 1);

    // Hazard warning ring (red glowing oval under truck)
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + Math.sin(gameTime * 10) * 0.3})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 15, 60, 20, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(-30, 14, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(30, 14, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#424242'; ctx.fillRect(-45, 2, 90, 10);

    // Danger colored tank! Or traditional green? Make it striped hazard? Let's make it distinct orange/green
    ctx.fillStyle = '#EF6C00'; ctx.beginPath(); ctx.ellipse(-15, -5, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF9800'; ctx.beginPath(); ctx.ellipse(-15, -8, 30, 15, 0, 0, Math.PI * 2); ctx.fill();
    // Stripe
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-15, -23); ctx.lineTo(-15, 13); ctx.stroke();

    ctx.fillStyle = '#EEEEEE'; ctx.beginPath(); ctx.moveTo(20, 2); ctx.lineTo(45, 2); ctx.lineTo(43, -12); ctx.lineTo(30, -18); ctx.lineTo(20, -18); ctx.fill();
    ctx.fillStyle = '#29B6F6'; ctx.beginPath(); ctx.moveTo(30, -3); ctx.lineTo(42, -3); ctx.lineTo(40, -10); ctx.lineTo(30, -14); ctx.fill();

    // Headlights
    ctx.fillStyle = '#FFF59D'; ctx.beginPath(); ctx.arc(45, -2, 4, 0, Math.PI * 2); ctx.fill();
    // Light beam
    ctx.fillStyle = 'rgba(255, 235, 59, 0.2)'; ctx.beginPath(); ctx.moveTo(48, -2); ctx.lineTo(200, 40); ctx.lineTo(200, -40); ctx.fill();
    ctx.restore();
}

function drawCharacters(ctx, p, isNPC) {
    const bounce = Math.abs(Math.sin(p.anim || p.walkAnim)) * 3;
    const legSwing = Math.sin(p.anim || p.walkAnim) * 6;
    const armSwing = Math.cos(p.anim || p.walkAnim) * 5;

    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, -bounce);

    // Worker specific colors vs NPC random colors
    const skin = '#FFE0B2';
    const bodyC = isNPC ? p.color : '#1976D2'; // blue overalls
    const shirtC = isNPC ? shadeColor(p.color, 40) : '#FFEB3B'; // yellow or light variant
    const hairHatC = isNPC ? '#5D4037' : '#FFC107'; // brown hair or yellow hardhat

    const drawLeftArm = () => { ctx.strokeStyle = skin; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(-10, -8 + armSwing); ctx.stroke(); ctx.strokeStyle = shirtC; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(-7, -12 + armSwing * 0.5); ctx.stroke(); };
    const drawRightArm = () => { ctx.strokeStyle = skin; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(10, -8 - armSwing); ctx.stroke(); ctx.strokeStyle = shirtC; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(7, -12 - armSwing * 0.5); ctx.stroke(); };
    const drawLegs = () => { ctx.strokeStyle = '#37474F'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(-3, 3 + legSwing); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(3, 3 - legSwing); ctx.stroke(); ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(-3, 4 + legSwing, 4, 3, 0, 0, Math.PI * 2); ctx.ellipse(3, 4 - legSwing, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); };
    const drawBody = () => { ctx.fillStyle = bodyC; ctx.fillRect(-6, -18, 12, 14); if (!isNPC) { ctx.fillStyle = shirtC; ctx.fillRect(-6, -20, 12, 6); ctx.fillStyle = '#1565C0'; ctx.fillRect(-5, -20, 2, 5); ctx.fillRect(3, -20, 2, 5); } else { ctx.fillStyle = shirtC; ctx.fillRect(-6, -20, 12, 8); } };
    const drawHead = () => {
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -24, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3E2723';
        if (p.direction === 'down' || isNPC) { ctx.beginPath(); ctx.arc(-2.5, -25, 1, 0, Math.PI * 2); ctx.arc(2.5, -25, 1, 0, Math.PI * 2); ctx.fill(); }
        else if (p.direction === 'left') { ctx.beginPath(); ctx.arc(-4, -25, 1, 0, Math.PI * 2); ctx.fill(); }
        else if (p.direction === 'right') { ctx.beginPath(); ctx.arc(4, -25, 1, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = hairHatC;
        if (isNPC) { ctx.beginPath(); ctx.arc(0, -26, 7.5, Math.PI, Math.PI * 2); ctx.fill(); } // hair
        else { ctx.beginPath(); ctx.arc(0, -26, 8, Math.PI, Math.PI * 2); ctx.ellipse(0, -26, 10, 3, 0, 0, Math.PI * 2); ctx.fill(); } // hardhat
    };

    let dir = p.direction; if (isNPC) dir = p.vx < 0 ? 'left' : (p.vx > 0 ? 'right' : 'down');

    if (dir === 'up') { drawLeftArm(); drawRightArm(); drawLegs(); drawBody(); drawHead(); ctx.fillStyle = hairHatC; ctx.beginPath(); ctx.arc(0, -24, 7.5, 0, Math.PI * 2); ctx.fill(); }
    else if (dir === 'left') { drawRightArm(); drawLegs(); drawBody(); drawHead(); drawLeftArm(); }
    else if (dir === 'right') { drawLeftArm(); drawLegs(); drawBody(); drawHead(); drawRightArm(); }
    else { drawLeftArm(); drawRightArm(); drawLegs(); drawBody(); drawHead(); }

    ctx.restore();
}

function drawDog(ctx, dog) {
    ctx.save();
    ctx.translate(dog.x, dog.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 4, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Try to determine direction
    let scaleX = 1;
    if (dog.vx < 0) scaleX = -1;
    ctx.scale(scaleX, 1);

    const bounce = Math.abs(Math.sin(dog.anim)) * 3;
    ctx.translate(0, -bounce);

    // Body
    ctx.fillStyle = '#8D6E63'; // Brown dog
    ctx.beginPath(); ctx.roundRect(-8, -10, 16, 12, 4); ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(10, -12, 6, 0, Math.PI * 2); ctx.fill();
    // Ear
    ctx.fillStyle = '#5D4037';
    ctx.beginPath(); ctx.arc(8, -16, 3, 0, Math.PI * 2); ctx.fill();
    // Nose
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(15, -12, 2, 0, Math.PI * 2); ctx.fill();
    // Legs
    ctx.fillStyle = '#795548';
    const leg1 = Math.sin(dog.anim) * 3, leg2 = Math.cos(dog.anim) * 3;
    ctx.fillRect(-6 + leg1, 2, 3, 6);
    ctx.fillRect(4 - leg1, 2, 3, 6);

    // Bark Alert Effect (!)
    if (dog.recentBark > 0) {
        ctx.scale(scaleX, 1); // unscale to draw text normally
        ctx.fillStyle = 'red';
        ctx.font = 'bold 18px Poppins';
        ctx.textAlign = 'center';
        ctx.fillText('! ВУФ !', 0, -25);
    }

    ctx.restore();
}

function drawParticles() {
    ctx.save();
    particles.forEach(p => {
        ctx.globalAlpha = p.life > 0 ? p.life : 0;
        ctx.fillStyle = p.color;
        if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 10; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        if (p.glow) ctx.shadowBlur = 0;
    });
    ctx.restore();
}

function drawMinimap() {
    mctx.fillStyle = '#689F38'; mctx.fillRect(0, 0, MM_W, MM_H);
    const scaleX = MM_W / mapWidth, scaleY = MM_H / mapHeight;
    mctx.strokeStyle = '#8D6E63'; mctx.lineWidth = 4; mctx.beginPath(); mctx.moveTo(0, ROAD_Y * scaleY); mctx.lineTo(MM_W, ROAD_Y * scaleY); mctx.stroke();

    houses.forEach((h, idx) => {
        mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo((h.yardX + h.yardWidth / 2) * scaleX, (h.yardY + h.yardHeight) * scaleY); mctx.lineTo((h.yardX + h.yardWidth / 2) * scaleX, ROAD_Y * scaleY); mctx.stroke();
        mctx.fillStyle = '#7CB342'; mctx.fillRect(h.yardX * scaleX, h.yardY * scaleY, h.yardWidth * scaleX, h.yardHeight * scaleY);
        mctx.fillStyle = h.colorFront; mctx.fillRect(h.houseX * scaleX, h.houseY * scaleY, h.w * scaleX, h.d * scaleY);
        const prob = problems[idx]; mctx.fillStyle = prob.fixed ? '#10b981' : '#ef4444';
        mctx.beginPath(); mctx.arc(prob.x * scaleX, prob.y * scaleY, 3, 0, Math.PI * 2); mctx.fill();
    });

    trucks.forEach(t => { mctx.fillStyle = '#F57C00'; mctx.beginPath(); mctx.arc(t.x * scaleX, t.y * scaleY, 4, 0, Math.PI * 2); mctx.fill(); });
    mctx.fillStyle = '#FFEB3B'; mctx.beginPath(); mctx.arc(player.x * scaleX, player.y * scaleY, 5, 0, Math.PI * 2); mctx.fill(); mctx.strokeStyle = '#000'; mctx.lineWidth = 1; mctx.stroke();
}

function draw() {
    ctx.fillStyle = '#8BC34A'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(-camera.x, -camera.y);

    ctx.fillStyle = 'rgba(104, 159, 56, 0.4)';
    for (let i = 0; i < Math.floor(mapWidth / 200); i++) for (let j = 0; j < Math.floor(mapHeight / 200); j++) { ctx.beginPath(); ctx.ellipse(i * 200 + (j % 2) * 100, j * 200 + 50, 60, 20, 0, 0, Math.PI * 2); ctx.fill(); }

    drawRoads(ctx); houses.forEach(h => drawYard(ctx, h));

    const renderList = [];
    trucks.forEach(tr => renderList.push({ type: 'truck', y: tr.y + 10, obj: tr }));
    houses.forEach(h => renderList.push({ type: 'house', y: h.houseY + h.d, obj: h }));
    problems.forEach(p => renderList.push({ type: 'problem', y: p.y, obj: p }));
    npcs.forEach(n => renderList.push({ type: 'npc', y: n.y, obj: n }));
    dogs.forEach(d => renderList.push({ type: 'dog', y: d.y, obj: d }));
    renderList.push({ type: 'player', y: player.y, obj: player });
    trees.forEach(t => renderList.push({ type: 'tree', y: t.y, obj: t }));

    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach(item => {
        if (item.type === 'tree') { const t = item.obj; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.size, t.size); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(4, 6, 26, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4E342E'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(4, -30); ctx.lineTo(-4, -30); ctx.fill(); ctx.fillStyle = '#1B5E20'; ctx.beginPath(); ctx.arc(-15, -31, 20, 0, Math.PI * 2); ctx.arc(15, -36, 22, 0, Math.PI * 2); ctx.arc(0, -55, 26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#388E3C'; ctx.beginPath(); ctx.arc(-15, -35, 20, 0, Math.PI * 2); ctx.arc(15, -40, 22, 0, Math.PI * 2); ctx.arc(0, -59, 26, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        else if (item.type === 'house') drawHouse(ctx, item.obj);
        else if (item.type === 'player') drawCharacters(ctx, item.obj, false);
        else if (item.type === 'npc') drawCharacters(ctx, item.obj, true);
        else if (item.type === 'dog') drawDog(ctx, item.obj);
        else if (item.type === 'truck') drawTruck(ctx, item.obj);
        else if (item.type === 'problem') {
            if (item.obj.fixed) drawSepticTank(ctx, item.obj);
            else {
                drawPyramid(ctx, item.obj);
                if (Math.hypot(player.x - item.obj.x, player.y - item.obj.y) < 65) {
                    ctx.save(); const bx = item.obj.x - 16, by = item.obj.y - 70 + Math.sin(gameTime * 5) * 4;
                    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, 32, 32, 8); else ctx.fillRect(bx, by, 32, 32); ctx.fill();
                    ctx.shadowColor = 'transparent'; ctx.fillStyle = '#1e293b'; ctx.font = 'bold 18px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('E', item.obj.x, by + 16);

                    // Draw Progress ring
                    if (item.obj.installTimer > 0) {
                        const reqTime = 0.6 / (1 + (upgrades.install - 1) * 0.4);
                        const pct = Math.min(1, item.obj.installTimer / reqTime);
                        ctx.beginPath(); ctx.arc(item.obj.x, by + 16, 20, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
                        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
                    }
                    ctx.restore();
                }
            }
        }
    });

    renderList.forEach(item => { if (item.type === 'problem') drawLabel(ctx, item.obj); });
    drawParticles();

    ctx.restore();
    drawMinimap();
}

function gameLoop() {
    const now = performance.now();
    let dt = (now - lastFrameTime) / 1000;

    // Cap dt strongly - if tab loses focus or initial lag occurs, don't let physics explode
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.016; // default 60fps fallback if very fast

    lastFrameTime = now;

    update(dt);
    draw();
    if (gameState === 'PLAYING') animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
    currentLevel = 1;
    startNextLevel();
}

function startNextLevel() {
    audioCtx.resume();
    startScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    loseScreen.classList.add('hidden');
    levelScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    initLevel();
    gameState = 'PLAYING';

    resize();
    updateMobileControlsVisibility();
    requestAnimationFrame(() => {
        resize();
        updateMobileControlsVisibility();
    });
    setTimeout(() => {
        resize();
        updateMobileControlsVisibility();
    }, 100);
    setTimeout(() => {
        resize();
        updateMobileControlsVisibility();
    }, 300);

    lastFrameTime = performance.now();
    gameLoop();
}

function completeLevel() {
    gameState = 'LEVEL_WIN';
    playSound('win');
    hud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    levelScreen.classList.remove('hidden');

    lsMoney.innerText = money;
    const m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
    lsTime.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    updateShopUI();
}

function updateShopUI() {
    const sBtn = document.getElementById('btn-upg-speed');
    const tBtn = document.getElementById('btn-upg-time');
    const iBtn = document.getElementById('btn-upg-install');

    const setBtn = (btn, type) => {
        const lvl = upgrades[type];
        btn.querySelector('span:first-of-type').innerText = lvl;
        if (lvl >= 4) {
            btn.disabled = true;
            btn.querySelector('.price-tag').innerText = "МАКС.";
        } else {
            const cost = upgCosts[type][lvl - 1];
            btn.querySelector('.price-tag').innerText = `${cost / 1000}k ₽`;
            btn.disabled = money < cost;
        }
    };
    setBtn(sBtn, 'speed'); setBtn(tBtn, 'time'); setBtn(iBtn, 'install');
}

window.buyUpgrade = function (type) {
    const lvl = upgrades[type];
    if (lvl >= 4) return;
    const cost = upgCosts[type][lvl - 1];
    if (money >= cost) {
        money -= cost;
        upgrades[type]++;
        playSound('cash');
        lsMoney.innerText = money;
        updateShopUI();
    }
}

function winGame() {
    gameState = 'WIN';
    playSound('win');
    hud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    winScreen.classList.remove('hidden');

    wsScore.innerText = score;
    wsMoney.innerText = money;
    const m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
    wsTime.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
nextLevelBtn.addEventListener('click', () => {
    if (currentLevel >= maxLevels) {
        winGame();
    } else {
        currentLevel++;
        startNextLevel();
    }
});

resize();
drawMinimap();
window.addEventListener("orientationchange", resize);