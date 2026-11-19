'use strict';
const $ = id => document.getElementById(id);
const ns = 'http://www.w3.org/2000/svg';
function element(parent, tag, attrs) {
  const node=document.createElementNS(ns,tag);
  Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
  parent.append(node);
  return node;
}
const {width:W,height:H,regions,km}=geography;
const colors=['#e6edcd','#e2eccf','#cddfc5','#eee6c1','#f1e8cb','#e1e7c6','#efdcb7','#d7e7ce','#d2e2ba','#e5e8c4','#d7e4d3'];
const map=$('map'), world=$('world');
const land=$('land');
const terrain=document.createElementNS(ns,'g');
element(terrain,'image',{id:'contours',href:'contours.webp',x:-650,y:-400,width:W+1300,height:H+800,'pointer-events':'none'});
element(terrain,'image',{id:'relief',href:'relief.webp',width:W,height:H,preserveAspectRatio:'none','clip-path':'url(#province)','pointer-events':'none'});
// Rivers and lakes on the terrain map (OpenStreetMap), already clipped to the province.
const waterLayer=element(terrain,'g',{id:'water','pointer-events':'none','aria-hidden':'true'});
// Data files may be missing from an old cached page; the map still works without them.
const waterData=typeof water==='object'?water:{area:'',rivers:''};
element(waterLayer,'path',{class:'water-area',d:waterData.area,'fill-rule':'evenodd'});
element(waterLayer,'path',{class:'water-line',d:waterData.rivers,'vector-effect':'non-scaling-stroke'});

const modeControls = document.querySelectorAll('input[name="map-mode"]');
const modeKey = 'chungbuk-atlas.map-mode';
function showMode(mode) {
  $('basemap').replaceChildren(mode === 'flat' ? land : terrain);
  $('nation-map').src = mode === 'flat' ? 'nation-flat.webp' : 'nation-terrain.webp';
  for (const control of modeControls) control.checked = control.value === mode;
}
let initialMode = 'terrain';
try {
  if (localStorage.getItem(modeKey) === 'flat') initialMode = 'flat';
} catch { /* The switch also works with storage disabled. */ }
showMode(initialMode);
for (const control of modeControls) {
  control.addEventListener('change', () => {
    showMode(control.value);
    try { localStorage.setItem(modeKey, control.value); } catch {}
  });
}

