# 🎮 Mafia Game - Modifier System

## Schimbări Majore (Commit 0a9b251)

### 1️⃣ Cod Cameră: 6 Caractere → 4 Caractere
- **Înainte**: ABC123 (6 caractere alfanumerice)
- **Acum**: A1B2 (4 caractere alfanumerice)
- **Motivație**: Mai ușor de partajat și introdus
- **Impact**: Validare actualizată în HTML, JavaScript, și Server

---

## ⭐ Sistem Modifiers (Abilități Secrete)

Modifiers sunt abilități speciale care se dau **aleatoriu** jucătorilor. Fiecare jucător poate avea **maxim 1 modifier per game**.

### 🎭 TRAITOR (Trădător)
**Descriere**: Dacă toți impostorii sunt eliminați, acest jucător devine impostor!

**Caracteristici**:
- ✅ Se activează când **toți impostori mor** ȘI mai sunt **3+ jucători** în viață
- ✅ **Secret**: Jucătorul NU știe că are modifier până când devine impostor
- ✅ Doar **Povestitorul** știe cine are acest modifier
- ✅ Nu poate primi alt modifier după activare
- ✅ **Șanse prestabilite**: 
  - 10% pentru Mafioți (foarte rar)
  - 50% pentru Doctor/Detectiv/Cetățean

**Exemplu**:
```
Rundă 4: Ultimul impostor este eliminat
→ Mai sunt 5 jucători în viață (2 Doctori, 2 Cetățeni, 1 Detectiv)
→ Unul dintre ei are modifier TRAITOR
→ ACTIVARE: "Ai devenit IMPOSTOR! Toți ceilalți impostori au murit..."
```

---

### 🛡️ HEALER (Vindecător)
**Descriere**: Nu moare din prima lovitură, ci abia a doua oară când este ales!

**Caracteristici**:
- ✅ Supraviețuiește **primul kill** (prima dată când Mafia îl alege)
- ✅ Moare la **al doilea kill**
- ✅ **Secret**: Jucătorul NU știe că are modifier
- ✅ Doar **Povestitorul** știe
- ✅ **Restricție**: NU poate fi Impostor (killer)
- ✅ **Șanse**: 50% pentru Doctor/Detectiv/Cetățean

**Exemplu**:
```
Noapte 2: Mafia alege Alex (are modifier HEALER)
→ Alex supraviețuiește! (hitCount: 1/2)
→ Ziua: "Nimeni nu a murit în noaptea asta!" (fără salvare Doctor)

Noapte 3: Mafia alege Alex din nou
→ Alex moare definitiv (hitCount: 2/2)
```

---

### 👁️ SEER (Văzător)
**Descriere**: Când face o acțiune asupra cuiva, vede și ce rol are acea persoană!

**Caracteristici**:
- ✅ **Impostor cu SEER**: Vede rolul victimei (chiar dacă e salvată)
- ✅ **Doctor cu SEER**: Vede rolul pacientului pe care îl salvează
- ✅ **Detectiv cu SEER**: Vede rolul EXACT (nu doar Impostor/Nevinovat)
- ✅ **Secret**: Jucătorul NU știe că are modifier
- ✅ **Restricție**: NU poate fi Detectiv (ar avea prea multă informație)
- ✅ **Șanse**: 50% pentru Impostor/Doctor/Cetățean

**Exemplu**:
```
Impostor Alex are SEER
Noapte 3: Mafia alege să omoare pe "Maria"
→ Alex vede: "👁️ SEER: Maria este Doctor!" (revelație)

Doctor Bob are SEER
Noapte 4: Salvează pe "John"
→ Bob vede: "👁️ SEER: John este Detectiv!"
```

---

### ⚖️ TIEBREAKER (Decisiv)
**Descriere**: La egalitate de voturi, votul său este decisiv!

**Caracteristici**:
- ✅ La **egalitate** (2+ candidați cu același număr de voturi), votul TIEBREAKER decide
- ✅ **Secret**: Jucătorul NU știe că are modifier
- ✅ Doar **Povestitorul** știe
- ✅ **Șanse prestabilite**:
  - 10% pentru Mafioți
  - 90% pentru Doctor/Detectiv/Cetățean
