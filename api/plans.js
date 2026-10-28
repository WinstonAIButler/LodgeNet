// GET /api/plans: the plans and prices as set up in Stripe, for the Pricing page and step 2 of Start.
// {plans:[{price,name,description,amount,currency,interval,interval_count,features}]}, or {plans:[]} when Stripe isn't connected.
const {stripeKey,plans}=require("./_stripe");
module.exports=async(req,res)=>{
  res.setHeader("Content-Type","application/json");
  try{
    const key=await stripeKey();
    const list=key?await plans(key):[];
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=600");
    res.end(JSON.stringify({plans:list.map(({order,...p})=>p)}));
  }catch(err){
    res.setHeader("Cache-Control","no-store");
    res.end(JSON.stringify({plans:[],error:err.message}));
  }
};
