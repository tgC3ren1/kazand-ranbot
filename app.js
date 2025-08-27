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
const center = { x: canvas.width/2, y: canvas.height/2 };
let wheelAngle = 0;
const colors = ["#2d6cdf","#5b8cff","#8aa9ff","#2e3b6b"];

function drawWheel(angle = 0) {
  const n = WHEEL_SEGMENTS.length;
  const step = (Math.PI*2)/n;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  for (let i=0;i<n;i++){
    const start = i*step + angle;
    const end = start + step;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, 170, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(start + step/2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "16px system-ui";
    ctx.fillText(WHEEL_SEGMENTS[i].label, 150, 6);
    ctx.restore();
  }

  // pointer
  ctx.beginPath();
  ctx.moveTo(center.x, center.y-180);
  ctx.lineTo(center.x-10, center.y-200);
  ctx.lineTo(center.x+10, center.y-200);
  ctx.closePath();
  ctx.fillStyle = "#ffda6a";
  ctx.fill();
}

function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

async function animateToSegment(index) {
  const n = WHEEL_SEGMENTS.length;
  const step = (Math.PI*2)/n;
  const targetAngle = (Math.PI/2) - (index*step + step/2);
  const rotations = Math.PI*2*5;
  const startAngle = wheelAngle;
  const endAngle = targetAngle + rotations;
  const duration = 2600;
  let startTime;

  return new Promise((resolve)=>{
    function tick(ts){
      if(!startTime) startTime = ts;
      const t = Math.min(1, (ts-startTime)/duration);
      const eased = easeOutCubic(t);
      wheelAngle = startAngle + (endAngle-startAngle)*eased;
      drawWheel(wheelAngle);
      if(t<1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
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

/* ========= Spin handler (with JWT) ========= */
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

/* ========= Event handlers ========= */
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
