# Chi siamo — Design spec dei 3 diorami coach

> Generato dal workflow di design multi-agente (giu 2026). Fonte autorevole per l'implementazione delle scene Three.js della pagina /chi-siamo. Le correzioni della Direzione Artistica (in fondo) PREVALGONO sulle singole spec dove divergono.



---

# SCENA: Exivezzz

… (full self-contained spec below) …

================================================================
DIORAMA 1 — EXIVEZZZ, MAIN COACH
"Il Gigante del Bagnasciuga al tramonto"
Spec definitiva, autosufficiente. Three.js ^0.184, procedurale al 100%.
================================================================

------------------------------------------------------------
0. CONCETT0 IN UNA FRASE
------------------------------------------------------------
Un mini-mondo da spiaggia in una scatola (diorama toy su base ovale di sabbia), colto in golden hour: un gigante allungato salta e schiaccia un pallone da beach volley che — guardandolo bene — e' un pesce paffuto e spaventato. Lettura in mezzo secondo, anche a 360px: "tizio altissimo + capo + schiaccia i fish". Atmosfera CALDA da poster anni '80 ridipinto low-poly, palette propria INDIPENDENTE dal tema della pagina (valori hex fissi nel componente, NON token CSS).

Le tre cose che la scena deve dire a colpo d'occhio:
1. E' ALTO  → silhouette che bucca lo skyline, gambe lunghe esagerate, la rete da volley gli arriva al PETTO (non sopra la testa), ombra blob lunghissima.
2. E' il MAIN → unico personaggio, illuminato come eroe dal rim light, "1" sulla canotta, cartello "MAIN COACH / €200" piantato nella sabbia.
3. EXPLOITA i FISH → il pallone e' un pesce terrorizzato che sta per essere schiacciato (rivelazione progressiva: da lontano = pallone, da vicino = pesce → sorriso).

------------------------------------------------------------
1. PATTERN TECNICO (identico all'hero-3d esistente — copiare lo scheletro)
------------------------------------------------------------
Riferimento: frontend/src/app/features/landing/hero-3d/hero-3d.component.ts.
- Standalone component, ChangeDetectionStrategy.OnPush, template = <div class="dio__fallback" aria-hidden="true"></div> + <canvas #canvas aria-hidden="true">.
- afterNextRender(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches || !hasWebGL()) return; void initScene(); }). Fallback CSS resta visibile sotto il canvas (gradiente golden-hour statico, vedi §11).
- Lazy: const THREE = await import('three'); if (this.disposed) return;
- WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).
- COLOR GRADING (innesto dal regista): renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace. Gli highlight del sole rollano morbidi → resa filmica a costo zero, niente post-processing.
- Timing: const start = performance.now(); const t = (performance.now() - start) / 1000. NIENTE THREE.Clock.
- Arrays cleanup: geometries[], materials[], textures[]; tutte le CanvasTexture generate UNA volta in init; tex.colorSpace = THREE.SRGBColorSpace.
- ResizeObserver sull'host (resize → setSize(clientW, clientH, false) + camera.aspect + updateProjectionMatrix; gestione mobile in §2).
- IntersectionObserver → visible; document 'visibilitychange' → running. Loop: this.rafId = requestAnimationFrame(loop); if (!running || !visible) return;.
- pointermove → parallasse (lerp 0.04), DISATTIVATA su touch: if (!matchMedia('(pointer: coarse)').matches) { addEventListener('pointermove', ...) }.
- ngOnDestroy / dispose: cancelAnimationFrame; geometries/materials/textures .dispose(); renderer.dispose(); renderer.forceContextLoss(); rimuovere tutti i listener via cleanupFns[].
- Tutto il diorama in UN solo THREE.Group "root" (parallasse, idle globale e dispose centralizzati). Il personaggio in un sub-group "exivezzz" (idle muove tutto insieme).
- Materiali condivisi (una sola istanza riusata su piu mesh per ridurre draw calls/GC): skinMat, sandMat, brandOrangeMat, netLineTex, ecc.

------------------------------------------------------------
2. CAMERA E INQUADRATURA
------------------------------------------------------------
- PerspectiveCamera(fov 34, aspect, near 0.1, far 100). FOV stretto = look tilt-shift/diorama in miniatura + comprime lo sfondo e slancia la verticalita.
- Desktop: position (0.6, 2.6, 11.5), lookAt (0.4, 2.4, 0). Camera leggermente SOTTO la testa del coach e angolata un filo verso l'alto (low-angle eroico → rende il personaggio gigante) MA abbastanza alta da mostrare un po' la "pianta" della base sabbia (sapore Monument Valley / mondo-in-scatola). Compromesso fra hero-shot dal basso e diorama dall'alto.
- Coach posizionato leggermente a DESTRA del centro della base (x ~ +0.6) cosi la sua altezza "punta" verso la colonna di testo del pannello. NOTA: il lato (scena sinistra/testo destra) e' deciso dal layout del pannello — il diorama e' simmetricamente robusto, ma di default il soggetto sta su un terzo della scena (regola dei terzi), sole sull'altro terzo.
- Aspect handling responsive (mobile ~360px, ratio piu quadrato): interpolare su camera.aspect. Quando aspect < 0.9 (ritratto), stringere a position (0.3, 2.8, 13) e alzare lookAt.y a 2.8 cosi coach + pallone-pesce + sole restano nel frame senza tagli. Implementare nella funzione resize().
- Fog: scene.fog = new THREE.FogExp2(0xffb37a, 0.018) — foschia calda costiera che desatura/sbiadisce il fondo e satura il primo piano → profondita atmosferica da diorama. Tiene basso anche l'overdraw lontano.

------------------------------------------------------------
3. LUCE E ATMOSFERA (golden hour, schema a 3 luci, no shadow map)
------------------------------------------------------------
Tutti MeshStandardMaterial. NIENTE ombre reali (castShadow = false ovunque) → si usano blob shadow finte (§7).
- KEY = sole controluce: DirectionalLight(0xff8a3d, 2.1), position (6, 5, -3) — DIETRO-destra del coach. Crea il RIM LIGHT infuocato sui contorni (spalle, braccio teso, cresta testa, bordo del pesce-pallone) = firma del fotogramma e focal point.
- FILL = cielo/sabbia: HemisphereLight(skyColor 0xffd9a0, groundColor 0xe9a36b, 0.95) — ammorbidisce le ombre con il bounce caldo della sabbia, gratis e bellissimo sul flat-shading.
- ACCENT freddo = mare: PointLight(0x26c6c6, 12, 22), position (-5, 1.5, 4) a sinistra — complementare turchese che stacca il lato in ombra del coach dallo sfondo caldo (contrasto caldo/freddo = leggibilita + look da poster).
- AmbientLight(0x704030, 0.35) bassissima → le ombre restano CALDE, mai nere/grigie.
- (Niente luci aggiuntive: il color grading ACES + fog + gradiente del cielo fanno il resto.)

------------------------------------------------------------
4. BASE DIORAMA — il "mondo in scatola" (cio che lo rende un GIOCATTOLO)
------------------------------------------------------------
- Disco sabbia: CylinderGeometry(3.1, 3.35, 0.5, 48, 1), scala (1, 1, 0.78) → ovale. MeshStandardMaterial flatShading:true, color 0xf2d6a8 (sabbia calda), roughness 0.95. Bordo netto: oltre la sabbia c'e' solo cielo/mare → e' una FETTA di mondo, non un livello infinito.
- Cap superiore separata per il dettaglio: CircleGeometry(3.1, 48) a y=0.251 scalata Z×0.78, con vertici spostati su Y di ±0.04 via rumore pseudo-casuale nel loop sull'attributo position: position.y += Math.sin(x*3)*Math.cos(z*4)*0.04 → micro-dune flat-shaded. Color 0xf7e2b6.
- CanvasTexture sulla cap (512×512, generata una volta): base sabbia + ~400 granelli puntinati (0xe8c48f / 0xfbe6bd) + qualche conchiglia bianca ovale (0xfff8ee) + DUE solchi a "C" che ricordano impronte di piedoni (micro-storia: il gigante ha camminato qui) + leggera vignettatura radiale scura ai bordi (gradiente nella texture) per concentrare lo sguardo al centro. map su MeshStandardMaterial.
- Riser/spessore: anello scuro 0xc9a86e sotto la cap (fa "spessore della scatola" → effetto isola galleggiante toy).

------------------------------------------------------------
5. SFONDO — cielo / mare / sole (3 piani per profondita)
------------------------------------------------------------
- CIELO (background, NON skybox): scene.background = CanvasTexture verticale 4×512. Gradiente: alto 0x5a86c4 (azzurro polvere) → orizzonte 0xff9e5e (corallo) → basso 0xffd27a (oro). Statico, costo ~0.
- SOLE: CircleGeometry(0.9, 32), MeshBasicMaterial(0xfff2cc), in alto a DESTRA (x +3.2, y +4.4, z -8), additive blending. Attorno un alone: secondo cerchio raggio 2.0 con CanvasTexture radiale (alpha falloff da 0xffb060), additive, opacita 0.25. Idle: alone pulse scala ±4% periodo ~8s (calore che vibra).
- MARE: PlaneGeometry(14, 5, 24, 6) orizzontale a y=0.1, z=-3.4, ruotato -PI/2 su X. MeshStandardMaterial flatShading:true, color 0x1fa3a3. Onde vertex: nel loop position.y += sin(x*0.6 + t*1.1)*0.06; computeVertexNormals SOLO ogni 2 frame (costo). Una seconda striscia di battigia piu chiara 0x7fd9c9 davanti.
- SCHIUMA battigia (innesto dal regista + P3): striscia PlaneGeometry(7, 0.5) bianca opacita 0.7 sul bagnasciuga, scale.x = 1 + sin(t*0.8)*0.06 e opacita 0.5 + sin(t*0.8)*0.2 (la risacca avanza/arretra).
- SCINTILLE MARE (innesto da P3): InstancedMesh di ~80 micro-quad PlaneGeometry(0.1, 0.1) sparsi sulla superficie del mare, MeshBasicMaterial bianco additive, ognuno con fase random; twinkle a LAMPI netti (non sinusoide): opacita = 0.2 + 0.8 * pow(sin(t*speed + phase), 8). 1 draw call.

