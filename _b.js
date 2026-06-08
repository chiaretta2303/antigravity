// Option B: dense symmetric maze resembling original. Boundary-outline render
// (rounded corners + glow), validated for play. Side-by-side with original.
const fs=require('fs'),zlib=require('zlib');
const ROOT='C:/Users/sorre/Desktop/antigravity';

// ===== DESIGN: left halves cols 0..6 (col6=center). 13 wide x 15 tall. =====
const LEFT=[
"WWWWWWW", // 0
"W......", // 1  open
"W.WWW..", // 2  chamber block (cols2-4)
"W.WWW..", // 3
"W.WWW..", // 4
"W......", // 5  open (gate exits up at c6)
"W...WWG", // 6  house top + gate(c6)
"....WGG", // 7  tunnel(c0) + house interior
"W...WGG", // 8  house interior
"W...WWW", // 9  house bottom
"W.WWW..", // 10 chamber block
"W.WWW..", // 11
"W.WWW..", // 12
"W......", // 13 open
"WWWWWWW", // 14
];
const PAC=[13,6], GATE=[6,6];
const GH=[[7,5],[7,6],[7,7],[8,5],[8,6],[8,7]];
const GHOSTS=[{id:'blinky',r:5,c:6},{id:'pinky',r:7,c:5},{id:'inky',r:7,c:7},{id:'clyde',r:8,c:6}];
const COLLECT=[[1,1],[1,11],[13,1],[13,11]];
const SCATTER={blinky:[1,11],pinky:[1,1],inky:[13,11],clyde:[13,1]};

const M=LEFT.map(h=>h+h.slice(0,6).split('').reverse().join(''));
const ROWS=M.length,COLS=M[0].length;
for(let r=0;r<ROWS;r++)M[r]=M[r].replace(/\./g,'P');

// ===== validate =====
const errs=[];
M.forEach((r,i)=>{if(r.length!==COLS)errs.push('len'+i);});
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(M[r][c]!==M[r][COLS-1-c])errs.push('asym'+r+','+c);
const walk=v=>v==='P'||v==='C';
function flood(sr,sc){const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false));if(!walk(M[sr][sc]))return{seen,cnt:0};const st=[[sr,sc]];seen[sr][sc]=true;let n=1;while(st.length){const[r,c]=st.pop();const nb=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]];if(c===0)nb.push([r,COLS-1]);if(c===COLS-1)nb.push([r,0]);for(const[a,b]of nb){if(a<0||a>=ROWS||b<0||b>=COLS)continue;if(!seen[a][b]&&walk(M[a][b])){seen[a][b]=true;n++;st.push([a,b]);}}}return{seen,cnt:n};}
let totP=0;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(walk(M[r][c]))totP++;
const fr=flood(PAC[0],PAC[1]);
let un=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(walk(M[r][c])&&!fr.seen[r][c])un.push(r+','+c);
if(un.length)errs.push('UNREACH('+un.length+'): '+un.join(' '));
for(const[r,c]of COLLECT)if(!fr.seen[r][c])errs.push('collect'+r+','+c);
console.log(M.join('\n'));
let wc=0;M.forEach(r=>{for(const c of r)if(c==='W')wc++;});console.log('wall%',(100*wc/(ROWS*COLS)).toFixed(0),'reach',fr.cnt+'/'+totP,errs.length?('\nERR: '+errs.join(' | ')):'OK');

// ===== decode original (color+size) =====
function dec(p){const b=fs.readFileSync(p);let o=8,W,H,ct;const id=[];while(o<b.length){const l=b.readUInt32BE(o);o+=4;const t=b.toString('ascii',o,o+4);o+=4;const d=b.subarray(o,o+l);o+=l+4;if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);else if(t==='IEND')break;}const ch=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(id)),st=W*ch,px=Buffer.alloc(H*st);const pe=(a,b,c)=>{const q=a+b-c,A=Math.abs(q-a),B=Math.abs(q-b),C=Math.abs(q-c);return A<=B&&A<=C?a:B<=C?b:c};let r=0;for(let y=0;y<H;y++){const f=raw[r++];for(let x=0;x<st;x++){const v=raw[r++];const a=x>=ch?px[y*st+x-ch]:0,bb=y>0?px[(y-1)*st+x]:0,cc=x>=ch&&y>0?px[(y-1)*st+x-ch]:0;let u;switch(f){case 0:u=v;break;case 1:u=v+a;break;case 2:u=v+bb;break;case 3:u=v+((a+bb)>>1);break;case 4:u=v+pe(a,bb,cc);break;}px[y*st+x]=u&255;}}return{W,H,ch,st,px};}
const im=dec(ROOT+'/public/assets/maze-without-pellets.png');const W=im.W,H=im.H;
let BL=[0,0,0],nb=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*im.st+x*im.ch;if(im.px[i+2]>90&&im.px[i+2]>im.px[i]+40&&im.px[i+2]>im.px[i+1]+40){BL[0]+=im.px[i];BL[1]+=im.px[i+1];BL[2]+=im.px[i+2];nb++;}}BL=BL.map(v=>Math.round(v/nb));

