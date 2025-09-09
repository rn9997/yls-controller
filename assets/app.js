// Currency, cart, product loader
const RATES = { USD: 1, BHD: 0.376, EUR: 0.92, GBP: 0.78 };
const SYMBOL = { USD: '$', BHD: 'ب.د', EUR: '€', GBP: '£' };
const STORE = {
  getCurrency(){ return localStorage.getItem('ccy') || 'USD'; },
  setCurrency(c){ localStorage.setItem('ccy', c); document.dispatchEvent(new Event('currency:changed')); },
  getCart(){ return JSON.parse(localStorage.getItem('cart')||'{}'); },
  setCart(x){ localStorage.setItem('cart', JSON.stringify(x)); document.dispatchEvent(new Event('cart:changed')); },
  add(id, qty=1){ const c=this.getCart(); c[id]=(c[id]||0)+qty; this.setCart(c); },
  setQty(id, qty){ const c=this.getCart(); c[id]=Math.max(1, Number(qty)||1); this.setCart(c); },
  remove(id){ const c=this.getCart(); delete c[id]; this.setCart(c); },
  clear(){ this.setCart({}); },
};
function toMoney(ccy, usd){ const dp = ccy==='BHD'?3:2; return `${SYMBOL[ccy]}\u00A0${(usd*(RATES[ccy]||1)).toFixed(dp)}`; }
async function loadProducts(){ const r=await fetch('assets/products.json'); return r.json(); }

// Header helpers
async function bindHeader(){
  const ccySel = document.getElementById('ccy'); if(ccySel){ ccySel.value=STORE.getCurrency(); ccySel.onchange=e=>STORE.setCurrency(e.target.value); }
  renderMiniCart(); document.addEventListener('cart:changed', renderMiniCart); document.addEventListener('currency:changed', renderMiniCart);
}
async function renderMiniCart(){
  const el=document.getElementById('cartMini'); if(!el) return;
  const data=await loadProducts(); const cart=STORE.getCart(); const ccy=STORE.getCurrency();
  let n=0, usd=0; for(const [id,qty] of Object.entries(cart)){ const p=data.find(x=>x.id===id); if(!p) continue; n+=qty; usd+=p.priceUSD*qty; }
  el.textContent=`${n} • ${toMoney(ccy,usd)}`;
}

// Drawer helpers (if you use the drawer mini-cart)
function openDrawer(){ document.querySelector('.drawer')?.classList.add('open'); document.querySelector('.overlay')?.classList.add('show'); }
function closeDrawer(){ document.querySelector('.drawer')?.classList.remove('open'); document.querySelector('.overlay')?.classList.remove('show'); }

