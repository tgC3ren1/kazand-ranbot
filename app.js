/* ========= Config ========= */
const DEFAULT_DAILY_ENERGY = 3;
const WHEEL_SEGMENTS = [
  { label: "PAS",   points: 0  },
  { label: "+10",   points: 10 },
  { label: "+20",   points: 20 },
  { label: "PAS",   points: 0  },
  { label: "+50",   points: 50 },
  { label: "+100",  points: 100 },
  { label: "PAS",   points: 0  },
  { label: "+5",    points: 5  },
];

/* ========= UI refs ========= */
const openRegister  = document.getElementById('openRegister');
const openLogin     = document.getElementById('openLogin');
const registerModal = document.getElementById('registerModal');
const loginModal    = document.getElementById('loginModal');

const logoutBtn      = document.getElementById('logoutBtn');
const usernameLabel  = document.getElementById('usernameLabel');

const todayStatusEl  = document.getElementById('todayStatus');
const myPointsEl     = document.getElementById('myPoints');
const energyValEl    = document.getElementById('energyVal');
const lbEl           = document.getElementById('leaderboardList');
const marketEl       = document.getElementById('marketList');

const regUsernameEl  = document.getElementById('regUsername');
const regGsmEl       = document.getElementById('regGsm');
const regEmailEl     = document.getElementById('regEmail');
const regPasswordEl  = document.getElementById('regPassword');
const registerBtn    = document.getElementById('registerBtn');
const registerError  = document.getElementById('registerError');

const loginEmailEl   = document.getElementById('loginEmail');
const loginPasswordEl= document.getElementById('loginPassword');
const loginBtn2      = document.getElementById('loginBtn');
const loginError     = document.getElementById('loginError');

const spinBtn        = document.getElementById('spinBtn');
const spinResultEl   = document.getElementById('spinResult');

/* ========= Canvas (Wheel) ========= */
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

/* HD ölçek: retina ekranlarda keskin görünsün */
const BASE = 380;                         // CSS boyutu
const dpr  = window.devicePixelRatio || 1;
canvas.width  = BASE * dpr;
canvas.height = BASE * dpr;
canvas.style.width  = BASE + "px";
canvas.style.height = BASE + "px";
ctx.scale(dpr, dpr);

/* Geometri: merkez ve yarıçaplar */
const center = { x: BASE/2, y: BASE/2 };
const R_OUT = 170;   // dış çerçeve yarıçapı
const R_SEG = 156;   // dilim yarıçapı
let wheelAngle = 0;

/* Zengin renk paleti */
const colors = [
  "#4f7cff","#7aa2ff","#3b5bd6","#263fa3",
  "#34b3a0","#5ad1bf","#228a7b","#17635a"
];

/* Ses (isteğe bağlı): kısa “tick” dosyası koyarsan çalar */
let tickSound = null;
try {
  tickSound = new Audio("./tick.mp3"); // ~100ms kısa ses önerilir
  tickSound.volume = 0.5;
} catch (_) { /* sessiz mod */ }

function playTick() {
  if (!tickSound) return;
  try { tickSound.currentTime = 0; tickSound.play(); } catch (_) {}
}

