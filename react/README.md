# React islandy (Fáze 1 — strangler-fig)

Postupný přechod na React **bez zahození** staré appky. Nové/vybrané panely se
kreslí v Reactu a mountují do existující HTML skořápky. Ověřeno: build i mount fungují.

## Jednorázová instalace
```bash
npm install --save-dev vite @vitejs/plugin-react
npm install react react-dom lucide-react
```

## package.json — přidej skripty
```json
"scripts": {
  "build:react": "vite build",
  "watch:react": "vite build --watch"
}
```

## Build
```bash
npm run build:react      # vytvoří js/react-islands.js (~144 kB, React uvnitř)
```

## Integrace do index.html (až PO úspěšném buildu)
1. Načti bundle (na konci `<body>`, po ostatních skriptech):
   ```html
   <script src="js/react-islands.js"></script>
   ```
2. Nahraď vanilla patičku účtu mount-pointem, nebo ji nech a mountuj s živými daty
   z renderer-bootstrap.js:
   ```js
   const el = document.getElementById('start-account');
   const prof = await lexisUI.readLawyerProfile();
   const level = (window.LexisEdition && window.LexisEdition.id) || 'full';
   window.LexisReactIslands.mountAccount(el, {
     profile: prof, level,
     onProfile: () => showProfileModal(),
     onSettings: () => lexisUI.openStartSettings(),
     onLock: () => lexisUI.lockApp(),
   });
   ```

## Proč takto
- **Jeden IIFE soubor** = žádná změna způsobu načítání appky, jen jeden `<script>`.
- **Stejné CSS třídy** (`.start-account*`) → styl z `css/lexis-style.css`, motiv z `css/tokens.css`.
- **Lucide ikony** = jednotná tloušťka, přebarví se s motivem (currentColor).
- Další panel = další komponenta v `react/`, přidat mount. Stará appka běží celou dobu.