// ===== boundary-outline render (rounded corners + glow + pink gate) =====
const sx=0.0054*W,sy=0.0039*H,stepW=0.9901*W/COLS,stepH=0.9872*H/ROWS;
const GXc=g=>sx+g*stepW, GYc=g=>sy+g*stepH;
const isW=(r,c)=> r>=0&&r<ROWS&&c>=0&&c<COLS ? M[r][c]==='W' : false;
// boundary unit edges (wall|non-wall), merged into runs
const hSet=new Set(),vSet=new Set();
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){if(!isW(r,c))continue;
 if(!isW(r-1,c))hSet.add(c+','+r); if(!isW(r+1,c))hSet.add(c+','+(r+1));
 if(!isW(r,c-1))vSet.add(c+','+r); if(!isW(r,c+1))vSet.add((c+1)+','+r);}
function mh(){const by={};for(const k of hSet){const[x,y]=k.split(',').map(Number);(by[y]=by[y]||[]).push(x);}const R=[];for(const y in by){const xs=by[y].sort((a,b)=>a-b);let s=xs[0],p=xs[0];for(let i=1;i<xs.length;i++){if(xs[i]===p+1)p=xs[i];else{R.push([s,+y,p+1,+y]);s=p=xs[i];}}R.push([s,+y,p+1,+y]);}return R;}
function mv(){const by={};for(const k of vSet){const[x,y]=k.split(',').map(Number);(by[x]=by[x]||[]).push(y);}const R=[];for(const x in by){const ys=by[x].sort((a,b)=>a-b);let s=ys[0],p=ys[0];for(let i=1;i<ys.length;i++){if(ys[i]===p+1)p=ys[i];else{R.push([+x,s,+x,p+1]);s=p=ys[i];}}R.push([+x,s,+x,p+1]);}return R;}
const runs=[...mh(),...mv()]; // in grid coords
// corner vertices map
const vmap={};runs.forEach((r,i)=>{[[r[0],r[1]],[r[2],r[3]]].forEach((v,e)=>{const k=v[0]+','+v[1];(vmap[k]=vmap[k]||[]).push({i,e});});});
const R_=Math.min(stepW,stepH)*0.34;
const segs=[]; // pixel segments to stroke
function dir(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[dx/l,dy/l,l];}
const trim=k=>vmap[k]&&vmap[k].length===2;
runs.forEach(rn=>{const A=[GXc(rn[0]),GYc(rn[1])],B=[GXc(rn[2]),GYc(rn[3])];const[ux,uy,len]=dir(A,B);const ra=trim(rn[0]+','+rn[1])?Math.min(R_,len/2):0,rb=trim(rn[2]+','+rn[3])?Math.min(R_,len/2):0;segs.push([A[0]+ux*ra,A[1]+uy*ra,B[0]-ux*rb,B[1]-uy*rb]);});
for(const k in vmap){const e=vmap[k];if(e.length!==2)continue;const C=[GXc(+k.split(',')[0]),GYc(+k.split(',')[1])];const pts=e.map(({i,e})=>{const rn=runs[i],A=[GXc(rn[0]),GYc(rn[1])],B=[GXc(rn[2]),GYc(rn[3])];const self=e===0?A:B,other=e===0?B:A;const[ux,uy,len]=dir(self,other);const r=Math.min(R_,len/2);return[C[0]+ux*r,C[1]+uy*r];});let pv=pts[0];for(let i=1;i<=8;i++){const t=i/8,mt=1-t;const x=mt*mt*pts[0][0]+2*mt*t*C[0]+t*t*pts[1][0],y=mt*mt*pts[0][1]+2*mt*t*C[1]+t*t*pts[1][1];segs.push([pv[0],pv[1],x,y]);pv=[x,y];}}
const gate=[GXc(GATE[1])+stepW*0.18,GYc(GATE[0]),GXc(GATE[1]+1)-stepW*0.18,GYc(GATE[0])];

