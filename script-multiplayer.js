// ====== MULTIPLAYER MAFIA GAME ======
// Conectare Socket.io
const socket = io();

// ====== CONFIGURARE & CONSTANTE ======
const ROLES = {
    MAFIA: {
        name: 'Mafia',
        icon: '🔫',
        description: 'Elimini un cetățean în fiecare noapte. Obiectiv: Rămâi în majoritate.',
        class: 'mafia'
    },
    DOCTOR: {
        name: 'Doctor',
        icon: '💊',
        description: 'Poți salva o persoană în fiecare noapte (inclusiv pe tine).',
        class: 'doctor'
    },
    DETECTIVE: {
        name: 'Detectiv',
        icon: '🔍',
        description: 'Investighezi un jucător în fiecare noapte pentru a afla dacă este Mafia.',
        class: 'detective'
    },
    CITIZEN: {
        name: 'Cetățean',
        icon: '👤',
        description: 'Nu ai abilități speciale. Ajută orașul să găsească Mafia prin vot.',
        class: 'citizen'
    },
    NARRATOR: {
        name: 'Povestitor',
        icon: '🎭',
        description: 'Moderezi jocul. Vezi toate rolurile dar nu participi activ.',
        class: 'narrator'
    }
};

// Stare locală
let myRole = null;
let myId = null;
let roomCode = null;
let isHost = false;
let currentPlayers = [];
let mafiaTeam = []; // Lista membrilor Mafia (dacă ești Mafia)
let allRoles = []; // Toate rolurile (dacă ești Narrator)
let isMafiaChatOpen = false;

// ====== INIȚIALIZARE ======
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    setupSocketListeners();
});

function initializeEventListeners() {
    // Meniu principal
    document.getElementById('create-room-btn').addEventListener('click', () => switchScreen('create-room-screen'));
    document.getElementById('join-room-btn').addEventListener('click', () => switchScreen('join-room-screen'));
    
    // Back buttons
    document.getElementById('back-to-menu-btn').addEventListener('click', () => switchScreen('main-menu-screen'));
    document.getElementById('back-to-menu-btn-2').addEventListener('click', () => switchScreen('main-menu-screen'));
    
    // Role count update
    const roleInputs = ['host-mafia-count', 'host-doctor-count', 'host-detective-count'];
    roleInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', updateTotalRoles);
        }
    });
    
    // Create room
    document.getElementById('confirm-create-btn').addEventListener('click', createRoom);
    
    // Join room
    document.getElementById('confirm-join-btn').addEventListener('click', joinRoom);
    document.getElementById('room-code').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Lobby
    document.getElementById('start-game-lobby-btn').addEventListener('click', startGame);
    document.getElementById('leave-lobby-btn').addEventListener('click', () => location.reload());
    
    // Mafia chat
    const sendMafiaBtn = document.getElementById('send-mafia-message-btn');
    const mafiaInput = document.getElementById('mafia-chat-input');
    const toggleChatBtn = document.getElementById('toggle-mafia-chat-btn');
    
    if (sendMafiaBtn) {
        sendMafiaBtn.addEventListener('click', sendMafiaMessage);
    }
    if (mafiaInput) {
        mafiaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMafiaMessage();
        });
    }
    if (toggleChatBtn) {
        toggleChatBtn.addEventListener('click', toggleMafiaChat);
    }
    
    // Joc din nou
    document.getElementById('play-again-btn').addEventListener('click', () => location.reload());
}

// Update total roles count
function updateTotalRoles() {
    const mafia = parseInt(document.getElementById('host-mafia-count').value) || 0;
    const doctor = parseInt(document.getElementById('host-doctor-count').value) || 0;
    const detective = parseInt(document.getElementById('host-detective-count').value) || 0;
    const total = mafia + doctor + detective;
    document.getElementById('total-special-roles').textContent = total;
}
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Lobby
    document.getElementById('start-game-lobby-btn').addEventListener('click', startGame);
    document.getElementById('leave-lobby-btn').addEventListener('click', () => location.reload());
    
    // Joc din nou
    document.getElementById('play-again-btn').addEventListener('click', () => location.reload());
}

