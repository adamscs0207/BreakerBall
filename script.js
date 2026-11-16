
// ============================================================
// FULL COURT BREAKER
// PERFORMANCE OPTIMIZED EDITION
// ============================================================

// ------------------------------------------------------------
// CANVAS AND HTML ELEMENTS
// ------------------------------------------------------------

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const $ = id => document.getElementById(id);

const scoreDisplay = $("score");
const highScoreDisplay = $("highScore");
const levelDisplay = $("level");
const livesDisplay = $("lives");
const gameStatus = $("gameStatus");
const comboDisplay = $("comboDisplay");
const overlay = $("overlay");
const overlayTitle = $("overlayTitle");
const overlayMessage = $("overlayMessage");
const startButton = $("startButton");
const pauseButton = $("pauseButton");
const soundButton = $("soundButton");
const announcement = $("announcement");
const powerupStatus = $("powerupStatus");

const WIDTH = 1000;
const HEIGHT = 650;

// ------------------------------------------------------------
// PERFORMANCE SETTINGS
// ------------------------------------------------------------

const MAX_PARTICLES = 220;
const MAX_FLOATING_TEXTS = 35;
const MAX_BALLS = 4;

const PARTICLE_LIFETIME = 900;
const POWER_DURATION = 15000;

// Cache the court so it only needs to be drawn once.
const courtCanvas = document.createElement("canvas");
courtCanvas.width = WIDTH;
courtCanvas.height = HEIGHT;

const courtCtx = courtCanvas.getContext("2d");

// ------------------------------------------------------------
// GAME STATE
// ------------------------------------------------------------

let score = 0;
let highScore = Number(localStorage.getItem("fullCourtHighScore")) || 0;
let level = 1;
let lives = 3;
let combo = 1;

let running = false;
let paused = false;
let gameOver = false;
let soundEnabled = true;

let animationId = null;
let lastTime = 0;
let lastUIUpdate = 0;
let announcementTimer = null;

let audioContext = null;

highScoreDisplay.textContent = String(highScore).padStart(6, "0");

// ------------------------------------------------------------
// GAME OBJECTS
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

const keys = {
    left: false,
    right: false
};

// ------------------------------------------------------------
// POWER-UP TRACKING
// ------------------------------------------------------------

let hotHandHits = 0;
let multiballHits = 0;
let consecutiveHits = 0;

const activePowers = {
    hotHand: 0,
    bigMan: 0,
    doublePoints: 0
};

// ------------------------------------------------------------
// AUDIO
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

        gain.gain.setValueAtTime(0.07, audioContext.currentTime);
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
// ANNOUNCEMENTS
// ------------------------------------------------------------

function announce(message) {
    announcement.textContent = message;
    announcement.classList.remove("show");

    void announcement.offsetWidth;

    announcement.classList.add("show");

    clearTimeout(announcementTimer);

    announcementTimer = setTimeout(() => {
        announcement.classList.remove("show");
    }, 1500);
}

// ------------------------------------------------------------
// BALL CREATION
// ------------------------------------------------------------

