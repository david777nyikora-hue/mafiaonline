# 👁️ Ghid Complet Povestitor (Narrator) - Sistem de Monitoring

## 📋 Prezentare Generală

Povestitorul (Host) nu participă în joc, dar vede **TOTUL** ce se întâmplă. Acesta are un ecran special de monitoring cu informații complete despre:
- Toate rolurile și modifiers ale jucătorilor
- Acțiunile de noapte ale fiecărui rol
- Voturile de zi ale fiecărui jucător
- **CE VĂDE fiecare jucător cu modifier SEER**
- Hit count pentru jucătorii cu modifier HEALER
- Activări de modifiers (Traitor, Tiebreaker)
- Toate chat-urile secrete (Mafia, Doctor, Detective)

---

## 🎯 Ecranul Povestitorului - Componente

### 1. 👥 Lista Jucători (cu TOATE detaliile)

Fiecare jucător este afișat cu:
- **Status**: ✅ Viu sau 💀 Mort
- **Nume**: Numele jucătorului
- **Rol**: Icon și nume rol (🔫 Impostor, 💊 Doctor, 🔍 Detectiv, 👤 Cetățean)
- **Modifier** (dacă există): Badge glow cu:
  - 🎭 Traitor
  - 🛡️ Healer + **(hitCount/2)** dacă a fost lovit
  - 👁️ Seer
  - ⚖️ Tiebreaker

**Exemplu display**:
```
✅ Alex - 🔫 Impostor 🎭 Traitor
✅ Maria - 💊 Doctor 🛡️ Healer (1/2 lovituri)
✅ Bob - 🔍 Detectiv
✅ John - 👤 Cetățean ⚖️ Tiebreaker
💀 Sara - 👤 Cetățean 👁️ Seer
```

### 2. 💬 Chat-uri Monitorizate

Povestitorul vede TOATE mesajele din chat-urile secrete:
- **🔫 Chat Mafia Secret**: Tot ce discută impostorii
- **💊 Chat Doctor Secret**: Tot ce discută doctorii
- **🔍 Chat Detectiv Secret**: Tot ce discută detectivii

Format mesaje:
```
[MAFIA] Alex: Omorâm pe Maria în noaptea asta?
[MAFIA] John: Da, e doctor sigur!
```

### 3. 🌙 Acțiuni Noapte (cu PREDICȚII modifier)

Povestitorul vede acțiunile curente și **predicții** despre ce vor vedea jucătorii cu modifiers:

**Exemplu**:
```
🔫 Mafia atacă: Maria
  👁️ Alex va vedea rolul lui Maria (are SEER)
  🛡️ Maria are HEALER! (0/2 lovituri) - va supraviețui!

💊 Doctor salvează: Bob
  👁️ Sara va vedea rolul lui Bob (are SEER)

🔍 Detectiv investighează: John
  👁️ Detectivul nu poate avea SEER (restricție)
```

### 4. ☀️ Voturi Zi (cu TIEBREAKER marcat)

Povestitorul vede cine votează pe cine, **inclusiv cine are TIEBREAKER**:

**Exemplu**:
```
Voturi curente:
• Alex → Maria
• Bob ⚖️ (TIEBREAKER) → Maria
• John → Alex
• Sara → Maria

Sumar voturi:
Maria: 3 voturi
Alex: 1 voturi

⚖️ EGALITATE! Bob va decide (dacă a votat un candidat)
```

### 5. ⭐ Evenimente Modifiers (Log Timp Real)

Log animat cu toate evenimentele legate de modifiers:

**Exemple**:
```
[21:45:32] 🎭 Alex a devenit IMPOSTOR (Traitor activated)!
[21:44:15] 🛡️ Maria a fost lovit! (HEALER: 1/2 lovituri)
[21:43:00] ⚖️ Votul lui Bob a decis eliminarea Mariei! (TIEBREAKER)
```

