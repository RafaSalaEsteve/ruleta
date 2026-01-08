// ================================
// State Management
// ================================
const STATE = {
    students: [],
    selectedHistory: [],
    statistics: {},
    isSpinning: false,
    noRepeatMode: false,
    availableStudents: [],
    theme: 'light',
    rotation: 0
};

// ================================
// Sound Generation using Web Audio API
// ================================
class SoundGenerator {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Generate spinning sound effect
    playSpinSound() {
        const duration = 3;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + duration);

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Generate winner celebration sound
    playWinnerSound() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C chord

        notes.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.type = 'sine';
                oscillator.frequency.value = freq;

                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.5);
            }, index * 100);
        });
    }
}

const soundGenerator = new SoundGenerator();

// ================================
// Roulette Wheel Class
// ================================
class RouletteWheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.rotation = 0;
        this.targetRotation = 0;
        this.isSpinning = false;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD',
            '#00D2FF', '#FF3CAC', '#2ECC71', '#E74C3C', '#9B59B6',
            '#F39C12', '#1ABC9C', '#E67E22', '#3498DB', '#16A085'
        ];
    }

    draw(students, currentRotation = this.rotation) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (students.length === 0) {
            this.drawEmptyState(centerX, centerY, radius);
            return;
        }

        const anglePerSegment = (Math.PI * 2) / students.length;

        students.forEach((student, index) => {
            const startAngle = anglePerSegment * index + currentRotation;
            const endAngle = startAngle + anglePerSegment;
            const color = this.colors[index % this.colors.length];

            // Draw segment
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            this.ctx.closePath();
            this.ctx.fillStyle = color;
            this.ctx.fill();

            // Segment border
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw text
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(startAngle + anglePerSegment / 2);
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Poppins, sans-serif';
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(student, radius * 0.65, 0);
            this.ctx.restore();
        });

        // Center circle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
    }

    drawEmptyState(centerX, centerY, radius) {
        // Draw gray circle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#e0e0e0';
        this.ctx.fill();

        // Draw message
        this.ctx.fillStyle = '#666';
        this.ctx.font = 'bold 20px Poppins, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Añade estudiantes', centerX, centerY - 10);
        this.ctx.font = '16px Poppins, sans-serif';
        this.ctx.fillText('para comenzar', centerX, centerY + 15);
    }

    spin(students, callback) {
        if (this.isSpinning || students.length === 0) return;

        this.isSpinning = true;

        // Play spin sound
        soundGenerator.playSpinSound();

        // Random rotation (multiple full spins + random position)
        const spins = 5 + Math.random() * 3; // 5-8 full rotations
        const extraRotation = Math.random() * Math.PI * 2;
        this.targetRotation = this.rotation + (Math.PI * 2 * spins) + extraRotation;

        const startTime = Date.now();
        const duration = 4000; // 4 seconds

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            this.rotation = this.rotation + (this.targetRotation - this.rotation) * eased * 0.1;
            this.draw(students, this.rotation);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.rotation = this.targetRotation % (Math.PI * 2);
                this.isSpinning = false;

                // Calculate winner
                // The pointer is at the top of the wheel (270 degrees = 3*PI/2 radians)
                // Segments are drawn starting from index 0 at angle 0 + rotation
                // We need to find which segment is at the pointer position
                const anglePerSegment = (Math.PI * 2) / students.length;
                const pointerAngle = (3 * Math.PI / 2); // Top of the wheel

                // Calculate which segment is at the pointer position
                // The segment i spans from (i * anglePerSegment + rotation) to ((i+1) * anglePerSegment + rotation)
                // We need to find i where the pointerAngle falls within that range
                let winnerIndex = Math.floor((pointerAngle - this.rotation) / anglePerSegment);

                // Normalize to be within [0, students.length)
                winnerIndex = ((winnerIndex % students.length) + students.length) % students.length;

                callback(students[winnerIndex]);
            }
        };

        animate();
    }
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
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD'];
        return {
            x: Math.random() * this.canvas.width,
            y: -10,
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        };
    }

    launch() {
        this.resizeCanvas();
        this.particles = [];

        // Create 150 particles
        for (let i = 0; i < 150; i++) {
            this.particles.push(this.createParticle());
        }

        this.animate();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // Gravity
            particle.rotation += particle.rotationSpeed;

            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation * Math.PI / 180);
            this.ctx.fillStyle = particle.color;
            this.ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
            this.ctx.restore();

            // Remove particles that are off screen
            if (particle.y > this.canvas.height) {
                this.particles.splice(index, 1);
            }
        });

        if (this.particles.length > 0) {
            this.animationFrame = requestAnimationFrame(() => this.animate());
        } else {
            this.clear();
        }
    }

    clear() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
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
    localStorage.setItem('rouletteStudents', JSON.stringify(STATE.students));
    localStorage.setItem('rouletteStatistics', JSON.stringify(STATE.statistics));
    localStorage.setItem('rouletteTheme', STATE.theme);
}

