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
  window.LodgeNetDash={snapshot:()=>({treasury:D.treasury,sponsors:D.sponsors,pipeline:D.pipeline,announcements:D.announcements,charities:D.charities})};
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
  const route=()=>{const h=location.hash.slice(1);show(h||"website");if(h==="minutes"){const t=$("#t-min");if(t)t.click()}};
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
      website:[["Website",CLOUD&&!CLOUD.paid?"Preview only":"Ready to publish",CLOUD&&!CLOUD.paid?"Publishing comes with a paid level":"Publish from the Website form"],
        ["Plan",($("#plan-line").textContent.split(" · ")[0]||"Lodge Starter"),"Change it under Settings"],
        ["Upcoming events",up.length,"On the calendar"],["Officer chairs",`${seats} of ${A.SEATS.length}`,"Filled on Members"]],
      members:[["Members",act.length,"On the roll"],["Master Masons",act.filter(m=>m.deg==="Master Mason").length,"Eligible for office"],
        ["Past Masters",act.filter(m=>m.pm).length,""],["Dues owed",owe.length,paid.length+" paid"]],
      communications:[["Next Stated",A.nextStated?day(A.nextStated):"Not set","From the meeting schedule"],["Upcoming events",up.length,""],
        ["Minutes to approve",A.minutes.filter(m=>m.status!=="Approved").length,A.minutes.filter(m=>m.status==="Approved").length+" approved"],
        ["Announcements",D.announcements.filter(a=>a.status==="Posted").length,D.announcements.filter(a=>a.status!=="Posted").length+" drafts"]],
      treasury:[["Balance",money(ledgerSum()),"All funds, from the ledger"],["Dues collected",money(paid.length*D.treasury.dues),many(paid.length,"brother")+" paid"],
        ["Dues outstanding",money(owe.length*D.treasury.dues),many(owe.length,"brother")+" owe"],["Fundraising",money(raised),many(fr.length,"fundraiser")]],
      fundraiser:[["Active",fr.filter(e=>e.d>=TODAY).length,"Upcoming fundraisers"],["Raised",money(raised),"All fundraisers"],
        ["Goal",money(fr.reduce((t,e)=>t+(+e.goal||0),0)),fr.length?Math.round(raised/Math.max(1,fr.reduce((t,e)=>t+(+e.goal||0),0))*100)+"% of goal":""],
        ["RSVPs",fr.reduce((t,e)=>t+(+e.rsvp||0),0),""]],
      pipelines:[["In progress",D.pipeline.filter(c=>c.stage<STAGES.length-1).length,"Inquiries to Fellowcraft"],["Petitions",D.pipeline.filter(c=>c.stage>=1&&c.stage<=3).length,"Received, investigating or at ballot"],
        ["In degrees",D.pipeline.filter(c=>c.stage===4||c.stage===5).length,"Entered Apprentice or Fellowcraft"],["Raised",D.pipeline.filter(c=>c.stage===STAGES.length-1).length,"Master Masons"]],
      sponsors:[["Active sponsors",live.length,""],["Yearly support",money(live.reduce((t,s)=>t+(+s.amt||0),0)),"From active sponsors"],
        ["Renewals due",live.filter(s=>s.renew&&s.renew<=soon).length,"In the next 60 days"],["Prospects",D.sponsors.filter(s=>s.status==="Prospect").length,""]],
      merchandise:[["Products",A.products.length,"In the lodge store"],["To charity",money(A.products.reduce((t,p)=>t+p.margin,0)/Math.max(1,A.products.length)),"Average per item"],
        ["Proceeds support",($("#s-charity")||{}).value||"","Pick on the left"],["Payments",["#f-pp","#f-venmo","#f-cash"].filter(f=>$(f)&&$(f).value.trim()).length+" of 3","Accounts linked on Website"]],
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

  /* ---------- Pipelines: from first inquiry to Master Mason ---------- */
  const STAGES=["Inquiry","Petition received","Investigation","Ballot","Entered Apprentice","Fellowcraft","Master Mason"];
  const DEGREE={4:"Entered Apprentice",5:"Fellowcraft",6:"Master Mason"};
  function renderPipe(){
    $("#p-pipe").innerHTML=`<form class="inline-form card" id="pipe-form">
        <div class="field grow"><label for="pp-n">Name</label><input id="pp-n" required placeholder="Full name"></div>
        <div class="field grow"><label for="pp-c">Phone or email</label><input id="pp-c"></div>
        <div class="field grow"><label for="pp-r">Recommended by</label><input id="pp-r" placeholder="Brother's name"></div>
        <button class="btn" type="submit">Add inquiry</button>
      </form>
      <div class="board">${STAGES.map((st,i)=>{const cs=D.pipeline.filter(c=>c.stage===i);
        return `<div class="col"><div class="col-h"><b>${st}</b><span class="pill">${cs.length}</span></div>${cs.map(c=>`<div class="pcard" data-pc="${esc(c.id)}">
          <b>${esc(c.name)}</b>${c.contact?`<span class="hint">${esc(c.contact)}</span>`:""}${c.by?`<span class="hint">Recommended by ${esc(c.by)}</span>`:""}
          <span class="hint">Since ${day(c.d)}</span>
          <div class="row-acts">${i>0?'<button class="btn line sm" type="button" data-act="back" aria-label="Move back">‹</button>':""}
            ${i<STAGES.length-1?'<button class="btn line sm" type="button" data-act="fwd">Next ›</button>':""}
            <button class="btn line sm" type="button" data-act="del" aria-label="Remove">×</button></div>
          ${c.member?'<span class="pill ok">On the roster</span>':""}</div>`).join("")}</div>`}).join("")}</div>
      <p class="hint">Once a candidate is initiated, moving him to Entered Apprentice adds him to the roster, and later stages update his degree there.</p>`;
    $("#pipe-form").addEventListener("submit",e=>{e.preventDefault();const n=$("#pp-n").value.trim();if(!n)return;
      D.pipeline.push({id:uid(),name:n,contact:$("#pp-c").value.trim(),by:$("#pp-r").value.trim(),stage:0,d:TODAY});renderPipe();changed()});
    $("#p-pipe").querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const id=b.closest("[data-pc]").dataset.pc,c=D.pipeline.find(x=>x.id===id);if(!c)return;
      if(b.dataset.act==="del")D.pipeline=D.pipeline.filter(x=>x!==c);
      else{c.stage=Math.max(0,Math.min(STAGES.length-1,c.stage+(b.dataset.act==="fwd"?1:-1)));c.d=TODAY;
        const deg=DEGREE[c.stage],m=c.member&&A.member(c.member);
        if(deg&&m){m.deg=deg;A.refresh()}
        else if(deg&&!m){c.member=A.addMember(c.name,deg).id}}
      renderPipe();changed()}));
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
  function renderChar(){
    $("#p-char").innerHTML=`<div class="two-col wide-left">
      <div class="fund-grid">${D.charities.length?D.charities.map(c=>{const fr=fundraisers().filter(e=>e.charity===c.name);
        return `<div class="card" data-ch="${esc(c.id)}"><div class="row-sp"><b>${esc(c.name)}</b><span class="pill${c.kind==="Lodge fund"?"":" gold"}">${esc(c.kind)}</span></div>
          ${c.note?`<span class="hint">${esc(c.note)}</span>`:""}
          <div class="mini-list"><div class="row-sp"><span>Received</span><b class="num">${money(raisedFor(c.name))}</b></div>
            <div class="row-sp"><span>Paid out</span><b class="num">${money(givenFor(c.name))}</b></div>
            <div class="row-sp"><span>Fundraisers</span><b class="num">${fr.length}</b></div></div>
          <div class="row-acts"><button class="btn line sm" type="button" data-del>Remove</button></div></div>`}).join("")
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
    $("#p-char").querySelectorAll("[data-ch]").forEach(card=>card.querySelector("[data-del]").addEventListener("click",()=>{
      const c=D.charities.find(x=>x.id===card.dataset.ch);
      if(!confirm(`Remove ${c.name}? Ledger entries already recorded for it stay in Treasury.`))return;
      D.charities=D.charities.filter(x=>x!==c);syncStore();renderChar();changed()}));
  }

  /* ---------- Settings ---------- */
  const ROLE={owner:"account owner",officer:"an officer",member:"a member"};
  function renderSet(){
    const plan=$("#plan-line").textContent.split(" · ")[0]||"Lodge Starter";
    $("#set-plan").textContent=CLOUD?`${plan}. ${CLOUD.paid?"Paid up, so the website can be published.":"The website can be published once a paid level is active."}`:`${plan}.`;
    $("#set-role").textContent=CLOUD?`You're signed in as ${CLOUD.email}, ${ROLE[CLOUD.role]||CLOUD.role} of this lodge. Officers can change the dashboard; members can read it.`:"Sign in to manage who can open this dashboard.";
  }

  const RENDER={communications:()=>{if(!$("#p-ann").innerHTML)renderAnn()},treasury:renderTreasury,fundraiser:renderFund,pipelines:renderPipe,
    sponsors:renderSpon,charities:renderChar,settings:renderSet};

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
