# Documentazione del Progetto: UNIQLO x PAC-MAN Immersive Purchase Experience

La presente documentazione analizza l'architettura tecnica, le tecnologie utilizzate, il funzionamento del flusso utente, i principi di UX design e gli obiettivi del prototipo interattivo **UNIQLO x PAC-MAN**.

---

## 1. Obiettivi del Progetto
Il progetto consiste in un prototipo desktop immersivo per un'esperienza di acquisto in collaborazione tra **UNIQLO** (linea LifeWear/UT) e **PAC-MAN** (pop icon globale del retro-gaming). L'obiettivo principale è coniugare l'engagement e l'interattività ludica con l'efficienza tipica di un e-commerce moderno.
Come evinto dall'analisi del [project-brief.pdf](file:///c:/Users/sorre/Desktop/antigravity/public/assets/project-brief.pdf):
- **Unire brand e pop culture**: Mettere insieme il posizionamento mass-market e quotidiano di UNIQLO (LifeWear) con l'immaginario ludico altamente riconoscibile di PAC-MAN.
- **Risolvere la coerenza UX/ludica**: I prodotti della capsule non sono "nemici" o ostacoli da evitare (come i fantasmi), ma diventano **collectible / reward** da raccogliere per sbloccare l'acquisto e lo sconto.
- **Fornire percorsi flessibili**: Bilanciare il minigioco interattivo per massimizzare l'engagement (adatto a collezionisti della pop-culture) con un percorso diretto all'acquisto ("Skip the Game") per utenti pragmatici o nostalgici con poco tempo a disposizione (nostalgici time-poor e fashion buyer).

---

## 2. Tecnologie Utilizzate
L'applicazione è sviluppata interamente con tecnologie **web standard nativa (Vanilla)**, garantendo elevate prestazioni ed evitando sovrastrutture complesse:
1. **HTML5**: Definisce la struttura semantica di tutte le schermate dell'esperienza (Landing Page, Schermata di Transizione, Press Start, Reveal Cabinet, Start Menu, Gameplay, Collection, Item Detail, Drawer Carrello).
2. **Vanilla CSS (CSS3)**: Gestisce lo styling personalizzato, le transizioni per gli stati (come l'effetto CRT, le scanlines, l'animazione del carrello) e la gestione dei Design Tokens (primitive e semantic tokens per i colori e i bordi).
3. **JavaScript (ES6+)**: Gestisce lo stato globale (schermate attive, sblocco dello sconto, gestione del carrello), la logica di navigazione e il loop grafico del minigioco Pac-Man.
4. **Three.js (r128)**: Utilizzato per il rendering 3D interattivo in due scenari principali:
   - **Reveal del Cabinato 3D**: Caricamento ed animazione del modello 3D del cabinato (`cabinet.glb`) con luci direzionali e ambientali, particelle di polvere (Dust Burst) generate all'impatto con il terreno, rotazione interattiva collegata allo scrolling e animazione del gettone inserito nella fessura.
   - **Product Viewer 3D (Sandwich rendering)**: Visualizzazione volumetrica tridimensionale "a sandwich" delle varianti dei prodotti (T-shirt, Sweatshirt, Cap, Tote Bag) in rotazione e oscillazione costante (bobbing). L'illuminazione si adatta dinamicamente per evitare la sovraesposizione sugli articoli di colore bianco.

---

## 3. Struttura del Flusso Utente e Funzionamento (User Journey)
L'applicazione implementa una navigazione a stati gestita tramite la classe CSS `.active` sulle diverse schermate:

### Fase 1: Homepage UNIQLO (Landing Page)
- Riproduce fedelmente l'interfaccia dell'e-commerce UNIQLO.
- Contiene un **Easter Egg** inserito nel logo (l'icona Pac-Man) che risponde ai clic dell'utente ingrandendosi temporaneamente.
- Dopo 3 clic consecutivi sull'Easter Egg, l'applicazione avvia la transizione verso il mondo arcade.

### Fase 2: Transizione "Eating Page"
- Uno schermo interattivo gestito su HTML5 Canvas in cui un Pac-Man bidimensionale si muove mangiando la pagina web riga per riga, lasciando dietro di sé uno sfondo nero.

### Fase 3: Schermata "Press Start" e Cabinet Drop
- Viene mostrato un pulsante arcade "PRESS START". Cliccandolo, l'immagine del pulsante passa allo stato premuto (`arcade-button-down.png`).
- Subito dopo, il cabinato arcade 3D precipita dall'alto con una fisica di rimbalzo ed emette particelle di polvere.
- L'utente deve scorrere con la rotella del mouse (wheel scroll) per avvicinarsi allo schermo del cabinato. Una barra di avanzamento e una freccia indicano il progresso dello scorrimento.

### Fase 4: Allineamento e Coin Insertion
- Una volta completato lo scorrimento, il cabinato si allinea frontalmente rispetto alla telecamera.
- Compare una moneta d'oro 3D che scivola all'interno della fessura del gettone.
- La telecamera esegue uno zoom immersivo sullo schermo del cabinato arcade attivando l'effetto CRT retro.

### Fase 5: Start Menu & Scelta del Flusso
- Mostra una sequenza di boot diagnostico (Self-Test ROM/RAM) e una presentazione nostalgica dei fantasmi (Blinky, Pinky, Inky e Clyde).
- Presenta due azioni principali:
  - **PLAY PLAYER 1**: Avvia il gameplay di Pac-Man.
  - **VIEW THE COLLECTION**: Mostra un popup informando che la capsule può essere visualizzata, ma invita a giocare per ottenere i vantaggi.

### Fase 6: Gameplay (Minigioco Pac-Man)
- Pac-Man si muove in un labirinto fedele all'originale per raccogliere i pellet e i **4 prodotti della collezione** collocati agli angoli del labirinto.
- Raccogliendo tutti e 4 gli oggetti, il gioco viene completato e l'utente sblocca uno **sconto del 20%**.
- È presente un pulsante **"Skip the Game"** che permette di bypassare la fase di gioco per andare direttamente allo store standard (senza sconto del 20%).

### Fase 7: Arcade Collection & Carrello
- I prodotti sbloccati vengono visualizzati in una galleria stile arcade con scanlines attive.
- Se sbloccati tramite gioco, i prezzi mostrano lo sconto del 20% applicato (es. da $24.90 a $19.92).
- Selezionando un articolo, si apre il **Product Viewer 3D**:
  - L'utente può visualizzare il capo in 3D, scegliere il colore (Nero, Bianco) e la taglia (S, M, L, XL).
  - Cliccando su "ADD TO BAG", un'animazione curva "fly-to-cart" sposta l'icona del prodotto verso il carrello.
- Il carrello (Shopping Bag Drawer) calcola in tempo reale subtotale, sconto del 20% (se attivo) e totale complessivo, permettendo di completare un checkout simulato con feedback finale.
- È presente un pulsante **`// REPLAY PAC-MAN`** che permette all'utente di rigiocare (visibile solo se il gioco è già stato completato con successo e lo sconto è attivo). Se lo sconto del 20% è già stato sbloccato, esso non viene sovrascritto né cumulato (rimane attivo al 20% fisso).

---

## 4. Principi di UX & Bias Cognitivi Applicati
Il design dell'applicazione sfrutta diversi bias cognitivi teorici indicati nel brief di progetto per incrementare la conversione:
- **Curiosity / Information Gap**: L'Easter Egg nel logo incuriosisce l'utente spingendolo ad interagire per colmare il "vuoto informativo".
- **Von Restorff Effect**: L'icona Pac-Man retro inserita in una landing page minimale e moderna spicca rispetto al contesto, fungendo da signifier visivo di cliccabilità.
- **Goal-Gradient & Endowed Progress**: Il tracciamento dei progressi (es. barra di caricamento, oggetti raccolti visibili in real-time) fa percepire l'utente vicino al premio, stimolando il completamento del gioco.
- **Endowment Effect**: I prodotti collezionati nel labirinto entrano a far parte della galleria e del carrello dell'utente come oggetti "già conquistati", aumentandone il valore percepito prima del pagamento.
- **Flessibilità ed Efficienza di Navigazione**: L'inserimento del tasto "Skip the Game" garantisce che la componente ludica sia un valore aggiunto (layer premium) e non un ostacolo frustrante alla conversione per utenti con poco tempo.
- **Visual Hierarchy & Progressive Disclosure**: Ogni schermata si focalizza su un'unica azione dominante (es. inserire la moneta, scegliere se giocare, giocare, personalizzare il prodotto) per non sovraccaricare cognitivamente l'utente.

---

## 5. Struttura dei File Analizzati
- [index.html](file:///c:/Users/sorre/Desktop/antigravity/public/index.html): Definisce i contenitori markup delle schermate di transizione, del gioco, della galleria prodotti, del viewer 3D dei singoli articoli e del carrello.
- [styles.css](file:///c:/Users/sorre/Desktop/antigravity/public/styles.css): Contiene le regole di visualizzazione per la simulazione CRT dello schermo arcade, il layout a griglia dei prodotti e le animazioni del carrello laterale.
- [script.js](file:///c:/Users/sorre/Desktop/antigravity/public/script.js): Il motore logico dell'app. Gestisce gli event listener di tastiera e rotella del mouse, il loop del gioco Pac-Man, il rendering Three.js (allineamento della camera, particelle ed effetti di luce dinamici) e lo stato del carrello.
- **/assets**: Directory contenente le texture dei prodotti per le varianti colore, il modello tridimensionale del cabinato arcade (`cabinet.glb`), il file del brief originale ed altre immagini di supporto.

---

## 6. Specifiche Tecniche per lo Sviluppo (Developer Handoff Guide)
Per facilitare il proseguimento dello sviluppo da parte di altri agenti/sviluppatori (incluso Claude), di seguito sono elencati i dettagli implementativi interni del codice:

### A. Gestione dello Stato Globale (`script.js`)
Lo stato dell'applicazione è guidato da variabili globali:
- `currentState` (string): Identifica la schermata corrente (`'LANDING'`, `'transition'`, `'pressStart'`, `'arcadeReveal'`, `'gameStart'`, `'gameplay'`, `'arcadeCollection'`).
- `hasDiscount` (boolean): `true` se il giocatore ha raccolto tutti e 4 gli articoli nel minigioco. Attiva lo sconto del 20% visibile sui prezzi dei prodotti e nel carrello.
- `unlockedItems` (array): Memorizza gli ID degli oggetti raccolti (`'tshirt'`, `'sweatshirt'`, `'cap'`, `'tote'`).
- `cartList` (array): Lista degli articoli inseriti nel carrello. Ogni oggetto contiene: `id`, `name`, `price`, `img` (URL variante), `color`, `size`, `quantity`.

### B. Struttura della Mappa e Movimento (`collisionMap`)
Il labirinto di Pac-Man è discretizzato tramite una matrice di stringhe:
```javascript
const collisionMap = [
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "WPPPPPPPPPPPPWWPPPPPPPPPPPPW",
  ...
];
```
*Legenda dei caratteri*:
- `W`: Muro/Ostacolo invalicabile (colore rosso in debug overlay).
- `P`: Sentiero calpestabile su cui spawnare i normali pellet (palline piccole da 10 PTS).
- `C`: Posizione iniziale di spawn dei 4 prodotti della capsule collection (collectible speciali).
- `G`: Casa dei fantasmi / Cancelletto.

*Movimento*:
- Guidato da `pacman.dir` e pre-caricato tramite `pacman.nextDir` per curve fluide a buffer.
- Aggiornato ogni **150ms** tramite `setInterval(gameLoop, 150)`.

### C. Logica delle Scene Three.js
1. **Scene del Cabinato (`initThreeJSCabinet`)**:
   - Modello caricato: `/assets/cabinet.glb` (centrato dinamicamente calcolando il bounding box).
   - Animazione di caduta (`dropping`): Utilizza una funzione di attenuazione personalizzata `bounceOut(t)` per dare impatto fisico al terreno.
   - All'impatto viene attivato `createDustBurst()`, che istanzia 35 particelle sferiche che si allontanano radialmente con decelerazione per attrito e dissolvenza opacità.
   - Fase di scorrimento (`scroll_idle`): Rileva l'evento `wheel` del mouse per spostare la camera lungo un arco cinematico interpolato (lerp su `scrollTarget` e `scrollCurrent`).
2. **Scene del Visualizzatore Prodotto (`initProductViewer`)**:
   - Rendering "a sandwich" (`buildLayers`): Per ricreare un effetto volumetrico 3D da texture 2D, vengono istanziati **24 layer (piani)** sovrapposti ad una distanza millimetrica (`thickness = 0.22`), ciascuno con un'attenuazione del colore (`tint`) calcolata in base alla distanza dal centro per simulare profondità visiva.
   - Regolazione luci (`adjustViewerShading`): Rileva se il prodotto selezionato è bianco o nero per attenuare o amplificare l'intensità delle sorgenti di luce al fine di evitare bruciature grafiche sugli elementi chiari.

---

## 7. Istruzioni per il Test e l'Avvio Locale
Poiché l'applicazione carica risorse esterne (modelli 3D `.glb` e immagini delle varianti dei prodotti) tramite fetch JavaScript, **non è possibile avviarla aprendo direttamente il file `index.html` tramite il protocollo `file://`** a causa delle restrizioni CORS del browser.

È necessario avviare un server HTTP locale all'interno della cartella `public`. Di seguito sono riportati i comandi rapidi consigliati:

- **Node.js (npx)**:
  ```bash
  npx serve public
  ```
- **Python 3**:
  ```bash
  cd public && python -m http.server 8000
  ```
- **VS Code**: Utilizzare l'estensione **Live Server** sul file `public/index.html`.

---

## 8. Sviluppi Futuri ed Estensioni Consigliate
Se si passa il codice a Claude per proseguire lo sviluppo, ecco i moduli prioritari da implementare per completare il prototipo:
1. **Implementazione dei Fantasmi Attivi**: Attualmente la lista dei fantasmi viene mostrata solo nella schermata di presentazione. Manca la logica di intelligenza artificiale per far inseguire Pac-Man dai fantasmi nel labirinto, con relativi stati di "Frightened" (quando Pac-Man mangia un pellet grande) e game over.
2. **Integrazione Effetti Sonori Retro (Web Audio API)**: Aggiungere il classico suono del movimento "waka waka", il jingle di inizio partita e gli effetti acustici di inserimento gettone e sblocco dei prodotti.
3. **Ottimizzazione Mobile / Controlli Touch**: Attualmente il movimento è vincolato alle frecce della tastiera e l'avvicinamento al cabinato richiede la rotella del mouse. Sarebbe opportuno mappare gesture di swipe su schermi touch o mostrare un joystick virtuale a schermo.
4. **Integrazione Carrello Reale**: Mappare il checkout verso un reale gateway di test o integrare le API di una piattaforma e-commerce per simulare un acquisto reale.

---

## 9. Editor Visuale della Mappa di Collisione (Visual Collision Editor)
Per allineare e personalizzare le collisioni sopra l'immagine del labirinto, l'applicazione integra un **Editor Visuale delle Collisioni**:

- **Attivazione**: Impostare `let EDIT_COLLISION_MAP = true;` in cima al file `script.js`.
- **Comportamento Visivo**: Sovrappone una griglia colorata semi-trasparente sul labirinto di gioco:
  - **Rosso (`W`)**: Muro / Bloccato.
  - **Verde (`P`)**: Sentiero calpestabile (dove nascono i pellet).
  - **Giallo (`C`)**: Oggetto speciale sbloccabile (Collectible).
  - **Viola (`G`)**: Casa dei fantasmi / Zona bloccata per Pac-Man.
- **Interattività**:
  - **Coordinate**: Passando il mouse sopra una cella, viene visualizzata la coordinata `R{r}C{c}` (Riga/Colonna).
  - **Ciclo di Modifica**: Cliccando su una cella, la sua tipologia cambia ciclicamente: `W → P → C → G → W`.
- **Fantasmi in Pausa**: Quando l'editor è attivo (`EDIT_COLLISION_MAP = true`), i fantasmi vengono congelati sulle loro posizioni correnti e le collisioni di game over sono temporaneamente disattivate per consentire una modifica agevole del labirinto.
- **Esportazione**: In fondo alla schermata di gioco comparirà il pulsante **"COPY COLLISION MAP"**. Cliccandolo, l'intera matrice aggiornata nel formato stringhe JavaScript viene copiata nella clipboard, pronta per essere incollata nel codice sorgente di `script.js`.
- **Allineamento**: Se la griglia risulta spostata rispetto all'immagine del labirinto, è possibile regolarne la posizione e la scala nel codice modificando le seguenti variabili:
  - `let TILE_SIZE = 24;` (Dimensione cella in pixel)
  - `let MAP_OFFSET_X = 0;` (Offset orizzontale della griglia)
  - `let MAP_OFFSET_Y = 0;` (Offset verticale della griglia)