function loadFromLocalStorage() {
    const savedStudents = localStorage.getItem('rouletteStudents');
    const savedStats = localStorage.getItem('rouletteStatistics');
    const savedTheme = localStorage.getItem('rouletteTheme');

    if (savedStudents) {
        STATE.students = JSON.parse(savedStudents);
    } else {
        // Default students
        STATE.students = [
            'Ana García', 'Carlos López', 'María Rodríguez', 'Juan Martínez',
            'Laura Sánchez', 'Pedro Gómez', 'Carmen Díaz', 'José Fernández',
            'Isabel Torres', 'Miguel Ruiz'
        ];
    }

    if (savedStats) {
        STATE.statistics = JSON.parse(savedStats);
    }

    if (savedTheme) {
        STATE.theme = savedTheme;
        applyTheme(savedTheme);
    }

    STATE.availableStudents = [...STATE.students];
}

// ================================
// Student Management
// ================================
function addStudent(name) {
    name = name.trim();
    if (!name) {
        alert('Por favor, introduce un nombre');
        return;
    }

    if (STATE.students.includes(name)) {
        alert('Este estudiante ya existe');
        return;
    }

    STATE.students.push(name);
    STATE.availableStudents.push(name);
    STATE.statistics[name] = STATE.statistics[name] || 0;

    saveToLocalStorage();
    renderStudentList();
    renderStatistics();
    roulette.draw(STATE.students);
}

function removeStudent(name) {
    STATE.students = STATE.students.filter(s => s !== name);
    STATE.availableStudents = STATE.availableStudents.filter(s => s !== name);

    saveToLocalStorage();
    renderStudentList();
    renderStatistics();
    roulette.draw(STATE.students);
}

function renderStudentList() {
    const list = document.getElementById('studentList');
    const count = document.getElementById('studentCount');

    count.textContent = STATE.students.length;

    list.innerHTML = STATE.students.map(student => `
        <li class="student-item">
            <span class="student-name">${student}</span>
            <button class="delete-button" onclick="removeStudent('${student}')">
                ✕ Eliminar
            </button>
        </li>
    `).join('');
}

// ================================
// Roulette Spin
// ================================
function spinRoulette() {
    if (STATE.isSpinning) return;

    const studentsToUse = STATE.noRepeatMode && STATE.availableStudents.length > 0
        ? STATE.availableStudents
        : STATE.students;

    if (studentsToUse.length === 0) {
        alert('No hay estudiantes disponibles');
        return;
    }

    STATE.isSpinning = true;
    document.getElementById('spinButton').disabled = true;

    roulette.spin(studentsToUse, (winner) => {
        // Update statistics
        STATE.statistics[winner] = (STATE.statistics[winner] || 0) + 1;

        // Update history
        STATE.selectedHistory.unshift(winner);
        if (STATE.selectedHistory.length > 10) {
            STATE.selectedHistory.pop();
        }

        // Remove from available if in no-repeat mode
        if (STATE.noRepeatMode) {
            STATE.availableStudents = STATE.availableStudents.filter(s => s !== winner);

            // Reset if all students have been selected
            if (STATE.availableStudents.length === 0) {
                STATE.availableStudents = [...STATE.students];
            }
        }

        saveToLocalStorage();

        // Show winner with delay
        setTimeout(() => {
            showWinnerModal(winner);
            STATE.isSpinning = false;
            document.getElementById('spinButton').disabled = false;
            renderHistory();
            renderStatistics();
        }, 500);
    });
}

