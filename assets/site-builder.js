/* The Website tab on lodge.html, loaded after assets/demo.js. It works the way Wix does:
   an overview (the site's address and status, a "get your site live" checklist, and whole-site designs to start from),
   and Edit site, which opens a full-screen drag-and-click editor at #website/edit.

   - The middle of the screen is the real site, drawn by assets/site-render.js (the same code the public site uses).
     Click any text on it to type, click a section to edit it in the left panel, drag a section by its handle to move it,
     and use the + between sections to add one there.
   - A toolbar row under the top bar: + Add, and for the selected section Change layout, Background, Edit, move,
     Duplicate and Delete.
   - The icon rail on the left slides out panels: Add (the section library: click a section or drag it onto the page),
     Pages (add from a template, rename, address, menu, reorder, delete), Design (site designs, color, fonts, buttons,
     header, logo) and Lodge info (the lodge details form demo.js already owns). Editing a section opens its panel.
   - Top bar: back to the dashboard, Undo / Redo, Preview and Publish (demo.js publishes #site-form). The frame's own bar
     has the page picker and Desktop / Phone.

   The layout saves with the rest of the lodge's data as siteLayout {v:2, theme, pages}. Publish copies it, with the
   fundraisers, store items and QR codes, into published.site (demo.js publicSite() spreads publicExtra() in). */
