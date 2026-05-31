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

// Generare cod unic pentru cameră (4 cifre)
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Verifică dacă codul există deja
    if (gameRooms.has(code)) {
        return generateRoomCode();
    }
    return code;
}

// Funcție pentru distribuirea rolurilor și modifiers
function assignRoles(players, roleConfig) {
    // Host-ul nu primește rol - e povestitor
    const playersWithoutHost = players.filter(p => !p.isHost);
    
    const { mafiaCount, doctorCount, detectiveCount, modifierConfig } = roleConfig;
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
    const playersWithRoles = players.map(player => {
        if (player.isHost) {
            return {
                ...player,
                role: 'NARRATOR',
                alive: false,
                modifier: null,
                hitCount: 0 // Pentru Healer modifier
            };
        }
        return {
            ...player,
            role: roles[roleIndex++],
            alive: true,
            modifier: null,
            hitCount: 0
        };
    });
    
    // Atribuie MODIFIERS
    if (modifierConfig && modifierConfig.enabled) {
        assignModifiers(playersWithRoles, modifierConfig);
    }
    
    return playersWithRoles;
}

// Funcție pentru atribuirea modifiers
function assignModifiers(players, modifierConfig) {
    const playersWithoutHost = players.filter(p => !p.isHost && p.alive);
    
    const modifiers = ['TRAITOR', 'HEALER', 'SEER', 'TIEBREAKER', 'SWAPPER'];
    const availablePlayers = [...playersWithoutHost];
    
    modifiers.forEach(modifier => {
        const config = modifierConfig[modifier.toLowerCase()];
        if (!config || config.count === 0) return;
        
        // Calculează jucători eligibili
        let eligiblePlayers = availablePlayers.filter(p => {
            if (p.modifier !== null) return false; // Deja are modifier
            
            // HEALER: Nu poate fi MAFIA
            if (modifier === 'HEALER' && p.role === 'MAFIA') return false;
            
            // SEER: Nu poate fi DETECTIVE
            if (modifier === 'SEER' && p.role === 'DETECTIVE') return false;
            
            // SWAPPER: Poate fi orice rol (10% șansă universală)
            
            // Verifică șansele per rol
            const roleChance = config.roleChances?.[p.role] || 50;
            return Math.random() * 100 < roleChance;
        });
        
        // Shuffle și selectează
        eligiblePlayers.sort(() => Math.random() - 0.5);
        const selectedCount = Math.min(config.count, eligiblePlayers.length);
        
        for (let i = 0; i < selectedCount; i++) {
            eligiblePlayers[i].modifier = modifier;
            // Elimină din availablePlayers
            const index = availablePlayers.indexOf(eligiblePlayers[i]);
            if (index > -1) availablePlayers.splice(index, 1);
        }
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
                    detectiveCount: data.roleConfig.detectiveCount || 1,
                    modifierConfig: data.roleConfig.modifierConfig || {
                        enabled: true,
                        traitor: { count: 0, roleChances: { MAFIA: 10, DOCTOR: 50, DETECTIVE: 50, CITIZEN: 50 } },
                        healer: { count: 0, roleChances: { DOCTOR: 50, DETECTIVE: 50, CITIZEN: 50 } },
                        seer: { count: 0, roleChances: { MAFIA: 50, DOCTOR: 50, CITIZEN: 50 } },
                        tiebreaker: { count: 0, roleChances: { MAFIA: 10, DOCTOR: 90, DETECTIVE: 90, CITIZEN: 90 } },
                        swapper: { count: 0, roleChances: { MAFIA: 10, DOCTOR: 10, DETECTIVE: 10, CITIZEN: 10 } }
                    }
                },
                nightActions: {},
                teamChoices: {},
                votes: {},
                consensusLocked: {},
                alivePlayers: [],
                deadPlayers: [],
                mafiaChat: [],
                traitorActivated: false // Flag pentru când Traitor devine activ
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
            
            // Identifică membrii fiecărei echipe pentru coordonare
            const mafiaPlayers = room.players.filter(p => p.role === 'MAFIA');
            const doctorPlayers = room.players.filter(p => p.role === 'DOCTOR');
            const detectivePlayers = room.players.filter(p => p.role === 'DETECTIVE');
            
            const mafiaList = mafiaPlayers.map(p => ({ id: p.id, name: p.name }));
            const doctorList = doctorPlayers.map(p => ({ id: p.id, name: p.name }));
            const detectiveList = detectivePlayers.map(p => ({ id: p.id, name: p.name }));
            
            // Trimite fiecărui jucător rolul său
            room.players.forEach(player => {
                const payload = {
                    role: player.role,
                    modifier: player.modifier, // Include modifier pentru fiecare jucător
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        alive: p.alive
                    }))
                };
                
                // Trimite lista echipei DOAR dacă sunt 2+ membri
                if (player.role === 'MAFIA' && mafiaList.length >= 2) {
                    payload.mafiaTeam = mafiaList;
                }
                
                if (player.role === 'DOCTOR' && doctorList.length >= 2) {
                    payload.doctorTeam = doctorList;
                }
                
                if (player.role === 'DETECTIVE' && detectiveList.length >= 2) {
                    payload.detectiveTeam = detectiveList;
                }
                
                // Dacă e Narrator (host), trimite toate rolurile cu modifiers
                if (player.role === 'NARRATOR') {
                    payload.allRoles = room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        role: p.role,
                        modifier: p.modifier, // Include modifier pentru Narrator
                        hitCount: p.hitCount, // Include hitCount pentru HEALER
                        alive: p.alive
                    }));
                }
                
                io.to(player.id).emit('game-started', payload);
            });
            
            // După 10 secunde (role reveal countdown), trimite signal să înceapă noaptea
            // Host-ul va controla manual trecerea către noapte
            setTimeout(() => {
                // Notifică host-ul că poate începe noaptea
                const narrator = room.players.find(p => p.role === 'NARRATOR');
                if (narrator) {
                    io.to(narrator.id).emit('ready-for-night', { message: 'Jucătorii și-au văzut rolurile. Poți începe noaptea.' });
                }
            }, 10000);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
    
    // TEAM CHOICE - Pentru echipe cu 2+ membri
    socket.on('team-choice', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const { actionType, targetId } = data;
        const player = room.players.find(p => p.id === socket.id);
        
        if (!player) return;
        
        // Verifică dacă consensul este deja locked pentru acest actionType
        if (!room.gameState.consensusLocked) {
            room.gameState.consensusLocked = {};
        }
        
        if (room.gameState.consensusLocked[actionType]) {
            return; // Consensul a fost deja atins, ignoră alegeri noi
        }
        
        // Inițializează teamChoices pentru acest actionType dacă nu există
        if (!room.gameState.teamChoices[actionType]) {
            room.gameState.teamChoices[actionType] = {};
        }
        
        // Salvează alegerea jucătorului
        room.gameState.teamChoices[actionType][socket.id] = targetId;
        
        // Găsește toți membrii echipei vii
        let teamMembers = [];
        if (actionType === 'mafia') {
            teamMembers = room.gameState.alivePlayers.filter(p => p.role === 'MAFIA');
        } else if (actionType === 'doctor') {
            teamMembers = room.gameState.alivePlayers.filter(p => p.role === 'DOCTOR');
        } else if (actionType === 'detective') {
            teamMembers = room.gameState.alivePlayers.filter(p => p.role === 'DETECTIVE');
        }
        
        const choices = room.gameState.teamChoices[actionType];
        const choicesMade = Object.keys(choices).length;
        const totalMembers = teamMembers.length;
        
        // Verifică dacă toți membrii au ales aceeași țintă
        const targetIds = Object.values(choices);
        const allAgree = targetIds.every(id => id === targetIds[0]);
        
        // Trimite update la toți membrii echipei
        const targetPlayer = room.players.find(p => p.id === targetIds[0]);
        const updateData = {
            choicesMade: choicesMade,
            totalMembers: totalMembers,
            allAgree: allAgree,
            targetName: targetPlayer ? targetPlayer.name : 'Necunoscut'
        };
        
        teamMembers.forEach(member => {
            io.to(member.id).emit('team-consensus-update', updateData);
        });
        
        // Dacă toți au ales și sunt de acord
        if (choicesMade === totalMembers && allAgree) {
            // Lock consensus pentru acest actionType
            room.gameState.consensusLocked[actionType] = true;
            
            // Salvează acțiunea finală
            room.gameState.nightActions[actionType] = targetIds[0];
            
            // Notifică echipa despre consens
            teamMembers.forEach(member => {
                io.to(member.id).emit('team-consensus-achieved', {
                    targetName: targetPlayer.name
                });
            });
            
            // Reset team choices pentru acest actionType
            room.gameState.teamChoices[actionType] = {};
            
            // Verifică dacă toate acțiunile sunt complete
            checkNightActionsComplete(roomCode);
        } else if (choicesMade === totalMembers && !allAgree) {
            // Toți au ales dar nu sunt de acord - resetează
            room.gameState.teamChoices[actionType] = {};
            
            teamMembers.forEach(member => {
                io.to(member.id).emit('team-consensus-failed', {
                    message: 'Membrii echipei au ales ținte diferite! Alegeți din nou.'
                });
            });
        }
    });
    
    // NIGHT ACTIONS (pentru acțiuni solo)
    socket.on('night-action', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        
        // Narrator nu poate face acțiuni
        if (!player || player.role === 'NARRATOR') {
            return;
        }
        
        const { actionType, targetId } = data;
        room.gameState.nightActions[actionType] = targetId;
        
        // Confirmă acțiunea
        socket.emit('action-confirmed', { actionType });
        
        // Trimite update la narrator
        const narrator = room.players.find(p => p.role === 'NARRATOR');
        if (narrator) {
            io.to(narrator.id).emit('narrator-action-update', {
                actions: room.gameState.nightActions,
                players: room.players
            });
        }
        
        // Verifică dacă toți au acționat
        checkNightActionsComplete(roomCode);
    });
    
    // DAY VOTE
    socket.on('vote', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        
        // Narrator nu poate vota
        if (!player || player.role === 'NARRATOR') {
            return;
        }
        
        const { targetId } = data;
        
        // Verifică dacă există Swapper și dacă votul vine de la Swapper
        const isSwapper = player.modifier === 'SWAPPER';
        
        if (isSwapper) {
            // Swapper votează DUPĂ ce face swap-ul (sau decide să nu facă)
            room.gameState.votes[socket.id] = targetId;
            
            console.log(`🔄 SWAPPER ${player.name} a votat: ${targetId}`);
            
            // Procesează voturile finale
            processVotes(roomCode);
        } else {
            // Votul normal (nu de la Swapper)
            room.gameState.votes[socket.id] = targetId;
            
            // Dacă există Swapper, trimite-i votul în timp real
            if (room.gameState.swapperId) {
                io.to(room.gameState.swapperId).emit('swapper-vote-update', {
                    voterId: socket.id,
                    voterName: player.name,
                    targetId: targetId,
                    targetName: room.players.find(p => p.id === targetId)?.name
                });
            }
            
            // Broadcast votul (fără a dezvălui cine a votat pentru jucători normali)
            io.to(roomCode).emit('vote-cast', {
                voterId: socket.id,
                targetId: targetId
            });
            
            // Trimite update la narrator
            const narrator = room.players.find(p => p.role === 'NARRATOR');
            if (narrator) {
                io.to(narrator.id).emit('narrator-vote-update', {
                    votes: room.gameState.votes,
                    players: room.players
                });
            }
            
            // Verifică dacă toți jucătorii normali (fără Swapper) au votat
            const aliveCount = room.gameState.alivePlayers.length;
            const swapperExists = room.gameState.swapperId !== undefined;
            const expectedVotes = swapperExists ? aliveCount - 1 : aliveCount;
            const voteCount = Object.keys(room.gameState.votes).length;
            
            if (voteCount === expectedVotes) {
                if (swapperExists) {
                    // Toți au votat EXCEPȚÂND Swapper-ul → Dă-i acces să facă swap
                    io.to(room.gameState.swapperId).emit('swapper-action-time', {
                        message: 'Toți jucătorii au votat. Poți modifica un vot sau sări direct la votul tău.',
                        votes: room.gameState.votes,
                        players: room.players
                    });
                } else {
                    // Fără Swapper → procesează direct
                    processVotes(roomCode);
                }
            }
        }
    });
    
    // SWAPPER: Modifică votul unui jucător
    socket.on('swapper-swap-vote', (data) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        
        // Verifică că e chiar Swapper-ul
        if (!player || player.modifier !== 'SWAPPER') {
            return;
        }
        
        const { originalVoterId, newTargetId } = data;
        
        // Modifică votul în secret
        if (room.gameState.votes[originalVoterId]) {
            const originalTarget = room.gameState.votes[originalVoterId];
            room.gameState.votes[originalVoterId] = newTargetId;
            
            const originalVoter = room.players.find(p => p.id === originalVoterId);
            const newTarget = room.players.find(p => p.id === newTargetId);
            
            console.log(`🔄 SWAPPER: ${originalVoter?.name}'s vote changed to ${newTarget?.name}`);
            
            // Notifică doar Swapper-ul și Narrator-ul
            socket.emit('swapper-swap-confirmed', {
                message: `Ai modificat votul lui ${originalVoter?.name} către ${newTarget?.name}`
            });
            
            const narrator = room.players.find(p => p.role === 'NARRATOR');
            if (narrator) {
                io.to(narrator.id).emit('narrator-notification', {
                    message: `🔄 SWAPPER a modificat votul lui ${originalVoter?.name} către ${newTarget?.name}`
                });
            }
            
            // După swap REUȘIT, cere Swapper-ului să voteze
            socket.emit('swapper-vote-now', {
                message: 'Acum votează și tu!'
            });
        } else {
            // Votul nu există (eroare) - cere Swapper-ului să voteze oricum
            console.warn(`⚠️ SWAPPER tried to swap non-existent vote: ${originalVoterId}`);
            socket.emit('swapper-vote-now', {
                message: 'Acum votează și tu!'
            });
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
        
        // Validare mesaj - max 200 caractere
        if (!data.message || data.message.length > 200) {
            return; // Ignoră mesaje invalide
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
    
    // DOCTOR CHAT - Trimite mesaj
    socket.on('doctor-chat-message', (data) => {
        handleRoleChat(socket, data, 'DOCTOR', 'doctor');
    });
    
    // DETECTIVE CHAT - Trimite mesaj
    socket.on('detective-chat-message', (data) => {
        handleRoleChat(socket, data, 'DETECTIVE', 'detective');
    });
    
    // RESTART GAME - Resetează jocul păstrând lobby-ul
    socket.on('restart-game', () => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room) return;
        
        // Curăță toate timeout-urile de disconnect active
        room.players.forEach(player => {
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                delete player.disconnectTimeout;
            }
        });
        
        // Resetează starea jocului
        room.started = false;
        room.gameState.phase = 'lobby';
        room.gameState.round = 1;
        room.gameState.nightActions = {};
        room.gameState.teamChoices = {};
        room.gameState.votes = {};
        room.gameState.consensusLocked = {};  // Curăță consensus locks
        room.gameState.alivePlayers = [];
        room.gameState.deadPlayers = [];
        room.gameState.mafiaChat = [];
        room.gameState.swapperId = undefined;  // Cleanup Swapper
        room.gameState.normalVotesComplete = false;
        room.gameState.swapperVotes = {};
        
        // Resetează rolurile jucătorilor și elimină flag-ul disconnected
        room.players = room.players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost
        }));
        
        console.log(`🔄 Joc resetat în camera ${roomCode}`);
        
        // Notifică toți jucătorii
        io.to(roomCode).emit('game-restarted', {
            players: room.players
        });
    });
    
    // HOST: Manual control - Start Night Phase
    socket.on('host-start-night', () => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            socket.emit('error', { message: 'Doar host-ul poate controla fazele!' });
            return;
        }
        
        startNightPhase(roomCode);
    });
    
    // HOST: Manual control - Start Day Phase (Process Night Results)
    socket.on('host-start-day', () => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            socket.emit('error', { message: 'Doar host-ul poate controla fazele!' });
            return;
        }
        
        processNightResults(roomCode);
    });
    
    // HOST: Manual control - Process Votes
    socket.on('host-process-votes', () => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            socket.emit('error', { message: 'Doar host-ul poate controla fazele!' });
            return;
        }
        
        processVotes(roomCode);
    });
    
    // REJOIN ROOM - Reconectare jucător deconectat
    socket.on('rejoin-room', (data) => {
        const { roomCode, playerName } = data;
        const room = gameRooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', { message: 'Camera nu mai există!' });
            return;
        }
        
        // Găsește jucătorul deconectat după nume
        const player = room.players.find(p => p.name === playerName && p.disconnected);
        
        if (!player) {
            socket.emit('error', { message: 'Nu ai fost în această cameră sau ai fost eliminat definitiv!' });
            return;
        }
        
        // Anulează timeout-ul de ștergere dacă există
        if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            delete player.disconnectTimeout;
        }
        
        // Actualizează socket ID-ul și marchează ca reconectat
        const oldId = player.id;
        player.id = socket.id;
        player.disconnected = false;
        
        // Dacă e host (narrator), actualizează room.host
        if (player.isHost) {
            room.host = socket.id;
        }
        
        // Actualizează socket ID în alivePlayers/deadPlayers
        const alivePlayer = room.gameState.alivePlayers.find(p => p.id === oldId);
        if (alivePlayer) {
            alivePlayer.id = socket.id;
        }
        const deadPlayer = room.gameState.deadPlayers.find(p => p.id === oldId);
        if (deadPlayer) {
            deadPlayer.id = socket.id;
        }
        
        // Actualizează voturile și team choices
        if (room.gameState.votes[oldId] !== undefined) {
            room.gameState.votes[socket.id] = room.gameState.votes[oldId];
            delete room.gameState.votes[oldId];
        }
        Object.keys(room.gameState.teamChoices).forEach(actionType => {
            if (room.gameState.teamChoices[actionType][oldId] !== undefined) {
                room.gameState.teamChoices[actionType][socket.id] = room.gameState.teamChoices[actionType][oldId];
                delete room.gameState.teamChoices[actionType][oldId];
            }
        });
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`🔄 ${playerName} s-a reconectat în camera ${roomCode}`);
        
        // Trimite starea completă de joc la jucător
        socket.emit('game-rejoined', {
            player: player,
            room: {
                code: roomCode,
                players: room.players,
                gameState: room.gameState,
                started: room.started
            }
        });
        
        // Notifică ceilalți jucători
        socket.to(roomCode).emit('player-reconnected', {
            playerName: playerName,
            players: room.players
        });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('🔴 Jucător deconectat:', socket.id);
        
        const roomCode = socket.roomCode;
        if (roomCode) {
            const room = gameRooms.get(roomCode);
            if (room) {
                // Dacă host-ul pleacă și jocul A ÎNCEPUT, permite reconnect
                if (room.host === socket.id && room.started) {
                    const player = room.players.find(p => p.id === socket.id);
                    if (player) {
                        player.disconnected = true;
                        
                        console.log(`⏳ Host ${player.name} deconectat - are 5 minute pentru reconnect`);
                        
                        // Timeout de 5 minute pentru host
                        const playerId = player.id;
                        player.disconnectTimeout = setTimeout(() => {
                            // După 5 min, închide lobby-ul
                            console.log(`⏰ Timeout reconnect host - închide lobby ${roomCode}`);
                            io.to(roomCode).emit('lobby-closed', {
                                message: 'Host-ul nu s-a reconectat. Lobby-ul a fost închis.'
                            });
                            
                            const room = gameRooms.get(roomCode);
                            if (room) {
                                room.players.forEach(p => {
                                    if (p.disconnectTimeout) clearTimeout(p.disconnectTimeout);
                                });
                                gameRooms.delete(roomCode);
                            }
                        }, 5 * 60 * 1000);
                        
                        // Notifică ceilalți jucători
                        io.to(roomCode).emit('player-disconnected', {
                            playerName: player.name,
                            players: room.players
                        });
                    }
                } else if (room.host === socket.id && !room.started) {
                    // Joc NU a început - închide lobby-ul direct
                    console.log(`🚺 Host-ul a părăsit camera ${roomCode} în lobby - închis`);
                    
                    // Curăță toate timeout-urile de disconnect active
                    room.players.forEach(player => {
                        if (player.disconnectTimeout) {
                            clearTimeout(player.disconnectTimeout);
                        }
                    });
                    
                    // Notifică toți jucătorii că lobby-ul se închide
                    io.to(roomCode).emit('lobby-closed', {
                        message: 'Host-ul a părăsit jocul. Lobby-ul a fost închis.'
                    });
                    
                    // Șterge camera
                    gameRooms.delete(roomCode);
                } else {
                    const player = room.players.find(p => p.id === socket.id);
                    
                    if (!player) return;
                    
                    // Dacă jocul a început, marchează ca deconectat în loc să ștergi
                    if (room.started) {
                        player.disconnected = true;
                        
                        console.log(`⏳ ${player.name} deconectat - are 5 minute pentru reconnect`);
                        
                        // Notifică ceilalți jucători
                        io.to(roomCode).emit('player-disconnected', {
                            playerName: player.name,
                            players: room.players
                        });
                        
                        // Setează timeout de 5 minute pentru ștergere definitivă
                        player.disconnectTimeout = setTimeout(() => {
                            console.log(`🗑️ ${player.name} eliminat definitiv după timeout`);
                            
                            // Salvează player.id înainte de ștergere (socket.id e deja invalid)
                            const playerId = player.id;
                            
                            // Șterge jucătorul definitiv
                            room.players = room.players.filter(p => p.id !== playerId);
                            room.gameState.alivePlayers = room.gameState.alivePlayers.filter(p => p.id !== playerId);
                            room.gameState.deadPlayers = room.gameState.deadPlayers.filter(p => p.id !== playerId);
                            
                            // Curăță alegerea jucătorului
                            Object.keys(room.gameState.teamChoices).forEach(actionType => {
                                delete room.gameState.teamChoices[actionType][playerId];
                            });
                            delete room.gameState.votes[playerId];
                            
                            // Verifică dacă jucătorul a făcut o acțiune solo în nightActions
                            // nightActions stochează doar targetId, nu player ID, deci nu trebuie curățat
                            
                            // Notifică eliminarea definitivă
                            io.to(roomCode).emit('player-removed-timeout', {
                                playerName: player.name,
                                players: room.players
                            });
                            
                            // Verifică dacă jocul poate continua
                            if (room.gameState.phase === 'night') {
                                checkNightActionsComplete(roomCode);
                            } else if (room.gameState.phase === 'day') {
                                const aliveCount = room.gameState.alivePlayers.length;
                                const voteCount = Object.keys(room.gameState.votes).length;
                                if (voteCount === aliveCount && aliveCount > 0) {
                                    processVotes(roomCode);
                                }
                            }
                            
                            checkWinCondition(roomCode);
                        }, 5 * 60 * 1000); // 5 minute
                    } else {
                        // În lobby, șterge direct
                        room.players = room.players.filter(p => p.id !== socket.id);
                        
                        if (room.players.length === 0) {
                            gameRooms.delete(roomCode);
                            console.log(`🗑️ Camera ${roomCode} ștearsă`);
                        } else {
                            io.to(roomCode).emit('player-left', { players: room.players });
                        }
                    }
                }
            }
        }
    });
});

