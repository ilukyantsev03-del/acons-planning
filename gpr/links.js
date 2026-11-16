/* Geometry only: stored dependencies and scheduling calculations are unchanged. */
(function(root){
  function route(from,to,type='ОН',lag=0){
    const sides={'ОН':['end','start'],'НН':['start','start'],'ОО':['end','end'],'НО':['start','end']};
    let [a,b]=sides[type]||sides['ОН'], reversed=false;
    const day=(box,side)=>side==='start'?box.startDay:box.finishDay;
    // A negative offset can encode an earlier event relative to a later one.
    // Display that relation in event order; never reverse a same-day overlap.
    if(lag<0&&day(from,a)>day(to,b)){
      [from,to]=[to,from];[a,b]=[b,a];reversed=true;
      type=Object.keys(sides).find(k=>sides[k][0]===a&&sides[k][1]===b);
    }
    const edge=(box,side)=>box.milestone?box.start+box.dayWidth/2+(side==='start'?-9:9):box[side];
    const x1=edge(from,a),x2=edge(to,b),y1=from.y,y2=to.y;
    const exit=a==='end'?1:-1,entry=b==='start'?-1:1,gap=14;
    let d;
    if(a===b){
      const lane=a==='start'?Math.min(x1,x2)-gap:Math.max(x1,x2)+gap;
      d=`M${x1},${y1} H${lane} V${y2} H${x2}`;
    }else if((x2-x1)*exit>=gap*2&&exit===-entry){
      const lane=(x1+x2)/2;
      d=`M${x1},${y1} H${lane} V${y2} H${x2}`;
    }else{
      // Escape through the free strip below/above the source bar, then
      // approach the target from its proper side even with overlap or lag.
      const laneY=y1+(y2>=y1?20:-20);
      d=`M${x1},${y1} H${x1+exit*gap} V${laneY} H${x2+entry*gap} V${y2} H${x2}`;
    }
    return {d,reversed,type,fromSide:a,toSide:b,x1,x2,y1,y2};
  }
  if(typeof module==='object'&&module.exports)module.exports={route};else root.GPR_LINKS={route};
})(typeof window!=='undefined'?window:globalThis);
