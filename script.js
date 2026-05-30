// ====== CONFIGURARE & VARIABILE GLOBALE ======
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
    }
};

// Stare joc
let gameState = {
    players: [],
    currentPhase: 'start',
    currentRound: 1,
    currentPlayerIndex: 0,
    nightActions: {
        mafiaTarget: null,
        doctorTarget: null,
        detectiveTarget: null,
        detectiveResult: null
    },
    votes: {},
    alivePlayers: [],
    deadPlayers: []
};

// ====== INIȚIALIZARE JOC ======
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

function initializeEventListeners() {
    // Ecran start
    document.getElementById('player-count').addEventListener('input', updateMafiaCountMax);
    document.getElementById('generate-names-btn').addEventListener('click', generatePlayerNameInputs);
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    
    // Distribuție roluri
    document.getElementById('reveal-role-btn').addEventListener('click', revealRole);
    document.getElementById('next-player-btn').addEventListener('click', nextPlayer);
    
    // Joc din nou
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
}

function updateMafiaCountMax() {
    const playerCount = parseInt(document.getElementById('player-count').value);
    const mafiaCountInput = document.getElementById('mafia-count');
    const maxMafia = Math.floor(playerCount / 2) - 1;
    mafiaCountInput.max = maxMafia;
    if (parseInt(mafiaCountInput.value) > maxMafia) {
        mafiaCountInput.value = maxMafia;
    }
}

function generatePlayerNameInputs() {
    const playerCount = parseInt(document.getElementById('player-count').value);
    const container = document.getElementById('player-names-container');
    container.innerHTML = '';
    
    for (let i = 1; i <= playerCount; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-name-input';
        input.placeholder = `Jucător ${i}`;
        input.dataset.playerIndex = i;
        input.addEventListener('input', checkAllNamesEntered);
        container.appendChild(input);
    }
    
    document.getElementById('start-game-btn').disabled = true;
}

function checkAllNamesEntered() {
    const inputs = document.querySelectorAll('.player-name-input');
    const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
    document.getElementById('start-game-btn').disabled = !allFilled;
}

// ====== DISTRIBUȚIE ROLURI ======
function startGame() {
    // Colectează nume jucători
    const nameInputs = document.querySelectorAll('.player-name-input');
    const playerNames = Array.from(nameInputs).map(input => input.value.trim());
    
    if (playerNames.some(name => name === '')) {
        alert('Te rog introdu nume pentru toți jucătorii!');
        return;
    }
    
    // Determină număr roluri
    const mafiaCount = parseInt(document.getElementById('mafia-count').value);
    const doctorCount = 1;
    const detectiveCount = 1;
    const citizenCount = playerNames.length - mafiaCount - doctorCount - detectiveCount;
    
    // Creează array de roluri
    let roles = [
        ...Array(mafiaCount).fill('MAFIA'),
        ...Array(doctorCount).fill('DOCTOR'),
        ...Array(detectiveCount).fill('DETECTIVE'),
        ...Array(citizenCount).fill('CITIZEN')
    ];
    
    // Amestecă rolurile
    roles = shuffleArray(roles);
    
    // Creează jucători
    gameState.players = playerNames.map((name, index) => ({
        id: index,
        name: name,
        role: roles[index],
        alive: true,
        votedBy: []
    }));
    
    gameState.alivePlayers = [...gameState.players];
    gameState.currentPlayerIndex = 0;
    
    // Treci la ecranul de distribuție roluri
    switchScreen('role-reveal-screen');
    showNextPlayerPrompt();
}

function showNextPlayerPrompt() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    document.getElementById('current-player-name').textContent = currentPlayer.name;
    document.getElementById('role-display').classList.add('hidden');
    document.getElementById('reveal-role-btn').style.display = 'block';
}

function revealRole() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const roleInfo = ROLES[currentPlayer.role];
    
    const roleCard = document.getElementById('role-display');
    roleCard.className = `role-card ${roleInfo.class}`;
    
    document.getElementById('role-icon').textContent = roleInfo.icon;
    document.getElementById('role-name').textContent = roleInfo.name;
    document.getElementById('role-description').textContent = roleInfo.description;
    
    roleCard.classList.remove('hidden');
    document.getElementById('reveal-role-btn').style.display = 'none';
}

