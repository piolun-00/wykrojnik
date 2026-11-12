/* ===== Geometria i formaty plików (bez DOM) ===== */
var TYPES={
  cut:{label:'Cięcie',layer:'CUT',aci:1,rgb:[255,0,0]},
  crease:{label:'Bigowanie',layer:'CREASE',aci:5,rgb:[0,0,255]},
  vcut:{label:'Rowek V',layer:'VCUT',aci:4,rgb:[0,160,160]},
  perf:{label:'Perforacja',layer:'PERF',aci:3,rgb:[0,160,0]},
  kiss:{label:'Nacinanie',layer:'KISSCUT',aci:6,rgb:[255,0,255]},
  ignore:{label:'Pomiń',layer:'',aci:8,rgb:[150,150,150]}
};
var ORDER=['crease','vcut','perf','kiss','cut'];
function mmul(m,n){return [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];}
function hasC(p){return p.c1x!==undefined;}
function dropC(p){delete p.c1x;delete p.c1y;delete p.c2x;delete p.c2y;}
function hex(r,g,b){return '#'+[r,g,b].map(function(v){v=Math.max(0,Math.min(255,Math.round(v)));return (v<16?'0':'')+v.toString(16);}).join('');}

function normPath(p){
  var a=p.pts,o=[a[0]];
  for(var i=1;i<a.length;i++){var q=a[i],l=o[o.length-1];if(!hasC(q)&&Math.abs(q.x-l.x)<1e-7&&Math.abs(q.y-l.y)<1e-7)continue;o.push(q);}
  p.pts=o;var n=o.length;
  if(n>2){var f=o[0],e=o[n-1];
    if(Math.hypot(f.x-e.x,f.y-e.y)<1e-4){if(hasC(e)){f.c1x=e.c1x;f.c1y=e.c1y;f.c2x=e.c2x;f.c2y=e.c2y;}o.pop();p.closed=true;}}
  if(!p.closed)dropC(p.pts[0]);
  return p;
}
function builder(m){
  var out=[],cur=null,sx=0,sy=0;
  function T(x,y){return m?[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]:[x,y];}
  function end(){if(cur&&cur.pts.length>1)out.push(cur);cur=null;}
  var B={
    M:function(x,y){end();sx=x;sy=y;var p=T(x,y);cur={closed:false,pts:[{x:p[0],y:p[1]}]};},
    L:function(x,y){if(!cur)B.M(sx,sy);var p=T(x,y);cur.pts.push({x:p[0],y:p[1]});},
    C:function(x1,y1,x2,y2,x,y){if(!cur)B.M(sx,sy);var a=T(x1,y1),b=T(x2,y2),p=T(x,y);cur.pts.push({x:p[0],y:p[1],c1x:a[0],c1y:a[1],c2x:b[0],c2y:b[1]});},
    Z:function(){if(cur){B.L(sx,sy);cur.closed=true;end();}},
    done:function(){end();return out.filter(function(p){return p.pts.length>1;}).map(normPath).filter(function(p){return p.pts.length>1;});}
  };
  return B;
}
function unitArc(a0,da){
  var n=Math.max(1,Math.ceil(Math.abs(da)/(Math.PI/2)-1e-9)),st=da/n,k=4/3*Math.tan(st/4),o=[];
  for(var i=0;i<n;i++){var a=a0+i*st,b=a+st,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);o.push([ca-k*sa,sa+k*ca,cb+k*sb,sb-k*cb,cb,sb]);}
  return o;
}
function arcTo(B,cx,cy,r,a0,da){unitArc(a0,da).forEach(function(s){B.C(cx+r*s[0],cy+r*s[1],cx+r*s[2],cy+r*s[3],cx+r*s[4],cy+r*s[5]);});}
function svgArc(B,x1,y1,rx,ry,phiDeg,fa,fs,x2,y2){
  rx=Math.abs(rx);ry=Math.abs(ry);
  if(!rx||!ry||(x1===x2&&y1===y2)){B.L(x2,y2);return;}
  var phi=phiDeg*Math.PI/180,cp=Math.cos(phi),sp=Math.sin(phi),dx=(x1-x2)/2,dy=(y1-y2)/2;
  var xp=cp*dx+sp*dy,yp=-sp*dx+cp*dy,l=xp*xp/(rx*rx)+yp*yp/(ry*ry);
  if(l>1){var s=Math.sqrt(l);rx*=s;ry*=s;}
  var num=rx*rx*ry*ry-rx*rx*yp*yp-ry*ry*xp*xp,den=rx*rx*yp*yp+ry*ry*xp*xp,co=Math.sqrt(Math.max(0,num/den));
  if(fa===fs)co=-co;
  var cxp=co*rx*yp/ry,cyp=-co*ry*xp/rx,cx=cp*cxp-sp*cyp+(x1+x2)/2,cy=sp*cxp+cp*cyp+(y1+y2)/2;
  function ang(ux,uy,vx,vy){return Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);}
  var ux=(xp-cxp)/rx,uy=(yp-cyp)/ry,t1=ang(1,0,ux,uy),dt=ang(ux,uy,(-xp-cxp)/rx,(-yp-cyp)/ry);
  if(!fs&&dt>0)dt-=2*Math.PI;else if(fs&&dt<0)dt+=2*Math.PI;
  function f(u,v){return [cx+cp*rx*u-sp*ry*v,cy+sp*rx*u+cp*ry*v];}
  unitArc(t1,dt).forEach(function(q){var a=f(q[0],q[1]),b=f(q[2],q[3]),e=f(q[4],q[5]);B.C(a[0],a[1],b[0],b[1],e[0],e[1]);});
}
function parseD(d,B){
  var i=0,n=d.length,cmd='',prev='',cx=0,cy=0,sx=0,sy=0,px=0,py=0;
  function ws(){while(i<n&&(d.charCodeAt(i)<=32||d[i]===','))i++;}
  function num(){ws();var m=/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.substr(i,48));if(!m)return NaN;i+=m[0].length;return +m[0];}
  function flag(){ws();var c=d[i];i++;return c==='1'?1:0;}
  while(true){
    ws();if(i>=n)break;
    if(/[a-zA-Z]/.test(d[i])){cmd=d[i++];}
    else if(!cmd)break;
    else if(cmd==='M')cmd='L';else if(cmd==='m')cmd='l';else if(cmd==='Z'||cmd==='z')break;
    var rel=cmd===cmd.toLowerCase(),C=cmd.toUpperCase(),ox=rel?cx:0,oy=rel?cy:0,x,y,x1,y1,x2,y2;
    if(C==='Z'){B.Z();cx=sx;cy=sy;prev=C;continue;}
    if(C==='M'){x=num()+ox;y=num()+oy;if(isNaN(y))break;B.M(x,y);cx=sx=x;cy=sy=y;}
    else if(C==='L'){x=num()+ox;y=num()+oy;if(isNaN(y))break;B.L(x,y);cx=x;cy=y;}
    else if(C==='H'){x=num()+ox;if(isNaN(x))break;B.L(x,cy);cx=x;}
    else if(C==='V'){y=num()+oy;if(isNaN(y))break;B.L(cx,y);cy=y;}
    else if(C==='C'){x1=num()+ox;y1=num()+oy;x2=num()+ox;y2=num()+oy;x=num()+ox;y=num()+oy;if(isNaN(y))break;B.C(x1,y1,x2,y2,x,y);px=x2;py=y2;cx=x;cy=y;}
    else if(C==='S'){x2=num()+ox;y2=num()+oy;x=num()+ox;y=num()+oy;if(isNaN(y))break;
      if(prev==='C'||prev==='S'){x1=2*cx-px;y1=2*cy-py;}else{x1=cx;y1=cy;}B.C(x1,y1,x2,y2,x,y);px=x2;py=y2;cx=x;cy=y;}
    else if(C==='Q'||C==='T'){var qx,qy;
      if(C==='Q'){qx=num()+ox;qy=num()+oy;}else if(prev==='Q'||prev==='T'){qx=2*cx-px;qy=2*cy-py;}else{qx=cx;qy=cy;}
      x=num()+ox;y=num()+oy;if(isNaN(y))break;
      B.C(cx+2/3*(qx-cx),cy+2/3*(qy-cy),x+2/3*(qx-x),y+2/3*(qy-y),x,y);px=qx;py=qy;cx=x;cy=y;}
    else if(C==='A'){var rx=num(),ry=num(),ro=num(),fa=flag(),fs=flag();x=num()+ox;y=num()+oy;if(isNaN(y))break;svgArc(B,cx,cy,rx,ry,ro,fa,fs,x,y);cx=x;cy=y;}
    else break;
    prev=C;
  }
}
function parseTransform(s){
  var m=[1,0,0,1,0,0],re=/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g,r;
  while((r=re.exec(s||''))){
    var a=r[2].split(/[\s,]+/).filter(Boolean).map(Number),t;
    if(r[1]==='matrix')t=a;
    else if(r[1]==='translate')t=[1,0,0,1,a[0]||0,a[1]||0];
    else if(r[1]==='scale')t=[a[0],0,0,a.length>1?a[1]:a[0],0,0];
    else if(r[1]==='rotate'){var c=Math.cos(a[0]*Math.PI/180),sn=Math.sin(a[0]*Math.PI/180);t=[c,sn,-sn,c,0,0];if(a.length>2)t=mmul(mmul([1,0,0,1,a[1],a[2]],t),[1,0,0,1,-a[1],-a[2]]);}
    else if(r[1]==='skewX')t=[1,0,Math.tan(a[0]*Math.PI/180),1,0,0];
    else t=[1,Math.tan(a[0]*Math.PI/180),0,1,0,0];
    if(t&&t.length===6)m=mmul(m,t);
  }
  return m;
}

