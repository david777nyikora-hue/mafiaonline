const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(__dirname));

// Structura pentru camere de joc
const gameRooms = new Map();

// Generare cod unic pentru cameră
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Verifică dacă codul există deja
    if (gameRooms.has(code)) {
        return generateRoomCode();
    }
    return code;
}

// Funcție pentru distribuirea rolurilor
function assignRoles(players, roleConfig) {
    // Host-ul nu primește rol - e povestitor
    const playersWithoutHost = players.filter(p => !p.isHost);
    
    const { mafiaCount, doctorCount, detectiveCount } = roleConfig;
    const citizenCount = playersWithoutHost.length - mafiaCount - doctorCount - detectiveCount;
    
    if (citizenCount < 0) {
        throw new Error('Prea multe roluri speciale pentru numărul de jucători!');
    }
    
    let roles = [
        ...Array(mafiaCount).fill('MAFIA'),
        ...Array(doctorCount).fill('DOCTOR'),
        ...Array(detectiveCount).fill('DETECTIVE'),
        ...Array(citizenCount).fill('CITIZEN')
    ];
    
    // Shuffle roluri (Fisher-Yates)
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    // Distribuie roluri
    let roleIndex = 0;
    return players.map(player => {
        if (player.isHost) {
            return {
                ...player,
                role: 'NARRATOR', // Host = Povestitor
                alive: false // Nu participă în joc
            };
        }
        return {
            ...player,
            role: roles[roleIndex++],
            alive: true
        };
    });
}

