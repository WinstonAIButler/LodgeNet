/* A confirmation, magic-link or password-reset email can land on any page: Supabase sends people to its Site URL
   when the link's own return address isn't on its allowed list. Only /login knows how to finish signing in,
   so hand the link's tokens (in the # or ?code=) on to it. Load it early in <head> on public pages. */
(function(){
  if(location.pathname==="/login")return;
  const h=location.hash,q=new URLSearchParams(location.search);
  const tokens=/(^|[#&])(access_token|error_description|error_code)=/.test(h)||/[#&]type=(signup|recovery|magiclink|invite|email_change)/.test(h);
  if(!tokens&&!(q.has("code")&&!q.has("session_id")))return;
  location.replace("/login"+(q.has("code")?"?code="+encodeURIComponent(q.get("code")):"")+h);
})();
