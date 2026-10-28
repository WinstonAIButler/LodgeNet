(function(){
  const $=s=>document.querySelector(s);
  const money=n=>"$"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  /* a lodge page can set window.LODGE before this script to load its own data */
  /* edits are kept in this browser under a key per page; Export/Import moves them between browsers */
  /* when a signed-in member opens their lodge, assets/auth.js sets LODGENET_CLOUD and edits save to the lodge account instead */
  const STORE_KEY="lodgenet:"+(location.pathname.replace(/\.html$/,"").replace(/\/$/,"")||"/");
  const CLOUD=window.LODGENET_CLOUD||null;
  let LOCAL=null;try{LOCAL=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch(e){LOCAL=null}
  /* the first officer to sign in carries this browser's saved edits up to the account */
  const MOVE_LOCAL=!!(CLOUD&&CLOUD.canEdit&&!CLOUD.data&&LOCAL);
  const SAVED=CLOUD?(CLOUD.data||(MOVE_LOCAL?LOCAL:null)):LOCAL;
  const CFG=Object.assign({},window.LODGE||{},SAVED||{},CLOUD?{plan:CLOUD.plan}:{});
  /* ---------- states and their Grand Lodges ----------
     style: F = Free and Accepted Masons (F.&A.M.), A = Ancient Free and Accepted Masons (A.F.&A.M.) */
  const STATES=[["AL","Alabama","F"],["AK","Alaska","F"],["AZ","Arizona","F"],["AR","Arkansas","F"],["CA","California","F"],
    ["CO","Colorado","A"],["CT","Connecticut","A"],["DE","Delaware","A"],["DC","District of Columbia","F"],["FL","Florida","F"],
    ["GA","Georgia","F"],["HI","Hawaii","F"],["ID","Idaho","A"],["IL","Illinois","A"],["IN","Indiana","F"],["IA","Iowa","A"],
    ["KS","Kansas","A"],["KY","Kentucky","F"],["LA","Louisiana","F"],["ME","Maine","A"],["MD","Maryland","A"],
    ["MA","Massachusetts","A"],["MI","Michigan","F"],["MN","Minnesota","A"],["MS","Mississippi","F"],["MO","Missouri","A"],
    ["MT","Montana","A"],["NE","Nebraska","A"],["NV","Nevada","F"],["NH","New Hampshire","F"],["NJ","New Jersey","F"],
    ["NM","New Mexico","A"],["NY","New York","F"],["NC","North Carolina","A"],["ND","North Dakota","A"],["OH","Ohio","F"],
    ["OK","Oklahoma","A"],["OR","Oregon","A"],["PA","Pennsylvania","F"],["RI","Rhode Island","F"],["SC","South Carolina","AFM"],
    ["SD","South Dakota","A"],["TN","Tennessee","F"],["TX","Texas","A"],["UT","Utah","F"],["VT","Vermont","F"],
    ["VA","Virginia","A"],["WA","Washington","F"],["WV","West Virginia","A"],["WI","Wisconsin","F"],["WY","Wyoming","A"]];
  const STYLE={F:["Free and Accepted Masons","F.&A.M."],A:["Ancient Free and Accepted Masons","A.F.&A.M."],AFM:["Ancient Free Masons","A.F.M."]};
  function grandLodge(code,family){
    const st=STATES.find(x=>x[0]===code);if(!st)return null;
    const of=code==="DC"?"the District of Columbia":st[1];
    if(family==="pha")return {gl:`Most Worshipful Prince Hall Grand Lodge of ${of}`,jur:"F.&A.M. (PHA)"};
    const [words,abbr]=STYLE[st[2]];
    return {gl:code==="MA"?"Grand Lodge of Masons in Massachusetts":`Grand Lodge of ${words} of ${of}`,jur:abbr};
  }
  (function(){const sel=document.getElementById("f-state");if(!sel)return;
    const def=sel.dataset.default!==undefined?sel.dataset.default:"OH";
    sel.innerHTML=(def===""?'<option value="">Choose your state</option>':"")+STATES.map(([c,n,t])=>`<option value="${c}">${n} (${STYLE[t][1]})</option>`).join("");
    sel.value=def;})();
  function fillGrandLodge(){const g=grandLodge(document.getElementById("f-state").value,document.getElementById("f-family").value);
    if(g){document.getElementById("f-gl").value=g.gl;document.getElementById("f-jur").value=g.jur}}

  /* ---------- Stated Communication schedule ---------- */
  const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const ORD=["","1st","2nd","3rd","4th"];
  const time12=t=>{if(!t)return "";let [h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${String(m).padStart(2,"0")} ${ap}`};
  function readSched(str){
    const w=/(1st|2nd|3rd|4th)/i.exec(str||""),d=/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/i.exec(str||""),t=/(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(str||"");
    let time="";if(t){let h=+t[1]%12;if(t[3].toUpperCase()==="PM")h+=12;time=`${String(h).padStart(2,"0")}:${t[2]}`}
    return {week:w?String(ORD.indexOf(w[1].toLowerCase())):"2",day:d?d[0][0].toUpperCase()+d[0].slice(1).toLowerCase():"Tuesday",time};
  }
  function schedText(){
    const el=id=>document.getElementById(id);
    return `${ORD[+el("f-week").value]} ${el("f-day").value} of each month`+(el("f-time").value?`, ${time12(el("f-time").value)}`:"");
  }
  function nthWeekday(y,m,n,dayName){const first=new Date(y,m,1),off=(DAYS.indexOf(dayName)-first.getDay()+7)%7;return new Date(y,m,1+off+7*(n-1))}

  /* older saves kept the town as "City, ST" */
  const savedForm=Object.assign({},(CFG.form||{}));
  if(savedForm["f-town"]&&!savedForm["f-city"]){const [c,st]=savedForm["f-town"].split(/,\s*/);savedForm["f-city"]=c;if(st&&STATES.some(x=>x[0]===st.toUpperCase()))savedForm["f-state"]=st.toUpperCase();delete savedForm["f-town"]}
  CFG.form=savedForm;
  if(!CFG.form["f-gl"]){Object.entries(CFG.form).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v});fillGrandLodge()}
  const applySchedule=()=>{const f=CFG.form||{};if(f["f-week"])return;
    const r=readSched(f["f-sched"]||document.getElementById("f-sched").value);
    document.getElementById("f-week").value=r.week;document.getElementById("f-day").value=r.day;document.getElementById("f-time").value=r.time;};
  Object.entries(CFG.form||{}).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v});
  applySchedule();document.getElementById("f-sched").value=schedText();document.getElementById("sched-text").textContent=schedText();
  const handle=id=>$(id).value.trim().replace(/^[@$]/,"").replace(/^https?:\/\/\S+\//,"");

  /* ---------- payment links ---------- */
  const PAY=[
    {k:"paypal",label:"PayPal",field:"#f-pp",url:(u,a,n)=>`https://paypal.me/${encodeURIComponent(u)}/${a.toFixed(2)}USD`},
    {k:"venmo",label:"Venmo",field:"#f-venmo",url:(u,a,n)=>`https://venmo.com/?txn=pay&recipients=${encodeURIComponent(u)}&amount=${a.toFixed(2)}&note=${encodeURIComponent(n)}`},
    {k:"cashapp",label:"Cash App",field:"#f-cash",url:(u,a,n)=>`https://cash.app/$${encodeURIComponent(u)}/${a.toFixed(2)}`}
  ];
  const payButtons=(attr)=>PAY.map(p=>`<button type="button" class="paybtn ${p.k}" ${attr}="${p.k}" ${handle(p.field)?"":"disabled title=\"Add this account on the Website tab\""}>${p.label}</button>`).join("");
  const payLink=(k,amt,note)=>{const p=PAY.find(x=>x.k===k);return p.url(handle(p.field),amt,note)};

  /* ---------- tabs ---------- */
  const tabs=[...document.querySelectorAll(".tab")];
  tabs.forEach(t=>t.addEventListener("click",()=>{
    tabs.forEach(o=>{o.setAttribute("aria-selected",o===t);document.getElementById(o.getAttribute("aria-controls")).hidden=o!==t});
    if(t.id==="t-store") drawProducts();
  }));

  /* ---------- shared events ---------- */
  const TODAY=new Date(2026,9,27);
  let events=CFG.events||[
    {d:"2026-11-10",t:"Stated Communication",k:"lodge",time:"7:30 PM",note:"Dinner at 6:30. Vote on 2027 budget."},
    {d:"2026-11-14",t:"Pancake Breakfast",k:"fund",time:"7:00–11:00 AM",goal:5000,raised:3180,rsvp:142,note:"Proceeds to the Lodge Scholarship Fund. $10 adults, $5 kids."},
    {d:"2026-11-19",t:"Fellowcraft Degree",k:"lodge",time:"7:00 PM",note:"Special Communication. Master Masons only."},
    {d:"2026-11-22",t:"Turkey Drive",k:"fund",time:"9:00 AM",goal:2000,raised:1460,rsvp:38,note:"Collecting for Millbrook Food Pantry."},
    {d:"2026-12-05",t:"Bikes for Books Raffle",k:"fund",time:"All day",goal:3000,raised:820,rsvp:61,note:"Bikes awarded to students who meet reading goals."},
    {d:"2026-12-08",t:"Stated Communication",k:"lodge",time:"7:30 PM",note:"Election of officers for 2027."},
    {d:"2026-12-27",t:"St. John's Day Installation",k:"lodge",time:"2:00 PM",note:"Public installation of 2027 officers. Families welcome."},
    {d:"2026-10-13",t:"Stated Communication",k:"lodge",time:"7:30 PM",note:"Minutes awaiting approval."},
    {d:"2026-10-24",t:"Fall Fish Fry",k:"fund",time:"5:00 PM",goal:2500,raised:2740,rsvp:180,note:"Goal met. Thank you, Millbrook!"}
  ];
  const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
  const fmt=(dt,o)=>dt.toLocaleDateString("en-US",o);

  /* ---------- members & officer seats ---------- */
  let nextMember=1;
  const M=(name,deg,pm,dues)=>({id:nextMember++,name,deg:deg||"Master Mason",pm:!!pm,dues:dues||"Paid 2026",active:true});
  const members=CFG.membersFull?CFG.membersFull.map(m=>({...m})):CFG.members?CFG.members.map(a=>M(...a)):[
    M("Daniel R. Ortega"),M("Marcus Hale"),M("Peter Lindqvist"),M("Walter Simms","",1),M("James Whitfield","",1),
    M("Andre Baptiste"),M("Kevin O'Rourke"),M("Samuel Carter"),M("Luis Ferreira"),M("Harold Benson","",1),
    M("Thomas Greene","",1),M("Robert Kline","",1,"Owes 2026"),M("George Patterson","",1),M("David Okafor"),
    M("Michael Tran","","", "Owes 2026"),M("Brian Walsh","Fellowcraft"),M("Thomas Reyes","Entered Apprentice")
  ];
  nextMember=Math.max(0,...members.map(m=>m.id))+1;
  const SEATS=[
    {k:"WM",ab:"WM",t:"Worshipful Master"},{k:"SW",ab:"SW",t:"Senior Warden"},{k:"JW",ab:"JW",t:"Junior Warden"},
    {k:"TREAS",ab:"Treas.",t:"Treasurer"},{k:"SEC",ab:"Sec.",t:"Secretary"},{k:"SD",ab:"SD",t:"Senior Deacon"},
    {k:"JD",ab:"JD",t:"Junior Deacon"},{k:"STW1",ab:"Stwd",t:"Senior Steward"},{k:"STW2",ab:"Stwd",t:"Junior Steward"},
    {k:"TILER",ab:"Tiler",t:"Tiler"},{k:"CHAP",ab:"Chap.",t:"Chaplain"}
  ];
  const officers=CFG.officers||{WM:1,SW:2,JW:3,TREAS:4,SEC:5,SD:6,JD:7,STW1:8,STW2:9,TILER:10,CHAP:11};
  const member=id=>members.find(m=>m.id===+id);
  const fullName=id=>{const m=member(id);return m?(m.pm?"WB ":"")+m.name:""};
  const eligible=()=>members.filter(m=>m.active&&m.deg==="Master Mason").sort((a,b)=>a.name.split(" ").pop().localeCompare(b.name.split(" ").pop()));
  function seatSelect(attr,seat,cur,cls){
    const opts=eligible();
    if(cur&&!opts.some(m=>m.id===+cur)&&member(cur))opts.unshift(member(cur));
    return `<select ${attr}="${seat.k}" class="${cls||""}" aria-label="${seat.t}"><option value="">${cls?"":"Vacant"}</option>${opts.map(m=>`<option value="${m.id}"${+cur===m.id?" selected":""}>${esc((m.pm?"WB ":"")+m.name)}</option>`).join("")}</select>`;
  }
  function renderMembers(){
    const act=members.filter(m=>m.active);
    if(!act.length){$("#mem-count").textContent="No members yet";$("#mem-rows").innerHTML='<tr><td colspan="6" class="hint">Add your first brother below. Officers are picked from Master Masons on this list.</td></tr>';$("#seat-defaults").innerHTML=SEATS.map(x=>`<div class="seat-row"><label for="sd-${x.k}" title="${x.t}">${x.ab}</label>${seatSelect("data-sdef",x,officers[x.k]).replace("<select ",`<select id="sd-${x.k}" `)}</div>`).join("");return}
    $("#mem-count").textContent=`${act.length} members · ${act.filter(m=>m.deg==="Master Mason").length} Master Masons`;
    const seatOf=id=>SEATS.filter(x=>+officers[x.k]===id).map(x=>x.ab).join(", ");
    $("#mem-rows").innerHTML=act.map(m=>`<tr>
      <td class="nm">${esc(m.name)}</td>
      <td><select data-mdeg="${m.id}" aria-label="Degree for ${esc(m.name)}">${["Master Mason","Fellowcraft","Entered Apprentice"].map(d=>`<option${d===m.deg?" selected":""}>${d}</option>`).join("")}</select></td>
      <td><input type="checkbox" data-mpm="${m.id}" aria-label="${esc(m.name)} is a Past Master"${m.pm?" checked":""}></td>
      <td>${seatOf(m.id)?`<span class="pill gold">${seatOf(m.id)}</span>`:'<span class="hint">None</span>'}</td>
      <td><span class="pill ${m.dues.startsWith("Paid")?"ok":m.dues.startsWith("Owes")?"warn":""}">${esc(m.dues)}</span></td>
      <td><button type="button" class="btn line sm" data-mrm="${m.id}">Remove</button></td></tr>`).join("");
    $("#seat-defaults").innerHTML=SEATS.map(x=>`<div class="seat-row"><label for="sd-${x.k}" title="${x.t}">${x.ab}</label>${seatSelect("data-sdef",x,officers[x.k]).replace("<select ",`<select id="sd-${x.k}" `)}</div>`).join("");
  }
  $("#mem-rows").addEventListener("change",e=>{
    const t=e.target;
    if(t.dataset.mdeg){const m=member(t.dataset.mdeg);m.deg=t.value;if(m.deg!=="Master Mason")for(const k in officers)if(+officers[k]===m.id)officers[k]="";}
    if(t.dataset.mpm)member(t.dataset.mpm).pm=t.checked;
    refreshPeople();
  });
  $("#mem-rows").addEventListener("click",e=>{
    const b=e.target.closest("[data-mrm]");if(!b)return;
    const m=member(b.dataset.mrm);m.active=false;for(const k in officers)if(+officers[k]===m.id)officers[k]="";
    refreshPeople();
  });
  $("#seat-defaults").addEventListener("change",e=>{const k=e.target.dataset.sdef;if(k){officers[k]=e.target.value;refreshPeople()}});
  $("#mem-form").addEventListener("submit",e=>{
    e.preventDefault();const n=$("#m-name").value.trim();if(!n)return;
    members.push(M(n,$("#m-deg").value,$("#m-pm").checked,"Paid 2026"));
    $("#m-name").value="";$("#m-pm").checked=false;refreshPeople();
  });
  function refreshPeople(){renderMembers();renderSite();if(typeof renderMinutes==="function")renderMinutes()}

  /* ---------- website builder ---------- */
  let siteColor=CFG.color||"#1c3a75";
  document.querySelectorAll(".swatch").forEach(b=>b.setAttribute("aria-pressed",b.dataset.c===siteColor));
  function renderSite(){
    const name=$("#f-name").value.trim()||"Your Lodge", num=$("#f-num").value.trim(), jur=$("#f-jur").value;
    const full=name+(num?" No. "+num:"");
    $("#pv-title").textContent=full+(jur?", "+jur:"");
    const town=[$("#f-city").value.trim(),$("#f-state").value].filter(Boolean).join(", ");
    $("#pv-sub").textContent=[town,"Stated Communications "+$("#f-sched").value.trim()].filter(Boolean).join(" · ");
    $("#pv-url").textContent=(name==="Your Lodge"&&!num)?"yourlodge.lodgenet.org":(name.toLowerCase().replace(/lodge/g,"").replace(/[^a-z0-9]/g,"")+num)+".lodgenet.org";
    $("#cb-name").textContent=full;
    $("#pv-officers").innerHTML=["WM","SW","JW","TREAS","SEC"].map(k=>{const x=SEATS.find(s=>s.k===k),m=member(officers[k]);
      return `<dt>${x.t}</dt><dd>${m?esc(m.name+(m.pm&&k!=="WM"?", PM":"")):"Vacant"}</dd>`}).join("");
    $("#site-preview").style.setProperty("--site",siteColor);
    const up=events.filter(e=>parse(e.d)>=TODAY).sort((a,b)=>a.d<b.d?-1:1).slice(0,4);
    const email=$("#f-email").value.trim();
    $("#pv-email").textContent=email||"Add the lodge email on the left";
    const socials=[["Facebook","#f-fb","https://facebook.com/"],["Instagram","#f-ig","https://instagram.com/"],["X","#f-x","https://x.com/"],["YouTube","#f-yt","https://youtube.com/@"],["TikTok","#f-tt","https://tiktok.com/@"]]
      .filter(([,f])=>handle(f)).map(([n,f,base])=>`<a href="${esc(base+handle(f))}" target="_blank" rel="noopener">${n}</a>`).join("");
    $("#pv-social").innerHTML=socials||'<span style="color:#5a6276">No social accounts linked</span>';
    $("#pv-pay").innerHTML=PAY.some(p=>handle(p.field))?PAY.filter(p=>handle(p.field)).map(p=>`<span class="paybtn ${p.k}">${p.label}</span>`).join(""):'<span style="color:#5a6276">No payment accounts linked</span>';
    $("#checkout").innerHTML=payButtons("data-pay");
    if(selected&&selected.k==="fund")renderDetail();
    $("#pv-events").innerHTML=up.map(e=>`<li><b>${fmt(parse(e.d),{month:"short",day:"numeric"})}</b> · ${esc(e.t)}</li>`).join("");
  }
  ["#f-name","#f-num","#f-jur","#f-gl","#f-city","#f-sched","#f-email","#f-fb","#f-ig","#f-x","#f-yt","#f-tt","#f-pp","#f-venmo","#f-cash"].forEach(s=>$(s).addEventListener("input",()=>{renderSite();renderMinutes();$("#site-status").textContent="Draft · unpublished changes"}));
  $("#swatches").addEventListener("click",e=>{const b=e.target.closest(".swatch");if(!b)return;siteColor=b.dataset.c;document.querySelectorAll(".swatch").forEach(s=>s.setAttribute("aria-pressed",s===b));renderSite();$("#site-status").textContent="Draft · unpublished changes"});
  ["#f-state","#f-family"].forEach(id=>$(id).addEventListener("change",()=>{fillGrandLodge();renderSite();renderMinutes();$("#site-status").textContent="Draft · unpublished changes"}));
  ["#f-week","#f-day","#f-time"].forEach(id=>$(id).addEventListener("change",()=>{
    $("#f-sched").value=schedText();$("#sched-text").textContent=schedText();regenStated();renderCal();renderMinutes();$("#site-status").textContent="Draft · unpublished changes"}));
  let gmail=!!CFG.gmail;
  function renderGmail(){
    const st=$("#gmail-state");st.textContent=gmail?"Connected":"Not connected";st.className="pill"+(gmail?" ok":"");
    $("#gmail-btn").textContent=gmail?"Disconnect":"Connect Gmail";
    $("#gmail-hint").textContent=gmail?`Inquiries, RSVPs and store receipts now send from ${$("#f-email").value.trim()} (demo, no account was contacted).`:'Connect to send "Become a Mason" inquiries, RSVPs and store receipts from the lodge\'s own address.';
  }
  $("#gmail-btn").addEventListener("click",()=>{
    const v=$("#f-email").value.trim();
    if(!gmail&&!/^[^@\s]+@(gmail\.com|googlemail\.com|[^@\s]+\.[a-z]{2,})$/i.test(v)){$("#gmail-hint").textContent="Enter the lodge's full email address first, for example cedarhollow214@gmail.com.";return}
    gmail=!gmail;renderGmail();
  });
  $("#f-email").addEventListener("input",()=>{if(gmail)renderGmail()});
  const LOCKED='<span class="pill">Not published</span> Publishing unlocks once the lodge\'s plan is paid for. <a href="/login">Subscribe on My lodges</a>';
  if(CLOUD&&!CLOUD.paid)$("#site-status").innerHTML=LOCKED;
  $("#site-form").addEventListener("submit",e=>{e.preventDefault();if(CLOUD&&!CLOUD.paid)return $("#site-status").innerHTML=LOCKED;$("#site-status").innerHTML='<span class="pill ok">Published</span> Live at '+esc($("#pv-url").textContent)+" (demo)"});

  /* ---------- store ---------- */
  const products=CFG.products||[
    {id:"tee",n:"Lodge No. 214 T-shirt",p:24,margin:9,kind:"tee",tag:"Best seller"},
    {id:"pin",n:"Square & Compasses lapel pin",p:12,margin:7,kind:"pin"},
    {id:"cap",n:"Embroidered lodge cap",p:22,margin:8,kind:"cap"},
    {id:"coin",n:"Centennial challenge coin",p:18,margin:10,kind:"coin",tag:"1926–2026"},
    {id:"mug",n:"\"Meet on the Level\" mug",p:16,margin:6,kind:"mug"},
    {id:"apron",n:"Pancake Breakfast apron",p:28,margin:11,kind:"apron",tag:"Fundraiser"}
  ];
  const cart={};
  function drawProducts(){
    document.querySelectorAll(".product canvas").forEach(c=>paint(c,c.dataset.kind));
  }
  function paint(c,kind){
    const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    if(!r.width)return;
    c.width=r.width*dpr;c.height=r.height*dpr;
    const x=c.getContext("2d");x.scale(dpr,dpr);
    const W=r.width,H=r.height,cs=getComputedStyle(document.documentElement);
    const navy=cs.getPropertyValue("--blue").trim(),gold=cs.getPropertyValue("--gold").trim(),bg=cs.getPropertyValue("--sunk").trim();
    x.fillStyle=bg;x.fillRect(0,0,W,H);
    const cx=W/2,cy=H/2,s=Math.min(W,H);
    x.fillStyle=navy;x.strokeStyle=gold;x.lineWidth=2;
    function sc(px,py,size){x.save();x.strokeStyle=gold;x.lineWidth=Math.max(1.5,size/12);x.lineCap="round";x.beginPath();
      x.moveTo(px-size*.45,py+size*.5);x.lineTo(px,py-size*.5);x.lineTo(px+size*.45,py+size*.5);
      x.moveTo(px-size*.6,py-size*.05);x.lineTo(px,py+size*.55);x.lineTo(px+size*.6,py-size*.05);x.stroke();x.restore()}
    if(kind==="tee"){x.beginPath();const w=s*.62,h=s*.6,t=cy-h/2;
      x.moveTo(cx-w*.2,t);x.lineTo(cx-w/2,t+h*.12);x.lineTo(cx-w*.62,t+h*.32);x.lineTo(cx-w*.38,t+h*.38);x.lineTo(cx-w*.36,t+h);x.lineTo(cx+w*.36,t+h);x.lineTo(cx+w*.38,t+h*.38);x.lineTo(cx+w*.62,t+h*.32);x.lineTo(cx+w/2,t+h*.12);x.lineTo(cx+w*.2,t);x.quadraticCurveTo(cx,t+h*.12,cx-w*.2,t);x.fill();sc(cx,cy+s*.03,s*.18)}
    else if(kind==="pin"){x.beginPath();x.arc(cx,cy,s*.24,0,7);x.fill();x.beginPath();x.arc(cx,cy,s*.24,0,7);x.stroke();sc(cx,cy,s*.24)}
    else if(kind==="cap"){x.beginPath();x.ellipse(cx,cy+s*.06,s*.3,s*.24,0,Math.PI,0);x.fill();x.beginPath();x.ellipse(cx+s*.22,cy+s*.07,s*.22,s*.05,0,0,7);x.fill();sc(cx-s*.02,cy-s*.04,s*.14)}
    else if(kind==="coin"){x.fillStyle=gold;x.beginPath();x.arc(cx,cy,s*.28,0,7);x.fill();x.fillStyle=navy;x.beginPath();x.arc(cx,cy,s*.22,0,7);x.fill();sc(cx,cy-s*.02,s*.2);x.fillStyle=gold;x.font=`600 ${s*.05}px ${cs.getPropertyValue("--mono")}`;x.textAlign="center";x.fillText(CFG.coinText||"100 YEARS",cx,cy+s*.17)}
    else if(kind==="mug"){x.fillRect(cx-s*.2,cy-s*.22,s*.34,s*.44);x.lineWidth=s*.04;x.strokeStyle=navy;x.beginPath();x.arc(cx+s*.16,cy,s*.1,-1.3,1.3);x.stroke();sc(cx-s*.03,cy,s*.16)}
    else if(kind==="apron"){x.beginPath();x.moveTo(cx-s*.22,cy-s*.12);x.lineTo(cx-s*.1,cy-s*.3);x.lineTo(cx+s*.1,cy-s*.3);x.lineTo(cx+s*.22,cy-s*.12);x.lineTo(cx+s*.24,cy+s*.3);x.lineTo(cx-s*.24,cy+s*.3);x.closePath();x.fill();sc(cx,cy+s*.04,s*.16)}
  }
  $("#products").innerHTML=products.map(p=>`<div class="product"><canvas data-kind="${p.kind}" aria-hidden="true"></canvas>
    <div class="pbody">${p.tag?`<span class="pill gold" style="justify-self:start">${esc(p.tag)}</span>`:""}<h4>${esc(p.n)}</h4>
    <span class="hint num">${money(p.margin)} to charity per item</span>
    <div class="meta"><span class="price num">${money(p.p)}</span><button class="btn sm" type="button" data-add="${p.id}">Add</button></div></div></div>`).join("");
  $("#products").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;cart[b.dataset.add]=(cart[b.dataset.add]||0)+1;$("#c-msg").hidden=true;renderCart()});
  $("#cart-lines").addEventListener("click",e=>{const b=e.target.closest("[data-rm]");if(!b)return;cart[b.dataset.rm]--;if(cart[b.dataset.rm]<=0)delete cart[b.dataset.rm];renderCart()});
  function renderCart(){
    const ids=Object.keys(cart);let sub=0,ch=0;
    $("#cart-lines").innerHTML=ids.length?ids.map(id=>{const p=products.find(x=>x.id===id),q=cart[id];sub+=p.p*q;ch+=p.margin*q;
      return `<div class="cart-line"><span>${q} × ${esc(p.n)}</span><span class="num">${money(p.p*q)} <button class="btn line sm" style="padding:0 6px" data-rm="${id}" aria-label="Remove one ${esc(p.n)}">−</button></span></div>`}).join(""):
      '<p class="hint">Your cart is empty. Add a shirt or pin to see how proceeds are counted.</p>';
    $("#c-sub").textContent=money(sub);$("#c-char").textContent=money(ch);
  }
  $("#checkout").addEventListener("click",e=>{
    const b=e.target.closest("[data-pay]");if(!b||b.disabled)return;
    const m=$("#c-msg");
    if(!Object.keys(cart).length){m.hidden=false;m.className="notice";m.textContent="Add at least one item before paying.";return}
    const total=Object.keys(cart).reduce((t,id)=>t+products.find(x=>x.id===id).p*cart[id],0);
    const ch=$("#c-char").textContent,label=b.textContent;
    const url=payLink(b.dataset.pay,total,"LodgeNet store order");
    m.hidden=false;m.className="toast";
    m.innerHTML=`Order placed (demo). ${esc(ch)} recorded for ${esc($("#s-charity").value)}. On the live site, ${esc(label)} opens:<br><span class="paylink">${esc(url)}</span>`;
    for(const k in cart)delete cart[k];renderCart();
  });
  window.addEventListener("resize",()=>{if(!$("#p-store").hidden)drawProducts()});

  /* ---------- calendar ---------- */
  let view=new Date(2026,10,1);
  let selected=events.find(e=>e.k==="fund"&&parse(e.d)>=TODAY)||events.find(e=>parse(e.d)>=TODAY);
  /* Stated Communications on the calendar follow the schedule; notes on a matching date are kept */
  let nextStated=CFG.nextStated||"";
  function regenStated(){
    const keep={};events.filter(e=>e.t==="Stated Communication").forEach(e=>keep[e.d]=e);
    events=events.filter(e=>e.t!=="Stated Communication");
    const n=+$("#f-week").value,day=$("#f-day").value,tm=time12($("#f-time").value)||"Time not set";
    const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const gen=[];
    for(let k=-2;k<=8;k++){const base=new Date(TODAY.getFullYear(),TODAY.getMonth()+k,1);
      const d=iso(nthWeekday(base.getFullYear(),base.getMonth(),n,day)),old=keep[d];
      gen.push({d,t:"Stated Communication",k:"lodge",time:tm,note:old?old.note:"Regular Communication on the third degree."});}
    events=events.concat(gen);
    nextStated=(gen.find(e=>parse(e.d)>=TODAY)||{}).d||nextStated;
    if(selected&&!events.includes(selected))selected=events.find(e=>e.d===selected.d)||gen.find(e=>parse(e.d)>=TODAY);
  }
  function renderCal(){
    $("#cal-title").textContent=fmt(view,{month:"long",year:"numeric"});
    const first=new Date(view.getFullYear(),view.getMonth(),1);
    const start=new Date(first);start.setDate(1-first.getDay());
    let h=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<div class="dow">${d}</div>`).join("");
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      if(i>=35&&d.getMonth()!==view.getMonth())break;
      const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      const evs=events.filter(e=>e.d===key);
      const cls=["day",d.getMonth()!==view.getMonth()?"out":"",d.getTime()===TODAY.getTime()?"today":""].join(" ");
      h+=`<div class="${cls}"><span class="d">${d.getDate()}</span>${evs.map(e=>`<button type="button" class="ev ${e.k==="fund"?"fund":""}" data-i="${events.indexOf(e)}">${esc(e.t)}</button>`).join("")}</div>`;
    }
    $("#cal").innerHTML=h;
    renderDetail();renderSite();
  }
  function renderDetail(){
    const e=selected,el=$("#ev-detail");
    if(!e){el.innerHTML='<h4>Pick an event</h4><p class="hint">Select any event on the calendar to see details, RSVPs and fundraising progress.</p>';return}
    const date=fmt(parse(e.d),{weekday:"long",month:"long",day:"numeric"});
    let body=`<span class="pill ${e.k==="fund"?"gold":""}" style="justify-self:start">${e.k==="fund"?"Public fundraiser":"Lodge meeting"}</span>
      <h4>${esc(e.t)}</h4><div class="hint">${date} · ${esc(e.time||"")}</div><p style="font-size:14px">${esc(e.note||"")}</p>`;
    if(e.k==="fund"){
      const pct=Math.min(100,Math.round(e.raised/e.goal*100));
      body+=`<div style="display:grid;gap:6px"><div class="cart-line"><b class="num">${money(e.raised).replace(".00","")} raised</b><span class="hint num">of ${money(e.goal).replace(".00","")} · ${pct}%</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div><span class="hint num">${e.rsvp} RSVPs</span></div>
        <div style="display:grid;gap:6px"><b style="font-size:13px">Donate $25 online</b><div class="paybtns" id="don-pay">${payButtons("data-don")}</div><div id="don-msg" class="hint" hidden></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" type="button" id="log-don">Log $100 cash donation</button><button class="btn line sm" type="button" id="log-rsvp">Add RSVP</button></div>`;
    }
    el.innerHTML=body;
    const d=$("#log-don"),r=$("#log-rsvp");
    if(d)d.onclick=()=>{e.raised+=100;renderDetail()};
    if(r)r.onclick=()=>{e.rsvp++;renderDetail()};
    const dp=$("#don-pay");
    if(dp)dp.onclick=ev=>{const b=ev.target.closest("[data-don]");if(!b||b.disabled)return;
      const url=payLink(b.dataset.don,25,e.t);e.raised+=25;renderDetail();
      const dm=$("#don-msg");dm.hidden=false;dm.innerHTML=`$25 recorded (demo). On the live site, ${esc(b.textContent)} opens:<br><span class="paylink">${esc(url)}</span>`};
  }
  $("#cal").addEventListener("click",ev=>{const b=ev.target.closest(".ev");if(!b)return;selected=events[+b.dataset.i];renderDetail()});
  $("#cal-prev").onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);renderCal()};
  $("#cal-next").onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);renderCal()};
  $("#e-kind").onchange=()=>{$("#e-goal").closest(".field").hidden=$("#e-kind").value!=="fund"};
  $("#ev-form").addEventListener("submit",ev=>{
    ev.preventDefault();
    const k=$("#e-kind").value,d=$("#e-date").value,t=$("#e-title").value.trim();if(!t||!d)return;
    const e={d,t,k,time:k==="fund"?"Time to be announced":"7:30 PM",note:k==="fund"?"New fundraiser added from the dashboard.":"New lodge meeting."};
    if(k==="fund"){e.goal=Math.max(50,+$("#e-goal").value||500);e.raised=0;e.rsvp=0}
    events.push(e);selected=e;view=new Date(parse(d).getFullYear(),parse(d).getMonth(),1);$("#e-title").value="";renderCal();
  });

  /* ---------- minutes: short form in, Stated Communication write-up out ----------
     Each section is a plugin: the fields the Secretary fills in, and how they read in the
     long form. Anything left blank is left out of the write-up and the PDF. */
  const DEG=["third","second","first"];
  const FOR=["the degrees","affiliation","reinstatement"];
  const RESULT=["carried","failed","tabled","referred to committee"];
  const MS=[
    {id:"opening",title:"Opening",core:true,fields:[["time","Opened at","time"],["degree","On the","sel",DEG,"degree"]]},
    {id:"attend",title:"Attendance",core:true,fields:[["total","Brothers present","num"],["visitors","Visitors","num"],["pms","Past Masters","num"],
      ["vlist","Visiting brethren","list",[["name","Name"],["lodge","Lodge"]]]]},
    {id:"prev",title:"Previous minutes",core:true,fields:[["action","The minutes were","sel",["","read and approved","approved as corrected","approved as distributed","reading dispensed with"]],["notes","Notes","area"]]},
    {id:"corr",title:"Correspondence",fields:[["items","Letters read","list",[["from","From"],["about","About"]]],["notes","Notes","area"]]},
    {id:"pet",title:"Petitions",fields:[["items","Petitions received","list",[["name","Petitioner"],["for","For","sel",FOR],["committee","Investigating committee"]]]]},
    {id:"ballot",title:"Balloting",fields:[["items","Ballots taken","list",[["name","Candidate"],["for","For","sel",FOR],["result","Result","sel",["elected","rejected"]]]]]},
    {id:"treas",title:"Treasurer's Report",fields:[["gen","General Fund $","money"],["char","Charity Fund $","money"],["wo","Widows & Orphans Fund $","money"],
      ["action","The report was","sel",["","accepted as read","received and filed for audit"]],["notes","Notes","area"]]},
    {id:"bills",title:"Bills",def:false,fields:[["items","Bills presented","list",[["payee","Payee"],["amt","Amount $"]]],["action","The bills were","sel",["","approved and ordered paid","referred to the Finance Committee"]]]},
    {id:"old",title:"Old Business",fields:[["motions","Motions","motions"],["notes","Notes","area"]]},
    {id:"new",title:"New Business",fields:[["motions","Motions","motions"],["notes","Notes","area"]]},
    {id:"degree",title:"Degree Work",def:false,fields:[["deg","Degree","sel",["","Entered Apprentice","Fellowcraft","Master Mason"]],["cands","Candidates"],["by","Conferred by"]]},
    {id:"mw",title:"Masters & Wardens",fields:[["notes","Notes","area"]]},
    {id:"edu",title:"Masonic Education",fields:[["by","Presented by","member"],["topic","Topic"],["notes","Notes","area"]]},
    {id:"sick",title:"Sick & Distressed",fields:[["items","Brethren and families","list",[["name","Name"],["note","Note"]]]]},
    {id:"ann",title:"Announcements",def:false,fields:[["notes","Announcements","area"]]},
    {id:"close",title:"Proceeding to close",core:true,fields:[["sw","The SW","area"],["jw","The JW","area"],["wm","The WM","area"],
      ["go","Grand Lodge officer present","sel",["","District Deputy Grand Master","Grand Lodge Officer"]],["goName","Name"],["goNotes","Remarks","area"]]},
    {id:"closing",title:"Closing and collections",core:true,fields:[["time","Closed at","time"],["dinner","Dinner $","money"],["wo","W & O $","money"]]}
  ];
  let minuteSections=Object.assign({},CFG.minuteSections||{});
  const secOn=sec=>sec.core||(minuteSections[sec.id]!==undefined?minuteSections[sec.id]:sec.def!==false);

  /* older minutes stored the template's free-text blanks in m.f */
  function migrate(x){
    if(x.s)return x;
    const f=x.f||{},s={};
    const t24=v=>{const r=/(\d{1,2}):(\d{2})/.exec(v||"");if(!r)return "";let h=+r[1];if(h<12)h+=12;return `${String(h).padStart(2,"0")}:${r[2]}`};
    const put=(k,v)=>{if(v&&v!=="N/A")s[k]=v};
    put("opening.time",t24(f.opened));put("attend.total",f.total);put("attend.visitors",f.visitors);put("attend.pms",f.pms);
    put("prev.notes",f.prev);put("corr.notes",f.corr);put("treas.notes",f.treas);put("old.notes",f.old);put("new.notes",f.nb);
    put("mw.notes",f.mw);put("edu.notes",f.edu);put("close.sw",f.sw);put("close.jw",f.jw);put("close.wm",f.wm);put("close.goNotes",f.ddgm);
    put("closing.time",t24(f.closed));put("closing.dinner",f.dinner);put("closing.wo",f.wo);
    if(f.ballot&&f.ballot!=="N/A")s["new.notes"]=[s["new.notes"],"Balloting: "+f.ballot].filter(Boolean).join("\n");
    if(f.sick&&f.sick!=="N/A")s["sick.items"]=[{name:f.sick,note:""}];
    const {f:_,...rest}=x;return {...rest,s};
  }
  const minutes=(CFG.minutes?CFG.minutes.map(x=>({...x,seats:{...officers,...(x.seats||{})}})):[
    {id:1,date:"2026-10-13",status:"Awaiting approval",seats:{...officers,STW2:13},s:{
      "opening.time":"19:31","attend.total":"34","attend.visitors":"3","attend.pms":"6",
      "attend.vlist":[{name:"Bro. Carl Mendez",lodge:"Millbrook Lodge No. 88"},{name:"WB Ray Ellis",lodge:"Millbrook Lodge No. 88"}],
      "prev.action":"read and approved",
      "corr.items":[{from:"Millbrook Food Pantry",about:"thanks for the summer food drive"}],
      "pet.items":[{name:"Mr. Aaron Fields",for:"the degrees",committee:"Bros. Hale, Carter and Tran"}],
      "treas.gen":"18412.07","treas.char":"6955.40","treas.action":"accepted as read",
      "old.notes":"The Fall Fish Fry raised $2,740 against a $2,500 goal. The Worshipful Master thanked Bro. Hale and the kitchen crew.",
      "new.motions":[{text:"purchase 200 centennial coins for the lodge store at a cost of $1,150",by:"2",second:"8",result:"carried"}],
      "edu.by":"10","edu.topic":"the history of the lodge's 1926 charter",
      "sick.items":[{name:"Bro. Robert Kline",note:"recovering at home after surgery; cards welcome"}],
      "close.sw":"Thanked the brethren for the Fish Fry turnout.","close.jw":"Dinner next month will be roast turkey.","close.wm":"Reminded all of the Pancake Breakfast on November 14.",
      "closing.time":"20:52","closing.dinner":"212","closing.wo":"75"}},
    {id:2,date:"2026-09-08",status:"Approved",seats:{...officers,TILER:12},s:{
      "opening.time":"19:30","attend.total":"29","attend.visitors":"1","attend.pms":"5","prev.action":"read and approved",
      "treas.gen":"17960.44","treas.action":"accepted as read",
      "new.notes":"Fish Fry committee appointed: Bros. Hale, Lindqvist and Carter.\nBikes for Books: 12 bicycles pledged for spring.",
      "close.wm":"Thanked the brethren for a good summer.","closing.time":"20:40","closing.dinner":"180","closing.wo":"60"}}
  ]).map(migrate);
  let current=minutes[0],minView="short",nextMin=Math.max(0,...minutes.map(m=>m.id))+1,showSections=false;
  const lodgeParts=()=>{
    const raw=$("#f-name").value.trim()||"Your Lodge";
    return {base:raw.replace(/\s+lodge$/i,""),num:$("#f-num").value.trim(),abbr:$("#f-jur").value.split(" ")[0],gl:$("#f-gl").value.trim()||"Grand Lodge"};
  };
  function statusPill(s){return `<span class="pill ${s==="Approved"?"ok":s==="Draft"?"":"warn"}">${s}</span>`}
  const longDate=d=>fmt(parse(d),{month:"long",day:"numeric",year:"numeric"});
  const timeLC=t=>time12(t).toLowerCase();
  const money2=v=>{const n=parseFloat(String(v).replace(/[$,]/g,""));return isNaN(n)?String(v):n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};
  const bro=id=>{const m=member(id);return m?(m.pm?"W Bro. ":"Bro. ")+m.name:""};
  const val=(m,k)=>{const v=m.s[k];return Array.isArray(v)?v.filter(r=>Object.values(r).some(x=>String(x||"").trim())):String(v||"").trim()};
  const list=(m,k)=>Array.isArray(m.s[k])?val(m,k):[];
  const listJoin=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];

  /* ---------- long form: a list of blocks both the preview and the PDF draw ----------
     p: {runs:[[text,style]], align, gap}; style "" | "b" | "u" | "bu" */
  function longForm(m){
    const B=[],L=lodgeParts(),P=(runs,o)=>B.push({t:"p",runs:typeof runs==="string"?[[runs,""]]:runs,...(o||{})});
    const H=(title,rest,o)=>P([[title,"bu"],[rest?": "+rest:":",""]],o);
    const deg=val(m,"opening.degree")||"third";
    const proTem=k=>m.seats[k]&&officers[k]&&+m.seats[k]!==+officers[k];
    B.push({t:"lh",L});
    P(longDate(m.date),{gap:24});
    P(`At a Stated Communication of ${L.base} Lodge No. ${L.num}${L.abbr?", "+L.abbr:""}, the following brethren filled the chairs:`);
    const rows=[["WM","SD"],["SW","JD"],["JW","STW1"],["TREAS","STW2"],["SEC","TILER"],[null,"CHAP"]]
      .map(r=>r.map(k=>k&&m.seats[k]?{name:fullName(m.seats[k])+(proTem(k)?" (pro tem)":""),ab:SEATS.find(x=>x.k===k).ab}:null))
      .filter(r=>r[0]||r[1]);
    if(rows.length)B.push({t:"seats",rows});
    const wm=member(m.seats.WM),t=val(m,"opening.time");
    P(`The Worshipful Master${wm?`, W Bro. ${wm.name}${proTem("WM")?" (pro tem)":""},`:""} opened the Lodge${t?` at ${timeLC(t)}`:""} in due form on the ${deg} degree of Masonry.`,{align:"justify"});
    const tot=val(m,"attend.total"),vis=val(m,"attend.visitors"),pms=val(m,"attend.pms"),vl=list(m,"attend.vlist");
    if(tot||vis||pms||vl.length){
      let s=vis||pms||vl.length?"The Worshipful Master welcomed visiting brothers and the Past Masters visiting and of the Lodge.":"";
      const inc=[vis&&`${vis} visitor${vis==="1"?"":"s"}`,pms&&`${pms} Past Master${pms==="1"?"":"s"}`].filter(Boolean);
      if(tot)s+=`${s?" ":""}There were ${tot} brothers present${inc.length?", including "+listJoin(inc):""}.`;
      else if(inc.length)s+=`${s?" ":""}Present were ${listJoin(inc)}.`;
      if(vl.length)s+=" Visiting brethren: "+vl.map(r=>[r.name,r.lodge&&`of ${r.lodge}`].filter(Boolean).join(" ")).join("; ")+".";
      P(s,{align:"justify"});
    }
    const pa=val(m,"prev.action"),pn=val(m,"prev.notes");
    if(pa||pn){const earlier=minutes.filter(x=>x.date<m.date).sort((a,b)=>a.date<b.date?1:-1)[0];
      P(pa?`The minutes of the previous Stated Communication${earlier?` of ${longDate(earlier.date)}`:""} were ${pa}.${pn?" "+pn:""}`:`The minutes of the previous communication – ${pn}`,{align:"justify"})}
    const on=id=>secOn(MS.find(x=>x.id===id));
    if(on("corr")){const it=list(m,"corr.items"),n=val(m,"corr.notes");
      if(it.length||n)P("Correspondence was read – "+[it.map(r=>[r.from&&`from ${r.from}`,r.about&&`regarding ${r.about}`].filter(Boolean).join(" ")).join("; ")+(it.length?".":""),n].filter(Boolean).join(" "),{align:"justify"})}
    if(on("pet")){const it=list(m,"pet.items");
      if(it.length)H("Petitions",it.map(r=>`A petition for ${r.for||"the degrees"} was received from ${r.name||"a petitioner"}${r.committee?` and referred to an investigating committee of ${r.committee}`:""}.`).join(" "))}
    if(on("ballot")){const it=list(m,"ballot.items");
      if(it.length)H("Balloting",it.map(r=>`A ballot was taken on the petition of ${r.name||"the candidate"} for ${r.for||"the degrees"}, and he was declared ${r.result||"elected"}.`).join(" "))}
    if(on("treas")){const funds=[["gen","General Fund"],["char","Charity Fund"],["wo","Widows & Orphans Fund"]].filter(([k])=>val(m,"treas."+k)).map(([k,n])=>`${n} $${money2(val(m,"treas."+k))}`);
      const a=val(m,"treas.action"),n=val(m,"treas.notes");
      if(funds.length||a||n)H("The Treasurer’s Report",[funds.length&&funds.join("; ")+".",a&&`The report was ${a}.`,n].filter(Boolean).join(" "))}
    if(on("bills")){const it=list(m,"bills.items"),a=val(m,"bills.action");
      if(it.length||a)H("Bills",[it.map(r=>`${r.payee||"____"}${r.amt?` $${money2(r.amt)}`:""}`).join("; ")+(it.length?".":""),a&&`The bills were ${a}.`].filter(Boolean).join(" "))}
    const business=(id,title)=>{if(!on(id))return;const mo=Array.isArray(m.s[id+".motions"])?val(m,id+".motions"):[],n=val(m,id+".notes");if(!mo.length&&!n)return;
      const sent=mo.map(r=>{const by=bro(r.by),se=bro(r.second);
        return `${by?`Motion by ${by}`:"A motion was made"}${se?`, seconded by ${se},`:""} to ${r.text||"____"}. Motion ${r.result||"carried"}.`});
      H(title,[...sent,n].filter(Boolean).join(" "))};
    business("old","Old Business");business("new","New Business");
    if(on("degree")){const d=val(m,"degree.deg"),c=val(m,"degree.cands"),by=val(m,"degree.by");
      if(d||c)H("Degree Work",`The ${d||"____"} degree was conferred upon ${c||"____"}${by?`, ${by} presiding`:""}.`)}
    if(on("mw")){const n=val(m,"mw.notes");if(n)P(`Masters & Wardens – ${n}`,{gap:18})}
    if(on("edu")){const by=bro(val(m,"edu.by")),tp=val(m,"edu.topic"),n=val(m,"edu.notes");
      if(by||tp||n)H("Masonic Education",[(by||tp)&&`${by||"A brother"} presented ${tp?`on ${tp}`:"Masonic Education"}.`,n].filter(Boolean).join(" "))}
    if(on("sick")){const it=list(m,"sick.items");if(it.length)H("Sick & Distressed",it.map(r=>[r.name,r.note].filter(Boolean).join(", ")).join("; ")+".")}
    if(on("ann")){const n=val(m,"ann.notes");if(n)H("Announcements",n)}
    const cl=[["sw","The SW"],["jw","The JW"],["wm","The WM"]].filter(([k])=>val(m,"close."+k));
    const go=val(m,"close.go"),gn=val(m,"close.goName"),gr=val(m,"close.goNotes");
    if(cl.length||go||gn||gr){
      P("Proceeding to close:",{gap:18});
      cl.forEach(([k,lab])=>P(`${lab} – ${val(m,"close."+k)}`,{gap:10,align:"justify"}));
      if(go||gn||gr)P(`${go||"Grand Lodge Officer"}${gn?`, ${gn}`:""}${gr?` – ${gr}`:""}`,{gap:10,align:"justify"});
    }
    const ct=val(m,"closing.time");
    P(`There being no further business, the Lodge was closed in due form${ct?` at ${timeLC(ct)}`:""} on the ${deg} degree of Masonry.`,{gap:18,align:"justify"});
    const coll=[["dinner","Dinner"],["wo","W & O"]].filter(([k])=>val(m,"closing."+k)).map(([k,n])=>`${n}: $${money2(val(m,"closing."+k))}`);
    B.push({t:"sig",sec:fullName(m.seats.SEC),wm:wm?(wm.pm?"WB ":"")+wm.name:"",coll,approved:m.status==="Approved"});
    return B;
  }

  /* preview of the long form on screen */
  function longHTML(m){
    const runHTML=r=>r.map(([t,st])=>st?`<span class="${st.includes("b")?"b ":""}${st.includes("u")?"u":""}">${esc(t)}</span>`:esc(t)).join("").replace(/\n/g,"<br>");
    return longForm(m).map(b=>{
      if(b.t==="lh")return `<div class="lh"><div class="lh-name">${esc(b.L.base)} <span class="scap">Lodge No.</span> ${esc(b.L.num)}</div><div class="lh-rule" aria-hidden="true"><i></i>★<i></i></div><div class="lh-gl">${esc(b.L.gl)}</div></div>`;
      if(b.t==="seats")return `<table class="seats"><tbody>${b.rows.map(r=>`<tr>${r.map(c=>c?`<td>${esc(c.name)}</td><td class="ab">${c.ab}</td>`:"<td></td><td></td>").join("")}</tr>`).join("")}</tbody></table>`;
      if(b.t==="sig")return `<div class="sig2"><div class="attest">${b.wm?`<p>Attest:</p><p class="line"></p><p>${esc(b.wm)}, Worshipful Master</p>`:""}</div>
        <div class="right"><p>Fraternally Submitted,</p><p class="line"></p><p>${b.sec?esc(b.sec)+", ":""}Secretary</p>${b.coll.map(c=>`<p>${esc(c)}</p>`).join("")}</div></div>`;
      return `<p class="${b.align==="justify"?"just":""}" style="${b.gap?`margin-top:${b.gap}px`:""}">${runHTML(b.runs)}</p>`;
    }).join("");
  }

  /* ---------- PDF: the same blocks, laid out on US Letter in Times ---------- */
  function loadPdfLib(){
    if(window.jspdf)return Promise.resolve();
    return new Promise((ok,fail)=>{const s=document.createElement("script");s.src="/assets/vendor/jspdf.umd.min.js";s.onload=ok;s.onerror=()=>fail(new Error("PDF library did not load"));document.head.appendChild(s)});
  }
  function buildPdf(m){
    const doc=new window.jspdf.jsPDF({unit:"pt",format:"letter"});
    const PW=612,PH=792,ML=72,MR=72,MT=72,MB=72,W=PW-ML-MR;let y=MT;
    const font=(st,size)=>{doc.setFont("times",st&&st.includes("b")?"bold":"normal");doc.setFontSize(size)};
    const room=h=>{if(y+h>PH-MB){doc.addPage();y=MT}};
    /* small caps: capitals at full size, the rest as smaller capitals */
    const scSegs=(text,big,small)=>{const out=[];for(const ch of text){const up=ch.toUpperCase();const isCap=ch===up&&/[A-Z0-9&.]/.test(ch);out.push([isCap?ch:up,isCap?big:small])}return out};
    const segWidth=segs=>segs.reduce((w,[c,sz])=>{font("",sz);return w+doc.getTextWidth(c)},0);
    const drawSegs=(segs,x,base)=>{for(const [c,sz] of segs){font("",sz);doc.text(c,x,base);x+=doc.getTextWidth(c)}};
    const blocks=longForm(m);
    for(const b of blocks){
      if(b.t==="lh"){
        const head=[...[...(b.L.base+" ")].map(c=>[c,26]),...scSegs("Lodge No.",26,20),...[...(" "+b.L.num)].map(c=>[c,26])];
        let w=segWidth(head);drawSegs(head,(PW-w)/2,y+20);y+=34;
        const cx=PW/2;doc.setLineWidth(1);doc.line(cx-170,y,cx-14,y);doc.line(cx+14,y,cx+170,y);
        const R=7,r=2.9,pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r:R;pts.push([cx+rad*Math.cos(a),y-1+rad*Math.sin(a)])}
        doc.setFillColor(0,0,0);doc.lines(pts.slice(1).map((p,i)=>[p[0]-pts[i][0],p[1]-pts[i][1]]),pts[0][0],pts[0][1],[1,1],"F",true);
        y+=20;const gl=scSegs(b.L.gl,14,11);w=segWidth(gl);drawSegs(gl,(PW-w)/2,y);y+=30;continue;
      }
      if(b.t==="seats"){
        const cw=[192,44,188,44],rh=17;room(rh*b.rows.length+10);doc.setLineWidth(.6);
        for(const r of b.rows){let x=ML;
          [r[0]&&r[0].name,r[0]&&r[0].ab,r[1]&&r[1].name,r[1]&&r[1].ab].forEach((t,i)=>{doc.rect(x,y,cw[i],rh);if(t){font("",11.5);doc.text(String(t),x+4,y+12.5)}x+=cw[i]});
          y+=rh}
        y+=14;continue;
      }
      if(b.t==="sig"){
        room(120);y+=16;const right=PW-MR,colX=PW/2+20;font("",12);
        doc.text("Fraternally Submitted,",right,y,{align:"right"});
        if(b.wm)doc.text("Attest:",ML,y);
        y+=34;doc.setLineWidth(.6);doc.line(colX+40,y,right,y);if(b.wm)doc.line(ML,y,ML+200,y);y+=14;
        doc.text(`${b.sec?b.sec+", ":""}Secretary`,right,y,{align:"right"});if(b.wm)doc.text(`${b.wm}, Worshipful Master`,ML,y);
        y+=22;for(const c of b.coll){doc.text(c,right,y,{align:"right"});y+=15}
        continue;
      }
      /* paragraph: lay out word by word so bold and underlined headings sit inline */
      /* a run that doesn't start with a space (": " after a heading) sticks to the word before it */
      const words=[];b.runs.forEach(([t,st],ri)=>String(t).split(/(\n| )/).forEach((w,wi)=>{if(w===" "||w==="")return;words.push({w,st,glue:ri>0&&wi===0})}));
      const lh=15,size=12;y+=b.gap!==undefined?b.gap-6:4;
      let line=[],lw=0;font("",size);const sp=doc.getTextWidth(" ");
      const flush=last=>{room(lh);let x=ML;const gaps=line.filter((o,i)=>i&&!o.glue).length;
        const extra=b.align==="justify"&&!last&&gaps>0?(W-lw)/gaps:0;
        line.forEach((o,i)=>{font(o.st,size);doc.text(o.w,x,y+11);const ww=doc.getTextWidth(o.w);
          const next=line[i+1],gap=next&&next.glue?0:sp+extra;
          if(o.st.includes("u")){const ul=ww+(next&&next.st.includes("u")?gap:0);doc.setLineWidth(.6);doc.line(x,y+12.6,x+ul,y+12.6)}
          x+=ww+gap});
        y+=lh;line=[];lw=0};
      for(const o of words){
        if(o.w==="\n"){flush(true);continue}
        font(o.st,size);const ww=doc.getTextWidth(o.w);
        if(line.length&&lw+sp+ww>W)flush(false);
        lw+=(line.length&&!o.glue?sp:0)+ww;line.push(o);
      }
      if(line.length)flush(true);
    }
    const n=doc.getNumberOfPages();
    for(let i=1;i<=n;i++){doc.setPage(i);font("",9);doc.text(`Page ${i} of ${n}`,PW/2,PH-36,{align:"center"})}
    return doc;
  }
  async function downloadPdf(){
    const btn=$('[data-act="pdf"]');if(btn){btn.disabled=true;btn.textContent="Making PDF…"}
    try{await loadPdfLib();const L=lodgeParts();
      buildPdf(current).save(`${(L.base+" Lodge "+L.num).trim().replace(/[^A-Za-z0-9]+/g,"-")}-Minutes-${current.date}.pdf`);
    }catch(e){alert("The PDF couldn't be made: "+e.message)}
    finally{renderMinutes()}
  }

  /* ---------- short form ---------- */
  function memberOptions(cur){
    const opts=members.filter(x=>x.active).sort((a,b)=>a.name.split(" ").pop().localeCompare(b.name.split(" ").pop()));
    return `<option value=""></option>`+opts.map(x=>`<option value="${x.id}"${+cur===x.id?" selected":""}>${esc((x.pm?"WB ":"")+x.name)}</option>`).join("");
  }
  function input(type,k,v,label,opts,attrs){
    const a=`aria-label="${esc(label)}" ${attrs||""}`;
    if(type==="sel")return `<select ${a}>${opts.map(o=>`<option value="${esc(o)}"${o===(v||"")||(!v&&o===opts[0])?" selected":""}>${esc(o||"Choose")}</option>`).join("")}</select>`;
    if(type==="member")return `<select ${a}>${memberOptions(v)}</select>`;
    if(type==="area")return `<textarea rows="2" ${a}>${esc(v||"")}</textarea>`;
    if(type==="time")return `<input type="time" value="${esc(v||"")}" ${a}>`;
    if(type==="num")return `<input type="number" min="0" inputmode="numeric" value="${esc(v||"")}" ${a}>`;
    if(type==="money")return `<input inputmode="decimal" value="${esc(v||"")}" placeholder="0.00" ${a}>`;
    return `<input value="${esc(v||"")}" ${a}>`;
  }
  function shortForm(m,locked){
    const dis=locked?"disabled":"";
    const seatRows=SEATS.map(x=>`<label class="sf-seat"><span title="${x.t}">${x.ab}</span>${seatSelect("data-seat",x,m.seats[x.k]).replace("<select ",`<select ${dis} `)}</label>`).join("");
    let h=`<fieldset class="sf-sec"><legend>Meeting</legend><div class="sf-grid">
      <label class="sf-f"><span>Date of the Stated Communication</span><input type="date" data-date value="${m.date}" ${dis}></label></div>
      <p class="hint" style="margin-top:10px">Officers in the chairs. Anyone filling in for the regular officer is marked "pro tem".</p>
      <div class="sf-seats">${seatRows}</div></fieldset>`;
    for(const sec of MS){
      if(!secOn(sec))continue;
      h+=`<fieldset class="sf-sec"><legend>${esc(sec.title)}</legend><div class="sf-grid">`;
      for(const [f,label,type,opts,suffix] of sec.fields){
        const k=`${sec.id}.${f}`,v=m.s[k];
        if(type==="list"||type==="motions"){
          const sub=type==="motions"?[["text","Motion to…"],["by","Moved by","member"],["second","Seconded by","member"],["result","Result","sel",RESULT]]:opts;
          const rows=Array.isArray(v)?v:[];
          h+=`<div class="sf-f sf-wide"><span>${esc(label)}</span><div class="sf-list">${rows.map((r,i)=>`<div class="sf-row">${sub.map(([sk,sl,st,so])=>`<label class="sf-cell"><span>${esc(sl)}</span>${input(st||"text",k,r[sk],sl,so,`data-list="${k}" data-row="${i}" data-sub="${sk}" ${dis}`)}</label>`).join("")}${locked?"":`<button type="button" class="btn line sm sf-del" data-del="${k}" data-row="${i}" aria-label="Remove">✕</button>`}</div>`).join("")}
            ${locked?"":`<button type="button" class="btn line sm" data-add="${k}">+ Add ${type==="motions"?"motion":esc(label.toLowerCase().replace(/s$/,""))}</button>`}</div></div>`;
          continue;
        }
        h+=`<label class="sf-f${type==="area"?" sf-wide":""}"><span>${esc(label)}${suffix?` <em>${esc(suffix)}</em>`:""}</span>${input(type||"text",k,v,label,opts,`data-k="${k}" ${dis}`)}</label>`;
      }
      h+=`</div></fieldset>`;
    }
    return h;
  }
  function sectionsPanel(){
    return `<div class="card sf-sections"><h4>Sections in your minutes</h4><p class="hint">Turn on the parts your lodge uses. Opening, attendance, previous minutes and closing are always included.</p>
      <div class="sf-toggles">${MS.filter(s=>!s.core).map(s=>`<label><input type="checkbox" data-sec="${s.id}"${secOn(s)?" checked":""}> ${esc(s.title)}</label>`).join("")}</div></div>`;
  }

  function renderMinutes(){
    if(!current){
      $("#min-list").innerHTML='<p class="hint">No minutes yet.</p>';
      $("#min-toolbar").innerHTML="";
      $("#min-doc").innerHTML='<p style="text-align:center;margin:2in 0">Click "New minutes" to start the minutes for your next Stated Communication.</p>';
      return;
    }
    const m=current,locked=m.status==="Approved";
    if(locked)minView="long";
    $("#min-list").innerHTML=minutes.map(x=>`<button type="button" class="min-item" data-id="${x.id}" aria-current="${x===current}">
      <b>Stated Communication</b><span>${longDate(x.date)}</span>${statusPill(x.status)}</button>`).join("");
    const seg=`<span class="seg" role="group" aria-label="View"><button type="button" data-view="short" aria-pressed="${minView==="short"}"${locked?" disabled":""}>Short form</button><button type="button" data-view="long" aria-pressed="${minView==="long"}">Full write-up</button></span>`;
    const acts=[`<button class="btn sm" type="button" data-act="pdf">Save as PDF</button>`];
    if(!locked){acts.unshift(`<button class="btn line sm" type="button" data-act="sections" aria-expanded="${showSections}">Sections</button>`);
      if(m.status==="Draft")acts.push('<button class="btn line sm" type="button" data-act="submit">Send for approval</button>');
      acts.push('<button class="btn line sm" type="button" data-act="approve">Mark approved</button>')}
    $("#min-toolbar").innerHTML=`<span class="min-state">${statusPill(m.status)}${locked?' <span class="hint">Approved. Locked.</span>':""}</span>${seg}<span class="acts">${acts.join("")}</span>`;
    const wrap=$("#min-doc");
    if(minView==="short"){wrap.className="sf";wrap.innerHTML=(showSections?sectionsPanel():"")+shortForm(m,locked)}
    else{wrap.className="paper";wrap.innerHTML=longHTML(m)}
  }
  $("#min-list").addEventListener("click",e=>{const b=e.target.closest(".min-item");if(!b)return;current=minutes.find(m=>m.id==b.dataset.id);minView=current.status==="Approved"?"long":"short";renderMinutes()});
  $("#min-toolbar").addEventListener("click",e=>{
    const v=e.target.closest("[data-view]");if(v&&!v.disabled){minView=v.dataset.view;renderMinutes();return}
    const a=e.target.closest("[data-act]");if(!a)return;const act=a.dataset.act;
    if(act==="pdf"){downloadPdf();return}
    if(act==="sections"){showSections=!showSections;minView="short"}
    if(act==="submit")current.status="Awaiting approval";
    if(act==="approve"){current.status="Approved";minView="long"}
    renderMinutes();
  });
  const doc$=$("#min-doc");
  doc$.addEventListener("input",e=>{const t=e.target;
    if(t.dataset.k)current.s[t.dataset.k]=t.value;
    if(t.dataset.list){const rows=current.s[t.dataset.list];if(rows&&rows[+t.dataset.row])rows[+t.dataset.row][t.dataset.sub]=t.value}
  });
  doc$.addEventListener("change",e=>{const t=e.target;
    if(t.dataset.seat){current.seats[t.dataset.seat]=t.value}
    if(t.hasAttribute("data-date")&&t.value){current.date=t.value;renderMinutes()}
    if(t.dataset.sec){minuteSections[t.dataset.sec]=t.checked;renderMinutes()}
    if(t.dataset.k&&t.tagName==="SELECT")current.s[t.dataset.k]=t.value;
    if(t.dataset.list&&t.tagName==="SELECT"){const rows=current.s[t.dataset.list];if(rows&&rows[+t.dataset.row])rows[+t.dataset.row][t.dataset.sub]=t.value}
  });
  doc$.addEventListener("click",e=>{
    const add=e.target.closest("[data-add]"),del=e.target.closest("[data-del]");
    if(add){const k=add.dataset.add;(current.s[k]=Array.isArray(current.s[k])?current.s[k]:[]).push({});renderMinutes();
      const last=doc$.querySelector(`[data-add="${k}"]`).closest(".sf-list").querySelector(".sf-row:last-of-type [data-list]");if(last)last.focus()}
    if(del){current.s[del.dataset.del].splice(+del.dataset.row,1);renderMinutes()}
  });
  $("#min-new").addEventListener("click",()=>{
    const m={id:nextMin++,date:nextStated||"2026-11-10",status:"Draft",seats:{...officers},s:{"prev.action":"read and approved"}};
    minutes.unshift(m);current=m;minView="short";renderMinutes();
  });


  /* ---------- plan (new lodges from /start) ---------- */
  const PLANS={starter:{name:"Lodge Starter",price:"$0 / month"},lodge:{name:"Lodge",price:"$19 / month"},district:{name:"District / Grand Lodge",price:"custom pricing"}};
  let plan=CLOUD?CFG.plan:CFG.plan!==undefined?(new URLSearchParams(location.search).get("plan")||CFG.plan):"";
  if(plan&&!PLANS[plan])plan="lodge";
  if(plan){
    const P=PLANS[plan];
    const pl=$("#plan-line");if(pl)pl.innerHTML=`${P.name} plan · ${P.price} · ${CLOUD?'<a href="/login">Plan &amp; billing</a>':'<a href="/pricing">Change plan</a>'}`;
    const eb=$("#plan-eyebrow");if(eb)eb.textContent=`Step 2 · Set up your lodge · ${P.name} plan`;
    if(plan==="starter"){
      $("#p-store .store-wrap").hidden=true;
      $("#p-store").insertAdjacentHTML("afterbegin",'<div class="card" style="max-width:560px"><h4>The store comes with the Lodge plan</h4><p class="hint">Lodge Starter includes your website, calendar, members and minutes. Move to the Lodge plan ($19 / month) to sell shirts, pins and coins and take donations through PayPal, Venmo or Cash App.</p><a class="btn sm" href="'+(CLOUD?"/login":"/pricing")+'" style="justify-self:start">'+(CLOUD?"Upgrade this lodge":"See plans")+'</a></div>');
    }
  }

  /* ---------- saving ---------- */
  function snapshot(){
    const form={};document.querySelectorAll("#site-form input[id],#site-form select[id]").forEach(el=>form[el.id]=el.value);
    return {app:"LodgeNet",version:1,page:STORE_KEY,savedAt:new Date().toISOString(),form,color:siteColor,
      membersFull:members,officers,events,minutes,minuteSections,gmail,nextStated,...(plan?{plan}:{})};
  }
  const stamp=d=>new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  function setState(t){const el=$("#save-state");if(el)el.textContent=t}
  let saveTimer=null;
  const VIEW_ONLY="View only. Your membership can read this lodge; officers make the changes, so edits here aren't saved.";
  async function save(){
    const snap=snapshot();
    if(CLOUD){
      if(!CLOUD.canEdit)return setState(VIEW_ONLY);
      setState("Saving to the lodge account…");
      try{const at=await CLOUD.save(snap);setState("Saved to the lodge account · "+stamp(at||snap.savedAt));return true}
      catch(e){setState("Couldn't save to the lodge account ("+e.message+"). Your changes are still on screen; keep editing to retry, or Export a copy.");return false}
    }
    try{localStorage.setItem(STORE_KEY,JSON.stringify(snap));setState("Saved in this browser · "+stamp(snap.savedAt))}
    catch(e){setState("Couldn't save in this browser. Use Export to keep a copy.")}
  }
  const queueSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(save,400)};
  ["input","change"].forEach(t=>$(".console").addEventListener(t,queueSave));
  $(".console").addEventListener("click",e=>{if(e.target.closest("button"))queueSave()});
  if(CLOUD)setState(!CLOUD.canEdit?VIEW_ONLY:CLOUD.data?"Saved to the lodge account · "+stamp(CLOUD.updatedAt):"Signed in as "+CLOUD.email+". Changes save to the lodge account automatically.");
  else setState(SAVED?"Saved in this browser · "+stamp(SAVED.savedAt):"Not saved yet. Changes save automatically.");
  $("#data-export").addEventListener("click",()=>{
    const snap=snapshot(),slug=STORE_KEY.split("/").pop()||"lodge";
    const url=URL.createObjectURL(new Blob([JSON.stringify(snap,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=`${slug}-lodgenet-${snap.savedAt.slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("#data-import").addEventListener("click",()=>$("#data-file").click());
  $("#data-file").addEventListener("change",async e=>{
    const f=e.target.files[0];if(!f)return;
    try{const d=JSON.parse(await f.text());
      if(d.app!=="LodgeNet"||!d.form||!Array.isArray(d.membersFull))throw new Error("not a LodgeNet export");
      if(CLOUD){if(!CLOUD.canEdit)return setState(VIEW_ONLY);await CLOUD.save(d)}
      else localStorage.setItem(STORE_KEY,JSON.stringify(d));
      location.reload();
    }catch(err){setState(err instanceof SyntaxError||err.message==="not a LodgeNet export"?"That file isn't a LodgeNet export, so nothing was changed.":"Couldn't save the import to the lodge account ("+err.message+").")}
    e.target.value="";
  });
  $("#data-reset").addEventListener("click",()=>{
    if(CLOUD){
      if(!CLOUD.canEdit)return setState(VIEW_ONLY);
      if(!confirm("Discard everything saved in the lodge account and go back to the starting data? This changes it for every brother who signs in."))return;
      clearTimeout(saveTimer);
      CLOUD.save(null).then(()=>{try{localStorage.removeItem(STORE_KEY)}catch(e){}location.reload()},e=>setState("Couldn't start over ("+e.message+")."));
      return;
    }
    if(!confirm("Discard everything saved in this browser for this lodge and start over?"))return;
    clearTimeout(saveTimer);try{localStorage.removeItem(STORE_KEY)}catch(e){}
    location.reload();
  });

  renderMembers();renderGmail();regenStated();
  renderCal();renderCart();renderMinutes();
  if(MOVE_LOCAL)save().then(ok=>{if(ok)try{localStorage.removeItem(STORE_KEY)}catch(e){}});
})();

/* open a tab from the address, e.g. /demo#store */
(function(){
  const map={site:"t-site",store:"t-store",calendar:"t-cal",members:"t-mem",minutes:"t-min"};
  function go(){const id=map[location.hash.slice(1)];if(id)document.getElementById(id).click()}
  go();window.addEventListener("hashchange",go);
})();
