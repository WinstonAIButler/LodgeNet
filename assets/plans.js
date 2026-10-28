/* The plan cards on Pricing and step 2 of Start come from Stripe (/api/plans): each product's name, price, description and
   marketing features. The free Lodge Starter and the District cards stay as written in the page unless Stripe has a free plan.
   If Stripe has no plans, or can't be reached, the page keeps its own cards. */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const money=(a,cur)=>{const n=a/100;return (cur==="usd"?"$":cur.toUpperCase()+" ")+(Number.isInteger(n)?n:n.toFixed(2))};
  const per=p=>p.interval_count>1?`${p.interval_count} ${p.interval}s`:p.interval;
  let loaded=null;
  function load(){
    if(!loaded)loaded=fetch("/api/plans").then(r=>r.ok?r.json():{plans:[]}).then(d=>d.plans||[]).catch(()=>[]);
    return loaded;
  }
  /* mode "pricing": links to /start; mode "start": buttons with data-pick / data-price for assets/start.js */
  async function render(box,mode){
    const list=await load();
    if(!list.length||!box)return list;
    const free=list.find(p=>p.amount===0),paid=list.filter(p=>p.amount>0);
    const card=(p,i)=>{
      const label=p.amount?`${money(p.amount,p.currency)} / ${per(p)}`:"Free";
      const pick=p.amount?"lodge":"starter";
      const cta=mode==="start"
        ?`<button class="btn${i===0&&p.amount?"":" line"}" type="button" data-pick="${pick}" data-price="${esc(p.price)}" data-name="${esc(p.name)}" data-label="${esc(label)}">Choose ${esc(p.name)}${p.amount?" · "+esc(label):""}</button>`
        :`<a class="btn${i===0&&p.amount?"":" line"}" href="/start?${p.amount?"price="+encodeURIComponent(p.price):"plan=starter"}">Start with ${esc(p.name)}</a>`;
      return `<div class="tier${i===0&&p.amount?" feat-tier":""}" data-tier="${esc(p.amount?p.price:"starter")}"><h3>${esc(p.name)}</h3>
        <div class="amt num">${p.amount?`${money(p.amount,p.currency)}<small> / ${esc(per(p))}</small>`:"$0"}</div>
        ${p.description?`<p class="hint">${esc(p.description)}</p>`:""}
        ${p.features.length?`<ul>${p.features.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>`:""}
        ${cta}
        ${p.amount?'<p class="hint">Billed by card through Stripe. Have a promo code? Enter it at checkout.</p>':""}</div>`;
    };
    const keep=[...box.querySelectorAll('[data-tier="starter"],[data-tier="district"]')];
    const starter=free?card(free,-1):(keep.find(t=>t.dataset.tier==="starter")||{}).outerHTML||"";
    const district=(keep.find(t=>t.dataset.tier==="district")||{}).outerHTML||"";
    box.innerHTML=starter+paid.map(card).join("")+district;
    return list;
  }
  window.LodgeNetPlans={load,render};
})();
