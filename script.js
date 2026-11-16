
// ============================================================
// FULL COURT BREAKER
// Optimized basketball brick-breaker game
// ============================================================

// ------------------------------------------------------------
// 1. HTML ELEMENTS AND CANVAS
// ------------------------------------------------------------

const $ = id => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const WIDTH = 1000;
const HEIGHT = 650;

const scoreDisplay = $("score");
const highScoreDisplay = $("highScore");
const rankDisplay = $("rankDisplay");
const levelDisplay = $("level");
const livesDisplay = $("lives");
const comboDisplay = $("comboDisplay");
const clockDisplay = $("clockDisplay");
const modeLabel = $("modeLabel");
const gameStatus = $("gameStatus");

const overlay = $("overlay");
const overlayTitle = $("overlayTitle");
const overlayMessage = $("overlayMessage");
const overlayKicker = $("overlayKicker");
const startButton = $("startButton");
const pauseButton = $("pauseButton");
const soundButton = $("soundButton");
const announcement = $("announcement");
const powerupStatus = $("powerupStatus");

// ------------------------------------------------------------
// 2. GAME SETTINGS
// ------------------------------------------------------------

const MAX_PARTICLES = 100;
const MAX_FLOATING_TEXTS = 18;
const MAX_BALLS = 4;
const POWER_DURATION = 15000;

const MODES = {
    arcade: {
        label: "ARCADE",
        lives: 3,
        time: 0,
        description: "Classic basketball brick breaker. Clear every round and keep climbing."
    },
    shotclock: {
        label: "SHOT CLOCK",
        lives: 3,
        time: 60,
        description: "You have 60 seconds. Score as many points as possible before the clock expires."
    },
    threepoint: {
        label: "3-POINT",
        lives: 3,
        time: 0,
        description: "Golden targets are worth triple points. Aim for the gold!"
    },
    championship: {
        label: "FINALS",
        lives: 2,
        time: 0,
        description: "The championship is tough. Targets take extra hits and you only get two lives."
    }
};

let selectedMode = "arcade";

let score = 0;
let highScore = 0;
let level = 1;
let lives = 3;
let combo = 1;

let running = false;
let paused = false;
let gameOver = false;
let soundEnabled = true;

let remainingTime = 0;
let animationId = null;
let lastTime = 0;
let lastUIUpdate = 0;
let announcementTimer = null;

let audioContext = null;

try {
    highScore = Number(localStorage.getItem("fullCourtHighScore")) || 0;
} catch (error) {
    highScore = 0;
}

// ------------------------------------------------------------
// 3. GAME OBJECTS
// ------------------------------------------------------------

const paddle = {
    x: WIDTH / 2 - 90,
    y: 610,
    width: 180,
    height: 16,
    speed: 9
};

let balls = [];
let bricks = [];
let particles = [];
let powerups = [];
let floatingTexts = [];

let remainingBricks = 0;

const keys = {
    left: false,
    right: false
};

// Power-up progress.
let hotHandHits = 0;
let multiballHits = 0;
let consecutiveHits = 0;

const activePowers = {
    hotHand: 0,
    bigMan: 0,
    doublePoints: 0
};

// ------------------------------------------------------------
// 4. AUDIO
// ------------------------------------------------------------

