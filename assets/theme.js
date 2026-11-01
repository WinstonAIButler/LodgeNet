/* Light or dark, chosen per device with the Light/Dark switch on each dashboard. Light (Danish Cream) is the default and the
   phone's own dark mode is ignored on purpose: Justin wants cream unless he picks dark himself. Load this in <head>, before
   the stylesheet paints, so a dark page never flashes cream. A page puts data-theme-slot on the element the switch goes in. */
(function(){
  const KEY="lodgenet-theme",root=document.documentElement;
  /* a page can start dark with <html data-theme-default="dark"> (Jarvis, which was always dark) until a choice is saved */
  const get=()=>{let v=null;try{v=localStorage.getItem(KEY)}catch(e){}return v==="dark"||v==="light"?v:root.dataset.themeDefault==="dark"?"dark":"light"};
  function apply(t){
    root.dataset.theme=t;
    const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#141d2a":"#f9f5ec";
    document.querySelectorAll(".theme-btn").forEach(b=>{
      b.setAttribute("aria-pressed",String(t==="dark"));
      b.querySelector("span").textContent=t==="dark"?"Light mode":"Dark mode";
    });
  }
  function set(t){try{localStorage.setItem(KEY,t)}catch(e){}apply(t)}
  apply(get());
  function mount(){
    document.querySelectorAll("[data-theme-slot]").forEach(slot=>{
      if(slot.querySelector(".theme-btn"))return;
      const b=document.createElement("button");
      b.type="button";b.className="theme-btn link-btn";b.title="Switch between light and dark";
      b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9z"/></svg><span></span>';
      b.addEventListener("click",()=>set(root.dataset.theme==="dark"?"light":"dark"));
      slot.appendChild(b);
    });
    apply(root.dataset.theme);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
  /* pages that build their sidebar later (the lodge gate, the owner sign-in) call this again */
  window.LodgeNetTheme={mount,set,get:()=>root.dataset.theme};
  window.addEventListener("storage",e=>{if(e.key===KEY)apply(get())});
})();
