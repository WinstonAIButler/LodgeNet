/* LodgeNet sign-in. Accounts and lodge data live in Supabase (Auth + Postgres) once the deployment has it:
   /api/config hands over the project URL and public key, and without them the site stays browser-only.
   Every page loads this to turn the header's Login link into "My lodges" when someone is signed in.
   A lodge page loads it with data-app="/assets/demo.js": the dashboard then opens only for that lodge's
   members and reads and saves the lodge's data in the account (window.LODGENET_CLOUD). */
(function(){
  const me=document.currentScript,app=me&&me.dataset.app;
  if(app)document.documentElement.classList.add("auth-wait");
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.body.appendChild(s)})}

  let clientP=null;
  function client(){
    if(!clientP)clientP=(async()=>{
      let cfg=null;
      try{const r=await fetch("/api/config",{cache:"no-store"});if(r.ok)cfg=await r.json()}catch(e){}
      if(!cfg||!cfg.url||!cfg.key)return null;
      window.LodgeNetAuth.billing=!!cfg.billing;
      if(!window.supabase)await loadScript("/assets/vendor/supabase.umd.min.js");
      return window.supabase.createClient(cfg.url,cfg.key);
    })().catch(()=>null);
    return clientP;
  }
  async function session(){const sb=await client();if(!sb)return null;const {data}=await sb.auth.getSession();return data.session}
  /* [{role, lodge:{id,slug,name,number,city,state,plan,comped,billing_status}}] for the signed-in user */
  async function myLodges(){
    const sb=await client(),s=await session();if(!sb||!s)return [];
    const {data,error}=await sb.from("lodge_members").select("role,lodges(id,slug,name,number,city,state,plan,comped,billing_status)").eq("user_id",s.user.id);
    if(error)throw error;
    return (data||[]).filter(r=>r.lodges).map(r=>({role:r.role,lodge:r.lodges}));
  }
  window.LodgeNetAuth={client,session,myLodges};

  async function markNav(){
    const s=await session();if(!s)return;
    document.querySelectorAll('.nav a[href="/login"]').forEach(a=>a.textContent="My lodges");
  }

  function gate(title,body,cta){
    const band=document.querySelector("#demo .wrap")||document.querySelector("main");
    band.innerHTML=`<div class="card auth-gate"><h3>${esc(title)}</h3><p class="hint">${esc(body)}</p>${cta?`<a class="btn" href="${esc(cta[1])}">${esc(cta[0])}</a>`:""}</div>`;
    document.documentElement.classList.remove("auth-wait");
  }
  async function bootLodge(){
    const slug=(window.LODGE||{}).slug,sb=await client();
    const open=()=>loadScript(app).finally(()=>document.documentElement.classList.remove("auth-wait"));
    if(!sb||!slug){window.LODGENET_CLOUD=null;return open()}
    const s=await session(),login="/login?next="+encodeURIComponent(location.pathname+location.hash);
    if(!s)return gate("Sign in to open this lodge","This dashboard is for the lodge's brethren. Sign in with the email your lodge invited.",["Sign in",login]);
    try{await sb.rpc("claim_invites")}catch(e){}
    const {data:row,error}=await sb.from("lodges").select("id,plan,data,updated_at").eq("slug",slug).maybeSingle();
    if(error)return gate("Couldn't reach the lodge's account",error.message,["Try again",location.pathname]);
    if(!row)return gate("You're not on this lodge's roll yet",`You're signed in as ${s.user.email}. Ask the lodge's account owner to invite that email, then sign in again.`,["My lodges","/login"]);
    const {data:mem}=await sb.from("lodge_members").select("role").eq("lodge_id",row.id).eq("user_id",s.user.id).maybeSingle();
    const role=mem?mem.role:"member";
    window.LODGENET_CLOUD={role,canEdit:role==="owner"||role==="officer",plan:row.plan,data:row.data,updatedAt:row.updated_at,email:s.user.email,
      async save(snap){
        const {data,error}=await sb.from("lodges").update({data:snap}).eq("id",row.id).select("updated_at");
        if(error)throw error;
        if(!data||!data.length)throw new Error("this account can't save this lodge");
        return data[0].updated_at;
      }};
    return open();
  }

  const ready=f=>document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f):f();
  ready(()=>{markNav();if(app)bootLodge()});
})();
