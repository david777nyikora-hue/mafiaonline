# 🎮 Mafia Online - Features 7 & 8 Documentation

## Implemented: Discussion Timer + Swapper Modifier

---

## 📝 Feature 7: Discussion Timer (Faza de Discuții)

### **Overview**
After the narrator announces the night events and starts the morning, the game automatically enters a **30-second discussion phase** before voting begins.

### **User Flow**
1. Narrator starts day phase
2. All players receive night results (victim, saved)
3. **NEW**: Discussion timer overlay appears (30 seconds)
4. Players discuss what happened during the night
5. After 30 seconds, app automatically transitions to voting phase

### **Technical Implementation**

#### Backend (server.js)
- **Modified**: `startDayPhase()` function
  - Sets `phase = 'discussion'`
  - Emits `discussion-started` event with 30-second duration
  - Uses `setTimeout()` to auto-start voting after 30 seconds
  
- **New**: `startVotingPhase()` function
  - Sets `phase = 'voting'`
  - Checks for Swapper presence
  - Emits `voting-started` event

```javascript
// Discussion Phase (30s)
room.gameState.phase = 'discussion';
io.to(roomCode).emit('discussion-started', { duration: 30000 });

setTimeout(() => {
    startVotingPhase(roomCode);
}, 30000);
```

#### Frontend (script-multiplayer.js)
- **New Event Listener**: `discussion-started`
- **New Function**: `showDiscussionTimer(duration)`
  - Creates fullscreen overlay with countdown
  - Displays timer from 30 to 0
  - Pulse animation at last 5 seconds (red color)
  - Auto-removes overlay when timer reaches 0

#### UI/UX (style.css)
- **New Classes**:
  - `.discussion-timer-overlay`: Fullscreen backdrop
  - `.discussion-timer-box`: Centered timer card
  - `.discussion-countdown`: Large animated countdown (5rem)
  - Pulse animation for urgency at <5 seconds

### **Example Flow**
```
Night Phase Ends
    ↓
Narrator clicks "Start Day"
    ↓
All players see: "💬 Fază de Discuții"
Countdown: 30 seconds
    ↓
Players discuss
    ↓
Timer reaches 0
    ↓
Auto-transition to Voting Phase
```

---

## 🔄 Feature 8: Swapper Modifier (Manipulatorul de Voturi)

### **Overview**
A **highly powerful (OP)** modifier with only **10% chance** to be assigned. The Swapper can see all votes in real-time and **swap one player's vote** before voting themselves.

### **Key Mechanics**

#### 1. **Secret Assignment**
- Swapper has **10% chance** across all roles (MAFIA, DOCTOR, DETECTIVE, CITIZEN)
- **Does NOT appear in role reveal** at game start
- Player discovers they are Swapper **only when voting phase starts**

#### 2. **Live Vote Tracking**
- While other players vote, Swapper sees real-time updates:
  - Who voted
  - Who they voted for
- Swapper **does not vote** during normal voting phase

#### 3. **Vote Manipulation**
- After all other players have voted:
  - Swapper receives `swapper-action-time` event
  - UI shows all votes in a selectable list
  - Swapper can:
    1. **Select a vote to modify** (e.g., "John → Mary")
    2. **Select new target** (e.g., change to "John → Peter")
    3. **Skip** (no modifications)
- Original voter **NEVER knows** their vote was changed

#### 4. **Final Vote**
- After swap (or skip), Swapper votes normally
- Votes are processed with swapped values
- Results announced as usual

### **Technical Implementation**

#### Backend (server.js)

##### Modified Functions:
1. **`assignModifiers()`**
   - Added `SWAPPER` to modifiers list
   - 10% roleChances for all roles

2. **`startVotingPhase()`** (NEW)
   - Checks if Swapper exists
   - Emits `swapper-revealed` to Swapper
   - Tracks `swapperId` in game state

