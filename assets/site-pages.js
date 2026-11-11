/* Website tab, part two (lodge.html): the lodge's own pages, the content on each page, and QR codes. Loaded after assets/demo.js.

   - Pages: Home plus any pages the lodge adds. Each page has a name, an address (/site/<lodge>/<page>), a "show in the menu"
     switch and a list of content blocks (heading, text, photo, button, custom HTML; see assets/site-blocks.js).
     On Home, the built-in sections (About, Upcoming, Officers, Contact, Give, Store, Photos) can each be switched off, and the
     lodge's own blocks show after About.
   - QR codes: each code is printed with a fixed address, /site/<lodge>/qr/<id>, and the published site sends the visitor on to
     wherever the code is assigned: Home, a page, a fundraiser, or any https link. Reassigning a code after it's printed only
     needs Publish site; nothing has to be reprinted.

   Saved with the rest of the lodge's data as sitePages, siteHome and siteQrs; Publish copies the public parts into
   published.site (pages, home, funds, qrs), which is all /site/<slug> ever reads. */
(function(){
  const A=window.LodgeNetApp,B=window.LodgeSiteBlocks;
  if(!A||!B||!document.getElementById("pages"))return;
  const $=s=>document.querySelector(s),esc=A.esc,CFG=A.CFG,CLOUD=A.CLOUD;
  const rid=n=>Math.random().toString(36).slice(2,2+n);
  const HOME_SECS=[["about","About the lodge"],["events","Upcoming events"],["officers","Officers"],["contact","Contact"],["give","Give to the lodge"],["store","Lodge store"],["photos","Photos"]];
  const KINDS=[["heading","Heading"],["text","Text"],["image","Photo"],["button","Button"],["html","Custom HTML"]];
  const KIND=Object.fromEntries(KINDS);
  const RESERVED=["qr","fundraiser","home","site"],MAX_PAGES=20,MAX_BLOCKS=40;

  const pages=Array.isArray(CFG.sitePages)?CFG.sitePages:[];
  const home=Object.assign({hide:[],blocks:[]},CFG.siteHome||{});
  const qrs=Array.isArray(CFG.siteQrs)?CFG.siteQrs:[];
  let editing=null;

  /* ---------- addresses ---------- */
  const SLUG=A.SLUG||"";
  /* codes are printed, so they always carry the live domain, even when the dashboard is opened on a preview deploy */
  const ORIGIN=/(^|\.)lodgenet\.app$/i.test(location.hostname)?location.origin:"https://www.lodgenet.app";
  const sitePath=rest=>"/site/"+encodeURIComponent(SLUG||"your-lodge")+(rest?"/"+rest:"");
  const slugify=t=>String(t||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48)||"page";
  function uniqueSlug(base,self){
    let s=slugify(base);if(RESERVED.includes(s))s+="-page";
    let out=s,n=2;while(pages.some(p=>p!==self&&p.slug===out))out=s+"-"+n++;
    return out;
  }
  const pageById=id=>pages.find(p=>p.id===id);
  const blocksOf=id=>id==="home"?home.blocks:((pageById(id)||{}).blocks||[]);

  /* ---------- fundraisers get a lasting id so pages, buttons and QR codes can point at them ---------- */
  const fundraisers=()=>A.events.filter(e=>e.k==="fund").sort((a,b)=>a.d<b.d?1:-1);
  function ensureFids(){A.events.forEach(e=>{if(e.k==="fund"&&!e.fid)e.fid="f"+rid(7)})}
  const fundById=id=>A.events.find(e=>e.k==="fund"&&e.fid===id);
  const dayFmt=d=>A.fmt(A.parse(d),{month:"short",day:"numeric",year:"numeric"});

  /* ---------- link targets shared by buttons and QR codes ---------- */
  function targetOptions(cur,withUrl){
    ensureFids();const fr=fundraisers();
    const o=(v,t)=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(t)}</option>`;
    return `<optgroup label="General">${o("home","Home page")}${pages.map(p=>o("page:"+p.id,p.title)).join("")}</optgroup>`
      +(fr.length?`<optgroup label="Fundraisers">${fr.map(e=>o("fund:"+e.fid,e.t+" · "+dayFmt(e.d))).join("")}</optgroup>`:"")
      +(withUrl?`<optgroup label="Other">${o("url","A link you type in")}</optgroup>`:"");
  }
  /* where a target goes on the public site; "" when it no longer exists */
  function targetHref(t){
    t=t||"";
    if(t==="home")return sitePath("");
    if(t.startsWith("page:")){const p=pageById(t.slice(5));return p?sitePath(p.slug):""}
    if(t.startsWith("fund:")){const f=fundById(t.slice(5));return f?sitePath("fundraiser/"+f.fid):""}
    return B.safeHref(t)&&!/^\/site\//.test(t)?t:"";
  }
  function targetName(t){
    if(t==="home")return "Home page";
    if(t.startsWith("page:")){const p=pageById(t.slice(5));return p?"Page: "+p.title:"A deleted page"}
    if(t.startsWith("fund:")){const f=fundById(t.slice(5));return f?"Fundraiser: "+f.t:"A deleted fundraiser"}
    return t||"Nowhere yet";
  }
  const pubBlock=b=>b.type==="button"?{type:"button",label:b.label||"",href:targetHref(b.link)}:Object.assign({},b);

  /* ---------- what Publish sends (demo.js publicSite() adds this) ---------- */
  function publicExtra(){
    ensureFids();
    return {
      pages:pages.map(p=>({id:p.id,title:p.title,slug:p.slug,nav:p.nav!==false,blocks:p.blocks.map(pubBlock)})),
      home:{hide:home.hide.slice(),blocks:home.blocks.map(pubBlock)},
      funds:fundraisers().map(e=>({id:e.fid,t:e.t,d:e.d,time:e.time||"",note:e.note||"",goal:+e.goal||0,raised:+e.raised||0,charity:e.charity||""})),
      qrs:qrs.map(q=>({id:q.id,href:targetHref(q.to)})).filter(q=>q.href)
    };
  }

  /* ---------- pages and content editor ---------- */
  function blockEditor(b,i,n){
    const tools=`<span class="row-acts"><button type="button" class="btn line sm" data-blk-up="${i}"${i?"":" disabled"} aria-label="Move up">↑</button>`
      +`<button type="button" class="btn line sm" data-blk-down="${i}"${i<n-1?"":" disabled"} aria-label="Move down">↓</button>`
      +`<button type="button" class="btn line sm" data-blk-del="${i}">Remove</button></span>`;
    let body="";
    if(b.type==="heading")body=`<input data-blk="${i}" data-k="text" value="${esc(b.text||"")}" placeholder="Heading" aria-label="Heading text">`;
    if(b.type==="text")body=`<textarea data-blk="${i}" data-k="text" rows="5" placeholder="Write here. Leave a blank line between paragraphs." aria-label="Text">${esc(b.text||"")}</textarea>`;
    if(b.type==="image")body=`<div class="blk-pic">${b.src?`<img src="${esc(b.src)}" alt="">`:'<span class="hint">No photo chosen yet.</span>'}</div>
      <span class="row-acts"><label class="btn line sm">${b.src?"Replace photo":"Choose photo"}<input type="file" accept="image/*" data-blk-img="${i}" hidden></label></span>
      <input data-blk="${i}" data-k="caption" value="${esc(b.caption||"")}" placeholder="Caption (optional, also read aloud to blind visitors)" aria-label="Photo caption">`;
    if(b.type==="button"){const isUrl=!!b.link&&!/^(home|page:|fund:)/.test(b.link)||b.link==="url";
      body=`<input data-blk="${i}" data-k="label" value="${esc(b.label||"")}" placeholder="Button words, e.g. Buy breakfast tickets" aria-label="Button words">
      <select data-blk-to="${i}" aria-label="Button opens">${targetOptions(isUrl?"url":(b.link||"home"),true)}</select>
      <input data-blk="${i}" data-k="link" value="${esc(isUrl&&b.link!=="url"?b.link:"")}" placeholder="https://" inputmode="url" aria-label="Button link"${isUrl?"":" hidden"}>`}
    if(b.type==="html"){const len=String(b.html||"").length;
      body=`<textarea class="mono" data-blk="${i}" data-k="html" rows="9" spellcheck="false" placeholder="<div>Paste your own HTML here: a donation form, an embedded video, a sign-up form, a whole page.</div>" aria-label="Custom HTML">${esc(b.html||"")}</textarea>
      <span class="row-acts"><label class="btn line sm">Load an .html file<input type="file" accept=".html,.htm,text/html" data-blk-htm="${i}" hidden></label><span class="hint" data-len="${i}">${len?Math.ceil(len/1000)+" KB of "+B.HTML_MAX/1000+" KB":""}</span></span>
      <p class="hint">Scripts and styles work. It runs in a sealed frame, so it can't reach LodgeNet sign-ins or the lodge's records.</p>`}
    return `<div class="blk" data-i="${i}"><div class="row-sp"><b class="blk-k">${KIND[b.type]||b.type}</b>${tools}</div>${body}</div>`;
  }
  function editor(){
    const isHome=editing==="home",p=pageById(editing),bl=blocksOf(editing);
    if(!isHome&&!p)return "";
    const top=isHome
      ?`<fieldset class="pg-secs"><legend>Sections on the Home page</legend>
          ${HOME_SECS.map(([k,t])=>`<label class="check"><input type="checkbox" data-home-sec="${k}"${home.hide.includes(k)?"":" checked"}> ${t}</label>`).join("")}
          <p class="hint">Untick a section to take it off the Home page. Your own content shows under About.</p></fieldset>`
      :`<div class="field"><label for="pg-title">Page name</label><input id="pg-title" data-pg-f="title" value="${esc(p.title)}"></div>
        <div class="field"><label for="pg-slug">Address</label><div class="pre"><span>${esc(sitePath(""))}/</span><input id="pg-slug" data-pg-f="slug" value="${esc(p.slug)}" autocapitalize="off" spellcheck="false"></div>
          <span class="hint">Changing it breaks links to the old address. QR codes keep working.</span></div>
        <label class="check"><input type="checkbox" data-pg-f="nav"${p.nav!==false?" checked":""}> Show in the site menu</label>`;
    return `<div class="pg-ed"><div class="row-sp"><h4>${isHome?"Home page":esc(p.title)}</h4><button type="button" class="btn line sm" data-pg-edit="">Done</button></div>
      ${top}
      <div class="blk-list">${bl.length?bl.map((b,i)=>blockEditor(b,i,bl.length)).join(""):'<p class="hint">No content on this page yet. Add some below.</p>'}</div>
      <div class="row-acts blk-add"><span class="hint">Add</span>${KINDS.map(([k,t])=>`<button type="button" class="btn line sm" data-blk-add="${k}"${bl.length>=MAX_BLOCKS?" disabled":""}>${t}</button>`).join("")}</div>
    </div>`;
  }
  function renderPages(){
    const row=(id,title,sub,acts)=>`<li${editing===id?' class="on"':""}><div><b>${esc(title)}</b><span class="hint">${esc(sub)}</span></div><span class="row-acts">${acts}</span></li>`;
    const n=pages.length;
    $("#pages").innerHTML=`<ul class="pg-list">
        ${row("home","Home",sitePath("")+(home.blocks.length?" · "+home.blocks.length+" of your own":""),`<button type="button" class="btn line sm" data-pg-edit="home">Edit</button>`)}
        ${pages.map((p,i)=>row(p.id,p.title,sitePath(p.slug)+(p.nav===false?" · not in the menu":"")+" · "+p.blocks.length+" "+(p.blocks.length===1?"block":"blocks"),
          `<button type="button" class="btn line sm" data-pg-up="${i}"${i?"":" disabled"} aria-label="Move ${esc(p.title)} up">↑</button>`
          +`<button type="button" class="btn line sm" data-pg-down="${i}"${i<n-1?"":" disabled"} aria-label="Move ${esc(p.title)} down">↓</button>`
          +`<button type="button" class="btn line sm" data-pg-edit="${p.id}">Edit</button><button type="button" class="btn line sm" data-pg-del="${p.id}">Delete</button>`)).join("")}
      </ul>
      ${n<MAX_PAGES?`<div class="pg-add"><input data-pg-new placeholder="New page name, e.g. Become a Mason" aria-label="New page name">
        <button type="button" class="btn line sm" data-pg-add>Add page</button>
        <label class="btn line sm">Upload an .html page<input type="file" accept=".html,.htm,text/html" data-pg-file hidden></label></div>`:`<p class="hint">That's the most pages a lodge site can have (${MAX_PAGES}).</p>`}
      ${editing?editor():""}`;
  }
  function addPage(title,blocks){
    if(pages.length>=MAX_PAGES)return null;
    title=String(title||"").trim().slice(0,80)||"New page";
    const p={id:"p"+rid(7),title,slug:uniqueSlug(title),nav:true,blocks:blocks||[],auto:true};
    pages.push(p);editing=p.id;return p;
  }
  function changed(full){if(full)renderPages();renderQr();preview();A.save()}
  const readText=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=no;r.readAsText(f)});
  const tooBig=t=>t.length>B.HTML_MAX&&(alert(`That HTML is ${Math.ceil(t.length/1000)} KB. A custom HTML block holds up to ${B.HTML_MAX/1000} KB, so put large pictures on another host and link to them.`),true);

  const box=$("#pages");
  box.addEventListener("keydown",e=>{
    if(e.key!=="Enter"||e.target.tagName==="TEXTAREA")return;
    e.preventDefault();/* Enter in these boxes must not press Publish site */
    if(e.target.matches("[data-pg-new]"))box.querySelector("[data-pg-add]").click();
  });
  box.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t)return;const d=t.dataset;
    if("pgAdd" in d){const inp=box.querySelector("[data-pg-new]");if(!inp.value.trim())return inp.focus();addPage(inp.value);return changed(true)}
    if("pgEdit" in d){editing=d.pgEdit||null;return changed(true)}
    if(d.pgUp||d.pgDown){const i=+(d.pgUp||d.pgDown),j=d.pgUp?i-1:i+1;if(j<0||j>=pages.length)return;[pages[i],pages[j]]=[pages[j],pages[i]];return changed(true)}
    if(d.pgDel){const p=pageById(d.pgDel);if(!p)return;
      const q=qrs.filter(x=>x.to==="page:"+p.id).length;
      if(!confirm(`Delete the page "${p.title}" and everything on it?`+(q?` ${q} QR code${q===1?"":"s"} point${q===1?"s":""} at it and will open Home instead until you reassign ${q===1?"it":"them"}.`:"")+" The live site changes when you next press Publish site."))return;
      qrs.forEach(x=>{if(x.to==="page:"+p.id)x.to="home"});
      pages.splice(pages.indexOf(p),1);if(editing===p.id)editing=null;return changed(true)}
    const bl=blocksOf(editing);
    if(d.blkAdd){if(bl.length>=MAX_BLOCKS)return;const b={id:"b"+rid(6),type:d.blkAdd};
      if(b.type==="button")b.link="home";bl.push(b);changed(true);
      const last=box.querySelectorAll(".blk");const el=last[last.length-1];if(el){el.scrollIntoView({block:"nearest"});const f=el.querySelector("input:not([type=file]),textarea");if(f)f.focus()}
      return}
    if(d.blkUp||d.blkDown){const i=+(d.blkUp||d.blkDown),j=d.blkUp?i-1:i+1;if(j<0||j>=bl.length)return;[bl[i],bl[j]]=[bl[j],bl[i]];return changed(true)}
    if(d.blkDel){const i=+d.blkDel,b=bl[i];if(!b)return;
      const has=b.text||b.src||b.html||b.label;
      if(has&&!confirm(`Remove this ${(KIND[b.type]||"block").toLowerCase()} from the page?`))return;
      bl.splice(i,1);return changed(true)}
  });
  box.addEventListener("input",e=>{
    const t=e.target,bl=blocksOf(editing);
    if(t.dataset.blk!==undefined){const b=bl[+t.dataset.blk];if(!b)return;
      let v=t.value;if(t.dataset.k==="html"&&v.length>B.HTML_MAX){v=v.slice(0,B.HTML_MAX)}
      b[t.dataset.k]=v;
      if(t.dataset.k==="html"){const s=box.querySelector(`[data-len="${t.dataset.blk}"]`);if(s)s.textContent=Math.ceil(v.length/1000)+" KB of "+B.HTML_MAX/1000+" KB"}
      return preview()}
    const p=pageById(editing);if(!p)return;
    if(t.dataset.pgF==="title"){p.title=t.value.slice(0,80);if(p.auto)p.slug=uniqueSlug(p.title||"page",p);
      const h=box.querySelector(".pg-ed h4");if(h)h.textContent=p.title||"Untitled page";
      const s=$("#pg-slug");if(s&&p.auto)s.value=p.slug;preview()}
  });
  box.addEventListener("change",async e=>{
    const t=e.target,d=t.dataset,bl=blocksOf(editing),p=pageById(editing);
    if(d.homeSec){home.hide=home.hide.filter(k=>k!==d.homeSec);if(!t.checked)home.hide.push(d.homeSec);return changed()}
    if(d.pgF==="nav"&&p){p.nav=t.checked;return changed(true)}
    if(d.pgF==="slug"&&p){p.slug=uniqueSlug(t.value||p.title,p);p.auto=false;return changed(true)}
    if(d.pgF==="title"&&p){if(!p.title.trim())p.title="Untitled page";return changed(true)}
    if(d.blkTo!==undefined){const b=bl[+d.blkTo];if(!b)return;b.link=t.value==="url"?"url":t.value;return changed(true)}
    if(d.blk!==undefined&&d.k==="link"){const b=bl[+d.blk];if(b){let v=t.value.trim();if(v&&!/^(https?:|mailto:|tel:)/i.test(v))v="https://"+v;v=v.replace(/^http:/i,"https:");b.link=v||"url";t.value=v;changed()}return}
    if(d.blkImg!==undefined){const b=bl[+d.blkImg],f=t.files[0];t.value="";if(!b||!f)return;
      try{b.src=await A.shrinkPic(await A.fileUrl(f),"block")}catch(err){return alert("That file isn't a picture LodgeNet can read.")}
      return changed(true)}
    if(d.blkHtm!==undefined){const b=bl[+d.blkHtm],f=t.files[0];t.value="";if(!b||!f)return;
      const txt=await readText(f);if(tooBig(txt))return;
      if(String(b.html||"").trim()&&!confirm("Replace the HTML already in this block with "+f.name+"?"))return;
      b.html=txt;return changed(true)}
    if("pgFile" in d){const f=t.files[0];t.value="";if(!f)return;
      const txt=await readText(f);if(tooBig(txt))return;
      const m=/<title[^>]*>([^<]{1,80})<\/title>/i.exec(txt);
      addPage(m?m[1].trim():f.name.replace(/\.html?$/i,"").replace(/[-_]+/g," "),[{id:"b"+rid(6),type:"html",html:txt}]);
      return changed(true)}
  });

  /* ---------- the preview on the right follows the page being edited ---------- */
  function preview(){
    const pv=$("#site-preview");if(!pv)return;
    const nav=pv.querySelector(".site-nav");
    if(nav)nav.innerHTML=["<span>Home</span>"].concat(pages.filter(p=>p.nav!==false).map(p=>`<span>${esc(p.title)}</span>`)).join("");
    const pg=pageById(editing),url=$("#pv-url");
    if(url&&CLOUD&&SLUG)url.textContent=location.host+sitePath(pg?pg.slug:"");
    pv.querySelectorAll("[data-hs]").forEach(el=>el.hidden=!!pg||home.hide.includes(el.dataset.hs));
    const hb=$("#pv-home-blocks"),pb=$("#pv-page");
    hb.hidden=!!pg||!home.blocks.length;if(!hb.hidden)hb.innerHTML=B.render(home.blocks.map(pubBlock));
    pb.hidden=!pg;if(pg)pb.innerHTML=`<h3 class="blk-title">${esc(pg.title)}</h3>`+(B.render(pg.blocks.map(pubBlock))||'<p class="hint">Nothing on this page yet.</p>');
    $(".site-body").hidden=!!pg||(home.hide.includes("events")&&home.hide.includes("officers"));
    $(".site-foot").hidden=!!pg||(home.hide.includes("contact")&&home.hide.includes("give"));
  }

  /* ---------- QR codes ---------- */
  const QR=window.qrcode;
  function matrix(text){const q=QR(0,"M");q.addData(text);q.make();const n=q.getModuleCount();return {n,dark:(r,c)=>q.isDark(r,c)}}
  const qrUrl=q=>ORIGIN+sitePath("qr/"+q.id);
  function qrSvg(q,withLabel){
    const m=matrix(qrUrl(q)),pad=4,size=m.n+pad*2,lab=withLabel&&q.label?6:0;let path="";
    for(let r=0;r<m.n;r++)for(let c=0;c<m.n;c++)if(m.dark(r,c))path+=`M${c+pad} ${r+pad}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size+lab}" shape-rendering="crispEdges"><rect width="${size}" height="${size+lab}" fill="#fff"/><path d="${path}" fill="#000"/>`
      +(lab?`<text x="${size/2}" y="${size+2.6}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="2.6" font-weight="700" fill="#000">${esc(q.label)}</text>`:"")+"</svg>";
  }
  function qrPng(q){
    const m=matrix(qrUrl(q)),pad=4,cell=Math.max(8,Math.floor(1000/(m.n+pad*2))),side=(m.n+pad*2)*cell,lab=q.label?Math.round(cell*6):0;
    const c=document.createElement("canvas");c.width=side;c.height=side+lab;const x=c.getContext("2d");
    x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.fillStyle="#000";
    for(let r=0;r<m.n;r++)for(let k=0;k<m.n;k++)if(m.dark(r,k))x.fillRect((k+pad)*cell,(r+pad)*cell,cell,cell);
    if(lab){x.font=`700 ${Math.round(cell*2.4)}px Arial,Helvetica,sans-serif`;x.textAlign="center";x.textBaseline="middle";
      let t=q.label;while(x.measureText(t).width>side-cell*4&&t.length>4)t=t.slice(0,-2)+"…";x.fillText(t,side/2,side+lab*0.35)}
    return c.toDataURL("image/png");
  }
  const fileName=q=>(slugify(q.label||"qr-code")+"-qr");
  function download(href,name){const a=document.createElement("a");a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove()}
  function renderQr(){
    const el=$("#qr");if(!el)return;
    if(!QR){el.innerHTML='<p class="hint">The QR code maker didn\'t load. Refresh the page to try again.</p>';return}
    const live=!!(A.published&&A.published.site);
    el.innerHTML=`<div class="qr-tab"><div class="qr-make"><h4>Make a QR code</h4>
        <div class="field"><label for="qr-label">Name</label><input id="qr-label" placeholder="e.g. Pancake Breakfast flyer" maxlength="60"></div>
        <div class="field"><label for="qr-to">Opens</label><select id="qr-to">${targetOptions("home",true)}</select></div>
        <div class="field" id="qr-url-f" hidden><label for="qr-url">Link</label><input id="qr-url" inputmode="url" placeholder="https://" autocapitalize="off" spellcheck="false"></div>
        <button type="button" class="btn sm" data-qr-make>Make QR code</button>
      ${!SLUG?'<p class="hint">In the demo, codes point at a sample address. A signed-in lodge gets codes for its own site.</p>':!live?'<p class="hint"><span class="pill warn">Site not published</span> Codes open the lodge website, so <a href="#website">publish it from the Website tab</a> before you print them.</p>':""}
      <p class="hint">Each code keeps the same printed address. Change what it opens here any time, then press Publish site on the Website tab and printed codes follow.</p>
      </div>
      <div class="qr-list">${qrs.length?qrs.slice().reverse().map(q=>{
        const href=targetHref(q.to),isFund=(q.to||"").startsWith("fund:"),isUrl=!!q.to&&!/^(home|page:|fund:)/.test(q.to);
        const pubHref=live&&((A.published.site.qrs||[]).find(x=>x.id===q.id)||{}).href;
        const pending=SLUG&&live&&href&&pubHref!==href;
        return `<div class="qr-card" data-qr="${esc(q.id)}">
          <img class="qr-img" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(q,false))}" alt="QR code for ${esc(q.label||"the lodge website")}" width="120" height="120">
          <div class="qr-info">
            <div class="row-sp"><b>${esc(q.label||"QR code")}</b><span class="pill${isFund?" gold":""}">${isFund?"Fundraiser":"General"}</span></div>
            <span class="hint">Opens ${esc(targetName(q.to))}${href?"":" (it opens Home until you choose again)"}</span>
            <span class="hint mono">${esc(qrUrl(q).replace(/^https:\/\//,""))}</span>
            ${pending?'<span class="hint"><span class="pill warn">Unpublished change</span> <a href="#website">Publish the site</a> and printed codes follow.</span>':""}
            <div class="row-acts"><select data-qr-to aria-label="What ${esc(q.label||"this code")} opens">${targetOptions(isUrl?"url":q.to,true)}</select>
              <input data-qr-url value="${esc(isUrl?q.to:"")}" placeholder="https://" inputmode="url" aria-label="Link"${isUrl?"":" hidden"}></div>
            <div class="row-acts"><button type="button" class="btn line sm" data-qr-png>Download PNG</button><button type="button" class="btn line sm" data-qr-svg>Download SVG</button>
              <a class="btn line sm" href="${esc(qrUrl(q))}" target="_blank" rel="noopener">Test it</a><button type="button" class="btn line sm" data-qr-del>Delete</button></div>
          </div></div>`}).join(""):'<p class="empty">No QR codes yet. Make one on the left.</p>'}</div></div>`;
  }
  /* a fundraiser card on the Fundraiser tab can ask for a code */
  function makeQr(to,label){
    ensureFids();
    let id;do id=rid(6);while(qrs.some(q=>q.id===id));
    const q={id,label:String(label||"").trim().slice(0,60),to,at:new Date().toISOString()};
    if(to.startsWith("page:")){const p=pageById(to.slice(5));if(p)p.auto=false}
    qrs.push(q);renderQr();A.save();if(window.LodgeNetDash&&location.hash==="#qrcodes")window.dispatchEvent(new Event("hashchange"));return q;
  }
  const qbox=$("#qr");
  qbox.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName==="INPUT"){e.preventDefault();if(e.target.closest(".qr-make"))qbox.querySelector("[data-qr-make]").click()}});
  qbox.addEventListener("change",e=>{
    const t=e.target;
    if(t.id==="qr-to"){$("#qr-url-f").hidden=t.value!=="url";const lb=$("#qr-label");
      if(!lb.value.trim()&&t.value!=="url"&&t.value!=="home")lb.value=targetName(t.value).replace(/^(Page|Fundraiser): /,"");return}
    const card=t.closest("[data-qr]"),q=card&&qrs.find(x=>x.id===card.dataset.qr);if(!q)return;
    if(t.matches("[data-qr-to]")){if(t.value==="url"){card.querySelector("[data-qr-url]").hidden=false;card.querySelector("[data-qr-url]").focus();return}
      q.to=t.value;if(q.to.startsWith("page:")){const p=pageById(q.to.slice(5));if(p)p.auto=false}renderQr();A.save()}
    if(t.matches("[data-qr-url]")){const v=cleanUrl(t.value);if(!v)return alert("Enter a full web address that starts with https://");q.to=v;renderQr();A.save()}
  });
  const cleanUrl=v=>{v=String(v||"").trim();if(!v)return "";if(!/^https?:\/\//i.test(v))v="https://"+v;v=v.replace(/^http:/i,"https:");return /^https:\/\/[^\s/"<>]+\.[^\s"<>]+$/i.test(v)?v:""};
  qbox.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t)return;
    if("qrMake" in t.dataset){let to=$("#qr-to").value;
      if(to==="url"){to=cleanUrl($("#qr-url").value);if(!to){$("#qr-url").focus();return alert("Enter a full web address that starts with https://")}}
      const label=$("#qr-label").value.trim()||(to==="home"?"Lodge website":targetName(to).replace(/^(Page|Fundraiser): /,""));
      makeQr(to,label);return}
    const card=t.closest("[data-qr]"),q=card&&qrs.find(x=>x.id===card.dataset.qr);if(!q)return;
    if("qrPng" in t.dataset)return download(qrPng(q),fileName(q)+".png");
    if("qrSvg" in t.dataset)return download("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(qrSvg(q,true)),fileName(q)+".svg");
    if("qrDel" in t.dataset){if(!confirm(`Delete the QR code "${q.label||"QR code"}"? Codes already printed will stop working once you publish.`))return;
      qrs.splice(qrs.indexOf(q),1);renderQr();A.save()}
  });

  window.LodgeNetSite={
    snapshot:()=>({sitePages:pages,siteHome:home,siteQrs:qrs}),
    publicExtra,preview,
    qrForFund(e){ensureFids();const ex=qrs.find(q=>q.to==="fund:"+e.fid);const q=ex||makeQr("fund:"+e.fid,e.t);
      location.hash="qrcodes";setTimeout(()=>{const c=document.querySelector(`[data-qr="${q.id}"]`);if(c)c.scrollIntoView({behavior:"smooth",block:"center"})},80)},
    renderQr
  };
  ensureFids();renderPages();renderQr();preview();A.siteState();
  /* fundraisers added or renamed elsewhere show up in the pickers */
  window.addEventListener("hashchange",()=>{if(location.hash==="#qrcodes")renderQr();if(location.hash==="#website"&&editing)renderPages()});
})();
