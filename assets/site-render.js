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
  const payUrl=(p,n,note)=>{const enc=encodeURIComponent,amt=v=>(+v||0).toFixed(2);
    return p.k==="cashapp"?`https://cash.app/$${enc(p.v)}/${amt(n)}`:p.k==="paypal"?`https://paypal.me/${enc(p.v)}/${amt(n)}USD`
      :p.k==="venmo"?`https://venmo.com/?txn=pay&recipients=${enc(p.v)}&amount=${amt(n)}&note=${enc(note)}`:p.k==="link"?safeHref(p.v):""};
  const LOCK='<svg class="ls-lock" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>';
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
    charities:{name:"Charities",group:"Lodge",make:()=>({heading:"The causes we support",body:"Every fundraiser and store purchase helps these funds and charities."})},
    sponsors:{name:"Sponsors",group:"Lodge",make:()=>({heading:"Thank you to our sponsors",body:"These local businesses help make our work possible."})},
    news:{name:"News",group:"Lodge",make:()=>({heading:"Lodge news",count:6})},
    dues:{name:"Pay dues",group:"Lodge",make:()=>({heading:"Pay your dues",body:"Pay online with the button you prefer. Put your name and the year in the payment note so the Secretary can mark you paid."})},
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

  const orgJoin=()=>(window.LodgeOrg&&window.LodgeOrg.current&&window.LodgeOrg.current.join)||{title:"Become a Mason",sub:"To be one, ask one.",who:"Freemasonry welcomes good men of every background who believe in a Supreme Being and want to make themselves and their communities better.\n\nA man must be of lawful age, of good character and recommended by members of the lodge."};
  /* page templates for "Add page", in groups. A template with members:true makes a members-only page. */
  const TEMPLATE_GROUPS=["Basics","Lodge life","Giving","Members"];
  const TEMPLATES={
    blank:{name:"Blank page",group:"Basics",title:"New page",make:()=>[newSection("text")]},
    about:{name:"About the lodge",group:"Basics",title:"About",make:()=>[newSection("hero",{heading:"About the lodge",height:"short"}),newSection("imageText"),newSection("features",{bg:"tint"}),newSection("officers",{bg:"plain"})]},
    history:{name:"Our history",group:"Basics",title:"Our history",make:()=>[newSection("hero",{heading:"Our history",sub:"More than a century of brotherly love, relief and truth.",height:"short"}),
      newSection("imageText",{heading:"How it began",body:"Tell the story of the lodge's charter: the year, the founding brethren and the first place the lodge met."}),
      newSection("text",{heading:"Through the years",body:"Share the moments the lodge is proud of: new halls, centennials, service to the town and brethren who made a difference.",bg:"tint"}),
      newSection("text",{heading:"Past Masters",body:"List the brethren who have served as Worshipful Master, one per line, with their years."}),newSection("gallery",{heading:"From the archives"})]},
    contact:{name:"Contact",group:"Basics",title:"Contact",make:()=>[newSection("hero",{heading:"Contact the lodge",height:"short"}),newSection("contact"),newSection("give",{bg:"tint"})]},
    events:{name:"Events",group:"Lodge life",title:"Events",make:()=>[newSection("hero",{heading:"Events",sub:"Stated Communications, degree nights and public events.",height:"short"}),newSection("events",{count:"12"}),newSection("fundraisers",{bg:"tint"})]},
    join:{get name(){return orgJoin().title},group:"Lodge life",get title(){return orgJoin().title},make:()=>[newSection("hero",{heading:orgJoin().title,sub:orgJoin().sub,height:"short"}),
      newSection("text",{heading:"Who can join",body:orgJoin().who}),
      newSection("features",{heading:"How it works",bg:"tint",items:[{title:"Ask",body:"Talk with any member, or send us a note below."},{title:"Meet",body:"Have dinner with the brethren and get to know us."},{title:"Petition",body:"When you're ready, fill out a petition to join."}]}),
      newSection("cta",{heading:"Ready to talk?",body:"We'd be glad to answer your questions.",button:{label:"Email the lodge",link:"email"}})]},
    visitors:{name:"Visiting brethren",group:"Lodge life",title:"Visiting brethren",make:()=>[newSection("hero",{heading:"Visiting brethren",sub:"Traveling Masons are always welcome.",height:"short"}),
      newSection("text",{heading:"Before you come",body:"Bring your current dues card. Dinner is served before each Stated Communication, and dress is coat and tie.\n\nLet us know you're coming and a brother will meet you at the door."}),
      newSection("contact",{heading:"When and where",body:"",bg:"tint"}),newSection("events",{heading:"Coming up",count:"6"})]},
    officers:{name:"Officers",group:"Lodge life",title:"Officers",make:()=>[newSection("hero",{heading:"Our officers",height:"short"}),newSection("officers",{bg:"plain"}),newSection("contact",{bg:"tint"})]},
    newsletter:{name:"Newsletter (Trestleboard)",group:"Lodge life",title:"Trestleboard",make:()=>[newSection("hero",{heading:"The Trestleboard",sub:"News and notes from the lodge.",height:"short"}),
      newSection("text",{body:"Our newsletter keeps brethren, families and friends up to date: the Worshipful Master's message, upcoming degrees, birthdays, and news from around the lodge.",align:"center"}),
      newSection("news",{heading:"Latest news",count:"12"}),
      newSection("cta",{heading:"Get the Trestleboard by email",body:"Send us your name and email address and we'll add you to the list.",button:{label:"Subscribe by email",link:"email"},bg:"color"})]},
    gallery:{name:"Photo gallery",group:"Lodge life",title:"Photos",make:()=>[newSection("hero",{heading:"Photos",sub:"Life at the lodge.",height:"short"}),newSection("gallery",{heading:"Lodge events"}),newSection("gallery",{heading:"In the community",bg:"tint"})]},
    donations:{name:"Donations",group:"Giving",title:"Donate",make:()=>[newSection("hero",{heading:"Support our work",sub:"Every gift stays in our community.",height:"short"}),
      newSection("give",{heading:"Give online",body:"Choose the way you'd like to give. Put the fund or cause in the payment note."}),
      newSection("features",{heading:"Where your gift goes",bg:"tint",items:[{title:"Scholarships",body:"Helping local students reach college and trade school."},{title:"Relief",body:"Quiet help for brethren, widows and neighbors in need."},{title:"Community",body:"Food drives, child ID programs and service across town."}]}),
      newSection("charities"),newSection("fundraisers",{bg:"tint"})]},
    fundraiser:{name:"Fundraiser",group:"Giving",title:"Fundraiser",make:()=>[newSection("hero",{heading:"Our fundraiser",sub:"Join us and support a good cause.",height:"short"}),newSection("text",{heading:"What it's for",body:"Tell supporters what the money will do."}),newSection("fundraisers"),newSection("give",{bg:"tint"})]},
    dues:{name:"Pay dues",group:"Giving",title:"Pay dues",make:()=>[newSection("hero",{heading:"Pay your dues",sub:"Thank you for keeping the lodge strong.",height:"short"}),newSection("dues"),
      newSection("text",{heading:"Questions about dues?",body:"Dues are payable by December 31. If you're facing hardship, speak with the Worshipful Master or Secretary in confidence.",bg:"tint"}),newSection("contact",{heading:"Contact the Secretary"})]},
    scholarships:{name:"Scholarships",group:"Giving",title:"Scholarships",make:()=>[newSection("hero",{heading:"Scholarships",sub:"Investing in the next generation.",height:"short"}),
      newSection("text",{heading:"Who can apply",body:"Describe who's eligible (for example, graduating seniors in the county), the amount awarded and the deadline."}),
      newSection("features",{heading:"How to apply",bg:"tint",items:[{title:"Request a form",body:"Email the lodge for this year's application."},{title:"Send it in",body:"Return it with your transcript and a short essay."},{title:"Hear back",body:"Winners are announced in the spring."}]}),
      newSection("cta",{heading:"Ask for an application",button:{label:"Email the lodge",link:"email"}})]},
    store:{name:"Lodge store",group:"Giving",title:"Store",make:()=>[newSection("hero",{heading:"Lodge store",sub:"Every purchase supports our lodge and its charities.",height:"short"}),newSection("store"),newSection("give",{bg:"tint"})]},
    rental:{name:"Hall rental",group:"Giving",title:"Rent our hall",make:()=>[newSection("hero",{heading:"Rent our hall",sub:"A welcoming space for meetings, parties and receptions.",height:"short"}),
      newSection("imageText",{heading:"The space",body:"Describe the hall: how many people it seats, the kitchen, parking and what's included."}),
      newSection("features",{heading:"Good to know",bg:"tint",items:[{title:"Capacity",body:"Seats up to 120 for dinner."},{title:"Kitchen",body:"Full kitchen available."},{title:"Parking",body:"Free parking on site."}]}),
      newSection("cta",{heading:"Check a date",body:"Tell us the date and the event and we'll get back to you.",button:{label:"Email the lodge",link:"email"}})]},
    members:{name:"Members only",group:"Members",title:"Members",members:true,make:()=>[newSection("hero",{heading:"Brethren's corner",sub:"For members of the lodge. Signed-in brethren only.",height:"short"}),
      newSection("text",{heading:"Welcome, Brother",body:"Share what brethren need: the Worshipful Master's message, the degree schedule, who to call for relief, and reminders for the month."}),
      newSection("news",{heading:"Lodge news",bg:"tint"}),newSection("events",{heading:"On the calendar"}),newSection("dues",{bg:"tint"}),
      newSection("text",{heading:"Lodge documents",body:"List the by-laws, minutes and forms brethren can ask the Secretary for, or link to them with buttons."})]}
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
    if(link==="email")return /^[^@\s"<>]+@[^@\s"<>]+\.[a-z]{2,}$/i.test(site.email||"")?"mailto:"+site.email:"";
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
    /* the regular meeting's name follows the organization type: Stated Communications, Stated Meetings, Club Meetings… */
    const MEET=site.meetings||"Stated Communications";
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
        +g.filter(x=>!safeHref(x.url)&&x.note).map(x=>`<p class="ls-note"><b>${esc(x.label)}:</b> ${esc(x.note)}</p>`).join("")
        +(site.ein&&/^[0-9 -]{9,12}$/.test(site.ein)?`<p class="ls-note">${esc(full)} is a nonprofit organization. Tax ID (EIN): ${esc(site.ein)}.</p>`:"")};
    const head=s=>T("h2","ls-h2","heading",s.heading,"Section heading");

    const R={
      hero:s=>{const sub=s.sub||[place,site.schedule?MEET+" "+site.schedule:""].filter(Boolean).join(" · ");
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
          ${site.schedule?`<div><span class="ls-lbl">${esc(MEET)}</span><b>${esc(site.schedule)}</b></div>`:""}
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
      charities:s=>{const c=site.charities||[];
        return `<div class="ls-wrap">${head(s)}${B(s.body)}${c.length?`<div class="ls-cards">${c.map(x=>{const fr=funds.filter(f=>f.charity===x.name&&parse(f.d)>=today);
          return `<div class="ls-card ls-card-static"><span class="ls-tag">${esc(x.kind||"Charity")}</span><h3 class="ls-h3">${esc(x.name)}</h3>${x.note?`<span class="ls-note">${esc(x.note)}</span>`:""}
            ${fr.map(f=>`<a class="ls-more" href="${esc(root+"/fundraiser/"+f.id)}">${esc(f.t)} →</a>`).join("")}</div>`}).join("")}</div>`:empty("Our charities will be listed here soon.")}
          ${E?'<p class="ls-hint">Charities come from the Charities tab.</p>':""}</div>`},
      sponsors:s=>{const sp=site.sponsors||[];
        return `<div class="ls-wrap ls-al-center">${head(s)}${B(s.body)}${sp.length?`<div class="ls-sponsors">${sp.map(x=>`<div class="ls-sponsor"><b>${esc(x.name)}</b>${x.level?`<span>${esc(x.level)}</span>`:""}</div>`).join("")}</div>`:empty("Sponsor recognition coming soon.")}
          ${E?'<p class="ls-hint">Active sponsors come from the Sponsors tab.</p>':""}</div>`},
      news:s=>{const n=(site.news||[]).slice(0,+s.count||6);
        return `<div class="ls-wrap ls-narrow">${head(s)}${n.length?`<div class="ls-news">${n.map(x=>`<article><span class="ls-tag">${esc(parse(x.d).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}))}</span><h3 class="ls-h3">${esc(x.subject)}</h3>${x.body?`<div class="ls-body">${esc(x.body)}</div>`:""}</article>`).join("")}</div>`
          :empty("No news posted yet.")}${E?'<p class="ls-hint">Posts come from Communications → Announcements, when the audience is Public.</p>':""}</div>`},
      dues:s=>{const d=site.dues||{},amt=+d.amount||0,pay=site.pay||[],note=`${d.year||new Date().getFullYear()} dues`;
        const links=amt?pay.map(p=>{const u=payUrl(p,amt,note+" from "+full);return u?`<a class="ls-btn" href="${esc(u)}" target="_blank" rel="noopener">${esc(p.label)}</a>`:""}).join(""):"";
        const notes=pay.filter(p=>p.k==="zelle"||p.k==="check").map(p=>`<p class="ls-note"><b>${esc(p.label)}:</b> ${esc(p.k==="zelle"?(amt?"send "+money(amt)+" to ":"send to ")+p.v:"mail "+(amt?money(amt)+" ":"")+"to "+p.v)}</p>`).join("");
        return `<div class="ls-wrap ls-narrow ls-al-center">${head(s)}${amt?`<p class="ls-dues"><span>${esc(note.replace(/^\w/,c=>c.toUpperCase()))}</span><b>${money(amt)}</b></p>`:""}${B(s.body)}
          ${links?`<div class="ls-btns">${links}</div>`:""}${notes}${!amt&&!E?empty("Ask the Secretary for this year's dues."):""}
          ${E?`<p class="ls-hint">${amt?"The amount comes from Treasury → Dues.":"Set the yearly dues in Treasury → Dues to show the amount and pay buttons."} Payment buttons come from Settings → Payment options.</p>`:""}</div>`},
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
    }else if(o.view==="gate"){const g=o.gate||{};
      body=`<section class="ls-sec ls-bg-plain"><div class="ls-wrap ls-narrow ls-al-center ls-gate"><span class="ls-gate-ic">${LOCK}</span><h1 class="ls-h1 ls-dark">${esc(g.title||"Members only")}</h1>
        <p class="ls-lead">${esc(g.text||"This page is for members of the lodge.")}</p>${g.button?`<p><a class="ls-btn" href="${esc(g.button[1])}">${esc(g.button[0])}</a></p>`:""}${g.small?`<p class="ls-note">${esc(g.small)}</p>`:""}</div></section>`;
    }else if(o.view==="404")body=`<section class="ls-sec ls-bg-plain"><div class="ls-wrap ls-narrow"><h1 class="ls-h1 ls-dark">That page isn't here</h1><p class="ls-lead">It may have moved or been taken down.</p><p><a class="ls-btn" href="${esc(root||"/")}">Go to the home page</a></p></div></section>`;
    else{const p=o.page||pages[0];body=(p.sections||[]).map(section).join("")||(E?"":empty("This page is being written. Check back soon."))}

    const cur=o.page&&o.page.id;
    const nav=pages.filter(p=>p.nav!==false).map(p=>`<a href="${esc(root+(p.slug?"/"+p.slug:""))}"${p.id===cur?' aria-current="page"':""}${E?` data-goto="${esc(p.id)}"`:""}${p.members?' title="Members only"':""}>${p.members?LOCK:""}${esc(p.title)}</a>`).join("");
    const logo=okImg((site.images||{}).logo)?`<img class="ls-logo" src="${esc(site.images.logo)}" alt="">`:`<span class="ls-crest">${CREST}</span>`;
    const soc=(site.social||[]).filter(x=>safeHref(x.url));
    return `<div class="lsite" data-font="${esc(th.font)}" data-btn="${th.btn==="square"?"square":"rounded"}" data-head="${th.header==="left"?"left":"center"}" style="--c:${color};--hf:${esc(F.head)};--bf:${esc(F.body)}">
      <header class="ls-head"><div class="ls-wrap ls-head-in"><a class="ls-brand" href="${esc(root||"/")}"${E?' data-goto="home"':""}>${logo}<span><b>${esc(full)}</b>${site.jur||site.grandLodge?`<small>${esc([site.jur,site.grandLodge].filter(Boolean).join(" · "))}</small>`:""}</span></a>
        ${nav&&pages.length>1?`<nav class="ls-nav" aria-label="Site">${nav}</nav>`:""}</div></header>
      <main>${body}</main>
      <footer class="ls-foot"><div class="ls-wrap"><div><b>${esc(full)}</b>${site.schedule?`<span>${esc(MEET)} ${esc(site.schedule)}</span>`:""}${place?`<span>${esc(place)}</span>`:""}</div>
        ${soc.length?`<div class="ls-foot-soc">${soc.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join("")}</div>`:""}
        <small>© ${new Date().getFullYear()} ${esc(full)} · Website by <a href="https://www.lodgenet.app/">LodgeNet</a></small></div></footer>
    </div>`;
  }

  window.LodgeSite={render,resolve,SITE_TEMPLATES,TEMPLATE_GROUPS,SECTIONS,TEMPLATES,FONTS,THEME,fontHref,newSection,defaultHome,pagesOf,esc,safeHref,okImg,videoSrc,HTML_MAX};
})();
