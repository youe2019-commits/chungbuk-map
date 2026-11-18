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
const backdrop=element(world,'image',{id:'contours',href:'contours.webp',x:-650,y:-400,width:W+1300,height:H+800,'pointer-events':'none'});
world.prepend(backdrop);

const modeControls = document.querySelectorAll('input[name="map-mode"]');
const modeKey = 'chungbuk-atlas.map-mode';
function showMode(mode) {
  map.classList.toggle('flat', mode === 'flat');
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

$('relief').setAttribute('width',W);$('relief').setAttribute('height',H);$('relief').setAttribute('preserveAspectRatio','none');
const paths=new Map(), labels=new Map(), buttons=new Map();
regions.forEach(({name,path,label},i)=>{
  element($('province'),'path',{d:path,'clip-rule':'evenodd'});
  element($('land'),'path',{d:path,fill:colors[i],'fill-rule':'evenodd'});
  const region=element($('districts'),'path',{d:path,class:'district','fill-rule':'evenodd','data-region':name});
  paths.set(name,region);
  region.addEventListener('pointerenter',()=>region.classList.add('hover'));
  region.addEventListener('pointerleave',()=>region.classList.remove('hover'));
  // Place the two labels where the district shape and nearby office pins leave room.
  const [x,y]=name==='증평군'?[183,328]:name==='청주시'?[149,487]:label;
  const labelNode=element($('labels'),'text',{x,y,'text-anchor':'middle','dominant-baseline':'central',class:'map-label'});
  labelNode.textContent=name;labels.set(name,labelNode);
});
['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'].forEach(name=>{
  const button=document.createElement('button');button.textContent=name;
  $(name.endsWith('시')?'cities':'counties').append(button);
  button.onclick=()=>choose(name);buttons.set(name,button);
});
let selected='',z=1,base=1,origin=[0,0],center=[W/2,H/2],vw=0,vh=0;
const compact=matchMedia('(max-width:720px), (max-height:540px)');
// Anchors use the same Web Mercator extent as the administrative boundary paths.
const schoolTypes={
  publicMiddle:{label:'공립중', level:'middle', color:'#146e60'},
  privateMiddle:{label:'사립중', level:'middle', color:'#a04b12'},
  publicHigh:{label:'공립고', level:'high', color:'#245ca3'},
  privateHigh:{label:'사립고', level:'high', color:'#784499'}
};
const offices = [
  {name:'충청북도청', region:'청주시', short:'도청', kind:'도 행정', icon:'civic', color:'#36634f', lat:36.6356178, lon:127.4906769,
   address:'청주시 상당구 상당로 82', description:'충청북도의 살림과 행정을 맡습니다. 복지, 교통, 환경 등 여러 시·군에 걸친 정책을 마련하고 도민에게 필요한 사업을 추진합니다.', url:'https://www.chungbuk.go.kr/'},
  {name:'충청북도의회', region:'청주시', short:'도의회', kind:'지방의회', icon:'assembly', color:'#916039', lat:36.6355019, lon:127.4929946,
   address:'청주시 상당구 대성로 116', description:'도민이 선출한 도의원들이 지역의 규칙인 조례를 만들고 고칩니다. 도청과 교육청이 제출한 예산안을 심의하고 행정이 잘 이루어지는지 살펴봅니다.', url:'https://council.chungbuk.kr/'},
  {name:'충청북도교육청', region:'청주시', short:'교육청', kind:'교육행정', icon:'book', color:'#456b8a', lat:36.6066899, lon:127.479413,
   address:'청주시 서원구 청남로 1929', description:'충북의 유치원과 초·중·고등학교 교육을 지원합니다. 학교에서 무엇을 어떻게 가르칠지 함께 준비하고, 학생 복지와 학교 시설을 돌봅니다.', url:'https://www.cbe.go.kr/cbe/'},
  {name:'매괴고등학교', region:'음성군', schoolType:schoolTypes.privateHigh, short:'매괴고', kind:'사립 고등학교', icon:'book', lat:37.1203437, lon:127.6405404,
   address:'음성군 감곡면 매괴길 10', description:'음성군 북쪽 감곡면에 있는 사립 일반고등학교입니다.', url:'https://school.cbe.go.kr/maegoe-h/'},
  {name:'충북반도체고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'충북반도체고', kind:'공립 마이스터고', icon:'book', lat:36.9943672, lon:127.6063144,
   address:'음성군 금왕읍 무극로 393-1', description:'금왕읍에 있는 마이스터고등학교로, 반도체 분야의 기술 인재를 양성합니다.', url:'https://school.cbe.go.kr/cbsemi-h/'},
  {name:'대금고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'대금고', kind:'공립 고등학교', icon:'book', lat:36.9813757, lon:127.528525,
   address:'음성군 금왕읍 신내로 507', description:'금왕읍 신내로에 있는 공립 일반고등학교입니다.', url:'https://school.cbe.go.kr/daegeum-h/'},
  {name:'음성고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'음성고', kind:'공립 고등학교', icon:'book', lat:36.9335096, lon:127.6863450,
   address:'음성군 음성읍 중앙로 109-16', description:'음성읍에 있는 공립 고등학교입니다.', url:'https://school.cbe.go.kr/eumseong-h/'},
  {name:'동성고등학교', region:'음성군', schoolType:schoolTypes.publicHigh, short:'동성고', kind:'공립 고등학교', icon:'book', lat:36.9148164, lon:127.5460141,
   address:'음성군 맹동면 대하로 315', description:'맹동면에 있는 공립 일반고등학교로, 2023년에 문을 열었습니다.', url:'https://school.cbe.go.kr/ds-h/'},
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
function projectOffice({lat,lon}){
  const radius=6378137, radians=Math.PI/180, units=900/(4475176.648049062-4302331.855694858);
  return [(radius*lon*radians-14168260.57948982)*units,
    (4475176.648049062-radius*Math.asinh(Math.tan(lat*radians)))*units];
}
function markerColor(office){
  return office.schoolType?.color ?? office.color;
}
function showOffice(office){
  const card=$('office-card');
  card.style.setProperty('--office-color',markerColor(office));
  $('office-kind').textContent=office.kind;
  $('office-title').textContent=office.name;
  $('office-icon').setAttribute('href','#ic-'+office.icon);
  $('office-description').textContent=office.description;
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
    button.setAttribute('aria-description',office.kind);
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
  try { localStorage.setItem(cardsKey,String(cardsVisible)); } catch {}
};
updateCardVisibility();

const schoolFilter=$('school-filter');
const schoolToggle=$('school-toggle');
function collapseSchoolFilter(){
  schoolToggle.setAttribute('aria-expanded','false');
}
schoolToggle.onclick=()=>{
  schoolToggle.setAttribute('aria-expanded',String(schoolToggle.getAttribute('aria-expanded')!=='true'));
  layoutRegionCards();
};
for(const type of Object.values(schoolTypes)){
  const item=document.createElement('li');
  item.textContent=type.label;
  item.dataset.level=type.level;
  item.style.setProperty('--office-color',type.color);
  $('school-legend').append(item);
}
let schoolLevel='all';
schoolFilter.addEventListener('change',event=>{
  schoolLevel=event.target.value;
  layoutRegionCards();
  draw();
});
const schoolsNorthFirst=officeMarkers.filter(marker=>marker.office.schoolType)
  .sort((a,b)=>b.office.lat-a.office.lat || a.office.name.localeCompare(b.office.name,'ko'));
function matchesSchoolLevel(office){
  return schoolLevel==='all' || schoolLevel===office.schoolType.level;
}

const schoolListDialog=$('school-list-dialog');
$('show-school-list').onclick=()=>{
  const list=$('school-list');
  list.replaceChildren();
  for(const {office} of schoolsNorthFirst.filter(marker=>matchesSchoolLevel(marker.office))){
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
  const left=landscape?Math.max(filter.right,controls.right,document.querySelector('.map-mode').getBoundingClientRect().right)+8:inset;
  const right=vw-inset;
  const top=landscape?8:filter.bottom-mapTop+8;
  const bottom=landscape?vh-8:controls.top-mapTop-8;
  const maxWidth=(right-left-12)/2;
  const rows=Math.ceil(cards.length/2);
  const pitch=Math.min(46,(bottom-top)/rows);
  const height=Math.min(44,pitch-2);

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
    const width=Math.min(maxWidth,Math.max(44,name.length*13+8));
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
  const mobile=compact.matches;
  const pitch=44;
  const visible=[];
  for(const marker of officeMarkers){
    const show=marker.office.region===selected && (!marker.office.schoolType || matchesSchoolLevel(marker.office));
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
  if(selected==='음성군'){
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
  for(const control of document.querySelectorAll('#panel,.map-mode:not([hidden]),.controls,.north,.scale')){
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
  const left=compact.matches?6:55,right=compact.matches?6:55,top=compact.matches?63:12,bottom=compact.matches?31:14;
  origin=[left+(vw-left-right)/2,top+(vh-top-bottom)/2];
  base=Math.max(.01,Math.min((vw-left-right)/W,(vh-top-bottom)/H)*.995);
}
function draw(){
  const k=base*z;
  // Keep part of the mapped province within reach even after a long drag.
  center=[Math.min(W+origin[0]/k-50,Math.max(-(vw-origin[0])/k+50,center[0])),Math.min(H+origin[1]/k-50,Math.max(-(vh-origin[1])/k+50,center[1]))];
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
  $('minus').disabled=z<=1.0001;$('plus').disabled=z>=7.999;
}
function fittedZoom([[l,t],[r,b]]){
  return Math.min(8,Math.max(1,Math.min(W/(r-l),H/(b-t))*.78));
}
function fitSelection(){
  if(selected){
    const [[l,t],[r,b]]=regions.find(x=>x.name===selected).bounds;
    center=[(l+r)/2,(t+b)/2];
    z=fittedZoom([[l,t],[r,b]]);
  }else{center=[W/2,H/2];z=1}
  draw();
}
function panel(open){$('panel').classList.toggle('open',open);$('mobile-select').setAttribute('aria-expanded',String(open))}
function renderSelection(name,view){
  if(selected!==name || view){
    schoolLevel=name==='음성군' && ['middle','high'].includes(view?.schoolLevel)?view.schoolLevel:'all';
    schoolFilter.querySelector('[value="'+schoolLevel+'"]').checked=true;
  }
  selected=name;
  cardToggle.hidden=!offices.some(office=>office.region===name);
  collapseSchoolFilter();
  schoolFilter.hidden=name!=='음성군';
  buttons.forEach((b,n)=>{b.classList.toggle('selected',n===name);b.setAttribute('aria-pressed',String(n===name))});
  paths.forEach((p,n)=>p.classList.toggle('active',n===name));
  if(name)$('districts').append(paths.get(name));
  $('all').classList.toggle('selected',!name);$('all').setAttribute('aria-pressed',String(!name));
  $('mobile-name').textContent=name||'시·군 확대';$('announce').textContent=name?name+' 확대 보기':'충청북도 전체 보기';
  if($('panel').classList.contains('open'))$('mobile-select').focus();
  panel(false);
  layoutRegionCards();
  if(view){
    center=[...view.center];
    z=view.zoom;
    draw();
  }else{
    fitSelection();
  }
}

function entryState(){
  return {...history.state,chungbukMap:{region:selected,center:[...center],zoom:z,schoolLevel}};
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
     Number.isFinite(view.zoom) && view.zoom>=1 && view.zoom<=8){
    renderSelection(view.region,view);
  }else{
    renderSelection('');
  }
}

window.addEventListener('popstate',event=>{
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  restoreEntry(event.state);
});
function zoom(factor,p=origin,q=p){
  const old=z;z=Math.min(8,Math.max(1,z*factor));
  center[0]+=(p[0]-origin[0])/(base*old)-(q[0]-origin[0])/(base*z);
  center[1]+=(p[1]-origin[1])/(base*old)-(q[1]-origin[1])/(base*z);draw();
}
$('zoom-range').oninput=e=>zoom(Number(e.target.value)/z);
$('all').onclick=$('fit').onclick=()=>choose('');$('plus').onclick=()=>zoom(1.45);$('minus').onclick=()=>zoom(1/1.45);
$('mobile-select').onclick=()=>panel(!$('panel').classList.contains('open'));
$('info').onclick=()=>{panel(false);$('details').showModal()};$('close').onclick=()=>$('details').close();
$('details').addEventListener('click',e=>{if(e.target===$('details')){const r=$('details').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('details').close()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('panel').classList.contains('open')){panel(false);$('mobile-select').focus()}});
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
    if(!$('panel').classList.contains('open')){
      tapTarget=e.target.closest('[data-office],[data-region]');
    }
    panel(false);
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
  const target=e.detail===0 && !e.pointerType?e.target.closest('.office-marker'):pendingMapTap;
  pendingMapTap=null;
  if(target?.dataset.office)showOffice(offices.find(office=>office.name===target.dataset.office));
  else if(target?.dataset.region)choose(target.dataset.region);
});
map.addEventListener('keydown',e=>{
  const delta=45/(base*z);
  if(e.key==='+'||e.key==='=')zoom(1.45);else if(e.key==='-')zoom(1/1.45);else if(e.key==='Home')choose('');
  else if(e.key==='ArrowLeft')center[0]-=delta;else if(e.key==='ArrowRight')center[0]+=delta;else if(e.key==='ArrowUp')center[1]-=delta;else if(e.key==='ArrowDown')center[1]+=delta;else return;
  e.preventDefault();draw();
});
dimensions();
restoreEntry(history.state);
new ResizeObserver(()=>{dimensions();layoutRegionCards();draw()}).observe(map);