function playSound(frequency = 400, duration = 0.08, type = "sine") {
    if (!soundEnabled) return;

    try {
        if (!audioContext) {
            audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.06, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        // Audio is optional.
    }
}

// ------------------------------------------------------------
// 5. ANNOUNCEMENTS
// ------------------------------------------------------------

function announce(message) {
    announcement.textContent = message;
    announcement.classList.remove("show");

    // Restart the announcement animation.
    void announcement.offsetWidth;

    announcement.classList.add("show");

    clearTimeout(announcementTimer);

    announcementTimer = setTimeout(() => {
        announcement.classList.remove("show");
    }, 1500);
}

// ------------------------------------------------------------
// 6. BALL CREATION
// ------------------------------------------------------------

// The trail uses fixed-size arrays instead of creating new objects
// every frame. This helps reduce unnecessary memory usage.

function createBall(x, y, vx, vy) {
    return {
        x,
        y,
        vx,
        vy,
        radius: 17,
        rotation: 0,
        trailX: new Float32Array(5),
        trailY: new Float32Array(5),
        trailCount: 0,
        trailIndex: 0,
        lost: false
    };
}

function resetBall() {
    balls = [
        createBall(
            WIDTH / 2,
            565,
            4 * (Math.random() > 0.5 ? 1 : -1),
            -6
        )
    ];
}

// ------------------------------------------------------------
// 7. BASKETBALL DRAWING
// ------------------------------------------------------------

function drawBasketball(ball) {
    const r = ball.radius;

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    // Ball shadow.
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(4, r + 5, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Orange basketball surface.
    const gradient = ctx.createRadialGradient(
        -r * 0.4, -r * 0.5, 1,
        0, 0, r * 1.3
    );

    gradient.addColorStop(0, "#ffca7c");
    gradient.addColorStop(0.35, "#f58a32");
    gradient.addColorStop(0.75, "#d65c19");
    gradient.addColorStop(1, "#81300d");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Keep the basketball seams inside the ball.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    ctx.clip();

    // Basketball texture.
    for (let i = 0; i < 18; i++) {
        const angle = i * 2.399;
        const distance = Math.sqrt(i / 18) * r * 0.9;

        ctx.fillStyle = "rgba(75,30,8,0.18)";
        ctx.beginPath();
        ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            0.7,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    // Traditional curved basketball seams.
    ctx.strokeStyle = "#392015";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(-r * 0.48, -r * 0.35, -r * 0.48, r * 0.35, 0, r);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.48, -r * 0.35, r * 0.48, r * 0.35, 0, r);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r * 0.35, -r * 0.48, r * 0.35, -r * 0.48, r, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r * 0.35, r * 0.48, r * 0.35, r * 0.48, r, 0);
    ctx.stroke();

    ctx.restore();

    // Ball highlight.
    const shine = ctx.createRadialGradient(
        -r * 0.4, -r * 0.5, 0,
        -r * 0.2, -r * 0.2, r * 1.2
    );

    shine.addColorStop(0, "rgba(255,255,255,0.3)");
    shine.addColorStop(0.4, "rgba(255,255,255,0.05)");
    shine.addColorStop(1, "rgba(0,0,0,0.2)");

    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(70,28,9,0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// ------------------------------------------------------------
// 8. BASKETBALL COURT
// ------------------------------------------------------------

// The court is drawn once and stored in another canvas.
// It does not need to be redrawn from scratch every frame.

const courtCanvas = document.createElement("canvas");
courtCanvas.width = WIDTH;
courtCanvas.height = HEIGHT;

const courtCtx = courtCanvas.getContext("2d");

function drawHoop(c, x, y) {
    c.fillStyle = "rgba(245,245,245,0.85)";
    c.fillRect(x - 15, y - 35, 30, 65);

    c.strokeStyle = "#ffffff";
    c.lineWidth = 3;
    c.strokeRect(x - 15, y - 35, 30, 65);

    c.strokeStyle = "#ff6030";
    c.lineWidth = 7;

    c.beginPath();
    c.ellipse(x, y + 30, 25, 8, 0, 0, Math.PI * 2);
    c.stroke();

    c.strokeStyle = "rgba(255,255,255,0.65)";
    c.lineWidth = 1.5;

    for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(x + i * 10, y + 35);
        c.lineTo(x + i * 6, y + 72);
        c.stroke();
    }

    c.beginPath();
    c.moveTo(x - 20, y + 48);
    c.lineTo(x + 20, y + 48);
    c.stroke();
}

function drawCourt(c) {
    const wood = c.createLinearGradient(0, 0, 0, HEIGHT);

    wood.addColorStop(0, "#c88b52");
    wood.addColorStop(0.5, "#b77740");
    wood.addColorStop(1, "#92552e");

    c.fillStyle = wood;
    c.fillRect(0, 0, WIDTH, HEIGHT);

    // Floorboards.
    for (let row = 0; row < 14; row++) {
        const y = row * 48;
        const offset = row % 2 === 0 ? 0 : 85;

        for (let col = -1; col < 7; col++) {
            const x = col * 170 + offset;

            c.fillStyle = (row + col) % 2 === 0
                ? "rgba(255,205,145,0.10)"
                : "rgba(75,36,14,0.09)";

            c.fillRect(x, y, 170, 48);

            c.strokeStyle = "rgba(83,43,20,0.18)";
            c.lineWidth = 2;
            c.strokeRect(x, y, 170, 48);
        }
    }

    const lighting = c.createLinearGradient(0, 0, 0, HEIGHT);
    lighting.addColorStop(0, "rgba(255,255,255,0.12)");
    lighting.addColorStop(1, "rgba(0,0,0,0.16)");

    c.fillStyle = lighting;
    c.fillRect(0, 0, WIDTH, HEIGHT);

    // Court markings.
    c.strokeStyle = "rgba(255,239,205,0.75)";
    c.lineWidth = 4;

    c.strokeRect(22, 12, WIDTH - 44, HEIGHT - 24);

    c.beginPath();
    c.moveTo(WIDTH / 2, 12);
    c.lineTo(WIDTH / 2, HEIGHT - 12);
    c.stroke();

    c.beginPath();
    c.arc(WIDTH / 2, HEIGHT / 2, 84, 0, Math.PI * 2);
    c.stroke();

    c.strokeRect(330, 12, 340, 180);
    c.strokeRect(330, HEIGHT - 192, 340, 180);

    c.beginPath();
    c.arc(WIDTH / 2, 192, 65, 0, Math.PI);
    c.stroke();

    c.beginPath();
    c.arc(WIDTH / 2, HEIGHT - 192, 65, Math.PI, 0);
    c.stroke();

    c.beginPath();
    c.arc(WIDTH / 2, -5, 300, 0.18, Math.PI - 0.18);
    c.stroke();

    c.beginPath();
    c.arc(WIDTH / 2, HEIGHT + 5, 300, Math.PI + 0.18, -0.18);
    c.stroke();

    c.fillStyle = "rgba(255,244,220,0.85)";
    c.beginPath();
    c.arc(WIDTH / 2, HEIGHT / 2, 5, 0, Math.PI * 2);
    c.fill();

    c.font = "bold 55px Arial";
    c.textAlign = "center";
    c.fillStyle = "rgba(255,255,255,0.075)";
    c.fillText("FULL COURT", WIDTH / 2, HEIGHT / 2 + 20);

    drawHoop(c, 50, 95);
    drawHoop(c, WIDTH - 50, 95);
}

drawCourt(courtCtx);

// ------------------------------------------------------------
// 9. BRICKS / TARGETS
// ------------------------------------------------------------

function createBricks() {
    bricks = [];

    let rows = Math.min(4 + level, 7);

    if (selectedMode === "championship") {
        rows = Math.min(5 + level, 8);
    }

    const columns = 10;
    const brickWidth = 88;
    const brickHeight = 34;
    const gap = 12;

    const totalWidth = columns * (brickWidth + gap) - gap;
    const startX = (WIDTH - totalWidth) / 2;

    const colors = [
        "#e94c40",
        "#f29432",
        "#32a6d2",
        "#8296d0",
        "#25ad79",
        "#e8b83c"
    ];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            if (Math.random() < 0.05) continue;

            const golden = Math.random() < 0.09;

            let hits = row >= 3 ? 2 : 1;

            if (selectedMode === "championship") {
                hits = 2 + (row >= 4 ? 1 : 0);
            }

            if (golden) hits = 1;

            bricks.push({
                x: startX + col * (brickWidth + gap),
                y: 45 + row * 43,
                width: brickWidth,
                height: brickHeight,
                hits,
                color: golden ? "#f5c84c" : colors[row % colors.length],
                golden,
                alive: true
            });
        }
    }

    remainingBricks = bricks.length;
}

