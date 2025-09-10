// ======================================================
// app.js — store utilities, cart, gallery, personalization
// ======================================================

// ---------- Currency, cart, products ----------
const RATES  = { USD: 1, BHD: 0.376, EUR: 0.92, GBP: 0.78 };
const SYMBOL = { USD: '$', BHD: 'ب.د', EUR: '€', GBP: '£' };

const safeJSON = (str, fallback) => { try { return JSON.parse(str); } catch { return fallback; } };

const STORE = {
  getCurrency(){ return localStorage.getItem('ccy') || 'USD'; },
  setCurrency(c){
    const code = SYMBOL[c] ? c : 'USD';
    localStorage.setItem('ccy', code);
    document.dispatchEvent(new Event('currency:changed'));
  },

  getCart(){ return safeJSON(localStorage.getItem('cart'), {}); },
  setCart(x){
    localStorage.setItem('cart', JSON.stringify(x));
    document.dispatchEvent(new Event('cart:changed'));
  },
  add(id, qty=1){
    const c = this.getCart();
    c[id] = (c[id] || 0) + Math.max(1, Number(qty)||1);
    this.setCart(c);
  },
  setQty(id, qty){
    const q = Math.max(0, Number(qty)||0);
    const c = this.getCart();
    if(q <= 0){ delete c[id]; } else { c[id] = q; }
    this.setCart(c);
  },
  remove(id){ const c=this.getCart(); if(id in c){ delete c[id]; this.setCart(c); } },
  clear(){ this.setCart({}); },
};

function toMoney(ccy, usd){
  const code = SYMBOL[ccy] ? ccy : 'USD';
  const dp = code === 'BHD' ? 3 : 2;
  const rate = RATES[code] ?? 1;
  return `${SYMBOL[code]}\u00A0${(Number(usd||0) * rate).toFixed(dp)}`;
}

// cache products so we don’t re-fetch on every update
let __productsPromise = null;
async function loadProducts(){
  if(!__productsPromise){
    __productsPromise = fetch('assets/products.json')
      .then(r => {
        if(!r.ok) throw new Error('Failed to load products.json');
        return r.json();
      })
      .catch(err => { console.error(err); return []; });
  }
  return __productsPromise;
}

// ---------- Header helpers ----------
async function bindHeader(){
  const ccySel = document.getElementById('ccy');
  if(ccySel){
    ccySel.value = STORE.getCurrency();
    ccySel.addEventListener('change', e => STORE.setCurrency(e.target.value));
  }

  renderMiniCart();
  document.addEventListener('cart:changed', renderMiniCart);
  document.addEventListener('currency:changed', renderMiniCart);
}

async function renderMiniCart(){
  const el = document.getElementById('cartMini');
  if(!el) return;

  const data = await loadProducts();
  const cart = STORE.getCart();
  const ccy  = STORE.getCurrency();

  let n = 0, usd = 0;
  for(const [id, qty] of Object.entries(cart)){
    const p = data.find(x => x.id === id);
    if(!p) continue;
    n += qty;
    usd += (Number(p.priceUSD)||0) * qty;
  }
  el.textContent = `${n} • ${toMoney(ccy, usd)}`;
}

// ---------- Drawer helpers ----------
function openDrawer(){
  document.querySelector('.drawer')?.classList.add('open');
  document.querySelector('.overlay')?.classList.add('show');
}
function closeDrawer(){
  document.querySelector('.drawer')?.classList.remove('open');
  document.querySelector('.overlay')?.classList.remove('show');
}
window.OPEN_CART = openDrawer;
window.CLOSE_CART = closeDrawer;

