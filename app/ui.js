/* ===== Interfejs =====
   Dokument = pudełko (opcjonalne, liczone z wymiarów) + swobodne linie (wczytane albo narysowane).
   Poziomy jak w Figmie: obiekty → dwuklik/Enter → wnętrze (ścianki pudełka albo punkty linii) → Esc wraca. */
(function(){
var SCRIPT_SRC=(document.currentScript&&document.currentScript.src)||'';
var $=function(id){return document.getElementById(id);};
var svg=$('cv'),world=$('world'),overlay=$('overlay');
var S={free:[],bpaths:[],paths:[],box:null,ctx:'obj',boxSel:false,sel:new Set(),nsel:new Set(),edit:new Set(),selP:null,polys:{},plus:[],labels:[],frames:{},dims:{},
  clash:{},editBox:false,key:null,clip:null,pasteN:0,tool:'select',view:'die',z:2,tx:40,ty:40,name:'pudełko',meas:null,undo:[],nid:1,rot:'auto',corner:'tl',hot:null,sides:3};
var MATS=[['Karton 300 g',0.4],['Karton 350 g',0.5],['Mikrofala F',0.8],['Mikrofala E',1.5],['Mikrofala B',3],['Tektura szara 1 mm',1],['Tektura szara 1,5 mm',1.5],['Tektura szara 2 mm',2],['Tektura szara 3 mm',3]];
try{var sm=JSON.parse(localStorage.getItem('wykr-mats')||'null');if(sm&&sm.length===MATS.length)MATS=sm;}catch(e){}
var LBL={cut:'Cięcie',crease:'Bigowanie',vcut:'Rowek V',perf:'Perforacja',kiss:'Nacinanie',ignore:'Pomiń'};
var KIND={wall:'Ścianka',glue:'Klejenie',tuck:'Zakładka',dust:'Klapka boczna',tab:'Wypustki',snapF:'Dno: klapa z językiem',snapB:'Dno: klapa z wycięciem'},BASE={auto:'Automatycznie',S:'Szerokość pudełka',W:'Wysokość pudełka',G:'Głębokość pudełka',num:'Własny wymiar'};
/* menu plusa: pozycja główna + druga lista z odmianami (rozwija się po najechaniu) */
var MENU=[{k:'wall',l:'Ścianka'},
  {k:'tuck',l:'Zakładka',sub:[{l:'Na tarcie',o:{lock:0}},{l:'Z zamkiem szczelinowym',o:{lock:10}}]},
  {k:'dust',l:'Klapka boczna',sub:[{l:'Z barkiem',o:{shape:'shoulder'}},{l:'Z barkiem, odwrócona',o:{shape:'shoulder',flip:true}},{l:'Trapez',o:{shape:'trap'}}]},
  {k:'glue',l:'Klejenie'},{k:'tab',l:'Wypustki',n:'bez bigu'},
  {k:'snapF',l:'Dno zatrzaskowe',sub:[{l:'Klapa przednia z językiem',k:'snapF'},{l:'Klapa tylna z wycięciem',k:'snapB',o:{sink:{kt:1}}},{l:'Klapa boczna',k:'dust',o:{shape:'trap',sink:{kt:2},ext:{base:'G',mul:0.45,kt:0}}}]}];
var DRAW={rect:1,ellipse:1,line:1,poly:1};
var drag=null,space=false,raf=0,editing=false,shift=false;
window.addEventListener('keydown',function(e){shift=e.shiftKey;},true);window.addEventListener('keyup',function(e){shift=e.shiftKey;},true);window.addEventListener('blur',function(){shift=false;});

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function n1(v){return v.toFixed(1).replace('.',',');}
function toast(t){var e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(function(){e.style.display='none';},3800);}
function cfg(){var n=function(id,d){var v=parseFloat($(id).value);return isFinite(v)?v:d;};return {W:Math.max(10,n('iW',1010)),H:Math.max(10,n('iH',720)),m:Math.max(0,n('iM',12)),gap:Math.max(0,n('iG',3)),max:Math.max(0,Math.floor(n('iMax',0))),rot:S.rot,corner:S.corner,mk:$('iMk').checked?5:0};}
function thk(){var v=parseFloat($('thk').value);return isFinite(v)?v:0;}
function byId(id){for(var i=0;i<S.free.length;i++)if(S.free[i].id===id)return S.free[i];return null;}
function active(){return S.paths.filter(function(p){return p.type!=='ignore';});}
function compose(){S.paths=S.bpaths.concat(S.free);}
function constrain(o,w){var dx=w.x-o.x,dy=w.y-o.y,ax=Math.abs(dx),ay=Math.abs(dy);if(ax>2*ay)dy=0;else if(ay>2*ax)dx=0;else{var m=Math.max(ax,ay);dx=(dx<0?-m:m);dy=(dy<0?-m:m);}return {x:o.x+dx,y:o.y+dy};}

/* --- cofanie --- */
function pushUndo(){S.undo.push(JSON.stringify({free:S.free,box:S.box,name:S.name}));if(S.undo.length>80)S.undo.shift();}
function undo(){var u=S.undo.pop();if(!u){toast('Nie ma czego cofać.');return;}u=JSON.parse(u);S.free=u.free;S.box=u.box;S.name=u.name;leave(true);S.sel.clear();S.boxSel=false;regen();syncBox();refresh(true);renderPanelCard();}

/* --- pudełko --- */
function regen(){
  if(!S.box){S.dims={};S.clash={};S.bpaths=[];S.polys={};S.plus=[];S.labels=[];S.frames={};S.free.forEach(function(p){delete p.pin;});compose();return;}
  S.box.P.t=thk();var r=buildBox(S.box),o=S.box.off||(S.box.off={x:0,y:0});
  r.paths.forEach(function(p){movePath(p,o.x,o.y);p.id=S.nid++;});
  Object.keys(r.polys).forEach(function(k){r.polys[k].forEach(function(q){q.x+=o.x;q.y+=o.y;});});
  r.plus.forEach(function(q){q.x+=o.x;q.y+=o.y;});r.labels.forEach(function(q){q.x+=o.x;q.y+=o.y;});
  Object.keys(r.frames).forEach(function(k){var f=r.frames[k];f.pos+=o.x*Math.abs(f.nx)+o.y*Math.abs(f.ny);});
  S.dims=r.dims;S.bpaths=r.paths;S.polys=r.polys;S.plus=r.plus;S.labels=r.labels;S.frames=r.frames;
  S.clash=r.clash;S.name='pudełko '+S.box.P.S+'×'+S.box.P.W+'×'+S.box.P.G;compose();applyPins();
}
/* kształt narysowany na ściance jest do niej przypięty: pamięta położenie środka w proporcjach ścianki i jedzie za nią przy zmianie wymiarów */
function polyUV(pg,x,y){var o=pg[0],ax=pg[1].x-o.x,ay=pg[1].y-o.y,bx=pg[3].x-o.x,by=pg[3].y-o.y,det=ax*by-ay*bx;if(Math.abs(det)<1e-9)return null;var dx=x-o.x,dy=y-o.y;return {u:(dx*by-dy*bx)/det,v:(ax*dy-ay*dx)/det};}
function polyXY(pg,u,v){var o=pg[0];return {x:o.x+u*(pg[1].x-o.x)+v*(pg[3].x-o.x),y:o.y+u*(pg[1].y-o.y)+v*(pg[3].y-o.y)};}
function wallAt(w){var hit=null,ar=Infinity;Object.keys(S.polys).forEach(function(id){var pn=panel(+id);if(!pn||pn.kind!=='wall')return;var pg=S.polys[id];if(pointInPoly(pg,w.x,w.y)){var b=bboxOf([{pts:pg,closed:true}]),a=b.w*b.h||1;if(a<ar){ar=a;hit=+id;}}});return hit;}
function updatePins(list){list.forEach(function(p){delete p.pin;if(!S.box)return;var b=bboxOf([p]),c={x:b.x+b.w/2,y:b.y+b.h/2},id=wallAt(c);if(id==null)return;var uv=polyUV(S.polys[id],c.x,c.y);if(uv)p.pin={id:id,u:uv.u,v:uv.v};});}
function applyPins(){S.free.forEach(function(p){if(!p.pin)return;var pg=S.polys[p.pin.id];if(!pg){delete p.pin;return;}var b=bboxOf([p]),t=polyXY(pg,p.pin.u,p.pin.v);movePath(p,t.x-(b.x+b.w/2),t.y-(b.y+b.h/2));});}
/* wzorzec wyrównania: drugi klik w zaznaczony element (albo ściankę) — reszta równa się do niego */
function keyOk(){var k=S.key;if(!k)return null;if(k.t==='p'?!S.sel.has(k.id):S.selP!==k.id){S.key=null;return null;}return k;}
function alignRef(sel){var k=keyOk();
  if(k&&k.t==='p'){var kp=byId(k.id);if(kp)return {box:bboxOf([kp]),skip:k.id};}
  if(S.selP!=null&&S.polys[S.selP])return {box:bboxOf([{pts:S.polys[S.selP],closed:true}])};
  return {box:bboxOf(sel.length>1?sel:active())};}
function boxEdited(){var b=S.box;return !!b&&((b.ov&&Object.keys(b.ov).length>0)||(b.splits&&b.splits.length>0)||(b.dels&&b.dels.length>0));}
/* zaznaczony pojedynczy prostokąt (cztery proste boki, poziomo-pionowo) da się zamienić na pierwszą ściankę pudełka */
function rectSel(){if(S.sel.size!==1)return null;var p=selFree()[0];if(!p||!p.closed||p.pts.length!==4||p.pts.some(hasC))return null;var b=bboxOf([p]);
  return p.pts.every(function(q){return (Math.abs(q.x-b.x)<0.01||Math.abs(q.x-b.x-b.w)<0.01)&&(Math.abs(q.y-b.y)<0.01||Math.abs(q.y-b.y-b.h)<0.01);})&&b.w>=1&&b.h>=1?{p:p,b:b}:null;}
function selFree(){return S.free.filter(function(p){return S.sel.has(p.id);});}
function panel(id){if(!S.box)return null;for(var i=0;i<S.box.panels.length;i++)if(S.box.panels[i].id===id)return S.box.panels[i];return null;}
function setVal(id,v){var e=$(id);if(e&&document.activeElement!==e)e.value=v;}
function foldNote(){var f=S.box?S.box.P.fold||'crease':$('fold').value;$('foldNote').textContent={crease:'Karton zgina się w połowie grubości: ścianka między zgięciami = wymiar zewnętrzny − 1 × grubość. Linie idą na warstwę CREASE.',vin:'Zawias zostaje na zewnętrznej warstwie: ścianka między zgięciami = wymiar zewnętrzny. Linie idą na warstwę VCUT. Arkusz tniesz stroną wewnętrzną do góry.',vout:'Zawias zostaje na wewnętrznej warstwie: ścianka = wymiar zewnętrzny − 2 × grubość. Linie idą na warstwę KISSCUT.'}[f];}
function syncBox(){if(!S.box)return;$('fold').value=S.box.P.fold||'crease';foldNote();setVal('bS',S.box.P.S);setVal('bW',S.box.P.W);setVal('bG',S.box.P.G);}
function newBox(tpl){var P=S.box?S.box.P:{S:60,W:100,G:40,t:thk(),fold:$('fold').value},off=S.box?S.box.off:{x:0,y:0};S.box={P:P,panels:boxTemplate(tpl),off:off,ov:{},splits:[],dels:[]};S.selP=null;regen();syncBox();}
function exprOf(p,k){return k==='ext'?p.ext:p[k];}
function jointBase(p){var par=panel(p.parent);if(par.parent==null)return (p.edge==='t'||p.edge==='b')?par.w.base:par.h.base;return p.edge==='o'?jointBase(par):par.ext.base;}
function basesOf(p){return p.parent==null?[p.w.base,p.h.base]:[jointBase(p),p.ext.base];}
function defExt(kind,par,at){if(kind==='tab')return {base:'num',val:3,kt:1};if(kind==='glue'||kind==='tuck')return {base:'auto',kt:0};if(kind==='dust')return {base:'G',mul:0.5,kt:0};if(kind==='snapF')return {base:'G',mul:0.4,kt:0};if(kind==='snapB')return {base:'G',mul:0.667,kt:0};
  /* nowa ścianka: najpierw wymiar sąsiada z tego samego rzędu, potem ten wymiar pudełka, którego brakuje ściance obok */
  if(at){var q=null;S.plus.forEach(function(x){if(x.id===at.id&&x.edge===at.edge)q=x;});
    if(q){var pos=q.x*Math.abs(q.nx)+q.y*Math.abs(q.ny),twin=null;
      S.box.panels.forEach(function(o){var f=S.frames[o.id];if(!twin&&f&&o.kind==='wall'&&Math.abs(f.nx-q.nx)<1e-6&&Math.abs(f.ny-q.ny)<1e-6&&Math.abs(f.pos-pos)<0.01)twin=o;});
      if(twin)return JSON.parse(JSON.stringify(twin.ext));}}
  var have=par?basesOf(par):[],miss=['S','W','G'].filter(function(b){return have.indexOf(b)<0;});
  return {base:miss.length===1?miss[0]:'G',kt:0};}
function dimRow(p,k,label){var e=exprOf(p,k),v=e.base==='num'?e.val:e.base==='auto'?dimOf(p,k):S.box.P[e.base]*(e.mul||1);
  return '<div class="f"><span class="f__label">'+label+'<span class="pv" id="pv-'+k+'"></span></span><div class="grid2"><select data-k="'+k+'" id="pb-'+k+'" aria-label="Skąd wymiar">'+Object.keys(BASE).filter(function(b){return b!=='auto'||p.kind==='tuck'||p.kind==='glue';}).map(function(b){return '<option value="'+b+'"'+(b===e.base?' selected':'')+'>'+BASE[b]+'</option>';}).join('')+
    '</select><input type="number" step="0.5" min="1" data-k="'+k+'" id="pn-'+k+'" value="'+(Math.round(v*100)/100)+'" aria-label="Wymiar mm"></div><div class="chips" data-k="'+k+'">'+[-2,-1,0,1,2].map(function(n){return '<button type="button" data-kt="'+n+'" aria-pressed="'+((e.kt||0)===n)+'">'+(n>0?'+':'')+(n?n+' × grubość':'bez poprawki')+'</button>';}).join('')+'</div></div>';}
function renderPanelCard(){
  var box=$('pcard');if(!S.box)return;var p=S.ctx==='obj'&&S.selP!=null?panel(S.selP):null;
  if(!p){box.innerHTML='<p class="note">Kliknij ściankę, żeby zmienić jej wymiar. Plus przy krawędzi dodaje ściankę albo klejenie.</p>';$('subWall').textContent='';return;}
  var h='';
  if(p.parent==null)h+=dimRow(p,'w','Szerokość ścianki')+dimRow(p,'h','Wysokość ścianki');
  else{h+='<div class="f"><span class="f__label">Rodzaj</span><div class="chips" id="kinds">'+Object.keys(KIND).map(function(k){return '<button type="button" data-setkind="'+k+'" aria-pressed="'+(p.kind===k)+'">'+KIND[k]+'</button>';}).join('')+'</div></div>';
    h+=dimRow(p,'ext',p.kind==='wall'?'Wymiar ścianki':'Szerokość');
    if(p.kind==='wall'){var un=p.under||0;h+='<div class="f"><span class="f__label">Wolne boki pod wieczkiem</span><div class="chips">'+[0,1,2].map(function(n){return '<button type="button" data-under="'+n+'" aria-pressed="'+(un===n)+'">'+(n?n+(n>1?' warstwy':' warstwa'):'równo z bigiem')+'</button>';}).join('')+'</div><span class="f__hint">Obniża wolne boki tej ścianki, żeby wieczko leżało na nich płasko.</span></div>';}
    if(p.kind==='wall'){var nt=(p.notch||[]).slice().sort().join('');h+='<div class="f"><span class="f__label">Wycięcie na palec</span><div class="chips">'+[['','brak'],['a','bok 1'],['b','bok 2'],['ab','oba boki']].map(function(o){return '<button type="button" data-notch="'+o[0]+'" aria-pressed="'+(nt===o[0])+'">'+o[1]+'</button>';}).join('')+'</div><span class="f__hint">Półokrągłe wycięcie na wolnej krawędzi, tam gdzie wchodzi zakładka.</span></div>';}
    if(p.kind==='tuck'){var lk=p.lock||0,rd=p.rad!=null?p.rad:4;
      h+='<div class="f"><span class="f__label">Zamknięcie</span><div class="chips">'+[[0,'na tarcie'],[4,'zamek 4 mm'],[8,'zamek 8 mm'],[10,'zamek 10 mm']].map(function(o){return '<button type="button" data-lock="'+o[0]+'" aria-pressed="'+(lk===o[0])+'">'+o[1]+'</button>';}).join('')+'</div><span class="f__hint">Zamek to nacięcia na końcach bigu, za które zaczepiają się klapki boczne.</span></div>';
      h+='<div class="f"><span class="f__label">Promień rogów</span><div class="chips">'+[4,8,12].map(function(n){return '<button type="button" data-rad="'+n+'" aria-pressed="'+(rd===n)+'">'+n+' mm</button>';}).join('')+'</div></div>';}
    if(p.kind==='dust'){var shp=p.shape||'trap';h+='<div class="f"><span class="f__label">Kształt</span><div class="chips"><button type="button" data-shape="shoulder" aria-pressed="'+(shp==='shoulder')+'">z barkiem</button><button type="button" data-shape="trap" aria-pressed="'+(shp==='trap')+'">trapez</button>'+(shp==='shoulder'?'<button type="button" data-flip="1" aria-pressed="'+(!!p.flip)+'">odwróć strony</button>':'')+'</div><span class="f__hint">Prosty bok klapki z barkiem ma być od strony wieczka.</span></div>';}
    if(p.kind!=='wall'&&p.kind!=='tab'){var gk=p.gap&&p.gap.kt!=null?p.gap.kt:1;h+='<div class="f"><span class="f__label">Odstęp od krawędzi<span class="pv">= '+n1(gk*S.box.P.t)+' mm</span></span><div class="chips">'+[0,1,2,3].map(function(n){return '<button type="button" data-gap="'+n+'" aria-pressed="'+(gk===n)+'">'+(n?n+' × grubość':'bez odstępu')+'</button>';}).join('')+'</div></div>';}
    if(p.kind!=='wall'&&p.kind!=='tab'){var sk=p.sink&&p.sink.kt!=null?p.sink.kt:(p.kind==='dust'?1:0);h+='<div class="f"><span class="f__label">Cofnięcie bigu<span class="pv">= '+n1(sk*S.box.P.t)+' mm</span></span><div class="chips">'+[0,1,2].map(function(n){return '<button type="button" data-sink="'+n+'" aria-pressed="'+(sk===n)+'">'+(n?n+' × grubość':'w linii ścianki')+'</button>';}).join('')+'</div><span class="f__hint">Dla klapki, która po złożeniu leży pod inną warstwą.</span></div>';}
    h+='<button class="btn is--danger" type="button" id="pDel">Usuń '+(p.kind==='wall'?'ściankę i wszystko za nią':'ten element')+'</button>';}
  box.innerHTML=h;$('subWall').textContent=p.parent==null?'pierwsza':KIND[p.kind].toLowerCase();updatePv();
}
function dimOf(p,k){var d=S.dims[p.id]||{};return d[k]||0;}
function updatePv(){var p=S.selP!=null?panel(S.selP):null;if(!p)return;(p.parent==null?['w','h']:['ext']).forEach(function(k){var el=$('pv-'+k);if(!el)return;var e=exprOf(p,k),v=dimOf(p,k),P=S.box.P,t='';
  if(e.base!=='num'&&e.base!=='auto'){var raw=P[e.base]*(e.mul||1),kt=(e.kt||0)*P.t,fd=raw+kt-v;t=n1(raw)+(fd>0.001?' − '+n1(fd)+' zgięcia':'')+(kt?(kt>0?' + ':' − ')+n1(Math.abs(kt))+' poprawka':'')+' ';}
  el.textContent=t+'= '+n1(v)+' mm';});}
function boxChanged(full){regen();refresh();if(full)renderPanelCard();else updatePv();}
function startEdit(){if(!editing){editing=true;pushUndo();}}
document.querySelector('.panel').addEventListener('focusout',function(){editing=false;if(S.hot){S.hot=null;render();}});
$('pcard').addEventListener('input',function(e){var t=e.target;if(t.tagName!=='INPUT')return;var p=panel(S.selP),v=parseFloat(t.value);if(!p||!(v>=1))return;startEdit();
  var ex=exprOf(p,t.dataset.k);ex.base='num';ex.val=v;ex.kt=0;delete ex.mul;$('pb-'+t.dataset.k).value='num';
  t.closest('.f').querySelectorAll('[data-kt]').forEach(function(c){c.setAttribute('aria-pressed',c.dataset.kt==='0');});boxChanged(false);});
$('pcard').addEventListener('change',function(e){var t=e.target;if(t.tagName!=='SELECT')return;var p=panel(S.selP);if(!p)return;pushUndo();var ex=exprOf(p,t.dataset.k);
  if(t.value==='num'){ex.val=Math.round(dimOf(p,t.dataset.k)*100)/100;ex.kt=0;}ex.base=t.value;delete ex.mul;boxChanged(true);});
$('pcard').addEventListener('click',function(e){var p=S.selP!=null?panel(S.selP):null;if(!p)return;var b=e.target.closest('button');if(!b)return;
  if(b.dataset.notch!==undefined){pushUndo();p.notch=b.dataset.notch.split('');boxChanged(true);}
  else if(b.dataset.rad!==undefined){pushUndo();p.rad=+b.dataset.rad;boxChanged(true);}
  else if(b.dataset.shape){pushUndo();p.shape=b.dataset.shape;boxChanged(true);}
  else if(b.dataset.flip){pushUndo();p.flip=!p.flip;boxChanged(true);}
  else if(b.dataset.under!==undefined){pushUndo();p.under=+b.dataset.under;boxChanged(true);}
  else if(b.dataset.lock!==undefined){pushUndo();p.lock=+b.dataset.lock;boxChanged(true);}
  else if(b.dataset.sink!==undefined){pushUndo();p.sink={kt:+b.dataset.sink};boxChanged(true);}
  else if(b.dataset.gap!==undefined){pushUndo();p.gap={kt:+b.dataset.gap};boxChanged(true);}
  else if(b.dataset.kt!==undefined){pushUndo();exprOf(p,b.parentNode.dataset.k).kt=+b.dataset.kt;boxChanged(true);}
  else if(b.dataset.setkind){var k=b.dataset.setkind;if(k===p.kind)return;pushUndo();if(k!=='wall')removeKids(p.id);p.kind=k;p.ext=defExt(k,panel(p.parent),null);boxChanged(true);}
  else if(b.id==='pDel')delPanel();});
function removeKids(id){var gone={},again=true;while(again){again=false;S.box.panels.forEach(function(q){if(q.parent!=null&&(q.parent===id||gone[q.parent])&&!gone[q.id]){gone[q.id]=1;again=true;}});}
  S.box.panels=S.box.panels.filter(function(q){return !gone[q.id];});}
function delPanel(){var p=S.selP!=null?panel(S.selP):null;if(!p){toast('Najpierw kliknij ściankę.');return;}if(p.parent==null){toast('Pierwszej ścianki nie da się usunąć. Żeby usunąć całe pudełko, zaznacz je ramką i naciśnij Delete.');return;}
  pushUndo();removeKids(p.id);S.box.panels=S.box.panels.filter(function(q){return q.id!==p.id;});S.selP=null;boxChanged(true);}
var menuAt=null,menu=$('menu');
function closeMenu(){menu.style.display='none';menuAt=null;}
menu.innerHTML='<span class="menu__label">Dodaj przy tej krawędzi</span>'+MENU.map(function(it,i){return '<div class="menu__item"><button type="button" data-mi="'+i+'">'+it.l+(it.sub?'<small>›</small>':it.n?'<small>'+it.n+'</small>':'')+'</button>'+
  (it.sub?'<div class="menu__sub"><span class="menu__label">'+it.l+'</span>'+it.sub.map(function(sb,j){return '<button type="button" data-mi="'+i+'" data-si="'+j+'">'+sb.l+'</button>';}).join('')+'</div>':'')+'</div>';}).join('');
menu.addEventListener('click',function(e){var b=e.target.closest('[data-mi]');if(!b||!menuAt)return;var it=MENU[+b.dataset.mi],sb=it.sub?it.sub[b.dataset.si!==undefined?+b.dataset.si:0]:null,kind=(sb&&sb.k)||it.k,o=(sb&&sb.o)||{};
  pushUndo();var id=1;S.box.panels.forEach(function(q){id=Math.max(id,q.id+1);});
  var np={id:id,kind:kind,parent:menuAt.id,edge:menuAt.edge,ext:o.ext?JSON.parse(JSON.stringify(o.ext)):defExt(kind,panel(menuAt.id),menuAt)};
  Object.keys(o).forEach(function(k){if(k!=='ext')np[k]=JSON.parse(JSON.stringify(o[k]));});
  S.box.panels.push(np);S.selP=id;closeMenu();boxChanged(true);});
window.addEventListener('pointerdown',function(e){if(menuAt&&!e.target.closest('#menu')&&!e.target.closest('[data-plus]'))closeMenu();},true);
['bS','bW','bG'].forEach(function(id){$(id).addEventListener('input',function(){var v=parseFloat($(id).value);if(!(v>=1)||!S.box)return;startEdit();var key=id.charAt(1),old=S.box.P[key];
  if((shift||$('bLock').checked)&&old>0){var f=v/old;['S','W','G'].forEach(function(k){if(k!==key)S.box.P[k]=Math.max(1,Math.round(S.box.P[k]*f*10)/10);});syncBox();}
  S.box.P[key]=v;boxChanged(false);});});
$('tpl').addEventListener('click',function(e){var t=e.target.dataset.tpl;if(!t)return;pushUndo();newBox(t);refresh();renderPanelCard();fitView();});
$('bNew').addEventListener('click',function(){pushUndo();S.free=[];S.box=null;leave(true);S.sel.clear();S.boxSel=false;newBox('tuck');refresh(true);renderPanelCard();fitView();});
$('bFlat').addEventListener('click',function(){if(!S.box)return;pushUndo();leave(true);flatten();refresh(true);renderPanelCard();
  toast('Pudełko jest teraz zwykłymi liniami. Wymiary już go nie przeliczają.');});

/* --- poziomy: obiekty / ścianki / punkty --- */
function leave(quiet){S.ctx='obj';S.nsel.clear();S.edit.clear();S.editBox=false;closeMenu();if(!quiet){refresh();renderPanelCard();}}
function flatten(){S.bpaths.forEach(function(p){p.id=S.nid++;S.free.push(p);});var ids=S.bpaths.map(function(p){return p.id;});S.box=null;S.boxSel=false;S.selP=null;S.name='wykrojnik';regen();return ids;}
/* głębszy poziom = punkty. Pudełko zostaje pudełkiem: przesunięcia jego punktów zapisuję osobno i nakładam po każdym przeliczeniu wymiarów. */
function enter(){
  if(S.view!=='die')return;
  var bx=!!S.box&&(S.boxSel||S.selP!=null);
  if(S.sel.size||bx){S.ctx='nodes';S.edit=new Set(S.sel);S.editBox=bx;S.nsel.clear();S.selP=null;S.boxSel=false;refresh();renderPanelCard();return;}
  toast('Najpierw zaznacz ściankę albo linię.');
}

/* --- podgląd --- */
function toWorld(e){var r=svg.getBoundingClientRect();return {x:(e.clientX-r.left-S.tx)/S.z,y:(e.clientY-r.top-S.ty)/S.z};}
function contentBox(){if(S.view==='sheet'){var c=cfg();return {x:0,y:0,w:c.W,h:c.H};}return bboxOf(S.paths)||{x:0,y:0,w:200,h:150};}
function fitView(){var r=svg.getBoundingClientRect(),b=contentBox(),pad=64;if(!r.width)return;
  S.z=Math.max(0.05,Math.min((r.width-2*pad)/Math.max(b.w,1),(r.height-2*pad-40)/Math.max(b.h,1)));
  S.tx=(r.width-b.w*S.z)/2-b.x*S.z;S.ty=(r.height-40-b.h*S.z)/2-b.y*S.z;render();}
function nodesOf(list){var o=[];list.forEach(function(p){p.pts.forEach(function(q,i){o.push({k:p.id+':'+i,p:p,i:i,x:q.x,y:q.y});});});return o;}
function editNodes(){var o=nodesOf(S.free.filter(function(p){return S.edit.has(p.id);}));
  if(S.editBox){var seen={};S.bpaths.forEach(function(p){p.pts.forEach(function(q){var k='B|'+q.ks[0];if(seen[k])return;seen[k]=1;o.push({k:k,x:q.x,y:q.y,ks:q.ks,box:true});});});}
  return o;}
function nodeByKey(k){var l=editNodes();for(var i=0;i<l.length;i++)if(l[i].k===k)return l[i];return null;}
function handlesOf(){var o=[];S.nsel.forEach(function(k){if(k.charAt(0)==='B')return;var a=k.split(':'),p=byId(+a[0]);if(!p)return;var i=+a[1],n=p.pts.length,q=p.pts[i];if(!q)return;
    if(hasC(q))o.push({k:k+':in',x:q.c2x,y:q.c2y,ax:q.x,ay:q.y,q:q,f:'c2'});
    if(i+1<n||p.closed){var nx=p.pts[(i+1)%n];if(nx!==q&&hasC(nx))o.push({k:k+':out',x:nx.c1x,y:nx.c1y,ax:q.x,ay:q.y,q:nx,f:'c1'});}});return o;}
function snap(w,skipSel){var best=null,lim=9/S.z;nodesOf(S.paths).forEach(function(n){if(skipSel&&S.nsel.has(n.k))return;var d=Math.hypot(n.x-w.x,n.y-w.y);if(d<lim&&(!best||d<best.d))best={d:d,x:n.x,y:n.y};});return best?{x:best.x,y:best.y}:w;}
function segName(ax,i){return ax==='x'?String.fromCharCode(65+i%26):String(i+1);}
function boxAt(w){var hit=null,ar=Infinity;Object.keys(S.polys).forEach(function(id){var pg=S.polys[id];if(pointInPoly(pg,w.x,w.y)){var b=bboxOf([{pts:pg,closed:true}]),a=b.w*b.h||1;if(a<ar){ar=a;hit=+id;}}});return hit;}

function shapeFrom(tool,a,b,e){
  var p=null,B,dx=b.x-a.x,dy=b.y-a.y;
  if(tool==='line'){var t=e.shiftKey?constrain(a,b):b;return {closed:false,pts:[{x:a.x,y:a.y},{x:t.x,y:t.y}]};}
  if(tool==='poly'){var R=Math.hypot(dx,dy),a0=e.shiftKey?-Math.PI/2:Math.atan2(dy,dx),pts=[];for(var i=0;i<S.sides;i++){var an=a0+i*2*Math.PI/S.sides;pts.push({x:a.x+R*Math.cos(an),y:a.y+R*Math.sin(an)});}return {closed:true,pts:pts};}
  if(e.shiftKey){var m=Math.max(Math.abs(dx),Math.abs(dy));dx=(dx<0?-m:m);dy=(dy<0?-m:m);}
  var x0=e.altKey?a.x-dx:a.x,y0=e.altKey?a.y-dy:a.y,x1=a.x+dx,y1=a.y+dy,l=Math.min(x0,x1),t2=Math.min(y0,y1),w=Math.abs(x1-x0),h=Math.abs(y1-y0);
  if(tool==='rect')return {closed:true,pts:[{x:l,y:t2},{x:l+w,y:t2},{x:l+w,y:t2+h},{x:l,y:t2+h}]};
  var cx=l+w/2,cy=t2+h/2,rx=w/2,ry=h/2;B=builder(null);B.M(cx+rx,cy);unitArc(0,2*Math.PI).forEach(function(s){B.C(cx+rx*s[0],cy+ry*s[1],cx+rx*s[2],cy+ry*s[3],cx+rx*s[4],cy+ry*s[5]);});B.Z();
  p=B.done()[0];return p||null;
}

function render(){
  var h='';
  if(S.view==='sheet'){
    var c=cfg(),L=layoutSheet(S.paths,c);
    h+='<rect class="sheet" x="0" y="0" width="'+c.W+'" height="'+c.H+'"/><rect class="area" x="'+c.m+'" y="'+c.m+'" width="'+Math.max(0,c.W-2*c.m)+'" height="'+Math.max(0,c.H-2*c.m)+'"/>';
    markList(c).forEach(function(m){h+='<circle class="mark" cx="'+m.x+'" cy="'+m.y+'" r="'+m.r+'"/>';});
    if(L){h+='<defs><g id="die">';S.paths.forEach(function(p){if(p.type!=='ignore')h+='<path class="p t-'+p.type+'" d="'+pathD(p)+'"/>';});h+='</g></defs>';
      L.cells.forEach(function(q){h+='<use href="#die" transform="translate('+fmt(q.x)+' '+fmt(q.y)+')'+(L.rot?' translate('+fmt(L.b.h)+' 0) rotate(90)':'')+' translate('+fmt(-L.b.x)+' '+fmt(-L.b.y)+')"/>';});}
  }else{
    var kk=keyOk(),sp=S.ctx==='obj'&&S.selP!=null?S.polys[S.selP]:null;if(sp)h+='<path class="psel'+(kk&&kk.t==='w'?' key':'')+'" d="M'+sp.map(function(q){return fmt(q.x)+' '+fmt(q.y);}).join('L')+'Z"/>';
    Object.keys(S.clash).forEach(function(id){var cp=S.polys[id];if(cp)h+='<path class="pclash" d="M'+cp.map(function(q){return fmt(q.x)+' '+fmt(q.y);}).join('L')+'Z"/>';});
    S.bpaths.forEach(function(p){h+='<path class="p t-'+p.type+(S.ctx==='nodes'&&!S.editBox?' dimmed':'')+'" d="'+pathD(p)+'"/>';});
    S.free.forEach(function(p){var d=pathD(p),on=S.ctx==='nodes'?S.edit.has(p.id):S.sel.has(p.id);h+='<path class="hit'+(on?' on':'')+(kk&&kk.t==='p'&&kk.id===p.id&&S.ctx==='obj'?' key':'')+'" data-id="'+p.id+'" d="'+d+'"/><path class="p t-'+p.type+'" d="'+d+'"/>';});
  }
  world.innerHTML=h;world.setAttribute('transform','matrix('+S.z+' 0 0 '+S.z+' '+S.tx+' '+S.ty+')');
  renderOverlay();
}
function renderOverlay(){
  var h='',sx=function(x){return x*S.z+S.tx;},sy=function(y){return y*S.z+S.ty;},i;
  if(S.view==='die'){
    if(S.box){
      S.labels.forEach(function(l){if(Math.min(l.a,l.b)*S.z>26&&Math.max(l.a,l.b)*S.z>70)h+='<text class="lab'+(S.ctx==='obj'&&l.id===S.selP?' on':'')+'" text-anchor="middle" x="'+sx(l.x)+'" y="'+(sy(l.y)+4)+'">'+n1(l.a)+' × '+n1(l.b)+'</text>';});
      if(S.ctx==='obj'&&S.tool==='select')S.plus.forEach(function(q){var x=sx(q.x)+q.nx*16,y=sy(q.y)+q.ny*16;h+='<g class="plus" data-plus="'+q.id+':'+q.edge+'"><circle cx="'+x+'" cy="'+y+'" r="8"/><path d="M'+(x-4)+' '+y+'h8M'+x+' '+(y-4)+'v8"/></g>';});
      if(S.ctx==='obj'&&S.boxSel&&S.selP==null){var bb=bboxOf(S.bpaths);if(bb)h+='<rect class="bsel" x="'+(sx(bb.x)-5)+'" y="'+(sy(bb.y)-5)+'" width="'+(bb.w*S.z+10)+'" height="'+(bb.h*S.z+10)+'"/>';}
    }else{
      var b=bboxOf(active());
      if(b){var cx=axisCuts(S.paths,'x'),cy=axisCuts(S.paths,'y'),ty=sy(b.y)-14,tx=sx(b.x)-14;
        for(i=0;i<cx.length;i++)h+='<line class="tick" x1="'+sx(cx[i])+'" x2="'+sx(cx[i])+'" y1="'+(ty-2)+'" y2="'+(ty+6)+'"/>';
        for(i=0;i+1<cx.length;i++)if((cx[i+1]-cx[i])*S.z>34)h+='<text class="dim'+(S.hot==='x'+i?' hot':'')+'" text-anchor="middle" x="'+sx((cx[i]+cx[i+1])/2)+'" y="'+(ty-6)+'">'+segName('x',i)+' '+n1(cx[i+1]-cx[i])+'</text>';
        for(i=0;i<cy.length;i++)h+='<line class="tick" y1="'+sy(cy[i])+'" y2="'+sy(cy[i])+'" x1="'+(tx-2)+'" x2="'+(tx+6)+'"/>';
        for(i=0;i+1<cy.length;i++)if((cy[i+1]-cy[i])*S.z>34)h+='<text class="dim'+(S.hot==='y'+i?' hot':'')+'" text-anchor="middle" transform="translate('+(tx-6)+' '+sy((cy[i]+cy[i+1])/2)+') rotate(-90)">'+segName('y',i)+' '+n1(cy[i+1]-cy[i])+'</text>';}
    }
    if(S.ctx==='nodes'){
      handlesOf().forEach(function(hd){h+='<line class="hl" x1="'+sx(hd.ax)+'" y1="'+sy(hd.ay)+'" x2="'+sx(hd.x)+'" y2="'+sy(hd.y)+'"/><circle class="hd" data-h="'+hd.k+'" cx="'+sx(hd.x)+'" cy="'+sy(hd.y)+'" r="4"/>';});
      editNodes().forEach(function(n){h+='<rect class="nd'+(S.nsel.has(n.k)?' on':'')+'" data-n="'+esc(n.k)+'" x="'+(sx(n.x)-3.5)+'" y="'+(sy(n.y)-3.5)+'" width="7" height="7"/>';});}
    if(S.ctx==='obj'&&S.tool==='select'&&S.sel.size&&!(drag&&drag.k==='marq')){var xb=bboxOf(selFree());
      if(xb){var X0=sx(xb.x),Y0=sy(xb.y),X1=sx(xb.x+xb.w),Y1=sy(xb.y+xb.h),XM=(X0+X1)/2,YM=(Y0+Y1)/2;
        h+='<rect class="xfbox" x="'+X0+'" y="'+Y0+'" width="'+(X1-X0)+'" height="'+(Y1-Y0)+'"/><line class="xfbox" x1="'+XM+'" y1="'+Y0+'" x2="'+XM+'" y2="'+(Y0-22)+'"/><circle class="th" data-t="rot" cx="'+XM+'" cy="'+(Y0-22)+'" r="4.5"/>';
        [['nw',X0,Y0],['n',XM,Y0],['ne',X1,Y0],['e',X1,YM],['se',X1,Y1],['s',XM,Y1],['sw',X0,Y1],['w',X0,YM]].forEach(function(t){h+='<rect class="th" data-t="'+t[0]+'" x="'+(t[1]-4)+'" y="'+(t[2]-4)+'" width="8" height="8"/>';});}}
  }
  if(drag&&drag.k==='xf'&&drag.moved){var xb2=bboxOf(selFree());if(xb2)h+='<text class="measT" x="'+(sx(xb2.x+xb2.w)+12)+'" y="'+(sy(xb2.y+xb2.h)+18)+'">'+n1(xb2.w)+' × '+n1(xb2.h)+' mm</text>';}
  if(drag&&drag.k==='draw'&&drag.shape){var sh=mapPath(drag.shape,function(x,y){return [sx(x),sy(y)];}),bb2=bboxOf([drag.shape]);
    h+='<path class="ghost" d="'+pathD(sh)+'"/><text class="measT" x="'+(sx(drag.b.x)+12)+'" y="'+(sy(drag.b.y)+18)+'">'+n1(bb2.w)+' × '+n1(bb2.h)+' mm</text>';}
  if(drag&&drag.k==='marq'){var x=Math.min(drag.a.x,drag.b.x),y=Math.min(drag.a.y,drag.b.y);h+='<rect class="marq" x="'+sx(x)+'" y="'+sy(y)+'" width="'+Math.abs(drag.b.x-drag.a.x)*S.z+'" height="'+Math.abs(drag.b.y-drag.a.y)*S.z+'"/>';}
  if(S.meas&&S.meas.a){var a=S.meas.a,e=S.meas.b||S.meas.h;if(e){var dx=e.x-a.x,dy=e.y-a.y;
    h+='<line class="meas" x1="'+sx(a.x)+'" y1="'+sy(a.y)+'" x2="'+sx(e.x)+'" y2="'+sy(e.y)+'"/><text class="measT" x="'+(sx(e.x)+10)+'" y="'+(sy(e.y)-10)+'">'+Math.hypot(dx,dy).toFixed(2)+' mm · poziomo '+Math.abs(dx).toFixed(2)+' · pionowo '+Math.abs(dy).toFixed(2)+'</text>';}}
  overlay.innerHTML=h;
}
function schedule(){if(!raf)raf=requestAnimationFrame(function(){raf=0;render();});}

/* --- karty: wartości na żywo --- */
var groupList=[];
function renderDims(force){
  ['x','y'].forEach(function(ax){
    var c=S.box?[]:axisCuts(S.paths,ax),box=$('dim-'+ax),n=Math.max(0,c.length-1);
    if(force||+box.dataset.n!==n){box.dataset.n=n;var h='';
      for(var i=0;i<n;i++)h+='<div class="f"><span class="f__label"><label for="d'+ax+i+'">'+segName(ax,i)+'</label><button class="link" type="button" data-add="'+ax+':'+i+'">+ grubość</button></span><input type="number" step="0.1" min="1" id="d'+ax+i+'" data-ax="'+ax+'" data-i="'+i+'"></div>';
      box.innerHTML=h||'<p class="note">Brak linii.</p>';}
    for(var k=0;k<n;k++)setVal('d'+ax+k,(Math.round((c[k+1]-c[k])*100)/100).toString());
  });
}
function show(sel,on){document.querySelectorAll(sel).forEach(function(e){e.hidden=!on;});}
function refresh(forceDims){
  render();autosave();
  var act=active(),b=bboxOf(act),len={cut:0,crease:0};
  var foldT={crease:1,vcut:1},boxFold=S.box?{crease:'crease',vin:'vcut',vout:'kiss'}[S.box.P.fold||'crease']:'';
  act.forEach(function(p){var l=pathLength(p);if(p.type==='cut')len.cut+=l;else if(foldT[p.type]||(p.type===boxFold&&S.bpaths.indexOf(p)>=0))len.crease+=l;});
  var c=cfg(),L=layoutSheet(S.paths,c),dimT=b?n1(b.w)+' × '+n1(b.h)+' mm':'–',impT=L?L.count+' szt.':'–';
  $('status').innerHTML=b?'<b>'+esc(S.name)+'</b> · '+dimT+' · cięcie '+(len.cut/1000).toFixed(2).replace('.',',')+' m · zgięcia '+(len.crease/1000).toFixed(2).replace('.',',')+' m · arkusz '+impT+(Object.keys(S.clash).length?' · <b class="warn">ścianki nachodzą na siebie</b>':''):'Pusty dokument. Narysuj coś, wczytaj plik albo zacznij nowe pudełko.';
  $('subPlik').textContent=S.name;$('subMat').textContent=thk().toString().replace('.',',')+' mm';if(S.box)$('subBox').textContent=S.box.P.S+' × '+S.box.P.W+' × '+S.box.P.G;
  $('subWym').textContent=dimT;$('subArk').textContent=L?impT+' · '+Math.round(L.util*100)+'%':'–';
  $('impBig').textContent=L&&L.count?L.count+' szt. · '+L.uc+' × '+L.ur+(L.rot?' · obrót 90°':'')+' · '+Math.round(L.util*100)+'% arkusza':b?'Nie mieści się na arkuszu':'–';
  if(b){setVal('scW',(Math.round(b.w*10)/10).toString());setVal('scH',(Math.round(b.h*10)/10).toString());}
  show('[data-card=box],[data-card=wall],#bFlat',!!S.box);show('[data-card=plik],[data-card=wymiary]',!S.box&&S.free.length>0);show('[data-card=linie],#bJoin',S.free.length>0);
  show('#align',S.ctx==='obj'&&S.sel.size>0);show('#bCurve',S.ctx==='nodes'&&S.edit.size>0);show('#bOv',boxEdited());show('#bWall',!S.box&&S.ctx==='obj'&&!!rectSel());show('#sidesBox',S.tool==='poly');
  renderDims(forceDims);
  var map={};groupList=[];
  S.free.forEach(function(p){var g=map[p.src];if(!g){g=map[p.src]={src:p.src,n:0,types:{}};groupList.push(g);}g.n++;g.types[p.type]=1;});
  var sig=groupList.map(function(g){return g.src+g.n+Object.keys(g.types).join();}).join('|');
  if(sig!==refresh.sig){refresh.sig=sig;
    $('groups').innerHTML=groupList.map(function(g,i){var ts=Object.keys(g.types),cur=ts.length===1?ts[0]:'',m=/#[0-9a-f]{6}/i.exec(g.src);
      return '<div class="grp"><i style="background:'+(m?m[0]:'transparent')+'"></i><span title="'+esc(g.src)+'">'+esc(g.src==='narysowane'?'Narysowane':m?'Kolor '+g.src:'Warstwa '+g.src)+'</span><em>'+g.n+'</em><select id="grp'+i+'" data-g="'+i+'" aria-label="Rodzaj linii">'+(cur?'':'<option value="">różne</option>')+
        Object.keys(LBL).map(function(t){return '<option value="'+t+'"'+(t===cur?' selected':'')+'>'+LBL[t]+'</option>';}).join('')+'</select></div>';}).join('');}
  $('subLinie').textContent=S.free.length+' linii';
  var sheet=S.view==='sheet';
  $('subZapis').textContent=sheet?'arkusz':'pojedynczy';
  $('saveNote').textContent=sheet?'Zapisuję cały arkusz ('+impT+'). Zwiń Impozycję, żeby zapisać pojedynczy wykrojnik.':'Zapisuję pojedynczy wykrojnik. Rozwiń Impozycję, żeby zapisać cały arkusz.';
  $('crumb').innerHTML=sheet?'<b>Arkusz</b>':S.ctx==='nodes'?'<button class="link" type="button" id="crumbUp">Wykrojnik</button> › <b>Punkty</b> <span>Esc wraca</span>':'<b>Wykrojnik</b>';
  info.sel=S.ctx==='nodes'?(S.nsel.size?'punkty: '+S.nsel.size:''):S.ctx==='obj'?[S.selP!=null?'ścianka':S.boxSel?'pudełko':'',S.sel.size?'linie: '+S.sel.size+(selFree().some(function(p){return p.pin;})?' (przypięte do ścianki)':''):'',keyOk()?'wzorzec: '+(S.key.t==='w'?'ścianka':'linia'):''].filter(Boolean).join(' + '):'';showInfo();
}
var info={pos:'',sel:''};
function showInfo(){var hint=S.view==='sheet'?'przeciągnij, żeby przesunąć widok':DRAW[S.tool]?'przeciągnij · Shift równo · Alt od środka':S.tool==='measure'?'kliknij dwa punkty':S.tool==='pan'?'przeciągnij widok':
    S.ctx==='nodes'?(S.editBox?'przeciągnij punkt · dwuklik na linii dodaje · Delete usuwa':'ramka zaznacza · dwuklik na linii dodaje punkt'):S.sel.size+(S.selP!=null?1:0)>1?'kliknij zaznaczony jeszcze raz, żeby równać do niego':S.box?'kliknij ściankę · plus dodaje · Enter otwiera punkty':'Enter albo dwuklik otwiera punkty';
  $('info').textContent=[info.sel,info.pos,hint].filter(Boolean).join('  ·  ');}
$('crumb').addEventListener('click',function(e){if(e.target.id==='crumbUp')leave();});

/* --- karty: zwijanie --- */
function setView(v){if(S.view===v)return;S.view=v;S.meas=null;closeMenu();if(v==='sheet')leave(true);refresh();renderPanelCard();fitView();}
document.querySelector('.panel').addEventListener('click',function(e){
  var t=e.target.closest('.card__title');if(!t)return;var c=t.parentNode,open=c.classList.toggle('is--open');
  t.querySelector('.card__chev').textContent=open?'▾':'▸';
  if(c.dataset.card==='arkusz')setView(open?'sheet':'die');
});

/* --- linie --- */
$('typeBtns').innerHTML=Object.keys(LBL).map(function(t){return '<button type="button" data-type="'+t+'"><i style="background:var(--'+t+')"></i>'+LBL[t]+'</button>';}).join('');
$('typeBtns').addEventListener('click',function(e){var b=e.target.closest('[data-type]');if(!b)return;var ids=S.ctx==='nodes'?S.edit:S.sel;if(!ids.size){toast('Najpierw kliknij linię na podglądzie.');return;}
  pushUndo();S.free.forEach(function(p){if(ids.has(p.id))p.type=b.dataset.type;});refresh(true);});
$('groups').addEventListener('change',function(e){var g=groupList[e.target.dataset.g];if(!g||!e.target.value)return;pushUndo();S.free.forEach(function(p){if(p.src===g.src)p.type=e.target.value;});refresh(true);});

/* --- odcinki między bigami (pliki bez pudełka) --- */
function resize(ax,i,d){
  var c=axisCuts(S.paths,ax);if(i+1>=c.length||Math.abs(d)<1e-6)return;
  if(c[i+1]-c[i]+d<1)return;
  if(c.length===2){S.free=scaleAxis(S.free,ax,c[0],(c[1]-c[0]+d)/(c[1]-c[0]));compose();}
  else stretchAxis(S.free,ax,c[i],c[i+1],d);
  S.nsel.clear();
}
['dim-x','dim-y'].forEach(function(id){
  $(id).addEventListener('input',function(e){var t=e.target,ax=t.dataset.ax,i=+t.dataset.i,v=parseFloat(t.value);if(!ax||!(v>=1))return;
    var c=axisCuts(S.paths,ax);startEdit();resize(ax,i,v-(c[i+1]-c[i]));refresh();});
  $(id).addEventListener('focusin',function(e){if(e.target.dataset.ax){S.hot=e.target.dataset.ax+e.target.dataset.i;render();}});
  $(id).addEventListener('click',function(e){var a=e.target.dataset.add;if(!a)return;var p=a.split(':');if(!(thk()>0)){toast('Ustaw grubość materiału.');return;}
    pushUndo();resize(p[0],+p[1],thk());refresh();toast(segName(p[0],+p[1])+' + '+thk().toString().replace('.',',')+' mm');});
});
function scaleTo(k){if(!(k>0)||!isFinite(k))return;var b=bboxOf(S.free);if(!b)return;startEdit();S.free=S.free.map(function(p){return mapPath(p,function(x,y){return [(x-b.x)*k,(y-b.y)*k];});});compose();S.nsel.clear();refresh();fitView();}
$('scW').addEventListener('input',function(){var b=bboxOf(active()),v=parseFloat($('scW').value);if(b&&v>=1)scaleTo(v/b.w);});
$('scH').addEventListener('input',function(){var b=bboxOf(active()),v=parseFloat($('scH').value);if(b&&v>=1)scaleTo(v/b.h);});
$('mat').innerHTML=MATS.map(function(m,i){return '<option value="'+i+'">'+esc(m[0])+'</option>';}).join('');
$('mat').value='1';$('thk').value=MATS[1][1];
$('fold').addEventListener('change',function(){if(S.box){pushUndo();S.box.P.fold=$('fold').value;boxChanged(true);}foldNote();});
$('mat').addEventListener('change',function(){$('thk').value=MATS[+$('mat').value][1];if(S.box){pushUndo();boxChanged(true);}else refresh();});
$('thk').addEventListener('input',function(){if(S.box){startEdit();boxChanged(false);}else refresh();});
$('thk').addEventListener('change',function(){MATS[+$('mat').value][1]=thk();try{localStorage.setItem('wykr-mats',JSON.stringify(MATS));}catch(e){}});

/* --- impozycja na żywo --- */
['iW','iH','iM','iG','iMax','iMk'].forEach(function(id){$(id).addEventListener('input',function(){refresh();if(S.view==='sheet'&&(id==='iW'||id==='iH'))fitView();});});
$('corner').addEventListener('click',function(e){var r=e.target.dataset.corner;if(!r)return;S.corner=r;$('corner').querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.corner===r?'true':'false');});refresh();});
$('rot').addEventListener('click',function(e){var r=e.target.dataset.rot;if(!r)return;S.rot=r;$('rot').querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.rot===r?'true':'false');});refresh();});