function drawBricks() {
    for (const brick of bricks) {
        if (!brick.alive) continue;

        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(
            brick.x + 4,
            brick.y + 6,
            brick.width,
            brick.height
        );

        const gradient = ctx.createLinearGradient(
            brick.x,
            brick.y,
            brick.x,
            brick.y + brick.height
        );

        gradient.addColorStop(0, brick.color);
        gradient.addColorStop(1, "#713b27");

        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.roundRect(
            brick.x,
            brick.y,
            brick.width,
            brick.height,
            8
        );
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(brick.x + 8, brick.y + 5);
        ctx.lineTo(brick.x + brick.width - 8, brick.y + 5);
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "23px Arial";

        ctx.fillText(
            brick.golden ? "★" : "🏀",
            brick.x + brick.width / 2,
            brick.y + brick.height / 2 + 1
        );

        if (brick.hits > 1) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 13px Arial";
            ctx.fillText(
                brick.hits,
                brick.x + brick.width - 10,
                brick.y + 12
            );
        }
    }
}

// ------------------------------------------------------------
// 10. PADDLE
// ------------------------------------------------------------

function drawPaddle() {
    const gradient = ctx.createLinearGradient(
        paddle.x,
        paddle.y,
        paddle.x,
        paddle.y + paddle.height
    );

    gradient.addColorStop(0, "#ffbd70");
    gradient.addColorStop(0.5, "#ff782f");
    gradient.addColorStop(1, "#c9481d");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(
        paddle.x,
        paddle.y,
        paddle.width,
        paddle.height,
        12
    );
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(
        paddle.x + 12,
        paddle.y + 3,
        paddle.width - 24,
        2
    );
}

// ------------------------------------------------------------
// 11. PARTICLES
// ------------------------------------------------------------

