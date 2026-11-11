/* /start?plan=…|price=…, in order:
   1. choose a plan (the paid ones come from Stripe, see assets/plans.js); skipped when Pricing already chose one
   2. your information: the account (Continue with Google / Apple / Microsoft, or email and password), your name, phone and office,
      and the organization (Blue Lodge, Scottish Rite Club or Valley, District, Grand Lodge), its details and current website
   3. paid plans: Stripe Checkout (api/billing.js "checkout" with no lodge yet; it returns to /start?paid=1&session_id=…), or a code:
      a LodgeNet plan code ("check_code", spent by redeem_plan_code()) or a Stripe promo code (applied at checkout)
   then the lodge is made from step 2 (create_lodge(), you as account owner), the payment put on it ("attach") or the code redeemed,
   and the dashboard opens on the Website builder (/lodges/<slug>?welcome=1[&import=<current site>]#website).
   Everything is kept in localStorage, so the trips out to Google, the confirmation email and Stripe don't lose it. */
(function(){
  const $=s=>document.querySelector(s);
  const A=window.LodgeNetAuth;
  const STATES=[["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],
    ["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],
    ["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
    ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],
    ["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];
  let sb=null,session=null,lodge=null,acctMode="up";
  const q=new URLSearchParams(location.search);
  const KEY="lodgenet-start";
  /* {plan:"starter"|"lodge", price, name, label, info:{…step 2}, session_id, code} */
  let st=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){return {}}})();
  const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
  const forget=()=>{st={};try{localStorage.removeItem(KEY)}catch(e){}};
  /* if a confirmation email lands on /login instead, it sends them back here */
  const backHere=()=>{try{localStorage.setItem("lodgenet-next",JSON.stringify({next:"/start",t:Date.now()}))}catch(e){}};

  const VIEWS=["loading","v-off","v-pick","v-info","v-check","v-pay","v-making","v-done"];
  function show(id){VIEWS.forEach(v=>$("#"+v).hidden=v!==id);window.scrollTo(0,0)}
  function msg(el,t,err){el.textContent=t;el.classList.toggle("err",!!err);el.hidden=!t&&el.id==="paid-note"}
  async function api(action,extra){
    const r=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      body:JSON.stringify({action,...extra})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||"LodgeNet didn't answer. Try again.");
    return d;
  }
  const label=p=>`$${(p.amount/100).toFixed(p.amount%100?2:0)} / ${p.interval_count>1?p.interval_count+" "+p.interval+"s":p.interval}`;
  const paidPlan=()=>st.plan==="lodge";
  $("#l-state").insertAdjacentHTML("beforeend",STATES.map(([c,n])=>`<option value="${c}">${n}</option>`).join(""));

  /* ---------- step 1: the plan ---------- */
  let drawn=false;
  async function toPick(){show("v-pick");if(!drawn){drawn=true;await window.LodgeNetPlans.render($("#tiers"),"start")}}
  $("#tiers").addEventListener("click",e=>{
    const b=e.target.closest("[data-pick]");if(!b)return;
    if(b.dataset.pick==="lodge"&&A.billing===false)return msg($("#pick-msg"),"Payments aren't switched on for LodgeNet yet. Start on Lodge Starter and upgrade later from your account.",true);
    const info=st.info;
    st={plan:b.dataset.pick,price:b.dataset.price||null,name:b.dataset.name||null,label:b.dataset.label||null,info};keep();
    toInfo();
  });
  /* the paid plan Pricing chose (?price=…, or the older ?plan=lodge link) */
  async function chosen(){
    const id=q.get("price"),lodgeLink=q.get("plan")==="lodge";
    if((!id&&!lodgeLink)||st.session_id||st.code)return null;
    const paid=(await window.LodgeNetPlans.load()).filter(x=>x.amount>0);
    return (id?paid.find(x=>x.price===id):paid.find(x=>/^lodge\b/i.test(x.name))||paid[0])||null;
  }

  /* ---------- step 2: your information ---------- */
  const KIND={lodge:["Lodge name","Lodge number","e.g. Murrells Inlet Lodge","e.g. 368"],
    club:["Club name","Club number (if it has one)","e.g. Grand Strand Scottish Rite Club",""],
    valley:["Valley name","Valley number (if it has one)","e.g. Valley of Charleston",""],
    district:["District name","District number","e.g. 15th Masonic District","e.g. 15"],
    grand:["Grand Lodge name","","e.g. Grand Lodge of South Carolina",""]};
  function kindLabels(){
    const k=$("#l-kind").value,[n,num,pn,pnum]=KIND[k];
    $("#l-name-lbl").textContent=n;$("#l-name").placeholder=pn;
    $("#l-num-lbl").textContent=num;$("#l-num").placeholder=pnum;$("#l-num").closest(".field").hidden=!num;
    $("#l-gl").closest(".field").hidden=k==="grand";
  }
  $("#l-kind").addEventListener("change",kindLabels);
  const FIELDS={name:"p-name",phone:"p-phone",title:"p-title",kind:"l-kind",lodge:"l-name",number:"l-num",gl:"l-gl",city:"l-city",state:"l-state",site:"l-site"};
  function readInfo(){const o={};for(const [k,id] of Object.entries(FIELDS))o[k]=$("#"+id).value.trim();if(o.kind==="grand")o.number="";return o}
  function fillInfo(){
    const i=st.info||{},meta=session&&session.user.user_metadata||{};
    for(const [k,id] of Object.entries(FIELDS)){const v=i[k]||(k==="name"?meta.full_name||meta.name||"":k==="phone"?meta.phone||"":"");if(v)$("#"+id).value=v}
    kindLabels();
  }
  /* save as they type, so leaving for Google or the confirmation email keeps it */
  $("#v-info").addEventListener("input",()=>{st.info=readInfo();keep()});
  $("#v-info").addEventListener("change",()=>{st.info=readInfo();keep()});

  function setAcct(){
    $("#acct-in").hidden=!session;$("#acct-new").hidden=!!session;
    if(session)$("#acct-who").textContent="Signed in as "+session.user.email+". You'll be the account owner.";
    $("#a-pass-lbl").textContent=acctMode==="up"?"Choose a password":"Your password";
    $("#a-pass").setAttribute("autocomplete",acctMode==="up"?"new-password":"current-password");
    $("#a-pass-hint").hidden=acctMode!=="up";
    $("#a-mode").textContent=acctMode==="up"?"I already have a LodgeNet account":"I'm new here: create my account";
  }
  $("#a-mode").addEventListener("click",()=>{acctMode=acctMode==="up"?"in":"up";setAcct()});
  $("#acct-out").addEventListener("click",async()=>{await sb.auth.signOut({scope:"local"});session=null;setAcct();renderOAuth()});
  let oauthDone=false;
  function renderOAuth(){if(oauthDone||session)return;oauthDone=true;
    window.LodgeNetOAuth.render($("#oauth-box"),location.origin+"/start",()=>{st.info=readInfo();st.await=1;keep();backHere()})}

  function planLine(){
    const name=st.name||(paidPlan()?"Lodge Level":"Lodge Starter");
    $("#plan-eyebrow").textContent="Start your lodge · "+name;
    const how=st.code?" Covered by your code "+st.code+".":st.session_id?" Paid by card through Stripe.":"";
    $("#info-plan").textContent=(paidPlan()?`${name}${st.label?" · "+st.label:""}. Payment is the next step.`:`${name}. Free.`)+how;
    $("#info-go").textContent=st.session_id||st.code?"Set up my lodge":paidPlan()?"Continue to payment":"Create my lodge";
  }
  function toInfo(note){
    planLine();fillInfo();setAcct();renderOAuth();
    msg($("#paid-note"),note||"");
    show("v-info");
  }
  $("#re-pick").addEventListener("click",()=>{
    if((st.session_id||st.code)&&!confirm("You've already "+(st.code?"entered a code":"paid")+" for this plan. Choose a different plan anyway?"))return;
    const info=st.info;forget();st.info=info;keep();toPick();
  });

  $("#v-info").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#info-msg"),i=readInfo();st.info=i;keep();
    if(!i.name)return msg(out,"Enter your full name.",true);
    if(!i.lodge)return msg(out,"Enter your "+KIND[i.kind][0].toLowerCase()+".",true);
    if(i.site&&!/^https?:\/\//i.test(i.site)){i.site="https://"+i.site;$("#l-site").value=i.site;st.info=i;keep()}
    const go=$("#info-go");go.disabled=true;
    try{
      if(!session){
        const email=$("#a-email").value.trim(),password=$("#a-pass").value;
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return msg(out,"Enter your email, or use one of the Continue with buttons.",true);
        if(password.length<8)return msg(out,acctMode==="up"?"Choose a password of at least 8 characters.":"Enter your password.",true);
        msg(out,acctMode==="up"?"Creating your account…":"Signing in…");
        const meta={full_name:i.name,phone:i.phone,title:i.title};
        if(acctMode==="in"){
          const {data,error}=await sb.auth.signInWithPassword({email,password});
          if(error)return msg(out,error.message==="Invalid login credentials"?"That email and password don't match an account.":error.message,true);
          session=data.session;
        }else{
          backHere();
          const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+"/start",
            /* the plan and step 2 ride on the account too, so the confirmation link can be opened in any browser or on a phone */
            data:{...meta,lodgenet_start:{plan:st.plan,price:st.price||null,name:st.name||null,label:st.label||null,info:i}}}});
          if(error)return msg(out,error.message,true);
          if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length){
            acctMode="in";setAcct();$("#a-pass").value="";
            return msg(out,`${email} already has a LodgeNet account. Enter its password to sign in.`,true);
          }
          if(!data.session){st.await=1;st.email=email;keep();$("#check-text").textContent=`We sent an email to ${email} to confirm it's yours.`;show("v-check");$("#o-code").focus();return}
          session=data.session;
        }
      }
      msg(out,"Saving…");
      sb.auth.updateUser({data:{full_name:i.name,phone:i.phone,title:i.title}}).catch(()=>{});
      if(paidPlan()&&!st.session_id&&!st.code)return toPay();
      await finish();
    }finally{go.disabled=false}
  });

  /* ---------- confirming the email: the code from it, typed here (or the link in it, which comes back to /start) ---------- */
  $("#f-otp").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#o-msg"),token=$("#o-code").value.replace(/\s/g,"");
    if(!/^\d{6,10}$/.test(token))return msg(out,"Enter the code from the email.",true);
    $("#o-go").disabled=true;msg(out,"Confirming…");
    try{
      const {data,error}=await sb.auth.verifyOtp({email:st.email,token,type:"signup"});
      if(error)return msg(out,/expired|invalid/i.test(error.message)?"That code didn't work or has expired. Check the newest email, or send it again.":error.message,true);
      session=data.session;delete st.await;keep();
      const i=st.info||{};
      sb.auth.updateUser({data:{full_name:i.name,phone:i.phone,title:i.title}}).catch(()=>{});
      if(paidPlan()&&!st.session_id&&!st.code)return toPay("Email confirmed. You're signed in as "+session.user.email+".");
      await finish();
    }finally{$("#o-go").disabled=false}
  });
  $("#o-again").addEventListener("click",async()=>{
    const {error}=await sb.auth.resend({type:"signup",email:st.email,options:{emailRedirectTo:location.origin+"/start"}});
    msg($("#o-msg"),error?error.message:"Sent again. Use the newest email.",!!error);
  });
  $("#o-back").addEventListener("click",()=>{delete st.await;delete st.email;keep();toInfo()});

  /* ---------- step 3: payment or a code ---------- */
  function toPay(note,err){
    planLine();
    $("#pay-plan").textContent=`${st.name||"Lodge Level"} · ${st.label||"$19 / month"}. Pay by card, or use a code.`;
    msg($("#pay-msg"),note||"",err);
    show("v-pay");
  }
  $("#pay-back").addEventListener("click",()=>toInfo());
  $("#pay-go").addEventListener("click",async()=>{
    const b=$("#pay-go");b.disabled=true;msg($("#pay-msg"),"Opening Stripe checkout…");
    try{location.href=(await api("checkout",st.price?{price_id:st.price}:{})).url}
    catch(err){msg($("#pay-msg"),err.message,true);b.disabled=false}
  });
  $("#f-code").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#c-msg"),code=$("#c-code").value.trim();
    if(!code)return msg(out,"Enter your code.",true);
    $("#c-go").disabled=true;msg(out,"Checking your code…");
    try{
      const d=await api("check_code",{code});
      if(d.promo){
        msg(out,`${d.code} applied: ${d.off}. Opening Stripe to finish${d.free?". No card needed":""}…`);
        location.href=(await api("checkout",{...(st.price?{price_id:st.price}:{}),promotion_code:d.promo})).url;
        return;
      }
      st.code=d.code;keep();
      msg(out,"Code accepted. Setting up your lodge…");
      await finish();
    }
    catch(err){msg(out,err.message,true)}
    finally{$("#c-go").disabled=false}
  });

  /* ---------- then: make the lodge, put the payment or code on it, open the Website builder ---------- */
  const dash=()=>"/lodges/"+encodeURIComponent(lodge.slug)+"?welcome=1"+(st.info&&st.info.site?"&import="+encodeURIComponent(st.info.site):"")+"#website";
  async function settle(){
    if(st.session_id)await api("attach",{lodge_id:lodge.id,session_id:st.session_id});
    else if(st.code){const {error}=await sb.rpc("redeem_plan_code",{lid:lodge.id,c:st.code});if(error)throw error}
  }
  function failed(note){
    $("#made-title").textContent=`${lodge.name}${lodge.number?" No. "+lodge.number:""} is set up`;
    $("#open-lodge").href=dash();$("#pay-again").hidden=false;
    msg($("#d-msg"),note,true);show("v-done");
  }
  async function finish(){
    const i=st.info||{};
    if(!i.lodge)return toInfo(st.session_id?"Payment received. Thank you! Now add your information to finish.":"");
    show("v-making");msg($("#m-msg"),"Creating "+i.lodge+"…");
    if(!lodge){
      const {data:slug,error}=await sb.rpc("create_lodge",{n:i.lodge,num:i.number||"",c:i.city||"",st:i.state||""});
      if(error){toInfo();return msg($("#info-msg"),error.message,true)}
      const {data:row}=await sb.from("lodges").select("id,slug,name,number").eq("slug",slug).maybeSingle();
      lodge=row||{slug,name:i.lodge,number:i.number};
      if(lodge.id&&i.gl)sb.from("lodges").update({grand_lodge:i.gl}).eq("id",lodge.id).then(()=>{},()=>{});
      sb.auth.updateUser({data:{full_name:i.name,phone:i.phone,title:i.title,org_kind:i.kind}}).catch(()=>{});
    }
    if(st.session_id||st.code){
      msg($("#m-msg"),st.code?"Applying your code…":"Adding your payment…");
      try{await settle()}
      catch(err){return failed(`Your lodge is saved, but ${st.code?"the code":"the payment"} couldn't be added to it yet (${err.message}). Try again, and if it keeps failing, contact LodgeNet. You won't be charged twice.`)}
    }
    sb.auth.updateUser({data:{lodgenet_start:null}}).catch(()=>{});
    const to=dash();forget();location.assign(to);
  }
  $("#pay-again").addEventListener("click",async()=>{
    const b=$("#pay-again");b.disabled=true;msg($("#d-msg"),"Trying again…");
    try{await settle();const to=dash();forget();location.assign(to)}catch(err){msg($("#d-msg"),err.message,true);b.disabled=false}
  });

  /* ---------- start ---------- */
  (async()=>{
    sb=await A.client();
    if(!sb)return show("v-off");
    session=await A.session();
    /* confirmed in another browser, on a phone or in the mail app: pick up where they left off from the account */
    const saved=session&&session.user.user_metadata&&session.user.user_metadata.lodgenet_start;
    if(saved&&saved.plan&&!st.plan&&!st.session_id&&!st.code){st={...saved,await:1};keep()}
    /* back from Stripe */
    if(q.get("paid")&&q.get("session_id")){
      history.replaceState(null,"",location.pathname);
      if(!session)return toInfo("Sign in with the same account you used before to finish setting up.");
      show("v-making");msg($("#m-msg"),"Checking your payment…");
      try{await api("paid",{session_id:q.get("session_id")});st.session_id=q.get("session_id");st.plan="lodge";keep();return finish()}
      catch(err){return toPay(err.message,true)}
    }
    const p=await chosen();
    if(p){const info=st.info;st={plan:"lodge",price:p.price,name:p.name,label:label(p),info};keep();history.replaceState(null,"",location.pathname)}
    else if(q.get("plan")==="starter"&&!st.plan){st.plan="starter";keep()}
    if(q.get("step")==="pay"&&paidPlan()&&!st.session_id&&session){history.replaceState(null,"",location.pathname);return toPay("Checkout was closed before paying. You can try again, or use a code.")}
    /* back from Google / Apple / Microsoft or the confirmation email: with the information filled in, straight on to payment */
    if(st.await&&session){
      delete st.await;keep();const i=st.info||{};
      if(i.name&&i.lodge){sb.auth.updateUser({data:{full_name:i.name,phone:i.phone,title:i.title}}).catch(()=>{});
        if(paidPlan()&&!st.session_id&&!st.code){planLine();return toPay("You're signed in as "+session.user.email+".")}
        return finish()}
      return toInfo("You're signed in as "+session.user.email+". Fill in the rest, then continue.");
    }
    if(st.await&&!session&&st.email){$("#check-text").textContent=`We sent an email to ${st.email} to confirm it's yours.`;return show("v-check")}
    if(st.session_id||st.code)return session?finish():toInfo();
    if(st.plan)return toInfo();
    await toPick();
  })();
})();
