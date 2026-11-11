/* Lodge websites: one renderer for the public site (assets/lodge-site.js) and the Website builder's canvas
   (assets/site-builder.js), so what an officer edits is exactly what visitors see. Styles are assets/lodge-site.css.

   A site is the published copy the dashboard makes (demo.js publicSite()): the lodge's details, officers, events, giving and
   store, plus `layout` from the builder: {theme:{font,btn,header}, pages:[{id,slug,title,nav,sections:[...]}]}.
   The first page is Home (id "home", slug ""). Each section is {id,type,bg,...fields}; SECTIONS below lists the types.
   Lodge sections (events, officers, contact, give, store, fundraisers) fill themselves from the dashboard's records.

   Links in buttons are stored as "home", "page:<id>", "fund:<id>" or an https/mailto/tel address, and resolved here,
   so renaming a page never breaks a button.

   Custom HTML runs in a sandboxed iframe without allow-same-origin, so its scripts can't read LodgeNet sign-ins, cookies or
   lodge records. It reports its height with postMessage. */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const safeHref=u=>/^(https:\/\/[^\s"<>]+|mailto:[^\s"<>]+|tel:[+\d\s().-]+|\/site\/[^\s"<>]*)$/i.test(u||"")?u:"";
  const okImg=u=>/^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(u||"")||/^https:\/\/[^\s"<>]+$/i.test(u||"");
  const uid=()=>"s"+Math.random().toString(36).slice(2,9);
  const HTML_MAX=200000;

  const FONTS={
    modern:{name:"Modern",head:"Montserrat,system-ui,sans-serif",body:'"Public Sans",system-ui,sans-serif',q:"family=Montserrat:wght@600;700;800&family=Public+Sans:wght@400;500;600"},
    classic:{name:"Classic",head:'"Playfair Display",Georgia,serif',body:'"Source Sans 3",system-ui,sans-serif',q:"family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;600"},
    heritage:{name:"Heritage",head:"Cinzel,Georgia,serif",body:'"EB Garamond",Georgia,serif',q:"family=Cinzel:wght@600;700&family=EB+Garamond:wght@400;500;600"}
  };
  const fontHref=k=>"https://fonts.googleapis.com/css2?"+(FONTS[k]||FONTS.modern).q+"&display=swap";
  const THEME={font:"modern",btn:"rounded",header:"center"};

  /* the section library: name, group, and what a new one starts with */
  const SECTIONS={
    hero:{name:"Banner",group:"Basics",make:()=>({heading:"",sub:"",image:"",button:{label:"",link:""},height:"tall",align:"center"})},
    text:{name:"Text",group:"Basics",make:()=>({heading:"A heading",body:"Write a few sentences here. Click any text on the page to change it.",align:"left"})},
    imageText:{name:"Picture and text",group:"Basics",make:()=>({heading:"Our history",body:"Tell visitors when the lodge was chartered, what it has done for the town, and what it stands for.",image:"",side:"left",button:{label:"",link:""}})},
    features:{name:"Three columns",group:"Basics",make:()=>({heading:"What we do",items:[{title:"Charity",body:"Scholarships, food drives and help for neighbors in need."},{title:"Fellowship",body:"Good men meeting on the level, building lasting friendships."},{title:"Community",body:"Pancake breakfasts, parades and service across town."}]})},
    cta:{name:"Call to action",group:"Basics",make:()=>({heading:"Interested in becoming a Mason?",body:"To be one, ask one. We'd be glad to meet you.",button:{label:"Get in touch",link:""},bg:"color"})},
    gallery:{name:"Photo gallery",group:"Media",make:()=>({heading:"Photos",images:[]})},
    video:{name:"Video",group:"Media",make:()=>({heading:"",url:""})},
    events:{name:"Upcoming events",group:"Lodge",make:()=>({heading:"Upcoming",count:6})},
    fundraisers:{name:"Fundraisers",group:"Lodge",make:()=>({heading:"Support our fundraisers",body:""})},
    officers:{name:"Officers",group:"Lodge",make:()=>({heading:"Our officers",bg:"tint"})},
    contact:{name:"Contact and meetings",group:"Lodge",make:()=>({heading:"Visit us",body:"Visitors and Masons in good standing are always welcome."})},
    give:{name:"Give to the lodge",group:"Lodge",make:()=>({heading:"Give to the lodge",body:"Your gift supports our charities and the upkeep of the lodge."})},
    store:{name:"Lodge store",group:"Lodge",make:()=>({heading:"Lodge store",body:"Pay the lodge directly with the button you prefer, and put the item, size and your name in the payment note."})},
    html:{name:"Custom HTML",group:"Advanced",make:()=>({html:""})}
  };
  const newSection=(type,over)=>Object.assign({id:uid(),type,bg:"plain"},SECTIONS[type].make(),over||{});

  /* a Home page built from what a lodge already had before the builder (About text, banner, gallery, store) */
  function defaultHome(s){
    const im=s.images||{},about=String(s.about||"").trim(),gal=(im.gallery||[]).filter(okImg);
    const L=[newSection("hero",{image:okImg(im.hero)?im.hero:""})];
    if(about)L.push(newSection("text",{heading:"About the lodge",body:about}));
    L.push(newSection("events"),newSection("officers"));
    if((s.store||[]).length)L.push(newSection("store"));
    if(gal.length)L.push(newSection("gallery",{images:gal}));
    L.push(newSection("contact"),newSection("give",{bg:"tint"}));
    return {id:"home",slug:"",title:"Home",nav:true,sections:L};
  }
  const pagesOf=s=>s.layout&&Array.isArray(s.layout.pages)&&s.layout.pages.length?s.layout.pages:[defaultHome(s)];

  /* page templates for "Add page" */
  const TEMPLATES={
    blank:{name:"Blank page",title:"New page",make:()=>[newSection("text")]},
    about:{name:"About the lodge",title:"About",make:()=>[newSection("hero",{heading:"About the lodge",height:"short"}),newSection("imageText"),newSection("features",{bg:"tint"}),newSection("officers",{bg:"plain"})]},
    join:{name:"Become a Mason",title:"Become a Mason",make:()=>[newSection("hero",{heading:"Become a Mason",sub:"To be one, ask one.",height:"short"}),
      newSection("text",{heading:"Who can join",body:"Freemasonry welcomes good men of every background who believe in a Supreme Being and want to make themselves and their communities better.\n\nA man must be of lawful age, of good character and recommended by members of the lodge."}),
      newSection("features",{heading:"How it works",bg:"tint",items:[{title:"Ask",body:"Talk with any member, or send us a note below."},{title:"Meet",body:"Have dinner with the brethren and get to know us."},{title:"Petition",body:"When you're ready, fill out a petition to join."}]}),
      newSection("cta",{heading:"Ready to talk?",body:"We'd be glad to answer your questions.",button:{label:"Contact the lodge",link:""}})]},
    events:{name:"Events",title:"Events",make:()=>[newSection("hero",{heading:"Events",height:"short"}),newSection("events",{count:12}),newSection("fundraisers",{bg:"tint"})]},
    contact:{name:"Contact",title:"Contact",make:()=>[newSection("hero",{heading:"Contact the lodge",height:"short"}),newSection("contact"),newSection("give",{bg:"tint"})]},
    fundraiser:{name:"Fundraiser",title:"Fundraiser",make:()=>[newSection("hero",{heading:"Our fundraiser",sub:"Join us and support a good cause.",height:"short"}),newSection("text",{heading:"What it's for",body:"Tell supporters what the money will do."}),newSection("fundraisers"),newSection("give",{bg:"tint"})]}
  };

  /* whole-site designs a lodge can start from (the Website overview and Design panel) */
  const S=newSection;
  const SITE_TEMPLATES={
    traditional:{name:"Traditional Lodge",desc:"Dignified and classic: a full-width banner, history and officers.",color:"#1c3a75",theme:{font:"heritage",btn:"square",header:"center"},
      pages:()=>[{id:"home",slug:"",title:"Home",nav:true,sections:[S("hero",{layout:"center"}),S("text",{heading:"About the lodge",body:"Tell visitors when the lodge was chartered, what it stands for, and how it serves the community.",align:"center"}),
        S("features",{bg:"tint"}),S("events"),S("officers",{bg:"tint"}),S("contact"),S("give",{bg:"color"})]},
        tp("about","About"),tp("join","Become a Mason"),tp("contact","Contact")]},
    bold:{name:"Bold Community",desc:"Big type beside a photo, and fundraisers up front.",color:"#6b1f2a",theme:{font:"modern",btn:"rounded",header:"left"},
      pages:()=>[{id:"home",slug:"",title:"Home",nav:true,sections:[S("hero",{layout:"split",heading:"Good men. Doing good.",button:{label:"Become a Mason",link:""}}),
        S("fundraisers",{bg:"tint"}),S("imageText",{side:"right"}),S("events"),S("gallery",{bg:"tint"}),S("cta",{bg:"color"}),S("give")]},
        tp("events","Events"),tp("join","Become a Mason"),tp("contact","Contact")]},
    heritage:{name:"Heritage",desc:"Warm and storied: picture-and-text history, columns and meetings.",color:"#264d3b",theme:{font:"classic",btn:"rounded",header:"center"},
      pages:()=>[{id:"home",slug:"",title:"Home",nav:true,sections:[S("hero",{layout:"left"}),S("imageText"),S("features",{style:"cards",bg:"tint"}),S("events"),S("officers"),S("contact",{bg:"tint"})]},
        tp("about","Our history"),tp("join","Membership"),tp("contact","Visit")]},
    modern:{name:"Modern Charity",desc:"Clean and current, built around giving and the store.",color:"#22252c",theme:{font:"modern",btn:"square",header:"left"},
      pages:()=>[{id:"home",slug:"",title:"Home",nav:true,sections:[S("hero",{layout:"split",heading:"Building better communities",sub:"Charity, fellowship and service, one neighbor at a time."}),
        S("features",{style:"cards",heading:"Where your support goes",items:[{title:"Scholarships",body:"Helping local students reach college."},{title:"Relief",body:"Quiet help for families in need."},{title:"Community",body:"Events that bring the town together."}]}),
        S("fundraisers",{bg:"tint"}),S("store"),S("cta",{bg:"color",heading:"Every gift makes a difference",body:"Give online in under a minute.",button:{label:"Give now",link:""}}),S("give")]},
        tp("fundraiser","Fundraisers"),tp("about","About"),tp("contact","Contact")]},
    fundraiser:{name:"Fundraising Focus",desc:"One clear call to give, with progress and events.",color:"#3d2f5a",theme:{font:"classic",btn:"rounded",header:"center"},
      pages:()=>[{id:"home",slug:"",title:"Home",nav:true,sections:[S("hero",{layout:"center",heading:"Help us reach our goal",sub:"Every dollar stays in our community.",button:{label:"See our fundraisers",link:""}}),
        S("fundraisers"),S("text",{heading:"Why we give",body:"Share the story behind the cause: who it helps and why it matters to the lodge.",align:"center",bg:"tint"}),S("events"),S("give",{bg:"color"})]},
        tp("events","Events"),tp("about","About"),tp("contact","Contact")]}
  };
  function tp(k,title){const t=TEMPLATES[k];return {id:"p"+Math.random().toString(36).slice(2,9),title,slug:title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),nav:true,sections:t.make()}}

  /* ---------- pieces ---------- */
  const parse=d=>{const [y,m,day]=String(d).split("-").map(Number);return new Date(y,m-1,day)};
  const money=n=>"$"+(+n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const CREST='<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6 12 46M32 6l20 40"/><path d="M8 34l24 22 24-22"/><path d="M20 46h24"/></g><text x="32" y="38" text-anchor="middle" font-family="Montserrat,sans-serif" font-weight="800" font-size="13" fill="currentColor">G</text></svg>';
  const paras=t=>String(t||"").trim().split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p.trim()).replace(/\n/g,"<br>")}</p>`).join("");
  function frameDoc(html){
    const SIZER='<script>(function(){function s(){parent.postMessage({lodgenetFrame:1,h:Math.ceil(document.documentElement.scrollHeight)},"*")}addEventListener("load",s);try{new ResizeObserver(s).observe(document.documentElement)}catch(e){}setTimeout(s,60)})()<\/script>';
    html=String(html||"").slice(0,HTML_MAX);
    if(/<!doctype|<html[\s>]/i.test(html)){let d=html;
      if(!/<base\s/i.test(d)&&/<head[^>]*>/i.test(d))d=d.replace(/<head[^>]*>/i,m=>m+'<base target="_blank">');
      return /<\/body>/i.test(d)?d.replace(/<\/body>/i,()=>SIZER+"</body>"):d+SIZER}
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+(/<base\s/i.test(html)?"":'<base target="_blank">')
      +'<style>body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d2433}img,video,iframe{max-width:100%}</style></head><body>'+html+SIZER+"</body></html>";
  }
  let wired=false;
  function wire(){if(wired||typeof addEventListener!=="function")return;wired=true;
    addEventListener("message",e=>{if(!e.data||e.data.lodgenetFrame!==1)return;
      document.querySelectorAll("iframe.ls-frame").forEach(f=>{if(f.contentWindow===e.source)f.style.height=Math.min(20000,Math.max(40,+e.data.h||0))+"px"})})}
  function videoSrc(u){u=String(u||"").trim();let m;
    if((m=/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,15})/i.exec(u)))return "https://www.youtube-nocookie.com/embed/"+m[1];
    if((m=/vimeo\.com\/(?:video\/)?(\d{5,12})/i.exec(u)))return "https://player.vimeo.com/video/"+m[1];
    if((m=/facebook\.com\/.+\/videos\/(\d+)/i.exec(u)))return "https://www.facebook.com/plugins/video.php?href="+encodeURIComponent(u);
    return ""}

  /* where a stored link goes on the published site; "" when its page or fundraiser is gone */
  function resolve(site,link,root){
    link=String(link||"");root=root||"";
    if(link==="home")return root||"/";
    if(link.startsWith("page:")){const p=pagesOf(site).find(x=>x.id===link.slice(5));return p?root+(p.slug?"/"+p.slug:""):""}
    if(link.startsWith("fund:")){const f=(site.funds||[]).find(x=>x.id===link.slice(5));return f?root+"/fundraiser/"+f.id:""}
    return /^\/site\//.test(link)?"":safeHref(link);
  }

  /* ---------- the page ---------- */
  function render(site,o){
    o=o||{};wire();
    const E=!!o.edit,th=Object.assign({},THEME,(site.layout&&site.layout.theme)||{}),F=FONTS[th.font]||FONTS.modern;
    const color=/^#[0-9a-f]{6}$/i.test(site.color||"")?site.color:"#1c3a75";
    const root=o.root||"",pages=pagesOf(site),funds=site.funds||[];
    const today=new Date();today.setHours(0,0,0,0);
    const place=[site.city,site.state].filter(Boolean).join(", ");
    const full=site.full||site.name||"Our Lodge";
    const href=link=>resolve(site,link,root);
    /* text the builder can type into: in the editor it's always there (with a hint when empty); on the live site empty text is left out */
    const T=(tag,cls,f,val,ph)=>E?`<${tag} class="${cls}" data-f="${f}" data-ph="${esc(ph||"")}">${esc(val||"")}</${tag}>`:(String(val||"").trim()?`<${tag} class="${cls}">${esc(val)}</${tag}>`:"");
    const B=(t,cls)=>E?`<div class="ls-body ${cls||""}" data-f="body" data-ph="Write something here">${esc(t||"")}</div>`:(String(t||"").trim()?`<div class="ls-body ${cls||""}">${esc(t)}</div>`:"");
    const btn=(b,f,cls)=>{b=b||{};const h=href(b.link);
      if(!b.label||(!h&&!E))return "";
      return `<a class="ls-btn ${cls||""}" href="${esc(h||"#")}"${/^https:/i.test(h)?' target="_blank" rel="noopener"':""}${E?` data-f="${f}.label" data-ph="Button"`:""}>${esc(b.label)}</a>`};
    const img=(u,f,cls,alt)=>okImg(u)?`<img class="${cls}" src="${esc(u)}" alt="${esc(alt||"")}" loading="lazy"${E?` data-img="${f}"`:""}>`
      :E?`<button type="button" class="${cls} ls-noimg" data-img="${f}"><span>Add a picture</span></button>`:"";
    const empty=t=>`<p class="ls-empty">${esc(t)}</p>`;
    const giveBtns=()=>{const g=site.give||[],links=g.filter(x=>safeHref(x.url));
      return (links.length?`<div class="ls-btns">${links.map(x=>`<a class="ls-btn" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join("")}</div>`:"")
        +g.filter(x=>!safeHref(x.url)&&x.note).map(x=>`<p class="ls-note"><b>${esc(x.label)}:</b> ${esc(x.note)}</p>`).join("")};
    const head=s=>T("h2","ls-h2","heading",s.heading,"Section heading");

    const R={
      hero:s=>{const sub=s.sub||[place,site.schedule?"Stated Communications "+site.schedule:""].filter(Boolean).join(" · ");
        const lay=s.layout||(s.align==="left"?"left":"center");
        if(lay==="split")return `<div class="ls-hs ls-h-${s.height==="short"?"short":"tall"}"><div class="ls-wrap ls-hs-in">
          <div class="ls-hs-txt"><div class="ls-hs-card">${T("h1","ls-h1","heading",s.heading||full,"Page heading")}${T("p","ls-sub","sub",sub,"A short line under the heading")}</div>${btn(s.button,"button","ls-btn-block")}</div>
          <div class="ls-hs-pic">${img(s.image,"image","ls-hs-img",s.heading||full)}</div></div></div>`;
        const bg=okImg(s.image)?` style="background-image:linear-gradient(rgba(10,14,22,.45),rgba(10,14,22,.62)),url('${esc(s.image)}')"`:"";
        return `<div class="ls-hero ls-h-${s.height==="short"?"short":"tall"} ls-al-${lay==="left"?"left":"center"}${bg?" has-img":""}"${bg}><div class="ls-wrap">
          ${T("h1","ls-h1","heading",s.heading||full,"Page heading")}${T("p","ls-sub","sub",sub,"A short line under the heading")}${btn(s.button,"button")}
          ${E?`<button type="button" class="ls-hero-pic" data-img="image">${okImg(s.image)?"Change background picture":"Add a background picture"}</button>`:""}</div></div>`},
      text:s=>`<div class="ls-wrap ls-narrow ls-al-${s.align==="center"?"center":"left"}">${head(s)}${B(s.body)}</div>`,
      imageText:s=>`<div class="ls-wrap ls-split${s.side==="right"?" ls-flip":""}"><div class="ls-split-pic">${img(s.image,"image","ls-pic",s.heading)}</div>
        <div class="ls-split-txt">${head(s)}${B(s.body)}${btn(s.button,"button")}</div></div>`,
      features:s=>`<div class="ls-wrap">${head(s)}<div class="ls-cols${s.style==="cards"?" ls-cols-cards":""}">${(s.items||[]).map((it,i)=>`<div class="ls-col">
          ${T("h3","ls-h3",`items.${i}.title`,it.title,"Title")}${E?`<div class="ls-body" data-f="items.${i}.body" data-ph="A sentence or two">${esc(it.body||"")}</div>`:it.body?`<div class="ls-body">${esc(it.body)}</div>`:""}</div>`).join("")}</div></div>`,
      cta:s=>`<div class="ls-wrap ls-narrow ls-al-center">${head(s)}${B(s.body)}${btn(s.button,"button","ls-btn-lg")}</div>`,
      gallery:s=>{const g=(s.images||[]).filter(okImg);
        return `<div class="ls-wrap">${head(s)}${g.length?`<div class="ls-gal">${g.map((u,i)=>`<button type="button" class="ls-gal-i" data-zoom="${i}" aria-label="Open photo ${i+1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}</div>`
          :E?`<button type="button" class="ls-noimg ls-gal-empty" data-img="images"><span>Add photos</span></button>`:""}</div>`},
      video:s=>{const v=videoSrc(s.url);
        return `<div class="ls-wrap ls-narrow">${head(s)}${v?`<div class="ls-video"><iframe src="${esc(v)}" title="${esc(s.heading||"Video")}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
          :E?'<div class="ls-noimg ls-video-empty"><span>Paste a YouTube or Vimeo link in the panel on the left</span></div>':""}</div>`},
      events:s=>{const ev=(site.events||[]).filter(e=>parse(e.d)>=today).slice(0,+s.count||6);
        return `<div class="ls-wrap">${head(s)}${ev.length?`<ul class="ls-events">${ev.map(e=>{const d=parse(e.d),f=e.fid&&funds.find(x=>x.id===e.fid);
          return `<li><div class="ls-date"><span>${d.toLocaleDateString("en-US",{month:"short"})}</span><b>${d.getDate()}</b></div><div><div class="ls-ev-t">${f?`<a href="${esc(root+"/fundraiser/"+f.id)}">${esc(e.t)}</a>`:esc(e.t)}${e.fund?'<span class="ls-tag">Fundraiser</span>':""}</div>
            <div class="ls-ev-s">${esc(d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))}${e.time&&!/not set|to be announced/i.test(e.time)?" · "+esc(e.time):""}</div></div></li>`}).join("")}</ul>`
          :empty("No upcoming events posted yet. Check back soon.")}${E?'<p class="ls-hint">Events come from the lodge calendar (Communications → Calendar).</p>':""}</div>`},
      fundraisers:s=>{const fr=funds.filter(f=>parse(f.d)>=today).sort((a,b)=>a.d<b.d?-1:1);
        return `<div class="ls-wrap">${head(s)}${B(s.body)}${fr.length?`<div class="ls-cards">${fr.map(f=>{const pct=f.goal?Math.min(100,Math.round(f.raised/f.goal*100)):0;
          return `<a class="ls-card" href="${esc(root+"/fundraiser/"+f.id)}"><span class="ls-tag">${esc(parse(f.d).toLocaleDateString("en-US",{month:"long",day:"numeric"}))}</span><h3 class="ls-h3">${esc(f.t)}</h3>
            ${f.goal?`<div class="ls-goal"><i style="width:${pct}%"></i></div><span class="ls-note">${money(f.raised)} of ${money(f.goal)}</span>`:""}<span class="ls-more">Learn more and give →</span></a>`}).join("")}</div>`
          :empty("No fundraisers coming up right now.")}${E?'<p class="ls-hint">Fundraisers come from the Fundraiser tab.</p>':""}</div>`},
      officers:s=>`<div class="ls-wrap">${head(s)}${(site.officers||[]).length?`<div class="ls-officers">${site.officers.map(x=>`<div class="ls-officer"><span>${esc(x.seat)}</span><b>${esc(x.name)}</b></div>`).join("")}</div>`
        :empty("Officers to be announced.")}${E?'<p class="ls-hint">Officers come from the chairs on Members.</p>':""}</div>`,
      contact:s=>{const soc=(site.social||[]).filter(x=>safeHref(x.url));
        return `<div class="ls-wrap ls-split ls-split-even"><div>${head(s)}${B(s.body)}</div><div class="ls-contact">
          ${site.schedule?`<div><span class="ls-lbl">Stated Communications</span><b>${esc(site.schedule)}</b></div>`:""}
          ${place?`<div><span class="ls-lbl">Where</span><b>${esc(place)}</b></div>`:""}
          ${site.email?`<div><span class="ls-lbl">Email</span><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></div>`:""}
          ${soc.length?`<div class="ls-btns">${soc.map(x=>`<a class="ls-btn ls-btn-line" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}</div>`:""}
          ${!site.schedule&&!site.email&&!soc.length?empty("Visit us at a Stated Communication."):""}
          ${E?'<p class="ls-hint">Meeting time, email and social links are under Settings in this panel.</p>':""}</div></div>`},
      give:s=>{const g=giveBtns();
        return `<div class="ls-wrap ls-narrow ls-al-center">${head(s)}${B(s.body)}${g||(E?'<p class="ls-hint">Add PayPal, Venmo, Cash App, Zelle or a pay link under the dashboard\'s Settings → Payment options.</p>':"")}</div>`},
      store:s=>{const items=site.store||[],pay=site.pay||[],enc=encodeURIComponent,amt=n=>(+n||0).toFixed(2);
        const payUrl=(p,n,note)=>p.k==="cashapp"?`https://cash.app/$${enc(p.v)}/${amt(n)}`:p.k==="paypal"?`https://paypal.me/${enc(p.v)}/${amt(n)}USD`
          :p.k==="venmo"?`https://venmo.com/?txn=pay&recipients=${enc(p.v)}&amount=${amt(n)}&note=${enc(note)}`:p.k==="link"?safeHref(p.v):"";
        return `<div class="ls-wrap">${head(s)}${B(s.body)}${items.length?`<div class="ls-store">${items.map(it=>{
          const links=pay.map(p=>{const u=payUrl(p,it.p,it.n+" from "+full);return u?`<a class="ls-btn ls-btn-sm" href="${esc(u)}" target="_blank" rel="noopener">${esc(p.label)}</a>`:""}).join("");
          const notes=pay.filter(p=>p.k==="zelle"||p.k==="check").map(p=>`<p class="ls-note">${esc(p.label)}: ${esc(p.k==="zelle"?"send "+money(it.p)+" to "+p.v:"mail "+money(it.p)+" to "+p.v)}</p>`).join("");
          const mail=site.email?`<a class="ls-btn ls-btn-sm ls-btn-line" href="mailto:${esc(site.email)}?subject=${enc("Order: "+it.n)}">Email to order</a>`:"";
          return `<div class="ls-item"><div class="ls-item-pic"${okImg(it.img)?` style="background-image:url('${esc(it.img)}')"`:""}>${okImg(it.img)?"":CREST}</div>
            <div class="ls-item-b"><b>${esc(it.n)}</b><span class="ls-price">${money(it.p)}</span>${it.sizes?`<span class="ls-note">Sizes: ${esc(it.sizes)}</span>`:""}
            <div class="ls-btns">${links||mail||'<span class="ls-note">Ask at the lodge to order.</span>'}${links&&mail?mail:""}</div>${notes}</div></div>`}).join("")}</div>`
          :empty(E?"Items you mark as showing on Merchandise appear here (paid plans).":"The store is being stocked. Check back soon.")}</div>`},
      html:s=>String(s.html||"").trim()?`<iframe class="ls-frame" title="Lodge content" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" referrerpolicy="no-referrer" srcdoc="${esc(frameDoc(s.html))}" style="height:140px"></iframe>`
        :E?'<div class="ls-wrap"><div class="ls-noimg ls-video-empty"><span>Paste your HTML in the panel on the left</span></div></div>':""
    };
    const section=s=>R[s.type]?`<section class="ls-sec ls-t-${s.type} ls-bg-${s.type==="hero"?"none":s.bg==="tint"||s.bg==="color"?s.bg:"plain"}" data-sid="${esc(s.id)}">${R[s.type](s)}</section>`:"";

    /* which page */
    let body="";
    if(o.view==="fund"){const f=o.fund;
      if(f){const d=parse(f.d),over=d<today,pct=f.goal?Math.min(100,Math.round(f.raised/f.goal*100)):0,g=giveBtns();
        body=`<section class="ls-sec ls-bg-plain"><div class="ls-wrap ls-narrow"><span class="ls-tag">Fundraiser</span><h1 class="ls-h1 ls-dark">${esc(f.t)}</h1>
          <p class="ls-lead">${esc(d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}))}${f.time&&!/not set|to be announced/i.test(f.time)?" · "+esc(f.time):""}</p>
          ${f.charity?`<p class="ls-note">Proceeds support ${esc(f.charity)}.</p>`:""}${f.note?`<div class="ls-body">${esc(f.note)}</div>`:""}
          ${f.goal?`<div class="ls-goal ls-goal-lg"><i style="width:${pct}%"></i></div><p class="ls-note">${money(f.raised)} raised of ${money(f.goal)}</p>`:""}
          ${over?'<p><b>This fundraiser has ended. Thank you to everyone who came out and gave.</b></p>':""}
          ${g?`<h2 class="ls-h2">${over?"You can still give to the lodge":"Give now"}</h2>${g}<p class="ls-note">Put "${esc(f.t)}" in the payment note so it's counted.</p>`:""}</div></section>`}
      else body=`<section class="ls-sec ls-bg-plain"><div class="ls-wrap ls-narrow"><h1 class="ls-h1 ls-dark">That fundraiser isn't here</h1><p><a class="ls-btn" href="${esc(root||"/")}">Go to the home page</a></p></div></section>`;
    }else if(o.view==="404")body=`<section class="ls-sec ls-bg-plain"><div class="ls-wrap ls-narrow"><h1 class="ls-h1 ls-dark">That page isn't here</h1><p class="ls-lead">It may have moved or been taken down.</p><p><a class="ls-btn" href="${esc(root||"/")}">Go to the home page</a></p></div></section>`;
    else{const p=o.page||pages[0];body=(p.sections||[]).map(section).join("")||(E?"":empty("This page is being written. Check back soon."))}

    const cur=o.page&&o.page.id;
    const nav=pages.filter(p=>p.nav!==false).map(p=>`<a href="${esc(root+(p.slug?"/"+p.slug:""))}"${p.id===cur?' aria-current="page"':""}${E?` data-goto="${esc(p.id)}"`:""}>${esc(p.title)}</a>`).join("");
    const logo=okImg((site.images||{}).logo)?`<img class="ls-logo" src="${esc(site.images.logo)}" alt="">`:`<span class="ls-crest">${CREST}</span>`;
    const soc=(site.social||[]).filter(x=>safeHref(x.url));
    return `<div class="lsite" data-font="${esc(th.font)}" data-btn="${th.btn==="square"?"square":"rounded"}" data-head="${th.header==="left"?"left":"center"}" style="--c:${color};--hf:${esc(F.head)};--bf:${esc(F.body)}">
      <header class="ls-head"><div class="ls-wrap ls-head-in"><a class="ls-brand" href="${esc(root||"/")}"${E?' data-goto="home"':""}>${logo}<span><b>${esc(full)}</b>${site.jur||site.grandLodge?`<small>${esc([site.jur,site.grandLodge].filter(Boolean).join(" · "))}</small>`:""}</span></a>
        ${nav&&pages.length>1?`<nav class="ls-nav" aria-label="Site">${nav}</nav>`:""}</div></header>
      <main>${body}</main>
      <footer class="ls-foot"><div class="ls-wrap"><div><b>${esc(full)}</b>${site.schedule?`<span>Stated Communications ${esc(site.schedule)}</span>`:""}${place?`<span>${esc(place)}</span>`:""}</div>
        ${soc.length?`<div class="ls-foot-soc">${soc.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}</div>`:""}
        <small>© ${new Date().getFullYear()} ${esc(full)} · Website by <a href="https://www.lodgenet.app/">LodgeNet</a></small></div></footer>
    </div>`;
  }

  window.LodgeSite={render,resolve,SITE_TEMPLATES,SECTIONS,TEMPLATES,FONTS,THEME,fontHref,newSection,defaultHome,pagesOf,esc,safeHref,okImg,videoSrc,HTML_MAX};
})();
