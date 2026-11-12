/* Masonic organization types. The whole dashboard reads its words and structure from here: what the unit is called, its
   officer chairs, its regular meeting, its governing body, its degrees and honorifics, and its membership pipeline.
   demo.js calls LodgeOrg.use(CFG.org) as it starts, and every other script reads LodgeOrg.current.
   The type is saved with the lodge's data as `org` and chosen in Settings → Organization type.

   Chairs made with C() (a club's Directors and Editor) carry a fill-in title: demo.js keeps the typed kind in seatNames.
   Each type: degLabel (the name of the roll's column for the body's own degree), past (what the roll calls those who have presided), name, group (for the Settings picker), notes (the minutes tab's name, when it isn't the meetings' name), unit (Lodge, Valley, Chapter…), numbered (has a number like No. 368),
   meeting / meetings (the regular meeting's name), governing (the governing body's label) and gov(state) (its usual name and
   abbreviation, filled in from the state), member / members (Brother / Brethren, Companion / Companions…), titles (honorifics
   for the roll), degrees (degree choices on the roll; the first can hold office), seats (officer chairs) and seatRows (how
   Members lays them out), pipeline (stages; deg maps a stage to the degree it sets on the roll; join is the first stage that adds
   him to the roll; done is the finished stage), join (the website's joining page) and nonprofit (shows the Tax ID field). */
