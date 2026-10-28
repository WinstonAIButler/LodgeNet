/* "What it would cost separately" on Home and Pricing. TOOLS is the one list both pages draw from: each row is a job the lodge
   dashboard does and the entry-level paid plan of a well-known standalone tool for that job, at its lowest published monthly rate
   (yearly billing where the vendor offers it). Prices were checked in October 2026 and are estimates; payment fees aren't included.
   The Lodge Level price comes live from Stripe (/api/plans, via assets/plans.js) and falls back to LODGE below. */
(function(){
  const TOOLS=[
    {job:"Lodge website",what:"Website builder with your own domain",ex:"Squarespace Basic",mo:16},
    {job:"Members, titles and dues",what:"Membership roster and dues tracking",ex:"WildApricot, 100 contacts",mo:66},
    {job:"Merchandise store",what:"Online store with an order form",ex:"Shopify Basic",mo:19},
    {job:"Treasury",what:"Bookkeeping: ledger, dues and fund balances",ex:"QuickBooks Online Simple Start",mo:38},
    {job:"Meeting minutes",what:"AI transcription that turns a meeting into notes",ex:"Otter.ai Pro",mo:8.33},
    {job:"Sponsor search",what:"AI business search and prospect lists",ex:"Apollo.io Basic, 1 user",mo:49},
    {job:"Pipelines",what:"CRM for prospects, stages and follow-ups",ex:"HubSpot Sales Hub Starter, 1 seat",mo:20},
    {job:"Fundraisers",what:"Fundraiser pages with goals and donations",ex:"GiveWP Pro",mo:20},
    {job:"Lodge calendar",what:"Shared calendar for meetings and events",ex:"Teamup Plus",mo:12}
  ];
  /* things LodgeNet does that no off-the-shelf tool does for a lodge; shown as included, never priced */
  const EXTRA=[
    ["Stated Communication minutes template","Short form, full write-up and PDF in your lodge's own wording"],
    ["Officer chairs and Masonic titles","WM to Tiler, B. / WB. / RWB., Past Masters"],
    ["Charities tied to every sale and donation","Each charity is a fund in Treasury and a choice in the store"]
  ];
  const SOURCES=[
    ["Squarespace","https://beancount.io/blog/2026/09/17/squarespace-new-pricing-basic-core-plus-advanced-small-business-guide"],
    ["WildApricot","https://costbench.com/software/board-management/wildapricot/"],
    ["Shopify","https://craftshift.com/shopify-basic-plan-2026/"],
    ["QuickBooks Online","https://auditfriendly.co/answers/quickbooks-online-price-increase-2026"],
    ["Otter.ai","https://www.castmagic.io/fr/blog/otter-ai-pricing"],
    ["Apollo.io","https://costbench.com/software/sales-intelligence/apollo-io"],
    ["HubSpot","https://automationatlas.io/answers/hubspot-pricing-explained-2026/"],
    ["GiveWP","https://projectcostestimator.com/blog/nonprofit-fundraising-platform-cost-2026"],
    ["Teamup","https://www.teamup.com/pricing/"]
  ];
  const LODGE=49.99;
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const usd=(n,cents)=>"$"+(cents?n.toFixed(2):Math.round(n).toLocaleString("en-US"));
  const per=n=>Number.isInteger(n)?usd(n):usd(n,true);
  const total=TOOLS.reduce((t,x)=>t+x.mo,0);

  function table(){
    return `<table class="vtable">
      <thead><tr><th>What the lodge needs</th><th>Typical standalone tool</th><th>Per month</th></tr></thead>
      <tbody>${TOOLS.map(t=>`<tr><td><b>${esc(t.job)}</b><small>${esc(t.what)}</small></td><td>${esc(t.ex)}</td><td class="amt">${per(t.mo)}</td></tr>`).join("")}
      ${EXTRA.map(([a,b])=>`<tr class="extra"><td><b>${esc(a)}</b><small>${esc(b)}</small></td><td>No standalone equivalent</td><td class="inc">Only in LodgeNet</td></tr>`).join("")}</tbody>
      <tfoot><tr><td>Bought separately</td><td></td><td class="amt">${usd(total)} / mo</td></tr></tfoot>
    </table>
    <p class="sources">Estimates. Each price is the entry-level paid plan of a well-known tool in that category, at its lowest published monthly rate (yearly billing where offered), checked October 2026. Vendors change prices, most charge more per extra user or contact, and payment processing fees are extra everywhere, including LodgeNet. Sources: ${SOURCES.map(([n,u])=>`<a href="${u}" rel="noopener" target="_blank">${esc(n)}</a>`).join(", ")}.</p>`;
  }
  function summary(price,box){
    const save=total-price,pct=Math.round(save/total*100);
    box.querySelectorAll("[data-v]").forEach(el=>{
      el.textContent={them:usd(total),themyr:usd(total*12),ours:per(price),oursyr:usd(price*12),save:usd(save*12),pct:pct+"%",count:String(TOOLS.length)}[el.dataset.v]||el.textContent;
    });
  }
  function lodgePrice(){
    const P=window.LodgeNetPlans;if(!P)return Promise.resolve(LODGE);
    return P.load().then(list=>{
      const p=list.find(x=>x.amount>0&&x.interval==="month"&&/lodge/i.test(x.name)&&!/grand|district|valley|starter/i.test(x.name));
      return p?p.amount/100:LODGE;
    }).catch(()=>LODGE);
  }
  document.querySelectorAll("[data-value-table]").forEach(el=>el.innerHTML=table());
  const boxes=document.querySelectorAll("[data-value-sum]");
  boxes.forEach(b=>summary(LODGE,b));
  if(boxes.length)lodgePrice().then(p=>boxes.forEach(b=>summary(p,b)));
})();
