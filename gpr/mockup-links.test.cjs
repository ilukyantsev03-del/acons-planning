const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('./mockup-links'),{route}=require('./links');
const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
test('stretched table columns use measured calendar origin, not a fixed 643px',()=>{
 const work=rect(0,300,1600,600),table=rect(0,300,1600,1000),cell=rect(960,365,640,54),bar=rect(1100,500,200,18);
 const f=G.frame(work,table,cell),b=G.box(bar,{left:cell.left,top:table.top});assert.equal(f.left,960);assert.equal(b.start+f.left,bar.left);assert.equal(b.end+f.left,bar.right);assert.equal(b.y+work.top,(bar.top+bar.bottom)/2);
});
test('scrolling preserves SVG content coordinates and measured endpoints',()=>{
 const table=rect(-200,-100,2400,1400),work=rect(0,300,1600,600),cell=rect(760,-35,1440,54),bar=rect(1000,400,200,18);
 const a=G.frame(work,table,cell,200,400),b=G.box(bar,{left:cell.left,top:table.top});
 const moved=r=>rect(r.left-150,r.top-100,r.width,r.height);
 assert.deepEqual(G.frame(work,moved(table),moved(cell),350,500),a);assert.deepEqual(G.box(moved(bar),{left:moved(cell).left,top:moved(table).top}),b);
});
test('FS path ends exactly on the rendered milestone tip, including its rotation',()=>{
 const origin={left:960,top:300},a=G.box(rect(1100,500,200,18),origin),b=G.box(rect(1340,550,18.384,18.384),origin),r=route(a,b,'ОН',0);
 assert.equal(r.x1+origin.left,1300);assert.equal(r.x2+origin.left,1340);assert.equal(r.y2+origin.top,559.192);assert.match(r.d,/ H380$/);
});

test('short FS gaps use one elbow instead of a two pixel zigzag',()=>{const r=G.route({start:0,end:100,y:27},{start:110,end:200,y:81},'ОН',0);assert.equal(r.d,'M100,27 H105 V81 H110');});