/* --- operacje na ścieżkach --- */
function segCount(tol,a,b){var dd=Math.max(Math.hypot(a.x-2*b.c1x+b.c2x,a.y-2*b.c1y+b.c2y),Math.hypot(b.c1x-2*b.c2x+b.x,b.c1y-2*b.c2y+b.y));return Math.max(1,Math.min(200,Math.ceil(Math.sqrt(0.75*dd/tol))));}
function cubicAt(a,b,t){var u=1-t;return {x:u*u*u*a.x+3*u*u*t*b.c1x+3*u*t*t*b.c2x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*b.c1y+3*u*t*t*b.c2y+t*t*t*b.y};}
function flattenPath(p,tol){
  tol=tol||0.05;var a=p.pts,n=a.length,o=[{x:a[0].x,y:a[0].y}],last=p.closed?n:n-1;
  for(var k=1;k<=last;k++){var b=a[k%n],s=a[k-1];
    if(hasC(b)){var c=segCount(tol,s,b);for(var j=1;j<=c;j++)o.push(cubicAt(s,b,j/c));}else o.push({x:b.x,y:b.y});}
  if(p.closed)o.pop();
  return o;
}
function pathLength(p){var f=flattenPath(p,0.05),l=0;for(var i=1;i<f.length;i++)l+=Math.hypot(f[i].x-f[i-1].x,f[i].y-f[i-1].y);if(p.closed)l+=Math.hypot(f[0].x-f[f.length-1].x,f[0].y-f[f.length-1].y);return l;}
function bboxOf(paths){
  var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  paths.forEach(function(p){flattenPath(p,0.05).forEach(function(q){if(q.x<x0)x0=q.x;if(q.y<y0)y0=q.y;if(q.x>x1)x1=q.x;if(q.y>y1)y1=q.y;});});
  if(x0===Infinity)return null;
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
function mapPath(p,f){
  return {id:p.id,type:p.type,src:p.src,col:p.col,closed:p.closed,pts:p.pts.map(function(q){var a=f(q.x,q.y),o={x:a[0],y:a[1]};
    if(hasC(q)){var b=f(q.c1x,q.c1y),c=f(q.c2x,q.c2y);o.c1x=b[0];o.c1y=b[1];o.c2x=c[0];o.c2y=c[1];}return o;})};
}
function movePath(p,dx,dy){p.pts.forEach(function(q){q.x+=dx;q.y+=dy;if(hasC(q)){q.c1x+=dx;q.c1y+=dy;q.c2x+=dx;q.c2y+=dy;}});}
function moveNode(p,i,dx,dy){
  var a=p.pts,n=a.length,q=a[i];q.x+=dx;q.y+=dy;
  if(hasC(q)){q.c2x+=dx;q.c2y+=dy;}
  if(i+1<n||p.closed){var nx=a[(i+1)%n];if(nx!==q&&hasC(nx)){nx.c1x+=dx;nx.c1y+=dy;}}
}
function deleteNode(p,i){
  var a=p.pts,n=a.length;
  if(i+1<n||p.closed)dropC(a[(i+1)%n]);
  a.splice(i,1);
  if(!p.closed&&a.length)dropC(a[0]);
}
function nearestOnPath(p,x,y){
  var a=p.pts,n=a.length,best={d:Infinity},last=p.closed?n:n-1;
  for(var k=1;k<=last;k++){var b=a[k%n],s=a[k-1];
    if(hasC(b)){for(var j=0;j<=32;j++){var t=j/32,q=cubicAt(s,b,t),d=Math.hypot(q.x-x,q.y-y);if(d<best.d)best={d:d,i:k%n,t:t,x:q.x,y:q.y};}}
    else{var vx=b.x-s.x,vy=b.y-s.y,l=vx*vx+vy*vy,tt=l?Math.max(0,Math.min(1,((x-s.x)*vx+(y-s.y)*vy)/l)):0,qx=s.x+tt*vx,qy=s.y+tt*vy,dd=Math.hypot(qx-x,qy-y);
      if(dd<best.d)best={d:dd,i:k%n,t:tt,x:qx,y:qy};}}
  return best;
}
function splitAt(p,i,t){
  var a=p.pts,n=a.length,b=a[i],s=a[(i-1+n)%n],q;
  t=Math.max(0.02,Math.min(0.98,t));
  if(hasC(b)){
    var l=function(u,v){return u+(v-u)*t;};
    var ax=l(s.x,b.c1x),ay=l(s.y,b.c1y),bx=l(b.c1x,b.c2x),by=l(b.c1y,b.c2y),cx=l(b.c2x,b.x),cy=l(b.c2y,b.y);
    var abx=l(ax,bx),aby=l(ay,by),bcx=l(bx,cx),bcy=l(by,cy);
    q={x:l(abx,bcx),y:l(aby,bcy),c1x:ax,c1y:ay,c2x:abx,c2y:aby};
    b.c1x=bcx;b.c1y=bcy;b.c2x=cx;b.c2y=cy;
  }else q={x:s.x+(b.x-s.x)*t,y:s.y+(b.y-s.y)*t};
  if(i===0){a.push(q);return a.length-1;}
  a.splice(i,0,q);return i;
}
/* usuwa „wąsy”: miejsca, gdzie obrys idzie odcinkiem tam i z powrotem po tej samej linii (zostaje po nich wiszące nacięcie) */
function removeSpikes(p){
  var a=p.pts,changed=true,guard=0;
  while(changed&&a.length>2&&guard++<1000){changed=false;var n=a.length;
    for(var i=0;i<n;i++){
      if(!p.closed&&(i===0||i===n-1))continue;
      var pv=a[(i-1+n)%n],q=a[i],nx=a[(i+1)%n];if(hasC(q)||hasC(nx))continue;
      var ax=q.x-pv.x,ay=q.y-pv.y,bx=nx.x-q.x,by=nx.y-q.y,la=Math.hypot(ax,ay),lb=Math.hypot(bx,by);
      if(la<1e-6){a.splice(i,1);changed=true;break;}
      if(lb<1e-6)continue;
      if(Math.abs(ax*by-ay*bx)<1e-6*la*lb&&ax*bx+ay*by<0){a.splice(i,1);changed=true;break;}}}
  return p;
}
function reversePath(p){
  var a=p.pts,n=a.length,r=[];
  for(var i=n-1;i>=0;i--){var o={x:a[i].x,y:a[i].y};if(a[i].k)o.k=a[i].k;r.push(o);}
  for(var k=1;k<n;k++)if(hasC(a[k])){var t=r[n-k];t.c1x=a[k].c2x;t.c1y=a[k].c2y;t.c2x=a[k].c1x;t.c2y=a[k].c1y;}
  p.pts=r;
}
function joinPaths(paths,tol){
  var open=paths.filter(function(p){return !p.closed;}),gone={},merged=0,again=true;
  function ends(p){return [p.pts[0],p.pts[p.pts.length-1]];}
  function near(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<=tol;}
  while(again){again=false;
    for(var i=0;i<open.length&&!again;i++){var A=open[i];if(gone[A.id]||A.closed)continue;
      for(var j=0;j<open.length;j++){var Bp=open[j];if(i===j||gone[Bp.id]||Bp.closed||Bp.type!==A.type)continue;
        var ea=ends(A),eb=ends(Bp);
        if(near(ea[1],eb[0])){}
        else if(near(ea[1],eb[1]))reversePath(Bp);
        else if(near(ea[0],eb[1])){reversePath(A);reversePath(Bp);}
        else if(near(ea[0],eb[0]))reversePath(A);
        else continue;
        A.pts=A.pts.concat(Bp.pts.slice(1));gone[Bp.id]=1;merged++;
        normPath(A);again=true;break;}}}
  return {gone:gone,merged:merged};
}
function guessType(src){
  var s=String(src).toLowerCase();
  if(/wype|fill/.test(s))return 'ignore';
  if(/big|creas|fold|rill|zgi|score|falc/.test(s))return 'crease';
  if(/perf/.test(s))return 'perf';
  if(/kiss|nacin|half|pół|pol-/.test(s))return 'kiss';
  if(/cut|ci[eę]c|n[oó][zż]|kontur|die|stanz|wykr/.test(s))return 'cut';
  var m=/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/.exec(s);
  if(m){var r=parseInt(m[1],16),g=parseInt(m[2],16),b=parseInt(m[3],16);
    if(b>130&&r>130&&g<110)return 'kiss';
    if(b>130&&b>r+50&&b>g+30)return 'crease';
    if(g>110&&g>r+50&&g>b+40)return 'perf';}
  return 'cut';
}

/* --- DXF: odczyt --- */
function deBoor(deg,kn,ct,u){
  var n=ct.length-1,k=deg;while(k<n&&u>=kn[k+1])k++;
  var d=[];for(var j=0;j<=deg;j++)d.push([ct[j+k-deg][0],ct[j+k-deg][1]]);
  for(var r=1;r<=deg;r++)for(var q=deg;q>=r;q--){var i=q+k-deg,den=kn[i+deg-r+1]-kn[i],a=den?(u-kn[i])/den:0;d[q][0]=(1-a)*d[q-1][0]+a*d[q][0];d[q][1]=(1-a)*d[q-1][1]+a*d[q][1];}
  return d[deg];
}
function parseDXF(text,unitScale){
  var L=text.split(/\r\n|\r|\n/),pairs=[];
  for(var i=0;i+1<L.length;i+=2)pairs.push([parseInt(L[i],10),L[i+1].trim()]);
  var sec=/SECTION/.test(text)?'':'ENTITIES',ents=[],cur=null,ins=0;
  for(var k=0;k<pairs.length;k++){var c=pairs[k][0],v=pairs[k][1];
    if(c===0){if(v==='SECTION'){sec=pairs[k+1]?pairs[k+1][1]:'';cur=null;k++;continue;}
      if(v==='ENDSEC'){sec='';cur=null;continue;}
      if(sec==='ENTITIES'){cur={t:v,g:[]};ents.push(cur);}else cur=null;}
    else if(cur)cur.g.push([c,v]);
    else if(sec==='HEADER'&&c===9&&v==='$INSUNITS'&&pairs[k+1])ins=parseInt(pairs[k+1][1],10);}
  var sc=unitScale||({1:25.4,2:304.8,5:10,6:1000}[ins]||1),out=[],poly=null;
  function get(e,c,d){for(var i=0;i<e.g.length;i++)if(e.g[i][0]===c)return e.g[i][1];return d;}
  function f(e,c){return parseFloat(get(e,c,'0'))||0;}
  function all(e,c){return e.g.filter(function(g){return g[0]===c;}).map(function(g){return parseFloat(g[1]);});}
  function push(B,layer){B.done().forEach(function(p){p.src=layer;out.push(p);});}
  function drawPoly(vs,closed,layer){
    if(vs.length<2)return;var B=builder(null);B.M(vs[0].x,vs[0].y);
    var m=closed?vs.length:vs.length-1;
    for(var i=0;i<m;i++){var a=vs[i],b=vs[(i+1)%vs.length];
      if(a.b){var th=4*Math.atan(a.b),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d<1e-9)continue;
        var h=d/2/Math.tan(th/2),cx=(a.x+b.x)/2-dy/d*h,cy=(a.y+b.y)/2+dx/d*h,r=Math.hypot(a.x-cx,a.y-cy);
        arcTo(B,cx,cy,r,Math.atan2(a.y-cy,a.x-cx),th);}
      else B.L(b.x,b.y);}
    if(closed)B.Z();push(B,layer);
  }
  ents.forEach(function(e){
    var layer=get(e,8,'0'),B;
    if(e.t==='VERTEX'&&poly){poly.vs.push({x:f(e,10),y:f(e,20),b:f(e,42)});return;}
    if(e.t==='SEQEND'&&poly){drawPoly(poly.vs,poly.closed,poly.layer);poly=null;return;}
    if(e.t==='POLYLINE'){poly={vs:[],closed:(parseInt(get(e,70,'0'),10)&1)===1,layer:layer};return;}
    if(e.t==='LINE'){B=builder(null);B.M(f(e,10),f(e,20));B.L(f(e,11),f(e,21));push(B,layer);}
    else if(e.t==='LWPOLYLINE'){var vs=[];e.g.forEach(function(g){if(g[0]===10)vs.push({x:parseFloat(g[1]),y:0,b:0});else if(g[0]===20&&vs.length)vs[vs.length-1].y=parseFloat(g[1]);else if(g[0]===42&&vs.length)vs[vs.length-1].b=parseFloat(g[1]);});
      drawPoly(vs,(parseInt(get(e,70,'0'),10)&1)===1,layer);}
    else if(e.t==='CIRCLE'){B=builder(null);var r=f(e,40),cx=f(e,10),cy=f(e,20);B.M(cx+r,cy);arcTo(B,cx,cy,r,0,2*Math.PI);B.Z();push(B,layer);}
    else if(e.t==='ARC'){B=builder(null);var rr=f(e,40),ax=f(e,10),ay=f(e,20),a0=f(e,50)*Math.PI/180,a1=f(e,51)*Math.PI/180,da=a1-a0;while(da<=0)da+=2*Math.PI;
      B.M(ax+rr*Math.cos(a0),ay+rr*Math.sin(a0));arcTo(B,ax,ay,rr,a0,da);push(B,layer);}
    else if(e.t==='ELLIPSE'){B=builder(null);var ex=f(e,10),ey=f(e,20),mx=f(e,11),my=f(e,21),ra=f(e,40),t0=f(e,41),t1=parseFloat(get(e,42,String(2*Math.PI))),dt=t1-t0;while(dt<=0)dt+=2*Math.PI;
      var nx=-my*ra,ny=mx*ra,P=function(u,v){return [ex+mx*u+nx*v,ey+my*u+ny*v];},s0=P(Math.cos(t0),Math.sin(t0));B.M(s0[0],s0[1]);
      unitArc(t0,dt).forEach(function(q){var a=P(q[0],q[1]),b=P(q[2],q[3]),c=P(q[4],q[5]);B.C(a[0],a[1],b[0],b[1],c[0],c[1]);});
      if(Math.abs(dt-2*Math.PI)<1e-6)B.Z();push(B,layer);}
    else if(e.t==='SPLINE'){var deg=parseInt(get(e,71,'3'),10),kn=all(e,40),xs=all(e,10),ys=all(e,20),fx=all(e,11),fy=all(e,21),pts=[];
      if(xs.length>deg&&kn.length===xs.length+deg+1){var ct=xs.map(function(x,i){return [x,ys[i]];}),u0=kn[deg],u1=kn[xs.length],N=Math.max(16,xs.length*8);
        for(var s=0;s<=N;s++)pts.push(deBoor(deg,kn,ct,s===N?u1-1e-9*(u1-u0):u0+(u1-u0)*s/N));}
      else if(fx.length>1)pts=fx.map(function(x,i){return [x,fy[i]];});
      else pts=xs.map(function(x,i){return [x,ys[i]];});
      if(pts.length>1){B=builder(null);B.M(pts[0][0],pts[0][1]);for(var j=1;j<pts.length;j++)B.L(pts[j][0],pts[j][1]);push(B,layer);}}
  });
  return out.map(function(p){var q=mapPath(p,function(x,y){return [x*sc,-y*sc];});q.src=p.src;return q;});
}