// Socket.IO
io.on('connection', (socket) => {
    console.log('🟢 Jucător conectat:', socket.id);
    
    // HOST - Creează cameră nouă
    socket.on('create-room', (data) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            host: socket.id,
            players: [{
                id: socket.id,
                name: data.playerName,
                isHost: true
            }],
            gameState: {
                phase: 'lobby',
                round: 1,
                roleConfig: {
                    mafiaCount: data.roleConfig.mafiaCount || 2,
                    doctorCount: data.roleConfig.doctorCount || 1,
                    detectiveCount: data.roleConfig.detectiveCount || 1
                },
                nightActions: {},
                votes: {},
                alivePlayers: [],
                deadPlayers: [],
                mafiaChat: [] // Istoric chat Mafia
            },
            started: false
        };
        
        gameRooms.set(roomCode, room);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`🎮 Cameră creată: ${roomCode} de ${data.playerName}`);
        
        socket.emit('room-created', {
            roomCode: roomCode,
            players: room.players
        });
    });
    
    // JOIN - Intră în cameră existentă
    socket.on('join-room', (data) => {
        const { roomCode, playerName } = data;
        const room = gameRooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', { message: 'Cameră inexistentă!' });
            return;
        }
        
        if (room.started) {
            socket.emit('error', { message: 'Jocul a început deja!' });
            return;
        }
        
        // Verifică dacă numele există deja
        if (room.players.find(p => p.name === playerName)) {
            socket.emit('error', { message: 'Numele este deja folosit!' });
            return;
        }
        
        const player = {
            id: socket.id,
            name: playerName,
            isHost: false
        };
        
        room.players.push(player);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`➕ ${playerName} s-a alăturat camerei ${roomCode}`);
        
        // Notifică toți jucătorii
        io.to(roomCode).emit('player-joined', {
            players: room.players,
            newPlayer: playerName
        });
    });
    
    // START GAME
    socket.on('start-game', () => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            socket.emit('error', { message: 'Doar host-ul poate începe jocul!' });
            return;
        }
        
        const playersWithoutHost = room.players.filter(p => !p.isHost);
        if (playersWithoutHost.length < 4) {
            socket.emit('error', { message: 'Minim 4 jucători necesari (fără host)!' });
            return;
        }
        
        // Distribuie roluri
        try {
            room.players = assignRoles(room.players, room.gameState.roleConfig);
            room.gameState.alivePlayers = room.players.filter(p => p.alive);
            room.started = true;
            room.gameState.phase = 'role-reveal';
            
            console.log(`🎬 Jocul a început în camera ${roomCode}`);
            
            // Identifică membrii Mafia pentru ca să se știe între ei
            const mafiaPlayers = room.players.filter(p => p.role === 'MAFIA');
            const mafiaList = mafiaPlayers.map(p => ({
                id: p.id,
                name: p.name
            }));
            
            // Trimite fiecărui jucător rolul său
            room.players.forEach(player => {
                const payload = {
                    role: player.role,
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        alive: p.alive
                    }))
                };
                
                // Dacă e Mafia, trimite și lista cu ceilalți Mafia
                if (player.role === 'MAFIA') {
                    payload.mafiaTeam = mafiaList;
                }
                
                // Dacă e Narrator (host), trimite toate rolurile
                if (player.role === 'NARRATOR') {
                    payload.allRoles = room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        role: p.role,
                        alive: p.alive
                    }));
                }
                
                io.to(player.id).emit('game-started', payload);
            });
            
            // După 5 secunde, începe noaptea
            setTimeout(() => {
                startNightPhase(roomCode);
            }, 5000);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
    
    // NIGHT ACTIONS
    socket.on('night-action', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const { actionType, targetId } = data;
        room.gameState.nightActions[actionType] = targetId;
        
        // Confirmă acțiunea
        socket.emit('action-confirmed', { actionType });
        
        // Verifică dacă toți au acționat
        checkNightActionsComplete(roomCode);
    });
    
    // DAY VOTE
    socket.on('vote', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const { targetId } = data;
        room.gameState.votes[socket.id] = targetId;
        
        // Broadcast votul (fără a dezvălui cine a votat)
        io.to(roomCode).emit('vote-cast', {
            voterId: socket.id,
            targetId: targetId
        });
        
        // Verifică dacă toți au votat
        const aliveCount = room.gameState.alivePlayers.length;
        const voteCount = Object.keys(room.gameState.votes).length;
        
        if (voteCount === aliveCount) {
            processVotes(roomCode);
        }
    });
    
    // MAFIA CHAT - Trimite mesaj
    socket.on('mafia-chat-message', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.role !== 'MAFIA') {
            return; // Doar Mafia poate trimite mesaje
        }
        
        const message = {
            sender: player.name,
            senderId: player.id,
            text: data.message,
            timestamp: Date.now()
        };
        
        // Salvează în istoric
        room.gameState.mafiaChat.push(message);
        
        // Trimite la toți membrii Mafia
        const mafiaMembers = room.players.filter(p => p.role === 'MAFIA');
        mafiaMembers.forEach(member => {
            io.to(member.id).emit('mafia-chat-message', message);
        });
        
        // Trimite și la Narrator (host) pentru monitorizare
        const narrator = room.players.find(p => p.role === 'NARRATOR');
        if (narrator) {
            io.to(narrator.id).emit('mafia-chat-message', message);
        }
        
        console.log(`💬 Mafia chat în ${roomCode}: ${player.name}: ${data.message}`);
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('🔴 Jucător deconectat:', socket.id);
        
        const roomCode = socket.roomCode;
        if (roomCode) {
            const room = gameRooms.get(roomCode);
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                
                // Dacă host-ul pleacă, transferă host-ul
                if (room.host === socket.id && room.players.length > 0) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
                    io.to(roomCode).emit('new-host', { hostId: room.host });
                }
                
                // Dacă nu mai sunt jucători, șterge camera
                if (room.players.length === 0) {
                    gameRooms.delete(roomCode);
                    console.log(`🗑️ Camera ${roomCode} ștearsă`);
                } else {
                    io.to(roomCode).emit('player-left', { players: room.players });
                }
            }
        }
    });
});

// Funcție pentru a începe faza de noapte
function startNightPhase(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'night';
    room.gameState.nightActions = {};
    
    console.log(`🌙 Noapte începută în ${roomCode} - Runda ${room.gameState.round}`);
    
    io.to(roomCode).emit('night-started', {
        round: room.gameState.round,
        alivePlayers: room.gameState.alivePlayers.map(p => ({
            id: p.id,
            name: p.name
        }))
    });
}

// Verifică dacă toate acțiunile de noapte sunt complete
function checkNightActionsComplete(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    const actions = room.gameState.nightActions;
    const hasMafia = room.gameState.alivePlayers.some(p => p.role === 'MAFIA');
    const hasDoctor = room.gameState.alivePlayers.some(p => p.role === 'DOCTOR');
    const hasDetective = room.gameState.alivePlayers.some(p => p.role === 'DETECTIVE');
    
    const allActionsComplete = 
        (!hasMafia || actions.mafia !== undefined) &&
        (!hasDoctor || actions.doctor !== undefined) &&
        (!hasDetective || actions.detective !== undefined);
    
    if (allActionsComplete) {
        processNightResults(roomCode);
    }
}

