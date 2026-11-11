/* "Continue with Google / Apple / Microsoft" buttons, shown only for the providers switched on in Supabase
   (Authentication → Sign In / Providers). LodgeNetOAuth.render(box, returnTo, beforeLeave) fills box with them and hides it when none are on. */
(function(){
  const ICON={
    google:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>',
    apple:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>',
    azure:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>'};
  const NAME={google:"Google",apple:"Apple",azure:"Microsoft (Outlook, Hotmail)"};
  if(!document.getElementById("oauth-css")){
    const c=document.createElement("style");c.id="oauth-css";
    c.textContent=`.oauth{display:grid;gap:8px}.oauth .btn{justify-content:center;background:#fff;color:#1f1f1f;border:1px solid #b9ae97;width:100%}
.oauth .btn:hover{background:#f3f3f3}.oauth svg{width:18px;height:18px}.oauth-or{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;margin:6px 0 2px}
.oauth-or::before,.oauth-or::after{content:"";flex:1;border-top:1px solid var(--line)}`;
    document.head.appendChild(c);
  }
  async function render(box,returnTo,before){
    const A=window.LodgeNetAuth,on=await A.providers();
    const list=["google","apple","azure"].filter(p=>on[p]);
    box.hidden=!list.length;if(!list.length)return;
    box.innerHTML=`<div class="oauth">${list.map(p=>`<button class="btn" type="button" data-oauth="${p}">${ICON[p]}<span>Continue with ${NAME[p]}</span></button>`).join("")}</div><div class="oauth-or">or use your email</div>`;
    box.querySelectorAll("[data-oauth]").forEach(b=>b.addEventListener("click",async()=>{
      b.disabled=true;
      try{if(before)await before();
        const sb=await A.client();
        const {error}=await sb.auth.signInWithOAuth({provider:b.dataset.oauth,options:{redirectTo:returnTo,...(b.dataset.oauth==="azure"?{scopes:"email"}:{})}});
        if(error)throw error;
      }catch(e){b.disabled=false;alert("Couldn't open "+NAME[b.dataset.oauth]+" sign-in: "+e.message)}
    }));
  }
  window.LodgeNetOAuth={render};
})();
