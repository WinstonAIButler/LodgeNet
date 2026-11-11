/* Content blocks for lodge websites. The public site (assets/lodge-site.js) and the dashboard's Website preview
   (assets/site-pages.js) both draw a page's blocks with LodgeSiteBlocks.render(), so what an officer sees is what visitors get.

   Block types: heading {text}, text {text}, image {src, caption}, button {label, href}, html {html}.
   Custom HTML runs inside a sandboxed iframe with no allow-same-origin: its scripts and styles work, but it gets an opaque
   origin, so it can't read LodgeNet sign-ins, cookies or lodge records, or touch the page around it. The frame reports its
   height with postMessage so it sizes to its content. */
(function(){
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const safeHref=u=>/^(https:\/\/[^\s"<>]+|mailto:[^\s"<>]+|tel:[+\d\s().-]+|\/site\/[^\s"<>]*)$/i.test(u||"")?u:"";
  const okImg=u=>/^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(u||"")||/^https:\/\/[^\s"<>]+$/i.test(u||"");
  const paras=t=>String(t||"").trim().split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p.trim()).replace(/\n/g,"<br>")}</p>`).join("");
  const SANDBOX="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";
  const SIZER='<script>(function(){function s(){parent.postMessage({lodgenetFrame:1,h:Math.ceil(document.documentElement.scrollHeight)},"*")}'
    +'addEventListener("load",s);try{new ResizeObserver(s).observe(document.documentElement)}catch(e){}setTimeout(s,60)})()<\/script>';
  const HTML_MAX=200000;
  /* a whole document keeps its own <head>; a fragment gets a plain wrapper. Links open in a new tab unless the HTML sets its own <base>. */
  function frameDoc(html){
    html=String(html||"").slice(0,HTML_MAX);
    if(/<!doctype|<html[\s>]/i.test(html)){
      let d=html;
      if(!/<base\s/i.test(d)&&/<head[^>]*>/i.test(d))d=d.replace(/<head[^>]*>/i,m=>m+'<base target="_blank">');
      return /<\/body>/i.test(d)?d.replace(/<\/body>/i,()=>SIZER+"</body>"):d+SIZER;
    }
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      +(/<base\s/i.test(html)?"":'<base target="_blank">')
      +'<style>body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d2433}img,video,iframe{max-width:100%}</style></head><body>'
      +html+SIZER+"</body></html>";
  }
  let wired=false;
  function wire(){
    if(wired)return;wired=true;
    addEventListener("message",e=>{
      if(!e.data||e.data.lodgenetFrame!==1)return;
      document.querySelectorAll("iframe.blk-frame").forEach(f=>{if(f.contentWindow===e.source)f.style.height=Math.min(20000,Math.max(40,+e.data.h||0))+"px"});
    });
  }
  function block(b){
    switch(b&&b.type){
      case "heading":return b.text?`<h2 class="blk-h">${esc(b.text)}</h2>`:"";
      case "text":return String(b.text||"").trim()?`<div class="blk-t">${paras(b.text)}</div>`:"";
      case "image":return okImg(b.src)?`<figure class="blk-img"><img src="${esc(b.src)}" alt="${esc(b.caption||"")}" loading="lazy">${b.caption?`<figcaption>${esc(b.caption)}</figcaption>`:""}</figure>`:"";
      case "button":{const h=safeHref(b.href);
        return h&&b.label?`<p class="blk-b"><a class="btn" href="${esc(h)}"${/^https:/i.test(h)?' target="_blank" rel="noopener"':""}>${esc(b.label)}</a></p>`:""}
      case "html":return String(b.html||"").trim()?`<iframe class="blk-frame" title="${esc(b.title||"Lodge content")}" sandbox="${SANDBOX}" referrerpolicy="no-referrer" srcdoc="${esc(frameDoc(b.html))}" style="height:120px"></iframe>`:"";
    }
    return "";
  }
  window.LodgeSiteBlocks={render(blocks){wire();return (blocks||[]).map(block).join("")},esc,safeHref,okImg,HTML_MAX};
})();