// Handler generic pentru chat-uri de rol (Doctor, Detective)
function handleRoleChat(socket, data, roleName, roleKey) {
    const roomCode = socket.roomCode;
    const room = gameRooms.get(roomCode);
    
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== roleName) {
        return; // Doar jucătorii cu rolul respectiv pot trimite mesaje
    }    
    // Validare mesaj - max 200 caractere
    if (!data.message || data.message.length > 200) {
        return; // Ignoră mesaje invalide
    }    
    const message = {
        sender: player.name,
        senderId: player.id,
        text: data.message,
        timestamp: Date.now()
    };
    
    // Trimite la toți membrii cu același rol
    const roleMembers = room.players.filter(p => p.role === roleName);
    roleMembers.forEach(member => {
        io.to(member.id).emit(`${roleKey}-chat-message`, message);
    });
    
    // Trimite și la Narrator (host) pentru monitorizare
    const narrator = room.players.find(p => p.role === 'NARRATOR');
    if (narrator) {
        io.to(narrator.id).emit(`${roleKey}-chat-message`, message);
    }
    
    console.log(`💬 ${roleName} chat în ${roomCode}: ${player.name}: ${data.message}`);
}

// Funcție pentru a începe faza de noapte
function startNightPhase(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'night';
    room.gameState.nightActions = {};
    room.gameState.teamChoices = {}; // Reset team consensus pentru rundă nouă
    room.gameState.consensusLocked = {}; // Reset consensus locks pentru rundă nouă
    
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
    
    // Filtrează rolurile după jucătorii VIVI (exclude jucătorii morți din echipe duplicate)
    const hasMafia = room.gameState.alivePlayers.some(p => p.role === 'MAFIA');
    const hasDoctor = room.gameState.alivePlayers.some(p => p.role === 'DOCTOR');
    const hasDetective = room.gameState.alivePlayers.some(p => p.role === 'DETECTIVE');
    
    const allActionsComplete = 
        (!hasMafia || actions.mafia !== undefined) &&
        (!hasDoctor || actions.doctor !== undefined) &&
        (!hasDetective || actions.detective !== undefined);
    
    if (allActionsComplete) {
        // Nu procesăm automat - trimitem notificare la host să continue
        const narrator = room.players.find(p => p.role === 'NARRATOR');
        if (narrator) {
            io.to(narrator.id).emit('ready-for-day', { 
                message: 'Toate acțiunile nopții au fost completate. Poți continua la ziuă.' 
            });
        }
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
    let seerRevelations = []; // Pentru SEER modifier
    
    // Verifică dacă victima a fost salvată
    if (actions.mafia !== undefined) {
        if (actions.mafia !== actions.doctor) {
            victim = room.players.find(p => p.id === actions.mafia);
            if (victim) {
                const targetForSeer = victim; // Salvează referință pentru SEER
                
                // HEALER MODIFIER: Verifică dacă victima are modifier HEALER
                if (victim.modifier === 'HEALER') {
                    victim.hitCount = (victim.hitCount || 0) + 1;
                    
                    // Notifică Narratorul despre lovitură
                    const narrator = room.players.find(p => p.role === 'NARRATOR');
                    if (narrator) {
                        io.to(narrator.id).emit('narrator-healer-hit', {
                            playerName: targetForSeer.name,
                            hitCount: victim.hitCount
                        });
                    }
                    
                    if (victim.hitCount < 2) {
                        // Supraviețuiește prima lovitură
                        saved = true;
                        victim = null; // Nu moare
                        console.log(`🛡️ ${targetForSeer.name} a supraviețuit datorită modifier-ului HEALER (${targetForSeer.hitCount}/2)`);
                    } else {
                        // A doua lovitură - moare
                        victim.alive = false;
                        room.gameState.alivePlayers = room.gameState.alivePlayers.filter(p => p.id !== victim.id);
                        room.gameState.deadPlayers.push(victim);
                        console.log(`💀 ${targetForSeer.name} a murit la a doua lovitură (HEALER: 2/2)`);
                    }
                } else {
                    // Fără HEALER - moare direct
                    victim.alive = false;
                    room.gameState.alivePlayers = room.gameState.alivePlayers.filter(p => p.id !== victim.id);
                    room.gameState.deadPlayers.push(victim);
                    
                    // Trimite spectator mode către jucătorul mort
                    enableSpectatorMode(victim.id, room);
                }
                
                // SEER MODIFIER: Mafia cu SEER vede rolul victimei (chiar dacă a supraviețuit)
                const mafiaMembers = room.gameState.alivePlayers.filter(p => p.role === 'MAFIA');
                mafiaMembers.forEach(mafioso => {
                    if (mafioso.modifier === 'SEER') {
                        seerRevelations.push({
                            playerId: mafioso.id,
                            playerName: mafioso.name,
                            targetName: targetForSeer.name,
                            targetRole: targetForSeer.role
                        });
                    }
                });
            }
        } else {
            saved = true;
            
            // SEER MODIFIER: Doctor cu SEER vede rolul celui salvat
            const savedPlayer = room.players.find(p => p.id === actions.doctor);
            const doctors = room.gameState.alivePlayers.filter(p => p.role === 'DOCTOR');
            doctors.forEach(doctor => {
                if (doctor.modifier === 'SEER' && savedPlayer) {
                    seerRevelations.push({
                        playerId: doctor.id,
                        playerName: doctor.name,
                        targetName: savedPlayer.name,
                        targetRole: savedPlayer.role
                    });
                }
            });
        }
    }
    
    // Rezultat detectiv + SEER modifier
    if (actions.detective !== undefined) {
        const target = room.players.find(p => p.id === actions.detective);
        if (target) {
            // Găsește TOȚI detectivii vii
            const detectives = room.gameState.alivePlayers.filter(p => p.role === 'DETECTIVE');
            detectiveResult = {
                targetName: target.name,
                isMafia: target.role === 'MAFIA'
            };
            
            // Trimite rezultatul la TOȚI detectivii
            detectives.forEach(detective => {
                io.to(detective.id).emit('detective-result', detectiveResult);
                
                // SEER MODIFIER: Detective cu SEER vede rolul exact
                if (detective.modifier === 'SEER') {
                    seerRevelations.push({
                        playerId: detective.id,
                        playerName: detective.name,
                        targetName: target.name,
                        targetRole: target.role
                    });
                }
            });
        }
    }
    
    // Trimite revelații SEER
    seerRevelations.forEach(rev => {
        // Trimite către jucătorul cu SEER
        io.to(rev.playerId).emit('seer-revelation', {
            targetName: rev.targetName,
            targetRole: rev.targetRole
        });
        
        // Trimite și către NARRATOR pentru monitoring
        const narrator = room.players.find(p => p.role === 'NARRATOR');
        if (narrator) {
            io.to(narrator.id).emit('narrator-seer-revelation', {
                playerName: rev.playerName,
                targetName: rev.targetName,
                targetRole: rev.targetRole
            });
        }
    });
    
    // Verifică condiție de victorie (include TRAITOR activation)
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
    
    room.gameState.phase = 'discussion';
    room.gameState.votes = {};
    
    console.log(`☀️ Zi începută în ${roomCode} - Discussion Phase (30s)`);
    
    // Trimite rezultatele nopții și pornește discussion timer
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
    
    // Pornește discussion timer de 30 secunde
    io.to(roomCode).emit('discussion-started', {
        duration: 30000 // 30 secunde
    });
    
    // După 30 secunde, treci la voting phase
    setTimeout(() => {
        startVotingPhase(roomCode);
    }, 30000);
}

// Pornește faza de voting (după discussion)
function startVotingPhase(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'voting';
    room.gameState.votes = {};
    room.gameState.normalVotesComplete = false;
    room.gameState.swapperVotes = {}; // Track votes pentru Swapper
    
    console.log(`🗳️ Voting Phase începută în ${roomCode}`);
    
    // Verifică dacă există Swapper viu
    const swapper = room.gameState.alivePlayers.find(p => p.modifier === 'SWAPPER');
    
    if (swapper) {
        // Notifică Swapper-ul că are modifier-ul
        io.to(swapper.id).emit('swapper-revealed', {
            message: 'Ai modifier-ul SWAPPER! Vei vedea toate voturile și vei putea schimba un vot.'
        });
        
        room.gameState.swapperId = swapper.id;
    }
    
    // Notifică toți jucătorii să înceapă votarea
    io.to(roomCode).emit('voting-started', {
        alivePlayers: room.gameState.alivePlayers.map(p => ({
            id: p.id,
            name: p.name
        })),
        hasSwapper: !!swapper
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
    
    // Găsește cel mai votat (și verifică egalități)
    let maxVotes = 0;
    let candidates = []; // Toți cu același număr maxim de voturi
    
    Object.entries(voteCounts).forEach(([playerId, votes]) => {
        const player = room.players.find(p => p.id === playerId);
        if (!player) return;
        
        if (votes > maxVotes) {
            maxVotes = votes;
            candidates = [player];
        } else if (votes === maxVotes && maxVotes > 0) {
            candidates.push(player);
        }
    });
    
    let eliminated = null;
    
    // TIEBREAKER MODIFIER: Dacă sunt 2+ candidați (egalitate)
    if (candidates.length > 1) {
        // Caută TIEBREAKER în lista de votanți
        const voters = Object.keys(room.gameState.votes).map(voterId => {
            return room.gameState.alivePlayers.find(p => p.id === voterId);
        }).filter(p => p); // Remove nulls
        
        const tiebreaker = voters.find(p => p.modifier === 'TIEBREAKER');
        
        if (tiebreaker) {
            // Votul TIEBREAKER-ului decide
            const tiebreakerVote = room.gameState.votes[tiebreaker.id];
            eliminated = candidates.find(c => c.id === tiebreakerVote);
            
            if (eliminated) {
                console.log(`⚖️ TIEBREAKER: Votul lui ${tiebreaker.name} a decis eliminarea lui ${eliminated.name}`);
                io.to(roomCode).emit('tiebreaker-activated', {
                    tiebreakerName: tiebreaker.name,
                    eliminatedName: eliminated.name
                });
            } else {
                // Tiebreaker nu a votat un candidat din egalitate - aleatoriu
                eliminated = candidates[Math.floor(Math.random() * candidates.length)];
            }
        } else {
            // Fără TIEBREAKER - aleatoriu
            eliminated = candidates[Math.floor(Math.random() * candidates.length)];
            console.log(`🎲 Egalitate fără Tiebreaker - ales aleatoriu: ${eliminated.name}`);
        }
    } else if (candidates.length === 1) {
        eliminated = candidates[0];
    }
    
    if (eliminated) {
        eliminated.alive = false;
        room.gameState.alivePlayers = room.gameState.alivePlayers.filter(p => p.id !== eliminated.id);
        room.gameState.deadPlayers.push(eliminated);
        
        // Trimite spectator mode către jucătorul eliminat
        enableSpectatorMode(eliminated.id, room);
        
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
        
        // Notifică host-ul că poate continua la următoarea rundă
        const narrator = room.players.find(p => p.role === 'NARRATOR');
        if (narrator) {
            io.to(narrator.id).emit('ready-for-next-round', { 
                message: 'Votul s-a încheiat. Poți începe următoarea rundă.' 
            });
        }
    }
}

// Activează modul spectator pentru jucători morți
function enableSpectatorMode(playerId, room) {
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Trimite toate informațiile spectatorului (același lucru pe care îl vede narrator-ul)
    io.to(playerId).emit('enter-spectator-mode', {
        message: 'Ai fost eliminat! Acum ești spectator și poți vedea toate rolurile.',
        allRoles: room.players.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            modifier: p.modifier,
            hitCount: p.hitCount,
            alive: p.alive
        }))
    });
    
    console.log(`👁️ ${player.name} a intrat în modul spectator`);
}