// ---------- Product gallery ----------
function buildGallery(images=[], mainId, thumbsId){
  const main = document.getElementById(mainId);
  const thumbs = document.getElementById(thumbsId);
  if(!main || !thumbs || !Array.isArray(images) || images.length === 0) return null;

  let idx = 0;

  function update(){ main.src = images[idx]; }
  function highlight(){
    [...thumbs.children].forEach((el, i) => {
      if(i === idx) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  thumbs.innerHTML = '';
  images.forEach((src, i) => {
    const im = document.createElement('img');
    im.src = src;
    im.alt = '';
    im.addEventListener('click', () => { idx = i; update(); highlight(); });
    thumbs.appendChild(im);
  });

  update(); highlight();

  return {
    next(){ idx = (idx + 1) % images.length; update(); highlight(); },
    prev(){ idx = (idx - 1 + images.length) % images.length; update(); highlight(); }
  };
}
window.buildGallery = buildGallery;

// ======================================================
// Personalization (free, on-device)
// ======================================================

const LS_KEY = 'ls_prefs_v1';
const DECAY  = 0.98; // daily decay
const WEIGHTS = { view: 1, click: 3, add: 6, purchase: 10 };

function loadPrefs(){
  const raw = localStorage.getItem(LS_KEY);
  const prefs = raw ? safeJSON(raw, null) : null;
  const base = prefs || { tags:{}, cats:{}, last: Date.now(), price:{sum:0, n:0} };

  const days = Math.max(0, (Date.now() - (base.last || Date.now())) / 86400000);
  if(days >= 1){
    for(const k in base.tags) base.tags[k] *= Math.pow(DECAY, days);
    for(const k in base.cats) base.cats[k] *= Math.pow(DECAY, days);
    base.last = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(base));
  }
  return base;
}
function savePrefs(p){ localStorage.setItem(LS_KEY, JSON.stringify(p)); }

const LS_AI = {
  recordEvent(item, type){
    const prefs = loadPrefs();
    const w = WEIGHTS[type] || 0;
    (item?.tags || []).forEach(t => prefs.tags[t] = (prefs.tags[t] || 0) + w);
    if(item?.category) prefs.cats[item.category] = (prefs.cats[item.category] || 0) + w;

    if(type === 'add' || type === 'purchase'){
      prefs.price.sum += Number(item?.priceUSD || 0);
      prefs.price.n += 1;
    }
    prefs.last = Date.now();
    savePrefs(prefs);
  },

  score(item){
    const prefs = loadPrefs();
    const tagScore = (item?.tags || []).reduce((s, t) => s + (prefs.tags[t] || 0), 0);
    const catScore = prefs.cats[item?.category] || 0;

    let priceBoost = 0;
    if(prefs.price.n > 0){
      const avg  = prefs.price.sum / prefs.price.n;
      const diff = Math.abs((Number(item?.priceUSD)||0) - avg);
      priceBoost = Math.max(0, 1 - (diff / Math.max(20, avg)));
    }

    // gentle bias so page isn't empty on first load if you pre-tag some items
    const baseBias = (item?.tags || []).includes('featured') ? 1.5 : 0;

    return tagScore + catScore + priceBoost + baseBias;
  },

  getPersonalizedFeatured(products, limit=6){
    const prefs = loadPrefs();
    const cold = !Object.keys(prefs.tags).length && !Object.keys(prefs.cats).length;
    const pool = cold ? products.filter(p => (p.tags||[]).includes('featured')) : products;
    return [...pool].map(p => ({ p, s: this.score(p) }))
                    .sort((a,b) => b.s - a.s)
                    .slice(0, limit)
                    .map(x => x.p);
  }
};

window.LS_AI = LS_AI; // expose for UI hooks

// ======================================================
// Boot
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Bind header + mini cart
  bindHeader();

  // Ensure products in memory for anything else on the page
  const products = await loadProducts();
  // expose once if you need elsewhere
  window.allProducts = window.allProducts || products;

  // Render personalized featured if container exists
  const grid = document.getElementById('featured-grid');
  if(grid){
    const lineup = LS_AI.getPersonalizedFeatured(window.allProducts, 6);
    grid.innerHTML = lineup.map(item => `
      <article class="card" data-id="${item.id}">
        <div class="pimg"><img src="${item.img}" alt="${item.name}"></div>
        <div class="pad">
          <h3 class="ptitle">${item.name}</h3>
          <p class="pmeta">Condition: ${item.condition}</p>
          <div class="row spread">
            <strong class="price">${toMoney(STORE.getCurrency(), item.priceUSD)}</strong>
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

    // Learn from interactions
    grid.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if(!card) return;
      const item = window.allProducts.find(p => p.id === card.dataset.id);
      if(!item) return;

      if(e.target.matches('.add')){
        STORE.add(item.id, 1);
        LS_AI.recordEvent(item, 'add');
        openDrawer?.();
      } else {
        LS_AI.recordEvent(item, 'click');
      }
    });

    // Track views once per card
    const io = new IntersectionObserver(entries => {
      entries.forEach(ent => {
        if(ent.isIntersecting){
          const id = ent.target.dataset.id;
          const item = window.allProducts.find(p => p.id === id);
          if(item) LS_AI.recordEvent(item, 'view');
          io.unobserve(ent.target);
        }
      });
    }, { rootMargin: '0px 0px -20% 0px' });
    document.querySelectorAll('.card').forEach(c => io.observe(c));
  }
});
