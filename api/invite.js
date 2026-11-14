// Add someone to a lodge's dashboard and email them an invitation.
// POST /api/invite {lodge_id, email, role:"officer"|"member"} with the account owner's Supabase access token.
//   1. checks the caller is the lodge's account owner
//   2. records the invite in lodge_invites (claim_invites() turns it into a membership when they sign in)
//   3. emails them: a new person gets Supabase's "Invite user" email, whose link signs them in and opens
//      /login to choose a password; someone who already has a LodgeNet account gets a sign-in link instead.
// The link brings them back to /login?invited=<lodge slug>, which sends them on to the lodge's dashboard.
// Needs SUPABASE_SERVICE_ROLE_KEY. Supabase's built-in email sender only sends a few emails an hour;
// set up custom SMTP in Supabase (Authentication → Emails) for real use.
const e=process.env;
const PUBLIC=require("./_public");
const SB_URL=e.SUPABASE_URL||e.NEXT_PUBLIC_SUPABASE_URL||PUBLIC.url;
const SB_ANON=e.SUPABASE_ANON_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY||e.SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||(SB_URL===PUBLIC.url?PUBLIC.key:"");
const SB_SERVICE=e.SUPABASE_SERVICE_ROLE_KEY||e.SUPABASE_SECRET_KEY||"";
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sb(path,{method="GET",body,token,anon,prefer}={}){
  const key=token||anon?SB_ANON:SB_SERVICE;
  const r=await fetch(SB_URL+path,{method,body:body&&JSON.stringify(body),
    headers:{apikey:key,Authorization:"Bearer "+(token||key),"Content-Type":"application/json",Prefer:prefer||"return=representation"}});
  const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch(x){d={message:t}}
  if(!r.ok)throw Object.assign(new Error((d&&(d.msg||d.message||d.error_description||d.error))||r.statusText),{status:r.status,code:d&&(d.error_code||d.code)});
  return d;
}
function readBody(req){return new Promise((ok,no)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>ok(b));req.on("error",no)})}
/* only send people back to this site */
function siteOrigin(req){
  const h=String(req.headers["x-forwarded-host"]||req.headers.host||"");
  return /(^|\.)lodgenet\.app$|\.vercel\.app$|^localhost(:\d+)?$/.test(h)?(h.startsWith("localhost")?"http://":"https://")+h:"https://www.lodgenet.app";
}

module.exports=async(req,res)=>{
  const send=(status,d)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(d))};
  if(req.method!=="POST")return send(405,{error:"Use POST."});
  try{
    if(!SB_URL||!SB_ANON||!SB_SERVICE)return send(503,{error:"Email invites aren't switched on for this site yet."});
    const body=req.body&&typeof req.body==="object"?req.body:JSON.parse(await readBody(req)||"{}");
    const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    if(!token)return send(401,{error:"Sign in first."});
    const user=await sb("/auth/v1/user",{token}).catch(()=>{throw Object.assign(new Error("Your sign-in has expired. Sign in again."),{status:401})});
    const lid=String(body.lodge_id||""),email=String(body.email||"").trim().toLowerCase(),role=body.role==="officer"?"officer":"member";
    if(!/^[0-9a-f-]{36}$/i.test(lid))return send(400,{error:"Which lodge?"});
    if(!EMAIL.test(email)||email.length>254)return send(400,{error:"Enter their email address."});

    const [me]=await sb(`/rest/v1/lodge_members?select=role&lodge_id=eq.${lid}&user_id=eq.${user.id}`);
    if(!me||me.role!=="owner")return send(403,{error:"Only the lodge's account owner can add people."});
    const [lodge]=await sb(`/rest/v1/lodges?select=slug,name,number&id=eq.${lid}`);
    if(!lodge)return send(404,{error:"That lodge wasn't found."});
    const already=await sb(`/rest/v1/lodge_members?select=user_id&lodge_id=eq.${lid}&email=ilike.${encodeURIComponent(email)}`);
    if(already.length)return send(409,{error:email+" is already on this dashboard."});

    await sb("/rest/v1/lodge_invites?on_conflict=lodge_id,email",{method:"POST",body:{lodge_id:lid,email,role},prefer:"resolution=merge-duplicates,return=minimal"});

    const lodgeName=lodge.name+(lodge.number?" No. "+lodge.number:"");
    const back=siteOrigin(req)+"/login?invited="+encodeURIComponent(lodge.slug);
    let sent="invite";
    try{
      await sb("/auth/v1/invite?redirect_to="+encodeURIComponent(back),{method:"POST",body:{email,data:{invited_to:lodgeName,invited_by:user.email||""}}});
    }catch(err){
      /* they already have a LodgeNet account: send a sign-in link; signing in claims the invite */
      if(err.status===422||/already.*(registered|exists)/i.test(err.message)||err.code==="email_exists"){
        sent="signin";
        await sb("/auth/v1/otp?redirect_to="+encodeURIComponent(back),{method:"POST",anon:true,body:{email,create_user:false}});
      }else throw err;
    }
    return send(200,{ok:true,sent,email,role});
  }catch(err){
    const rate=err.status===429||/rate limit/i.test(err.message);
    return send(rate?429:err.status&&err.status<500?err.status:500,{error:rate?"Too many emails have gone out in the last hour. The invite is saved; try sending again later, or email them the link yourself.":err.message||"Something went wrong."});
  }
};
