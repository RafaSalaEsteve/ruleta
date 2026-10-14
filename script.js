// ================================
// State Management
// ================================
const STORAGE_KEYS = {
    students: 'rouletteStudents',
    statistics: 'rouletteStatistics',
    bonus: 'rouletteBonus',
    history: 'rouletteHistory',
    available: 'rouletteAvailable',
    theme: 'rouletteTheme',
    noRepeat: 'rouletteNoRepeat',
    powerUps: 'roulettePowerUps',
    sound: 'rouletteSound'
};

const HISTORY_LIMIT = 10;
const DEFAULT_SPIN_DURATION = 4000;
const POWER_UP_CHANCE = 0.35;

const DEFAULT_STUDENTS = [
    'Ana García', 'Carlos López', 'María Rodríguez', 'Juan Martínez',
    'Laura Sánchez', 'Pedro Gómez', 'Carmen Díaz', 'José Fernández',
    'Isabel Torres', 'Miguel Ruiz'
];

const STATE = {
    students: [],
    selectedHistory: [],
    statistics: {},
    bonusPoints: {},
    isSpinning: false,
    noRepeatMode: false,
    powerUpsMode: false,
    soundEnabled: true,
    availableStudents: [],
    theme: 'light',
    activePowerUp: null,
    pendingRespin: false
};

// ================================
// Power-Ups
// ================================
// Each power-up is rolled before the spin. Speed power-ups change the
// duration of the current spin; the rest act once the winner is known.
const POWER_UPS = [
    {
        id: 'speed-x2',
        icon: '⚡',
        name: 'Velocidad x2',
        description: '¡La ruleta gira el doble de rápido!',
        duration: DEFAULT_SPIN_DURATION / 2
    },
    {
        id: 'slow-motion',
        icon: '🐢',
        name: 'Cámara lenta',
        description: 'Máximo suspense: la ruleta gira a cámara lenta.',
        duration: DEFAULT_SPIN_DURATION * 2
    },
    {
        id: 'bonus-points',
        icon: '⭐',
        name: 'Punto extra',
        description: 'Si responde bien, gana un punto extra (+1 ⭐).'
    },
    {
        id: 'team-play',
        icon: '🤝',
        name: 'Trabajo en equipo',
        description: 'La ruleta elige también a un compañero para ayudar.'
    },
    {
        id: 'respin',
        icon: '🔄',
        name: 'Segunda oportunidad',
        description: 'Se libra esta vez: al cerrar, la ruleta vuelve a girar.'
    }
];

// ================================
// Safe localStorage helpers
// ================================
function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // Storage may be unavailable (private mode, file:// in some browsers)
    }
}

