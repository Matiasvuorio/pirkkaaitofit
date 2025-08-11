# Atlas-integroitu versio (progressio + pilvihistoria)
- Tallenna treeni -> paikallinen IndexedDB + POST /api/workouts (Atlas)
- Progressio: jos kaikki sarjat saavuttavat tavoitealueen ylärajan, nosta painoa +1.25 kg (tai toistot +2 jos painoa ei ole)
- Tallennuksen jälkeen siirrytään automaattisesti aloitusvalintaan (ja nollataan käynnissä oleva treeni)
- Historia: paikallinen ja pilvihaku, "Tuo" tuo pilvitreenin paikalliseksi

## Käyttöönotto (lokaali)
1) `npm install`
2) `cp .env.example .env` ja korvaa `<db_password>` Atlas-salasanalla
3) `npm run dev`
4) Avaa `http://localhost:8787`

## Deploy (Render)
- Start Command: `node server/server.js`
- Environment: `MONGODB_URI`, `MONGODB_DB=gymbuddy`
