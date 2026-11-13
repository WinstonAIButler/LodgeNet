/* The "Blue Book" layout for a lodge's own tabs (custom-tabs.js): a yearly directory and calendar book, kept page for page
   in the order and look of the printed book (4 × 9 in pages), so officers bring it up to date each year instead of
   rebuilding it. Start it from last year's PDF (Import from PDF) and every page comes in as one of:
     cover     the front: year, title lines, edition
     body      a lodge or body: name, location, stated communications, correspondence and the officers table
     calendar  a month, drawn from every body's meeting day plus the extra dates entered here
     sponsors  the sponsor index, filled in from the ad pages
     picture   an ad or piece of artwork, kept as a picture of the page
     text      anything else: a message, a prayer, Grand Lodge information
   Start the next year's book moves the year on (2026 → 2027 wherever it's written), redraws the calendars, keeps last
   year's officers as a reference, and marks every page "to check" so the officers can tick them off as they go.
   Content lives in the tab's own data (t.c.bluebook). jsPDF draws every page; pdf.js shows those pages on screen
   and reads the PDF on import. Both load only when needed. */
(function(){
  const PDFJS="/assets/vendor/pdf.min.js",PDFJS_WORKER="/assets/vendor/pdf.worker.min.js",JSPDF="/assets/vendor/jspdf.umd.min.js";
  const PW=288,PH=648,M=18;                      /* page in points: 4 × 9 in, 1/4 in margins */
  const PIC_W=640,PIC_Q=.78,WARN_BYTES=8e6;
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const KINDS=[["cover","Cover"],["body","Lodge or body"],["calendar","Calendar month"],["sponsors","Sponsor index"],["picture","Picture or ad"],["text","Text page"]];
  const KN=Object.fromEntries(KINDS);
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clone=o=>JSON.parse(JSON.stringify(o));

  const loaded={};
  function loadScript(src){
    return loaded[src]||(loaded[src]=new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;
      s.onerror=()=>{delete loaded[src];no(new Error("couldn't load "+src.split("/").pop()))};document.head.appendChild(s)}));
  }
  async function pdfjs(){await loadScript(PDFJS);window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib}
  async function jspdf(){if(!window.jspdf)await loadScript(JSPDF);return window.jspdf.jsPDF}

  /* ================= meeting days: "1st Tuesday", "2nd & 4th Monday", "Last Friday", "(Jan/Apr/July/Oct)" ================= */
  const ORD={"1st":1,first:1,"2nd":2,second:2,"3rd":3,third:3,"4th":4,fourth:4,"5th":5,fifth:5,last:-1};
  const MON3=MONTHS.map(m=>m.slice(0,3).toLowerCase());
  function parseRule(s){
    s=String(s||"").replace(/\b(st|nd|rd|th)\s?([1-5])\b/gi,"$2$1");
    const day=s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i);if(!day)return null;
    const dow=["sun","mon","tue","wed","thu","fri","sat"].indexOf(day[1].toLowerCase());
    const before=s.slice(0,day.index);
    const nth=[...before.slice(-24).matchAll(/\b(1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth|last|[1-5](?=\s*(?:\.|&|and|,|$|\s)))/gi)].map(m=>ORD[m[1].toLowerCase()]||+m[1]);
    if(!nth.length)return null;
    const ms=[...s.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b/gi)].map(m=>MON3.indexOf(m[1].toLowerCase()));
    return {nth,dow,months:ms.length>1?ms:null};
  }
  function ruleDays(rule,y,m){
    if(!rule||(rule.months&&!rule.months.includes(m)))return [];
    const first=new Date(y,m,1).getDay(),len=new Date(y,m+1,0).getDate(),out=[];
    const d1=1+((rule.dow-first+7)%7);
    for(const n of rule.nth){
      let d=n>0?d1+(n-1)*7:(()=>{let x=d1;while(x+7<=len)x+=7;return x})();
      if(d<=len)out.push(d);
    }
    return out;
  }
  /* everything on the calendar for one month: {day: [labels]} */
  function monthItems(B,y,m){
    const out={},put=(d,l)=>{if(!l)return;(out[d]=out[d]||[]).includes(l)||out[d].push(l)};
    for(const p of B.pages)if(p.k==="body"&&p.label&&p.cal!==false)ruleDays(parseRule(p.meets),y,m).forEach(d=>put(d,p.label));
    for(const r of B.repeat||[])ruleDays(parseRule(r.rule),y,m).forEach(d=>put(d,r.label));
    for(const e of B.dates||[]){const d=new Date(e.date+"T12:00");if(!isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m)put(d.getDate(),e.label)}
    return out;
  }

  /* ================= drawing the pages (jsPDF, points) ================= */
  const pdfText=s=>String(s||"").replace(/[‐-―]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF•…]/g,"");
  const ordinal=n=>n+(n%100>10&&n%100<14?"th":["th","st","nd","rd"][n%10]||"th");
  function pageNos(B){
    const first=Math.max(1,+B.firstNo||2),out={};
    B.pages.forEach((p,i)=>{if(i+1>=first)out[p.id]=i+2-first});
    return out;
  }
  async function draw(B,only){
    const J=await jspdf(),doc=new J({unit:"pt",format:[PW,PH],orientation:"portrait"});
    const nos=pageNos(B),list=only?B.pages.filter(p=>only.includes(p.id)):B.pages;
    for(let i=0;i<list.length;i++){
      if(i)doc.addPage([PW,PH],"portrait");
      const p=list[i];
      try{PAGE[p.k]?PAGE[p.k](doc,p,B,nos):PAGE.text(doc,p,B,nos)}catch(e){doc.setFontSize(9);doc.text("Couldn't draw this page: "+pdfText(e.message||e),M,M+10)}
      if(nos[p.id]&&p.k!=="calendar"&&p.k!=="picture"&&p.k!=="cover"){doc.setFont("times","normal");doc.setFontSize(10);doc.setTextColor(26,26,26);doc.text(String(nos[p.id]),PW/2,PH-14,{align:"center"})}
    }
    if(!list.length){doc.setFontSize(11);doc.text("No pages yet.",M,M+12)}
    return doc;
  }
  const yr=(B,s)=>String(s||"").replace(/\{year\}/g,B.year);
  /* a page linked to the District tab shares its officers there, year by year: the year's list entered on either side is the one printed */
  const DX=()=>window.LodgeNetDistrict&&window.LodgeNetDistrict.getRoster?window.LodgeNetDistrict:null;
  /* an ad page linked to a sponsor prints that sponsor's ad from the Sponsors tab */
  const SPN=()=>window.LodgeNetDash&&window.LodgeNetDash.sponsors?window.LodgeNetDash.sponsors():null;
  const sponsorOf=p=>{const L=SPN();return p.spon&&L?L.find(x=>x.id===p.spon):null};
  const adOf=p=>{const x=sponsorOf(p);return x&&x.ad||p.src};
  const nameOf=p=>{const x=sponsorOf(p);return x?x.name:p.sponsor};
  function officersOf(p,B){const X=DX();if(p.dist&&X){const r=X.getRoster(p.dist,B.year);if(r&&r.length)return r}return p.officers||[]}
  /* write lines that fit a width, shrinking the type until they fit the height */
  function fit(doc,text,w,h,size,min,lh){
    for(let s=size;s>=min;s-=.5){doc.setFontSize(s);const L=doc.splitTextToSize(text,w);if(L.length*s*lh<=h)return {L,s}}
    doc.setFontSize(min);return {L:doc.splitTextToSize(text,w),s:min};
  }
  function image(doc,src,x,y,w,h){
    if(!src)return;
    const fmt=/^data:image\/png/.test(src)?"PNG":"JPEG",pr=doc.getImageProperties(src),k=Math.min(w/pr.width,h/pr.height);
    const iw=pr.width*k,ih=pr.height*k;doc.addImage(src,fmt,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
  }
  const PAGE={
    cover(doc,p,B){
      doc.setTextColor(26,26,26);doc.setFont("times","bold");
      const lines=[String(B.year),...yr(B,p.lines||"").split("\n")];
      const sizes=lines.map((l,i)=>i===0?40:/^(published|by)\b/i.test(l)?14:20);
      let h=0;lines.forEach((l,i)=>h+=sizes[i]*1.3+(l.trim()?0:-sizes[i]*.6));
      const ed=+B.edition?ordinal(+B.edition)+" Annual Edition":"";
      if(p.src)h+=150;if(ed)h+=30;
      let y=Math.max(M+30,(PH-h)/2);
      lines.forEach((l,i)=>{doc.setFont("times",i===0||sizes[i]>14?"bold":"normal");doc.setFontSize(sizes[i]);
        doc.splitTextToSize(pdfText(l),PW-2*M).forEach(x=>{doc.text(x,PW/2,y+sizes[i],{align:"center"});y+=sizes[i]*1.3})});
      if(p.src){image(doc,p.src,M+30,y+10,PW-2*M-60,130);y+=150}
      if(ed){doc.setFont("times","bold");doc.setFontSize(16);doc.text(ed,PW/2,y+24,{align:"center"})}
    },
    picture(doc,p){
      const src=adOf(p);if(src)image(doc,src,0,0,PW,PH);
      else{doc.setFontSize(11);doc.setTextColor(120);doc.text(pdfText(p.title||"Picture page")+": no picture yet",PW/2,PH/2,{align:"center"})}
    },
    text(doc,p,B){
      doc.setTextColor(26,26,26);let y=M+6;
      if(p.title){doc.setFont("times","bold");const t=fit(doc,pdfText(yr(B,p.title)),PW-2*M,80,20,12,1.2);
        t.L.forEach(l=>{doc.text(l,PW/2,y+t.s,{align:"center"});y+=t.s*1.2});y+=8}
      doc.setFont("times","normal");
      const body=pdfText(yr(B,p.body||"")),r=fit(doc,body,PW-2*M,PH-30-y,12,6.5,1.3);
      r.L.forEach(l=>{doc.text(l,p.center?PW/2:M,y+r.s,p.center?{align:"center"}:{});y+=r.s*1.3});
    },
    body(doc,p,B){
      doc.setTextColor(26,26,26);
      const emb=p.src?64:0,TW=PW-2*M-(emb?emb+6:0);
      let y=M+2;
      if(p.src)image(doc,p.src,PW-M-emb,M,emb,emb);
      doc.setFont("times","bold");
      const tt=fit(doc,pdfText(p.title||"Lodge or body"),TW,92,24,13,1.12);
      tt.L.forEach(l=>{doc.text(l,PW/2-(emb?(emb+6)/2:0),y+tt.s,{align:"center"});y+=tt.s*1.12});
      y=Math.max(y+6,emb?M+emb+4:0);
      /* two columns: location and correspondence | stated communications */
      const CW=(PW-2*M)/2-4,X2=M+CW+8;
      const col=(x,y0,head,text,sz)=>{let yy=y0;if(head){doc.setFont("times","bold");doc.setFontSize(11.5);doc.splitTextToSize(head,CW).forEach(l=>{doc.text(l,x,yy+11.5);yy+=13})}
        doc.setFont("times","normal");doc.setFontSize(sz||10.5);
        pdfText(text).split("\n").forEach(par=>doc.splitTextToSize(par,CW).forEach(l=>{if(/@|^www\.|^https?:/i.test(l))doc.setTextColor(26,60,170);doc.text(l,x,yy+(sz||10.5));doc.setTextColor(26,26,26);yy+=(sz||10.5)*1.18}));
        return yy};
      let yl=y,yr2=y;
      if(p.loc)yl=col(M,yl,"Location:",p.loc)+6;
      const mail=[p.mail,p.email].filter(Boolean).join("\n");
      if(mail)yl=col(M,yl,"Correspondence to:",mail,10)+4;
      const meets=[p.meets,p.dinner?"Dinner: "+p.dinner:"",p.meetsNote].filter(Boolean).join("\n");
      if(meets)yr2=col(X2,yr2,"Stated Communications:",meets)+4;
      y=Math.max(yl,yr2)+2;
      const offs=officersOf(p,B).filter(o=>o&&(o.t||o.n||o.p));
      doc.setLineWidth(1.6);doc.line(M-6,y,PW-M+6,y);y+=4;
      doc.setFont("times","bold");doc.setFontSize(12.5);doc.text("Officers for "+B.year,PW/2,y+13,{align:"center"});y+=22;
      const notes=pdfText(yr(B,p.notes||"")),noteH=notes?Math.min(80,doc.splitTextToSize(notes,PW-2*M).length*11+6):0;
      const room=PH-30-noteH-y,step=offs.length?Math.max(10,Math.min(26,room/offs.length)):0,sz=Math.min(10.5,Math.max(6.5,step*.62));
      doc.setFont("times","normal");doc.setFontSize(sz);
      const RW=Math.min(88,Math.max(56,...offs.map(o=>doc.getTextWidth(pdfText(o.t))))),NX=M+4+RW+6;
      offs.forEach(o=>{
        const ty=y+sz,rt=pdfText(o.t);
        if(doc.getTextWidth(rt)>RW)doc.setFontSize(Math.max(5.5,sz*RW/doc.getTextWidth(rt)));
        doc.text(rt,M+4,ty);doc.setFontSize(sz);
        const ph=pdfText(o.p),nm=pdfText(o.n),room=PW-M-2-(ph?doc.getTextWidth(ph)+6:0)-NX;
        if(doc.getTextWidth(nm)>room)doc.setFontSize(Math.max(6,sz*room/doc.getTextWidth(nm)));
        doc.text(nm,NX,ty);doc.setFontSize(sz);
        if(ph)doc.text(ph,PW-M-2,ty,{align:"right"});
        y+=step});
      if(notes){doc.setFontSize(8.5);doc.splitTextToSize(notes,PW-2*M).slice(0,7).forEach(l=>{doc.text(l,M,y+9);y+=11})}
    },
    sponsors(doc,p,B,nos){
      doc.setTextColor(26,26,26);let y=M+4;
      doc.setFont("times","normal");doc.setFontSize(20);doc.text(pdfText(p.title||"Sponsor Index"),PW/2,y+20,{align:"center"});y+=28;
      if(p.body){doc.setFontSize(10);doc.splitTextToSize(pdfText(yr(B,p.body)),PW-2*M).forEach(l=>{doc.text(l,M,y+10);y+=11.5});y+=6}
      const rows=sponsorRows(B,nos),min=Math.max(rows.length,+p.rows||0);
      const x1=M,x2=PW-M-46,x3=PW-M,rh=15;
      doc.setFont("times","bold");doc.setFontSize(12);doc.text("Business",(x1+x2)/2,y+11,{align:"center"});doc.text("Page",(x2+x3)/2,y+11,{align:"center"});y+=15;
      doc.setLineWidth(.6);doc.setFont("times","normal");doc.setFontSize(10);
      for(let i=0;i<min&&y+rh<PH-24;i++){
        doc.rect(x1,y,x2-x1,rh);doc.rect(x2,y,x3-x2,rh);
        const r=rows[i];if(r){doc.text(doc.splitTextToSize(pdfText(r.name),x2-x1-8)[0],x1+4,y+11);doc.text(String(r.no||""),(x2+x3)/2,y+11,{align:"center"})}
        y+=rh}
    },
    calendar(doc,p,B){
      /* drawn sideways, as in the printed book: the month reads up the page */
      const y0=B.year+(+p.plus||0),m=+p.month||0,items=monthItems(B,y0,m);
      const LW=PH,LH=PW,T=(X,Y)=>[Y,PH-X];         /* landscape (LW × LH) → portrait */
      const line=(a,b,c,d)=>{const[p1,q1]=T(a,b),[p2,q2]=T(c,d);doc.line(p1,q1,p2,q2)};
      const text=(s,X,Y,align,size,bold)=>{doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);
        const w=doc.getTextWidth(s),x=align==="center"?X-w/2:align==="right"?X-w:X,[px,py]=T(x,Y);doc.text(s,px,py,{angle:90})};
      doc.setTextColor(26,26,26);doc.setDrawColor(26,26,26);
      const gx=52,gy=50,gw=LW-gx-24,top=gy+28,hh=16,first=new Date(y0,m,1).getDay(),len=new Date(y0,m+1,0).getDate(),weeks=Math.ceil((first+len)/7);
      const cw=gw/7,ch=(LH-top-hh-12)/weeks;
      doc.setFillColor(214,220,230);const[fx,fy]=T(gx,gy+28);doc.rect(fx,fy-gw,hh+0,gw,"F");
      text(MONTHS[m].toUpperCase()+" "+y0,gx+gw/2,gy+21,"center",12,true);
      doc.setLineWidth(.9);line(gx,gy+28,gx+gw,gy+28);
      DAYS.forEach((d,i)=>text(d.toUpperCase(),gx+cw*i+cw/2,top+12,"center",8.5,true));
      doc.setLineWidth(.8);line(gx,top,gx+gw,top);line(gx,top+hh,gx+gw,top+hh);
      for(let w=0;w<=weeks;w++)line(gx,top+hh+ch*w,gx+gw,top+hh+ch*w);
      for(let i=0;i<=7;i++)line(gx+cw*i,top,gx+cw*i,top+hh+ch*weeks);
      for(let d=1;d<=len;d++){
        const c=(first+d-1)%7,w=Math.floor((first+d-1)/7),x=gx+cw*c,y=top+hh+ch*w;
        text(String(d),x+cw-3,y+9,"right",7.5,true);
        /* a day's items share lines, "40 & 297", as far as the cell is wide */
        let sz=7.2,L=[];
        for(;sz>=5;sz-=.4){doc.setFont("helvetica","normal");doc.setFontSize(sz);L=[];
          for(const it of (items[d]||[]).map(pdfText)){const last=L[L.length-1],j=last&&last+" & "+it;
            if(j&&doc.getTextWidth(j)<=cw-6)L[L.length-1]=j;else L.push(it)}
          if(L.length*(sz+1.5)<=ch-10)break}
        L.forEach((l,j)=>text(doc.splitTextToSize(l,cw-6)[0],x+3,y+10+(j+1)*(sz+1.5),"left",sz));
      }
    }
  };
  /* sponsor index rows, from the ad pages that name a business */
  function sponsorRows(B,nos){
    const r=B.pages.filter(p=>p.k==="picture"&&nameOf(p)&&nameOf(p).trim()).map(p=>({name:nameOf(p).trim(),no:nos[p.id]||""}));
    return r.sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"}));
  }

  /* ================= reading last year's PDF ================= */
  async function pageLines(page){
    const tc=await page.getTextContent(),vp=page.getViewport({scale:1}),items=[],raw=tc.items.map(i=>i.str).join(" ");
    for(const it of tc.items){if(!it.str||!it.str.trim())continue;
      const s=Math.hypot(it.transform[2],it.transform[3])||10;
      items.push({x:it.transform[4],y:vp.height-it.transform[5],s,w:it.width||0,t:it.str})}
    items.sort((a,b)=>Math.abs(a.y-b.y)<Math.min(a.s,b.s)*.45?a.x-b.x:a.y-b.y);
    const lines=[];
    for(const it of items){const L=lines[lines.length-1];
      if(L&&Math.abs(it.y-L.y)<Math.min(it.s,L.s)*.45){const c=L.cells[L.cells.length-1];
        if(it.x-(c.x+c.w)>Math.max(8,it.s*1.2))L.cells.push({x:it.x,w:it.w,t:it.t});else{c.t+=(it.x-(c.x+c.w)>it.s*.15&&!/\s$/.test(c.t)?" ":"")+it.t;c.w=it.x+it.w-c.x}
        L.s=Math.max(L.s,it.s)}
      else lines.push({y:it.y,s:it.s,cells:[{x:it.x,w:it.w,t:it.t}]})}
    lines.forEach(l=>{l.cells.forEach(c=>c.t=c.t.replace(/\s+/g," ").replace(/\b(st|nd|rd|th)\s?([1-5])\b/g,"$2$1").trim());l.cells=l.cells.filter(c=>c.t);l.text=l.cells.map(c=>c.t).join("   ")});
    /* superscripts (the "th" of 29th) sit on lines of their own: put them back after the number they belong to */
    const out=[];let sup="";
    for(const l of lines.filter(l=>l.text)){
      if(/^(st|nd|rd|th)$/i.test(l.text)){sup=l.text;continue}
      if(sup&&/(^|[^\d-])\d{1,2}$/.test(l.text)){l.text+=sup;l.cells[l.cells.length-1].t+=sup;sup=""}
      else if(sup&&/\b\d{1,2}(?=\s)/.test(l.text)){const f=x=>x.replace(/\b(\d{1,2})(?=\s)/,"$1"+sup);l.text=f(l.text);const c=l.cells.find(c=>/\b\d{1,2}(?=\s)/.test(c.t));if(c)c.t=f(c.t);sup=""}
      out.push(l)}
    return {lines:out,raw,w:vp.width,h:vp.height};
  }
  /* what's written in each day of a printed calendar page. The grid is printed sideways, so turn it upright first:
     across = the PDF's y (up), down = the PDF's x. A day's number sits in the top right corner of its square. */
  async function calendarCells(page){
    const tc=await page.getTextContent(),nums=[],labels=[];
    for(const it of tc.items){const t=it.str.replace(/\s+/g," ").trim();if(!t)continue;
      const X=it.transform[5],Y=it.transform[4];
      if(/^\d{1,2}$/.test(t)&&+t>=1&&+t<=31)nums.push({d:+t,X,Y});
      else if(!/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(t)&&!MONTH_RE.test(t))labels.push({t,X,Y})}
    const span=v=>{const s=v.slice().sort((a,b)=>a-b),g=[s[0]];for(const x of s)if(x-g[g.length-1]>20)g.push(x);return {lo:s[0],hi:s[s.length-1],n:g.length}};
    const sx=span(nums.map(n=>n.X)),sy=span(nums.map(n=>n.Y));
    const cw=nums.length?(sx.hi-sx.lo)/Math.max(1,sx.n-1):80,chh=nums.length?(sy.hi-sy.lo)/Math.max(1,sy.n-1):60;
    const out={};
    for(const l of labels){
      let best=null;
      for(const n of nums){const dx=n.X-l.X,dy=l.Y-n.Y;
        if(dx>-4&&dx<cw*1.05&&dy>-2&&dy<chh*1.05&&(!best||dx+dy*.5<best.s))best={n,s:dx+dy*.5}}
      if(best&&!/^\d+\/\d+$/.test(l.t))(out[best.n.d]=out[best.n.d]||[]).push(l)}
    /* a line starting "at 419" finishes the line above it */
    for(const d in out){const L=out[d].sort((a,b)=>a.Y-b.Y),m=[];
      for(const l of L){if(/^at\s/i.test(l.t)&&m.length)m[m.length-1]+=" "+l.t;else m.push(l.t)}
      out[d]=m.flatMap(splitLabel)}
    return out;
  }
  /* "40 & 297" is two lodges; "M & W Club" is one name */
  function splitLabel(t){const parts=t.split(/\s+&\s+/).map(x=>x.trim());
    return parts.length>1&&parts.some(x=>/\d/.test(x))&&parts.every(x=>x.length>1)?parts:[t]}
  /* how well a calendar name fits a lodge or body's title: shared words, initials, and no clash of numbers */
  function fitName(label,title){
    const ln=(label.match(/\d+/)||[])[0],tn=(title.match(/\b\d{1,3}\b/)||[])[0];
    if(ln&&tn&&ln!==tn)return -1;if(ln&&!tn)return -1;
    const gen=/^(club|lodge|chapter|council|the|and|of|no|order|omar)$/;
    const tw=title.toLowerCase().split(/[^a-z]+/).filter(w=>w&&!gen.test(w)),lw=label.toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=3&&!gen.test(w));
    let sc=lw.filter(w=>tw.some(x=>x.startsWith(w)||w.startsWith(x)&&x.length>=4)).length;
    const ini=title.split(/\s+/).filter(w=>/^[A-Z]/.test(w)).map(w=>w[0]).join(""),caps=label.replace(/[^A-Z]/g,"");
    if(caps.length>=2&&label.replace(/\s|\d/g,"")===caps&&(ini.startsWith(caps)||caps.startsWith(ini)))sc+=2;
    if(ln&&ln===tn)sc+=1;
    return sc;
  }
  /* repeating meetings and one-off dates, worked out from what the old calendars show */
  function learnCalendar(seen,known){
    const occ={};
    for(const {y,m,cells} of seen)for(const d in cells)for(const t of cells[d]){
      if(known.has(t.toLowerCase()))continue;(occ[t]=occ[t]||[]).push({y,m,d:+d})}
    const repeat=[],dates=[];
    for(const t in occ){
      const by={};
      for(const o of occ[t]){const dow=new Date(o.y,o.m,o.d).getDay(),n=Math.ceil(o.d/7),k=n+"-"+dow;(by[k]=by[k]||[]).push(o)}
      const best=Object.entries(by).sort((a,b)=>b[1].length-a[1].length)[0];
      let used=[];
      if(best&&best[1].length>=3){const[n,dow]=best[0].split("-").map(Number),ms=[...new Set(best[1].map(o=>o.m))].sort((a,b)=>a-b);
        repeat.push({label:t,rule:`${ordinal(n)} ${DAYS[dow]}`+(ms.length<=6?" ("+ms.map(m=>MONTHS[m].slice(0,3)).join("/")+")":"")});used=best[1]}
      for(const o of occ[t])if(!used.includes(o))dates.push({date:`${o.y}-${String(o.m+1).padStart(2,"0")}-${String(o.d).padStart(2,"0")}`,label:t})}
    dates.sort((a,b)=>a.date.localeCompare(b.date));repeat.sort((a,b)=>a.label.localeCompare(b.label));
    return {repeat,dates};
  }
  const PHONE=/\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/;
  const MONTH_RE=new RegExp("\\b("+MONTHS.join("|").toUpperCase()+")\\s+(20\\d\\d)\\b");
  function classify(P,i,info){
    const all=P.lines.map(l=>l.text).join("\n"),chars=all.replace(/\s|\d/g,"").length;
    if(i===0)return "cover";
    if(/sponsor index/i.test(all))return "sponsors";
    if(MONTH_RE.test(P.raw)&&/sunday/i.test(P.raw)&&/saturday/i.test(P.raw))return "calendar";
    if(chars<40)return "picture";
    if(/officers\s+for\s+20\d\d/i.test(all)&&P.lines.filter(l=>PHONE.test(l.text)).length>=2)return "body";
    return "text";
  }
  const lastNumber=P=>{for(let i=P.lines.length-1;i>=0;i--){const t=P.lines[i].text.trim();if(/^\d{1,3}$/.test(t))return +t}return null};
  /* ---------- officers' seats: the book's shorthand ("W. Master", "EHP", "3V") as each order names its offices ---------- */
  const orderOf=t=>{t=String(t).replace(/\n/g," ");return /royal arch|\bchapter no\.?\s*\d+\s*$/i.test(t)&&!/eastern star|oes/i.test(t)?"chapter":/council|royal\s*&\s*select/i.test(t)?"council":/commandery|knights templar/i.test(t)?"commandery":/eastern star|\boes\b/i.test(t)?"oes":/\blodge\b/i.test(t)?"blue":"club"};
  const SEATS={
    all:{treasurer:"Treasurer",treas:"Treasurer",tr:"Treasurer",secretary:"Secretary",sec:"Secretary",secy:"Secretary",recorder:"Recorder",rec:"Recorder",chaplain:"Chaplain",chap:"Chaplain",
      sentinel:"Sentinel",sent:"Sentinel",tiler:"Tiler",tyler:"Tiler",marshal:"Marshal",organist:"Organist",musician:"Musician",president:"President",pres:"President",
      vicepresident:"Vice President",vpres:"Vice President",vp:"Vice President",vicepres:"Vice President",vpresident:"Vice President",
      "1vp":"1st Vice President","1vpres":"1st Vice President","1vpresident":"1st Vice President","2vp":"2nd Vice President","2vpres":"2nd Vice President","2vpresident":"2nd Vice President",
      "3vp":"3rd Vice President","3vpres":"3rd Vice President","3vpresident":"3rd Vice President","1stvp":"1st Vice President","1stvpres":"1st Vice President","2ndvp":"2nd Vice President","2ndvpres":"2nd Vice President","3rdvp":"3rd Vice President","3rdvpres":"3rd Vice President",
      asstdir:"Assistant Director",assistantdirector:"Assistant Director",chaplin:"Chaplain",director:"Director",chairman:"Chairman",historian:"Historian"},
    blue:{wmaster:"Worshipful Master",wm:"Worshipful Master",worshipfulmaster:"Worshipful Master",master:"Worshipful Master",srwarden:"Senior Warden",sw:"Senior Warden",seniorwarden:"Senior Warden",
      jrwarden:"Junior Warden",jw:"Junior Warden",juniorwarden:"Junior Warden",srdeacon:"Senior Deacon",sd:"Senior Deacon",seniordeacon:"Senior Deacon",jrdeacon:"Junior Deacon",jd:"Junior Deacon",juniordeacon:"Junior Deacon",
      srsteward:"Senior Steward",ss:"Senior Steward",seniorsteward:"Senior Steward",jrsteward:"Junior Steward",js:"Junior Steward",juniorsteward:"Junior Steward",lecturer:"Lecturer"},
    chapter:{ehp:"Excellent High Priest",highpriest:"Excellent High Priest",k:"King",king:"King",s:"Scribe",scribe:"Scribe",ch:"Captain of the Host",cofh:"Captain of the Host",coh:"Captain of the Host",
      ps:"Principal Sojourner",rac:"Royal Arch Captain",ra:"Royal Arch Captain","3v":"Master of the 3rd Veil","2v":"Master of the 2nd Veil","1v":"Master of the 1st Veil",mov3:"Master of the 3rd Veil",mov2:"Master of the 2nd Veil",mov1:"Master of the 1st Veil"},
    council:{im:"Illustrious Master",tim:"Illustrious Master",dm:"Deputy Master",rdm:"Deputy Master",pcw:"Principal Conductor of the Work",cg:"Captain of the Guard",cofg:"Captain of the Guard",cc:"Conductor of the Council",cofc:"Conductor of the Council",steward:"Steward"},
    commandery:{ec:"Eminent Commander",g:"Generalissimo",gen:"Generalissimo",cg:"Captain General",pr:"Prelate",prelate:"Prelate",sw:"Senior Warden",jw:"Junior Warden",stb:"Standard Bearer",sb:"Standard Bearer",
      swb:"Sword Bearer",w:"Warder",warder:"Warder"},
    oes:{wm:"Worthy Matron",worthymatron:"Worthy Matron",wp:"Worthy Patron",worthypatron:"Worthy Patron",am:"Associate Matron",assocmatron:"Associate Matron",amatron:"Associate Matron",ap:"Associate Patron",assocpatron:"Associate Patron",apatron:"Associate Patron",
      cond:"Conductress",conductress:"Conductress",ac:"Associate Conductress",aconductress:"Associate Conductress",assocconductress:"Associate Conductress",warder:"Warder",adah:"Adah",ruth:"Ruth",esther:"Esther",martha:"Martha",electa:"Electa"}};
  const MONTH_ROW=/^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?$/i;
  function properSeats(list,title){
    const k=orderOf(title),T=Object.assign({},SEATS.all,SEATS[k]||{}),key=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const rows=(list||[]).map(o=>({t:String(o.t||"").trim(),n:String(o.n||"").trim(),p:String(o.p||"").trim()}));
    /* a seat printed over two lines ("R" … "AC") comes in as pieces around the name: put it back together */
    const out=[];
    for(let i=0;i<rows.length;i++){const o=rows[i];
      /* "Assistant" over "Director" is one seat */
      if(o.t&&!o.n&&!o.p&&/^(assistant|asst\.?|associate|assoc\.?|vice|deputy|past)$/i.test(o.t)&&rows[i+1]&&rows[i+1].t){rows[i+1].t=o.t+" "+rows[i+1].t;continue}
      if(o.t&&!o.n&&!o.p){const nx=rows[i+1];
        if(nx&&!nx.t&&(nx.n||nx.p)){nx.t=o.t;continue}
        const pv=out[out.length-1];if(pv&&pv._joined){pv.t+=" "+o.t;continue}
        if(nx&&nx.t&&(nx.n||nx.p)&&pv&&o.t.length<=3){pv.t+=" "+o.t;continue}
        out.push(o);continue}
      if(!o.t&&(o.n||o.p)&&out.length){const pv=out[out.length-1];if(pv.t&&!pv.n&&!pv.p){pv.n=o.n;pv.p=o.p;pv._joined=true;continue}}
      if(o.t&&rows[i-1]&&rows[i-1].t&&!rows[i-1].n&&!rows[i-1].p)o._joined=true;
      out.push(o)}
    /* "Steward", "Steward" in a lodge are its Senior and Junior Stewards */
    let stew=0;const many=out.filter(o=>key(o.t)==="steward").length;
    const notes=[];
    const known=new Set(Object.values(T).map(key));
    /* the seat run into the name ("V.President John Ingram"), and a phone on a line of its own */
    for(const o of out){if(!o.t&&o.n){const w=o.n.split(/\s+/);for(let j=Math.min(3,w.length-1);j>=1;j--){const pre=w.slice(0,j).join(" ");if(T[key(pre)]){o.t=pre;o.n=w.slice(j).join(" ");break}}}}
    for(let i=out.length-1;i>0;i--){const o=out[i];if(!o.t&&!o.n&&o.p&&!out[i-1].p){out[i-1].p=o.p;out.splice(i,1)}}
    const seats=out.filter(o=>{if(MONTH_ROW.test(o.t)){notes.push(o.t+" "+o.n);return false}
      /* a line with no name or phone that isn't a seat (an address, a heading) is a note, not an officer */
      if(o.t&&!o.n&&!o.p&&!T[key(o.t)]&&!known.has(key(o.t))&&!/steward|master|warden|deacon|officer|director|captain|conductor|bearer/i.test(o.t)){notes.push(o.t);return false}
      return o.t||o.n||o.p}).map(o=>{
      let t=o.t,kk=key(t);
      if(k==="blue"&&kk==="steward"&&many>=2)t=stew++?"Junior Steward":"Senior Steward";
      else if(k==="chapter"&&/^r\s*a?\s*c$/i.test(t.replace(/\./g,"")))t="Royal Arch Captain";
      else if(T[kk])t=T[kk];
      const n=k==="club"&&/scottish/i.test(title)?o.n.replace(/\b(3[23])(?!°)(\s|,|$)/,"$1°$2"):o.n;
      return {t,n,p:o.p}});
    return {seats,notes};
  }
  function parseBody(P){
    const L=P.lines.filter(l=>!/^\d{1,3}$/.test(l.text.trim()));
    const oi=L.findIndex(l=>/officers\s+for\s+20\d\d/i.test(l.text));
    const head=L.slice(0,oi),rest=L.slice(oi+1);
    /* title: the big type at the top */
    const ti=[];
    for(const l of head){if(l.s>=13&&(!ti.length||l.s>=head[0].s*.8))ti.push(l.text);else break}
    const below=head.slice(ti.length);
    /* the two columns under it */
    const mid=P.w/2,left=[],right=[];
    below.forEach(l=>l.cells.forEach(c=>(c.x<mid-10?left:right).push(c.t)));
    const p={k:"body",title:ti.join("\n")||(head[0]&&head[0].text)||"",loc:"",mail:"",email:"",meets:"",dinner:"",meetsNote:"",notes:"",officers:[]};
    let sec="loc";
    for(const t0 of left){let t=t0;
      if(/^location:?/i.test(t)){sec="loc";t=t.replace(/^location:?\s*/i,"")}
      if(/^correspondence( to)?:?/i.test(t)){sec="mail";t=t.replace(/^correspondence( to)?:?\s*/i,"")}
      if(!t)continue;
      if(/@/.test(t)&&!/\s/.test(t.trim())){p.email=t.trim();continue}
      p[sec]+=(p[sec]?"\n":"")+t}
    let rsec="meets";
    for(const t0 of right){let t=t0.replace(/^stated\s*/i,"").replace(/^communications?:?\s*/i,"").trim();
      if(!t)continue;
      const dm=t.match(/^dinner:?\s*(.*)$/i);if(dm){p.dinner=dm[1];rsec="meetsNote";continue}
      t=t.replace(/^meetings?:?\s*/i,"");if(!t)continue;
      if(rsec==="meets"&&!parseRule(p.meets)){p.meets+=(p.meets?" ":"")+t;continue}
      if(rsec==="meets")rsec="meetsNote";
      p[rsec]+=(p[rsec]?"\n":"")+t}
    /* officers: office · name · phone */
    /* tiny type (the ° of 33°) is dropped; a heading in larger type ends the officers, and what follows is a note */
    const rs=rest.map(l=>l.s).sort((a,b)=>a-b),rmed=rs[Math.floor(rs.length/2)]||10;let ended=false;
    for(const l of rest){
      if(l.s<rmed*.72&&l.text.length<=8)continue;
      if(ended||(l.s>rmed*1.2&&!PHONE.test(l.text)&&p.officers.length)){ended=true;p.notes+=(p.notes?"\n":"")+l.text;continue}
      const c=l.cells.map(x=>x.t),ph=(l.text.match(PHONE)||[""])[0];
      if(/e-?mail|@/i.test(l.text)&&!ph){p.notes+=(p.notes?"\n":"")+l.text;continue}
      const cs=c.map(x=>x.replace(PHONE,"").trim()).filter(Boolean);
      if(!cs.length&&!ph)continue;
      if(cs.length===1&&!ph&&l.cells[0].x>P.w*.25){p.notes+=(p.notes?"\n":"")+cs[0];continue}
      p.officers.push(cs.length>1?{t:cs[0],n:cs.slice(1).join(" "),p:ph}:ph?{t:"",n:cs[0]||"",p:ph}:{t:cs[0],n:"",p:""})}
    const fx=properSeats(p.officers,p.title);p.officers=fx.seats;p.seated=1;
    if(fx.notes.length)p.notes=(p.notes?p.notes+"\n":"")+fx.notes.join("\n");
    const num=(p.title.match(/\b(?:no\.?\s*)?(\d{1,3})\b/i)||[])[1];
    const T=p.title.replace(/\n/g," ");
    p.label=!num?T.replace(/^omar\s+/i,"").slice(0,22):/lodge/i.test(T)?num:/eastern star/i.test(T)?"OES "+num:/royal arch|chapter/i.test(T)?"RAM "+num:/commandery/i.test(T)?"KT "+num:/council/i.test(T)?"Council "+num:/rainbow/i.test(T)?"Rainbow "+num:/amaranth/i.test(T)?"AMD "+num:T.replace(/\s*no\.?\s*\d+.*$/i,"").slice(0,16)+" "+num;
    if(p.label.length>16)p.label=p.label.split(/\s+/).filter(w=>/^[A-Z]/.test(w)).map(w=>w[0]).join("");
    if(!p.email){const e=(p.mail.match(/\S+@\S+/)||[])[0];if(e){p.email=e;p.mail=p.mail.replace(e,"").trim()}}
    return p;
  }
  function parseText(P,i){
    const L=P.lines.filter(l=>!/^\d{1,3}$/.test(l.text.trim()));
    if(!L.length)return {k:"text",title:"",body:""};
    const big=L[0].s>=Math.max(13,(L.map(l=>l.s).sort((a,b)=>a-b)[Math.floor(L.length/2)]||11)*1.2);
    const tl=big?[L[0].text]:[];let j=big?1:0;
    while(big&&L[j]&&Math.abs(L[j].s-L[0].s)<1)tl.push(L[j++].text);
    let body="",prev=null;
    for(const l of L.slice(j)){
      if(prev)body+=l.y-prev.y>prev.s*1.9?"\n\n":"\n";
      body+=l.text;prev=l}
    body=body.trim();
    if(!tl.length){const f=body.split("\n")[0];if(f.length<60&&body.includes("\n")&&!PHONE.test(f)){tl.push(f);body=body.slice(f.length).trim()}}
    return {k:"text",title:tl.join(" "),body};
  }
  async function pagePicture(page){
    const vp1=page.getViewport({scale:1}),vp=page.getViewport({scale:PIC_W/vp1.width});
    const c=document.createElement("canvas");c.width=Math.round(vp.width);c.height=Math.round(vp.height);
    const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
    await page.render({canvasContext:x,viewport:vp}).promise;
    return c.toDataURL("image/jpeg",PIC_Q);
  }
  async function importPdf(file,progress){
    const lib=await pdfjs(),doc=await lib.getDocument({data:await file.arrayBuffer()}).promise,n=doc.numPages;
    const pages=[],texts=[];
    for(let i=0;i<n;i++){
      progress(`Reading page ${i+1} of ${n}…`);
      const page=await doc.getPage(i+1),P=await pageLines(page);texts.push(P);
      const k=classify(P,i);let p;
      if(k==="body"){p=parseBody(P);if(p.officers.length<2)p=parseText(P,i)}
      else if(k==="calendar"){const m=P.raw.match(MONTH_RE);p={k,month:MONTHS.findIndex(x=>x.toLowerCase()===m[1].toLowerCase()),year:+m[2]};
        p._cells=await calendarCells(page);p._seen={y:p.year,m:p.month}}
      else if(k==="sponsors"){const t=parseText(P,i);
        p={k,title:t.title||"Sponsor Index",body:(t.body.split(/\n+business\b/i)[0]||"").replace(/\n/g," ").trim(),rows:30,_rows:P.lines.map(l=>l.cells).filter(c=>c.length>=2&&/^\d{1,3}$/.test(c[c.length-1].t)).map(c=>({name:c.slice(0,-1).map(x=>x.t).join(" "),no:+c[c.length-1].t}))}}
      else if(k==="picture"||k==="cover")p={k,src:await pagePicture(page)};
      else p=parseText(P,i);
      if(k==="cover"){const t=P.lines.map(l=>l.text);
        p.year=+((t.join(" ").match(/\b(20\d\d)\b/)||[])[1])||new Date().getFullYear();
        p.edition=+((t.join(" ").match(/\b(\d{1,3})(?:st|nd|rd|th)\s+annual/i)||[])[1])||0;
        p.lines=t.filter(x=>!/^\s*20\d\d\s*$/.test(x)&&!/annual edition/i.test(x)).join("\n");
        if(p.lines.replace(/\s/g,"").length>20)delete p.src}
      p.id="pg-"+uid()+i;p.from=i+1;p.printed=lastNumber(P);
      pages.push(p);
    }
    doc.destroy();
    const cover=pages[0]&&pages[0].k==="cover"?pages[0]:null,year=cover?cover.year:new Date().getFullYear(),edition=cover&&cover.edition||0;
    /* the months run one after another; a page printed with the wrong month gets the one it should have had */
    const cals=pages.filter(p=>p.k==="calendar"),fixed=[];
    cals.forEach((p,j)=>{if(!j)return;const q=cals[j-1],want=(q.year*12+q.month)+1;
      if(p.year*12+p.month!==want){fixed.push(`book page ${p.from} showed ${MONTHS[p.month]} ${p.year}`);p.year=Math.floor(want/12);p.month=want%12}});
    pages.forEach(p=>{if(p.k==="calendar"){p.plus=p.year-year;delete p.year}});
    /* each month printed once is enough to learn from (the PDF repeats some) */
    const seen=[],had=new Set();
    for(const p of cals){const k=p._seen.y*12+p._seen.m;if(!had.has(k)){had.add(k);seen.push({y:p._seen.y,m:p._seen.m,cells:p._cells})}delete p._cells;delete p._seen}
    const known=new Set();
    pages.forEach(p=>{if(p.k==="body"&&p.label&&parseRule(p.meets))known.add(p.label.toLowerCase())});
    const learned=learnCalendar(seen,known);
    /* a body whose own name isn't on the old calendars, but that meets when a calendar name repeats, goes by that name */
    const onCal=new Set();seen.forEach(x=>Object.values(x.cells).forEach(L=>L.forEach(t=>onCal.add(t.toLowerCase()))));
    const pairs=[];
    learned.repeat.forEach(r=>{const R=parseRule(r.rule);if(!R)return;
      pages.forEach(p=>{if(p.k!=="body"||!p.label||onCal.has(p.label.toLowerCase()))return;const q=parseRule(p.meets);
        if(q&&q.dow===R.dow&&q.nth.length===1&&q.nth[0]===R.nth[0]){const sc=fitName(r.label,p.title.replace(/\n/g," "));if(sc>0)pairs.push({r,p,sc})}})});
    const usedR=new Set(),usedP=new Set();
    pairs.sort((a,b)=>b.sc-a.sc).forEach(x=>{if(usedR.has(x.r)||usedP.has(x.p))return;usedR.add(x.r);usedP.add(x.p);x.p.label=x.r.label});
    learned.repeat=learned.repeat.filter(r=>!usedR.has(r));
    /* name the ads from the sponsor index: its page numbers are the printed ones */
    const sp=pages.find(p=>p.k==="sponsors");
    if(sp){for(const r of sp._rows||[]){
        const hit=pages.find(p=>p.k==="picture"&&p.printed===r.no)||pages[r.no]&&pages[r.no].k==="picture"&&pages[r.no]||pages[r.no-1]&&pages[r.no-1].k==="picture"&&pages[r.no-1];
        if(hit&&!hit.sponsor)hit.sponsor=r.name}
      delete sp._rows}
    pages.forEach(p=>{delete p.printed;if(p.k==="picture")p.title=p.sponsor||"Picture page "+p.from;if(p.k==="cover"){delete p.year;delete p.edition}});
    /* the printed numbers start on the page after the cover unless the PDF says otherwise */
    return {year,edition,pages,source:file.name,fixed,repeat:learned.repeat,dates:learned.dates};
  }

  /* ================= next year ================= */
  function bumpYear(s,y){return String(s||"").replace(new RegExp("\\b"+(y+1)+"\\b","g"),"\u0000").replace(new RegExp("\\b"+y+"\\b","g"),String(y+1)).replace(/\u0000/g,String(y+2))}
  function nextYear(B){
    const y=+B.year;
    B.archive=B.archive||{};
    B.archive[y]={edition:B.edition,pages:B.pages.filter(p=>p.k==="body").map(p=>({id:p.id,title:p.title,meets:p.meets,officers:clone(officersOf(p,B))}))};
    B.pages.forEach(p=>{if(p.k==="body")p.officers=clone(officersOf(p,B))});
    const ys=Object.keys(B.archive).sort();while(ys.length>5)delete B.archive[ys.shift()];
    B.pages.forEach(p=>{["title","body","lines","notes","meetsNote","loc","mail"].forEach(k=>{if(p[k])p[k]=bumpYear(p[k],y)});delete p.ok});
    B.dates=(B.dates||[]).filter(e=>+String(e.date).slice(0,4)>y);
    B.year=y+1;if(+B.edition)B.edition=+B.edition+1;
  }

  /* link each lodge and body page to the District tab, and give the District tab what it's missing:
     the book year's officers where none are entered, and meeting day, meal, mail and email where the directory has none */
  function syncDistrict(B){
    const X=DX(),out={linked:0,officers:0,info:0};if(!X||!X.link)return out;
    for(const p of B.pages){if(p.k!=="body")continue;
      if(!p.seated){const fx=properSeats(p.officers,p.title);p.officers=fx.seats;if(fx.notes.length)p.notes=(p.notes?p.notes+"\n":"")+fx.notes.join("\n");p.seated=1}
      if(!p.dist)p.dist=X.link(p.title)||undefined;
      if(!p.dist&&X.addBody){p.dist=X.addBody({name:p.title.replace(/\n/g," ").replace(/\s+A\.?F\.?M\.?$/i,""),meets:p.meets,meal:p.dinner,mail:p.mail,email:p.email})||undefined;if(p.dist)out.added=(out.added||0)+1}
      if(!p.dist)continue;out.linked++;
      const offs=(p.officers||[]).filter(o=>o.n||o.p);
      /* the District tab's list is filled from the book when it's empty, or when all it has are some of the book's names */
      const nm=v=>String(v||"").toLowerCase().replace(/^(wb|rw|mw|b|bro)\s+/,"").replace(/[^a-z]/g,""),had=X.getRoster(p.dist,B.year);
      if(offs.length&&(!had.length||had.length<offs.length&&had.every(o=>offs.some(q=>nm(q.n).includes(nm(o.n)))))){X.putRoster(p.dist,B.year,offs);out.officers++}
      const sec=(p.officers||[]).find(o=>/secretary|recorder/i.test(o.t||"")&&o.n);
      out.info+=X.fillInfo(p.dist,{meets:p.meets,meal:p.dinner,mail:p.mail,email:p.email,contact:sec?(/recorder/i.test(sec.t)?"Recorder ":"Secretary ")+sec.n:"",phone:sec&&sec.p})}
    return out;
  }
  /* the ads that name a sponsor go on the Sponsors tab */
  function addSponsors(B){
    const S=window.LodgeNetDash&&window.LodgeNetDash.addSponsors;if(!S)return {added:0};
    const ads=B.pages.filter(p=>p.k==="picture"&&p.sponsor&&!p.spon);
    /* the Sponsors tab announces the change at once; the book's own ad pages are linked just below, so don't add more */
    importing=true;let r;try{r=S(ads.map(p=>({name:p.sponsor,ad:p.src,book:true})))}finally{importing=false}
    ads.forEach(p=>{const id=r.ids[p.sponsor];if(id){p.spon=id;delete p.src}});
    return r;
  }
  /* the Sponsors tab decides who runs in the book: new ones get an ad page after the last ad, dropped ones come out */
  let importing=false;
  function syncSponsors(B){
    const L=SPN();if(!L||importing)return 0;let n=0;
    /* one page per sponsor: a second copy comes out */
    const seen=new Set();
    for(let i=0;i<B.pages.length;i++){const p=B.pages[i];if(!p.spon)continue;if(seen.has(p.spon)){B.pages.splice(i--,1);n++}else seen.add(p.spon)}
    for(let i=B.pages.length-1;i>=0;i--){const p=B.pages[i];if(p.spon){const x=L.find(y=>y.id===p.spon);if(!x||!x.book){B.pages.splice(i,1);n++}}}
    for(const x of L.filter(y=>y.book&&!B.pages.some(p=>p.spon===y.id))){
      let at=-1;B.pages.forEach((p,j)=>{if(p.k==="picture"&&(p.spon||p.sponsor))at=j});
      B.pages.splice(at<0?B.pages.length:at+1,0,{id:"pg-"+uid(),k:"picture",spon:x.id,title:x.name});n++}
    return n;
  }

  /* ================= the tab ================= */
  const S={};const st=id=>S[id]||(S[id]={sel:null,msg:"",err:false,busy:false});
  function mount(box,t,data,o){
    const s=st(t.id),B=data,canEdit=!!o.canEdit,save=o.save;
    B.pages=Array.isArray(B.pages)?B.pages:[];B.year=+B.year||new Date().getFullYear();
    B.repeat=Array.isArray(B.repeat)?B.repeat:[];B.dates=Array.isArray(B.dates)?B.dates:[];
    if(canEdit&&B.pages.length&&syncSponsors(B))save();
    if(!B.pages.some(p=>p.id===s.sel))s.sel=B.pages[0]?B.pages[0].id:null;
    const $=q=>box.querySelector(q);
    box.innerHTML=`<div class="bb">
      <div class="bb-bar">
        <div class="bb-ed"><b class="bb-year"></b><span class="hint bb-prog"></span></div><span class="bb-sp"></span>
        ${canEdit?`<label class="btn line sm">Import from PDF<input type="file" accept="application/pdf,.pdf" hidden data-imp></label>
        <button type="button" class="btn line sm" data-next>Start the next year's book</button>`:""}
        <button type="button" class="btn sm" data-out>Download the Blue Book (PDF)</button>
      </div>
      <p class="hint bb-msg" role="status"></p>
      <div class="bb-main"><div class="bb-side"><ol class="bb-list" aria-label="Pages"></ol>
        ${canEdit?'<div class="bb-adds"><button type="button" class="btn line sm" data-addp>+ Add a section</button><button type="button" class="btn line sm" data-adds>+ Add a sponsor</button></div><div class="bb-slot"></div>':""}</div>
        <div class="bb-page"></div></div>
    </div>`;
    const msg=(m,err)=>{s.msg=m||"";s.err=!!err;const p=$(".bb-msg");if(p){p.textContent=s.msg;p.classList.toggle("bb-err",s.err)}};
    msg(s.msg,s.err);
    const changed=(redrawList)=>{save();if(redrawList)drawList();head();preview()};
    function head(){
      $(".bb-year").textContent=`${B.year} book`+(+B.edition?` · ${ordinal(+B.edition)} annual edition`:"");
      const n=B.pages.length,ok=B.pages.filter(p=>p.ok===B.year).length,X=DX();
      const lk=B.pages.filter(p=>p.k==="body"&&p.dist),has=X?lk.filter(p=>X.getRoster(p.dist,B.year).length).length:0;
      $(".bb-prog").textContent=n?`${ok} of ${n} pages checked for ${B.year}`+(lk.length?` · ${B.year} officers on the District tab for ${has} of ${lk.length} lodges and bodies`:""):"";
    }
    head();

    if(canEdit){
      $("[data-imp]").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
        if(B.pages.length&&!confirm(`Replace the ${B.pages.length} pages in this book with the pages of ${f.name}? Anything typed here will be replaced.`))return;
        try{s.busy=true;const r=await importPdf(f,m=>msg(m));
          Object.assign(B,{year:r.year,edition:r.edition,pages:r.pages,firstNo:2,source:r.source,repeat:r.repeat,dates:r.dates});
          const sync=syncDistrict(B),sp=addSponsors(B);
          s.sel=B.pages[0]&&B.pages[0].id;save();drawList();head();drawPage();
          const c=k=>B.pages.filter(p=>p.k===k).length,size=JSON.stringify(B).length;
          msg(`Read ${B.pages.length} pages from ${f.name}: ${c("body")} lodges and bodies, ${c("calendar")} calendar months, ${c("picture")} pictures and ads, ${c("text")} text pages, plus ${B.repeat.length} other repeating meetings and ${B.dates.length} one-off dates from the calendars. Check each page against the PDF; anything the reader got wrong can be typed over.`+(r.fixed.length?` The calendar months now run in order: ${r.fixed.join("; ")}.`:"")+(sync.linked?` ${sync.linked} pages are linked to the District tab: ${sync.officers} officer lists and ${sync.info} missing details went to it, and officers entered there for any year now show in that year's book.`+(sync.added?` ${sync.added} of them weren't in the district list and were added to it.`:""):"")+(sp.added||sp.updated?` ${sp.added} sponsors were added to the Sponsors tab${sp.updated?` and ${sp.updated} already there got their ad`:""}, with their ads; edit them there.`:"")+(size>WARN_BYTES?` The pictures add up to ${(size/1e6).toFixed(1)} MB, which slows down saving.`:""))}
        catch(err){msg("Couldn't read that PDF: "+(err.message||err),true)}
        finally{s.busy=false}});
      $("[data-addp]").addEventListener("click",()=>{
        const slot=$(".bb-slot");if(slot.innerHTML){slot.innerHTML="";return}
        slot.innerHTML=`<div class="bb-box"><b>Add a section</b><div class="bb-kinds">${KINDS.filter(k=>k[0]!=="cover").map(([k,n])=>`<button type="button" class="btn line sm" data-kind="${k}">${n}</button>`).join("")}</div>
          <p class="hint" style="margin:0">It goes after the page you have open. Move it with the arrows.</p></div>`;
        slot.querySelectorAll("[data-kind]").forEach(b=>b.addEventListener("click",()=>{
          const k=b.dataset.kind,p={id:"pg-"+uid(),k,title:k==="sponsors"?"Sponsor Index":"",officers:k==="body"?[{t:"",n:"",p:""}]:undefined,month:k==="calendar"?0:undefined,plus:0};
          const i=B.pages.findIndex(x=>x.id===s.sel);B.pages.splice(i<0?B.pages.length:i+1,0,p);s.sel=p.id;slot.innerHTML="";changed(true);drawPage()}));
      });
      /* a sponsor: an ad page among the others, in the sponsor index, and on the Sponsors tab */
      $("[data-adds]").addEventListener("click",()=>{
        const slot=$(".bb-slot");if(slot.innerHTML){slot.innerHTML="";return}
        const known=(window.LodgeNetDash&&window.LodgeNetDash.sponsorNames?window.LodgeNetDash.sponsorNames():[]).filter(n=>!B.pages.some(p=>p.sponsor&&p.sponsor.toLowerCase()===n.toLowerCase()));
        slot.innerHTML=`<div class="bb-box"><b>Add a sponsor</b>
          <div class="field"><label>Business</label><input data-sn list="bb-spn-${esc(t.id)}" placeholder="Business name"><datalist id="bb-spn-${esc(t.id)}">${known.map(n=>`<option value="${esc(n)}">`).join("")}</datalist></div>
          <div class="field"><label>Their ad (a picture; you can add it later)</label><input type="file" accept="image/*" data-sf></div>
          <div class="bb-kinds"><button type="button" class="btn sm" data-sgo>Add to the book</button><button type="button" class="link-btn" data-sx>Cancel</button></div>
          <p class="hint" style="margin:0">They go on the Sponsors tab too. The ad goes after the last sponsor's ad, and the sponsor index picks it up with its page number.</p></div>`;
        slot.querySelector("[data-sx]").addEventListener("click",()=>slot.innerHTML="");
        slot.querySelector("[data-sgo]").addEventListener("click",async()=>{
          const name=slot.querySelector("[data-sn]").value.trim();if(!name)return slot.querySelector("[data-sn]").focus();
          const f=slot.querySelector("[data-sf]").files[0];let ad;
          if(f)try{ad=await shrink(f,1400)}catch(e){return msg("Couldn't add that picture: "+(e.message||e),true)}
          const S=window.LodgeNetDash&&window.LodgeNetDash.addSponsors;
          if(!S){const p={id:"pg-"+uid(),k:"picture",sponsor:name,title:name,src:ad};B.pages.push(p);s.sel=p.id}
          else{const r=S([{name,ad,book:true}]),id=r.ids[name],L=SPN(),x=L&&L.find(y=>y.id===id);if(x)x.book=true;syncSponsors(B);const pg=B.pages.find(p=>p.spon===id);if(pg)s.sel=pg.id}
          slot.innerHTML="";changed(true);drawPage();msg(`Added ${name} to the book and the Sponsors tab.`+(f?"":" Add their ad picture on the page when you have it."))});
        slot.querySelector("[data-sn]").focus();
      });
      $("[data-next]").addEventListener("click",()=>{
        const y=B.year;
        if(!confirm(`Start the ${y+1} book from this one?\n\n• ${y} becomes ${y+1} (and ${y+1} becomes ${y+2}) wherever it's written\n• the calendars are redrawn for ${y+1}\n• the officers stay in place for you to update; the ${y} officers are kept for reference\n• every page is marked "to check" again\n\nDownload the ${y} PDF first if you want a copy of it as it stands.`))return;
        nextYear(B);changed(true);drawPage();msg(`This is now the ${B.year} book. Go through the pages and tick "Checked for ${B.year}" as each one is brought up to date.`)});
    }
    $("[data-out]").addEventListener("click",async()=>{const b=$("[data-out]");b.disabled=true;msg("Drawing the book…");
      try{const doc=await draw(B);doc.save(`${(t.name||"Blue Book").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"-")||"Blue-Book"}-${B.year}.pdf`);msg("")}
      catch(e){msg("Couldn't make the PDF: "+(e.message||e),true)}finally{b.disabled=false}});

    function drawList(){
      const L=$(".bb-list"),nos=pageNos(B);
      if(!B.pages.length){L.innerHTML="";$(".bb-page").innerHTML=`<div class="bb-empty"><b>No pages yet.</b><span class="hint">${canEdit?"Choose Import from PDF and pick last year's Blue Book. Every page comes in, in order, ready to bring up to date.":"Officers are putting the book together."}</span></div>`;return}
      L.innerHTML=B.pages.map((p,i)=>`<li><button type="button" data-pg="${esc(p.id)}" aria-current="${p.id===s.sel}">
        <span class="bb-no">${nos[p.id]||(i?"·":"C")}</span><span class="bb-t">${esc(label(p))}</span><span class="bb-k">${esc(KN[p.k]||"Page")}</span>${p.ok===B.year?'<span class="bb-ok" aria-label="Checked">✓</span>':""}</button></li>`).join("");
      L.querySelectorAll("[data-pg]").forEach(b=>b.addEventListener("click",()=>{s.sel=b.dataset.pg;drawList();drawPage();
        if(window.innerWidth<900)$(".bb-page").scrollIntoView({behavior:"smooth",block:"start"})}));
    }
    const label=p=>p.k==="calendar"?`${MONTHS[+p.month||0]} ${B.year+(+p.plus||0)}`:p.k==="cover"?"Front cover":p.k==="picture"?(nameOf(p)||p.title||"Picture"):String(p.title||p.body||KN[p.k]||"Page").split("\n")[0].slice(0,60)||"Untitled";

    /* ---------- one page: its fields and how it prints ---------- */
    function drawPage(){
      const el=$(".bb-page"),i=B.pages.findIndex(x=>x.id===s.sel),p=B.pages[i];
      if(!p){if(B.pages.length){s.sel=B.pages[0].id;return drawPage()}return}
      const F=(k,n,area,ph)=>`<div class="field"><label>${n}</label>${area?`<textarea data-f="${k}" rows="${area}"${ph?` placeholder="${esc(ph)}"`:""}>${esc(p[k]||"")}</textarea>`:`<input data-f="${k}" value="${esc(p[k]||"")}"${ph?` placeholder="${esc(ph)}"`:""}>`}</div>`;
      let form="";
      if(!canEdit)form="";
      else if(p.k==="cover")form=`<div class="bb-row"><div class="field"><label>Year</label><input data-b="year" type="number" value="${B.year}"></div><div class="field"><label>Edition</label><input data-b="edition" type="number" value="${esc(B.edition||"")}"></div></div>
        ${F("lines","Lines under the year",6)}${pic(p,"Picture on the cover (optional)")}`;
      else if(p.k==="body"){
        const X=DX(),rs=!p.dist&&X&&X.rosters?matchRoster(p):null,old=lastYear(p);
        if(p.dist&&X)p.officers=clone(officersOf(p,B));
        form=`${F("title","Name (one line per printed line)",2)}
        <div class="bb-row">${F("loc","Location",3)}${F("meets","Stated communications",2,"e.g. 1st Tuesday, 7:00 PM")}</div>
        <div class="bb-row">${F("mail","Correspondence to",3)}<div>${F("dinner","Dinner")}${F("meetsNote","More about meetings",2)}</div></div>
        <div class="bb-row">${F("email","Email")}${F("label","On the calendar as",0,"e.g. 40")}</div>
        <p class="hint bb-rule">${ruleHint(p)}</p>
        ${p.dist&&X?(()=>{const n=X.getRoster(p.dist,B.year).length;return `<p class="bb-note${n?" ok":""}">${n?`✓ The District tab has ${n} officers for ${B.year} for ${esc(X.bodyName(p.dist))}.`:`The District tab has no ${B.year} officers for ${esc(X.bodyName(p.dist))} yet. Enter them there, or below.`}</p>`})():""}
        ${X&&X.bodies().length?`<div class="field"><label>On the District tab</label><select data-dist><option value="">Not linked</option>${X.bodies().map(b=>`<option value="${esc(b.id)}"${p.dist===b.id?" selected":""}>${esc(b.name)}</option>`).join("")}</select>
          <p class="hint" style="margin:4px 0 0">${p.dist?`Linked: the officers below are the same list as on the District tab for ${B.year}. Enter next year's officers there (or here, once the next year's book is started) and they print in that year's book.`:"Link this page to its lodge or body to share the officers with the District tab."}</p></div>`:""}
        <div class="field"><label>Officers for ${B.year}</label><div class="bb-offs">${(p.officers||[]).map((x,j)=>`<div class="bb-off" data-o="${j}">
          <input data-of="t" value="${esc(x.t)}" placeholder="Office" aria-label="Office"><input data-of="n" value="${esc(x.n)}" placeholder="Name" aria-label="Name"><input data-of="p" value="${esc(x.p)}" placeholder="Phone" aria-label="Phone" inputmode="tel">
          <span class="ct-rowbtns"><button type="button" class="btn line sm" data-ou="${j}"${j?"":" disabled"} aria-label="Move up">↑</button><button type="button" class="btn line sm" data-ox="${j}" aria-label="Remove officer">✕</button></span></div>`).join("")}</div>
          <span class="ct-adds"><button type="button" class="btn line sm" data-oadd>Add an officer</button>${rs?`<button type="button" class="btn line sm" data-ofill>Fill in from the District tab (${esc(rs.name)}, ${B.year})</button>`:""}</span></div>
        ${old?`<details class="bb-old"><summary class="hint">Officers in ${old.year}</summary><ol>${old.officers.map(x=>`<li>${esc([x.t,x.n,x.p].filter(Boolean).join(" · "))}</li>`).join("")}</ol></details>`:""}
        ${F("notes","Note at the bottom of the page",2)}${pic(p,"Emblem (top right, optional)")}`;
      }
      else if(p.k==="calendar")form=`<div class="bb-row"><div class="field"><label>Month</label><select data-f="month">${MONTHS.map((m,j)=>`<option value="${j}"${+p.month===j?" selected":""}>${m}</option>`).join("")}</select></div>
        <div class="field"><label>Year</label><select data-f="plus"><option value="0"${+p.plus?"":" selected"}>${B.year} (this book's year)</option><option value="1"${+p.plus===1?" selected":""}>${B.year+1} (the January after)</option></select></div></div>
        <p class="hint">Every lodge and body page with a meeting day and an "On the calendar as" name shows up here by itself. Add anything else below: it counts for every calendar page.</p>
        ${listEd("repeat","Other meetings that repeat",[["label","On the calendar as","e.g. Beachcombers"],["rule","When","e.g. 3rd Wednesday"]])}
        ${listEd("dates","One-off dates",[["date","Date","","date"],["label","On the calendar as","e.g. Grand Lodge"]])}`;
      else if(p.k==="sponsors")form=`${F("title","Heading")}${F("body","Thank-you line",3)}
        <div class="field"><label>Rows in the table (at least)</label><input data-f="rows" type="number" min="0" max="40" value="${esc(p.rows||0)}"></div>
        <p class="hint">The list fills itself from the picture pages that name a sponsor, with the page each ad is on.</p>
        <div class="field"><label>Page numbers start on</label><select data-b="firstNo">${B.pages.slice(0,8).map((x,j)=>`<option value="${j+1}"${(+B.firstNo||2)===j+1?" selected":""}>${j===0?"the cover":"book page "+(j+1)+" ("+esc(label(x))+")"}</option>`).join("")}</select></div>`;
      else if(p.k==="picture"&&sponsorOf(p)){const x=sponsorOf(p);
        form=`<p class="bb-note">This is <b>${esc(x.name)}</b>'s ad. It's kept on the <a href="#sponsors">Sponsors tab</a> with the rest of their details: a new ad picked here or there replaces it in both places. Untick "In the book" there to take it out.</p>
        <div class="field"><label>Their ad</label>${x.ad?`<img class="bb-pic" src="${esc(x.ad)}" alt="">`:'<p class="hint" style="margin:0">No ad picture yet.</p>'}<span class="ct-adds"><label class="btn line sm">${x.ad?"Replace the ad":"Add the ad"}<input type="file" accept="image/*" hidden data-spic></label></span></div>`}
      else if(p.k==="picture")form=`${F("sponsor","Sponsor (for the sponsor index; leave empty for artwork)")}${pic(p,"The page as a picture")}<p class="hint">For a new ad, use + Add a sponsor so it's kept on the Sponsors tab too. A tall picture fills the 4 × 9 in page.</p>`;
      else form=`${F("title","Heading")}${F("body","Text",14)}<label class="check"><input type="checkbox" data-c="center"${p.center?" checked":""}> Center the lines</label>`;
      el.innerHTML=`<div class="bb-pg">
        <div class="bb-pgh"><h3>${esc(label(p))}</h3><span class="hint">${esc(KN[p.k])}${p.from?` · page ${p.from} of ${esc(B.source||"the imported PDF")}`:""}</span></div>
        ${canEdit?`<div class="bb-pga">
          <label class="check bb-chk"><input type="checkbox" data-ok${p.ok===B.year?" checked":""}> Checked for ${B.year}</label><span class="bb-sp"></span>
          <select data-kind aria-label="Kind of page">${KINDS.map(([k,n])=>`<option value="${k}"${p.k===k?" selected":""}>${n}</option>`).join("")}</select>
          <button type="button" class="btn line sm" data-mv="-1"${i?"":" disabled"} aria-label="Move page up">↑</button><button type="button" class="btn line sm" data-mv="1"${i<B.pages.length-1?"":" disabled"} aria-label="Move page down">↓</button>
          <button type="button" class="btn line sm" data-dup>Copy</button><button type="button" class="btn line sm" data-del>Delete</button></div>`:""}
        <div class="bb-cols"><div class="bb-form">${form}</div><figure class="bb-prev"><canvas></canvas><figcaption class="hint">As printed, 4 × 9 in</figcaption></figure></div>
      </div>`;
      wire(el,p,i);preview();
    }
    const pic=(p,n)=>`<div class="field"><label>${n}</label>${p.src?`<img class="bb-pic" src="${esc(p.src)}" alt="">`:""}<span class="ct-adds"><label class="btn line sm">${p.src?"Replace":"Add a picture"}<input type="file" accept="image/*" hidden data-pic></label>${p.src?'<button type="button" class="link-btn" data-unpic>Remove</button>':""}</span></div>`;
    const listEd=(key,n,cols)=>`<div class="field"><label>${n}</label><div class="bb-lst" data-l="${key}">${B[key].map((x,j)=>`<div class="bb-off">${cols.map(([c,cn,ph,type])=>`<input data-lc="${c}" data-j="${j}" type="${type||"text"}" value="${esc(x[c]||"")}" placeholder="${esc(ph||cn)}" aria-label="${esc(cn)}">`).join("")}<span class="ct-rowbtns"><button type="button" class="btn line sm" data-lx="${j}" aria-label="Remove">✕</button></span></div>`).join("")}</div>
      <span class="ct-adds"><button type="button" class="btn line sm" data-la="${key}">Add one</button></span></div>`;
    function ruleHint(p){const r=parseRule(p.meets);
      if(!r)return p.meets?"The calendar can't read that meeting day. Write it like 1st Tuesday, 2nd & 4th Monday or Last Friday.":"";
      return `On the calendar: ${r.nth.map(n=>n<0?"last":ordinal(n)).join(" & ")} ${DAYS[r.dow]}${r.months?` in ${r.months.map(m=>MONTHS[m].slice(0,3)).join(", ")}`:""}${p.label?` as “${esc(p.label)}”`:" (add an “On the calendar as” name)"}.`}
    function lastYear(p){const A=B.archive||{},y=Object.keys(A).map(Number).filter(x=>x<B.year).sort((a,b)=>b-a)[0];
      const q=y&&A[y].pages.find(x=>x.id===p.id);return q&&q.officers.length?{year:y,officers:q.officers}:null}
    function matchRoster(p){
      const R=window.LodgeNetDistrict.rosters(B.year)||[],num=(String(p.title).match(/\b(\d{1,3})\b/)||[])[1],w=String(p.title).toLowerCase().split(/\W+/).filter(x=>x.length>3&&!/lodge|chapter|council|order|masons|royal/.test(x));
      return R.find(r=>{const n=(r.name.match(/\b(\d{1,3})\b/)||[])[1],rl=r.name.toLowerCase();return (num&&n===num||!num)&&w.some(x=>rl.includes(x))})||null}
    function wire(el,p,i){
      if(!canEdit)return;
      const re=()=>{drawList();drawPage()};
      el.querySelectorAll("[data-f]").forEach(x=>x.addEventListener("input",()=>{const k=x.dataset.f;p[k]=x.tagName==="SELECT"||x.type==="number"?+x.value:x.value;
        if(k==="meets"||k==="label"){const h=el.querySelector(".bb-rule");if(h)h.innerHTML=ruleHint(p)}
        changed(["title","sponsor","month","plus","body"].includes(k))}));
      el.querySelectorAll("[data-b]").forEach(x=>x.addEventListener("input",()=>{B[x.dataset.b]=+x.value||0;changed(true)}));
      el.querySelectorAll("[data-c]").forEach(x=>x.addEventListener("change",()=>{p[x.dataset.c]=x.checked;changed()}));
      const ok=el.querySelector("[data-ok]");if(ok)ok.addEventListener("change",()=>{if(ok.checked)p.ok=B.year;else delete p.ok;changed(true)});
      el.querySelector("[data-kind]").addEventListener("change",e=>{const k=e.target.value;
        if(p.k==="picture"&&p.src&&k!=="cover"&&k!=="body"&&!confirm("This page's picture is removed when it becomes a "+KN[k].toLowerCase()+". Go ahead?")){e.target.value=p.k;return}
        if(k!=="picture"&&k!=="cover"&&k!=="body")delete p.src;
        p.k=k;if(k==="body"&&!p.officers)p.officers=[];if(k==="calendar"&&p.month==null){p.month=0;p.plus=0}changed(true);drawPage()});
      el.querySelectorAll("[data-mv]").forEach(b=>b.addEventListener("click",()=>{const j=i+ +b.dataset.mv;if(j<0||j>=B.pages.length)return;[B.pages[i],B.pages[j]]=[B.pages[j],B.pages[i]];changed();re()}));
      el.querySelector("[data-dup]").addEventListener("click",()=>{const c=clone(p);c.id="pg-"+uid();delete c.from;delete c.ok;B.pages.splice(i+1,0,c);s.sel=c.id;changed();re()});
      el.querySelector("[data-del]").addEventListener("click",()=>{if(!confirm(`Delete “${label(p)}” from the book? This can't be undone.`))return;B.pages.splice(i,1);s.sel=(B.pages[i]||B.pages[i-1]||{}).id;changed();re()});
      const pf=el.querySelector("[data-pic]");if(pf)pf.addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
        try{p.src=await shrink(f,p.k==="picture"?1400:700);changed();drawPage()}catch(err){msg("Couldn't add that picture: "+(err.message||err),true)}});
      const sp=el.querySelector("[data-spic]");if(sp)sp.addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";const x=sponsorOf(p);if(!f||!x)return;
        try{x.ad=await shrink(f,1400);save();drawPage()}catch(err){msg("Couldn't add that picture: "+(err.message||err),true)}});
      const up=el.querySelector("[data-unpic]");if(up)up.addEventListener("click",()=>{delete p.src;changed();drawPage()});
      /* officers */
      const offChanged=()=>{const X=DX();if(p.dist&&X){quiet=true;X.putRoster(p.dist,B.year,p.officers)}changed()};
      const dl=el.querySelector("[data-dist]");if(dl)dl.addEventListener("change",()=>{p.dist=dl.value||undefined;const X=DX();
        if(p.dist&&X&&!X.getRoster(p.dist,B.year).length&&(p.officers||[]).some(o=>o.n))X.putRoster(p.dist,B.year,p.officers);
        changed();drawPage()});
      el.querySelectorAll(".bb-off[data-o]").forEach(row=>{const x=p.officers[+row.dataset.o];
        row.querySelectorAll("[data-of]").forEach(inp=>inp.addEventListener("input",()=>{x[inp.dataset.of]=inp.value;offChanged()}))});
      el.querySelectorAll("[data-ou]").forEach(b=>b.addEventListener("click",()=>{const j=+b.dataset.ou;[p.officers[j-1],p.officers[j]]=[p.officers[j],p.officers[j-1]];offChanged();drawPage()}));
      el.querySelectorAll("[data-ox]").forEach(b=>b.addEventListener("click",()=>{p.officers.splice(+b.dataset.ox,1);offChanged();drawPage()}));
      const oa=el.querySelector("[data-oadd]");if(oa)oa.addEventListener("click",()=>{p.officers.push({t:"",n:"",p:""});offChanged();drawPage();const r=el.querySelectorAll(".bb-off[data-o] [data-of=t]");r[r.length-1].focus()});
      const of=el.querySelector("[data-ofill]");if(of)of.addEventListener("click",()=>{const r=matchRoster(p);if(!r)return;
        if(p.officers.some(o=>o.n)&&!confirm(`Replace the officers on this page with the ${r.officers.length} entered for ${r.name} on the District tab?`))return;
        p.officers=r.officers.map(o=>({t:o.t||"",n:o.n||"",p:o.p||""}));changed();drawPage();msg(`Filled in ${r.officers.length} officers from the District tab.`)});
      /* calendar lists */
      el.querySelectorAll("[data-lc]").forEach(inp=>inp.addEventListener("input",()=>{const L=B[inp.closest("[data-l]").dataset.l];L[+inp.dataset.j][inp.dataset.lc]=inp.value;changed()}));
      el.querySelectorAll("[data-lx]").forEach(b=>b.addEventListener("click",()=>{B[b.closest(".field").querySelector("[data-l]").dataset.l].splice(+b.dataset.lx,1);changed();drawPage()}));
      el.querySelectorAll("[data-la]").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.la;B[k].push(k==="dates"?{date:`${B.year+(+p.plus||0)}-${String((+p.month||0)+1).padStart(2,"0")}-01`,label:""}:{label:"",rule:""});changed();drawPage()}));
    }
    /* officers typed on the District tab show up here */
    let quiet=false;
    if(s.off)document.removeEventListener("lodgenet:district",s.off);
    s.off=()=>{if(quiet){quiet=false;return}if(!box.isConnected)return;head();const p=B.pages.find(x=>x.id===s.sel);
      const a=document.activeElement;if(p&&p.k==="body"&&!(a&&box.contains(a)&&a.matches("input,textarea,select")))drawPage();else preview()};
    document.addEventListener("lodgenet:district",s.off);
    if(s.offS)document.removeEventListener("lodgenet:sponsors",s.offS);
    s.offS=()=>{if(!box.isConnected)return;if(canEdit&&syncSponsors(B))save();drawList();head();
      const p=B.pages.find(x=>x.id===s.sel);if(!p){s.sel=B.pages[0]&&B.pages[0].id}drawPage()};
    document.addEventListener("lodgenet:sponsors",s.offS);
    let run=0,pt=0;
    function preview(){clearTimeout(pt);pt=setTimeout(async()=>{
      const c=box.querySelector(".bb-prev canvas"),id=s.sel,me=++run;if(!c||!id)return;
      try{const doc=await draw(B,[id]),lib=await pdfjs(),pdf=await lib.getDocument({data:doc.output("arraybuffer")}).promise;
        if(me!==run){pdf.destroy();return}
        const page=await pdf.getPage(1),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.min(300,(c.parentElement.clientWidth||300)),vp=page.getViewport({scale:w/PW*dpr});
        c.width=Math.round(vp.width);c.height=Math.round(vp.height);c.style.width=w+"px";
        await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;pdf.destroy();
      }catch(e){if(me===run){const f=box.querySelector(".bb-prev figcaption");if(f)f.textContent="Couldn't draw this page: "+(e.message||e)}}
    },250)}
    drawList();drawPage();
  }
  function shrink(file,max){return new Promise((ok,no)=>{const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);ok(c.toDataURL("image/jpeg",.82))};
    img.onerror=()=>{URL.revokeObjectURL(url);no(new Error("that file isn't a picture this browser can read"))};img.src=url})}

  const css=document.createElement("style");
  css.textContent=`
.bb{display:grid;gap:14px}
.bb-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.bb-sp{flex:1}.bb-bar label.btn{cursor:pointer}
.bb-ed{display:grid;gap:2px}.bb-ed b{font-family:var(--display);font-size:18px}
.bb-msg{margin:0}.bb-msg:empty{display:none}.bb-err{color:#b3261e}
.bb-box{display:grid;gap:10px;border:1px dashed var(--line);padding:14px;background:var(--surface)}.bb-kinds{display:flex;flex-wrap:wrap;gap:8px}
.bb-empty{display:grid;gap:4px;padding:28px 20px;border:1px dashed var(--line);text-align:center}
.bb-main{display:grid;grid-template-columns:minmax(200px,260px) minmax(0,1fr);gap:16px;align-items:start}
@media(max-width:900px){.bb-main{grid-template-columns:1fr}.bb-list{max-height:280px}}
.bb-note{margin:0;padding:8px 10px;border-left:3px solid #b08d2e;background:var(--surface);font-size:13.5px}.bb-note.ok{border-left-color:#2f6b4f}
.bb-side{display:grid;gap:8px;min-width:0}.bb-adds{display:flex;flex-wrap:wrap;gap:6px}.bb-adds .btn{flex:1;white-space:nowrap}
.bb-side .bb-box .field input{width:100%;font:inherit;padding:7px 9px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.bb-list{list-style:none;margin:0;padding:0;border:1px solid var(--line);max-height:78vh;overflow:auto;background:var(--bg)}
.bb-list button{display:grid;grid-template-columns:28px 1fr auto;grid-template-rows:auto auto;column-gap:8px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;color:var(--fg);font:inherit;padding:7px 10px;cursor:pointer}
.bb-list button[aria-current="true"]{background:var(--surface);box-shadow:inset 3px 0 0 var(--ct)}
.bb-no{grid-row:span 2;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:2px}
.bb-t{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bb-k{grid-column:2;font-size:11.5px;color:var(--muted)}
.bb-ok{grid-row:1/span 2;grid-column:3;align-self:center;color:#2f6b4f;font-weight:700}
.bb-pg{display:grid;gap:12px;min-width:0}.bb-pgh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.bb-pgh h3{margin:0;font-family:var(--display)}
.bb-pga{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bb-pga select{padding:6px 8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit;font-size:13px}
.bb-chk{font-weight:600}
.bb-cols{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start}
@media(max-width:1100px){.bb-cols{grid-template-columns:1fr}}
.bb-form{display:grid;gap:10px;min-width:0}
.bb-form input,.bb-form textarea,.bb-form select{width:100%;font:inherit;padding:8px 10px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
.bb-form textarea{line-height:1.5;resize:vertical}
.bb-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.bb-row{grid-template-columns:1fr}}
.bb-rule{margin:0}.bb-rule:empty{display:none}
.bb-offs,.bb-lst{display:grid;gap:6px}
.bb-off{display:grid;grid-template-columns:minmax(80px,1fr) minmax(120px,1.6fr) minmax(110px,1fr) auto;gap:6px;align-items:center}
.bb-lst .bb-off{grid-template-columns:minmax(120px,1fr) minmax(120px,1fr) auto}
@media(max-width:560px){.bb-off{grid-template-columns:1fr 1fr}.bb-off input[data-of=n]{grid-column:span 2}}
.bb-old ol{margin:6px 0 0;padding-left:20px;font-size:13px;color:var(--muted)}
.bb-pic{display:block;max-width:160px;max-height:240px;border:1px solid var(--line);margin-bottom:6px}
.bb-prev{margin:0;display:grid;gap:6px;justify-items:center;position:sticky;top:12px}
.bb-prev canvas{width:300px;max-width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2),0 6px 18px rgba(0,0,0,.08)}`;
  document.head.appendChild(css);

  window.LodgeNetBlueBook={mount,_test:{parseRule,ruleDays,bumpYear,nextYear,monthItems,draw,syncDistrict,officersOf,syncSponsors,properSeats}};
})();