function nextPlayer() {
    gameState.currentPlayerIndex++;
    
    if (gameState.currentPlayerIndex >= gameState.players.length) {
        // Toți jucătorii au văzut rolurile - începe jocul
        startNightPhase();
    } else {
        showNextPlayerPrompt();
    }
}

// ====== FAZA DE NOAPTE ======
function startNightPhase() {
    gameState.currentPhase = 'night';
    gameState.nightActions = {
        mafiaTarget: null,
        doctorTarget: null,
        detectiveTarget: null,
        detectiveResult: null
    };
    
    switchScreen('night-screen');
    document.getElementById('night-round').textContent = gameState.currentRound;
    
    // Începe cu acțiunea Mafiei
    showMafiaAction();
}

function showMafiaAction() {
    const mafiaPlayers = gameState.alivePlayers.filter(p => p.role === 'MAFIA');
    
    if (mafiaPlayers.length === 0) {
        // Nu mai este mafia - sari la doctor
        showDoctorAction();
        return;
    }
    
    const container = document.getElementById('night-action-container');
    container.innerHTML = `
        <div class="action-info">
            <h2>🔫 Acțiunea Mafiei</h2>
            <p class="instruction">Mafioși: ${mafiaPlayers.map(p => p.name).join(', ')}</p>
            <p class="instruction">Alegeți o victimă</p>
        </div>
        <div class="players-grid" id="mafia-targets"></div>
        <button class="btn btn-danger" id="confirm-mafia-btn" disabled>Confirmă Alegerea</button>
    `;
    
    renderPlayerCards('mafia-targets', 'mafia');
    
    document.getElementById('confirm-mafia-btn').addEventListener('click', () => {
        showDoctorAction();
    });
}

function showDoctorAction() {
    const doctor = gameState.alivePlayers.find(p => p.role === 'DOCTOR');
    
    if (!doctor) {
        // Nu mai este doctor - sari la detectiv
        showDetectiveAction();
        return;
    }
    
    const container = document.getElementById('night-action-container');
    container.innerHTML = `
        <div class="action-info">
            <h2>💊 Acțiunea Doctorului</h2>
            <p class="instruction">Doctor: ${doctor.name}</p>
            <p class="instruction">Alege pe cine să salvezi</p>
        </div>
        <div class="players-grid" id="doctor-targets"></div>
        <button class="btn btn-secondary" id="confirm-doctor-btn" disabled>Confirmă Alegerea</button>
    `;
    
    renderPlayerCards('doctor-targets', 'doctor');
    
    document.getElementById('confirm-doctor-btn').addEventListener('click', () => {
        showDetectiveAction();
    });
}

function showDetectiveAction() {
    const detective = gameState.alivePlayers.find(p => p.role === 'DETECTIVE');
    
    if (!detective) {
        // Nu mai este detectiv - procesează rezultatele
        processNightResults();
        return;
    }
    
    const container = document.getElementById('night-action-container');
    container.innerHTML = `
        <div class="action-info">
            <h2>🔍 Acțiunea Detectivului</h2>
            <p class="instruction">Detectiv: ${detective.name}</p>
            <p class="instruction">Investighează un jucător</p>
        </div>
        <div class="players-grid" id="detective-targets"></div>
        <button class="btn btn-secondary" id="confirm-detective-btn" disabled>Confirmă Alegerea</button>
    `;
    
    renderPlayerCards('detective-targets', 'detective');
    
    document.getElementById('confirm-detective-btn').addEventListener('click', () => {
        // Afișează rezultatul imediat
        showDetectiveResult();
    });
}