/* --- edycja na podglądzie --- */
function moveSel(dx,dy){
  if(S.ctx==='nodes'){if(!S.nsel.size)return false;var bn=null;
    S.nsel.forEach(function(k){if(k.charAt(0)==='B'){bn=bn||editNodes();for(var i=0;i<bn.length;i++)if(bn[i].k===k){bn[i].ks.forEach(function(kk){var o=S.box.ov[kk]||(S.box.ov[kk]={x:0,y:0});o.x+=dx;o.y+=dy;});break;}}
      else{var a=k.split(':'),p=byId(+a[0]);if(p)moveNode(p,+a[1],dx,dy);}});
    if(bn)regen();return true;}
  if(S.ctx!=='obj')return false;var any=false;
  if(S.sel.size){S.free.forEach(function(p){if(S.sel.has(p.id))movePath(p,dx,dy);});any=true;}
  if(S.boxSel&&S.box){S.box.off.x+=dx;S.box.off.y+=dy;regen();any=true;}
  return any;
}
function del(){
  if(S.ctx==='obj'&&!S.sel.size&&S.selP!=null){delPanel();return;}
  if(S.ctx==='nodes'){if(!S.nsel.size){toast('Zaznacz punkty do usunięcia.');return;}var fk=[];S.nsel.forEach(function(k){if(k.charAt(0)!=='B')fk.push(k);});
    var bk=[];S.nsel.forEach(function(k){if(k.charAt(0)==='B'){var nd=nodeByKey(k);if(nd)bk.push(nd);}});
    if(!fk.length&&!bk.length)return;pushUndo();
    if(bk.length){S.box.splits=S.box.splits||[];S.box.dels=S.box.dels||[];bk.forEach(function(nd){var xk=null;nd.ks.forEach(function(k){if(k.charAt(0)==='x')xk=k;});
      if(xk){var sid=+xk.slice(1).split('#')[0];S.box.splits=S.box.splits.filter(function(sp){return sp.id!==sid;});delete S.box.ov[xk];}else S.box.dels.push(nd.ks[0]);});regen();}
    var by={};fk.forEach(function(k){var a=k.split(':');(by[a[0]]=by[a[0]]||[]).push(+a[1]);});
    Object.keys(by).forEach(function(id){var p=byId(+id);if(!p)return;by[id].sort(function(a,b){return b-a;}).forEach(function(i){deleteNode(p,i);});});
    S.free=S.free.filter(function(p){return p.pts.length>1;});compose();S.nsel.clear();if(!editNodes().length)leave(true);refresh(true);return;}
  if(!S.sel.size&&!S.boxSel){toast('Najpierw coś zaznacz.');return;}
  pushUndo();S.free=S.free.filter(function(p){return !S.sel.has(p.id);});S.sel.clear();if(S.boxSel&&S.selP==null){S.box=null;S.boxSel=false;S.name='wykrojnik';}regen();refresh(true);renderPanelCard();
}
$('bCurve').addEventListener('click',function(){var ks=[];S.nsel.forEach(function(k){if(k.charAt(0)!=='B')ks.push(k);});if(!ks.length){toast('Zaznacz punkt linii, którą chcesz wygiąć albo wyprostować.');return;}pushUndo();
  ks.forEach(function(k){var a=k.split(':'),p=byId(+a[0]);if(!p)return;var i=+a[1],n=p.pts.length,q=p.pts[i],pv=(i>0||p.closed)?p.pts[(i-1+n)%n]:null,nx=(i+1<n||p.closed)?p.pts[(i+1)%n]:null;
    var curved=hasC(q)||(nx&&hasC(nx));
    if(curved){if(pv)dropC(q);if(nx)dropC(nx);}
    else{if(pv&&pv!==q){q.c1x=pv.x+(q.x-pv.x)/3;q.c1y=pv.y+(q.y-pv.y)/3;q.c2x=pv.x+(q.x-pv.x)*2/3;q.c2y=pv.y+(q.y-pv.y)*2/3;}
      if(nx&&nx!==q){nx.c1x=q.x+(nx.x-q.x)/3;nx.c1y=q.y+(nx.y-q.y)/3;nx.c2x=q.x+(nx.x-q.x)*2/3;nx.c2y=q.y+(nx.y-q.y)*2/3;}}});
  refresh();});
