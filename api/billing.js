// Lodge plan billing: Stripe Checkout to subscribe ($19 / month), the Stripe Customer Portal to manage it,
// and a sync that reads the subscription back from Stripe (on return from Checkout or the Portal), so no webhook is needed.
// POST /api/billing {action:"checkout"|"portal"|"sync", lodge_id, session_id?} with the owner's Supabase access token.
// Needs SUPABASE_SERVICE_ROLE_KEY, and a Stripe secret key: STRIPE_SECRET_KEY from Vercel's Stripe integration,
// otherwise the one saved in the owner's hub (platform_secrets, row stripe_secret_key).
const PRICE_CENTS=1900;
const e=process.env;
const SB_URL=e.SUPABASE_URL||e.NEXT_PUBLIC_SUPABASE_URL||"";
const SB_ANON=e.SUPABASE_ANON_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY||e.SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"";
const SB_SERVICE=e.SUPABASE_SERVICE_ROLE_KEY||e.SUPABASE_SECRET_KEY||"";
const LIVE=["active","trialing","past_due"],ENDED=["canceled","unpaid","incomplete_expired"];

async function sb(path,{method="GET",body,token}={}){
  const key=token?SB_ANON:SB_SERVICE;
  const r=await fetch(SB_URL+path,{method,body:body&&JSON.stringify(body),
    headers:{apikey:key,Authorization:"Bearer "+(token||SB_SERVICE),"Content-Type":"application/json",Prefer:"return=representation"}});
  const t=await r.text(),d=t?JSON.parse(t):null;
  if(!r.ok)throw Object.assign(new Error((d&&(d.message||d.msg||d.error_description))||r.statusText),{status:r.status});
  return d;
}

let savedKey=null;
async function stripeKey(){
  if(e.STRIPE_SECRET_KEY)return e.STRIPE_SECRET_KEY;
  if(!savedKey){
    try{const [row]=await sb("/rest/v1/platform_secrets?select=*&name=eq.stripe_secret_key");savedKey=row&&(row.value||row.secret)||null}
    catch(err){savedKey=null}
  }
  return savedKey;
}

/* Stripe takes form encoding with bracketed keys: line_items[0][price_data][currency]=usd */
function form(o,prefix,out=[]){
  for(const [k,v] of Object.entries(o)){
    if(v==null)continue;
    const key=prefix?`${prefix}[${k}]`:k;
    if(typeof v==="object")form(v,key,out);else out.push(encodeURIComponent(key)+"="+encodeURIComponent(v));
  }
  return out.join("&");
}
async function stripe(key,path,params){
  const r=await fetch("https://api.stripe.com/v1"+path,{method:params?"POST":"GET",body:params&&form(params),
    headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"}});
  const d=await r.json();
  if(!r.ok)throw Object.assign(new Error(d.error&&d.error.message||"Stripe error"),{status:502});
  return d;
}

function readBody(req){return new Promise((ok,no)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>ok(b));req.on("error",no)})}

module.exports=async(req,res)=>{
  const send=(status,d)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(d))};
  if(req.method!=="POST")return send(405,{error:"Use POST."});
  try{
    if(!SB_URL||!SB_ANON||!SB_SERVICE)return send(503,{error:"Billing isn't switched on for this site yet."});
    const key=await stripeKey();
    if(!key)return send(503,{error:"Stripe isn't connected to this site yet."});
    const body=req.body&&typeof req.body==="object"?req.body:JSON.parse(await readBody(req)||"{}");
    const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    if(!token)return send(401,{error:"Sign in first."});
    const user=await sb("/auth/v1/user",{token}).catch(err=>{throw Object.assign(new Error("Your sign-in has expired. Sign in again."),{status:401})});
    const lid=String(body.lodge_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(lid))return send(400,{error:"Which lodge?"});
    const [mem]=await sb(`/rest/v1/lodge_members?select=role&lodge_id=eq.${lid}&user_id=eq.${user.id}`);
    if(!mem||mem.role!=="owner")return send(403,{error:"Only the lodge's account owner can manage billing."});
    const [lodge]=await sb(`/rest/v1/lodges?select=id,name,number,plan,comped,stripe_customer_id,stripe_subscription_id,billing_status&id=eq.${lid}`);
    const origin="https://"+(req.headers["x-forwarded-host"]||req.headers.host);

    if(body.action==="checkout"){
      if(lodge.comped)return send(400,{error:"This lodge is already on the Lodge plan at no charge."});
      if(LIVE.includes(lodge.billing_status))return send(400,{error:"This lodge already has a subscription. Use Manage billing."});
      const s=await stripe(key,"/checkout/sessions",{
        mode:"subscription",
        line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:PRICE_CENTS,recurring:{interval:"month"},
          product_data:{name:"LodgeNet Lodge plan"}}}],
        client_reference_id:lid,
        metadata:{lodge_id:lid},
        subscription_data:{metadata:{lodge_id:lid,lodge:`${lodge.name}${lodge.number?" No. "+lodge.number:""}`}},
        ...(lodge.stripe_customer_id?{customer:lodge.stripe_customer_id}:{customer_email:user.email}),
        allow_promotion_codes:true,
        success_url:`${origin}/login?billing=done&lodge=${lid}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:`${origin}/login`
      });
      return send(200,{url:s.url});
    }

    if(body.action==="portal"){
      if(!lodge.stripe_customer_id)return send(400,{error:"This lodge hasn't subscribed yet."});
      const p=await stripe(key,"/billing_portal/sessions",{customer:lodge.stripe_customer_id,return_url:`${origin}/login?billing=sync&lodge=${lid}`});
      return send(200,{url:p.url});
    }

    if(body.action==="sync"){
      const patch={};
      if(body.session_id){
        const s=await stripe(key,"/checkout/sessions/"+encodeURIComponent(body.session_id));
        if(s.client_reference_id!==lid||s.status!=="complete")return send(400,{error:"That checkout doesn't belong to this lodge or isn't finished."});
        patch.stripe_customer_id=s.customer;patch.stripe_subscription_id=s.subscription;
      }
      const subId=patch.stripe_subscription_id||lodge.stripe_subscription_id;
      if(!subId)return send(200,{plan:lodge.plan,billing_status:lodge.billing_status});
      const sub=await stripe(key,"/subscriptions/"+encodeURIComponent(subId));
      patch.billing_status=sub.status;
      if(LIVE.includes(sub.status)&&lodge.plan==="starter")patch.plan="lodge";
      if(ENDED.includes(sub.status)&&lodge.plan==="lodge"&&!lodge.comped)patch.plan="starter";
      const [row]=await sb(`/rest/v1/lodges?id=eq.${lid}`,{method:"PATCH",body:patch});
      return send(200,{plan:row.plan,billing_status:row.billing_status});
    }

    return send(400,{error:"Unknown action."});
  }catch(err){
    return send(err.status===401?401:err.status||500,{error:err.message});
  }
};
