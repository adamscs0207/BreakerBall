
// ============================================================
// FULL COURT BREAKER
// Complete JavaScript Game
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ------------------------------------------------------------
// HTML ELEMENTS
// ------------------------------------------------------------

const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("highScore");
const levelDisplay = document.getElementById("level");
const livesDisplay = document.getElementById("lives");
const gameStatus = document.getElementById("gameStatus");
const comboDisplay = document.getElementById("comboDisplay");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const soundButton = document.getElementById("soundButton");
const announcement = document.getElementById("announcement");
const powerupStatus = document.getElementById("powerupStatus");

// ------------------------------------------------------------
// GAME SETTINGS
// ------------------------------------------------------------

const WIDTH = 1000;
const HEIGHT = 650;

let score = 0;
let highScore = Number(localStorage.getItem("fullCourtHighScore")) || 0;
let level = 1;
let lives = 3;
let combo = 1;

let running = false;
let paused = false;
let gameOver = false;
let soundEnabled = true;

let animationId;
let lastTime = 0;
let announcementTimer;

highScoreDisplay.textContent = highScore.toString().padStart(6, "0");

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

let activePowers = {
    hotHand: 0,
    bigMan: 0,
    doublePoints: 0
};

// ------------------------------------------------------------
// AUDIO
// ------------------------------------------------------------

let audioContext;

function playSound(frequency = 400, duration = 0.08, type = "sine") {
    if (!soundEnabled) return;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        // The game can still run if audio is unavailable.
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
// BASKETBALL CREATION
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
        fire: false
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
// REALISTIC BASKETBALL DRAWING
// ------------------------------------------------------------

function drawBasketball(ball) {

    const r = ball.radius;

    ctx.save();

    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    // Ball shadow
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(5, r + 5, r * 1.05, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer ball shape
    const ballGradient = ctx.createRadialGradient(
        -r * 0.4,
        -r * 0.5,
        1,
        0,
        0,
        r * 1.3
    );

    ballGradient.addColorStop(0, "#ffbd69");
    ballGradient.addColorStop(0.35, "#f58a32");
    ballGradient.addColorStop(0.75, "#d65c19");
    ballGradient.addColorStop(1, "#81300d");

    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Clip everything inside the ball
    ctx.save();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    ctx.clip();

    // Subtle leather pebble texture
    for (let i = 0; i < 95; i++) {
        const angle = i * 2.399;
        const distance = Math.sqrt(i / 95) * r * 0.91;

        const px = Math.cos(angle) * distance;
        const py = Math.sin(angle) * distance;

        ctx.fillStyle = i % 2 === 0
            ? "rgba(255,210,145,0.16)"
            : "rgba(80,30,8,0.13)";

        ctx.beginPath();
        ctx.arc(px, py, 0.45, 0, Math.PI * 2);
        ctx.fill();
    }

    // Traditional basketball seams.
    // These are two perpendicular curved channels,
    // NOT diagonal lines forming an X.

    ctx.strokeStyle = "#392015";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Vertical meridian seam
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

    // Horizontal curved channel
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

    // Slight highlights along the channels
    ctx.strokeStyle = "rgba(255,190,110,0.2)";
    ctx.lineWidth = 0.7;

    ctx.beginPath();
    ctx.moveTo(-r * 0.88, -r * 0.08);
    ctx.bezierCurveTo(
        -r * 0.3, -r * 0.52,
        r * 0.3, -r * 0.52,
        r * 0.88, -r * 0.08
    );
    ctx.stroke();

    ctx.restore();

    // Spherical lighting
    const shine = ctx.createRadialGradient(
        -r * 0.45,
        -r * 0.5,
        0,
        -r * 0.2,
        -r * 0.2,
        r * 1.2
    );

    shine.addColorStop(0, "rgba(255,255,255,0.28)");
    shine.addColorStop(0.35, "rgba(255,255,255,0.06)");
    shine.addColorStop(1, "rgba(0,0,0,0.24)");

    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Small leather highlight
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.55, r * 0.22, r * 0.09, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Outer edge
    ctx.strokeStyle = "rgba(70,28,9,0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// ------------------------------------------------------------
// COURT DESIGN
// ------------------------------------------------------------

function drawCourt() {

    // Main wooden floor
    const wood = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    wood.addColorStop(0, "#c88b52");
    wood.addColorStop(0.5, "#b77740");
    wood.addColorStop(1, "#92552e");

    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Alternating individual wood planks
    const plankHeight = 48;

    for (let row = 0; row < 14; row++) {
        const y = row * plankHeight;
        const offset = row % 2 === 0 ? 0 : 85;

        for (let col = -1; col < 7; col++) {
            const x = col * 170 + offset;

            ctx.fillStyle = (row + col) % 2 === 0
                ? "rgba(255,205,145,0.10)"
                : "rgba(75,36,14,0.09)";

            ctx.fillRect(x, y, 170, plankHeight);

            ctx.strokeStyle = "rgba(83,43,20,0.18)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 170, plankHeight);

            // Wood grain
            ctx.strokeStyle = "rgba(255,224,180,0.09)";
            ctx.lineWidth = 1;

            for (let grain = 0; grain < 3; grain++) {
                ctx.beginPath();
                ctx.moveTo(x + 15, y + 10 + grain * 13);
                ctx.bezierCurveTo(
                    x + 65, y + 7 + grain * 13,
                    x + 110, y + 15 + grain * 13,
                    x + 155, y + 10 + grain * 13
                );
                ctx.stroke();
            }
        }
    }

    // Court lighting
    const lighting = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    lighting.addColorStop(0, "rgba(255,255,255,0.12)");
    lighting.addColorStop(1, "rgba(0,0,0,0.16)");

    ctx.fillStyle = lighting;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Court markings
    ctx.save();

    ctx.strokeStyle = "rgba(255,239,205,0.75)";
    ctx.lineWidth = 4;

    // Outer boundary
    ctx.strokeRect(22, 12, WIDTH - 44, HEIGHT - 24);

    // Half court line
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 12);
    ctx.lineTo(WIDTH / 2, HEIGHT - 12);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 84, 0, Math.PI * 2);
    ctx.stroke();

    // Free throw areas
    ctx.strokeRect(330, 12, 340, 180);
    ctx.strokeRect(330, HEIGHT - 192, 340, 180);

    // Free throw circles
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 192, 65, 0, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT - 192, 65, Math.PI, 0);
    ctx.stroke();

    // Three-point arcs
    ctx.beginPath();
    ctx.arc(WIDTH / 2, -5, 300, 0.18, Math.PI - 0.18);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT + 5, 300, Math.PI + 0.18, -0.18);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = "rgba(255,244,220,0.85)";
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Arena lettering
    ctx.font = "bold 55px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.075)";
    ctx.fillText("FULL COURT", WIDTH / 2, HEIGHT / 2 + 20);

    ctx.restore();

    // Arena hoops
    drawHoop(50, 95, true);
    drawHoop(WIDTH - 50, 95, false);
}

