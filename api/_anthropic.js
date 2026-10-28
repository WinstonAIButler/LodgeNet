// The Anthropic API key, from Vercel's environment variables. ANTHROPIC_API_KEY is the usual name; a key added through
// Vercel's Anthropic integration (joslin-enterprises-anthropic) may carry a prefix, so any variable named like *ANTHROPIC*KEY counts.
// Server-side only: never send it to the browser.
module.exports=()=>{
  const e=process.env;
  if(e.ANTHROPIC_API_KEY)return e.ANTHROPIC_API_KEY;
  const name=Object.keys(e).sort().find(k=>/ANTHROPIC/i.test(k)&&/KEY$/i.test(k)&&/^sk-ant-/.test(e[k]||""));
  return name?e[name]:"";
};