function createParticles(x, y, color, amount = 8) {
    const count = Math.min(
        amount,
        MAX_PARTICLES - particles.length
    );

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 4 + 2,
            color,
            life: 1
        });
    }
}

function updateParticles(delta) {
    const step = delta / 16.67;
    let writeIndex = 0;

    // Compact the array in place instead of making a new array.
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx * step;
        p.y += p.vy * step;
        p.life -= delta / 850;
        p.vy += 0.04 * step;

        if (p.life > 0) {
            particles[writeIndex++] = p;
        }
    }

    particles.length = writeIndex;
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// 12. FLOATING SCORE TEXT
// ------------------------------------------------------------

function addFloatingText(x, y, text, color = "#ffffff") {
    if (floatingTexts.length >= MAX_FLOATING_TEXTS) {
        floatingTexts.shift();
    }

    floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1
    });
}

function updateFloatingTexts(delta) {
    let writeIndex = 0;

    for (let i = 0; i < floatingTexts.length; i++) {
        const item = floatingTexts[i];

        item.y -= delta / 16.67;
        item.life -= delta / 850;

        if (item.life > 0) {
            floatingTexts[writeIndex++] = item;
        }
    }

    floatingTexts.length = writeIndex;
}

function drawFloatingTexts() {
    for (const item of floatingTexts) {
        ctx.globalAlpha = item.life;
        ctx.fillStyle = item.color;
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(item.text, item.x, item.y);
    }

    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// 13. SCORE AND RANK
// ------------------------------------------------------------

function updateRank() {
    let rank = "ROOKIE";

    if (score >= 5000) rank = "ALL-STAR";
    if (score >= 15000) rank = "MVP";
    if (score >= 30000) rank = "LEGEND";

    rankDisplay.textContent = rank;
}

function updateScore(points) {
    const multiplier = activePowers.doublePoints > 0 ? 2 : 1;

    score += points * combo * multiplier;

    scoreDisplay.textContent = String(score).padStart(6, "0");

    if (score > highScore) {
        highScore = score;

        try {
            localStorage.setItem("fullCourtHighScore", highScore);
        } catch (error) {
            // Saving a high score is optional.
        }

        highScoreDisplay.textContent = String(highScore).padStart(6, "0");
    }

    updateRank();
}

// ------------------------------------------------------------
// 14. POWER-UP DISPLAY
// ------------------------------------------------------------

function updatePowerupProgress() {
    $("fireProgress").style.width =
        Math.min(hotHandHits / 3 * 100, 100) + "%";

    $("fireText").textContent =
        `${Math.min(hotHandHits, 3)} / 3 ACCURATE HITS`;

    $("multiProgress").style.width =
        Math.min(multiballHits / 5 * 100, 100) + "%";

    $("multiText").textContent =
        `${Math.min(multiballHits, 5)} / 5 TARGETS`;

    $("doubleProgress").style.width =
        Math.min(consecutiveHits / 10 * 100, 100) + "%";

    $("doubleText").textContent =
        `${Math.min(consecutiveHits, 10)} / 10 TARGETS`;

    $("wideProgress").style.width =
        activePowers.bigMan > 0 ? "100%" : "0%";

    $("wideText").textContent =
        activePowers.bigMan > 0
            ? "BIG MAN ACTIVE!"
            : "FIND THE GOLD TARGET";

    $("fireCard").classList.toggle(
        "unlocked",
        activePowers.hotHand > 0
    );

    $("multiCard").classList.toggle(
        "unlocked",
        balls.length > 1
    );

    $("wideCard").classList.toggle(
        "unlocked",
        activePowers.bigMan > 0
    );

    $("doubleCard").classList.toggle(
        "unlocked",
        activePowers.doublePoints > 0
    );

    const active = [];

    if (activePowers.hotHand > 0) active.push("HOT HAND");
    if (balls.length > 1) active.push("MULTIBALL");
    if (activePowers.bigMan > 0) active.push("BIG MAN");
    if (activePowers.doublePoints > 0) active.push("DOUBLE POINTS");

    powerupStatus.textContent = active.length
        ? "ACTIVE: " + active.join(" • ")
        : "NO ACTIVE POWER-UPS";
}

// ------------------------------------------------------------
// 15. POWER-UP DROPS
// ------------------------------------------------------------

function dropPowerup(x, y, type) {
    if (powerups.length >= 6) return;

    powerups.push({
        x,
        y,
        type,
        size: 15,
        speed: 2.5,
        collected: false
    });
}

function drawPowerups() {
    const icons = {
        fire: "🔥",
        multi: "🏀",
        wide: "💪",
        double: "💎"
    };

    ctx.font = "27px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const p of powerups) {
        ctx.fillText(icons[p.type], p.x, p.y);
    }
}