// ====== SOCKET LISTENERS ======
function setupSocketListeners() {
    // Cameră creată
    socket.on('room-created', (data) => {
        roomCode = data.roomCode;
        isHost = true;
        currentPlayers = data.players;
        
        switchScreen('lobby-screen');
        document.getElementById('display-room-code').textContent = roomCode;
        document.getElementById('host-controls').style.display = 'block';
        updateLobbyPlayers(data.players);
    });
    
    // Jucător s-a alăturat
    socket.on('player-joined', (data) => {
        currentPlayers = data.players;
        updateLobbyPlayers(data.players);
        showNotification(`${data.newPlayer} s-a alăturat jocului!`, 'success');
    });
    
    // Jucător a plecat
    socket.on('player-left', (data) => {
        currentPlayers = data.players;
        updateLobbyPlayers(data.players);
    });
    
    // Joc început
    socket.on('game-started', (data) => {
        myRole = data.role;
        currentPlayers = data.players;
        
        // Dacă ești Mafia, primești lista echipei
        if (data.mafiaTeam) {
            mafiaTeam = data.mafiaTeam;
        }
        
        // Dacă ești Narrator, primești toate rolurile
        if (data.allRoles) {
            allRoles = data.allRoles;
        }
        
        showMyRole();
    });
    
    // Noapte începută
    socket.on('night-started', (data) => {
        startNightPhase(data);
    });
    
    // Rezultat detectiv
    socket.on('detective-result', (data) => {
        showDetectiveResult(data);
    });
    
    // Zi începută
    socket.on('day-started', (data) => {
        startDayPhase(data);
    });
    
    // Vot înregistrat
    socket.on('vote-cast', (data) => {
        updateVoteDisplay(data);
    });
    
    // Jucător eliminat
    socket.on('player-eliminated', (data) => {
        showEliminationResult(data);
    });
    
    // Joc terminat
    socket.on('game-ended', (data) => {
        showGameEnd(data);
    });
    
    // Erori
    socket.on('error', (data) => {
        showNotification(data.message, 'error');
    });    
    // Mafia chat message
    socket.on('mafia-chat-message', (message) => {
        displayMafiaMessage(message);
    });}

// ====== FUNCȚII CAMERĂ ======
function createRoom() {
    const playerName = document.getElementById('host-name').value.trim();
    const mafiaCount = parseInt(document.getElementById('host-mafia-count').value);
    const doctorCount = parseInt(document.getElementById('host-doctor-count').value);
    const detectiveCount = parseInt(document.getElementById('host-detective-count').value);
    
    if (!playerName) {
        showNotification('Introdu un nume!', 'error');
        return;
    }
    
    socket.emit('create-room', {
        playerName: playerName,
        roleConfig: {
            mafiaCount: mafiaCount,
            doctorCount: doctorCount,
            detectiveCount: detectiveCount
        }
    });
}

function joinRoom() {
    const playerName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    
    if (!playerName) {
        showNotification('Introdu un nume!', 'error');
        return;
    }
    
    if (!code || code.length !== 6) {
        showNotification('Introdu un cod valid de 6 caractere!', 'error');
        return;
    }
    
    socket.emit('join-room', {
        roomCode: code,
        playerName: playerName
    });
    
    roomCode = code;
    switchScreen('lobby-screen');
    document.getElementById('display-room-code').textContent = code;
}

function updateLobbyPlayers(players) {
    const list = document.getElementById('lobby-players-list');
    list.innerHTML = '';
    
    document.getElementById('player-count').textContent = players.length;
    
    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'lobby-player-item';
        item.innerHTML = `
            <span>${player.isHost ? '👑' : '👤'} ${player.name}</span>
            ${player.isHost ? '<span class="host-badge">HOST</span>' : ''}
        `;
        list.appendChild(item);
    });
    
    // Actualizează butonul de start
    const startBtn = document.getElementById('start-game-lobby-btn');
    if (isHost) {
        startBtn.disabled = players.length < 4;
    }
}

function startGame() {
    socket.emit('start-game');
}