function showDetectiveResult() {
    const target = gameState.players.find(p => p.id === gameState.nightActions.detectiveTarget);
    const isMafia = target.role === 'MAFIA';
    
    gameState.nightActions.detectiveResult = {
        target: target.name,
        isMafia: isMafia
    };
    
    const container = document.getElementById('night-action-container');
    container.innerHTML = `
        <div class="action-info">
            <h2>🔍 Rezultat Investigație</h2>
            <div class="result-message" style="font-size: 1.5rem; margin: 30px 0;">
                ${target.name} ${isMafia ? '❌ ESTE MAFIA!' : '✅ NU este Mafia'}
            </div>
            <p class="instruction">Memorează această informație pentru faza de zi</p>
            <button class="btn btn-primary" id="continue-to-day-btn">Continuă către Zi</button>
        </div>
    `;
    
    document.getElementById('continue-to-day-btn').addEventListener('click', () => {
        processNightResults();
    });
}

function renderPlayerCards(containerId, actionType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    // Pentru fiecare rol, afișează doar jucătorii relevanți
    let selectablePlayers = gameState.alivePlayers;
    
    // Mafia nu se poate elimina pe sine
    if (actionType === 'mafia') {
        selectablePlayers = gameState.alivePlayers.filter(p => p.role !== 'MAFIA');
    }
    // Detectivul nu se poate investiga pe sine
    else if (actionType === 'detective') {
        const detective = gameState.alivePlayers.find(p => p.role === 'DETECTIVE');
        selectablePlayers = gameState.alivePlayers.filter(p => p.id !== detective.id);
    }
    
    selectablePlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <h3>${player.name}</h3>
            <p class="status">Viu</p>
        `;
        
        card.addEventListener('click', () => {
            // Deselectează toate
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
            // Selectează aceasta
            card.classList.add('selected');
            
            // Salvează alegerea
            if (actionType === 'mafia') {
                gameState.nightActions.mafiaTarget = player.id;
                document.getElementById('confirm-mafia-btn').disabled = false;
            } else if (actionType === 'doctor') {
                gameState.nightActions.doctorTarget = player.id;
                document.getElementById('confirm-doctor-btn').disabled = false;
            } else if (actionType === 'detective') {
                gameState.nightActions.detectiveTarget = player.id;
                document.getElementById('confirm-detective-btn').disabled = false;
            }
        });
        
        container.appendChild(card);
    });
}

// ====== PROCESARE REZULTATE NOAPTE ======
function processNightResults() {
    let victim = null;
    
    // Verifică dacă victima a fost salvată
    if (gameState.nightActions.mafiaTarget !== null) {
        if (gameState.nightActions.mafiaTarget !== gameState.nightActions.doctorTarget) {
            // Victima moare
            victim = gameState.players.find(p => p.id === gameState.nightActions.mafiaTarget);
            victim.alive = false;
            gameState.alivePlayers = gameState.alivePlayers.filter(p => p.id !== victim.id);
            gameState.deadPlayers.push(victim);
        }
    }
    
    // Treci la faza de zi
    startDayPhase(victim);
}

// ====== FAZA DE ZI ======
function startDayPhase(victim) {
    gameState.currentPhase = 'day';
    gameState.votes = {};
    
    switchScreen('day-screen');
    document.getElementById('day-round').textContent = gameState.currentRound;
    
    // Afișează rezultatele nopții
    const resultsContainer = document.getElementById('night-results');
    
    if (victim) {
        resultsContainer.innerHTML = `
            <div class="result-message death">
                💀 <strong>${victim.name}</strong> a fost eliminat în timpul nopții!
            </div>
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="result-message saved">
                ✨ Nimeni nu a murit în această noapte! Doctorul a salvat victima!
            </div>
        `;
    }
    
    // Verifică condiție de victorie
    if (checkWinCondition()) {
        return;
    }
    
    // Afișează jucătorii pentru vot
    renderVotingPlayers();
}

function renderVotingPlayers() {
    const container = document.getElementById('alive-players-list');
    container.innerHTML = '';
    
    gameState.alivePlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <h3>${player.name}</h3>
            <p class="status">Voturi: <span id="vote-count-${player.id}">0</span></p>
        `;
        
        card.addEventListener('click', () => {
            voteForPlayer(player.id, card);
        });
        
        container.appendChild(card);
    });
}

