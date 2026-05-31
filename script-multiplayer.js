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
let myName = null; // Numele meu pentru reconnect
let roomCode = null;
let isHost = false;
let currentPlayers = [];
let mafiaTeam = []; // Lista membrilor Mafia (dacă ești Mafia)
let doctorTeam = []; // Lista membrilor Doctor
let detectiveTeam = []; // Lista membrilor Detective
let allRoles = []; // Toate rolurile (dacă ești Narrator)
let isMafiaChatOpen = false;
let isDoctorChatOpen = false;
let isDetectiveChatOpen = false;

// Team consensus pentru night actions
let teamChoices = {}; // { playerId: targetId }
let currentNightAction = null; // Stochează detalii despre acțiunea curentă { type, players, isTeam }

// ====== FUNCȚII PENTRU SALVAREA NUMELUI ======
function loadSavedName() {
    const savedName = localStorage.getItem('mafiaPlayerName');
    const rememberName = localStorage.getItem('mafiaRememberName') === 'true';
    
    if (savedName && rememberName) {
        // Precompletează ambele input-uri
        const hostInput = document.getElementById('host-name');
        const playerInput = document.getElementById('player-name');
        const rememberHostCheckbox = document.getElementById('remember-host-name');
        const rememberPlayerCheckbox = document.getElementById('remember-player-name');
        
        if (hostInput) hostInput.value = savedName;
        if (playerInput) playerInput.value = savedName;
        if (rememberHostCheckbox) rememberHostCheckbox.checked = true;
        if (rememberPlayerCheckbox) rememberPlayerCheckbox.checked = true;
    }
}

function saveName(name, remember) {
    if (remember) {
        localStorage.setItem('mafiaPlayerName', name);
        localStorage.setItem('mafiaRememberName', 'true');
    } else {
        localStorage.removeItem('mafiaPlayerName');
        localStorage.removeItem('mafiaRememberName');
    }
}

// ====== INIȚIALIZARE ======
document.addEventListener('DOMContentLoaded', () => {
    hideAllChats(); // Ascunde toate chat-urile la început
    loadSavedName(); // Încarcă numele salvat din localStorage
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
    
    // Remember name checkboxes
    const rememberHostCheckbox = document.getElementById('remember-host-name');
    const rememberPlayerCheckbox = document.getElementById('remember-player-name');
    
    if (rememberHostCheckbox) {
        rememberHostCheckbox.addEventListener('change', (e) => {
            const name = document.getElementById('host-name').value.trim();
            if (name) {
                saveName(name, e.target.checked);
            } else if (!e.target.checked) {
                saveName('', false);
            }
        });
    }
    
    if (rememberPlayerCheckbox) {
        rememberPlayerCheckbox.addEventListener('change', (e) => {
            const name = document.getElementById('player-name').value.trim();
            if (name) {
                saveName(name, e.target.checked);
            } else if (!e.target.checked) {
                saveName('', false);
            }
        });
    }
    
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
    document.getElementById('leave-lobby-btn').addEventListener('click', leaveLobby);
    
    // Mafia chat
    setupRoleChat('mafia');
    
    // Doctor chat
    setupRoleChat('doctor');
    
    // Detective chat
    setupRoleChat('detective');
    
    // Joc din nou
    document.getElementById('play-again-btn').addEventListener('click', playAgain);
}

// Setup chat pentru un rol specific
function setupRoleChat(role) {
    const sendBtn = document.getElementById(`send-${role}-message-btn`);
    const input = document.getElementById(`${role}-chat-input`);
    const toggleBtn = document.getElementById(`toggle-${role}-chat-btn`);
    
    if (sendBtn) {
        sendBtn.addEventListener('click', () => sendRoleMessage(role));
    }
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendRoleMessage(role);
        });
    }
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleRoleChat(role));
    }
}

// Leave lobby
function leaveLobby() {
    if (confirm('Sigur vrei să părăsești camera?')) {
        // Curăță datele de reconnect
        localStorage.removeItem('mafiaGameRoomCode');
        localStorage.removeItem('mafiaGamePlayerName');
        location.reload();
    }
}

// Play Again - Rămâi în același lobby
function playAgain() {
    socket.emit('restart-game');
    switchScreen('lobby-screen');
}

