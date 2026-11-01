/* The signed-in lodge dashboard (lodge.html): a sidebar of ten sections with key figures on top of each.
   Website, Members, Merchandise and the Calendar and Minutes under Communications are the tools in assets/demo.js; this file adds
   Announcements, Treasury, Fundraiser, Pipelines, Sponsors, Charities and Settings. Their records save with the rest of the lodge's
   data (demo.js snapshot() asks LodgeNetDash for them), so every officer sees the same figures. */
(function(){
  const A=window.LodgeNetApp;if(!A)return;
  const $=s=>document.querySelector(s),esc=A.esc,CFG=A.CFG,CLOUD=A.CLOUD;
  const money=n=>(n<0?"−":"")+A.money(Math.abs(+n||0)).replace(/\.00$/,"");
  const many=(n,one,more)=>n+" "+(n===1?one:more||one+"s");
  const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const NOW=new Date(),TODAY=iso(NOW),YEAR=NOW.getFullYear();
  const day=s=>s?A.fmt(A.parse(s),{month:"short",day:"numeric",year:"numeric"}):"";
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const opts=(list,cur)=>list.map(v=>`<option${v===cur?" selected":""}>${esc(v)}</option>`).join("");

  /* ---------- the lodge's records ---------- */
  const D={
    treasury:Object.assign({dues:0,ledger:[]},CFG.treasury||{}),
    sponsors:CFG.sponsors||[],
    pipeline:CFG.pipeline||[],
    announcements:CFG.announcements||[],
    charities:CFG.charities||[
      {id:"c1",name:"Lodge Charity Fund",kind:"Lodge fund",note:"General relief and benevolence."},
      {id:"c2",name:"Widows & Orphans Fund",kind:"Lodge fund",note:"Help for the families of departed brethren."},
      {id:"c3",name:"Lodge Building Fund",kind:"Lodge fund",note:"Upkeep of the lodge hall."}]
  };
  window.LodgeNetDash={snapshot:()=>({treasury:D.treasury,sponsors:D.sponsors,pipeline:D.pipeline,bsearch:D.bsearch,plists:D.plists,ptasks:D.ptasks,announcements:D.announcements,charities:D.charities})};
  const changed=()=>{A.save();kpis(cur)};
  const funds=()=>["General Fund",...D.charities.map(c=>c.name)];
  const fundraisers=()=>A.events.filter(e=>e.k==="fund").sort((a,b)=>a.d<b.d?1:-1);
  const active=()=>A.members.filter(m=>m.active);
  const ledgerSum=f=>D.treasury.ledger.filter(f||(()=>true)).reduce((t,x)=>t+(x.kind==="out"?-1:1)*(+x.amt||0),0);

  /* ---------- sections ---------- */
  const TITLES={website:"Website",members:"Members",communications:"Communications",treasury:"Treasury",fundraiser:"Fundraiser",
    pipelines:"Pipelines",sponsors:"Sponsors",merchandise:"Merchandise",charities:"Charities",settings:"Settings"};
  const OLD={site:"website",store:"merchandise",calendar:"communications",minutes:"communications"};
  let cur="website";
  function show(sec){
    sec=OLD[sec]||sec;if(!TITLES[sec])sec="website";cur=sec;
    document.querySelectorAll(".sec").forEach(s=>s.hidden=s.dataset.sec!==sec);
    document.querySelectorAll(".nav-i").forEach(a=>a.toggleAttribute("aria-current",a.dataset.sec===sec));
    $("#sec-title").textContent=TITLES[sec];
    kpis(sec);(RENDER[sec]||(()=>{}))();
    if(sec==="merchandise")requestAnimationFrame(A.drawProducts);
    const on=document.querySelector(".nav-i[aria-current]");if(on&&on.scrollIntoView)on.scrollIntoView({block:"nearest",inline:"nearest"});
  }
  const route=()=>{const h=location.hash.slice(1);show(h||"website");const sub={minutes:"#t-min",calendar:"#t-cal",store:"#t-store"}[h];if(sub)$(sub).click()};
  window.addEventListener("hashchange",route);

  /* ---------- key figures on top of each section ---------- */
  function kpis(sec){
    const box=$("#kpis"),act=active(),fr=fundraisers(),up=A.events.filter(e=>e.d>=TODAY);
    const seats=A.SEATS.filter(s=>A.member(A.officers[s.k])).length;
    const owe=act.filter(m=>/^owes/i.test(m.dues)),paid=act.filter(m=>/^paid/i.test(m.dues));
    const raised=fr.reduce((t,e)=>t+(+e.raised||0),0);
    const live=D.sponsors.filter(s=>s.status==="Active");
    const soon=iso(new Date(NOW.getTime()+60*864e5));
    const F={
      website:[["Website",CLOUD&&!CLOUD.paid?"Preview only":A.published?"Published":"Ready to publish",CLOUD&&!CLOUD.paid?"Publishing comes with a paid level":A.published&&A.CFG.slug?"/site/"+A.CFG.slug:"Publish from the Website form"],
        ["Plan",($("#plan-line").textContent.split(" · ")[0]||"Lodge Starter"),"Change it under Settings"],
        ["Upcoming events",up.length,"On the calendar"],["Officer chairs",`${seats} of ${A.SEATS.length}`,"Filled on Members"]],
      members:[["Members",act.length,"On the roll"],["Master Masons",act.filter(m=>m.deg==="Master Mason").length,"Eligible for office"],
        ["Past Masters",act.filter(m=>m.pm).length,""],["Dues owed",owe.length,paid.length+" paid"]],
      communications:[["Next Stated",A.nextStated?day(A.nextStated):"Not set","From the meeting schedule"],["Upcoming events",up.length,""],
        ["Write-ups to approve",A.minutes.filter(m=>m.status!=="Approved").length,A.minutes.filter(m=>m.status==="Approved").length+" approved"],
        ["Announcements",D.announcements.filter(a=>a.status==="Posted").length,D.announcements.filter(a=>a.status!=="Posted").length+" drafts"]],
      treasury:[["Balance",money(ledgerSum()),"All funds, from the ledger"],["Dues collected",money(paid.length*D.treasury.dues),many(paid.length,"brother")+" paid"],
        ["Dues outstanding",money(owe.length*D.treasury.dues),many(owe.length,"brother")+" owe"],["Fundraising",money(raised),many(fr.length,"fundraiser")]],
      fundraiser:[["Active",fr.filter(e=>e.d>=TODAY).length,"Upcoming fundraisers"],["Raised",money(raised),"All fundraisers"],
        ["Goal",money(fr.reduce((t,e)=>t+(+e.goal||0),0)),fr.length?Math.round(raised/Math.max(1,fr.reduce((t,e)=>t+(+e.goal||0),0))*100)+"% of goal":""],
        ["RSVPs",fr.reduce((t,e)=>t+(+e.rsvp||0),0),""]],
      pipelines:[["In progress",D.pipeline.filter(c=>c.stage<RAISED).length,many(D.pipeline.filter(c=>c.stage===0).length,"new inquiry","new inquiries")],["Petitions",D.pipeline.filter(c=>c.stage>=1&&c.stage<=3).length,"Received, investigating or at ballot"],
        ["In degrees",D.pipeline.filter(c=>c.stage===4||c.stage===5).length,"Entered Apprentice or Fellowcraft"],["Follow-ups due",D.ptasks.filter(t=>!t.done&&t.due&&t.due<=TODAY).length,many(D.ptasks.filter(t=>!t.done).length,"open task")]],
      sponsors:[["Active sponsors",live.length,""],["Yearly support",money(live.reduce((t,s)=>t+(+s.amt||0),0)),"From active sponsors"],
        ["Renewals due",live.filter(s=>s.renew&&s.renew<=soon).length,"In the next 60 days"],["Prospects",D.sponsors.filter(s=>s.status==="Prospect").length,""]],
      merchandise:(()=>{const O=A.orders.filter(o=>o.status!=="Cancelled");
        return [["Orders",O.length,many(O.filter(o=>o.status==="New").length,"new order")],["Sales",money(O.reduce((t,o)=>t+o.total,0)),"Not counting cancelled"],
          ["To charity",money(O.reduce((t,o)=>t+o.toCharity,0)),"From these sales"],["To fill",O.filter(o=>o.status!=="Fulfilled").length,"Not yet handed over or shipped"]]})(),
      charities:[["Charities",D.charities.length,"Funds and causes"],["Raised",money(D.charities.reduce((t,c)=>t+raisedFor(c.name),0)),"Donations and fundraisers"],
        ["Given",money(D.charities.reduce((t,c)=>t+givenFor(c.name),0)),"Paid out from the ledger"],["Fundraisers",fr.filter(e=>e.charity).length,"Tied to a charity"]],
      settings:null
    }[sec];
    box.hidden=!F;
    if(F)box.innerHTML=F.map(([l,v,s])=>`<div class="kpi"><span class="kpi-l">${esc(l)}</span><b class="kpi-v num">${esc(v)}</b>${s?`<span class="kpi-s">${esc(s)}</span>`:""}</div>`).join("");
  }

  /* ---------- Communications: announcements (calendar and minutes are in demo.js) ---------- */
  const AUD=["All brethren","Officers","Public"];
  function renderAnn(){
    $("#p-ann").innerHTML=`<div class="two-col">
      <form class="card" id="ann-form">
        <h4>New announcement</h4>
        <div class="field"><label for="an-sub">Subject</label><input id="an-sub" required placeholder="Stated Communication this Tuesday"></div>
        <div class="field"><label for="an-aud">Who it's for</label><select id="an-aud">${opts(AUD)}</select></div>
        <div class="field"><label for="an-body">Message</label><textarea id="an-body" rows="6" style="font-family:var(--body);font-size:14px" placeholder="Dinner at 6:30, lodge opens at 7:30."></textarea></div>
        <div class="row-acts"><button class="btn" type="submit" value="Posted">Mark as sent</button><button class="btn line" type="submit" value="Draft">Save draft</button></div>
        <p class="hint">Email opens a message in your own email app, ready to send to the brethren. LodgeNet keeps the record here.</p>
      </form>
      <div class="list">${D.announcements.length?D.announcements.map(a=>`<div class="card" data-ann="${esc(a.id)}">
        <div class="row-sp"><b>${esc(a.subject)}</b><span class="pill${a.status==="Posted"?" ok":""}">${a.status==="Posted"?"Sent":"Draft"}</span></div>
        <span class="hint">${day(a.d)} · ${esc(a.aud)}</span>
        ${a.body?`<p style="margin:0;font-size:14px;white-space:pre-wrap">${esc(a.body)}</p>`:""}
        <div class="row-acts"><a class="btn line sm" href="mailto:?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body||"")}">Email</a>
          ${a.status==="Posted"?"":'<button class="btn line sm" type="button" data-act="post">Mark as sent</button>'}
          <button class="btn line sm" type="button" data-act="del">Delete</button></div></div>`).join("")
        :'<div class="empty">No announcements yet. Write one on the left to keep the brethren up to date.</div>'}</div></div>`;
    $("#ann-form").addEventListener("submit",e=>{e.preventDefault();const s=$("#an-sub").value.trim();if(!s)return;
      D.announcements.unshift({id:uid(),d:TODAY,subject:s,aud:$("#an-aud").value,body:$("#an-body").value.trim(),status:(e.submitter||{}).value||"Draft"});
      renderAnn();changed()});
    $("#p-ann").querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const id=b.closest("[data-ann]").dataset.ann,i=D.announcements.findIndex(a=>a.id===id);
      if(b.dataset.act==="del")D.announcements.splice(i,1);else D.announcements[i].status="Posted";
      renderAnn();changed()}));
  }

  /* ---------- Treasury ---------- */
  function renderTreasury(){
    const L=D.treasury.ledger.slice().sort((a,b)=>a.d<b.d?1:-1),act=active();
    const owe=act.filter(m=>/^owes/i.test(m.dues)),unk=act.filter(m=>!/^(owes|paid)/i.test(m.dues));
    $("#p-treas").innerHTML=`<div class="two-col wide-left">
      <div class="list">
        <div class="card">
          <h4>Ledger</h4>
          <div class="table-scroll"><table class="dtable"><thead><tr><th>Date</th><th>Description</th><th>Fund</th><th class="r">Amount</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
          ${L.length?L.map(x=>`<tr><td class="num">${day(x.d)}</td><td>${esc(x.desc)}</td><td><span class="pill">${esc(x.fund)}</span></td>
            <td class="r num ${x.kind==="out"?"neg":"pos"}">${x.kind==="out"?money(-x.amt):"+"+money(x.amt)}</td><td class="r"><button class="btn line sm" type="button" data-del="${esc(x.id)}" aria-label="Delete entry">×</button></td></tr>`).join("")
            :'<tr><td colspan="5" class="hint">No entries yet. Record dues, donations and bills below, or log a donation from the Fundraiser tab.</td></tr>'}
          </tbody></table></div>
          <form class="inline-form" id="led-form">
            <div class="field"><label for="l-d">Date</label><input id="l-d" type="date" value="${TODAY}" required></div>
            <div class="field grow"><label for="l-desc">Description</label><input id="l-desc" required placeholder="Electric bill"></div>
            <div class="field"><label for="l-fund">Fund</label><select id="l-fund">${opts(funds())}</select></div>
            <div class="field"><label for="l-kind">Type</label><select id="l-kind"><option value="in">Money in</option><option value="out">Money out</option></select></div>
            <div class="field"><label for="l-amt">Amount ($)</label><input id="l-amt" type="number" min="0" step="0.01" required style="max-width:8em"></div>
            <button class="btn" type="submit">Add</button>
          </form>
        </div>
      </div>
      <div class="list">
        <div class="card">
          <h4>Dues for ${YEAR}</h4>
          <div class="field" style="margin:0"><label for="t-dues">Yearly dues per brother ($)</label><input id="t-dues" type="number" min="0" step="1" value="${+D.treasury.dues||""}" placeholder="e.g. 120" style="max-width:9em"></div>
          ${owe.length?`<div class="mini-list">${owe.map(m=>`<div class="row-sp"><span>${esc(m.name)}</span><button class="btn line sm" type="button" data-pay="${m.id}">Mark paid</button></div>`).join("")}</div>`
            :'<p class="hint">Nobody is marked as owing dues.</p>'}
          ${unk.length?`<p class="hint">${unk.length} brother${unk.length>1?"s have":" has"} no dues status yet. Set it on <a href="#members">Members</a>.</p>`:""}
        </div>
        <div class="card">
          <h4>Fund balances</h4>
          <div class="mini-list">${funds().map(f=>`<div class="row-sp"><span>${esc(f)}</span><b class="num">${money(ledgerSum(x=>x.fund===f))}</b></div>`).join("")}</div>
        </div>
      </div></div>`;
    $("#led-form").addEventListener("submit",e=>{e.preventDefault();const amt=+$("#l-amt").value;if(!amt||!$("#l-desc").value.trim())return;
      D.treasury.ledger.push({id:uid(),d:$("#l-d").value||TODAY,desc:$("#l-desc").value.trim(),fund:$("#l-fund").value,kind:$("#l-kind").value,amt});renderTreasury();changed()});
    $("#t-dues").addEventListener("change",e=>{D.treasury.dues=Math.max(0,+e.target.value||0);changed()});
    $("#p-treas").querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{
      D.treasury.ledger=D.treasury.ledger.filter(x=>x.id!==b.dataset.del);renderTreasury();changed()}));
    $("#p-treas").querySelectorAll("[data-pay]").forEach(b=>b.addEventListener("click",()=>{
      const m=A.member(b.dataset.pay);if(!m)return;m.dues="Paid "+YEAR;
      if(D.treasury.dues>0)D.treasury.ledger.push({id:uid(),d:TODAY,desc:`${YEAR} dues · ${m.name}`,fund:"General Fund",kind:"in",amt:+D.treasury.dues});
      A.refresh();renderTreasury();changed()}));
  }

  /* ---------- Fundraiser (events of the "Public fundraiser" type on the calendar) ---------- */
  function renderFund(){
    const fr=fundraisers();
    $("#p-fund").innerHTML=`<div class="two-col wide-left">
      <div class="fund-grid">${fr.length?fr.map((e,i)=>{const pct=e.goal?Math.min(100,Math.round((+e.raised||0)/e.goal*100)):0;
        return `<div class="card" data-fi="${A.events.indexOf(e)}">
          <div class="row-sp"><b>${esc(e.t)}</b>${e.d<TODAY?'<span class="pill">Past</span>':'<span class="pill gold">Upcoming</span>'}</div>
          <span class="hint">${day(e.d)}${e.charity?" · for "+esc(e.charity):""}</span>
          <div class="row-sp"><b class="num">${money(e.raised)} raised</b><span class="hint num">of ${money(e.goal)} · ${pct}%</span></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <span class="hint num">${+e.rsvp||0} RSVPs</span>
          <div class="row-acts"><input type="number" min="1" step="1" placeholder="$" aria-label="Donation amount" class="amt-in">
            <button class="btn sm" type="button" data-act="don">Log donation</button><button class="btn line sm" type="button" data-act="rsvp">Add RSVP</button>
            <button class="btn line sm" type="button" data-act="cal">Calendar</button></div></div>`}).join("")
        :'<div class="empty">No fundraisers yet. Plan one on the right; it goes on the lodge calendar too.</div>'}</div>
      <form class="card" id="fund-form">
        <h4>Plan a fundraiser</h4>
        <div class="field"><label for="fr-t">Name</label><input id="fr-t" required placeholder="Pancake breakfast"></div>
        <div class="field"><label for="fr-d">Date</label><input id="fr-d" type="date" required value="${TODAY}"></div>
        <div class="field"><label for="fr-g">Goal ($)</label><input id="fr-g" type="number" min="50" step="50" value="1500"></div>
        <div class="field"><label for="fr-c">Proceeds go to</label><select id="fr-c">${opts(funds().slice(1).concat("General Fund"))}</select></div>
        <div class="field"><label for="fr-n">Details</label><input id="fr-n" placeholder="$10 adults, $5 kids"></div>
        <button class="btn" type="submit">Add fundraiser</button>
      </form></div>`;
    $("#fund-form").addEventListener("submit",ev=>{ev.preventDefault();const t=$("#fr-t").value.trim(),d=$("#fr-d").value;if(!t||!d)return;
      A.addEvent({d,t,k:"fund",time:"Time to be announced",goal:Math.max(50,+$("#fr-g").value||500),raised:0,rsvp:0,charity:$("#fr-c").value,note:$("#fr-n").value.trim()||"Public fundraiser."});
      renderFund();changed()});
    $("#p-fund").querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const card=b.closest("[data-fi]"),e=A.events[+card.dataset.fi];if(!e)return;
      if(b.dataset.act==="cal"){location.hash="communications";$("#t-cal").click();A.select(e);return}
      if(b.dataset.act==="rsvp")e.rsvp=(+e.rsvp||0)+1;
      if(b.dataset.act==="don"){const amt=+card.querySelector(".amt-in").value;if(!amt)return card.querySelector(".amt-in").focus();
        e.raised=(+e.raised||0)+amt;
        D.treasury.ledger.push({id:uid(),d:TODAY,desc:"Donation · "+e.t,fund:e.charity&&funds().includes(e.charity)?e.charity:"General Fund",kind:"in",amt})}
      A.refresh();renderFund();changed()}));
  }

  /* ---------- Pipelines: prospective brethren from first inquiry to raising, laid out like a lead database:
     tabs for Prospects, Lists and Tasks; filters on the left; a sortable table with bulk actions; a detail card per prospect.
     Nothing is found or scored automatically: officers add prospects and set the fit themselves. ---------- */
  const STAGES=["Inquiry","Petition received","Investigation","Ballot","Entered Apprentice","Fellowcraft","Raised","Not proceeding"];
  const RAISED=6,NOPE=7,DEGREE={4:"Entered Apprentice",5:"Fellowcraft",6:"Master Mason"};
  const KINDS_P=["Prospective member","Affiliation","Reinstatement"],SOURCES=["Brother's referral","Website","Event","Walk-in","Other"];
  const FITS=[["strong","Strong (80+)",f=>f>=80],["possible","Possible (50–79)",f=>f>=50&&f<80],["weak","Weak (under 50)",f=>f!=null&&f<50],["none","Not scored yet",f=>f==null]];
  const CONTACT=[["email","Has an email",c=>!!c.email],["phone","Has a phone",c=>!!c.phone],["by","Recommended by a brother",c=>!!c.by]];
  D.plists=CFG.plists||[];D.ptasks=CFG.ptasks||[];
  /* Find businesses: the last AI search (api/business-search.js) is kept with the lodge's records so other officers see it too */
  D.bsearch=CFG.bsearch||{what:"",zip:"",radius:10,purpose:"Sponsor",count:10,results:[],notes:"",at:""};
  const RADII=[5,10,25,50];
  const PURPOSES=["Sponsor","Fundraiser partner","Event venue","Vendor or supplier","In-kind donor"];
  const BS={busy:false,msg:""};
  const SCORE_DIMS=[["giving","Community giving",30],["local","Local roots",20],["ties","Veteran, fraternal and civic ties",15],["capacity","Capacity to give",15],["relevance","Fit for this ask",10],["reach","Reachable decision-maker",10]];
  D.pipeline.forEach(c=>{if(c.contact&&!c.email&&!c.phone){/@/.test(c.contact)?c.email=c.contact:c.phone=c.contact;delete c.contact}c.kind=c.kind||KINDS_P[0];c.lists=c.lists||[];if(c.fit===undefined)c.fit=null});
  const PF={fopen:null,view:"search",stage:new Set(),fit:new Set(),contact:new Set(),kind:new Set(),list:"",q:"",sort:"fit",page:0,sel:new Set(),open:null};
  const PAGE=25;
  const tier=f=>f==null?["none","Not scored"]:f>=80?["strong","Strong"]:f>=50?["possible","Possible"]:["weak","Weak"];
  function syncDegree(c){const deg=DEGREE[c.stage],m=c.member&&A.member(c.member);
    if(deg&&m){m.deg=deg;A.refresh()}else if(deg&&!m)c.member=A.addMember(c.name,deg).id}
  function filtered(){
    const q=PF.q.toLowerCase();
    let L=D.pipeline.filter(c=>(!PF.stage.size||PF.stage.has(c.stage))&&(!PF.kind.size||PF.kind.has(c.kind))&&(!PF.list||c.lists.includes(PF.list))
      &&(!PF.fit.size||FITS.some(([k,,t])=>PF.fit.has(k)&&t(c.fit)))&&[...PF.contact].every(k=>CONTACT.find(x=>x[0]===k)[2](c))
      &&(!q||[c.name,c.email,c.phone,c.by,c.city,c.notes].some(v=>String(v||"").toLowerCase().includes(q))));
    const by={fit:(a,b)=>(b.fit??-1)-(a.fit??-1),new:(a,b)=>a.d<b.d?1:-1,name:(a,b)=>a.name.localeCompare(b.name),stage:(a,b)=>a.stage-b.stage}[PF.sort];
    return L.sort(by);
  }
  const chk=(group,k,label,n)=>`<label class="pl-chk"><input type="checkbox" data-fg="${group}" value="${esc(k)}"${PF[group].has(group==="stage"?+k:k)?" checked":""}><span>${esc(label)}</span>${n==null?"":`<span class="pl-n">${n}</span>`}</label>`;
  function csv(rows){const q=v=>`"${String(v==null?"":v).replace(/"/g,'""')}"`;
    const out=[["Name","Kind","Email","Phone","Recommended by","City","Source","Fit","Stage","Added"].map(q).join(",")].concat(rows.map(c=>[c.name,c.kind,c.email,c.phone,c.by,c.city,c.source,c.fit,STAGES[c.stage],c.d].map(q).join(",")));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([out.join("\n")],{type:"text/csv"}));a.download="lodge-prospects.csv";document.body.appendChild(a);a.click();a.remove()}
  function renderPipe(){
    const openTasks=D.ptasks.filter(t=>!t.done).length;
    const tabs=`<div class="tabs pl-tabs" role="tablist" aria-label="Pipelines">${[["search","Find businesses"],["prospects",`Prospects (${D.pipeline.length})`],["lists",`Lists (${D.plists.length})`],["tasks",`Tasks (${openTasks})`]]
      .map(([k,l])=>`<button type="button" class="tab" role="tab" data-view="${k}" aria-selected="${PF.view===k}">${l}</button>`).join("")}</div>`;
    let body="";
    if(PF.view==="prospects"){
      const L=filtered(),pages=Math.max(1,Math.ceil(L.length/PAGE));PF.page=Math.min(PF.page,pages-1);
      const shown=L.slice(PF.page*PAGE,PF.page*PAGE+PAGE),allSel=shown.length&&shown.every(c=>PF.sel.has(c.id));
      const count=f=>D.pipeline.filter(f).length;
      body=`<form class="card pl-add" id="pipe-form">
          <div><h4>Add a prospect</h4><p class="hint" style="margin:4px 0 0">Someone who asked about joining, was recommended by a brother, or signed up at an event.</p></div>
          <div class="inline-form">
            <div class="field grow"><label for="pp-n">Name</label><input id="pp-n" required placeholder="Full name"></div>
            <div class="field grow"><label for="pp-e">Email</label><input id="pp-e" type="email"></div>
            <div class="field"><label for="pp-p">Phone</label><input id="pp-p" type="tel" style="max-width:10em"></div>
            <div class="field grow"><label for="pp-r">Recommended by</label><input id="pp-r" placeholder="Brother's name"></div>
            <div class="field"><label for="pp-c">City</label><input id="pp-c" style="max-width:10em"></div>
            <div class="field"><label for="pp-s">Source</label><select id="pp-s">${opts(SOURCES)}</select></div>
            <button class="btn" type="submit">Add prospect</button>
          </div></form>
        <div class="pl-wrap">
          <aside class="pl-filters">
            <input type="search" id="pl-q" placeholder="Search prospects" value="${esc(PF.q)}" aria-label="Search prospects">
            ${PF.list?`<div class="pl-group"><b>List</b><span class="row-sp"><span class="pill gold">${esc((D.plists.find(l=>l.id===PF.list)||{}).name||"")}</span><button type="button" class="link-btn" id="pl-nolist">Clear</button></span></div>`:""}
            <details class="pl-fd"${PF.fopen??innerWidth>860?" open":""}><summary>Filters</summary>
            <div class="pl-group"><b>Stage</b>${STAGES.map((st,i)=>chk("stage",i,st,count(c=>c.stage===i))).join("")}</div>
            <div class="pl-group"><b>Fit</b>${FITS.map(([k,l,t])=>chk("fit",k,l,count(c=>t(c.fit)))).join("")}</div>
            <div class="pl-group"><b>Contact info</b>${CONTACT.map(([k,l,t])=>chk("contact",k,l,count(t))).join("")}</div>
            <div class="pl-group"><b>Kind</b>${KINDS_P.map(k=>chk("kind",k,k,count(c=>c.kind===k))).join("")}</div>
            </details>
            ${PF.stage.size||PF.fit.size||PF.contact.size||PF.kind.size||PF.q?'<button type="button" class="btn line sm" id="pl-clear">Clear filters</button>':""}
          </aside>
          <div class="pl-main">
            <div class="pl-bar">
              <b>${many(L.length,"prospect")}${L.length!==D.pipeline.length?` <span class="hint">of ${D.pipeline.length}</span>`:""}</b>
              <label class="hint">Sort <select id="pl-sort">${[["fit","Best fit first"],["new","Newest first"],["name","Name A–Z"],["stage","Stage"]].map(([k,l])=>`<option value="${k}"${PF.sort===k?" selected":""}>${l}</option>`).join("")}</select></label>
            </div>
            ${PF.sel.size?`<div class="pl-bulk"><b>${PF.sel.size} selected</b>
              <select id="bk-stage" aria-label="Move to stage"><option value="">Move to stage…</option>${STAGES.map((st,i)=>`<option value="${i}">${st}</option>`).join("")}</select>
              <select id="bk-list" aria-label="Add to list"><option value="">Add to list…</option>${D.plists.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("")}<option value="+">New list…</option></select>
              <button type="button" class="btn line sm" data-bk="task">Add follow-up</button>
              <button type="button" class="btn line sm" data-bk="csv">Export CSV</button>
              <button type="button" class="btn line sm" data-bk="del">Delete</button>
              <button type="button" class="link-btn" data-bk="none">Clear selection</button></div>`:""}
            <div class="table-scroll"><table class="dtable pl-table"><thead><tr>
              <th><input type="checkbox" id="pl-all" aria-label="Select all on this page"${allSel?" checked":""}></th><th>Prospect</th><th>Recommended by</th><th>Contact</th><th>Location</th><th>Fit</th><th>Stage</th></tr></thead><tbody>
            ${shown.length?shown.map(c=>{const [tk,tl]=tier(c.fit);return `<tr data-pc="${esc(c.id)}"${PF.open===c.id?' class="on"':""}>
              <td><input type="checkbox" data-sel aria-label="Select ${esc(c.name)}"${PF.sel.has(c.id)?" checked":""}></td>
              <td><button type="button" class="link-btn pl-name" data-open>${esc(c.name)}</button><br><span class="hint">${esc([c.kind!==KINDS_P[0]?c.kind:"",c.source].filter(Boolean).join(" · "))}</span></td>
              <td>${c.by?esc(c.by):'<span class="hint">None</span>'}</td>
              <td>${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}${c.email&&c.phone?"<br>":""}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:""}${!c.email&&!c.phone?'<span class="hint">Not added</span>':""}</td>
              <td>${c.city?esc(c.city):'<span class="hint">—</span>'}</td>
              <td><span class="fit ${tk}">${tl}${c.fit!=null?` · ${c.fit}`:""}</span></td>
              <td><select data-stage aria-label="Stage for ${esc(c.name)}">${STAGES.map((st,i)=>`<option value="${i}"${i===c.stage?" selected":""}>${st}</option>`).join("")}</select></td></tr>`}).join("")
              :`<tr><td colspan="7" class="hint">${D.pipeline.length?"No prospects match these filters.":"No prospects yet. Add the first one above."}</td></tr>`}
            </tbody></table></div>
            ${L.length>PAGE?`<div class="row-sp pl-pager"><span class="hint">${PF.page*PAGE+1}–${Math.min(L.length,PF.page*PAGE+PAGE)} of ${L.length}</span><span class="row-acts">
              <button type="button" class="btn line sm" data-pg="-1"${PF.page?"":" disabled"}>Previous</button><button type="button" class="btn line sm" data-pg="1"${PF.page<pages-1?"":" disabled"}>Next</button></span></div>`:""}
            ${detail()}
          </div>
        </div>`;
    }else if(PF.view==="search"){
      body=bizSearch();
    }else if(PF.view==="lists"){
      body=`<div class="two-col wide-left"><div class="list">${D.plists.length?D.plists.map(l=>{const n=D.pipeline.filter(c=>c.lists.includes(l.id)).length;
          return `<div class="card" data-li="${esc(l.id)}"><div class="row-sp"><b>${esc(l.name)}</b><span class="pill">${many(n,"prospect")}</span></div>
            <div class="row-acts"><button type="button" class="btn line sm" data-lact="show">Show prospects</button><button type="button" class="btn line sm" data-lact="del">Delete list</button></div></div>`}).join("")
          :'<div class="empty">No lists yet. Lists group prospects, for example "Spring open house" or "Waiting on petition".</div>'}</div>
        <form class="card" id="plist-form"><h4>New list</h4><div class="field"><label for="pl-ln">Name</label><input id="pl-ln" required placeholder="Spring open house"></div>
          <button class="btn" type="submit">Create list</button><p class="hint">Add prospects to a list from the Prospects tab: tick them, then choose "Add to list".</p></form></div>`;
    }else{
      const T=D.ptasks.slice().sort((a,b)=>a.done-b.done||(a.due||"9")<(b.due||"9")?-1:1);
      body=`<div class="card"><div class="table-scroll"><table class="dtable"><thead><tr><th><span class="sr">Done</span></th><th>Follow-up</th><th>Prospect</th><th>Due</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
        ${T.length?T.map(t=>{const c=D.pipeline.find(x=>x.id===t.pid);return `<tr data-ti="${esc(t.id)}"${t.done?' class="done"':""}>
          <td><input type="checkbox" data-done aria-label="Done"${t.done?" checked":""}></td><td>${esc(t.text)}</td><td>${c?esc(c.name):'<span class="hint">Removed</span>'}</td>
          <td class="num${!t.done&&t.due&&t.due<TODAY?" late":""}">${t.due?day(t.due):'<span class="hint">No date</span>'}</td>
          <td class="r"><button type="button" class="btn line sm" data-tdel aria-label="Delete">×</button></td></tr>`}).join("")
          :'<tr><td colspan="5" class="hint">No follow-ups yet. Add one here, or from a prospect\'s card.</td></tr>'}
        </tbody></table></div>
        <form class="inline-form" id="ptask-form">
          <div class="field grow"><label for="pt-t">Follow-up</label><input id="pt-t" required placeholder="Call to set up a lodge visit"></div>
          <div class="field"><label for="pt-p">Prospect</label><select id="pt-p">${D.pipeline.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="pt-d">Due</label><input id="pt-d" type="date"></div>
          <button class="btn" type="submit"${D.pipeline.length?"":" disabled"}>Add follow-up</button></form></div>`;
    }
    $("#p-pipe").innerHTML=tabs+body+(PF.view==="search"?"":`<p class="hint" style="margin:14px 0 0">Moving a prospect to Entered Apprentice adds him to the roster on Members, and Fellowcraft and Raised update his degree there.</p>`);
    wirePipe();
  }
  function detail(){
    const c=D.pipeline.find(x=>x.id===PF.open);if(!c)return "";
    const T=D.ptasks.filter(t=>t.pid===c.id);
    const f=(k,l,type)=>`<div class="field"><label>${l}<input data-pf="${k}"${type?` type="${type}"`:""} value="${esc(c[k]==null?"":c[k])}"></label></div>`;
    return `<div class="card pl-detail" id="pl-detail"><div class="row-sp"><h4>${esc(c.name)}</h4><button type="button" class="btn line sm" id="pl-close">Close</button></div>
      <div class="pl-dgrid">${f("name","Name")}${f("email","Email","email")}${f("phone","Phone","tel")}${f("by","Recommended by")}${f("city","City")}
        <div class="field"><label>Kind<select data-pf="kind">${opts(KINDS_P,c.kind)}</select></label></div>
        <div class="field"><label>Source<select data-pf="source">${opts(SOURCES,c.source)}</select></label></div>
        <div class="field"><label>Fit score (0–100)<input data-pf="fit" type="number" min="0" max="100" value="${c.fit==null?"":c.fit}" placeholder="Not scored"></label></div></div>
      <div class="field"><label>Notes<textarea data-pf="notes" rows="3" style="font-family:var(--body);font-size:14px">${esc(c.notes||"")}</textarea></label></div>
      <div class="row-sp"><span class="hint">Added ${day(c.d)}${c.lists.length?" · Lists: "+c.lists.map(id=>(D.plists.find(l=>l.id===id)||{}).name).filter(Boolean).map(esc).join(", "):""}</span>${c.member?'<span class="pill ok">On the roster</span>':""}</div>
      <div class="mini-list"><b style="font-size:13px">Follow-ups</b>${T.length?T.map(t=>`<span class="hint">${t.done?"✓ ":""}${esc(t.text)}${t.due?" · "+day(t.due):""}</span>`).join(""):'<span class="hint">None yet.</span>'}
        <form class="row-acts" id="pl-dtask"><input id="pl-dt" placeholder="New follow-up" class="amt-in" style="width:auto;flex:1"><input id="pl-dd" type="date" class="amt-in" style="width:auto"><button class="btn line sm" type="submit">Add</button></form></div></div>`;
  }
  function bizSearch(){
    const B=D.bsearch;
    const added=r=>D.sponsors.some(s=>s.name.toLowerCase()===r.name.toLowerCase());
    return `<form class="biz-form" id="biz-form" novalidate>
        <div><h4>Find businesses</h4><p class="hint" style="margin:4px 0 0">Enter a ZIP code and how far around it to look, and the kind of business if you have one in mind. Claude searches the web for real ones nearby, scores how likely each is to help, and says why. Add the good ones to Sponsors.</p></div>
        <div class="inline-form">
          <div class="field grow"><label for="bz-w">Type of business <span class="hint">(optional)</span></label><input id="bz-w" placeholder="Any kind, or e.g. restaurants, banks, contractors" value="${esc(B.what)}"></div>
          <div class="field"><label for="bz-z">ZIP code</label><input id="bz-z" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="29576" value="${esc(B.zip||"")}" style="max-width:7em"></div>
          <div class="field"><label for="bz-r">Within</label><select id="bz-r">${RADII.map(n=>`<option value="${n}"${+(B.radius||10)===n?" selected":""}>${n} miles</option>`).join("")}</select></div>
          <div class="field"><label for="bz-p">To be a</label><select id="bz-p">${opts(PURPOSES,B.purpose)}</select></div>
          <div class="field"><label for="bz-n">How many</label><select id="bz-n">${[10,15,20].map(n=>`<option${+B.count===n?" selected":""}>${n}</option>`).join("")}</select></div>
          <button class="btn" type="submit"${BS.busy?" disabled":""}>${BS.busy?"Searching…":"Search"}</button>
        </div>
        ${BS.msg?`<p class="hint biz-msg" role="status">${esc(BS.msg)}</p>`:""}
      </form>
      ${B.results.length?`<div class="pl-bar"><b>${many(B.results.length,"business","businesses")}</b><span class="hint">${esc(B.what||"Any kind of business")} within ${B.radius||10} miles of ${esc(B.zip||B.where||"")} · ${esc(B.purpose)}${B.at?" · searched "+day(B.at):""}</span><button type="button" class="btn line sm" id="bz-csv">Export CSV</button></div>
      <div class="table-scroll"><table class="dtable biz-table"><thead><tr><th>Business</th><th>Contact</th><th>Fit</th><th>Why, and how to ask</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
      ${B.results.map((r,i)=>{const [tk,tl]=tier(r.fit);return `<tr data-bz="${i}">
        <td><b>${esc(r.name)}</b><br><span class="hint">${esc(r.category)}</span><br><span class="hint">${esc([r.address,r.city].filter(Boolean).join(", "))}</span></td>
        <td>${r.contact?`${esc(r.contact)}${r.role?`<br><span class="hint">${esc(r.role)}</span>`:""}<br>`:""}${[r.phone?`<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>`:"",r.email?`<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`:"",r.website?`<a href="${esc(r.website)}" target="_blank" rel="noopener">Website</a>`:""].filter(Boolean).join("<br>")||'<span class="hint">Not found</span>'}</td>
        <td><span class="fit ${tk}">${tl} · ${r.fit}</span></td>
        <td class="biz-why">${esc(r.why)}
          <details class="biz-more"><summary>Evidence, score and suggested ask</summary>
            ${r.signals&&r.signals.length?`<ul class="biz-sig">${r.signals.map(g=>`<li>${esc(g.text)}${g.url?` <a href="${esc(g.url)}" target="_blank" rel="noopener">Source</a>`:""}</li>`).join("")}</ul>`:""}
            ${r.score?`<dl class="biz-score">${SCORE_DIMS.map(([k,l,max])=>`<dt>${l}</dt><dd>${+r.score[k]||0} / ${max}</dd>`).join("")}</dl>`:""}
            ${r.pitch?`<blockquote class="biz-pitch">${esc(r.pitch)}</blockquote><button type="button" class="btn line sm" data-bzcopy>Copy the ask</button>`:""}
          </details></td>
        <td class="r">${added(r)?'<span class="hint">In Sponsors</span>':'<button type="button" class="btn line sm" data-bzadd>Add to Sponsors</button>'}</td></tr>`}).join("")}
      </tbody></table></div>${B.notes?`<p class="notice">${esc(B.notes)}</p>`:""}`
      :`<div class="empty">No search yet. Try "family restaurants" or "local banks and credit unions" near your lodge.</div>`}`;
  }
  async function runBizSearch(){
    const B=D.bsearch;B.what=$("#bz-w").value.trim();B.zip=$("#bz-z").value.replace(/\D/g,"").slice(0,5);B.radius=+$("#bz-r").value;B.purpose=$("#bz-p").value;B.count=+$("#bz-n").value;
    const C=window.LODGENET_CLOUD,say=m=>{BS.msg=m;renderPipe()};
    /* phone browsers can block a submit silently on an empty required field, so the form checks itself and says what's missing */
    if(!/^\d{5}$/.test(B.zip)){say("Enter the 5-digit ZIP code to search around, then press Search.");return $("#bz-z").focus()}
    if(!C||!C.lodgeId)return say("Business search runs in a signed-in lodge account. Here you can add sponsors by hand on the Sponsors tab.");
    if(!C.canEdit)return say("Only the lodge's officers can search for businesses.");
    const session=window.LodgeNetAuth&&await window.LodgeNetAuth.session();
    if(!session)return say("Your sign-in has expired. Sign in again.");
    BS.busy=true;say("Searching the web. This usually takes a minute or two.");
    const t0=Date.now(),tick=setInterval(()=>{const m=$(".biz-msg");if(m&&BS.busy)m.textContent=`Searching the web… ${Math.round((Date.now()-t0)/1000)}s. This usually takes a minute or two.`},1000);
    try{
      const r=await fetch("/api/business-search",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({lodge_id:C.lodgeId,lodge:($("#lodge-title")||{}).textContent||"",what:B.what,zip:B.zip,radius:B.radius,purpose:B.purpose,count:B.count,
          exclude:D.sponsors.map(x=>x.name)})});
      const d=await r.json().catch(()=>({error:`The search didn't finish (the server answered ${r.status}${r.status===504?", it ran out of time":""}). Try again.`}));
      if(!r.ok)throw new Error(d.error||"The search didn't finish just now.");
      B.results=d.results||[];B.notes=d.notes||"";B.at=TODAY;
      BS.msg=B.results.length?"":"No matching businesses turned up. Try a wider area or different wording.";changed();
    }catch(err){BS.msg=err instanceof TypeError?"The connection dropped before the search finished. Try again.":err.message||"The search didn't finish just now. Try again."}
    clearInterval(tick);BS.busy=false;renderPipe();
  }
  function wirePipe(){
    const P=$("#p-pipe"),re=()=>{renderPipe();changed()};
    const bf=$("#biz-form");
    if(bf){bf.addEventListener("submit",e=>{e.preventDefault();if(!BS.busy)runBizSearch()});
      P.querySelectorAll("[data-bzadd]").forEach(b=>b.addEventListener("click",()=>{const r=D.bsearch.results[+b.closest("[data-bz]").dataset.bz];
        D.sponsors.push({id:uid(),name:r.name,contact:[r.contact,r.phone,r.email||r.website].filter(Boolean).join(" · "),level:D.bsearch.purpose==="In-kind donor"?"In-kind":"Bronze",amt:0,renew:"",status:"Prospect"});
        renderSpon();re()}));
      P.querySelectorAll("[data-bzcopy]").forEach(b=>b.addEventListener("click",async()=>{const r=D.bsearch.results[+b.closest("[data-bz]").dataset.bz];
        try{await navigator.clipboard.writeText(r.pitch);b.textContent="Copied"}catch{b.textContent="Select the text to copy"}}));
      const xc=$("#bz-csv");if(xc)xc.addEventListener("click",()=>{const q=v=>`"${String(v==null?"":v).replace(/"/g,'""')}"`;
        const rows=[["Business","Kind","Address","City","Contact","Role","Phone","Email","Website","Fit","Why","Suggested ask"]].concat(D.bsearch.results.map(r=>
          [r.name,r.category,r.address,r.city,r.contact,r.role,r.phone,r.email,r.website,r.fit,r.why,r.pitch]));
        const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(x=>x.map(q).join(",")).join("\n")],{type:"text/csv"}));
        a.download="lodge-business-search.csv";document.body.appendChild(a);a.click();a.remove()});
      P.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{PF.view=b.dataset.view;renderPipe()}));
      return}
    P.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{PF.view=b.dataset.view;renderPipe()}));
    const form=$("#pipe-form");
    if(form)form.addEventListener("submit",e=>{e.preventDefault();const n=$("#pp-n").value.trim();if(!n)return;
      D.pipeline.push({id:uid(),name:n,email:$("#pp-e").value.trim(),phone:$("#pp-p").value.trim(),by:$("#pp-r").value.trim(),city:$("#pp-c").value.trim(),
        source:$("#pp-s").value,kind:KINDS_P[0],fit:null,stage:0,lists:[],d:TODAY});re()});
    P.querySelectorAll("[data-fg]").forEach(i=>i.addEventListener("change",()=>{const g=i.dataset.fg,v=g==="stage"?+i.value:i.value;
      i.checked?PF[g].add(v):PF[g].delete(v);PF.page=0;renderPipe()}));
    const q=$("#pl-q");if(q){let t;q.addEventListener("input",()=>{clearTimeout(t);t=setTimeout(()=>{PF.q=q.value;PF.page=0;renderPipe();const n=$("#pl-q");n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)})}
    const fd=P.querySelector(".pl-fd");if(fd)fd.addEventListener("toggle",()=>PF.fopen=fd.open);
    const cl=$("#pl-clear");if(cl)cl.addEventListener("click",()=>{["stage","fit","contact","kind"].forEach(g=>PF[g].clear());PF.q="";renderPipe()});
    const nl=$("#pl-nolist");if(nl)nl.addEventListener("click",()=>{PF.list="";renderPipe()});
    const so=$("#pl-sort");if(so)so.addEventListener("change",()=>{PF.sort=so.value;renderPipe()});
    P.querySelectorAll("[data-pg]").forEach(b=>b.addEventListener("click",()=>{PF.page+=+b.dataset.pg;renderPipe()}));
    const all=$("#pl-all");if(all)all.addEventListener("change",()=>{P.querySelectorAll("tr[data-pc]").forEach(r=>all.checked?PF.sel.add(r.dataset.pc):PF.sel.delete(r.dataset.pc));renderPipe()});
    P.querySelectorAll("tr[data-pc]").forEach(r=>{const c=D.pipeline.find(x=>x.id===r.dataset.pc);
      r.querySelector("[data-sel]").addEventListener("change",e=>{e.target.checked?PF.sel.add(c.id):PF.sel.delete(c.id);renderPipe()});
      r.querySelector("[data-open]").addEventListener("click",()=>{PF.open=PF.open===c.id?null:c.id;renderPipe();const d=$("#pl-detail");if(d)d.scrollIntoView({block:"nearest"})});
      r.querySelector("[data-stage]").addEventListener("change",e=>{c.stage=+e.target.value;c.d=c.d||TODAY;syncDegree(c);re()})});
    const sel=()=>D.pipeline.filter(c=>PF.sel.has(c.id));
    const bs=$("#bk-stage");if(bs)bs.addEventListener("change",()=>{if(bs.value==="")return;sel().forEach(c=>{c.stage=+bs.value;syncDegree(c)});re()});
    const bl=$("#bk-list");if(bl)bl.addEventListener("change",()=>{let id=bl.value;if(!id)return;
      if(id==="+"){const n=(prompt("Name the new list")||"").trim();if(!n){bl.value="";return}id=uid();D.plists.push({id,name:n})}
      sel().forEach(c=>{if(!c.lists.includes(id))c.lists.push(id)});re()});
    P.querySelectorAll("[data-bk]").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.bk;
      if(k==="none")PF.sel.clear();
      if(k==="csv")return csv(sel());
      if(k==="task"){const t=(prompt(`Follow-up for ${PF.sel.size} prospect${PF.sel.size>1?"s":""}`,"Call to invite to the next open house")||"").trim();if(!t)return;
        sel().forEach(c=>D.ptasks.push({id:uid(),pid:c.id,text:t,due:"",done:false}))}
      if(k==="del"){if(!confirm(`Delete ${PF.sel.size} prospect${PF.sel.size>1?"s":""}? Brothers already on the roster stay there.`))return;
        D.pipeline=D.pipeline.filter(c=>!PF.sel.has(c.id));D.ptasks=D.ptasks.filter(t=>!PF.sel.has(t.pid));PF.sel.clear()}
      re()}));
    const det=$("#pl-detail");
    if(det){const c=D.pipeline.find(x=>x.id===PF.open);
      $("#pl-close").addEventListener("click",()=>{PF.open=null;renderPipe()});
      det.querySelectorAll("[data-pf]").forEach(el=>el.addEventListener("change",()=>{const k=el.dataset.pf;
        c[k]=k==="fit"?(el.value===""?null:Math.max(0,Math.min(100,Math.round(+el.value)))):el.value.trim();
        if(k==="name"&&!c.name)c.name="Unnamed";re()}));
      $("#pl-dtask").addEventListener("submit",e=>{e.preventDefault();const t=$("#pl-dt").value.trim();if(!t)return;
        D.ptasks.push({id:uid(),pid:c.id,text:t,due:$("#pl-dd").value,done:false});re()});
    }
    const lf=$("#plist-form");if(lf)lf.addEventListener("submit",e=>{e.preventDefault();const n=$("#pl-ln").value.trim();if(!n)return;D.plists.push({id:uid(),name:n});re()});
    P.querySelectorAll("[data-li]").forEach(card=>card.querySelectorAll("[data-lact]").forEach(b=>b.addEventListener("click",()=>{const id=card.dataset.li;
      if(b.dataset.lact==="show"){PF.view="prospects";PF.list=id;PF.page=0;return renderPipe()}
      D.plists=D.plists.filter(l=>l.id!==id);D.pipeline.forEach(c=>c.lists=c.lists.filter(x=>x!==id));if(PF.list===id)PF.list="";re()})));
    const tf=$("#ptask-form");if(tf)tf.addEventListener("submit",e=>{e.preventDefault();const t=$("#pt-t").value.trim();if(!t)return;
      D.ptasks.push({id:uid(),pid:$("#pt-p").value,text:t,due:$("#pt-d").value,done:false});re()});
    P.querySelectorAll("tr[data-ti]").forEach(r=>{const t=D.ptasks.find(x=>x.id===r.dataset.ti);
      r.querySelector("[data-done]").addEventListener("change",e=>{t.done=e.target.checked;re()});
      r.querySelector("[data-tdel]").addEventListener("click",()=>{D.ptasks=D.ptasks.filter(x=>x!==t);re()})});
  }

  /* ---------- Sponsors ---------- */
  const LEVELS=["Gold","Silver","Bronze","In-kind"],STATUS=["Active","Prospect","Lapsed"];
  function renderSpon(){
    const S=D.sponsors.slice().sort((a,b)=>STATUS.indexOf(a.status)-STATUS.indexOf(b.status)||(+b.amt||0)-(+a.amt||0));
    $("#p-spon").innerHTML=`<div class="card">
      <div class="table-scroll"><table class="dtable"><thead><tr><th>Sponsor</th><th>Contact</th><th>Level</th><th class="r">Per year</th><th>Renews</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
      ${S.length?S.map(s=>`<tr data-sp="${esc(s.id)}"><td><b>${esc(s.name)}</b></td><td>${esc(s.contact||"")}</td><td><span class="pill gold">${esc(s.level)}</span></td>
        <td class="r num">${money(s.amt)}</td><td class="num">${s.renew?day(s.renew):'<span class="hint">Not set</span>'}</td>
        <td><select data-st aria-label="Status for ${esc(s.name)}">${opts(STATUS,s.status)}</select></td>
        <td class="r"><button class="btn line sm" type="button" data-del aria-label="Remove ${esc(s.name)}">×</button></td></tr>`).join("")
        :'<tr><td colspan="7" class="hint">No sponsors yet. Add the local businesses that back your lodge\'s events below.</td></tr>'}
      </tbody></table></div>
      <form class="inline-form" id="spon-form">
        <div class="field grow"><label for="sp-n">Business</label><input id="sp-n" required placeholder="Inlet Hardware"></div>
        <div class="field grow"><label for="sp-c">Contact</label><input id="sp-c" placeholder="Name, phone or email"></div>
        <div class="field"><label for="sp-l">Level</label><select id="sp-l">${opts(LEVELS)}</select></div>
        <div class="field"><label for="sp-a">Per year ($)</label><input id="sp-a" type="number" min="0" step="50" style="max-width:8em"></div>
        <div class="field"><label for="sp-r">Renews</label><input id="sp-r" type="date"></div>
        <div class="field"><label for="sp-s">Status</label><select id="sp-s">${opts(STATUS)}</select></div>
        <button class="btn" type="submit">Add sponsor</button>
      </form></div>`;
    $("#spon-form").addEventListener("submit",e=>{e.preventDefault();const n=$("#sp-n").value.trim();if(!n)return;
      D.sponsors.push({id:uid(),name:n,contact:$("#sp-c").value.trim(),level:$("#sp-l").value,amt:+$("#sp-a").value||0,renew:$("#sp-r").value,status:$("#sp-s").value});renderSpon();changed()});
    $("#p-spon").querySelectorAll("[data-sp]").forEach(r=>{const s=D.sponsors.find(x=>x.id===r.dataset.sp);
      r.querySelector("[data-st]").addEventListener("change",e=>{s.status=e.target.value;renderSpon();changed()});
      r.querySelector("[data-del]").addEventListener("click",()=>{D.sponsors=D.sponsors.filter(x=>x!==s);renderSpon();changed()})});
  }

  /* ---------- Charities: the funds and causes the lodge gives to ---------- */
  const raisedFor=n=>D.treasury.ledger.filter(x=>x.fund===n&&x.kind!=="out").reduce((t,x)=>t+(+x.amt||0),0);
  const givenFor=n=>D.treasury.ledger.filter(x=>x.fund===n&&x.kind==="out").reduce((t,x)=>t+(+x.amt||0),0);
  function syncStore(){const sel=$("#s-charity");if(!sel)return;const v=sel.value;
    sel.innerHTML=opts(D.charities.map(c=>c.name));if(D.charities.some(c=>c.name===v))sel.value=v}
  let chEdit=null;   /* id of the charity being edited, if any */
  function charEditCard(c){
    return `<form class="card ch-edit" data-ch="${esc(c.id)}">
        <h4>Edit charity</h4>
        <div class="field"><label for="che-n">Name</label><input id="che-n" required value="${esc(c.name)}"></div>
        <div class="field"><label for="che-k">Kind</label><select id="che-k">${opts(["Lodge fund","Outside charity"])}</select></div>
        <div class="field"><label for="che-d">About it</label><input id="che-d" value="${esc(c.note||"")}" placeholder="What the money does"></div>
        <p class="hint ch-err" hidden></p>
        <div class="row-acts"><button class="btn sm" type="submit">Save</button><button class="btn line sm" type="button" data-cancel>Cancel</button></div></form>`}
  /* a renamed charity keeps its history: its ledger entries, fundraisers and store orders move to the new name */
  function renameCharity(from,to){
    if(from===to)return;
    D.treasury.ledger.forEach(x=>{if(x.fund===from)x.fund=to});
    A.events.forEach(e=>{if(e.charity===from)e.charity=to});
    A.orders.forEach(o=>{if(o.charity===from)o.charity=to});
  }
  function renderChar(){
    $("#p-char").innerHTML=`<div class="two-col wide-left">
      <div class="fund-grid">${D.charities.length?D.charities.map(c=>{if(c.id===chEdit)return charEditCard(c);
        const fr=fundraisers().filter(e=>e.charity===c.name);
        return `<div class="card" data-ch="${esc(c.id)}"><div class="row-sp"><b>${esc(c.name)}</b><span class="pill${c.kind==="Lodge fund"?"":" gold"}">${esc(c.kind)}</span></div>
          ${c.note?`<span class="hint">${esc(c.note)}</span>`:""}
          <div class="mini-list"><div class="row-sp"><span>Received</span><b class="num">${money(raisedFor(c.name))}</b></div>
            <div class="row-sp"><span>Paid out</span><b class="num">${money(givenFor(c.name))}</b></div>
            <div class="row-sp"><span>Fundraisers</span><b class="num">${fr.length}</b></div></div>
          <div class="row-acts"><button class="btn line sm" type="button" data-edit>Edit</button><button class="btn line sm" type="button" data-del>Delete</button></div></div>`}).join("")
        :'<div class="empty">No charities yet. Add the funds and causes your lodge supports.</div>'}</div>
      <form class="card" id="char-form">
        <h4>Add a charity</h4>
        <div class="field"><label for="ch-n">Name</label><input id="ch-n" required placeholder="Shriners Children's"></div>
        <div class="field"><label for="ch-k">Kind</label><select id="ch-k">${opts(["Lodge fund","Outside charity"])}</select></div>
        <div class="field"><label for="ch-d">About it</label><input id="ch-d" placeholder="What the money does"></div>
        <button class="btn" type="submit">Add charity</button>
        <p class="hint">Each charity becomes a fund in Treasury, a choice for fundraisers, and a "Proceeds support" option in the store.</p>
      </form></div>`;
    $("#char-form").addEventListener("submit",e=>{e.preventDefault();const n=$("#ch-n").value.trim();if(!n||funds().includes(n))return;
      D.charities.push({id:uid(),name:n,kind:$("#ch-k").value,note:$("#ch-d").value.trim()});syncStore();renderChar();changed()});
    $("#p-char").querySelectorAll(".card[data-ch]:not(form)").forEach(card=>{
      const c=D.charities.find(x=>x.id===card.dataset.ch);
      card.querySelector("[data-edit]").addEventListener("click",()=>{chEdit=c.id;renderChar();const i=$("#che-n");if(i)i.focus()});
      card.querySelector("[data-del]").addEventListener("click",()=>{
        if(!confirm(`Delete ${c.name}? Ledger entries already recorded for it stay in Treasury.`))return;
        D.charities=D.charities.filter(x=>x!==c);syncStore();renderChar();changed()})});
    const ef=$("#p-char").querySelector("form.ch-edit");
    if(ef){const c=D.charities.find(x=>x.id===ef.dataset.ch);$("#che-k").value=c.kind;
      ef.querySelector("[data-cancel]").addEventListener("click",()=>{chEdit=null;renderChar()});
      ef.addEventListener("submit",e=>{e.preventDefault();const n=$("#che-n").value.trim(),err=ef.querySelector(".ch-err");
        if(!n)return;
        if(n!==c.name&&funds().includes(n)){err.textContent=`There's already a fund called ${n}.`;err.hidden=false;return}
        renameCharity(c.name,n);Object.assign(c,{name:n,kind:$("#che-k").value,note:$("#che-d").value.trim()});
        chEdit=null;syncStore();renderChar();changed()})}
  }

  /* ---------- Settings ---------- */
  const ROLE={owner:"account owner",officer:"an officer",member:"a member"};
  function renderSet(){
    const plan=$("#plan-line").textContent.split(" · ")[0]||"Lodge Starter";
    $("#set-plan").textContent=CLOUD?`${plan}. ${CLOUD.paid?"Paid up, so the website can be published.":"The website can be published once a paid level is active."}`:`${plan}.`;
    $("#set-role").textContent=CLOUD?`You're signed in as ${CLOUD.email}, ${ROLE[CLOUD.role]||CLOUD.role} of this lodge. Officers can change the dashboard; members can read it.`:"Sign in to manage who can open this dashboard.";
  }

  /* ---------- Merchandise: the order form is demo.js's store; Orders and Products are here ---------- */
  const OSTATUS=["New","Paid","Fulfilled","Cancelled"];
  const linesText=o=>o.lines.map(l=>`${l.q} × ${l.n}${[l.size,l.color].filter(Boolean).length?" ("+[l.size,l.color].filter(Boolean).join(", ")+")":""}${l.pers?` · "${l.pers}"`:""}`);
  function renderOrders(){
    const O=A.orders;
    $("#p-ord").innerHTML=`<div class="table-scroll"><table class="dtable"><thead><tr><th>#</th><th>Date</th><th>Buyer</th><th>Items</th><th>Delivery</th><th class="r">Total</th><th>Paid by</th><th>Status</th></tr></thead><tbody>
      ${O.length?O.map((o,i)=>`<tr data-oi="${i}"><td class="num">${o.no}</td><td class="num">${day(o.d)}</td>
        <td><b>${esc(o.name)}</b>${o.contact?`<br><span class="hint">${esc(o.contact)}</span>`:""}</td>
        <td>${linesText(o).map(esc).join("<br>")}</td>
        <td>${esc(o.get)}${o.addr?`<br><span class="hint">${esc(o.addr)}</span>`:""}</td>
        <td class="r num"><b>${money(o.total)}</b><br><span class="hint">${money(o.toCharity)} to ${esc(o.charity)}</span></td>
        <td>${esc(o.pay)}</td>
        <td><select data-ost aria-label="Status of order ${o.no}">${opts(OSTATUS,o.status)}</select></td></tr>`).join("")
        :'<tr><td colspan="8" class="hint">No orders yet. Take one on the Order form: pick the items, fill in the buyer, and choose how they pay.</td></tr>'}
      </tbody></table></div>
      <p class="hint" style="margin:12px 0 0">Marking an order Paid records it in Treasury: the charity's share to its fund and the rest to the General Fund.</p>`;
    $("#p-ord").querySelectorAll("[data-oi]").forEach(r=>r.querySelector("[data-ost]").addEventListener("change",e=>{
      const o=A.orders[+r.dataset.oi];o.status=e.target.value;
      if(o.status==="Paid"&&!o.booked){o.booked=true;
        const fund=funds().includes(o.charity)?o.charity:"General Fund";
        if(o.toCharity)D.treasury.ledger.push({id:uid(),d:TODAY,desc:`Store order #${o.no} · ${o.name}`,fund,kind:"in",amt:o.toCharity});
        if(o.total-o.toCharity>0)D.treasury.ledger.push({id:uid(),d:TODAY,desc:`Store order #${o.no} · ${o.name}`,fund:"General Fund",kind:"in",amt:o.total-o.toCharity})}
      changed()}));
  }
  const KINDS=[["tee","T-shirt"],["hoodie","Hoodie"],["polo","Polo"],["cap","Cap"],["pin","Pin"],["coin","Coin"],["mug","Mug"],["apron","Apron"],["sticker","Sticker or patch"],["other","Other"]];
  let redraw=null;
  const storeChanged=()=>{clearTimeout(redraw);redraw=setTimeout(()=>{A.renderProducts();changed()},300)};
  function shrink(file){return new Promise((ok,no)=>{const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{const k=Math.min(1,480/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);ok(c.toDataURL("image/jpeg",.8))};
    img.onerror=()=>{URL.revokeObjectURL(url);no(new Error("not an image"))};img.src=url})}
  function renderProd(){
    const P=A.products;
    $("#p-prod").innerHTML=`<div class="row-sp" style="margin-bottom:14px"><p class="hint" style="margin:0">Everything here shows on the Order form and, once published, the lodge store. Hide an item to stop selling it without losing it.</p>
        <button class="btn sm" type="button" id="prod-add">Add a product</button></div>
      <div class="prod-grid">${P.map((p,i)=>`<div class="card prod-edit${p.off?" off":""}" data-pi="${i}">
        <div class="prod-pic">${p.img?`<img src="${esc(p.img)}" alt="">`:`<span class="hint">No photo; the store shows a drawing</span>`}
          <span class="row-acts"><label class="btn line sm">${p.img?"Change photo":"Add photo"}<input type="file" accept="image/*" data-f="img" hidden></label>${p.img?'<button class="btn line sm" type="button" data-act="noimg">Remove photo</button>':""}</span></div>
        <div class="field"><label>Name<input data-f="n" value="${esc(p.n)}"></label></div>
        <div class="pe-row">
          <div class="field"><label>Type<select data-f="kind">${KINDS.map(([k,l])=>`<option value="${k}"${k===p.kind?" selected":""}>${l}</option>`).join("")}</select></label></div>
          <div class="field"><label>Price ($)<input data-f="p" type="number" min="0" step="0.5" value="${+p.p||0}"></label></div>
          <div class="field"><label>To charity ($)<input data-f="margin" type="number" min="0" step="0.5" value="${+p.margin||0}"></label></div>
        </div>
        <div class="field"><label>Sizes<input data-f="sizes" value="${esc(p.sizes||"")}" placeholder="S, M, L, XL"></label></div>
        <div class="field"><label>Colors<input data-f="colors" value="${esc(p.colors||"")}" placeholder="Navy, Gray"></label></div>
        <div class="field"><label>Ask the buyer for<input data-f="pers" value="${esc(p.pers||"")}" placeholder="e.g. Name on the back (leave empty for none)"></label></div>
        <div class="field"><label>Label<input data-f="tag" value="${esc(p.tag||"")}" placeholder="e.g. Best seller"></label></div>
        <div class="row-sp"><label class="field-check"><input type="checkbox" data-f="on"${p.off?"":" checked"}> Show in the store</label><button class="btn line sm" type="button" data-act="del">Delete</button></div>
      </div>`).join("")}</div>`;
    $("#prod-add").addEventListener("click",()=>{P.push({id:uid(),n:"New product",p:20,margin:5,kind:"tee",sizes:"S, M, L, XL",colors:"",pers:"",tag:""});renderProd();storeChanged();
      const last=$("#p-prod .prod-edit:last-child [data-f=n]");if(last){last.focus();last.select()}});
    $("#p-prod").querySelectorAll("[data-pi]").forEach(card=>{const p=P[+card.dataset.pi];
      card.addEventListener("input",e=>{const f=e.target.dataset.f;if(!f||f==="img"||f==="on")return;
        p[f]=e.target.type==="number"?Math.max(0,+e.target.value||0):e.target.value;storeChanged()});
      card.addEventListener("change",async e=>{const f=e.target.dataset.f;
        if(f==="kind")p.kind=e.target.value;
        if(f==="on"){p.off=!e.target.checked;card.classList.toggle("off",p.off)}
        if(f==="img"&&e.target.files[0]){try{p.img=await shrink(e.target.files[0]);renderProd()}catch(err){alert("That file isn't a picture LodgeNet can read.")}}
        storeChanged()});
      card.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
        if(b.dataset.act==="noimg")delete p.img;
        if(b.dataset.act==="del"){if(!confirm(`Delete ${p.n}? Past orders keep their record.`))return;P.splice(P.indexOf(p),1)}
        renderProd();storeChanged()}));
    });
  }
  window.LodgeNetDash.orderPlaced=()=>{if(!$("#p-ord").hidden)renderOrders();changed()};
  document.querySelectorAll("#t-ord,#t-prod").forEach(t=>t.addEventListener("click",()=>t.id==="t-ord"?renderOrders():renderProd()));
  if(A.plan==="starter")document.querySelector('[data-sec="merchandise"] .sub-tabs').hidden=true;

  const RENDER={communications:()=>{if(!$("#p-ann").innerHTML)renderAnn()},treasury:renderTreasury,fundraiser:renderFund,pipelines:renderPipe,
    sponsors:renderSpon,charities:renderChar,settings:renderSet,merchandise:()=>{renderOrders();renderProd()}};

  /* ---------- sidebar: who's signed in, sign out, other lodges ---------- */
  (async()=>{
    const Au=window.LodgeNetAuth;
    if(CLOUD)$("#who-email").textContent=CLOUD.email;else $("#dash-out").hidden=true;
    const out=async()=>{const sb=Au&&await Au.client();if(sb)await sb.auth.signOut();location.href="/login"};
    $("#dash-out").addEventListener("click",out);$("#set-out").addEventListener("click",out);$("#set-out").hidden=!CLOUD;
    if(!CLOUD||!Au)return;
    try{const rows=await Au.myLodges();if(rows.length<2)return;
      const sel=$("#lodge-switch"),slug=(window.LODGE||{}).slug;
      sel.innerHTML=rows.map(({lodge:l})=>`<option value="${esc(l.slug)}"${l.slug===slug?" selected":""}>${esc(l.name+(l.number?" No. "+l.number:""))}</option>`).join("");
      sel.hidden=false;sel.addEventListener("change",()=>location.href="/lodges/"+encodeURIComponent(sel.value));
    }catch(e){}
  })();

  /* keep the figures current as officers edit the original tools */
  ["input","change","click"].forEach(t=>$(".app-main").addEventListener(t,()=>{clearTimeout(kpis.t);kpis.t=setTimeout(()=>kpis(cur),250)}));
  syncStore();renderAnn();route();
})();