$('bOv').addEventListener('click',function(){if(!S.box)return;pushUndo();S.box.ov={};S.box.splits=[];S.box.dels=[];S.nsel.clear();boxChanged(true);});
$('bWall').addEventListener('click',function(){var r=rectSel();if(!r||S.box)return;pushUndo();var rd=function(v){return Math.round(v*100)/100;};
  S.free=S.free.filter(function(p){return p.id!==r.p.id;});S.sel.clear();
  S.box={P:{S:rd(r.b.w),W:rd(r.b.h),G:40,t:thk(),fold:$('fold').value},panels:boxTemplate('one'),off:{x:r.b.x,y:r.b.y},ov:{},splits:[],dels:[]};S.selP=1;S.boxSel=true;
  regen();syncBox();refresh(true);renderPanelCard();toast('Prostokąt jest teraz ścianką. Plusy przy krawędziach dodają kolejne.');});
$('bDel').addEventListener('click',del);$('bUndo').addEventListener('click',undo);$('bFit').addEventListener('click',fitView);
$('bJoin').addEventListener('click',function(){var set=S.sel.size?S.free.filter(function(p){return S.sel.has(p.id);}):S.free;pushUndo();
  var r=joinPaths(set,0.05);S.free=S.free.filter(function(p){return !r.gone[p.id];});compose();S.sel.clear();leave(true);refresh(true);
  toast(r.merged?'Połączono: '+r.merged+'.':'Nie ma linii, które stykają się końcami.');});