/* --- PDF: odczyt z listy operatorów pdf.js --- */
function pdfOpsToPaths(ol,OPS,base){
  var k=25.4/72,out=[],ctm=[1,0,0,1,0,0],stack=[],stroke='#000000',fill='#000000',pend=[];
  function col(a){if(typeof a[0]==='string')return a[0].toLowerCase();return hex(a[0],a[1],a[2]);}
  function flush(src,close){pend.forEach(function(p){if(close)p.closed=true;p.src=src;out.push(normPath(p));});pend=[];}
  for(var i=0;i<ol.fnArray.length;i++){var fn=ol.fnArray[i],a=ol.argsArray[i];
    if(fn===OPS.save)stack.push([ctm,stroke,fill]);
    else if(fn===OPS.restore||fn===OPS.paintFormXObjectEnd){var s=stack.pop();if(s){ctm=s[0];stroke=s[1];fill=s[2];}}
    else if(fn===OPS.transform)ctm=mmul(ctm,a);
    else if(fn===OPS.paintFormXObjectBegin){stack.push([ctm,stroke,fill]);if(a&&a[0])ctm=mmul(ctm,a[0]);}
    else if(fn===OPS.setStrokeRGBColor)stroke=col(a);
    else if(fn===OPS.setFillRGBColor)fill=col(a);
    else if(fn===OPS.constructPath){
      var B=builder(mmul([k,0,0,k,0,0],mmul(base,ctm))),ops=a[0],r=a[1],j=0,cx=0,cy=0;
      for(var q=0;q<ops.length;q++){var op=ops[q];
        if(op===OPS.moveTo){cx=r[j];cy=r[j+1];j+=2;B.M(cx,cy);}
        else if(op===OPS.lineTo){cx=r[j];cy=r[j+1];j+=2;B.L(cx,cy);}
        else if(op===OPS.curveTo){B.C(r[j],r[j+1],r[j+2],r[j+3],r[j+4],r[j+5]);cx=r[j+4];cy=r[j+5];j+=6;}
        else if(op===OPS.curveTo2){B.C(cx,cy,r[j],r[j+1],r[j+2],r[j+3]);cx=r[j+2];cy=r[j+3];j+=4;}
        else if(op===OPS.curveTo3){B.C(r[j],r[j+1],r[j+2],r[j+3],r[j+2],r[j+3]);cx=r[j+2];cy=r[j+3];j+=4;}
        else if(op===OPS.closePath)B.Z();
        else if(op===OPS.rectangle){var x=r[j],y=r[j+1],w=r[j+2],h=r[j+3];j+=4;B.M(x,y);B.L(x+w,y);B.L(x+w,y+h);B.L(x,y+h);B.Z();cx=x;cy=y;}}
      pend=pend.concat(B.done());}
    else if(fn===OPS.stroke||fn===OPS.fillStroke||fn===OPS.eoFillStroke)flush(stroke,false);
    else if(fn===OPS.closeStroke||fn===OPS.closeFillStroke||fn===OPS.closeEOFillStroke)flush(stroke,true);
    else if(fn===OPS.fill||fn===OPS.eoFill)flush('wypełnienie '+fill,false);
    else if(fn===OPS.endPath)pend=[];
  }
  return out;
}