// Product gallery helper
function buildGallery(images, mainId, thumbsId){
  const main=document.getElementById(mainId), thumbs=document.getElementById(thumbsId); let idx=0;
  function update(){ main.src=images[idx]; }
  thumbs.innerHTML=''; images.forEach((src,i)=>{ const im=document.createElement('img'); im.src=src; im.alt=''; im.onclick=()=>{idx=i; update(); highlight();}; thumbs.appendChild(im); });
  function highlight(){ [...thumbs.children].forEach((el,i)=> el.style.outline = (i===idx)?'2px solid var(--brand)':'none'); }
  update(); highlight();
  return { next(){ idx=(idx+1)%images.length; update(); highlight(); }, prev(){ idx=(idx-1+images.length)%images.length; update(); highlight(); } };
  // app.js
const LS_KEY = "ls_prefs_v1";
const DECAY = 0.98;
const WEIGHTS = { view: 1, click: 3, add: 6, purchase: 10 };
const BOOSTS  = { featured: 1.5 };

function loadPrefs(){
  const raw = localStorage.getItem(LS_KEY);
  const prefs = raw ? JSON.parse(raw) : { tags:{}, cats:{}, last: Date.now(), price:{sum:0, n:0} };
  const days = Math.max(0, (Date.now() - (prefs.last||Date.now())) / 86400000);
  if (days >= 1){
    for (const k in prefs.tags) prefs.tags[k] *= Math.pow(DECAY, days);
    for (const k in prefs.cats) prefs.cats[k] *= Math.pow(DECAY, days);
    prefs.last = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  }
  return prefs;
}
function savePrefs(p){ localStorage.setItem(LS_KEY, JSON.stringify(p)); }
exported = void 0; // avoids accidental globals in some setups

export const LS_AI = {
  recordEvent(item, type){
    const prefs = loadPrefs();
    const w = WEIGHTS[type] || 0;
    (item.tags||[]).forEach(t => prefs.tags[t] = (prefs.tags[t]||0) + w);
    if(item.category) prefs.cats[item.category] = (prefs.cats[item.category]||0) + w;
    if(type === "add" || type === "purchase"){
      prefs.price.sum += item.priceUSD; prefs.price.n += 1;
    }
    prefs.last = Date.now();
    savePrefs(prefs);
  },
  score(item){
    const prefs = loadPrefs();
    const tagScore = (item.tags||[]).reduce((s,t)=> s + (prefs.tags[t]||0), 0);
    const catScore = prefs.cats[item.category]||0;
    let priceBoost = 0;
    if(prefs.price.n > 0){
      const avg = prefs.price.sum / prefs.price.n;
      const diff = Math.abs((item.priceUSD||0) - avg);
      priceBoost = Math.max(0, 1 - (diff / Math.max(20, avg)));
    }
    const baseBias = (item.tags||[]).includes("featured") ? 1.5 : 0;
    return tagScore + catScore + priceBoost + baseBias;
  },
  getPersonalizedFeatured(products, limit=6){
    const prefs = loadPrefs();
    const cold = !Object.keys(prefs.tags).length && !Object.keys(prefs.cats).length;
    const pool = cold ? products.filter(p => (p.tags||[]).includes("featured")) : products;
    return [...pool].map(p=>({p, s:this.score(p)})).sort((a,b)=>b.s-a.s).slice(0,limit).map(x=>x.p);
  }
};

// ---- Example usage after products are available ----
document.addEventListener('DOMContentLoaded', () => {
  // assume window.allProducts exists or import it here
  const grid = document.getElementById('featured-grid');
  const lineup = LS_AI.getPersonalizedFeatured(window.allProducts || [], 6);

  grid.innerHTML = lineup.map(item => `
    <article class="card" data-id="${item.id}">
      <div class="pimg"><img src="${item.img}" alt="${item.name}"></div>
      <div class="pad">
        <h3 class="ptitle">${item.name}</h3>
        <p class="pmeta">Condition: ${item.condition}</p>
        <div class="row spread">
          <strong class="price">$${item.priceUSD.toFixed(2)}</strong>
          <span class="badge ${(item.tags||[]).includes('featured') ? 'hot' : ''}">
            ${(item.tags||[]).includes('featured') ? 'Featured' : 'For you'}
          </span>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn add" data-id="${item.id}">Add to cart</button>
        </div>
      </div>
    </article>
  `).join('');

  // interactions to learn preferences
  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const item = (window.allProducts||[]).find(p => p.id === card.dataset.id);
    if (!item) return;
    LS_AI.recordEvent(item, e.target.matches('.add') ? 'add' : 'click');
  });

  // view tracking
  const io = new IntersectionObserver(entries=>{
    entries.forEach(ent=>{
      if(ent.isIntersecting){
        const id = ent.target.dataset.id;
        const item = (window.allProducts||[]).find(p=>p.id===id);
        if(item) LS_AI.recordEvent(item, 'view');
        io.unobserve(ent.target);
      }
    });
  }, { rootMargin: "0px 0px -20% 0px" });
  document.querySelectorAll('.card').forEach(c=> io.observe(c));
});

}