function updatePowerups(delta) {
    const step = delta / 16.67;
    let writeIndex = 0;

    for (let i = 0; i < powerups.length; i++) {
        const p = powerups[i];

        p.y += p.speed * step;

        const caught =
            p.y + p.size > paddle.y &&
            p.y - p.size < paddle.y + paddle.height &&
            p.x > paddle.x &&
            p.x < paddle.x + paddle.width;

        if (caught) {
            activatePowerup(p.type);
            continue;
        }

        if (p.y < HEIGHT + 30) {
            powerups[writeIndex++] = p;
        }
    }

    powerups.length = writeIndex;
}

// ------------------------------------------------------------
// 16. ACTIVATE POWER-UPS
// ------------------------------------------------------------

function activatePowerup(type) {
    playSound(850, 0.2, "sine");

    if (type === "fire") {
        activePowers.hotHand = POWER_DURATION;
        announce("🔥 HOT HAND!");
    }

    if (type === "multi") {
        const original = balls[0];

        if (original) {
            const newBalls = [
                createBall(
                    original.x,
                    original.y,
                    -original.vx,
                    original.vy
                ),
                createBall(
                    original.x,
                    original.y,
                    original.vx * 0.7,
                    -original.vy
                )
            ];

            for (const ball of newBalls) {
                if (balls.length < MAX_BALLS) {
                    balls.push(ball);
                }
            }
        }

        announce("🏀 MULTIBALL!");
    }

    if (type === "wide") {
        activePowers.bigMan = POWER_DURATION;
        paddle.width = 260;
        announce("💪 BIG MAN!");
    }

    if (type === "double") {
        activePowers.doublePoints = POWER_DURATION;
        announce("💎 DOUBLE POINTS!");
    }

    updatePowerupProgress();
}

// ------------------------------------------------------------
// 17. BRICK COLLISIONS
// ------------------------------------------------------------

function hitBrick(ball, brick) {
    // Reverse the ball's vertical direction.
    ball.vy *= -1;

    brick.hits--;

    createParticles(
        brick.x + brick.width / 2,
        brick.y + brick.height / 2,
        brick.color,
        8
    );

    combo = Math.min(combo + 1, 10);
    comboDisplay.textContent = "x" + combo;

    consecutiveHits++;
    multiballHits++;

    // 3-Point mode gives golden targets a larger bonus.
    let points = brick.golden ? 250 : 100;

    if (selectedMode === "threepoint" && brick.golden) {
        points = 750;
    }

    updateScore(points);

    addFloatingText(
        brick.x + brick.width / 2,
        brick.y,
        "+" + points,
        brick.golden ? "#fff0a0" : "#ffffff"
    );

    if (brick.hits <= 0) {
        brick.alive = false;
        remainingBricks--;

        playSound(550 + Math.random() * 200, 0.08, "triangle");

        if (brick.golden) {
            dropPowerup(
                brick.x + brick.width / 2,
                brick.y,
                "wide"
            );
        }

        if (multiballHits >= 5) {
            dropPowerup(ball.x, ball.y, "multi");
            multiballHits = 0;
        }

        if (consecutiveHits >= 10) {
            dropPowerup(ball.x, ball.y, "double");
            consecutiveHits = 0;
        }

        updatePowerupProgress();
    }

    if (combo >= 5 && combo % 5 === 0) {
        announce("🔥 COMBO x" + combo + "!");
    }
}

// ------------------------------------------------------------
// 18. BALL PHYSICS
// ------------------------------------------------------------

