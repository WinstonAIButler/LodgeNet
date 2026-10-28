/* /start?plan=…: create an account (on /login, which sends you back here), then create the lodge with you as its account owner.
   New lodges begin on Lodge Starter; the Lodge plan is turned on with a plan code or a Stripe subscription. */
(function(){
  const $=s=>document.querySelector(s);
  const A=window.LodgeNetAuth;
  const PLANS={starter:["Lodge Starter","Free. Your website, calendar, members and minutes."],
    lodge:["Lodge plan","$19 a month, or free with a plan code. Everything in Starter plus the lodge store and donations."],
    district:["District / Grand Lodge","Custom pricing. Your first lodge starts here; contact LodgeNet to link the lodges in your district."]};
  const plan=PLANS[new URLSearchParams(location.search).get("plan")]?new URLSearchParams(location.search).get("plan"):"lodge";
  const STATES=[["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],
    ["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],
    ["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
    ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],
    ["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];
  let sb=null,session=null,lodge=null;

  function show(id){["loading","v-off","v-out","v-in","v-plan"].forEach(v=>$("#"+v).hidden=v!==id)}
  function msg(el,t,err){el.textContent=t;el.classList.toggle("err",!!err)}

  const [pn,pt]=PLANS[plan];
  ["","2"].forEach(n=>{$("#plan-name"+n).textContent=pn;$("#plan-text"+n).textContent=pt});
  $("#plan-eyebrow").textContent="Start your lodge · "+pn;
  const here=location.pathname+location.search;
  $("#go-up").href="/login?mode=up&next="+encodeURIComponent(here);
  $("#go-in").href="/login?next="+encodeURIComponent(here);
  $("#l-state").insertAdjacentHTML("beforeend",STATES.map(([c,n])=>`<option value="${c}">${n}</option>`).join(""));

  $("#f-lodge").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#l-msg"),name=$("#l-name").value.trim(),num=$("#l-num").value.trim();
    if(!name)return msg(out,"Enter your lodge's name.",true);
    $("#l-go").disabled=true;msg(out,"Creating your lodge…");
    const {data:slug,error}=await sb.rpc("create_lodge",{n:name,num,c:$("#l-city").value.trim(),st:$("#l-state").value});
    $("#l-go").disabled=false;
    if(error)return msg(out,error.message,true);
    const {data:row}=await sb.from("lodges").select("id,slug,name,number").eq("slug",slug).maybeSingle();
    lodge=row||{slug,name,number:num};
    const dash="/lodges/"+encodeURIComponent(slug);
    if(plan==="starter")return location.assign(dash);
    $("#made-title").textContent=`${lodge.name}${lodge.number?" No. "+lodge.number:""} is set up`;
    $("#open-lodge").href=dash;
    $("#subscribe").hidden=!(A.billing&&plan==="lodge");
    show("v-plan");
  });

  $("#f-code").addEventListener("submit",async e=>{
    e.preventDefault();
    const out=$("#p-msg"),code=e.target.code.value.trim();
    if(!code)return msg(out,"Enter the code.",true);
    const {data,error}=await sb.rpc("redeem_plan_code",{lid:lodge.id,c:code});
    if(error)return msg(out,error.message,true);
    $("#subscribe").hidden=true;
    msg(out,`Code accepted. Your lodge is on the ${(PLANS[data]||[data])[0]} at no charge. Open your dashboard to get started.`);
  });

  $("#subscribe").addEventListener("click",async()=>{
    const b=$("#subscribe"),out=$("#p-msg");
    b.disabled=true;msg(out,"Opening Stripe checkout…");
    try{
      const r=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({action:"checkout",lodge_id:lodge.id})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Billing didn't answer. Try again.");
      location.href=d.url;
    }catch(err){msg(out,err.message,true);b.disabled=false}
  });

  (async()=>{
    sb=await A.client();
    if(!sb)return show("v-off");
    session=await A.session();
    if(!session)return show("v-out");
    $("#who").textContent="Signed in as "+session.user.email+". You'll be this lodge's account owner.";
    show("v-in");
  })();
})();