function voteForPlayer(playerId, cardElement) {
    // Toggle vot
    const alreadyVoted = gameState.votes[playerId] || 0;
    
    // Resetează toate selecțiile
    document.querySelectorAll('#alive-players-list .player-card').forEach(c => {
        c.classList.remove('selected');
    });
    
    // Adaugă vot
    gameState.votes[playerId] = (gameState.votes[playerId] || 0) + 1;
    cardElement.classList.add('selected');
    
    // Update display
    document.getElementById(`vote-count-${playerId}`).textContent = gameState.votes[playerId];
    
    // Afișează rezumat voturi
    showVoteSummary();
}

function showVoteSummary() {
    const summary = document.getElementById('vote-summary');
    const results = document.getElementById('vote-results');
    
    summary.classList.remove('hidden');
    results.innerHTML = '';
    
    // Sortează după număr de voturi
    const sortedVotes = Object.entries(gameState.votes)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count > 0);
    
    sortedVotes.forEach(([playerId, count]) => {
        const player = gameState.players.find(p => p.id === parseInt(playerId));
        const voteItem = document.createElement('div');
        voteItem.className = 'vote-item';
        voteItem.innerHTML = `
            <span>${player.name}</span>
            <span class="vote-count">${count} voturi</span>
        `;
        results.appendChild(voteItem);
    });
    
    // Activează butonul de execuție dacă există voturi
    const executeBtn = document.getElementById('execute-vote-btn');
    executeBtn.disabled = sortedVotes.length === 0;
    
    executeBtn.onclick = () => executeElimination(sortedVotes);
}

function executeElimination(sortedVotes) {
    if (sortedVotes.length === 0) return;
    
    // Cel mai votat jucător
    const [eliminatedId, _] = sortedVotes[0];
    const eliminated = gameState.players.find(p => p.id === parseInt(eliminatedId));
    
    // Elimină jucătorul
    eliminated.alive = false;
    gameState.alivePlayers = gameState.alivePlayers.filter(p => p.id !== eliminated.id);
    gameState.deadPlayers.push(eliminated);
    
    // Afișează mesaj
    alert(`${eliminated.name} a fost eliminat prin vot! Rolul său era: ${ROLES[eliminated.role].name} ${ROLES[eliminated.role].icon}`);
    
    // Verifică condiție de victorie
    if (checkWinCondition()) {
        return;
    }
    
    // Următoarea rundă - noapte
    gameState.currentRound++;
    startNightPhase();
}

// ====== VERIFICARE CONDIȚIE VICTORIE ======
function checkWinCondition() {
    const aliveMafia = gameState.alivePlayers.filter(p => p.role === 'MAFIA').length;
    const aliveTown = gameState.alivePlayers.filter(p => p.role !== 'MAFIA').length;
    
    if (aliveMafia === 0) {
        // Orașul a câștigat
        endGame('town');
        return true;
    }
    
    if (aliveMafia >= aliveTown) {
        // Mafia a câștigat
        endGame('mafia');
        return true;
    }
    
    return false;
}

// ====== ECRAN FINAL ======
function endGame(winner) {
    switchScreen('end-screen');
    
    const victoryMessage = document.getElementById('victory-message');
    const winnerTitle = document.getElementById('winner-title');
    const winnerSubtitle = document.getElementById('winner-subtitle');
    
    if (winner === 'mafia') {
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
    
    gameState.players.forEach(player => {
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

// ====== UTILITĂȚI ======
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function resetGame() {
    gameState = {
        players: [],
        currentPhase: 'start',
        currentRound: 1,
        currentPlayerIndex: 0,
        nightActions: {
            mafiaTarget: null,
            doctorTarget: null,
            detectiveTarget: null,
            detectiveResult: null
        },
        votes: {},
        alivePlayers: [],
        deadPlayers: []
    };
    
    switchScreen('start-screen');
    document.getElementById('player-names-container').innerHTML = '';
    document.getElementById('start-game-btn').disabled = true;
}
