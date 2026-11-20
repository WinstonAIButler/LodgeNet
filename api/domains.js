// A lodge's own web address: buy one through LodgeNet (resold via Name.com, a yearly Stripe subscription) or connect one
// the lodge already owns. The setup steps, prices and DNS checks are the shared Domain Kit (api/_domain-kit, generated from
// the Desktop master by make-plain-js.sh); this file is LodgeNet's storage, sign-in and payment around it.
// POST /api/domains {action, lodge_id, ...} with the signed-in brother's Supabase access token:
//   list                                  the lodge's domains (and moves any that are still being set up)
//   search {q}                            priced suggestions                         (account owner)
//   buy {domain, contact}                 Stripe Checkout for the first year          (account owner)
//   paid {session_id}                     back from Checkout: register and set it up  (account owner)
//   connect {domain}                      use a domain the lodge already owns         (owner or officer)
//   records {id} · check {id} · primary {id} · remove {id}                            (owner or officer; remove: owner)
// GET /api/domains?cron=1 (Vercel cron, Authorization: Bearer CRON_SECRET) re-checks domains being set up and renews.
// Needs SUPABASE_SERVICE_ROLE_KEY, a Stripe key (api/_stripe.js), NAMECOM_USERNAME + NAMECOM_TOKEN (+ NAMECOM_ENV=production
// for real purchases), VERCEL_TOKEN + VERCEL_PROJECT_ID (+ VERCEL_TEAM_ID). Table: supabase/domains.sql.
const {stripeKey,stripe}=require("./_stripe");
const K=require("./_domain-kit");
const PUBLIC=require("./_public");
const e=process.env;
const SB_URL=e.SUPABASE_URL||e.NEXT_PUBLIC_SUPABASE_URL||PUBLIC.url;
const SB_ANON=e.SUPABASE_ANON_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY||e.SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||(SB_URL===PUBLIC.url?PUBLIC.key:"");
const SB_SERVICE=e.SUPABASE_SERVICE_ROLE_KEY||e.SUPABASE_SECRET_KEY||"";
const ACTIVE=["paid","registering","dns","attaching","pending","verifying"];
const ENDINGS=["org","com","net","us","club"];

async function sb(path,{method="GET",body,token}={}){
  const key=token?SB_ANON:SB_SERVICE;
  const r=await fetch(SB_URL+path,{method,body:body&&JSON.stringify(body),
    headers:{apikey:key,Authorization:"Bearer "+(token||SB_SERVICE),"Content-Type":"application/json",Prefer:"return=representation"}});
  const t=await r.text(),d=t?JSON.parse(t):null;
  if(!r.ok)throw Object.assign(new Error((d&&(d.message||d.msg||d.error_description))||r.statusText),{status:r.status});
  return d;
}
const enc=encodeURIComponent;
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});
function readBody(req){return new Promise((ok,no)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>ok(b));req.on("error",no)})}

/* settings: Vercel environment first, else a row the owner saved in the hub (platform_secrets) */
const saved={};
async function setting(name){
  if(e[name])return e[name];
  if(!(name in saved)&&SB_SERVICE){
    try{const [row]=await sb(`/rest/v1/platform_secrets?select=*&name=eq.${enc(name.toLowerCase())}`);saved[name]=row&&(row.value||row.secret)||null}catch(err){saved[name]=null}
  }
  return saved[name]||null;
}
async function services(){
  const [u,t,env,vt,pid,team]=await Promise.all(["NAMECOM_USERNAME","NAMECOM_TOKEN","NAMECOM_ENV","VERCEL_TOKEN","VERCEL_PROJECT_ID","VERCEL_TEAM_ID"].map(setting));
  return {registrar:u&&t?K.nameCom({username:u,token:t,env}):null,host:vt&&pid?K.vercelHost({token:vt,projectId:pid,teamId:team||undefined}):null,
    sandbox:String(env||"").trim().toLowerCase()!=="production"};
}

