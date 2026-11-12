/* District tab on the lodge dashboard: every blue lodge in the lodge's Masonic district and every York Rite, Eastern Star,
   Rainbow, DeMolay, Amaranth, Shrine and Scottish Rite body that meets there, on a map and in a list.
   The directory itself is assets/districts.js; the lodge is matched to its district by city and state (Lodge info). */
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const KINDS=[
    ["blue","Blue lodges","#2f5d8a"],["york","York Rite","#a3302b"],["oes","Eastern Star","#2e7d4f"],
    ["rainbow","Rainbow Girls","#7b4fa0"],["demolay","DeMolay","#b5651d"],["amaranth","Amaranth","#8a6d1d"],
    ["shrine","Shriners","#b0263f"],["scottish","Scottish Rite","#1f6f78"]];
  const KIND=Object.fromEntries(KINDS.map(([k,l,c])=>[k,{label:l,color:c}]));
  const LEAFLET="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  let map=null,layer=null,pins={},filter="all",q="",key=null;

  const val=id=>{const el=document.getElementById(id);return el?el.value:""};
  const C=()=>(window.LodgeNetApp&&window.LodgeNetApp.CFG)||window.LODGE||{};
  function districtKey(){
    const D=window.LodgeNetDistricts;if(!D)return null;
    const cfg=C(),f=cfg.form||{};
    return D.find(val("f-city")||f["f-city"]||cfg.city,val("f-state")||f["f-state"]||cfg.state,cfg.district);
  }
  const telHref=p=>"tel:+1"+String(p).replace(/\D/g,"").replace(/^1/,"");
  const dirHref=a=>"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(a);

  /* ---------- officers: this year's and next year's, for every lodge and body in the district ----------
     Saved with the lodge's data as districtOfficers[district][body][year] = [{t:office,n:name,p:phone}].
     A booklet tab (the Blue Book) lays them out with Add district officers (assets/booklet.js). */
  const YEAR=new Date().getFullYear(),YEARS=[YEAR,YEAR+1];
  const A=()=>window.LodgeNetApp||{};
  const canEdit=()=>{const c=A().CLOUD;return !c||!!c.canEdit};
  const OFF=C().districtOfficers&&typeof C().districtOfficers==="object"?JSON.parse(JSON.stringify(C().districtOfficers)):{};
  const bid=b=>b.id||b.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const OFFICES={
    blue:["Worshipful Master","Senior Warden","Junior Warden","Treasurer","Secretary","Senior Deacon","Junior Deacon","Chaplain","Senior Steward","Junior Steward","Tiler"],
    chapter:["Excellent High Priest","King","Scribe","Captain of the Host","Principal Sojourner","Royal Arch Captain","Master of the 3rd Veil","Master of the 2nd Veil","Master of the 1st Veil","Treasurer","Secretary","Sentinel"],
    council:["Illustrious Master","Deputy Master","Principal Conductor of the Work","Treasurer","Recorder","Captain of the Guard","Conductor of the Council","Steward","Sentinel"],
    commandery:["Eminent Commander","Generalissimo","Captain General","Prelate","Senior Warden","Junior Warden","Treasurer","Recorder","Standard Bearer","Sword Bearer","Warder","Sentinel"],
    oes:["Worthy Matron","Worthy Patron","Associate Matron","Associate Patron","Secretary","Treasurer","Conductress","Associate Conductress","Chaplain","Marshal","Organist","Warder","Sentinel"],
    rainbow:["Worthy Advisor","Worthy Associate Advisor","Charity","Hope","Faith","Recorder","Treasurer","Chaplain","Drill Leader","Mother Advisor","Advisory Board Chair"],
    demolay:["Master Councilor","Senior Councilor","Junior Councilor","Scribe","Treasurer","Chapter Advisor","Advisory Council Chairman"],
    amaranth:["Royal Matron","Royal Patron","Associate Matron","Associate Patron","Secretary","Treasurer","Conductress","Associate Conductress"],
    club:["President","Vice President","Secretary","Treasurer"],
    scottish:["President","Vice President","Secretary","Treasurer"]};
  const officesFor=b=>b.k==="york"?OFFICES[/chapter/i.test(b.name)?"chapter":/council/i.test(b.name)?"council":"commandery"]
    :b.k==="shrine"?OFFICES.club:OFFICES[b.k]||OFFICES.club;
  const roster=(k,b,y)=>(((OFF[k]||{})[bid(b)]||{})[y])||null;
  const filled=r=>(r||[]).filter(x=>x.n&&x.n.trim());
  /* the usual offices, with the contact the district published put in his chair */
  function starter(b){
    const m=String(b.contact||"").match(/^(.*?)\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)*)$/);
    return officesFor(b).map(t=>{
      const hit=m&&m[1]&&(t.toLowerCase()===m[1].toLowerCase()||t.toLowerCase().endsWith(m[1].toLowerCase()));
      return {t,n:hit?m[2]:"",p:hit&&b.phone?b.phone:""}});
  }
  function setRoster(k,b,y,r){((OFF[k]=OFF[k]||{})[bid(b)]=OFF[k][bid(b)]||{})[y]=r;saveSoon()}
  function saveSoon(){clearTimeout(saveSoon.t);saveSoon.t=setTimeout(()=>{const a=A();if(a.save)a.save()},500)}
  const offOpen={};let offYear=YEAR;

  function offPanel(d,b,i){
    const r=roster(key,b,offYear),ed=canEdit(),prev=roster(key,b,offYear-1);
    const rows=r||[];
    return `<div class="dist-off-h">
        <div class="dist-yr" role="group" aria-label="Officers for">${YEARS.map(y=>`<button type="button" data-yr="${y}" aria-pressed="${y===offYear}">${y}${y===YEAR?" · current":" · next year"}</button>`).join("")}</div>
      </div>
      ${rows.length?`<table class="dist-off-t"><thead><tr><th>Office</th><th>Name</th><th>Phone</th>${ed?'<th><span class="sr">Remove</span></th>':""}</tr></thead><tbody>
        ${rows.map((x,j)=>ed?`<tr><td><input data-o="${j}" data-f="t" value="${esc(x.t)}" aria-label="Office"></td><td><input data-o="${j}" data-f="n" value="${esc(x.n)}" placeholder="Name" aria-label="${esc(x.t)} name"></td><td><input data-o="${j}" data-f="p" value="${esc(x.p)}" placeholder="Phone" inputmode="tel" aria-label="${esc(x.t)} phone"></td><td><button type="button" class="link-btn" data-orm="${j}" aria-label="Remove ${esc(x.t)}">✕</button></td></tr>`
          :`<tr><td>${esc(x.t)}</td><td>${esc(x.n)||'<span class="hint">Not entered</span>'}</td><td>${x.p?`<a href="${telHref(x.p)}">${esc(x.p)}</a>`:""}</td></tr>`).join("")}
      </tbody></table>`:`<p class="hint" style="margin:0">No ${offYear} officers entered yet.</p>`}
      ${ed?`<div class="row-acts">
        ${rows.length?'<button type="button" class="btn line sm" data-oadd>Add an office</button>':'<button type="button" class="btn sm" data-ostart>Start with the usual offices</button>'}
        ${prev&&filled(prev).length?`<button type="button" class="btn line sm" data-ocopy>Copy ${offYear-1}'s list</button>`:""}
      </div>`:""}`;
  }
  function wireOff(el,d,b,i){
    const draw=()=>{el.innerHTML=offPanel(d,b,i);wireOff(el,d,b,i);const s=el.closest(".dist-card").querySelector(".dist-offsum");if(s)s.innerHTML=offSum(b)};
    el.querySelectorAll("[data-yr]").forEach(x=>x.addEventListener("click",()=>{offYear=+x.dataset.yr;draw()}));
    const r=()=>roster(key,b,offYear)||[];
    el.querySelectorAll("[data-o]").forEach(inp=>inp.addEventListener("input",()=>{const rr=r();rr[+inp.dataset.o][inp.dataset.f]=inp.value;setRoster(key,b,offYear,rr);
      const s=el.closest(".dist-card").querySelector(".dist-offsum");if(s)s.innerHTML=offSum(b)}));
    el.querySelectorAll("[data-orm]").forEach(x=>x.addEventListener("click",()=>{const rr=r();rr.splice(+x.dataset.orm,1);setRoster(key,b,offYear,rr);draw()}));
    const on=(sel,f)=>{const x=el.querySelector(sel);if(x)x.addEventListener("click",()=>{f();draw();const f1=el.querySelector('input[data-f="n"]');if(f1&&sel!=="[data-oadd]")f1.focus()})};
    on("[data-oadd]",()=>{const rr=r();rr.push({t:"",n:"",p:""});setRoster(key,b,offYear,rr)});
    on("[data-ostart]",()=>setRoster(key,b,offYear,offYear===YEAR?starter(b):officesFor(b).map(t=>({t,n:"",p:""}))));
    on("[data-ocopy]",()=>{if(r().some(x=>x.n)&&!confirm(`Replace the ${offYear} list with ${offYear-1}'s?`))return;
      setRoster(key,b,offYear,(roster(key,b,offYear-1)||[]).map(x=>({...x})))});
  }
  const offSum=b=>YEARS.map(y=>{const n=filled(roster(key,b,y)).length;return `<span class="pill${n?" ok":""}">${y}: ${n?n+" officer"+(n>1?"s":""):"none yet"}</span>`}).join(" ");

  function loadLeaflet(){
    if(window.L)return Promise.resolve(window.L);
    if(loadLeaflet.p)return loadLeaflet.p;
    const css=document.createElement("link");css.rel="stylesheet";css.href=LEAFLET+"leaflet.min.css";document.head.appendChild(css);
    return loadLeaflet.p=new Promise((ok,no)=>{const s=document.createElement("script");s.src=LEAFLET+"leaflet.min.js";
      s.onload=()=>ok(window.L);s.onerror=no;document.head.appendChild(s)});
  }

  const shown=d=>d.bodies.filter(b=>(filter==="all"||b.k===filter)&&
    (!q||(b.name+" "+(d.halls[b.hall]||{}).addr+" "+(b.contact||"")).toLowerCase().includes(q)));

  function card(d,b,i){
    const h=d.halls[b.hall]||{},k=KIND[b.k];
    return `<article class="card dist-card" data-i="${i}" style="--kc:${k.color}">
      <div class="row-sp"><span class="dist-kind">${esc(k.label)}</span>${b.since?`<span class="hint">Chartered ${b.since}</span>`:""}</div>
      <h4>${esc(b.name)}</h4>
      <dl class="dist-dl">
        <dt>Meets</dt><dd>${esc(b.meets)}${b.meal?` · meal ${esc(b.meal)}`:""}</dd>
        <dt>Where</dt><dd>${esc(h.addr||"")}${h.approx?' <span class="hint">(pin is approximate)</span>':""}</dd>
        ${b.contact||b.phone?`<dt>Contact</dt><dd>${esc(b.contact||"")}${b.phone?` · <a href="${telHref(b.phone)}">${esc(b.phone)}</a>`:""}</dd>`:""}
        ${b.email?`<dt>Email</dt><dd><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></dd>`:""}
        ${b.mail?`<dt>Mail</dt><dd>${esc(b.mail)}</dd>`:""}
      </dl>
      ${b.note?`<p class="hint" style="margin:0">${esc(b.note)}</p>`:""}
      <div class="dist-offsum">${offSum(b)}</div>
      <div class="dist-off" data-off="${i}"${offOpen[bid(b)]?"":" hidden"}></div>
      <div class="row-acts">
        <button class="btn sm" type="button" data-offbtn="${i}" aria-expanded="${!!offOpen[bid(b)]}">Officers</button>
        <button class="btn line sm" type="button" data-show="${i}">Show on map</button>
        ${h.addr?`<a class="btn line sm" href="${dirHref(h.addr)}" target="_blank" rel="noopener">Directions</a>`:""}
        ${b.web?`<a class="btn line sm" href="${esc(b.web)}" target="_blank" rel="noopener">Website</a>`:""}
      </div>
    </article>`;
  }

  function drawPins(d,list){
    if(!map||!window.L)return;const L=window.L;
    if(layer)layer.remove();layer=L.layerGroup().addTo(map);pins={};
    const byHall={};list.forEach(b=>(byHall[b.hall]=byHall[b.hall]||[]).push(b));
    const pts=[];
    Object.entries(byHall).forEach(([hk,bs])=>{const h=d.halls[hk];if(!h||!h.ll)return;
      const col=KIND[bs[0].k].color;
      const icon=L.divIcon({className:"dist-pin",html:`<span style="background:${col}">${bs.length>1?bs.length:""}</span>`,iconSize:[24,24],iconAnchor:[12,12],popupAnchor:[0,-12]});
      const m=L.marker(h.ll,{icon,title:h.name,keyboard:true}).addTo(layer).bindPopup(
        `<b>${esc(h.name)}</b><br>${esc(h.addr)}<ul class="dist-pop">${bs.map(b=>`<li><i style="background:${KIND[b.k].color}"></i>${esc(b.name)}<br><small>${esc(b.meets)}</small></li>`).join("")}</ul>
         <a href="${dirHref(h.addr)}" target="_blank" rel="noopener">Directions</a>`);
      pins[hk]=m;pts.push(h.ll)});
    if(pts.length)map.fitBounds(pts,{padding:[30,30],maxZoom:13});
  }

  function render(){
    const box=$("#p-dist");if(!box)return;
    const top=$(".side");if(top)document.documentElement.style.setProperty("--top-h",top.getBoundingClientRect().height+"px");
    const D=window.LodgeNetDistricts;key=districtKey();const d=key&&D[key];
    if(!d){box.innerHTML=`<div class="empty">We don't have a directory for your district yet. Make sure your city and state are set under
      <a href="#website">Lodge info</a>, or email <a href="mailto:hello@lodgenet.app">hello@lodgenet.app</a> and we'll add your district's lodges and bodies.</div>`;return}
    const counts=Object.fromEntries(KINDS.map(([k])=>[k,d.bodies.filter(b=>b.k===k).length]));
    box.innerHTML=`
      <div class="dist-head">
        <div><h3 class="panel-title" style="margin:0">${esc(d.name)}</h3>
          <p class="hint" style="margin:4px 0 0">${esc(d.grand)} · ${esc(d.area)}${d.ddgm?` · DDGM ${esc(d.ddgm)}`:""}</p></div>
        ${d.site?`<a class="btn line sm" href="${esc(d.site)}" target="_blank" rel="noopener">District website</a>`:""}
      </div>
      <div class="dist-bar">
        <div class="dist-chips" role="group" aria-label="Show">
          <button type="button" data-f="all" aria-pressed="${filter==="all"}">All <b>${d.bodies.length}</b></button>
          ${KINDS.filter(([k])=>counts[k]).map(([k,l,c])=>`<button type="button" data-f="${k}" aria-pressed="${filter===k}" style="--kc:${c}"><i></i>${esc(l)} <b>${counts[k]}</b></button>`).join("")}
        </div>
        <input type="search" id="dist-q" placeholder="Search by name, town or contact" value="${esc(q)}" aria-label="Search the district">
      </div>
      <div class="dist-wrap">
        <div class="dist-map-box"><div id="dist-map" role="region" aria-label="Map of the district"></div></div>
        <div class="dist-list" id="dist-list"></div>
      </div>
      <p class="hint" style="margin:14px 0 0">From the district's own pages (afm29th.org), the SC Grand York Rite and the Grand Chapter OES, November 2026. Officers change each year, so call ahead before visiting.</p>`;
    box.querySelectorAll("[data-f]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.f;
      box.querySelectorAll("[data-f]").forEach(x=>x.setAttribute("aria-pressed",x===b));list(d)}));
    $("#dist-q").addEventListener("input",e=>{q=e.target.value.trim().toLowerCase();list(d)});
    if(map){map.remove();map=null}
    loadLeaflet().then(L=>{
      map=L.map("dist-map",{scrollWheelZoom:false}).setView(d.center,10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
      list(d);
    }).catch(()=>{$("#dist-map").innerHTML='<div class="empty" style="height:100%;display:grid;place-items:center">The map could not load. The list still has every address.</div>'});
    list(d);
  }

  function list(d){
    const L=shown(d),el=$("#dist-list");if(!el)return;
    const all=d.bodies;
    el.innerHTML=L.length?L.map(b=>card(d,b,all.indexOf(b))).join(""):'<div class="empty">Nothing matches that search.</div>';
    el.querySelectorAll(".dist-off:not([hidden])").forEach(o=>{const b=all[+o.dataset.off];o.innerHTML=offPanel(d,b);wireOff(o,d,b)});
    el.querySelectorAll("[data-offbtn]").forEach(btn=>btn.addEventListener("click",()=>{
      const b=all[+btn.dataset.offbtn],o=el.querySelector(`.dist-off[data-off="${btn.dataset.offbtn}"]`),open=o.hidden;
      offOpen[bid(b)]=open;o.hidden=!open;btn.setAttribute("aria-expanded",open);
      if(open){o.innerHTML=offPanel(d,b);wireOff(o,d,b)}}));
    el.querySelectorAll("[data-show]").forEach(btn=>btn.addEventListener("click",()=>{
      const b=all[+btn.dataset.show],m=pins[b.hall];if(!m||!map)return;
      map.setView(m.getLatLng(),14);m.openPopup();
      $("#dist-map").scrollIntoView({behavior:"smooth",block:"nearest"})}));
    drawPins(d,L);
  }

  /* booklet entries for one year: each lodge and body, its meeting and its officers, in the district's order */
  function entries(year,kinds,skipEmpty){
    const D=window.LodgeNetDistricts,k=districtKey(),d=k&&D[k];if(!d)return [];
    return d.bodies.filter(b=>!kinds||kinds.includes(b.k)).map(b=>{
      const h=d.halls[b.hall]||{},r=filled(roster(k,b,year));
      if(skipEmpty&&!r.length)return null;
      const lines=[`Meets: ${b.meets}${b.meal?` (meal ${b.meal})`:""}`,h.addr?`At: ${h.addr}`:"",b.mail?`Mail: ${b.mail}`:"",b.web?`Web: ${b.web}`:""].filter(Boolean);
      const offs=r.length?r.map(x=>`${x.t||"Officer"}: ${x.n}${x.p?`, ${x.p}`:""}`).join("\n"):"Officers not entered yet.";
      return {id:`dist-${k}-${bid(b)}-${year}`,title:`${b.name}`,body:lines.join("\n")+`\n\n${year} OFFICERS\n`+offs,images:[],sources:[`${d.name} officers, ${year}`],at:new Date().toISOString().slice(0,10),kind:b.k};
    }).filter(Boolean);
  }
  window.LodgeNetDistrict={render,entries,years:()=>YEARS,data:()=>OFF,kinds:()=>KINDS.map(([k,l])=>[k,l]),
    has:()=>!!districtKey(),name:()=>{const k=districtKey();return k?window.LodgeNetDistricts[k].name:""},
    figures(){const D=window.LodgeNetDistricts,k=districtKey(),d=k&&D[k];if(!d)return null;
      const n=x=>d.bodies.filter(b=>b.k===x).length;
      return [["District",d.name.replace(/ Masonic District$/,""),d.area],["Blue lodges",n("blue"),"In the district"],
        ["York Rite",n("york"),"Chapters, councils, commanderies"],["Other bodies",d.bodies.length-n("blue")-n("york"),"OES, Rainbow, DeMolay, Shrine and more"]]}};
})();