// ================================
// Winner Modal
// ================================
function showWinnerModal(winner) {
    const modal = document.getElementById('winnerModal');
    const winnerName = document.getElementById('winnerName');

    winnerName.textContent = winner;
    modal.classList.add('active');

    // Play winner sound
    soundGenerator.playWinnerSound();

    // Launch confetti
    confetti.launch();
}

function closeWinnerModal() {
    const modal = document.getElementById('winnerModal');
    modal.classList.remove('active');
    confetti.clear();
}

// ================================
// History
// ================================
function renderHistory() {
    const historyList = document.getElementById('historyList');

    historyList.innerHTML = STATE.selectedHistory.map(student => `
        <span class="history-item">${student}</span>
    `).join('');
}

function resetHistory() {
    if (confirm('¿Estás seguro de que quieres reiniciar el historial?')) {
        STATE.selectedHistory = [];
        STATE.availableStudents = [...STATE.students];
        renderHistory();
    }
}

// ================================
// Statistics
// ================================
function renderStatistics() {
    const statsList = document.getElementById('statisticsList');

    const sorted = Object.entries(STATE.statistics)
        .filter(([name]) => STATE.students.includes(name))
        .sort((a, b) => b[1] - a[1]);

    statsList.innerHTML = sorted.map(([name, count]) => `
        <div class="stat-item">
            <span class="stat-name">${name}</span>
            <span class="stat-count">${count}</span>
        </div>
    `).join('');
}

// ================================
// Import/Export
// ================================
function exportData() {
    const data = {
        students: STATE.students,
        statistics: STATE.statistics,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruleta-estudiantes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData() {
    document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (confirm('¿Quieres reemplazar los datos actuales con los importados?')) {
                STATE.students = data.students || [];
                STATE.statistics = data.statistics || {};
                STATE.availableStudents = [...STATE.students];
                STATE.selectedHistory = [];

                saveToLocalStorage();
                renderStudentList();
                renderStatistics();
                renderHistory();
                roulette.draw(STATE.students);

                alert('Datos importados correctamente');
            }
        } catch (error) {
            alert('Error al importar el archivo. Asegúrate de que es un archivo JSON válido.');
        }
    };
    reader.readAsText(file);
}

// ================================
// Theme Toggle
// ================================
function toggleTheme() {
    STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
    applyTheme(STATE.theme);
    saveToLocalStorage();
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('.theme-icon').textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.querySelector('.theme-icon').textContent = '🌙';
    }
}

// ================================
// Event Listeners
// ================================
document.getElementById('spinButton').addEventListener('click', spinRoulette);
document.getElementById('addStudentButton').addEventListener('click', () => {
    const input = document.getElementById('studentNameInput');
    addStudent(input.value);
    input.value = '';
});

document.getElementById('studentNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const input = e.target;
        addStudent(input.value);
        input.value = '';
    }
});

document.getElementById('noRepeatMode').addEventListener('change', (e) => {
    STATE.noRepeatMode = e.target.checked;
});

document.getElementById('resetHistory').addEventListener('click', resetHistory);
document.getElementById('closeModal').addEventListener('click', closeWinnerModal);
document.getElementById('exportButton').addEventListener('click', exportData);
document.getElementById('importButton').addEventListener('click', importData);
document.getElementById('importFileInput').addEventListener('change', handleImportFile);
document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// Close modal on background click
document.getElementById('winnerModal').addEventListener('click', (e) => {
    if (e.target.id === 'winnerModal') {
        closeWinnerModal();
    }
});

// ================================
// Initialize on Load
// ================================
window.addEventListener('load', () => {
    loadFromLocalStorage();
    renderStudentList();
    renderStatistics();
    renderHistory();
    roulette.draw(STATE.students);
});

// Handle window resize for confetti
window.addEventListener('resize', () => {
    confetti.resizeCanvas();
});
