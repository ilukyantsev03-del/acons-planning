'use strict';
(function(root){
  // Convert measured viewport geometry into the same content coordinates as SVG.
  function frame(work,table,timeline,scrollLeft=0,scrollTop=0,clientLeft=0,clientTop=0){
    return {left:timeline.left-work.left+scrollLeft-clientLeft,top:table.top-work.top+scrollTop-clientTop,width:Math.max(0,table.right-timeline.left),height:table.height};
  }
  function box(rect,origin){
    return {start:rect.left-origin.left,end:rect.right-origin.left,y:(rect.top+rect.bottom)/2-origin.top,milestone:false,dayWidth:0};
  }
  function route(from,to,type,lag){
    const common=root.GPR_LINKS||(typeof require==='function'?require('./links'):null),r=common.route(from,to,type,lag);
    // A short positive gap still has room for a clean single elbow.
    if(r.fromSide==='end'&&r.toSide==='start'&&r.x2-r.x1>2){const mid=(r.x1+r.x2)/2;r.d=`M${r.x1},${r.y1} H${mid} V${r.y2} H${r.x2}`;}
    return r;
  }
  root.GPR_MOCKUP_LINKS={frame,box,route};
  if(typeof module!=='undefined')module.exports={frame,box,route};
})(typeof window!=='undefined'?window:globalThis);