function updateBalls(delta) {
    const step = delta / 16.67;

    for (const ball of balls) {
        // Save a few old positions for the trail.
        if (Math.floor(performance.now() / 35) !== ball.lastTrailTime) {
            ball.lastTrailTime = Math.floor(performance.now() / 35);

            ball.trailX[ball.trailIndex] = ball.x;
            ball.trailY[ball.trailIndex] = ball.y;

            ball.trailIndex = (ball.trailIndex + 1) % 5;
            ball.trailCount = Math.min(ball.trailCount + 1, 5);
        }

        ball.x += ball.vx * step;
        ball.y += ball.vy * step;
        ball.rotation += ball.vx * 0.018 * step;

        // Left wall.
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
        }

        // Right wall.
        if (ball.x + ball.radius > WIDTH) {
            ball.x = WIDTH - ball.radius;
            ball.vx = -Math.abs(ball.vx);
        }

        // Top wall.
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
        }

        // Paddle collision.
        if (
            ball.vy > 0 &&
            ball.y + ball.radius >= paddle.y &&
            ball.y - ball.radius <= paddle.y + paddle.height &&
            ball.x >= paddle.x &&
            ball.x <= paddle.x + paddle.width
        ) {
            ball.y = paddle.y - ball.radius;

            const hitPosition =
                (ball.x - (paddle.x + paddle.width / 2)) /
                (paddle.width / 2);

            ball.vx = hitPosition * 7;

            ball.vy = -Math.sqrt(
                Math.max(25, 100 - ball.vx * ball.vx)
            );

            ball.vy = Math.max(ball.vy, -10);

            if (Math.abs(hitPosition) < 0.25) {
                hotHandHits++;

                if (
                    hotHandHits >= 3 &&
                    activePowers.hotHand <= 0
                ) {
                    dropPowerup(ball.x, ball.y, "fire");
                    hotHandHits = 0;
                    announce("🔥 HOT HAND UNLOCKED!");
                }
            }

            playSound(180, 0.1, "triangle");
            updatePowerupProgress();
        }

        // Only test bricks that are near the ball.
        // This avoids checking every brick unnecessarily.
        for (const brick of bricks) {
            if (!brick.alive) continue;

            if (
                ball.x + ball.radius > brick.x &&
                ball.x - ball.radius < brick.x + brick.width &&
                ball.y + ball.radius > brick.y &&
                ball.y - ball.radius < brick.y + brick.height
            ) {
                hitBrick(ball, brick);
                break;
            }
        }

        if (ball.y - ball.radius > HEIGHT) {
            ball.lost = true;
        }
    }

    // Remove lost balls in place.
    let writeIndex = 0;

    for (let i = 0; i < balls.length; i++) {
        if (!balls[i].lost) {
            balls[writeIndex++] = balls[i];
        }
    }

    balls.length = writeIndex;

    // All balls have fallen.
    if (balls.length === 0 && running) {
        lives--;

        combo = 1;
        consecutiveHits = 0;
        comboDisplay.textContent = "x1";

        updateLivesDisplay();
        updatePowerupProgress();

        if (lives <= 0) {
            endGame();
        } else {
            announce("NEXT POSSESSION!");
            resetBall();
        }
    }
}

// ------------------------------------------------------------
// 19. DRAW BALLS
// ------------------------------------------------------------

function drawBalls() {
    for (const ball of balls) {
        // Draw the short trail.
        for (let i = 0; i < ball.trailCount; i++) {
            const index = (ball.trailIndex - 1 - i + 5) % 5;

            ctx.globalAlpha = 0.12 * (1 - i / 5);
            ctx.fillStyle = "#ffb15b";

            ctx.beginPath();
            ctx.arc(
                ball.trailX[index],
                ball.trailY[index],
                ball.radius * 0.55,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        drawBasketball(ball);
    }
}

// ------------------------------------------------------------
// 20. PADDLE MOVEMENT
// ------------------------------------------------------------

function updatePaddle(delta) {
    const step = delta / 16.67;

    if (keys.left) {
        paddle.x -= paddle.speed * step;
    }

    if (keys.right) {
        paddle.x += paddle.speed * step;
    }

    paddle.x = Math.max(
        0,
        Math.min(WIDTH - paddle.width, paddle.x)
    );
}

function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0) return;

    const scale = WIDTH / rect.width;

    paddle.x =
        (clientX - rect.left) * scale -
        paddle.width / 2;

    paddle.x = Math.max(
        0,
        Math.min(WIDTH - paddle.width, paddle.x)
    );
}

// ------------------------------------------------------------
// 21. INPUT CONTROLS
// ------------------------------------------------------------

canvas.addEventListener("mousemove", event => {
    if (running && !paused) {
        movePaddleTo(event.clientX);
    }
});

canvas.addEventListener("touchmove", event => {
    event.preventDefault();

    if (running && !paused && event.touches.length > 0) {
        movePaddleTo(event.touches[0].clientX);
    }
}, { passive: false });

document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (key === "arrowleft" || key === "a") {
        keys.left = true;
        event.preventDefault();
    }

    if (key === "arrowright" || key === "d") {
        keys.right = true;
        event.preventDefault();
    }

    if (event.code === "Space") {
        event.preventDefault();

        if (running) {
            togglePause();
        } else if (paused) {
            togglePause();
        } else if (!gameOver) {
            startGame();
        }
    }
});

document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();

    if (key === "arrowleft" || key === "a") {
        keys.left = false;
    }

    if (key === "arrowright" || key === "d") {
        keys.right = false;
    }
});

