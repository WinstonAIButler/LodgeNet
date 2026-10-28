// Stripe calls shared by api/billing.js and api/plans.js. The key is STRIPE_SECRET_KEY from Vercel's Stripe integration,
// otherwise the one saved in the owner's hub (platform_secrets, row stripe_secret_key), read with the service role.
const e=process.env;
const PUBLIC=require("./_public");
const SB_URL=e.SUPABASE_URL||e.NEXT_PUBLIC_SUPABASE_URL||PUBLIC.url;
const SB_SERVICE=e.SUPABASE_SERVICE_ROLE_KEY||e.SUPABASE_SECRET_KEY||"";

let savedKey=null;
async function stripeKey(){
  if(e.STRIPE_SECRET_KEY)return e.STRIPE_SECRET_KEY;
  if(!savedKey&&SB_SERVICE){
    try{
      const r=await fetch(SB_URL+"/rest/v1/platform_secrets?select=*&name=eq.stripe_secret_key",{headers:{apikey:SB_SERVICE,Authorization:"Bearer "+SB_SERVICE}});
      const [row]=r.ok?await r.json():[];savedKey=row&&(row.value||row.secret)||null;
    }catch(err){savedKey=null}
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

/* the plans for sale: every active recurring price on an active product, cheapest first.
   A product's marketing features are its benefit list; metadata.order (a number) can set the order instead. */
async function plans(key){
  const d=await stripe(key,"/prices?active=true&type=recurring&limit=100&expand[]=data.product");
  return d.data.filter(p=>p.product&&typeof p.product==="object"&&p.product.active&&p.unit_amount!=null).map(p=>({
    price:p.id,name:p.product.name,description:p.product.description||"",
    amount:p.unit_amount,currency:p.currency,interval:p.recurring.interval,interval_count:p.recurring.interval_count,
    features:(p.product.marketing_features||[]).map(f=>f.name).filter(Boolean),
    order:Number(p.product.metadata&&p.product.metadata.order)
  })).sort((a,b)=>(isNaN(a.order)?a.amount:a.order)-(isNaN(b.order)?b.amount:b.order)||a.amount-b.amount);
}

module.exports={stripeKey,stripe,plans};
