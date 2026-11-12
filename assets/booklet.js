/* The "A5 booklet" layout for a lodge's own tabs (custom-tabs.js). Officers add entries as they come up: a heading,
   text, pictures, and anything pulled from a PDF (drag a box over part of a page to take its text, a picture of it,
   or both). The tab shows the entries and the same entries laid out on A5 pages (148 × 210 mm), and downloads them
   as an A5 PDF. Content lives in the tab's own data (t.c.booklet.entries); pictures are shrunk to JPEG data URLs
   like the rest of the lodge's photos. pdf.js and jsPDF load only when they're needed. */
(function(){
  const PDFJS="/assets/vendor/pdf.min.js",PDFJS_WORKER="/assets/vendor/pdf.worker.min.js",JSPDF="/assets/vendor/jspdf.umd.min.js";
  const PIC_MAX=1400,PIC_Q=.8,WARN_BYTES=8e6;
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let escClear=null;document.addEventListener("keydown",e=>{if(e.key==="Escape"&&escClear)escClear()});
  const S={};                                   /* per-tab state that outlives a re-render: draft, view, open PDF */
  const st=id=>S[id]||(S[id]={mode:"entries",draft:null,pdf:null,msg:"",err:false});

  const loaded={};
  function loadScript(src){
    return loaded[src]||(loaded[src]=new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;
      s.onerror=()=>{delete loaded[src];no(new Error("couldn't load "+src.split("/").pop()))};document.head.appendChild(s)}));
  }
  async function pdfjs(){
    await loadScript(PDFJS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
    return window.pdfjsLib;
  }
  async function jspdf(){if(!window.jspdf)await loadScript(JSPDF);return window.jspdf.jsPDF}

  /* pictures: shrunk in the browser, JPEG on white */
  function shrink(src){return new Promise((ok,no)=>{
    const img=new Image(),url=src instanceof Blob?URL.createObjectURL(src):src;
    img.onload=()=>{const k=Math.min(1,PIC_MAX/Math.max(img.width,img.height)),c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
      if(src instanceof Blob)URL.revokeObjectURL(url);ok(c.toDataURL("image/jpeg",PIC_Q))};
    img.onerror=()=>{if(src instanceof Blob)URL.revokeObjectURL(url);no(new Error("that file isn't a picture this browser can read"))};
    img.src=url})}

  /* ================= mount ================= */
  function mount(box,t,data,o){
    const s=st(t.id);
    data.entries=Array.isArray(data.entries)?data.entries:[];
    const E=data.entries,canEdit=!!o.canEdit,save=o.save;
    box.innerHTML=`<div class="bk">
      <div class="bk-bar">
        <div class="bk-seg" role="group" aria-label="Booklet view"><button type="button" data-mode="entries" aria-pressed="${s.mode==="entries"}">Entries</button><button type="button" data-mode="pages" aria-pressed="${s.mode==="pages"}">A5 pages</button></div>
        <span class="hint bk-count"></span><span class="bk-sp"></span>
        ${canEdit?'<button type="button" class="btn sm" data-new>Add an entry</button>':""}
        <button type="button" class="btn line sm" data-out>Download A5 PDF</button>
      </div>
      <p class="hint bk-msg" role="status"></p>
      <div class="bk-comp-slot"></div>
      <div class="bk-main"></div>
    </div>`;
    const $=q=>box.querySelector(q);
    const msg=(m,err)=>{s.msg=m||"";s.err=!!err;const p=$(".bk-msg");if(p){p.textContent=s.msg;p.classList.toggle("bk-err",s.err)}};
    msg(s.msg,s.err);
    const count=()=>{const n=E.length;$(".bk-count").textContent=n?n+(n===1?" entry":" entries"):""};
    count();

    box.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{s.mode=b.dataset.mode;
      box.querySelectorAll("[data-mode]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));drawMain()}));
    const nb=$("[data-new]");if(nb)nb.addEventListener("click",()=>{if(!s.draft)s.draft={id:null,title:"",body:"",images:[],sources:[]};drawComposer();
      const h=$(".bk-comp [data-d=title]");if(h)h.focus()});
    $("[data-out]").addEventListener("click",download);

    /* ---------- the entries, and the A5 pages ---------- */
    function drawMain(){ s.mode==="pages"?drawPages():drawList() }
    function drawList(){
      const m=$(".bk-main");
      if(!E.length){m.innerHTML=`<div class="bk-empty"><b>No entries yet.</b><span class="hint">${canEdit?"Choose Add an entry to write one, add pictures, or pull text and pictures from a PDF. They're laid out on A5 pages as you go.":"Officers add entries here as they come up."}</span></div>`;return}
      m.innerHTML=`<ol class="bk-list">${E.map((e,i)=>`<li class="bk-entry${s.draft&&s.draft.id===e.id?" on":""}">
        <div class="bk-et"><span class="bk-no">${String(i+1).padStart(2,"0")}</span><b>${esc(e.title||"Untitled entry")}</b></div>
        ${e.body?`<p class="bk-snip">${esc(e.body)}</p>`:""}
        ${e.images&&e.images.length?`<div class="bk-minis">${e.images.slice(0,8).map(im=>`<img src="${esc(im.src)}" alt="">`).join("")}${e.images.length>8?`<span class="hint">+${e.images.length-8}</span>`:""}</div>`:""}
        ${e.sources&&e.sources.length?`<small class="hint">From ${esc(e.sources.join(" · "))}</small>`:""}
        ${canEdit?`<span class="ct-rowbtns"><button type="button" class="btn line sm" data-ed="${i}">Edit</button><button type="button" class="btn line sm" data-mu="${i}"${i?"":" disabled"} aria-label="Move up">↑</button><button type="button" class="btn line sm" data-md="${i}"${i<E.length-1?"":" disabled"} aria-label="Move down">↓</button><button type="button" class="btn line sm" data-rm="${i}" aria-label="Delete entry">✕</button></span>`:""}
      </li>`).join("")}</ol>`;
      m.querySelectorAll("[data-ed]").forEach(b=>b.addEventListener("click",()=>{const e=E[+b.dataset.ed];
        s.draft={id:e.id,title:e.title||"",body:e.body||"",images:(e.images||[]).map(x=>({...x})),sources:[...(e.sources||[])]};
        drawComposer();drawList();$(".bk-comp").scrollIntoView({behavior:"smooth",block:"start"})}));
      const mv=(i,j)=>{if(j<0||j>=E.length)return;[E[i],E[j]]=[E[j],E[i]];save();drawList()};
      m.querySelectorAll("[data-mu]").forEach(b=>b.addEventListener("click",()=>mv(+b.dataset.mu,+b.dataset.mu-1)));
      m.querySelectorAll("[data-md]").forEach(b=>b.addEventListener("click",()=>mv(+b.dataset.md,+b.dataset.md+1)));
      m.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{const i=+b.dataset.rm,e=E[i];
        if(!confirm(`Delete the entry "${e.title||"Untitled entry"}" and its pictures? This can't be undone.`))return;
        E.splice(i,1);if(s.draft&&s.draft.id===e.id){s.draft=null;drawComposer()}save();count();drawList()}));
    }
    let pagesRun=0;
    async function drawPages(){
      const m=$(".bk-main"),run=++pagesRun;
      m.innerHTML='<p class="hint">Laying out A5 pages…</p>';
      try{
        const doc=await layout(t,E);
        const lib=await pdfjs();
        const pdf=await lib.getDocument({data:doc.output("arraybuffer")}).promise;
        if(run!==pagesRun)return;
        const n=pdf.numPages,blanks=n%4?4-n%4:0;
        m.innerHTML=`<p class="hint">${n} A5 pages (148 × 210 mm), cover included${blanks?` · add ${blanks} blank page${blanks>1?"s":""} to fold it as a booklet`:""}.</p><div class="bk-sheets"></div>`;
        const g=m.querySelector(".bk-sheets"),dpr=Math.min(window.devicePixelRatio||1,2);
        for(let p=1;p<=n;p++){
          if(run!==pagesRun)return;
          const page=await pdf.getPage(p),vp1=page.getViewport({scale:1}),w=260,vp=page.getViewport({scale:w/vp1.width*dpr});
          const f=document.createElement("figure");f.className="bk-sheet";
          const c=document.createElement("canvas");c.width=Math.round(vp.width);c.height=Math.round(vp.height);
          const cap=document.createElement("figcaption");cap.textContent=p===1?"Cover":"Page "+(p-1);
          f.append(c,cap);g.append(f);
          await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
        }
        pdf.destroy();
      }catch(e){if(run===pagesRun)m.innerHTML=`<p class="hint bk-err">Couldn't lay out the pages: ${esc(e.message||e)}</p>`}
    }
    async function download(){
      const b=$("[data-out]");b.disabled=true;msg("Building the A5 PDF…");
      try{const doc=await layout(t,E);doc.save(((t.name||"booklet").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"-")||"booklet")+"-A5.pdf");msg("")}
      catch(e){msg("Couldn't build the PDF: "+(e.message||e),true)}
      finally{b.disabled=false}
    }

    /* ---------- the entry being written ---------- */
    function drawComposer(){
      const slot=$(".bk-comp-slot");
      if(!canEdit||!s.draft){slot.innerHTML="";return}
      const d=s.draft;
      slot.innerHTML=`<div class="bk-comp">
        <div class="bk-comp-h"><h4>${d.id?"Edit entry":"New entry"}</h4></div>
        <div class="field"><label>Heading</label><input data-d="title" maxlength="160" value="${esc(d.title)}" placeholder="e.g. Grand Lodge visit, 12 November"></div>
        <div class="field"><label>Text</label><textarea data-d="body" rows="8" placeholder="Type or paste here, or pull text in from a PDF.">${esc(d.body)}</textarea></div>
        <div class="field"><label>Pictures</label><div class="bk-thumbs"></div><div class="bk-drop">Drop pictures or a PDF here, or paste a picture</div></div>
        <p class="hint bk-src"></p>
        <div class="bk-acts">
          <label class="btn line sm">Add pictures<input type="file" accept="image/*" multiple hidden data-addimg></label>
          <label class="btn line sm">Add file (PDF)<input type="file" accept="application/pdf,.pdf" hidden data-addpdf></label>
          <span class="bk-sp"></span>
          <button type="button" class="link-btn" data-cancel>Cancel</button>
          <button type="button" class="btn sm" data-save>${d.id?"Save entry":"Add to booklet"}</button>
        </div>
        <div class="bk-pdf" hidden>
          <div class="bk-pdf-h"><b class="bk-pdf-n"></b><span class="hint bk-pdf-c"></span><span class="bk-sp"></span><button type="button" class="link-btn" data-pdfx>Close PDF</button></div>
          <p class="hint">Drag a box over any part of a page, then pull its text, a picture of it, or both into this entry.</p>
          <div class="bk-pdf-scroll"></div>
        </div>
      </div>`;
      const c=slot.querySelector(".bk-comp"),q=x=>c.querySelector(x);
      c.querySelectorAll("[data-d]").forEach(el=>el.addEventListener("input",()=>{d[el.dataset.d]=el.value}));
      q("[data-addimg]").addEventListener("change",e=>{[...e.target.files].forEach(addPic);e.target.value=""});
      q("[data-addpdf]").addEventListener("change",e=>{const f=e.target.files[0];if(f)openPdf(f);e.target.value=""});
      const drop=q(".bk-drop");
      ["dragenter","dragover"].forEach(k=>drop.addEventListener(k,e=>{e.preventDefault();drop.classList.add("over")}));
      ["dragleave","drop"].forEach(k=>drop.addEventListener(k,()=>drop.classList.remove("over")));
      drop.addEventListener("drop",e=>{e.preventDefault();for(const f of e.dataTransfer.files){
        if(/^image\//.test(f.type))addPic(f);else if(f.type==="application/pdf"||/\.pdf$/i.test(f.name))openPdf(f)}});
      c.addEventListener("paste",e=>{const f=[...((e.clipboardData&&e.clipboardData.files)||[])].filter(x=>/^image\//.test(x.type));if(f.length){e.preventDefault();f.forEach(addPic)}});
      q("[data-cancel]").addEventListener("click",()=>{if((d.body||d.title||d.images.length)&&!d.id&&!confirm("Throw away this entry?"))return;closePdf();s.draft=null;msg("");drawComposer();drawList()});
      q("[data-save]").addEventListener("click",saveDraft);
      q("[data-pdfx]").addEventListener("click",closePdf);
      drawThumbs();drawSources();
      if(s.pdf)showPdf();
    }
    function drawThumbs(){
      const el=box.querySelector(".bk-thumbs");if(!el||!s.draft)return;
      el.innerHTML=s.draft.images.map((im,i)=>`<figure><img src="${esc(im.src)}" alt=""><button type="button" data-unimg="${i}" aria-label="Remove picture">×</button></figure>`).join("")+(s.busy?'<figure class="bk-busy"><span class="hint">Adding…</span></figure>':"");
      el.querySelectorAll("[data-unimg]").forEach(b=>b.addEventListener("click",()=>{s.draft.images.splice(+b.dataset.unimg,1);drawThumbs()}));
    }
    function drawSources(){const el=box.querySelector(".bk-src");if(el&&s.draft)el.textContent=s.draft.sources.length?"From "+s.draft.sources.join(" · "):""}
    const addSource=x=>{if(!s.draft.sources.includes(x))s.draft.sources.push(x);drawSources()};
    async function addPic(src,from){
      if(!s.draft)return;s.busy=(s.busy||0)+1;drawThumbs();
      try{const u=await shrink(src);s.draft.images.push(from?{src:u,from}:{src:u})}
      catch(e){msg("Couldn't add that picture: "+(e.message||e),true)}
      finally{s.busy--;drawThumbs()}
    }
    function saveDraft(){
      const d=s.draft;if(!d)return;
      if(s.busy)return msg("Wait a moment, the pictures are still being added.",true);
      const e={id:d.id||"e-"+uid(),title:d.title.trim(),body:d.body.replace(/\s+$/,""),images:d.images,sources:d.sources,at:new Date().toISOString().slice(0,10)};
      if(!e.title&&!e.body&&!e.images.length)return msg("Add a heading, some text or a picture first.",true);
      const i=E.findIndex(x=>x.id===e.id);
      if(i>=0)E[i]=e;else E.push(e);
      save();closePdf();s.draft=null;
      const size=JSON.stringify(E).length;
      msg((i>=0?"Entry saved.":"Added to the booklet.")+(size>WARN_BYTES?` This booklet is now ${(size/1e6).toFixed(1)} MB of pictures, which slows down saving. Remove a few or use fewer pages as pictures.`:""),size>WARN_BYTES);
      count();drawComposer();drawMain();
    }

    /* ---------- Add file (PDF): pull from what's selected ---------- */
    async function openPdf(file){
      msg("Opening "+file.name+"…");
      try{
        const lib=await pdfjs(),buf=await file.arrayBuffer();
        closePdf();
        const doc=await lib.getDocument({data:buf}).promise;
        s.pdf={doc,name:file.name,base:file.name.replace(/\.pdf$/i,""),pages:{}};
        showPdf();msg("");
        box.querySelector(".bk-pdf").scrollIntoView({behavior:"smooth",block:"start"});
      }catch(e){msg("Couldn't open that PDF: "+(e.message||e),true)}
    }
    function closePdf(){
      if(!s.pdf)return;if(s.pdf.io)s.pdf.io.disconnect();try{s.pdf.doc.destroy()}catch(e){}s.pdf=null;
      const p=box.querySelector(".bk-pdf");if(p){p.hidden=true;p.querySelector(".bk-pdf-scroll").innerHTML=""}
    }
    async function showPdf(){
      const P=s.pdf,panel=box.querySelector(".bk-pdf");if(!P||!panel)return;
      panel.hidden=false;panel.querySelector(".bk-pdf-n").textContent=P.name;
      panel.querySelector(".bk-pdf-c").textContent=P.doc.numPages+(P.doc.numPages===1?" page":" pages");
      const sc=panel.querySelector(".bk-pdf-scroll");sc.innerHTML="";
      if(P.io)P.io.disconnect();
      P.io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){P.io.unobserve(en.target);paint(+en.target.dataset.p)}}),{root:sc,rootMargin:"400px"});
      const avail=Math.max(240,sc.clientWidth-24);
      for(let p=1;p<=P.doc.numPages;p++){
        if(s.pdf!==P)return;
        const page=await P.doc.getPage(p),vp=page.getViewport({scale:1}),k=Math.min(avail/vp.width,1.6);
        const info=P.pages[p]={k,w:vp.width*k,h:vp.height*k,painted:false};
        const el=document.createElement("div");el.className="bk-pp";el.dataset.p=p;el.style.width=info.w+"px";
        el.innerHTML=`<div class="bk-pp-h"><span>Page ${p}</span><span class="ct-rowbtns"><button type="button" class="btn line sm" data-pt>Page text</button><button type="button" class="btn line sm" data-pi>Whole page as picture</button></span></div>
          <div class="bk-pp-c" style="height:${info.h}px"><canvas></canvas><div class="bk-layer" aria-label="Drag to select part of page ${p}"></div></div>`;
        el.querySelector("[data-pt]").addEventListener("click",()=>pull(p,{x:0,y:0,w:info.w,h:info.h},"text"));
        el.querySelector("[data-pi]").addEventListener("click",()=>pull(p,{x:0,y:0,w:info.w,h:info.h},"image"));
        sc.append(el);selectable(el.querySelector(".bk-layer"),p);P.io.observe(el);
      }
    }
    async function paint(p){
      const P=s.pdf,info=P&&P.pages[p];if(!info||info.painted)return;info.painted=true;
      const el=box.querySelector(`.bk-pp[data-p="${p}"]`);if(!el)return;
      const c=el.querySelector("canvas"),dpr=Math.min(window.devicePixelRatio||1,2.5);
      const page=await P.doc.getPage(p),vp=page.getViewport({scale:info.k*dpr});
      c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
      await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
    }
    let sel=null;
    const clearSel=()=>{if(sel){sel.box.remove();sel.bar.remove();sel=null}};
    function selectable(layer,p){
      let a=null,b=null;
      const pos=e=>{const r=layer.getBoundingClientRect();return {x:clamp(e.clientX-r.left,0,r.width),y:clamp(e.clientY-r.top,0,r.height)}};
      const rect=(u,v)=>({x:Math.min(u.x,v.x),y:Math.min(u.y,v.y),w:Math.abs(u.x-v.x),h:Math.abs(u.y-v.y)});
      const put=r=>Object.assign(b.style,{left:r.x+"px",top:r.y+"px",width:r.w+"px",height:r.h+"px"});
      layer.addEventListener("pointerdown",e=>{if(e.button)return;clearSel();layer.setPointerCapture(e.pointerId);a=pos(e);
        b=document.createElement("div");b.className="bk-box";layer.append(b);put(rect(a,a))});
      layer.addEventListener("pointermove",e=>{if(a)put(rect(a,pos(e)))});
      layer.addEventListener("pointerup",e=>{if(!a)return;const r=rect(a,pos(e));a=null;
        if(r.w<8||r.h<8){b.remove();return}
        const bar=document.createElement("div");bar.className="bk-selbar";
        bar.innerHTML='<button type="button" class="btn sm" data-k="text">Pull text</button><button type="button" class="btn line sm" data-k="image">Pull as picture</button><button type="button" class="btn line sm" data-k="both">Both</button><button type="button" class="link-btn" data-k="x">Cancel</button>';
        bar.addEventListener("pointerdown",ev=>ev.stopPropagation());
        bar.querySelectorAll("[data-k]").forEach(x=>x.addEventListener("click",ev=>{ev.stopPropagation();const k=x.dataset.k;clearSel();if(k!=="x")pull(p,r,k)}));
        const host=layer.parentElement;host.append(bar);
        const top=r.y+r.h+6;bar.style.top=(top>host.clientHeight-46?Math.max(0,r.y-46):top)+"px";
        bar.style.left=clamp(r.x,0,Math.max(0,host.clientWidth-320))+"px";
        sel={box:b,bar}});
    }
    escClear=clearSel;
    async function pull(p,r,kind){
      const P=s.pdf;if(!P||!s.draft)return;const from=P.base+", p. "+p;
      try{
        if(kind!=="image"){
          const txt=await textIn(P,p,r);
          if(txt){s.draft.body=s.draft.body?s.draft.body.replace(/\s+$/,"")+"\n\n"+txt:txt;const ta=box.querySelector('.bk-comp [data-d="body"]');if(ta)ta.value=s.draft.body;addSource(from);msg("Pulled the text from page "+p+".")}
          else msg(kind==="both"?"There's no text to pull there (it may be a scan), so only the picture was added.":"There's no text to pull there. It may be a scanned page, so try Pull as picture.",kind!=="both");
        }
        if(kind!=="text"){
          await paint(p);
          const info=P.pages[p],cv=box.querySelector(`.bk-pp[data-p="${p}"] canvas`),k=cv.width/info.w;
          const out=document.createElement("canvas");out.width=Math.max(1,Math.round(r.w*k));out.height=Math.max(1,Math.round(r.h*k));
          out.getContext("2d").drawImage(cv,r.x*k,r.y*k,r.w*k,r.h*k,0,0,out.width,out.height);
          addSource(from);await addPic(out.toDataURL("image/png"),from);
          if(kind==="image")msg("Pulled a picture from page "+p+".");
        }
      }catch(e){msg("Couldn't pull from page "+p+": "+(e.message||e),true)}
    }

    drawComposer();drawMain();
  }

  /* text whose middle sits inside the box, in reading order; a wide gap between lines starts a new paragraph */
  async function textIn(P,p,r){
    const info=P.pages[p],page=await P.doc.getPage(p),vp=page.getViewport({scale:info.k}),tc=await page.getTextContent();
    const U=window.pdfjsLib.Util,hits=[];
    for(const it of tc.items){
      if(!it.str||!it.str.trim())continue;
      const tx=U.transform(vp.transform,it.transform),h=Math.hypot(tx[2],tx[3])||10,x=tx[4],y=tx[5]-h,w=(it.width||0)*info.k,cy=y+h/2;
      if(cy>=r.y&&cy<=r.y+r.h&&x+w>=r.x&&x<=r.x+r.w)hits.push({x,y,h,s:it.str});
    }
    hits.sort((a,b)=>Math.abs(a.y-b.y)<Math.min(a.h,b.h)*.5?a.x-b.x:a.y-b.y);
    const lines=[];let cur=null;
    for(const t of hits){if(cur&&Math.abs(t.y-cur.y)<t.h*.5)cur.parts.push(t.s);else{if(cur)lines.push(cur);cur={y:t.y,h:t.h,parts:[t.s]}}}
    if(cur)lines.push(cur);
    let out="",prev=null;
    for(const l of lines){
      const s=l.parts.join(" ").replace(/\s+/g," ").trim();if(!s)continue;
      if(prev)out=l.y-prev.y>prev.h*1.9?out+"\n\n":/-$/.test(out)?out.slice(0,-1):out+" ";
      out+=s;prev=l;
    }
    return out.trim();
  }

  /* ================= A5 layout (jsPDF, millimetres) ================= */
  const pdfText=s=>String(s||"").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g,"");
  async function layout(t,E){
    const J=await jspdf(),doc=new J({unit:"mm",format:"a5",orientation:"portrait"});
    const W=148,H=210,ML=14,MT=16,MB=18,CW=W-ML*2,BOT=H-MB,pt=.3528;
    const lodge=((document.getElementById("lodge-title")||{}).textContent||"").trim();
    /* cover */
    doc.setFont("times","bold");doc.setFontSize(24);doc.setTextColor(26,26,26);
    const tl=doc.splitTextToSize(pdfText(t.name||"Booklet"),CW-10);
    let y=H/2-tl.length*24*pt*1.2/2;
    tl.forEach(l=>{doc.text(l,W/2,y,{align:"center"});y+=24*pt*1.2});
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(110);
    if(lodge){y+=4;doc.text(pdfText(lodge).toUpperCase(),W/2,y,{align:"center",charSpace:.4});y+=5}
    doc.text(E.length+(E.length===1?" entry":" entries"),W/2,y+2,{align:"center"});
    if(!E.length){doc.addPage("a5","portrait");doc.setFont("times","italic");doc.setFontSize(11);doc.setTextColor(120);doc.text("No entries yet.",ML,MT+6)}
    /* entries flow page to page */
    y=BOT+1;
    const page=()=>{doc.addPage("a5","portrait");y=MT};
    const room=h=>{if(y+h>BOT)page()};
    E.forEach((e,i)=>{
      if(i&&y<BOT-30){y+=3;doc.setDrawColor(200);doc.setLineWidth(.25);doc.line(ML,y,W-ML,y);y+=7}else page();
      doc.setFont("times","bold");doc.setFontSize(15);doc.setTextColor(26,26,26);
      const lh=15*pt*1.25,hl=doc.splitTextToSize(pdfText(e.title||"Untitled entry"),CW);
      room(hl.length*lh+11);                                       /* keep a heading with its first lines */
      hl.forEach(l=>{doc.text(l,ML,y+lh*.8);y+=lh});y+=2.5;
      doc.setFont("times","normal");doc.setFontSize(10.5);
      const bl=10.5*pt*1.45;
      String(e.body||"").split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).forEach(par=>{
        doc.splitTextToSize(pdfText(par),CW).forEach(l=>{room(bl);doc.text(l,ML,y+bl*.75);y+=bl});y+=2.2});
      (e.images||[]).forEach(im=>{
        let pw=1,ph=1;try{const pr=doc.getImageProperties(im.src);pw=pr.width;ph=pr.height}catch(x){return}
        let w=CW,h=w*ph/pw;const maxH=Math.min(130,BOT-MT);if(h>maxH){h=maxH;w=h*pw/ph}
        if(y+h>BOT){if(y-MT>20||h>BOT-y)page()}
        doc.addImage(im.src,"JPEG",ML+(CW-w)/2,y,w,h,undefined,"FAST");y+=h+4;
      });
      if(e.sources&&e.sources.length){doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(120);
        doc.splitTextToSize(pdfText("Source: "+e.sources.join(" · ")),CW).forEach(l=>{room(3.6);doc.text(l,ML,y+2.8);y+=3.6});y+=1.5;doc.setTextColor(26,26,26)}
    });
    /* folios */
    const n=doc.getNumberOfPages();
    doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(120);
    for(let p=2;p<=n;p++){doc.setPage(p);doc.text(String(p-1),W/2,H-9,{align:"center"})}
    return doc;
  }

  /* ---------- styles ---------- */
  const css=document.createElement("style");
  css.textContent=`
.bk{display:grid;gap:14px}
.bk-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.bk-sp{flex:1}
.bk-seg{display:inline-flex;border:1px solid var(--line)}.bk-seg button{border:0;background:var(--bg);color:var(--muted);font:inherit;font-size:13px;font-weight:600;padding:7px 14px;cursor:pointer}
.bk-seg button+button{border-left:1px solid var(--line)}.bk-seg button[aria-pressed="true"]{background:var(--surface);color:var(--ct);box-shadow:inset 0 -2px 0 var(--ct)}
.bk-msg{margin:0;min-height:1em}.bk-msg:empty{display:none}.bk-err{color:#b3261e}
.bk-empty{display:grid;gap:4px;padding:28px 20px;border:1px dashed var(--line);text-align:center}
.bk-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.bk-entry{display:grid;gap:6px;padding:12px 14px;border:1px solid var(--line);border-left:3px solid var(--ct);background:var(--bg);min-width:0}
.bk-entry.on{background:var(--surface);outline:1px solid var(--ct)}
.bk-et{display:flex;gap:10px;align-items:baseline}.bk-et b{font-family:var(--display);font-size:17px}
.bk-no{font-size:12px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.bk-snip{margin:0;color:var(--muted);line-height:1.5;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.bk-minis{display:flex;gap:4px;flex-wrap:wrap;align-items:center}.bk-minis img{width:44px;height:44px;object-fit:cover;border:1px solid var(--line)}
.bk-comp{display:grid;gap:12px;border:1px dashed var(--line);padding:16px;background:var(--surface)}
.bk-comp h4{margin:0}.bk-comp input[data-d],.bk-comp textarea{width:100%;font:inherit;padding:9px 11px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.bk-comp input[data-d="title"]{font-family:var(--display);font-size:18px}.bk-comp textarea{line-height:1.55;resize:vertical}
.bk-thumbs{display:flex;flex-wrap:wrap;gap:8px}.bk-thumbs:empty{display:none}
.bk-thumbs figure{position:relative;margin:0;width:96px;height:96px;border:1px solid var(--line);background:var(--bg);display:grid;place-items:center}
.bk-thumbs img{width:100%;height:100%;object-fit:cover}
.bk-thumbs button{position:absolute;top:3px;right:3px;width:24px;height:24px;border:0;border-radius:50%;background:rgba(0,0,0,.62);color:#fff;cursor:pointer;padding:0;line-height:24px}
.bk-drop{border:1.5px dashed var(--line);padding:10px;text-align:center;color:var(--muted);font-size:13px;margin-top:8px}.bk-drop.over{border-color:var(--ct);color:var(--ct)}
.bk-src{margin:0}.bk-src:empty{display:none}
.bk-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.bk-acts label.btn{cursor:pointer}
.bk-pdf{display:grid;gap:8px;border-top:1px solid var(--line);padding-top:12px}.bk-pdf p{margin:0}
.bk-pdf-h{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.bk-pdf-scroll{max-height:72vh;overflow:auto;display:flex;flex-direction:column;gap:16px;padding:12px;border:1px solid var(--line);background:var(--bg)}
.bk-pp{margin:0 auto;max-width:100%}.bk-pp-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:6px}
.bk-pp-c{position:relative;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18)}.bk-pp-c canvas{display:block;width:100%;height:100%}
.bk-layer{position:absolute;inset:0;cursor:crosshair;touch-action:none}
.bk-box{position:absolute;border:1.5px solid var(--ct);background:color-mix(in srgb,var(--ct) 18%,transparent);pointer-events:none}
.bk-selbar{position:absolute;z-index:3;display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px;background:var(--bg);border:1px solid var(--line);box-shadow:0 6px 18px rgba(0,0,0,.2)}
.bk-sheets{display:flex;flex-wrap:wrap;gap:20px}
.bk-sheet{margin:0;display:grid;gap:6px;justify-items:center}.bk-sheet canvas{width:260px;height:auto;max-width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2),0 6px 18px rgba(0,0,0,.08)}
.bk-sheet figcaption{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}`;
  document.head.appendChild(css);

  window.LodgeNetBooklet={mount};
})();
