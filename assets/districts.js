/* Masonic district directories for the District tab (assets/district.js).
   One entry per district: the towns it covers (to match a lodge to its district by city and state),
   the halls (one map pin each, since several bodies share a building) and every body that meets in the district.
   Gathered from the district's own site (afm29th.org), the SC Grand York Rite (scgyr.org) and masonpost.com, November 2026.
   Officers change every year, so contacts name the office, not just the man. */
window.LodgeNetDistricts={
  "SC-29":{
    name:"29th Masonic District",
    grand:"Grand Lodge of Ancient Free Masons of South Carolina",
    state:"SC",
    area:"Horry and Georgetown Counties",
    site:"https://www.afm29th.org",
    ddgm:"RW Billy R. Hudson, PM of Murrells Inlet No. 368",
    towns:["Myrtle Beach","North Myrtle Beach","Murrells Inlet","Surfside Beach","Garden City","Socastee","Carolina Forest","Conway","Aynor","Loris","Longs","Little River","Jordanville","Georgetown","Pawleys Island","Litchfield","Andrews","Green Sea","Galivants Ferry"],
    center:[33.70,-79.02],
    halls:{
      winyah:{name:"Winyah Lodge No. 40 hall",addr:"2617 S Fraser St, Georgetown, SC 29440",ll:[33.33837,-79.30459]},
      conway:{name:"Conway Masonic Lodge (Conway 65 and Horry 381)",addr:"903 15th Ave, Conway, SC 29526",ll:[33.84860,-79.05380]},
      loris:{name:"Loris Lodge No. 205 hall",addr:"3517 Casey St, Loris, SC 29569",ll:[34.05720,-78.89614]},
      graddy:{name:"Graddy Lodge No. 257 hall",addr:"842 S Main St, Aynor, SC 29511",ll:[33.99808,-79.20113]},
      jordanville:{name:"Jordanville Lodge No. 297 hall",addr:"9400 block of Pee Dee Hwy, Conway, SC 29527",ll:[33.8986,-79.2371],approx:true},
      mb:{name:"Myrtle Beach Masonic Center (Myrtle Beach 353 and Seaside 419)",addr:"905 US-501, Myrtle Beach, SC 29577",ll:[33.69411,-78.88824]},
      mi:{name:"Murrells Inlet Lodge No. 368 hall",addr:"620 Collins Ave, Murrells Inlet, SC 29576",ll:[33.55237,-79.04218],approx:true},
      gs:{name:"Grand Strand Lodge No. 392 hall",addr:"919 6th Ave S, North Myrtle Beach, SC 29582",ll:[33.82555,-78.68542]},
      pi:{name:"Pawleys Island Lodge No. 409 hall",addr:"75 Haunted Trail Rd, Pawleys Island, SC 29585",ll:[33.44083,-79.12381]},
      soc:{name:"Socastee Lodge No. 421 hall",addr:"7650 Butler Rd, Myrtle Beach, SC 29588",ll:[33.67262,-79.03412]},
      waccshrine:{name:"Waccamaw Shrine Club",addr:"10 Elm St, Conway, SC 29526",ll:[33.83014,-79.04543]},
      mbshrine:{name:"Myrtle Beach Shrine Club",addr:"9589 N Kings Hwy, Myrtle Beach, SC 29572",ll:[33.77401,-78.79854]},
      gwshrine:{name:"G & W Shrine Club",addr:"36 Omar Way, Georgetown, SC 29440",ll:[33.47778,-79.27917]}
    },
    bodies:[
      /* ---- Blue lodges ---- */
      {k:"blue",name:"Winyah Lodge No. 40",hall:"winyah",meets:"1st Tuesday, 7:00 PM",meal:"6:15 PM",since:1818,
        contact:"Secretary Dennis L. Baker",phone:"(843) 833-4579",email:"dlbakerafm@aol.com",mail:"PO Box 704, Georgetown, SC 29442"},
      {k:"blue",name:"Conway Lodge No. 65",hall:"conway",meets:"2nd Monday, 7:30 PM",meal:"6:30 PM",since:1888,
        contact:"Worshipful Master Chris Zurcher",phone:"(843) 254-0356",web:"https://www.conwaylodge65.com/",mail:"1010 Mimisa Ct, Conway, SC 29527"},
      {k:"blue",name:"Loris Lodge No. 205",hall:"loris",meets:"1st Monday, 7:30 PM",meal:"6:45 PM",since:1879,
        contact:"Secretary Haywood Fowler",phone:"(910) 840-5784",email:"horacehfowler@gmail.com"},
      {k:"blue",name:"Graddy Lodge No. 257",hall:"graddy",meets:"1st Monday, 7:30 PM",meal:"6:45 PM",since:1904,
        contact:"Secretary Joseph Vaught",phone:"(843) 855-8417",mail:"PO Box 494, Aynor, SC 29511"},
      {k:"blue",name:"Jordanville Lodge No. 297",hall:"jordanville",meets:"1st Tuesday, 7:30 PM",meal:"6:30 PM",since:1912,
        contact:"Secretary William Caddell",phone:"(843) 616-1421"},
      {k:"blue",name:"Myrtle Beach Lodge No. 353",hall:"mb",meets:"2nd Tuesday, 7:30 PM",meal:"6:45 PM",since:1937,
        contact:"Secretary Don Cox",phone:"(843) 222-0072",web:"https://www.myrtlebeach353.org/",mail:"PO Box 353, Myrtle Beach, SC 29578"},
      {k:"blue",name:"Murrells Inlet Lodge No. 368",hall:"mi",meets:"2nd Tuesday, 7:30 PM",meal:"6:45 PM",since:1948,
        contact:"Secretary Michael Sheads",phone:"(843) 424-1705",web:"https://www.murrellsinletmasoniclodge.com/",mail:"PO Box 2131, Murrells Inlet, SC 29576",note:"May be dark in summer; check before visiting."},
      {k:"blue",name:"Horry Lodge No. 381",hall:"conway",meets:"1st Tuesday, 7:30 PM",meal:"6:45 PM",since:1952,
        contact:"Secretary Jason Jordan",phone:"(843) 516-9684",mail:"PO Box 648, Conway, SC 29528"},
      {k:"blue",name:"Grand Strand Lodge No. 392",hall:"gs",meets:"2nd Monday, 7:30 PM",meal:"6:45 PM",since:1956,
        contact:"Secretary Rex Thompson",phone:"(910) 443-1531",email:"gs392afm@gmail.com",mail:"PO Box 5671, North Myrtle Beach, SC 29597"},
      {k:"blue",name:"Pawleys Island Lodge No. 409",hall:"pi",meets:"1st Thursday, 7:30 PM",meal:"6:45 PM",since:1967,
        contact:"Secretary Carl Schiller",phone:"(843) 485-2656",email:"secretary@pi409.com",mail:"PO Box 1592, Pawleys Island, SC 29585"},
      {k:"blue",name:"Seaside Lodge No. 419",hall:"mb",meets:"1st Tuesday, 7:30 PM",meal:"6:45 PM",since:1978,
        contact:"Secretary John Richardson",phone:"(843) 694-2161",web:"https://www.discovermasons.com/"},
      {k:"blue",name:"Socastee Lodge No. 421",hall:"soc",meets:"3rd Tuesday, 7:30 PM",meal:"7:00 PM",since:1982,
        contact:"Secretary Paul Urban",phone:"(843) 455-0627",mail:"PO Box 30582, Myrtle Beach, SC 29588"},

      /* ---- York Rite ---- */
      {k:"york",name:"Horry Chapter No. 48, Royal Arch Masons",hall:"conway",meets:"4th Monday, 7:30 PM (1st Friday in December)",meal:"6:45 PM",
        contact:"Secretary Kenneth Brackens",phone:"(843) 446-0871",email:"kbrackens@yahoo.com",web:"https://scgyr.org/body/conway/",note:"The Conway York Rite bodies meet together; the Chapter opens in January, April, July and October."},
      {k:"york",name:"Kingston Council No. 36, Royal & Select Masters",hall:"conway",meets:"4th Monday, 7:30 PM (1st Friday in December)",meal:"6:45 PM",
        contact:"Recorder Kenneth Brackens",phone:"(843) 446-0871",email:"kbrackens@yahoo.com",web:"https://scgyr.org/body/conway/",note:"Opens in February, May, August and November."},
      {k:"york",name:"Conway Commandery No. 25, Knights Templar",hall:"conway",meets:"4th Monday, 7:30 PM (1st Friday in December)",meal:"6:45 PM",
        contact:"Recorder Kenneth Brackens",phone:"(843) 446-0871",email:"kbrackens@yahoo.com",web:"https://scgyr.org/body/conway/",note:"Opens in March, June, September and December."},
      {k:"york",name:"Winyah Chapter No. 45, Royal Arch Masons",hall:"winyah",meets:"4th Tuesday Jan to Oct, 3rd Tuesday Nov, 2nd Friday Dec; 7:30 PM",meal:"6:30 PM",
        contact:"Secretary James A. Lambert",web:"https://scgyr.org/body/georgetown/",note:"The Georgetown York Rite bodies meet together at Winyah Lodge No. 40."},
      {k:"york",name:"Winyah Council No. 24, Royal & Select Masters",hall:"winyah",meets:"4th Tuesday Jan to Oct, 3rd Tuesday Nov, 2nd Friday Dec; 7:30 PM",meal:"6:30 PM",
        contact:"Recorder James A. Lambert",web:"https://scgyr.org/body/georgetown/"},
      {k:"york",name:"Winyah Commandery No. 24, Knights Templar",hall:"winyah",meets:"4th Tuesday Jan to Oct, 3rd Tuesday Nov, 2nd Friday Dec; 7:30 PM",meal:"6:30 PM",
        contact:"Recorder James A. Lambert",web:"https://scgyr.org/body/georgetown/"},

      /* ---- Order of the Eastern Star ---- */
      {k:"oes",name:"Myrtle Beach Chapter No. 180, OES",hall:"mb",meets:"3rd Tuesday, 7:30 PM (4th Tuesday in June)",
        contact:"Secretary-Treasurer Joann Shattuck",phone:"(603) 496-5052"},
      {k:"oes",name:"Waccamaw Chapter No. 89, OES",hall:"conway",meets:"2nd Thursday, 7:30 PM",
        contact:"Shawn Beauregard",phone:"(843) 798-8083"},
      {k:"oes",name:"Loris Chapter No. 106, OES",hall:"loris",meets:"2nd Monday, 7:30 PM",
        contact:"Eldred Johnson",phone:"(843) 907-7980"},
      {k:"oes",name:"Winyah Chapter No. 148, OES",hall:"winyah",meets:"Call for meeting night",
        web:"https://scoes.org/",note:"Listed by the Grand Chapter of South Carolina; meeting night not published."},

      /* ---- Rainbow, DeMolay, Amaranth ---- */
      {k:"rainbow",name:"Rainbow for Girls, Myrtle Beach Assembly",hall:"mb",meets:"1st and 3rd Monday, 7:00 PM",
        contact:"Mother Advisor Katherine Kelly",phone:"(917) 741-1493",email:"kmkelly6@gmail.com",note:"For girls 11 to 20."},
      {k:"demolay",name:"Chuck Hargis Memorial Chapter, Order of DeMolay",hall:"conway",meets:"1st and 3rd Thursday, 7:30 PM",
        contact:"Chairman Skip Dow",phone:"(609) 638-1005",note:"Sponsored by Grand Strand Lodge No. 392. For young men 12 to 21."},
      {k:"amaranth",name:"Murrells Inlet Court No. 20, Order of the Amaranth",hall:"soc",meets:"2nd Monday, 7:30 PM (dark July and August)",
        contact:"John Johnson",phone:"(843) 450-5310"},

      /* ---- Shrine (Omar Shriners, Mt. Pleasant) ---- */
      {k:"shrine",name:"Myrtle Beach Shrine Club",hall:"mbshrine",meets:"3rd Monday, 7:00 PM (dark June to August)",meal:"6:30 PM meet and greet",
        contact:"Secretary Monroe Baldwin",phone:"(843) 222-3534",web:"https://omarshriners.org/clubs.html"},
      {k:"shrine",name:"Waccamaw Shrine Club",hall:"waccshrine",meets:"2nd Tuesday, 7:00 PM",meal:"6:00 PM",
        contact:"Secretary Ronald Lilly",phone:"(843) 458-6481",web:"https://omarshriners.org/clubs.html",note:"Ladies Auxiliary meets the same night."},
      {k:"shrine",name:"G & W Shrine Club",hall:"gwshrine",meets:"2nd Monday, 7:00 PM",meal:"6:00 PM meet and greet",
        contact:"Secretary John Gainey",phone:"(843) 833-1025",web:"https://omarshriners.org/clubs.html"},
      {k:"shrine",name:"Omar Beachcombers (Omar Shriners unit)",hall:"mbshrine",meets:"3rd Wednesday",
        web:"https://omarshriners.org/beachcombers.html",mail:"PO Box 66, Myrtle Beach, SC 29578"},

      /* ---- Scottish Rite ---- */
      {k:"scottish",name:"Waccamaw Scottish Rite Club",hall:"mb",meets:"Call for meeting night",
        contact:"Secretary Alan Kalisky",phone:"(843) 213-7502",email:"waccamawsrc@gmail.com",web:"https://www.afm29th.org/waccamaw-scottish-rite-club",
        note:"Supports the Childhood Language Disorder Centers. Degrees are conferred by the Valley's bodies."}
    ]
  }
};
/* which district a lodge is in: a saved choice first, then its city and state */
window.LodgeNetDistricts.find=function(city,state,saved){
  const D=window.LodgeNetDistricts;if(saved&&D[saved])return saved;
  const c=String(city||"").trim().toLowerCase(),s=String(state||"").trim().toUpperCase();
  for(const k in D){const d=D[k];if(typeof d!=="object"||!d.towns)continue;
    if(d.state===s&&d.towns.some(t=>t.toLowerCase()===c))return k}
  return null;
};