3. **Vote Handler** (`socket.on('vote')`)
   - Separate flow for Swapper vs normal players
   - For normal votes:
     - Send real-time update to Swapper (`swapper-vote-update`)
     - Check if all non-Swapper players have voted
     - Trigger `swapper-action-time` when ready
   - For Swapper vote:
     - Process final votes after swap

4. **New Event**: `swapper-swap-vote`
   - Receives: `{ originalVoterId, newTargetId }`
   - Modifies `room.gameState.votes[originalVoterId]`
   - Notifies Swapper and Narrator
   - Keeps it secret from other players

```javascript
// Example: Swapper changes vote
room.gameState.votes[originalVoterId] = newTargetId;

// Only Swapper and Narrator know
io.to(swapperId).emit('swapper-swap-confirmed', { ... });
io.to(narratorId).emit('narrator-notification', { 
    message: `🔄 SWAPPER changed ${voterName}'s vote to ${newTargetName}`
});
```

#### Frontend (script-multiplayer.js)

##### New Event Listeners:
- `swapper-revealed`: Notification that player has Swapper modifier
- `swapper-vote-update`: Real-time vote tracking (only for Swapper)
- `swapper-action-time`: All players voted, show swap interface
- `swapper-swap-confirmed`: Swap completed
- `swapper-vote-now`: Prompt Swapper to cast their own vote

##### New Functions:
1. **`updateSwapperLiveVotes(data)`**
   - Stores incoming votes
   - Updates live tracker UI

2. **`createSwapperLiveTracker()`**
   - Creates "🔄 SWAPPER - Live Vote Tracker" UI
   - Shows: `👤 VoterName → 🎯 TargetName`

3. **`showSwapperSwapInterface(data)`**
   - Two-step selection:
     1. Select which vote to modify
     2. Select new target
   - Buttons: "Skip" or "Confirm Swap"

4. **`showSwapperVotingInterface()`**
   - After swap, show normal voting UI for Swapper

#### UI/UX (style.css)

##### New Classes:
- `.swapper-live-tracker-container`: Orange-themed container
- `.swapper-vote-item`: Individual vote display (voter → target)
- `.swapper-swap-container`: Fixed overlay for swap interface
- `.swapper-swap-box`: Card with swap options
- `.swapper-vote-select-item`: Clickable vote cards
  - Hover effect: Orange border
  - Selected: Glowing orange, scale 1.05
- `.swapper-buttons`: Action buttons (Skip/Confirm)

##### Color Scheme:
- Primary: `#ff9933` (Orange)
- Hover: `rgba(255, 153, 51, 0.3)`
- Selected: Glowing orange shadow

---

## 🔐 Security & Privacy

### **Swapper Secrecy**
- Role reveal at game start: **SWAPPER is hidden** (`modifier !== 'SWAPPER'` check)
- Only revealed at voting phase start
- Narrator sees Swapper in player list (for monitoring)

### **Vote Manipulation Privacy**
- Swapped vote: **Only Swapper and Narrator know**
- Modified player: **No notification**
- Other players: **No indication**
- Final results: **Appear normal**

---

## 📊 Game State Tracking

### New Server State Variables:
```javascript
room.gameState.phase = 'discussion' | 'voting' | ...
room.gameState.swapperId = socket.id // Tracks Swapper
room.gameState.normalVotesComplete = false
room.gameState.swapperVotes = {} // Backup of original votes
```

### Client State Variables:
```javascript
let swapperLiveVotes = {}; // Track votes for Swapper
let isSwapper = false; // Flag for Swapper UI
```

---

## 🎯 Testing Checklist

### Discussion Timer
- [ ] Timer appears after narrator starts day
- [ ] Countdown from 30 to 0
- [ ] Pulse animation at <5 seconds
- [ ] Auto-transition to voting at 0
- [ ] Timer visible to all players

### Swapper Modifier
- [ ] Swapper NOT shown in initial role reveal
- [ ] Swapper revealed only at voting phase
- [ ] Live vote tracker updates in real-time
- [ ] Swapper can see all votes
- [ ] Swap interface shows after all normal votes
- [ ] Swapper can select vote to modify
- [ ] Swapper can select new target
- [ ] Skip button works
- [ ] Confirm swap modifies vote secretly
- [ ] Swapper votes after swap
- [ ] Narrator sees swap notification
- [ ] Modified player has NO indication
- [ ] Final results use swapped votes

