/* /owner: the LodgeNet owner's hub. Every lodge, account and plan code, read and changed through the admin_*
   functions in supabase/owner-hub.sql. Those functions refuse anyone who isn't in platform_admins, so hiding
   this page is only a courtesy; the database is what keeps it private. */
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const A=window.LodgeNetAuth;
  const PLAN={starter:"Lodge Starter",lodge:"Lodge plan",district:"District / Grand Lodge"};
  const PRICE={starter:0,lodge:19};            // per month, as on /pricing; District is quoted
  const ROLE={owner:"Account owner",officer:"Officer",member:"Member"};
  const day=t=>t?new Date(t).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}):"Never";
  let sb=null;

  function show(id){["loading","v-off","v-out","v-no","v-in"].forEach(v=>$("#"+v).hidden=v!==id)}
  function msg(el,t,err){el.textContent=t;el.classList.toggle("err",!!err)}
  const planOpts=cur=>Object.keys(PLAN).map(p=>`<option value="${p}"${p===cur?" selected":""}>${PLAN[p]}</option>`).join("");
  async function call(fn,args){const {data,error}=await sb.rpc(fn,args);if(error)throw error;return data}

  async function signedIn(s){
    $("#sign-out").hidden=false;
    let ok=false;
    try{ok=await call("is_platform_admin")}catch(e){}
    if(!ok){
      $("#no-text").textContent=`You're signed in as ${s.user.email}, which can't open the owner's hub.`;
      return show("v-no");
    }
    $("#who").textContent="Signed in as "+s.user.email;
    show("v-in");
    refresh();renderStripe();
  }

  async function refresh(){
    try{
      const [lodges,users,codes]=await Promise.all([call("admin_lodges"),call("admin_users"),call("admin_codes")]);
      renderStats(lodges,users,codes);renderLodges(lodges);renderCodes(codes);renderUsers(users);
    }catch(e){msg($("#lodge-msg"),"Couldn't load the hub ("+e.message+"). Reload to try again.",true)}
  }

  const live=c=>(!c.expires_at||new Date(c.expires_at)>new Date())&&(c.max_uses==null||c.uses<c.max_uses);
  function renderStats(lodges,users,codes){
    const paying=lodges.filter(l=>!l.comped&&PRICE[l.plan]>0);
    const mrr=paying.reduce((n,l)=>n+PRICE[l.plan],0);
    const stat=(n,label,sub)=>`<div class="card hub-stat"><span class="hint">${esc(label)}</span><b class="num">${esc(n)}</b>${sub?`<span class="hint">${esc(sub)}</span>`:""}</div>`;
    $("#stats").innerHTML=[
      stat(lodges.length,"Lodges",lodges.filter(l=>l.plan==="lodge").length+" on the Lodge plan"),
      stat(paying.length,"Paying lodges",lodges.filter(l=>l.comped).length+" at no charge"),
      stat("$"+mrr,"Monthly, at list price","Before Stripe is live"),
      stat(users.length,"Accounts",users.filter(u=>!u.confirmed).length+" waiting on email confirmation"),
      stat(codes.filter(live).length,"Live plan codes",codes.reduce((n,c)=>n+c.uses,0)+" redeemed")].join("");
  }

  function renderLodges(rows){
    const box=$("#lodges");
    if(!rows.length){box.innerHTML='<tr><td colspan="6" class="hint">No lodges yet.</td></tr>';return}
    box.innerHTML=rows.map(l=>`<tr data-id="${esc(l.id)}">
      <td class="nm"><a href="/lodges/${encodeURIComponent(l.slug)}">${esc(l.name)}${l.number?" No. "+esc(l.number):""}</a><br><span class="hint">${esc([l.city,l.state].filter(Boolean).join(", "))}</span></td>
      <td><select class="l-plan" aria-label="Plan">${planOpts(l.plan)}</select></td>
      <td><input type="checkbox" class="l-comp" aria-label="No charge"${l.comped?" checked":""}></td>
      <td class="num">${l.members}${l.invites?` <span class="hint">+${l.invites} invited</span>`:""}</td>
      <td>${l.owners.length?l.owners.map(esc).join("<br>"):'<span class="pill warn">None</span>'}</td>
      <td class="hint">${l.updated_at&&l.updated_at!==l.created_at?day(l.updated_at):"Not yet"}</td></tr>`).join("");
    box.querySelectorAll("tr[data-id]").forEach(tr=>{
      const save=async()=>{
        const out=$("#lodge-msg");
        try{
          await call("admin_set_plan",{lid:tr.dataset.id,p:tr.querySelector(".l-plan").value,is_comped:tr.querySelector(".l-comp").checked});
          await refresh();msg(out,"Saved.");
        }catch(e){msg(out,e.message,true)}
      };
      tr.querySelector(".l-plan").addEventListener("change",save);
      tr.querySelector(".l-comp").addEventListener("change",save);
    });
  }

  function renderCodes(rows){
    const box=$("#codes");
    if(!rows.length){box.innerHTML='<tr><td colspan="6" class="hint">No plan codes yet.</td></tr>';return}
    box.innerHTML=rows.map(c=>`<tr>
      <td class="mono">${esc(c.code)} ${live(c)?"":'<span class="pill">Ended</span>'}</td>
      <td>${esc(PLAN[c.plan]||c.plan)}</td>
      <td class="num">${c.uses} of ${c.max_uses==null?"unlimited":c.max_uses}</td>
      <td class="hint">${c.expires_at?day(c.expires_at):"Never"}</td>
      <td>${esc(c.note||"")}</td>
      <td>${live(c)?`<button class="btn line sm" type="button" data-end="${esc(c.code)}">End code</button>`:""}</td></tr>`).join("");
    box.querySelectorAll("[data-end]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm(`End ${b.dataset.end}? It stops working now. Lodges that already used it keep their plan.`))return;
      try{await call("admin_end_code",{c:b.dataset.end});refresh()}catch(e){alert(e.message)}
    }));
  }

  function renderUsers(rows){
    $("#acct-count").textContent=rows.length+(rows.length===1?" account":" accounts");
    const box=$("#users");
    if(!rows.length){box.innerHTML='<tr><td colspan="4" class="hint">No accounts yet.</td></tr>';return}
    box.innerHTML=rows.map(u=>`<tr>
      <td class="nm">${esc(u.email)} ${u.confirmed?"":'<span class="pill warn">Unconfirmed</span>'}</td>
      <td>${u.lodges.length?u.lodges.map(l=>`${esc(l.name)}${l.number?" No. "+esc(l.number):""} <span class="hint">${esc(ROLE[l.role]||l.role)}</span>`).join("<br>"):'<span class="hint">None</span>'}</td>
      <td class="hint">${day(u.created_at)}</td>
      <td class="hint">${day(u.last_sign_in_at)}</td></tr>`).join("");
  }

  /* the Stripe key goes in and never comes back out: the server only reports its kind, mode and last four */
  async function renderStripe(){
    const out=$("#stripe-status");
    try{
      const [k]=await call("admin_stripe_key_status");
      $("#s-clear").hidden=!k;$("#s-go").textContent=k?"Replace key":"Save key";
      out.innerHTML=k?`<span class="pill ${k.mode==="live"?"ok":"warn"}">${k.mode==="live"?"Live":"Test mode"}</span> ${k.kind==="restricted"?"Restricted":"Secret"} key ending in <b class="mono">${esc(k.last4)}</b> <span class="hint">· saved ${day(k.updated_at)}</span>`
        :'<span class="pill">Not set</span> <span class="hint">No Stripe key saved yet.</span>';
    }catch(e){out.innerHTML=`<span class="hint">Couldn't check the Stripe key (${esc(e.message)}).</span>`}
  }
  $("#f-stripe").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#s-msg"),k=$("#s-key").value.trim();
    if(/^pk_/.test(k))return msg(out,"That's the publishable key. Paste the secret (sk_) or restricted (rk_) key instead.",true);
    if(!/^(sk|rk)_(test|live)_/.test(k))return msg(out,"Paste a Stripe key that starts with sk_ or rk_.",true);
    try{await call("admin_set_stripe_key",{k});$("#s-key").value="";await renderStripe();msg(out,"Saved. The key is stored on the server and won't be shown again.")}
    catch(err){msg(out,err.message,true)}
  });
  $("#s-clear").addEventListener("click",async()=>{
    if(!confirm("Remove the saved Stripe key? Billing stops working until a new key is saved."))return;
    try{await call("admin_clear_stripe_key");await renderStripe();msg($("#s-msg"),"Removed.")}catch(e){msg($("#s-msg"),e.message,true)}
  });

  /* LODGE-XXXX-XXXX from an alphabet without look-alikes */
  function newCode(plan){
    const abc="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",r=crypto.getRandomValues(new Uint32Array(8));
    const s=Array.from(r,n=>abc[n%abc.length]).join("");
    return (plan==="starter"?"START":plan==="district"?"DIST":"LODGE")+"-"+s.slice(0,4)+"-"+s.slice(4);
  }

  $("#l-plan").innerHTML=planOpts("lodge");
  $("#c-plan").innerHTML=planOpts("lodge");
  $("#c-code").value=newCode("lodge");
  $("#c-plan").addEventListener("change",()=>{$("#c-code").value=newCode($("#c-plan").value)});
  const slugify=()=>[$("#l-name").value.replace(/\blodge\b/i,""),$("#l-num").value].join(" ").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  let slugTouched=false;
  $("#l-slug").addEventListener("input",()=>{slugTouched=true});
  ["#l-name","#l-num"].forEach(s=>$(s).addEventListener("input",()=>{if(!slugTouched)$("#l-slug").value=slugify()}));

  $("#f-lodge").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#l-msg"),slug=$("#l-slug").value.trim().toLowerCase(),owner=$("#l-owner").value.trim();
    if(!$("#l-name").value.trim())return msg(out,"Enter the lodge's name.",true);
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))return msg(out,"Use lower-case letters, numbers and dashes for the page address.",true);
    if(owner&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner))return msg(out,"Check the account owner's email.",true);
    try{
      await call("admin_add_lodge",{s:slug,n:$("#l-name").value,num:$("#l-num").value,ci:$("#l-city").value,st:$("#l-state").value.toUpperCase(),gl:$("#l-gl").value,p:$("#l-plan").value,owner_email:owner});
      e.target.reset();slugTouched=false;$("#l-plan").value="lodge";
      await refresh();msg(out,`Added. Its page goes at /lodges/${slug}.`);
    }catch(err){msg(out,/duplicate/.test(err.message)?"A lodge already uses that page address.":err.message,true)}
  });

  $("#f-code").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#c-msg"),code=$("#c-code").value.trim().toUpperCase(),max=$("#c-max").value,exp=$("#c-exp").value;
    if(code.length<6)return msg(out,"Use at least 6 characters for the code.",true);
    try{
      await call("admin_add_code",{c:code,p:$("#c-plan").value,max_uses:max?parseInt(max,10):null,expires_at:exp?new Date(exp+"T23:59:59").toISOString():null,note:$("#c-note").value});
      $("#c-note").value="";$("#c-exp").value="";$("#c-code").value=newCode($("#c-plan").value);
      await refresh();msg(out,`Created ${code}. Share it privately; a lodge's account owner enters it under My lodges.`);
    }catch(err){msg(out,/duplicate/.test(err.message)?"That code already exists.":err.message,true)}
  });

  $("#f-auth").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#a-msg"),email=$("#a-email").value.trim(),password=$("#a-pass").value;
    if(!email||!password)return msg(out,"Enter your email and password.",true);
    $("#a-go").disabled=true;msg(out,"Signing in…");
    try{
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error)return msg(out,error.message==="Invalid login credentials"?"That email and password don't match an account.":error.message,true);
      msg(out,"");signedIn(data.session);
    }finally{$("#a-go").disabled=false}
  });
  $("#a-forgot").addEventListener("click",async()=>{
    const out=$("#a-msg"),email=$("#a-email").value.trim();
    if(!email)return msg(out,"Enter your email above first, then choose Forgot your password.",true);
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/login?next=/owner"});
    msg(out,error?error.message:`If ${email} has an account, a reset link is on its way.`,!!error);
  });
  $("#sign-out").addEventListener("click",async()=>{await sb.auth.signOut();location.reload()});

  (async()=>{
    sb=await A.client();
    if(!sb)return show("v-off");
    const s=await A.session();
    if(s)return signedIn(s);
    show("v-out");
  })();
})();