Culori border:
- 🎭 Traitor: Roșu (#ff3333)
- 🛡️ Healer: Verde (#33ff99)
- ⚖️ Tiebreaker: Auriu (#ffd700)
- ℹ️ Info: Albastru (#3399ff)

### 6. 👁️ Revelații Seer (CE VĂDE JUCĂTORII)

**Cea mai importantă secțiune!** Aici Povestitorul vede **exact ce văd jucătorii cu modifier SEER**:

**Exemplu**:
```
[21:46:30] Alex vede: 🔫 Maria = Impostor
[21:45:15] Sara vede: 💊 Bob = Doctor
[21:44:00] John vede: 👤 Maria = Cetățean
```

Aceasta reflectă **ce primește jucătorul pe ecranul său** - Povestitorul monitorizează experiența fiecărui jucător!

---

## 🔄 Flux de Informații - Cum Funcționează

### Faza de Noapte

1. **Jucători aleg ținte** (Mafia/Doctor/Detective)
2. **Server trimite către Povestitor**:
   - `narrator-action-update`: Acțiuni curente + predicții Seer/Healer
3. **Povestitorul vede predicții**:
   ```
   "Alex va vedea rolul lui Maria" (înainte să se întâmple)
   ```

4. **Server procesează acțiuni**:
   - HEALER lovit → `narrator-healer-hit` → "Maria a fost lovit! (1/2)"
   - SEER vede roluri → `narrator-seer-revelation` → "Alex vede: Maria = Doctor"

5. **Povestitorul vede rezultate**:
   - Log actualizat cu ce a văzut fiecare jucător
   - HitCount actualizat în lista jucători

### Faza de Zi

1. **Jucători votează**
2. **Server trimite către Povestitor**:
   - `narrator-vote-update`: Voturi curente + detectare TIEBREAKER

3. **Povestitorul vede**:
   ```
   Bob ⚖️ (TIEBREAKER) → Maria
   
   EGALITATE! Bob va decide dacă a votat un candidat din egalitate
   ```

4. **La procesare voturi**:
   - Dacă egalitate → `tiebreaker-activated` (trimis la TOȚI)
   - Povestitorul vede: "⚖️ Votul lui Bob a decis eliminarea Mariei!"

### Activare Traitor

1. **Ultimul Impostor moare** + **3+ jucători vii**
2. **Server găsește jucător cu TRAITOR**
3. **Trimite**:
   - Către jucător: `traitor-activated` → "Ai devenit IMPOSTOR!"
   - Către Povestitor: `narrator-notification` → "Alex a devenit IMPOSTOR (Traitor activated)!"

4. **Povestitorul vede**:
   - Log: "🎭 Alex a devenit IMPOSTOR (Traitor activated)!"
   - Lista jucători: Alex acum are rol 🔫 Impostor

---

## 🎮 Utilizare Practică

### Scenario 1: Jucător cu SEER

**Setup**:
- Alex = Impostor cu modifier SEER
- Maria = Doctor

**Noapte**:
1. Mafia alege să omoare pe Maria
2. **Povestitor vede predicție**:
   ```
   🔫 Mafia atacă: Maria
   👁️ Alex va vedea rolul lui Maria
   ```
3. **Server procesează** → Alex primește "👁️ SEER: Maria este Doctor!"
4. **Povestitor vede revelație**:
   ```
   [21:45:30] Alex vede: 💊 Maria = Doctor
   ```

**Rezultat**: Povestitorul știe că Alex acum cunoaște rolul Mariei!

### Scenario 2: Jucător cu HEALER

**Setup**:
- Maria = Cetățean cu modifier HEALER
- Mafia alege Maria

**Noapte 1**:
1. Mafia atacă Maria
2. **Povestitor vede predicție**:
   ```
   🔫 Mafia atacă: Maria
   🛡️ Maria are HEALER! (0/2 lovituri) - va supraviețui!
   ```
3. **Server procesează** → Maria hitCount: 0 → 1
4. **Povestitor primește**:
   ```
   narrator-healer-hit: Maria a fost lovit! (1/2 lovituri)
   ```
5. **Display actualizat**:
   ```
   ✅ Maria - 👤 Cetățean 🛡️ Healer (1/2 lovituri)
   ```
6. **Ziua**: "Nimeni nu a murit!" (fără salvare Doctor)

**Noapte 2**:
1. Mafia atacă Maria DIN NOU
2. **Povestitor vede**:
   ```
   🔫 Mafia atacă: Maria
   🛡️ Maria are HEALER! (1/2 lovituri) - va MURI de data asta!
   ```
3. **Maria moare** (hitCount: 2/2)

**Rezultat**: Povestitorul știe când un jucător cu HEALER va muri!

### Scenario 3: TIEBREAKER Activat

**Setup**:
- Bob = Cetățean cu modifier TIEBREAKER
- Voturi: Alex (3), Maria (3), John (2)

**Zi**:
1. Votare se termină cu egalitate
2. **Povestitor vede**:
   ```
   Sumar voturi:
   Alex: 3 voturi
   Maria: 3 voturi
   John: 2 voturi
   
   ⚖️ EGALITATE! Bob va decide (dacă a votat un candidat)
   ```
3. **Server verifică**: Bob a votat Maria
4. **Rezultat**: Maria este eliminată
5. **Toți primesc**: "⚖️ TIEBREAKER: Votul lui Bob a decis eliminarea Mariei!"
6. **Povestitor log**:
   ```
   [21:50:00] ⚖️ Votul lui Bob a decis eliminarea Mariei! (TIEBREAKER)
   ```

**Rezultat**: Povestitorul știe când și cum TIEBREAKER influențează votarea!

---

## 📊 Informații Strategice pentru Povestitor

### Ce să monitorizezi

1. **Seer Revelations**: Cine știe ce roluri?
   - Dacă Impostor cu SEER vede Doctori → va ținti specific
   - Dacă Doctor cu SEER vede Impostori → poate coordona salvări

2. **Healer Hit Counts**: Cine e vulnerabil?
   - (0/2): Încă are protecție
   - (1/2): Următoarea lovitură îl omoară!

3. **Tiebreaker Potential**: În caz de egalitate
   - Verifică dacă TIEBREAKER a votat un candidat din egalitate
   - Dacă nu → rezultat aleatoriu

4. **Traitor Activation**: Când se întâmplă?
   - Toți Impostori morți + 3+ jucători vii
   - Urmărește când se apropie de această condiție

### Sfaturi pentru Povestire

- **Anunță rezultatele**, nu procesul
  - ❌ "Alex cu SEER a văzut că Maria e Doctor"
  - ✅ "Nimeni nu a murit în noaptea asta"

- **Creează suspans** cu informațiile tale
  - Știi că HEALER e la (1/2) dar nu dezvălui

- **Urmărește dinamica** 
  - Cine știe ce din Seer revelations
  - Cum influențează deciziile

---

## 🔧 Probleme Comune & Soluții

### "Nu văd Seer revelations"

**Cauză**: Niciun jucător cu SEER nu a acționat încă
**Soluție**: Așteaptă până la procesarea acțiunilor de noapte

### "TIEBREAKER nu funcționează"

**Cauză**: Jucătorul cu TIEBREAKER a votat altcineva (nu candidat din egalitate)
**Soluție**: Normal - rezultatul devine aleatoriu

### "Healer hitCount nu se actualizează"

**Cauză**: Doctor a salvat jucătorul cu HEALER
**Soluție**: HitCount se incrementează doar dacă KILL e succesfull

---

## 🎯 Checklist Povestitor

La începutul jocului:
- [ ] Verifică lista jucători - cine are ce modifier?
- [ ] Notează (mental) jucătorii cu SEER - vor primi informații extra
- [ ] Identifică TIEBREAKER - pentru cazuri de egalitate
- [ ] Monitorizează TRAITOR - pentru activare posibilă

În timpul nopții:
- [ ] Urmărește acțiunile în secțiunea "Acțiuni Noapte"
- [ ] Verifică predicțiile Seer - cine va vedea ce?
- [ ] Monitorizează "Revelații Seer" pentru rezultate

În timpul zilei:
- [ ] Urmărește voturile în timp real
- [ ] Identifică TIEBREAKER în lista de votanți
- [ ] La egalitate - verifică dacă TIEBREAKER a votat un candidat

După eliminări:
- [ ] Verifică condiția pentru Traitor (toți Impostori morți + 3+ jucători)
- [ ] Monitorizează "Evenimente Modifiers" pentru activări

---

**Versiune**: 7ff8857  
**Data**: May 31, 2026  
**Feature**: Enhanced Narrator Monitoring System