/* public DNS over HTTPS (Cloudflare, then Google), as the internet sees it */
const TYPES={A:1,CNAME:5,TXT:16};
async function lookup(name,type){
  for(const u of [`https://cloudflare-dns.com/dns-query?name=${enc(name)}&type=${type}`,`https://dns.google/resolve?name=${enc(name)}&type=${type}`]){
    try{
      const r=await fetch(u,{headers:{accept:"application/dns-json"},signal:AbortSignal.timeout(8000)});if(!r.ok)continue;
      const j=await r.json();
      return (j.Answer||[]).filter(a=>a.type===TYPES[type]).map(a=>type==="TXT"?a.data.replace(/^"|"$/g,"").replace(/" "/g,""):a.data.replace(/\.$/,"").toLowerCase());
    }catch(err){}
  }
  return [];
}
function domainName(s){
  let h=String(s||"").trim().toLowerCase().replace(/^[a-z]+:\/\//,"").split(/[/?#]/)[0].replace(/:\d+$/,"").replace(/\.$/,"");
  if(h.length>253||!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)||/^\d+(\.\d+){3}$/.test(h))return null;
  if(/(^|\.)(lodgenet\.app|vercel\.app|localhost|local|test|example|invalid)$/.test(h))return null;
  return K.apexOf(h);
}

/* ---------- the setup flow ---------- */
const toOrder=d=>({name:d.name,source:d.source,status:d.status,years:d.years,priceCents:d.price_cents,attempts:d.attempts,
  lastError:d.last_error,lastCheck:d.last_check,expiresAt:d.expires_at,createdAt:d.created_at});

async function refund(d,reason){
  const key=await stripeKey();if(!key)throw new Error("Stripe isn't connected.");
  const s=await stripe(key,"/checkout/sessions/"+enc(d.stripe_session_id));
  if(s.subscription)await fetch("https://api.stripe.com/v1/subscriptions/"+enc(s.subscription),{method:"DELETE",headers:{Authorization:"Bearer "+key}}).catch(()=>{});
  let pi=s.payment_intent;
  if(!pi&&s.invoice){
    const {data:[p]=[]}=await stripe(key,"/invoice_payments?invoice="+enc(s.invoice)).catch(()=>({data:[]}));
    pi=p&&p.payment&&p.payment.payment_intent;
  }
  if(!pi)throw new Error("Couldn't find the payment to refund. Refund it by hand in Stripe.");
  await stripe(key,"/refunds",{payment_intent:typeof pi==="string"?pi:pi.id,metadata:{kind:"domain",domain:d.name,reason:String(reason).slice(0,400)}});
}

async function advanceOne(d,svc){
  if(!ACTIVE.includes(d.status)||!svc.host||(d.source==="purchased"&&!svc.registrar))return d;
  const deps={registrar:svc.registrar||{},host:svc.host,lookup,registrant:async()=>d.registrant||null,
    refund:reason=>refund(d,reason),notify:async()=>{}};
  for(let i=0;i<6;i++){
    const before=d.status,o=await K.advance(toOrder(d),deps);
    const patch={status:o.status,attempts:o.attempts,last_error:o.lastError,last_check:o.lastCheck,expires_at:o.expiresAt,updated_at:new Date().toISOString()};
    if(["dns","attaching","verifying","live","refunded"].includes(o.status))patch.registrant=null;
    [d]=await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:patch});
    if(d.status==="live"){
      const prim=await sb(`/rest/v1/lodge_domains?select=id&lodge_id=eq.${d.lodge_id}&status=eq.live&is_primary=eq.true`);
      if(!prim.length)[d]=await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{is_primary:true}});
      break;
    }
    if(d.status===before||K.FINAL.has(d.status))break;
  }
  return d;
}