- ✅ **Fallback**: Dacă TIEBREAKER a votat altcineva (nu candidat din egalitate) → random

**Exemplu**:
```
Ziua 3 - Votare:
- Alex: 3 voturi
- Maria: 3 voturi
- Bob: 2 voturi

→ Egalitate între Alex și Maria!
→ Verificare: Votanții includ pe "John" care are TIEBREAKER
→ John a votat Maria
→ Rezultat: "⚖️ TIEBREAKER: Votul lui John a decis eliminarea Mariei!"
```

---

## 🎮 Configurare Host

Când creezi o cameră ca Povestitor, ai noi opțiuni:

```
⭐ Configurează Modifiers (Opțional):

🎭 Traitor (Devine impostor dacă toți impostorii mor): [0-2]
🛡️ Healer (Supraviețuiește primul kill): [0-2]
👁️ Seer (Vede rolul țintei când acționează): [0-2]
⚖️ Tiebreaker (Votul său decide la egalitate): [0-2]

📋 Restricții: 
- Healer nu poate fi Impostor 
- Seer nu poate fi Detective
```

**Șansele sunt prestabilite** conform specificațiilor:
- TRAITOR: 10% Mafia, 50% alții
- HEALER: 50% toți (exclus Mafia)
- SEER: 50% toți (exclus Detective)
- TIEBREAKER: 10% Mafia, 90% alții

---

## 👁️ Ecran Povestitor

Povestitorul vede TOȚI modifiers cu badge-uri:

```
✅ Alex - 🔫 Impostor 🎭 Traitor
✅ Maria - 💊 Doctor 🛡️ Healer
✅ Bob - 🔍 Detectiv
✅ John - 👤 Cetățean ⚖️ Tiebreaker
💀 Sara - 👤 Cetățean 👁️ Seer
```

Badge-urile au animație **glow** pentru vizibilitate.

---

## 🔧 Implementare Tehnică

### Server-side (server.js)
- `assignModifiers()`: Distribuie modifiers cu șanse per rol
- `processNightResults()`: HEALER hit tracking, SEER revelations
- `checkWinCondition()`: TRAITOR activation când Mafia = 0
- `processVotes()`: TIEBREAKER logic la egalitate

### Client-side (script-multiplayer.js)
- Socket events: `seer-revelation`, `traitor-activated`, `tiebreaker-activated`
- Notifications cu durată customizabilă (3s-8s)
- Narrator display cu modifier badges

### UI (index.html)
- Modifier configuration inputs în create-room-screen
- 4-character room code input (maxlength="4")

### Styling (style.css)
- `.modifier-badge` cu glow animation
- Warning color pentru traitor-activated

---

## 📊 Game Balance

**1 Modifier per Player**: Previne stacking de abilități
**Șanse Diferențiate**: Tiebreaker și Traitor mai rare pentru Mafia (10%)
**Secret vs Public**: 
- Secret: Traitor, Healer, Tiebreaker
- Vede: Seer (vede el, nu știu alții)
- Knows All: Narrator (vede toți modifiers)

---

## 🚀 Deployment

✅ Pushed la GitHub (commit 0a9b251)
✅ Auto-deploy pe Render.com activ
✅ Live în ~3-5 minute după push

**URL**: https://mafiaonline.onrender.com

---

## 🎯 Testing Checklist

- [ ] Room code 4 cifre funcționează
- [ ] Traitor se activează când ultimul Mafia moare (cu 3+ jucători)
- [ ] Healer supraviețuiește primul kill
- [ ] Seer vede roluri când acționează
- [ ] Tiebreaker decide la egalitate
- [ ] Narrator vede toți modifiers cu badges
- [ ] Restricții respectate (Healer ≠ Mafia, Seer ≠ Detective)
- [ ] 1 modifier per player maximum

---

**Versiune**: 0a9b251  
**Data**: May 31, 2026  
**Features**: Room Codes (4 chars) + Modifier System (Traitor/Healer/Seer/Tiebreaker)
