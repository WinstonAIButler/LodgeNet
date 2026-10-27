/* /login: sign in, create an account, reset a password, and for account owners, the lodge roll and invites */
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const A=window.LodgeNetAuth;
  const PLAN={starter:"Lodge Starter",lodge:"Lodge plan",district:"District / Grand Lodge"};
  const ROLE={owner:"Account owner",officer:"Officer",member:"Member"};
  const next=(()=>{const n=new URLSearchParams(location.search).get("next");return n&&n.startsWith("/")&&!n.startsWith("//")?n:null})();
  /* read before the client takes the tokens out of the address */
  const HASH=new URLSearchParams(location.hash.slice(1));
  let recovering=HASH.get("type")==="recovery";
  let sb=null,mode="in";

  function show(id){["loading","v-off","v-out","v-reset","v-in"].forEach(v=>$("#"+v).hidden=v!==id)}
  function msg(el,t,err){el.textContent=t;el.classList.toggle("err",!!err)}
  function setMode(m){
    mode=m;
    $("#m-in").setAttribute("aria-selected",m==="in");$("#m-up").setAttribute("aria-selected",m==="up");
    $("#a-go").textContent=m==="in"?"Sign in":"Create account";
    $("#a-pass").setAttribute("autocomplete",m==="in"?"current-password":"new-password");
    $("#a-pass-hint").hidden=m==="in";$("#a-forgot").hidden=m!=="in";
    msg($("#a-msg"),"");
  }
  const back=()=>location.origin+"/login"+(next?"?next="+encodeURIComponent(next):"");

  async function signedIn(session){
    try{await sb.rpc("claim_invites")}catch(e){}
    if(next){location.replace(next);return}
    $("#head-title").textContent="My lodges";
    $("#head-text").textContent="Open your lodge's dashboard. Edits there save to the lodge account, so every officer sees the same website, calendar, members and minutes.";
    $("#who").textContent="Signed in as "+session.user.email;
    show("v-in");
    renderLodges(session);
  }

  async function renderLodges(session){
    const box=$("#lodges");box.innerHTML='<p class="hint">Loading your lodges…</p>';
    let rows;
    try{rows=await A.myLodges()}
    catch(e){box.innerHTML=`<div class="card auth-gate"><p class="hint">Couldn't load your lodges (${esc(e.message)}). Reload to try again.</p></div>`;return}
    if(!rows.length){
      box.innerHTML=`<div class="card auth-gate"><h3>No lodge on this account yet</h3><p class="hint">You're signed in as ${esc(session.user.email)}, but no lodge has invited that email. Ask your lodge's account owner to invite it, then sign in again. Starting a new lodge? Pick a plan.</p><a class="btn line sm" href="/pricing">See plans</a></div>`;
      return;
    }
    box.innerHTML=rows.map(({role,lodge:l})=>`<div class="card" data-lodge="${esc(l.id)}">
      <div class="lodge-row">
        <div style="display:grid;gap:4px"><b>${esc(l.name)}${l.number?" No. "+esc(l.number):""}</b><span class="hint">${esc([l.city,l.state].filter(Boolean).join(", "))}</span></div>
        <span><span class="pill gold">${esc(PLAN[l.plan]||l.plan)}${l.comped?" · no charge":""}</span> <span class="pill">${esc(ROLE[role]||role)}</span></span>
      </div>
      <a class="btn" href="/lodges/${encodeURIComponent(l.slug)}" style="justify-self:start">Open dashboard</a>
      ${role==="owner"?`<form class="invite code-form" novalidate style="grid-template-columns:minmax(0,1fr) auto">
        <div class="field"><label>Have a plan code?<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="LODGE-XXXX-XXXX"></label></div>
        <button class="btn line sm" type="submit">Redeem</button>
      </form><p class="auth-msg code-msg" role="status" aria-live="polite"></p>
      <div class="roll-box" style="display:grid;gap:10px;margin-top:8px"><p class="hint">Loading the lodge roll…</p></div>`:""}
    </div>`).join("");
    rows.filter(r=>r.role==="owner").forEach(r=>{renderRoll(r.lodge.id,session.user.id);codeForm(r.lodge.id,session)});
    if(location.hash==="#code"){const f=box.querySelector(".code-form input");if(f){f.scrollIntoView({block:"center"});f.focus()}}
  }

  /* account owners: a plan code puts the lodge on that plan at no charge */
  function codeForm(lodgeId,session){
    const card=document.querySelector(`[data-lodge="${lodgeId}"]`),f=card.querySelector(".code-form"),out=card.querySelector(".code-msg");
    f.addEventListener("submit",async e=>{
      e.preventDefault();
      const code=f.code.value.trim();
      if(!code)return msg(out,"Enter the code.",true);
      const {data,error}=await sb.rpc("redeem_plan_code",{lid:lodgeId,c:code});
      if(error)return msg(out,error.message,true);
      await renderLodges(session);
      msg(document.querySelector(`[data-lodge="${lodgeId}"] .code-msg`),`Code accepted. This lodge is on the ${PLAN[data]||data} at no charge.`);
    });
  }

  /* account owners: who can sign in to this lodge, and invites waiting to be claimed */
  async function renderRoll(lodgeId,myId){
    const box=document.querySelector(`[data-lodge="${lodgeId}"] .roll-box`);
    const [m,i]=await Promise.all([
      sb.from("lodge_members").select("user_id,email,role").eq("lodge_id",lodgeId).order("created_at"),
      sb.from("lodge_invites").select("email,role").eq("lodge_id",lodgeId).order("created_at")]);
    if(m.error||i.error){box.innerHTML=`<p class="hint">Couldn't load the lodge roll (${esc((m.error||i.error).message)}).</p>`;return}
    const roleSel=(uid,cur)=>`<select data-uid="${esc(uid)}" aria-label="Role">${["owner","officer","member"].map(r=>`<option value="${r}"${r===cur?" selected":""}>${ROLE[r]}</option>`).join("")}</select>`;
    const rows=m.data.map(x=>x.user_id===myId
        ?`<tr><td class="who">${esc(x.email||"You")} <span class="hint">(you)</span></td><td>${ROLE[x.role]}</td></tr>`
        :`<tr><td class="who">${esc(x.email||"Brother")}</td><td>${roleSel(x.user_id,x.role)} <button class="btn line sm" type="button" data-remove="${esc(x.user_id)}">Remove</button></td></tr>`)
      .concat(i.data.map(x=>`<tr><td class="who">${esc(x.email)} <span class="pill">Invited · ${ROLE[x.role]}</span></td><td><button class="btn line sm" type="button" data-cancel="${esc(x.email)}">Cancel invite</button></td></tr>`));
    box.innerHTML=`<h4>Lodge roll</h4>
      <p class="hint">Officers can change the dashboard; members can read it. Invite a brother by email, then let them know: they choose Create account here with that email and join the lodge once they confirm it.</p>
      <table class="roll"><tbody>${rows.join("")}</tbody></table>
      <form class="invite" novalidate>
        <div class="field"><label>Invite by email<input type="email" name="email" required placeholder="brother@example.com"></label></div>
        <div class="field"><label>Role<select name="role"><option value="officer">Officer</option><option value="member" selected>Member</option></select></label></div>
        <button class="btn sm" type="submit">Invite</button>
      </form>
      <p class="auth-msg" role="status" aria-live="polite"></p>`;
    const out=box.querySelector(".auth-msg"),again=()=>renderRoll(lodgeId,myId);
    const done=(r,ok)=>{if(r.error)msg(out,r.error.message,true);else again().then(()=>msg(box.querySelector(".auth-msg"),ok))};
    box.querySelectorAll("select[data-uid]").forEach(s=>s.addEventListener("change",async()=>
      done(await sb.from("lodge_members").update({role:s.value}).eq("lodge_id",lodgeId).eq("user_id",s.dataset.uid),"Role changed.")));
    box.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm("Remove this brother from the lodge account? They won't be able to sign in to it."))return;
      done(await sb.from("lodge_members").delete().eq("lodge_id",lodgeId).eq("user_id",b.dataset.remove),"Removed.");
    }));
    box.querySelectorAll("[data-cancel]").forEach(b=>b.addEventListener("click",async()=>
      done(await sb.from("lodge_invites").delete().eq("lodge_id",lodgeId).eq("email",b.dataset.cancel),"Invite cancelled.")));
    box.querySelector(".invite").addEventListener("submit",async e=>{
      e.preventDefault();
      const f=e.target,email=f.email.value.trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return msg(out,"Enter the brother's email address.",true);
      done(await sb.from("lodge_invites").upsert({lodge_id:lodgeId,email,role:f.role.value}),`Invited ${email}. Let them know to create an account at ${location.host}/login.`);
    });
  }

  async function init(){
    sb=await A.client();
    if(!sb){show("v-off");return}
    sb.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY"){recovering=true;show("v-reset")}});
    const s=await A.session();
    if(recovering&&s){show("v-reset");return}
    if(s)return signedIn(s);
    show("v-out");
    if(HASH.get("error_description"))msg($("#a-msg"),HASH.get("error_description")+". Try again or ask for a new link.",true);
  }

  $("#m-in").addEventListener("click",()=>setMode("in"));
  $("#m-up").addEventListener("click",()=>setMode("up"));
  $("#f-auth").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#a-msg"),email=$("#a-email").value.trim(),password=$("#a-pass").value;
    if(!email||!password)return msg(out,"Enter your email and password.",true);
    if(mode==="up"&&password.length<8)return msg(out,"Use at least 8 characters for your password.",true);
    $("#a-go").disabled=true;msg(out,mode==="in"?"Signing in…":"Creating your account…");
    try{
      if(mode==="in"){
        const {data,error}=await sb.auth.signInWithPassword({email,password});
        if(error)return msg(out,error.message==="Invalid login credentials"?"That email and password don't match an account.":error.message,true);
        return signedIn(data.session);
      }
      const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:back()}});
      if(error)return msg(out,error.message,true);
      if(data.session)return signedIn(data.session);
      msg(out,`Check ${email} for a confirmation link. It brings you back here signed in.`);
    }finally{$("#a-go").disabled=false}
  });
  $("#a-forgot").addEventListener("click",async()=>{
    const out=$("#a-msg"),email=$("#a-email").value.trim();
    if(!email)return msg(out,"Enter your email above first, then choose Forgot your password.",true);
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:back()});
    msg(out,error?error.message:`If ${email} has an account, a reset link is on its way.`,!!error);
  });
  $("#f-reset").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#r-msg"),password=$("#r-pass").value;
    if(password.length<8)return msg(out,"Use at least 8 characters.",true);
    const {data,error}=await sb.auth.updateUser({password});
    if(error)return msg(out,error.message,true);
    recovering=false;
    const s=await A.session();signedIn(s||{user:data.user});
  });
  $("#sign-out").addEventListener("click",async()=>{await sb.auth.signOut();location.href="/login"});
  setMode("in");
  init();
})();
