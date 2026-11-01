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