var AL=[['l','Wyrównaj do lewej','M2 1v12M5 3h7v3H5zM5 8h4v3H5z'],['cx','Wyśrodkuj w poziomie','M7 1v12M2 3h10v3H2zM4 8h6v3H4z'],['r','Wyrównaj do prawej','M12 1v12M2 3h7v3H2zM5 8h4v3H5z'],
  ['t','Wyrównaj do góry','M1 2h12M3 5h3v7H3zM8 5h3v4H8z'],['cy','Wyśrodkuj w pionie','M1 7h12M3 2h3v10H3zM8 4h3v6H8z'],['b','Wyrównaj do dołu','M1 12h12M3 2h3v7H3zM8 5h3v4H8z'],
  ['dh','Rozłóż w poziomie z równymi odstępami','M1 1v12M13 1v12M4 4h2v6H4zM8 4h2v6H8z'],['dv','Rozłóż w pionie z równymi odstępami','M1 1h12M1 13h12M4 4h6v2H4zM4 8h6v2H4z']];
$('align').innerHTML=AL.map(function(a){return '<button type="button" data-al="'+a[0]+'" title="'+a[1]+'" aria-label="'+a[1]+'"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2"><path d="'+a[2]+'"/></svg></button>';}).join('');
$('align').addEventListener('click',function(e){var bt=e.target.closest('[data-al]');if(!bt)return;
  var sel=S.free.filter(function(p){return S.sel.has(p.id);});if(!sel.length)return;
  var m=bt.dataset.al;
  if(m==='dh'||m==='dv'){if(sel.length<3){toast('Zaznacz co najmniej trzy kształty.');return;}var ax=m==='dh'?'x':'y',sz=m==='dh'?'w':'h';
    var it=sel.map(function(p){return {p:p,b:bboxOf([p])};}).sort(function(x,y){return x.b[ax]-y.b[ax];}),first=it[0].b,last=it[it.length-1].b,sum=0;it.forEach(function(q){sum+=q.b[sz];});
    var gap=(last[ax]+last[sz]-first[ax]-sum)/(it.length-1),cur=first[ax];pushUndo();
    it.forEach(function(q){var d=cur-q.b[ax];movePath(q.p,m==='dh'?d:0,m==='dh'?0:d);cur+=q.b[sz]+gap;});updatePins(sel);refresh();return;}
  var rf=alignRef(sel),ref=rf.box;pushUndo();
  sel.forEach(function(p){if(p.id===rf.skip)return;var b=bboxOf([p]),dx=0,dy=0;
    if(m==='l')dx=ref.x-b.x;else if(m==='cx')dx=ref.x+ref.w/2-b.x-b.w/2;else if(m==='r')dx=ref.x+ref.w-b.x-b.w;
    else if(m==='t')dy=ref.y-b.y;else if(m==='cy')dy=ref.y+ref.h/2-b.y-b.h/2;else dy=ref.y+ref.h-b.y-b.h;
    movePath(p,dx,dy);});
  updatePins(sel);refresh();});

