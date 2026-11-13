/* The lodge's own dashboard tabs (lodge.html). Officers add them in Settings → Your own tabs; each one gets a place in the sidebar,
   one of twelve layouts, its own name, icon, color, width and audience, and content edited right on the tab.
   Saved with the rest of the lodge's data as customTabs (dash.js puts it in the snapshot), so every officer sees the same tabs.
   Loaded before dash.js, which asks window.LodgeNetTabs for titles, rendering and the Settings card. */
(function(){
  const A=window.LodgeNetApp;if(!A)return;
  const esc=v=>A.esc(v==null?"":v),CFG=A.CFG,CLOUD=A.CLOUD;
  const canEdit=!CLOUD||!!CLOUD.canEdit;
  const officer=!CLOUD||CLOUD.role==="owner"||CLOUD.role==="officer";
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const $=s=>document.querySelector(s);
  let tabs=Array.isArray(CFG.customTabs)?CFG.customTabs.filter(t=>t&&t.id):[];
  const editing=new Set();
  let saveT=0;const save=()=>{clearTimeout(saveT);saveT=setTimeout(()=>A.save(),400)};

  /* ---------- the twelve layouts ---------- */
  const R=(x,y,w,h,f)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"${f?' class="f"':""}/>`;
  const L=(x,y,w)=>`<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" class="l"/>`;
  const LAYOUTS=[
    {k:"notes",n:"Notes page",d:"A page of writing: notices, a history, instructions.",pic:L(6,8,40)+L(6,15,52)+L(6,22,48)+L(6,29,52)+L(6,36,30)},
    {k:"columns",n:"Two columns",d:"Two blocks of writing side by side.",pic:L(6,8,22)+L(6,15,24)+L(6,22,20)+L(6,29,24)+L(36,8,22)+L(36,15,24)+L(36,22,18)+L(36,29,24)},
    {k:"cards",n:"Cards",d:"Boxes with a title, a few lines and a link.",pic:R(6,7,16,14,1)+R(24,7,16,14,1)+R(42,7,16,14,1)+R(6,25,16,14,1)+R(24,25,16,14,1)+R(42,25,16,14,1)},
    {k:"checklist",n:"Checklist",d:"Tasks to tick off, with who and when.",pic:R(6,8,5,5)+L(14,9,36)+R(6,18,5,5,1)+L(14,19,30)+R(6,28,5,5)+L(14,29,40)+R(6,38,5,5)+L(14,39,26)},
    {k:"table",n:"Table",d:"Rows and columns you name yourself.",pic:R(6,7,52,7,1)+R(6,16,52,6)+R(6,24,52,6)+R(6,32,52,6)+'<path d="M23 7v31M40 7v31" class="s"/>'},
    {k:"links",n:"Links & resources",d:"Useful websites, forms and documents.",pic:'<circle cx="9" cy="10" r="2.5" class="f"/>'+L(14,9,30)+'<circle cx="9" cy="20" r="2.5" class="f"/>'+L(14,19,38)+'<circle cx="9" cy="30" r="2.5" class="f"/>'+L(14,29,26)+'<circle cx="9" cy="40" r="2.5" class="f"/>'+L(14,39,34)},
    {k:"directory",n:"Directory",d:"People with their role, phone and email.",pic:'<circle cx="13" cy="13" r="5" class="f"/>'+L(21,10,18)+L(21,16,12)+'<circle cx="13" cy="32" r="5" class="f"/>'+L(21,29,20)+L(21,35,14)+'<circle cx="43" cy="13" r="5" class="f"/>'+'<circle cx="43" cy="32" r="5" class="f"/>'},
    {k:"schedule",n:"Schedule",d:"Dates in order: degrees, visits, deadlines.",pic:'<path d="M12 6v36" class="s"/>'+'<circle cx="12" cy="10" r="3" class="f"/>'+L(19,9,30)+'<circle cx="12" cy="22" r="3" class="f"/>'+L(19,21,36)+'<circle cx="12" cy="34" r="3" class="f"/>'+L(19,33,24)},
    {k:"faq",n:"Questions & answers",d:"Questions that open to show the answer.",pic:R(6,7,52,8,1)+L(10,20,40)+L(10,26,34)+R(6,32,52,8,1)},
    {k:"embed",n:"Embed",d:"A Google Doc, Sheet, Form or Calendar, or a YouTube video.",pic:R(6,7,52,32)+'<path d="M28 17l9 6-9 6z" class="f"/>'},
    {k:"booklet",n:"A5 booklet",d:"Entries with pictures and PDF clippings, laid out as A5 pages.",pic:R(8,5,21,36)+L(11,10,15)+R(11,16,15,10,1)+L(11,30,13)+R(35,5,21,36)+L(38,10,15)+L(38,16,13)+L(38,22,15)+L(38,28,11)},
    {k:"bluebook",n:"Blue Book",d:"A yearly directory and calendar book, page for page like the printed one, brought up to date each year.",pic:R(10,4,14,38,1)+R(26,4,14,38)+L(29,9,8)+L(29,15,9)+L(29,21,8)+L(29,27,9)+R(42,4,14,38)+'<path d="M45 10h8M45 17h8M45 24h8M45 31h8M49 8v28" class="s"/>'}
  ];
  const LAY=Object.fromEntries(LAYOUTS.map(l=>[l.k,l]));
  const thumb=k=>`<svg class="ct-pic" viewBox="0 0 64 46" aria-hidden="true">${LAY[k].pic}</svg>`;

  /* what each item in a list layout holds */
  const FIELDS={
    cards:[["a","Title"],["b","Text","area"],["c","Link (optional)","url"]],
    checklist:[["a","Task"],["b","Who / when"]],
    links:[["a","Title"],["b","Web address","url"],["c","Description"]],
    directory:[["a","Name"],["b","Role"],["c","Phone","tel"],["d","Email","email"]],
    schedule:[["a","Date","date"],["b","What"],["c","Details"]],
    faq:[["a","Question"],["b","Answer","area"]]};
  const iso=(n=0)=>{const d=new Date(Date.now()+n*864e5);return d.toISOString().slice(0,10)};
  const STARTER={
    notes:()=>({text:"Write anything here.\n\nLeave a blank line between paragraphs, start a line with - for a list, and wrap words in **two stars** to make them bold. Web addresses become links."}),
    columns:()=>({text:"**Left column**\nWrite here.",text2:"**Right column**\nAnd here."}),
    cards:()=>({items:[{a:"First card",b:"A few lines about it.",c:""},{a:"Second card",b:"Another short note.",c:""},{a:"Third card",b:"Add as many as you like.",c:""}]}),
    checklist:()=>({items:[{a:"First thing to do",b:"Secretary · this month"},{a:"Second thing to do",b:"Worshipful Master"},{a:"Something already done",b:"",done:true}]}),
    table:()=>({cols:["Item","Who","Notes"],rows:[["","",""],["","",""]]}),
    links:()=>({items:[{a:"Grand Lodge website",b:"https://",c:"Forms, the calendar and news"}]}),
    directory:()=>({items:[{a:"Name",b:"Role",c:"",d:""}]}),
    schedule:()=>({items:[{a:iso(14),b:"Something coming up",c:""},{a:iso(45),b:"And after that",c:""}]}),
    faq:()=>({items:[{a:"A question brethren ask?",b:"The answer."}]}),
    embed:()=>({url:"",height:"640"}),
    booklet:()=>({entries:[]}),
    bluebook:()=>({pages:[],repeat:[],dates:[]})};

  /* ---------- icons and colors ---------- */
  const ICONS={
    star:'<path d="M10 2.8l2.2 4.5 4.9.7-3.6 3.5.9 4.9-4.4-2.3-4.4 2.3.9-4.9L2.9 8l4.9-.7z"/>',
    doc:'<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3M7.5 9h5M7.5 12h5M7.5 15h3"/>',
    book:'<path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5v11c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5z"/><path d="M10 5v11"/>',
    check:'<rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M6.5 10.2l2.4 2.4 4.7-5"/>',
    calendar:'<rect x="2.5" y="4" width="15" height="13" rx="1.5"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/>',
    people:'<circle cx="7.5" cy="7" r="3"/><path d="M2 17c.6-3 2.8-4.5 5.5-4.5S12.4 14 13 17"/><circle cx="14" cy="6.5" r="2.3"/><path d="M14.5 11.5c1.9.3 3.1 1.7 3.5 4"/>',
    link:'<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>',
    flag:'<path d="M4 17.5V3M4 3.5h10l-2 3.5 2 3.5H4"/>',
    bell:'<path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z"/><path d="M8.5 17a1.5 1.5 0 0 0 3 0"/>',
    square:'<path d="M3 16.5L10 3l7 13.5"/><path d="M5.5 11.5h9"/><path d="M6 16.5l4-4 4 4"/>',
    tools:'<path d="M12.5 3a4 4 0 0 0-3.8 5.2L3 14l3 3 5.8-5.7A4 4 0 0 0 17 7.5l-2.5 2.5-2.5-2.5L14.5 5z"/>',
    image:'<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><circle cx="7" cy="8" r="1.5"/><path d="M2.5 14l4.5-4 4 3.5 2.5-2 4 3"/>'};
  const COLORS=["#2f4a6d","#b08d2e","#8a2b2b","#5a3d7a","#2f6b4f","#1e2b3e","#c26a1b","#3f7c8a"];

  /* ---------- formatting for text the lodge writes ---------- */
  const safeUrl=u=>/^https?:\/\/[^\s"<>]+$/i.test(String(u||"").trim())?String(u).trim():"";
  function inline(s){
    return esc(s).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>")
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function prose(t){
    return String(t||"").split(/\n{2,}/).map(p=>{
      const lines=p.split("\n");
      if(lines.every(l=>/^\s*[-•]\s+/.test(l)))return "<ul>"+lines.map(l=>"<li>"+inline(l.replace(/^\s*[-•]\s+/,""))+"</li>").join("")+"</ul>";
      return "<p>"+lines.map(inline).join("<br>")+"</p>";
    }).join("");
  }
  /* Google and YouTube share links become their embeddable form */
  function embedUrl(u){
    u=safeUrl(u);if(!u)return "";
    let m=u.match(/youtube\.com\/watch\?v=([\w-]{6,})/)||u.match(/youtu\.be\/([\w-]{6,})/);
    if(m)return "https://www.youtube.com/embed/"+m[1];
    if(/docs\.google\.com\/(document|spreadsheets|presentation)\//.test(u))return u.replace(/\/(edit|view)(\?.*)?(#.*)?$/,"/preview");
    if(/docs\.google\.com\/forms\//.test(u)&&!/embedded=true/.test(u))return u.replace(/\/viewform.*$/,"/viewform")+"?embedded=true";
    if(/drive\.google\.com\/file\/d\//.test(u))return u.replace(/\/view(\?.*)?$/,"/preview");
    return u;
  }
  const dayFmt=s=>{const d=new Date(s+"T12:00");return isNaN(d)?esc(s):d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})};

  /* ---------- sidebar and sections ---------- */
  const visible=t=>t.who!=="officers"||officer;
  const navIcon=t=>`<svg viewBox="0 0 20 20" aria-hidden="true">${ICONS[t.icon]||ICONS.star}</svg>`;
  function drawNav(){
    document.querySelectorAll(".nav-i[data-ct]").forEach(a=>a.remove());
    const set=document.querySelector('.nav-i[data-sec="settings"]');if(!set)return;
    for(const t of tabs.filter(visible)){
      const a=document.createElement("a");a.className="nav-i";a.href="#"+t.id;a.dataset.sec=t.id;a.dataset.ct="1";
      a.innerHTML=navIcon(t)+`<span>${esc(t.name||"New tab")}</span>`;
      if(location.hash.slice(1)===t.id)a.setAttribute("aria-current","");
      set.before(a);
    }
    const setSec=document.querySelector('.sec[data-sec="settings"]');
    for(const t of tabs)if(!document.querySelector(`.sec[data-sec="${t.id}"]`)&&setSec){
      const s=document.createElement("section");s.className="sec";s.dataset.sec=t.id;s.hidden=true;
      s.innerHTML=`<div class="panel ct" id="ct-${t.id}"></div>`;setSec.before(s);
    }
    document.querySelectorAll('.sec[data-sec^="tab-"]').forEach(s=>{if(!tabs.some(t=>t.id===s.dataset.sec))s.remove()});
  }
  const byId=id=>tabs.find(t=>t.id===id);

  /* ---------- a tab, as brethren see it ---------- */
  function viewBody(t){
    const it=(C(t).items||[]).filter(x=>x&&Object.keys(x).some(k=>k!=="done"&&String(x[k]||"").trim()));
    const none='<p class="hint">Nothing here yet.'+(canEdit?" Choose Edit this tab to add some.":"")+"</p>";
    switch(t.layout){
      case "notes":return `<div class="ct-prose">${prose(C(t).text)||none}</div>`;
      case "columns":return `<div class="ct-cols"><div class="ct-prose">${prose(C(t).text)}</div><div class="ct-prose">${prose(C(t).text2)}</div></div>`;
      case "cards":return it.length?`<div class="ct-cards">${it.map(c=>`<div class="card"><h4>${esc(c.a)}</h4>${c.b?`<div class="ct-prose">${prose(c.b)}</div>`:""}${safeUrl(c.c)?`<a class="btn line sm" href="${esc(safeUrl(c.c))}" target="_blank" rel="noopener">Open</a>`:""}</div>`).join("")}</div>`:none;
      case "checklist":{
        const done=it.filter(x=>x.done).length;
        return it.length?`<p class="hint">${done} of ${it.length} done</p><ul class="ct-check">${it.map((x,i)=>`<li${x.done?' class="done"':""}><label><input type="checkbox" data-tick="${i}"${x.done?" checked":""}${canEdit?"":" disabled"}> <span>${esc(x.a)}</span></label>${x.b?`<small>${esc(x.b)}</small>`:""}</li>`).join("")}</ul>`:none;}
      case "table":{
        const cols=C(t).cols||[],rows=(C(t).rows||[]).filter(r=>r.some(c=>String(c||"").trim()));
        return `<div class="table-scroll"><table class="dtable"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${cols.map((c,j)=>`<td>${inline(r[j]||"")}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${cols.length||1}" class="hint">No rows yet.</td></tr>`}</tbody></table></div>`;}
      case "links":return it.length?`<ul class="ct-links">${it.map(x=>{const u=safeUrl(x.b);return `<li>${u?`<a href="${esc(u)}" target="_blank" rel="noopener"><b>${esc(x.a||u)}</b></a>`:`<b>${esc(x.a)}</b>`}${x.c?`<span class="hint">${esc(x.c)}</span>`:""}</li>`}).join("")}</ul>`:none;
      case "directory":return it.length?`<div class="ct-dir">${it.map(x=>`<div class="card"><b>${esc(x.a)}</b>${x.b?`<span class="hint">${esc(x.b)}</span>`:""}${x.c?`<a href="tel:${esc(x.c.replace(/[^\d+]/g,""))}">${esc(x.c)}</a>`:""}${x.d?`<a href="mailto:${esc(x.d)}">${esc(x.d)}</a>`:""}</div>`).join("")}</div>`:none;
      case "schedule":{
        const s=it.slice().sort((a,b)=>String(a.a).localeCompare(String(b.a))),today=iso();
        return s.length?`<ol class="ct-sched">${s.map(x=>`<li${x.a&&x.a<today?' class="past"':""}><span class="ct-date">${x.a?dayFmt(x.a):"Date to come"}</span><b>${esc(x.b)}</b>${x.c?`<span class="hint">${esc(x.c)}</span>`:""}</li>`).join("")}</ol>`:none;}
      case "faq":return it.length?`<div class="ct-faq">${it.map(x=>`<details><summary>${esc(x.a)}</summary><div class="ct-prose">${prose(x.b)}</div></details>`).join("")}</div>`:none;
      case "booklet":return '<div data-bk></div>';
      case "bluebook":return '<div data-bb></div>';
      case "embed":{
        const u=embedUrl(C(t).url);
        return u?`<iframe class="ct-embed" src="${esc(u)}" style="height:${+C(t).height||640}px" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><p class="hint"><a href="${esc(safeUrl(C(t).url))}" target="_blank" rel="noopener">Open it in a new window</a></p>`
          :'<p class="hint">No address yet.'+(canEdit?" Choose Edit this tab and paste a Google Doc, Sheet, Form, Calendar or YouTube link.":"")+"</p>";}
    }
    return none;
  }

  /* ---------- the same tab, being edited ---------- */
  const inp=(f,v,type,ph)=>type==="area"
    ?`<textarea data-f="${f}" rows="3"${ph?` placeholder="${esc(ph)}"`:""}>${esc(v||"")}</textarea>`
    :`<input data-f="${f}" type="${type&&type!=="url"?type:"text"}"${type==="url"?' inputmode="url" autocapitalize="off" spellcheck="false"':""} value="${esc(v||"")}"${ph?` placeholder="${esc(ph)}"`:""}>`;
  const rowBtns=(i,n)=>`<span class="ct-rowbtns"><button type="button" class="btn line sm" data-up="${i}"${i?"":" disabled"} aria-label="Move up">↑</button><button type="button" class="btn line sm" data-down="${i}"${i<n-1?"":" disabled"} aria-label="Move down">↓</button><button type="button" class="btn line sm" data-del="${i}" aria-label="Remove">✕</button></span>`;
  function editBody(t){
    const L=t.layout;
    if(L==="notes")return `<div class="field"><label>Page text</label><textarea data-k="text" rows="14">${esc(C(t).text||"")}</textarea></div>${FMT}`;
    if(L==="columns")return `<div class="ct-cols"><div class="field"><label>Left column</label><textarea data-k="text" rows="12">${esc(C(t).text||"")}</textarea></div><div class="field"><label>Right column</label><textarea data-k="text2" rows="12">${esc(C(t).text2||"")}</textarea></div></div>${FMT}`;
    if(L==="booklet")return '<p class="hint">Add, change and reorder entries right here, or after you choose Done editing.</p><div data-bk></div>';
    if(L==="bluebook")return '<p class="hint">Bring the pages up to date right here, or after you choose Done editing.</p><div data-bb></div>';
    if(L==="embed")return `<div class="field"><label>Address to show</label><input data-k="url" inputmode="url" autocapitalize="off" spellcheck="false" value="${esc(C(t).url||"")}" placeholder="https://docs.google.com/… or https://youtu.be/…"></div>
      <p class="hint">In Google Docs, Sheets or Slides, use Share → anyone with the link can view, then paste the link. In Google Calendar, use Settings → Integrate calendar → Public URL.</p>
      <div class="field"><label>Height</label><select data-k="height">${[["420","Short"],["640","Medium"],["900","Tall"],["1200","Very tall"]].map(([v,n])=>`<option value="${v}"${String(C(t).height||"640")===v?" selected":""}>${n}</option>`).join("")}</select></div>`;
    if(L==="table"){
      const cols=C(t).cols||[],rows=C(t).rows||[];
      return `<div class="table-scroll"><table class="dtable ct-tedit"><thead><tr>${cols.map((c,j)=>`<th><input data-col="${j}" value="${esc(c)}" aria-label="Column ${j+1} name"><button type="button" class="link-btn" data-delcol="${j}"${cols.length>1?"":" hidden"}>Remove column</button></th>`).join("")}<th></th></tr></thead>
        <tbody>${rows.map((r,i)=>`<tr>${cols.map((c,j)=>`<td><input data-cell="${i}:${j}" value="${esc(r[j]||"")}" aria-label="${esc(c)}, row ${i+1}"></td>`).join("")}<td>${rowBtns(i,rows.length)}</td></tr>`).join("")}</tbody></table></div>
        <span class="ct-adds"><button type="button" class="btn line sm" data-addrow>Add a row</button><button type="button" class="btn line sm" data-addcol>Add a column</button></span>`;
    }
    const F=FIELDS[L]||[],it=C(t).items||[];
    return `<div class="ct-items">${it.map((x,i)=>`<div class="ct-item" data-i="${i}">${F.map(([f,n,type])=>`<div class="field"><label>${n}</label>${inp(f,x[f],type)}</div>`).join("")}
      ${L==="checklist"?`<label class="check"><input type="checkbox" data-done${x.done?" checked":""}> Done</label>`:""}${rowBtns(i,it.length)}</div>`).join("")||'<p class="hint">Nothing yet.</p>'}</div>
      <button type="button" class="btn line sm" data-additem>Add ${{cards:"a card",checklist:"a task",links:"a link",directory:"a person",schedule:"a date",faq:"a question"}[L]||"one"}</button>`;
  }
  const FMT='<p class="hint">Blank line = new paragraph · start a line with - for a list · **two stars** for bold · web addresses become links.</p>';

  function render(id){
    const t=byId(id),box=document.getElementById("ct-"+id);if(!t||!box)return;
    const ed=canEdit&&editing.has(id);
    box.style.setProperty("--ct",t.color||COLORS[0]);
    box.className="panel ct"+(t.width==="wide"?" wide":"");
    const head=`<div class="ct-head"><div><h2>${esc(t.name||"New tab")}</h2>${!ed&&t.intro?`<p class="ct-intro">${inline(t.intro)}</p>`:""}</div>
      ${canEdit?`<button type="button" class="btn sm" data-edit>${ed?"Done editing":"Edit this tab"}</button>`:""}</div>`;
    if(!ed){box.innerHTML=head+viewBody(t);wireView(box,t);return}
    box.innerHTML=head+`<div class="ct-editor">
      <div class="ct-opts">
        <div class="field"><label>Tab name</label><input data-k="name" maxlength="40" value="${esc(t.name||"")}"></div>
        <div class="field"><label>Introduction (optional)</label><input data-k="intro" maxlength="300" value="${esc(t.intro||"")}" placeholder="One line under the title"></div>
        <div class="field"><label>Who can see it</label><select data-k="who"><option value="all"${t.who!=="officers"?" selected":""}>Everyone on the lodge roll</option><option value="officers"${t.who==="officers"?" selected":""}>Officers only</option></select></div>
        <div class="field"><label>Width</label><select data-k="width"><option value="normal"${t.width!=="wide"?" selected":""}>Standard</option><option value="wide"${t.width==="wide"?" selected":""}>Full width</option></select></div>
      </div>
      <div class="field"><label>Icon</label><div class="ct-icons">${Object.keys(ICONS).map(k=>`<button type="button" class="ct-ico" data-icon="${k}" aria-label="${k}" aria-pressed="${(t.icon||"star")===k}"><svg viewBox="0 0 20 20" aria-hidden="true">${ICONS[k]}</svg></button>`).join("")}</div></div>
      <div class="field"><label>Color</label><div class="ct-colors">${COLORS.map(c=>`<button type="button" class="ct-sw" data-color="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${(t.color||COLORS[0])===c}"></button>`).join("")}<input type="color" data-k="color" value="${esc(t.color||COLORS[0])}" aria-label="Any color"></div></div>
      <div class="field"><label>Layout</label>${layoutPicker(t.layout,"data-layout")}<p class="hint">Switching layout keeps what you've entered where it fits.</p></div>
      <h4 style="margin:8px 0 0">Content</h4>
      ${editBody(t)}
      <div class="ct-foot"><button type="button" class="btn sm" data-edit>Done editing</button><button type="button" class="link-btn" data-remove>Delete this tab</button></div>
    </div>`;
    wireEdit(box,t);
  }
  function layoutPicker(cur,attr){
    return `<div class="ct-layouts">${LAYOUTS.map(l=>`<button type="button" class="ct-lay" ${attr}="${l.k}" aria-pressed="${cur===l.k}">${thumb(l.k)}<b>${l.n}</b><small>${l.d}</small></button>`).join("")}</div>`;
  }

  const mountBooklet=(box,t)=>{const el=box.querySelector("[data-bk]");
    if(el&&window.LodgeNetBooklet)window.LodgeNetBooklet.mount(el,t,C(t),{canEdit,save});
    else if(el)el.innerHTML='<p class="hint">The booklet didn\'t load. Refresh the page to try again.</p>';
    const bb=box.querySelector("[data-bb]");
    if(bb&&window.LodgeNetBlueBook)window.LodgeNetBlueBook.mount(bb,t,C(t),{canEdit,save});
    else if(bb)bb.innerHTML='<p class="hint">The Blue Book didn\'t load. Refresh the page to try again.</p>'};
  function wireView(box,t){
    const e=box.querySelector("[data-edit]");if(e)e.addEventListener("click",()=>{editing.add(t.id);render(t.id)});
    mountBooklet(box,t);
    const shown=(C(t).items||[]).filter(x=>x&&Object.keys(x).some(k=>k!=="done"&&String(x[k]||"").trim()));
    box.querySelectorAll("[data-tick]").forEach(c=>c.addEventListener("change",()=>{shown[+c.dataset.tick].done=c.checked;save();render(t.id)}));
  }
  function wireEdit(box,t){
    const re=()=>render(t.id),changed=()=>{save()};
    box.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{editing.delete(t.id);A.save();re()}));
    box.querySelector("[data-remove]").addEventListener("click",()=>remove(t.id));
    box.querySelectorAll("[data-k]").forEach(el=>el.addEventListener("input",()=>{
      const k=el.dataset.k;(["text","text2","url","height"].includes(k)?C(t):t)[k]=el.value;
      if(k==="name"){const n=document.querySelector(`.nav-i[data-sec="${t.id}"] span`);if(n)n.textContent=t.name||"New tab";box.querySelector(".ct-head h2").textContent=t.name||"New tab";const st=document.getElementById("sec-title");if(st)st.textContent=t.name||"New tab"}
      if(k==="color"){box.style.setProperty("--ct",t.color);box.querySelectorAll("[data-color]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.color===t.color)))}
      if(k==="who"){drawNav();settingsCard()}
      if(k==="width")box.classList.toggle("wide",t.width==="wide");
      changed();
    }));
    box.querySelectorAll("select[data-k]").forEach(el=>el.addEventListener("change",()=>el.dispatchEvent(new Event("input"))));
    box.querySelectorAll("[data-icon]").forEach(b=>b.addEventListener("click",()=>{t.icon=b.dataset.icon;changed();drawNav();markCurrent();re()}));
    box.querySelectorAll("[data-color]").forEach(b=>b.addEventListener("click",()=>{t.color=b.dataset.color;changed();re()}));
    box.querySelectorAll("[data-layout]").forEach(b=>b.addEventListener("click",()=>{setLayout(t,b.dataset.layout);changed();re()}));
    if(t.layout==="booklet"||t.layout==="bluebook"){mountBooklet(box,t);return}
    /* list layouts */
    const it=C(t).items||(C(t).items=[]);
    box.querySelectorAll(".ct-item").forEach(row=>{
      const x=it[+row.dataset.i];
      row.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("input",()=>{x[el.dataset.f]=el.value;changed()}));
      const d=row.querySelector("[data-done]");if(d)d.addEventListener("change",()=>{x.done=d.checked;changed()});
    });
    const list=t.layout==="table"?(C(t).rows||(C(t).rows=[])):it;
    const move=(i,j)=>{if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];changed();re()};
    box.querySelectorAll("[data-up]").forEach(b=>b.addEventListener("click",()=>move(+b.dataset.up,+b.dataset.up-1)));
    box.querySelectorAll("[data-down]").forEach(b=>b.addEventListener("click",()=>move(+b.dataset.down,+b.dataset.down+1)));
    box.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{list.splice(+b.dataset.del,1);changed();re()}));
    const add=box.querySelector("[data-additem]");if(add)add.addEventListener("click",()=>{it.push(t.layout==="schedule"?{a:iso(7)}:{});changed();re();
      const last=box.querySelector(".ct-item:last-child input,.ct-item:last-child textarea");if(last)last.focus()});
    /* table */
    box.querySelectorAll("[data-col]").forEach(el=>el.addEventListener("input",()=>{C(t).cols[+el.dataset.col]=el.value;changed()}));
    box.querySelectorAll("[data-cell]").forEach(el=>el.addEventListener("input",()=>{const [i,j]=el.dataset.cell.split(":").map(Number);(C(t).rows[i]||(C(t).rows[i]=[]))[j]=el.value;changed()}));
    const ar=box.querySelector("[data-addrow]");if(ar)ar.addEventListener("click",()=>{C(t).rows.push(C(t).cols.map(()=>""));changed();re()});
    const ac=box.querySelector("[data-addcol]");if(ac)ac.addEventListener("click",()=>{if(C(t).cols.length>=8)return;C(t).cols.push("New column");C(t).rows.forEach(r=>r.push(""));changed();re()});
    box.querySelectorAll("[data-delcol]").forEach(b=>b.addEventListener("click",()=>{const j=+b.dataset.delcol;if(!confirm(`Remove the column "${C(t).cols[j]}" and what's in it?`))return;C(t).cols.splice(j,1);C(t).rows.forEach(r=>r.splice(j,1));changed();re()}));
  }

  /* each layout keeps its own content (t.c[layout]), so switching back finds it as it was. The first visit to a layout
     brings the main words across from the one just left: titles stay titles, dates stay with dates */
  const MAIN={cards:"a",checklist:"a",links:"a",directory:"a",schedule:"b",faq:"a"};
  const NEXT={cards:"b",checklist:"b",links:"c",directory:"b",schedule:"c",faq:"b"};
  function C(t){
    t.c=t.c||{};
    if(!t.c[t.layout]){
      /* tabs saved before layouts kept their own content */
      if(t.items||t.text||t.cols||t.url){t.c[t.layout]={items:t.items,text:t.text,text2:t.text2,cols:t.cols,rows:t.rows,url:t.url,height:t.height};["items","text","text2","cols","rows","url","height"].forEach(k=>delete t[k])}
      else t.c[t.layout]=convert(t.c[t.prev],t.prev,t.layout)||STARTER[t.layout]();
    }
    return t.c[t.layout];
  }
  function convert(src,from,to){
    if(!src)return null;
    if(to==="bluebook"&&from==="booklet"){const E=(src.entries||[]).filter(e=>e&&(e.title||e.body));
      return E.length?{pages:E.map(e=>({id:"pg-"+uid(),k:"text",title:e.title||"",body:e.body||""})),repeat:[],dates:[]}:null}
    if(to==="booklet"){const body=from==="notes"?src.text:from==="columns"?[src.text,src.text2].filter(Boolean).join("\n\n"):"";
      return body&&body.trim()?{entries:[{id:"e-"+uid(),title:"",body:body.replace(/\*\*/g,""),images:[],sources:[]}]}:null}
    const list=FIELDS[from]&&(src.items||[]).filter(x=>x&&(x[MAIN[from]]||x[NEXT[from]]));
    const rows=from==="table"&&(src.rows||[]).filter(r=>r.some(c=>String(c||"").trim()));
    const text=from==="notes"?src.text:from==="columns"?[src.text,src.text2].filter(Boolean).join("\n\n"):"";
    if(FIELDS[to]){
      const items=list&&list.length?list.map(x=>({[MAIN[to]]:x[MAIN[from]]||"",[NEXT[to]]:x[NEXT[from]]||"",...(to==="schedule"&&from==="schedule"?{a:x.a}:{})}))
        :rows&&rows.length?rows.map(r=>({[MAIN[to]]:r[0]||"",[NEXT[to]]:r[1]||""}))
        :text?text.split(/\n+/).map(l=>l.replace(/^\s*[-•]\s+/,"").replace(/\*\*/g,"").trim()).filter(Boolean).slice(0,30).map(l=>({[MAIN[to]]:l})):null;
      if(!items)return null;
      if(to==="schedule")items.forEach((x,i)=>{if(!x.a)x.a=""});
      return {items};
    }
    if(to==="table"){
      if(list&&list.length){const F=FIELDS[from];return {cols:F.map(f=>f[1]),rows:list.map(x=>F.map(f=>x[f[0]]||""))}}
      return null;
    }
    if(to==="notes"||to==="columns"){
      const t2=text||(list&&list.length?list.map(x=>"- "+[x[MAIN[from]],x[NEXT[from]]].filter(Boolean).join(": ")).join("\n"):"");
      if(!t2)return null;
      return to==="columns"&&from==="columns"?{text:src.text,text2:src.text2}:to==="columns"?{text:t2,text2:""}:{text:t2};
    }
    return null;
  }
  function setLayout(t,k){
    if(t.layout===k)return;
    C(t);t.prev=t.layout;t.layout=k;C(t);
  }

  /* ---------- adding, ordering and removing ---------- */
  function add(name,layout){
    const t={id:"tab-"+uid(),name:name||LAY[layout].n,icon:{notes:"doc",columns:"book",cards:"star",checklist:"check",table:"doc",links:"link",directory:"people",schedule:"calendar",faq:"bell",embed:"image",booklet:"book",bluebook:"book"}[layout]||"star",
      layout,color:COLORS[tabs.length%COLORS.length],who:"all",width:"normal",intro:"",c:{[layout]:STARTER[layout]()}};
    tabs.push(t);A.save();drawNav();editing.add(t.id);settingsCard();
    location.hash=t.id;
  }
  function remove(id){
    const t=byId(id);if(!t)return;
    if(!confirm(`Delete the tab "${t.name}" and everything on it? This can't be undone.`))return;
    tabs=tabs.filter(x=>x.id!==id);editing.delete(id);A.save();drawNav();settingsCard();
    if(location.hash.slice(1)===id)location.hash="settings";
  }
  function move(id,d){
    const i=tabs.findIndex(t=>t.id===id),j=i+d;if(i<0||j<0||j>=tabs.length)return;
    [tabs[i],tabs[j]]=[tabs[j],tabs[i]];A.save();drawNav();markCurrent();settingsCard();
  }
  const markCurrent=()=>{const h=location.hash.slice(1);document.querySelectorAll(".nav-i").forEach(a=>a.toggleAttribute("aria-current",a.dataset.sec===h))};

  /* ---------- Settings → Your own tabs ---------- */
  function settingsCard(){
    const grid=document.querySelector('.sec[data-sec="settings"] .set-grid');if(!grid)return;
    let card=document.getElementById("ct-settings");
    if(!card){card=document.createElement("div");card.className="card ct-set";card.id="ct-settings";grid.prepend(card)}
    const list=tabs.map((t,i)=>`<li><span class="ct-ico" style="color:${esc(t.color||COLORS[0])}"><svg viewBox="0 0 20 20" aria-hidden="true">${ICONS[t.icon]||ICONS.star}</svg></span>
        <span class="ct-set-n"><b>${esc(t.name)}</b><small>${esc(LAY[t.layout]?LAY[t.layout].n:"")} · ${t.who==="officers"?"Officers only":"Everyone on the roll"}</small></span>
        <span class="ct-rowbtns"><a class="btn line sm" href="#${esc(t.id)}">Open</a>${canEdit?`<button type="button" class="btn line sm" data-ct-edit="${esc(t.id)}">Edit</button><button type="button" class="btn line sm" data-ct-up="${esc(t.id)}"${i?"":" disabled"} aria-label="Move up">↑</button><button type="button" class="btn line sm" data-ct-down="${esc(t.id)}"${i<tabs.length-1?"":" disabled"} aria-label="Move down">↓</button><button type="button" class="btn line sm" data-ct-del="${esc(t.id)}" aria-label="Delete">✕</button>`:""}</span></li>`).join("");
    card.innerHTML=`<h4>Your own tabs</h4>
      <p class="hint">Add tabs of your own to the sidebar: a degree schedule, an officers' checklist, a building fund page, the Grand Lodge forms, anything. Pick one of twelve layouts and change it whenever you like.</p>
      ${tabs.length?`<ul class="ct-set-list">${list}</ul>`:'<p class="hint"><b>No tabs of your own yet.</b></p>'}
      ${canEdit?`<details class="ct-new"${tabs.length?"":" open"}><summary class="btn sm">Add a tab</summary>
        <div class="field"><label for="ct-new-name">Tab name</label><input id="ct-new-name" maxlength="40" placeholder="e.g. Degree Schedule"></div>
        <div class="field"><label>Layout</label>${layoutPicker("notes","data-new-layout")}</div>
        <button type="button" class="btn sm" id="ct-new-go">Add this tab</button></details>`:'<p class="hint">Only officers can add or change tabs.</p>'}`;
    let pick="notes";
    card.querySelectorAll("[data-new-layout]").forEach(b=>b.addEventListener("click",()=>{pick=b.dataset.newLayout;card.querySelectorAll("[data-new-layout]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
      const n=card.querySelector("#ct-new-name");if(!n.value.trim())n.placeholder=LAY[pick].n}));
    const go=card.querySelector("#ct-new-go");if(go)go.addEventListener("click",()=>{if(tabs.length>=20)return alert("That's the most tabs one lodge can have (20).");add(card.querySelector("#ct-new-name").value.trim(),pick)});
    card.querySelectorAll("[data-ct-edit]").forEach(b=>b.addEventListener("click",()=>{editing.add(b.dataset.ctEdit);location.hash=b.dataset.ctEdit;render(b.dataset.ctEdit)}));
    card.querySelectorAll("[data-ct-up]").forEach(b=>b.addEventListener("click",()=>move(b.dataset.ctUp,-1)));
    card.querySelectorAll("[data-ct-down]").forEach(b=>b.addEventListener("click",()=>move(b.dataset.ctDown,1)));
    card.querySelectorAll("[data-ct-del]").forEach(b=>b.addEventListener("click",()=>remove(b.dataset.ctDel)));
  }

  /* ---------- styles (kept here so this file stands on its own) ---------- */
  const css=document.createElement("style");
  css.textContent=`
.ct{--ct:#2f4a6d;max-width:980px}.ct.wide{max-width:none}
.ct-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-left:4px solid var(--ct);padding-left:14px;margin-bottom:20px}
.ct-head h2{margin:0;font-family:var(--display);font-size:24px}.ct-intro{margin:6px 0 0;color:var(--muted)}
.ct-prose p{margin:0 0 12px;line-height:1.6}.ct-prose ul{margin:0 0 12px;padding-left:20px;line-height:1.6}.ct-prose a{color:var(--ct)}
.ct-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px}
.ct-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.ct-cards .card{border-top:3px solid var(--ct)}.ct-cards h4{margin:0}.ct-cards .btn{justify-self:start}
.ct-check{list-style:none;margin:0;padding:0;display:grid;gap:2px}.ct-check li{display:grid;gap:2px;padding:10px 12px;border:1px solid var(--line);background:var(--surface)}
.ct-check label{display:flex;gap:10px;align-items:center;font-weight:500}.ct-check input{width:18px;height:18px;accent-color:var(--ct)}.ct-check small{color:var(--muted);padding-left:28px}
.ct-check li.done span{text-decoration:line-through;color:var(--muted)}
.ct-links{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ct-links li{display:grid;gap:2px;padding:12px 14px;border:1px solid var(--line);border-left:3px solid var(--ct)}.ct-links a{color:var(--ct)}
.ct-dir{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.ct-dir .card{gap:4px;border-top:3px solid var(--ct)}.ct-dir a{color:var(--ct)}
.ct-sched{list-style:none;margin:0;padding:0 0 0 18px;border-left:2px solid var(--ct);display:grid;gap:18px}.ct-sched li{position:relative;display:grid;gap:2px}
.ct-sched li::before{content:"";position:absolute;left:-25px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--ct)}.ct-sched li.past{opacity:.55}
.ct-date{font-size:13px;font-weight:600;color:var(--ct);text-transform:uppercase;letter-spacing:.04em}
.ct-faq{display:grid;gap:8px}.ct-faq details{border:1px solid var(--line);padding:12px 14px;background:var(--surface)}.ct-faq summary{cursor:pointer;font-weight:600}.ct-faq details[open] summary{margin-bottom:10px;color:var(--ct)}
.ct-embed{width:100%;border:1px solid var(--line);background:#fff}
.ct-editor{display:grid;gap:16px;border:1px dashed var(--line);padding:18px;background:var(--surface)}
.ct-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.ct-editor textarea{width:100%;font:inherit;padding:9px 11px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.ct-icons,.ct-colors{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ct-ico{width:38px;height:38px;display:inline-grid;place-items:center;border:1px solid var(--line);background:var(--bg);color:var(--fg);cursor:pointer;padding:0}
.ct-ico svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.ct-ico[aria-pressed="true"]{border:2px solid var(--ct);color:var(--ct)}
.ct-sw{width:30px;height:30px;border:2px solid transparent;cursor:pointer;padding:0}.ct-sw[aria-pressed="true"]{outline:2px solid var(--fg);outline-offset:2px}
.ct-colors input[type=color]{width:38px;height:32px;border:1px solid var(--line);padding:2px;background:var(--bg)}
.ct-layouts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ct-lay{display:grid;gap:4px;text-align:left;padding:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);cursor:pointer;font:inherit}
.ct-lay b{font-size:13px}.ct-lay small{font-size:12px;color:var(--muted);line-height:1.35}
.ct-lay[aria-pressed="true"]{border:2px solid var(--ct,#2f4a6d);padding:9px;background:var(--surface)}
.ct-pic{width:100%;height:auto;background:var(--surface);border:1px solid var(--line)}
.ct-pic rect,.ct-pic circle{fill:none;stroke:var(--muted);stroke-width:1}.ct-pic .f{fill:var(--ct,#2f4a6d);fill-opacity:.25;stroke:var(--ct,#2f4a6d)}.ct-pic .l{fill:var(--muted);stroke:none;opacity:.55}.ct-pic .s{stroke:var(--muted);fill:none}
.ct-items{display:grid;gap:10px}.ct-item{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end;padding:12px;border:1px solid var(--line);background:var(--bg)}
.ct-item textarea{min-height:60px}
.ct-rowbtns{display:inline-flex;gap:4px;flex-wrap:wrap}.ct-rowbtns .btn{min-width:34px;justify-content:center;padding-left:8px;padding-right:8px}
.ct-tedit input{width:100%;min-width:110px;padding:6px 8px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}.ct-tedit th{vertical-align:bottom}.ct-tedit th .link-btn{font-size:12px;font-weight:400}
.ct-adds{display:flex;gap:8px;flex-wrap:wrap}
.ct-foot{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.ct-set{grid-column:1 / -1}.ct-set-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ct-set-list li{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--line)}
.ct-set-n{display:grid;flex:1;min-width:160px}.ct-set-n small{color:var(--muted)}
.ct-set-list .ct-ico{border:0;background:none;cursor:default;width:28px;height:28px}
.ct-new{display:grid;gap:12px}.ct-new summary{list-style:none;justify-self:start;width:max-content}.ct-new summary::-webkit-details-marker{display:none}.ct-new[open] summary{margin-bottom:12px}`;
  document.head.appendChild(css);

  /* ---------- for dash.js ---------- */
  window.LodgeNetTabs={
    has:id=>{const t=byId(id);return !!t&&visible(t)},
    title:id=>{const t=byId(id);return t?t.name||"New tab":""},
    render,settings:settingsCard,data:()=>tabs};
  drawNav();
})();
