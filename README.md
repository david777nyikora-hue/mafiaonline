# 🎭 MAFIA - Multiplayer Online Game

Joc Mafia **multiplayer online** în timp real - **fiecare jucător pe propriul dispozitiv**!

## 🎮 [JOACĂ ACUM](https://your-game-url.onrender.com) ← Înlocuiește cu URL-ul tău după deploy

## ✨ Caracteristici

🌐 **Multiplayer Adevărat:**
- Fiecare jucător pe propriul telefon/tabletă/computer
- Host creează cameră → cod unic (ex: ABC123)
- Alții se conectează cu codul
- Sincronizare Socket.io în timp real

🎭 **Sistem de Roluri:**
- 🔫 **Mafia** - Elimină cetățeni noaptea
- 💊 **Doctor** - Salvează jucători
- 🔍 **Detectiv** - Investighează suspecți
- 👤 **Cetățean** - Votează în timpul zilei

⚡ **Gameplay Interactiv:**
- Faze Noapte 🌙 și Zi ☀️ alternate
- Fiecare vede doar rolul său
- Acțiuni secrete pe dispozitiv propriu
- Votare democratică în timp real

## 🎮 Cum se Joacă

### Pentru HOST:
1. Accesează jocul online
2. Click "Creează Cameră"
3. Primești cod (ex: **XYZ789**)
4. Trimite codul prietenilor (WhatsApp, SMS, etc.)
5. Când toți sunt conectați → "Start Joc"

### Pentru JUCĂTORI:
1. Primește codul de la host
2. Accesează același link
3. "Intră în Cameră" → Introdu codul
4. ✅ Gata! Așteaptă să înceapă jocul

### În Joc:
- 🌙 **Noapte**: Fiecare rol acționează secret pe dispozitivul său
- ☀️ **Zi**: Se anunță rezultate → discuții → voturi
- 🏆 **Victorie**: Mafia sau Orașul câștigă!

## 🚀 Instalare Locală

```bash
# Clonează repository
git clone https://github.com/USERNAME/mafia-game.git
cd mafia-game

# Instalează dependențe
npm install

# Pornește server
npm start
```

Accesează: `http://localhost:3000`

**Pentru alte dispozitive (telefoane) în aceeași rețea:**
1. Află IP-ul: `ipconfig` (Windows) sau `ifconfig` (Mac/Linux)
2. Pe telefon: `http://[IP-ul-tau]:3000`

## 🌐 Deploy GRATUIT Online

### Opțiunea 1: Render.com ⭐ (RECOMANDAT)

1. Fork acest repository pe GitHub
2. Mergi pe [render.com](https://render.com)
3. Sign up gratuit (cu GitHub)
4. "New +" → "Web Service"
5. Conectează repository-ul tău
6. Setări:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
7. Click "Create Web Service"
8. ✅ Gata! Primești URL public

### Opțiunea 2: Railway.app

1. [railway.app](https://railway.app)
2. "Start a New Project" → "Deploy from GitHub"
3. Selectează repo-ul
4. ✅ Auto-deploy!

### Opțiunea 3: Glitch.com

1. [glitch.com](https://glitch.com)
2. "New Project" → "Import from GitHub"
3. Paste URL-ul repo-ului
4. ✅ Live instant!

## 📋 Tehnologii

- **Backend**: Node.js + Express
- **Real-time**: Socket.io (WebSockets)
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Styling**: CSS Grid + Flexbox + Animations

## 🎯 Configurări Recomandate

| Jucători | Mafia | Doctor | Detectiv | Cetățeni |
|----------|-------|--------|----------|----------|
| 4        | 1     | 1      | 1        | 1        |
| 6        | 2     | 1      | 1        | 2        |
| 8        | 2     | 1      | 1        | 4        |
| 10       | 3     | 1      | 1        | 5        |

## 🎯 Sfaturi Strategice

### Pentru Mafia 🔫
- Rămâi discret și nu te faci prea observat
- Acuză alți jucători pentru a devia suspiciunea
- Coordonează-te cu ceilalți mafioți (vă cunoașteți între voi)

### Pentru Doctor 💊
- Încearcă să anticipezi cine ar putea fi ținta Mafiei
- Poți să te salvezi pe tine dacă ești în pericol
- Nu dezvălui rolul tău prea devreme

### Pentru Detectiv 🔍
- Folosește informațiile cu prudență
- Nu-ți dezvălui rolul imediat - Mafia te va elimina
- Investighează jucătorii cei mai suspecți

### Pentru Cetățeni 👤
- Observă comportamentul fiecărui jucător
- Votează logic bazându-te pe dovezi
- Lucrează în echipă cu ceilalți cetățeni

## 🛠️ Structura Proiectului

```
/mafia-multiplayer
   ├── server.js              # Backend Node.js + Socket.io
   ├── index.html             # Frontend multiplayer
   ├── style.css              # Stilizare
   ├── script-multiplayer.js  # Client logic
   ├── package.json           # Dependencies
   ├── Procfile               # Pentru Heroku
   └── README.md              # Documentație
```

## 🐛 Troubleshooting

### Local:
- **Serverul nu pornește**: Verifică că Node.js e instalat (`node --version`)
- **Jucători nu se conectează**: Verifică firewall-ul și că sunteți pe aceeași rețea
- **Erori la instalare**: Rulează `npm install` din nou

### Online:
- **Deploy eșuat**: Verifică logurile pe platforma de hosting
- **Joc lent**: Platformele gratuite au limitări de resurse
- **Deconectări**: Normal pe free tier - refresh pagina

## 📄 Licență

MIT License - Gratuit pentru uz personal și educațional

## 🎉 Contribuții

Pull requests sunt binevenite! Pentru schimbări majore, deschide mai întâi un issue.

## 🌟 Star pe GitHub

Dacă îți place jocul, lasă un ⭐ pe GitHub!

---

**Versiune Multiplayer 2.0** - Creat cu ❤️ pentru iubitorii de jocuri de society
