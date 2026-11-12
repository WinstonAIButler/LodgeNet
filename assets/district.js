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
      <div class="row-acts">
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
    el.querySelectorAll("[data-show]").forEach(btn=>btn.addEventListener("click",()=>{
      const b=all[+btn.dataset.show],m=pins[b.hall];if(!m||!map)return;
      map.setView(m.getLatLng(),14);m.openPopup();
      $("#dist-map").scrollIntoView({behavior:"smooth",block:"nearest"})}));
    drawPins(d,L);
  }

  window.LodgeNetDistrict={render,
    figures(){const D=window.LodgeNetDistricts,k=districtKey(),d=k&&D[k];if(!d)return null;
      const n=x=>d.bodies.filter(b=>b.k===x).length;
      return [["District",d.name.replace(/ Masonic District$/,""),d.area],["Blue lodges",n("blue"),"In the district"],
        ["York Rite",n("york"),"Chapters, councils, commanderies"],["Other bodies",d.bodies.length-n("blue")-n("york"),"OES, Rainbow, DeMolay, Shrine and more"]]}};
})();
