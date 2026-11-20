/* Settings → Web address: give the lodge's website its own address (yourlodge.org). Buy one through LodgeNet, or connect one
   the lodge already owns. The work happens in api/domains.js; this draws the card and calls it.
   Coming back from Stripe Checkout (?domain_session=…) registers the domain right away. */
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=c=>"$"+(c/100).toFixed(2);
  const STATUS={paid:"Paid · registering",registering:"Registering",dns:"Setting up",attaching:"Setting up",pending:"Waiting for your records",
    verifying:"Connecting…",live:"Live",refunded:"Refunded",needs_attention:"Needs attention",removed:"Not showing your site"};
  const S={mode:null,quotes:null,buying:null,records:{},msg:"",err:false,busy:false,data:null};

  async function call(action,extra){
    const Au=window.LodgeNetAuth,C=window.LODGENET_CLOUD;
    const s=Au&&await Au.session();
    if(!s||!C)throw new Error("Sign in again.");
    const r=await fetch("/api/domains",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+s.access_token},
      body:JSON.stringify(Object.assign({action,lodge_id:C.lodgeId},extra||{}))});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||"Couldn't do that just now.");
    return d;
  }
  const say=(msg,err)=>{S.msg=msg;S.err=!!err};

  async function load(){
    try{S.data=await call("list")}catch(e){S.data={error:e.message}}
    draw();
  }

  function draw(){
    const box=$("#set-domain-body");if(!box)return;
    const C=window.LODGENET_CLOUD;
    if(!C){box.innerHTML='<p class="hint">Sign in to give your website its own address.</p>';return}
    if(!C.canEdit){$("#set-domain").hidden=true;return}
    const D=S.data;
    if(!D){box.innerHTML='<p class="hint">Loading…</p>';return}
    if(D.error){box.innerHTML=`<p class="hint">${esc(D.error)}</p>`;return}
    if(!D.canConnect&&!D.domains.length){box.innerHTML='<p class="hint">Custom web addresses are coming soon.</p>';return}
    const slug=(window.LODGE||{}).slug||"";
    const live=D.domains.find(d=>d.is_primary&&d.status==="live");
    let h=`<p class="hint">${live?`Your website is live at <b>${esc(live.name)}</b>.`:`Your website is at www.lodgenet.app/site/${esc(slug)}. Give it its own address, like yourlodge.org.`}</p>`;
    if(D.domains.length){
      h+='<div class="dom-list">'+D.domains.map(d=>{
        const bits=[];
        if(d.source==="purchased"&&d.status==="live"&&d.expires_at)bits.push(`${d.auto_renew?"renews":"expires"} ${new Date(d.expires_at).toLocaleDateString()} · ${money(d.price_cents)}/yr`);
        const acts=[];
        if(!["live","refunded","removed"].includes(d.status))acts.push(`<button class="link-btn" data-check="${esc(d.id)}">Check again</button>`);
        if(d.status==="live"&&!d.is_primary)acts.push(`<button class="link-btn" data-primary="${esc(d.id)}">Make main</button>`);
        if(D.owner)acts.push(`<button class="link-btn" data-remove="${esc(d.id)}" data-name="${esc(d.name)}" data-src="${esc(d.source)}">Remove</button>`);
        let more="";
        if(d.last_error&&d.status!=="live")more+=`<p class="hint" style="color:var(--danger,#b3261e)">${esc(d.last_error)}</p>`;
        if(d.last_check&&d.status!=="live")more+='<ul class="hint dom-check">'+d.last_check.items.map(i=>`<li>${i.ok?"✓":"○"} ${esc(i.label)}: ${esc(i.detail)}</li>`).join("")+"</ul>";
        if(d.source==="connected"&&d.status!=="live"){
          const r=S.records[d.id];
          more+=r?`<table class="dom-recs"><tr><th>Type</th><th>Name / Host</th><th>Value</th></tr>${r.map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.host)}</td><td><code>${esc(x.value)}</code></td></tr>`).join("")}</table>
            <p class="hint">Add these where the lodge bought ${esc(d.name)} (its DNS settings). Changes can take a few hours; LodgeNet checks again each day, or press Check again.</p>`
            :`<button class="btn line sm" data-records="${esc(d.id)}">Show the records to set</button>`;
        }
        return `<div class="dom-row"><div class="dom-head"><span><b>${esc(d.name)}</b>${d.is_primary&&d.status==="live"?' <span class="hint">· main address</span>':""}<br>
          <span class="hint">${esc(STATUS[d.status]||d.status)}${bits.length?" · "+bits.join(" · "):""}</span></span><span class="dom-acts">${acts.join(" ")}</span></div>${more}</div>`;
      }).join("")+"</div>";
    }
    h+='<div class="dom-btns">'+(D.canBuy&&D.owner?`<button class="btn sm${S.mode==="buy"?"":" line"}" data-mode="buy">Get a domain</button>`:"")+
      (D.canConnect?`<button class="btn sm${S.mode==="connect"?"":" line"}" data-mode="connect">Use one we own</button>`:"")+"</div>";
    if(S.mode==="buy"){
      h+=`${D.sandbox?'<p class="hint">Test mode: nothing is really registered.</p>':""}
        <form class="dom-form" id="dom-search"><input name="q" placeholder="Your lodge's name or number" aria-label="Search for a domain" value="${esc(S.q||"")}"><button class="btn sm line">Search</button></form>`;
      if(S.quotes&&!S.buying)h+='<div class="dom-list">'+(S.quotes.length?S.quotes.map(q=>`<div class="dom-q"><span${q.available?"":' class="hint" style="text-decoration:line-through"'}>${esc(q.domain)}</span>
        ${q.available?`<span class="hint">${money(q.priceCents)}/yr</span><button class="btn sm line" data-buy="${esc(q.domain)}" data-price="${q.priceCents}">Buy</button>`:`<span class="hint">${esc(q.reason||"")}</span>`}</div>`).join(""):'<p class="hint">Nothing found. Try a shorter name.</p>')+"</div>";
      if(S.buying)h+=`<form class="dom-buy" id="dom-buy"><p><b>${esc(S.buying.domain)}</b> · ${money(S.buying.priceCents)} a year. Renews yearly at the same price; cancel any time.</p>
        <p class="hint">Who legally owns it? Registries require these details. A confirmation email goes to this address; the details stay private.</p>
        <div class="dom-grid">${[["firstName","First name"],["lastName","Last name"],["companyName","Lodge or company (optional)",1],["address1","Street address",1],["city","City"],["state","State"],["zip","ZIP"],["country","Country","","US"],["email","Email"],["phone","Phone"]]
          .map(([n,p,wide,v])=>`<input name="${n}" placeholder="${p}"${n==="companyName"?"":" required"}${wide?' class="wide"':""}${v?` value="${v}"`:""}${n==="email"?' type="email"':n==="phone"?' type="tel"':""}>`).join("")}</div>
        <div class="dom-btns"><button class="btn sm">Pay ${money(S.buying.priceCents)}</button><button type="button" class="link-btn" data-back>Back</button></div>
        <p class="hint">If the domain can't be registered after you pay, the payment is refunded in full automatically.</p></form>`;
    }
    if(S.mode==="connect")h+=`<form class="dom-form" id="dom-connect"><input name="d" placeholder="yourlodge.org" aria-label="Your domain"><button class="btn sm line">Connect</button></form>`;
    if(S.msg)h+=`<p class="hint" style="${S.err?"color:var(--danger,#b3261e)":""}">${esc(S.msg)}</p>`;
    box.innerHTML=h;
    box.querySelectorAll("button,input").forEach(b=>{if(S.busy&&b.tagName==="BUTTON")b.disabled=true});
  }

  const busy=async fn=>{if(S.busy)return;S.busy=true;draw();try{await fn()}catch(e){say(e.message,true)}finally{S.busy=false;draw()}};

  document.addEventListener("click",e=>{
    const t=e.target.closest("#set-domain-body button");if(!t||t.type==="submit"&&t.closest("form"))return;
    const d=t.dataset;
    if(d.mode){S.mode=S.mode===d.mode?null:d.mode;S.msg="";return draw()}
    if(d.back!==undefined){S.buying=null;return draw()}
    if(d.buy){S.buying={domain:d.buy,priceCents:+d.price};return draw()}
    if(d.records)return busy(async()=>{S.records[d.records]=(await call("records",{id:d.records})).records});
    if(d.check)return busy(async()=>{await call("check",{id:d.check});await load()});
    if(d.primary)return busy(async()=>{await call("primary",{id:d.primary});await load()});
    if(d.remove){
      const note=d.src==="purchased"?" The domain stays the lodge's; the website just won't show there.":"";
      if(!confirm(`Stop showing the lodge's website at ${d.name}?${note}`))return;
      return busy(async()=>{await call("remove",{id:d.remove});say("Removed.");await load()});
    }
  });
  document.addEventListener("submit",e=>{
    const f=e.target;if(!f.closest("#set-domain-body"))return;e.preventDefault();
    if(f.id==="dom-search")return busy(async()=>{S.q=f.q.value;S.buying=null;S.msg="";S.quotes=(await call("search",{q:S.q})).quotes});
    if(f.id==="dom-connect")return busy(async()=>{await call("connect",{domain:f.d.value});S.mode=null;say("Added. Show the records to set, and add them where the lodge bought the domain.");await load()});
    if(f.id==="dom-buy")return busy(async()=>{
      const contact={};new FormData(f).forEach((v,k)=>contact[k]=v);
      const r=await call("buy",{domain:S.buying.domain,contact});location.href=r.url;
    });
  });

  /* back from Stripe Checkout */
  async function returning(){
    const sid=new URLSearchParams(location.search).get("domain_session");if(!sid)return;
    history.replaceState(null,"",location.pathname+location.hash);
    try{const r=await call("paid",{session_id:sid});say(r.domain.status==="refunded"?`We couldn't register ${r.domain.name}, so the payment was refunded in full.`:`Paid. ${r.domain.name} is being set up for your website.`,r.domain.status==="refunded")}
    catch(e){say(e.message,true)}
  }

  let started=false;
  window.LodgeNetDomains={async render(){
    if(!started){started=true;await returning()}
    draw();await load();
  }};
})();