/* yearly renewals: once Stripe has been paid for the coming year, extend the registration */
async function renewals(svc){
  const key=await stripeKey();if(!key||!svc.registrar)return 0;
  const soon=new Date(Date.now()+30*864e5).toISOString();
  const due=await sb(`/rest/v1/lodge_domains?select=*&source=eq.purchased&status=eq.live&auto_renew=eq.true&expires_at=lt.${enc(soon)}`);
  let n=0;
  for(const d of due){
    try{
      if(!d.stripe_subscription_id)continue;
      const s=await stripe(key,"/subscriptions/"+enc(d.stripe_subscription_id));
      if(["canceled","unpaid","incomplete_expired"].includes(s.status)||s.cancel_at_period_end){await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{auto_renew:false}});continue}
      const end=(s.items&&s.items.data[0]&&s.items.data[0].current_period_end)||s.current_period_end||0;
      if(s.status==="active"&&end*1000>new Date(d.expires_at).getTime()){
        const r=await svc.registrar.renew(d.name,1);
        await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{expires_at:r.expireDate||new Date(new Date(d.expires_at).getTime()+365*864e5).toISOString(),last_error:null}});
        n++;
      }
    }catch(err){await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{last_error:("Renewal: "+err.message).slice(0,500)}}).catch(()=>{})}
  }
  return n;
}

const pub=d=>({id:d.id,name:d.name,source:d.source,status:d.status,is_primary:d.is_primary,price_cents:d.price_cents,expires_at:d.expires_at,
  auto_renew:d.auto_renew,last_error:d.last_error,last_check:d.last_check});