// ====== AFIȘARE ROL ======
function showMyRole() {
    // Dacă ești Narrator (host), arată ecranul special
    if (myRole === 'NARRATOR') {
        showNarratorScreen();
        return;
    }
    
    const roleInfo = ROLES[myRole];
    
    switchScreen('my-role-screen');
    
    const roleCard = document.getElementById('my-role-display');
    roleCard.className = `role-card ${roleInfo.class}`;
    
    document.getElementById('my-role-icon').textContent = roleInfo.icon;
    document.getElementById('my-role-name').textContent = roleInfo.name;
    document.getElementById('my-role-description').textContent = roleInfo.description;
    
    // Dacă ești Mafia, arată echipa ta
    if (myRole === 'MAFIA' && mafiaTeam.length > 0) {
        const teamInfo = document.createElement('div');
        teamInfo.className = 'mafia-team-info';
        teamInfo.innerHTML = `
            <h3>🤝 Echipa Ta Mafia:</h3>
            <ul>
                ${mafiaTeam.map(member => `<li>${member.name}</li>`).join('')}
            </ul>
            <p class="instruction">💬 Folosește chat-ul secret pentru a coordona acțiunile!</p>
        `;
        roleCard.appendChild(teamInfo);
        
        // Activează chat-ul Mafia
        showMafiaChat();
    }
}

// ====== ECRAN NARRATOR (HOST) ======
function showNarratorScreen() {
    switchScreen('narrator-screen');
    
    // Populează lista de jucători cu roluri
    const playersList = document.getElementById('narrator-players-list');
    playersList.innerHTML = '';
    
    allRoles.forEach(player => {
        const roleInfo = ROLES[player.role] || { icon: '❓', name: player.role };
        const playerItem = document.createElement('div');
        playerItem.className = `narrator-player-item ${player.alive ? 'alive' : 'dead'}`;
        playerItem.innerHTML = `
            <span class="player-name">${player.alive ? '✅' : '💀'} ${player.name}</span>
            <span class="player-role ${ROLES[player.role]?.class || ''}">${roleInfo.icon} ${roleInfo.name}</span>
        `;
        playersList.appendChild(playerItem);
    });
    
    // Setup chat Mafia pentru monitoring
    const mafiaMessages = document.getElementById('narrator-mafia-messages');
    mafiaMessages.innerHTML = '<p class="instruction">📡 Monitorizezi chat-ul Mafia...</p>';
    
    // Setup event listener pentru end game
    document.getElementById('narrator-end-game-btn').addEventListener('click', () => {
        if (confirm('Sigur vrei să închei jocul?')) {
            location.reload();
        }
    });
}

// ====== FAZA DE NOAPTE ======
function startNightPhase(data) {
    switchScreen('night-screen');
    document.getElementById('night-round').textContent = data.round;
    
    const container = document.getElementById('night-action-container');
    
    // Afișează acțiunea specifică rolului
    if (myRole === 'MAFIA') {
        showMafiaAction(data.alivePlayers);
    } else if (myRole === 'DOCTOR') {
        showDoctorAction(data.alivePlayers);
    } else if (myRole === 'DETECTIVE') {
        showDetectiveAction(data.alivePlayers);
    } else {
        // Cetățean
        container.innerHTML = `
            <div class="action-info">
                <h2>😴 Orașul Doarme</h2>
                <p class="instruction">Tu ești cetățean. Așteaptă până dimineață...</p>
                <div class="waiting-spinner">⏳</div>
            </div>
        `;
    }
}

function showMafiaAction(players) {
    const container = document.getElementById('night-action-container');
    const targets = players.filter(p => {
        const player = currentPlayers.find(cp => cp.id === p.id);
        return player && player.role !== 'MAFIA';
    });
    
    container.innerHTML = `
        <div class="action-info">
            <h2>🔫 Alege Victima</h2>
            <p class="instruction">Selectează un jucător pentru eliminare</p>
        </div>
        <div class="players-grid" id="action-targets"></div>
        <button class="btn btn-danger" id="confirm-action-btn" disabled>Confirmă Alegerea</button>
    `;
    
    renderActionTargets(targets, 'mafia');
}