/* --- pasek narzędzi --- */
var TOOLS=[['select','Zaznacz','V','M3 2l9 5-4 1 2.5 4.5-1.6.9L6.4 9 3 12z'],['measure','Miarka','M','M2 10l8-8 4 4-8 8zM5 9l1.5 1.5M7 7l1.5 1.5M9 5l1.5 1.5'],['rect','Prostokąt','R','M2.5 3.5h11v9h-11z'],
  ['ellipse','Elipsa','O','M8 2.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z'],['line','Linia','L','M3 13L13 3'],['poly','Wielokąt','P','M8 2.5l6 10.5H2z'],['pan','Przesuwanie widoku','H','M5 8V4a1 1 0 012 0v3V3a1 1 0 012 0v4V4a1 1 0 012 0v6c0 2.5-1.5 4-4 4-2 0-3-1-4-3L3.5 9c-.5-1 .7-1.8 1.5-1z']];
$('dockTools').innerHTML=TOOLS.map(function(t){return '<button type="button" data-tool="'+t[0]+'" title="'+t[1]+' ('+t[2]+')" aria-label="'+t[1]+'" aria-pressed="false"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><path d="'+t[3]+'"/></svg></button>';}).join('');
function setTool(t){S.tool=t;$('dockTools').querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.tool===t?'true':'false');});
  svg.setAttribute('class',DRAW[t]||t==='measure'?'t-cross':t==='pan'?'t-pan':'');if(t!=='measure')S.meas=null;if(DRAW[t]&&S.ctx!=='obj')leave(true);refresh();renderPanelCard();}
