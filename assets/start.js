/* /start?plan=…|price=…, in order:
   1. create an account (on /login, which sends you back here)
   2. choose a plan (the paid ones come from Stripe, see assets/plans.js)
   3. paid plans: pay through Stripe Checkout (api/billing.js action "checkout" with no lodge yet; it returns to /start?paid=1&session_id=…),
      or enter a LodgeNet plan code (checked by action "check_code", spent by redeem_plan_code() in step 4)
   4. the lodge or Scottish Rite club's details: create_lodge() makes it with you as account owner, then the payment is put on it
      (action "attach") or the code redeemed
   5. the dashboard opens on the Website builder (/lodges/<slug>?welcome=1#website)
   Where you are is kept in localStorage, so the trip out to Stripe and back (or a reload) doesn't lose it. */
(function(){
  const $=s=>document.querySelector(s);
  const A=window.LodgeNetAuth;
  const PLANS={starter:["Lodge Starter","Free. Build your website, calendar, members and minutes. Publishing comes with a paid level."],
    lodge:["Lodge plan","$19 a month, billed by card through Stripe. Publishing, the lodge store, fundraisers and unlimited officers."]};
  const STATES=[["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],
    ["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],
    ["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
    ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],
    ["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];
  let sb=null,session=null,lodge=null;
  const q=new URLSearchParams(location.search);
  const KEY="lodgenet-start";
  /* {plan:"starter"|"lodge", price, name, label, session_id, code} */
  let st=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){return {}}})();
  const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
  const forget=()=>{st={};try{localStorage.removeItem(KEY)}catch(e){}};
  if(PLANS[q.get("plan")]&&!st.session_id&&!st.code)st.plan=q.get("plan");

  const VIEWS=["loading","v-off","v-out","v-pick","v-pay","v-in","v-done"];
  function show(id){VIEWS.forEach(v=>$("#"+v).hidden=v!==id);window.scrollTo(0,0)}
  function msg(el,t,err){el.textContent=t;el.classList.toggle("err",!!err)}
  async function api(action,extra){
    const r=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      body:JSON.stringify({action,...extra})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||"LodgeNet didn't answer. Try again.");
    return d;
  }

  const here=location.pathname+location.search;
  $("#go-up").href="/login?mode=up&next="+encodeURIComponent(here);
  $("#go-in").href="/login?next="+encodeURIComponent(here);
  $("#l-state").insertAdjacentHTML("beforeend",STATES.map(([c,n])=>`<option value="${c}">${n}</option>`).join(""));

  /* Blue Lodge, Scottish Rite Club or Valley: the same account, with the form worded for it */
  const KIND={lodge:["Lodge name","Lodge number","e.g. Murrells Inlet Lodge","e.g. 368","Your lodge"],
    club:["Club name","Club number (if it has one)","e.g. Grand Strand Scottish Rite Club","","Your club"],
    valley:["Valley name","Valley number (if it has one)","e.g. Valley of Charleston","","Your Valley"],
    other:["Name","Number (if it has one)","","","Your Masonic body"]};
  $("#l-kind").addEventListener("change",()=>{
    const [n,num,pn,pnum,t]=KIND[$("#l-kind").value];
    $("#l-name-lbl").textContent=n;$("#l-num-lbl").textContent=num;$("#l-name").placeholder=pn;$("#l-num").placeholder=pnum;
    $("#in-title").textContent="Step 4 · "+t;
  });

  function planText(){
    const paid=st.plan==="lodge";
    const name=st.name||(paid?"Lodge Level":"Lodge Starter");
    const how=st.code?" Covered by your code "+st.code+".":st.session_id?" Paid by card through Stripe.":"";
    $("#plan-name").textContent=name;
    $("#plan-text").textContent=paid?(st.label?st.label+", billed by card through Stripe.":PLANS.lodge[1])+how:PLANS.starter[1];
    $("#plan-eyebrow").textContent="Start your lodge · "+name;
  }
  function toDetails(note){
    planText();
    msg($("#paid-note"),note||"");$("#paid-note").hidden=!note;
    show("v-in");$("#l-name").focus({preventScroll:true});
  }
  function toPay(note,err){
    planText();
    $("#pay-plan").textContent=`${st.name||"Lodge Level"}${st.label?" · "+st.label:" · $19 / month"}. Pay by card, or use a LodgeNet code below.`;
    msg($("#pay-msg"),note||"",err);
    show("v-pay");
  }

  /* step 2 → step 3 (paid) or step 4 (free); a plan from Stripe carries its price id, name and price label on the button */
  $("#tiers").addEventListener("click",e=>{
    const b=e.target.closest("[data-pick]");if(!b)return;
    if(b.dataset.pick==="lodge"&&!A.billing)return msg($("#pick-msg"),"Payments aren't switched on for LodgeNet yet. Start on Lodge Starter and upgrade later from your account under Login.",true);
    st={plan:b.dataset.pick,price:b.dataset.price||null,name:b.dataset.name||null,label:b.dataset.label||null};keep();
    if(st.plan==="lodge")toPay();else toDetails();
  });
  $("#re-pick").addEventListener("click",()=>{
    if((st.session_id||st.code)&&!confirm("You've already "+(st.code?"entered a code":"paid")+" for this plan. Choose a different plan anyway?"))return;
    forget();toPick();
  });
  $("#pay-back").addEventListener("click",()=>{forget();toPick()});

  /* step 3: Stripe Checkout, before the lodge exists */
  $("#pay-go").addEventListener("click",async()=>{
    const b=$("#pay-go");b.disabled=true;msg($("#pay-msg"),"Opening Stripe checkout…");
    try{location.href=(await api("checkout",st.price?{price_id:st.price}:{})).url}
    catch(err){msg($("#pay-msg"),err.message,true);b.disabled=false}
  });
  /* step 3: or a LodgeNet plan code */
  $("#f-code").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#c-msg"),code=$("#c-code").value.trim();
    if(!code)return msg(out,"Enter your code.",true);
    $("#c-go").disabled=true;msg(out,"Checking your code…");
    try{const d=await api("check_code",{code});st.code=d.code;if(d.plan==="district")st.name="District / Grand Lodge";keep();
      toDetails("Code accepted. No payment needed. Now tell us about your lodge.")}
    catch(err){msg(out,err.message,true)}
    finally{$("#c-go").disabled=false}
  });

  /* step 4 → 5: make the lodge, put the payment or code on it, then open the Website builder */
  const dash=()=>"/lodges/"+encodeURIComponent(lodge.slug)+"?welcome=1#website";
  async function settle(){
    if(st.session_id)await api("attach",{lodge_id:lodge.id,session_id:st.session_id});
    else if(st.code){const {error}=await sb.rpc("redeem_plan_code",{lid:lodge.id,c:st.code});if(error)throw error}
  }
  function done(note){
    $("#made-title").textContent=`${lodge.name}${lodge.number?" No. "+lodge.number:""} is set up`;
    $("#open-lodge").href=dash();
    $("#pay-again").hidden=false;
    msg($("#d-msg"),note,true);
    show("v-done");
  }
  $("#f-lodge").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#l-msg"),name=$("#l-name").value.trim(),num=$("#l-num").value.trim();
    if(!name)return msg(out,"Enter the name.",true);
    if(st.plan==="lodge"&&!st.session_id&&!st.code)return toPay("Pay or enter a code first, then add your details.",true);
    $("#l-go").disabled=true;msg(out,"Saving…");
    const {data:slug,error}=await sb.rpc("create_lodge",{n:name,num,c:$("#l-city").value.trim(),st:$("#l-state").value});
    if(error){$("#l-go").disabled=false;return msg(out,error.message,true)}
    const {data:row}=await sb.from("lodges").select("id,slug,name,number").eq("slug",slug).maybeSingle();
    lodge=row||{slug,name,number:num};
    if(st.session_id||st.code){
      msg(out,st.code?"Applying your code…":"Adding your payment…");
      try{await settle()}
      catch(err){return done(`Your lodge is saved, but ${st.code?"the code":"the payment"} couldn't be added to it yet (${err.message}). Try again, and if it keeps failing, contact LodgeNet. You won't be charged twice.`)}
    }
    forget();
    location.assign(dash());
  });
  $("#pay-again").addEventListener("click",async()=>{
    const b=$("#pay-again");b.disabled=true;msg($("#d-msg"),"Trying again…");
    try{await settle();forget();location.assign(dash())}catch(err){msg($("#d-msg"),err.message,true);b.disabled=false}
  });

  /* the paid plan named by ?price=…, as Stripe has it (the same list the Pricing page shows) */
  const label=p=>`$${(p.amount/100).toFixed(p.amount%100?2:0)} / ${p.interval_count>1?p.interval_count+" "+p.interval+"s":p.interval}`;
  async function chosen(){
    const id=q.get("price"),lodgeLink=q.get("plan")==="lodge";
    if((!id&&!lodgeLink)||st.session_id||st.code)return null;
    const paid=(await window.LodgeNetPlans.load()).filter(x=>x.amount>0);
    /* /start?plan=lodge (an older link): the Lodge Level, or the cheapest paid plan */
    return (id?paid.find(x=>x.price===id):paid.find(x=>/^lodge\b/i.test(x.name))||paid[0])||null;
  }
  let drawn=false;
  async function toPick(){
    show("v-pick");
    if(!drawn){drawn=true;await window.LodgeNetPlans.render($("#tiers"),"start")}
  }

  (async()=>{
    sb=await A.client();
    if(!sb)return show("v-off");
    session=await A.session();
    if(!session){
      show("v-out");
      /* signed out with a plan already chosen: say so, so step 2 isn't a surprise */
      chosen().then(p=>{if(p)$("#plan-eyebrow").textContent=`Start your lodge · ${p.name} · ${label(p)}`});
      return;
    }
    $("#who").textContent="Signed in as "+session.user.email+". You'll be your lodge's account owner.";
    /* back from Stripe */
    if(q.get("paid")&&q.get("session_id")){
      history.replaceState(null,"",location.pathname);
      show("loading");
      try{await api("paid",{session_id:q.get("session_id")});st.session_id=q.get("session_id");st.plan="lodge";keep();
        return toDetails("Payment received. Thank you! Now tell us about your lodge.")}
      catch(err){return toPay(err.message,true)}
    }
    if(q.get("step")==="pay"&&st.plan==="lodge"&&!st.session_id){history.replaceState(null,"",location.pathname);return toPay("Checkout was closed before paying. You can try again, or use a code.")}
    if(st.session_id||st.code)return toDetails(st.code?"Your code is ready to use. Add your lodge's details.":"Your payment is ready. Add your lodge's details.");
    /* a plan already chosen on the Pricing page (/start?price=…): don't ask again, go straight to payment */
    const p=await chosen();
    if(p){st={plan:"lodge",price:p.price,name:p.name,label:label(p)};keep();history.replaceState(null,"",location.pathname);return toPay()}
    if(st.plan==="starter")return toDetails();
    await toPick();
    if(st.plan){const t=document.querySelector(`[data-tier="${CSS.escape(st.price||st.plan)}"]`);if(t)t.scrollIntoView({block:"center"})}
  })();
})();