function showDoctorAction(players) {
    const container = document.getElementById('night-action-container');
    
    container.innerHTML = `
        <div class="action-info">
            <h2>💊 Salvează un Jucător</h2>
            <p class="instruction">Alege pe cine să salvezi (poți să te alegi pe tine)</p>
        </div>
        <div class="players-grid" id="action-targets"></div>
        <button class="btn btn-secondary" id="confirm-action-btn" disabled>Confirmă Alegerea</button>
    `;
    
    renderActionTargets(players, 'doctor');
}

function showDetectiveAction(players) {
    const container = document.getElementById('night-action-container');
    const targets = players.filter(p => p.id !== socket.id);
    
    container.innerHTML = `
        <div class="action-info">
            <h2>🔍 Investighează un Jucător</h2>
            <p class="instruction">Selectează un jucător pentru a afla dacă este Mafia</p>
        </div>
        <div class="players-grid" id="action-targets"></div>
        <button class="btn btn-secondary" id="confirm-action-btn" disabled>Confirmă Investigația</button>
    `;
    
    renderActionTargets(targets, 'detective');
}

function renderActionTargets(players, actionType) {
    const container = document.getElementById('action-targets');
    let selectedTarget = null;
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `<h3>${player.name}</h3>`;
        
        card.addEventListener('click', () => {
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedTarget = player.id;
            document.getElementById('confirm-action-btn').disabled = false;
        });
        
        container.appendChild(card);
    });
    
    document.getElementById('confirm-action-btn').addEventListener('click', () => {
        if (selectedTarget) {
            socket.emit('night-action', {
                actionType: actionType,
                targetId: selectedTarget
            });
            
            // Afișează mesaj de confirmare
            container.parentElement.innerHTML = `
                <div class="action-info">
                    <h2>✅ Acțiune Confirmată</h2>
                    <p class="instruction">Așteaptă ca ceilalți jucători să își facă alegerile...</p>
                    <div class="waiting-spinner">⏳</div>
                </div>
            `;
        }
    });
}

function showDetectiveResult(data) {
    const container = document.getElementById('night-action-container');
    container.innerHTML = `
        <div class="action-info">
            <h2>🔍 Rezultat Investigație</h2>
            <div class="result-message" style="font-size: 1.5rem; margin: 30px 0;">
                ${data.targetName} ${data.isMafia ? '❌ ESTE MAFIA!' : '✅ NU este Mafia'}
            </div>
            <p class="instruction">Memorează această informație!</p>
        </div>
    `;
}

// ====== FAZA DE ZI ======
function startDayPhase(data) {
    switchScreen('day-screen');
    document.getElementById('day-round').textContent = data.round;
    
    // Afișează rezultatele nopții
    const resultsContainer = document.getElementById('night-results');
    
    if (data.victim) {
        resultsContainer.innerHTML = `
            <div class="result-message death">
                💀 <strong>${data.victim.name}</strong> a fost eliminat în timpul nopții!
            </div>
        `;
    } else if (data.saved) {
        resultsContainer.innerHTML = `
            <div class="result-message saved">
                ✨ Nimeni nu a murit! Doctorul a salvat victima!
            </div>
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="result-message">
                🌅 Orașul se trezește liniștit...
            </div>
        `;
    }
    
    // Afișează jucătorii pentru vot
    renderVotingPlayers(data.alivePlayers);
}