function drawHoop(x, y, left) {

    ctx.save();

    // Backboard
    ctx.fillStyle = "rgba(245,245,245,0.75)";
    ctx.fillRect(x - 15, y - 35, 30, 65);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 15, y - 35, 30, 65);

    // Rim
    ctx.strokeStyle = "#ff6030";
    ctx.lineWidth = 7;

    ctx.beginPath();
    ctx.ellipse(x, y + 30, 25, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Net
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.5;

    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 10, y + 35);
        ctx.lineTo(x + i * 6, y + 72);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(x - 20, y + 48);
    ctx.lineTo(x + 20, y + 48);
    ctx.stroke();

    ctx.restore();
}

// ------------------------------------------------------------
// BRICK CREATION
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

            // Random gaps make each court feel different
            if (Math.random() < 0.07) continue;

            const golden = Math.random() < 0.055;

            bricks.push({
                x: startX + col * (brickWidth + gap),
                y: 45 + row * 43,
                width: brickWidth,
                height: brickHeight,
                hits: golden ? 1 : (row >= 3 ? 2 : 1),
                maxHits: golden ? 1 : (row >= 3 ? 2 : 1),
                color: golden ? "#f5c84c" : colors[row % colors.length],
                golden,
                alive: true
            });
        }
    }
}

// ------------------------------------------------------------
// BRICK DRAWING
// ------------------------------------------------------------

function drawBricks() {

    bricks.forEach(brick => {

        if (!brick.alive) return;

        ctx.save();

        // Brick shadow
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

        // Top highlight
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(brick.x + 8, brick.y + 5);
        ctx.lineTo(brick.x + brick.width - 8, brick.y + 5);
        ctx.stroke();

        // Basketball or star design
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
    });
}

// ------------------------------------------------------------
// PADDLE DRAWING
// ------------------------------------------------------------