$('dockTools').addEventListener('click',function(e){var b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool);});
function setSides(n){S.sides=Math.max(3,Math.min(24,n));$('sidesN').textContent=S.sides;if(drag&&drag.k==='draw'){drag.shape=shapeFrom(S.tool,drag.a,drag.b,drag.e);schedule();}}
$('sidesBox').addEventListener('click',function(e){var d=e.target.dataset.d;if(d)setSides(S.sides+ +d);});

svg.addEventListener('wheel',function(e){e.preventDefault();var r=svg.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,k=Math.exp(-e.deltaY*0.0015),z=Math.max(0.05,Math.min(400,S.z*k));
  S.tx=mx-(mx-S.tx)*z/S.z;S.ty=my-(my-S.ty)*z/S.z;S.z=z;schedule();},{passive:false});
svg.addEventListener('pointerdown',function(e){
  var t=e.target,w=toWorld(e);try{svg.setPointerCapture(e.pointerId);}catch(x){}
  if(e.button===1||space||S.tool==='pan'||S.view==='sheet'){drag={k:'pan',x:e.clientX,y:e.clientY,tx:S.tx,ty:S.ty};return;}
  if(S.tool==='measure'){var p=snap(w);if(!S.meas||S.meas.b)S.meas={a:p,b:null,h:p};else S.meas.b=p;render();return;}
  if(DRAW[S.tool]){var a=S.tool==='line'?snap(w):w;drag={k:'draw',a:a,b:a,e:{shiftKey:e.shiftKey,altKey:e.altKey},shape:null};return;}
  var pl=S.ctx==='obj'&&t.closest&&t.closest('[data-plus]');
  if(pl){var a0=pl.dataset.plus.split(':');menuAt={id:+a0[0],edge:a0[1]};menu.style.display='grid';menu.classList.toggle('is--left',e.clientX>window.innerWidth-470);menu.style.left=Math.min(e.clientX+8,window.innerWidth-230)+'px';menu.style.top=Math.max(8,Math.min(e.clientY+8,window.innerHeight-280))+'px';return;}
  if(S.ctx==='nodes'){var hk=t.dataset&&t.dataset.h;if(hk){drag={k:'hmove',h:hk,moved:false};return;}
    var k=t.dataset&&t.dataset.n;
    if(k){if(e.shiftKey){if(S.nsel.has(k))S.nsel.delete(k);else S.nsel.add(k);}else if(!S.nsel.has(k)){S.nsel.clear();S.nsel.add(k);}
      var gq=nodeByKey(k);drag={k:'nmove',grab:k,moved:false,orig:{x:gq.x,y:gq.y}};refresh();}
    else drag={k:'marq',a:w,b:w,add:e.shiftKey,nodes:true};return;}
  var th=t.dataset&&t.dataset.t;
  if(th&&S.sel.size){var xb=bboxOf(selFree());drag={k:'xf',h:th,bb:xb,start:w,orig:JSON.parse(JSON.stringify(selFree())),moved:false};return;}
  var id=t.dataset&&t.dataset.id?+t.dataset.id:0;
  if(id){var cand=null;if(e.shiftKey){if(S.sel.has(id))S.sel.delete(id);else S.sel.add(id);}else if(!S.sel.has(id)){S.sel.clear();S.sel.add(id);S.boxSel=false;S.selP=null;}
    else if(S.sel.size+(S.selP!=null?1:0)>1)cand={t:'p',id:id};
    drag={k:'move',last:w,start:w,moved:false,cand:cand};refresh();renderPanelCard();return;}
  var hp=S.box?boxAt(w):null;
  if(hp!=null){var wc=null;if(hp===S.selP&&S.sel.size&&!e.shiftKey)wc={t:'w',id:hp};else if(!e.shiftKey)S.sel.clear();S.boxSel=true;S.selP=hp;drag={k:'move',last:w,start:w,moved:false,cand:wc};refresh();renderPanelCard();return;}
  drag={k:'marq',a:w,b:w,add:e.shiftKey};
});
svg.addEventListener('pointermove',function(e){
  var w=toWorld(e);info.pos=n1(w.x)+' / '+n1(w.y)+' mm';showInfo();
  if(S.tool==='measure'&&S.meas&&!S.meas.b&&!drag){S.meas.h=snap(w);schedule();return;}
  if(!drag)return;
  if(drag.k==='pan'){S.tx=drag.tx+e.clientX-drag.x;S.ty=drag.ty+e.clientY-drag.y;schedule();}
  else if(drag.k==='draw'){drag.b=S.tool==='line'&&!e.shiftKey?snap(w):w;drag.e={shiftKey:e.shiftKey,altKey:e.altKey};drag.shape=Math.hypot(drag.b.x-drag.a.x,drag.b.y-drag.a.y)*S.z>3?shapeFrom(S.tool,drag.a,drag.b,drag.e):null;schedule();}
  else if(drag.k==='move'){var cw=e.shiftKey&&drag.moved?constrain(drag.start,w):w,dx=cw.x-drag.last.x,dy=cw.y-drag.last.y;if(!drag.moved){if(Math.hypot(dx,dy)*S.z<3)return;pushUndo();drag.moved=true;}
    moveSel(dx,dy);drag.last=cw;schedule();}
  else if(drag.k==='nmove'){var g=nodeByKey(drag.grab);if(!g)return;var tg=e.shiftKey?constrain(drag.orig,w):e.altKey?w:snap(w,true),ddx=tg.x-g.x,ddy=tg.y-g.y;
    if(!drag.moved){if(Math.hypot(w.x-g.x,w.y-g.y)*S.z<3)return;pushUndo();drag.moved=true;}
    moveSel(ddx,ddy);schedule();}
  else if(drag.k==='hmove'){var hd=null;handlesOf().forEach(function(x){if(x.k===drag.h)hd=x;});if(!hd)return;if(!drag.moved){pushUndo();drag.moved=true;hd=null;handlesOf().forEach(function(x){if(x.k===drag.h)hd=x;});}
    var hw=e.shiftKey?constrain({x:hd.ax,y:hd.ay},w):w;hd.q[hd.f+'x']=hw.x;hd.q[hd.f+'y']=hw.y;schedule();}
  else if(drag.k==='xf'){var bb=drag.bb,cx=bb.x+bb.w/2,cy=bb.y+bb.h/2,hh=drag.h,f;
    if(!drag.moved){if(Math.hypot(w.x-drag.start.x,w.y-drag.start.y)*S.z<3)return;pushUndo();drag.moved=true;}
    if(hh==='rot'){var an=Math.atan2(w.y-cy,w.x-cx)-Math.atan2(drag.start.y-cy,drag.start.x-cx);if(e.shiftKey)an=Math.round(an/(Math.PI/12))*(Math.PI/12);var co=Math.cos(an),si=Math.sin(an);
      f=function(x,y){return [cx+(x-cx)*co-(y-cy)*si,cy+(x-cx)*si+(y-cy)*co];};}
    else{var hx=hh.indexOf('e')>=0?1:hh.indexOf('w')>=0?-1:0,hy=hh.indexOf('s')>=0?1:hh.indexOf('n')>=0?-1:0;
      var ax=e.altKey||!hx?cx:(hx>0?bb.x:bb.x+bb.w),ay=e.altKey||!hy?cy:(hy>0?bb.y:bb.y+bb.h),px=hx>0?bb.x+bb.w:bb.x,py=hy>0?bb.y+bb.h:bb.y;
      var kx=hx&&Math.abs(px-ax)>1e-9?(w.x-ax)/(px-ax):1,ky=hy&&Math.abs(py-ay)>1e-9?(w.y-ay)/(py-ay):1;
      if(e.shiftKey){if(hx&&hy){var mm=Math.max(Math.abs(kx),Math.abs(ky));kx=kx<0?-mm:mm;ky=ky<0?-mm:mm;}else if(hx)ky=Math.abs(kx);else kx=Math.abs(ky);}
      if(Math.abs(kx)<1e-4)kx=1e-4;if(Math.abs(ky)<1e-4)ky=1e-4;
      f=function(x,y){return [ax+(x-ax)*kx,ay+(y-ay)*ky];};}
    var mp={};drag.orig.forEach(function(o){mp[o.id]=mapPath(o,f);});S.free=S.free.map(function(p){return mp[p.id]||p;});compose();schedule();}
  else if(drag.k==='marq'){drag.b=w;schedule();}
});
function endDrag(){
  if(!drag)return;var d=drag;drag=null;
  if(d.k==='draw'){if(d.shape){pushUndo();var p=d.shape;p.id=S.nid++;p.type='cut';p.src='narysowane';S.free.push(p);updatePins([p]);compose();S.sel.clear();S.sel.add(p.id);S.boxSel=false;if(!S.box&&S.free.length===1)S.name='rysunek';setTool('select');refresh(true);}else render();return;}
  if(d.k==='marq'){var x0=Math.min(d.a.x,d.b.x),x1=Math.max(d.a.x,d.b.x),y0=Math.min(d.a.y,d.b.y),y1=Math.max(d.a.y,d.b.y),tiny=(x1-x0)*S.z<4&&(y1-y0)*S.z<4;
    if(d.nodes){if(!d.add)S.nsel.clear();if(!tiny)editNodes().forEach(function(n){if(n.x>=x0&&n.x<=x1&&n.y>=y0&&n.y<=y1)S.nsel.add(n.k);});}
    else{if(!d.add){S.sel.clear();S.boxSel=false;}if(S.selP!=null){S.selP=null;renderPanelCard();}
      if(!tiny){S.free.forEach(function(p){var b=bboxOf([p]);if(b.x<=x1&&b.x+b.w>=x0&&b.y<=y1&&b.y+b.h>=y0)S.sel.add(p.id);});
        var bb=S.box?bboxOf(S.bpaths):null;if(bb&&bb.x<=x1&&bb.x+bb.w>=x0&&bb.y<=y1&&bb.y+bb.h>=y0)S.boxSel=true;}}}
  if(d.k==='move'&&!d.moved&&d.cand){var kc=keyOk();S.key=kc&&kc.t===d.cand.t&&kc.id===d.cand.id?null:d.cand;}
  if((d.k==='move'||d.k==='xf')&&d.moved)updatePins(selFree());
  if(d.k!=='pan')refresh(d.k==='move'||d.k==='nmove'||d.k==='xf');
}
svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
svg.addEventListener('dblclick',function(e){
  if(S.tool!=='select'||S.view!=='die')return;var w=toWorld(e);
  if(S.ctx==='obj'){var id=e.target.dataset&&e.target.dataset.id?+e.target.dataset.id:0;
    if(id){S.sel.clear();S.sel.add(id);S.boxSel=false;enter();}
    else if(S.box&&boxAt(w)!=null){S.sel.clear();S.boxSel=true;enter();}
    return;}
  if(S.ctx==='nodes'){var best=null;
    S.free.forEach(function(p){if(!S.edit.has(p.id))return;var n=nearestOnPath(p,w.x,w.y);if(n.d<8/S.z&&(!best||n.d<best.n.d))best={p:p,n:n};});
    if(!best&&S.editBox){var bb=null;S.bpaths.forEach(function(p){var n=nearestOnPath(p,w.x,w.y);if(n.d<8/S.z&&(!bb||n.d<bb.n.d))bb={p:p,n:n};});
      if(bb){var L=bb.p.pts.length,A=bb.p.pts[(bb.n.i-1+L)%L],B=bb.p.pts[bb.n.i];pushUndo();S.box.splits=S.box.splits||[];S.box.sid=(S.box.sid||0)+1;
        S.box.splits.push({id:S.box.sid,a:A.ks.slice(),b:B.ks.slice(),t:bb.n.t});regen();S.nsel.clear();S.nsel.add('B|x'+S.box.sid+'#0');refresh();return;}}
    if(!best){if(!(e.target.dataset&&(e.target.dataset.n||e.target.dataset.h)))leave();return;}
    pushUndo();var i=splitAt(best.p,best.n.i,best.n.t);S.nsel.clear();S.nsel.add(best.p.id+':'+i);refresh();}
});
window.addEventListener('keydown',function(e){
  var tg=e.target.tagName;if(tg==='INPUT'||tg==='SELECT'||tg==='TEXTAREA')return;
  if(e.key===' '){space=true;e.preventDefault();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
  if(e.ctrlKey||e.metaKey){var ck=e.key.toLowerCase();
    if(ck==='c'&&S.ctx==='obj'&&S.sel.size){S.clip=JSON.stringify(selFree());S.pasteN=0;toast('Skopiowano: '+S.sel.size+'.');}
    else if((ck==='v'&&S.clip||ck==='d'&&S.sel.size)&&S.ctx==='obj'&&S.view==='die'){e.preventDefault();var src=ck==='d'?JSON.stringify(selFree()):S.clip,off=ck==='d'?5:5*(++S.pasteN);pushUndo();
      var np=JSON.parse(src);S.sel.clear();S.boxSel=false;S.selP=null;np.forEach(function(q){q.id=S.nid++;delete q.pin;movePath(q,off,off);S.free.push(q);S.sel.add(q.id);});compose();updatePins(np);refresh(true);renderPanelCard();}
    return;}
  var k=e.key.toLowerCase(),map={v:'select',m:'measure',r:'rect',o:'ellipse',l:'line',p:'poly',h:'pan'};
  if(map[k]){setTool(map[k]);return;}
  if(S.tool==='poly'&&(k==='arrowup'||k==='arrowdown')){e.preventDefault();setSides(S.sides+(k==='arrowup'?1:-1));return;}
  if(k==='enter'){e.preventDefault();if(S.ctx==='obj')enter();else leave();}
  else if(k==='delete'||k==='backspace'){e.preventDefault();del();}
  else if(k==='escape'){if(drag&&drag.k==='draw'){drag=null;render();}else if(S.tool!=='select')setTool('select');else if(S.ctx!=='obj')leave();else{S.sel.clear();S.boxSel=false;S.selP=null;S.meas=null;refresh();renderPanelCard();}}
  else if(k.indexOf('arrow')===0&&S.view==='die'){var s=e.shiftKey?1:0.1,d={arrowleft:[-s,0],arrowright:[s,0],arrowup:[0,-s],arrowdown:[0,s]}[k];
    if(d&&(S.sel.size||S.nsel.size||S.boxSel)){e.preventDefault();pushUndo();moveSel(d[0],d[1]);refresh();}}
});
window.addEventListener('keyup',function(e){if(e.key===' ')space=false;});
window.addEventListener('resize',function(){render();});

/* --- wczytywanie --- */
function finishImport(paths,name){
  paths=paths.filter(function(p){return p.pts&&p.pts.length>1&&p.pts.every(function(q){return isFinite(q.x)&&isFinite(q.y);});});
  if(!paths.length){toast('W pliku nie ma linii wektorowych. Sprawdź, czy to nie obraz albo tekst.');return;}
  var b=bboxOf(paths),tm={};
  S.free=paths.map(function(p){var q=mapPath(p,function(x,y){return [x-b.x,y-b.y];});q.id=S.nid++;q.src=p.src;q.type=tm[p.src]||(tm[p.src]=guessType(p.src));return q;});
  S.box=null;S.undo=[];S.sel.clear();S.boxSel=false;leave(true);S.tool='select';S.name=name.replace(/\.[^.]+$/,'');regen();
  setTool('select');refresh(true);fitView();toast('Wczytano '+S.free.length+' linii. Sprawdź kartę Linie.');
}
function cssHex(c){var m=/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?/.exec(c||'');if(!m||(m[4]!==undefined&&+m[4]===0))return null;return hex(+m[1],+m[2],+m[3]);}
function importSVG(text){
  var doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
  if(!root||root.nodeName.toLowerCase()!=='svg')throw new Error('to nie jest poprawny plik SVG');
  root.querySelectorAll('script,foreignObject,image,text').forEach(function(n){n.remove();});
  var host=document.createElement('div');host.style.cssText='position:absolute;left:-99999px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden';
  var node=document.importNode(root,true);host.appendChild(node);document.body.appendChild(host);
  var out=[];
  try{
    var vb=(node.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number),um=/^([\d.]+)\s*(mm|cm|in|pt|px)?$/.exec((node.getAttribute('width')||'').trim());
    var U={mm:1,cm:10,'in':25.4,pt:25.4/72,px:25.4/96},sc,base=[1,0,0,1,0,0];
    if(vb.length===4&&vb[2]>0)base=[1,0,0,1,-vb[0],-vb[1]];
    if(um&&um[2]&&vb.length===4&&vb[2]>0)sc=parseFloat(um[1])*U[um[2]]/vb[2];else if(um&&um[2])sc=U[um[2]];else sc=25.4/72;
    base=mmul([sc,0,0,sc,0,0],base);
    node.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').forEach(function(el){
      if(el.closest('defs,clipPath,mask,pattern,symbol,marker'))return;
      var chain=[],n=el;while(n&&n!==node){chain.unshift(n);n=n.parentNode;}
      var m=base;chain.forEach(function(c){var t=c.getAttribute&&c.getAttribute('transform');if(t)m=mmul(m,parseTransform(t));});
      var cs=getComputedStyle(el);if(cs.display==='none')return;
      var st=cssHex(cs.stroke),src=st||('wypełnienie '+(cssHex(cs.fill)||'#000000'));
      var B=builder(m),g=function(a){return parseFloat(el.getAttribute(a))||0;},tag=el.tagName.toLowerCase();
      if(tag==='path')parseD(el.getAttribute('d')||'',B);
      else if(tag==='rect'){var x=g('x'),y=g('y'),w=g('width'),h=g('height');B.M(x,y);B.L(x+w,y);B.L(x+w,y+h);B.L(x,y+h);B.Z();}
      else if(tag==='line'){B.M(g('x1'),g('y1'));B.L(g('x2'),g('y2'));}
      else if(tag==='circle'||tag==='ellipse'){var rx=tag==='circle'?g('r'):g('rx'),ry=tag==='circle'?g('r'):g('ry'),cx=g('cx'),cy=g('cy');
        parseD('M'+(cx-rx)+' '+cy+'A'+rx+' '+ry+' 0 1 0 '+(cx+rx)+' '+cy+'A'+rx+' '+ry+' 0 1 0 '+(cx-rx)+' '+cy+'Z',B);}
      else{var ps=(el.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number);for(var i=0;i+1<ps.length;i+=2){if(i===0)B.M(ps[0],ps[1]);else B.L(ps[i],ps[i+1]);}if(tag==='polygon')B.Z();}
      B.done().forEach(function(p){p.src=src;out.push(p);});
    });
  }finally{host.remove();}
  return out;
}
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('brak połączenia z internetem (potrzebne do PDF)'));};document.head.appendChild(s);});}
var PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function importPDF(buf){
  if(!window.pdfjsLib){await loadScript(PDFJS+'pdf.min.js');await loadScript(PDFJS+'pdf.worker.min.js');}
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';
  var doc=await window.pdfjsLib.getDocument({data:buf}).promise,page=await doc.getPage(1),vp=page.getViewport({scale:1}),ol=await page.getOperatorList();
  return pdfOpsToPaths(ol,window.pdfjsLib.OPS,vp.transform);
}
async function openFile(file){
  if(!file)return;var ext=(file.name.split('.').pop()||'').toLowerCase();
  try{
    if(ext==='svg')finishImport(importSVG(await file.text()),file.name);
    else if(ext==='dxf')finishImport(parseDXF(await file.text()),file.name);
    else if(ext==='json'){var dj=JSON.parse(await file.text());pushUndo();loadDoc(dj);fitView();toast('Wczytano projekt.');}
    else if(ext==='pdf'){toast('Czytam PDF…');finishImport(await importPDF(await file.arrayBuffer()),file.name);}
    else toast('Wczytuję SVG, DXF, PDF i plik projektu. Plik AI zapisz jako PDF.');
  }catch(err){toast('Nie udało się wczytać: '+(err&&err.message||err)+'.');}
}
$('fileIn').addEventListener('change',function(e){openFile(e.target.files[0]);e.target.value='';});
document.querySelector('.top label[for=fileIn]').addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileIn').click();}});
var dz=$('drop');
window.addEventListener('dragover',function(e){e.preventDefault();dz.style.display='flex';});
window.addEventListener('dragleave',function(e){if(!e.relatedTarget)dz.style.display='none';});
window.addEventListener('drop',function(e){e.preventDefault();dz.style.display='none';if(e.dataTransfer.files[0])openFile(e.dataTransfer.files[0]);});

