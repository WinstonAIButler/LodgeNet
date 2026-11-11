/* The QR codes tab on lodge.html. Loaded after assets/site-builder.js, which owns the pages and fundraiser ids these codes
   point at (window.LodgeNetSite).

   Each code is printed with a fixed address, /site/<lodge>/qr/<id>, and the published site sends the visitor on to wherever
   the code is assigned: Home, a page, a fundraiser, or any https link. Reassigning a printed code only needs Publish.
   Codes save with the lodge's data as siteQrs [{id,label,to,at}]; Publish sends [{id,to}] and lodge-site.js resolves them. */
(function(){
  const A=window.LodgeNetApp,S=window.LodgeNetSite;
  if(!A||!S||!document.getElementById("qr"))return;
  const $=s=>document.querySelector(s),esc=A.esc,CFG=A.CFG;
  const rid=n=>Math.random().toString(36).slice(2,2+n);
  const qrs=Array.isArray(CFG.siteQrs)?CFG.siteQrs:[];
  const SLUG=S.SLUG,slugify=S.slugify,ensureFids=S.ensureFids;
  /* codes are printed, so they always carry the live domain, even when the dashboard is opened on a preview deploy */
  const ORIGIN=/(^|\.)lodgenet\.app$/i.test(location.hostname)?location.origin:"https://www.lodgenet.app";
  const sitePath=rest=>S.ROOT+(rest?"/"+rest:"");
  const targetOptions=(c,u)=>S.targetOptions(c,u);
  const targetName=t=>{const n=S.linkName(t);return t&&t.startsWith("page:")&&!/deleted/.test(n)?"Page: "+n:t==="home"?"Home page":n};
  /* "" when the page or fundraiser it points at is gone */
  const targetHref=t=>{t=t||"";if(t==="home")return sitePath("");
    if(t.startsWith("page:")){const p=S.pageById(t.slice(5));return p?sitePath(p.slug):""}
    if(t.startsWith("fund:")){const f=S.fundById(t.slice(5));return f?sitePath("fundraiser/"+f.fid):""}
    return S.isUrl(t)?t:""};

  /* ---------- QR codes ---------- */
  const QR=window.qrcode;
  function matrix(text){const q=QR(0,"M");q.addData(text);q.make();const n=q.getModuleCount();return {n,dark:(r,c)=>q.isDark(r,c)}}
  const qrUrl=q=>ORIGIN+sitePath("qr/"+q.id);
  function qrSvg(q,withLabel){
    const m=matrix(qrUrl(q)),pad=4,size=m.n+pad*2,lab=withLabel&&q.label?6:0;let path="";
    for(let r=0;r<m.n;r++)for(let c=0;c<m.n;c++)if(m.dark(r,c))path+=`M${c+pad} ${r+pad}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size+lab}" shape-rendering="crispEdges"><rect width="${size}" height="${size+lab}" fill="#fff"/><path d="${path}" fill="#000"/>`
      +(lab?`<text x="${size/2}" y="${size+2.6}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="2.6" font-weight="700" fill="#000">${esc(q.label)}</text>`:"")+"</svg>";
  }
  function qrPng(q){
    const m=matrix(qrUrl(q)),pad=4,cell=Math.max(8,Math.floor(1000/(m.n+pad*2))),side=(m.n+pad*2)*cell,lab=q.label?Math.round(cell*6):0;
    const c=document.createElement("canvas");c.width=side;c.height=side+lab;const x=c.getContext("2d");
    x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.fillStyle="#000";
    for(let r=0;r<m.n;r++)for(let k=0;k<m.n;k++)if(m.dark(r,k))x.fillRect((k+pad)*cell,(r+pad)*cell,cell,cell);
    if(lab){x.font=`700 ${Math.round(cell*2.4)}px Arial,Helvetica,sans-serif`;x.textAlign="center";x.textBaseline="middle";
      let t=q.label;while(x.measureText(t).width>side-cell*4&&t.length>4)t=t.slice(0,-2)+"…";x.fillText(t,side/2,side+lab*0.35)}
    return c.toDataURL("image/png");
  }
  const fileName=q=>(slugify(q.label||"qr-code")+"-qr");
  function download(href,name){const a=document.createElement("a");a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove()}
  function renderQr(){
    const el=$("#qr");if(!el)return;
    if(!QR){el.innerHTML='<p class="hint">The QR code maker didn\'t load. Refresh the page to try again.</p>';return}
    const live=!!(A.published&&A.published.site);
    el.innerHTML=`<div class="qr-tab"><div class="qr-make"><h4>Make a QR code</h4>
        <div class="field"><label for="qr-label">Name</label><input id="qr-label" placeholder="e.g. Pancake Breakfast flyer" maxlength="60"></div>
        <div class="field"><label for="qr-to">Opens</label><select id="qr-to">${targetOptions("home",true)}</select></div>
        <div class="field" id="qr-url-f" hidden><label for="qr-url">Link</label><input id="qr-url" inputmode="url" placeholder="https://" autocapitalize="off" spellcheck="false"></div>
        <button type="button" class="btn sm" data-qr-make>Make QR code</button>
      ${!SLUG?'<p class="hint">In the demo, codes point at a sample address. A signed-in lodge gets codes for its own site.</p>':!live?'<p class="hint"><span class="pill warn">Site not published</span> Codes open the lodge website, so <a href="#website">publish it from the Website tab</a> before you print them.</p>':""}
      <p class="hint">Each code keeps the same printed address. Change what it opens here any time, then press Publish on the Website tab and printed codes follow.</p>
      </div>
      <div class="qr-list">${qrs.length?qrs.slice().reverse().map(q=>{
        const href=targetHref(q.to),isFund=(q.to||"").startsWith("fund:"),isUrl=S.isUrl(q.to);
        const pub=live&&(A.published.site.qrs||[]).find(x=>x.id===q.id);
        const pending=SLUG&&live&&(!pub||pub.to!==q.to);
        return `<div class="qr-card" data-qr="${esc(q.id)}">
          <img class="qr-img" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(q,false))}" alt="QR code for ${esc(q.label||"the lodge website")}" width="120" height="120">
          <div class="qr-info">
            <div class="row-sp"><b>${esc(q.label||"QR code")}</b><span class="pill${isFund?" gold":""}">${isFund?"Fundraiser":"General"}</span></div>
            <span class="hint">Opens ${esc(targetName(q.to))}${href?"":" (it opens Home until you choose again)"}</span>
            <span class="hint mono">${esc(qrUrl(q).replace(/^https:\/\//,""))}</span>
            ${pending?'<span class="hint"><span class="pill warn">Unpublished change</span> <a href="#website">Publish the site</a> and printed codes follow.</span>':""}
            <div class="row-acts"><select data-qr-to aria-label="What ${esc(q.label||"this code")} opens">${targetOptions(isUrl?"url":q.to,true)}</select>
              <input data-qr-url value="${esc(isUrl?q.to:"")}" placeholder="https://" inputmode="url" aria-label="Link"${isUrl?"":" hidden"}></div>
            <div class="row-acts"><button type="button" class="btn line sm" data-qr-png>Download PNG</button><button type="button" class="btn line sm" data-qr-svg>Download SVG</button>
              <a class="btn line sm" href="${esc(qrUrl(q))}" target="_blank" rel="noopener">Test it</a><button type="button" class="btn line sm" data-qr-del>Delete</button></div>
          </div></div>`}).join(""):'<p class="empty">No QR codes yet. Make one on the left.</p>'}</div></div>`;
  }
  /* a fundraiser card on the Fundraiser tab can ask for a code */
  function makeQr(to,label){
    ensureFids();
    let id;do id=rid(6);while(qrs.some(q=>q.id===id));
    const q={id,label:String(label||"").trim().slice(0,60),to,at:new Date().toISOString()};
    qrs.push(q);renderQr();A.save();if(window.LodgeNetDash&&location.hash==="#qrcodes")window.dispatchEvent(new Event("hashchange"));return q;
  }
  const qbox=$("#qr");
  qbox.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName==="INPUT"){e.preventDefault();if(e.target.closest(".qr-make"))qbox.querySelector("[data-qr-make]").click()}});
  qbox.addEventListener("change",e=>{
    const t=e.target;
    if(t.id==="qr-to"){$("#qr-url-f").hidden=t.value!=="url";const lb=$("#qr-label");
      if(!lb.value.trim()&&t.value!=="url"&&t.value!=="home")lb.value=targetName(t.value).replace(/^(Page|Fundraiser): /,"");return}
    const card=t.closest("[data-qr]"),q=card&&qrs.find(x=>x.id===card.dataset.qr);if(!q)return;
    if(t.matches("[data-qr-to]")){if(t.value==="url"){card.querySelector("[data-qr-url]").hidden=false;card.querySelector("[data-qr-url]").focus();return}
      q.to=t.value;renderQr();A.save()}
    if(t.matches("[data-qr-url]")){const v=cleanUrl(t.value);if(!v)return alert("Enter a full web address that starts with https://");q.to=v;renderQr();A.save()}
  });
  const cleanUrl=v=>{v=String(v||"").trim();if(!v)return "";if(!/^https?:\/\//i.test(v))v="https://"+v;v=v.replace(/^http:/i,"https:");return /^https:\/\/[^\s/"<>]+\.[^\s"<>]+$/i.test(v)?v:""};
  qbox.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t)return;
    if("qrMake" in t.dataset){let to=$("#qr-to").value;
      if(to==="url"){to=cleanUrl($("#qr-url").value);if(!to){$("#qr-url").focus();return alert("Enter a full web address that starts with https://")}}
      const label=$("#qr-label").value.trim()||(to==="home"?"Lodge website":targetName(to).replace(/^(Page|Fundraiser): /,""));
      makeQr(to,label);return}
    const card=t.closest("[data-qr]"),q=card&&qrs.find(x=>x.id===card.dataset.qr);if(!q)return;
    if("qrPng" in t.dataset)return download(qrPng(q),fileName(q)+".png");
    if("qrSvg" in t.dataset)return download("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(qrSvg(q,true)),fileName(q)+".svg");
    if("qrDel" in t.dataset){if(!confirm(`Delete the QR code "${q.label||"QR code"}"? Codes already printed will stop working once you publish.`))return;
      qrs.splice(qrs.indexOf(q),1);renderQr();A.save()}
  });

  Object.assign(S,{
    qrSnapshot:()=>({siteQrs:qrs}),
    qrPublic:()=>qrs.map(q=>({id:q.id,to:q.to})),
    /* codes that pointed at a deleted page open Home until they're reassigned */
    pageDeleted(id){qrs.forEach(q=>{if(q.to==="page:"+id)q.to="home"});A.save()},
    qrForFund(e){ensureFids();const ex=qrs.find(q=>q.to==="fund:"+e.fid);const q=ex||makeQr("fund:"+e.fid,e.t);
      location.hash="qrcodes";setTimeout(()=>{const c=document.querySelector(`[data-qr="${q.id}"]`);if(c)c.scrollIntoView({behavior:"smooth",block:"center"})},80)},
    renderQr
  });
  renderQr();
  window.addEventListener("hashchange",()=>{if(location.hash==="#qrcodes")renderQr()});
})();