/* --- impozycja --- */
function layoutSheet(paths,c){
  var act=paths.filter(function(p){return p.type!=='ignore';});if(!act.length)return null;
  var b=bboxOf(act);
  function fit(w,h){var cols=Math.max(0,Math.floor((c.W-2*c.m+c.gap+1e-6)/(w+c.gap))),rows=Math.max(0,Math.floor((c.H-2*c.m+c.gap+1e-6)/(h+c.gap)));return {cols:cols,rows:rows,n:cols*rows,w:w,h:h};}
  var a=fit(b.w,b.h),r=fit(b.h,b.w),rot=c.rot==='90'||(c.rot==='auto'&&r.n>a.n),Lr=rot?r:a;
  var n=Lr.n;if(c.max>0)n=Math.min(n,c.max);
  var uc=Math.min(n,Lr.cols),ur=Lr.cols?Math.ceil(n/Lr.cols):0;
  var bw=uc*Lr.w+Math.max(0,uc-1)*c.gap,bh=ur*Lr.h+Math.max(0,ur-1)*c.gap;
  var cells=[],co=c.corner||'tl',rt=co.charAt(1)==='r',bt=co.charAt(0)==='b';
  for(var i=0;i<n;i++){var cx=(i%Lr.cols)*(Lr.w+c.gap),cy=Math.floor(i/Lr.cols)*(Lr.h+c.gap);cells.push({x:rt?c.W-c.m-Lr.w-cx:c.m+cx,y:bt?c.H-c.m-Lr.h-cy:c.m+cy});}
  return {b:b,rot:rot,w:Lr.w,h:Lr.h,cols:Lr.cols,rows:Lr.rows,uc:uc,ur:ur,count:n,cells:cells,util:n*b.w*b.h/(c.W*c.H)};
}
function orderPaths(paths){
  return paths.filter(function(p){return p.type!=='ignore';}).map(function(p){var b=bboxOf([p]);return {p:p,a:b.w*b.h,o:ORDER.indexOf(p.type)};})
    .sort(function(x,y){return x.o-y.o||x.a-y.a;}).map(function(x){return x.p;});
}
function jobItems(paths,L){
  var ord=orderPaths(paths),b=L.b,out=[];
  L.cells.forEach(function(c){ord.forEach(function(p){
    out.push(mapPath(p,L.rot?function(x,y){return [c.x+b.h-(y-b.y),c.y+(x-b.x)];}:function(x,y){return [c.x+x-b.x,c.y+y-b.y];}));});});
  return out;
}
function markList(c){if(!(c.mk>0))return [];var o=Math.max(c.mk,c.m/2);return [[o,o],[c.W-o,o],[o,c.H-o],[c.W-o,c.H-o]].map(function(p){return {x:p[0],y:p[1],r:c.mk/2};});}