/* --- zapis --- */
function job(){
  var c=cfg();
  if(S.view==='sheet'){var L=layoutSheet(S.paths,c);if(!L||!L.count)return null;return {items:jobItems(S.paths,L),W:c.W,H:c.H,marks:markList(c),name:S.name+'_arkusz_'+L.count+'szt'};}
  var ord=orderPaths(S.paths);if(!ord.length)return null;var b=bboxOf(ord),pad=5;
  return {items:ord.map(function(p){return mapPath(p,function(x,y){return [x-b.x+pad,y-b.y+pad];});}),W:b.w+2*pad,H:b.h+2*pad,marks:[],name:S.name+'_wykrojnik'};
}
function save(filename,data,mime){
  try{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:mime}));a.download=filename;document.body.appendChild(a);a.click();a.remove();toast('Zapisano '+filename);}
  catch(e){toast('Przeglądarka zablokowała zapis pliku.');}
}
function exportAs(kind){
  var j=job();if(!j){toast(S.view==='sheet'?'Wykrojnik nie mieści się na arkuszu.':'Nie ma linii do zapisania.');return;}
  var n=j.name.replace(/[^\w\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/g,'_');
  if(kind==='dxf')save(n+'.dxf',writeDXF(j.items,j.H,j.marks),'application/dxf');
  else if(kind==='pdf')save(n+'.pdf',writePDF(j.items,j.W,j.H,j.marks),'application/pdf');
  else save(n+'.svg',writeSVG(j.items,j.W,j.H,j.marks),'image/svg+xml');
}
$('exDxf').addEventListener('click',function(){exportAs('dxf');});$('exPdf').addEventListener('click',function(){exportAs('pdf');});$('exSvg').addEventListener('click',function(){exportAs('svg');});

/* --- zapis pracy: autozapis w przeglądarce + plik projektu --- */
function docState(){return {app:'khorei-wykrojnik',v:1,name:S.name,free:S.free,box:S.box,mat:+$('mat').value,thk:thk(),fold:$('fold').value,sides:S.sides,
  imp:{W:$('iW').value,H:$('iH').value,M:$('iM').value,G:$('iG').value,Max:$('iMax').value,Mk:$('iMk').checked,rot:S.rot,corner:S.corner}};}
function loadDoc(d){
  if(!d||d.app!=='khorei-wykrojnik'||!Array.isArray(d.free))throw new Error('to nie jest plik projektu wykrojnika');
  S.free=d.free;S.box=d.box||null;S.name=d.name||'wykrojnik';var mx=0;S.free.forEach(function(p){if(p.id>mx)mx=p.id;});S.nid=mx+1;
  if(d.mat!=null)$('mat').value=String(d.mat);if(d.thk!=null)$('thk').value=d.thk;if(d.fold)$('fold').value=d.fold;if(d.sides)setSides(d.sides);
  var im=d.imp||{};if(im.W)$('iW').value=im.W;if(im.H)$('iH').value=im.H;if(im.M!=null)$('iM').value=im.M;if(im.G!=null)$('iG').value=im.G;$('iMax').value=im.Max||'';$('iMk').checked=im.Mk!==false;
  S.rot=im.rot||'auto';S.corner=im.corner||'tl';
  $('rot').querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.rot===S.rot?'true':'false');});
  $('corner').querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.corner===S.corner?'true':'false');});
  S.sel.clear();S.boxSel=false;S.selP=null;S.key=null;leave(true);if(S.box){S.box.ov=S.box.ov||{};S.box.splits=S.box.splits||[];S.box.dels=S.box.dels||[];S.box.off=S.box.off||{x:0,y:0};}
  regen();syncBox();foldNote();refresh(true);renderPanelCard();
}
var saveT=0;
function autosave(){clearTimeout(saveT);saveT=setTimeout(function(){try{localStorage.setItem('wykr-doc',JSON.stringify(docState()));var n=new Date();$('saved').textContent='Zapisano '+('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2);$('saved').classList.remove('is--warn');}
  catch(e){$('saved').textContent='Nie zapisano w przeglądarce';$('saved').classList.add('is--warn');}},500);}
$('exProj').addEventListener('click',function(){save(S.name.replace(/[^\w\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/g,'_')+'.wykrojnik.json',JSON.stringify(docState()),'application/json');});

/* --- wersja jak w brandmanualu: numer nadaje wdrożenie (?v= przy plikach + version.json), strona co minutę pyta serwer i pokazuje pasek --- */
var VERSION=(/[?&]v=([^&]+)/.exec(SCRIPT_SRC)||[])[1]||'dev';$('ver').textContent='v'+VERSION;
function checkVersion(){if(VERSION==='dev'||location.protocol==='file:'||!window.fetch)return;fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
  if(j&&j.version&&j.version!==VERSION){$('banner').hidden=false;document.querySelector('.app').classList.add('has--banner');render();}}).catch(function(){});}
$('bUpdate').addEventListener('click',function(){location.replace(location.pathname+'?t='+Date.now());});
setInterval(checkVersion,60000);document.addEventListener('visibilitychange',function(){if(!document.hidden)checkVersion();});checkVersion();

/* --- start: przykładowe pudełko --- */
foldNote();
var restored=false;try{var sd=localStorage.getItem('wykr-doc');if(sd){loadDoc(JSON.parse(sd));restored=true;}}catch(e){restored=false;}
if(!restored)newBox('tuck');
setTool('select');
requestAnimationFrame(fitView);
})();
