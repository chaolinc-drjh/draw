/* ========================================
   State
   ======================================== */
   const state = {
    names: [],
    originalNames: [],
    drawnHistory: [],
    drawCount: 1,
    isSpinning: false,
    currentRotation: 0, // canvas CSS rotation in degrees
};

// Vibrant HSL palettes
const COLORS = [
    '#ff6b6b', '#feca57', '#1dd1a1', '#5f27cd', '#54a0ff',
    '#ff9fe5', '#01a3a4', '#ff9f43', '#0abde3', '#e15f41',
    '#c8d6e5', '#8395a7', '#10ac84', '#ee5253', '#341f97'
];

/* ========================================
   DOM Elements
   ======================================== */
const els = {
    fileInput: document.getElementById('fileInput'),
    namesInput: document.getElementById('namesInput'),
    btnUpdateWheel: document.getElementById('btnUpdateWheel'),
    btnReset: document.getElementById('btnReset'),
    nameCountBadge: document.getElementById('nameCountBadge'),
    drawCount: document.getElementById('drawCount'),
    historyList: document.getElementById('historyList'),
    canvas: document.getElementById('wheelCanvas'),
    btnSpin: document.getElementById('btnSpin'),
    
    // Modal
    resultModal: document.getElementById('resultModal'),
    winnersContainer: document.getElementById('winnersContainer'),
    btnModalClose: document.getElementById('btnModalClose'),
    confettiContainer: document.getElementById('confettiContainer')
};

const ctx = els.canvas.getContext('2d');

/* ========================================
   Initialization
   ======================================== */
function saveState() {
    try {
        localStorage.setItem('wheel_state', JSON.stringify({
            names: state.names,
            originalNames: state.originalNames,
            drawnHistory: state.drawnHistory,
            namesInputText: els.namesInput.value
        }));
    } catch(e) {}
}

function loadState() {
    try {
        const saved = localStorage.getItem('wheel_state');
        if (saved) {
            const data = JSON.parse(saved);
            state.names = data.names || [];
            state.originalNames = data.originalNames || [];
            state.drawnHistory = data.drawnHistory || [];
            els.namesInput.value = data.namesInputText || state.names.join('\n');
            
            els.nameCountBadge.textContent = `${state.names.length} 人`;
            els.btnSpin.disabled = state.names.length === 0;
            updateHistoryUI();
            drawWheel();
            return true;
        }
    } catch(e) {}
    return false;
}

async function init() {
    setupEventListeners();
    if (!loadState()) {
        setFallbackNames();
    }
}

function setFallbackNames() {
    // Default 01~25
    const defaults = Array.from({length: 25}, (_, i) => String(i + 1).padStart(2, '0'));
    els.namesInput.value = defaults.join('\n');
    state.originalNames = [];
    updateNamesFromInput();
}

function setupEventListeners() {
    els.fileInput.addEventListener('change', handleFileUpload);
    els.btnUpdateWheel.addEventListener('click', updateNamesFromInput);
    els.btnReset.addEventListener('click', () => {
        if(confirm('確定要清除所有紀錄並重置嗎？')) {
            els.namesInput.value = state.originalNames.join('\n');
            state.drawnHistory = [];
            updateHistoryUI();
            updateNamesFromInput();
        }
    });

    els.drawCount.addEventListener('change', (e) => {
        state.drawCount = parseInt(e.target.value);
    });

    els.btnSpin.addEventListener('click', spinWheel);
    
    // Modal buttons
    els.btnModalClose.addEventListener('click', () => {
        const toHide = state.modalWinners.filter(w => w.hide).map(w => w.name);
        const toKeep = state.modalWinners.filter(w => !w.hide).map(w => w.name);
        
        // Update history tracking in the last record
        if (state.drawnHistory.length > 0) {
            const lastRecord = state.drawnHistory[state.drawnHistory.length - 1];
            if (Array.isArray(lastRecord)) {
                state.drawnHistory[state.drawnHistory.length - 1] = {
                    winners: lastRecord,
                    kept: toKeep
                };
            } else {
                lastRecord.kept = toKeep;
            }
        }
        
        if (toHide.length > 0) {
            hideWinners(toHide);
        }
        
        updateHistoryUI();
        saveState();
        closeModal();
    });
}

/* ========================================
   Data Processing
   ======================================== */
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        els.namesInput.value = event.target.result;
        // Keep original intact, load fresh
        const list = parseNames(event.target.result);
        state.originalNames = [...list];
        updateNamesFromInput();
    };
    reader.readAsText(file);
    e.target.value = ''; // reset file input
}