function createBall(x, y, vx, vy) {
    return {
        x,
        y,
        vx,
        vy,
        radius: 17,
        rotation: 0,
        trail: [],
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
// BASKETBALL DRAWING
// ------------------------------------------------------------

function drawBasketball(ball) {
    const r = ball.radius;

    ctx.save();

    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    // Ball shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";

    ctx.beginPath();
    ctx.ellipse(5, r + 5, r * 1.05, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Orange leather surface
    const gradient = ctx.createRadialGradient(
        -r * 0.4, -r * 0.5, 1,
        0, 0, r * 1.3
    );

    gradient.addColorStop(0, "#ffbd69");
    gradient.addColorStop(0.35, "#f58a32");
    gradient.addColorStop(0.75, "#d65c19");
    gradient.addColorStop(1, "#81300d");

    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Clip the seams and texture inside the ball.
    ctx.save();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    ctx.clip();

    // Lightweight leather texture.
    for (let i = 0; i < 35; i++) {
        const angle = i * 2.399;
        const distance = Math.sqrt(i / 35) * r * 0.9;

        ctx.fillStyle = i % 2 === 0
            ? "rgba(255,210,145,0.14)"
            : "rgba(80,30,8,0.12)";

        ctx.beginPath();
        ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            0.55,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    // Traditional basketball channels.
    ctx.strokeStyle = "#392015";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Vertical curved seam.
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(
        -r * 0.48, -r * 0.35,
        -r * 0.48, r * 0.35,
        0, r
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(
        r * 0.48, -r * 0.35,
        r * 0.48, r * 0.35,
        0, r
    );
    ctx.stroke();

    // Horizontal curved seam.
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(
        -r * 0.35, -r * 0.48,
        r * 0.35, -r * 0.48,
        r, 0
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(
        -r * 0.35, r * 0.48,
        r * 0.35, r * 0.48,
        r, 0
    );
    ctx.stroke();

    ctx.restore();

    // Spherical lighting.
    const shine = ctx.createRadialGradient(
        -r * 0.45, -r * 0.5, 0,
        -r * 0.2, -r * 0.2, r * 1.2
    );

    shine.addColorStop(0, "rgba(255,255,255,0.28)");
    shine.addColorStop(0.35, "rgba(255,255,255,0.06)");
    shine.addColorStop(1, "rgba(0,0,0,0.24)");

    ctx.fillStyle = shine;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer edge.
    ctx.strokeStyle = "rgba(70,28,9,0.65)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// ------------------------------------------------------------
// BASKETBALL COURT
// This is cached instead of redrawn every frame.
// ------------------------------------------------------------

function drawHoop(c, x, y) {
    c.save();

    // Backboard
    c.fillStyle = "rgba(245,245,245,0.85)";
    c.fillRect(x - 15, y - 35, 30, 65);

    c.strokeStyle = "#ffffff";
    c.lineWidth = 3;
    c.strokeRect(x - 15, y - 35, 30, 65);

    // Rim
    c.strokeStyle = "#ff6030";
    c.lineWidth = 7;

    c.beginPath();
    c.ellipse(x, y + 30, 25, 8, 0, 0, Math.PI * 2);
    c.stroke();

    // Net
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

    c.restore();
}

function drawCourt(c = ctx) {

    // Main wooden floor.
    const wood = c.createLinearGradient(0, 0, 0, HEIGHT);

    wood.addColorStop(0, "#c88b52");
    wood.addColorStop(0.5, "#b77740");
    wood.addColorStop(1, "#92552e");

    c.fillStyle = wood;
    c.fillRect(0, 0, WIDTH, HEIGHT);

    // Wooden planks.
    const plankHeight = 48;

    for (let row = 0; row < 14; row++) {
        const y = row * plankHeight;
        const offset = row % 2 === 0 ? 0 : 85;

        for (let col = -1; col < 7; col++) {
            const x = col * 170 + offset;

            c.fillStyle = (row + col) % 2 === 0
                ? "rgba(255,205,145,0.10)"
                : "rgba(75,36,14,0.09)";

            c.fillRect(x, y, 170, plankHeight);

            c.strokeStyle = "rgba(83,43,20,0.18)";
            c.lineWidth = 2;
            c.strokeRect(x, y, 170, plankHeight);

            // Wood grain.
            c.strokeStyle = "rgba(255,224,180,0.09)";
            c.lineWidth = 1;

            for (let grain = 0; grain < 3; grain++) {
                c.beginPath();
                c.moveTo(x + 15, y + 10 + grain * 13);

                c.bezierCurveTo(
                    x + 65, y + 7 + grain * 13,
                    x + 110, y + 15 + grain * 13,
                    x + 155, y + 10 + grain * 13
                );

                c.stroke();
            }
        }
    }

    // Court lighting.
    const lighting = c.createLinearGradient(0, 0, 0, HEIGHT);

    lighting.addColorStop(0, "rgba(255,255,255,0.12)");
    lighting.addColorStop(1, "rgba(0,0,0,0.16)");

    c.fillStyle = lighting;
    c.fillRect(0, 0, WIDTH, HEIGHT);

    // Court markings.
    c.save();

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
    c.arc(
        WIDTH / 2,
        HEIGHT + 5,
        300,
        Math.PI + 0.18,
        -0.18
    );
    c.stroke();

    c.fillStyle = "rgba(255,244,220,0.85)";
    c.beginPath();
    c.arc(WIDTH / 2, HEIGHT / 2, 5, 0, Math.PI * 2);
    c.fill();

    c.font = "bold 55px Arial";
    c.textAlign = "center";
    c.fillStyle = "rgba(255,255,255,0.075)";
    c.fillText("FULL COURT", WIDTH / 2, HEIGHT / 2 + 20);

    c.restore();

    drawHoop(c, 50, 95);
    drawHoop(c, WIDTH - 50, 95);
}

// Build the static court one time.
drawCourt(courtCtx);

// ------------------------------------------------------------
// BRICKS
// ------------------------------------------------------------

function createBricks() {
    bricks = [];

    const rows = Math.min(4 + level, 7);
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

            if (Math.random() < 0.07) continue;

            const golden = Math.random() < 0.055;
            const hits = golden ? 1 : (row >= 3 ? 2 : 1);

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
}

function drawBricks() {
    for (const brick of bricks) {
        if (!brick.alive) continue;

        ctx.save();

        ctx.fillStyle = "rgba(0,0,0,0.3)";
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

        ctx.strokeStyle = "rgba(255,255,255,0.5)";
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
            ctx.fillStyle = "white";
            ctx.font = "bold 13px Arial";

            ctx.fillText(
                brick.hits,
                brick.x + brick.width - 10,
                brick.y + 12
            );
        }

        ctx.restore();
    }
}

// ------------------------------------------------------------
// PADDLE
// ------------------------------------------------------------

function drawPaddle() {
    ctx.save();

    ctx.shadowColor = "#ff762f";
    ctx.shadowBlur = 12;

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

    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(
        paddle.x + 12,
        paddle.y + 3,
        paddle.width - 24,
        2
    );

    ctx.restore();
}

// ------------------------------------------------------------
// PARTICLES
// ------------------------------------------------------------

function createParticles(x, y, color, amount = 12) {

    const available = MAX_PARTICLES - particles.length;
    const count = Math.min(amount, available);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 5 + 2,
            color,
            life: 1
        });
    }
}

function updateParticles(delta) {
    const step = delta / 16.67;

    for (const p of particles) {
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.life -= delta / PARTICLE_LIFETIME;
        p.vy += 0.04 * step;
    }

    particles = particles.filter(p => p.life > 0);
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
// FLOATING SCORE TEXT
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
    const step = delta / 16.67;

    for (const t of floatingTexts) {
        t.y -= step;
        t.life -= delta / 850;
    }

    floatingTexts = floatingTexts.filter(t => t.life > 0);
}

function drawFloatingTexts() {
    for (const t of floatingTexts) {
        ctx.globalAlpha = t.life;
        ctx.fillStyle = t.color;
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
    }

    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// SCORE
// ------------------------------------------------------------

function updateScore(points) {

    const multiplier = activePowers.doublePoints > 0 ? 2 : 1;

    score += points * combo * multiplier;

    if (score > highScore) {
        highScore = score;

        try {
            localStorage.setItem("fullCourtHighScore", highScore);
        } catch (error) {
            // Storage is optional.
        }

        highScoreDisplay.textContent =
            String(highScore).padStart(6, "0");
    }

    scoreDisplay.textContent = String(score).padStart(6, "0");
}

// ------------------------------------------------------------
// POWER-UP DISPLAY
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
            : "FIND THE GOLDEN TARGET";

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
// POWER-UP DROPS
// ------------------------------------------------------------

function dropPowerup(x, y, type) {

    // Prevent an excessive number of falling power-ups.
    if (powerups.length >= 8) return;

    powerups.push({
        x,
        y,
        type,
        size: 15,
        speed: 2.5
    });
}

function drawPowerups() {

    const icons = {
        fire: "🔥",
        multi: "🏀",
        wide: "💪",
        double: "💎"
    };

    for (const p of powerups) {
        ctx.save();

        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 10;

        ctx.font = "27px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(icons[p.type], p.x, p.y);

        ctx.restore();
    }
}

function updatePowerups(delta) {
    const step = delta / 16.67;

    for (const p of powerups) {
        p.y += p.speed * step;

        if (
            p.y + p.size > paddle.y &&
            p.y - p.size < paddle.y + paddle.height &&
            p.x > paddle.x &&
            p.x < paddle.x + paddle.width
        ) {
            activatePowerup(p.type);
            p.collected = true;
        }
    }

    powerups = powerups.filter(
        p => !p.collected && p.y < HEIGHT + 30
    );
}

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

            while (
                newBalls.length &&
                balls.length < MAX_BALLS
            ) {
                balls.push(newBalls.shift());
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
// BRICK COLLISIONS
// ------------------------------------------------------------

function hitBrick(ball, brick) {

    brick.hits--;

    ball.vy *= -1;

    createParticles(
        brick.x + brick.width / 2,
        brick.y + brick.height / 2,
        brick.color,
        10
    );

    combo = Math.min(combo + 1, 10);

    consecutiveHits++;
    multiballHits++;

    const points = brick.golden ? 250 : 100;

    updateScore(points);

    addFloatingText(
        brick.x + brick.width / 2,
        brick.y,
        "+" + points,
        "#fff0a0"
    );

    if (brick.hits <= 0) {

        brick.alive = false;

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

    if (combo >= 5) {
        comboDisplay.textContent = "COMBO x" + combo;
    }
}

// ------------------------------------------------------------
// BALL PHYSICS
// ------------------------------------------------------------

function updateBalls(delta) {

    const step = delta / 16.67;

    for (const ball of balls) {

        // Keep a short trail.
        ball.trail.push({
            x: ball.x,
            y: ball.y
        });

        if (ball.trail.length > 6) {
            ball.trail.shift();
        }

        ball.x += ball.vx * step;
        ball.y += ball.vy * step;

        ball.rotation += ball.vx * 0.018 * step;

        // Side walls.
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
        }

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

        // Brick collision.
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

    balls = balls.filter(ball => !ball.lost);

    // All balls have fallen.
    if (balls.length === 0) {

        lives--;

        combo = 1;
        consecutiveHits = 0;

        livesDisplay.textContent =
            "🏀 ".repeat(Math.max(0, lives));

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
// BALL DRAWING
// ------------------------------------------------------------

function drawBalls() {

    for (const ball of balls) {

        for (let i = 0; i < ball.trail.length; i++) {
            const point = ball.trail[i];

            ctx.globalAlpha =
                (i / ball.trail.length) * 0.15;

            ctx.fillStyle = "#ffb15b";

            ctx.beginPath();
            ctx.arc(
                point.x,
                point.y,
                ball.radius * 0.6,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        if (activePowers.hotHand > 0) {
            ctx.save();
            ctx.shadowColor = "#ff5522";
            ctx.shadowBlur = 15;
            drawBasketball(ball);
            ctx.restore();
        } else {
            drawBasketball(ball);
        }
    }
}

// ------------------------------------------------------------
// PADDLE MOVEMENT
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
// INPUT CONTROLS
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

        if (!running && !paused && !gameOver) {
            startGame();
        } else if (running) {
            togglePause();
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
// LEVEL SYSTEM
// ------------------------------------------------------------

function nextLevel() {

    level++;

    levelDisplay.textContent =
        String(level).padStart(2, "0");

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
// POWER-UP TIMERS
// Timers now use milliseconds rather than frame counts.
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
// GAME DRAWING
// ------------------------------------------------------------

function drawGame() {

    // Reuse the already-created court image.
    ctx.drawImage(courtCanvas, 0, 0);

    drawBricks();
    drawPaddle();
    drawPowerups();
    drawParticles();
    drawFloatingTexts();
    drawBalls();
}

// ------------------------------------------------------------
// GAME UPDATE
// ------------------------------------------------------------

function updateGame(delta) {

    updatePaddle(delta);
    updateBalls(delta);
    updatePowerups(delta);
    updateParticles(delta);
    updateFloatingTexts(delta);

    const timerChanged = updatePowerTimers(delta);

    // Only check for a new level when necessary.
    if (bricks.length && bricks.every(brick => !brick.alive)) {
        nextLevel();
    }

    // Update the HTML less frequently.
    const now = performance.now();

    if (timerChanged || now - lastUIUpdate > 200) {
        updatePowerupProgress();
        lastUIUpdate = now;
    }
}

// ------------------------------------------------------------
// GAME LOOP
// ------------------------------------------------------------

function gameLoop(timestamp) {

    if (!running || paused) {
        animationId = null;
        return;
    }

    // Limit unusually large frame jumps.
    const delta = Math.min(
        Math.max(timestamp - lastTime, 0),
        32
    );

    lastTime = timestamp;

    updateGame(delta);
    drawGame();

    // Only schedule another frame during active gameplay.
    if (running && !paused) {
        animationId = requestAnimationFrame(gameLoop);
    } else {
        animationId = null;
    }
}

// ------------------------------------------------------------
// START GAME
// ------------------------------------------------------------

function startGame() {

    if (running) return;

    if (gameOver) {

        score = 0;
        level = 1;
        lives = 3;
        combo = 1;

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

        gameOver = false;
    }

    running = true;
    paused = false;

    lastTime = performance.now();

    overlay.classList.add("hidden");

    gameStatus.textContent = "LIVE GAME";

    scoreDisplay.textContent =
        String(score).padStart(6, "0");

    levelDisplay.textContent =
        String(level).padStart(2, "0");

    livesDisplay.textContent = "🏀 🏀 🏀";

    pauseButton.textContent = "Ⅱ PAUSE";

    startButton.textContent = "▶ START GAME";

    announce("🏀 TIP-OFF!");

    // Never create a second animation loop.
    if (animationId === null) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// ------------------------------------------------------------
// PAUSE GAME
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

        overlayTitle.textContent = "TIMEOUT!";

        overlayMessage.textContent =
            "Take a breather. The court will be waiting.";

        startButton.textContent = "▶ RESUME GAME";

        drawGame();

    } else if (paused) {

        paused = false;
        running = true;

        lastTime = performance.now();

        overlay.classList.add("hidden");

        gameStatus.textContent = "LIVE GAME";
        pauseButton.textContent = "Ⅱ PAUSE";

        if (animationId === null) {
            animationId = requestAnimationFrame(gameLoop);
        }
    }
}

// ------------------------------------------------------------
// END GAME
// ------------------------------------------------------------

function endGame() {

    running = false;
    paused = false;
    gameOver = true;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    gameStatus.textContent = "GAME OVER";

    overlay.classList.remove("hidden");

    overlayTitle.textContent = "BUZZER BEATER... NOT!";

    overlayMessage.textContent =
        "Final Score: " + score +
        " | You reached Level " + level +
        ". Get back on the court and try again!";

    startButton.textContent = "▶ PLAY AGAIN";

    pauseButton.textContent = "Ⅱ PAUSE";

    announce("GAME OVER!");

    playSound(120, 0.6, "sawtooth");

    drawGame();
}

// ------------------------------------------------------------
// BUTTONS
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
// INITIALIZE GAME
// ------------------------------------------------------------

function initializeGame() {

    createBricks();
    resetBall();

    scoreDisplay.textContent = "000000";

    highScoreDisplay.textContent =
        String(highScore).padStart(6, "0");

    levelDisplay.textContent = "01";
    livesDisplay.textContent = "🏀 🏀 🏀";

    gameStatus.textContent = "WAITING FOR TIP-OFF";

    updatePowerupProgress();

    // Draw the opening screen once.
    drawGame();

    // No animation loop runs until the player starts.
}

initializeGame();

// ============================================================
// END OF FULL COURT BREAKER
// ============================================================
