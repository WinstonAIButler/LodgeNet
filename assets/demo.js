(function(){
  const $=s=>document.querySelector(s);
  const money=n=>"$"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
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
  let events=[
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

  /* ---------- website builder ---------- */
  let siteColor="#1c3a75";
  function renderSite(){
    const name=$("#f-name").value.trim()||"Your Lodge", num=$("#f-num").value.trim(), jur=$("#f-jur").value;
    const full=name+(num?" No. "+num:"");
    $("#pv-title").textContent=full+", "+jur;
    $("#pv-sub").textContent=[$("#f-town").value.trim(),"Stated Communications "+$("#f-sched").value.trim()].filter(Boolean).join(" · ");
    $("#pv-url").textContent=(name.toLowerCase().replace(/lodge/g,"").replace(/[^a-z0-9]/g,"")+num)+".lodgenet.org";
    $("#cb-name").textContent=full;
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
  ["#f-name","#f-num","#f-jur","#f-town","#f-sched","#f-email","#f-fb","#f-ig","#f-x","#f-yt","#f-tt","#f-pp","#f-venmo","#f-cash"].forEach(s=>$(s).addEventListener("input",()=>{renderSite();$("#site-status").textContent="Draft · unpublished changes"}));
  $("#swatches").addEventListener("click",e=>{const b=e.target.closest(".swatch");if(!b)return;siteColor=b.dataset.c;document.querySelectorAll(".swatch").forEach(s=>s.setAttribute("aria-pressed",s===b));renderSite();$("#site-status").textContent="Draft · unpublished changes"});
  let gmail=false;
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
  $("#site-form").addEventListener("submit",e=>{e.preventDefault();$("#site-status").innerHTML='<span class="pill ok">Published</span> Live at '+esc($("#pv-url").textContent)+" (demo)"});

  /* ---------- store ---------- */
  const products=[
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
    else if(kind==="coin"){x.fillStyle=gold;x.beginPath();x.arc(cx,cy,s*.28,0,7);x.fill();x.fillStyle=navy;x.beginPath();x.arc(cx,cy,s*.22,0,7);x.fill();sc(cx,cy-s*.02,s*.2);x.fillStyle=gold;x.font=`600 ${s*.05}px ${cs.getPropertyValue("--mono")}`;x.textAlign="center";x.fillText("100 YEARS",cx,cy+s*.17)}
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
  let selected=events.find(e=>e.d==="2026-11-14");
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

  /* ---------- minutes ---------- */
  const minutes=[
    {id:1,title:"Stated Communication",date:"2026-10-13",status:"Awaiting approval",body:
`Cedar Hollow Lodge No. 214 was opened on the Third Degree at 7:31 PM,
Worshipful Brother Daniel R. Ortega presiding.

Officers present: all stations filled.
Members present: 34.   Visitors: 3 (from Millbrook Lodge No. 88).

1. Minutes of the September Stated Communication were read and approved.
2. Treasurer's report: General Fund $18,412.07; Charity Fund $6,955.40.
3. Petitions: two petitions for the degrees received and referred
   to investigation committees.
4. Fall Fish Fry: raised $2,740 against a $2,500 goal. Thanks
   extended to Bro. Hale and the kitchen crew.
5. Motion to purchase 200 centennial coins for the lodge store
   ($1,150). Seconded. Carried.

There being no further business, the lodge was closed in due form
at 8:52 PM.

James Whitfield, PM, Secretary`},
    {id:2,title:"Stated Communication",date:"2026-09-08",status:"Approved",body:
`Cedar Hollow Lodge No. 214 was opened on the Third Degree at 7:30 PM,
Worshipful Brother Daniel R. Ortega presiding.

Members present: 29.   Visitors: 1.

1. Minutes of the August Stated Communication were read and approved.
2. Treasurer's report accepted as read.
3. Fish Fry committee appointed: Bros. Hale, Lindqvist, Carter.
4. Bikes for Books: 12 bicycles pledged for spring.

The lodge was closed in due form at 8:40 PM.

James Whitfield, PM, Secretary`},
    {id:3,title:"Special Communication: Entered Apprentice Degree",date:"2026-08-20",status:"Approved",body:
`A Special Communication of Cedar Hollow Lodge No. 214 was opened
on the Third Degree at 7:00 PM for the purpose of conferring the
Entered Apprentice Degree.

The Degree was conferred upon Mr. Thomas Reyes in ample form.

The lodge was closed in due form at 9:05 PM.

James Whitfield, PM, Secretary`}
  ];
  let current=minutes[0],editing=false,nextId=4;
  const TEMPLATE=d=>`Cedar Hollow Lodge No. 214 was opened on the Third Degree at __:__ PM,
Worshipful Brother __________ presiding.

Officers present:
Members present: __   Visitors: __

1. Minutes of the previous Stated Communication were read and
2. Treasurer's report:
3. Bills and communications:
4. Petitions:
5. Committee reports:
6. New business:

There being no further business, the lodge was closed in due form
at __:__ PM.

__________, Secretary`;
  function statusPill(s){return `<span class="pill ${s==="Approved"?"ok":s==="Draft"?"":"warn"}">${s}</span>`}
  function renderMinutes(){
    $("#min-list").innerHTML=minutes.map(m=>`<button type="button" class="min-item" data-id="${m.id}" aria-current="${m===current}">
      <b>${esc(m.title)}</b><span>${fmt(parse(m.date),{month:"long",day:"numeric",year:"numeric"})}</span>${statusPill(m.status)}</button>`).join("");
    const m=current;
    const head=`<div class="doc-head"><span class="eyebrow">Minutes · ${m.status==="Approved"?"members only":"officers only until approved"}</span>
      <h3>${esc(m.title)}</h3><p>${fmt(parse(m.date),{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p></div>`;
    const body=editing?`<div class="field"><label for="min-edit">Edit minutes</label><textarea id="min-edit" rows="18">${esc(m.body)}</textarea></div>`:`<pre>${esc(m.body)}</pre>`;
    let actions="";
    if(editing) actions=`<span class="hint">Editing a draft</span><span style="display:flex;gap:8px"><button class="btn line sm" type="button" data-act="cancel">Cancel</button><button class="btn sm" type="button" data-act="save">Save draft</button></span>`;
    else if(m.status==="Approved") actions=`${statusPill(m.status)}<span class="hint">Approved at the following Stated Communication. Locked.</span>`;
    else actions=`${statusPill(m.status)}<span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" type="button" data-act="edit">Edit</button>${m.status==="Draft"?'<button class="btn line sm" type="button" data-act="submit">Send for approval</button>':""}<button class="btn sm" type="button" data-act="approve">Mark approved</button></span>`;
    $("#min-doc").innerHTML=head+body+`<div class="doc-actions">${actions}</div>`;
  }
  $("#min-list").addEventListener("click",e=>{const b=e.target.closest(".min-item");if(!b)return;current=minutes.find(m=>m.id==b.dataset.id);editing=false;renderMinutes()});
  $("#min-doc").addEventListener("click",e=>{
    const a=e.target.closest("[data-act]");if(!a)return;const act=a.dataset.act;
    if(act==="edit")editing=true;
    if(act==="cancel")editing=false;
    if(act==="save"){current.body=$("#min-edit").value;editing=false}
    if(act==="submit")current.status="Awaiting approval";
    if(act==="approve")current.status="Approved";
    renderMinutes();
  });
  $("#min-new").addEventListener("click",()=>{
    const m={id:nextId++,title:"Stated Communication",date:"2026-11-10",status:"Draft",body:TEMPLATE()};
    minutes.unshift(m);current=m;editing=true;renderMinutes();
  });

  renderCal();renderCart();renderMinutes();
})();

/* open a tab from the address, e.g. /demo#store */
(function(){
  const map={site:"t-site",store:"t-store",calendar:"t-cal",minutes:"t-min"};
  function go(){const id=map[location.hash.slice(1)];if(id)document.getElementById(id).click()}
  go();window.addEventListener("hashchange",go);
})();