/* --- zapis: DXF, PDF, SVG, ZIP --- */
function fmt(n){return (Math.round(n*1000)/1000).toString();}
function writeDXF(items,H,marks){
  var o=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','0','ENDSEC','0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','6'];
  ORDER.concat(['reg']).forEach(function(t){var T=TYPES[t]||{layer:'REG',aci:7};o.push('0','LAYER','2',T.layer,'70','0','62',String(T.aci),'6','CONTINUOUS');});
  o.push('0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES');
  items.forEach(function(p){var ly=TYPES[p.type].layer,f=flattenPath(p,0.02);
    o.push('0','POLYLINE','8',ly,'66','1','70',p.closed?'1':'0','10','0','20','0','30','0');
    f.forEach(function(q){o.push('0','VERTEX','8',ly,'10',fmt(q.x),'20',fmt(H-q.y),'30','0');});
    o.push('0','SEQEND','8',ly);});
  (marks||[]).forEach(function(m){o.push('0','CIRCLE','8','REG','10',fmt(m.x),'20',fmt(H-m.y),'30','0','40',fmt(m.r));});
  o.push('0','ENDSEC','0','EOF');
  return o.join('\r\n')+'\r\n';
}
function writePDF(items,W,H,marks){
  var k=72/25.4,X=function(x){return fmt(x*k);},Y=function(y){return fmt((H-y)*k);},c='0.5 w 1 J 1 j\n',lt='';
  function cv(q){return X(q.c1x)+' '+Y(q.c1y)+' '+X(q.c2x)+' '+Y(q.c2y)+' '+X(q.x)+' '+Y(q.y)+' c\n';}
  items.forEach(function(p){
    if(p.type!==lt){c+=TYPES[p.type].rgb.map(function(v){return fmt(v/255);}).join(' ')+' RG\n';lt=p.type;}
    var a=p.pts;c+=X(a[0].x)+' '+Y(a[0].y)+' m\n';
    for(var i=1;i<a.length;i++)c+=hasC(a[i])?cv(a[i]):X(a[i].x)+' '+Y(a[i].y)+' l\n';
    if(p.closed){if(hasC(a[0]))c+=cv(a[0]);c+='s\n';}else c+='S\n';});
  (marks||[]).forEach(function(m){c+='0 0 0 rg\n'+X(m.x+m.r)+' '+Y(m.y)+' m\n';
    unitArc(0,2*Math.PI).forEach(function(s){c+=X(m.x+m.r*s[0])+' '+Y(m.y+m.r*s[1])+' '+X(m.x+m.r*s[2])+' '+Y(m.y+m.r*s[3])+' '+X(m.x+m.r*s[4])+' '+Y(m.y+m.r*s[5])+' c\n';});c+='f\n';});
  var objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+fmt(W*k)+' '+fmt(H*k)+'] /Contents 4 0 R /Resources << >> >>',
    '<< /Length '+c.length+' >>\nstream\n'+c+'endstream'],pdf='%PDF-1.4\n',off=[];
  objs.forEach(function(s,i){off.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+s+'\nendobj\n';});
  var xr=pdf.length;pdf+='xref\n0 5\n0000000000 65535 f \n';
  off.forEach(function(n){pdf+=('0000000000'+n).slice(-10)+' 00000 n \n';});
  return pdf+'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF\n';
}
function pathD(p){
  var a=p.pts,d='M'+fmt(a[0].x)+' '+fmt(a[0].y);
  function cv(q){return 'C'+fmt(q.c1x)+' '+fmt(q.c1y)+' '+fmt(q.c2x)+' '+fmt(q.c2y)+' '+fmt(q.x)+' '+fmt(q.y);}
  for(var i=1;i<a.length;i++)d+=hasC(a[i])?cv(a[i]):'L'+fmt(a[i].x)+' '+fmt(a[i].y);
  if(p.closed){if(hasC(a[0]))d+=cv(a[0]);d+='Z';}
  return d;
}
function writeSVG(items,W,H,marks){
  var s='<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+fmt(W)+'mm" height="'+fmt(H)+'mm" viewBox="0 0 '+fmt(W)+' '+fmt(H)+'">\n';
  ORDER.forEach(function(t){var g=items.filter(function(p){return p.type===t;});if(!g.length)return;
    s+='<g id="'+TYPES[t].layer+'" fill="none" stroke="rgb('+TYPES[t].rgb.join(',')+')" stroke-width="0.25">\n';
    g.forEach(function(p){s+='<path d="'+pathD(p)+'"/>\n';});s+='</g>\n';});
  if(marks&&marks.length){s+='<g id="REG" fill="#000">\n';marks.forEach(function(m){s+='<circle cx="'+fmt(m.x)+'" cy="'+fmt(m.y)+'" r="'+fmt(m.r)+'"/>\n';});s+='</g>\n';}
  return s+'</svg>\n';
}
function samplePaths(){
  var xs=[12,72,112,172,212],top=[{x:12,y:30}],bot=[],out=[],i;
  for(i=0;i<4;i++){var a=xs[i],b=xs[i+1];top.push({x:a+.5,y:30},{x:a+2.5,y:2},{x:b-2.5,y:2},{x:b-.5,y:30});}
  top.push({x:212,y:30},{x:212,y:130});
  for(i=3;i>=0;i--){var c=xs[i],d=xs[i+1];bot.push({x:d-.5,y:130},{x:d-2.5,y:158},{x:c+2.5,y:158},{x:c+.5,y:130});}
  bot.push({x:12,y:130},{x:0,y:124},{x:0,y:36});
  out.push({type:'cut',src:'#ff0000',closed:true,pts:top.concat(bot)});
  for(i=0;i<4;i++){out.push({type:'crease',src:'#0000ff',closed:false,pts:[{x:xs[i],y:30},{x:xs[i],y:130}]});
    out.push({type:'crease',src:'#0000ff',closed:false,pts:[{x:xs[i]+.5,y:30},{x:xs[i+1]-.5,y:30}]});
    out.push({type:'crease',src:'#0000ff',closed:false,pts:[{x:xs[i]+.5,y:130},{x:xs[i+1]-.5,y:130}]});}
  var B=builder(null);B.M(152,80);arcTo(B,142,80,10,0,2*Math.PI);B.Z();
  var h=B.done()[0];h.type='cut';h.src='#ff0000';out.push(h);
  return out;
}

