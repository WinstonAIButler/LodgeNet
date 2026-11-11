/* Light or dark, chosen per device with the Light / Dark toggle on each dashboard (top right, and the sidebar foot on lodge pages). Light (Danish Cream) is the default and the
   phone's own dark mode is ignored on purpose: Justin wants cream unless he picks dark himself. Load this in <head>, before
   the stylesheet paints, so a dark page never flashes cream. A page puts data-theme-slot on the element the switch goes in. */
(function(){
  const KEY="lodgenet-theme",root=document.documentElement;
  /* a page can start dark with <html data-theme-default="dark"> (Jarvis, which was always dark) until a choice is saved */
  const get=()=>{let v=null;try{v=localStorage.getItem(KEY)}catch(e){}return v==="dark"||v==="light"?v:root.dataset.themeDefault==="dark"?"dark":"light"};
  function apply(t){
    root.dataset.theme=t;
    const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#141d2a":"#f9f5ec";
    document.querySelectorAll(".theme-toggle [data-t]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.t===t)));
  }
  function set(t){try{localStorage.setItem(KEY,t)}catch(e){}apply(t)}
  apply(get());
  function mount(){
    document.querySelectorAll("[data-theme-slot]").forEach(slot=>{
      if(slot.querySelector(".theme-toggle"))return;
      /* a two-way Light / Dark switch; Light is the cream of the main site */
      const g=document.createElement("div");
      g.className="theme-toggle";g.setAttribute("role","group");g.setAttribute("aria-label","Color mode");
      g.innerHTML='<button type="button" data-t="light" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.4"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>Light</button>'
        +'<button type="button" data-t="dark" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9z"/></svg>Dark</button>';
      g.addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(b)set(b.dataset.t)});
      slot.appendChild(g);
    });
    apply(root.dataset.theme);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
  /* pages that build their sidebar later (the lodge gate, the owner sign-in) call this again */
  window.LodgeNetTheme={mount,set,get:()=>root.dataset.theme};
  window.addEventListener("storage",e=>{if(e.key===KEY)apply(get())});
})();