const paths=new Map(), labels=new Map();
regions.forEach(({name,path,label},i)=>{
  element($('province'),'path',{d:path,'clip-rule':'evenodd'});
  element(land,'path',{d:path,fill:colors[i],'fill-rule':'evenodd'});
  const region=element($('districts'),'path',{d:path,class:'district','fill-rule':'evenodd','data-region':name,
    role:'button',tabindex:0,'aria-label':name,'aria-pressed':'false'});
  paths.set(name,region);
  region.addEventListener('pointerenter',()=>region.classList.add('hover'));
  region.addEventListener('pointerleave',()=>region.classList.remove('hover'));
  // Place the two labels where the district shape and nearby office pins leave room.
  const [x,y]=name==='증평군'?[183,328]:name==='청주시'?[149,487]:label;
  const labelNode=element($('labels'),'text',{x,y,'text-anchor':'middle','dominant-baseline':'central',class:'map-label'});
  labelNode.textContent=name;labels.set(name,labelNode);
});
// Neighbouring provinces in grey; pressing one opens the national map.
const neighbourLayer=document.createElementNS(ns,'g');neighbourLayer.id='neighbour-layer';
world.insertBefore(neighbourLayer,$('districts'));
const neighbourLabels=[];
const neighbourData=typeof neighbours==='object'?neighbours:[];
for(const {name,path} of neighbourData){
  element(neighbourLayer,'path',{d:path,class:'neighbour','fill-rule':'evenodd','data-neighbour':name,
    role:'button',tabindex:0,'aria-label':name+' · 전국 지도 보기'});
}
const neighbourNames=element(neighbourLayer,'g',{'pointer-events':'none'});
for(const {short,label:[x,y]} of neighbourData){
  const text=element(neighbourNames,'text',{x,y,class:'neighbour-label','text-anchor':'middle','dominant-baseline':'central'});
  text.textContent=short;neighbourLabels.push(text);
}
// Sub-areas (청주 4개 구, 진천·음성·보은 읍·면) appear over the district once school cards are shown there.
const guLayer=document.createElementNS(ns,'g');guLayer.id='gu-layer';
world.insertBefore(guLayer,$('labels'));
const guData=typeof subdivisions==='object'?subdivisions:{};
const guGroups=new Map(), guPaths=new Map(), guLabels=[];
for(const [region,parts] of Object.entries(guData)){
  const group=element(guLayer,'g',{'data-sub-region':region});
  group.setAttribute('hidden','');
  const mid=parts.reduce((sum,{label:[x,y]})=>[sum[0]+x/parts.length,sum[1]+y/parts.length],[0,0]);
  const paths=new Map();
  for(const {name,path,label:[x,y]} of parts){
    const node=element(group,'path',{d:path,class:'gu','data-gu':name,role:'button',tabindex:-1,
      'aria-label':region+' '+name+' 학교만 보기','aria-pressed':'false'});
    // Direction away from the district centre, used to pull the parts slightly apart when they appear.
    const length=Math.hypot(x-mid[0],y-mid[1])||1;
    node.style.setProperty('--gu-dx',((x-mid[0])/length*4).toFixed(2)+'px');
    node.style.setProperty('--gu-dy',((y-mid[1])/length*4).toFixed(2)+'px');
    paths.set(name,node);
  }
  const names=element(group,'g',{'pointer-events':'none'});
  for(const {name,label:[x,y]} of parts){
    const text=element(names,'text',{x,y,class:'gu-label','text-anchor':'middle','dominant-baseline':'central'});
    text.textContent=name;guLabels.push(text);
  }
  guGroups.set(region,group);guPaths.set(region,paths);
}
let selectedGu='';
function syncGu(){
  const on=guGroups.has(selected) && typeInputs.some(input=>input.checked);
  if(!on) selectedGu='';
  const shown=on?selected:'';
  // When the parts first appear, lift each one briefly so it reads as something to press.
  if(on && (!guLayer.classList.contains('visible') || guLayer.dataset.region!==shown)){
    guLayer.classList.remove('intro');
    void guLayer.getBoundingClientRect();
    guLayer.classList.add('intro');
    clearTimeout(syncGu.timer);
    syncGu.timer=setTimeout(()=>guLayer.classList.remove("intro"),2400);
  }
  guLayer.dataset.region=shown;
  guLayer.classList.toggle('visible',on);
  guLayer.classList.toggle('picked',Boolean(selectedGu));
  for(const [region,group] of guGroups){
    // While fading out, keep the last group showing; otherwise only the selected district's parts.
    if(on) group.toggleAttribute('hidden',region!==shown);
    for(const [name,path] of guPaths.get(region)){
      path.classList.toggle('active',region===shown && name===selectedGu);
      path.setAttribute('aria-pressed',String(region===shown && name===selectedGu));
      path.setAttribute('tabindex',on && region===shown?0:-1);
    }
  }
  for(const [name,label] of labels) label.classList.toggle('muted',on && name===shown);
}
function toggleGu(name){
  selectedGu=selectedGu===name?'':name;
  $('announce').textContent=selectedGu?selected+' '+selectedGu+' 학교 보기':selected+' 전체 학교 보기';
  updateFilters();
}
let selected='',z=1,base=1,origin=[0,0],center=[W/2,H/2],vw=0,vh=0;
// The map can zoom out until all of South Korea (the grey provinces) fits on screen.
const nationBounds=(()=>{
  let x0=0,y0=0,x1=W,y1=H;
  for(const {path} of neighbourData){
    const n=path.match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[];
    for(let i=0;i+1<n.length;i+=2){x0=Math.min(x0,n[i]);x1=Math.max(x1,n[i]);y0=Math.min(y0,n[i+1]);y1=Math.max(y1,n[i+1])}
  }
  return [x0,y0,x1,y1];
})();
let zMin=1;
const compact=matchMedia('(max-width:720px), (max-height:540px)');
// Anchors use the same Web Mercator extent as the administrative boundary paths.
const schoolTypes={
  publicMiddle:{label:'공립중', level:'middle', color:'#146e60'},
  privateMiddle:{label:'사립중', level:'middle', color:'#a04b12'},
  nationalMiddle:{label:'국립중', level:'middle', color:'#6e5926'},
  publicHigh:{label:'공립고', level:'high', color:'#245ca3'},
  privateHigh:{label:'사립고', level:'high', color:'#784499'},
  nationalHigh:{label:'국립고', level:'high', color:'#85591d'}
};
// 청주시 중학교 위치·설립형태: 전국초중등학교위치표준데이터 (2026-10-01).
const offices = [
  {name:"가경중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"가경중", kind:"공립 중학교", icon:'book', lat:36.62581198, lon:127.4452459,
   address:"청주시 흥덕구 장구봉로 113", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/gagyeong-m/M01"},
  {name:"가덕중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"가덕중", kind:"공립 중학교", icon:'book', lat:36.5779265, lon:127.5784827,
   address:"청주시 상당구 가덕면 단재로 1448", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/gadeok-e"},
  {name:"각리중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"각리중", kind:"공립 중학교", icon:'book', lat:36.70898232, lon:127.4223164,
   address:"청주시 청원구 오창읍 오창중앙로 48", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/gakri-m/M01"},
  {name:"경덕중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"경덕중", kind:"공립 중학교", icon:'book', lat:36.61943157, lon:127.4360439,
   address:"청주시 흥덕구 풍년로79번길 7-2", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/kyongdug-m/M01"},
  {name:"금천중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"금천중", kind:"공립 중학교", icon:'book', lat:36.6317748, lon:127.5113213,
   address:"청주시 상당구 호미로 278", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"http://www.geumcheon.ms.kr/"},
  {name:"남성중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"남성중", kind:"공립 중학교", icon:'book', lat:36.60926984, lon:127.4847039,
   address:"청주시 서원구 청남로 1984", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cjnamseong-m/M01"},
  {name:"내수중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"내수중", kind:"공립 중학교", icon:'book', lat:36.72399884, lon:127.5377031,
   address:"청주시 청원구 내수읍 마산3길 38", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/naesu-m"},
  {name:"대성여자중학교", region:'청주시', schoolType:schoolTypes.privateMiddle, short:"대성여중", kind:"사립 중학교", icon:'book', lat:36.64433671, lon:127.4923634,
   address:"청주시 상당구 대성로 208", description:"청주시 상당구에 있는 사립 중학교입니다.", url:"http://210.106.100.174/dsg-m/M01/"},
  {name:"대성중학교", region:'청주시', schoolType:schoolTypes.privateMiddle, short:"대성중", kind:"사립 중학교", icon:'book', lat:36.6580328, lon:127.4691294,
   address:"청주시 흥덕구 사운로 342", description:"청주시 흥덕구에 있는 사립 중학교입니다.", url:"https://school.cbe.go.kr/cjdaeseong-m"},
  {name:"문의중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"문의중", kind:"공립 중학교", icon:'book', lat:36.51585586, lon:127.5011211,
   address:"청주시 상당구 문의면 대청호반로 832", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"http://www.munui.ms.kr"},
  {name:"미원중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"미원중", kind:"공립 중학교", icon:'book', lat:36.6362374, lon:127.6612932,
   address:"청주시 상당구 미원면 단재로 2494", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/miwon-m"},
  {name:"복대중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"복대중", kind:"공립 중학교", icon:'book', lat:36.63383868, lon:127.4264097,
   address:"청주시 흥덕구 짐대로 30", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/bokdae-m"},
  {name:"봉명중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"봉명중", kind:"공립 중학교", icon:'book', lat:36.6468051, lon:127.4604183,
   address:"청주시 흥덕구 백봉로224번길 59", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/bongmyeong-m"},
  {name:"산남중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"산남중", kind:"공립 중학교", icon:'book', lat:36.61149337, lon:127.4633929,
   address:"청주시 서원구 산남로 98", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/sn-m"},
  {name:"생명중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"생명중", kind:"공립 중학교", icon:'book', lat:36.71214657, lon:127.4385489,
   address:"청주시 청원구 오창읍 중부로 772", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/saengmyeong-e"},
  {name:"서경중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"서경중", kind:"공립 중학교", icon:'book', lat:36.61909886, lon:127.4412818,
   address:"청주시 흥덕구 가경로 41", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/seogyeong-m"},
  {name:"서원중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"서원중", kind:"공립 중학교", icon:'book', lat:36.63107402, lon:127.4335017,
   address:"청주시 흥덕구 가경로189번길 61", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cjseowon-m"},
  {name:"서현중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"서현중", kind:"공립 중학교", icon:'book', lat:36.61989101, lon:127.4313028,
   address:"청주시 흥덕구 서현중로 10", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/good-m/"},
  {name:"성화중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"성화중", kind:"공립 중학교", icon:'book', lat:36.61741372, lon:127.459426,
   address:"청주시 서원구 신성화로 20", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"http://www.seonghwa.ms.kr"},
  {name:"세광중학교", region:'청주시', schoolType:schoolTypes.privateMiddle, short:"세광중", kind:"사립 중학교", icon:'book', lat:36.60287611, lon:127.4547348,
   address:"청주시 서원구 2순환로 1574", description:"청주시 서원구에 있는 사립 중학교입니다.", url:"https://school.cbe.go.kr/sekwang-m"},
  {name:"솔강중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"솔강중", kind:"공립 중학교", icon:'book', lat:36.61783455, lon:127.3095735,
   address:"청주시 흥덕구 오송읍 오송생명8로 85", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/solgang-m"},
  {name:"솔밭중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"솔밭중", kind:"공립 중학교", icon:'book', lat:36.64021621, lon:127.429130,
   address:"청주시 흥덕구 진재로103번길 15", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/solbat-m"},
  {name:"송절중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"송절중", kind:"공립 중학교", icon:'book', lat:36.65940789, lon:127.4580939,
   address:"청주시 흥덕구 송절로 81", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/sjj-m/M01"},
  {name:"수곡중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"수곡중", kind:"공립 중학교", icon:'book', lat:36.61430614, lon:127.4741591,
   address:"청주시 서원구 수곡로 15", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/sugok-m/M01"},
  {name:"양청중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"양청중", kind:"공립 중학교", icon:'book', lat:36.72014588, lon:127.424052,
   address:"청주시 청원구 오창읍 양청택지3길 5", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cbyc-m/"},
  {name:"오송중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"오송중", kind:"공립 중학교", icon:'book', lat:36.62673583, lon:127.330528,
   address:"청주시 흥덕구 오송읍 만수2길 13", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"http://www.osong.ms.kr"},
  {name:"오창중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"오창중", kind:"공립 중학교", icon:'book', lat:36.73519455, lon:127.4613997,
   address:"청주시 청원구 오창읍 팔결로 619", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/ochang-m"},
  {name:"옥산중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"옥산중", kind:"공립 중학교", icon:'book', lat:36.67072024, lon:127.3697643,
   address:"청주시 흥덕구 옥산면 오산1길 41", description:"청주시 흥덕구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/osm-m"},
  {name:"용성중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"용성중", kind:"공립 중학교", icon:'book', lat:36.62750678, lon:127.5183091,
   address:"청주시 상당구 영운천로203번길 36-12", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/yongsung-m"},
  {name:"용아중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"용아중", kind:"공립 중학교", icon:'book', lat:36.61908143, lon:127.5218293,
   address:"청주시 상당구 중고개로142번길 32-7", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/yongah-m"},
  {name:"용암중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"용암중", kind:"공립 중학교", icon:'book', lat:36.61120432, lon:127.5095846,
   address:"청주시 상당구 용암로 18", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/yongam-m"},
  {name:"운동중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"운동중", kind:"공립 중학교", icon:'book', lat:36.60532067, lon:127.5137136,
   address:"청주시 상당구 운동로 19", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/undong-m"},
  {name:"운호중학교", region:'청주시', schoolType:schoolTypes.privateMiddle, short:"운호중", kind:"사립 중학교", icon:'book', lat:36.62505317, lon:127.4851868,
   address:"청주시 서원구 무심서로 375", description:"청주시 서원구에 있는 사립 중학교입니다.", url:"https://school.cbe.go.kr/unho-m/M01"},
  {name:"원봉중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"원봉중", kind:"공립 중학교", icon:'book', lat:36.61418134, lon:127.5055537,
   address:"청주시 상당구 중흥로 99", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/wonbong-m"},
  {name:"원평중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"원평중", kind:"공립 중학교", icon:'book', lat:36.6080651, lon:127.4938827,
   address:"청주시 서원구 1순환로1137번길 36", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/wp-m/"},
  {name:"율량중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"율량중", kind:"공립 중학교", icon:'book', lat:36.67563376, lon:127.486176,
   address:"청주시 청원구 2순환로 310", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/yullyang-m"},
  {name:"일신여자중학교", region:'청주시', schoolType:schoolTypes.privateMiddle, short:"일신여중", kind:"사립 중학교", icon:'book', lat:36.62692783, lon:127.4968969,
   address:"청주시 상당구 영운로 126", description:"청주시 상당구에 있는 사립 중학교입니다.", url:"https://school.cbe.go.kr/ilshin-m"},
  {name:"주성중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"주성중", kind:"공립 중학교", icon:'book', lat:36.66950234, lon:127.4983628,
   address:"청주시 청원구 율량로 152", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/jusung-m"},
  {name:"청운중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청운중", kind:"공립 중학교", icon:'book', lat:36.61888194, lon:127.5053758,
   address:"청주시 상당구 영운천로 69", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cheongun-m/"},
  {name:"청주남중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청주남중", kind:"공립 중학교", icon:'book', lat:36.61442695, lon:127.4842559,
   address:"청주시 서원구 청남로 2039", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cjnam-m"},
  {name:"청주동중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청주동중", kind:"공립 중학교", icon:'book', lat:36.62848198, lon:127.506259,
   address:"청주시 상당구 수영로 258", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"http://www.cjd.ms.kr"},
  {name:"청주여자중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청주여중", kind:"공립 중학교", icon:'book', lat:36.63468533, lon:127.4805441,
   address:"청주시 서원구 사운로 60", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cheongju-m"},
  {name:"청주중앙여자중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청주중앙여중", kind:"공립 중학교", icon:'book', lat:36.66404363, lon:127.4778871,
   address:"청주시 청원구 율천북로 59", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cjjag-m"},
  {name:"청주중앙중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청주중앙중", kind:"공립 중학교", icon:'book', lat:36.65432258, lon:127.4797665,
   address:"청주시 청원구 향군로115번길 17", description:"청주시 청원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cjja-m"},
  {name:"청주중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"청주중", kind:"공립 중학교", icon:'book', lat:36.64295204, lon:127.4859557,
   address:"청주시 상당구 사직대로361번길 125", description:"청주시 상당구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/cms-m"},
  {name:"충북대학교사범대학부설중학교", region:'청주시', schoolType:schoolTypes.nationalMiddle, short:"충북대사대부설중", kind:"국립 중학교", icon:'book', lat:36.6239268, lon:127.4385285,
   address:"청주시 흥덕구 장구봉로41번길 12", description:"청주시 흥덕구에 있는 국립 중학교입니다.", url:"https://school.cbe.go.kr/bujung-m"},
  {name:"충북여자중학교", region:'청주시', schoolType:schoolTypes.privateMiddle, short:"충북여중", kind:"사립 중학교", icon:'book', lat:36.62663158, lon:127.4841051,
   address:"청주시 서원구 무심서로 377", description:"청주시 서원구에 있는 사립 중학교입니다.", url:"https://school.cbe.go.kr/chungbuk-m"},
  {name:"한국교원대학교부설미호중학교", region:'청주시', schoolType:schoolTypes.nationalMiddle, short:"교원대부설미호중", kind:"국립 중학교", icon:'book', lat:36.62209938, lon:127.3669072,
   address:"청주시 흥덕구 강내면 가로수로 602", description:"청주시 흥덕구에 있는 국립 중학교입니다.", url:"https://school.cbe.go.kr/mihoj-m"},
  {name:"현도중학교", region:'청주시', schoolType:schoolTypes.publicMiddle, short:"현도중", kind:"공립 중학교", icon:'book', lat:36.48310468, lon:127.425716,
   address:"청주시 서원구 현도면 청남로 332-4", description:"청주시 서원구에 있는 공립 중학교입니다.", url:"https://school.cbe.go.kr/hyeondo-m/M01"},
  {name:'광혜원고등학교', region:'진천군', schoolType:schoolTypes.publicHigh, short:'광혜원고', kind:'공립 고등학교', icon:'book', lat:36.99429574, lon:127.4280498,
   address:'진천군 광혜원면 덕성산로 56', description:'보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/ghw-h/'},
  {name:'서전고등학교', region:'진천군', schoolType:schoolTypes.publicHigh, short:'서전고', kind:'공립 고등학교', icon:'book', lat:36.89948149, lon:127.5259529,
   address:'진천군 덕산읍 대하로 47', description:'보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/seojeon-h/'},
  {name:'진천고등학교', region:'진천군', schoolType:schoolTypes.publicHigh, short:'진천고', kind:'공립 고등학교', icon:'book', lat:36.8539549, lon:127.4499542,
   address:'진천군 진천읍 문화12길 48', description:'보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/jcg-h/'},
  {name:'진천상업고등학교', specializedHigh:true, region:'진천군', schoolType:schoolTypes.publicHigh, short:'진천상업고', kind:'공립 고등학교', icon:'book', lat:36.84776396, lon:127.443637,
   address:'진천군 진천읍 문화3길 25', description:'회계와 사무 등 상업 분야의 실무를 배우며 취업과 진학을 준비합니다.', url:'https://school.cbe.go.kr/jcch-h/'},
  {name:'충북체육고등학교', region:'진천군', schoolType:schoolTypes.publicHigh, short:'충북체육고', kind:'공립 고등학교', icon:'book', lat:36.76308637, lon:127.4347297,
   address:'진천군 문백면 도하3길 120', description:'보통교과와 종목별 전문 훈련을 병행하며 체육 분야의 진로를 준비합니다.', url:'https://school.cbe.go.kr/cbp-h/'},
  {name:'한국바이오마이스터고등학교', region:'진천군', schoolType:schoolTypes.publicHigh, short:'한국바이오마이스터고', kind:'공립 고등학교', icon:'book', lat:36.85087948, lon:127.4400545,
   address:'진천군 진천읍 남산4길 13', description:'바이오 식품과 제약 분야의 생산·품질관리 기술을 실습하는 마이스터고입니다.', url:'https://school.cbe.go.kr/kbm-h/'},
  {name:'광혜원중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'광혜원중', kind:'공립 중학교', icon:'book', lat:36.99214384, lon:127.440182,
   address:'진천군 광혜원면 화랑길 137', description:'진천군 광혜원면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/ghw-m/'},
  {name:'덕산중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'덕산중', kind:'공립 중학교', icon:'book', lat:36.90726011, lon:127.5104128,
   address:'진천군 덕산읍 몽촌2길 19', description:'진천군 덕산읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/jcds-m/'},
  {name:'서전중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'서전중', kind:'공립 중학교', icon:'book', lat:36.90416004, lon:127.5299979,
   address:'진천군 덕산읍 예지로 42', description:'진천군 덕산읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/seojeon-m/'},
  {name:'이월중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'이월중', kind:'공립 중학교', icon:'book', lat:36.92704651, lon:127.4281234,
   address:'진천군 이월면 진광로 753', description:'진천군 이월면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/iwol-m/'},
  {name:'진천여자중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'진천여중', kind:'공립 중학교', icon:'book', lat:36.86921086, lon:127.4562294,
   address:'진천군 진천읍 덕금로 65-16', description:'진천군 진천읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/jincheon-m/'},
  {name:'진천중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'진천중', kind:'공립 중학교', icon:'book', lat:36.86732592, lon:127.4465511,
   address:'진천군 진천읍 성중로 27-5', description:'진천군 진천읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/jinjung-m/'},
  {name:'충북체육중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'충북체육중', kind:'공립 중학교', icon:'book', lat:36.76308637, lon:127.4347297,
   address:'진천군 문백면 도하3길 120', description:'진천군 문백면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/cbp-m/'},
  {name:'은여울중학교', region:'진천군', schoolType:schoolTypes.publicMiddle, short:'은여울중', kind:'공립 중학교', icon:'book', lat:36.7944015, lon:127.486351,
   address:'진천군 문백면 농다리로 536-45', description:'체험과 공동체 활동을 중심으로 배우는 공립 대안학교입니다.', url:'https://school.cbe.go.kr/eyu-m/'},
  {name:'은여울고등학교', region:'진천군', schoolType:schoolTypes.publicHigh, short:'은여울고', kind:'공립 고등학교', icon:'book', lat:36.79385, lon:127.4855352,
   address:'진천군 문백면 농다리로 536-43', description:'체험과 공동체 활동을 통해 자신의 진로를 탐색하는 공립 대안학교입니다.', url:'https://school.cbe.go.kr/eyu-m/'},
  {name:'보덕중학교', region:'보은군', schoolType:schoolTypes.publicMiddle, short:'보덕중', kind:'공립 중학교', icon:'book', lat:36.4362936, lon:127.8054176,
   address:'보은군 탄부면 삼승탄부로 843-21', description:'보은군 탄부면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/boduck-m/'},
  {name:'보은여자중학교', region:'보은군', schoolType:schoolTypes.publicMiddle, short:'보은여중', kind:'공립 중학교', icon:'book', lat:36.4942017, lon:127.7164244,
   address:'보은군 보은읍 보은로 223', description:'보은군 보은읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/boeung-m/'},
  {name:'보은중학교', region:'보은군', schoolType:schoolTypes.publicMiddle, short:'보은중', kind:'공립 중학교', icon:'book', lat:36.4853944, lon:127.7271483,
   address:'보은군 보은읍 뱃들로 55-23', description:'보은군 보은읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/boeun-m/'},
  {name:'속리산중학교', region:'보은군', schoolType:schoolTypes.publicMiddle, short:'속리산중', kind:'공립 중학교', icon:'book', lat:36.392523, lon:127.7362,
   address:'보은군 삼승면 능월1길 11', description:'보은군 삼승면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/songnisan-m/'},
  {name:'회인중학교', region:'보은군', schoolType:schoolTypes.publicMiddle, short:'회인중', kind:'공립 중학교', icon:'book', lat:36.4939483, lon:127.5966019,
   address:'보은군 회인면 회인로 73', description:'보은군 회인면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/hoein-m/'},
  {name:'보은여자고등학교', region:'보은군', schoolType:schoolTypes.publicHigh, short:'보은여고', kind:'공립 고등학교', icon:'book', lat:36.4942004, lon:127.7158663,
   address:'보은군 보은읍 보은로 223', description:'보은군 보은읍에 있는 공립 고등학교입니다. 국어·수학·영어 등 보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/boeung-h/'},
  {name:'충북생명산업고등학교', specializedHigh:true, region:'보은군', schoolType:schoolTypes.publicHigh, short:'충북생명산업고', kind:'공립 고등학교', icon:'book', lat:36.4921467, lon:127.7164429,
   address:'보은군 보은읍 자영고길 10', description:'스마트팜에서 작물 재배와 환경 제어를 실습하고 농산물 유통·경영을 배워 농업 창업을 준비합니다.', url:'https://school.cbe.go.kr/cbb-h/'},
  {name:'보은고등학교', region:'보은군', schoolType:schoolTypes.privateHigh, short:'보은고', kind:'사립 고등학교', icon:'book', lat:36.4750884, lon:127.7211248,
   address:'보은군 보은읍 보은로 17', description:'보은군 보은읍에 있는 사립 고등학교입니다. 국어·수학·영어 등 보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/boeun-h/'},
  // 청주 고등학교 위치·설립형태: 전국초중등학교위치표준데이터(2026-10-01), 학교알리미 학교기본정보.
  {name:'금천고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'금천고', kind:'공립 고등학교', icon:'book', lat:36.62779716, lon:127.5119428,
   address:'청주시 상당구 호미로233번길 65', description:'상당구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/kch-h'},
  {name:'다다예술학교(고)', region:'청주시', schoolType:schoolTypes.privateHigh, short:'다다예술학교(고)', kind:'사립 대안학교', icon:'book', lat:36.5909401696, lon:127.6110663318,
   address:'청주시 상당구 낭성면 단재로 1794', description:'청주시 상당구 낭성면에 있는 다다예술학교의 고등학교 과정입니다.', url:'http://www.ddart.org'},
  {name:'단재고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'단재고', kind:'공립 대안학교', icon:'book', lat:36.5626094238, lon:127.5607447647,
   address:'청주시 상당구 가덕면 계산은행로 12', description:'청주시 상당구 가덕면에 있는 공립 대안학교입니다.', url:'https://school.cbe.go.kr/danjae-h/'},
  {name:'봉명고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'봉명고', kind:'공립 고등학교', icon:'book', lat:36.65492565, lon:127.4552839,
   address:'청주시 흥덕구 월명로220번길 19', description:'흥덕구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cbm-h/M01'},
  {name:'산남고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'산남고', kind:'공립 고등학교', icon:'book', lat:36.60858732, lon:127.4697341,
   address:'청주시 서원구 두꺼비로 7', description:'서원구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/sannam-h'},
  {name:'상당고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'상당고', kind:'공립 고등학교', icon:'book', lat:36.60641965, lon:127.5086186,
   address:'청주시 상당구 월평로238번길 3-10', description:'상당구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/sangdang-h'},
  {name:'서원고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'서원고', kind:'공립 고등학교', icon:'book', lat:36.62008178, lon:127.4410388,
   address:'청주시 흥덕구 가경로 49', description:'흥덕구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/seowongo-h'},
  {name:'세광고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'세광고', kind:'사립 고등학교', icon:'book', lat:36.6032833, lon:127.4529213,
   address:'청주시 서원구 2순환로 1572', description:'서원구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/skhs-h/'},
  {name:'양청고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'양청고', kind:'공립 고등학교', icon:'book', lat:36.72699018, lon:127.4335201,
   address:'청주시 청원구 오창읍 양청6길 33', description:'청원구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/yc-h/M01'},
  {name:'오송고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'오송고', kind:'공립 고등학교', icon:'book', lat:36.62962002, lon:127.3259846,
   address:'청주시 흥덕구 오송읍 오송생명3로 95', description:'흥덕구에 있는 공립 자율고등학교입니다.', url:'https://school.cbe.go.kr/os-h'},
  {name:'오창고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'오창고', kind:'공립 고등학교', icon:'book', lat:36.7341991, lon:127.4616514,
   address:'청주시 청원구 오창읍 괴정1길 10', description:'청원구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/ochang-h/'},
  {name:'운호고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'운호고', kind:'사립 고등학교', icon:'book', lat:36.62505317, lon:127.4851868,
   address:'청주시 서원구 무심서로 375', description:'서원구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/unho-h/'},
  {name:'일신여자고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'일신여고', kind:'사립 고등학교', icon:'book', lat:36.62692783, lon:127.4968969,
   address:'청주시 상당구 영운로 126', description:'상당구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cjis-h/'},
  {name:'주성고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'주성고', kind:'공립 고등학교', icon:'book', lat:36.63483259, lon:127.5106512,
   address:'청주시 상당구 호미로 310', description:'상당구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/juseong-h'},
  {name:'청석고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'청석고', kind:'사립 고등학교', icon:'book', lat:36.61443915, lon:127.5066419,
   address:'청주시 상당구 원봉로 75', description:'상당구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cs-h'},
  {name:'청원고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'청원고', kind:'공립 고등학교', icon:'book', lat:36.71412973, lon:127.4150059,
   address:'청주시 청원구 오창읍 구룡5길 9', description:'청원구에 있는 공립 자율고등학교입니다.', url:'https://school.cbe.go.kr/cw-h'},
  {name:'청주고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주고', kind:'공립 고등학교', icon:'book', lat:36.63602351, lon:127.4552331,
   address:'청주시 흥덕구 사직대로 79', description:'흥덕구에 있는 공립 자율고등학교입니다.', url:'https://school.cbe.go.kr/cheongju-h'},
  {name:'청주고등학교부설방송통신고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주방통고', kind:'공립 방송통신고', icon:'book', lat:36.6360605251, lon:127.4553103878,
   address:'청주시 흥덕구 사직대로 79', description:'청주고등학교에 부설된 방송통신고등학교로, 원격수업과 출석수업을 병행합니다.', url:'https://school.cbe.go.kr/cheongju-h/'},
  {name:'청주대성고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'청주대성고', kind:'사립 고등학교', icon:'book', lat:36.65378546, lon:127.4906593,
   address:'청주시 청원구 대성로300번길 18', description:'청원구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cjds-h'},
  {name:'청주신흥고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'청주신흥고', kind:'사립 고등학교', icon:'book', lat:36.66965116, lon:127.4965194,
   address:'청주시 청원구 율봉로 229', description:'청원구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/shinheung-h/'},
  {name:'청주여자고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주여고', kind:'공립 고등학교', icon:'book', lat:36.66774008, lon:127.489702,
   address:'청주시 청원구 충청대로107번길 82', description:'청원구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cheongjug-h'},
  {name:'청주중앙여자고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주중앙여고', kind:'공립 고등학교', icon:'book', lat:36.63776915, lon:127.4645545,
   address:'청주시 서원구 천석로 15', description:'서원구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cjjang-h'},
  {name:'충북고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북고', kind:'공립 고등학교', icon:'book', lat:36.60854214, lon:127.4817144,
   address:'청주시 서원구 청남로 1969', description:'서원구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/chungbukgo-h'},
  {name:'충북과학고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북과학고', kind:'공립 고등학교', icon:'book', lat:36.58779121, lon:127.5691772,
   address:'청주시 상당구 가덕면 교육원로 153-135', description:'상당구에 있는 공립 특수목적고등학교입니다.', url:'https://school.cbe.go.kr/cbs-h/M01'},
  {name:'충북대학교사범대학부설고등학교', region:'청주시', schoolType:schoolTypes.nationalHigh, short:'충북대사대부고', kind:'국립 고등학교', icon:'book', lat:36.6239268, lon:127.4385184,
   address:'청주시 흥덕구 장구봉로41번길 12', description:'흥덕구에 있는 국립 일반고등학교입니다.', url:'https://school.cbe.go.kr/cbnu-h'},
  {name:'충북에너지고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북에너지고', kind:'공립 고등학교', icon:'book', lat:36.63980192, lon:127.6571478,
   address:'청주시 상당구 미원면 미원초정로 27', description:'상당구에 있는 공립 특수목적고등학교입니다.', url:'https://school.cbe.go.kr/cbenergy-h/'},
  {name:'충북여자고등학교', region:'청주시', schoolType:schoolTypes.privateHigh, short:'충북여고', kind:'사립 고등학교', icon:'book', lat:36.62538218, lon:127.4841669,
   address:'청주시 서원구 무심서로 377-2', description:'서원구에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/chungbuk-h/'},
  {name:'충북예술고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북예술고', kind:'공립 고등학교', icon:'book', lat:36.61085188, lon:127.4327541,
   address:'청주시 흥덕구 서부로 1185', description:'흥덕구에 있는 공립 특수목적고등학교입니다.', url:'https://school.cbe.go.kr/cbart-h/'},
  {name:'충북온라인학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북온라인학교', kind:'공립 온라인학교', icon:'book', lat:36.6144968508, lon:127.4846839435,
   address:'청주시 서원구 청남로 2039', description:'다른 고등학교에 재학 중인 학생들이 온라인으로 과목을 이수합니다. 재학생 수는 별도로 공시하지 않습니다.', url:'https://school.cbe.go.kr/cbonline-h'},
  {name:'충북외국어고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북외고', kind:'공립 고등학교', icon:'book', lat:36.6255022, lon:127.4444905,
   address:'청주시 흥덕구 장구봉로 107', description:'흥덕구에 있는 공립 특수목적고등학교입니다.', url:'https://school.cbe.go.kr/cfl-h/M01'},
  {name:'한국교원대학교부설고등학교', region:'청주시', schoolType:schoolTypes.nationalHigh, short:'교원대부고', kind:'국립 고등학교', icon:'book', lat:36.6056652, lon:127.3573247,
   address:'청주시 흥덕구 강내면 태성탑연로 250', description:'흥덕구에 있는 국립 일반고등학교입니다.', url:'https://school.cbe.go.kr/ahsknue-h/'},
  {name:'흥덕고등학교', region:'청주시', schoolType:schoolTypes.publicHigh, short:'흥덕고', kind:'공립 고등학교', icon:'book', lat:36.63686278, lon:127.4239538,
   address:'청주시 흥덕구 증안로 9', description:'흥덕구에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/hds-h/'},
  {name:'청주공업고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주공고', kind:'공립고', icon:'book', lat:36.6383598, lon:127.4856352,
   address:'청주시 상당구 교서로 17', description:'전자회로와 반도체 기초, 프로그래밍 등을 배우며 공업 기술 분야의 진로를 준비합니다.', url:'https://school.cbe.go.kr/ck-h/'},
  {name:'청주농업고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주농고', kind:'공립고', icon:'book', lat:36.6600712, lon:127.4842284,
   address:'청주시 청원구 내덕로 45', description:'도시농업과 농업토목 등에서 화훼, 농업기계 운전 같은 기술을 배우며 농업 분야 진로를 준비합니다.', url:'https://school.cbe.go.kr/cjagh-h/'},
  {name:'충북공업고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북공고', kind:'공립고', icon:'book', lat:36.6126871, lon:127.4309739,
   address:'청주시 흥덕구 서부로1205번길 52', description:'기계·전기·전자를 함께 배우고 생산자동화설비, 금형, 정밀기계 등의 실습으로 제조 현장에 필요한 기술을 익힙니다.', url:'https://school.cbe.go.kr/cbt-h/'},
  {name:'청주하이텍고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.publicHigh, short:'청주하이텍고', kind:'공립고', icon:'book', lat:36.609161, lon:127.4923736,
   address:'청주시 서원구 1순환로1137번길 59', description:'자동화 장비를 제어하고 전기·전자 회로를 다루는 실습으로 생산설비 분야의 기술을 익힙니다.', url:'https://school.cbe.go.kr/cjh-h/'},
  {name:'충북상업정보고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.publicHigh, short:'충북상업정보고', kind:'공립고', icon:'book', lat:36.6637875, lon:127.4787784,
   address:'청주시 청원구 율천북로 73', description:'광고·마케팅, 물류, 관광 서비스 등을 배우며 상업과 서비스 분야의 취업·창업을 준비합니다.', url:'https://school.cbe.go.kr/cbci-h/'},
  {name:'청주IT과학고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.privateHigh, short:'청주IT과학고', kind:'사립고', icon:'book', lat:36.521889, lon:127.436617,
   address:'청주시 서원구 현도면 죽암도원로 34-13', description:'소프트웨어 개발, 인공지능 프로그래밍, 컴퓨터 디자인을 배우며 IT 분야의 진로를 준비합니다.', url:'https://school.cbe.go.kr/cjits-h/'},
  {name:'청주여자상업고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.privateHigh, short:'청주여상고', kind:'사립고', icon:'book', lat:36.625861, lon:127.483889,
   address:'청주시 서원구 무심서로 377-1', description:'경영회계, 콘텐츠 디자인, 외식 조리를 배우며 각 분야의 실무와 진로를 탐색합니다.', url:'https://school.cbe.go.kr/croba-h/'},
  {name:'대성여자상업고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.privateHigh, short:'대성여상고', kind:'사립고', icon:'book', lat:36.6451545, lon:127.4922457,
   address:'청주시 상당구 대성로 220', description:'회계와 세무, 문서 작성과 정보처리 등을 익혀 기업과 금융기관의 사무 업무를 준비합니다.', url:'https://school.cbe.go.kr/cds-h/'},
  {name:'양업고등학교', specializedHigh:true, region:'청주시', schoolType:schoolTypes.privateHigh, short:'양업고', kind:'사립고', icon:'book', lat:36.671027, lon:127.3473567,
   address:'청주시 흥덕구 옥산면 환희길 277', description:'가톨릭 대안교육을 바탕으로 보통교과와 체험 중심 활동을 함께 배우며 자율성과 공동체 생활 역량을 기릅니다.', url:'https://www.yangeob.hs.kr/'},
  {name:'충청북도청', region:'청주시', short:'도청', kind:'도 행정', icon:'civic', color:'#36634f', lat:36.6356178, lon:127.4906769,
   address:'청주시 상당구 상당로 82', description:'도민이 직접 뽑은 도지사가 이끄는 충북의 집행기관입니다. 도의회가 정한 조례와 예산에 따라 교통·복지·산업·환경처럼 도민의 생활에 필요한 일을 실제로 해 나갑니다.\n예를 들어 가정의 사교육비 부담을 덜기 위해 도청이 청소년이 무료로 들을 수 있는 학습·진로 프로그램을 계획하면, 그 비용을 예산안에 담아 도의회에 냅니다. 도의회가 의결하면 도청은 시·군, 교육청과 함께 프로그램을 운영합니다.', url:'https://www.chungbuk.go.kr/'},
  {name:'충청북도의회', region:'청주시', short:'도의회', kind:'지방의회', icon:'assembly', color:'#916039', lat:36.6355019, lon:127.4929946,
   address:'청주시 상당구 대성로 116', description:'도민이 뽑은 도의원 38명이 모인 충북의 의결기관입니다. 충북의 규칙인 조례를 만들고, 도청과 교육청이 낸 예산안을 심의해 의결하며, 그 돈을 제대로 썼는지 행정사무감사로 살핍니다.\n예를 들어 학원이 밤 몇 시까지 수업할 수 있는지는 도의회가 만드는 조례로 정합니다. 또 교육청이 낸 방과후 수업 예산을 심의하면서 “사교육비가 실제로 줄었나요?”라고 묻고, 그 결과를 점검합니다.', url:'https://council.chungbuk.kr/'},
  {name:'충청북도교육청', region:'청주시', short:'교육청', kind:'교육행정', icon:'book', color:'#456b8a', lat:36.6066899, lon:127.479413,
   address:'청주시 서원구 청남로 1929', description:'도민이 직접 뽑은 교육감이 이끄는 교육 자치의 집행기관입니다. 도청과 따로 학교 교육과 선생님, 학교 시설과 급식 등을 맡고, 학원 등록과 지도·점검도 맡습니다.\n예를 들어 학원에 다니기 어려운 학생도 학교에서 충분히 배울 수 있도록 방과후 수업과 온라인 학습을 늘리려면, 교육감이 교육비 예산안을 도의회에 냅니다. 도의회 교육위원회가 심사하고 본회의에서 의결하면 교육청이 학교와 함께 운영합니다.', url:'https://www.cbe.go.kr/cbe/'},
  {name:'매괴고등학교', region:'음성군', schoolType:schoolTypes.privateHigh, short:'매괴고', kind:'사립 고등학교', icon:'book', lat:37.1203437, lon:127.6405404,
   address:'음성군 감곡면 매괴길 10', description:'음성군 북쪽 감곡면에 있는 사립 일반고등학교입니다. 국어·수학·영어 등 보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/maegoe-h/'},
  {name:'충북반도체고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'충북반도체고', kind:'공립 마이스터고', icon:'book', lat:36.9943672, lon:127.6063144,
   address:'음성군 금왕읍 무극로 393-1', description:'반도체를 만드는 공정과 장비 운용을 실습하며 반도체 생산 현장에서 일할 기술인을 기르는 마이스터고입니다.', url:'https://school.cbe.go.kr/cbsemi-h/'},
  {name:'대금고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'대금고', kind:'공립 고등학교', icon:'book', lat:36.9813757, lon:127.528525,
   address:'음성군 금왕읍 신내로 507', description:'금왕읍 신내로에 있는 공립 일반고등학교입니다. 국어·수학·영어 등 보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/daegeum-h/'},
  {name:'음성고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'음성고', kind:'공립 고등학교', icon:'book', lat:36.9335096, lon:127.6863450,
   address:'음성군 음성읍 중앙로 109-16', description:'음성읍에 있는 공립 고등학교입니다. 국어·수학·영어 등 보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/eumseong-h/'},
  {name:'동성고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'동성고', kind:'공립 고등학교', icon:'book', lat:36.9148164, lon:127.5460141,
   address:'음성군 맹동면 대하로 315', description:'맹동면에 있는 공립 일반고등학교로, 2023년에 문을 열었습니다. 국어·수학·영어 등 보통교과와 선택과목을 공부하며 진학과 진로를 준비합니다.', url:'https://school.cbe.go.kr/ds-h/'},
  {name:'감곡중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'감곡중', kind:'공립 중학교', icon:'book', lat:37.1106382, lon:127.6419545,
   address:'음성군 감곡면 음성로 2629', description:'음성군 감곡면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/gamgok-m/'},
  {name:'대소중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'대소중', kind:'공립 중학교', icon:'book', lat:36.9626896, lon:127.4898499,
   address:'음성군 대소읍 대동로869번길 15', description:'음성군 대소읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/daeso-m/'},
  {name:'동성중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'동성중', kind:'공립 중학교', icon:'book', lat:36.9119029, lon:127.5429252,
   address:'음성군 맹동면 학예로 32', description:'음성군 맹동면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/dongseong-m/'},
  {name:'매괴여자중학교', region:'음성군', schoolType:schoolTypes.privateMiddle, short:'매괴여중', kind:'사립 중학교', icon:'book', lat:37.1203437, lon:127.6405404,
   address:'음성군 감곡면 매괴길 10', description:'음성군 감곡면에 있는 사립 중학교입니다.', url:'https://school.cbe.go.kr/maegoe-m/'},
  {name:'무극중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'무극중', kind:'공립 중학교', icon:'book', lat:36.9888258, lon:127.5918067,
   address:'음성군 금왕읍 응천서길27번길 37', description:'음성군 금왕읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/mugeuk-m/'},
  {name:'삼성중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'삼성중', kind:'공립 중학교', icon:'book', lat:37.025419, lon:127.50027,
   address:'음성군 삼성면 덕호로 39', description:'음성군 삼성면에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/sams-m/'},
  {name:'생극중학교', region:'음성군', schoolType:schoolTypes.privateMiddle, short:'생극중', kind:'사립 중학교', icon:'book', lat:37.0357465, lon:127.6051271,
   address:'음성군 생극면 음성로 1672', description:'음성군 생극면에 있는 사립 중학교입니다.', url:'https://school.cbe.go.kr/saenggeuk-m/'},
  {name:'음성여자중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'음성여중', kind:'공립 중학교', icon:'book', lat:36.9277447, lon:127.6990698,
   address:'음성군 음성읍 한불로 10', description:'음성군 음성읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/eumseongg-m/'},
  {name:'음성중학교', region:'음성군', schoolType:schoolTypes.publicMiddle, short:'음성중', kind:'공립 중학교', icon:'book', lat:36.9358708, lon:127.6955885,
   address:'음성군 음성읍 수정로 79', description:'음성군 음성읍에 있는 공립 중학교입니다.', url:'https://school.cbe.go.kr/eumseong-m/'},
  {name:'한일중학교', region:'음성군', schoolType:schoolTypes.privateMiddle, short:'한일중', kind:'사립 중학교', icon:'book', lat:36.9353714, lon:127.6858972,
   address:'음성군 음성읍 예술로 34', description:'음성군 음성읍에 있는 사립 중학교입니다.', url:'https://school.cbe.go.kr/hanil-m/'}
];
// Schools other than general high schools get the red star and a type label.
const specialSchools={
  '충북과학고등학교':'특목고 · 과학고','충북외국어고등학교':'특목고 · 외국어고',
  '충북예술고등학교':'특목고 · 예술고','충북체육고등학교':'특목고 · 체육고',
  '충북반도체고등학교':'마이스터고','충북에너지고등학교':'마이스터고','한국바이오마이스터고등학교':'마이스터고',
  '단재고등학교':'대안학교','은여울고등학교':'대안학교',
  '청주고등학교부설방송통신고등학교':'방송통신고','충북온라인학교':'온라인학교'
};
for(const office of offices){
  const byKind=office.schoolType?.level==='high' && office.kind.match(/대안학교|마이스터고|방송통신고|온라인학교/)?.[0];
  const label=office.specializedHigh?'특성화고':specialSchools[office.name]||byKind;
  if(!label) continue;
  office.specialLabel=label;
  // Do not repeat a type the kind already names (e.g. '공립 마이스터고').
  office.kindText=office.kind.includes(label.split(' · ').pop())?office.kind:office.kind+' · '+label;
}
function projectOffice({lat,lon}){
  const radius=6378137, radians=Math.PI/180, units=900/(4475176.648049062-4302331.855694858);
  return [(radius*lon*radians-14168260.57948982)*units,
    (4475176.648049062-radius*Math.asinh(Math.tan(lat*radians)))*units];
}
function markerColor(office){
  return office.schoolType?.color ?? office.color;
}
function showNumbers(id, entries){
  const list=$(id);
  list.replaceChildren();
  for(const [label,value] of entries){
    const item=document.createElement('div');
    const term=document.createElement('dt'), number=document.createElement('dd');
    term.textContent=label;
    number.textContent=value.toLocaleString('ko-KR')+'명';
    item.append(term,number); list.append(item);
  }
}
$('home-button').onclick=()=>choose('');
// Region comparison: 청주 ↔ 그 밖의 충북, 수도권 ↔ 충북.
$('compare-open').onclick=()=>{$('compare-dialog').showModal();$('compare-dialog').scrollTop=0};
for(const tab of document.querySelectorAll('[data-compare]')){
  tab.onclick=()=>{
    for(const other of document.querySelectorAll('[data-compare]')) other.setAttribute('aria-pressed',String(other===tab));
    for(const panel of document.querySelectorAll('[data-compare-panel]')) panel.hidden=panel.dataset.comparePanel!==tab.dataset.compare;
  };
}
$('region-info').onclick=()=>{
  const data=regionStatistics[selected];
  if(!data)return;
  $('region-title').textContent=selected+' 지역 정보';
  $('region-feature').textContent=data.feature;
  showNumbers('region-residents',[['전체',data.male+data.female],['남성',data.male],['여성',data.female]]);
  showNumbers('region-students',[['전체 재학생',data.middle+data.high],['중학생',data.middle],['고등학생',data.high]]);
  $('population-source').href='https://wooaingu.wooahouse.com/region/충북/'+selected+'/';
  $('region-dialog').showModal();
};
function showOffice(office){
  const card=$('office-card');
  card.style.setProperty('--office-color',markerColor(office));
  card.classList.toggle('specialized-high',Boolean(office.specialLabel));
  $('office-kind').textContent=office.kindText||office.kind;
  $('office-title').textContent=office.name;
  $('office-icon').setAttribute('href','#ic-'+office.icon);
  $('office-description').textContent=office.description;
  // The three institutions in 청주 show how local autonomy works and their own organisation chart.
  const orgTemplate=document.getElementById('org-'+office.name);
  $('office-org').hidden=!orgTemplate;
  $('office-org').open=false;
  $('office-org-body').replaceChildren(...(orgTemplate?[orgTemplate.content.cloneNode(true)]:[]));
  $('office-extra').replaceChildren(...(orgTemplate?[$('local-autonomy').content.cloneNode(true)]:[]));
  for(const box of $('office-extra').querySelectorAll('[data-org]')) box.classList.toggle('current',box.dataset.org===office.name);
  const stats=schoolStatistics[office.name];
  $('school-stats').hidden=!stats;
  if(stats){
    const students=stats.boys+stats.girls;
    showNumbers('school-numbers',[['전체 학생',students],['남학생',stats.boys],['여학생',stats.girls],
      ['교원',stats.teachers],['교원 1인당 학생',Number((students/stats.teachers).toFixed(1))]]);
    $('school-year').textContent=stats.year||2026;
    $('school-source').href=stats.source;
  }
  $('office-address').textContent='충청북도 '+office.address;
  $('office-link').href=office.url;
  card.showModal();
}
$('office-close').onclick=()=>$('office-card').close();
$('office-card').addEventListener('click',event=>{
  if(event.target!==event.currentTarget)return;
  const box=event.currentTarget.getBoundingClientRect();
  if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)event.currentTarget.close();
});
const officeMarkers=offices.map(office=>{
  const layer=$('office-lines');
  const line=element($('connectors'),'path',{
    class:office.schoolType?'office-line school-connector':'office-line',
    stroke:markerColor(office)
  });
  const dot=element(layer,'circle',{class:'office-dot',r:office.schoolType?5:3.4,fill:markerColor(office),'pointer-events':'all','data-office':office.name});
  const button=document.createElement('button');
  button.className='office-marker';
  if(office.schoolType){
    button.classList.add('school-marker');
    button.classList.toggle('specialized-high',Boolean(office.specialLabel));
    button.setAttribute('aria-description',office.kindText||office.kind);
  }
  button.setAttribute('aria-label',office.name+' 설명 보기');
  button.setAttribute('aria-haspopup','dialog');
  button.style.setProperty('--office-color',markerColor(office));
  const badge=document.createElement('span');
  const icon=element(badge,'svg',{'aria-hidden':'true'});
  element(icon,'use',{href:'#ic-'+office.icon});
  const title=document.createElement('b');badge.append(title);button.append(badge);
  $('office-markers').append(button);
  button.dataset.office=office.name;
  return {office,point:projectOffice(office),line,dot,button,title};
});
const cardToggle=$('card-visibility');
const cardsKey='chungbuk-atlas.cards-visible';
let cardsVisible=true;
try { cardsVisible=localStorage.getItem(cardsKey)!=='false'; } catch {}
function updateCardVisibility(){
  $('area').classList.toggle('cards-hidden',!cardsVisible);
  cardToggle.textContent=cardsVisible?'카드 숨기기':'카드 보기';
}
cardToggle.onclick=()=>{
  cardsVisible=!cardsVisible;
  updateCardVisibility();
  layoutRegionCards();draw();
  try { localStorage.setItem(cardsKey,String(cardsVisible)); } catch {}
};
updateCardVisibility();

const schoolFilter=$('school-filter');
const schoolToggle=$('school-toggle');
schoolToggle.onclick=()=>{
  schoolToggle.setAttribute('aria-expanded',String(schoolToggle.getAttribute('aria-expanded')!=='true'));
};
// National middle and high schools share one filter: '국립'.
function filterTypes(key){
  return key==='nationalMiddle'?[schoolTypes.nationalMiddle,schoolTypes.nationalHigh]:[schoolTypes[key]];
}
const typeInputs=Object.entries(schoolTypes).filter(([key])=>key!=='nationalHigh')
  .sort(([a],[b])=>(a==='nationalMiddle')-(b==='nationalMiddle')).map(([key,type])=>{
  const label=document.createElement('label');
  const input=document.createElement('input');
  input.type='checkbox'; input.value=key;
  const name=document.createElement('span'); name.textContent=key==='nationalMiddle'?'국립':type.label;
  label.style.setProperty('--office-color',type.color);
  label.append(input,name);
  $('school-options').insertBefore(label,$('show-school-list'));
  return input;
});
function updateFilters(){
  cardPage=0;
  layoutRegionCards();
  draw();
  history.replaceState(entryState(),'');
}
schoolFilter.addEventListener('change',updateFilters);
const schoolsNorthFirst=officeMarkers.filter(marker=>marker.office.schoolType)
  .sort((a,b)=>b.office.lat-a.office.lat || a.office.name.localeCompare(b.office.name,'ko'));
function matchesSchoolLevel(office){
  return typeInputs.some(input=>input.checked && filterTypes(input.value).includes(office.schoolType))
    && (!selectedGu || office.address.split(/\s+/)[1]===selectedGu);
}

const schoolListDialog=$('school-list-dialog');
$('show-school-list').onclick=()=>{
  const list=$('school-list');
  list.replaceChildren();
  for(const {office} of schoolsNorthFirst.filter(marker=>marker.office.region===selected && matchesSchoolLevel(marker.office))){
    const item=document.createElement('li'), button=document.createElement('button');
    const type=document.createElement('small');
    type.textContent=office.schoolType.label;
    type.style.color=markerColor(office);
    button.append(office.name,type);
    button.onclick=()=>{schoolListDialog.close();showOffice(office)};
    item.append(button);list.append(item);
  }
  schoolListDialog.showModal();
};
$('close-school-list').onclick=()=>schoolListDialog.close();

let cardPage=0;
const cardPages=$('card-pages');
$('previous-cards').onclick=()=>{cardPage--;layoutRegionCards();draw()};
$('next-cards').onclick=()=>{cardPage++;layoutRegionCards();draw()};

function layoutSchools(cards){
  cards.sort((a,b)=>b.marker.office.lat-a.marker.office.lat || a.marker.office.name.localeCompare(b.marker.office.name,'ko'));
  // Pair neighbours by latitude. Column choices depend only on geography,
  // so dragging or changing the zoom cannot swap their positions.
  for(let i=0;i+1<cards.length;i+=2){
    const east=cards[i].marker.office.lon>cards[i+1].marker.office.lon?i:i+1;
    cards[east].column=1;
  }
  const mapTop=map.getBoundingClientRect().top;
  const filter=schoolFilter.getBoundingClientRect();
  const controls=document.querySelector('.controls').getBoundingClientRect();
  const landscape=compact.matches && vh<425 && vw>=540;
  const inset=compact.matches?4:Math.max(16,vw*.025);
  // In landscape the left controls take the left edge; the terrain switch sits at the top right.
  const left=landscape?Math.max(filter.right,controls.right,$('panel').getBoundingClientRect().right)+8:inset;
  const right=landscape?document.querySelector('.map-mode').getBoundingClientRect().left-8:vw-inset;
  const cheongju=selected==='청주시';
  const edgeGap=cheongju?4:8;
  let top=landscape?edgeGap:Math.max(filter.bottom,$('region-info').getBoundingClientRect().bottom)-mapTop+edgeGap;
  const bottom=landscape?vh-edgeGap:controls.top-mapTop-edgeGap;
  // When high-school filters crowd the map, page the labels but keep all location dots.
  const minPitch=26;
  if(cheongju && cards.some(({marker})=>marker.office.schoolType?.level==='high')
      && Math.ceil(cards.length/2)*minPitch>bottom-top){
    cardPages.hidden=false;
    if(!landscape)top=Math.max(top,cardPages.getBoundingClientRect().bottom-mapTop+edgeGap);
    const perPage=2*Math.max(1,Math.floor((bottom-top)/minPitch));
    const pages=Math.ceil(cards.length/perPage);
    cardPage=Math.max(0,Math.min(cardPage,pages-1));
    const start=cardPage*perPage;
    cards.forEach(({marker},index)=>{
      const hidden=index<start || index>=start+perPage;
      marker.button.hidden=hidden;
      marker.line.style.display=hidden?'none':'';
    });
    cards=cards.slice(start,start+perPage);
    $('card-page-number').textContent=(cardPage+1)+' / '+pages;
    $('previous-cards').disabled=cardPage===0;
    $('next-cards').disabled=cardPage===pages-1;
  }
  const maxWidth=(right-left-12)/2;
  const rows=Math.ceil(cards.length/2);
  const pitch=Math.min(cheongju?50:46,(bottom-top)/rows);
  const height=Math.min(44,pitch-2);
  // Keep the touch target tall and make space between the visible card faces.
  if(cheongju){
    const faceHeight=Math.max(15,Math.min(21,pitch-6));
    $('office-markers').style.setProperty('--cheongju-card-height',faceHeight+'px');
  }

  const rowOffset=Math.min(14,pitch/3);

  // Reserve enough room for every later card in each column, then place each
  // card as close to its latitude as possible while preserving north-to-south order.
  const lastAllowed=[bottom-height/2,bottom-height/2];
  let ceiling=bottom-height/2;
  for(let i=cards.length-1;i>=0;i--){
    const card=cards[i];
    ceiling=Math.min(ceiling,lastAllowed[card.column]);
    card.limit=ceiling;
    lastAllowed[card.column]=ceiling-pitch;
  }
  let floor=top+height/2;
  const nextFree=[floor,floor];
  for(const {marker,x,y,column,limit} of cards){
    const rowY=Math.max(floor,nextFree[column],Math.min(limit,y+rowOffset));
    floor=rowY;
    nextFree[column]=rowY+pitch;
    const name=marker.office.short;
    const padding=marker.office.schoolType?8:32;
    const width=Math.min(maxWidth,Math.max(44,name.length*13+padding+(marker.office.specialLabel?8:0)));
    const cardX=column===0?left:right-width;
    const cardEdge=cardX+(column===0?width:0);
    const elbow=cardEdge+(column===0?1:-1)*Math.min(40,Math.max(14,(right-left)*.055));
    marker.line.setAttribute('d',`M${x},${y} L${elbow},${rowY} H${cardEdge}`);
    marker.title.textContent=name;
    marker.button.style.width=width+'px';
    marker.button.style.height=height+'px';
    marker.button.style.left=cardX+'px';
    marker.button.style.top=(rowY-height/2)+'px';
  }
}

// Lay out once in the fitted region view. Move the entire layout with the map.
let annotationView=null;
function layoutRegionCards(){
  syncGu();
  cardPages.hidden=true;
  const mobile=compact.matches;
  const pitch=44;
  const visible=[];
  const showInstitutions=selected==='청주시' && !typeInputs.some(input=>input.checked);
  for(const marker of officeMarkers){
    const show=marker.office.region===selected && (marker.office.schoolType
      ? matchesSchoolLevel(marker.office) : showInstitutions);
    marker.button.hidden=!show;
    marker.line.style.display=marker.dot.style.display=show?'':'none';
    if(show)visible.push({marker,column:0});
  }
  if(!visible.length){annotationView=null;return}
  const bounds=regions.find(region=>region.name===selected).bounds;
  const scale=base*fittedZoom(bounds);
  const midX=(bounds[0][0]+bounds[1][0])/2, midY=(bounds[0][1]+bounds[1][1])/2;
  annotationView={scale,midX,midY};
  for(const card of visible){
    const marker=card.marker;
    card.x=origin[0]+(marker.point[0]-midX)*scale;
    card.y=origin[1]+(marker.point[1]-midY)*scale;
    marker.dot.setAttribute('cx',card.x);
    marker.dot.setAttribute('cy',card.y);
  }
  if(visible.some(card=>card.marker.office.schoolType)){
    layoutSchools(visible);
    return;
  }
  const blockers=[];
  for(const label of labels.values()){
    const px=origin[0]+(Number(label.getAttribute('x'))-midX)*scale;
    const py=origin[1]+(Number(label.getAttribute('y'))-midY)*scale;
    blockers.push([px-36,py-15,px+36,py+15]);
  }
  const mapTop=map.getBoundingClientRect().top;
  for(const control of document.querySelectorAll('#panel,.map-mode:not([hidden]),.controls,.scale')){
    const r=control.getBoundingClientRect();
    blockers.push([r.left,r.top-mapTop,r.right,r.bottom-mapTop]);
  }
  const avgX=visible.reduce((sum,m)=>sum+m.x,0)/visible.length;
  const avgY=visible.reduce((sum,m)=>sum+m.y,0)/visible.length;
  const width=mobile?76:130;
  const height=pitch*visible.length;
  let best;
  for(const side of (mobile?[1,-1]:[-1,1])){
    for(const offset of [0,-pitch,pitch,-2*pitch,2*pitch]){
      const gap=mobile?22:39;
      const left=Math.max(4,Math.min(vw-width-4,avgX+(side>0?gap:-gap-width)));
      const top=Math.max(4,Math.min(vh-height-4,avgY-height/2+offset));
      let cost=Math.abs(offset)*.12;
      for(const [l,t,r,b] of blockers){
        cost+=Math.max(0,Math.min(left+width+4,r)-Math.max(left-4,l))*
          Math.max(0,Math.min(top+height,b)-Math.max(top,t));
      }
      for(const {x,y} of visible){
        if(x>=left-3&&x<=left+width+3&&y>=top&&y<=top+height)cost+=1500;
      }
      if(!best||cost<best.cost)best={left,top,cost,side};
    }
  }
  visible.forEach(({marker,x,y},i)=>{
    const {button,line,title,office}=marker;
    title.textContent=mobile?office.short:office.name;
    const cy=best.top+(i+.5)*pitch;
    const end=best.side>0?best.left:best.left+width;
    button.style.width=width+'px';
    button.style.left=best.left+'px';button.style.top=(cy-pitch/2)+'px';
    line.setAttribute('d',`M${x},${y} L${end-best.side*8},${cy} H${end}`);
  });
}

function dimensions(){
  const r=map.getBoundingClientRect();vw=r.width;vh=r.height;
  let left=compact.matches?6:55,right=compact.matches?6:55,top=compact.matches?63:12,bottom=compact.matches?31:14;
  // Portrait phones: fit the map between the top buttons and the bottom controls, centred in that gap.
  if(compact.matches && vh>vw){
    const mode=document.querySelector('.map-mode:not(.school-filter)').getBoundingClientRect();
    const controls=document.querySelector('.controls').getBoundingClientRect();
    if(mode.height && controls.height){
      top=Math.max(top,mode.bottom-r.top+10);
      bottom=Math.max(bottom,r.bottom-controls.top+10);
    }
  }
  origin=[left+(vw-left-right)/2,top+(vh-top-bottom)/2];
  base=Math.max(.01,Math.min((vw-left-right)/W,(vh-top-bottom)/H)*.995);
  const [nx0,ny0,nx1,ny1]=nationBounds;
  zMin=Math.min(1,Math.min((vw-left-right)/(nx1-nx0),(vh-top-bottom)/(ny1-ny0))/base);
  $('zoom-range').min=zMin.toFixed(3);
}
function draw(){
  const k=base*z;
  // Keep part of the mapped province within reach even after a long drag.
  const [bx0,by0,bx1,by1]=nationBounds;
  // When the whole country fits along an axis, centre it on that axis.
  const fitsX=(bx1-bx0)*k<=vw-12, fitsY=(by1-by0)*k<=vh-12;
  if(fitsX) center[0]=(bx0+bx1)/2+(origin[0]-vw/2)/k;
  if(fitsY) center[1]=(by0+by1)/2+(origin[1]-vh/2)/k;
  center=[Math.min(bx1+origin[0]/k-50,Math.max(bx0-(vw-origin[0])/k+50,center[0])),Math.min(by1+origin[1]/k-50,Math.max(by0-(vh-origin[1])/k+50,center[1]))];
  world.setAttribute('transform',`translate(${origin[0]} ${origin[1]}) scale(${k}) translate(${-center[0]} ${-center[1]})`);
  const overviewSize=Math.min(20,Math.max(compact.matches?11:12,19*base));
  const size=Math.min(24,overviewSize+3*Math.log2(z));
  labels.forEach((label,name)=>{
    const x=Number(label.getAttribute('x')),y=Number(label.getAttribute('y'));
    // Approximately 44 map units of usable width at Jeungpyeong's label position.
    const labelSize=name==='증평군'?Math.min(size,44*k/3):size;
    label.style.display=labelSize<11?'none':'';
    label.style.fontSize=(labelSize/k)+'px';label.style.strokeWidth=(2.8/k)+'px';
    label.classList.toggle('active',selected===name);
  });
  const guSize=Math.min(17,12+2*Math.log2(z));
  for(const text of guLabels){text.style.fontSize=(guSize/k)+'px';text.style.strokeWidth=(2.6/k)+'px'}
  for(const text of neighbourLabels){text.style.fontSize=(Math.max(10,Math.min(15,11+2*Math.log2(z)))/k)+'px';text.style.strokeWidth=(2.4/k)+'px'}
  $('zoom-range').value=z;
  $('zoom-range').setAttribute('aria-valuetext',Number(z.toFixed(2))+'배');
  if(annotationView){
    const ratio=k/annotationView.scale;
    const dx=(1-ratio)*origin[0]+(annotationView.midX-center[0])*k;
    const dy=(1-ratio)*origin[1]+(annotationView.midY-center[1])*k;
    const matrix=[ratio,0,0,ratio,dx,dy];
    $('office-lines').setAttribute('transform','matrix('+matrix.join(' ')+')');
    $('office-markers').style.transform='matrix('+matrix.join(',')+')';
  }
  const unit=[.2,.5,1,2,5,10,20,50,100].filter(v=>v*km*k<85).pop()||.1;
  $('scale-text').textContent=unit<1?(unit*1000)+' m':unit+' km';$('scale-line').style.width=(unit*km*k)+'px';
  $('minus').disabled=z<=zMin+.0001;$('plus').disabled=z>=7.999;
}
function fittedZoom([[l,t],[r,b]]){
  const fitFraction=selected==='청주시' ? 0.68 : 0.78;
  return Math.min(8,Math.max(1,Math.min(W/(r-l),H/(b-t))*fitFraction));
}
function fitSelection(){
  if(selected){
    const [[l,t],[r,b]]=regions.find(x=>x.name===selected).bounds;
    center=[(l+r)/2,(t+b)/2];
    z=fittedZoom([[l,t],[r,b]]);
  }else{center=[W/2,H/2];z=1}
  draw();
}
function renderSelection(name,view){
  const entering=selected!==name;
  if(selected!==name) selectedGu='';
  if(selected!==name || view){
    cardPage=0;
    for(const input of typeInputs){
      if(Array.isArray(view?.types)) input.checked=view.types.includes(input.value);
      else if(view?.schoolLevel) input.checked=view.schoolLevel==='all'||filterTypes(input.value).some(type=>type.level===view.schoolLevel);
      else input.checked=name!=='' && name!=='청주시' && (input.value==='publicMiddle' || input.value==='publicHigh');
    }
  }
  selected=name;
  $('office-markers').classList.toggle('cheongju-cards',name==='청주시');
  setNational(false);
  $('panel').hidden=!name;
  $('compare-open').hidden=Boolean(name);
  $('region-info').hidden=!name;
  cardToggle.hidden=!offices.some(office=>office.region===name);
  // The school filter opens by itself whenever a district with schools is chosen.
  schoolToggle.setAttribute('aria-expanded',String(entering && offices.some(office=>office.region===name && office.schoolType)));
  schoolFilter.hidden=!offices.some(office=>office.region===name && office.schoolType);
  $('school-list-title').textContent=name+' 학교 목록';
  for(const input of typeInputs){
    input.parentElement.hidden=!offices.some(office=>office.region===name && filterTypes(input.value).includes(office.schoolType));
  }
  paths.forEach((path,n)=>{
    path.classList.toggle('active',n===name);
    path.setAttribute('aria-pressed',String(n===name));
  });
  if(name)$('districts').append(paths.get(name));
  $('announce').textContent=name?name+' 확대 보기':'충청북도 전체 보기';
  layoutRegionCards();
  if(view){
    center=[...view.center];
    z=view.zoom;
    draw();
  }else{
    fitSelection();
  }
}

function setNational(active){
  const field=$('area').parentElement;
  field.classList.toggle('national',active);
  field.setAttribute('aria-label',active?'전국 지도 탐색':'충청북도 지도 탐색');
  $('nation-view').hidden=!active;
  $('fit').setAttribute('aria-pressed',String(!active));
  $('nation-toggle').setAttribute('aria-pressed',String(active));
  document.querySelector('.brand strong').textContent=active?'전국 지도':'충북 지도';
  if(active){setNationScale(1);document.querySelector('.nation-scroll').scrollTop=0}
}
// The national map zooms on its own (pinch or ctrl/trackpad wheel) instead of the browser zooming the page,
// so cards and dialogs opened from it always appear at their normal size.
const nationScroll=document.querySelector('.nation-scroll'), nationSheet=document.querySelector('.nation-sheet');
let nationScale=1, nationPinch=null;
function setNationScale(next,cx,cy){
  next=Math.min(4,Math.max(1,next));
  const box=nationScroll.getBoundingClientRect();
  const x=cx??box.left+box.width/2, y=cy??box.top+box.height/2;
  const px=nationScroll.scrollLeft+x-box.left, py=nationScroll.scrollTop+y-box.top, ratio=next/nationScale;
  nationScale=next;
  nationSheet.style.setProperty('--ns',next);
  nationScroll.scrollLeft=px*ratio-(x-box.left);
  nationScroll.scrollTop=py*ratio-(y-box.top);
}
nationScroll.addEventListener('touchstart',e=>{
  if(e.touches.length!==2)return;
  const [a,b]=e.touches;
  nationPinch={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),scale:nationScale};
},{passive:true});
nationScroll.addEventListener('touchmove',e=>{
  if(!nationPinch||e.touches.length!==2)return;
  e.preventDefault();
  const [a,b]=e.touches;
  setNationScale(nationPinch.scale*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/nationPinch.distance,(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);
},{passive:false});
nationScroll.addEventListener('touchend',e=>{if(e.touches.length<2)nationPinch=null});
nationScroll.addEventListener('wheel',e=>{
  if(!e.ctrlKey)return;
  e.preventDefault();
  setNationScale(nationScale*Math.exp(-e.deltaY/200),e.clientX,e.clientY);
},{passive:false});
// Safari's own pinch gesture would zoom the whole page; keep it on the map instead.
for(const type of ['gesturestart','gesturechange'])
  document.addEventListener(type,e=>{if(!$('nation-view').hidden)e.preventDefault()},{passive:false});
const ministryCard=$('ministry-card');
const lesson=$('relocation-lesson');
function setLessonStep(step){
  for(const page of lesson.querySelectorAll('[data-phase]')){
    page.toggleAttribute('hidden',page.dataset.phase!==step);
  }
  for(const button of lesson.querySelectorAll('[data-step]')){
    button.setAttribute('aria-pressed',String(button.dataset.step===step));
  }
}
function openLesson(step){
  setLessonStep(step);
  lesson.showModal();
  lesson.scrollTop=0;
}
for(const button of document.querySelectorAll('[data-lesson-open]')){
  button.onclick=()=>{
    if(ministryCard.open) ministryCard.close();
    const step=button.dataset.lessonOpen || '0';
    history.pushState({...entryState(),lessonStep:step},'');
    for(const detail of lesson.querySelectorAll('details')) detail.open=false;
    openLesson(step);
  };
}
for(const button of lesson.querySelectorAll('[data-step]')){
  button.onclick=()=>{
    setLessonStep(button.dataset.step);
    history.replaceState({...history.state,lessonStep:button.dataset.step},'');
  };
}
$('lesson-close').onclick=()=>history.back();
lesson.addEventListener('cancel',event=>{
  event.preventDefault();
  history.back();
});
function showMinistries(city){
  $('ministry-title').textContent=city+' 주요 부처';
  for(const group of ministryCard.querySelectorAll('[data-ministries]')){
    group.hidden=group.dataset.ministries!==city;
  }
  ministryCard.showModal();
  ministryCard.scrollTop=0;
}
for(const target of document.querySelectorAll('.ministry-city')){
  target.addEventListener('click',event=>{
    event.preventDefault();
    history.pushState({...entryState(),ministryCity:target.dataset.city},'');
    showMinistries(target.dataset.city);
  });
}
$('ministry-close').onclick=()=>history.back();
ministryCard.addEventListener('cancel',event=>{
  event.preventDefault();
  history.back();
});

// 충북 / 전국 buttons next to the zoom bar switch between the two maps.
$('nation-toggle').onclick=()=>{
  if(!$('nation-view').hidden) return;
  history.replaceState(entryState(),'');
  if(selected) renderSelection('');
  setNational(true);
  history.pushState(entryState(),'');
};
// Organisation charts open on top of whatever is showing and close by themselves.
for(const button of document.querySelectorAll('[data-org-open]')){
  button.onclick=()=>{
    const dialog=$(button.dataset.orgOpen);
    dialog.showModal();
    dialog.scrollTop=0;
  };
}

function entryState(){
  return {...history.state,chungbukMap:{national:!$('nation-view').hidden,region:selected,center:[...center],zoom:z,types:typeInputs.filter(input=>input.checked).map(input=>input.value)}};
}

function choose(name){
  if(name!==selected){
    // Capture the exact map extent just before leaving this region.
    history.replaceState(entryState(),'');
    renderSelection(name);
    history.pushState(entryState(),'');
  }else{
    renderSelection(name);
    history.replaceState(entryState(),'');
  }
}

function restoreEntry(state){
  const view=state?.chungbukMap;
  if(view && (view.region==='' || paths.has(view.region)) &&
     Array.isArray(view.center) && view.center.length===2 && view.center.every(Number.isFinite) &&
     Number.isFinite(view.zoom) && view.zoom>=zMin-.001 && view.zoom<=8){
    renderSelection(view.region,view);
    if(!view.region && view.national){
      setNational(true);
      if(['0','1','2','3'].includes(state.lessonStep)){
        openLesson(state.lessonStep);
      }else if([...ministryCard.querySelectorAll('[data-ministries]')].some(group=>group.dataset.ministries===state.ministryCity)){
        showMinistries(state.ministryCity);
      }
    }
  }else{
    renderSelection('');
  }
}

window.addEventListener('popstate',event=>{
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  restoreEntry(event.state);
});
function zoom(factor,p=origin,q=p){
  const old=z;z=Math.min(8,Math.max(zMin,z*factor));
  center[0]+=(p[0]-origin[0])/(base*old)-(q[0]-origin[0])/(base*z);
  center[1]+=(p[1]-origin[1])/(base*old)-(q[1]-origin[1])/(base*z);draw();
}
$('zoom-range').oninput=e=>zoom(Number(e.target.value)/z);
$('fit').onclick=()=>{
  if($('nation-view').hidden){choose('');return}
  history.replaceState(entryState(),'');
  renderSelection('');
  history.pushState(entryState(),'');
};$('plus').onclick=()=>zoom(1.45);$('minus').onclick=()=>zoom(1/1.45);
// Track the SVG and the overlaid label buttons as a single gesture surface.
const gestureArea=$('area');
const touches=new Map();
let start=[], tapTarget=null, pendingMapTap=null;
function point(e){const r=map.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const middle=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
gestureArea.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-Math.max(-180,Math.min(180,e.deltaY*(e.deltaMode===1?16:1)))*.0025),point(e))},{passive:false});
gestureArea.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const position=point(e);
  pendingMapTap=null;
  tapTarget=null;
  if(!touches.size){
    start=position;
    tapTarget=e.target.closest('[data-office],[data-gu],[data-region],[data-neighbour]');
  }
  touches.set(e.pointerId,position);
  gestureArea.setPointerCapture(e.pointerId);
  map.classList.add('dragging');
});
gestureArea.addEventListener('pointermove',e=>{
  const old=touches.get(e.pointerId);
  if(!old)return;
  const now=point(e);
  touches.set(e.pointerId,now);
  if(touches.size>1){
    const [[firstId,first],[secondId,second]]=touches;
    if(e.pointerId!==firstId && e.pointerId!==secondId)return;
    const other=e.pointerId===firstId?second:first;
    zoom(dist(now,other)/Math.max(dist(old,other),1),middle(old,other),middle(now,other));
  }else{
    if(tapTarget && dist(start,now)<=5)return;
    tapTarget=null;
    center[0]-=(now[0]-old[0])/(base*z);
    center[1]-=(now[1]-old[1])/(base*z);
    draw();
  }
});
function release(e){
  if(!touches.delete(e.pointerId))return;
  if(touches.size)return;
  map.classList.remove('dragging');
  if(e.type==='pointerup' && dist(start,point(e))<=5)pendingMapTap=tapTarget;
  tapTarget=null;
}
gestureArea.addEventListener('pointerup',release);
gestureArea.addEventListener('pointercancel',release);
gestureArea.addEventListener('lostpointercapture',e=>{
  if(e.target===gestureArea)release(e);
});
// Commit selection on click so a newly revealed label cannot receive the same tap.
// Keyboard and assistive-technology activations have no preceding pointer gesture.
gestureArea.addEventListener('click',e=>{
  const target=e.detail===0 && !e.pointerType?e.target.closest('.office-marker,[data-gu],[data-region],[data-neighbour]'):pendingMapTap;
  pendingMapTap=null;
  if(target?.dataset.office)showOffice(offices.find(office=>office.name===target.dataset.office));
  // A district (구) of Cheongju: show only its schools; pressing it again shows all of Cheongju.
  else if(target?.dataset.gu)toggleGu(target.dataset.gu);
  else if(target?.dataset.neighbour)$('nation-toggle').click();
  // Clicking the already selected district again returns to the whole-province view.
  else if(target?.dataset.region===selected){
    // Clicking the selected district again shows the whole province, centred on that district.
    const [[l,t],[r,b]]=regions.find(region=>region.name===selected).bounds;
    choose('');
    center=[(l+r)/2,(t+b)/2];
    draw();
    history.replaceState(entryState(),'');
  }
  else if(target?.dataset.region)choose(target.dataset.region);
});
map.addEventListener('keydown',e=>{
  if(e.target.dataset.neighbour && (e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    if(!e.repeat)$('nation-toggle').click();
    return;
  }
  if(e.target.dataset.gu && (e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    if(!e.repeat)toggleGu(e.target.dataset.gu);
    return;
  }
  const region=e.target.dataset.region;
  if(region && (e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    if(!e.repeat){
      choose(region===selected?'':region);
      e.target.focus();
    }
    return;
  }
  const delta=45/(base*z);
  if(e.key==='+'||e.key==='=')zoom(1.45);else if(e.key==='-')zoom(1/1.45);else if(e.key==='Home')choose('');
  else if(e.key==='ArrowLeft')center[0]-=delta;else if(e.key==='ArrowRight')center[0]+=delta;else if(e.key==='ArrowUp')center[1]-=delta;else if(e.key==='ArrowDown')center[1]+=delta;else return;
  e.preventDefault();draw();
});
dimensions();
restoreEntry(history.state);
new ResizeObserver(()=>{dimensions();layoutRegionCards();draw()}).observe(map);

// Floating handwriting pad. Strokes are kept in this browser's localStorage, so notes survive closing the pad or the page.
(()=>{
  const pad=$('note-pad'), canvas=$('note-canvas'), ctx=canvas.getContext('2d'), toggle=$('note-toggle');
  const KEY='chungbuk-map-notes', BOX='chungbuk-map-note-box';
  let strokes=[], color='#1f2a24', erasing=false, current=null, penSeen=false, clearArmed=null;
  try{strokes=JSON.parse(localStorage.getItem(KEY))||[]}catch{strokes=[]}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(strokes))}catch{}};
  const saveBox=()=>{try{localStorage.setItem(BOX,JSON.stringify({left:pad.offsetLeft,top:pad.offsetTop,width:pad.offsetWidth,height:pad.offsetHeight}))}catch{}};
  function drawStroke(s){
    const pts=s.p; if(!pts.length)return;
    ctx.strokeStyle=ctx.fillStyle=s.c; ctx.lineCap=ctx.lineJoin='round';
    if(pts.length===1){ctx.beginPath();ctx.arc(pts[0][0],pts[0][1],pts[0][2]/2,0,7);ctx.fill();return}
    for(let i=1;i<pts.length;i++){
      ctx.lineWidth=(pts[i-1][2]+pts[i][2])/2;
      ctx.beginPath();ctx.moveTo(pts[i-1][0],pts[i-1][1]);ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();
    }
  }
  function redraw(){
    const r=canvas.getBoundingClientRect(), d=devicePixelRatio||1;
    if(canvas.width!==Math.round(r.width*d)||canvas.height!==Math.round(r.height*d)){canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d)}
    ctx.setTransform(d,0,0,d,0,0); ctx.clearRect(0,0,r.width,r.height);
    strokes.forEach(drawStroke);
  }
  function placePad(){
    let box=null; try{box=JSON.parse(localStorage.getItem(BOX))}catch{}
    const w=Math.min(box?.width||460,innerWidth-16), h=Math.min(box?.height||360,innerHeight-16);
    pad.style.width=w+'px'; pad.style.height=h+'px';
    pad.style.left=Math.max(8,Math.min(box?.left??innerWidth-w-16,innerWidth-w-8))+'px';
    pad.style.top=Math.max(8,Math.min(box?.top??64,innerHeight-h-8))+'px';
  }
  function setOpen(open){
    pad.hidden=!open; toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-pressed',String(open));
    if(open){placePad();redraw()}
  }
  toggle.addEventListener('click',()=>setOpen(pad.hidden));
  $('note-close').addEventListener('click',()=>setOpen(false));
  // Pens and eraser
  const pens=[...pad.querySelectorAll('.note-pen')];
  function pick(btn){erasing=btn.id==='note-eraser';if(!erasing)color=btn.dataset.color;[...pens,$('note-eraser')].forEach(b=>b.setAttribute('aria-pressed',String(b===btn)))}
  [...pens,$('note-eraser')].forEach(b=>b.addEventListener('click',()=>pick(b)));
  $('note-undo').addEventListener('click',()=>{strokes.pop();save();redraw()});
  const clearBtn=$('note-clear');
  clearBtn.addEventListener('click',()=>{
    if(!clearArmed){clearBtn.textContent='한 번 더 누르면 지움';clearArmed=setTimeout(()=>{clearArmed=null;clearBtn.textContent='모두 지우기'},2500);return}
    clearTimeout(clearArmed);clearArmed=null;clearBtn.textContent='모두 지우기';strokes=[];save();redraw();
  });
  // Drawing: pen, mouse or finger. Once a stylus is used, fingers no longer draw (resting palm).
  const at=e=>{const r=canvas.getBoundingClientRect();return [Math.round((e.clientX-r.left)*10)/10,Math.round((e.clientY-r.top)*10)/10]};
  const width=e=>e.pointerType==='pen'&&e.pressure>0?Math.round((1.2+e.pressure*3.4)*10)/10:2.6;
  function eraseAt([x,y]){
    const before=strokes.length;
    strokes=strokes.filter(s=>!s.p.some(q=>Math.hypot(q[0]-x,q[1]-y)<10));
    if(strokes.length!==before)redraw();
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen')penSeen=true;
    if(e.pointerType==='touch'&&penSeen)return;
    if(e.button>0)return;
    canvas.setPointerCapture(e.pointerId); e.preventDefault();
    const pt=at(e);
    if(erasing){current={erase:true,id:e.pointerId};eraseAt(pt);return}
    current={id:e.pointerId,s:{c:color,p:[[...pt,width(e)]]}}; strokes.push(current.s); drawStroke(current.s);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!current||e.pointerId!==current.id)return;
    for(const ev of e.getCoalescedEvents?.()||[e]){
      const pt=at(ev);
      if(current.erase){eraseAt(pt);continue}
      const pts=current.s.p, last=pts[pts.length-1];
      if(Math.hypot(pt[0]-last[0],pt[1]-last[1])<1.2)continue;
      pts.push([...pt,width(ev)]);
      drawStroke({c:current.s.c,p:pts.slice(-2)});
    }
  });
  const end=e=>{if(current&&e.pointerId===current.id){current=null;save()}};
  canvas.addEventListener('pointerup',end); canvas.addEventListener('pointercancel',end);
  // Move by the title, resize from the corner (CSS resize); keep it on screen.
  const grip=pad.querySelector('.note-grip');
  let drag=null;
  grip.addEventListener('pointerdown',e=>{drag={x:e.clientX-pad.offsetLeft,y:e.clientY-pad.offsetTop,id:e.pointerId};grip.setPointerCapture(e.pointerId);e.preventDefault()});
  grip.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    pad.style.left=Math.max(0,Math.min(e.clientX-drag.x,innerWidth-pad.offsetWidth))+'px';
    pad.style.top=Math.max(0,Math.min(e.clientY-drag.y,innerHeight-40))+'px';
  });
  grip.addEventListener('pointerup',()=>{drag=null;saveBox()});
  new ResizeObserver(()=>{if(!pad.hidden){redraw();saveBox()}}).observe(pad);
  addEventListener('resize',()=>{if(!pad.hidden){placePad();redraw()}});
})();