function parseJSON(value, fallback) {
    if (value === null) return fallback;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

// ================================
// Sound Generation using Web Audio API
// ================================
class SoundGenerator {
    constructor() {
        // Created lazily: browsers block audio until there is a user gesture
        this.audioContext = null;
    }

    getContext() {
        if (!STATE.soundEnabled) return null;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        if (!this.audioContext) {
            this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    // Short click played each time a segment passes the pointer
    playTick() {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(900, now);

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        oscillator.start(now);
        oscillator.stop(now + 0.05);
    }

    // Winner celebration sound (C-E-G-C arpeggio)
    playWinnerSound() {
        const ctx = this.getContext();
        if (!ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, index) => {
            const start = ctx.currentTime + index * 0.1;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.value = freq;

            gainNode.gain.setValueAtTime(0.2, start);
            gainNode.gain.exponentialRampToValueAtTime(0.01, start + 0.5);

            oscillator.start(start);
            oscillator.stop(start + 0.5);
        });
    }

    // Rising sweep played when a power-up is activated
    playPowerUpSound() {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.3);

        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        oscillator.start(now);
        oscillator.stop(now + 0.35);
    }
}

const soundGenerator = new SoundGenerator();

// ================================
// Roulette Wheel Class
// ================================
const POINTER_ANGLE = 3 * Math.PI / 2; // Top of the wheel
const TWO_PI = Math.PI * 2;

class RouletteWheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.rotation = 0;
        this.isSpinning = false;
        this.students = [];
        this.highlightIndex = -1;
        this.size = 400;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD',
            '#00D2FF', '#FF3CAC', '#2ECC71', '#E74C3C', '#9B59B6',
            '#F39C12', '#1ABC9C', '#E67E22', '#3498DB', '#16A085'
        ];
        this.resize();
    }

    // Match the canvas backing store to its displayed size for sharp rendering
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const cssSize = Math.round(rect.width) || 400;
        const ratio = window.devicePixelRatio || 1;

        this.size = cssSize;
        this.canvas.width = Math.round(cssSize * ratio);
        this.canvas.height = Math.round(cssSize * ratio);
        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.draw(this.students);
    }

    segmentColor(index, total) {
        let color = this.colors[index % this.colors.length];
        // Avoid two adjacent segments with the same colour where the wheel wraps
        if (total > 1 && index === total - 1 && total % this.colors.length === 1) {
            color = this.colors[(index + 1) % this.colors.length];
        }
        return color;
    }

    fitText(text, maxWidth, baseSize) {
        let fontSize = baseSize;
        this.ctx.font = `bold ${fontSize}px Poppins, sans-serif`;

        while (this.ctx.measureText(text).width > maxWidth && fontSize > 10) {
            fontSize -= 1;
            this.ctx.font = `bold ${fontSize}px Poppins, sans-serif`;
        }

        if (this.ctx.measureText(text).width <= maxWidth) return text;

        let truncated = text;
        while (truncated.length > 1 && this.ctx.measureText(truncated + '…').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '…';
    }

    draw(students, currentRotation = this.rotation) {
        this.students = students;

        const centerX = this.size / 2;
        const centerY = this.size / 2;
        const radius = this.size / 2 - 6;

        this.ctx.clearRect(0, 0, this.size, this.size);

        if (students.length === 0) {
            this.drawEmptyState(centerX, centerY, radius);
            return;
        }

        const anglePerSegment = TWO_PI / students.length;
        // Keep labels clear of the central spin button
        const innerTextRadius = this.size * 0.2;
        const outerTextRadius = radius - 12;
        const maxTextWidth = outerTextRadius - innerTextRadius;
        const segmentHeight = 2 * Math.sin(Math.min(anglePerSegment, Math.PI) / 2) * (radius * 0.7);
        const baseFontSize = Math.max(10, Math.min(18, this.size / 24, segmentHeight * 0.55));

        students.forEach((student, index) => {
            const startAngle = anglePerSegment * index + currentRotation;
            const endAngle = startAngle + anglePerSegment;

            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            this.ctx.closePath();
            this.ctx.fillStyle = this.segmentColor(index, students.length);
            this.ctx.fill();

            if (index === this.highlightIndex) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                this.ctx.fill();
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 5;
            } else {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.lineWidth = 2;
            }
            this.ctx.stroke();

            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(startAngle + anglePerSegment / 2);
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'white';
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 4;
            const label = this.fitText(student, maxTextWidth, baseFontSize);
            this.ctx.fillText(label, outerTextRadius, 0);
            this.ctx.restore();
        });

        // Outer ring
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, TWO_PI);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
    }

    drawEmptyState(centerX, centerY, radius) {
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, TWO_PI);
        this.ctx.fillStyle = '#e0e0e0';
        this.ctx.fill();

        this.ctx.fillStyle = '#666';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `bold ${Math.round(this.size / 20)}px Poppins, sans-serif`;
        this.ctx.fillText('Añade estudiantes', centerX, centerY - radius * 0.55);
        this.ctx.font = `${Math.round(this.size / 25)}px Poppins, sans-serif`;
        this.ctx.fillText('para comenzar', centerX, centerY - radius * 0.42);
    }

    segmentAtPointer(rotation, count) {
        const anglePerSegment = TWO_PI / count;
        const relative = ((POINTER_ANGLE - rotation) % TWO_PI + TWO_PI) % TWO_PI;
        return Math.floor(relative / anglePerSegment) % count;
    }

    spin(students, duration, callback) {
        if (this.isSpinning || students.length === 0) return;

        this.isSpinning = true;
        this.highlightIndex = -1;

        const count = students.length;
        const anglePerSegment = TWO_PI / count;

        // Pick the winner first with a uniform random choice, then compute
        // the rotation that makes the wheel stop on it.
        const winnerIndex = Math.floor(Math.random() * count);
        // Land somewhere inside the segment, away from its borders
        const offsetInSegment = anglePerSegment * (0.15 + Math.random() * 0.7);
        const finalAngle = POINTER_ANGLE - (winnerIndex * anglePerSegment + offsetInSegment);

        const startRotation = ((this.rotation % TWO_PI) + TWO_PI) % TWO_PI;
        const normalizedFinal = ((finalAngle % TWO_PI) + TWO_PI) % TWO_PI;
        let delta = normalizedFinal - startRotation;
        if (delta < 0) delta += TWO_PI;

        const fullSpins = Math.round(duration / 1000) + 3 + Math.floor(Math.random() * 3);
        const totalRotation = delta + fullSpins * TWO_PI;

        const startTime = performance.now();
        let lastSegment = this.segmentAtPointer(startRotation, count);

        const animate = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            // Ease-out quart: fast start, smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 4);

            this.rotation = startRotation + totalRotation * eased;
            this.draw(students, this.rotation);

            const segment = this.segmentAtPointer(this.rotation, count);
            if (segment !== lastSegment) {
                lastSegment = segment;
                soundGenerator.playTick();
                pulsePointer();
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.rotation = ((this.rotation % TWO_PI) + TWO_PI) % TWO_PI;
                this.isSpinning = false;
                this.highlightIndex = winnerIndex;
                this.draw(students, this.rotation);
                callback(students[winnerIndex]);
            }
        };

        requestAnimationFrame(animate);
    }

    clearHighlight() {
        this.highlightIndex = -1;
    }
}

