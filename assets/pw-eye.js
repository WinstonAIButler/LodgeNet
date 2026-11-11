/* Show / hide button (an eye) on every password box, including ones added to the page later.
   Load it on any page with a password field: <script src="/assets/pw-eye.js" defer></script> */
(function(){
  if(window.__pwEye)return;window.__pwEye=1;
  const EYE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const SHUT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const css=document.createElement("style");
  css.textContent=`.pw-wrap{position:relative;display:block}.pw-wrap>input{width:100%;padding-right:46px!important;box-sizing:border-box}
.pw-eye{position:absolute;top:50%;right:4px;transform:translateY(-50%);width:38px;height:38px;display:grid;place-items:center;
  background:none;border:0;border-radius:8px;cursor:pointer;color:inherit;opacity:.7;padding:0}
.pw-eye:hover,.pw-eye[aria-pressed="true"]{opacity:1}.pw-eye:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.pw-eye svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}`;
  document.head.appendChild(css);
  function add(inp){
    if(inp.dataset.pwEye)return;inp.dataset.pwEye="1";
    const wrap=document.createElement("span");wrap.className="pw-wrap";
    inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
    const b=document.createElement("button");
    b.type="button";b.className="pw-eye";b.innerHTML=EYE;
    b.setAttribute("aria-label","Show password");b.setAttribute("aria-pressed","false");
    if(inp.id)b.setAttribute("aria-controls",inp.id);
    b.addEventListener("click",()=>{
      const show=inp.type==="password";
      inp.type=show?"text":"password";
      b.innerHTML=show?SHUT:EYE;
      b.setAttribute("aria-label",show?"Hide password":"Show password");
      b.setAttribute("aria-pressed",String(show));
      inp.focus({preventScroll:true});
    });
    wrap.appendChild(b);
  }
  const scan=root=>(root.querySelectorAll?root:document).querySelectorAll('input[type="password"]').forEach(add);
  function start(){
    scan(document);
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType!==1)return;
      if(n.matches&&n.matches('input[type="password"]'))add(n);else scan(n);
    }))).observe(document.body,{childList:true,subtree:true});
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start):start();
})();
