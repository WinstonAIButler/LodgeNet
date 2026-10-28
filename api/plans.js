// GET /api/plans: the plans and prices as set up in Stripe, for the Pricing page and step 2 of Start.
// {stripe:"test"|"live"|"none", plans:[{price,name,description,amount,currency,interval,interval_count,features}]}.
const {stripeKey,plans}=require("./_stripe");
module.exports=async(req,res)=>{
  res.setHeader("Content-Type","application/json");
  try{
    const key=await stripeKey();
    const list=key?await plans(key):[];
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=600");
    /* stripe says which kind of key the site found (never the key itself), so a missing or wrong-mode key is easy to spot */
    const kind=!key?"none":/^(sk|rk)_test_/.test(key)?"test":/^(sk|rk)_live_/.test(key)?"live":"other";
    res.end(JSON.stringify({stripe:kind,plans:list.map(({order,...p})=>p)}));
  }catch(err){
    res.setHeader("Cache-Control","no-store");
    res.end(JSON.stringify({plans:[],error:err.message}));
  }
};
