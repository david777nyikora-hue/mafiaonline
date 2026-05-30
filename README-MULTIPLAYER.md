# 🎭 MAFIA - Multiplayer Online

Un joc complet Mafia implementat cu **Node.js + Socket.io**, unde **fiecare jucător folosește propriul dispozitiv** și se conectează printr-un **cod de cameră generat automat**!

## 🌟 Caracteristici Principale

✅ **Multiplayer Adevărat:**
- Fiecare jucător pe propriul telefon/tabletă/computer
- Host creează cameră și primește un cod unic (ex: ABC123)
- Ceilalți jucători se conectează cu codul
- Sincronizare în timp real între toate dispozitivele

✅ **Sistem Complet de Roluri:**
- 🔫 **Mafia** - Elimină cetățeni în timpul nopții
- 💊 **Doctor** - Salvează jucători în timpul nopții  
- 🔍 **Detectiv** - Investighează jucători
- 👤 **Cetățean** - Votează în timpul zilei

✅ **Gameplay Interactiv:**
- Faze de Noapte și Zi alternate
- Fiecare jucător vede doar rolul său
- Acțiuni secrete pentru fiecare rol
- Votare democratică în timpul zilei
- Verificare automată condiții de victorie

## 🚀 Instalare și Pornire

### Cerințe
- **Node.js** (v14 sau mai nou) - [Descarcă aici](https://nodejs.org/)
- Browser modern (Chrome, Firefox, Edge, Safari)

### Pași de Instalare

1. **Instalează Node.js** (dacă nu e deja instalat)

2. **Navighează în folderul proiectului:**
```bash
cd c:\wamp64\www\Mafia
```

3. **Instalează dependențele:**
```bash
npm install
```

4. **Pornește serverul:**
```bash
npm start
```

5. **Deschide jocul în browser:**
   - Pe același computer: `http://localhost:3000`
   - Pe alte dispozitive (în aceeași rețea): `http://[IP-ul-computerului]:3000`
   
   Pentru a afla IP-ul:
   - Windows: `ipconfig` în CMD
   - Mac/Linux: `ifconfig` în Terminal

## 🎮 Cum se Joacă

### Pentru HOST (organizator):

1. Accesează `http://localhost:3000` în browser
2. Click pe **"Creează Cameră"**
3. Introdu numele tău
4. Alege numărul de mafioți (recomandat: 2 pentru 6-8 jucători)
5. Primești un **cod de 6 caractere** (ex: **XYZ789**)
6. **Trimite codul celorlalți jucători** (WhatsApp, SMS, etc.)
7. Când toți sunt conectați, apasă **"Start Joc"**

### Pentru JUCĂTORI:

1. Primești codul de la host (ex: XYZ789)
2. Accesează jocul pe telefon/tabletă: `http://[IP-host]:3000`
3. Click pe **"Intră în Cameră"**
4. Introdu numele tău
5. Introdu codul primit
6. Așteaptă să înceapă jocul!

### În timpul Jocului:

#### 🌙 **NOAPTE:**
- **Mafia**: Alege o victimă
- **Doctor**: Alege pe cine să salveze
- **Detectiv**: Investighează un jucător (află dacă e Mafia)
- **Cetățean**: Așteaptă

#### ☀️ **ZI:**
1. Se anunță cine a murit (sau dacă doctorul a salvat)
2. Detectivul știe rezultatul investigației sale
3. **Toți discută** cine ar putea fi Mafia
4. **Fiecare votează** pe dispozitivul său
5. Cel mai votat este eliminat

### 🏆 Condiții de Victorie:
- **Orașul câștigă**: Toți mafioții sunt eliminați
- **Mafia câștigă**: Număr mafioți ≥ număr cetățeni

## 📱 Configurare pentru Mai Multe Dispozitive

### Opțiunea 1: Aceeași Rețea WiFi (Cel Mai Simplu)

1. Conectează toate dispozitivele la aceeași rețea WiFi
2. Găsește IP-ul computerului care rulează serverul:
   ```bash
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```
3. Caută ceva de genul: `192.168.1.100`
4. Pe celelalte dispozitive, accesează: `http://192.168.1.100:3000`

### Opțiunea 2: Online (Pentru jucători din locații diferite)

Pentru a juca cu prieteni de la distanță, ai nevoie de un serviciu de port forwarding sau hosting:

**Variante Simple:**
- **ngrok**: [ngrok.com](https://ngrok.com/) - Gratuit, rapid
  ```bash
  ngrok http 3000
  ```
  Primești un link temporar care funcționează global!

- **Heroku**: Deploy gratuit
- **Glitch**: [glitch.com](https://glitch.com/) - hosting instant

## 🛠️ Structura Tehnică

```
/mafia-multiplayer
   ├── server.js              # Backend Node.js + Socket.io
   ├── index.html             # Client multiplayer
   ├── style.css              # Stilizare
   ├── script-multiplayer.js  # Logică client Socket.io
   ├── package.json           # Dependențe
   └── README.md             # Documentație
```

### Tehnologii:
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Comunicare**: WebSocket (Socket.io) pentru real-time sync

## 🎯 Configurări Recomandate

| Jucători | Mafia | Doctor | Detectiv | Cetățeni |
|----------|-------|--------|----------|----------|
| 4        | 1     | 1      | 1        | 1        |
| 6        | 2     | 1      | 1        | 2        |
| 8        | 2     | 1      | 1        | 4        |
| 10       | 3     | 1      | 1        | 5        |
| 12       | 3     | 1      | 1        | 7        |

## 🐛 Troubleshooting

### Serverul nu pornește:
```bash
# Verifică dacă Node.js e instalat
node --version

# Reinstalează dependențele
npm install
```

### Jucătorii nu se pot conecta:
- Verifică firewall-ul (permite portul 3000)
- Verifică că toate dispozitivele sunt pe aceeași rețea
- Verifică IP-ul computerului (poate s-a schimbat)
- Încearcă să dezactivezi temporar firewall-ul

### Eroare "Cannot find module":
```bash
npm install
```

## 🎯 Sfaturi Strategice

### Pentru Mafia 🔫
- Rămâi discret și nu te faci prea observat
- Acuză alți jucători pentru a devia suspiciunea
- Coordonează-te cu ceilalți mafioți

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

## 📝 Versiuni Viitoare

- [ ] Chat în joc
- [ ] Timer pentru faze
- [ ] Sunete și efecte audio
- [ ] Roluri suplimentare (Joker, Bodyguard)
- [ ] Istoric jocuri
- [ ] Statistici jucători

## 📄 Licență

Cod gratuit pentru uz personal și educațional.

## 🎉 Distracție Plăcută!

Bucură-te de joc împreună cu prietenii tăi!

---

**Versiune Multiplayer 2.0** - Creat cu ❤️ pentru iubitorii de jocuri de society