const THICK=8,half=THICK/2;const core=new Float32Array(W*H),glow=new Float32Array(W*H),pink=new Float32Array(W*H);
function ds(px,py,x0,y0,x1,y1){const dx=x1-x0,dy=y1-y0,l2=dx*dx+dy*dy;let t=l2?((px-x0)*dx+(py-y0)*dy)/l2:0;t=t<0?0:t>1?1:t;return Math.hypot(px-(x0+t*dx),py-(y0+t*dy));}
function stamp(b,s,rad,fade,sc){const mnx=Math.max(0,Math.floor(Math.min(s[0],s[2])-rad-1)),mxx=Math.min(W-1,Math.ceil(Math.max(s[0],s[2])+rad+1)),mny=Math.max(0,Math.floor(Math.min(s[1],s[3])-rad-1)),mxy=Math.min(H-1,Math.ceil(Math.max(s[1],s[3])+rad+1));for(let y=mny;y<=mxy;y++)for(let x=mnx;x<=mxx;x++){const d=ds(x+0.5,y+0.5,s[0],s[1],s[2],s[3]);let a=fade?(rad-d)/rad:(rad+0.5-d);a=a<0?0:a>1?1:a;if(fade)a*=sc;if(a>b[y*W+x])b[y*W+x]=a;}}
for(const s of segs){stamp(glow,s,half+5,true,0.4);stamp(core,s,half,false);}
stamp(pink,gate,3,false);
const out=Buffer.alloc(W*H*4);
for(let i=0;i<W*H;i++){let r=4,g=4,b=9;const gA=glow[i],a=core[i],pk=pink[i];r=r*(1-gA)+BL[0]*0.5*gA;g=g*(1-gA)+BL[1]*0.5*gA;b=b*(1-gA)+BL[2]*0.5*gA;r=r*(1-a)+BL[0]*a;g=g*(1-a)+BL[1]*a;b=b*(1-a)+BL[2]*a;if(pk>0){r=r*(1-pk)+255*pk;g=g*(1-pk)+150*pk;b=b*(1-pk)+200*pk;}out[i*4]=Math.round(r);out[i*4+1]=Math.round(g);out[i*4+2]=Math.round(b);out[i*4+3]=255;}
function crc(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c;}
function ck(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const tt=Buffer.from(t);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc(Buffer.concat([tt,d]))>>>0);return Buffer.concat([l,tt,d,cr]);}
function enc(b4,w,h,p){const s2=w*4,fl=Buffer.alloc(h*(s2+1));for(let y=0;y<h;y++){fl[y*(s2+1)]=0;b4.copy(fl,y*(s2+1)+1,y*s2,y*s2+s2);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;fs.writeFileSync(p,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ck('IHDR',ih),ck('IDAT',zlib.deflateSync(fl)),ck('IEND',Buffer.alloc(0))]));}
const TH=470,aw=Math.round(TH*W/H),sep=14,CW=aw*2+sep;const cmp=Buffer.alloc(CW*TH*4);
for(let y=0;y<TH;y++)for(let x=0;x<CW;x++){let Rr=18,Gg=18,Bb=18;if(x<aw){const px=(x*W/aw)|0,py=(y*H/TH)|0,i=py*im.st+px*im.ch;Rr=im.px[i];Gg=im.px[i+1];Bb=im.px[i+2];}else if(x>=aw+sep){const px=((x-aw-sep)*W/aw)|0,py=(y*H/TH)|0,i=(py*W+px)*4;Rr=out[i];Gg=out[i+1];Bb=out[i+2];}const i=(y*CW+x)*4;cmp[i]=Rr;cmp[i+1]=Gg;cmp[i+2]=Bb;cmp[i+3]=255;}
enc(cmp,CW,TH,ROOT+'/_b_cmp.png');
console.log('-> _b_cmp.png (L=orig R=new)');
