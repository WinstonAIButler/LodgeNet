/* A lodge's public website at /site/<slug> (vercel.json rewrites it and everything under it to lodge-site.html).
   It shows only what an officer last published from the dashboard: published_site() in supabase/public-site.sql returns that
   copy, and only while the lodge's plan is paid for. assets/site-render.js draws it.
   Addresses under the lodge:
     /site/<slug>                    Home
     /site/<slug>/<page>             one of the lodge's pages
     /site/<slug>/fundraiser/<id>    a fundraiser: details, progress and the lodge's giving buttons
     /site/<slug>/qr/<id>            a printed QR code; sends the visitor on to wherever the lodge last assigned it
   A members-only page is published as a title only. Its sections come from members_page() (supabase/members-pages.sql), which
   answers only a signed-in brother on the lodge's roll; everyone else sees a sign-in screen. */
(function(){
  const L=window.LodgeSite,$=s=>document.querySelector(s),esc=L.esc;
  const pm=location.pathname.match(/\/site\/([^/?#]+)(?:\/([^?#]*))?/)||[];
  const slug=decodeURIComponent(pm[1]||new URLSearchParams(location.search).get("slug")||"");
  const rest=decodeURIComponent(pm[2]||"").replace(/\/+$/,"");
  const root="/site/"+encodeURIComponent(slug);
  function show(title,body){$("#state").innerHTML=`<h1>${esc(title)}</h1><p>${esc(body)}</p><p><a href="/">LodgeNet</a></p>`}
  function paint(site,o){
    const box=$("#site");box.innerHTML=L.render(site,o);
    /* photo galleries open full size */
    const zoom=document.createElement("dialog");zoom.className="ls-zoom";zoom.innerHTML='<img alt="">';box.firstElementChild.appendChild(zoom);
    box.onclick=e=>{const b=e.target.closest("[data-zoom]");if(!b)return;zoom.querySelector("img").src=b.querySelector("img").src;zoom.showModal()};
    zoom.addEventListener("click",()=>zoom.close());
    $("#state").hidden=true;box.hidden=false;
  }
  const loadScript=src=>new Promise((ok,no)=>{const x=document.createElement("script");x.src=src;x.onload=ok;x.onerror=no;document.head.appendChild(x)});
  async function membersPage(site,o,cfg){
    const page=o.page,next="/login?next="+encodeURIComponent(location.pathname);
    const gate=g=>paint(site,{root,page,view:"gate",gate:g});
    gate({title:"Members only",text:"Checking your sign-in…"});
    try{
      if(!window.supabase)await loadScript("/assets/vendor/supabase.umd.min.js");
      const sb=window.supabase.createClient(cfg.url,cfg.key);
      const {data:{session}}=await sb.auth.getSession();
      if(!session)return gate({title:"Members only",text:`This page is for members of ${site.full}. Sign in with the email your lodge invited.`,button:["Sign in",next],small:"Not a member yet? Ask any brother about joining."});
      const {data,error}=await sb.rpc("members_page",{s:slug,p:page.id});
      if(error)return gate({title:"Members only",text:/function|does not exist|schema cache/i.test(error.message||"")?"Members-only pages aren't switched on for this site yet. Please check back soon.":"Couldn't open this page just now. Please try again in a moment."});
      if(!data||!data.page)return gate({title:"Members only",text:`You're signed in as ${session.user.email}, but that account isn't on the roll of ${site.full}. Ask the lodge's Secretary to invite you.`,button:["Sign in with another account",next]});
      const s2=Object.assign({},site,{dues:data.dues||site.dues,news:data.news||site.news});
      paint(s2,{root,page:Object.assign({},page,{sections:data.page.sections||[]})});
    }catch(e){gate({title:"Members only",text:"Couldn't open this page just now. Please try again in a moment."})}
  }
  function draw(site,cfg){
    /* a QR code goes straight on to its target (older publishes stored the address itself as href) */
    if(/^qr\//.test(rest)){const q=(site.qrs||[]).find(x=>x.id===rest.slice(3));
      return location.replace((q&&(q.to?L.resolve(site,q.to,root):L.safeHref(q.href)))||root)}
    const pages=L.pagesOf(site),title=site.full+(site.jur?", "+site.jur:"");
    let o={root},name="";
    if(!rest){o.page=pages[0]}
    else{const fm=/^fundraiser\/(.+)$/.exec(rest);
      if(fm){o.view="fund";o.fund=(site.funds||[]).find(f=>f.id===fm[1]);name=o.fund?o.fund.t:"Fundraiser"}
      else{o.page=pages.find(p=>p.slug===rest);if(o.page)name=o.page.title;else{o.view="404";name="Page not found"}}}
    document.title=(name?name+" · ":"")+title;
    const place=[site.city,site.state].filter(Boolean).join(", ");
    const md=document.querySelector('meta[name="description"]');
    if(md)md.content=`${title}${place?", "+place:""}.${site.schedule?" Stated Communications "+site.schedule+".":""}`;
    const th=Object.assign({},L.THEME,(site.layout&&site.layout.theme)||{});
    if(th.font!=="modern"){const f=document.createElement("link");f.rel="stylesheet";f.href=L.fontHref(th.font);document.head.appendChild(f)}
    if(o.page&&o.page.members)return membersPage(site,o,cfg);
    paint(site,o);
  }
  (async()=>{
    if(!slug)return show("No lodge here","This address doesn't name a lodge.");
    try{
      const cfg=await (await fetch("/api/config",{cache:"no-store"})).json();
      if(!cfg.url||!cfg.key)throw new Error("not configured");
      const r=await fetch(cfg.url+"/rest/v1/rpc/published_site",{method:"POST",headers:{apikey:cfg.key,Authorization:"Bearer "+cfg.key,"Content-Type":"application/json"},body:JSON.stringify({s:slug})});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const d=await r.json();
      if(!d||!d.site)return show("This lodge's website isn't published yet","If you're an officer, open the lodge dashboard, go to Website and press Publish.");
      draw(d.site,cfg);
    }catch(e){show("Couldn't load this website","Please try again in a moment.")}
  })();
})();
