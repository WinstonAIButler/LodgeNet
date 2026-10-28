/* The plan cards on Pricing and step 2 of Start. Prices and price ids come from Stripe (/api/plans); the wording for each level is
   written here, in LEVELS, so every card reads the same way: crest, name, one line on who it's for, price, button, then what it adds.
   Lodge Starter, the free level, runs as a strip under the paid ones.
   A Stripe product that matches no level keeps its own Stripe description and marketing features. Crests: red for Valley, purple
   for Grand Lodge, blue for the rest. If Stripe has no plans, or can't be reached, the page keeps its own cards. */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const money=(a,cur)=>{const n=a/100;return (cur==="usd"?"$":cur.toUpperCase()+" ")+(Number.isInteger(n)?n:n.toFixed(2))};
  const per=p=>p.interval_count>1?`${p.interval_count} ${p.interval}s`:p.interval;
  const crest=name=>/grand/i.test(name)?"purple":/valley/i.test(name)?"red":"blue";
  const LEVELS=[
    {match:/starter/i,tag:"Set up your lodge and see it working before you publish.",
      base:null,adds:["Website builder, in preview","Calendar with your Stated Communications filled in","Members roll and officer chairs","Minutes: short form, full write-up and PDF","2 officer logins"]},
    {match:/grand/i,tag:"Website and communications for a whole Grand Lodge jurisdiction.",
      base:"Lodge Level",adds:["The Grand Lodge's own published website","Every constituent lodge on one account","Jurisdiction-wide calendar and announcements","Extra payment routes, merchandise and fundraisers"]},
    {match:/valley/i,tag:"Website and communications for a Scottish Rite Valley.",
      base:"Lodge Level",adds:["The Valley's own published website","One calendar and announcements for every member","Extra payment routes, merchandise and fundraisers","Reunion and event RSVPs with donations"]},
    {match:/district/i,tag:"One website for a District's Masters and Wardens.",
      base:"Lodge Level",adds:["The District's own published website","District calendar and visitation schedule","District store and fundraisers","Payments to the District's own accounts"]},
    {match:/lodge/i,tag:"Everything a Blue Lodge needs online, published and taking payments.",
      base:"Lodge Starter",adds:["Publish on a lodgenet.org address or your own domain","Print-on-demand store: shirts, pins, caps and coins","Fundraiser goals, RSVPs and donations","Payments straight to the lodge's PayPal, Venmo or Cash App","Unlimited officer logins and a members area"]}
  ];
  const level=name=>LEVELS.find(l=>l.match.test(name));
  let loaded=null;
  function load(){
    if(!loaded)loaded=fetch("/api/plans").then(r=>r.ok?r.json():{plans:[]}).then(d=>d.plans||[]).catch(()=>[]);
    return loaded;
  }
  /* mode "pricing": links to /start; mode "start": buttons with data-pick / data-price for assets/start.js */
  async function render(box,mode){
    const list=await load();
    if(!list.length||!box)return list;
    const free=list.find(p=>p.amount===0)||{name:"Lodge Starter",amount:0,features:[]},paid=list.filter(p=>p.amount>0);
    const card=(p,i)=>{
      const L=level(p.name),label=p.amount?`${money(p.amount,p.currency)} / ${per(p)}`:"Free";
      const pick=p.amount?"lodge":"starter",main=i===0?"":" line";
      const cta=mode==="start"
        ?`<button class="btn${main}" type="button" data-pick="${pick}" data-price="${esc(p.price||"")}" data-name="${esc(p.name)}" data-label="${esc(label)}">${p.amount?"Choose this level":"Start free"}</button>`
        :`<a class="btn${main}" href="/start?${p.amount?"price="+encodeURIComponent(p.price):"plan=starter"}">${p.amount?"Get started":"Start free"}</a>`;
      const tag=L?L.tag:p.description,adds=L?L.adds:p.features;
      return `<div class="tier${i===0?" feat-tier":""}${p.amount?"":" free-tier"}" data-tier="${esc(p.amount?p.price:"starter")}">
        <img class="crest" src="/assets/brand/${p.amount?"crest-"+crest(p.name):"lodgenet-crest"}.webp" alt="" width="72" height="70">
        <h3>${esc(p.name)}</h3>
        ${tag?`<p class="tag">${esc(tag)}</p>`:""}
        <div class="amt num">${p.amount?`${money(p.amount,p.currency)}<small>per ${esc(per(p))}</small>`:"$0<small>free to start</small>"}</div>
        ${cta}
        ${adds.length?`<div class="incl">${L&&L.base?`<b>Everything in ${esc(L.base)}, plus</b>`:"<b>Includes</b>"}<ul>${adds.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></div>`:""}</div>`;
    };
    /* the paid levels side by side, then Lodge Starter as a strip underneath */
    box.innerHTML=paid.map(card).join("")+card(free,-1);
    box.style.gridTemplateColumns="";box.classList.toggle("four",paid.length===4);
    return list;
  }
  window.LodgeNetPlans={load,render};
})();