function pulsePointer() {
    const pointer = document.querySelector('.roulette-pointer');
    pointer.classList.remove('tick');
    // Force reflow so the animation restarts
    void pointer.offsetWidth;
    pointer.classList.add('tick');
}

// ================================
// Confetti Animation
// ================================
class ConfettiCannon {
    constructor() {
        this.canvas = document.getElementById('confettiCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationFrame = null;
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticle() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD', '#2ECC71', '#FF3CAC'];
        return {
            x: Math.random() * this.canvas.width,
            y: -20 - Math.random() * this.canvas.height * 0.5,
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        };
    }

    launch() {
        this.clear();
        this.resizeCanvas();
        this.particles = [];

        for (let i = 0; i < 180; i++) {
            this.particles.push(this.createParticle());
        }

        this.animate();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.05; // Gravity
            particle.rotation += particle.rotationSpeed;

            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation * Math.PI / 180);
            this.ctx.fillStyle = particle.color;
            this.ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
            this.ctx.restore();
        });

        // Remove particles that left the screen (filtering avoids skipping
        // elements, which happened when splicing inside forEach)
        this.particles = this.particles.filter(p => p.y < this.canvas.height + 20);

        if (this.particles.length > 0) {
            this.animationFrame = requestAnimationFrame(() => this.animate());
        } else {
            this.clear();
        }
    }

    clear() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// ================================
// Initialize Application
// ================================
const roulette = new RouletteWheel('rouletteCanvas');
const confetti = new ConfettiCannon();

// ================================
// Local Storage Functions
// ================================
function saveToLocalStorage() {
    storageSet(STORAGE_KEYS.students, JSON.stringify(STATE.students));
    storageSet(STORAGE_KEYS.statistics, JSON.stringify(STATE.statistics));
    storageSet(STORAGE_KEYS.bonus, JSON.stringify(STATE.bonusPoints));
    storageSet(STORAGE_KEYS.history, JSON.stringify(STATE.selectedHistory));
    storageSet(STORAGE_KEYS.available, JSON.stringify(STATE.availableStudents));
    storageSet(STORAGE_KEYS.theme, STATE.theme);
    storageSet(STORAGE_KEYS.noRepeat, String(STATE.noRepeatMode));
    storageSet(STORAGE_KEYS.powerUps, String(STATE.powerUpsMode));
    storageSet(STORAGE_KEYS.sound, String(STATE.soundEnabled));
}

