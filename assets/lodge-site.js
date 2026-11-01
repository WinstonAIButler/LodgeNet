/* A lodge's public website at /site/<slug> (vercel.json rewrites it to lodge-site.html).
   It shows only what an officer last published from the dashboard: published_site() in supabase/public-site.sql
   returns that copy, and only while the lodge's plan is paid for. */
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const safe=u=>/^https:\/\/[^\s"<>]+$/i.test(u||"")?u:"";
  const slug=decodeURIComponent((location.pathname.match(/\/site\/([^/?#]+)/)||[])[1]||new URLSearchParams(location.search).get("slug")||"");
  function show(title,body){$("#state").innerHTML=`<h1>${esc(title)}</h1><p class="empty">${esc(body)}</p><p><a href="/">LodgeNet</a></p>`}
  const parse=d=>{const [y,m,day]=d.split("-").map(Number);return new Date(y,m-1,day)};
  function render(s,at){
    document.documentElement.style.setProperty("--site",/^#[0-9a-f]{3,8}$/i.test(s.color||"")?s.color:"#1c3a75");
    const title=s.full+(s.jur?", "+s.jur:"");
    document.title=title;
    const place=[s.city,s.state].filter(Boolean).join(", ");
    const desc=`${title}${place?", "+place:""}.${s.schedule?" Stated Communications "+s.schedule+".":""}`;
    const md=document.querySelector('meta[name="description"]');if(md)md.content=desc;
    $("#s-title").textContent=title;
    $("#s-place").textContent=[place,s.grandLodge].filter(Boolean).join(" · ");
    $("#s-sched").textContent=s.schedule?"Stated Communications "+s.schedule:"";
    const today=new Date();today.setHours(0,0,0,0);
    const ev=(s.events||[]).filter(e=>parse(e.d)>=today);
    $("#s-events").innerHTML=ev.length?ev.map(e=>{const d=parse(e.d);
      return `<li><div class="date"><span>${d.toLocaleDateString("en-US",{month:"short"})}</span><b>${d.getDate()}</b></div>
        <div><div class="t">${esc(e.t)}${e.fund?'<span class="tag">Fundraiser</span>':""}</div><div class="s">${esc(d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))}${e.time&&!/not set/i.test(e.time)?" · "+esc(e.time):""}</div></div></li>`}).join("")
      :'<li class="empty">No upcoming events posted. Check back soon.</li>';
    $("#s-officers").innerHTML=(s.officers||[]).length?s.officers.map(o=>`<dt>${esc(o.seat)}</dt><dd>${esc(o.name)}</dd>`).join(""):'<dd class="empty">Officers to be announced.</dd>';
    const soc=(s.social||[]).filter(x=>safe(x.url));
    $("#s-contact").innerHTML=(s.email?`<p style="margin:0"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>`:"")
      +(soc.length?`<div class="links">${soc.map(x=>`<a class="btn line" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}</div>`:"")
      +(!s.email&&!soc.length?'<p class="empty" style="margin:0">Visit us at a Stated Communication.</p>':"");
    const give=s.give||[];
    $("#give").hidden=$("#nav-give").hidden=!give.length;
    $("#s-give").innerHTML=`<div class="links">${give.filter(g=>safe(g.url)).map(g=>`<a class="btn" href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.label)}</a>`).join("")}</div>`
      +give.filter(g=>!safe(g.url)&&g.note).map(g=>`<p class="note"><b>${esc(g.label)}:</b> ${esc(g.note)}</p>`).join("");
    /* pictures */
    const im=s.images||{},okImg=u=>/^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(u||"")||!!safe(u);
    if(okImg(im.hero)){const h=$(".hero");h.classList.add("has-img");h.style.backgroundImage=`linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.6)),url("${im.hero}")`}
    if(okImg(im.logo)){const l=document.createElement("img");l.className="logo";l.src=im.logo;l.alt=s.full+" seal";$("#s-crest").replaceWith(l)}
    const about=String(s.about||"").trim();
    $("#about").hidden=$("#nav-about").hidden=!about;
    $("#s-about").innerHTML=about.split(/\n\s*\n/).map(p=>`<p>${esc(p.trim()).replace(/\n/g,"<br>")}</p>`).join("");
    const gal=(im.gallery||[]).filter(okImg);
    $("#photos").hidden=$("#nav-photos").hidden=!gal.length;
    $("#s-gallery").innerHTML=gal.map((u,i)=>`<button type="button" data-z="${i}" aria-label="Open photo ${i+1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("");
    $("#s-gallery").onclick=e=>{const b=e.target.closest("[data-z]");if(!b)return;const d=$("#zoom");d.querySelector("img").src=gal[+b.dataset.z];d.showModal()};
    $("#zoom").onclick=()=>$("#zoom").close();
    /* store: each item pays the lodge straight through its own PayPal, Venmo or Cash App, or shows where to send Zelle or a check */
    const items=s.store||[],pay=s.pay||[];
    $("#store").hidden=$("#nav-store").hidden=!items.length;
    const enc=encodeURIComponent,amt=n=>(+n||0).toFixed(2);
    const payUrl=(p,n,note)=>p.k==="cashapp"?`https://cash.app/$${enc(p.v)}/${amt(n)}`:p.k==="paypal"?`https://paypal.me/${enc(p.v)}/${amt(n)}USD`
      :p.k==="venmo"?`https://venmo.com/?txn=pay&recipients=${enc(p.v)}&amount=${amt(n)}&note=${enc(note)}`:p.k==="link"?safe(p.v):"";
    const money=n=>"$"+(+n||0).toFixed(2);
    $("#s-store").innerHTML=items.map(it=>{
      const links=pay.map(p=>{const u=payUrl(p,it.p,it.n+" from "+s.full);return u?`<a class="btn" href="${esc(u)}" target="_blank" rel="noopener">${esc(p.label)}</a>`:""}).join("");
      const notes=pay.filter(p=>p.k==="zelle"||p.k==="check").map(p=>`<p class="howpay"><b>${esc(p.label)}:</b> ${esc(p.k==="zelle"?"send "+money(it.p)+" to "+p.v:"mail "+money(it.p)+" to "+p.v)}</p>`).join("");
      const mail=s.email?`<a class="btn line" href="mailto:${esc(s.email)}?subject=${enc("Order: "+it.n)}">Email to order</a>`:"";
      return `<div class="item"><div class="pic"${okImg(it.img)?` style="background-image:url('${it.img}')"`:""}>${okImg(it.img)?"":'<svg><use href="#sc"/></svg>'}</div>
        <div class="body"><b>${esc(it.n)}${it.tag?`<span class="tag">${esc(it.tag)}</span>`:""}</b><span class="price">${money(it.p)}</span>
        ${it.sizes?`<span class="opts">Sizes: ${esc(it.sizes)}</span>`:""}${it.colors?`<span class="opts">Colors: ${esc(it.colors)}</span>`:""}
        <div class="buy">${links||mail||'<span class="opts">Ask at the lodge to order.</span>'}${links&&mail?mail:""}</div>${notes}</div></div>`}).join("");
    $("#s-foot").textContent="© "+new Date().getFullYear()+" "+s.full;
    $("#state").hidden=true;$("#site").hidden=false;
  }
  (async()=>{
    if(!slug)return show("No lodge here","This address doesn't name a lodge.");
    try{
      const cfg=await (await fetch("/api/config",{cache:"no-store"})).json();
      if(!cfg.url||!cfg.key)throw new Error("not configured");
      const r=await fetch(cfg.url+"/rest/v1/rpc/published_site",{method:"POST",headers:{apikey:cfg.key,Authorization:"Bearer "+cfg.key,"Content-Type":"application/json"},body:JSON.stringify({s:slug})});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const d=await r.json();
      if(!d||!d.site)return show("This lodge's website isn't published yet","If you're an officer, open the lodge dashboard, go to Website and press Publish site.");
      render(d.site,d.at);
    }catch(e){show("Couldn't load this website","Please try again in a moment.")}
  })();
})();