function renderVotingPlayers(players) {
    const container = document.getElementById('alive-players-list');
    container.innerHTML = '';
    let selectedVote = null;
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <h3>${player.name}</h3>
            <p class="status">Click pentru a vota</p>
        `;
        
        card.addEventListener('click', () => {
            if (selectedVote === player.id) return; // Deja a votat
            
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedVote = player.id;
            
            // Trimite votul
            socket.emit('vote', { targetId: player.id });
            
            // Disabled voting
            container.querySelectorAll('.player-card').forEach(c => {
                c.style.pointerEvents = 'none';
            });
            card.innerHTML = `
                <h3>${player.name}</h3>
                <p class="status">✅ Votat</p>
            `;
            
            showNotification('Vot înregistrat! Așteaptă ceilalți jucători...', 'success');
        });
        
        container.appendChild(card);
    });
}

function updateVoteDisplay(data) {
    // Actualizează interfața cu voturile (opțional)
}

function showEliminationResult(data) {
    const message = `
        <div class="result-message death" style="margin: 30px 0;">
            💀 <strong>${data.player.name}</strong> a fost eliminat prin vot!<br>
            Rolul său: ${ROLES[data.player.role].icon} ${ROLES[data.player.role].name}
        </div>
    `;
    
    document.getElementById('night-results').innerHTML += message;
    
    showNotification(`${data.player.name} a fost eliminat!`, 'info');
}

// ====== ECRAN FINAL ======
function showGameEnd(data) {
    switchScreen('end-screen');
    
    const victoryMessage = document.getElementById('victory-message');
    const winnerTitle = document.getElementById('winner-title');
    const winnerSubtitle = document.getElementById('winner-subtitle');
    
    if (data.winner === 'mafia') {
        victoryMessage.className = 'victory-message mafia-win';
        winnerTitle.textContent = '🔫 MAFIA A CÂȘTIGAT!';
        winnerSubtitle.textContent = 'Crima organizată domină orașul...';
    } else {
        victoryMessage.className = 'victory-message town-win';
        winnerTitle.textContent = '🏛️ ORAȘUL A CÂȘTIGAT!';
        winnerSubtitle.textContent = 'Justiția a învins!';
    }
    
    // Afișează statistici finale
    const finalList = document.getElementById('final-player-list');
    finalList.innerHTML = '';
    
    data.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'final-player-item';
        
        const roleInfo = ROLES[player.role];
        
        item.innerHTML = `
            <div class="player-final-info">
                <span style="font-size: 1.5rem;">${player.alive ? '✅' : '💀'}</span>
                <strong>${player.name}</strong>
                <span class="role-badge ${roleInfo.class}">${roleInfo.icon} ${roleInfo.name}</span>
            </div>
            <span>${player.alive ? 'Supraviețuitor' : 'Eliminat'}</span>
        `;
        
        finalList.appendChild(item);
    });
}

// ====== MAFIA CHAT ======
function showMafiaChat() {
    const chatPanel = document.getElementById('mafia-chat-panel');
    chatPanel.classList.remove('hidden');
    
    // Populează membri Mafia
    const membersDiv = document.getElementById('mafia-chat-members');
    membersDiv.innerHTML = '<h4>Membrii echipei:</h4>' + 
        mafiaTeam.map(member => `<span class="mafia-member">🔫 ${member.name}</span>`).join('');
}

function toggleMafiaChat() {
    const chatPanel = document.getElementById('mafia-chat-panel');
    const content = chatPanel.querySelector('.mafia-chat-content');
    
    if (isMafiaChatOpen) {
        content.style.display = 'none';
        isMafiaChatOpen = false;
    } else {
        content.style.display = 'block';
        isMafiaChatOpen = true;
    }
}

function sendMafiaMessage() {
    const input = document.getElementById('mafia-chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    socket.emit('mafia-chat-message', { message });
    input.value = '';
}

function displayMafiaMessage(message) {
    // Afișează în chat-ul Mafia pentru jucători
    const mafiaMessages = document.getElementById('mafia-messages');
    if (mafiaMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <strong>${message.sender}:</strong> ${message.text}
            <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
        `;
        mafiaMessages.appendChild(messageDiv);
        mafiaMessages.scrollTop = mafiaMessages.scrollHeight;
    }
    
    // Afișează în ecranul narratorului pentru monitoring
    const narratorMessages = document.getElementById('narrator-mafia-messages');
    if (narratorMessages && myRole === 'NARRATOR') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <strong>${message.sender}:</strong> ${message.text}
            <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
        `;
        narratorMessages.appendChild(messageDiv);
        narratorMessages.scrollTop = narratorMessages.scrollHeight;
    }
}

// ====== UTILITĂȚI ======
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showNotification(message, type = 'info') {
    // Crează notificare
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? '#ff3333' : type === 'success' ? '#33ff99' : '#3399ff'};
        color: ${type === 'success' ? '#000' : '#fff'};
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// CSS pentru animații notificări
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);