/* --- wymiary: odcinki między bigami i rozciąganie --- */
function axisCuts(paths,ax){
  var act=paths.filter(function(p){return p.type!=='ignore';}),b=bboxOf(act);if(!b)return [];
  var o=ax==='x'?'y':'x',lo=ax==='x'?b.x:b.y,len=ax==='x'?b.w:b.h,oth=ax==='x'?b.h:b.w,sum={},vals=[lo,lo+len];
  act.forEach(function(p){if(p.type!=='crease'||p.pts.some(hasC))return;var v=p.pts[0][ax];
    if(!p.pts.every(function(q){return Math.abs(q[ax]-v)<0.05;}))return;
    var mn=Infinity,mx=-Infinity;p.pts.forEach(function(q){mn=Math.min(mn,q[o]);mx=Math.max(mx,q[o]);});
    var k=Math.round(v*10)/10;sum[k]=(sum[k]||0)+(mx-mn);});
  Object.keys(sum).forEach(function(k){if(sum[k]>=oth*0.25)vals.push(+k);});
  vals.sort(function(x,y){return x-y;});
  var out=[];vals.forEach(function(v){if(!out.length||v-out[out.length-1]>0.3)out.push(v);});
  if(out.length>1&&lo+len-out[out.length-1]<=0.3&&out[out.length-1]!==lo+len)out[out.length-1]=lo+len;
  return out;
}
function stretchAxis(paths,ax,a,b,d){
  var mid=(a+b)/2,eps=0.05,dx=ax==='x'?1:0,dy=ax==='x'?0:1;
  paths.forEach(function(p){
    var mn=Infinity,mx=-Infinity;p.pts.forEach(function(q){mn=Math.min(mn,q[ax]);mx=Math.max(mx,q[ax]);});
    if(mn>a+eps&&mx<b-eps&&mx-mn<0.6*(b-a)){movePath(p,dx*d/2,dy*d/2);return;}
    var idx=[];p.pts.forEach(function(q,i){if(q[ax]>mid)idx.push(i);});
    idx.forEach(function(i){moveNode(p,i,dx*d,dy*d);});
  });
}
function scaleAxis(paths,ax,lo,k){
  return paths.map(function(p){return mapPath(p,function(x,y){return ax==='x'?[lo+(x-lo)*k,y]:[x,lo+(y-lo)*k];});});
}

/* --- pudełko: ścianki połączone bigami, wymiary z danych pudełka --- */
/* Wymiar ścianki na wykrojniku (od bigu do bigu) liczony z wymiaru ZEWNĘTRZNEGO pudełka.
   Zgięcie ma zawias na głębokości P.h od zewnętrznej powierzchni: bigowanie = połowa grubości, rowek V od środka = 0, nacięcie od zewnątrz = cała grubość.
   Każdy koniec ścianki, który jest zgięciem, zabiera P.h; nf = liczba takich końców (0–2). Własny wymiar jest brany dosłownie. */
