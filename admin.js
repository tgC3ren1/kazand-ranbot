/* Admin Panel JS */
const adminEmailEl = document.getElementById('adminEmail');
const adminRoleEl = document.getElementById('adminRole');
const adminError = document.getElementById('adminError');

const fromDateEl = document.getElementById('fromDate');
const toDateEl = document.getElementById('toDate');
const exportBtn = document.getElementById('exportBtn');
const exportCount = document.getElementById('exportCount');

const mName = document.getElementById('mName');
const mPrice = document.getElementById('mPrice');
const mStock = document.getElementById('mStock');
const mImage = document.getElementById('mImage');
const mActive = document.getElementById('mActive');
const addItemBtn = document.getElementById('addItemBtn');
const adminMarketList = document.getElementById('adminMarketList');

const targetUserId = document.getElementById('targetUserId');
const grantCount = document.getElementById('grantCount');
const grantBtn = document.getElementById('grantBtn');
const grantMsg = document.getElementById('grantMsg');

async function requireAdmin(){
  const { data: { user } } = await supa.auth.getUser();
  if(!user){ adminError.textContent = "Lütfen giriş yapın."; throw new Error("No session"); }
  adminEmailEl.textContent = user.email;
  const { data: prof } = await supa.from("profiles").select("is_admin").eq("id", user.id).single();
  if(!prof?.is_admin){ adminError.textContent = "Admin yetkisi yok."; throw new Error("Not admin"); }
  adminRoleEl.textContent = "Admin";
}

async function loadAdminMarket(){
  const { data } = await supa.from("market_items").select("*").order("id");
  adminMarketList.innerHTML = "";
  (data||[]).forEach(item=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>#${item.id} ${item.name}</h4>
      <p>Fiyat: ${item.price} | Stok: ${item.stock} | Aktif: ${item.active ? "Evet" : "Hayır"}</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button data-act="inc" data-id="${item.id}">Stok +1</button>
        <button data-act="dec" data-id="${item.id}">Stok -1</button>
        <button data-act="toggle" data-id="${item.id}">Aktif Aç/Kapa</button>
        <button data-act="del" data-id="${item.id}">Sil</button>
      </div>
    `;
    div.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", ()=>updateItem(btn.dataset.id, btn.dataset.act));
    });
    adminMarketList.appendChild(div);
  });
}

async function updateItem(id, action){
  if(action==="inc"){
    await supa.rpc("admin_update_item", { p_id: id, p_delta_stock: 1, p_toggle: false, p_delete: false });
  }else if(action==="dec"){
    await supa.rpc("admin_update_item", { p_id: id, p_delta_stock: -1, p_toggle: false, p_delete: false });
  }else if(action==="toggle"){
    await supa.rpc("admin_update_item", { p_id: id, p_delta_stock: 0, p_toggle: true, p_delete: false });
  }else if(action==="del"){
    if(!confirm("Silinsin mi?")) return;
    await supa.rpc("admin_update_item", { p_id: id, p_delta_stock: 0, p_toggle: false, p_delete: true });
  }
  await loadAdminMarket();
}

addItemBtn.addEventListener("click", async ()=>{
  await supa.from("market_items").insert({
    name: mName.value.trim(),
    price: Number(mPrice.value || 0),
    stock: Number(mStock.value || 0),
    image_url: mImage.value.trim() || null,
    active: !!mActive.checked
  });
  mName.value = mPrice.value = mStock.value = mImage.value = "";
  mActive.checked = true;
  await loadAdminMarket();
});

exportBtn.addEventListener("click", async ()=>{
  const from = fromDateEl.value;
  const to = toDateEl.value;
  if(!from || !to){ alert("Tarih aralığı seçiniz."); return; }
  const { data, error } = await supa.rpc("admin_export_contacts", { p_from: from, p_to: to });
  if(error){ alert(error.message); return; }
  const rows = data || [];
  exportCount.textContent = rows.length + " kayıt bulundu.";
  const csv = ["username,gsm,email,created_at"].concat(rows.map(r=>[r.username, r.gsm, r.email, r.created_at].join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

grantBtn.addEventListener("click", async ()=>{
  const count = Number(grantCount.value || 1);
  const userId = (targetUserId.value || "").trim() || null;
  const sess = await supa.auth.getSession();
  const { data, error } = await supa.functions.invoke("grant_spins", {
    method: "POST",
    headers: { Authorization: `Bearer ${sess.data.session?.access_token}` },
    body: { count, userId }
  });
  if(error || data?.error){
    grantMsg.textContent = data?.error || error.message;
  }else{
    grantMsg.textContent = data.message || "Tanımlandı.";
  }
});

(async function init(){
  try{
    await requireAdmin();
    await loadAdminMarket();
  }catch(e){
    console.error(e);
  }
})();
