// Shared app logic (currency + cart) using localStorage across pages
const RATES = { USD: 1, BHD: 0.376, EUR: 0.92, GBP: 0.78 }; // base USD
const SYMBOL = { USD: '$', BHD: 'ب.د', EUR: '€', GBP: '£' };
const STORE = {
  getCurrency(){ return localStorage.getItem('nll.ccy') || 'BHD'; },
  setCurrency(ccy){ localStorage.setItem('nll.ccy', ccy); },
  getCart(){ return JSON.parse(localStorage.getItem('nll.cart')||'{}'); },
  setCart(obj){ localStorage.setItem('nll.cart', JSON.stringify(obj)); },
  add(id, qty=1){ const c=this.getCart(); c[id]=(c[id]||0)+qty; this.setCart(c); },
  setQty(id, qty){ const c=this.getCart(); c[id]=Math.max(1, Number(qty)||1); this.setCart(c); },
  remove(id){ const c=this.getCart(); delete c[id]; this.setCart(c); },
  clear(){ this.setCart({}); }
};

function moneyUSDTo(ccy, usd){
  const n = usd * (RATES[ccy]||1);
  const dp = ccy==='BHD' ? 3 : 2;
  return `${SYMBOL[ccy]}\u00A0${n.toFixed(dp)}`;
}

async function loadProducts(){
  const res = await fetch('assets/products.json');
  return res.json();
}

function bindHeader(){
  const ccySel = document.getElementById('ccy');
  if(ccySel){
    ccySel.value = STORE.getCurrency();
    ccySel.addEventListener('change', e=>{
      STORE.setCurrency(e.target.value);
      document.dispatchEvent(new CustomEvent('currency:changed'));
      updateHeaderTotals();
    });
  }
  updateHeaderTotals();
}

async function updateHeaderTotals(){
  const cart = STORE.getCart();
  const products = await loadProducts();
  const ccy = STORE.getCurrency();
  let count = 0, totalUSD = 0;
  for(const [id,qty] of Object.entries(cart)){
    const p = products.find(x=>x.id===id);
    if(!p) continue;
    count += qty;
    totalUSD += p.priceUSD * qty;
  }
  const el = document.getElementById('cartMini');
  if(el){ el.textContent = `${count} • ${moneyUSDTo(ccy,totalUSD)}`; }
}
document.addEventListener('cart:updated', updateHeaderTotals);