(function(){
  const STATES={AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"the District of Columbia",FL:"Florida",
    GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",
    MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
    ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",
    VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
  /* the Scottish Rite's Northern Masonic Jurisdiction; every other state is in the Southern Jurisdiction */
  const NMJ=["ME","NH","VT","MA","RI","CT","NY","NJ","PA","DE","OH","IN","IL","MI","WI"];
  const of=st=>STATES[st]||"your state";
  const S=(k,t,ab)=>({k,t,ab:ab||t});
  /* a chair whose kind the body names itself (Director of what, Editor of what), typed in beside it on Members */
  const C=(k,t,ph)=>({k,t,ab:t,base:t,custom:true,ph});
  const BLUE_SEATS=[S("WM","Worshipful Master","WM"),S("SW","Senior Warden","SW"),S("JW","Junior Warden","JW"),S("TREAS","Treasurer","Treas."),S("SEC","Secretary","Sec."),
    S("SD","Senior Deacon","SD"),S("JD","Junior Deacon","JD"),S("STW1","Senior Steward","Stwd"),S("STW2","Junior Steward","Stwd"),S("TILER","Tiler"),S("CHAP","Chaplain","Chap.")];
  const BLUE_PIPE={stages:["Inquiry","Petition received","Investigation","Ballot","Entered Apprentice","Fellowcraft","Raised","Not proceeding"],
    deg:{4:"Entered Apprentice",5:"Fellowcraft",6:"Master Mason"},join:4,done:6};
  const APPENDANT_JOIN=(body,what)=>({title:"Join the "+body,sub:"Further light in Masonry.",who:`Any Master Mason in good standing in a regular Blue Lodge may petition to join the ${body}. ${what}`});

  const TYPES={
    blue:{degLabel:"Lodge degree",past:"Past Masters",name:"Blue Lodge",group:"Craft Lodges",desc:"A Craft Lodge of Free and Accepted or Ancient Free and Accepted Masons.",
      unit:"Lodge",numbered:true,meeting:"Stated Communication",meetings:"Stated Communications",governing:"Grand Lodge",
      member:"Brother",members:"Brethren",titles:[["B.","Brother"],["WB.","Worshipful Brother"],["RWB.","Right Worshipful Brother"]],
      degrees:["Master Mason","Fellowcraft","Entered Apprentice"],seats:BLUE_SEATS,seatRows:[["WM","SW","JW"],["SEC","TREAS","SD","JD"],["STW1","STW2","TILER","CHAP"]],
      pipeline:BLUE_PIPE,join:{title:"Become a Mason",sub:"To be one, ask one.",who:"Freemasonry welcomes good men of every background who believe in a Supreme Being and want to make themselves and their communities better.\n\nA man must be of lawful age, of good character and recommended by members of the lodge."}},
    pha:{degLabel:"Lodge degree",past:"Past Masters",name:"Prince Hall Lodge",group:"Craft Lodges",desc:"A Lodge under a Most Worshipful Prince Hall Grand Lodge.",
      unit:"Lodge",numbered:true,meeting:"Stated Communication",meetings:"Stated Communications",governing:"Grand Lodge",pha:true,
      member:"Brother",members:"Brethren",titles:[["B.","Brother"],["WB.","Worshipful Brother"],["RWB.","Right Worshipful Brother"],["MWB.","Most Worshipful Brother"]],
      degrees:["Master Mason","Fellowcraft","Entered Apprentice"],seats:BLUE_SEATS,seatRows:[["WM","SW","JW"],["SEC","TREAS","SD","JD"],["STW1","STW2","TILER","CHAP"]],
      pipeline:BLUE_PIPE,join:{title:"Become a Prince Hall Mason",sub:"To be one, ask one.",who:"Prince Hall Freemasonry welcomes good men who believe in a Supreme Being and want to serve their families and communities.\n\nA man must be of lawful age, of good character and recommended by members of the lodge."}},
    sr:{degLabel:"Rite degree",past:"Past Venerable Masters",name:"Scottish Rite Valley",group:"Scottish Rite",desc:"A Valley with its Lodge of Perfection, Chapter of Rose Croix, Council of Kadosh and Consistory.",
      unit:"Valley",numbered:false,meeting:"Stated Meeting",meetings:"Stated Meetings",governing:"Orient and Supreme Council",
      gov:st=>{const n=NMJ.includes(st);return {gl:n?"Supreme Council, 33°, Ancient Accepted Scottish Rite, Northern Masonic Jurisdiction":`Orient of ${of(st)}, Supreme Council, 33°, Southern Jurisdiction`,jur:n?"A.A.S.R. (NMJ)":"A.&A.S.R. (SJ)"}},
      member:"Brother",members:"Brethren",titles:[["B.","Brother"],["Ill.","Illustrious Brother"],["Ill. 33°","Illustrious Brother, 33°"]],
      degrees:["32°","33°","Candidate"],
      seats:[S("PR","Personal Representative","PR"),S("SEC","Secretary","Sec."),S("TREAS","Treasurer","Treas."),S("ALM","Almoner","Alm."),
        S("VM","Venerable Master, Lodge of Perfection","VM"),S("WISE","Wise Master, Chapter of Rose Croix","WM"),S("CMDR","Commander, Council of Kadosh","Cmdr."),S("MK","Master of Kadosh, Consistory","MK"),
        S("RD","Director of Work","Dir."),S("CHAP","Chaplain","Chap.")],
      seatRows:[["PR","SEC","TREAS","ALM"],["VM","WISE","CMDR","MK"],["RD","CHAP"]],
      pipeline:{stages:["Inquiry","Petition received","Petition approved","Reunion scheduled","Degrees conferred (4°–32°)","Member","Not proceeding"],deg:{3:"Candidate",4:"32°",5:"32°"},join:3,done:5},
      join:APPENDANT_JOIN("Scottish Rite","Degrees are conferred at our Reunions, and every new member is welcomed into all four bodies of the Valley.")},
    chapter:{degLabel:"Chapter degree",past:"Past High Priests",name:"Royal Arch Chapter",group:"York Rite",desc:"A Chapter of Royal Arch Masons.",
      unit:"Chapter",numbered:true,meeting:"Stated Convocation",meetings:"Stated Convocations",governing:"Grand Chapter",
      gov:st=>({gl:`Grand Chapter of Royal Arch Masons of ${of(st)}`,jur:"R.A.M."}),
      member:"Companion",members:"Companions",titles:[["Comp.","Companion"],["Ex. Comp.","Excellent Companion"],["MEC.","Most Excellent Companion"]],
      degrees:["Royal Arch Mason","Most Excellent Master","Past Master (Virtual)","Mark Master","Candidate"],
      seats:[S("HP","Excellent High Priest","EHP"),S("KING","King"),S("SCRIBE","Scribe"),S("SEC","Secretary","Sec."),S("TREAS","Treasurer","Treas."),S("CH","Captain of the Host","CH"),
        S("PS","Principal Sojourner","PS"),S("RAC","Royal Arch Captain","RAC"),S("V3","Master of the Third Veil","M3V"),S("V2","Master of the Second Veil","M2V"),S("V1","Master of the First Veil","M1V"),S("SENT","Sentinel","Sent.")],
      seatRows:[["HP","KING","SCRIBE"],["SEC","TREAS","CH","PS"],["RAC","V3","V2","V1","SENT"]],
      pipeline:{stages:["Inquiry","Petition received","Ballot","Mark Master","Past Master (Virtual)","Most Excellent Master","Royal Arch Mason","Not proceeding"],deg:{3:"Mark Master",4:"Past Master (Virtual)",5:"Most Excellent Master",6:"Royal Arch Mason"},join:3,done:6},
      join:APPENDANT_JOIN("Royal Arch","The Chapter confers the Mark Master, Past Master, Most Excellent Master and Royal Arch degrees.")},
    council:{degLabel:"Council degree",past:"Past Illustrious Masters",name:"Cryptic Council",group:"York Rite",desc:"A Council of Royal and Select Masters.",
      unit:"Council",numbered:true,meeting:"Stated Assembly",meetings:"Stated Assemblies",governing:"Grand Council",
      gov:st=>({gl:`Grand Council of Royal and Select Masters of ${of(st)}`,jur:"R.&S.M."}),
      member:"Companion",members:"Companions",titles:[["Comp.","Companion"],["Ill. Comp.","Illustrious Companion"],["MIC.","Most Illustrious Companion"]],
      degrees:["Super Excellent Master","Select Master","Royal Master","Candidate"],
      seats:[S("IM","Illustrious Master","IM"),S("DM","Deputy Master","DM"),S("PCW","Principal Conductor of the Work","PCW"),S("REC","Recorder","Rec."),S("TREAS","Treasurer","Treas."),
        S("CG","Captain of the Guard","CG"),S("CC","Conductor of the Council","CC"),S("STW","Steward","Stwd"),S("SENT","Sentinel","Sent.")],
      seatRows:[["IM","DM","PCW"],["REC","TREAS","CG"],["CC","STW","SENT"]],
      pipeline:{stages:["Inquiry","Petition received","Ballot","Royal Master","Select Master","Super Excellent Master","Not proceeding"],deg:{3:"Royal Master",4:"Select Master",5:"Super Excellent Master"},join:3,done:5},
      join:APPENDANT_JOIN("Cryptic Rite","Royal Arch Masons are welcome to receive the Royal Master, Select Master and Super Excellent Master degrees.")},
    commandery:{degLabel:"Orders",past:"Past Commanders",name:"Commandery of Knights Templar",group:"York Rite",desc:"A Commandery of Knights Templar.",
      unit:"Commandery",numbered:true,meeting:"Stated Conclave",meetings:"Stated Conclaves",governing:"Grand Commandery",
      gov:st=>({gl:`Grand Commandery of Knights Templar of ${of(st)}`,jur:"K.T."}),
      member:"Sir Knight",members:"Sir Knights",titles:[["Sir Kt.","Sir Knight"],["Em. Sir Kt.","Eminent Sir Knight"],["R. Em. Sir Kt.","Right Eminent Sir Knight"]],
      degrees:["Knight Templar","Knight of Malta","Red Cross","Candidate"],
      seats:[S("EC","Eminent Commander","EC"),S("GEN","Generalissimo","Gen."),S("CG","Captain General","CG"),S("PREL","Prelate","Prel."),S("REC","Recorder","Rec."),S("TREAS","Treasurer","Treas."),
        S("SW","Senior Warden","SW"),S("JW","Junior Warden","JW"),S("STB","Standard Bearer","StB"),S("SWB","Sword Bearer","SwB"),S("WARD","Warder","Ward."),S("SENT","Sentinel","Sent.")],
      seatRows:[["EC","GEN","CG"],["PREL","REC","TREAS","SW","JW"],["STB","SWB","WARD","SENT"]],
      pipeline:{stages:["Inquiry","Petition received","Ballot","Order of the Red Cross","Order of Malta","Order of the Temple","Not proceeding"],deg:{3:"Red Cross",4:"Knight of Malta",5:"Knight Templar"},join:3,done:5},
      join:APPENDANT_JOIN("Knights Templar","Royal Arch Masons who profess a belief in the Christian religion may petition the Commandery.")},
    yorkrite:{degLabel:"York Rite degree",past:"Past presiding officers",name:"York Rite bodies",group:"York Rite",desc:"Chapter, Council and Commandery working together.",
      unit:"York Rite Bodies",numbered:false,meeting:"Stated Meeting",meetings:"Stated Meetings",governing:"Grand York Rite bodies",
      gov:st=>({gl:`Grand York Rite Bodies of ${of(st)}`,jur:"York Rite"}),
      member:"Companion",members:"Companions",titles:[["Comp.","Companion"],["Sir Kt.","Sir Knight"],["Ex. Comp.","Excellent Companion"],["Em. Sir Kt.","Eminent Sir Knight"]],
      degrees:["Knight Templar","Select Master","Royal Arch Mason","Candidate"],
      seats:[S("HP","Excellent High Priest, Chapter","EHP"),S("IM","Illustrious Master, Council","IM"),S("EC","Eminent Commander, Commandery","EC"),S("SEC","Secretary / Recorder","Sec."),
        S("TREAS","Treasurer","Treas."),S("KING","King, Chapter"),S("DM","Deputy Master, Council","DM"),S("GEN","Generalissimo, Commandery","Gen."),S("PREL","Prelate","Prel."),S("SENT","Sentinel","Sent.")],
      seatRows:[["HP","IM","EC"],["SEC","TREAS","KING","DM","GEN"],["PREL","SENT"]],
      pipeline:{stages:["Inquiry","Petition received","Ballot","Royal Arch Mason","Select Master","Knight Templar","Not proceeding"],deg:{3:"Royal Arch Mason",4:"Select Master",5:"Knight Templar"},join:3,done:5},
      join:APPENDANT_JOIN("York Rite","The York Rite confers the Chapter, Council and Commandery degrees, each building on the Blue Lodge.")},
    club:{degLabel:"Standing",past:"Past Presidents",name:"Scottish Rite Club",group:"Scottish Rite",desc:"A nonprofit Scottish Rite Club supporting its Valley and community.",nonprofit:true,
      unit:"Club",numbered:false,meeting:"Club Meeting",meetings:"Club Meetings",notes:"Meeting notes",governing:"Sponsoring Valley",
      gov:st=>({gl:"",jur:""}),
      member:"Member",members:"Members",titles:[["B.","Brother"],["Ill.","Illustrious Brother"],["Mr.","Mr."],["Mrs.","Mrs."],["Ms.","Ms."]],
      degrees:["Member","Associate member","Prospective member"],
      seats:[S("PRES","President","Pres."),S("VP","Vice President","VP"),S("SEC","Secretary","Sec."),S("TREAS","Treasurer","Treas."),C("DIR1","Director","e.g. Membership"),C("DIR2","Director","e.g. Programs"),C("DIR3","Director","e.g. Ritual"),C("EDIT","Editor","e.g. Newsletter"),S("CHAP","Chaplain","Chap.")],
      seatRows:[["PRES","VP"],["SEC","TREAS"],["DIR1","DIR2","DIR3"],["EDIT","CHAP"]],
      pipeline:{stages:["Inquiry","Application received","Approved","Member","Not proceeding"],deg:{3:"Member"},join:3,done:3},
      join:{title:"Join the club",sub:"Fellowship, service and the Scottish Rite.",who:"Our club welcomes Scottish Rite Masons and friends who want to support the Valley, its charities and our community. Come to a meeting and get to know us."}}
  };
  const GROUPS=["Craft Lodges","Scottish Rite","York Rite"];
  /* every member's Masonic degree, whatever the body: their highest degree in Freemasonry, chosen on the roll */
  const MASONIC=[
    ["Blue Lodge",["Entered Apprentice","Fellowcraft","Master Mason"]],
    ["Scottish Rite",["14° Perfect Elu","18° Knight Rose Croix","30° Knight Kadosh","32° Master of the Royal Secret","32° KCCH","33° Inspector General Honorary"]],
    ["York Rite",["Mark Master","Past Master (Virtual)","Most Excellent Master","Royal Arch Mason","Royal Master","Select Master","Super Excellent Master","Order of the Red Cross","Order of Malta","Knight Templar"]],
    ["Other",["Candidate","Not a Mason","Not recorded"]]];
  const MASONIC_ALL=MASONIC.flatMap(g=>g[1]);
  /* what a body's own degree means on the Masonic ladder ("" when it says nothing, like a club's "Member") */
  const FROM={"32°":"32° Master of the Royal Secret","33°":"33° Inspector General Honorary","Red Cross":"Order of the Red Cross","Knight of Malta":"Order of Malta"};
  const masonicOf=deg=>FROM[deg]||(MASONIC_ALL.includes(deg)&&deg!=="Not recorded"?deg:"");
  const groupOf=d=>(MASONIC.find(g=>g[1].includes(d))||[""])[0];
  /* a member's Masonic degree only ever rises on its own: a Blue Lodge degree rises within the Blue Lodge, and any Scottish or
     York Rite degree (which every Master Mason may go on to) outranks the Blue Lodge degrees; between the two Rites it's left alone */
  /* a Master Mason or beyond: every Scottish and York Rite degree is taken by Master Masons */
  const isMM=m=>{const d=m.mdeg||masonicOf(m.deg);return !!d&&d!=="Entered Apprentice"&&d!=="Fellowcraft"&&groupOf(d)!=="Other"&&groupOf(d)!==""};
  function raise(m){
    const to=masonicOf(m.deg);if(!to)return m;
    const cur=m.mdeg||"",cg=groupOf(cur),tg=groupOf(to);
    if(!cur||cg==="Other"||(cg==="Blue Lodge"&&(tg!=="Blue Lodge"||MASONIC[0][1].indexOf(to)>MASONIC[0][1].indexOf(cur)))||(cg===tg&&MASONIC_ALL.indexOf(to)>MASONIC_ALL.indexOf(cur)))m.mdeg=to;
    return m;
  }
  /* every type's meeting names, so the calendar can recognise its regular meetings after the type changes */
  const MEETINGS=[...new Set(Object.values(TYPES).map(t=>t.meeting))];
  let current=null;
  function use(key){
    const k=TYPES[key]?key:"blue",t=TYPES[k];
    current=Object.assign({key:k},t,{
      office:t.degrees[0],                                   /* the degree that can hold office */
      notes:t.notes||t.meetings,                             /* the name of the minutes tab and its write-ups */
      seatLabel:Object.fromEntries(t.seats.map(s=>[s.k,s.t.replace(/,.*$/,"")])),
      unitLower:t.unit.toLowerCase(),
      /* "Murrells Inlet Lodge No. 368" / "Valley of Charleston" */
      full:(name,num)=>String(name||"Your "+t.unit).trim()+(t.numbered&&num?" No. "+num:"")
    });
    window.LodgeOrg.current=current;
    document.documentElement.dataset.org=k;
    return current;
  }
  window.LodgeOrg={TYPES,GROUPS,MEETINGS,NMJ,STATES,MASONIC,MASONIC_ALL,masonicOf,raise,isMM,use,current:null};
  use((window.LODGE||{}).org);
})();