// ------------------------------------------------------------
// 22. GAME MODES
// ------------------------------------------------------------

function selectMode(mode) {
    if (!MODES[mode] || running || paused) return;

    selectedMode = mode;

    document.querySelectorAll(".mode-card").forEach(button => {
        button.classList.toggle(
            "selected",
            button.dataset.mode === mode
        );
    });

    modeLabel.textContent = MODES[mode].label;
    overlayMessage.textContent = MODES[mode].description;

    clockDisplay.textContent = mode === "shotclock" ? "60" : "--";

    announce(MODES[mode].label + " SELECTED");
}

document.querySelectorAll(".mode-card").forEach(button => {
    button.addEventListener("click", () => {
        selectMode(button.dataset.mode);
    });
});

// ------------------------------------------------------------
// 23. LIVES DISPLAY
// ------------------------------------------------------------

function updateLivesDisplay() {
    livesDisplay.textContent =
        "🏀 ".repeat(Math.max(0, lives)) || "0";
}

// ------------------------------------------------------------
// 24. LEVEL SYSTEM
// ------------------------------------------------------------

function nextLevel() {
    level++;

    levelDisplay.textContent = String(level).padStart(2, "0");

    announce("🏆 LEVEL " + level + "!");

    createBricks();
    resetBall();

    playSound(700, 0.3, "triangle");

    paddle.width = 180;

    activePowers.bigMan = 0;
    activePowers.hotHand = 0;
    activePowers.doublePoints = 0;

    powerups = [];

    updatePowerupProgress();
}

// ------------------------------------------------------------
// 25. POWER-UP TIMERS
// ------------------------------------------------------------

function updatePowerTimers(delta) {
    let changed = false;

    for (const power of Object.keys(activePowers)) {
        if (activePowers[power] > 0) {
            activePowers[power] -= delta;

            if (activePowers[power] <= 0) {
                activePowers[power] = 0;
                changed = true;

                if (power === "bigMan") {
                    paddle.width = 180;
                }

                announce("POWER-UP EXPIRED");
            }
        }
    }

    return changed;
}

// ------------------------------------------------------------
// 26. GAME DRAWING
// ------------------------------------------------------------

function drawGame() {
    ctx.drawImage(courtCanvas, 0, 0);

    drawBricks();
    drawPaddle();
    drawPowerups();
    drawParticles();
    drawFloatingTexts();
    drawBalls();
}

// ------------------------------------------------------------
// 27. GAME UPDATE
// ------------------------------------------------------------

function updateGame(delta) {
    updatePaddle(delta);
    updateBalls(delta);
    updatePowerups(delta);
    updateParticles(delta);
    updateFloatingTexts(delta);

    const timerChanged = updatePowerTimers(delta);

    // Shot Clock mode counts down from 60 seconds.
    if (selectedMode === "shotclock") {
        remainingTime -= delta / 1000;

        if (remainingTime <= 0) {
            remainingTime = 0;
            updateClockDisplay();
            endGame("SHOT CLOCK EXPIRED!");
            return;
        }

        updateClockDisplay();
    }

    // Only check for a cleared level using the remaining target count.
    if (remainingBricks <= 0 && running) {
        nextLevel();
    }

    const now = performance.now();

    // Update HTML less frequently to reduce unnecessary work.
    if (timerChanged || now - lastUIUpdate > 200) {
        updatePowerupProgress();
        lastUIUpdate = now;
    }
}

function updateClockDisplay() {
    clockDisplay.textContent =
        selectedMode === "shotclock"
            ? Math.ceil(remainingTime)
            : "--";

    if (selectedMode === "shotclock" && remainingTime <= 10) {
        clockDisplay.style.color = "#ff704d";
    } else {
        clockDisplay.style.color = "";
    }
}

// ------------------------------------------------------------
// 28. GAME LOOP
// ------------------------------------------------------------

function gameLoop(timestamp) {
    if (!running || paused) {
        animationId = null;
        return;
    }

    // Limit frame jumps so the ball doesn't teleport after lag.
    const delta = Math.min(
        Math.max(timestamp - lastTime, 0),
        32
    );

    lastTime = timestamp;

    updateGame(delta);
    drawGame();

    if (running && !paused) {
        animationId = requestAnimationFrame(gameLoop);
    } else {
        animationId = null;
    }
}

// ------------------------------------------------------------
// 29. RESET GAME
// ------------------------------------------------------------

