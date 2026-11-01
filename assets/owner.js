/* /owner: the LodgeNet master dashboard. Every lodge, account and plan code, read, changed and deleted through the admin_*
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
  let sb=null,meId=null;

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
    meId=s.user.id;
    $("#who").textContent="Signed in as "+s.user.email;
    show("v-in");
    refresh();renderStripe();
  }

  let data={lodges:[],users:[],codes:[]},open=new Set();
  async function refresh(){
    try{
      const [lodges,users,codes]=await Promise.all([call("admin_lodges"),call("admin_users"),call("admin_codes")]);
      data={lodges,users,codes};
      renderStats();renderAttention();renderLodges();renderCodes(codes);renderUsers();
    }catch(e){msg($("#lodge-msg"),"Couldn't load the dashboard ("+e.message+"). Reload to try again.",true)}
  }

  const live=c=>(!c.expires_at||new Date(c.expires_at)>new Date())&&(c.max_uses==null||c.uses<c.max_uses);
  const PAYING=["active","trialing"],OWED=["past_due","unpaid"];
  const BILL={active:"Paid",trialing:"Trial",past_due:"Payment due",unpaid:"Unpaid",canceled:"Cancelled",incomplete:"Incomplete",incomplete_expired:"Expired"};
  const lodgeName=l=>l.name+(l.number?" No. "+l.number:"");
  function renderStats(){
    const {lodges,users,codes}=data;
    const paying=lodges.filter(l=>!l.comped&&PAYING.includes(l.billing_status));
    const week=Date.now()-7*864e5;
    const stat=(n,label,sub)=>`<div class="card hub-stat"><span class="hint">${esc(label)}</span><b class="num">${esc(n)}</b>${sub?`<span class="hint">${esc(sub)}</span>`:""}</div>`;
    $("#stats").innerHTML=[
      stat(lodges.length,"Lodges",lodges.filter(l=>l.has_dashboard).length+" with a saved dashboard"),
      stat(paying.length,"Paying lodges",lodges.filter(l=>l.comped).length+" at no charge"),
      stat("$"+paying.reduce((n,l)=>n+(PRICE[l.plan]||0),0),"Monthly, at list price",paying.length?"From Stripe subscriptions":"No paid subscriptions yet"),
      stat(users.length,"Accounts",users.filter(u=>new Date(u.created_at)>week).length+" new this week"),
      stat(users.filter(u=>u.last_sign_in_at&&new Date(u.last_sign_in_at)>week).length,"Signed in this week",users.filter(u=>!u.last_sign_in_at).length+" never signed in"),
      stat(codes.filter(live).length,"Live plan codes",codes.reduce((n,c)=>n+c.uses,0)+" redeemed")].join("");
  }

  /* things worth a look: lodges nobody can run, unpaid bills, accounts stuck before confirming */
  function renderAttention(){
    const {lodges,users}=data,items=[];
    lodges.filter(l=>!l.owners.length).forEach(l=>items.push(`<b>${esc(lodgeName(l))}</b> has no account owner. Open Manage to invite one.`));
    lodges.filter(l=>OWED.includes(l.billing_status)).forEach(l=>items.push(`<b>${esc(lodgeName(l))}</b>: Stripe says ${esc(BILL[l.billing_status].toLowerCase())}.`));
    users.filter(u=>!u.confirmed).forEach(u=>items.push(`<b>${esc(u.email)}</b> hasn't confirmed their email. You can confirm it for them under Accounts.`));
    users.filter(u=>u.blocked).forEach(u=>items.push(`<b>${esc(u.email)}</b> is blocked from signing in.`));
    $("#attention-sec").hidden=!items.length;
    $("#attention").innerHTML=items.map(t=>`<li>${t}</li>`).join("");
  }

  const query=()=>$("#q").value.trim().toLowerCase();
  const hit=(q,...xs)=>!q||xs.some(x=>String(x||"").toLowerCase().includes(q));

  function renderLodges(){
    const box=$("#lodges"),q=query();
    const rows=data.lodges.filter(l=>hit(q,l.name,l.number,l.city,l.state,l.slug,...l.owners));
    if(!rows.length){box.innerHTML=`<tr><td colspan="8" class="hint">${data.lodges.length?"No lodge matches that search.":"No lodges yet."}</td></tr>`;return}
    box.innerHTML=rows.map(l=>`<tr data-id="${esc(l.id)}">
      <td class="nm"><a href="/lodges/${encodeURIComponent(l.slug)}">${esc(lodgeName(l))}</a><br><span class="hint">${esc([l.city,l.state].filter(Boolean).join(", "))}</span></td>
      <td><select class="l-plan" aria-label="Plan for ${esc(lodgeName(l))}">${planOpts(l.plan)}</select></td>
      <td><input type="checkbox" class="l-comp" aria-label="No charge for ${esc(lodgeName(l))}"${l.comped?" checked":""}></td>
      <td>${l.billing_status?`<span class="pill ${PAYING.includes(l.billing_status)?"ok":OWED.includes(l.billing_status)?"warn":""}">${esc(BILL[l.billing_status]||l.billing_status)}</span>`:'<span class="hint">None</span>'}</td>
      <td class="num">${l.members}${l.invites?` <span class="hint">+${l.invites} invited</span>`:""}</td>
      <td>${l.owners.length?l.owners.map(esc).join("<br>"):'<span class="pill warn">None</span>'}</td>
      <td class="hint">${l.has_dashboard?day(l.updated_at):"Not yet"}</td>
      <td><button class="btn line sm l-manage" type="button" aria-expanded="${open.has(l.id)}">${open.has(l.id)?"Close":"Manage"}</button></td></tr>
      ${open.has(l.id)?`<tr class="hub-detail" data-detail="${esc(l.id)}"><td colspan="8"><div class="hub-detail-in"><p class="hint">Loading…</p></div></td></tr>`:""}`).join("");
    box.querySelectorAll("tr[data-id]").forEach(tr=>{
      const id=tr.dataset.id;
      const save=async()=>{
        const out=$("#lodge-msg");
        try{
          await call("admin_set_plan",{lid:id,p:tr.querySelector(".l-plan").value,is_comped:tr.querySelector(".l-comp").checked});
          await refresh();msg(out,"Saved.");
        }catch(e){msg(out,e.message,true)}
      };
      tr.querySelector(".l-plan").addEventListener("change",save);
      tr.querySelector(".l-comp").addEventListener("change",save);
      tr.querySelector(".l-manage").addEventListener("click",()=>{open.has(id)?open.delete(id):open.add(id);renderLodges()});
    });
    rows.filter(l=>open.has(l.id)).forEach(renderDetail);
  }

  /* one lodge: its details, its roll and invites, and delete */
  async function renderDetail(l){
    const box=document.querySelector(`[data-detail="${l.id}"] .hub-detail-in`);if(!box)return;
    let roll;
    try{roll=await call("admin_lodge_roll",{lid:l.id})}catch(e){box.innerHTML=`<p class="hint">Couldn't load this lodge (${esc(e.message)}).</p>`;return}
    const roleOpts=cur=>Object.keys(ROLE).map(r=>`<option value="${r}"${r===cur?" selected":""}>${ROLE[r]}</option>`).join("");
    box.innerHTML=`
      <form class="hub-form d-edit" novalidate>
        <div class="field"><label>Lodge name<input name="n" value="${esc(l.name)}" required></label></div>
        <div class="field"><label>No.<input name="num" value="${esc(l.number||"")}"></label></div>
        <div class="field"><label>City<input name="ci" value="${esc(l.city||"")}"></label></div>
        <div class="field"><label>State<input name="st" maxlength="2" value="${esc(l.state||"")}"></label></div>
        <div class="field"><label>Grand Lodge<input name="gl" value="${esc(l.grand_lodge||"")}"></label></div>
        <button class="btn sm" type="submit">Save details</button>
      </form>
      <h4>Roll</h4>
      ${roll.length?`<table class="roll"><tbody>${roll.map(r=>r.invited
        ?`<tr><td class="who">${esc(r.email)} <span class="pill">Invited · ${esc(ROLE[r.role]||r.role)}</span></td><td><button class="btn line sm" type="button" data-cancel="${esc(r.email)}">Cancel invite</button></td></tr>`
        :`<tr><td class="who">${esc(r.email||"Brother")}</td><td><select data-uid="${esc(r.user_id)}" aria-label="Role for ${esc(r.email||"brother")}">${roleOpts(r.role)}</select> <button class="btn line sm" type="button" data-remove="${esc(r.user_id)}">Remove</button></td></tr>`).join("")}</tbody></table>`
        :'<p class="hint">Nobody on this lodge yet.</p>'}
      <form class="invite d-invite" novalidate>
        <div class="field"><label>Invite by email<input type="email" name="email" required placeholder="brother@example.com"></label></div>
        <div class="field"><label>Role<select name="role">${roleOpts("member")}</select></label></div>
        <button class="btn sm" type="submit">Invite</button>
      </form>
      <p class="auth-msg d-msg" role="status" aria-live="polite"></p>
      <div class="hub-danger-zone">
        <span class="hint">Deleting removes this lodge's dashboard, roll and invites for good. Accounts stay.${PAYING.concat(OWED).includes(l.billing_status)?" It has a Stripe subscription, so cancel that in Stripe first.":""}</span>
        <button class="btn line sm hub-danger-line d-delete" type="button">Delete lodge</button>
      </div>`;
    const out=box.querySelector(".d-msg");
    const act=async(fn,args,ok)=>{try{await call(fn,args);await refresh();msg($("#lodge-msg"),lodgeName(l)+": "+ok)}catch(e){msg(out,e.message,true)}};
    box.querySelector(".d-edit").addEventListener("submit",e=>{e.preventDefault();const f=e.target;
      if(!f.n.value.trim())return msg(out,"Enter the lodge's name.",true);
      act("admin_update_lodge",{lid:l.id,n:f.n.value,num:f.num.value,ci:f.ci.value,st:f.st.value,gl:f.gl.value},"Details saved.")});
    box.querySelectorAll("select[data-uid]").forEach(s=>s.addEventListener("change",()=>act("admin_set_member_role",{lid:l.id,uid:s.dataset.uid,r:s.value},"Role changed.")));
    box.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{
      if(confirm("Remove this brother from the lodge? Their account stays; they just lose access to this lodge."))act("admin_remove_member",{lid:l.id,uid:b.dataset.remove},"Removed from the lodge.")}));
    box.querySelectorAll("[data-cancel]").forEach(b=>b.addEventListener("click",()=>act("admin_cancel_invite",{lid:l.id,e:b.dataset.cancel},"Invite cancelled.")));
    box.querySelector(".d-invite").addEventListener("submit",e=>{e.preventDefault();const f=e.target,em=f.email.value.trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))return msg(out,"Enter the brother's email address.",true);
      act("admin_invite",{lid:l.id,e:em,r:f.role.value},`Invited ${em}. They choose Create account at ${location.host}/login with that email.`)});
    box.querySelector(".d-delete").addEventListener("click",()=>askDelete({
      title:`Delete ${lodgeName(l)}?`,
      body:"This permanently deletes the lodge's dashboard (website, calendar, members, minutes, store), its roll and its invites. It can't be undone.",
      label:`Type the page address, ${l.slug}, to confirm`,
      run:typed=>call("admin_delete_lodge",{lid:l.id,confirm_slug:typed}),
      done:()=>{open.delete(l.id);msg($("#lodge-msg"),`Deleted ${lodgeName(l)}.`)}}));
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

  function renderUsers(){
    const {users}=data,q=query(),me=meId;
    $("#acct-count").textContent=users.length+(users.length===1?" account":" accounts");
    const rows=users.filter(u=>hit(q,u.email,...u.lodges.map(l=>l.name)));
    const box=$("#users");
    if(!rows.length){box.innerHTML=`<tr><td colspan="5" class="hint">${users.length?"No account matches that search.":"No accounts yet."}</td></tr>`;return}
    box.innerHTML=rows.map(u=>{
      const locked=u.id===me||u.is_admin;
      return `<tr data-uid="${esc(u.id)}">
      <td class="nm">${esc(u.email)} ${u.id===me?'<span class="pill gold">You</span>':u.is_admin?'<span class="pill gold">LodgeNet owner</span>':""}${u.confirmed?"":' <span class="pill warn">Unconfirmed</span>'}${u.blocked?' <span class="pill warn">Blocked</span>':""}</td>
      <td>${u.lodges.length?u.lodges.map(l=>`${esc(l.name)}${l.number?" No. "+esc(l.number):""} <span class="hint">${esc(ROLE[l.role]||l.role)}</span>`).join("<br>"):'<span class="hint">None</span>'}</td>
      <td class="hint">${day(u.created_at)}</td>
      <td class="hint">${day(u.last_sign_in_at)}</td>
      <td class="hub-acts">
        ${u.confirmed?"":'<button class="btn line sm" type="button" data-act="confirm">Confirm email</button>'}
        <button class="btn line sm" type="button" data-act="reset">Send password reset</button>
        ${locked?"":`<button class="btn line sm" type="button" data-act="block">${u.blocked?"Unblock":"Block"}</button>
        <button class="btn line sm hub-danger-line" type="button" data-act="delete">Delete</button>`}
      </td></tr>`}).join("");
    const out=$("#user-msg");
    box.querySelectorAll("tr[data-uid]").forEach(tr=>{
      const u=users.find(x=>x.id===tr.dataset.uid);
      tr.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",async()=>{
        const a=b.dataset.act;
        try{
          if(a==="confirm"){await call("admin_confirm_user",{uid:u.id});await refresh();msg(out,`Confirmed ${u.email}. They can sign in now.`)}
          if(a==="reset"){const {error}=await sb.auth.resetPasswordForEmail(u.email,{redirectTo:location.origin+"/login"});if(error)throw error;msg(out,`Sent a password reset link to ${u.email}.`)}
          if(a==="block"){
            if(!u.blocked&&!confirm(`Block ${u.email}? They're signed out and can't sign in until you unblock them. Nothing is deleted.`))return;
            await call("admin_block_user",{uid:u.id,blocked:!u.blocked});await refresh();msg(out,u.blocked?`Unblocked ${u.email}.`:`Blocked ${u.email}.`)}
          if(a==="delete"){
            const owned=u.lodges.filter(l=>l.role==="owner").map(l=>l.name+(l.number?" No. "+l.number:""));
            askDelete({
              title:`Delete ${u.email}?`,
              body:"This permanently deletes the account and takes it off every lodge. The lodges themselves stay."+(owned.length?` It's the account owner of ${owned.join(", ")}, so invite a new owner there afterwards.`:"")+" It can't be undone.",
              label:"Type the email to confirm",
              run:typed=>call("admin_delete_user",{uid:u.id,confirm_email:typed}),
              done:()=>msg(out,`Deleted ${u.email}.`)});
          }
        }catch(e){msg(out,e.message,true)}
      }));
    });
  }

  /* deletes go through a dialog that wants the email or page address typed back; the server checks it again */
  let pending=null;
  function askDelete(o){
    pending=o;
    $("#cf-title").textContent=o.title;$("#cf-body").textContent=o.body;$("#cf-label").textContent=o.label;
    $("#cf-input").value="";msg($("#cf-msg"),"");$("#cf-go").disabled=false;
    $("#cf-dialog").showModal();$("#cf-input").focus();
  }
  $("#cf-cancel").addEventListener("click",()=>$("#cf-dialog").close());
  $("#cf-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const typed=$("#cf-input").value.trim();
    if(!typed)return msg($("#cf-msg"),"Type it exactly to confirm.",true);
    $("#cf-go").disabled=true;msg($("#cf-msg"),"Deleting…");
    try{await pending.run(typed);$("#cf-dialog").close();pending.done();await refresh()}
    catch(err){msg($("#cf-msg"),err.message,true);$("#cf-go").disabled=false}
  });
  $("#q").addEventListener("input",()=>{renderLodges();renderUsers()});

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
