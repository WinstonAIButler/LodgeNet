/* /start?plan=…|price=…: 1. create an account (on /login, which sends you back here), 2. choose a plan (the paid ones come from
   Stripe, see assets/plans.js), 3. create the lodge with you as its account owner. Lodges begin on Lodge Starter; a paid plan then
   opens Stripe Checkout for that price, where a promo code can take it to zero. */
(function(){
  const $=s=>document.querySelector(s);
  const A=window.LodgeNetAuth;
  const PLANS={starter:["Lodge Starter","Free. Build your website, calendar, members and minutes. Publishing comes with the Lodge plan."],
    lodge:["Lodge plan","$19 a month, billed by card through Stripe. Publishing, the lodge store, fundraisers and unlimited officers."]};
  const STATES=[["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],
    ["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],
    ["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
    ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],
    ["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];
  let sb=null,session=null,lodge=null,price=null;
  const q=new URLSearchParams(location.search);
  let plan=PLANS[q.get("plan")]?q.get("plan"):null;

  function show(id){["loading","v-off","v-out","v-pick","v-in","v-done"].forEach(v=>$("#"+v).hidden=v!==id);window.scrollTo(0,0)}
  function msg(el,t,err){el.textContent=t;el.classList.toggle("err",!!err)}

  const here=location.pathname+location.search;
  $("#go-up").href="/login?mode=up&next="+encodeURIComponent(here);
  $("#go-in").href="/login?next="+encodeURIComponent(here);
  $("#l-state").insertAdjacentHTML("beforeend",STATES.map(([c,n])=>`<option value="${c}">${n}</option>`).join(""));

  /* step 2 → step 3; a plan from Stripe carries its price id, name and price label on the button */
  function pick(p,b){
    plan=p;price=b&&b.dataset.price||null;
    const [pn,pt]=b&&b.dataset.name?[b.dataset.name,p==="lodge"?b.dataset.label+", billed by card through Stripe.":"Free."]:PLANS[p];
    $("#plan-name").textContent=pn;
    $("#plan-text").textContent=pt;
    $("#plan-eyebrow").textContent="Start your lodge · "+pn;
    $("#l-go").textContent=p==="lodge"?"Create my lodge and continue to payment":"Create my lodge";
    show("v-in");
  }
  $("#tiers").addEventListener("click",e=>{
    const b=e.target.closest("[data-pick]");if(!b)return;
    if(b.dataset.pick==="lodge"&&!A.billing)return msg($("#pick-msg"),"Payments aren't switched on for LodgeNet yet. Start on Lodge Starter and upgrade later from My lodges.",true);
    pick(b.dataset.pick,b);
  });
  $("#re-pick").addEventListener("click",()=>show("v-pick"));

  async function checkout(){
    const r=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      body:JSON.stringify({action:"checkout",lodge_id:lodge.id,...(price?{price_id:price}:{})})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||"Billing didn't answer. Try again.");
    location.href=d.url;
  }
  function done(note,err,payAgain){
    $("#made-title").textContent=`${lodge.name}${lodge.number?" No. "+lodge.number:""} is set up`;
    $("#open-lodge").href="/lodges/"+encodeURIComponent(lodge.slug);
    $("#pay-again").hidden=!payAgain;
    msg($("#d-msg"),note,err);
    show("v-done");
  }

  /* step 3: create the lodge, then Stripe Checkout for the Lodge plan */
  $("#f-lodge").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#l-msg"),name=$("#l-name").value.trim(),num=$("#l-num").value.trim();
    if(!name)return msg(out,"Enter your lodge's name.",true);
    $("#l-go").disabled=true;msg(out,"Creating your lodge…");
    const {data:slug,error}=await sb.rpc("create_lodge",{n:name,num,c:$("#l-city").value.trim(),st:$("#l-state").value});
    if(error){$("#l-go").disabled=false;return msg(out,error.message,true)}
    const {data:row}=await sb.from("lodges").select("id,slug,name,number").eq("slug",slug).maybeSingle();
    lodge=row||{slug,name,number:num};
    const dash="/lodges/"+encodeURIComponent(slug);
    if(plan==="starter")return location.assign(dash);
    msg(out,"Opening Stripe checkout…");
    try{await checkout()}
    catch(err){done(`Couldn't open payment (${err.message}). Your lodge is on Lodge Starter until the subscription starts.`,true,true)}
  });
  $("#pay-again").addEventListener("click",async()=>{
    const b=$("#pay-again");b.disabled=true;msg($("#d-msg"),"Opening Stripe checkout…");
    try{await checkout()}catch(err){msg($("#d-msg"),err.message,true);b.disabled=false}
  });

  (async()=>{
    sb=await A.client();
    if(!sb)return show("v-off");
    session=await A.session();
    if(!session)return show("v-out");
    $("#who").textContent="Signed in as "+session.user.email+". You'll be your lodge's account owner.";
    show("v-pick");
    await window.LodgeNetPlans.render($("#tiers"),"start");
    const want=q.get("price")||plan;
    if(want){const t=document.querySelector(`[data-tier="${CSS.escape(want)}"]`);if(t)t.scrollIntoView({block:"center"})}
  })();
})();