function isStringArray(value) {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isCountMap(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeCounts(value) {
    const result = {};
    if (!isCountMap(value)) return result;
    Object.entries(value).forEach(([name, count]) => {
        const number = Number(count);
        if (Number.isFinite(number) && number >= 0) {
            result[name] = Math.floor(number);
        }
    });
    return result;
}

function loadFromLocalStorage() {
    const savedStudents = parseJSON(storageGet(STORAGE_KEYS.students), null);
    STATE.students = isStringArray(savedStudents) ? savedStudents : [...DEFAULT_STUDENTS];

    STATE.statistics = sanitizeCounts(parseJSON(storageGet(STORAGE_KEYS.statistics), {}));
    STATE.bonusPoints = sanitizeCounts(parseJSON(storageGet(STORAGE_KEYS.bonus), {}));

    const savedHistory = parseJSON(storageGet(STORAGE_KEYS.history), []);
    STATE.selectedHistory = isStringArray(savedHistory) ? savedHistory.slice(0, HISTORY_LIMIT) : [];

    const savedAvailable = parseJSON(storageGet(STORAGE_KEYS.available), null);
    STATE.availableStudents = isStringArray(savedAvailable)
        ? savedAvailable.filter(name => STATE.students.includes(name))
        : [...STATE.students];
    if (STATE.availableStudents.length === 0) {
        STATE.availableStudents = [...STATE.students];
    }

    STATE.noRepeatMode = storageGet(STORAGE_KEYS.noRepeat) === 'true';
    STATE.powerUpsMode = storageGet(STORAGE_KEYS.powerUps) === 'true';
    STATE.soundEnabled = storageGet(STORAGE_KEYS.sound) !== 'false';

    const savedTheme = storageGet(STORAGE_KEYS.theme);
    if (savedTheme === 'dark' || savedTheme === 'light') {
        STATE.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        STATE.theme = 'dark';
    }
}

// ================================
// Toast notifications
// ================================
let toastTimeout = null;

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast visible ${type}`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.className = 'toast';
    }, 2800);
}

// ================================
// Student Management
// ================================
function normalizeName(name) {
    return name.trim().replace(/\s+/g, ' ');
}

function studentExists(name) {
    const lower = name.toLocaleLowerCase('es');
    return STATE.students.some(s => s.toLocaleLowerCase('es') === lower);
}

// Accepts a single name or several separated by commas, semicolons or new lines
function addStudents(rawText) {
    if (STATE.isSpinning) return;

    const names = rawText.split(/[,;\n]+/).map(normalizeName).filter(Boolean);

    if (names.length === 0) {
        showToast('Por favor, introduce un nombre', 'error');
        return false;
    }

    const added = [];
    const duplicates = [];

    names.forEach(name => {
        name = name.slice(0, 30);
        if (studentExists(name)) {
            duplicates.push(name);
            return;
        }
        STATE.students.push(name);
        STATE.availableStudents.push(name);
        added.push(name);
    });

    if (added.length > 0) {
        refreshAll();
    }

    if (added.length === 1 && duplicates.length === 0) {
        showToast(`✅ ${added[0]} añadido`, 'success');
    } else if (added.length > 0) {
        const extra = duplicates.length ? ` (${duplicates.length} repetidos ignorados)` : '';
        showToast(`✅ ${added.length} estudiantes añadidos${extra}`, 'success');
    } else {
        showToast(duplicates.length === 1 ? 'Este estudiante ya existe' : 'Esos estudiantes ya existen', 'error');
    }

    return added.length > 0;
}

function removeStudent(name) {
    if (STATE.isSpinning) return;

    STATE.students = STATE.students.filter(s => s !== name);
    STATE.availableStudents = STATE.availableStudents.filter(s => s !== name);
    if (STATE.availableStudents.length === 0) {
        STATE.availableStudents = [...STATE.students];
    }

    refreshAll();
}

function clearAllStudents() {
    if (STATE.isSpinning || STATE.students.length === 0) return;
    if (!confirm('¿Seguro que quieres eliminar a todos los estudiantes?')) return;

    STATE.students = [];
    STATE.availableStudents = [];
    STATE.selectedHistory = [];
    hidePowerUpBanner();
    refreshAll();
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderStudentList() {
    const list = document.getElementById('studentList');
    const count = document.getElementById('studentCount');

    count.textContent = STATE.students.length;
    list.replaceChildren();

    STATE.students.forEach(student => {
        const item = createElement('li', 'student-item');
        const alreadyPicked = STATE.noRepeatMode && !STATE.availableStudents.includes(student);
        if (alreadyPicked) item.classList.add('picked');

        const name = createElement('span', 'student-name', student);
        if (alreadyPicked) name.title = 'Ya ha salido en esta ronda';

        const button = createElement('button', 'delete-button', '✕');
        button.type = 'button';
        button.title = `Eliminar a ${student}`;
        button.setAttribute('aria-label', `Eliminar a ${student}`);
        button.dataset.name = student;

        item.append(name, button);
        list.appendChild(item);
    });

    document.getElementById('clearStudents').disabled = STATE.students.length === 0;
}

// Students currently on the wheel
function getWheelStudents() {
    return STATE.noRepeatMode ? STATE.availableStudents : STATE.students;
}

function renderRoundInfo() {
    const info = document.getElementById('roundInfo');
    if (STATE.noRepeatMode && STATE.students.length > 0) {
        info.textContent = `Quedan ${STATE.availableStudents.length} de ${STATE.students.length} en esta ronda`;
        info.classList.remove('hidden');
    } else {
        info.classList.add('hidden');
    }
}

function drawWheel() {
    roulette.draw(getWheelStudents());
}

function refreshAll() {
    saveToLocalStorage();
    renderStudentList();
    renderStatistics();
    renderHistory();
    renderRoundInfo();
    roulette.highlightIndex = -1;
    drawWheel();
}

// ================================
// Roulette Spin
// ================================
function setSpinningUI(spinning) {
    STATE.isSpinning = spinning;
    document.getElementById('spinButton').disabled = spinning;
    document.querySelector('.main-content').classList.toggle('is-spinning', spinning);
}

function rollPowerUp() {
    if (!STATE.powerUpsMode || Math.random() >= POWER_UP_CHANCE) return null;

    // Team play needs at least two students on the wheel
    const candidates = POWER_UPS.filter(p => p.id !== 'team-play' || STATE.students.length > 1);
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function showPowerUpBanner(powerUp) {
    const banner = document.getElementById('powerUpBanner');
    document.getElementById('powerUpName').textContent = `${powerUp.icon} ${powerUp.name}`;
    banner.classList.remove('hidden');
    // Restart the entrance animation
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
}

function hidePowerUpBanner() {
    document.getElementById('powerUpBanner').classList.add('hidden');
}

function spinRoulette() {
    if (STATE.isSpinning || roulette.isSpinning) return;

    // Ensure the audio context is unlocked by this user gesture
    soundGenerator.getContext();

    if (STATE.noRepeatMode && STATE.availableStudents.length === 0) {
        STATE.availableStudents = [...STATE.students];
    }

    const studentsToUse = [...getWheelStudents()];

    if (studentsToUse.length === 0) {
        showToast('Añade estudiantes para poder girar la ruleta', 'error');
        return;
    }

    closeWinnerModal({ silent: true });
    setSpinningUI(true);

    const powerUp = rollPowerUp();
    STATE.activePowerUp = powerUp;
    if (powerUp) {
        showPowerUpBanner(powerUp);
        soundGenerator.playPowerUpSound();
    } else {
        hidePowerUpBanner();
    }

    const duration = powerUp && powerUp.duration ? powerUp.duration : DEFAULT_SPIN_DURATION;

    roulette.spin(studentsToUse, duration, (winner) => {
        handleWinner(winner, powerUp);
    });
}

function pickTeammate(winner) {
    const others = STATE.students.filter(s => s !== winner);
    if (others.length === 0) return null;
    return others[Math.floor(Math.random() * others.length)];
}

function handleWinner(winner, powerUp) {
    const isRespin = powerUp && powerUp.id === 'respin';
    let teammate = null;

    if (!isRespin) {
        STATE.statistics[winner] = (STATE.statistics[winner] || 0) + 1;

        STATE.selectedHistory.unshift(winner);
        if (STATE.selectedHistory.length > HISTORY_LIMIT) {
            STATE.selectedHistory.length = HISTORY_LIMIT;
        }

        if (STATE.noRepeatMode) {
            STATE.availableStudents = STATE.availableStudents.filter(s => s !== winner);
        }

        if (powerUp && powerUp.id === 'bonus-points') {
            STATE.bonusPoints[winner] = (STATE.bonusPoints[winner] || 0) + 1;
        }

        if (powerUp && powerUp.id === 'team-play') {
            teammate = pickTeammate(winner);
            if (teammate) {
                STATE.statistics[teammate] = (STATE.statistics[teammate] || 0) + 1;
                if (STATE.noRepeatMode) {
                    STATE.availableStudents = STATE.availableStudents.filter(s => s !== teammate);
                }
            }
        }
    }

    // Start a new round once everybody has participated
    const roundComplete = STATE.noRepeatMode && STATE.availableStudents.length === 0;
    if (roundComplete) {
        STATE.availableStudents = [...STATE.students];
    }

    STATE.pendingRespin = Boolean(isRespin);
    saveToLocalStorage();

    setTimeout(() => {
        setSpinningUI(false);
        renderHistory();
        renderStatistics();
        renderStudentList();
        renderRoundInfo();
        showWinnerModal(winner, powerUp, teammate, roundComplete);
    }, 500);
}

// ================================
// Winner Modal
// ================================
let lastFocusedElement = null;

function showWinnerModal(winner, powerUp, teammate, roundComplete) {
    const modal = document.getElementById('winnerModal');
    const content = modal.querySelector('.modal-content');
    const title = document.getElementById('modalTitle');
    const trophy = document.getElementById('trophyIcon');
    const winnerName = document.getElementById('winnerName');
    const description = document.getElementById('powerUpDescription');

    content.className = 'modal-content';
    winnerName.textContent = teammate ? `${winner} y ${teammate}` : winner;

    if (powerUp) {
        content.classList.add(powerUp.id);
        trophy.textContent = powerUp.icon;
        title.textContent = powerUp.name;
        description.textContent = powerUp.description;
        description.classList.remove('hidden');
    } else {
        trophy.textContent = '🏆';
        title.textContent = '¡Seleccionado!';
        description.textContent = '';
        description.classList.add('hidden');
    }

    if (roundComplete) {
        const note = '¡Todos han participado! Empieza una ronda nueva.';
        description.textContent = description.textContent ? `${description.textContent} ${note}` : note;
        description.classList.remove('hidden');
    }

    document.getElementById('spinAgainButton').textContent = STATE.pendingRespin ? '🔄 Volver a girar' : '🎲 Girar otra vez';

    lastFocusedElement = document.activeElement;
    modal.classList.add('active');
    document.getElementById('closeModal').focus();

    soundGenerator.playWinnerSound();
    confetti.launch();
}

function closeWinnerModal({ silent = false } = {}) {
    const modal = document.getElementById('winnerModal');
    if (!modal.classList.contains('active')) return;

    modal.classList.remove('active');
    confetti.clear();
    roulette.clearHighlight();
    drawWheel();

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }

    // The "Segunda oportunidad" power-up spins again automatically
    if (STATE.pendingRespin && !silent) {
        STATE.pendingRespin = false;
        setTimeout(spinRoulette, 300);
    }
    STATE.pendingRespin = false;
}

function spinAgainFromModal() {
    STATE.pendingRespin = false;
    closeWinnerModal({ silent: true });
    setTimeout(spinRoulette, 300);
}

// ================================
// History
// ================================
function renderHistory() {
    const historyList = document.getElementById('historyList');
    historyList.replaceChildren();

    STATE.selectedHistory.forEach(student => {
        historyList.appendChild(createElement('span', 'history-item', student));
    });
}

function resetHistory() {
    if (STATE.isSpinning) return;
    if (!confirm('¿Reiniciar el historial y empezar una ronda nueva?')) return;

    STATE.selectedHistory = [];
    STATE.availableStudents = [...STATE.students];
    hidePowerUpBanner();
    refreshAll();
    showToast('Historial reiniciado', 'success');
}

// ================================
// Statistics
// ================================
function renderStatistics() {
    const statsList = document.getElementById('statisticsList');
    statsList.replaceChildren();

    const hasData = STATE.students.some(name => STATE.statistics[name] || STATE.bonusPoints[name]);
    document.getElementById('resetStats').disabled = !hasData;
    if (!hasData) return;

    const sorted = [...STATE.students].sort((a, b) =>
        (STATE.statistics[b] || 0) - (STATE.statistics[a] || 0) ||
        (STATE.bonusPoints[b] || 0) - (STATE.bonusPoints[a] || 0) ||
        a.localeCompare(b, 'es')
    );
    const max = Math.max(1, ...sorted.map(name => STATE.statistics[name] || 0));

    sorted.forEach(name => {
        const count = STATE.statistics[name] || 0;
        const bonus = STATE.bonusPoints[name] || 0;

        const item = createElement('div', 'stat-item');
        item.style.setProperty('--stat-fill', `${(count / max) * 100}%`);

        const label = createElement('span', 'stat-name', name);
        const badges = createElement('span', 'stat-badges');
        if (bonus > 0) {
            const bonusBadge = createElement('span', 'stat-bonus', `⭐ ${bonus}`);
            bonusBadge.title = 'Puntos extra';
            badges.appendChild(bonusBadge);
        }
        const countBadge = createElement('span', 'stat-count', String(count));
        countBadge.title = 'Veces seleccionado';
        badges.appendChild(countBadge);

        item.append(label, badges);
        statsList.appendChild(item);
    });
}

function resetStatistics() {
    if (STATE.isSpinning) return;
    if (!confirm('¿Borrar todas las estadísticas y puntos extra?')) return;

    STATE.statistics = {};
    STATE.bonusPoints = {};
    refreshAll();
    showToast('Estadísticas borradas', 'success');
}

// ================================
// Import/Export
// ================================
function exportData() {
    const data = {
        students: STATE.students,
        statistics: STATE.statistics,
        bonusPoints: STATE.bonusPoints,
        history: STATE.selectedHistory,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruleta-estudiantes-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData() {
    if (STATE.isSpinning) return;
    document.getElementById('importFileInput').click();
}

// Accepts the exported JSON, a plain JSON array of names, or a text/CSV
// file with one name per line.
function parseImportedFile(text, fileName) {
    const trimmed = text.trim();
    const looksLikeJSON = /\.json$/i.test(fileName) || trimmed.startsWith('{') || trimmed.startsWith('[');

    if (looksLikeJSON) {
        const data = JSON.parse(trimmed);
        if (isStringArray(data)) {
            return { students: data };
        }
        if (data && isStringArray(data.students)) {
            return data;
        }
        throw new Error('Formato no válido');
    }

    return { students: trimmed.split(/[\r\n,;]+/) };
}

function handleImportFile(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = parseImportedFile(String(e.target.result), file.name);

            const seen = new Set();
            const students = [];
            data.students.map(normalizeName).filter(Boolean).forEach(name => {
                name = name.slice(0, 30);
                const key = name.toLocaleLowerCase('es');
                if (!seen.has(key)) {
                    seen.add(key);
                    students.push(name);
                }
            });

            if (students.length === 0) {
                showToast('El archivo no contiene estudiantes', 'error');
                return;
            }

            if (!confirm(`Se importarán ${students.length} estudiantes y se reemplazarán los datos actuales. ¿Continuar?`)) {
                return;
            }

            STATE.students = students;
            STATE.statistics = sanitizeCounts(data.statistics);
            STATE.bonusPoints = sanitizeCounts(data.bonusPoints);
            STATE.selectedHistory = isStringArray(data.history)
                ? data.history.filter(name => students.includes(name)).slice(0, HISTORY_LIMIT)
                : [];
            STATE.availableStudents = [...students];
            hidePowerUpBanner();

            refreshAll();
            showToast('Datos importados correctamente', 'success');
        } catch (error) {
            showToast('No se pudo importar: usa un JSON exportado o un .txt/.csv con un nombre por línea', 'error');
        } finally {
            // Allow importing the same file again
            input.value = '';
        }
    };
    reader.onerror = () => {
        showToast('No se pudo leer el archivo', 'error');
        input.value = '';
    };
    reader.readAsText(file);
}

// ================================
// Theme & Sound Toggles
// ================================
function toggleTheme() {
    STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
    applyTheme(STATE.theme);
    saveToLocalStorage();
}

function applyTheme(theme) {
    const icon = document.querySelector('#themeToggle .theme-icon');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        icon.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        icon.textContent = '🌙';
    }
}

function toggleSound() {
    STATE.soundEnabled = !STATE.soundEnabled;
    applySound();
    saveToLocalStorage();
}

function applySound() {
    const button = document.getElementById('soundToggle');
    button.querySelector('.theme-icon').textContent = STATE.soundEnabled ? '🔊' : '🔇';
    button.setAttribute('aria-label', STATE.soundEnabled ? 'Silenciar sonido' : 'Activar sonido');
    button.title = STATE.soundEnabled ? 'Silenciar sonido' : 'Activar sonido';
}

// ================================
// Event Listeners
// ================================
function submitStudentInput() {
    const input = document.getElementById('studentNameInput');
    if (addStudents(input.value)) {
        input.value = '';
    }
    input.focus();
}

document.getElementById('spinButton').addEventListener('click', spinRoulette);
document.getElementById('addStudentButton').addEventListener('click', submitStudentInput);

document.getElementById('studentNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitStudentInput();
    }
});

// Pasting a column of names (e.g. from a spreadsheet) adds all of them
document.getElementById('studentNameInput').addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (/[\r\n]/.test(text.trim())) {
        e.preventDefault();
        addStudents(text.replace(/\r/g, ''));
    }
});

document.getElementById('studentList').addEventListener('click', (e) => {
    const button = e.target.closest('.delete-button');
    if (button) {
        removeStudent(button.dataset.name);
    }
});

document.getElementById('noRepeatMode').addEventListener('change', (e) => {
    STATE.noRepeatMode = e.target.checked;
    if (STATE.noRepeatMode && STATE.availableStudents.length === 0) {
        STATE.availableStudents = [...STATE.students];
    }
    refreshAll();
});

document.getElementById('powerUpsMode').addEventListener('change', (e) => {
    STATE.powerUpsMode = e.target.checked;
    if (!STATE.powerUpsMode) hidePowerUpBanner();
    saveToLocalStorage();
});

document.getElementById('resetHistory').addEventListener('click', resetHistory);
document.getElementById('resetStats').addEventListener('click', resetStatistics);
document.getElementById('clearStudents').addEventListener('click', clearAllStudents);
document.getElementById('closeModal').addEventListener('click', () => closeWinnerModal());
document.getElementById('spinAgainButton').addEventListener('click', spinAgainFromModal);
document.getElementById('exportButton').addEventListener('click', exportData);
document.getElementById('importButton').addEventListener('click', importData);
document.getElementById('importFileInput').addEventListener('change', handleImportFile);
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('soundToggle').addEventListener('click', toggleSound);

document.getElementById('winnerModal').addEventListener('click', (e) => {
    if (e.target.id === 'winnerModal') {
        closeWinnerModal();
    }
});

document.addEventListener('keydown', (e) => {
    const modalOpen = document.getElementById('winnerModal').classList.contains('active');

    if (e.key === 'Escape' && modalOpen) {
        closeWinnerModal();
        return;
    }

    // Space spins the wheel when focus is not on a form control
    const target = e.target;
    const typing = target.closest && target.closest('input, textarea, button, select, [contenteditable="true"]');
    if (e.code === 'Space' && !typing && !modalOpen) {
        e.preventDefault();
        spinRoulette();
    }
});

// ================================
// Initialize
// ================================
function init() {
    loadFromLocalStorage();
    applyTheme(STATE.theme);
    applySound();
    document.getElementById('noRepeatMode').checked = STATE.noRepeatMode;
    document.getElementById('powerUpsMode').checked = STATE.powerUpsMode;
    roulette.resize();
    refreshAll();
}

init();

// Redraw once the web font is ready so labels use Poppins
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => drawWheel());
}

let resizeFrame = null;
window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        roulette.resize();
        confetti.resizeCanvas();
    });
});