var FOLD={crease:0.5,vin:0,vout:1};
function exprVal(e,P,nf){var v=e.base==='num'?e.val+(e.kt||0)*P.t:P[e.base]*(e.mul||1)-(nf||0)*(P.h||0)+(e.kt||0)*P.t;return Math.max(1,v);}
function boxTemplate(name){
  var n=1,ps=[],W=function(par,edge,base,kt,more){var p={id:n++,kind:'wall',parent:par,edge:edge,ext:{base:base,kt:kt}};if(more)for(var k in more)p[k]=more[k];ps.push(p);return p.id;},
    F=function(par,edge,kind){var e=kind==='glue'?{base:'num',val:12,kt:0}:kind==='tuck'?{base:'num',val:15,kt:0}:{base:'G',mul:0.5,kt:0};ps.push({id:n++,kind:kind,parent:par,edge:edge,ext:e});};
  function root(a,b){ps.push({id:n++,kind:'wall',parent:null,w:{base:a,kt:0},h:{base:b,kt:0}});}
  if(name==='tray'){
    root('S','G');var t=W(1,'t','W',0),b=W(1,'b','W',0);W(1,'l','W',0);W(1,'r','W',0);
    F(t,'a','glue');F(t,'b','glue');F(b,'a','glue');F(b,'b','glue');
  }else if(name==='one'){root('S','W');
  }else if(name==='sleeve'){
    root('S','W');var a1=W(1,'r','G',0),a2=W(a1,'o','S',0),a3=W(a2,'o','G',-1);F(a3,'o','glue');
  }else if(name==='mailer'){
    /* pudełko wysyłkowe (układ FEFCO 0427): dno, tył z wieczkiem i klapą, przód, boki zawijane podwójnie z wypustkami w szczelinach dna;
       uszy przodu, tyłu i wieczka chowają się w zawinięciu boków */
    root('S','G');var bk2=W(1,'t','W',0),lid2=W(bk2,'o','G',0),fr=W(1,'b','W',0);
    W(lid2,'o','W',-1);
    var ear=function(par,edge,base,mul){ps.push({id:n++,kind:'dust',parent:par,edge:edge,ext:{base:base,mul:mul,kt:0},sink:{kt:0}});};
    ear(bk2,'a','G',0.45);ear(bk2,'b','G',0.45);ear(fr,'a','G',0.45);ear(fr,'b','G',0.45);ear(lid2,'a','W',0.8);ear(lid2,'b','W',0.8);
    ['l','r'].forEach(function(e){var o=W(1,e,'W',0),sp=n;ps.push({id:n++,kind:'wall',parent:o,edge:'o',ext:{base:'num',val:0,kt:2}});
      var inn=W(sp,'o','W',-2);ps.push({id:n++,kind:'tab',parent:inn,edge:'o',ext:{base:'num',val:3,kt:1}});});
  }else{
    /* ścianka z klejeniem i wieczka z zakładką są krótsze o 1 × grubość: klapka klejowa i zakładka chowają się POD sąsiednią ściankę.
       tylna ścianka ma wolne boki obniżone pod wieczko (under:1) */
    root('S','W');
    var s1=W(1,'r','G',0),bk=W(s1,'o','S',0,{under:1}),s2=W(bk,'o','G',-1);F(s2,'o','glue');
    var lid=W(1,'t','G',-1);F(lid,'o','tuck');var bot=W(1,'b','G',-1);F(bot,'o','tuck');
    F(s1,'a','dust');F(s1,'b','dust');F(s2,'a','dust');F(s2,'b','dust');
  }
  return ps;
}
/* część wspólna dwóch wypukłych wielokątów (test osi rozdzielających); eps pozwala na styk krawędzią */
function polysOverlap(A,B,eps){
  var polys=[A,B];
  for(var k=0;k<2;k++){var pl=polys[k];
    for(var i=0;i<pl.length;i++){var p=pl[i],q=pl[(i+1)%pl.length],nx=q.y-p.y,ny=p.x-q.x,l=Math.hypot(nx,ny);if(l<1e-9)continue;nx/=l;ny/=l;
      var a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
      A.forEach(function(v){var d=v.x*nx+v.y*ny;a0=Math.min(a0,d);a1=Math.max(a1,d);});
      B.forEach(function(v){var d=v.x*nx+v.y*ny;b0=Math.min(b0,d);b1=Math.max(b1,d);});
      if(Math.min(a1,b1)-Math.max(a0,b0)<=eps)return false;}}
  return true;
}
function buildBox(box){
  var P=box.P,kids={},out={paths:[],polys:{},plus:[],labels:[],frames:{},dims:{},clash:{}},root=null,ov=box.ov||{},slits=[],fr={},byIdP={};
  box.panels.forEach(function(p){byIdP[p.id]=p;});
  P.h=(FOLD[P.fold]!=null?FOLD[P.fold]:0.5)*P.t;
  box.panels.forEach(function(p){if(p.parent==null)root=p;else kids[p.parent+':'+p.edge]=p;});
  if(!root)return out;
  function pt(F,a,b){return {x:F.O.x+a*F.u.x+b*F.n.x,y:F.O.y+a*F.u.y+b*F.n.y};}
  /* linia zgięcia dostaje rodzaj narzędzia, którym będzie robiona: kółko bigujące, rowek V albo nacięcie */
  var foldType={crease:'crease',vin:'vcut',vout:'kiss'}[P.fold]||'crease';
  /* każdy punkt dostaje stały klucz (ścianka/krawędź/kolejność) — po nim trzymają się ręczne przesunięcia punktów */
  function emit(type,pts,key,list){var fold=type==='crease';if(fold)type=foldType;pts.forEach(function(q,i){q.k=key+'#'+i;});(list||out.paths).push({type:type,src:fold?'#0000ff':'#ff0000',closed:false,pts:pts,fold:fold});}
  function under(p){return p.kind==='wall'&&p.under?Math.max(0,p.under*P.t-P.h):0;}
  function plus(p,key,F){var m=pt(F,F.len/2,0);out.plus.push({id:p.id,edge:key,x:m.x,y:m.y,nx:F.n.x,ny:F.n.y});}
  function edge(p,key,F){
    var ch=kids[p.id+':'+key],base=p.id+'/'+key;
    if(!ch){emit('cut',[pt(F,0,0),pt(F,F.len,0)],base+'/x');plus(p,key,F);return;}
    if(ch.kind==='tab'){place(ch,F,0);return;}
    /* klapki odsuwają się od krawędzi o wielokrotność grubości; klapka leżąca pod inną warstwą ma big cofnięty w głąb ścianki */
    var ins=ch.kind==='wall'?0:Math.min(Math.max(0,(ch.gap&&ch.gap.kt!=null?ch.gap.kt:1)*P.t),F.len*0.2);
    var sk=ch.kind==='wall'?0:Math.min(Math.max(0,(ch.sink&&ch.sink.kt!=null?ch.sink.kt:(ch.kind==='dust'?1:0))*P.t),F.len*0.3);
    var lk=ch.kind==='tuck'&&ch.lock?Math.min(ch.lock,(F.len-2*ins)*0.2):0,L=[pt(F,0,0)],R=[];
    if(sk>0.001)L.push(pt(F,0,-sk));if(ins>0.001)L.push(pt(F,ins,-sk));
    if(L.length>1)emit('cut',L,base+'/L');
    emit('crease',[pt(F,ins+lk,-sk),pt(F,F.len-ins-lk,-sk)],base+'/F');
    if(ins>0.001)R.push(pt(F,F.len-ins,-sk));R.push(pt(F,F.len,-sk));if(sk>0.001)R.push(pt(F,F.len,0));
    if(R.length>1)emit('cut',R,base+'/R');
    /* zamek zakładki: krótkie nacięcia na końcach bigu, za które zaczepiają się klapki boczne */
    if(lk>0.001){emit('cut',[pt(F,ins,-sk),pt(F,ins+lk,-sk)],base+'/K1',slits);emit('cut',[pt(F,F.len-ins-lk,-sk),pt(F,F.len-ins,-sk)],base+'/K2',slits);}
    place(ch,sk>0.001?{O:pt(F,0,-sk),u:F.u,n:F.n,len:F.len}:F,ins);
  }
  function place(p,F,ins){
    var ext=exprVal(p.ext,P,p.kind==='wall'?1+(kids[p.id+':o']&&kids[p.id+':o'].kind!=='tab'?1:0):0),len=F.len,c,L0=ins||0,L1=len-(ins||0),q=function(a,b){return pt(F,a,b);};out.dims[p.id]={ext:ext};
    if(p.kind==='wall'){
      fr[p.id]=F;
      out.frames[p.id]={nx:F.n.x,ny:F.n.y,pos:F.O.x*Math.abs(F.n.x)+F.O.y*Math.abs(F.n.y)};
      out.polys[p.id]=[q(0,0),q(0,ext),q(len,ext),q(len,0)];
      var ce=q(len/2,ext/2);out.labels.push({id:p.id,x:ce.x,y:ce.y,a:len,b:ext});
      /* wolny bok obniżony pod wieczko: krawędź cofa się w głąb ścianki */
      var da=kids[p.id+':a']?0:Math.min(under(p),len*0.3),db=kids[p.id+':b']?0:Math.min(under(p),len*0.3);
      var Fa={O:q(0,0),u:F.n,n:{x:-F.u.x,y:-F.u.y},len:ext},Fb={O:q(len,0),u:F.n,n:F.u,len:ext},Fo={O:q(0,ext),u:F.u,n:F.n,len:len};
      if(da>0.001){emit('cut',[q(0,0),q(da,0),q(da,ext),q(0,ext)],p.id+'/a/x');plus(p,'a',Fa);}else edge(p,'a',Fa);
      if(!kids[p.id+':o']&&(da>0.001||db>0.001)){emit('cut',[q(da,ext),q(len-db,ext)],p.id+'/o/x');plus(p,'o',Fo);}else edge(p,'o',Fo);
      if(db>0.001){emit('cut',[q(len,0),q(len-db,0),q(len-db,ext),q(len,ext)],p.id+'/b/x');plus(p,'b',Fb);}else edge(p,'b',Fb);
    }else if(p.kind==='tab'){
      /* wypustki: przedłużenie ścianki bez bigu. Jeśli ścianka jest zawinięciem boku (bok → grzbiet → ścianka wewnętrzna), w dnie powstają szczeliny */
      var tw=Math.min(25,len*0.2),cs=[len*0.25,len*0.75],tp=[q(0,0)];
      cs.forEach(function(cx){tp.push(q(cx-tw/2,0),q(cx-tw/2,ext),q(cx+tw/2,ext),q(cx+tw/2,0));});tp.push(q(len,0));
      emit('cut',tp,p.id+'/out');out.polys[p.id]=[q(0,0),q(0,ext),q(len,ext),q(len,0)];
      var inn=byIdP[p.parent],spn=inn&&byIdP[inn.parent],outer=spn&&byIdP[spn.parent];
      if(outer&&outer.kind==='wall'&&spn.edge==='o'&&inn.edge==='o'&&p.edge==='o'&&fr[outer.id]&&out.dims[spn.id]){var Fo=fr[outer.id],sd=out.dims[spn.id].ext,hw=(P.t+0.5)/2;
        cs.forEach(function(cx,ci){var a0=cx-tw/2-0.5,a1=cx+tw/2+0.5;slits.push({type:'cut',src:'#ff0000',closed:true,fold:false,pts:[pt(Fo,a0,-sd-hw),pt(Fo,a1,-sd-hw),pt(Fo,a1,-sd+hw),pt(Fo,a0,-sd+hw)].map(function(v,vi){v.k=p.id+'/slot'+ci+'#'+vi;return v;})});});}
    }else if(p.kind==='tuck'){
      var r=Math.min(ext*0.6,(L1-L0)*0.25),k=0.5523*r,A=q(L0+r,ext),B=q(L1,ext-r),a1=q(L0,ext-r+k),a2=q(L0+r-k,ext),b1=q(L1-r+k,ext),b2=q(L1,ext-r+k);
      emit('cut',[q(L0,0),q(L0,ext-r),{x:A.x,y:A.y,c1x:a1.x,c1y:a1.y,c2x:a2.x,c2y:a2.y},q(L1-r,ext),{x:B.x,y:B.y,c1x:b1.x,c1y:b1.y,c2x:b2.x,c2y:b2.y},q(L1,0)],p.id+'/out');
      out.polys[p.id]=[q(L0,0),q(L0,ext),q(L1,ext),q(L1,0)];
    }else{
      c=Math.min(ext*(p.kind==='glue'?0.5:0.3),(L1-L0)*0.25);
      var pl=[q(L0,0),q(L0+c,ext),q(L1-c,ext),q(L1,0)];emit('cut',pl.map(function(v){return {x:v.x,y:v.y};}),p.id+'/out');out.polys[p.id]=pl;
    }
  }
  var w=exprVal(root.w,P,(kids[root.id+':l']?1:0)+(kids[root.id+':r']?1:0)),h=exprVal(root.h,P,(kids[root.id+':t']?1:0)+(kids[root.id+':b']?1:0));out.dims[root.id]={w:w,h:h};
  out.polys[root.id]=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];out.labels.push({id:root.id,x:w/2,y:h/2,a:w,b:h});
  edge(root,'t',{O:{x:0,y:0},u:{x:1,y:0},n:{x:0,y:-1},len:w});
  edge(root,'b',{O:{x:0,y:h},u:{x:1,y:0},n:{x:0,y:1},len:w});
  edge(root,'l',{O:{x:0,y:0},u:{x:0,y:1},n:{x:-1,y:0},len:h});
  edge(root,'r',{O:{x:w,y:0},u:{x:0,y:1},n:{x:1,y:0},len:h});
  /* big nie może leżeć pod linią cięcia: odcinam z bigów kawałki, po których idzie nóż */
  var segs=[];out.paths.concat(slits).forEach(function(p){if(p.fold)return;for(var i=1;i<p.pts.length;i++)if(!hasC(p.pts[i]))segs.push([p.pts[i-1],p.pts[i]]);});
  var kept=[];
  out.paths.forEach(function(p){
    if(!p.fold){kept.push(p);return;}
    var A=p.pts[0],B=p.pts[1],L=Math.hypot(B.x-A.x,B.y-A.y);if(L<1e-6)return;var ux=(B.x-A.x)/L,uy=(B.y-A.y)/L,cutI=[];
    segs.forEach(function(sg){var c=sg[0],d=sg[1];if(Math.abs((c.x-A.x)*uy-(c.y-A.y)*ux)>1e-6||Math.abs((d.x-A.x)*uy-(d.y-A.y)*ux)>1e-6)return;
      var t0=(c.x-A.x)*ux+(c.y-A.y)*uy,t1=(d.x-A.x)*ux+(d.y-A.y)*uy,lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(L,Math.max(t0,t1));if(hi-lo>1e-6)cutI.push([lo,hi]);});
    if(!cutI.length){kept.push(p);return;}
    cutI.sort(function(x,y){return x[0]-y[0];});var cur=0,parts=[];
    cutI.forEach(function(iv){if(iv[0]-cur>1e-6)parts.push([cur,iv[0]]);cur=Math.max(cur,iv[1]);});if(L-cur>1e-6)parts.push([cur,L]);
    parts.forEach(function(iv,n){var k0=p.pts[0].k.split('#')[0]+(n?'~'+n:'');kept.push({type:p.type,src:p.src,closed:false,fold:true,pts:[{x:A.x+ux*iv[0],y:A.y+uy*iv[0],k:k0+'#0'},{x:A.x+ux*iv[1],y:A.y+uy*iv[1],k:k0+'#1'}]});});
  });
  out.paths=kept.concat(slits);
  /* punkty dodane ręcznie na odcinku między dwoma punktami pudełka */
  (box.splits||[]).forEach(function(sp){var done=false;out.paths.forEach(function(p){if(done)return;for(var i=1;i<p.pts.length;i++){var A=p.pts[i-1],B=p.pts[i],f=sp.a.indexOf(A.k)>=0&&sp.b.indexOf(B.k)>=0,r=sp.b.indexOf(A.k)>=0&&sp.a.indexOf(B.k)>=0;
    if(f||r){var ni=splitAt(p,i,f?sp.t:1-sp.t);p.pts[ni].k='x'+sp.id+'#0';done=true;break;}}});});
  /* ręczne przesunięcia punktów (tryb punktów na pudełku) */
  out.paths.forEach(function(p){p.pts.forEach(function(q,i){var o=ov[q.k];if(o)moveNode(p,i,o.x,o.y);});});
  var loc={};out.paths.forEach(function(p){p.pts.forEach(function(q){var key=Math.round(q.x*1000)+','+Math.round(q.y*1000);(loc[key]=loc[key]||[]).push(q.k);});});
  out.paths.forEach(function(p,i){p.id=i+1;});
  var cuts=out.paths.filter(function(p){return p.type==='cut'&&slits.indexOf(p)<0;}),j=joinPaths(cuts,0.01);
  out.paths=out.paths.filter(function(p){return !j.gone[p.id];});
  cuts.forEach(function(p){if(!j.gone[p.id])removeSpikes(p);});
  out.paths.forEach(function(p){p.pts.forEach(function(q){q.ks=loc[Math.round(q.x*1000)+','+Math.round(q.y*1000)]||[q.k];});});
  /* punkty usunięte ręcznie */
  var dels=box.dels||[];
  if(dels.length){out.paths.forEach(function(p){for(var i=p.pts.length-1;i>=0;i--){if(p.pts[i].ks.some(function(k){return dels.indexOf(k)>=0;}))deleteNode(p,i);}});out.paths=out.paths.filter(function(p){return p.pts.length>1;});}
  /* kolizje: ścianki, które nie są rodzicem i dzieckiem, a nachodzą na siebie */
  var ids=Object.keys(out.polys),par={};box.panels.forEach(function(p){par[p.id]=p.parent;});
  for(var x=0;x<ids.length;x++)for(var y=x+1;y<ids.length;y++){var ia=+ids[x],ib=+ids[y];if(par[ia]===ib||par[ib]===ia)continue;
    if(polysOverlap(out.polys[ia],out.polys[ib],0.05)){out.clash[ia]=1;out.clash[ib]=1;}}
  return out;
}
function pointInPoly(pl,x,y){var c=false;for(var i=0,j=pl.length-1;i<pl.length;j=i++){var a=pl[i],b=pl[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;}
if(typeof module!=='undefined')module.exports={removeSpikes:removeSpikes,nearestOnPath:nearestOnPath,polysOverlap:polysOverlap,moveNode:moveNode,movePath:movePath,boxTemplate:boxTemplate,buildBox:buildBox,exprVal:exprVal,pointInPoly:pointInPoly,axisCuts:axisCuts,stretchAxis:stretchAxis,scaleAxis:scaleAxis,parseD:parseD,builder:builder,parseDXF:parseDXF,writeDXF:writeDXF,writePDF:writePDF,writeSVG:writeSVG,pdfOpsToPaths:pdfOpsToPaths,samplePaths:samplePaths,layoutSheet:layoutSheet,jobItems:jobItems,markList:markList,bboxOf:bboxOf,orderPaths:orderPaths,pathLength:pathLength,joinPaths:joinPaths,splitAt:splitAt,deleteNode:deleteNode,parseTransform:parseTransform,pathD:pathD,flattenPath:flattenPath};
