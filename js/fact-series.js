'use strict';
(function () {
  const value = input => {
    if(input===null||input===undefined||input==='')return null;
    const n=Number(String(input).replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(n)?n:null;
  };
  // A snapshot is the total at the END of its date. Quantities on that same
  // date are already included; subsequent quantities extend the baseline.
  function series(rows, asOf='9999-12-31') {
    const groups=new Map(),seenIds=new Set(),seenSources=new Set();
    for(const row of rows||[]) {
      if(!row||row.active===false)continue;
      const date=String(row.factDate||row.date||'').slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>asOf)continue;
      const source=row.sourceFingerprint||row.importFingerprint;
      if((row.id&&seenIds.has(String(row.id)))||(source&&seenSources.has(source)))continue;
      if(row.id)seenIds.add(String(row.id));if(source)seenSources.add(source);
      const qty=value(row.quantity??row.qty),cum=value(row.cumulativeQty??row.cumulative);
      const snapshot=row.factType==='cumulative_snapshot'||(!row.factType&&qty===null&&cum!==null);
      if((snapshot&&cum===null)||(!snapshot&&(qty===null||!['quantity',undefined,''].includes(row.factType))))continue;
      const key=JSON.stringify([row.frontId||'',row.metricId||'']);
      if(!groups.has(key))groups.set(key,new Map());
      const dates=groups.get(key);if(!dates.has(date))dates.set(date,{quantities:[],snapshots:[]});
      dates.get(date)[snapshot?'snapshots':'quantities'].push({row,qty,cum});
    }
    const daily=new Map(),entries=[];let actual=0;
    for(const dates of groups.values()) {
      let total=0,observed=false;
      for(const [date,day] of [...dates].sort((a,b)=>a[0].localeCompare(b[0]))) {
        let delta,baseline=false,row;
        if(day.snapshots.length) {
          const snapshots=day.snapshots.sort((a,b)=>String(a.row.updatedAt||a.row.createdAt||'').localeCompare(String(b.row.updatedAt||b.row.createdAt||'')));
          const last=snapshots[snapshots.length-1];row=last.row;
          delta=Math.max(0,last.cum)-total;baseline=!observed;total=Math.max(0,last.cum);
        } else {
          row=day.quantities[0].row;delta=day.quantities.reduce((sum,x)=>sum+x.qty,0);total+=delta;
        }
        observed=true;
        entries.push({...row,date,factDate:date,qty:delta,quantity:delta,cumulative:total,baseline});
        // An initial undated-increment baseline cannot establish production pace.
        if(!baseline)daily.set(date,(daily.get(date)||0)+delta);
      }
      actual+=total;
    }
    return {actual,daily,entries,hasFacts:entries.length>0,mode:'facts'};
  }
  function primaryRows(current, frontIds=null) {
    const primaries=new Map((current.workMetrics||[]).filter(x=>x.active!==false&&x.isPrimary===true).map(x=>[String(x.frontId),String(x.id)]));
    return [...(current.progressFacts||[]),...(current.factLog||[])].filter(row=>
      (!frontIds||frontIds.has(String(row.frontId)))&&(!row.metricId||primaries.get(String(row.frontId))===String(row.metricId))
    ).map(row=>({...row,metricId:row.metricId||primaries.get(String(row.frontId))||''}));
  }
  window.LIV_FACT_SERIES={series,primaryRows};
})();