function drawPaddle() {

    ctx.save();

    ctx.shadowColor = "#ff762f";
    ctx.shadowBlur = 18;

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
// PARTICLE EFFECTS
// ------------------------------------------------------------

function createParticles(x, y, color, amount = 12) {

    for (let i = 0; i < amount; i++) {

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

function updateParticles() {

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;
        p.vy += 0.04;
    });

    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {

    particles.forEach(p => {

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// FLOATING SCORE TEXT
// ------------------------------------------------------------

function addFloatingText(x, y, text, color = "#ffffff") {

    floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1
    });
}

function updateFloatingTexts() {

    floatingTexts.forEach(t => {
        t.y -= 1;
        t.life -= 0.02;
    });

    floatingTexts = floatingTexts.filter(t => t.life > 0);
}

function drawFloatingTexts() {

    floatingTexts.forEach(t => {

        ctx.globalAlpha = t.life;
        ctx.fillStyle = t.color;
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
    });

    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// SCORE SYSTEM
// ------------------------------------------------------------

function updateScore(points) {

    const multiplier = activePowers.doublePoints > 0 ? 2 : 1;

    score += points * combo * multiplier;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("fullCourtHighScore", highScore);
    }

    scoreDisplay.textContent = score.toString().padStart(6, "0");
    highScoreDisplay.textContent = highScore.toString().padStart(6, "0");
}

// ------------------------------------------------------------
// POWER-UP PROGRESS
// ------------------------------------------------------------

function updatePowerupProgress() {

    document.getElementById("fireProgress").style.width =
        Math.min(hotHandHits / 3 * 100, 100) + "%";

    document.getElementById("fireText").textContent =
        `${Math.min(hotHandHits, 3)} / 3 ACCURATE HITS`;

    document.getElementById("multiProgress").style.width =
        Math.min(multiballHits / 5 * 100, 100) + "%";

    document.getElementById("multiText").textContent =
        `${Math.min(multiballHits, 5)} / 5 TARGETS`;

    document.getElementById("doubleProgress").style.width =
        Math.min(consecutiveHits / 10 * 100, 100) + "%";

    document.getElementById("doubleText").textContent =
        `${Math.min(consecutiveHits, 10)} / 10 TARGETS`;

    document.getElementById("wideProgress").style.width =
        activePowers.bigMan > 0 ? "100%" : "0%";

    document.getElementById("wideText").textContent =
        activePowers.bigMan > 0
            ? "BIG MAN ACTIVE!"
            : "FIND THE GOLDEN TARGET";

    document.getElementById("fireCard").classList.toggle(
        "unlocked",
        activePowers.hotHand > 0
    );

    document.getElementById("multiCard").classList.toggle(
        "unlocked",
        balls.length > 1
    );

    document.getElementById("wideCard").classList.toggle(
        "unlocked",
        activePowers.bigMan > 0
    );

    document.getElementById("doubleCard").classList.toggle(
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

    powerups.push({
        x,
        y,
        type,
        size: 15,
        speed: 2.5
    });
}

function drawPowerups() {

    powerups.forEach(p => {

        ctx.save();

        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 15;

        const icons = {
            fire: "🔥",
            multi: "🏀",
            wide: "💪",
            double: "💎"
        };

        ctx.font = "27px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icons[p.type], p.x, p.y);

        ctx.restore();
    });
}

function updatePowerups() {

    powerups.forEach(p => {

        p.y += p.speed;

        // Paddle catches power-up
        if (
            p.y + p.size > paddle.y &&
            p.y - p.size < paddle.y + paddle.height &&
            p.x > paddle.x &&
            p.x < paddle.x + paddle.width
        ) {

            activatePowerup(p.type);

            p.collected = true;
        }
    });

    powerups = powerups.filter(p => !p.collected && p.y < HEIGHT + 30);
}

function activatePowerup(type) {

    playSound(850, 0.2, "sine");

    if (type === "fire") {
        activePowers.hotHand = 900;
        announce("🔥 HOT HAND!");
    }

    if (type === "multi") {

        const original = balls[0];

        if (original) {
            balls.push(
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
            );
        }

        announce("🏀 MULTIBALL!");
    }

    if (type === "wide") {
        activePowers.bigMan = 900;
        paddle.width = 260;
        announce("💪 BIG MAN!");
    }

    if (type === "double") {
        activePowers.doublePoints = 900;
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
        15
    );

    combo = Math.min(combo + 1, 10);
    consecutiveHits++;
    multiballHits++;

    updateScore(brick.golden ? 250 : 100);

    addFloatingText(
        brick.x + brick.width / 2,
        brick.y,
        "+" + (brick.golden ? 250 : 100),
        "#fff0a0"
    );

    if (brick.hits <= 0) {

        brick.alive = false;

        playSound(550 + Math.random() * 200, 0.08, "triangle");

        // Golden target unlocks Big Man
        if (brick.golden) {
            dropPowerup(
                brick.x + brick.width / 2,
                brick.y,
                "wide"
            );
        }

        // Three accurate paddle hits unlock Hot Hand
        if (hotHandHits >= 3 && activePowers.hotHand <= 0) {
            dropPowerup(ball.x, ball.y, "fire");
            hotHandHits = 0;
        }

        // Five destroyed targets unlock Multiball
        if (multiballHits >= 5) {
            dropPowerup(ball.x, ball.y, "multi");
            multiballHits = 0;
        }

        // Ten consecutive targets unlock Double Points
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

function updateBalls() {

    balls.forEach(ball => {

        // Motion trail
        ball.trail.push({
            x: ball.x,
            y: ball.y
        });

        if (ball.trail.length > 7) {
            ball.trail.shift();
        }

        ball.x += ball.vx;
        ball.y += ball.vy;

        ball.rotation += ball.vx * 0.018;

        // Side walls
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx *= -1;
            playSound(250, 0.04);
        }

        if (ball.x + ball.radius > WIDTH) {
            ball.x = WIDTH - ball.radius;
            ball.vx *= -1;
            playSound(250, 0.04);
        }

        // Top wall
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy *= -1;
            playSound(300, 0.04);
        }

        // Paddle collision
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

            // Center paddle hits build Hot Hand progress
            if (Math.abs(hitPosition) < 0.25) {

                hotHandHits++;

                if (hotHandHits === 3 && activePowers.hotHand <= 0) {
                    dropPowerup(ball.x, ball.y, "fire");
                    hotHandHits = 0;
                    announce("🔥 HOT HAND UNLOCKED!");
                }
            }

            playSound(180, 0.1, "triangle");

            updatePowerupProgress();
        }

        // Brick collisions
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

        // Ball falls out of court
        if (ball.y - ball.radius > HEIGHT) {
            ball.lost = true;
        }
    });

    balls = balls.filter(ball => !ball.lost);

    if (balls.length === 0) {

        lives--;

        combo = 1;
        consecutiveHits = 0;

        livesDisplay.textContent = "🏀 ".repeat(Math.max(0, lives));

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
// BALL TRAILS AND DRAWING
// ------------------------------------------------------------

function drawBalls() {

    balls.forEach(ball => {

        // Fading trail
        ball.trail.forEach((point, index) => {

            ctx.globalAlpha = index / ball.trail.length * 0.18;
            ctx.fillStyle = "#ffb15b";

            ctx.beginPath();
            ctx.arc(
                point.x,
                point.y,
                ball.radius * 0.65,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });

        ctx.globalAlpha = 1;

        if (activePowers.hotHand > 0) {
            ctx.save();
            ctx.shadowColor = "#ff5522";
            ctx.shadowBlur = 20;
            drawBasketball(ball);
            ctx.restore();
        } else {
            drawBasketball(ball);
        }
    });
}

// ------------------------------------------------------------
// PADDLE MOVEMENT
// ------------------------------------------------------------

function updatePaddle() {

    if (keys.left) {
        paddle.x -= paddle.speed;
    }

    if (keys.right) {
        paddle.x += paddle.speed;
    }

    paddle.x = Math.max(
        0,
        Math.min(WIDTH - paddle.width, paddle.x)
    );
}

function movePaddleTo(clientX) {

    const rect = canvas.getBoundingClientRect();

    const scale = WIDTH / rect.width;

    paddle.x = (clientX - rect.left) * scale - paddle.width / 2;

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

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keys.left = true;
        event.preventDefault();
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keys.right = true;
        event.preventDefault();
    }

    if (event.code === "Space") {

        event.preventDefault();

        if (!running && !gameOver) {
            startGame();
        } else if (running) {
            togglePause();
        }
    }
});

document.addEventListener("keyup", event => {

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keys.left = false;
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keys.right = false;
    }
});

// ------------------------------------------------------------
// LEVEL SYSTEM
// ------------------------------------------------------------

function nextLevel() {

    level++;

    levelDisplay.textContent = level.toString().padStart(2, "0");

    announce("🏆 LEVEL " + level + "!");

    createBricks();

    resetBall();

    playSound(700, 0.3, "triangle");

    paddle.width = 180;

    activePowers.bigMan = 0;
    activePowers.hotHand = 0;
    activePowers.doublePoints = 0;

    updatePowerupProgress();
}

// ------------------------------------------------------------
// POWER-UP TIMERS
// ------------------------------------------------------------

function updatePowerTimers() {

    Object.keys(activePowers).forEach(power => {

        if (activePowers[power] > 0) {
            activePowers[power]--;

            if (activePowers[power] === 0) {

                if (power === "bigMan") {
                    paddle.width = 180;
                }

                announce("POWER-UP EXPIRED");
            }
        }
    });

    updatePowerupProgress();
}

// ------------------------------------------------------------
// MAIN DRAWING FUNCTION
// ------------------------------------------------------------

function drawGame() {

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    drawCourt();
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

function updateGame() {

    if (!running || paused) return;

    updatePaddle();
    updateBalls();
    updatePowerups();
    updateParticles();
    updateFloatingTexts();
    updatePowerTimers();

    // Advance when all targets are destroyed
    if (bricks.every(brick => !brick.alive)) {
        nextLevel();
    }

    updatePowerupProgress();
}

// ------------------------------------------------------------
// GAME LOOP
// ------------------------------------------------------------

function gameLoop(timestamp) {

    const delta = Math.min((timestamp - lastTime) / 16.67 || 1, 2);
    lastTime = timestamp;

    if (running && !paused) {

        // Scale movement to maintain consistent speed
        updatePaddle();

        // Ball and other game physics
        updateBalls();
        updatePowerups();
        updateParticles();
        updateFloatingTexts();
        updatePowerTimers();

        if (bricks.every(brick => !brick.alive)) {
            nextLevel();
        }
    }

    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

// ------------------------------------------------------------
// START GAME
// ------------------------------------------------------------

function startGame() {

    if (running && !paused) return;

    if (gameOver) {
        score = 0;
        level = 1;
        lives = 3;
        combo = 1;
        hotHandHits = 0;
        multiballHits = 0;
        consecutiveHits = 0;

        activePowers = {
            hotHand: 0,
            bigMan: 0,
            doublePoints: 0
        };

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

    overlay.classList.add("hidden");

    gameStatus.textContent = "LIVE GAME";

    scoreDisplay.textContent = score.toString().padStart(6, "0");
    levelDisplay.textContent = level.toString().padStart(2, "0");
    livesDisplay.textContent = "🏀 🏀 🏀";

    pauseButton.textContent = "Ⅱ PAUSE";

    announce("🏀 TIP-OFF!");

    if (!animationId) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// ------------------------------------------------------------
// PAUSE GAME
// ------------------------------------------------------------

function togglePause() {

    if (!running || gameOver) return;

    paused = !paused;

    if (paused) {

        gameStatus.textContent = "GAME PAUSED";
        pauseButton.textContent = "▶ RESUME";

        overlay.classList.remove("hidden");
        overlayTitle.textContent = "TIMEOUT!";
        overlayMessage.textContent = "Take a breather. The court will be waiting.";
        startButton.textContent = "▶ RESUME GAME";

    } else {

        gameStatus.textContent = "LIVE GAME";
        pauseButton.textContent = "Ⅱ PAUSE";

        overlay.classList.add("hidden");
    }
}

// ------------------------------------------------------------
// END GAME
// ------------------------------------------------------------

function endGame() {

    running = false;
    paused = false;
    gameOver = true;

    gameStatus.textContent = "GAME OVER";

    overlay.classList.remove("hidden");

    overlayTitle.textContent = "BUZZER BEATER... NOT!";
    overlayMessage.textContent =
        "Final Score: " + score +
        " | You reached Level " + level +
        ". Get back on the court and try again!";

    startButton.textContent = "▶ PLAY AGAIN";

    announce("GAME OVER!");

    playSound(120, 0.6, "sawtooth");
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
    highScoreDisplay.textContent = highScore.toString().padStart(6, "0");
    levelDisplay.textContent = "01";
    livesDisplay.textContent = "🏀 🏀 🏀";

    gameStatus.textContent = "WAITING FOR TIP-OFF";

    updatePowerupProgress();

    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

initializeGame();

// ============================================================
// END OF FULL COURT BREAKER
// ============================================================
