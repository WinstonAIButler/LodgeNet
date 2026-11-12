/* Zeffy (zeffy.com): free fundraising and marketing for nonprofits. No platform or card fees for the nonprofit; Zeffy runs on
   optional tips from donors. Used two ways in the lodge dashboard:
   - Settings → Payment options → Zeffy form link: a "Donate with Zeffy" pay button wherever the lodge's pay buttons show
     (store checkout, fundraiser donations, dues and the published website). assets/demo.js adds it to PAY with clean() below.
   - Charities → Nonprofit marketing with Zeffy (render() below): the lodge's Zeffy campaigns (donation forms, event tickets,
     memberships, raffles, peer-to-peer, store), each with a live preview, copy link, open, and "use as the pay button".
   Campaigns save with the lodge's data as zeffy:{campaigns:[…]} (dash.js puts data() in the snapshot).
   Loaded before demo.js, so it touches window.LodgeNetApp only when drawing. */
(function(){
  /* a Zeffy address the lodge pasted: a campaign link, or the whole <iframe> embed code Zeffy's Share → Embed gives */
  function clean(v){
    v=String(v||"").trim();
    const m=v.match(/src=["']([^"']+)["']/i);if(m)v=m[1];
    v=v.replace(/&amp;/g,"&");
    return /^https:\/\/([a-z0-9-]+\.)*zeffy\.com\/[^\s"<>]*$/i.test(v)?v:"";
  }
  const TYPES=[["donation","Donation form"],["event","Event & tickets"],["membership","Membership"],["raffle","Raffle"],["p2p","Peer-to-peer"],["shop","Online store"]];
  const guess=u=>/ticketing|event/i.test(u)?"event":/membership/i.test(u)?"membership":/raffle|lottery/i.test(u)?"raffle":/peer-to-peer|p2p/i.test(u)?"p2p":/shop|store/i.test(u)?"shop":"donation";
  let D=null,preview=null;
  const data=()=>{if(!D){const A=window.LodgeNetApp,c=A&&A.CFG.zeffy;D={campaigns:c&&Array.isArray(c.campaigns)?c.campaigns:[]}}return D};

  function render(){
    const A=window.LodgeNetApp,box=document.getElementById("p-zeffy");if(!A||!box)return;
    const esc=v=>A.esc(v==null?"":v),Z=data(),C=A.CLOUD,canEdit=!C||!!C.canEdit;
    const payEl=document.getElementById("f-zeffy"),pay=payEl?clean(payEl.value):"";
    const tname=k=>(TYPES.find(t=>t[0]===k)||TYPES[0])[1];
    box.innerHTML=`<div class="card zf">
      <div class="row-sp"><h4 style="margin:0">Nonprofit marketing with Zeffy</h4><span class="pill ok">Free · no fees</span></div>
      <p class="hint">Zeffy is a fundraising and marketing platform built only for nonprofits, and it's free: no platform fees and no card fees, because donors may leave Zeffy an optional tip. Use it for your lodge's charitable foundation or any cause with nonprofit status. Zeffy checks that your organization qualifies when you sign up.</p>
      <div class="zf-grid">
        <div class="zf-step"><b>1. Sign up free</b><span class="hint">Create the nonprofit's account and connect its bank account.</span><a class="btn line sm" href="https://www.zeffy.com/" target="_blank" rel="noopener">Open Zeffy</a></div>
        <div class="zf-step"><b>2. Make a campaign</b><span class="hint">A donation form, event tickets for a pancake breakfast, memberships, a raffle, or a peer-to-peer drive.</span></div>
        <div class="zf-step"><b>3. Paste its link here</b><span class="hint">In Zeffy, choose Share, then Copy link (or Embed, and paste the code). It shows below with a preview.</span></div>
        <div class="zf-step"><b>4. Spread the word</b><span class="hint">Use Zeffy's free email campaigns to thank donors and announce events, then put the link on a <a href="#qrcodes">QR code</a>, your website, or <a href="#settings">a tab of your own</a>.</span></div>
      </div>
      <h4 style="margin:6px 0 0">Your Zeffy campaigns</h4>
      ${Z.campaigns.length?`<ul class="zf-list">${Z.campaigns.map(c=>`<li data-zc="${esc(c.id)}">
        <div class="zf-row"><span class="zf-n"><b>${esc(c.name)}</b><small>${esc(tname(c.type))}${c.url===pay?' · <span class="pill ok">Pay button</span>':""}</small></span>
          <span class="zf-acts"><button type="button" class="btn line sm" data-zprev>${preview===c.id?"Hide preview":"Preview"}</button><a class="btn line sm" href="${esc(c.url)}" target="_blank" rel="noopener">Open</a><button type="button" class="btn line sm" data-zcopy>Copy link</button>${canEdit&&c.url!==pay?'<button type="button" class="btn line sm" data-zpay>Use as the pay button</button>':""}${canEdit?'<button type="button" class="btn line sm" data-zdel aria-label="Remove">✕</button>':""}</span></div>
        ${preview===c.id?`<iframe class="zf-frame" src="${esc(c.url)}" title="${esc(c.name)} on Zeffy" loading="lazy" allowpaymentrequest allow="payment"></iframe>`:""}
      </li>`).join("")}</ul>`:'<p class="hint">No Zeffy campaigns added yet.</p>'}
      ${canEdit?`<form class="zf-add" novalidate>
        <div class="field"><label for="zf-name">Name</label><input id="zf-name" maxlength="80" placeholder="e.g. Scholarship Fund"></div>
        <div class="field"><label for="zf-type">Kind</label><select id="zf-type">${TYPES.map(([k,n])=>`<option value="${k}">${n}</option>`).join("")}</select></div>
        <div class="field grow"><label for="zf-url">Zeffy link or embed code</label><input id="zf-url" autocapitalize="off" spellcheck="false" placeholder="https://www.zeffy.com/en-US/donation-form/…"></div>
        <button class="btn sm" type="submit">Add campaign</button>
      </form><p class="auth-msg zf-msg" role="status" aria-live="polite"></p>`:""}
    </div>`;
    const msg=(t,err)=>{const m=box.querySelector(".zf-msg");if(m){m.textContent=t;m.classList.toggle("err",!!err)}};
    const save=()=>A.save();
    const f=box.querySelector(".zf-add");
    if(f){
      const u=f.querySelector("#zf-url");
      u.addEventListener("input",()=>{const c=clean(u.value);if(c)f.querySelector("#zf-type").value=guess(c)});
      f.addEventListener("submit",e=>{e.preventDefault();
        const url=clean(u.value),name=f.querySelector("#zf-name").value.trim();
        if(!url)return msg("Paste a link that starts with https://www.zeffy.com/ (in Zeffy: Share, then Copy link).",true);
        if(Z.campaigns.some(c=>c.url===url))return msg("That campaign is already on the list.",true);
        Z.campaigns.push({id:Date.now().toString(36),name:name||tname(f.querySelector("#zf-type").value),type:f.querySelector("#zf-type").value,url});
        /* the first donation form becomes the pay button if there isn't one yet */
        if(payEl&&!clean(payEl.value)&&f.querySelector("#zf-type").value==="donation"){payEl.value=url;payEl.dispatchEvent(new Event("input",{bubbles:true}))}
        save();render();msg("Added.");
      });
    }
    box.querySelectorAll("[data-zc]").forEach(li=>{
      const c=Z.campaigns.find(x=>x.id===li.dataset.zc);if(!c)return;
      li.querySelector("[data-zprev]").addEventListener("click",()=>{preview=preview===c.id?null:c.id;render()});
      li.querySelector("[data-zcopy]").addEventListener("click",async e=>{try{await navigator.clipboard.writeText(c.url);e.target.textContent="Copied"}catch(err){prompt("Copy this link:",c.url)}});
      const p=li.querySelector("[data-zpay]");if(p)p.addEventListener("click",()=>{if(!payEl)return;payEl.value=c.url;payEl.dispatchEvent(new Event("input",{bubbles:true}));save();render();msg(`"${c.name}" is now the Donate with Zeffy button on the store, fundraisers, dues and your website.`)});
      const d=li.querySelector("[data-zdel]");if(d)d.addEventListener("click",()=>{if(!confirm(`Remove "${c.name}" from this list? It stays on Zeffy.`))return;
        Z.campaigns=Z.campaigns.filter(x=>x!==c);if(payEl&&clean(payEl.value)===c.url){payEl.value="";payEl.dispatchEvent(new Event("input",{bubbles:true}))}
        if(preview===c.id)preview=null;save();render()});
    });
  }

  const css=document.createElement("style");
  css.textContent=`#p-zeffy{padding-bottom:0}.zf{border-top:3px solid #3a49d6}
.zf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.zf-step{display:grid;gap:4px;align-content:start;padding:12px;border:1px solid var(--line);background:var(--bg)}.zf-step .btn{justify-self:start}
.zf-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.zf-list li{border:1px solid var(--line);padding:10px 12px;display:grid;gap:10px}
.zf-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}.zf-n{display:grid}.zf-n small{color:var(--muted)}
.zf-acts{display:flex;flex-wrap:wrap;gap:6px}.zf-frame{width:100%;height:760px;border:1px solid var(--line);background:#fff}
.zf-add{display:flex;flex-wrap:wrap;gap:10px;align-items:end}.zf-add .field{margin:0;flex:1 1 160px}.zf-add .field.grow{flex:3 1 280px}`;
  document.head.appendChild(css);
  window.LodgeNetZeffy={clean,render,data};
})();