// Procesează rezultatele nopții
function processNightResults(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    const actions = room.gameState.nightActions;
    let victim = null;
    let saved = false;
    let detectiveResult = null;
    
    // Verifică dacă victima a fost salvată
    if (actions.mafia !== undefined) {
        if (actions.mafia !== actions.doctor) {
            victim = room.players.find(p => p.id === actions.mafia);
            if (victim) {
                victim.alive = false;
                room.gameState.alivePlayers = room.gameState.alivePlayers.filter(p => p.id !== victim.id);
                room.gameState.deadPlayers.push(victim);
            }
        } else {
            saved = true;
        }
    }
    
    // Rezultat detectiv
    if (actions.detective !== undefined) {
        const target = room.players.find(p => p.id === actions.detective);
        if (target) {
            const detective = room.gameState.alivePlayers.find(p => p.role === 'DETECTIVE');
            detectiveResult = {
                targetName: target.name,
                isMafia: target.role === 'MAFIA'
            };
            
            // Trimite rezultatul doar detectivului
            if (detective) {
                io.to(detective.id).emit('detective-result', detectiveResult);
            }
        }
    }
    
    // Verifică condiție de victorie
    if (checkWinCondition(roomCode)) {
        return;
    }
    
    // Începe ziua
    setTimeout(() => {
        startDayPhase(roomCode, victim, saved);
    }, 3000);
}

// Începe faza de zi
function startDayPhase(roomCode, victim, saved) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'day';
    room.gameState.votes = {};
    
    console.log(`☀️ Zi începută în ${roomCode}`);
    
    io.to(roomCode).emit('day-started', {
        round: room.gameState.round,
        victim: victim ? { name: victim.name } : null,
        saved: saved,
        alivePlayers: room.gameState.alivePlayers.map(p => ({
            id: p.id,
            name: p.name,
            alive: p.alive
        }))
    });
}

// Procesează voturile
function processVotes(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    const voteCounts = {};
    
    Object.values(room.gameState.votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    
    // Găsește cel mai votat
    let maxVotes = 0;
    let eliminated = null;
    
    Object.entries(voteCounts).forEach(([playerId, votes]) => {
        if (votes > maxVotes) {
            maxVotes = votes;
            eliminated = room.players.find(p => p.id === playerId);
        }
    });
    
    if (eliminated) {
        eliminated.alive = false;
        room.gameState.alivePlayers = room.gameState.alivePlayers.filter(p => p.id !== eliminated.id);
        room.gameState.deadPlayers.push(eliminated);
        
        io.to(roomCode).emit('player-eliminated', {
            player: {
                name: eliminated.name,
                role: eliminated.role
            },
            voteCounts: voteCounts
        });
        
        // Verifică condiție de victorie
        if (checkWinCondition(roomCode)) {
            return;
        }
        
        // Următoarea rundă
        setTimeout(() => {
            room.gameState.round++;
            startNightPhase(roomCode);
        }, 5000);
    }
}

// Verifică condiția de victorie
function checkWinCondition(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return false;
    
    const aliveMafia = room.gameState.alivePlayers.filter(p => p.role === 'MAFIA').length;
    const aliveTown = room.gameState.alivePlayers.filter(p => p.role !== 'MAFIA').length;
    
    if (aliveMafia === 0) {
        endGame(roomCode, 'town');
        return true;
    }
    
    if (aliveMafia >= aliveTown) {
        endGame(roomCode, 'mafia');
        return true;
    }
    
    return false;
}

// Termină jocul
function endGame(roomCode, winner) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'ended';
    
    console.log(`🏆 Joc terminat în ${roomCode} - Câștigător: ${winner}`);
    
    io.to(roomCode).emit('game-ended', {
        winner: winner,
        players: room.players.map(p => ({
            name: p.name,
            role: p.role,
            alive: p.alive
        }))
    });
}

// Route pentru pagina principală
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server pornit pe http://localhost:${PORT}`);
    console.log(`🎮 Jocul este disponibil la http://localhost:${PORT}`);
});