// Verifică condiția de victorie + TRAITOR activation
function checkWinCondition(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return false;
    
    let aliveMafia = room.gameState.alivePlayers.filter(p => p.role === 'MAFIA').length;
    const aliveTown = room.gameState.alivePlayers.filter(p => p.role !== 'MAFIA').length;
    
    // TRAITOR MODIFIER: Dacă toți Mafia au murit și mai sunt 3+ jucători
    if (aliveMafia === 0 && !room.gameState.traitorActivated && room.gameState.alivePlayers.length >= 3) {
        // Caută jucători cu modifier TRAITOR
        const traitor = room.gameState.alivePlayers.find(p => p.modifier === 'TRAITOR' && p.role !== 'MAFIA');
        
        if (traitor) {
            // Activează TRAITOR - devine MAFIA
            console.log(`🎭 TRAITOR ACTIVAT: ${traitor.name} devine MAFIA!`);
            traitor.role = 'MAFIA';
            room.gameState.traitorActivated = true;
            aliveMafia = 1; // Acum avem 1 Mafia
            
            // Notifică traitor-ul și narratorul
            io.to(traitor.id).emit('traitor-activated', {
                message: 'Ai devenit IMPOSTOR! Toți ceilalți impostori au murit și tu ești noul impostor.'
            });
            
            const narrator = room.players.find(p => p.role === 'NARRATOR');
            if (narrator) {
                io.to(narrator.id).emit('narrator-notification', {
                    message: `🎭 ${traitor.name} a devenit IMPOSTOR (Traitor activated)!`
                });
            }
        }
    }
    
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
    
    // Curăță toate timeout-urile de disconnect active
    room.players.forEach(player => {
        if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            delete player.disconnectTimeout;
        }
    });
    
    // Cleanup Swapper state
    room.gameState.swapperId = undefined;
    room.gameState.normalVotesComplete = false;
    room.gameState.swapperVotes = {};
    
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
