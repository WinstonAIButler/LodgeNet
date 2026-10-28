// Hands the browser the Supabase project URL and its public (anon / publishable) key.
// Both are meant to be public: Row Level Security in supabase/schema.sql is what guards the data.
// Never add the service role key here.
module.exports=(req,res)=>{
  const e=process.env;
  const url=e.SUPABASE_URL||e.NEXT_PUBLIC_SUPABASE_URL||"";
  const key=e.SUPABASE_ANON_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY||e.SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"";
  res.setHeader("Content-Type","application/json");
  res.setHeader("Cache-Control","no-store");
  /* billing: api/billing.js can run (it also needs a Stripe key, from Vercel or the owner's hub) */
  const billing=!!(e.SUPABASE_SERVICE_ROLE_KEY||e.SUPABASE_SECRET_KEY);
  res.end(JSON.stringify(url&&key?{url,key,billing}:{}));
};