---

## 🐛 Known Edge Cases

### Discussion Timer
- **Reconnection during discussion**: Player rejoins → sees remaining timer
- **Host leaves during discussion**: Timer continues, auto-transitions

### Swapper
- **Swapper dies before voting**: Normal voting (no Swapper flow)
- **Only 1 player alive + Swapper**: No votes to swap
- **Swapper skips swap**: Direct to voting
- **Swapper swaps to same target**: Valid (no change in result)

---

## 🚀 Future Enhancements

### Discussion Timer
- Configurable duration (15s/30s/60s)
- Audio countdown at last 5 seconds
- Chat integration during discussion

### Swapper
- Swap multiple votes (currently limited to 1)
- Reveal Swapper identity after game ends
- Statistics tracking (swap success rate)

---

## 📝 Files Modified

### Backend
- `server.js`:
  - Modified: `assignModifiers()`, `startDayPhase()`
  - Added: `startVotingPhase()`
  - Modified: `socket.on('vote')`
  - Added: `socket.on('swapper-swap-vote')`

### Frontend
- `script-multiplayer.js`:
  - Added event listeners: `discussion-started`, `voting-started`, `swapper-revealed`, `swapper-vote-update`, `swapper-action-time`, `swapper-swap-confirmed`, `swapper-vote-now`
  - New functions: `showDiscussionTimer()`, `startVotingPhase()`, `updateSwapperLiveVotes()`, `createSwapperLiveTracker()`, `updateSwapperLiveTrackerUI()`, `showSwapperSwapInterface()`, `showSwapperVotingInterface()`
  - Modified: `showRoleRevealWithCountdown()` (hide SWAPPER)
  - Modified: `showNarratorScreen()` (show SWAPPER in narrator list)

### Styling
- `style.css`:
  - Added: Discussion timer styles (`.discussion-timer-overlay`, `.discussion-timer-box`, `.discussion-countdown`)
  - Added: Swapper UI styles (`.swapper-live-tracker-container`, `.swapper-swap-container`, `.swapper-vote-item`, `.swapper-vote-select-item`, `.swapper-buttons`)
  - Added: Responsive media queries for mobile

---

## 🎨 Visual Examples

### Discussion Timer
```
╔════════════════════════════════╗
║     💬 Fază de Discuții        ║
║                                ║
║  Discutați despre ce s-a       ║
║  întâmplat în timpul nopții   ║
║                                ║
║          ⏱️ 30                 ║
║                                ║
║  Votarea va începe automat     ║
║      după 30 secunde           ║
╚════════════════════════════════╝
```

### Swapper Live Tracker
```
╔════════════════════════════════╗
║  🔄 SWAPPER - Live Vote Tracker║
║                                ║
║  👤 Alice  →  🎯 Bob          ║
║  👤 Charlie  →  🎯 Alice      ║
║  👤 David  →  🎯 Charlie      ║
╚════════════════════════════════╝
```

### Swapper Swap Interface
```
╔════════════════════════════════╗
║     🔄 Modifică un Vot         ║
║                                ║
║  1. Selectează votul:          ║
║   [ Alice → Bob ]  ← Selected  ║
║   [ Charlie → Alice ]          ║
║                                ║
║  2. Selectează noua țintă:     ║
║   [ 🎯 Alice ]                 ║
║   [ 🎯 Charlie ]  ← Selected   ║
║                                ║
║  [Sari] [Confirmă Swap] ✓      ║
╚════════════════════════════════╝
```

---

## 📞 Contact & Support

For issues or questions about these features, check:
1. Console logs (F12) for debugging
2. Server terminal for backend errors
3. Network tab for Socket.io events

---

**Last Updated**: 2024
**Version**: 2.0 (Features 7 & 8)