function resetGame() {
    score = 0;
    level = 1;
    lives = MODES[selectedMode].lives;
    combo = 1;

    remainingTime = MODES[selectedMode].time;

    hotHandHits = 0;
    multiballHits = 0;
    consecutiveHits = 0;

    activePowers.hotHand = 0;
    activePowers.bigMan = 0;
    activePowers.doublePoints = 0;

    particles = [];
    powerups = [];
    floatingTexts = [];

    paddle.width = 180;
    paddle.x = WIDTH / 2 - paddle.width / 2;

    createBricks();
    resetBall();

    scoreDisplay.textContent = "000000";
    levelDisplay.textContent = "01";
    comboDisplay.textContent = "x1";

    updateLivesDisplay();
    updateClockDisplay();
    updatePowerupProgress();
    updateRank();
}

// ------------------------------------------------------------
// 30. START GAME
// ------------------------------------------------------------

function startGame() {
    if (running) return;

    if (gameOver) {
        resetGame();
        gameOver = false;
    }

    if (!paused && !gameOver && score === 0 && level === 1) {
        // Use the selected mode's starting lives and clock.
        lives = MODES[selectedMode].lives;
        remainingTime = MODES[selectedMode].time;
        updateLivesDisplay();
        updateClockDisplay();
    }

    running = true;
    paused = false;

    lastTime = performance.now();

    overlay.classList.add("hidden");

    gameStatus.textContent = "LIVE GAME";
    modeLabel.textContent = MODES[selectedMode].label;

    startButton.textContent = "▶ START GAME";
    pauseButton.textContent = "Ⅱ PAUSE";

    announce("🏀 TIP-OFF!");

    if (animationId === null) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// ------------------------------------------------------------
// 31. PAUSE GAME
// ------------------------------------------------------------

function togglePause() {
    if (gameOver) return;

    if (running) {
        paused = true;
        running = false;

        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        gameStatus.textContent = "GAME PAUSED";
        pauseButton.textContent = "▶ RESUME";

        overlay.classList.remove("hidden");

        overlayKicker.textContent = "TIMEOUT";
        overlayTitle.textContent = "TIMEOUT!";
        overlayMessage.textContent =
            "Take a breather. The court will be waiting.";

        startButton.textContent = "▶ RESUME GAME";

        // Hide mode choices while paused.
        $("modePicker").style.display = "none";

        drawGame();
    } else if (paused) {
        paused = false;
        running = true;

        overlay.classList.add("hidden");
        $("modePicker").style.display = "";

        lastTime = performance.now();

        gameStatus.textContent = "LIVE GAME";
        pauseButton.textContent = "Ⅱ PAUSE";

        if (animationId === null) {
            animationId = requestAnimationFrame(gameLoop);
        }
    }
}

// ------------------------------------------------------------
// 32. END GAME
// ------------------------------------------------------------

function endGame(message = "GAME OVER!") {
    running = false;
    paused = false;
    gameOver = true;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    gameStatus.textContent = "GAME OVER";

    overlay.classList.remove("hidden");
    $("modePicker").style.display = "";

    overlayKicker.textContent = "FINAL BUZZER";
    overlayTitle.textContent = message;

    overlayMessage.textContent =
        "Final Score: " + score +
        " | You reached Level " + level +
        ". Choose a mode and get back on the court!";

    startButton.textContent = "▶ PLAY AGAIN";
    pauseButton.textContent = "Ⅱ PAUSE";

    announce("GAME OVER!");
    playSound(120, 0.6, "sawtooth");

    drawGame();
}

// ------------------------------------------------------------
// 33. BUTTONS
// ------------------------------------------------------------

startButton.addEventListener("click", () => {
    if (paused) {
        togglePause();
    } else {
        startGame();
    }
});

pauseButton.addEventListener("click", togglePause);

soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundButton.textContent = soundEnabled
        ? "🔊 SOUND ON"
        : "🔇 SOUND OFF";

    if (soundEnabled) {
        playSound(500, 0.1);
    }
});

// ------------------------------------------------------------
// 34. INITIALIZE GAME
// ------------------------------------------------------------

function initializeGame() {
    createBricks();
    resetBall();

    scoreDisplay.textContent = "000000";
    highScoreDisplay.textContent = String(highScore).padStart(6, "0");

    levelDisplay.textContent = "01";
    comboDisplay.textContent = "x1";

    selectMode("arcade");
    updateLivesDisplay();
    updateClockDisplay();
    updatePowerupProgress();
    updateRank();

    gameStatus.textContent = "WAITING FOR TIP-OFF";

    // Draw the opening screen once.
    // The animation loop only starts when the player presses TIP OFF.
    drawGame();
}

initializeGame();

// ============================================================
// END OF FULL COURT BREAKER
// ============================================================