------------------------------------------------------------
6. PERSONAGGIO — EXIVEZZZ (il gigante; sub-group "exivezzz", centrato x~+0.6)
------------------------------------------------------------
Linguaggio comune del cast: low-poly toy, flat-ish, faccia MINIMALE (occhi nascosti dagli occhiali → zero uncanny valley, niente bocca articolata), arti a capsule/box smussati. MA proporzionato ALTO: ~5 teste, gambe lunghe ESAGERATE (e' il tratto distintivo della statura). Altezza totale ~5.5 unita scena. Pelle abbronzata (vive in spiaggia).
Materiali: MeshStandardMaterial flatShading:true su torso/gambe/teste (look a faccette), roughness 0.7.

- TESTA: SphereGeometry(0.42, 20, 16) scalata Y×1.12, color pelle 0xc98a5b. (In alternativa IcosahedronGeometry(0.42, 1) per piu faccette — scelta libera, entrambe valide.)
- CAPELLI: calotta SphereGeometry(0.44, 16, 12, 0, 2PI, 0, PI*0.55), color 0x3a2c22 (castano), taglio corto sportivo, appoggiata sopra.
- OCCHIALI DA SOLE (firma del beach-pro, nascondono gli occhi): due BoxGeometry sottili smussati telaio 0x16223f + lenti specchiate 0x26c6c6 (riprende l'accent turchese; roughness 0.15, metalness 0.4) + pontino BoxGeometry(0.06,0.03,0.03). Le lenti riflettono il sole = highlight speculare voluto, "regista cool".
- FACCIA: nient'altro che gli occhiali. Eventualmente un mini sorriso come sottilissima riga su texture canvas o un piccolo arco. Niente occhi/bocca articolati.
- COLLO: CylinderGeometry(0.16, 0.18, 0.2, 8) pelle.
- TORSO/CANOTTA: CapsuleGeometry(0.45, 0.7, 4, 12), canotta sportiva color CORALLO BRAND 0xff6a1f, scala X×1.15 per spalle larghe (slancio atletico). CanvasTexture sul petto: numero "1" bianco grande + sotto piccola scritta "200" (ribadisce MAIN/n°1 e i Twister da 200€). Spallacci accennati: due TorusGeometry sottili arancio. Due piccole sfere ai giunti spalla.
- BRACCIA (sub-group articolato per la schiacciata): spalla SphereGeometry(0.16) + braccio CapsuleGeometry(0.13, 0.5) + avambraccio CapsuleGeometry(0.11, 0.45) + mano SphereGeometry(0.15) schiacciata, tutto pelle. BRACCIO DESTRO ALZATO sopra la testa (posa di schiacciata congelata, mano aperta sopra il pallone-pesce) → dinamismo + altezza. Braccio sinistro lungo il fianco con leggero swing idle.
- GAMBE LUNGHE (qui si "spende" l'altezza): bacino BoxGeometry(0.6, 0.35, 0.4) color pantaloncini 0x16223f. Coscia CapsuleGeometry(0.17, 0.9) + stinco CapsuleGeometry(0.14, 0.9), pelle → gambe SOVRADIMENSIONATE rispetto al torso (vende "tizio altissimo"). Posa: una gamba leggermente avanti/divaricata (atterraggio dinamico).
- PIEDI SCALZI (beach): BoxGeometry(0.28, 0.12, 0.5) smussati color pelle, leggermente affondati nella sabbia con piccolo "alone" di sabbia smossa (decal canvas opzionale).
- ALTEZZA PERCEPITA (vincolo chiave, triplo rinforzo ridondante):
  1. ~5 teste, gambe lunghe esagerate; gli altri elementi volutamente tozzi/piccoli.
  2. La banda alta della RETE da volley arriva al PETTO/spalla bassa del coach (non sopra la testa) → il cervello legge "uomo enorme" (la rete e' il metro di paragone).
  3. La sua OMBRA BLOB e' la piu lunga della scena, allungata e obliqua (sole basso), e si allunga ancora di piu nel momento wow.

------------------------------------------------------------
7. PROPS DI SCENA
------------------------------------------------------------
- RETE DA BEACH VOLLEY (metro di scala + linea-guida diagonale): due pali CylinderGeometry(0.05, 0.06, 2.4, 8) color 0xd8d2c4 (alluminio sabbioso) a x~-2.4 (z -0.6) e x~+2.0 (z -1.8) → la rete attraversa in DIAGONALE (profondita + dinamismo). Rete = PlaneGeometry(4.4, 0.9, 22, 5), CanvasTexture trasparente con maglie quadrate (linee bianche su alpha 0) + banda superiore bianca piena; transparent:true, side:DoubleSide, alphaTest 0.5, depthWrite:false. Ondeggia al vento (idle §8). Micro-storia: una mini ammaccatura dove il pallone l'ha colpita (un vertice spinto in avanti).
- PALLONE = PESCE (IL MOMENTO WOW, §9): sospeso sopra la mano destra del gigante.
- CARTELLO "MAIN COACH" (innesto da P3, esplicita il ruolo senza UI HTML): mini targhetta BoxGeometry(0.7, 0.3, 0.04) su un paletto, piantata nella sabbia in primo piano, leggero tilt. CanvasTexture in font mono "Spline Sans Mono" (--font-mono del sito): "MAIN COACH" bianco su pill corallo 0xff6a1f, sotto "€200" su fascia turchese 0x26c6c6. Oscilla pianissimo (rotation.z = sin(t*0.9)*0.05, piantato male nella sabbia).
- ASCIUGAMANO: PlaneGeometry(1.4, 0.9) appoggiato sulla sabbia, CanvasTexture a righe corallo 0xff6a1f / crema 0xf4f1e9 (o turchese per contrappunto freddo). Riempie il primo piano, da scala.
- BORRACCIA: piccola CylinderGeometry(0.08, 0.08, 0.22) trasparente azzurrina rovesciata vicino ai piedi.
- GRANCHIETTO (tocco adorabile, micro-storia): corpo SphereGeometry(0.1) scalato piatto color 0xff6a4d, due chele BoxGeometry, due occhietti su steli (cilindri sottili + sferette nere). Trotterella avanti-indietro lungo il bordo della base; chele aprono/chiudono frenetiche (idle §8) = buffo.
- PALME (silhouette di profondita, opzionali, ai bordi): tronco CylinderGeometry leggermente inclinato + 5-6 ConeGeometry appiattiti a ventaglio, in semi-controluce scure quasi silhouette (fog le sbiadisce). Incorniciano il "set". Tronco 0x5a3a2a, foglie 0x2f6b4a. Se il budget di draw call stringe, ometterle.
- BLOB SHADOW (no shadow map): sotto coach, pali, pallone-pesce, props. CircleGeometry/PlaneGeometry con CanvasTexture radiale alpha (nera sfumata), MeshBasicMaterial transparent, depthWrite:false, su y=0.255 (appena sopra la cap sabbia). L'ombra del COACH e' ALLUNGATA e OBLIQUA verso sinistra (sole basso) → vende l'ora del giorno e l'altezza; quella del pallone-pesce si scala col galleggiamento.

------------------------------------------------------------
8. ANIMAZIONI IDLE (continue, pausate fuori viewport/tab nascosta)
------------------------------------------------------------
Tutto su t = (performance.now()-start)/1000.
- Coach respiro: il group "exivezzz" scala Y di 1 + sin(t*1.6)*0.012 e trasla y di sin(t*1.6)*0.02. Testa micro-rotazione rotation.z = sin(t*0.8)*0.04, rotation.y = sin(t*0.5)*0.06 (guarda intorno).
- Braccio destro (carica della schiacciata, in attesa): avambraccio oscilla rotation.x ±0.2 periodo ~2.8s (ricarica energia senza colpire). La mano segue il pallone-pesce.
- Braccio sinistro: swing pendolo ±0.12 rad periodo ~3.5s.
- Pallone-pesce: orbita lenta sopra la mano, ellisse ampiezza (0.25, 0.18) periodo ~2.8s sincronizzata col braccio + spin lento rotation.y costante (~0.5 rad/s) + wobble coda (§9). Sembra appeso alla minaccia della mano.
- Mare onde: vertex sin (§5), periodo ~5s, ampiezza 0.06.
- Schiuma battigia: scale/opacita risacca (§5).
- Scintille mare: twinkle pow(sin,8) (§5).
- Rete al vento: vertici z += sin(t*2 + x*3)*0.03 (ondina morbida).
- Sole/alone: pulse scala ±4% periodo ~8s.
- Granchietto: trotterella lungo il bordo (lerp fra due punti con sin(t*0.4), rotation.y flippa a fine corsa), chele rotation.z = sin(t*6)*0.3.
- Cartello: rotation.z = sin(t*0.9)*0.05.
- Palme (se presenti): foglie ±0.05 rad periodo ~4.5s, sfasate.
- PARALLASSE MOUSE (DISATTIVATA su touch via matchMedia('(pointer: coarse)')): camera.position.x += (pointer.x*0.6 + baseX - camera.position.x)*0.04, idem Y con peso minore (0.35), range ±0.6/±0.35; camera.lookAt FISSO sul coach. Effetto "guardo dentro la scatola del giocattolo da angolazioni diverse": lo sfondo (sole, mare) scivola dietro il personaggio = profondita da diorama. Su touch: solo idle.

------------------------------------------------------------
9. IL MOMENTO WOW — "LA SCHIACCIATA DEL FISH" (fusione P1 pesce + P2 schiacciata)
------------------------------------------------------------
IL PALLONE E' UN PESCE, E STA PER ESSERE SCHIACCIATO. Brand tie-in puro: Exivezzz "exploita i fish", letteralmente e in movimento.

Geometria pesce-pallone: una SphereGeometry/IcosahedronGeometry a spicchi alternati color 0xff6a1f / crema 0xf4f1e9 / 0x26c6c6 (da lontano = pallone da beach volley; da vicino = pesce). Dettagli pesce: occhietto tondo sorpreso (sferetta bianca + pupilla nera), bocca a "O" preoccupata (TorusGeometry scuro), pinne laterali (2 ConeGeometry appiattiti), coda (ConeGeometry appiattito) che SBATTE nervosa (wobble ±0.4 rad periodo ~0.5s — e' terrorizzato). Raggio ~0.32, volutamente PICCOLO (contrasto col gigante). Rivelazione progressiva: colpo d'occhio = "tipo alto che schiaccia, bello" → sguardo ravvicinato = "...aspetta, il pallone e' un PESCE spaventato" → sorriso. Esattamente il tono BFF: ironico ma competente. Il rim light del sole accende il bordo del pesce sospeso = vero punto focale.

SEQUENZA SCRIPTATA ogni ~7s (timer a fasi phase = t % 7, NON random → soddisfazione prevedibile; funziona anche su mobile perche' non dipende dal mouse). Mini-sequenza ~1.4s con easing easeOutCubic, poi ritorno a idle:
1. CARICA (0→0.25s): il group si piega un filo sulle ginocchia (y scende ~0.15), braccio si arretra.
2. STACCO + ASCESA (0.25→0.6s): tutto il group sale di +0.9 in y ease-out (il gigante si alza ANCORA di piu → rinforza la statura nel momento clou); il pesce viene "lanciato" piu in alto.
3. SCHIACCIATA (0.6→0.8s): l'avambraccio destro scatta giu' (rotation.x da -1.4 a +0.6 in 0.2s); AL FRAME DEL CONTATTO il pesce parte in archetto parabolico verso il fondo-destra oltre la rete (lerp + arco su ~0.7s), scale pulse a 1.25 e ritorno (squash & stretch = DNA del giocattolo), spin accelera, la coda sbatte furiosa.
4. IMPATTO (0.85s): nel punto di atterraggio del pesce (dall'altra parte della rete, sulla sabbia/mare): SPRUZZO DI SABBIA = InstancedMesh di ~14 TetrahedronGeometry(0.05) color sabbia, sparati a ventaglio con gravita (-9) su vita 0.5s, poi nascosti, RIUSATI ad ogni schiacciata (1 draw call). + un anellino di polvere RingGeometry che si espande e svanisce + un FLASH additive (1 quad bianco-giallo, scala 0→1.6→0 in 0.25s).
5. RITORNO (0.8→1.4s): il group ridiscende con piccolo overshoot (atterraggio toy), l'ombra blob si allunga e poi si raccoglie, e si torna all'idle. Micro-gag opzionale: il granchietto sussulta allo schianto.

Lettura emotiva: "questo non sta giocando, sta EXPLOITANDO — schiaccia e i fish saltano". Main Coach in azione, ed e' adorabile.
Bonus regia: l'ombra allungata del coach include la sagoma del braccio teso → racconta la storia anche solo guardando il pavimento.

------------------------------------------------------------
10. PARTICELLE & EFFETTI (tutti instanced/riusati, costo trascurabile)
------------------------------------------------------------
- PULVISCOLO controluce (firma golden hour): InstancedMesh di ~100 micro-quad PlaneGeometry(0.03) (o THREE.Points) con texture canvas radiale dorata 0xffd9a0, additive, opacita 0.4. Fluttuano lenti verso l'alto-destra (drift + sin laterale), riciclati in basso. Catturano la luce del sole → "aria che brilla". 1 draw call.
- SPRUZZO SABBIA della schiacciata (§9): 14 tetraedri instanced, 1 draw call.
- SCINTILLE MARE (§5): ~80 quad instanced, 1 draw call.
- FLASH + anello impatto (§9): 1 quad additive + 1 RingGeometry riusati.
- (Niente lens flare/godrays: scartati per non sovraccaricare; il sole+alone+rim light bastano.)

------------------------------------------------------------
11. FALLBACK / ACCESSIBILITA
------------------------------------------------------------
- prefers-reduced-motion OR no-WebGL → si esce prima di initScene; resta il fallback CSS: un .dio__fallback con gradiente golden-hour statico (linear-gradient verticale 0x5a86c4 → 0xff9e5e → 0xffd27a + un radial caldo in alto-destra per il sole). Opzionalmente uno still PNG del fotogramma. aria-hidden="true" sul canvas e sul fallback (la scena e' decorativa; il contenuto informativo sta nel testo del pannello).
- Touch: parallasse OFF (solo idle + schiacciata scriptata, che non dipendono dal mouse).

------------------------------------------------------------
12. PALETTE ESADECIMALE (propria del diorama, hex FISSI nel componente — NON token CSS)
------------------------------------------------------------
- Cielo: 0x5a86c4 (alto) → 0xff9e5e (orizzonte) → 0xffd27a (basso). Sole 0xfff2cc / alone 0xffb060.
- Mare: 0x1fa3a3 (profondo) / 0x7fd9c9 (battigia) / schiuma 0xffffff / scintille 0xffffff.
- Sabbia: 0xf2d6a8 (base) / 0xf7e2b6 (dune) / granelli 0xe8c48f + 0xfbe6bd / riser 0xc9a86e / conchiglie 0xfff8ee.
- Pelle: 0xc98a5b. Capelli: 0x3a2c22. Occhiali: telaio 0x16223f, lenti 0x26c6c6.
- Canotta: 0xff6a1f (CORALLO BRAND = --copper-500 del sito, unico ponte cromatico) con "1"/"200" bianco. Pantaloncini: 0x16223f.
- Pesce-pallone: spicchi 0xff6a1f / 0xf4f1e9 / 0x26c6c6, occhio bianco+nero.
- Rete pali: 0xd8d2c4. Asciugamano: righe 0xff6a1f / 0xf4f1e9. Granchietto: 0xff6a4d. Palme: tronco 0x5a3a2a, foglie 0x2f6b4a.
- Cartello: pill 0xff6a1f, fascia 0x26c6c6. Fog: 0xffb37a. AmbientLight: 0x704030. PointLight mare: 0x26c6c6. DirLight sole: 0xff8a3d. Hemisphere: 0xffd9a0 / 0xe9a36b.
Nota: palette golden-hour INDIPENDENTE dal tema pagina (decisione utente), ma riecheggia il corallo/turchese del brand per familiarita.

------------------------------------------------------------
13. STIMA COSTO (budget 30-60k tris rispettato con ampio margine)
------------------------------------------------------------
- Coach (testa/capelli/occhiali + ~14 capsule/box arti+torso+gambe): ~8-10k tris.
- Pesce-pallone (sphere a spicchi + pinne/coda/occhi/bocca): ~1k.
- Base sabbia (disco + cap displaced + riser): ~3k. Mare (24×6 grid) + schiuma: ~2k. Cielo (background texture): ~0. Sole+alone: ~0.1k.
- Rete (plane segmentato + 2 pali): ~1.5k. Props (cartello, asciugamano, borraccia, granchietto, [palme]): ~2-3k. Blob shadows: ~0.1k.
- Particelle: pulviscolo ~100 instanced + scintille ~80 instanced + spruzzo 14 instanced + flash/ring: ~1.5k, ~4 draw call totali.
- TOTALE ≈ 18-22k triangoli. DRAW CALLS ≈ 22-28 (riducibili con BufferGeometryUtils.mergeGeometries sui sotto-gruppi statici: base+riser+ombre statiche in 1, pali rete in 1). Instancing obbligatorio su pulviscolo, scintille, spruzzo.
- 60fps su HW medio: setPixelRatio(min(dpr,2)), powerPreference 'low-power', ACES gratis, niente shadow map, niente post-processing, fog riduce overdraw, computeVertexNormals del mare solo a frame alterni. Disciplina lifecycle identica all'hero (lazy import, guard reduced-motion/WebGL, ResizeObserver/IntersectionObserver/visibilitychange, dispose completo + forceContextLoss).

------------------------------------------------------------
14. PERCHE' FUNZIONA (sintesi)
------------------------------------------------------------
Base ovale + bordo netto + camera tilt-shift = e' un GIOCATTOLO in scatola (la lettura "diorama" voluta dall'utente). Low-angle + gambe lunghe + testa che bucca lo skyline + rete al petto + ombra lunga = ALTO percepito in mezzo secondo, ridondante e robusto a 360px. Rim light golden-hour + canotta n°1 + cartello "MAIN COACH €200" + unico eroe illuminato = MAIN. Pesce-pallone terrorizzato sotto lo schiaccione, animato ogni 7s = EXPLOITER DI FISH, col sorriso. Color grading ACES + fog calda + pulviscolo controluce + scintille mare = fotogramma da poster che emoziona prima ancora che qualcosa si muova.

## Rationale della sintesi

Base = Proposta 2 (il giocattolaio): la base ovale di sabbia con bordo netto e il "mondo in scatola" sono la lettura piu fedele alla decisione utente "DIORAMI", e il triplo rinforzo della statura (5 teste + rete al petto + ombra lunga) e' il piu robusto a 360px. Da Proposta 1 ho preso il color grading filmico (ACES tone mapping + fog calda + rim light golden-hour) e la palette ambra/corallo/turchese — piu emozionante del mezzogiorno piatto e piu legata al brand (esiste un tema "tramonto") — e soprattutto IL PESCE-PALLONE (il pallone E' un pesce spaventato), miglior brand tie-in "exploita i fish". Da Proposta 3 ho preso le scintille mare instanced (twinkle pow(sin,8)), il cartello "MAIN COACH / €200" in font mono e il "200" sulla canotta. Conflitti risolti: golden hour invece di mezzogiorno; camera low-angle eroica ma FOV stretto con leggero sguardo dall'alto per tenere visibile la base-diorama; il wow "schiacciata" scriptata della P2 bersaglia il pesce della P1; occhiali a specchio per facce minimali (no uncanny valley). Scartati i godrays e la scala-mondo-grande della P3 (rompevano il mondo-in-scatola).


---

# SCENA: NagatoUzumaki

# Diorama 2 — NagatoUzumaki, Founder & Coach — "L'Abisso del Cacciatore"

Mini-mondo subacqueo low-poly "in scatola": un sub in apnea plana orizzontale nell'abisso blu, arbalete carico in pugno, mentre un banco di "fish" gli sfila davanti tagliato dai raggi di luce che scendono dalla superficie. Tono: il PREDATORE CALMO che sceglie il momento e i fish che scappano sempre — coerente col manifesto "Best Fish Forever". Nessuna gag pacchiana, nessuna violenza esplicita. Easter egg developer doppio e discreto. Atmosfera e palette completamente proprie (abisso blu), indipendenti dal tema della pagina.

---

## 0. Vincoli di integrazione (NON negoziabili — clonati 1:1 dal pattern esistente)

Replicare ESATTAMENTE l'architettura di `frontend/src/app/features/landing/hero-3d/hero-3d.component.ts`:

- Componente standalone Angular 22, `ChangeDetectionStrategy.OnPush`, zoneless (niente Zone.js, niente `THREE.Clock`).
- Template: un `<div class="diorama__fallback" aria-hidden="true">` (poster CSS statico) PIU un `<canvas #canvas aria-hidden="true">`. Il fallback è SEMPRE nel DOM e visibile finché il canvas non riceve la classe `is-on`.
- Tutta l'inizializzazione three dentro `afterNextRender(() => { ... })`.
- Guard d'ingresso PRIMA di caricare three: `if (matchMedia('(prefers-reduced-motion: reduce)').matches || !hasWebGL()) return;` → resta il fallback CSS. `hasWebGL()` identico all'esistente (prova `webgl2` poi `webgl` in try/catch).
- Lazy: `const THREE = await import('three');` dopo il guard. Subito dopo l'await: `if (this.disposed) return;`.
- `renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power', alpha: false })`. ATTENZIONE: qui `alpha: false` (diversamente dall'hero) perché il background è un fondale a gradiente opaco → meno blending, render più economico. `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- `resize()` legge `hostEl.clientWidth/clientHeight`, esce se 0, chiama `renderer.setSize(w, h, false)` + aggiorna `camera.aspect` + `updateProjectionMatrix()`. Osservato da `ResizeObserver` sull'host.
- `IntersectionObserver` sull'host → flag `visible`; `visibilitychange` → flag `running`. Nel loop: `if (!running || !visible) return;` (dopo aver già richiesto il prossimo `requestAnimationFrame`).
- Timing: `const start = performance.now()`; nel loop `const t = (performance.now() - start) / 1000;`.
- `cleanupFns: (() => void)[]` + `rafId` + `disposed`. In `ngOnDestroy`: `disposed = true`, `cancelAnimationFrame`, esegui tutte le cleanupFns. Registrare in cleanup: dispose di OGNI geometry, material, texture (canvas texture incluse), `InstancedMesh`, `Points`; `renderer.dispose()`; `renderer.forceContextLoss()`; rimozione listener `pointermove`, disconnect dei due observer, rimozione `visibilitychange`.
- Pointer/parallasse: listener globale `pointermove` passivo, `pointer.x/y` normalizzati in [-1,1]. DISATTIVARE su touch: aggiungere il listener solo se `!matchMedia('(pointer: coarse)').matches` (su touch resta la sola animazione idle).
- Texture canvas: ogni `CanvasTexture` deve avere `colorSpace = THREE.SRGBColorSpace`; generate UNA volta in init, mai a runtime.
- Alla fine dell'init: `canvas.classList.add('is-on'); loop();`.
- File suggerito (l'area `features/about/` è in lavorazione in sessione dedicata — questa spec è SOLO design, NON scrivere file qui): `frontend/src/app/features/about/diorami/diorama-nagato/diorama-nagato.component.ts` + `.scss`. Selettore `app-diorama-nagato`.

### Fallback CSS (`.diorama__fallback`)
Poster statico "abisso" sempre pronto sotto il canvas: `background: radial-gradient(ellipse at 50% 8%, #2a7fb8 0%, transparent 45%), linear-gradient(180deg, #1d6fa6 0%, #0c3a72 40%, #06304f 70%, #04122e 100%);`. Sopra, una silhouette sub stilizzata navy (`::before`, opacità ~0.5, una capsule SVG inline o un semplice blob con maschera) e 3-4 strisce verticali chiare additive (`::after`, opacità ~0.08) come god-rays statici. Il canvas, una volta `is-on`, copre il fallback (stesso box, `position: absolute; inset: 0`). Coerente con la struttura `hero3d__fallback` esistente.

---

## 1. Composizione e camera — IL FOTOGRAMMA

- **Canvas**: ~600×520 px desktop (metà pannello), full-width ~360px su mobile. Layout pannello: **scena a SINISTRA, testo a destra** (alterna rispetto al diorama precedente di Exivezzz; i pannelli full-width sono a lati alternati come da decisione utente).
- **Camera**: `PerspectiveCamera(42, aspect, 0.1, 120)`. Posizione base `(0, -0.6, 13)`, target `lookAt(0.5, 0.3, 0)`. Inquadratura cinematografica orizzontale, **camera leggermente sotto il sub e inclinata verso l'alto (low-angle eroico)**: la silhouette del sub si staglia contro i god-rays che piovono dall'alto. Su mobile: `fov 47`, `z 14.5` per far rientrare tutto.
- **Regola dei terzi (tensione narrativa cacciatore↔preda)**: sub sul terzo SINISTRO in assetto orizzontale rivolto a DESTRA; banco di pesci che entra dal terzo DESTRO e converge verso il centro. La tensione vive nello spazio negativo centrale (tra punta arbalete e banco).
- **Profondità per 3 piani** (chiave del colpo d'occhio, il fog fa il lavoro pesante a costo ~zero): foreground = sub + 1 roccia bassa vicina sfocata dal fog; midground = banco di pesci; background = colonne di god-rays + fondale roccioso che sfuma nel fog.
- **Fog**: `scene.fog = new THREE.FogExp2(0x0a2f5e, 0.05)`. Esponenziale (non lineare) per la dissolvenza morbida subacquea. Colore fog = blu medio del gradiente di background → il fondale si fonde col fondo, nasconde i bordi della scena, separa i piani. Il background plane (vedi §2) NON deve risentire del fog (è già "l'infinito").
- **Niente shadow map** (`renderer.shadowMap` OFF). Profondità data da fog + scala + opacità decrescente + blob-shadow finto.

### Camera idle + parallasse
- **Respiro d'onda costante** (anche a mouse fermo): roll `camera.rotation.z = Math.sin(t*0.12)*0.012` + leggerissimo dolly `camera.position.z = 13 + Math.sin(t*0.2)*0.25`. Sensazione di galleggiamento pesante, subacqueo.
- **Parallasse mouse** (desktop, smorzata, lerp 0.04, sommata come offset al respiro idle): `camera.position.x += (pointer.x*0.8 - camera.position.x)*0.04`; `camera.position.y += ((-0.6 - pointer.y*0.5) - camera.position.y)*0.04`. Max traslazione ±0.8x / ±0.5y. Il `lookAt` resta sostanzialmente fisso sul sub → profondità reale stratificata (god-rays in background si muovono meno dei pesci in midground per parallasse geometrica naturale; non serve codice extra, è automatico). Mai scattante. Disattivata su touch.

---

## 2. Background gradient + atmosfera

- **Mesh sfondo** (NON `scene.background` piatto, così resta fuori dal fog e regge meglio l'alone luce): `PlaneGeometry(90, 70)` a `z = -40`, `MeshBasicMaterial` con `CanvasTexture` 256×512 verticale, `fog: false`.
- Gradiente verticale (`createLinearGradient` top→bottom): top `#1d6fa6` (superficie illuminata) → `#0c3a72` (medio) → `#06304f` → bottom `#04122e` (abisso).
- Su quello stesso canvas: **alone radiale chiaro in alto-centro** (`createRadialGradient`, `#aee8ff` al ~22% alpha) = la "finestra" della superficie da cui scendono i raggi; **vignettatura radiale scura** agli angoli (`rgba(0,10,20,0.35)`) per concentrare lo sguardo al centro.
- Tutti i `MeshStandardMaterial` della scena: `roughness` alto (0.8–1.0), `metalness: 0` (eccetto l'arbalete, vedi §3). Look flat-shaded low-poly: `flatShading: true` su pesci/rocce/alghe (e in generale dove la sfaccettatura aiuta la leggibilità "poly").

---

## 3. Palette (esadecimale, propria del diorama — sempre abisso, anche su tema light)

Strategia cromatica: **freddo saturo con accenti caldi brand**. Il copper/ember arancio (token reali del sito `--copper-500 #ff6a1f`, `--copper-400 #ff7d36`, `--copper-600 #e25510`) su pinne, bordo maschera ed elastici dell'arbalete = coesione brand senza tradire l'abisso. Il navy della muta ammicca al `--navy-700 #1b2a4a`. UN accento ciano caldo-freddo sulla maschera/punta arma per guidare l'occhio sul volto e sulla mira.

| Ruolo | Hex |
|---|---|
| BG superficie (alto) | `#1d6fa6` |
| BG medio | `#0c3a72` |
| BG profondo / fog | `#06304f` / `#0a2f5e` |
| BG abisso (basso) | `#04122e` |
| God-rays (additive) | `#aee8ff` |
| Muta sub (corpo, neoprene) | `#16243c` (navy quasi nero, brand-leaning) |
| Muta — dettagli/zip | `#1b3a63` |
| Muta — pannelli hi-vis (fianchi/maniche) | `#ff6a1f` (copper) |
| Pelle viso/mani | `#e8b48f` |
| Maschera — telaio | `#ff7d36` (copper, bordo) |
| Maschera — vetro | `#bfeefe` (emissive ciano soft, semi-trasp) |
| Occhi (dietro vetro) | `#0a0e16` |
| Cappuccio/erogatore | `#10202f` |
| Bombola | `#1f8f6a` (verde-acqua) + valvola `#d8dde4` |
| Pinne | `#ff7d36` (copper) |
| Arbalete — corpo metallo | `#33404f` (roughness 0.3, metalness 0.6) |
| Arbalete — elastici (tesi = "carico") | `#ff6a1f` |
| Arbalete — freccia / punta | `#9aa6b4` / `#e6ebf2` |
| Pesci "fish" — corpo banco | `#ffc24a` (giallo-oro) |
| Pesci — pinne/coda (guizzo) | `#ff7d36` |
| Pesci — pancia/riga | `#eaf7ff` |
| Pesce "dev" (easter egg) | `#00d4d4` (neon-cyan brand, `--neon-cyan`) |
| Rocce fondale | `#0a2438` (in fog quasi nere) |
| Alghe | `#0e6b54` (micro-emissive per non sparire) |
| Bolle | `#cdeeff` (alpha ~0.5) |
| Bioluminescenza alghe/monolite | `#6affc9` + `#39e0c4` (easter egg circuito) |
| Marine snow | `#bcd6e8` |

---

## 4. Luci

- `AmbientLight(0x2a6a88, 0.85)` — base fredda diffusa (il blu dell'acqua, niente nero pieno).
- `DirectionalLight(0xbfe9ff, 1.2)` da `(2, 12, 4)` — KEY: la luce della superficie che cala dall'alto, modella sub e pesci sulle facce superiori, allineata ai god-rays.
- `PointLight(0x7fe9ff, 6, 12)` ancorata alla MASCHERA del sub (position aggiornata nel loop) — alone freddo sul volto, rende il sub il punto focale.
- `PointLight(0xff6a1f, 4, 8)` rim caldo dietro il sub — stacca la silhouette copper dal blu (brand rim-light).
- `PointLight(0x00d4d4, 5, 12)` debole vicino al pesce "dev" cyan — lo fa "brillare" come faro discreto.
- Una `PointLight(0x2ec5ff, 0, 22)` ancorata alla PUNTA dell'arbalete, intensità a riposo bassa (~2), pilotata dalla macchina a stati del momento wow (§8): sale ad agganciare il bersaglio.
- Niente ombre vere. **Blob shadow finto** sotto il sub (e micro sotto le rocce): `CircleGeometry(2.2)` orizzontale, `MeshBasicMaterial` nero `transparent opacity 0.18`, su un piano basso (`y ≈ -5`), che segue x/z del sub e scala leggermente col bobbing. In alternativa una `CanvasTexture` a gradiente radiale scuro su un plane (resa più morbida) — scegliere il radiale se il budget regge.

---

## 5. Oggetti — geometrie three.js

### 5.1 SUB (protagonista, ~4.5 teste, assetto ORIZZONTALE da nuoto)
`THREE.Group` `subGroup` (così bob/parallasse/idle muovono tutto insieme). Orientato lungo +X verso destra, con leggera planata: ruotato `~-0.15 rad` su Z e `~0.25 rad` su Y (tre quarti verso camera). Mesh statiche rigide che condividono materiale → mergiare per ridurre draw call (vedi §9).

- **Torso/muta**: `CapsuleGeometry(0.55, 1.3, 6, 12)` orizzontale, `#16243c`, roughness 0.6. Due pannelli hi-vis: `BoxGeometry(1.3, 0.12, 0.6)` sottili `#ff6a1f` sui fianchi.
- **Testa**: `SphereGeometry(0.48, 12, 10)` cappuccio muta `#16243c`. Porzione "viso" = `SphereGeometry(0.32)` `#e8b48f` che spunta frontale dal cappuccio.
- **Maschera**: telaio `BoxGeometry(0.55, 0.36, 0.2)` leggermente smussato (scala) `#ff7d36`; vetro = `PlaneGeometry(0.46, 0.28)` (o cupoletta `SphereGeometry` settoriale) frontale `#bfeefe`, `transparent opacity 0.55`, `emissive #7fe9ff intensity 0.4`. Dietro il vetro DUE occhi = `SphereGeometry(0.05)` `#0a0e16`. FACCIA MINIMALE: occhietti + maschera, NIENTE bocca articolata (vincolo coesione 3 coach rispettato).
- **Boccaglio/erogatore**: `CylinderGeometry(0.06, 0.06, 0.25)` `#10202f` dalla bocca, emitter delle bolle del respiro.
- **Braccia**: 2× `CapsuleGeometry(0.16, 0.7)` `#16243c`. Destro teso in avanti (impugna l'arbalete, raggruppato in un sotto-group `armGroup` per il tracking della mira), sinistro lungo il fianco. Mani = `SphereGeometry(0.16)` appiattite `#e8b48f`, anellino copper al polso.
- **Gambe**: 2× `CapsuleGeometry(0.18, 0.9)` `#16243c`, leggermente divaricate, terminano nelle pinne.
- **Pinne**: 2× `ExtrudeGeometry` di shape a goccia allungata (lunga ~1.1, depth 0.05) `#ff7d36`. Raggruppate ai piedi, animate (§7).
- **Bombola**: `CylinderGeometry(0.26, 0.26, 0.95, 12)` `#1f8f6a` sulla schiena + valvola `CylinderGeometry(0.06, 0.06, 0.12)` `#d8dde4`.

### 5.2 ARBALETE (prop-chiave del brand) — in `armGroup`
- Corpo/fusto: `BoxGeometry(0.12, 0.12, 1.4)` `#33404f`, `roughness 0.3, metalness 0.6` (unico metallo della scena).
- Impugnatura: `BoxGeometry(0.12, 0.3, 0.14)` `#22303f` sotto al fusto.
- Freccia: `CylinderGeometry(0.03, 0.03, 1.5)` `#9aa6b4` con punta `ConeGeometry(0.07, 0.2, 6)` `#e6ebf2`. La punta è il riferimento per la `PointLight` ciano e per il momento wow.
- Elastici (l'UNICO arancio sull'arma = "è carico", tensione): 2× `CylinderGeometry(0.02, 0.02, ...)` tesi `#ff6a1f`.
- L'arbalete PUNTA verso il banco ma a riposo NON spara → il momento è l'attesa del predatore calmo.

### 5.3 BANCO DI PESCI "FISH" (InstancedMesh — il trucco di costo)
- **Geometria unità** mergeata in UNA sola (`BufferGeometryUtils.mergeGeometries`): corpo = `SphereGeometry(0.2, 8, 6)` scalato `(1.6, 1, 0.7)` (affusolato, low-poly) + coda = `ConeGeometry(0.14, 0.26, 4)` (piramide 4 lati) saldata dietro + 2 pinnette `ConeGeometry(0.07, 0.11, 3)`. Occhio = puntino nero su anello bianco dipinto sulla `CanvasTexture` 64×64 della geometria mergeata (espressione ingenua da "fish", coerente col brand — niente geometria extra).
- **Count**: 36 desktop / 18 mobile. `InstancedMesh(geo, mat, COUNT)`, materiale `#ffc24a` flat; variazione hue per-istanza con `setColorAt` (alcuni più aranciati `#ff9a3c`) → banco vivo a 1 draw call. Coda/guizzo arancio fa leggere il banco anche piccolo.
- **Moto a banco (boids finto, NO flocking reale)**: centro_banco deriva lento su percorso lemniscata (`x = 3.5 + sin(t*0.18)*2`, `y = 0.4 + cos(t*0.13)*1.1`), entrando da destra verso il centro. Ogni istanza = centro + offset locale ellissoidale + `sin(t*1.2 + phase)*0.25` sui 3 assi (dispersione). Coda che frusta: rotazione per-istanza `sin(t*4 + phase)*0.35` su Y (veloce, contrasta con la lentezza del sub). Aggiornare `instanceMatrix` con `setMatrixAt` + `instanceMatrix.needsUpdate = true`.
- **Reazione al cacciatore** (costo trascurabile, solo distanza²): i pesci entro un raggio dalla punta dell'arbalete subiscono una spinta laterale (vettore di fuga centro→pesce) → il banco si "apre" davanti al sub.

### 5.4 PESCE "DEV" — easter egg #1 (1 istanza separata, NON instanced, colorabile a parte)
- Stesso modello pesce, `#00d4d4` neon (brand cyan), `scale 1.3`, `emissive #00d4d4 intensity 0.3`. Nuota più LENTO, in disparte, in figura a otto (Lissajous: `x = 3 + sin(t*0.3)*1.5`, `y = 0.6 + sin(t*0.6)*0.5`), pulsazione emissive `0.2↔0.4`.
- **NON scappa MAI** durante il momento wow (il sub mira sempre ai gialli, mai al cyan). Micro-storia: "il fish che ce l'ha fatta". Tie-in perfetto (cyan = accento del sito) senza scritte. Da notare solo dopo un po'.

### 5.5 EASTER EGG developer #2 (monolite — discreto, "il founder è anche il dev")
Sul fondale (dentro il fog, leggibile solo da vicino/parallasse): uno scoglio più squadrato (`BoxGeometry` ruotato, leggero bevel via scala) con una `CanvasTexture` emissive sul fronte che disegna un sottile pattern a circuito stampato (linee + nodi) e un glifo `{ }` luminoso `#39e0c4`. `emissiveIntensity` bassa (0.6), pulsa pianissimo `0.5 + sin(t*0.6)*0.15`. Il fondatore-developer che "compila" l'abisso. (I due easter egg — pesce cyan + monolite circuito — coesistono: uno in midground vivo, uno sul fondale statico.)

### 5.6 FONDALE
- **Rocce**: 5–6 `IcosahedronGeometry(0.8–1.6, 0)` (detail 0 = poliedro spigoloso low-poly), schiacciate su Y, `flatShading`, `#0a2438`, sul fondo `y ≈ -3.2`, sparse su X/Z, mezze inghiottite dal fog. Una vicina in foreground-sinistra parzialmente sfocata. Mergiabili in 1 draw call.
- **Alghe**: 8–10 `PlaneGeometry(0.22, 1.8, 1, 4)` (4 segmenti in altezza) `#0e6b54`, `side: DoubleSide`, micro-`emissive` per non sparire nel fog, a ciuffi sulle rocce. Punte con micro-`SphereGeometry` emissive `#6affc9` (3-4 punti bioluminescenti mood). Vertex animation a onda (§7).
- **Sabbia**: `PlaneGeometry(24, 14)` orizzontale a `y ≈ -3.4` con `CanvasTexture` 256×256 "caustiche" soft (macchie chiare `#0f4a6b` su base scura); `texture.offset` scorre lentissimo (caustiche dell'acqua).

### 5.7 GOD-RAYS (raggi di luce dall'alto, finti — alto impatto, basso costo)
5–6 `PlaneGeometry(1.2, 30)` molto alti e stretti, verticali leggermente inclinati e ruotati su Y a ventaglio convergente, sparsi su X/Z in background/midground. Materiale: `MeshBasicMaterial` con `CanvasTexture` a gradiente verticale (`#aee8ff` opaco in alto → trasparente in basso) + soft sui bordi orizzontali (no edge netti); `transparent`, `blending: THREE.AdditiveBlending`, `depthWrite: false`, `side: THREE.DoubleSide`, `fog: false`, `opacity ~0.1`. Animati: opacità che respira (`0.06 + sin(t*0.4 + phase)*0.05`, sfasata per raggio) + microrotazione `rotation.y` (±0.04 rad) + lievissimo slittamento `position.x`. Questo è IL tocco registico. `depthWrite:false` evita artefatti d'ordine.

### 5.8 PARTICELLE
- **Bolle**: `InstancedMesh` di ~50 `SphereGeometry(0.05, 6, 6)` `#cdeeff` `transparent opacity 0.5` (micro emissive bordo), `additive`, `depthWrite:false`. Due sorgenti: grappolo dall'erogatore del sub + risalita ambientale sparsa. Salgono in Y con zig-zag `x += sin(t*speed+phase)*amp`, si rimpiccioliscono verso l'alto, respawn in basso al wrap. 1 draw call. Burst extra al momento wow.
- **Marine snow**: `THREE.Points` ~250 (150 mobile), `PointsMaterial` size ~0.04, `#bcd6e8` opacity ~0.3, deriva lentissima verso il basso, wrap. 1 draw call. Vende la sospensione nell'acqua.

---

## 6. (riservato — vedi §7 e §8)

## 7. Animazioni idle (continue, loop infinito)

Tutto su `t`. Movimenti LENTI e pesanti (è sott'acqua). Pausa fuori viewport / scheda nascosta come da §0.

- **Sub bob + assetto**: `subGroup.position.y = baseY + sin(t*0.45)*0.18`; rollio `rotation.z = baseZ + sin(t*0.4)*0.05`; pitch `rotation.x = sin(t*0.4)*0.03`; deriva avanti-indietro `position.x = baseX + sin(t*0.3)*0.2`. Galleggiamento neutro in apnea.
- **Pinne — kick alternato di nuoto**: per pinna `rotation.x = sin(t*2.2 + sidePhase)*0.5`, le due sfasate di π (periodo ~0.45s) → propulsione. È il movimento che vende "sta nuotando".
- **Braccio/arbalete — micro-tracking della mira**: `armGroup.rotation.x += sin(t*0.25)*0.04` (segue il banco senza sparare, vivo).
- **Banco di pesci**: lemniscata del centro + offset per-istanza + frusta coda (§5.3); riciclo edge-wrap quando un pesce esce.
- **Pesce dev cyan**: Lissajous + pulsazione emissive (§5.4).
- **Alghe — vertex animation**: nel loop modifico i vertici (asse X piegato) in funzione di altezza-vertice e tempo: `pos.x += sin(t*1.4 + y*0.8 + clumpPhase)*0.12*y_norm` (più ampiezza in punta, base ancorata), `geometry.attributes.position.needsUpdate = true`. ~10 plane da ~10 vertici → costo irrisorio.
- **Bolle**: risalita + zig-zag + scale-down + respawn.
- **Marine snow**: deriva lentissima + wrap.
- **God-rays**: opacità respira + micro-rotazione Y + slittamento x (§5.7).
- **Caustiche sabbia**: scroll `texture.offset` lentissimo.
- **Monolite easter egg**: pulsazione emissive lentissima (§5.5).
- **Camera**: respiro d'onda + dolly + parallasse (§1).
- **PointLight maschera**: position segue la maschera del sub ogni frame.

---

## 8. IL MOMENTO WOW — "La battuta di caccia" (ciclo ~14–18s, automatico, con jitter)

Macchina a stati temporale (fase + `t` locale), NON legata al click — la scena è idle. Solo modulazione di trasformazioni già esistenti → zero costo extra. L'effetto è NARRATIVO (mini-storia leggibile), non pirotecnico. Sequenza ~1.8s:

1. **Aggancio/mira** (~1.2s): il sub punta l'arbalete verso un pesce GIALLO bersaglio (mai il cyan); `armGroup` si stabilizza sul target; gli elastici copper si tendono leggermente (scala); la `PointLight` punta arbalete sale (2→14) e il vetro maschera lampeggia ciano (+30% emissive) → "ha agganciato". Micro-zoom camera (`fov -1.5`). Il pesce mirato rallenta, il banco intorno si APRE (boids fuga §5.3).
2. **Scocco** (~0.15s): la freccia scatta in avanti lungo l'asse del fucile con easing brusco; un flash copper `PointLight` lampeggia ~1 frame; un **anello d'onda** = `RingGeometry` additivo parte dalla punta e si espande+sfuma (1 quad, costo nullo); burst extra di bolle dall'erogatore.
3. **La virata del banco / esito ironico** (~0.6s): proprio mentre l'arbalete è puntato, il pesce bersaglio fa un guizzo e **schiva all'ultimo** — la freccia LO MANCA di un pelo (passa accanto), il banco intero vira di scatto coordinato con guizzi delle code arancio. NESSUNA violenza, niente pesce infilzato. In quell'istante un god-ray si allinea e illumina la maschera del sub (point light maschera +30%): *il cacciatore aspetta calmo, i fish scappano sempre — "Best Fish Forever". Anche il top reg a volte buca, il fish sopravvive.* Tono ironico-competente del brand.
4. **Reset**: la freccia si riavvolge (retract sul fucile), elastici tornano laschi, banco si ricompatta, point light arbalete torna bassa. Dopo pausa con jitter, il ciclo riparte mirando a un pesce diverso.

**Easter egg condizionale**: se il bersaglio che entra in mira fosse il pesce `#00d4d4` (di norma escluso dalla selezione, ma se per caso vi capita vicino), l'anello d'onda esce ciano-verde e la point light fa un doppio flash → strizzata d'occhio per chi osserva a lungo: il founder-developer "compila" la scena. Discreto, opt-in visivo.

---

## 9. Budget e ottimizzazioni

| Elemento | Tris (~) | Draw calls |
|---|---|---|
| Sub (group ~14 mesh, mergiabile a ~8) | ~3.000 | ~8 |
| Arbalete | ~600 | ~4 |
| Banco pesci InstancedMesh (36) | ~4.300 | 1 |
| Pesce dev cyan | ~150 | 1 |
| Bolle InstancedMesh (50) | ~3.000 | 1 |
| Marine snow Points (250) | — | 1 |
| God-rays (5–6 quad, mergiabili) | ~12 | 1 |
| Rocce (5–6 icosaedri, mergiabili) | ~1.300 | 1 |
| Alghe (10 plane segmentati) | ~160 | 1 |
| Monolite easter egg | ~50 | 1 |
| Background plane + sabbia + blob shadow | ~10 | 3 |
| **Totale** | **~16–18k tris** | **~22–24 draw calls** |

Ampio margine sotto i 30–60k tris, 60fps su hardware medio con DPR cap 2. **Riduzione draw call**: mergiare con `BufferGeometryUtils.mergeGeometries` i gruppi rigidi che condividono materiale (muta navy del sub in una mesh, accenti copper in un'altra; rocce statiche in 1; god-rays in 1; alghe in 1). InstancedMesh per pesci/bolle, Points per marine snow.

**Texture canvas** (tutte piccole, generate una volta, `SRGBColorSpace`): background gradient (256×512), faccia pesce (64×64), caustiche sabbia (256×256), god-ray gradient (verticale, ~32×256), monolite circuito (~128×128). 

**Mobile**: banco 18 pesci, marine snow 150, god-rays 3–4, eventualmente disattivare il rim-light copper; nessuna parallasse (solo idle). Stesso budget con margine.

---

## 10. Coesione coi 3 coach (linguaggio comune)

Stesso vocabolario low-poly "toy": proporzioni ~4–5 teste (qui orizzontale ma stessa testa-grande), facce MINIMALI (occhietti + maschera, niente bocca articolata — vincolo rispettato), arti a capsule/box smussati. Il carattere di NagatoUzumaki passa da: **silhouette** (assetto orizzontale da nuoto, pinne, bombola), **palette** (abisso blu + navy muta + accenti copper brand), **posa** (caccia calma in apnea), **props** (arbalete carico, maschera, pinne). Atmosfera e palette completamente proprie e indipendenti dal tema della pagina, come richiesto. Tie-in brand "il founder caccia i fish" valorizzato come beat narrativo di tensione-e-rilascio, mai gag esplicita; doppio easter egg developer discreto (pesce dev cyan + monolite circuito).

## Rationale della sintesi

Le tre proposte sono fortemente convergenti (stesso concept: sub orizzontale + arbalete + banco di fish + god-rays + fog abisso + il fish che scappa sempre). Ho usato come BASE la Proposta 2 per la sua precisione di geometrie/numeri e il momento-wow narrativo a macchina a stati ("la battuta di caccia"), e ho innestato:

- Da Proposta 1: la regia cinematografica (camera low-angle eroico, regola dei terzi con tensione nello spazio negativo, fog 0.05 con colore = blu medio del gradiente, respiro d'onda camera `sin*0.012`, virata coordinata del banco come beat); il SECONDO easter egg developer (monolite con circuito `{ }` bioluminescente sul fondale, più discreto e "ambientale" del solo pesce-dev); le specifiche tecniche degli additivi (`depthWrite:false`, DoubleSide) e i materiali metallo dell'arbalete.
- Da Proposta 3: il background come MESH plane con `fog:false` (più solido di scene.background piatto per reggere l'alone luce), l'anello d'onda `RingGeometry` additivo allo scocco, `alpha:false` con motivazione (meno blending), la parallasse stratificata geometrica naturale, e l'allineamento esplicito ai token reali del repo.

Conflitti risolti: (1) colore pesci — scelto giallo-oro `#ffc24a` (Prop. 2/3) invece del bianco di Prop.1, perché legge meglio come "fish" e contrasta col blu; il guizzo arancio resta. (2) Accenti brand — unificati sul copper REALE del sito (`#ff6a1f/#ff7d36`, verificati in _tokens.scss) per pinne/maschera/elastici, più coerente del teal di Prop.1. (3) Easter egg — tenuti ENTRAMBI (pesce cyan vivo in midground + monolite statico sul fondale) perché non si pestano. (4) Posizione sub — terzo sinistro rivolto a destra (Prop.1, miglior tensione narrativa) invece del centro. (5) Pattern tecnici allineati 1:1 al componente hero-3d reale che ho letto (`alpha:false` qui giustificato, parallasse off su `pointer:coarse`, fallback CSS sempre presente, dispose completo). Ho corretto i refusi delle proposte (es. `#1f6 db`, `#bfeoff`) con hex validi.


---

# SCENA: Bastogne87

# Diorama 3 — BASTOGNE87, Coach · "Mezzanotte, l'asso si rivela"

Un ragazzo elegante "alla Joker" (NON il Joker, niente trucco/clown) sta in piedi su un piccolo palco circolare, scolpito da uno spotlight conico caldo dall'alto. Attorno a lui un anello di carte da gioco orbita lento; fumo basso striscia sul palco; un fondale di velluto scuro chiude la quinta. Ogni ~9s una carta in orbita rallenta davanti alla mano e SI RIVELA come Asso (flip + ingrandimento + glow teal + scintille). Palette viola/verde/oro + un unico accento TEAL, indipendente dal tema della pagina.

## Vincolo critico (ripetuto perche e' il piu sbagliabile)
NIENTE faccia da clown, NIENTE trucco bianco/rosso, NIENTE ghigno spaccato. Pelle normale. E' un ragazzo VESTITO alla Joker. L'aggancio Joker passa SOLO da: abito viola + gilet verde + atmosfera teatrale + carte. La faccia e' minimale e composta (occhi azzurri come piccole geometrie, mezzo sorriso accennato).

## Pattern tecnico obbligatorio (identico all'hero esistente hero-3d.component.ts)
- Angular standalone, ChangeDetectionStrategy.OnPush, template con `<div class="...__fallback" aria-hidden>` + `<canvas aria-hidden>`. In `constructor` → `afterNextRender(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches || !hasWebGL()) return; void initScene(); })`.
- `hasWebGL()` come nell'hero (probe canvas webgl2 ?? webgl).
- Three.js via `const THREE = await import('three')` DENTRO initScene (chunk lazy). Guard `if (this.disposed) return` dopo l'await.
- `WebGLRenderer({ canvas, alpha:true, antialias:true, powerPreference:'low-power' })`, `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Loop con `performance.now()` (NO THREE.Clock): `const start = performance.now()`, `const t = (performance.now()-start)/1000`, `requestAnimationFrame`. Render solo se `running && visible`.
- ResizeObserver su hostEl (resize → setSize(clientW,clientH,false) + camera.aspect + updateProjectionMatrix). IntersectionObserver → `visible`. `visibilitychange` → `running = !document.hidden`.
- Parallasse mouse: `pointermove` → pointer.x/y in [-1,1], camera lerp 0.04 (vedi sotto). DISATTIVATA su touch: `if (!matchMedia('(pointer: coarse)').matches && !('ontouchstart' in window))`.
- `cleanupFns: (()=>void)[]`, `ngOnDestroy`: disposed=true, cancelAnimationFrame, esegui tutti i cleanup (removeEventListener, observer.disconnect). Dispose finale: tutte le geometrie/materiali/texture in array dedicati (`geometries[]`,`materials[]`,`textures[]`) → `.dispose()`, poi `renderer.dispose()` + `renderer.forceContextLoss()`.
- Riuso ESATTO di `roundedRect(w,h,r)` (Shape con absarc) e del trucco UV per le carte: `tex.colorSpace = SRGBColorSpace; tex.repeat.set(1/CARD_W, 1/CARD_H); tex.offset.set(0.5,0.5)`. Tutte le texture (faccia carte, fondale, fumo, legno palco) via canvas 2D, ZERO asset esterni. `canvas.classList.add('is-on')` a fine init.
- Fallback CSS sotto il canvas (gradiente viola→nero + silhouette + glow oro/teal) sempre presente, resta visibile se WebGL assente o reduced-motion.

## Palette diorama (canvas/materiali, indipendente dal tema pagina)
- Fondale notte: `#2a1840` (centro, illuminato dallo spot) → `#0a0410` (bordi, quasi nero)
- Fog: `0x140a22`
- Disco palco: `#1d0f2e` (top), bordo ribalta oro `#c9962f` (emissive `0x3a2a00`)
- Listoni legno (texture): strisce `#1a0e29` / `#241338`
- Giacca viola Joker: `#6a2da8`; revers piu chiari `#8b4fd0`
- Gilet verde Joker: `#1f6e3a` (unico verde acido → fa pop)
- Pantaloni: viola scuro `#3b1d63`
- Camicia: avorio `#ece6d8`; cravatta bordeaux `#7a1530` (tocco caldo che stacca dal verde)
- Scarpe / cilindro / fiche-nere: `#0d0814`–`#1a1420`
- Pelle: `#e8c0a0`
- Capelli biondo-rossiccio (rame): `#c8763a`; sopracciglia stesso colore
- Occhi: bianco `#f2f2ee` + iride azzurra `#3aa0e8`
- Spotlight caldo: `0xfff0d0` / god-ray `0xffe6b0`
- Rim light viola: `0x9a4fd0`
- PointLight verde (sul gilet): `0x1f6e3a`
- Fumo: malva `rgba(120,90,150,a)`
- Carte dorso: nero `#0d0814` + cornice oro `#c9962f` + rombo viola; fronte panna `#f4f0e4`
- ACCENTO TEAL (solo asso magico): `#3fd8c8` — l'unico colore freddo della scena → punto focale

## Composizione e camera
- `PerspectiveCamera(36, aspect, 0.1, 100)`, posizione base `(0, 1.6, 11)`, `lookAt(0, 1.4, 0)`. FOV stretto = ritratto da palco, compressione cinematografica.
- Personaggio leggermente decentrato a x ≈ -0.4 (lascia respiro all'orbita carte e, nel mezzo-pannello, fa "guardare" verso la colonna di testo).
- Scena a SINISTRA del pannello (alterna rispetto ai diorami 1/2), testo a destra. Y-up, pavimento palco ~y=0.
- Altezza personaggio ≈ 4.6 teste (toy), ~4.2 unita scena.
- `scene.background` = lasciato trasparente NON serve: uso un **plane gigante** `PlaneGeometry(40,30)` a z=-12 con `MeshBasicMaterial` + CanvasTexture gradiente radiale verticale (`#2a1840`→`#0a0410`, 512×512, con accenni di pieghe velluto = bande verticali sin di luce/ombra). Piu economico e prevedibile dell'equirect.
- `scene.fog = new THREE.FogExp2(0x140a22, 0.045)` — IL trucco-chiave: fonde la base del personaggio col palco, nasconde i bordi del disco, da profondita gratis e crea il "momento teatrale". Tienila a questa densita: troppo alta mangia la silhouette.

## Palco
- **Disco**: `CylinderGeometry(3, 3.2, 0.4, 48)` (top<bottom = svasatura), `MeshStandardMaterial({ color:0x1d0f2e, roughness:0.85, metalness:0.1 })`, y=-0.2. Top mappato con CanvasTexture listoni legno (UV cap) — niente geometria extra.
- **Bordo ribalta**: `TorusGeometry(3.05, 0.05, 8, 48)` oro `0xc9962f` emissive `0x3a2a00`, orizzontale sul bordo del disco.

## Personaggio (THREE.Group gerarchico, primitive smussate, ~4.6 teste)
flatShading: true su corpo/giacca/capelli (look low-poly sfaccettato); faccia LISCIA (flatShading off). Sotto-group separati per testa, braccio sinistro (regge la carta), cosi animabili indipendentemente.
- **Gambe**: 2× `CapsuleGeometry(0.28, 1.0, 4, 8)` pantaloni `#3b1d63`, leggermente divaricate, x=±0.32, y≈0.6.
- **Scarpe**: 2× `BoxGeometry(0.4, 0.22, 0.7)` smussato (scale bevel), `#0d0814` roughness 0.3 (lucide). Una con punta leggermente sollevata (posa dinamica da passo/inchino).
- **Torso base**: `CapsuleGeometry(0.5, 1.0, 6, 10)` color camicia.
- **Gilet verde** (il pezzo che "fa Joker"): guscio `CapsuleGeometry(0.52, 0.8)` leggermente piu largo, `#1f6e3a`, flatShading, copre davanti/lati (dietro la giacca aperta). 3 bottoni dorati (piccole `SphereGeometry` `#c9962f`) in fila centrale.
- **Camicia visibile**: `BoxGeometry(0.22, 0.9, 0.1)` avorio `#ece6d8` davanti al gilet.
- **Cravatta**: `ConeGeometry(0.09, 0.5, 4)` capovolta (4 segmenti = rombo low-poly) bordeaux `#7a1530`, sulla camicia — tocco caldo che stacca dal verde.
- **Giacca viola** (pezzo forte): due falde/revers via `ExtrudeGeometry` da una `Shape` a pannello di giacca aperta (trapezio spalla larga + taglio a V sul petto; riuso del pattern roundedRect/Shape). Due mesh speculari (scale.x=±1), `#6a2da8`, flatShading, roughness 0.6. Bordo revers in `#8b4fd0` (seconda Shape sottile sovrapposta) per leggere il taglio sartoriale. Falde dalle spalle (y≈2.1) a y≈0.9, larghe ~0.7, inclinate verso l'esterno (rotation.z ±0.12). **Coda di rondine accennata**: un `PlaneGeometry` viola che scende dietro fino a meta coscia → silhouette dandy svolazzante.
- **Spalle**: 2× `SphereGeometry(0.26, 8, 6)` viola giacca a coprire i giunti braccio/torso.
- **Braccia**: 2× `CapsuleGeometry(0.16, 0.85, 4, 8)` viola (maniche). Braccio destro lungo il fianco (mano aperta verso l'asso magico). Braccio sinistro PIEGATO che regge una carta. Mani: `SphereGeometry(0.14, 8, 6)` pelle `#e8c0a0`. Polsini camicia (anellino avorio) ai polsi.
- **Testa**: `SphereGeometry(0.55, 16, 14)` schiacciata (scale.y 1.05, scale.z 0.95), pelle `#e8c0a0`, roughness 0.7, flatShading OFF (liscia, no uncanny).
- **Faccia (occhi-geometria, semplicissima — coerente col linguaggio comune dei 3 coach)**:
  - Occhi azzurri: 2× `SphereGeometry(0.07,8,6)` bianco `#f2f2ee` + sopra `SphereGeometry(0.035)` iride `#3aa0e8`, x=±0.18, y≈3.15, z=0.48 (fronte). Sguardo vispo/furbo.
  - Naso: `ConeGeometry(0.05, 0.14, 4)` pelle, z=0.52.
  - Bocca: singolo `BoxGeometry(0.18, 0.025, 0.02)` `#9a5a55` leggermente ruotato (rotation.z ~0.06) e posizionato per un mezzo sorriso accennato. NIENTE bocca articolata (vincolo brief).
  - Sopracciglia: 2× `BoxGeometry(0.16, 0.03, 0.02)` color capelli, leggermente inarcate (aria "ho un asso che tu non vedi"), non malvagie.
- **Capelli biondo-rossicci medio-lunghi** (firma del personaggio): calotta base `SphereGeometry(0.57,12,10)` ritagliata a emisfero superiore (phiStart/thetaLength) `#c8763a`, + ~10-12 ciocche `ConeGeometry(0.12, 0.6, 4)` (coni 4 lati = sfaccettati) piantate sulla calotta, orientate verso basso/esterno con angoli da seed FISSO (deterministico), che scendono fino a nuca/orecchie (medio-lunghi). 2-3 ciocche-ciuffo inclinate in avanti sulla fronte. flatShading ON. Le ciocche ondeggiano (idle).
- **Blob shadow**: `CircleGeometry(0.9, 24)` orizzontale y=0.01 sotto i piedi, `MeshBasicMaterial` + CanvasTexture radiale (nero opacity 0.5 centro → trasparente), `transparent:true, depthWrite:false`. NIENTE shadow map reali. Si stringe/allarga col respiro.

## Carte (instancing)
- **Anello orbitante**: 12 carte, raggio ~3.4, anello su un piano inclinato ~20° rispetto all'orizzontale (look dinamico, anelli-di-Saturno-storti).
- Geometria: `ExtrudeGeometry` del roundedRect (riuso `roundedRect`, depth 0.03; W 0.7, H 1.0; CARD_W/CARD_H per il trucco UV). Le carte dietro al personaggio passano in z reale → profondita.
- **InstancedMesh** unico per i 12 dorsi (1 draw call): texture dorso (canvas 256×358: nero `#0d0814`, cornice oro `#c9962f`, rombo viola centrale, mini-picche). Monogramma "B" oro opzionale al centro (tie-in coach).
- **2-3 carte speciali** come mesh singole (non instanced) con texture fronte dedicata, in orbita davanti: gli Assi candidati al "reveal". Raggio leggermente diverso.
- **Carta in mano sinistra** (mesh singola): l'asso/jolly che il personaggio rigira fra le dita (idle twirl) — il riferimento Joker passa anche da QUI, non dalla faccia.

## Luci (cuore teatrale)
- **SpotLight** vero: `THREE.SpotLight(0xfff0d0, 18, 20, Math.PI/7, 0.4, 1.2)` da `(0, 9, 3)`, `target` sul busto (y≈2). Angolo stretto, cono caldo sul protagonista, resto in penombra. NIENTE shadow map (costose) — l'ombra e' il blob.
- **God-ray visibile** (fascio volumetrico finto, costo ~zero): `ConeGeometry(2.2, 7, 24, 1, true)` (open-ended) capovolto dall'alto allineato allo spot, `MeshBasicMaterial({ color:0xffe6b0, transparent:true, opacity:0.10, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false })`. Opacity pulsa leggermente (flicker da palco).
- **AmbientLight** `0x2a1840` intensita 0.6 (riempimento viola, non spegne le ombre).
- **Rim light**: `DirectionalLight(0x9a4fd0, 0.8)` da dietro-sinistra `(-6, 4, -5)` → bordo viola su capelli/spalle, STACCA il personaggio dal fondo nero (fondamentale per leggibilita silhouette su scuro).
- **PointLight verde**: `0x1f6e3a` intensita 6, range 8, da `(3, 1, 4)` → riflesso verde sul gilet e sulle carte vicine, lega la palette.
- **PointLight teal** dell'asso magico: agganciato all'asso "rivelato", `0x3fd8c8` intensita ~0.9 (pulsa 0.7↔1.1) — acceso SOLO durante il reveal.

## Animazioni idle (continue, sinusoidali, ampiezze piccole — vivo ma elegante, non balla)
- **Respiro**: tutto il Group scala y `1 + sin(t*1.1)*0.012` e sale `sin(t*1.1)*0.02`.
- **Sway busto**: `rotation.z = sin(t*0.5)*0.025`. **Testa**: yaw `sin(t*0.35)*0.18` + micro-cenni `rotation.x = sin(t*0.7)*0.04` (osserva il pubblico/le carte).
- **Braccio sx + carta in mano**: braccio piegato fisso; la carta fa un twirl lento `rotation.z += dt*0.6` (la rigira); mano sale/scende `sin(t*0.9)*0.03`.
- **Capelli**: ogni ciocca-cono oscilla `rotation = sin(t*1.6 + seedPhase[i])*0.05` (sfasata per ciocca) — ondeggio senza fisica.
- **Anello carte**: gruppo orbita `rotation.y = t*0.25` (giro ~25s). Ogni carta spinna su se' `rotation.z = t*0.4 + phase[i]` e ondeggia in raggio `sin(t*0.8+phase)*0.15`.
- **God-ray flicker**: opacity `0.10 + sin(t*3.1)*0.018 + sin(t*7.7)*0.008`.
- **Spotlight jitter**: target.x `sin(t*0.4)*0.1` (il cono "cerca", teatrale).

## IL MOMENTO WOW — "L'asso si rivela" (deterministico, ciclo ~9s)
Guidato da una SINGOLA fase temporale `const p = (t % 9) / 9` con easing (niente stato complesso). Quando una carta speciale, nell'orbita, arriva davanti alla mano destra tesa (allineata al cono di luce):
1. **Rallenta e si volta**: flip su Y in ~0.6s, rivelando l'**Asso di Picche** (texture fronte panna `#f4f0e4`, picca nera, "A" agli angoli).
2. **Si ingrandisce** leggermente (scale ~1.25) e **scatta** in posizione sospesa davanti al palmo.
3. **Si accende del glow TEAL** `#3fd8c8`: PointLight teal on (intensita 0.7→1.1) + piano emissivo teal dietro la carta.
4. **Pop di scintille teal**: 6-8 micro-quad/punti teal che si irradiano (instanced, alpha pulsante che decade).
5. **Flicker dello spot**: opacity god-ray + intensita spot pulsano una volta piu forte (come se la magia "consumasse" la luce).
6. **Resta esibito ~2s**: il personaggio fa un micro-cenno della testa, sguardo compiaciuto verso il testo/spettatore.
7. **Si rivolta dorso** e **rientra in orbita** dissolvendo il glow, mentre la prossima carta speciale e' gia pronta.
E' il "ta-daa!" del prestigiatore. Leggibile a colpo d'occhio e a piccole dimensioni perche e' l'UNICO elemento teal (freddo) che cresce e brilla al centro di una scena calda → massimo contrasto/focal point.

## Particelle / effetti (instancing, billboard)
- **Fumo basso da palco**: ~40 `THREE.Sprite` con `SpriteMaterial` (billboard automatico, 1 texture canvas 128×128 condivisa: macchia radiale `rgba(120,90,150,a)` sfumata), `transparent`, `depthWrite:false`, `blending: NormalBlending` (NON additive — il fumo diffonde, non illumina). Sparsi a y 0.1–0.6. Drift orizzontale lento (sin su x/z) + rotazione individuale + opacity che respira `0.25*(0.6+0.4*sin(t*0.5+phase))`, sale lentissimo e si resetta in basso (loop). Densita maggiore ai piedi.
- **Pulviscolo oro nel cono**: ~30 puntini (`Points` con PointsMaterial sprite morbido, o instanced `SphereGeometry(0.015)`) oro `#ffe6b0`, additive, alpha basso, moto browniano lento (somma di 2 sinusoidi per asse), CONFINATI nel volume del cono — vende il fascio polveroso da proiettore.
- **Scintille teal** del reveal: vedi momento wow (instanced, attive solo nel reveal).

## Micro-storie a terra (brand BFF: gioca 50/100, esplora ogni field)
- **Cilindro rovesciato** (top hat) accanto ai piedi: `CylinderGeometry` tesa + falda piatta (cilindro schiacciato / RingGeometry), `#1a1420` con nastro viola `#5f2d82`. Da dentro spunta appena un **angolo di carta** (una carta che "tenta la fuga") — dettaglio che fa sorridere.
- **Fiche impilate** (50€ verde / 100€ nero): `CylinderGeometry` sottili come **InstancedMesh** (1 draw call), 5-6 fiche in 2 pile, `#1f6e3a` e `#0d0814` con bordino bianco (tacche su texture canvas). Aggancia "gioca i 50 e i 100 euro / esplora field".

## Responsive / parallasse
- **Desktop**: canvas ~600×520. Parallasse: la camera orbita leggermente `camera.position.x += (pointer.x*0.9 - camera.position.x + baseX)*0.05`, `camera.position.y += (-pointer.y*0.5 + baseY - camera.position.y)*0.05`, sempre `lookAt(0,1.4,0)`. In piu il busto ruota verso il mouse `group.rotation.y += (pointer.x*0.15 - group.rotation.y)*0.06` ("ti guarda").
- **Mobile** (~360px, `aspect < 0.85`): nel resize → `camera.position.z = 13`, `lookAt y = 1.6`; fumo ridotto a ~20 sprite, pulviscolo ~20; il reveal teal RESTA (e' il wow). Parallasse DISATTIVATA (touch / pointer coarse).
- `devicePixelRatio` cap 2. Pausa fuori viewport (IntersectionObserver + visibilitychange). Fallback CSS (gradiente viola→nero + silhouette + glow teal/oro) se no-WebGL o reduced-motion.

## Budget / costo (target 30-60k tris, draw call contenute)
- Personaggio (corpo + ~14 ciocche-cono + testa/occhi/dettagli): ~2.5k tris, ~18 mesh.
- Palco (disco + bordo) + plane fondale: ~1.5k tris, ~3 draw call.
- Carte: InstancedMesh 12 dorsi = 1 draw call (~900 tris) + 2-3 speciali singole (~250 tris) + carta in mano.
- Fumo 40 Sprite (~1 draw), pulviscolo Points (1 draw), god-ray cone (~96 tris), scintille reveal (instanced, 1 draw).
- Cilindro + fiche (InstancedMesh, 1 draw): ~0.8k tris.
- **Totale ≈ 8-9k triangoli** (ben sotto budget, margine ampio). **Draw calls ~14-16** (instancing/sprite tengono basso).
- 60fps su hardware medio: niente shadow map, niente post-processing, lerp leggeri, particelle a quad/sprite. `MeshStandardMaterial` ovunque, `colorSpace = SRGBColorSpace` su tutte le CanvasTexture.

## Coesione col linguaggio dei 3 coach
Stessa grammatica low-poly: corpo a capsule/box smussati, ~4.6 teste, flatShading sul corpo, faccia minimale con OCCHI come piccole geometrie (sfere bianco+iride azzurra), niente realismo. Il carattere di Bastogne passa SOLO da: silhouette giacca-lunga svolazzante (coda di rondine), palette viola/verde/oro su nero teatrale con accento teal, posa showman che rigira la carta, capelli rame ondeggianti, fog + god-ray. Zero trucco, zero faccia da clown.


## Rationale della sintesi

Proposta 1 era solo un titolo, scartata. Base = Proposta 3 "Mezzanotte al Tavolo Verde": piu robusta tecnicamente (6-7k tris, 12-14 draw call vs 16-20k/~25 della 2), e con due trucchi cinematografici che la 2 non ha — FogExp2 (fonde la base, profondita gratis) e il cono god-ray visibile additive (fascio volumetrico a costo zero). Inoltre la 3 usa occhi-geometria (sfere bianco+iride) invece di canvas-texture sul viso: piu coerente col "linguaggio comune dei 3 coach" e zero rischio uncanny. Camera fov 36, z=11/13, palco circolare aperto + fog (preferito al proscenio-box della 2, che a 600px affolla). Dalla Proposta 2 ho innestato: (1) il momento wow superiore "L'asso si rivela" — flip + ingrandimento + glow + scintille + flicker guidati da una singola fase deterministica (t%9), molto meglio del flash secco della 3; (2) l'accento cromatico TEAL come unico freddo sull'asso magico = focal point ideale a piccole dimensioni su scena calda; (3) le micro-storie a terra (cilindro rovesciato con carta che spunta + fiche 50/100 euro instanced) che agganciano forte il brand BFF; (4) cravatta bordeaux come tocco caldo che stacca dal verde gilet; (5) coda di rondine della giacca. Conflitti risolti: faccia → occhi-geometria (3); glow asso → teal (2) col PointLight verde che resta sul gilet; background → plane gigante + fog (3); ambiente → palco circolare (3) rinunciando a proscenio/sipario/mantovana (troppa geometria). La spec e' autosufficiente e ricalca il pattern dell'hero esistente (lazy import three, roundedRect+UV trick, performance.now, observer pausing, dispose completo, dpr cap 2, fallback CSS).


---

# DIREZIONE ARTISTICA (style guide cast + correzioni + rischi)

Below is the complete deliverable.

---

# DIREZIONE ARTISTICA — I 3 DIORAMI COACH
## Verifica famiglia + Style Guide unificata + Correzioni + Rischi

Verdict d'insieme: **i 3 diorami sono già una famiglia coerente**. Stesso vocabolario low-poly toy, stesso skeleton tecnico, stesso livello di dettaglio, stesso uso di blob-shadow/fog/instancing. Le palette sono distinte ma imparentate (corallo/copper come ponte cromatico ricorrente). Servono **correzioni mirate di coesione**, non riscritture. La progressione di luminosità (spiaggia assolata → abisso blu → palco scuro) funziona come arco drammaturgico e va consolidata, non corretta.

---

## PARTE 0 — VERIFICA "FAMIGLIA" (la cosa più importante)

### 0.1 La progressione di luminosità funziona?
Sì, ed è un punto di forza da **proteggere**: chiaro caldo → blu medio-scuro → scuro caldo è una discesa luminosa coerente con un viaggio (giorno → profondità → notte teatrale). Rischio: se Bastogne resta troppo buio dopo l'abisso, lo scroll "muore" sul fondo. **Regola registica imposta:** la luminosità media percepita dei tre pannelli deve scendere in modo dolce, non a gradino. Esivezz ~alto, Nagato ~medio (NON troppo scuro: il god-ray e l'alone superficie devono tenerlo a metà strada), Bastogne ~basso ma con lo **spotlight caldo che rialza il valore locale del soggetto** così il volto resta luminoso quanto quello degli altri due. Misurare a occhio sul soggetto, non sullo sfondo: il **viso dei 3 coach deve avere luminanza simile** (è l'ancora percettiva della famiglia).

### 0.2 Nessuna scena ruba la scena
Il rischio reale è Exivezzz: ha più props, più gag, un momento wow più pirotecnico (spruzzo sabbia + flash + ring + squash). Nagato è il più sobrio (è giusto: predatore calmo). Bastogne è a metà. **Imporre parità di "rumore visivo"** — vedi correzione globale C-G3. Senza questo, lo scroll va in discesa di energia e il founder (Nagato) sembra il meno curato, che è l'opposto di quello che vuoi.

### 0.3 Coerenza palette tra scene
Le 3 palette condividono **due ancore brand**: il corallo/copper `#ff6a1f`/`#ff7d36` (canotta Exivezzz, accenti muta/pinne/arbalete Nagato, NON in Bastogne — vedi C-B7) e il **cyan/teal** brand (`#00d4d4` lenti Exivezzz, pesce-dev + monolite Nagato, asso magico Bastogne `#3fd8c8`). Questo è esattamente ciò che rende le scene "sorelle" pur con atmosfere autonome. Vincolo: **ogni scena deve contenere almeno un tocco copper E un tocco cyan/teal** anche se minimo, così l'occhio le riconosce come stessa scuola. Bastogne attualmente ha solo teal → vedi correzione C-B7.

---

## PARTE 1 — STYLE GUIDE UNIFICATA DEI PERSONAGGI
*(da applicare identica a tutti e 3; dove una spec diverge senza motivo, vince questa)*

### 1.1 Unità di misura comune: LA TESTA
Adottare **una sola "testa canonica"** per tutto il cast così le proporzioni si leggono come stesso universo.

- **Testa canonica = sfera di raggio 0.5 unità scena** (diametro 1.0). Questa è l'unità di misura ("1 testa" = 1.0 unità).
- Altezza personaggio in piedi = **4.6 teste ≈ 4.6 unità** (Bastogne è già a questo valore: è il riferimento). Exivezzz è l'**eccezione voluta**: ~5.5 unità, ma l'extra **tutto nelle GAMBE**, testa e torso restano dimensione-cast. Nagato è orizzontale ma con la **stessa testa-grande** (~0.5 raggio).
- **Conseguenza obbligatoria sulle teste:** le tre spec usano raggi-testa diversi (Exivezzz 0.42, Nagato 0.48, Bastogne 0.55). **Allinearle**: testa raggio **0.48–0.52** per tutti. Exivezzz 0.42 è troppo piccola per un "toy a testa grande" → portarla a **0.48**. Bastogne 0.55 è il limite alto accettabile (resta) ma idealmente **0.52**. Questo è il singolo fix che più fa "sembrare fratelli".

### 1.2 Costruzione testa (identica per i 3)
- Base: `SphereGeometry(0.48–0.52, 16, 14)`, leggermente schiacciata (`scale.y ≈ 1.05`, `scale.z ≈ 0.95`).
- **flatShading OFF sulla testa** (faccia liscia = niente uncanny low-poly sul volto). Il resto del corpo flatShading ON. Questa regola è già in Bastogne; **estenderla esplicitamente a Exivezzz e Nagato** (le loro spec dicono flatShading sulle teste → correggere: testa liscia).
- Pelle: ognuno la sua (Exivezzz abbronzato `#c98a5b`, Nagato `#e8b48f`, Bastogne `#e8c0a0`) ma stesso `roughness ≈ 0.7`, `metalness 0`.

### 1.3 Occhi — UN SOLO METODO per tutti
Le spec oggi divergono (Exivezzz: nessun occhio, nascosti dagli occhiali; Nagato: 2 sferette dietro vetro; Bastogne: sfera bianca + iride). **Unificare la costruzione, variare solo la visibilità:**

- **Occhio canonico** = `SphereGeometry(0.06, 8, 6)` bianco `#f2f2ee` + iride `SphereGeometry(0.03)` colore-iride sovrapposta in avanti, posizionata sul fronte testa (z ≈ +raggio·0.9).
- **Niente bianco dell'occhio esagerato, niente bocca articolata** per nessuno (vincolo cast già rispettato).
- Applicazione per coach:
  - **Bastogne**: occhi visibili, iride azzurra `#3aa0e8` (firma). → tiene lo standard.
  - **Nagato**: stesso occhio canonico ma iride scura `#0a0e16`, **dietro il vetro maschera** semi-trasparente. → tiene lo standard.
  - **Exivezzz**: stesso occhio canonico **ma costruito comunque** (anche se coperto dagli occhiali) — così se la camera si muove non c'è "vuoto" sotto le lenti riflettenti. Le lenti `#26c6c6` restano sopra. Niente disegnare occhi su texture: usare la geometria canonica (coerenza > risparmio di 2 sferette).
- **Bocca**: per tutti = al massimo una `BoxGeometry` sottilissima leggermente ruotata per un mezzo sorriso accennato (metodo Bastogne), oppure niente. **Mai** TorusGeometry "bocca a O" sul VOLTO dei coach (la bocca-O esiste solo sul pesce-pallone di Exivezzz, che è un prop, ok lì).

### 1.4 Capelli — UN SOLO METODO (calotta + ciocche-cono)
Le spec usano metodi diversi (Exivezzz: mezza-sfera liscia; Bastogne: calotta + 10-12 coni; Nagato: cappuccio muta). **Standard unico** (Bastogne è il riferimento, è il più espressivo):

- **Calotta base** = `SphereGeometry(raggio·1.05, 12, 10)` ritagliata a emisfero superiore (`phiStart/thetaLength`), colore capelli, flatShading ON.
- **Ciocche** = N× `ConeGeometry(0.10–0.12, lunghezza, 4)` (4 lati = sfaccettatura coerente con tutto il cast), piantate sulla calotta con **angoli da seed FISSO deterministico** (mai `Math.random()` a runtime — vedi rischio R-4).
- Per coach:
  - **Bastogne**: 10-12 ciocche medio-lunghe biondo-rame `#c8763a`, alcune sulla fronte. Ciocche ondeggiano (idle). → standard.
  - **Exivezzz**: stessa calotta `#3a2c22`, **poche ciocche corte (3-4)** = taglio sportivo. NON una mezza-sfera liscia: usare il metodo calotta+coni corti, così la grammatica capelli è la stessa. Sotto gli occhiali resta semplice.
  - **Nagato**: ha il cappuccio muta (no capelli visibili) → **esente**, ma il cappuccio usa la stessa `SphereGeometry` emisferica della calotta (stessa costruzione, materiale neoprene). Coerenza di metodo anche senza capelli.

### 1.5 Corpo e arti — capsule/box smussati (già allineato, fisso i numeri)
- **Torso** = `CapsuleGeometry` (Exivezzz 0.45×0.7, Nagato 0.55×1.3 orizz., Bastogne 0.5×1.0). Coerenti come metodo. Mantenere.
- **Arti** = `CapsuleGeometry` per braccia/gambe, `SphereGeometry` appiattita per mani/giunti. **Standard spessori** così non c'è chi ha arti-stecchino e chi arti-salsiccia:
  - Braccio: raggio **0.14–0.16**, lunghezza 0.7–0.85.
  - Avambraccio (dove separato): raggio 0.11–0.13.
  - Gamba (coscia): raggio **0.17–0.18**. Stinco 0.14.
  - Mano/giunto: sfera 0.14–0.16 appiattita.
  - Exivezzz può eccedere in **lunghezza** gambe (è il suo tratto) ma **non** in raggio: gambe lunghe sì, gambe grosse no.
- **Spalle**: una sferetta copri-giunto per tutti (già in tutte le spec).
- `roughness ≈ 0.6–0.7` corpo, `metalness 0` ovunque tranne metalli espliciti (occhiali Exivezzz, arbalete Nagato, bottoni/scarpe Bastogne).

### 1.6 Silhouette = il vero portatore di carattere
Le facce sono volutamente quasi-identiche (minimal). Il riconoscimento avviene per **silhouette + palette + posa + props**, e questo è corretto e va difeso:
- Exivezzz: verticale slanciato, braccio teso in alto, gambe lunghissime.
- Nagato: orizzontale planante, pinne+bombola+arbalete.
- Bastogne: verticale elegante, giacca con coda di rondine, anello di carte.
Vincolo: ogni silhouette deve essere **riconoscibile in nero pieno a 360px**. Test obbligatorio in implementazione (vedi R-1).

### 1.7 Livello di dettaglio comune (budget tris allineato)
Le 3 spec stimano: Exivezzz ~18-22k, Nagato ~16-18k, Bastogne ~8-9k. **Bastogne è troppo "magro" rispetto agli altri due** → rischio "fratello meno curato". Non gonfiare artificialmente, ma **portarlo a ~12-15k** aggiungendo densità dove serve (più segmenti su carte/palco, qualche carta in più nell'orbita, pulviscolo del cono più ricco). Target famiglia: **tutti nella fascia 12-22k**, nessuno sotto i 12k. Mai sopra 30k (tetto duro). Vedi C-G2.

---

## PARTE 2 — CORREZIONI PUNTUALI PER SPEC
*(solo dove serve coesione/correttezza; il resto delle 3 spec resta valido e va eseguito com'è)*

### Correzioni GLOBALI (tutte e 3)
- **C-G1 — Skeleton 1:1 dall'hero, alpha incluso.** Confermato dal codice reale. Attenzione: la spec Nagato impone `alpha:false`, Exivezzz e Bastogne `alpha:true`. È **corretto e voluto** (Nagato ha sfondo opaco, gli altri lasciano trasparire il fallback/pagina). Mantenere la divergenza. Tutti gli altri parametri identici all'hero: `powerPreference:'low-power'`, `setPixelRatio(Math.min(devicePixelRatio,2))`, niente `THREE.Clock`, dispose completo + `forceContextLoss()`.
- **C-G2 — Parità di dettaglio**: Bastogne sale a 12-15k tris (vedi 1.7). Exivezzz e Nagato restano. Nessuno sotto 12k, nessuno sopra 30k.
- **C-G3 — Parità di "energia" del momento wow.** Exivezzz oggi è il più pirotecnico, Nagato il più sobrio. Decisione registica: **abbassare di un filo Exivezzz** (lo squash 1.25 → 1.18; il flash additive opacità di picco ridotta; lo spruzzo da 14 a ~10 tetraedri) e **alzare di un filo Bastogne** (le scintille teal 6-8 → 8-10, glow leggermente più ampio). Nagato resta volutamente il più calmo (è il predatore) ma il suo wow deve avere **un singolo accento forte** (il lampo ciano della maschera al momento della schivata) ben leggibile. Obiettivo: i 3 wow hanno **intensità comparabile**, nessuno mette in ombra gli altri.
- **C-G4 — Ogni scena ha copper E cyan/teal** (vedi 0.3). Exivezzz ok (canotta copper + lenti cyan). Nagato ok (copper su muta/pinne + cyan pesce-dev). Bastogne **manca copper** → vedi C-B7.
- **C-G5 — Allineare le teste** a raggio 0.48–0.52 e **flatShading OFF sul volto** per tutti (vedi 1.1/1.2). Questa è la correzione di coesione n°1.
- **C-G6 — Occhi e capelli col metodo unico** della Parte 1 (1.3/1.4) anche dove la spec originale divergeva.
- **C-G7 — Parallasse spenta su touch** con la stessa guard per tutti. Uniformare a `if (!matchMedia('(pointer: coarse)').matches)` (la spec Bastogne aggiunge `&& !('ontouchstart' in window)` — ridondante ma innocuo; tenere solo per Bastogne se già scritto, o uniformare al solo pointer-coarse: preferire **solo pointer-coarse** per coerenza con l'hero esistente).
- **C-G8 — Seed deterministico** per ogni elemento "sparso" (ciocche, rocce, granelli, posizioni pesci/bolle/scintille). Mai `Math.random()` chiamato nel loop o in modo da cambiare tra frame. Generare una volta in init con un PRNG seedato o array di fasi costanti (vedi R-4).

### Correzioni Diorama 1 — EXIVEZZZ
- **C-E1** — Testa: `0.42 → 0.48`, **flatShading OFF** sul volto (resta ON su torso/arti/gambe). Allinea al cast.
- **C-E2** — Capelli: NON mezza-sfera liscia; usare **calotta emisferica + 3-4 coni corti** `#3a2c22` (metodo unico 1.4).
- **C-E3** — Occhi: **costruire la geometria canonica** (sferetta bianca + iride) **sotto** le lenti, anche se quasi invisibile, per coerenza e robustezza ai movimenti camera (1.3).
- **C-E4** — Gambe: lunghezza esagerata OK (è il tratto), ma **raggio coscia ≤ 0.18, stinco ≤ 0.14** (no gambe grosse, solo lunghe). L'altezza si "spende" in lunghezza, non in volume.
- **C-E5** — Momento wow: ridurre il pirotecnico per parità col cast (C-G3): squash 1.25→1.18, spruzzo 14→~10 tetraedri, flash di picco più contenuto. La sequenza e i tempi restano.
- **C-E6** — La "bocca a O" e la bocca articolata **solo sul pesce-pallone** (prop), **mai** sul volto del coach. Già così nella spec; ribadito per sicurezza.
- **C-E7** — Le palme opzionali: tenerle **come silhouette in fog** solo se il budget draw-call non sfora; altrimenti ometterle (la spec già lo dice). Non sono load-bearing per il riconoscimento.

### Correzioni Diorama 2 — NAGATO
- **C-N1** — Testa/viso: la porzione viso `SphereGeometry(0.32)` che spunta dal cappuccio è ok, ma assicurare **flatShading OFF** su quella porzione viso (liscia) mentre il cappuccio neoprene resta flat. La testa-cappuccio raggio 0.48 è già in standard → tiene.
- **C-N2** — Occhi: 2 sferette dietro vetro = **metodo canonico** (1.3), iride scura. Confermato, solo formalizzare il raggio 0.06/0.03.
- **C-N3** — È il personaggio **più sobrio**: va bene, ma per non sembrare "meno curato" del cast, garantire la **parità di dettaglio** (16-18k, già ok) e che il suo **momento wow abbia un accento forte e leggibile** (il lampo ciano maschera alla schivata) — C-G3.
- **C-N4** — Doppio easter egg (pesce-dev cyan + monolite circuito): mantenere **discreti**. Il pesce-dev cyan è anche il "tocco cyan" obbligatorio della scena (C-G4) → ok. Non aggiungere scritte/loghi leggibili (resta criptico).
- **C-N5** — `alpha:false` confermato corretto (sfondo opaco). Non uniformare a `true`.
- **C-N6** — Background come **mesh plane fuori dal fog** (`fog:false`), NON `scene.background`. Confermato dalla spec; ribadito perché diverge dall'hero (che non ha fog) ed è la scelta giusta qui.

### Correzioni Diorama 3 — BASTOGNE
- **C-B1** — Testa: `0.55 → 0.52` (limite alto del range, per allineare al cast senza stravolgere). flatShading OFF già previsto → ok.
- **C-B2** — Dettaglio totale: salire da ~8-9k a **~12-15k tris** (C-G2): più segmenti su carte (W/H più fitti), 12→14-16 carte nell'orbita se il budget regge, pulviscolo del cono più ricco. Evitare che sembri il "fratello povero".
- **C-B3** — VINCOLO CRITICO ribadito: **niente faccia da clown, niente trucco bianco/rosso, niente ghigno**. Pelle normale, occhi azzurri, mezzo sorriso. L'aggancio Joker è SOLO abito viola + gilet verde + atmosfera + carte. Questo è il punto più sbagliabile dell'intero set → è anche un rischio (R-5).
- **C-B4** — Capelli: metodo calotta+coni (è il riferimento dello standard 1.4) → tiene. Seed FISSO (C-G8/R-4).
- **C-B5** — `SpotLight` vero senza shadow map: ok. Attenzione: lo SpotLight è **costoso quanto una luce in più** ma accettabile (1 sola). Non aggiungerne altri "veri" oltre a questo + le point/dir già previste. Tetto luci per scena: **max 5-6 luci** (vedi R-2).
- **C-B6** — Il personaggio non deve "ballare": ampiezze idle piccole (già nella spec). Elegante, non comico. Coerente col tono "ironico ma competente".
- **C-B7 — Aggiungere un tocco COPPER** alla scena (C-G4). Opzioni a basso impatto, sceglierne una: il **bordo ribalta oro** del palco vira leggermente verso copper, OPPURE i bottoni del gilet/fibbie copper invece di puro oro, OPPURE il nastro del cilindro. NON toccare il teal (resta l'accento focale dell'asso) né il verde gilet (è il pop Joker). Serve solo un richiamo minimo al copper brand per legare Bastogne alle altre due scene.
- **C-B8** — Fumo a `Sprite` con `NormalBlending` (non additive): confermato corretto (il fumo diffonde, non illumina). Diverge da god-rays/scintille che sono additive: giusto così.

---

## PARTE 3 — RISCHI DI IMPLEMENTAZIONE

- **R-1 — Leggibilità a 360px (rischio n°1).** Tre scene ricche viste a ~360px di larghezza su mobile possono diventare poltiglia. Mitigazione: ogni diorama va validato con un **test silhouette** (soggetto in nero pieno su sfondo piatto deve restare riconoscibile) e con un **render mobile reale**, non solo desktop rimpicciolito. Su mobile ridurre conteggi (pesci, fumo, god-rays, pulviscolo) come già previsto, e verificare che camera/lookAt mobile (già diversi nelle spec) tengano il soggetto + il prop-chiave dentro frame senza tagli.

- **R-2 — Costo luci × 3 scene sulla stessa pagina.** Anche se le scene sono pausate fuori viewport, lo scroll può tenerne **due visibili insieme** (fine pannello A + inizio pannello B). Con 5-6 `MeshStandardMaterial`-light ciascuna, due scene attive = 10-12 luci dinamiche simultanee → calo fps su GPU integrate. Mitigazione: **IntersectionObserver con soglia generosa** ma soprattutto verificare il caso "due canvas attivi"; considerare un coordinatore che mette in pausa la scena meno visibile. Tetto: **max 5-6 luci/scena**, niente shadow map (già imposto).

- **R-3 — Più contesti WebGL sulla stessa pagina.** Tre `WebGLRenderer` = tre contesti GL. I browser limitano i contesti attivi (tipicamente ~8-16); con hero-3d in cima la pagina /chi-siamo potrebbe averne 4. Generalmente ok, ma su mobile datati si rischia "context lost". Mitigazione: dispose rigoroso (già previsto, `forceContextLoss`), e valutare di **non istanziare il renderer finché il pannello non è mai stato vicino al viewport** (lazy init oltre il lazy import). Gestire l'evento `webglcontextlost` per ri-mostrare il fallback CSS senza crash.

- **R-4 — Non-determinismo da `Math.random()`.** Ciocche capelli, rocce, granelli, fasi di pesci/bolle/scintille: se generati con random non seedato, ad ogni mount (es. rientro nel viewport, navigazione) il diorama cambia aspetto → rompe la sensazione "disegnato a mano, sempre uguale". Mitigazione: **seed fisso / array di fasi costanti**, generati una volta in init. Imposto come C-G8.

- **R-5 — Bastogne scivola nel Joker-clown.** È il rischio creativo più alto del set: chiunque implementi "vestito alla Joker" tende ad aggiungere trucco/ghigno. Va bloccato a monte. Mitigazione: review visiva dedicata su Bastogne, checklist negativa (no bianco volto, no rosso bocca esagerato, no sopracciglia malvagie, pelle `#e8c0a0` normale, occhi azzurri visibili). Il carattere passa SOLO da abito + carte + palco.

- **R-6 — Font canvas non ancora caricati.** Le texture canvas usano `Bricolage Grotesque`/`Spline Sans Mono` (cartello Exivezzz, "1/200", facce carte). Se la `CanvasTexture` è generata in init **prima** che i webfont siano pronti, il testo esce in font di fallback e resta "cotto" nella texture (le texture sono generate una volta sola). Mitigazione: attendere `document.fonts.ready` (o `document.fonts.load(...)` dei font specifici) **prima** di disegnare le texture testuali, oppure rigenerare quelle texture dopo il `fonts.ready`. Riguarda tutte e 3 le scene con testo.

- **R-7 — `flatShading` + `computeVertexNormals` ogni frame.** Il mare di Exivezzz e le alghe di Nagato fanno vertex animation con ricalcolo normali. Su flatShading il ricalcolo è più pesante. Già mitigato (mare ogni 2 frame). Estendere la stessa disciplina alle alghe Nagato e a qualsiasi altra animazione vertici: **ricalcolo normali a frame alterni**, o saltarlo del tutto dove l'errore di shading è impercettibile.

- **R-8 — `BufferGeometryUtils.mergeGeometries` e il trucco UV/multi-materiale.** Le spec consigliano merge per ridurre draw call, ma il merge richiede geometrie con gli **stessi gruppi-materiale** e attenzione alle UV (il trucco UV delle carte di Bastogne si basa su `repeat/offset` per-texture). Mergiare carte con texture diverse rompe l'UV. Mitigazione: mergiare **solo** mesh che condividono lo **stesso** materiale (muta navy del sub in una; accenti copper in un'altra; rocce in una; god-rays in una). Le carte con facce diverse restano `InstancedMesh` (dorsi) + mesh singole (assi). Non forzare merge dove c'è multi-materiale o UV custom.

- **R-9 — `ExtrudeGeometry` (pinne Nagato, falde giacca Bastogne, carte) può generare più tris del previsto** se la `Shape` ha molti punti/curve. Le stime budget assumono shape semplici. Mitigazione: `bevelEnabled:false` (già nell'hero), `curveSegments` basso, contare i tris reali in dev (`renderer.info`).

- **R-10 — Coerenza tonale del color grading.** Solo Exivezzz specifica ACES + exposure 1.05. Se Nagato e Bastogne non applicano lo stesso tone mapping, i tre pannelli avranno "resa" diversa (uno filmico, due flat) e la famiglia si spezza. Mitigazione: **applicare `ACESFilmicToneMapping` + `outputColorSpace = SRGBColorSpace` a tutte e 3 le scene** (exposure può variare leggermente: ~1.05 Exivezzz luminoso, ~1.0 Nagato, ~1.1 Bastogne scuro). Questa è anche una micro-correzione di coesione (aggiungere a C-G1).

- **R-11 — Accessibilità coerente.** Tutti e 3 i canvas sono `aria-hidden` decorativi: l'informazione (chi è il coach) deve stare **nel testo del pannello**, non solo nella scena (es. "MAIN COACH €200" su texture non è letto dagli screen reader). Verificare che ogni pannello abbia il nome/ruolo/descrizione del coach come **testo HTML reale** accanto al diorama. Riguarda l'integrazione in `features/about/`, non il componente 3D, ma va segnalato a chi assembla il pannello.

---

### Sintesi operativa per chi implementa
1. Clonare lo skeleton da `hero-3d.component.ts` (verificato) — identico per i 3, salvo `alpha` (false solo Nagato).
2. Applicare la **Parte 1** (teste 0.48–0.52, volto liscio, occhi e capelli col metodo unico, spessori arti standard) a TUTTI prima di seguire le 3 spec di dettaglio.
3. Applicare le **correzioni Parte 2** (in particolare C-G3 parità wow, C-G4/C-B7 copper+cyan ovunque, C-G5 teste, R-10→tone mapping su tutti).
4. Tenere d'occhio i **rischi Parte 2/3**: leggibilità 360px (R-1), luci/contesti multipli (R-2/R-3), determinismo (R-4), Joker-non-clown (R-5), font canvas (R-6).

Le 3 spec originali restano la fonte autorevole per ogni dettaglio non toccato qui: queste correzioni **non le riscrivono**, le mettono in famiglia.

(Plan file salvato in `C:\Users\Pietro Piraino\.claude\plans\glowing-meandering-rain-agent-ac6ee8d1a25d1a9f3.md`; il contenuto completo è questa risposta.)


---

# STYLE GUIDE V2 — "MORBIDO" (2026-06-06, feedback utente)

> Il proprietario ha bocciato il linguaggio low-poly a faccette dei PERSONAGGI: "spigolosi e poco realistici".
> Decisione: personaggi **stilizzati ma morbidi** (animazione 3D moderna, niente faccette), proporzioni toy INVARIATE (non lo disturbano), AMBIENTI invariati (il low-poly su sabbia/rocce/carte va bene). Questa sezione PREVALE sulla Parte 1 della Direzione Artistica per tutto ciò che riguarda i personaggi.

## V2.1 — Superfici lisce (il fix principale)
- `flatShading: false` su OGNI mesh del personaggio (corpo, vestiti, capelli, props indossati). Le normali liscie sono il punto: niente faccette visibili.
- Segmentazioni minime: SphereGeometry ≥ 24×18; CapsuleGeometry ≥ (capSegments 8, radialSegments 24); LatheGeometry ≥ 24 segmenti; TubeGeometry ≥ (tubularSegments 16, radialSegments 8); ConeGeometry sui personaggi: VIETATA a 4 lati (se serve un cono: ≥ 16 lati).
- Roughness corpo/abiti 0.55–0.7, metalness 0 (salvo metalli veri). Le micro-variazioni di colore tra capi sostituiscono il dettaglio a faccette.

## V2.2 — Costruzione corpi morbidi
- **Torso**: LatheGeometry con profilo curvo (spalle → vita → bacino, campionato su curva morbida ~12 punti) al posto di capsule/box. Spalle raccordate con sfere lisce che SI FONDONO nella silhouette.
- **Arti**: helper `makeTaperedLimb` (lathe rastremato r_spalla→r_polso con leggera pancia muscolare). Braccio = 2 segmenti (omero + avambraccio) con SFERA-GOMITO che raccorda; idem gambe con ginocchio. MAI un arto dritto a capsula singola.
- **Mani**: sfera scalata a "guanto" + pollice accennato (piccola capsula liscia). **Piedi**: forme arrotondate (sfera scalata/box con scale smussante), niente parallelepipedi netti.
- **Giunti**: ogni raccordo spalla/gomito/ginocchio/anca ha una sfera liscia di blending leggermente più grande del segmento, così la silhouette non "spezza".

## V2.3 — Visi rifiniti (secondo fix richiesto)
- **Occhi**: helper `makeRefinedEye` — bianco ≥24 seg + iride colorata + PUPILLA + riflessino emissivo in alto a sinistra + palpebra superiore color pelle (spicchio di sfera) che dà espressione. Niente più sferette nude.
- **Sopracciglia**: `makeBrow` — tubo su curva bezier, arco morbido, MAI box squadrati.
- **Naso**: piccola sfera/goccia liscia raccordata, MAI coni a 4 lati.
- **Bocca**: `makeSmile` — tubo su curva bezier (sorriso asimmetrico = carattere). Ogni coach ha un'espressione SUA:
  - Exivezzz: sorriso ampio e sicuro sotto gli occhiali a specchio (che restano), sopracciglia sopra la montatura.
  - Nagato: occhi rifiniti calmi dietro il vetro maschera, sopracciglia rilassate; la maschera resta protagonista.
  - Bastogne: mezzo sorriso furbo asimmetrico, palpebre leggermente abbassate (sguardo da showman), sopracciglia rame espressive MA non malvagie. SEMPRE niente trucco.
- **Orecchie**: due semisfere piccole dove visibili (Exivezzz, Bastogne).

## V2.4 — Capelli morbidi
- Le ciocche-CONO della v1 sono VIETATE (erano la principale fonte di spigoli). Helper `makeHairLock`: TubeGeometry su CubicBezier (scalpo → fuori → giù col droop) + sferetta liscia sulla punta. Calotta liscia (flatShading OFF).
- Bastogne: 10–14 lock medio-lunghe che drappeggiano con sag naturale + 2-3 lock frontali corte; ondeggio idle sulle lock (rotazioni piccole sfalsate).
- Exivezzz: calotta corta + 4-6 lock cortissime spettinate in avanti (taglio sportivo morbido).

## V2.5 — Pose naturali (terzo fix richiesto)
- VIETATA la simmetria perfetta: sempre contrapposto (peso su una gamba, bacino ruotato 3–6°, spalle controruotate), testa con tilt/yaw leggeri.
- Gomiti e ginocchia SEMPRE leggermente flessi (≥0.15 rad) anche in idle: arti dritti = manichino.
- Exivezzz: posa da schiacciata atletica — schiena leggermente inarcata, gamba di carico flessa, braccio alto con gomito morbido, sguardo (e mento) verso il pesce.
- Nagato: planata viva — leggera ondulazione a S del corpo (fase sfalsata torso→gambe→pinne nel tick), braccio armato rilassato ma mirato.
- Bastogne: showman — anca fuori asse, una gamba avanti rilassata, testa inclinata ~0.1 rad verso la carta, polso che ruota nel twirl.

## V2.6 — Animazioni fluide
- Mai un solo `sin` secco e simmetrico sul personaggio: combinare 2 armoniche (es. `sin(t·w) + 0.3·sin(t·2.3w + φ)`) e SFALSARE le fasi tra parti del corpo (la testa segue il torso con ~0.15s di ritardo percepito, i capelli seguono la testa).
- Easing sulle sequenze wow: easeInOut sulle transizioni di posa (niente scatti lineari salvo lo scocco/contatto che DEVE essere rapido).
- Follow-through: dopo il momento wow, piccolo overshoot smorzato su torso/capelli.

## V2.7 — Cosa NON cambia
- Ambienti, props di scena, particelle, luci, palette, camera, momenti wow (le coreografie restano; cambia la QUALITÀ del movimento).
- Proporzioni toy (~4.6 teste, Exivezzz ~5.5 con gambe lunghe), nomi-ancora dei test, determinismo, res.track, tetto luci, budget (i personaggi morbidi costeranno più tris: ok fino a 35-40k/scena, restiamo fluidi).


---

# RIG V3 — PERSONAGGI & ANIMAZIONE (2026-06-06, riavvio con skill threejs-animation)

> Il restyling V2 è stato interrotto a metà: i personaggi nei file sono RESIDUI INCOERENTI da sostituire integralmente.
> Questa sezione definisce COME si ricostruiscono personaggi e animazione, da zero, usando il sistema di animazione di three.js (riferimento: la skill in C:\Users\Pietro Piraino\.claude\skills\threejs-animation\SKILL.md). Le regole estetiche dello STYLE GUIDE V2 (superfici lisce, visi rifiniti, niente faccette/coni a 4 lati, proporzioni toy) restano valide e si sommano a queste. Gli AMBIENTI nei file sono approvati e NON si toccano.

## R3.1 — Rig: gerarchia di pivot nominati ("ossa" Object3D)
- Ogni personaggio è un albero di Object3D-pivot VUOTI con nomi UNIVOCI prefissati per scena (le KeyframeTrack risolvono per nome nodo):
  `<p>-root → <p>-hips → <p>-spine → <p>-chest → <p>-neck → <p>-head`; braccia `<p>-shoulder-l/r → <p>-elbow-l/r → <p>-wrist-l/r`; gambe `<p>-hip-l/r → <p>-knee-l/r → <p>-ankle-l/r` (prefissi: ex, na, ba).
- Ogni pivot sta sul GIUNTO anatomico; le mesh (lathe/sfere lisce V2) si appendono ai pivot come figli e NON vengono mai animate direttamente: si animano SOLO i pivot.
- La POSA BASE si imposta sui pivot alla costruzione (contrapposto, gomiti/ginocchia flessi ≥0.15 rad, tilt testa) — le clip animano ATTORNO alla posa base.

## R3.2 — Animazione: AnimationMixer + clip per personaggio
- UN `AnimationMixer(characterRoot)` per scena. Nel tick: `const dt = Math.min(Math.max(t - lastT, 0), 0.066); lastT = t; mixer.update(dt);` — niente Clock (il contratto passa t), il clamp evita salti dopo le pause. Stessa sequenza di t ⇒ stesso risultato (i test di determinismo usano sequenze fisse).
- **Clip 'idle'** (LoopRepeat, 6–8s): QuaternionKeyframeTrack sui pivot principali (hips/spine/head/shoulder/elbow), 5–8 keyframe di POSE vere (peso che si sposta, testa che osserva, micro-aggiustamenti asimmetrici). I quaternioni interpolano in slerp: morbidezza gratis. Per i NumberKeyframeTrack/VectorKeyframeTrack usare `setInterpolation(THREE.InterpolateSmooth)`.
- **Clip 'breath' ADDITIVA** (LoopRepeat ~3.2s): micro-espansione del chest + alzata spalle; convertita con `THREE.AnimationUtils.makeClipAdditive(clip)` e suonata con `blendMode` additivo SOPRA l'idle (pattern della skill) — il respiro non lotta mai con l'idle.
- **Clip 'wow'** (LoopOnce + `clampWhenFinished`): la coreografia del momento wow (schiacciata / battuta di caccia / reveal) AUTORALE a keyframe, con anticipazione → azione rapida → follow-through (timing teatrale nei keyframe, non easing a mano). Trigger deterministico nel tick: quando `Math.floor(t / PERIODO)` cambia → `wowAction.reset().fadeIn(0.15).play()` e `idleAction` riprende con `crossFadeTo` al termine (listener 'finished' del mixer, o crossfade programmato sui keyframe finali).
- Le parti NON umane già animate dagli ambienti (pesci, bolle, carte orbitanti, mare…) restano col loro codice attuale.

## R3.3 — Moto secondario: fisica leggera
- Classe `Spring` (stiffness/damping, dalla skill) per: ciocche dei capelli (target = rotazione corrente della testa), falde/coda della giacca di Bastogne, cinghie/erogatore di Nagato. Update con lo stesso dt del mixer. Risultato: follow-through e overshoot FISICI al posto dei sin sfasati.
- Parallasse camera: `smoothDamp` (skill) verso il target del pointer — niente lerp secco.

## R3.4 — Vestiti che vestono (errore del V2 interrotto da NON ripetere)
- I capi sono superfici che SEGUONO il corpo: canotta/muta/giacca = lathe sullo STESSO profilo del torso, scalato +4–8%, attaccato agli stessi pivot. MAI pezzi galleggianti, MAI pelle scoperta non intenzionale tra i capi, MAI "bikini effect": la canotta di Exivezzz copre il torso fino ai pantaloncini.
- Le maniche vivono sui pivot del braccio (seguono l'animazione), i colli/cappucci si raccordano alla testa.

## R3.5 — Vincoli di sistema (invariati)
- Determinismo totale (clip = dati fissi; seed fissi per tutto lo sparso); `ctx.res.track` su OGNI geometry/material/texture nuova; nomi-ancora dei test preservati (exivezzz/base-sabbia/cartello · sub/arbalete/fish-school/fish-dev · bastogne/card-ring/hand-card); max 6 luci; niente shadow map; nessuna allocazione nel tick (gli oggetti temporanei vivono nel closure); budget ≤ 40k tris/scena; ambienti/camera/palette/targhette invariati.


---

# CONCEPT V4 — IL BANCO PARTICELLARE (2026-06-07, pivot definitivo)

> Dopo tre iterazioni di personaggi 3D (procedurale low-poly → procedurale morbido → modelli GLTF Quaternius), il proprietario ha chiesto un cambio totale di rotta. Scelta finale: **niente figure** — i coach sono nickname pseudonimi, gli avatar non c'entravano.

**Concept**: un unico organismo — il banco di Best Fish Forever — fatto di ~9.000 particelle-pesce (micro-ellissi orientate lungo la velocità, THREE.Points + ShaderMaterial, 1 draw call) che vive DIETRO tutta la pagina su canvas fixed. Nuota come nastro sinuoso tra le sezioni, scappa dal cursore, e si riforma nell'EMBLEMA del coach quando il suo pannello è al centro: ♠ Exivezzz · arbalete Nagato · cappello da jolly Bastogne · ♣ sulla CTA.

**Tecnica**: camera ortografica mappata 1:1 sui pixel CSS (le ancore `[data-emblem]` si misurano con getBoundingClientRect); emblemi campionati da sagome canvas (`emblem-shapes.ts`, seedato); simulazione CPU arrive+wander+fuga con attivazione a plateau per stazione; palette theme-aware via token CSS (navy/copper su chiaro, ciano/oro su Notte) con MutationObserver su data-theme; fallback = pagina senza banco (reduced-motion / no WebGL). I diorami e i modelli GLTF sono archiviati FUORI dal repo in `C:\Projects\poker-ranges\attic-chi-siamo-dioramas\`.

**Aggiornamento 2026-06-07 (richiesta utente)**: emblemi = i QUATTRO SEMI (♠ Exivezzz · ♥ Nagato/founder · ♦ Bastogne · ♣ CTA, l'intera quaterna in ordine di pagina) e le PARTICELLE stesse sono micro-semi (atlante canvas 2×2 campionato nel fragment shader, `drawSuitAtlas`), con bicromia da carte: ♥♦ nel colore caldo del tema, ♠♣ nel colore base, distribuzione ~68% neri / 32% rossi; inclinazione dolce lungo la direzione di nuoto, raddrizzati in formazione.
