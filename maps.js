// attendre que tout le HTML soit chargé avant d'exécuter le JS
document.addEventListener("DOMContentLoaded", () => {

  // ---------- CONSTANTES ----------

  // limiter la carte à une zone autour de Metz (coins Sud-Ouest et Nord-Est)
  const METZ_BOUNDS = [[49.00, 6.05],[49.16, 6.35]];

  // zoom minimum autorisé
  const MIN_ZOOM = 12;

  // zoom maximum autorisé
  const MAX_ZOOM = 19;

  // clé utilisée dans localStorage pour stocker les plans enregistrés
  const PLANS_KEY = "emotion_maps_plans";

  // couleur par défaut de départ
  const DEFAULT_HEX = "#2F6B4A";

  // palette de couleurs disponibles (6 émotions)
  const PALETTE = ["#2F6B4A","#9be42c","#99bef5","#672fbd","#941d53","#490f1b"];

  // VARIABLES GLOBALES
  var raf = false;

  // ---------- MAP ----------

  // créer la carte Leaflet dans la div id="maps"
  const map = L.map("maps", {
    center: [49.1193, 6.1757],
    zoom: 14,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxBounds: METZ_BOUNDS,
    zoomControl: false
  });

  // charger la couche de tuiles OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:"© OpenStreetMap"
  }).addTo(map);


  // ---------- UI : BURGER + clic dehors ----------

  const burger = document.getElementById("burgerMaps");
  const sideMenu = document.getElementById("sideMenuMaps");

  burger.addEventListener("click", (e) => {
    e.stopPropagation();
    sideMenu.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!sideMenu.classList.contains("open")) return;
    if (sideMenu.contains(e.target) || burger.contains(e.target)) return;
    sideMenu.classList.remove("open");
  });


  // ---------- UI : ZOOM ----------

  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomRange = document.getElementById("zoomRange");

  zoomInBtn.addEventListener("click", () => map.zoomIn());
  zoomOutBtn.addEventListener("click", () => map.zoomOut());
  zoomRange.addEventListener("input", (e) => map.setZoom(Number(e.target.value)));
  map.on("zoomend", () => zoomRange.value = map.getZoom());


  // ---------- CANVAS ----------

  const canvas = document.getElementById("drawCanvas");
  const ctx = canvas.getContext("2d", { alpha:true });

  function resizeCanvas(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    redrawAll();
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function metersPerPixel(lat){
    const earth = 40075016.686;
    return earth * Math.cos(lat * Math.PI/180) / Math.pow(2, map.getZoom()+8);
  }

  function hexToRgba(hex, a){
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }


  // ---------- DESSIN (ancré à la map) ----------

  let strokes = [];
  let undoStack = [];
  let redoStack = [];

  let currentHex = DEFAULT_HEX;
  let currentColor = hexToRgba(currentHex, 0.65);

  // taille du pinceau en “mètres” (pas en pixels)
  let widthM = 22;

  // ---------- TAILLE DU TRAIT (stylo + gomme) ----------
  const sizeSlider = document.getElementById("brushSize");
  const sizeValue  = document.getElementById("brushSizeValue");

  if (sizeSlider){
    widthM = Number(sizeSlider.value) || widthM;
    if (sizeValue) sizeValue.textContent = String(widthM);

    sizeSlider.addEventListener("input", (e) => {
      widthM = Number(e.target.value);
      if (sizeValue) sizeValue.textContent = String(widthM);
    });
  }

  let mode = "draw";
  let toolMode = "brush";
  let isDrawing = false;
  let activeStroke = null;

  function pushUndo(){
    undoStack.push(JSON.stringify(strokes));
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  }

  function disableMapNav(){
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
  }

  function enableMapNav(){
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
  }

  function isUI(target){
    return !!target.closest(".bottom-bar, .right-rail, .burger-menu, .side-menu");
  }

  function drawStroke(s){
    if (!s.points || s.points.length === 0) return;

    const latRef = s.points[0].lat;
    const wPx = Math.max(1, s.widthM / metersPerPixel(latRef));
    const pts = s.points.map(p => map.latLngToContainerPoint([p.lat, p.lng]));

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = wPx;

    if (s.mode === "erase"){
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = s.color;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 1){
      ctx.lineTo(pts[0].x + 0.01, pts[0].y + 0.01);
    } else {
      for (let i=1; i<pts.length-1; i++){
        const midX = (pts[i].x + pts[i+1].x)/2;
        const midY = (pts[i].y + pts[i+1].y)/2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      const last = pts[pts.length-1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
  }

  function redrawAll(){
    if (raf) return;
    raf = true;

    requestAnimationFrame(() => {
      raf = false;

      ctx.clearRect(0,0,innerWidth,innerHeight);
      ctx.filter = "blur(0.35px)";

      for (const s of strokes) drawStroke(s);

      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
    });
  }

  map.on("move zoom", redrawAll);


  // ---------- OUTILS ----------

  const toolBrush = document.getElementById("toolBrush");
  const toolHand  = document.getElementById("toolHand");
  const toolEraser = document.getElementById("toolEraser");

  function setTool(t){
    toolMode = t;

    toolBrush.classList.toggle("active", t === "brush");
    toolHand.classList.toggle("active", t === "hand");
    toolEraser.classList.toggle("active", t === "eraser");

    if (t === "hand"){
      canvas.style.pointerEvents = "none";
      enableMapNav();
      return;
    }

    canvas.style.pointerEvents = "auto";
    mode = (t === "eraser") ? "erase" : "draw";
  }

  toolBrush.addEventListener("click", () => setTool("brush"));
  toolHand.addEventListener("click", () => setTool("hand"));
  toolEraser.addEventListener("click", () => setTool("eraser"));


  // ---------- COULEURS ----------

  const colorButtons = document.querySelectorAll("#colorSelector .c");

  function updateSmileys(){
    const happy = document.querySelector(".smiley.happy");
    const angry = document.querySelector(".smiley.angry");
    if (happy) happy.style.color = PALETTE[0];
    if (angry) angry.style.color = PALETTE[PALETTE.length-1];
  }

  function selectColor(hex){
    currentHex = hex;
    currentColor = hexToRgba(hex, 0.35);
    setTool("brush");
    colorButtons.forEach(b => b.classList.toggle("selected", b.dataset.color === hex));
  }

  colorButtons.forEach(btn => btn.addEventListener("click", () => selectColor(btn.dataset.color)));

  const defaultBtn = [...colorButtons].find(b => b.dataset.color === DEFAULT_HEX);
  if (defaultBtn) defaultBtn.classList.add("selected");

  updateSmileys();


  // ---------- COORDS SAFE (Leaflet officiel) ----------

  function getLatLngFromEvent(ev){
    const e = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    if (!e) return null;

    const rect = map.getContainer().getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return map.containerPointToLatLng([x, y]);
  }


  // ---------- DESSIN : handlers génériques ----------

  function startDraw(ev){
    if (toolMode === "hand") return;
    if (isUI(ev.target)) return;

    const ll = getLatLngFromEvent(ev);
    if (!ll) return;

    ev.preventDefault?.();

    isDrawing = true;
    pushUndo();
    disableMapNav();

    activeStroke = {
      mode,
      color: currentColor,
      widthM,
      points:[{lat: ll.lat, lng: ll.lng}]
    };

    strokes.push(activeStroke);
    redrawAll();
  }

  function moveDraw(ev){
    if (!isDrawing || !activeStroke) return;

    const ll = getLatLngFromEvent(ev);
    if (!ll) return;

    ev.preventDefault?.();

    const pts = activeStroke.points;
    const last = pts[pts.length-1];

    const dLat = ll.lat - last.lat;
    const dLng = ll.lng - last.lng;

    if ((dLat*dLat + dLng*dLng) < 0.000000002) return;

    pts.push({lat: ll.lat, lng: ll.lng});
    redrawAll();
  }

  function endDraw(){
    if (!isDrawing) return;
    isDrawing = false;
    activeStroke = null;

    if (toolMode !== "hand") enableMapNav();
    redrawAll();
  }


  // ---------- EVENTS : Pointer si possible, sinon Mouse/Touch ----------

  const supportsPointer = "PointerEvent" in window;

  if (supportsPointer){
    canvas.addEventListener("pointerdown", (e) => {
      startDraw(e);
      try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
    }, { passive:false });

    canvas.addEventListener("pointermove", moveDraw, { passive:false });
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);

  } else {
    canvas.addEventListener("mousedown", startDraw);
    window.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);

    canvas.addEventListener("touchstart", startDraw, { passive:false });
    canvas.addEventListener("touchmove", moveDraw, { passive:false });
    canvas.addEventListener("touchend", endDraw);
    canvas.addEventListener("touchcancel", endDraw);
  }


  // ---------- UNDO / REDO ----------

  const toolUndo = document.getElementById("toolUndo");
  const toolRedo = document.getElementById("toolRedo");

  toolUndo.addEventListener("click", () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(strokes));
    strokes = JSON.parse(undoStack.pop());
    redrawAll();
  });

  toolRedo.addEventListener("click", () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(strokes));
    strokes = JSON.parse(redoStack.pop());
    redrawAll();
  });


  // ---------- LOAD PLAN via ?plan=IDX ----------

  function getPlanIndexFromURL(){
    const p = new URLSearchParams(location.search);
    const v = p.get("plan");
    return v === null ? null : Number(v);
  }

  function loadPlanFromStorage(idx){
    const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");
    const plan = plans[idx];
    if (!plan) return;
    strokes = plan.strokes || [];
    if (plan.center && plan.zoom) map.setView([plan.center.lat, plan.center.lng], plan.zoom);
    redrawAll();
  }

  const planIdx = getPlanIndexFromURL();
  if (planIdx !== null && !Number.isNaN(planIdx)) loadPlanFromStorage(planIdx);


  // ---------- CAPTURE PREVIEW (LIGHT) + EXPORTS ----------

  // capture légère (preview) pour stockage : JPEG compressé + scale réduit
  async function capturePreviewNoUI(){

    const hideEls = [
      document.querySelector(".bottom-bar"),
      document.querySelector(".right-rail"),
      document.querySelector(".burger-menu"),
      document.querySelector(".side-menu")
    ];

    const prev = hideEls.map(el => el ? el.style.display : null);
    hideEls.forEach(el => el && (el.style.display = "none"));

    map.invalidateSize(true);

    const node = document.getElementById("captureArea");
    const shot = await html2canvas(node, {
      useCORS:true,
      allowTaint:true,
      logging:false,
      scale: 0.5
    });

    hideEls.forEach((el,i) => el && (el.style.display = prev[i] || ""));

    return shot.toDataURL("image/jpeg", 0.72);
  }

  // capture FULL (pour téléchargement) : PNG, sans UI
  async function capturePNGNoUI(){

    const hideEls = [
      document.querySelector(".bottom-bar"),
      document.querySelector(".right-rail"),
      document.querySelector(".burger-menu"),
      document.querySelector(".side-menu")
    ];

    const prev = hideEls.map(el => el ? el.style.display : null);
    hideEls.forEach(el => el && (el.style.display = "none"));

    map.invalidateSize(true);

    const node = document.getElementById("captureArea");
    const shot = await html2canvas(node, {
      useCORS:true,
      allowTaint:true,
      logging:false,
      scale: 1
    });

    hideEls.forEach((el,i) => el && (el.style.display = prev[i] || ""));

    return shot.toDataURL("image/png");
  }

  function nextFrame(){
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function captureDrawingOnlyPNG(){
    redrawAll();
    await nextFrame();
    return canvas.toDataURL("image/png");
  }

  function downloadDataURL(dataUrl, filename){
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }


  // ---------- TELECHARGER ----------

  document.getElementById("download").addEventListener("click", async () => {

    // 1) map + dessin (PNG)
    const pngMapAndDraw = await capturePNGNoUI();
    downloadDataURL(pngMapAndDraw, "maps_map_et_dessin.png");

    // 2) dessin seul (PNG transparent)
    const pngDrawOnly = await captureDrawingOnlyPNG();
    downloadDataURL(pngDrawOnly, "maps_dessin_seul_transparent.png");
  });


  // ---------- ENREGISTRER ----------

  document.getElementById("savePlan").addEventListener("click", async () => {

    const name = prompt("Date de création :");
    if (!name) return;

    const creator = prompt("Ton nom :") || "anonyme";

    // preview légère pour stockage (évite quota localStorage)
    const preview = await capturePreviewNoUI();

    const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");

    plans.push({
      name,
      creator,
      timestamp: Date.now(),
      img: preview,            // preview compressée
      center: map.getCenter(),
      zoom: map.getZoom(),
      strokes
    });

    try {
      localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    } catch (e) {
      alert("❌ Stockage plein : impossible d'enregistrer plus de plans.\n\nAstuce : supprime quelques plans dans Plans.");
      console.error(e);
      return;
    }

    alert("✅ Enregistré ! Va sur Plans.");
  });

  setTool("brush");

}); // fin DOMContentLoaded