function parseNames(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function updateNamesFromInput() {
    const list = parseNames(els.namesInput.value);
    state.names = list;
    if (state.originalNames.length === 0) {
        state.originalNames = [...list]; // Backup original full list
    }
    
    els.nameCountBadge.textContent = `${state.names.length} 人`;
    els.btnSpin.disabled = state.names.length === 0;

    // Reset rotation slightly so visually it's fresh, but keep it near 0
    state.currentRotation = state.currentRotation % 360; 
    els.canvas.style.transform = `rotate(${state.currentRotation}deg)`;
    
    drawWheel();
    saveState();
}

/* ========================================
   Drawing the Canvas Wheel
   ======================================== */
function drawWheel() {
    const width = els.canvas.width;
    const height = els.canvas.height;
    const center = width / 2;
    const radius = width / 2;
    
    ctx.clearRect(0, 0, width, height);

    if (state.names.length === 0) {
        // Draw empty grey wheel
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#2c2c54';
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px "Noto Sans TC"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('沒有名單', center, center - 60);
        return;
    }

    const sliceAngle = (2 * Math.PI) / state.names.length;

    for (let i = 0; i < state.names.length; i++) {
        const startAngle = i * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();

        // Ensure adjacent colors aren't the same if possible
        let colorIdx = i % COLORS.length;
        // Logic to prevent first and last from having same color if odd
        if (i === state.names.length - 1 && colorIdx === 0 && state.names.length > 1) {
            colorIdx = 1; 
        }
        ctx.fillStyle = COLORS[colorIdx];
        ctx.fill();
        
        // Slice Borders
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(startAngle + sliceAngle / 2);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        // Dynamic font size
        const fontSize = Math.max(16, Math.min(32, 450 / state.names.length));
        ctx.font = `bold ${fontSize}px "Noto Sans TC"`;
        
        // Shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        
        const name = state.names[i];
        const displayTxt = name.length > 15 ? name.substring(0,12)+'...' : name;
        
        // Vertical text rendering from outside to inside (rotated 180 deg)
        let xPos = radius - 55;
        let charIndex = 0;
        
        // 檢查前兩碼是否為數字，若是的話則將它合併成單一字串以橫排繪製
        if (/^\d{2}/.test(displayTxt)) {
            const prefix = displayTxt.substring(0, 2);
            charIndex = 2;
            
            ctx.save();
            ctx.translate(xPos, 0);
            ctx.rotate(Math.PI / 2); 
            ctx.fillText(prefix, 0, 0);
            ctx.restore();
            
            xPos -= (fontSize + 6);
        }
        
        // 繪製剩下的字元（過濾掉空白字元以避免多餘的斷點）
        for (; charIndex < displayTxt.length; charIndex++) {
            const char = displayTxt[charIndex];
            if (char.trim() === '') continue; // 略過空白字元
            
            ctx.save();
            ctx.translate(xPos, 0);
            ctx.rotate(Math.PI / 2); // Rotate +90 degrees (+180 from previous -90)
            ctx.fillText(char, 0, 0);
            ctx.restore();
            
            xPos -= (fontSize + 6); // Move inwards for next character
        }
        ctx.restore();
    }
}

/* ========================================
   Spin Logic & Announcing
   ======================================== */
function spinWheel() {
    if (state.isSpinning || state.names.length === 0) return;
    
    // Determine number of winners
    let numDraws = Math.min(state.drawCount, state.names.length);
    
    // Pick winners randomly without replacement
    let pool = [...state.names];
    let winners = [];
    let winnerIndices = [];

    for (let k=0; k<numDraws; k++) {
        const rndIdx = Math.floor(Math.random() * pool.length);
        const wName = pool[rndIdx];
        winners.push(wName);
        pool.splice(rndIdx, 1);
        if (k===0) {
            // First winner configures the wheel landing
            winnerIndices.push(state.names.indexOf(wName));
        }
    }

    state.isSpinning = true;
    els.btnSpin.disabled = true;

    // Index of the 1st winner
    const winningIndex = winnerIndices[0];

    const sliceAngle = 360 / state.names.length;
    // Calculate the center of the winning slice (in degrees)
    // Canvas starts drawing at 0 degrees (3 o'clock). Pointer is at 270 degrees (12 o'clock).
    // We want the wheel rotation to align the slice center with 270 degrees.
    const sliceCenter = (winningIndex * sliceAngle) + (sliceAngle / 2);
    
    // Extra rotations for the spin effect (5 full spins)
    const extraSpins = 5 * 360; 
    
    // Add a random offset within the slice so it doesn't always stop dead center.
    // Offset between -sliceAngle/2 + 5 degrees and +sliceAngle/2 - 5 degrees (padding)
    const padding = Math.min(5, sliceAngle / 4);
    const randomOffset = (Math.random() - 0.5) * (sliceAngle - padding * 2);
    
    // Target rotation: 
    // Wheel rotated by R -> 0-deg slice moves to R.
    // So slice 'winningIndex' is at `sliceCenter + R`.
    // To hit pointer at 270:  sliceCenter + R = 270 (mod 360)
    // R = 270 - sliceCenter.
    let targetRotation = 270 - sliceCenter + randomOffset;
    
    // Ensure rotation is positive and adds extra spins
    const rotationsToAdd = extraSpins + (360 - (state.currentRotation % 360)) + targetRotation;
    const finalRotation = state.currentRotation + rotationsToAdd;

    // Animate via CSS transition
    els.canvas.style.transition = 'transform 4s cubic-bezier(0.1, 0.9, 0.2, 1)';
    els.canvas.style.transform = `rotate(${finalRotation}deg)`;

    // Wait for transition to end
    setTimeout(() => {
        state.isSpinning = false;
        els.btnSpin.disabled = false;
        state.currentRotation = finalRotation;
        state.currentWinners = winners;
        
        onDrawComplete(winners);
    }, 4100);
}

function onDrawComplete(winners) {
    // 1. Add to history
    state.drawnHistory.push({ winners: winners, kept: [] });
    updateHistoryUI();
    saveState();

    // 2. Show Modal Celebration (decision to hide is made here)
    showModal(winners);
}

function hideWinners(winners) {
    state.names = state.names.filter(n => !winners.includes(n));
    els.namesInput.value = state.names.join('\n');
    
    // Remove transition to redraw without animation jump
    els.canvas.style.transition = 'none';
    
    // Update UI
    updateNamesFromInput();
}

/* ========================================
   History UI
   ======================================== */
function updateHistoryUI() {
    els.historyList.innerHTML = '';
    if (state.drawnHistory.length === 0) {
        els.historyList.innerHTML = '<li class="empty-msg">尚未開始抽籤</li>';
        return;
    }

    // Show newest first
    const reversed = [...state.drawnHistory].reverse();
    reversed.forEach((record, i) => {
        const roundNum = state.drawnHistory.length - i;
        const li = document.createElement('li');
        
        const isArray = Array.isArray(record);
        const winners = isArray ? record : record.winners;
        const kept = isArray ? [] : record.kept;

        // "保留學生以刪除線方式顯示"
        const winnersHtml = winners.map(w => {
            if (kept.includes(w)) {
                return `<del style="opacity: 0.5;">${w}</del>`;
            }
            return w;
        }).join('、');

        li.innerHTML = `第 ${roundNum} 次：${winnersHtml}`;
        els.historyList.appendChild(li);
    });
}

/* ========================================
   Modal & Confetti Animation
   ======================================== */
function showModal(winners) {
    els.winnersContainer.innerHTML = '';
    state.modalWinners = winners.map(w => ({ name: w, hide: true })); // 預設隱藏

    state.modalWinners.forEach(item => {
        const block = document.createElement('div');
        block.className = 'winner-card';
        if (item.hide) {
            block.classList.add('is-hidden');
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'winner-name';
        nameSpan.textContent = item.name;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-hide-toggle';
        if (item.hide) {
            toggleBtn.classList.add('is-active');
            toggleBtn.innerHTML = '❌ 隱藏';
        } else {
            toggleBtn.innerHTML = '✔️ 保留';
        }
        
        toggleBtn.onclick = () => {
            item.hide = !item.hide;
            if (item.hide) {
                block.classList.add('is-hidden');
                toggleBtn.classList.add('is-active');
                toggleBtn.innerHTML = '❌ 隱藏';
            } else {
                block.classList.remove('is-hidden');
                toggleBtn.classList.remove('is-active');
                toggleBtn.innerHTML = '✔️ 保留';
            }
        };

        block.appendChild(nameSpan);
        block.appendChild(toggleBtn);
        els.winnersContainer.appendChild(block);
    });

    els.resultModal.classList.add('active');
    triggerConfetti();
}

function closeModal() {
    els.resultModal.classList.remove('active');
    els.confettiContainer.innerHTML = '';
}

function triggerConfetti() {
    els.confettiContainer.innerHTML = '';
    const colors = ['#feca57', '#ff6b6b', '#1dd1a1', '#54a0ff', '#ff9fe5'];
    
    for(let i=0; i<60; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + '%';
        conf.style.background = colors[Math.floor(Math.random() * colors.length)];
        
        // Random animation variations
        const duration = 1 + Math.random() * 2;
        const delay = Math.random() * 0.5;
        conf.style.animation = `makeItRain ${duration}s ${delay}s ease-out forwards`;
        
        els.confettiContainer.appendChild(conf);
    }
}

// Start
init();