// Update total roles count
function updateTotalRoles() {
    const mafia = parseInt(document.getElementById('host-mafia-count').value) || 0;
    const doctor = parseInt(document.getElementById('host-doctor-count').value) || 0;
    const detective = parseInt(document.getElementById('host-detective-count').value) || 0;
    const total = mafia + doctor + detective;
    document.getElementById('total-special-roles').textContent = total;
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
    
    // Lobby închis (host a plecat)
    socket.on('lobby-closed', (data) => {
        // Curăță datele de reconnect când lobby-ul se închide
        localStorage.removeItem('mafiaGameRoomCode');
        localStorage.removeItem('mafiaGamePlayerName');
        
        showNotification(data.message, 'error');
        
        // Așteaptă 2 secunde și redirecționează la meniul principal
        setTimeout(() => {
            location.reload();
        }, 2000);
    });
    
    // Joc început
    socket.on('game-started', (data) => {
        myRole = data.role;
        const myModifier = data.modifier; // Primim modifier-ul nostru
        currentPlayers = data.players;
        
        // Salvează roomCode și myName pentru reconnect
        localStorage.setItem('mafiaGameRoomCode', roomCode);
        localStorage.setItem('mafiaGamePlayerName', myName);
        
        // Dacă ești Mafia, primești lista echipei
        if (data.mafiaTeam) {
            mafiaTeam = data.mafiaTeam;
        }
        
        // Dacă ești Doctor, primești lista echipei
        if (data.doctorTeam) {
            doctorTeam = data.doctorTeam;
        }
        
        // Dacă ești Detective, primești lista echipei
        if (data.detectiveTeam) {
            detectiveTeam = data.detectiveTeam;
        }
        
        // Dacă ești Narrator, primești toate rolurile
        if (data.allRoles) {
            allRoles = data.allRoles;
        }
        
        // Afișează Role Reveal Screen cu countdown de 10 secunde
        showRoleRevealWithCountdown(myRole, myModifier);
    });
    
    // Restart game
    socket.on('game-restarted', (data) => {
        // Reset stare
        myRole = null;
        mafiaTeam = [];
        doctorTeam = [];
        detectiveTeam = [];
        allRoles = [];
        swapperLiveVotes = {};
        isSwapper = false;
        
        // Revin la lobby
        switchScreen('lobby-screen');
        updateLobbyPlayers(data.players);
        showNotification('Joc resetat! Pregătiți-vă pentru o nouă rundă!', 'success');
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
    
    // === DISCUSSION TIMER (30 secunde) ===
    socket.on('discussion-started', (data) => {
        // Narrator NU vede discussion timer (rămâne pe ecranul său)
        if (myRole !== 'NARRATOR') {
            showDiscussionTimer(data.duration);
        }
    });
    
    // === VOTING PHASE ===
    socket.on('voting-started', (data) => {
        // Reset Swapper state la început de voting
        swapperLiveVotes = {};
        isSwapper = false;
        
        startVotingPhase(data);
    });
    
    // === SWAPPER MODIFIER EVENTS ===
    socket.on('swapper-revealed', (data) => {
        showNotification('🔄 ' + data.message, 'warning', 8000);
        console.log('🔄 SWAPPER modifier revealed');
    });
    
    socket.on('swapper-vote-update', (data) => {
        // Swapper vede voturile live
        updateSwapperLiveVotes(data);
    });
    
    socket.on('swapper-action-time', (data) => {
        // Toți au votat, Swapper poate face swap
        showSwapperSwapInterface(data);
    });
    
    socket.on('swapper-swap-confirmed', (data) => {
        showNotification('✅ ' + data.message, 'success', 5000);
    });
    
    socket.on('swapper-vote-now', (data) => {
        // După swap, Swapper votează
        showSwapperVotingInterface();
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
        // Curăță datele de reconnect când jocul se termină
        localStorage.removeItem('mafiaGameRoomCode');
        localStorage.removeItem('mafiaGamePlayerName');
        showGameEnd(data);
    });
    
    // Erori
    socket.on('error', (data) => {
        showNotification(data.message, 'error');
    });
    
    // Role chat messages
    socket.on('mafia-chat-message', (message) => {
        displayRoleMessage('mafia', message);
    });
    
    socket.on('doctor-chat-message', (message) => {
        displayRoleMessage('doctor', message);
    });
    
    socket.on('detective-chat-message', (message) => {
        displayRoleMessage('detective', message);
    });
    
    // Team consensus updates
    socket.on('team-consensus-update', (data) => {
        updateConsensusStatus(data);
    });
    
    socket.on('team-consensus-achieved', (data) => {
        // Consensul a fost atins, confirmă acțiunea
        const container = document.getElementById('night-action-container');
        if (container) {
            container.innerHTML = `
                <div class="action-info">
                    <h2>✅ Consens Echipă Atins!</h2>
                    <p class="instruction">Toți membrii echipei au ales: <strong>${data.targetName}</strong></p>
                    <p class="instruction">Așteaptă ca ceilalți jucători să își facă alegerile...</p>
                    <div class="waiting-spinner">⏳</div>
                </div>
            `;
        }
    });
    
    socket.on('team-consensus-failed', (data) => {
        showNotification('❌ Echipa ta a ales ținte diferite! Alegeți din nou aceeași persoană.', 'error');
        
        // Reconstruiește interfața folosind datele salvate
        if (currentNightAction) {
            const { type, players, isTeam } = currentNightAction;
            
            // Resetează statusul
            const statusDiv = document.getElementById('team-consensus-status');
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <p class="consensus-disagree">❌ Echipa a ales diferit! Alegeți DIN NOU aceeași persoană.</p>
                `;
            }
            
            // Reconstruiește lista de ținte
            renderActionTargets(players, type, isTeam);
        }
    });
    
    // Narrator updates - real-time monitoring
    socket.on('narrator-action-update', (data) => {
        if (myRole === 'NARRATOR') {
            updateNarratorActions(data);
        }
    });
    
    socket.on('narrator-vote-update', (data) => {
        if (myRole === 'NARRATOR') {
            updateNarratorVotes(data);
        }
    });
    
    // === MODIFIER EVENTS ===
    
    // SEER MODIFIER - Revelație rol țintă
    socket.on('seer-revelation', (data) => {
        showNotification(`👁️ SEER: ${data.targetName} este ${ROLES[data.targetRole]?.name || data.targetRole}!`, 'info', 5000);
        console.log('🔮 Seer revelation:', data);
        
        // NARRATOR: Monitorizează ce vede jucătorul cu SEER
        if (myRole === 'NARRATOR') {
            logNarratorSeerRevelation(data);
        }
    });
    
    // NARRATOR: Primește copie a tuturor Seer revelations
    socket.on('narrator-seer-revelation', (data) => {
        if (myRole === 'NARRATOR') {
            logNarratorSeerRevelation(data);
        }
    });
    
    // TRAITOR MODIFIER - Activare
    socket.on('traitor-activated', (data) => {
        myRole = 'MAFIA'; // Acum ești MAFIA
        showNotification('🎭 ' + data.message, 'warning', 8000);
        
        // Update role display dacă există
        const roleNameEl = document.getElementById('my-role-name');
        const roleIconEl = document.getElementById('my-role-icon');
        const roleDescEl = document.getElementById('my-role-description');
        
        if (roleNameEl) roleNameEl.textContent = ROLES.MAFIA.name;
        if (roleIconEl) roleIconEl.textContent = ROLES.MAFIA.icon;
        if (roleDescEl) roleDescEl.textContent = ROLES.MAFIA.description;
        
        console.log('🎭 TRAITOR ACTIVATED - Now MAFIA');
    });
    
    // TIEBREAKER MODIFIER - Notificare activare
    socket.on('tiebreaker-activated', (data) => {
        showNotification(`⚖️ TIEBREAKER: Votul lui ${data.tiebreakerName} a decis eliminarea lui ${data.eliminatedName}!`, 'info', 5000);
        console.log('⚖️ Tiebreaker activated:', data);
    });
    
    // HEALER HIT - Notificare pentru Narrator când jucător cu HEALER e lovit
    socket.on('narrator-healer-hit', (data) => {
        if (myRole === 'NARRATOR') {
            logNarratorModifierEvent(`🛡️ ${data.playerName} a fost lovit! (HEALER: ${data.hitCount}/2 lovituri)`, 'healer');
        }
    });
    
    // NARRATOR - Notificări speciale
    socket.on('narrator-notification', (data) => {
        if (myRole === 'NARRATOR') {
            showNotification(data.message, 'info', 5000);
            logNarratorModifierEvent(data.message, 'info');
        }
    });
    
    // === HOST MANUAL CONTROL EVENTS ===
    
    // Host poate începe noaptea după role reveal
    socket.on('ready-for-night', (data) => {
        if (myRole === 'NARRATOR') {
            showHostControlButton('start-night', 'Începe Noaptea', data.message);
        }
    });
    
    // Host poate începe ziua după acțiuni noapte
    socket.on('ready-for-day', (data) => {
        if (myRole === 'NARRATOR') {
            showHostControlButton('start-day', 'Începe Ziua', data.message);
        }
    });
    
    // Host poate începe următoarea rundă după voturi
    socket.on('ready-for-next-round', (data) => {
        if (myRole === 'NARRATOR') {
            showHostControlButton('next-round', 'Următoarea Rundă', data.message);
        }
    });
    
    // === SPECTATOR MODE EVENT ===
    
    // Jucător mort devine spectator
    socket.on('enter-spectator-mode', (data) => {
        showNotification(data.message, 'info', 8000);
        
        // Actualizează variabila globală allRoles cu informații complete
        allRoles = data.allRoles;
        
        // Afișează ecranul de spectator
        showSpectatorScreen();
    });
    
    // Disconnect/Reconnect events
    socket.on('disconnect', () => {
        console.log('⚠️ Deconectat de la server');
        
        // Dacă suntem în joc (nu în lobby/menu), arată opțiunea de reconnect
        const savedRoomCode = localStorage.getItem('mafiaGameRoomCode');
        const savedPlayerName = localStorage.getItem('mafiaGamePlayerName');
        
        if (savedRoomCode && savedPlayerName) {
            showReconnectOption();
        }
    });
    
    socket.on('player-disconnected', (data) => {
        showNotification(`⚠️ ${data.playerName} s-a deconectat - are 5 minute pentru reconnect`, 'warning');
        currentPlayers = data.players;
    });
    
    socket.on('player-reconnected', (data) => {
        showNotification(`✅ ${data.playerName} s-a reconectat!`, 'success');
        currentPlayers = data.players;
    });
    
    socket.on('player-removed-timeout', (data) => {
        showNotification(`❌ ${data.playerName} a fost eliminat (timeout reconnect)`, 'error');
        currentPlayers = data.players;
    });
    
    socket.on('game-rejoined', (data) => {
        // Restaurează starea completă de joc
        const player = data.player;
        const room = data.room;
        
        roomCode = room.code;
        currentPlayers = room.players;
        myRole = player.role;
        myId = player.id;
        isHost = player.isHost || false;
        
        // Restaurează echipele - folosește toți jucătorii, nu doar cei vii
        const allGamePlayers = [...(room.gameState.alivePlayers || []), ...(room.gameState.deadPlayers || [])];
        mafiaTeam = allGamePlayers.filter(p => p.role === 'MAFIA');
        doctorTeam = allGamePlayers.filter(p => p.role === 'DOCTOR');
        detectiveTeam = allGamePlayers.filter(p => p.role === 'DETECTIVE');
        
        // Dacă ești Narrator
        if (myRole === 'NARRATOR') {
            allRoles = room.players.filter(p => p.role !== undefined);
        }
        
        showNotification('✅ Reconectat cu succes!', 'success');
        
        // Navighează la ecranul potrivit în funcție de faza jocului
        if (room.gameState.phase === 'lobby') {
            switchScreen('lobby-screen');
            document.getElementById('display-room-code').textContent = roomCode;
            if (isHost) {
                document.getElementById('host-controls').style.display = 'block';
            }
            updateLobbyPlayers(room.players);
        } else if (room.gameState.phase === 'night') {
            startNightPhase({ round: room.gameState.round, alivePlayers: room.gameState.alivePlayers });
        } else if (room.gameState.phase === 'day') {
            startDayPhase({ 
                round: room.gameState.round, 
                alivePlayers: room.gameState.alivePlayers,
                victim: null,
                saved: false
            });
        } else if (myRole === 'NARRATOR') {
            showNarratorScreen();
        } else {
            showMyRole();
        }
    });
}

// ====== FUNCȚIE RECONNECT ======
function showReconnectOption() {
    // Verifică dacă overlay-ul există deja pentru a preveni duplicate
    if (document.getElementById('reconnect-overlay')) {
        return;
    }
    
    const container = document.querySelector('.container');
    const reconnectDiv = document.createElement('div');
    reconnectDiv.id = 'reconnect-overlay';
    reconnectDiv.className = 'reconnect-overlay';
    reconnectDiv.innerHTML = `
        <div class="reconnect-box">
            <h2>⚠️ Conexiune Pierdută</h2>
            <p>S-a întrerupt conexiunea cu serverul.</p>
            <p>Vrei să te reconectezi la joc?</p>
            <button class="btn btn-primary" onclick="rejoinGame()">🔄 Reconectează</button>
            <button class="btn btn-secondary" onclick="cancelReconnect()">❌ Anulează</button>
        </div>
    `;
    container.appendChild(reconnectDiv);
}

function rejoinGame() {
    const savedRoomCode = localStorage.getItem('mafiaGameRoomCode');
    const savedPlayerName = localStorage.getItem('mafiaGamePlayerName');
    
    if (!savedRoomCode || !savedPlayerName) {
        showNotification('Nu există date de reconnect!', 'error');
        return;
    }
    
    // Elimină overlay-ul
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    showNotification('🔄 Încerc reconnect...', 'info');
    
    socket.emit('rejoin-room', {
        roomCode: savedRoomCode,
        playerName: savedPlayerName
    });
}

function cancelReconnect() {
    // Curăță localStorage
    localStorage.removeItem('mafiaGameRoomCode');
    localStorage.removeItem('mafiaGamePlayerName');
    
    // Elimină overlay-ul
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Revin la meniul principal
    switchScreen('main-menu-screen');
}

// ====== FUNCȚII CAMERĂ ======
function createRoom() {
    const playerName = document.getElementById('host-name').value.trim();
    const mafiaCount = parseInt(document.getElementById('host-mafia-count').value);
    const doctorCount = parseInt(document.getElementById('host-doctor-count').value);
    const detectiveCount = parseInt(document.getElementById('host-detective-count').value);
    const rememberName = document.getElementById('remember-host-name').checked;
    
    // Modifiers
    const traitorCount = parseInt(document.getElementById('modifier-traitor-count').value) || 0;
    const healerCount = parseInt(document.getElementById('modifier-healer-count').value) || 0;
    const seerCount = parseInt(document.getElementById('modifier-seer-count').value) || 0;
    const tiebreakerCount = parseInt(document.getElementById('modifier-tiebreaker-count').value) || 0;
    
    if (!playerName) {
        showNotification('Introdu un nume!', 'error');
        return;
    }
    
    if (playerName.length > 20) {
        showNotification('Numele este prea lung (max 20 caractere)!', 'error');
        return;
    }
    
    // Salvează numele global și în localStorage
    myName = playerName;
    saveName(playerName, rememberName);
    
    socket.emit('create-room', {
        playerName: playerName,
        roleConfig: {
            mafiaCount: mafiaCount,
            doctorCount: doctorCount,
            detectiveCount: detectiveCount,
            modifierConfig: {
                enabled: (traitorCount + healerCount + seerCount + tiebreakerCount) > 0,
                traitor: { 
                    count: traitorCount, 
                    roleChances: { MAFIA: 10, DOCTOR: 50, DETECTIVE: 50, CITIZEN: 50 } 
                },
                healer: { 
                    count: healerCount, 
                    roleChances: { DOCTOR: 50, DETECTIVE: 50, CITIZEN: 50 } 
                },
                seer: { 
                    count: seerCount, 
                    roleChances: { MAFIA: 50, DOCTOR: 50, CITIZEN: 50 } 
                },
                tiebreaker: { 
                    count: tiebreakerCount, 
                    roleChances: { MAFIA: 10, DOCTOR: 90, DETECTIVE: 90, CITIZEN: 90 } 
                }
            }
        }
    });
}

function joinRoom() {
    const playerName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    const rememberName = document.getElementById('remember-player-name').checked;
    
    if (!playerName) {
        showNotification('Introdu un nume!', 'error');
        return;
    }
    
    if (playerName.length > 20) {
        showNotification('Numele este prea lung (max 20 caractere)!', 'error');
        return;
    }
    
    if (!code || code.length !== 4) {
        showNotification('Introdu un cod valid de 4 caractere!', 'error');
        return;
    }
    
    // Salvează numele global și în localStorage
    myName = playerName;
    saveName(playerName, rememberName);
    
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

// ====== AFIȘARE ROL CU COUNTDOWN (10 SECUNDE) ======
function showRoleRevealWithCountdown(role, modifier) {
    // Dacă ești Narrator (host), arată direct ecranul special
    if (role === 'NARRATOR') {
        showNarratorScreen();
        return;
    }
    
    const roleInfo = ROLES[role];
    
    // Creează overlay pentru role reveal cu countdown
    const overlay = document.createElement('div');
    overlay.id = 'role-reveal-overlay';
    overlay.className = 'role-reveal-overlay';
    
    // Informații modifier
    let modifierInfo = '';
    if (modifier && modifier !== 'TRAITOR' && modifier !== 'TIEBREAKER' && modifier !== 'SWAPPER') {
        // Doar HEALER și SEER sunt vizibile pentru jucător de la început
        // TRAITOR, TIEBREAKER și SWAPPER sunt secrete până la activare
        const modifierIcons = {
            'HEALER': '🛡️',
            'SEER': '👁️'
        };
        const modifierNames = {
            'HEALER': 'Healer',
            'SEER': 'Seer'
        };
        const modifierDescriptions = {
            'HEALER': 'Supraviețuiești primul kill - ai două vieți!',
            'SEER': 'Vezi rolul exact al țintei când acționezi asupra ei!'
        };
        
        if (modifierIcons[modifier]) {
            modifierInfo = `
                <div class="modifier-reveal">
                    <div class="modifier-icon">${modifierIcons[modifier]}</div>
                    <h3 class="modifier-name">${modifierNames[modifier]}</h3>
                    <p class="modifier-description">${modifierDescriptions[modifier]}</p>
                </div>
            `;
        }
    }
    
    overlay.innerHTML = `
        <div class="role-reveal-box">
            <div class="countdown-timer" id="countdown-timer">10</div>
            <div class="role-reveal-icon">${roleInfo.icon}</div>
            <h1 class="role-reveal-name">${roleInfo.name}</h1>
            <p class="role-reveal-description">${roleInfo.description}</p>
            ${modifierInfo}
            <p class="role-reveal-instruction">🔒 Păstrează-ți rolul secret!</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Countdown de 10 secunde
    let timeLeft = 10;
    const countdownEl = document.getElementById('countdown-timer');
    
    const countdownInterval = setInterval(() => {
        timeLeft--;
        if (countdownEl) {
            countdownEl.textContent = timeLeft;
            
            // Animație pulsare la ultimele 3 secunde
            if (timeLeft <= 3) {
                countdownEl.style.animation = 'pulse 0.5s infinite';
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            
            // Șterge overlay-ul
            if (overlay && overlay.parentNode) {
                overlay.remove();
            }
            
            // Afișează ecranul de rol normal
            showMyRole();
        }
    }, 1000);
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
    
    // Afișează echipa și chat doar dacă sunt 2+ membri
    if (myRole === 'MAFIA' && mafiaTeam.length >= 2) {
        showTeamInfo('MAFIA', mafiaTeam, roleCard);
        showRoleChat('mafia', mafiaTeam);
    }
    
    if (myRole === 'DOCTOR' && doctorTeam.length >= 2) {
        showTeamInfo('DOCTOR', doctorTeam, roleCard);
        showRoleChat('doctor', doctorTeam);
    }
    
    if (myRole === 'DETECTIVE' && detectiveTeam.length >= 2) {
        showTeamInfo('DETECTIVE', detectiveTeam, roleCard);
        showRoleChat('detective', detectiveTeam);
    }
}

// Afișează info echipă pe role card
function showTeamInfo(roleName, team, roleCard) {
    const roleEmojis = {
        'MAFIA': '🔫',
        'DOCTOR': '💊',
        'DETECTIVE': '🔍'
    };
    
    const roleNames = {
        'MAFIA': 'Mafia',
        'DOCTOR': 'Doctor',
        'DETECTIVE': 'Detectiv'
    };
    
    const teamInfo = document.createElement('div');
    teamInfo.className = `team-info ${roleName.toLowerCase()}-team-info`;
    teamInfo.innerHTML = `
        <h3>${roleEmojis[roleName]} Echipa Ta ${roleNames[roleName]}:</h3>
        <ul>
            ${team.map(member => `<li>${member.name}</li>`).join('')}
        </ul>
        <p class="instruction">💬 Folosește chat-ul secret pentru a coordona acțiunile!</p>
    `;
    roleCard.appendChild(teamInfo);
}

// ====== ECRAN NARRATOR (HOST) ======
function showNarratorScreen() {
    switchScreen('narrator-screen');
    
    // Populează lista de jucători cu roluri + modifiers
    const playersList = document.getElementById('narrator-players-list');
    playersList.innerHTML = '';
    
    allRoles.forEach(player => {
        const roleInfo = ROLES[player.role] || { icon: '❓', name: player.role };
        const playerItem = document.createElement('div');
        playerItem.className = `narrator-player-item ${player.alive ? 'alive' : 'dead'}`;
        
        // Modifier display (doar pentru narrator)
        let modifierBadge = '';
        if (player.modifier) {
            const modifierIcons = {
                'TRAITOR': '🎭',
                'HEALER': '🛡️',
                'SEER': '👁️',
                'TIEBREAKER': '⚖️',
                'SWAPPER': '🔄'
            };
            const modifierNames = {
                'TRAITOR': 'Traitor',
                'HEALER': 'Healer',
                'SEER': 'Seer',
                'TIEBREAKER': 'Tiebreaker',
                'SWAPPER': 'Swapper'
            };
            
            let extraInfo = '';
            // Arată hitCount pentru HEALER
            if (player.modifier === 'HEALER' && player.hitCount > 0) {
                extraInfo = ` (${player.hitCount}/2 lovituri)`;
            }
            
            modifierBadge = `<span class="modifier-badge" style="font-size: 0.8rem; color: #ffd700; margin-left: 8px;">${modifierIcons[player.modifier]} ${modifierNames[player.modifier]}${extraInfo}</span>`;
        }
        
        playerItem.innerHTML = `
            <span class="player-name">${player.alive ? '✅' : '💀'} ${player.name}</span>
            <span class="player-role ${ROLES[player.role]?.class || ''}">${roleInfo.icon} ${roleInfo.name}${modifierBadge}</span>
        `;
        playersList.appendChild(playerItem);
    });
    
    // Setup chat Mafia pentru monitoring
    const mafiaMessages = document.getElementById('narrator-mafia-messages');
    mafiaMessages.innerHTML = '<p class="instruction">📡 Monitorizezi chat-ul Mafia...</p>';
    
    // Setup event listener pentru end game - previne duplicate listeners
    const endGameBtn = document.getElementById('narrator-end-game-btn');
    const newEndGameBtn = endGameBtn.cloneNode(true);
    endGameBtn.parentNode.replaceChild(newEndGameBtn, endGameBtn);
    newEndGameBtn.addEventListener('click', () => {
        if (confirm('Sigur vrei să închei jocul?')) {
            location.reload();
        }
    });
}

// ====== HOST CONTROL BUTTONS (Manual Phase Progression) ======
function showHostControlButton(action, buttonText, message) {
    // Verifică dacă există deja un container de control
    let controlContainer = document.getElementById('host-phase-control');
    
    if (!controlContainer) {
        // Creează container pentru butoane de control
        controlContainer = document.createElement('div');
        controlContainer.id = 'host-phase-control';
        controlContainer.className = 'host-phase-control';
        
        // Adaugă în ecranul narrator
        const narratorContainer = document.querySelector('.narrator-container');
        if (narratorContainer) {
            narratorContainer.insertBefore(controlContainer, narratorContainer.querySelector('.narrator-controls'));
        }
    }
    
    // Actualizează conținutul
    controlContainer.innerHTML = `
        <div class="host-control-message">
            <p>✅ ${message}</p>
        </div>
        <button id="host-action-btn" class="btn btn-primary host-action-btn">${buttonText}</button>
    `;
    
    // Adaugă event listener pentru buton
    const actionBtn = document.getElementById('host-action-btn');
    if (actionBtn) {
        actionBtn.addEventListener('click', () => {
            if (action === 'start-night') {
                socket.emit('host-start-night');
                controlContainer.remove();
            } else if (action === 'start-day') {
                socket.emit('host-start-day');
                controlContainer.remove();
            } else if (action === 'next-round') {
                socket.emit('host-start-night'); // Următoarea rundă = start night
                controlContainer.remove();
            }
        });
    }
}

// ====== SPECTATOR SCREEN (Pentru jucători morți) ======
function showSpectatorScreen() {
    switchScreen('narrator-screen'); // Folosim același ecran ca narrator
    
    // Actualizează header-ul pentru spectator
    const narratorHeader = document.querySelector('.narrator-header h1');
    const narratorSubtitle = document.querySelector('.narrator-header .subtitle');
    
    if (narratorHeader) {
        narratorHeader.textContent = '👁️ SPECTATOR';
    }
    
    if (narratorSubtitle) {
        narratorSubtitle.textContent = 'Ai fost eliminat - acum poți vedea tot!';
    }
    
    // Ascunde butoanele de control (spectatorii nu pot controla jocul)
    const narratorControls = document.querySelector('.narrator-controls');
    if (narratorControls) {
        narratorControls.style.display = 'none';
    }
    
    const hostPhaseControl = document.getElementById('host-phase-control');
    if (hostPhaseControl) {
        hostPhaseControl.style.display = 'none';
    }
    
    // Populează lista de jucători cu roluri + modifiers (același ca narrator)
    const playersList = document.getElementById('narrator-players-list');
    if (playersList) {
        playersList.innerHTML = '';
        
        allRoles.forEach(player => {
            const roleInfo = ROLES[player.role] || { icon: '❓', name: player.role };
            const playerItem = document.createElement('div');
            playerItem.className = `narrator-player-item ${player.alive ? 'alive' : 'dead'}`;
            
            // Modifier display
            let modifierBadge = '';
            if (player.modifier) {
                const modifierIcons = {
                    'TRAITOR': '🎭',
                    'HEALER': '🛡️',
                    'SEER': '👁️',
                    'TIEBREAKER': '⚖️'
                };
                const modifierNames = {
                    'TRAITOR': 'Traitor',
                    'HEALER': 'Healer',
                    'SEER': 'Seer',
                    'TIEBREAKER': 'Tiebreaker'
                };
                
                let extraInfo = '';
                if (player.modifier === 'HEALER' && player.hitCount > 0) {
                    extraInfo = ` (${player.hitCount}/2 lovituri)`;
                }
                
                modifierBadge = `<span class="modifier-badge" style="font-size: 0.8rem; color: #ffd700; margin-left: 8px;">${modifierIcons[player.modifier]} ${modifierNames[player.modifier]}${extraInfo}</span>`;
            }
            
            playerItem.innerHTML = `
                <span class="player-name">${player.alive ? '✅' : '💀'} ${player.name}</span>
                <span class="player-role ${ROLES[player.role]?.class || ''}">${roleInfo.icon} ${roleInfo.name}${modifierBadge}</span>
            `;
            playersList.appendChild(playerItem);
        });
    }
}

function updateNarratorActions(data) {
    const actionsList = document.getElementById('narrator-actions-list');
    if (!actionsList) return;
    
    actionsList.innerHTML = '<h3>Acțiuni curente:</h3>';
    
    if (data.actions.mafia !== undefined) {
        const target = data.players.find(p => p.id === data.actions.mafia);
        const mafiaPlayers = data.players.filter(p => p.role === 'MAFIA' && p.alive);
        const seerMafia = mafiaPlayers.filter(p => p.modifier === 'SEER');
        
        actionsList.innerHTML += `<p>🔫 Mafia atacă: <strong>${target ? target.name : 'Unknown'}</strong></p>`;
        
        // Arată dacă vreun Mafioso are SEER
        if (seerMafia.length > 0 && target) {
            actionsList.innerHTML += `<p class="modifier-info">👁️ <em>${seerMafia.map(p => p.name).join(', ')} vor vedea rolul lui ${target.name}</em></p>`;
        }
        
        // Arată dacă ținta are HEALER
        if (target && target.modifier === 'HEALER') {
            actionsList.innerHTML += `<p class="modifier-info">🛡️ <em>${target.name} are HEALER! (${target.hitCount || 0}/2 lovituri)</em></p>`;
        }
    }
    
    if (data.actions.doctor !== undefined) {
        const target = data.players.find(p => p.id === data.actions.doctor);
        const doctorPlayers = data.players.filter(p => p.role === 'DOCTOR' && p.alive);
        const seerDoctor = doctorPlayers.filter(p => p.modifier === 'SEER');
        
        actionsList.innerHTML += `<p>💊 Doctor salvează: <strong>${target ? target.name : 'Unknown'}</strong></p>`;
        
        // Arată dacă vreun Doctor are SEER
        if (seerDoctor.length > 0 && target) {
            actionsList.innerHTML += `<p class="modifier-info">👁️ <em>${seerDoctor.map(p => p.name).join(', ')} vor vedea rolul lui ${target.name}</em></p>`;
        }
    }
    
    if (data.actions.detective !== undefined) {
        const target = data.players.find(p => p.id === data.actions.detective);
        const detectivePlayers = data.players.filter(p => p.role === 'DETECTIVE' && p.alive);
        const seerDetective = detectivePlayers.filter(p => p.modifier === 'SEER');
        
        actionsList.innerHTML += `<p>🔍 Detectiv investighează: <strong>${target ? target.name : 'Unknown'}</strong></p>`;
        
        // Arată dacă vreun Detectiv are SEER
        if (seerDetective.length > 0 && target) {
            actionsList.innerHTML += `<p class="modifier-info">👁️ <em>${seerDetective.map(p => p.name).join(', ')} vor vedea rolul EXACT al lui ${target.name}</em></p>`;
        }
    }
    
    if (Object.keys(data.actions).length === 0) {
        actionsList.innerHTML += '<p class="instruction">⏳ Nicio acțiune înregistrată încă...</p>';
    }
}

function updateNarratorVotes(data) {
    const votesList = document.getElementById('narrator-votes-list');
    if (!votesList) return;
    
    votesList.innerHTML = '<h3>Voturi curente:</h3>';
    
    const voteCounts = {};
    const tiebreakers = data.players.filter(p => p.modifier === 'TIEBREAKER' && p.alive);
    
    Object.entries(data.votes).forEach(([voterId, targetId]) => {
        const voter = data.players.find(p => p.id === voterId);
        const target = data.players.find(p => p.id === targetId);
        
        if (voter && target) {
            const isTiebreaker = voter.modifier === 'TIEBREAKER';
            votesList.innerHTML += `<p>• <strong>${voter.name}</strong>${isTiebreaker ? ' ⚖️ <em>(TIEBREAKER)</em>' : ''} → ${target.name}</p>`;
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        }
    });
    
    if (Object.keys(data.votes).length === 0) {
        votesList.innerHTML += '<p class="instruction">⏳ Niciun vot înregistrat încă...</p>';
    } else {
        votesList.innerHTML += '<br><h3>Sumar voturi:</h3>';
        Object.entries(voteCounts).forEach(([targetId, count]) => {
            const target = data.players.find(p => p.id === targetId);
            votesList.innerHTML += `<p><strong>${target ? target.name : 'Unknown'}</strong>: ${count} voturi</p>`;
        });
        
        // Detectează egalități și arată TIEBREAKER
        const maxVotes = Math.max(...Object.values(voteCounts));
        const candidates = Object.entries(voteCounts).filter(([_, count]) => count === maxVotes);
        
        if (candidates.length > 1 && tiebreakers.length > 0) {
            votesList.innerHTML += `<br><p class="modifier-info">⚖️ <em>EGALITATE! ${tiebreakers.map(p => p.name).join(', ')} va decide (dacă a votat un candidat)</em></p>`;
        }
    }
}

// Loghează Seer revelations pentru Narrator
function logNarratorSeerRevelation(data) {
    const seerLog = document.getElementById('narrator-seer-log');
    if (!seerLog) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const roleInfo = ROLES[data.targetRole];
    
    const logEntry = document.createElement('div');
    logEntry.className = 'narrator-log-entry seer-revelation-entry';
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <strong>${data.playerName || 'Jucător cu SEER'}</strong> vede: 
        <span class="role-reveal">${roleInfo?.icon || '❓'} ${data.targetName} = ${roleInfo?.name || data.targetRole}</span>
    `;
    
    seerLog.appendChild(logEntry);
    seerLog.scrollTop = seerLog.scrollHeight;
    
    // Păstrează doar ultimele 20 de intrări
    while (seerLog.children.length > 20) {
        seerLog.removeChild(seerLog.firstChild);
    }
}

// Loghează evenimente modifier pentru Narrator
function logNarratorModifierEvent(message, type = 'info') {
    const modifierLog = document.getElementById('narrator-modifier-log');
    if (!modifierLog) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `narrator-log-entry modifier-event-${type}`;
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        ${message}
    `;
    
    modifierLog.appendChild(logEntry);
    modifierLog.scrollTop = modifierLog.scrollHeight;
    
    // Păstrează doar ultimele 30 de intrări
    while (modifierLog.children.length > 30) {
        modifierLog.removeChild(modifierLog.firstChild);
    }
}

// ====== FAZA DE NOAPTE ======
function startNightPhase(data) {
    // Narrator rămâne pe ecranul său de monitoring
    if (myRole === 'NARRATOR') {
        // Resetează lista de acțiuni pentru noua noapte
        const actionsList = document.getElementById('narrator-actions-list');
        if (actionsList) {
            actionsList.innerHTML = '<h3>Acțiuni curente:</h3><p class="instruction">⏳ Nicio acțiune înregistrată încă...</p>';
        }
        return; // Narrator nu participă la acțiuni de noapte
    }
    
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
    
    // Verifică dacă sunt în echipă (2+ membri) - folosește alive players
    const aliveMafiaCount = players.filter(p => {
        const player = currentPlayers.find(cp => cp.id === p.id && cp.role === 'MAFIA' && cp.alive);
        return player;
    }).length;
    const isTeamAction = aliveMafiaCount >= 2;
    const instructionText = isTeamAction ? 
        '⚠️ ECHIPĂ: Toți membrii Mafia trebuie să aleagă ACEEAȘI victimă!' : 
        'Selectează un jucător pentru eliminare';
    
    container.innerHTML = `
        <div class="action-info">
            <h2>🔫 Alege Victima</h2>
            <p class="instruction">${instructionText}</p>
            ${isTeamAction ? '<div id="team-consensus-status" class="consensus-status"></div>' : ''}
        </div>
        <div class="players-grid" id="action-targets"></div>
        <button class="btn btn-danger" id="confirm-action-btn" disabled>Confirmă Alegerea</button>
    `;
    
    // Salvează detalii pentru posibila resetare
    currentNightAction = {
        type: 'mafia',
        players: targets,
        isTeam: isTeamAction
    };
    
    renderActionTargets(targets, 'mafia', isTeamAction);
}

function showDoctorAction(players) {
    const container = document.getElementById('night-action-container');
    
    // Verifică alive doctors pentru team action
    const aliveDoctorCount = players.filter(p => {
        const player = currentPlayers.find(cp => cp.id === p.id && cp.role === 'DOCTOR' && cp.alive);
        return player;
    }).length;
    const isTeamAction = aliveDoctorCount >= 2;
    const instructionText = isTeamAction ? 
        '⚠️ ECHIPĂ: Toți doctorii trebuie să aleagă ACEEAȘI persoană de salvat!' : 
        'Alege pe cine să salvezi (poți să te alegi pe tine)';
    
    container.innerHTML = `
        <div class="action-info">
            <h2>💊 Salvează un Jucător</h2>
            <p class="instruction">${instructionText}</p>
            ${isTeamAction ? '<div id="team-consensus-status" class="consensus-status"></div>' : ''}
        </div>
        <div class="players-grid" id="action-targets"></div>
        <button class="btn btn-secondary" id="confirm-action-btn" disabled>Confirmă Alegerea</button>
    `;
    
    // Salvează detalii pentru posibila resetare
    currentNightAction = {
        type: 'doctor',
        players: players,
        isTeam: isTeamAction
    };
    
    renderActionTargets(players, 'doctor', isTeamAction);
}

function showDetectiveAction(players) {
    const container = document.getElementById('night-action-container');
    const targets = players.filter(p => p.id !== socket.id);
    
    // Verifică alive detectives pentru team action
    const aliveDetectiveCount = players.filter(p => {
        const player = currentPlayers.find(cp => cp.id === p.id && cp.role === 'DETECTIVE' && cp.alive);
        return player;
    }).length;
    const isTeamAction = aliveDetectiveCount >= 2;
    const instructionText = isTeamAction ? 
        '⚠️ ECHIPĂ: Toți detectivii trebuie să aleagă ACEEAȘI persoană de investigat!' : 
        'Selectează un jucător pentru a afla dacă este Mafia';
    
    container.innerHTML = `
        <div class="action-info">
            <h2>🔍 Investighează un Jucător</h2>
            <p class="instruction">${instructionText}</p>
            ${isTeamAction ? '<div id="team-consensus-status" class="consensus-status"></div>' : ''}
        </div>
        <div class="players-grid" id="action-targets"></div>
        <button class="btn btn-secondary" id="confirm-action-btn" disabled>Confirmă Investigația</button>
    `;
    
    // Salvează detalii pentru posibila resetare
    currentNightAction = {
        type: 'detective',
        players: targets,
        isTeam: isTeamAction
    };
    
    renderActionTargets(targets, 'detective', isTeamAction);
}

function renderActionTargets(players, actionType, isTeamAction = false) {
    const container = document.getElementById('action-targets');
    const oldConfirmBtn = document.getElementById('confirm-action-btn');
    let selectedTarget = null;
    let selectedTargetName = null;
    
    // Curăță containerul și resetează butonul
    container.innerHTML = '';
    oldConfirmBtn.disabled = true;
    
    // Clonează butonul IMEDIAT pentru a elimina event listeners vechi
    const confirmBtn = oldConfirmBtn.cloneNode(true);
    oldConfirmBtn.parentNode.replaceChild(confirmBtn, oldConfirmBtn);
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `<h3>${player.name}</h3>`;
        
        card.addEventListener('click', () => {
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedTarget = player.id;
            selectedTargetName = player.name;
            confirmBtn.disabled = false; // Acum modifică NOUL buton
        });
        
        container.appendChild(card);
    });
    
    confirmBtn.addEventListener('click', () => {
        if (selectedTarget && !confirmBtn.disabled) {
            // Dezactivează IMEDIAT pentru a preveni double-click
            confirmBtn.disabled = true;
            
            if (isTeamAction) {
                // Trimite alegerea către server pentru verificare consens
                socket.emit('team-choice', {
                    actionType: actionType,
                    targetId: selectedTarget
                });
                
                // Dezactivează toate cardurile
                container.querySelectorAll('.player-card').forEach(c => {
                    c.style.pointerEvents = 'none';
                    c.style.opacity = '0.6';
                });
                confirmBtn.textContent = 'Alegere trimisă...';
                
                // Afișează mesaj de așteptare consens
                const statusDiv = document.getElementById('team-consensus-status');
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <p>⏳ Ai ales: <strong>${selectedTargetName}</strong></p>
                        <p>Așteaptă ca toți membrii echipei să aleagă aceeași țintă...</p>
                    `;
                }
            } else {
                // Acțiune solo, trimite direct
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
    // Narrator rămâne pe ecranul său de monitoring
    if (myRole === 'NARRATOR') {
        // Actualizează lista de jucători în viu în ecranul narratorului
        const playersList = document.getElementById('narrator-players-list');
        if (playersList) {
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
        }
        return; // Narrator nu participă la votare
    }
    
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
    let hasVoted = false;
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <h3>${player.name}</h3>
            <p class="status">Click pentru a vota</p>
        `;
        
        card.addEventListener('click', () => {
            // Previne double-click sau vot multiplu
            if (hasVoted || selectedVote !== null) return;
            
            hasVoted = true;
            selectedVote = player.id;
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
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
// Ascunde toate chat-urile la început
function hideAllChats() {
    ['mafia', 'doctor', 'detective'].forEach(role => {
        const chatPanel = document.getElementById(`${role}-chat-panel`);
        if (chatPanel) {
            chatPanel.classList.add('hidden');
        }
    });
}

// Afișează chat DOAR pentru rolul tău
function showRoleChat(role, team) {
    const chatPanel = document.getElementById(`${role}-chat-panel`);
    if (!chatPanel) return;
    
    // Ascunde toate celelalte chat-uri
    hideAllChats();
    
    // Arată doar chat-ul tău
    chatPanel.classList.remove('hidden');
    
    // Populează membri echipei
    const membersDiv = document.getElementById(`${role}-chat-members`);
    const roleEmojis = { 'mafia': '🔫', 'doctor': '💊', 'detective': '🔍' };
    
    if (membersDiv) {
        membersDiv.innerHTML = '<h4>Membrii echipei:</h4>' + 
            team.map(member => `<span class="${role}-member">${roleEmojis[role]} ${member.name}</span>`).join('');
    }
}

function toggleRoleChat(role) {
    const chatPanel = document.getElementById(`${role}-chat-panel`);
    if (!chatPanel) return;
    
    const content = chatPanel.querySelector(`.${role}-chat-content`);
    if (!content) return;
    
    const isOpen = (role === 'mafia') ? isMafiaChatOpen : (role === 'doctor') ? isDoctorChatOpen : isDetectiveChatOpen;
    
    if (isOpen) {
        content.style.display = 'none';
        if (role === 'mafia') isMafiaChatOpen = false;
        else if (role === 'doctor') isDoctorChatOpen = false;
        else if (role === 'detective') isDetectiveChatOpen = false;
    } else {
        content.style.display = 'block';
        if (role === 'mafia') isMafiaChatOpen = true;
        else if (role === 'doctor') isDoctorChatOpen = true;
        else if (role === 'detective') isDetectiveChatOpen = true;
    }
}

function sendRoleMessage(role) {
    const input = document.getElementById(`${role}-chat-input`);
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    socket.emit(`${role}-chat-message`, { message });
    input.value = '';
}

// Helper function pentru XSS protection
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function displayRoleMessage(role, message) {
    // Afișează în chat-ul specific pentru jucători
    const roleMessages = document.getElementById(`${role}-messages`);
    if (roleMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <strong>${escapeHTML(message.sender)}:</strong> ${escapeHTML(message.text)}
            <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
        `;
        roleMessages.appendChild(messageDiv);
        roleMessages.scrollTop = roleMessages.scrollHeight;
    }
    
    // Afișează în ecranul narratorului pentru monitoring (toate chat-urile)
    if (myRole === 'NARRATOR') {
        const narratorMessages = document.getElementById(`narrator-${role}-messages`);
        if (narratorMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.innerHTML = `
                <strong>[${role.toUpperCase()}] ${escapeHTML(message.sender)}:</strong> ${escapeHTML(message.text)}
                <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
            `;
            narratorMessages.appendChild(messageDiv);
            narratorMessages.scrollTop = narratorMessages.scrollHeight;
        }
    }
}

// Actualizează statusul consensului echipei
function updateConsensusStatus(data) {
    const statusDiv = document.getElementById('team-consensus-status');
    if (!statusDiv) return;
    
    const { choicesMade, totalMembers, allAgree, targetName } = data;
    
    let statusHTML = `<p>📊 Alegeri făcute: ${choicesMade}/${totalMembers}</p>`;
    
    if (choicesMade > 0) {
        if (allAgree) {
            statusHTML += `<p class="consensus-agree">✅ Toți membrii au ales: <strong>${targetName}</strong></p>`;
        } else {
            statusHTML += `<p class="consensus-disagree">❌ Membrii echipei au ales ținte diferite!</p>`;
        }
    }
    
    statusDiv.innerHTML = statusHTML;
}

// ====== UTILITĂȚI ======
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showNotification(message, type = 'info', duration = 3000) {
    // Crează notificare
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message; // Schimbat la innerHTML pentru formatare
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? '#ff3333' : type === 'success' ? '#33ff99' : type === 'warning' ? '#ff9933' : '#3399ff'};
        color: ${type === 'success' ? '#000' : '#fff'};
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, duration);
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

// ====== DISCUSSION TIMER (30 SECUNDE) ======
function showDiscussionTimer(duration) {
    // Previne duplicate overlays
    const existingOverlay = document.getElementById('discussion-timer-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Creează overlay pentru discussion timer
    const overlay = document.createElement('div');
    overlay.id = 'discussion-timer-overlay';
    overlay.className = 'discussion-timer-overlay';
    
    let timeLeft = Math.floor(duration / 1000); // Convert to seconds
    
    overlay.innerHTML = `
        <div class="discussion-timer-box">
            <div class="discussion-icon">💬</div>
            <h2 class="discussion-title">Fază de Discuții</h2>
            <p class="discussion-instruction">Discutați despre ce s-a întâmplat în timpul nopții</p>
            <div class="discussion-countdown" id="discussion-countdown">${timeLeft}</div>
            <p class="discussion-note">Votarea va începe automat după ${timeLeft} secunde</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Countdown
    const countdownEl = document.getElementById('discussion-countdown');
    const countdownInterval = setInterval(() => {
        timeLeft--;
        if (countdownEl) {
            countdownEl.textContent = timeLeft;
            
            // Animație pulsare la ultimele 5 secunde
            if (timeLeft <= 5) {
                countdownEl.style.animation = 'pulse 0.5s infinite';
                countdownEl.style.color = '#ff3333';
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            
            // Șterge overlay-ul
            if (overlay && overlay.parentNode) {
                overlay.remove();
            }
        }
    }, 1000);
}

// ====== VOTING PHASE ======
let swapperLiveVotes = {}; // Track votes pentru Swapper
let isSwapper = false;

function startVotingPhase(data) {
    // Narrator nu votează - rămâne pe ecranul său
    if (myRole === 'NARRATOR') {
        return;
    }
    
    if (!data.hasSwapper) {
        // Fără Swapper - voting normal
        showNormalVotingInterface(data.alivePlayers);
    } else {
        // Cu Swapper în joc
        // Swapper va primi swapper-revealed event separat
        // Ceilalți jucători votează normal
        showNormalVotingInterface(data.alivePlayers);
    }
}

function showNormalVotingInterface(alivePlayers) {
    switchScreen('day-screen');
    
    const nightResults = document.getElementById('night-results');
    if (nightResults) {
        // Rezultatele au fost deja afișate în startDayPhase
    }
    
    renderVotingPlayers(alivePlayers);
}

// ====== SWAPPER LIVE VOTE TRACKING ======
function updateSwapperLiveVotes(data) {
    isSwapper = true;
    
    // Salvează votul
    swapperLiveVotes[data.voterId] = {
        voterName: data.voterName,
        targetId: data.targetId,
        targetName: data.targetName
    };
    
    // Update UI dacă există swapper live tracker
    const liveTracker = document.getElementById('swapper-live-tracker');
    if (liveTracker) {
        updateSwapperLiveTrackerUI();
    } else {
        // Creează live tracker dacă nu există
        createSwapperLiveTracker();
    }
}

function createSwapperLiveTracker() {
    const dayScreen = document.getElementById('day-screen');
    if (!dayScreen) return;
    
    // Creează container pentru live tracker
    const trackerContainer = document.createElement('div');
    trackerContainer.id = 'swapper-live-tracker-container';
    trackerContainer.className = 'swapper-live-tracker-container';
    trackerContainer.innerHTML = `
        <div class="swapper-header">
            <h2>🔄 SWAPPER - Live Vote Tracker</h2>
            <p class="instruction">Vezi în timp real cine pe cine votează</p>
        </div>
        <div id="swapper-live-tracker" class="swapper-live-tracker">
            <p class="instruction">Așteptăm voturi...</p>
        </div>
    `;
    
    // Inserează înaintea voting section
    const votingSection = dayScreen.querySelector('.voting-section');
    if (votingSection) {
        dayScreen.insertBefore(trackerContainer, votingSection);
    }
    
    updateSwapperLiveTrackerUI();
}

function updateSwapperLiveTrackerUI() {
    const liveTracker = document.getElementById('swapper-live-tracker');
    if (!liveTracker) return;
    
    if (Object.keys(swapperLiveVotes).length === 0) {
        liveTracker.innerHTML = '<p class="instruction">Așteptăm voturi...</p>';
        return;
    }
    
    liveTracker.innerHTML = '';
    
    Object.entries(swapperLiveVotes).forEach(([voterId, voteData]) => {
        const voteItem = document.createElement('div');
        voteItem.className = 'swapper-vote-item';
        voteItem.dataset.voterId = voterId;
        voteItem.innerHTML = `
            <span class="voter-name">👤 ${voteData.voterName}</span>
            <span class="vote-arrow">→</span>
            <span class="target-name">🎯 ${voteData.targetName}</span>
        `;
        liveTracker.appendChild(voteItem);
    });
}

// ====== SWAPPER SWAP INTERFACE ======
function showSwapperSwapInterface(data) {
    const dayScreen = document.getElementById('day-screen');
    if (!dayScreen) return;
    
    // Ascunde tracker-ul live
    const trackerContainer = document.getElementById('swapper-live-tracker-container');
    if (trackerContainer) {
        trackerContainer.style.display = 'none';
    }
    
    // Creează interfață de swap
    const swapContainer = document.createElement('div');
    swapContainer.id = 'swapper-swap-container';
    swapContainer.className = 'swapper-swap-container';
    
    swapContainer.innerHTML = `
        <div class="swapper-swap-box">
            <h2>🔄 Modifică un Vot</h2>
            <p class="instruction">${data.message}</p>
            
            <div class="swapper-swap-section">
                <h3>1. Selectează votul pe care vrei să-l modifici:</h3>
                <div id="swapper-vote-list" class="swapper-vote-list">
                    ${Object.entries(swapperLiveVotes).map(([voterId, voteData]) => `
                        <div class="swapper-vote-select-item" data-voter-id="${voterId}">
                            <span>${voteData.voterName} → ${voteData.targetName}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="swapper-swap-section" id="swapper-target-selection" style="display: none;">
                <h3>2. Selectează noua țintă:</h3>
                <div id="swapper-new-target-list" class="swapper-vote-list">
                    <!-- Se populează dinamic -->
                </div>
            </div>
            
            <div class="swapper-buttons">
                <button id="swapper-skip-btn" class="btn btn-secondary">Sari (Nu modific)</button>
                <button id="swapper-confirm-swap-btn" class="btn btn-primary" disabled>Confirmă Swap</button>
            </div>
        </div>
    `;
    
    dayScreen.appendChild(swapContainer);
    
    // Event listeners pentru swap
    let selectedVoterId = null;
    let selectedNewTargetId = null;
    
    // Selectare vot de modificat
    document.querySelectorAll('.swapper-vote-select-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.swapper-vote-select-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedVoterId = item.dataset.voterId;
            
            // Arată secțiunea de selectare țintă nouă
            const targetSection = document.getElementById('swapper-target-selection');
            const newTargetList = document.getElementById('swapper-new-target-list');
            
            if (targetSection && newTargetList) {
                targetSection.style.display = 'block';
                
                // Populează țintele posibile (toți jucătorii vii, FĂRĂ Narrator)
                newTargetList.innerHTML = '';
                currentPlayers.filter(p => p.alive && p.role !== 'NARRATOR').forEach(player => {
                    const targetItem = document.createElement('div');
                    targetItem.className = 'swapper-vote-select-item';
                    targetItem.dataset.targetId = player.id;
                    targetItem.innerHTML = `<span>🎯 ${player.name}</span>`;
                    
                    targetItem.addEventListener('click', () => {
                        document.querySelectorAll('#swapper-new-target-list .swapper-vote-select-item').forEach(i => i.classList.remove('selected'));
                        targetItem.classList.add('selected');
                        selectedNewTargetId = player.id;
                        
                        // Activează butonul de confirm
                        document.getElementById('swapper-confirm-swap-btn').disabled = false;
                    });
                    
                    newTargetList.appendChild(targetItem);
                });
            }
        });
    });
    
    // Buton Skip
    document.getElementById('swapper-skip-btn').addEventListener('click', () => {
        // Fără swap, direct la vot
        swapContainer.remove();
        showSwapperVotingInterface();
    });
    
    // Buton Confirm Swap
    document.getElementById('swapper-confirm-swap-btn').addEventListener('click', () => {
        if (selectedVoterId && selectedNewTargetId) {
            // Trimite swap la server
            socket.emit('swapper-swap-vote', {
                originalVoterId: selectedVoterId,
                newTargetId: selectedNewTargetId
            });
            
            // Șterge interfața
            swapContainer.remove();
            
            // Așteaptă confirmarea și apoi votează
            // showSwapperVotingInterface() va fi apelat de swapper-vote-now event
        }
    });
}

// ====== SWAPPER VOTING INTERFACE ======
function showSwapperVotingInterface() {
    showNotification('Acum votează și tu!', 'info', 3000);
    
    // Afișează interfața normală de vot (exclude Narrator)
    const alivePlayers = currentPlayers.filter(p => p.alive && p.role !== 'NARRATOR');
    renderVotingPlayers(alivePlayers);
}