(function(){
  const A=window.LodgeNetApp,L=window.LodgeSite;
  if(!A||!L||!document.getElementById("bld"))return;
  const $=s=>document.querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)],esc=A.esc,CFG=A.CFG,CLOUD=A.CLOUD;
  const SLUG=A.SLUG||"",ROOT="/site/"+encodeURIComponent(SLUG||"your-lodge");
  const rid=n=>Math.random().toString(36).slice(2,2+n);
  const planNow=()=>CLOUD?CFG.plan:A.plan;
  const RESERVED=["qr","fundraiser","home","site"],MAX_PAGES=20,MAX_SECTIONS=40,GAL_MAX=24;

  /* ---------- the layout ---------- */
  function startLayout(){
    const saved=CFG.siteLayout;
    if(saved&&Array.isArray(saved.pages)&&saved.pages.length)return saved;
    /* first open: Home is built from what the lodge already had. The banner and gallery move into it, so photos aren't stored twice. */
    const p=A.pics,starter=planNow()==="starter";
    const home=L.defaultHome({about:(CFG.form||{})["f-about"]||"",images:{hero:p.hero,gallery:p.gallery.slice()},store:starter?[]:A.products.filter(x=>!x.off)});
    p.hero="";p.gallery.splice(0);
    return {v:2,theme:Object.assign({},L.THEME),pages:[home]};
  }
  const layout=startLayout();
  layout.v=2;layout.theme=Object.assign({},L.THEME,layout.theme||{});
  const pages=layout.pages;
  pages[0].id="home";pages[0].slug="";
  pages.forEach(p=>{p.sections=Array.isArray(p.sections)?p.sections:[];p.sections.forEach(s=>{if(!s.id)s.id="s"+rid(7)})});

  let curId="home",sel=null,insertAt=null,device="desktop",previewing=false,tab="add",panelOpen=false,drag=null,addingPage=false,menu=null;
  const curPage=()=>pages.find(p=>p.id===curId)||pages[0];
  const secOf=id=>curPage().sections.find(s=>s.id===id);
  const pageById=id=>pages.find(p=>p.id===id);

  /* ---------- undo / redo ---------- */
  const past=[],future=[];
  const state=()=>JSON.stringify({pages,theme:layout.theme,color:A.siteColor});
  function commit(){past.push(state());if(past.length>80)past.shift();future.length=0;histBtns()}
  function restore(json){const d=JSON.parse(json);pages.splice(0,pages.length,...d.pages);Object.assign(layout.theme,d.theme);if(d.color&&d.color!==A.siteColor)A.setColor(d.color);
    if(!pageById(curId))curId="home";if(sel&&!secOf(sel))sel=null;drawAll();A.save()}
  function undo(){if(!past.length)return;future.push(state());restore(past.pop());histBtns()}
  function redo(){if(!future.length)return;past.push(state());restore(future.pop());histBtns()}
  function histBtns(){$("#bld-undo").disabled=!past.length;$("#bld-redo").disabled=!future.length}
  /* every change to the layout goes through here: remember the old state, change, redraw, save */
  function change(fn,o){commit();fn();if(!o||o.draw!==false)drawAll();A.save()}

  /* ---------- fundraisers have lasting ids so buttons and QR codes can point at them ---------- */
  const fundraisers=()=>A.events.filter(e=>e.k==="fund").sort((a,b)=>a.d<b.d?1:-1);
  function ensureFids(){A.events.forEach(e=>{if(e.k==="fund"&&!e.fid)e.fid="f"+rid(7)})}
  const fundById=id=>A.events.find(e=>e.k==="fund"&&e.fid===id);
  const dayFmt=d=>A.fmt(A.parse(d),{month:"short",day:"numeric",year:"numeric"});
  function targetOptions(cur,withUrl){
    ensureFids();const fr=fundraisers(),o=(v,t)=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(t)}</option>`;
    return `<optgroup label="Pages">${pages.map(p=>o(p.id==="home"?"home":"page:"+p.id,p.title)).join("")}</optgroup>`
      +(fr.length?`<optgroup label="Fundraisers">${fr.map(e=>o("fund:"+e.fid,e.t+" · "+dayFmt(e.d))).join("")}</optgroup>`:"")
      +(withUrl?`<optgroup label="Other">${o("url","A web address")}</optgroup>`:"");
  }
  function linkName(t){t=t||"";
    if(t==="home")return "Home";
    if(t.startsWith("page:")){const p=pageById(t.slice(5));return p?p.title:"A deleted page"}
    if(t.startsWith("fund:")){const f=fundById(t.slice(5));return f?"Fundraiser: "+f.t:"A deleted fundraiser"}
    return t||"Nowhere yet"}
  const isUrl=l=>!!l&&!/^(home|page:|fund:)/.test(l);

  /* ---------- what Publish sends (demo.js publicSite() spreads this in) ---------- */
  function publicExtra(){
    ensureFids();
    const hasStore=pages.some(p=>p.sections.some(s=>s.type==="store"));
    const Q=window.LodgeNetSite&&window.LodgeNetSite.qrPublic;
    return {
      layout:{v:2,theme:Object.assign({},layout.theme),pages:pages.map(p=>({id:p.id,slug:p.slug,title:p.title,nav:p.nav!==false,sections:p.sections}))},
      funds:fundraisers().map(e=>({id:e.fid,t:e.t,d:e.d,time:e.time||"",note:e.note||"",goal:+e.goal||0,raised:+e.raised||0,charity:e.charity||""})),
      store:hasStore&&planNow()!=="starter"?A.products.filter(x=>!x.off).map(x=>({id:x.id,n:x.n,p:+x.p||0,img:x.img||"",tag:x.tag||"",sizes:x.sizes||"",colors:x.colors||"",kind:x.kind||""})):[],
      ...(Q?{qrs:Q()}:{})
    };
  }

  /* ---------- icons ---------- */
  const I={
    drag:'<svg viewBox="0 0 20 20"><circle cx="7" cy="5" r="1.3"/><circle cx="13" cy="5" r="1.3"/><circle cx="7" cy="10" r="1.3"/><circle cx="13" cy="10" r="1.3"/><circle cx="7" cy="15" r="1.3"/><circle cx="13" cy="15" r="1.3"/></svg>',
    up:'<svg viewBox="0 0 20 20"><path d="M10 15V5M5.5 9.5 10 5l4.5 4.5"/></svg>',down:'<svg viewBox="0 0 20 20"><path d="M10 5v10M5.5 10.5 10 15l4.5-4.5"/></svg>',
    dup:'<svg viewBox="0 0 20 20"><rect x="6.5" y="6.5" width="10" height="10" rx="1"/><path d="M13.5 6.5v-3h-10v10h3"/></svg>',
    del:'<svg viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6"/></svg>',
    edit:'<svg viewBox="0 0 20 20"><path d="M4 16l1-4 8-8 3 3-8 8z"/></svg>',
    plus:'<svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>',back:'<svg viewBox="0 0 20 20"><path d="M12 5l-5 5 5 5"/></svg>',
    home:'<svg viewBox="0 0 20 20"><path d="M3.5 9.5 10 4l6.5 5.5M5.5 8v8h9V8"/></svg>',page:'<svg viewBox="0 0 20 20"><path d="M5.5 3h6l3.5 3.5V17h-9.5z"/><path d="M11.5 3v3.5H15"/></svg>',
    gear:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>'
  };
  /* small wireframe thumbnails for the section library */
  const box=(x,y,w,h,f)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"${f?` class="f"`:""}/>`,ln=(x,y,w)=>`<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" class="t"/>`;
  const THUMB={
    hero:box(2,2,76,46,1)+ln(22,18,36)+ln(28,25,24)+box(32,33,16,6),
    text:ln(10,10,40)+ln(10,19,60)+ln(10,26,56)+ln(10,33,60)+ln(10,40,34),
    imageText:box(6,8,32,34,1)+ln(44,12,26)+ln(44,21,30)+ln(44,28,28)+ln(44,35,22),
    features:ln(26,6,28)+[6,30,54].map(x=>box(x,16,20,3,1)+ln(x,24,20)+ln(x,30,16)).join(""),
    cta:box(2,6,76,38,1)+ln(20,16,40)+ln(26,23,28)+box(30,31,20,6),
    gallery:[4,30,56].map(x=>box(x,6,20,18,1)+box(x,27,20,18,1)).join(""),
    video:box(10,6,60,38,1)+'<path d="M35 18v14l12-7z" class="t"/>',
    events:[8,22,36].map(y=>box(6,y,10,10,1)+ln(22,y+2,40)+ln(22,y+7,26)).join(""),
    fundraisers:[6,42].map(x=>box(x,8,32,34)+ln(x+4,14,20)+box(x+4,24,24,3,1)+ln(x+4,32,16)).join(""),
    officers:[6,30,54].map(x=>box(x,10,20,13)+box(x,27,20,13)).join(""),
    contact:ln(6,10,30)+ln(6,18,26)+ln(6,24,22)+ln(46,10,26)+ln(46,18,28)+box(46,28,14,6,1)+box(62,28,14,6,1),
    give:ln(24,10,32)+ln(18,18,44)+box(14,28,16,7,1)+box(32,28,16,7,1)+box(50,28,16,7,1),
    store:[4,30,56].map(x=>box(x,6,20,22,1)+ln(x,32,16)+box(x,38,12,5)).join(""),
    html:'<path d="M28 15l-10 10 10 10M52 15l10 10-10 10M44 12l-8 26" class="s"/>'
  };
  const thumb=t=>`<svg class="bld-thumb" viewBox="0 0 80 50" aria-hidden="true">${THUMB[t]||""}</svg>`;

  /* ---------- the canvas ---------- */
  const PLAIN=(()=>{const d=document.createElement("div");try{d.contentEditable="plaintext-only"}catch(e){}return d.contentEditable==="plaintext-only"?"plaintext-only":"true"})();
  const loadedFonts={modern:true};
  function font(k){if(loadedFonts[k]||!L.FONTS[k])return;loadedFonts[k]=true;const l=document.createElement("link");l.rel="stylesheet";l.href=L.fontHref(k);document.head.appendChild(l)}
  function draw(){
    const c=$("#bld-canvas"),stage=$("#bld-stage"),y=stage.scrollTop;
    font(layout.theme.font);
    c.innerHTML=L.render(A.publicSite(),{page:curPage(),edit:!previewing,root:ROOT});
    if(!previewing)decorate(c);
    stage.scrollTop=y;
    const p=curPage();$("#bld-url").textContent=(CLOUD&&SLUG?location.host:"www.lodgenet.app")+ROOT+(p.slug?"/"+p.slug:"");
  }
  function decorate(c){
    const secs=$$(".ls-sec[data-sid]",c),n=secs.length;
    const gap=i=>`<div class="bx-gap${insertAt===i?" on":""}" data-gap="${i}"><button type="button" data-bx-add="${i}">${I.plus}<span>Add section</span></button></div>`;
    secs.forEach((el,i)=>{
      const s=secOf(el.dataset.sid);if(!s)return;
      el.classList.add("bx-sec");if(s.id===sel)el.classList.add("bx-on");
      el.insertAdjacentHTML("afterbegin",`<span class="bx-chip">${esc(L.SECTIONS[s.type].name)}</span><div class="bx-tools" data-bx>
        <button type="button" class="bx-drag" draggable="true" data-bx-drag title="Drag to move">${I.drag}<span class="sr">Drag to move</span></button>
        <button type="button" data-bx-edit title="Edit">${I.edit}<span class="sr">Edit section</span></button>
        <button type="button" data-bx-up${i?"":" disabled"} title="Move up">${I.up}<span class="sr">Move up</span></button>
        <button type="button" data-bx-down${i<n-1?"":" disabled"} title="Move down">${I.down}<span class="sr">Move down</span></button>
        <button type="button" data-bx-dup title="Duplicate">${I.dup}<span class="sr">Duplicate</span></button>
        <button type="button" data-bx-del title="Delete">${I.del}<span class="sr">Delete section</span></button></div>`);
      if(el.querySelector("iframe"))el.insertAdjacentHTML("beforeend",'<div class="bx-cover" aria-hidden="true"></div>');
      el.insertAdjacentHTML("beforeend",`<button type="button" class="bx-addsec" data-bx-add="${i+1}">${I.plus}<span>Add Section</span></button>`);
      el.insertAdjacentHTML("beforebegin",gap(i));
    });
    const main=c.querySelector("main");
    if(n)main.insertAdjacentHTML("beforeend",gap(n));
    else main.innerHTML=`<div class="bx-blank"><b>This page is empty</b><span>Drag a section here from the left, or</span><button type="button" class="btn sm" data-bx-add="0">Add a section</button></div>`;
    $$("[data-f]",c).forEach(el=>{el.contentEditable=PLAIN;el.spellcheck=true;el.classList.add("bx-txt")});
  }
  let drawTimer=0;
  function drawSoon(){clearTimeout(drawTimer);drawTimer=setTimeout(()=>{if(!$("#bld-canvas").contains(document.activeElement))draw()},140)}
  function drawAll(){draw();drawPagePick();drawPanel();drawTools();drawOverview()}

  /* ---------- reading and writing a section's fields: "heading", "button.label", "items.1.title" ---------- */
  const getPath=(o,p)=>p.split(".").reduce((x,k)=>x==null?x:x[k],o);
  function setPath(o,p,v){const k=p.split("."),last=k.pop();const t=k.reduce((x,key)=>{if(x[key]==null)x[key]=/^\d+$/.test(key)?[]:{};return x[key]},o);t[last]=v}

  /* ---------- section actions ---------- */
  function addSection(type,at){
    const arr=curPage().sections;if(arr.length>=MAX_SECTIONS)return alert(`A page can hold up to ${MAX_SECTIONS} sections.`);
    const s=L.newSection(type);
    change(()=>{const i=at!=null?at:sel&&secOf(sel)?arr.findIndex(x=>x.id===sel)+1:arr.length;arr.splice(Math.max(0,Math.min(i,arr.length)),0,s);sel=s.id;insertAt=null;tab="edit"});
    reveal(s.id);
  }
  function moveSection(id,to){const arr=curPage().sections,i=arr.findIndex(x=>x.id===id);if(i<0)return;
    change(()=>{const [s]=arr.splice(i,1);arr.splice(to>i?to-1:to,0,s)})}
  function dupSection(id){const arr=curPage().sections,i=arr.findIndex(x=>x.id===id);if(i<0)return;
    const c=JSON.parse(JSON.stringify(arr[i]));c.id="s"+rid(7);change(()=>{arr.splice(i+1,0,c);sel=c.id;tab="edit"});reveal(c.id)}
  function delSection(id){const arr=curPage().sections,i=arr.findIndex(x=>x.id===id);if(i<0)return;
    change(()=>{arr.splice(i,1);if(sel===id){sel=null;tab="add";panelOpen=false}})}
  function select(id){sel=id;insertAt=null;tab="edit";panelOpen=true;menu=null;$$("#bld-canvas .bx-on").forEach(e=>e.classList.remove("bx-on"));
    const el=$(`#bld-canvas [data-sid="${id}"]`);if(el)el.classList.add("bx-on");$$("#bld-canvas .bx-gap.on").forEach(e=>e.classList.remove("on"));drawPanel();drawTools()}
  function reveal(id){requestAnimationFrame(()=>{const el=$(`#bld-canvas [data-sid="${id}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"nearest"})})}
  function go(id){if(!pageById(id))return;curId=id;sel=null;insertAt=null;if(tab==="edit"){tab="add";panelOpen=false}$("#bld-stage").scrollTop=0;drawAll()}

  /* pictures, shrunk in the browser like every other LodgeNet photo */
  function pickFiles(multiple){return new Promise(ok=>{const i=document.createElement("input");i.type="file";i.accept="image/*";i.multiple=!!multiple;
    i.onchange=()=>ok([...i.files]);i.click()})}
  async function shrink(files,kind){const out=[];for(const f of files){try{out.push(await A.shrinkPic(await A.fileUrl(f),kind))}catch(e){alert(`${f.name} isn't a picture LodgeNet can read.`)}}return out}
  async function choosePic(s,path){
    if(path==="images"){const room=GAL_MAX-(s.images||[]).length;if(room<=0)return alert(`A gallery holds up to ${GAL_MAX} photos. Add another gallery section for more.`);
      const files=(await pickFiles(true)).slice(0,room);if(!files.length)return;const u=await shrink(files,"gallery");if(u.length)change(()=>{s.images=(s.images||[]).concat(u)});return}
    const files=await pickFiles(false);if(!files.length)return;
    const [u]=await shrink(files,s.type==="hero"?"hero":"block");if(u)change(()=>setPath(s,path,u));
  }

  /* ---------- canvas events ---------- */
  const canvas=$("#bld-canvas");
  canvas.addEventListener("click",e=>{
    if(previewing){const a=e.target.closest("a");if(a){e.preventDefault();const g=a.closest("[data-goto]")||a;if(g.dataset.goto)go(g.dataset.goto)}return}
    const t=e.target;
    const goto=t.closest("[data-goto]");if(goto){e.preventDefault();return go(goto.dataset.goto)}
    const add=t.closest("[data-bx-add]");if(add){insertAt=+add.dataset.bxAdd;sel=null;tab="add";panelOpen=true;draw();drawPanel();drawTools();return}
    const secEl=t.closest("[data-sid]");
    if(t.closest("a")&&!t.closest("[data-f]"))e.preventDefault();
    if(!secEl)return;
    const id=secEl.dataset.sid,s=secOf(id);if(!s)return;
    const tool=t.closest("[data-bx] button");
    if(tool){const d=tool.dataset,arr=curPage().sections,i=arr.indexOf(s);
      if("bxUp" in d)return moveSection(id,i-1);if("bxDown" in d)return moveSection(id,i+2);
      if("bxDup" in d)return dupSection(id);if("bxDel" in d)return delSection(id);return select(id)}
    const im=t.closest("[data-img]");if(im){select(id);return choosePic(s,im.dataset.img)}
    if(t.closest("a[data-f]"))e.preventDefault();
    if(sel!==id||tab!=="edit"||!panelOpen)select(id);
  });
  let typing=false;
  canvas.addEventListener("focusin",e=>{if(e.target.matches("[data-f]")&&!typing){commit();typing=true}});
  canvas.addEventListener("focusout",e=>{if(e.target.matches("[data-f]"))typing=false});
  canvas.addEventListener("input",e=>{const el=e.target.closest("[data-f]"),sec=el&&el.closest("[data-sid]");if(!el||!sec)return;
    const s=secOf(sec.dataset.sid);if(!s)return;const v=el.innerText.replace(/\n+$/,"");setPath(s,el.dataset.f,v);
    const f=$(`#bld-edit [data-ed="${el.dataset.f}"]`);if(f&&document.activeElement!==f)f.value=v});
  canvas.addEventListener("keydown",e=>{const el=e.target.closest("[data-f]");if(!el)return;
    if(e.key==="Enter"&&!el.classList.contains("ls-body")){e.preventDefault();el.blur()}
    if(e.key==="Escape")el.blur()});
  canvas.addEventListener("paste",e=>{if(!e.target.closest("[data-f]"))return;e.preventDefault();
    document.execCommand("insertText",false,(e.clipboardData||window.clipboardData).getData("text/plain"))});

  /* ---------- drag and drop: library cards onto the page, sections by their handle ---------- */
  function dropIndex(y){const secs=$$("#bld-canvas .ls-sec[data-sid]");for(let i=0;i<secs.length;i++){const r=secs[i].getBoundingClientRect();if(y<r.top+r.height/2)return i}return secs.length}
  function showDrop(i){$$("#bld-canvas .bx-gap").forEach(g=>g.classList.toggle("drop",+g.dataset.gap===i));const b=$("#bld-canvas .bx-blank");if(b)b.classList.add("drop")}
  function endDrag(){drag=null;document.body.classList.remove("bx-dragging");$$("#bld-canvas .drop").forEach(g=>g.classList.remove("drop"))}
  document.addEventListener("dragstart",e=>{
    const card=e.target.closest&&e.target.closest("[data-add]");
    if(card&&card.closest("#bld-add")){drag={add:card.dataset.add};e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-lodgenet-section",card.dataset.add)}
    else if(e.target.closest&&e.target.closest("[data-bx-drag]")){const sec=e.target.closest("[data-sid]");drag={move:sec.dataset.sid};
      e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-lodgenet-section",sec.dataset.sid);try{e.dataTransfer.setDragImage(sec,40,20)}catch(err){}}
    else return;
    document.body.classList.add("bx-dragging");
  });
  /* caught on the way down, so the page's editable text never takes the drop */
  $("#bld-stage").addEventListener("dragover",e=>{if(!drag)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=drag.add?"copy":"move";showDrop(dropIndex(e.clientY))},true);
  $("#bld-stage").addEventListener("drop",e=>{if(!drag)return;e.preventDefault();e.stopPropagation();const i=dropIndex(e.clientY),d=drag;endDrag();
    if(d.add)addSection(d.add,i);else moveSection(d.move,i)},true);
  document.addEventListener("dragend",endDrag);
  /* the toolbar only shows on hover, so hold it open while its drag handle is pressed */
  canvas.addEventListener("mousedown",e=>{const h=e.target.closest("[data-bx-drag]");if(h)h.closest("[data-sid]").classList.add("bx-hold")});
  document.addEventListener("mouseup",()=>$$("#bld-canvas .bx-hold").forEach(x=>x.classList.remove("bx-hold")));
  document.addEventListener("dragend",()=>$$("#bld-canvas .bx-hold").forEach(x=>x.classList.remove("bx-hold")));

  /* ---------- left panel ---------- */
  const TITLES={add:"Add to this page",pages:"Pages",design:"Design",settings:"Lodge info"};
  function showTab(t){tab=t;panelOpen=true;drawPanel()}
  function closePanel(){panelOpen=false;if(tab==="edit"){sel=null;tab="add";$$("#bld-canvas .bx-on").forEach(x=>x.classList.remove("bx-on"))}insertAt=null;
    $$("#bld-canvas .bx-gap.on").forEach(g=>g.classList.remove("on"));drawPanel();drawTools()}
  function drawPanel(){
    $$(".bld-rail [data-tab]").forEach(b=>b.setAttribute("aria-pressed",String(panelOpen&&b.dataset.tab===tab)));
    $("#bld-side").hidden=!panelOpen||previewing;
    if(!panelOpen)return;
    $$(".bld-panel").forEach(p=>p.hidden=p.dataset.panel!==tab);
    const s=tab==="edit"&&secOf(sel);$("#bld-side-title").textContent=s?L.SECTIONS[s.type].name:TITLES[tab]||"";
    if(tab==="add")drawAdd();if(tab==="edit")drawEdit();if(tab==="design")drawDesign();if(tab==="pages")drawPages();
  }
  function drawAdd(){
    const groups={};Object.entries(L.SECTIONS).forEach(([k,v])=>(groups[v.group]=groups[v.group]||[]).push([k,v]));
    $("#bld-add").innerHTML=`<p class="bld-lead">${insertAt!=null?"<b>Choose a section</b> to add where the gold line is.":"<b>Click a section</b> to add it to this page, or <b>drag it</b> to where you want it."}</p>
      ${Object.entries(groups).map(([g,list])=>`<h3 class="bld-h">${g==="Lodge"?"Lodge sections (fill themselves in)":g}</h3>
        <div class="bld-lib">${list.map(([k,v])=>`<button type="button" class="bld-card" draggable="true" data-add="${k}">${thumb(k)}<span>${esc(v.name)}</span></button>`).join("")}</div>`).join("")}`;
  }

  $("#bld-add").addEventListener("click",e=>{const c=e.target.closest("[data-add]");if(c)addSection(c.dataset.add,insertAt)});

  /* the editor for the selected section */
  const FIELDS={
    hero:[["heading","Heading","line","Leave empty to show the lodge's name"],["sub","Line under the heading","area","Leave empty to show the town and meeting time"],["image","Picture","image"],["button","Button","button"],
      ["layout","Layout","choice",[["center","Centered"],["left","Left"],["split","Beside picture"]]],["height","Height","choice",[["tall","Tall"],["short","Short"]]]],
    text:[["heading","Heading","line"],["body","Text","area"],["align","Text","choice",[["left","Left"],["center","Centered"]]]],
    imageText:[["heading","Heading","line"],["body","Text","area"],["image","Picture","image"],["side","Picture on the","choice",[["left","Left"],["right","Right"]]],["button","Button","button"]],
    features:[["heading","Heading","line"],["style","Style","choice",[["lines","Simple"],["cards","Cards"]]],["items","Columns","items"]],
    cta:[["heading","Heading","line"],["body","Text","area"],["button","Button","button"]],
    gallery:[["heading","Heading","line"],["images","Photos","gallery"]],
    video:[["heading","Heading","line"],["url","YouTube or Vimeo link","url"]],
    events:[["heading","Heading","line"],["count","How many to show","choice",[["3","3"],["6","6"],["12","12"]]]],
    fundraisers:[["heading","Heading","line"],["body","Text","area"]],
    officers:[["heading","Heading","line"]],
    contact:[["heading","Heading","line"],["body","Text","area"]],
    give:[["heading","Heading","line"],["body","Text","area"]],
    store:[["heading","Heading","line"],["body","Text","area"]],
    html:[["html","Your HTML","code"]]
  };
  const NOTES={
    events:'Events come from the lodge calendar. <a href="#communications">Open Communications</a> to add one.',
    fundraisers:'Upcoming fundraisers come from the <a href="#fundraiser">Fundraiser tab</a>, each with its own page.',
    officers:'Names come from the officer chairs on <a href="#members">Members</a>.',
    contact:'The meeting time, town, email and social links come from <b>Settings</b> in this panel.',
    give:'The giving buttons come from <a href="#settings">Settings → Payment options</a>.',
    store:'Items come from <a href="#merchandise">Merchandise</a>. The store comes with a paid plan.',
    html:'Scripts and styles work. It runs in a sealed frame, so it can\'t reach LodgeNet sign-ins or the lodge\'s records.'
  };
  function field(s,[path,label,kind,extra]){
    const v=getPath(s,path),id="ed-"+path.replace(/\./g,"-");
    if(kind==="line")return `<div class="field"><label for="${id}">${label}</label><input id="${id}" data-ed="${path}" value="${esc(v||"")}"${extra?` placeholder="${esc(extra)}"`:""}></div>`;
    if(kind==="area")return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" data-ed="${path}" rows="4"${extra?` placeholder="${esc(extra)}"`:""}>${esc(v||"")}</textarea></div>`;
    if(kind==="url")return `<div class="field"><label for="${id}">${label}</label><input id="${id}" data-ed="${path}" value="${esc(v||"")}" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" autocapitalize="off" spellcheck="false">
      ${v&&!L.videoSrc(v)?'<span class="hint" style="color:var(--warn)">That doesn\'t look like a YouTube or Vimeo link.</span>':""}</div>`;
    if(kind==="code")return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" class="mono" data-ed="${path}" rows="12" spellcheck="false" placeholder="<div>A donation form, an embedded calendar, a sign-up form…</div>">${esc(v||"")}</textarea>
      <span class="row-acts"><button type="button" class="btn line sm" data-ed-htm="${path}">Load an .html file</button><span class="hint">${v?Math.ceil(String(v).length/1000)+" KB of "+L.HTML_MAX/1000+" KB":""}</span></span></div>`;
    if(kind==="choice")return `<div class="field"><span class="flabel">${label}</span><div class="bld-seg bld-seg-full" role="group" aria-label="${esc(label)}">${extra.map(([k,t])=>`<button type="button" data-ed-choice="${path}" data-v="${k}" aria-pressed="${String(String(v)===k)}">${t}</button>`).join("")}</div></div>`;
    if(kind==="image")return `<div class="field"><span class="flabel">${label}</span>${L.okImg(v)?`<img class="bld-pic" src="${esc(v)}" alt="">`:""}
      <span class="row-acts"><button type="button" class="btn line sm" data-ed-pic="${path}">${L.okImg(v)?"Replace":"Choose a picture"}</button>${L.okImg(v)?`<button type="button" class="btn line sm" data-ed-unpic="${path}">Remove</button>`:""}</span></div>`;
    if(kind==="button"){const b=v||{},link=b.link||"",u=isUrl(link)||link==="url";
      return `<fieldset class="bld-fs"><legend>${label}</legend>
        <div class="field"><label for="${id}-l">Words on the button</label><input id="${id}-l" data-ed="${path}.label" value="${esc(b.label||"")}" placeholder="Leave empty for no button"></div>
        <div class="field"><label for="${id}-k">Opens</label><select id="${id}-k" data-ed-link="${path}">${targetOptions(u?"url":(link||"home"),true)}</select></div>
        <div class="field"${u?"":" hidden"}><label for="${id}-u">Web address</label><input id="${id}-u" data-ed-url="${path}" value="${esc(link==="url"?"":link)}" placeholder="https://" inputmode="url" autocapitalize="off" spellcheck="false"></div></fieldset>`}
    if(kind==="items")return `<div class="field"><span class="flabel">${label}</span>${(v||[]).map((it,i)=>`<fieldset class="bld-fs"><legend>Column ${i+1}</legend>
        <div class="field"><label for="${id}-${i}t">Title</label><input id="${id}-${i}t" data-ed="${path}.${i}.title" value="${esc(it.title||"")}"></div>
        <div class="field"><label for="${id}-${i}b">Text</label><textarea id="${id}-${i}b" data-ed="${path}.${i}.body" rows="3">${esc(it.body||"")}</textarea></div>
        ${(v||[]).length>1?`<button type="button" class="link-btn" data-ed-item-del="${i}">Remove this column</button>`:""}</fieldset>`).join("")}
      ${(v||[]).length<4?'<button type="button" class="btn line sm" data-ed-item-add>Add a column</button>':""}</div>`;
    if(kind==="gallery"){const g=v||[];return `<div class="field"><span class="flabel">${label} <span class="hint">${g.length} of ${GAL_MAX}</span></span>
      <div class="bld-gal">${g.map((u,i)=>`<figure><img src="${esc(u)}" alt=""><span class="bld-gal-acts">
        <button type="button" data-ed-gmove="${i}" data-dir="-1"${i?"":" disabled"} aria-label="Move photo ${i+1} earlier">${I.up}</button>
        <button type="button" data-ed-gmove="${i}" data-dir="1"${i<g.length-1?"":" disabled"} aria-label="Move photo ${i+1} later">${I.down}</button>
        <button type="button" data-ed-gdel="${i}" aria-label="Remove photo ${i+1}">${I.del}</button></span></figure>`).join("")}</div>
      ${g.length<GAL_MAX?'<button type="button" class="btn line sm" data-ed-gadd>Add photos</button>':""}</div>`}
    return "";
  }
  function drawEdit(){
    const s=secOf(sel),el=$("#bld-edit");if(!s){tab="add";return drawPanel()}
    const arr=curPage().sections,i=arr.indexOf(s),bg=s.type!=="hero"&&s.type!=="html";
    el.innerHTML=`${NOTES[s.type]?`<p class="bld-note">${NOTES[s.type]}</p>`:""}
      ${(FIELDS[s.type]||[]).map(f=>field(s,f)).join("")}
      ${bg?field(s,["bg","Background","choice",[["plain","White"],["tint","Cream"],["color","Lodge color"]]]):""}
      <div class="bld-acts"><button type="button" class="btn line sm" data-ed-act="up"${i?"":" disabled"}>${I.up}Up</button><button type="button" class="btn line sm" data-ed-act="down"${i<arr.length-1?"":" disabled"}>${I.down}Down</button>
        <button type="button" class="btn line sm" data-ed-act="dup">${I.dup}Duplicate</button><button type="button" class="btn line sm bld-danger" data-ed-act="del">${I.del}Delete</button></div>`;
  }
  const edit=$("#bld-edit");let edFocus=false;
  edit.addEventListener("focusin",e=>{if(e.target.matches("[data-ed],[data-ed-url]")&&!edFocus){commit();edFocus=true}});
  edit.addEventListener("focusout",()=>{edFocus=false});
  edit.addEventListener("input",e=>{const t=e.target,s=secOf(sel);if(!s)return;
    if(t.dataset.ed){let v=t.value;if(t.dataset.ed==="html"&&v.length>L.HTML_MAX)v=v.slice(0,L.HTML_MAX);setPath(s,t.dataset.ed,v);drawSoon()}});
  edit.addEventListener("change",e=>{const t=e.target,s=secOf(sel);if(!s)return;
    if(t.dataset.edLink){const p=t.dataset.edLink;if(t.value==="url"){setPath(s,p+".link","url");drawEdit();const u=edit.querySelector(`[data-ed-url="${p}"]`);if(u)u.focus();return}
      change(()=>setPath(s,p+".link",t.value));return}
    if(t.dataset.edUrl){let v=t.value.trim();if(v&&!/^(https?:|mailto:|tel:)/i.test(v))v="https://"+v;v=v.replace(/^http:/i,"https:");
      if(v&&!L.safeHref(v))return alert("Enter a full web address that starts with https://");change(()=>setPath(s,t.dataset.edUrl+".link",v||"url"));return}
    if(t.dataset.ed==="url")drawEdit();
  });
  edit.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName==="INPUT")e.preventDefault()});
  edit.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset,s=secOf(sel);
    if(!s)return;
    if(d.edChoice)return change(()=>setPath(s,d.edChoice,d.v));
    if(d.edPic)return choosePic(s,d.edPic);
    if(d.edUnpic)return change(()=>setPath(s,d.edUnpic,""));
    if("edItemAdd" in d)return change(()=>{s.items=(s.items||[]).concat({title:"New column",body:""})});
    if(d.edItemDel)return change(()=>s.items.splice(+d.edItemDel,1));
    if("edGadd" in d)return choosePic(s,"images");
    if(d.edGdel)return change(()=>s.images.splice(+d.edGdel,1));
    if(d.edGmove){const i=+d.edGmove,j=i+(+d.dir);return change(()=>{[s.images[i],s.images[j]]=[s.images[j],s.images[i]]})}
    if(d.edHtm){const i=document.createElement("input");i.type="file";i.accept=".html,.htm,text/html";
      i.onchange=async()=>{const f=i.files[0];if(!f)return;const txt=await f.text();
        if(txt.length>L.HTML_MAX)return alert(`That file is ${Math.ceil(txt.length/1000)} KB. A custom HTML section holds up to ${L.HTML_MAX/1000} KB.`);
        if(String(s.html||"").trim()&&!confirm("Replace the HTML already in this section with "+f.name+"?"))return;change(()=>{s.html=txt})};i.click();return}
    if(d.edAct){const arr=curPage().sections,i=arr.indexOf(s);
      if(d.edAct==="up")moveSection(s.id,i-1);if(d.edAct==="down")moveSection(s.id,i+2);if(d.edAct==="dup")dupSection(s.id);
      if(d.edAct==="del"&&confirm(`Delete this ${L.SECTIONS[s.type].name.toLowerCase()} section?`))delSection(s.id)}
  });

  /* ---------- Design ---------- */
  function drawDesign(){
    const th=layout.theme,logo=A.pics.logo;Object.keys(L.FONTS).forEach(font);
    const opt=(k,v,label,extra)=>`<button type="button" class="bld-opt" data-theme="${k}" data-v="${v}" aria-pressed="${String(th[k]===v)}">${extra||""}<span>${label}</span></button>`;
    $("#bld-color").value=/^#[0-9a-f]{6}$/i.test(A.siteColor||"")?A.siteColor:"#1c3a75";
    $("#bld-design").innerHTML=`<h3 class="bld-h">Fonts</h3><div class="bld-opts">${Object.entries(L.FONTS).map(([k,f])=>opt("font",k,f.name,`<b style="font-family:${esc(f.head)}">Aa</b>`)).join("")}</div>
      <h3 class="bld-h">Buttons</h3><div class="bld-opts bld-opts-2">${opt("btn","rounded","Rounded",'<i class="bld-btn-demo"></i>')}${opt("btn","square","Square",'<i class="bld-btn-demo sq"></i>')}</div>
      <h3 class="bld-h">Header</h3><div class="bld-opts bld-opts-2">${opt("header","center","Centered",'<i class="bld-head-demo"></i>')}${opt("header","left","Logo left",'<i class="bld-head-demo lft"></i>')}</div>
      <h3 class="bld-h">Logo or seal</h3>
      <div class="bld-logo">${L.okImg(logo)?`<img src="${esc(logo)}" alt="">`:'<span class="hint">Without one, the site shows the square and compasses.</span>'}
        <span class="row-acts"><button type="button" class="btn line sm" data-logo>${L.okImg(logo)?"Replace":"Upload a logo"}</button>${L.okImg(logo)?'<button type="button" class="btn line sm" data-unlogo>Remove</button>':""}</span></div>
      <h3 class="bld-h">Start over from a design</h3>
      <div class="bld-designs">${Object.entries(L.SITE_TEMPLATES).map(([k,t])=>`<button type="button" class="bld-design" data-design="${k}">${mini(designSite(k),1200)}<b>${esc(t.name)}</b></button>`).join("")}</div>`;
    fitMinis($("#bld-design"));
  }
  $('[data-panel="design"]').addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.design){applyDesign(b.dataset.design);return}
    if(b.dataset.theme){const k=b.dataset.theme,v=b.dataset.v;change(()=>{layout.theme[k]=v});return}
    if("logo" in b.dataset){const f=await pickFiles(false);if(!f.length)return;try{A.pics.logo=await A.shrinkPic(await A.fileUrl(f[0]),"logo")}catch(err){return alert("That file isn't a picture LodgeNet can read.")}drawAll();A.save();return}
    if("unlogo" in b.dataset){A.pics.logo="";drawAll();A.save()}
  });
  $("#bld-color").addEventListener("input",e=>A.setColor(e.target.value));

  /* ---------- Pages ---------- */
  const slugify=t=>String(t||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48)||"page";
  function uniqueSlug(base,self){let s=slugify(base);if(RESERVED.includes(s))s+="-page";let out=s,n=2;while(pages.some(p=>p!==self&&p.slug===out))out=s+"-"+n++;return out}
  let pageOpen=null;
  function drawPages(){
    const n=pages.length;
    $("#bld-pages").innerHTML=addingPage?`<div class="bld-edit-h"><button type="button" class="link-btn" data-pg-cancel>${I.back}Pages</button></div>
        <h3 class="bld-title">Add a page</h3><p class="bld-lead">Start from a ready-made page and change anything on it.</p>
        <div class="bld-lib">${Object.entries(L.TEMPLATES).map(([k,t])=>`<button type="button" class="bld-card" data-tpl="${k}">${I.page}<span>${esc(t.name)}</span></button>`).join("")}</div>`
      :`<p class="bld-lead">Click a page to edit it. The menu on the site follows this order.</p>
      <ul class="bld-pages">${pages.map((p,i)=>`<li class="${p.id===curId?"on":""}">
        <div class="bld-page-row"><button type="button" class="bld-page-go" data-pg-go="${p.id}">${p.id==="home"?I.home:I.page}<span><b>${esc(p.title)}</b><small>${esc(p.slug?"/"+p.slug:"/")}${p.nav===false?" · hidden from menu":""}</small></span></button>
          ${p.id==="home"?"":`<button type="button" class="bld-icon" data-pg-up="${i}"${i>1?"":" disabled"} title="Move up">${I.up}<span class="sr">Move ${esc(p.title)} up</span></button><button type="button" class="bld-icon" data-pg-down="${i}"${i<n-1?"":" disabled"} title="Move down">${I.down}<span class="sr">Move ${esc(p.title)} down</span></button>`}
          <button type="button" class="bld-icon" data-pg-set="${p.id}" aria-expanded="${String(pageOpen===p.id)}" title="Page settings">${I.gear}<span class="sr">Settings for ${esc(p.title)}</span></button></div>
        ${pageOpen===p.id?`<div class="bld-page-set">
          <div class="field"><label for="pg-t-${p.id}">Page name</label><input id="pg-t-${p.id}" data-pg-title="${p.id}" value="${esc(p.title)}"></div>
          ${p.id==="home"?"":`<div class="field"><label for="pg-s-${p.id}">Address</label><div class="pre"><span>…/</span><input id="pg-s-${p.id}" data-pg-slug="${p.id}" value="${esc(p.slug)}" autocapitalize="off" spellcheck="false"></div><span class="hint">Changing it breaks links people saved. Buttons and QR codes keep working.</span></div>`}
          <label class="check"><input type="checkbox" data-pg-nav="${p.id}"${p.nav!==false?" checked":""}> Show in the site menu</label>
          ${p.id==="home"?"":`<button type="button" class="btn line sm bld-danger" data-pg-del="${p.id}">${I.del}Delete page</button>`}</div>`:""}</li>`).join("")}</ul>
      ${n<MAX_PAGES?`<button type="button" class="btn sm" data-pg-add>${I.plus}Add a page</button>`:`<p class="hint">That's the most pages a lodge site can have (${MAX_PAGES}).</p>`}`;
  }
  const pg=$("#bld-pages");
  pg.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
    if("pgAdd" in d){addingPage=true;return drawPages()}
    if("pgCancel" in d){addingPage=false;return drawPages()}
    if(d.tpl){const t=L.TEMPLATES[d.tpl];const p={id:"p"+rid(7),title:t.title,slug:uniqueSlug(t.title),nav:true,sections:t.make()};
      addingPage=false;change(()=>{pages.push(p);curId=p.id;sel=null});return}
    if(d.pgGo)return go(d.pgGo);
    if(d.pgSet){pageOpen=pageOpen===d.pgSet?null:d.pgSet;return drawPages()}
    if(d.pgUp||d.pgDown){const i=+(d.pgUp||d.pgDown),j=d.pgUp?i-1:i+1;if(j<1||j>=pages.length)return;return change(()=>{[pages[i],pages[j]]=[pages[j],pages[i]]})}
    if(d.pgDel){const p=pageById(d.pgDel);if(!p||!confirm(`Delete the page "${p.title}" and everything on it?`))return;
      change(()=>{pages.splice(pages.indexOf(p),1);if(curId===p.id)curId="home";pageOpen=null});
      if(window.LodgeNetSite.pageDeleted)window.LodgeNetSite.pageDeleted(p.id)}
  });
  pg.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName==="INPUT"){e.preventDefault();e.target.blur()}});
  pg.addEventListener("change",e=>{const t=e.target,d=t.dataset;
    if(d.pgTitle){const p=pageById(d.pgTitle);if(p)change(()=>{p.title=t.value.trim().slice(0,60)||p.title})}
    if(d.pgSlug){const p=pageById(d.pgSlug);if(p)change(()=>{p.slug=uniqueSlug(t.value||p.title,p)})}
    if(d.pgNav){const p=pageById(d.pgNav);if(p)change(()=>{p.nav=t.checked})}
  });

  /* ---------- top bar and the frame's bar ---------- */
  function drawPagePick(){
    $("#bld-page").innerHTML=pages.map(p=>`<option value="${esc(p.id)}"${p.id===curId?" selected":""}>${esc(p.title)}</option>`).join("")
      +(pages.length<MAX_PAGES?'<option value="+">+ Add a page…</option>':"");
    $("#bld-sitename").textContent=A.publicSite().full||"Your lodge";
  }
  $("#bld-page").addEventListener("change",e=>{if(e.target.value==="+"){addingPage=true;showTab("pages");drawPagePick();return}go(e.target.value)});
  $$(".bld-rail [data-tab]").forEach(b=>b.addEventListener("click",()=>{const t=b.dataset.tab;addingPage=false;
    if(panelOpen&&tab===t)return closePanel();
    if(t!=="add")insertAt=null;sel=null;$$("#bld-canvas .bx-on").forEach(x=>x.classList.remove("bx-on"));showTab(t);drawTools();if(t==="add")draw()}));
  $("#bld-side-close").addEventListener("click",closePanel);
  $$("[data-dev]").forEach(b=>b.addEventListener("click",()=>{device=b.dataset.dev;$$("[data-dev]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));$("#bld-frame").classList.toggle("phone",device==="phone")}));
  $("#bld-undo").addEventListener("click",undo);$("#bld-redo").addEventListener("click",redo);
  function setPreview(on){previewing=on;const b=$("#bld-preview");b.setAttribute("aria-pressed",String(on));
    b.textContent=on?"Back to editor":"Preview";$("#bld").classList.toggle("previewing",on);draw();drawPanel();drawTools()}
  $("#bld-preview").addEventListener("click",()=>setPreview(!previewing));
  const editorOpen=()=>!$("#bld").hidden;
  document.addEventListener("keydown",e=>{
    if(!editorOpen())return;
    if(e.key==="Escape"&&!e.target.closest("[data-f],input,textarea,select")){if(menu){menu=null;return drawTools()}if(previewing)return setPreview(false);if(panelOpen)return closePanel()}
    if(!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=="z")return;
    const t=e.target;if(t.closest&&t.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])"))return;
    e.preventDefault();e.shiftKey?redo():undo()});
  /* Enter in the lodge details must not press Publish */
  $("#site-form").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName==="INPUT")e.preventDefault()});

  /* ---------- the toolbar row: + Add, and the selected section's tools ---------- */
  /* "Change layout" choices per section type: [field, value, label] */
  const LAYOUTS={
    hero:[["layout","center","Words centered over the picture"],["layout","left","Words on the left over the picture"],["layout","split","Words beside the picture"]],
    imageText:[["side","left","Picture on the left"],["side","right","Picture on the right"]],
    text:[["align","left","Left aligned"],["align","center","Centered"]],
    features:[["style","lines","Simple columns"],["style","cards","Cards"]],
    events:[["count","3","Show 3 events"],["count","6","Show 6 events"],["count","12","Show 12 events"]]
  };
  const BGS=[["plain","White"],["tint","Cream"],["color","Lodge color"]];
  const curVal=(s,f)=>String(s[f]!=null?s[f]:f==="layout"?(s.align==="left"?"left":"center"):f==="style"?"lines":f==="side"?"left":f==="align"?"left":"");
  function drawTools(){
    const s=sel&&secOf(sel),el=$("#bld-tools");
    const addBtn=`<button type="button" class="bld-add" data-tl="add" aria-pressed="${String(panelOpen&&tab==="add")}">${I.plus}<span>Add</span></button>`;
    if(previewing){el.innerHTML=`<span class="bld-tools-hint">Previewing ${esc(curPage().title)}. Links between pages work here. <button type="button" class="link-btn" data-tl="unpreview">Back to editor</button></span>`;return}
    if(!s){el.innerHTML=addBtn+`<span class="bld-sep"></span><span class="bld-tools-hint">Click any section on the page to edit it, or click its text to type.</span>
      <span class="bld-tools-r"><button type="button" class="bld-tool" data-tl="design">${I.gear}<span>Site design</span></button><button type="button" class="bld-tool" data-tl="pages">${I.page}<span>Pages</span></button></span>`;return}
    const L2=LAYOUTS[s.type],hasBg=s.type!=="hero"&&s.type!=="html",arr=curPage().sections,i=arr.indexOf(s);
    const dd=(k,label,icon,items)=>`<span class="bld-dd"><button type="button" class="bld-tool" data-tl-menu="${k}" aria-expanded="${String(menu===k)}">${icon}<span>${label}</span><svg class="bld-caret" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg></button>
      ${menu===k?`<div class="bld-menu" role="menu">${items}</div>`:""}</span>`;
    el.innerHTML=addBtn+`<span class="bld-sep"></span><span class="bld-chipname">${esc(L.SECTIONS[s.type].name)}</span>
      ${L2?dd("layout","Change layout",'<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="1"/><path d="M10 3v14M3 10h7"/></svg>',
        L2.map(([f,v,t])=>`<button type="button" role="menuitemradio" aria-checked="${String(curVal(s,f)===v)}" data-tl-set="${f}" data-v="${v}">${esc(t)}</button>`).join("")):""}
      ${hasBg?dd("bg","Background",'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor"/></svg>',
        BGS.map(([v,t])=>`<button type="button" role="menuitemradio" aria-checked="${String((s.bg||"plain")===v)}" data-tl-set="bg" data-v="${v}">${esc(t)}</button>`).join("")):""}
      ${s.type==="hero"||s.type==="imageText"?`<button type="button" class="bld-tool" data-tl="pic">${'<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1"/><circle cx="7.5" cy="8.5" r="1.5"/><path d="m3.5 15 4.5-4.5 3 3 2-2 3.5 3.5"/></svg>'}<span>${L.okImg(s.image)?"Replace picture":"Add picture"}</span></button>`:""}
      <button type="button" class="bld-tool" data-tl="edit">${I.edit}<span>Edit</span></button>
      <span class="bld-tools-r">
        <button type="button" class="bld-icon" data-tl="up"${i?"":" disabled"} title="Move up">${I.up}<span class="sr">Move up</span></button>
        <button type="button" class="bld-icon" data-tl="down"${i<arr.length-1?"":" disabled"} title="Move down">${I.down}<span class="sr">Move down</span></button>
        <button type="button" class="bld-icon" data-tl="dup" title="Duplicate">${I.dup}<span class="sr">Duplicate</span></button>
        <button type="button" class="bld-icon bld-danger" data-tl="del" title="Delete">${I.del}<span class="sr">Delete section</span></button></span>`;
  }
  $("#bld-tools").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset,s=sel&&secOf(sel);
    if(d.tl==="unpreview")return setPreview(false);
    if(d.tl==="add"){if(panelOpen&&tab==="add")return closePanel();sel=null;showTab("add");draw();return drawTools()}
    if(d.tl==="design"||d.tl==="pages"){showTab(d.tl);return drawTools()}
    if(d.tlMenu){menu=menu===d.tlMenu?null:d.tlMenu;return drawTools()}
    if(!s)return;
    if(d.tlSet){menu=null;return change(()=>{s[d.tlSet]=d.tlSet==="count"?d.v:d.v;if(d.tlSet==="layout")delete s.align})}
    const arr=curPage().sections,i=arr.indexOf(s);
    if(d.tl==="pic")return choosePic(s,"image");
    if(d.tl==="edit"){tab="edit";panelOpen=true;return drawPanel()}
    if(d.tl==="up")return moveSection(s.id,i-1);if(d.tl==="down")return moveSection(s.id,i+2);
    if(d.tl==="dup")return dupSection(s.id);if(d.tl==="del")return delSection(s.id);
  });
  document.addEventListener("click",e=>{if(menu&&!e.target.closest(".bld-dd")){menu=null;drawTools()}});

  /* ---------- whole-site designs ---------- */
  /* buttons in a design point at the page that fits their words */
  function wireLinks(list){
    const find=re=>list.find(p=>p.id!=="home"&&re.test(p.title));
    const contact=find(/contact|visit/i),join=find(/mason|member|join/i),fund=find(/fundrais/i),events=find(/event/i);
    list.forEach(p=>p.sections.forEach(s=>{const b=s.button;if(!b||!b.label||b.link)return;
      const t=/mason|join|member/i.test(b.label)?join||contact:/fundrais|give|donat|goal/i.test(b.label)?fund||events||contact:contact||join;
      b.link=t?"page:"+t.id:"home"}));
    return list;
  }
  function designSite(k){const t=L.SITE_TEMPLATES[k],site=A.publicSite();site.color=t.color;site.layout={theme:t.theme,pages:wireLinks(t.pages())};return site}
  function applyDesign(k){const t=L.SITE_TEMPLATES[k];if(!t)return;
    if(!confirm(`Use the ${t.name} design? It replaces your pages, sections and look with this design's. You can press Undo to go back.`))return false;
    commit();const np=wireLinks(t.pages());
    /* keep the lodge's own pictures: its banner and gallery carry over into the new design */
    const oldHero=pages[0].sections.find(x=>x.type==="hero"&&L.okImg(x.image)),oldGal=[].concat(...pages.map(p=>p.sections.filter(x=>x.type==="gallery").map(x=>x.images||[])));
    if(oldHero){const h=np[0].sections.find(x=>x.type==="hero");if(h)h.image=oldHero.image}
    if(oldGal.length){const g=np[0].sections.find(x=>x.type==="gallery");if(g)g.images=oldGal.slice(0,GAL_MAX)}
    pages.splice(0,pages.length,...np);Object.assign(layout.theme,t.theme);curId="home";sel=null;
    A.setColor(t.color);drawAll();A.save();return true}
  /* thumbnails are the real site drawn wide and scaled down to fit their box */
  const fitRO=typeof ResizeObserver==="function"?new ResizeObserver(es=>es.forEach(e=>fit(e.target))):null;
  function fit(m){const i=m.firstElementChild,w=parseFloat(getComputedStyle(m).getPropertyValue("--mw"))||1200;if(i&&m.clientWidth)i.style.transform=`scale(${m.clientWidth/w})`}
  function fitMinis(root){$$(".mini",root).forEach(m=>{fit(m);if(fitRO)fitRO.observe(m)})}
  /* a live, shrunk copy of the design, drawn by the real renderer */
  const mini=(site,w)=>`<div class="mini" style="--mw:${w}px"><div class="mini-in">${L.render(site,{page:site.layout.pages[0],root:ROOT})}</div></div>`;

  /* ---------- the Website overview (the tab before Edit site) ---------- */
  function checklist(){
    const site=A.publicSite(),all=pages.flatMap(p=>p.sections),defaults=Object.values(L.SECTIONS).map(d=>d.make().body).filter(Boolean);
    return [
      ["Add the lodge's name and meeting time",!!(A.CFG&&site.name&&site.name!=="Your Lodge"&&site.schedule),"settings"],
      ["Upload a logo or seal",L.okImg(A.pics.logo),"design"],
      ["Add a banner picture",all.some(s=>s.type==="hero"&&L.okImg(s.image)),"hero"],
      ["Tell visitors about the lodge",all.some(s=>(s.type==="text"||s.type==="imageText")&&String(s.body||"").trim().length>30&&!defaults.includes(s.body)),"about"],
      ["Add a second page",pages.length>1,"pages"],
      ["Publish your site",!!(A.published&&A.published.site),"publish"]
    ];
  }
  function ring(done,total){const r=26,c=2*Math.PI*r;return `<svg class="wov-ring" viewBox="0 0 64 64" role="img" aria-label="${done} of ${total} done"><circle cx="32" cy="32" r="${r}" class="bg"/><circle cx="32" cy="32" r="${r}" class="fg" stroke-dasharray="${c*done/total} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${done}/${total}</text></svg>`}
  function drawOverview(){
    const el=$("#wov");if(!el||el.hidden)return;
    Object.keys(L.FONTS).forEach(font);
    const site=A.publicSite(),pub=A.published&&A.published.site,paid=!CLOUD||CLOUD.paid;
    const url=(CLOUD&&SLUG?location.host:"www.lodgenet.app")+ROOT,live=CLOUD&&SLUG&&pub;
    const steps=checklist(),done=steps.filter(x=>x[1]).length;
    const status=!CLOUD?'<span class="pill">Demo</span>':!paid?'<span class="pill warn">Preview only</span>':pub?'<span class="pill ok">Published</span>':'<span class="pill">Not published yet</span>';
    el.innerHTML=`<div class="wov-site">
        <div class="wov-shot">${mini(site,1200)}</div>
        <div class="wov-info">
          <span class="eyebrow">Your website</span><h2>${esc(site.full||"Your lodge")}</h2>
          <div class="wov-url">${status}<span class="mono">${esc(url)}</span>${live?`<a href="${esc(ROOT)}" target="_blank" rel="noopener">View live site</a>`:""}</div>
          <p class="hint">${!paid?'Publishing comes with a paid plan. <a href="/login?account">Choose a plan</a>':`${pages.length} ${pages.length===1?"page":"pages"} · edits save as you go and go live when you press Publish.`}</p>
          <div class="row-acts"><a class="btn" href="#website/edit">Edit site</a><a class="btn line" href="#website/edit" data-wov-preview>Preview</a><a class="btn line" href="#qrcodes">QR codes</a></div>
        </div>
      </div>
      <div class="wov-setup">
        <div class="wov-setup-h">${ring(done,steps.length)}<div><h3>${done===steps.length?"Your site is all set":"Let's get your site live"}</h3><p class="hint">${done===steps.length?"Nice work. Keep it fresh with photos and events.":"Finish these steps for a site visitors will trust."}</p></div></div>
        <ul class="wov-steps">${steps.map(([t,ok,go],i)=>`<li class="${ok?"done":i===steps.findIndex(x=>!x[1])?"next":""}"><span class="wov-tick" aria-hidden="true">${ok?'<svg viewBox="0 0 20 20"><path d="m5 10 3.5 3.5L15 7"/></svg>':""}</span><span class="wov-step">${esc(t)}</span>${ok?'<span class="sr">Done</span>':`<a class="btn sm${i===steps.findIndex(x=>!x[1])?" wov-go":" line"}" href="#website/edit" data-step="${go}">${go==="publish"?"Publish":"Start"}</a>`}</li>`).join("")}</ul>
      </div>
      <div class="wov-designs">
        <div class="row-sp"><div><h3>Start from a design</h3><p class="hint">Made for lodges. Pick one and make it yours: every word, picture and section can be changed.</p></div></div>
        <div class="wov-grid">${Object.entries(L.SITE_TEMPLATES).map(([k,t])=>`<div class="wov-card"><div class="wov-card-shot">${mini(designSite(k),1200)}
          <div class="wov-card-acts"><button type="button" class="btn sm" data-design="${k}">Use this design</button></div></div>
          <b>${esc(t.name)}</b><span class="hint">${esc(t.desc)}</span></div>`).join("")}</div>
      </div>`;
    fitMinis(el);
  }
  $("#wov").addEventListener("click",e=>{
    const d=e.target.closest("[data-design]");if(d){if(applyDesign(d.dataset.design))location.hash="website/edit";return}
    const st=e.target.closest("[data-step]");
    if(st){const k=st.dataset.step;
      if(k==="publish"){e.preventDefault();$('#site-form').requestSubmit();return setTimeout(drawOverview,400)}
      pendingStep=k;return}
    if(e.target.closest("[data-wov-preview]"))pendingStep="preview";
  });
  let pendingStep=null;
  function runStep(k){
    if(k==="settings")showTab("settings");
    if(k==="design")showTab("design");
    if(k==="pages"){addingPage=true;showTab("pages")}
    if(k==="preview")setPreview(true);
    if(k==="hero"||k==="about"){const all=pages[0].sections,s=k==="hero"?all.find(x=>x.type==="hero"):all.find(x=>x.type==="text"||x.type==="imageText");
      go("home");if(s){select(s.id);reveal(s.id);if(k==="hero")choosePic(s,"image")}else addSection(k==="hero"?"hero":"text",k==="hero"?0:1)}
    drawTools();
  }

  /* ---------- the editor opens full screen at #website/edit ---------- */
  function route(){
    const open=/^#website\/edit/.test(location.hash),inSite=/^#website/.test(location.hash)||(!location.hash&&!$('.sec[data-sec="website"]').hidden);
    $("#bld").hidden=!open;document.documentElement.classList.toggle("bld-open",open);
    $("#wov").hidden=open;
    if(open){if(previewing&&pendingStep!=="preview")setPreview(false);drawAll();if(pendingStep){const k=pendingStep;pendingStep=null;runStep(k)}}
    else if(inSite){drawOverview()}
  }
  window.addEventListener("hashchange",route);
  /* ---------- after "Build from your current website" (demo.js applyImport) ---------- */
  function fromImport(d){
    const p=A.pics,h=pages[0];
    change(()=>{
      let hero=h.sections.find(s=>s.type==="hero");if(!hero){hero=L.newSection("hero");h.sections.unshift(hero)}
      if(p.hero){hero.image=p.hero;p.hero=""}
      const about=String(d.about||"").trim();
      if(about){let t=h.sections.find(s=>s.type==="text");if(!t){t=L.newSection("text");h.sections.splice(1,0,t)}t.heading=t.heading||"About the lodge";t.body=about}
      if(p.gallery.length){let g=h.sections.find(s=>s.type==="gallery");if(!g){g=L.newSection("gallery");h.sections.push(g)}g.images=(g.images||[]).concat(p.gallery).slice(0,GAL_MAX);p.gallery.splice(0)}
      curId="home";
    });
  }

  window.LodgeNetSite=Object.assign(window.LodgeNetSite||{},{
    snapshot:()=>Object.assign({siteLayout:layout},window.LodgeNetSite.qrSnapshot?window.LodgeNetSite.qrSnapshot():{siteQrs:CFG.siteQrs}),
    publicExtra,preview:()=>{drawSoon();if(!$("#wov").hidden)clearTimeout(ovTimer),ovTimer=setTimeout(drawOverview,300)},fromImport,
    pages:()=>pages,pageById,fundById,fundraisers,ensureFids,targetOptions,linkName,isUrl,ROOT,SLUG,slugify
  });
  let ovTimer=0;
  ensureFids();histBtns();route();if($("#bld").hidden)drawOverview();A.siteState();
})();