module.exports=async(req,res)=>{
  const send=(status,d)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(d))};
  try{
    if(!SB_URL||!SB_ANON||!SB_SERVICE)return send(503,{error:"Domains aren't switched on for this site yet."});
    const svc=await services();

    if(req.method==="GET"){
      if(!e.CRON_SECRET||(req.headers.authorization||"")!=="Bearer "+e.CRON_SECRET)return send(401,{error:"Not allowed."});
      const rows=await sb(`/rest/v1/lodge_domains?select=*&status=in.(${ACTIVE.join(",")})&limit=200`);
      for(const d of rows)await advanceOne(d,svc).catch(err=>console.error("[domains] check failed",d.name,err.message));
      return send(200,{checked:rows.length,renewed:await renewals(svc)});
    }
    if(req.method!=="POST")return send(405,{error:"Use POST."});

    const body=req.body&&typeof req.body==="object"?req.body:JSON.parse(await readBody(req)||"{}");
    const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    if(!token)return send(401,{error:"Sign in first."});
    const user=await sb("/auth/v1/user",{token}).catch(()=>{throw fail("Your sign-in has expired. Sign in again.",401)});
    const lid=String(body.lodge_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(lid))return send(400,{error:"Which lodge?"});
    const [mem]=await sb(`/rest/v1/lodge_members?select=role&lodge_id=eq.${lid}&user_id=eq.${user.id}`);
    if(!mem||mem.role==="member")return send(403,{error:"Only the lodge's officers can manage its web address."});
    const owner=mem.role==="owner";
    const needOwner=()=>{if(!owner)throw fail("Only the lodge's account owner can buy or remove a domain.",403)};
    const [lodge]=await sb(`/rest/v1/lodges?select=id,slug,name,number&id=eq.${lid}`);
    if(!lodge)return send(404,{error:"Lodge not found."});
    const mine=async id=>{
      const [d]=await sb(`/rest/v1/lodge_domains?select=*&id=eq.${enc(String(id||""))}&lodge_id=eq.${lid}`);
      if(!d)throw fail("Domain not found.",404);return d;
    };
    const origin="https://"+(req.headers["x-forwarded-host"]||req.headers.host);
    const rules={markupCents:Number(await setting("DOMAIN_MARKUP_CENTS"))||K.DEFAULT_PRICING.markupCents,minimumCents:Number(await setting("DOMAIN_MINIMUM_CENTS"))||K.DEFAULT_PRICING.minimumCents};

    if(body.action==="list"){
      let rows=await sb(`/rest/v1/lodge_domains?select=*&lodge_id=eq.${lid}&status=neq.checkout&order=created_at`);
      rows=await Promise.all(rows.map(d=>ACTIVE.includes(d.status)?advanceOne(d,svc).catch(()=>d):d));
      return send(200,{domains:rows.map(pub),canBuy:!!(svc.registrar&&svc.host),canConnect:!!svc.host,sandbox:svc.sandbox,owner});
    }

    if(body.action==="search"){
      needOwner();
      if(!svc.registrar)return send(503,{error:"Buying domains isn't set up yet."});
      const typed=domainName(String(body.q||"").includes(".")?body.q:"");
      const word=(typed?typed.split(".")[0]:String(body.q||"")).toLowerCase().replace(/[^a-z0-9-]/g,"").replace(/^-+|-+$/g,"").slice(0,63);
      if(word.length<2)return send(400,{error:"Type a name to search for."});
      const names=[...new Set([...(typed?[typed]:[]),...ENDINGS.map(x=>`${word}.${x}`)])];
      const quotes=(await svc.registrar.checkAvailability(names)).map(r=>K.quoteFrom(r,rules)).map(q=>({domain:q.domain,available:q.available,priceCents:q.priceCents,reason:q.reason}));
      return send(200,{quotes:names.map(n=>quotes.find(q=>q.domain===n)).filter(Boolean),sandbox:svc.sandbox});
    }

    if(body.action==="buy"){
      needOwner();
      const key=await stripeKey();
      if(!key||!svc.registrar||!svc.host)return send(503,{error:"Buying domains isn't set up yet."});
      const name=domainName(body.domain);if(!name)return send(400,{error:"That doesn't look like a domain."});
      const c=body.contact||{},F=["firstName","lastName","address1","city","state","zip","country","email","phone"];
      const contact={};for(const f of F){contact[f]=String(c[f]||"").trim().slice(0,120);if(!contact[f])return send(400,{error:"Please fill in every owner detail. Domain registries require them."})}
      if(c.companyName)contact.companyName=String(c.companyName).trim().slice(0,120);
      contact.country=contact.country.toUpperCase().slice(0,2);
      const digits=contact.phone.replace(/[^\d+]/g,"");
      contact.phone=digits.startsWith("+")?digits.replace(/^\+(\d{1,3})(\d+)$/,"+$1.$2"):"+1."+digits.replace(/^1(?=\d{10}$)/,"");
      if(!/^\S+@\S+\.\S+$/.test(contact.email))return send(400,{error:"Please enter a valid email. The registry sends a confirmation there."});
      const [q]=(await svc.registrar.checkAvailability([name])).map(r=>K.quoteFrom(r,rules));
      if(!q||!q.available)return send(400,{error:`${name}: ${(q&&q.reason||"can't be bought right now").toLowerCase()}.`});
      const [old]=await sb(`/rest/v1/lodge_domains?select=id,status&name=eq.${enc(name)}`);
      if(old&&!["checkout","refunded","removed"].includes(old.status))return send(400,{error:`${name} is already being set up.`});
      if(old)await sb(`/rest/v1/lodge_domains?id=eq.${old.id}`,{method:"DELETE"});
      const [d]=await sb("/rest/v1/lodge_domains",{method:"POST",body:{lodge_id:lid,name,source:"purchased",status:"checkout",price_cents:q.priceCents,registrant:contact}});
      const meta={kind:"domain",domain_id:d.id,lodge_id:lid,domain:name};
      const s=await stripe(key,"/checkout/sessions",{
        mode:"subscription",
        line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:q.priceCents,recurring:{interval:"year"},
          product_data:{name:`Web address: ${name}`,description:"Renews yearly at the same price. Cancel any time; the domain stays the lodge's until it expires."}}}],
        client_reference_id:"d_"+d.id,metadata:meta,subscription_data:{metadata:meta},customer_email:user.email,
        success_url:`${origin}/lodges/${enc(lodge.slug)}?domain_session={CHECKOUT_SESSION_ID}#settings`,
        cancel_url:`${origin}/lodges/${enc(lodge.slug)}#settings`
      });
      await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{stripe_session_id:s.id}});
      return send(200,{url:s.url});
    }

    if(body.action==="paid"){
      const key=await stripeKey();if(!key)return send(503,{error:"Stripe isn't connected to this site yet."});
      const sid=String(body.session_id||"");
      if(!/^cs_[A-Za-z0-9_]+$/.test(sid))return send(400,{error:"That payment link isn't right."});
      const [d]=await sb(`/rest/v1/lodge_domains?select=*&stripe_session_id=eq.${enc(sid)}&lodge_id=eq.${lid}`);
      if(!d)return send(404,{error:"That payment isn't for one of this lodge's domains."});
      if(d.status==="checkout"){
        const s=await stripe(key,"/checkout/sessions/"+enc(sid));
        if(s.status!=="complete"||s.payment_status!=="paid")return send(400,{error:"Stripe hasn't finished that payment yet."});
        await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{status:"paid",stripe_customer_id:typeof s.customer==="string"?s.customer:s.customer&&s.customer.id,
          stripe_subscription_id:typeof s.subscription==="string"?s.subscription:s.subscription&&s.subscription.id}});
      }
      const [fresh]=await sb(`/rest/v1/lodge_domains?select=*&id=eq.${d.id}`);
      return send(200,{domain:pub(await advanceOne(fresh,svc))});
    }

    if(body.action==="connect"){
      if(!svc.host)return send(503,{error:"Connecting domains isn't set up yet."});
      const name=domainName(body.domain);if(!name)return send(400,{error:"That doesn't look like a domain. Try something like yourlodge.org."});
      const [old]=await sb(`/rest/v1/lodge_domains?select=id,lodge_id,status&name=eq.${enc(name)}`);
      if(old&&old.lodge_id!==lid&&!["removed","refunded"].includes(old.status))return send(400,{error:`${name} is already connected to another lodge.`});
      let d;
      if(old)[d]=await sb(`/rest/v1/lodge_domains?id=eq.${old.id}`,{method:"PATCH",body:{lodge_id:lid,source:"connected",status:"pending",attempts:0,last_error:null,price_cents:0,created_at:new Date().toISOString()}});
      else [d]=await sb("/rest/v1/lodge_domains",{method:"POST",body:{lodge_id:lid,name,source:"connected",status:"pending"}});
      return send(200,{domain:pub(await advanceOne(d,svc))});
    }

    if(body.action==="records"){
      const d=await mine(body.id);if(!svc.host)return send(503,{error:"Connecting domains isn't set up yet."});
      const st=await svc.host.status(d.name),target=await svc.host.target(d.name,st.verification);
      return send(200,{records:K.recordsToSet(d.name,target)});
    }
    if(body.action==="check"){
      let d=await mine(body.id);
      if(d.status==="needs_attention"&&d.source==="connected")[d]=await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{status:"verifying",attempts:0,created_at:new Date().toISOString()}});
      return send(200,{domain:pub(await advanceOne(d,svc))});
    }
    if(body.action==="primary"){
      const d=await mine(body.id);if(d.status!=="live")return send(400,{error:"Only a live domain can be the main address."});
      await sb(`/rest/v1/lodge_domains?lodge_id=eq.${lid}`,{method:"PATCH",body:{is_primary:false}});
      await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{is_primary:true}});
      return send(200,{ok:true});
    }
    if(body.action==="remove"){
      needOwner();
      const d=await mine(body.id);
      if(d.source==="purchased"&&ACTIVE.includes(d.status))return send(400,{error:"This domain is still being set up. Try again once it's live."});
      if(svc.host&&d.status!=="checkout"){await svc.host.detach(d.name);await svc.host.detach("www."+d.name).catch(()=>{})}
      if(d.source==="connected"||["checkout","refunded"].includes(d.status))await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"DELETE"});
      else await sb(`/rest/v1/lodge_domains?id=eq.${d.id}`,{method:"PATCH",body:{status:"removed",is_primary:false}});
      return send(200,{ok:true});
    }
    return send(400,{error:"Unknown action."});
  }catch(err){
    console.error("[domains]",err.message);
    send(err.status&&err.status<500?err.status:500,{error:err.status&&err.status<500?err.message:"Couldn't do that just now. Please try again."});
  }
};
