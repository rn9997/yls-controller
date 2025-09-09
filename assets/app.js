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
}