/* ========= Çizim ========= */
function drawWheel(angle = 0) {
  const n = WHEEL_SEGMENTS.length;
  const step = (Math.PI*2)/n;
  ctx.clearRect(0,0,BASE,BASE);

  // dış çerçeve (altın)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;

  ctx.beginPath();
  ctx.arc(center.x, center.y, R_OUT, 0, Math.PI*2);
  ctx.fillStyle = "#0c1222";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#ffd54d";
  ctx.stroke();
  ctx.restore();

  // dilimler
  for (let i=0;i<n;i++){
    const start = i*step + angle;
    const end   = start + step;

    const grad = ctx.createLinearGradient(
      center.x + Math.cos(start)*R_SEG,
      center.y + Math.sin(start)*R_SEG,
      center.x + Math.cos(end)*R_SEG,
      center.y + Math.sin(end)*R_SEG
    );
    grad.addColorStop(0, colors[i % colors.length]);
    grad.addColorStop(1, "#0b1330");

    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, R_SEG, start, end);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // label
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(start + step/2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 6;
    ctx.fillText(WHEEL_SEGMENTS[i].label, R_SEG - 10, 6);
    ctx.restore();
  }

  // merkez kapak
  ctx.beginPath();
  ctx.arc(center.x, center.y, 46, 0, Math.PI*2);
  const cap = ctx.createRadialGradient(center.x, center.y, 6, center.x, center.y, 46);
  cap.addColorStop(0, "#fff");
  cap.addColorStop(1, "#c7d1ff");
  ctx.fillStyle = cap; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = "#7aa2ff"; ctx.stroke();

  /* ===== Sabit iğne (pointer) – görünür garantisi ===== */
  const tipY  = center.y - (R_OUT - 2);    // ucu çerçevenin hemen içi
  const baseY = center.y - (R_OUT - 24);   // taban üçgeni için

  ctx.beginPath();
  ctx.moveTo(center.x, tipY);
  ctx.lineTo(center.x - 16, baseY);
  ctx.lineTo(center.x + 16, baseY);
  ctx.closePath();
  ctx.fillStyle = "#ff5959";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  // iğne pimi
  ctx.beginPath();
  ctx.arc(center.x, baseY + 2, 7, 0, Math.PI*2);
  ctx.fillStyle = "#ffe082";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

/* Yavaşlayarak durma + segment geçişinde “tick” */
async function animateToSegment(index) {
  const n = WHEEL_SEGMENTS.length;
  const step = (Math.PI*2)/n;

  // hedef açı (pointer üstte, -90° ekseni)
  const targetAngle = (Math.PI/2) - (index*step + step/2);

  const rotations = Math.PI*2 * 5.5; // 5.5 tur
  const startAngle = wheelAngle;
  const endAngle   = targetAngle + rotations;
  const duration   = 4200;

  let startTime;
  let lastTick = -1;

  return new Promise((resolve)=>{
    function raf(ts){
      if(!startTime) startTime = ts;
      const t = Math.min(1, (ts-startTime)/duration);
      const eased = easeOutCubic(t);
      wheelAngle = startAngle + (endAngle-startAngle)*eased;

      // tick: pointer altından geçen aktif dilim
      const current = ( ( (Math.PI*2) - (wheelAngle % (Math.PI*2)) + Math.PI/2 ) / step ) % n;
      const idx = Math.floor(current);
      if (idx !== lastTick) { playTick(); lastTick = idx; }

      drawWheel(wheelAngle);
      if(t < 1) requestAnimationFrame(raf);
      else resolve();
    }
    requestAnimationFrame(raf);
  });
}

/* ========= Helpers ========= */
function isValidE164(phone){
  return /^\+?[1-9]\d{9,14}$/.test(phone);
}
function isLikelyEmail(s){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* ========= Auth & Data ========= */
async function bootstrap() {
  drawWheel(0);
  const { data: { user } } = await supa.auth.getUser();

  if(user){
    openLogin.classList.add("hidden");
    openRegister.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    await ensureProfile(user);
    await refreshProfileUI();
    await loadLeaderboard();
    await loadMarket();
  }else{
    openLogin.classList.remove("hidden");
    openRegister.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    usernameLabel.textContent = "-";
    myPointsEl.textContent = "0";
    todayStatusEl.textContent = "-";
    energyValEl.textContent = "0";
    lbEl.innerHTML = "";
    marketEl.innerHTML = "";
  }
}

async function ensureProfile(user){
  const { data: existing } = await supa
    .from("profiles").select("id").eq("id", user.id).maybeSingle();

  if(!existing){
    await supa.from("profiles").insert({
      id: user.id,
      username: "user_"+user.id.slice(0,6),
      email: user.email,
      gsm: null
    });
  }
}

async function refreshProfileUI(){
  const { data: { user } } = await supa.auth.getUser();
  if(!user) return;

  const { data: prof } = await supa
    .from("profiles").select("username, points").eq("id", user.id).single();

  usernameLabel.textContent = prof?.username || "-";
  myPointsEl.textContent = prof?.points ?? 0;

  const today = new Date().toISOString().slice(0,10);
  let { data: daily } = await supa
    .from("spins_daily").select("*")
    .eq("user_id", user.id).eq("d", today).maybeSingle();

  if(!daily){
    await supa.from("spins_daily").insert({
      user_id: user.id, d: today, remaining_energy: DEFAULT_DAILY_ENERGY
    });
    const { data: d2 } = await supa
      .from("spins_daily").select("*")
      .eq("user_id", user.id).eq("d", today).maybeSingle();
    daily = d2;
  }

  const rem = daily?.remaining_energy ?? 0;
  energyValEl.textContent = rem;
  todayStatusEl.textContent = rem > 0 ? "Hazır" : "Enerji bitti";
  spinBtn.disabled = rem <= 0;
}

async function loadLeaderboard(){
  const { data } = await supa
    .from("profiles").select("username, points")
    .order("points", { ascending: false }).limit(10);

  lbEl.innerHTML = "";
  (data||[]).forEach((r)=>{
    const li = document.createElement("li");
    li.textContent = `${r.username} — ${r.points} puan`;
    lbEl.appendChild(li);
  });
}

async function loadMarket(){
  const { data } = await supa
    .from("market_items").select("*")
    .eq("active", true).order("id");

  marketEl.innerHTML = "";
  (data||[]).forEach(item=>{
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <h4>${item.name}</h4>
      <p>Fiyat: <strong>${item.price}</strong> puan</p>
      <p>Stok: ${item.stock}</p>
      <button ${item.stock<=0 ? "disabled": ""} data-id="${item.id}">Satın Al</button>
    `;
    div.querySelector("button")
      .addEventListener("click", ()=>purchaseItem(item.id));
    marketEl.appendChild(div);
  });
}

async function purchaseItem(itemId){
  const { data: { session } } = await supa.auth.getSession();
  if(!session){ loginModal.showModal(); return; }

  try{
    const { data, error } = await supa.functions.invoke("purchase", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { itemId, quantity: 1 }
    });
    if(error || data?.error) throw new Error(data?.error || error.message);
    alert("Satın alma başarılı!");
    await refreshProfileUI();
    await loadMarket();
  }catch(err){
    alert("Hata: " + (err?.message || "Satın alma başarısız"));
  }
}

/* ========= Spin handler ========= */
async function handleSpin(){
  const { data: { session } } = await supa.auth.getSession();
  if(!session){ loginModal.showModal(); return; }

  spinBtn.disabled = true;
  spinResultEl.textContent = "Dönüyor...";

  try{
    const { data, error } = await supa.functions.invoke("spin", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { wheel: WHEEL_SEGMENTS.map(s => ({ label: s.label, points: s.points })) }
    });

    if(error || data?.error){
      throw new Error(data?.error || error.message || "Edge Function hatası");
    }

    const { segmentIndex, label, points, remainingEnergy, totalPoints } = data;
    await animateToSegment(segmentIndex);
    spinResultEl.textContent = label === "PAS"
      ? "Pas geldi, puan yok."
      : `${points} puan kazandın!`;
    energyValEl.textContent = remainingEnergy;
    myPointsEl.textContent = totalPoints;
    todayStatusEl.textContent = remainingEnergy>0 ? "Hazır" : "Enerji bitti";
    await loadLeaderboard();
    spinBtn.disabled = remainingEnergy <= 0;

  }catch(err){
    console.error("spin error", err);
    spinResultEl.textContent = err?.message || "İstek gönderilemedi";
    spinBtn.disabled = false;
  }
}

/* ========= Events ========= */
openRegister?.addEventListener("click", ()=>registerModal.showModal());
openLogin?.addEventListener("click", ()=>loginModal.showModal());

registerBtn?.addEventListener("click", async (e)=>{
  e.preventDefault();
  registerError.textContent = "";
  const username = regUsernameEl.value.trim();
  const gsm = regGsmEl.value.trim();
  const email = regEmailEl.value.trim();
  const password = regPasswordEl.value;

  if(username.length<3){ registerError.textContent="Kullanıcı adı en az 3 karakter olmalı."; return; }
  if(!isValidE164(gsm)){ registerError.textContent="Geçerli E.164 GSM formatı giriniz: +90555..."; return; }
  if(!isLikelyEmail(email)){ registerError.textContent="Geçerli e-posta giriniz."; return; }

  const { data, error } = await supa.auth.signUp({ email, password });
  if(error){ registerError.textContent = error.message; return; }
  const user = data?.user;
  if(!user){ registerError.textContent="Kayıt oluşturulamadı."; return; }

  const { error: e2 } = await supa.from("profiles").upsert({
    id: user.id, username, gsm, email
  });
  if(e2){ registerError.textContent = e2.message; return; }

  registerModal.close();
  await bootstrap();
});

loginBtn2?.addEventListener("click", async (e)=>{
  e.preventDefault();
  loginError.textContent = "";
  const email = loginEmailEl.value.trim();
  const password = loginPasswordEl.value;

  const { error } = await supa.auth.signInWithPassword({ email, password });
  if(error){ loginError.textContent = error.message; return; }
  loginModal.close();
  await bootstrap();
});

logoutBtn?.addEventListener("click", async ()=>{
  await supa.auth.signOut();
  await bootstrap();
});

spinBtn?.addEventListener("click", handleSpin);

/* ========= Start ========= */
bootstrap();
