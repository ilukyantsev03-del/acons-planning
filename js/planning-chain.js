'use strict';
/* Shared, read-only integration of facts, obligations and physical resources. */
(function(){
  const P=window.LIV_PLANNING,D=window.LIV_PLANNING_DOMAIN,E=window.LIV_DAILY,F=window.LIV_FACT_SERIES;
  const dates=(p,t,type='working')=>(p.taskDates||[]).filter(d=>d.taskId===t.id&&d.type===type).at(-1)||{};
  const tomorrow=d=>new Date(Date.parse(d)+86400000).toISOString().slice(0,10);
  const max=(...values)=>values.filter(v=>P.date(v)).sort().at(-1)||'';
  function pace(p,t,asOf,calendar,windowDays=7){
    const n=Number(windowDays);if(!P.date(asOf)||!Number.isInteger(n)||n<1||n>366)throw Error('Укажите дату факта и окно темпа от 1 до 366 дней.');
    const fact=D.factAt(p,t,asOf),from=new Date(Date.parse(asOf)-(n-1)*86400000).toISOString().slice(0,10);
    // A cumulative opening balance establishes coverage only AFTER its date.
    const first=fact.entries.map(r=>r.date).sort()[0],baseline=fact.entries.some(r=>r.date===first&&r.baseline);
    const observed=first?max(from,baseline?tomorrow(first):first):'';
    const days=observed&&observed<=asOf?P.workingCount(observed,asOf,calendar):0;
    const quantity=[...fact.daily].filter(([d])=>observed&&d>=observed&&d<=asOf).reduce((s,[,q])=>s+q,0);
    return {from:observed,to:asOf,days,quantity,rate:days?Math.max(0,quantity/days):null,fact};
  }
  function input(p,t,asOf,override={}){
    const saved={...t.planning,...override},frontId=saved.frontId||t.frontId||'',work={...t,frontId},front=(p.fronts||[]).find(f=>f.id===frontId),d=dates(p,t),cal=override.calendar?.holidays?override.calendar:E.calendar(p,saved.calendar||t.calendar),v=D.volumeAt(p,work,asOf),fact=D.factAt(p,work,asOf),q=(p.taskQuantities||[]).find(q=>q.taskId===t.id);
    const result={mode:'manual',resources:1,manual:t.isMilestone?0:P.date(d.start)&&P.date(d.finish)?P.workingCount(d.start,d.finish,cal):t.durationAccepted,total:v.total??q?.quantity??front?.totalQty??'',done:front?.doneQty??0,rate:'',start:d.start||d.finish,unit:v.unit||q?.unit||front?.unit||t.unit||'',...saved,calendar:cal,asOf,frontId};
    if((p.quantityBaselines||[]).some(b=>b.key===D.quantityKey(work))&&v.total!==null)result.total=v.total;
    const journal=result.useJournal!==false&&fact.hasFacts;
    if(journal)result.done=fact.actual;
    result.actualStart=dates(p,t,'actual').start||front?.factStart||saved.actualStart||'';
    result.scopeOverrun=P.number(result.total)!==null&&Number(result.done)>Number(result.total);
    const complete=journal?P.number(result.total)!==null&&Number(result.done)>=Number(result.total)&&Number(result.total)>0:Number(t.progressPercent)>=100&&!(P.number(result.total)!==null&&Number(result.total)>Number(result.done));
    result.fixed=complete;
    if(complete){result.start=dates(p,t,'actual').start||front?.factStart||d.start;result.finish=dates(p,t,'actual').finish||front?.factEnd||d.finish;return result;}
    if(journal&&result.mode!=='manual')result.start=max(result.start,tomorrow(asOf));
    if(result.mode==='actual'){
      if(!frontId)throw Error('Для фактического темпа выберите фронт.');
      if(result.useJournal===false)throw Error('Расчёт по фактическому темпу требует использования журнала факта.');
      const observed=pace(p,work,asOf,cal,result.windowDays||7);result.pace=observed;
      if(observed.rate===null)throw Error('Для темпа недостаточно истории после накопительной отсечки.');
      // rate is the TOTAL front pace here; physical resources remain separate.
      result.physicalResources=P.number(saved.physicalResources);result.rate=observed.rate;result.resources=1;result.done=observed.fact.actual;result.start=max(saved.start,tomorrow(asOf));result.resourceSteps=[];
      result.physicalResourceSteps=saved.physicalResourceSteps||saved.resourceSteps||[];
    }
    return result;
  }
  function contractTargets(p,t,asOf){
    const current=(p.scheduleVersions||[]).find(v=>v.id===(t.versionId||t.sourceImportId)),out=[];if(!current)return out;
    const own=(p.tasks||[]).filter(x=>(x.versionId||x.sourceImportId)===current.id&&x.active!==false);
    for(const role of ['customer','contractor']){
      const groups=[...new Set((p.scheduleVersions||[]).filter(v=>v.role===role&&['Принят','Архив'].includes(v.status)).map(v=>v.scheduleKey))];
      for(const group of groups){const v=D.resolveVersion(p,group,asOf);if(!v)continue;
        const other=(p.tasks||[]).filter(x=>(x.versionId||x.sourceImportId)===v.id&&x.active!==false);
        let matching;
        if(v.id===current.id)matching=[t];else{
          const rows=E.compareTasks(p,own,other,x=>dates(p,x)),row=rows.find(r=>(r.oldMembers||[r.old]).some(x=>x?.id===t.id)&&r.now&&r.status!=='Требует сопоставления');
          matching=row?(row.newMembers||[row.now]):[];
        }
        if(!matching.length)continue;
        const ds=matching.map(x=>dates(p,x,'contract')),complete=ds.every(d=>P.date(d.finish));
        out.push({id:role+':'+v.id,role,label:role==='customer'?'Наш договор с Заказчиком':'Договор подрядчика',contractNo:v.contractNo||matching[0].contractNo||'',organization:v.organizationId||'',versionId:v.id,versionName:v.name||v.fileName||'',date:complete?ds.map(d=>d.finish).sort().at(-1):'',notice:matching.length>1?'Срок сопоставленного набора работ':complete?'':'Нет договорной даты'});
      }
    }return out;
  }
  function schemes(p,t){
    const marks=(p.schemeMarks||[]).filter(m=>m.active!==false),valid=new Set((p.schemes||[]).filter(s=>s.active!==false).map(s=>s.id));
    return marks.filter(m=>{const element=(p.numberedElements||[]).find(e=>e.id===m.numberedElementId),group=(p.numberedElementGroups||[]).find(g=>g.id===(m.elementGroupId||element?.groupId));return valid.has(m.schemeId)&&!!t.frontId&&[m.frontId,element?.frontId,group?.frontId].includes(t.frontId);});
  }
  function milestoneView(p,m,asOf){
    const histories=[...(m.forecastHistory||[])].reverse(),preferred=histories.map(h=>(p.scheduleVersions||[]).find(v=>v.id===h.versionId)).filter(v=>v&&['Принят','Архив'].includes(v.status)&&P.date(v.effectiveDate||v.createdAt?.slice(0,10))<=asOf);
    const groups=[...new Set((p.scheduleVersions||[]).filter(v=>v.role==='working'&&['Принят','Архив'].includes(v.status)).map(v=>v.scheduleKey))];
    const candidates=[...preferred,...groups.map(g=>D.resolveVersion(p,g,asOf))].filter(Boolean),seen=new Set();
    for(const version of candidates){if(seen.has(version.id))continue;seen.add(version.id);const tasks=(p.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===version.id&&t.active!==false),view=D.milestoneForecast(p,tasks).find(r=>r.id===m.id);if(view?.finish)return {...view,version};}
    return null;
  }
  function requirement(i,total,actual,deadline,asOf,latestFinish){
    if(total===null||actual===null)return {notice:'Нет подтверждённого объёма или факта',requiredResources:null};
    const remaining=Math.max(0,total-actual);if(!remaining)return {remaining,days:0,requiredResources:0,requiredPace:0,notice:'Объём выполнен; выполнение КД подтверждается отдельно'};
    const target=P.date(latestFinish||deadline),start=max(tomorrow(asOf),i.start,i.availableFrom);
    if(!target)return {remaining,requiredResources:null,notice:'Срок не задан'};
    if(target<start)return {remaining,requiredResources:null,notice:'Срок раньше доступного начала остатка'};
    const rate=P.number(i.mode==='actual'?i.productivityRate:(i.productivityRate||i.rate));
    try{const r=P.reverse({...i,total,done:actual,start,mode:'productivity',rate,resources:i.mode==='actual'?i.physicalResources:i.resources,resourceSteps:i.mode==='actual'?i.physicalResourceSteps:i.resourceSteps},target);return {...r,remaining,start,target,notice:rate>0?'Постоянный состав при заданной выработке на 1 ресурс':'Нужна выработка на 1 ресурс; общий фактический темп её не заменяет'};}catch(e){return {remaining,requiredResources:null,notice:e.message};}
  }
  function overview(p,tasks,{asOf,results,inputs,dependencies=[]}){
    tasks=tasks.map(t=>{try{const i=inputs(t);return {...t,frontId:i.frontId||t.frontId};}catch{return t;}});
    const kd=(p.milestones||[]).filter(m=>m.active!==false),links=p.planningSettings?.milestoneLinks||[],backward=new Map();
    for(const m of kd){const direct=tasks.filter(t=>t.milestoneId===m.id||links.some(l=>l.milestoneId===m.id&&l.key===D.quantityKey(t))),ids=new Set(direct.map(t=>t.id));
      if(!ids.size)continue;let changed=true;while(changed){changed=false;for(const d of dependencies)if(ids.has(d.successorTaskId)&&!ids.has(d.predecessorTaskId)){ids.add(d.predecessorTaskId);changed=true;}}
      const group=tasks.filter(t=>ids.has(t.id)),deps=dependencies.filter(d=>ids.has(d.predecessorTaskId)&&ids.has(d.successorTaskId));
      // A virtual terminal represents only the directly linked works, not incidental branches.
      const terminal={id:'chain-kd-'+m.id,isMilestone:true},all=[...group,terminal],edges=[...deps,...direct.map(t=>({predecessorTaskId:t.id,successorTaskId:terminal.id,linkType:'FF',lagDays:0}))];
      try{const cp=P.criticalPath(all,edges,t=>t===terminal?{mode:'manual',manual:0,start:asOf,calendar:'7x0'}:inputs(t),m.contractDate);backward.set(m.id,{ids,results:cp.results});}catch(e){backward.set(m.id,{ids,error:e.message});}
    }
    return tasks.filter(t=>!t.isSummary&&!t.isMilestone).map(t=>{
      const factual=D.stateAt(p,t,asOf),warnings=[];let i;try{i=inputs(t);}catch(e){i={...t.planning,calendar:E.calendar(p,t.calendar)};warnings.push(e.message);}
      const duplicate=t.frontId&&tasks.filter(x=>!x.isSummary&&!x.isMilestone&&(x.planning?.frontId||x.frontId)===t.frontId).length>1;
      if(duplicate)warnings.push('Один фронт назначен нескольким работам: требуется распределение факта');
      const actual=duplicate?null:factual.actual,remaining=actual===null||factual.total===null?null:Math.max(0,factual.total-actual),targets=contractTargets(p,t,asOf);
      for(const m of kd){const b=backward.get(m.id);if(!b?.ids.has(t.id))continue;targets.push({id:'milestone:'+m.id,role:'milestone',label:'КД: '+m.title,contractNo:m.contractNo||'',date:m.contractDate,latestFinish:b.error?'':b.results.get(t.id)?.lateFinish,blocked:!!b.error,notice:b.error||'С учётом предшествующих и последующих работ'});}
      if(i.target)targets.push({id:'manual:'+t.id,role:'manual',label:'Заданный целевой срок',date:i.target});
      if(!t.frontId)warnings.push('Работа не связана с фронтом: факт и схемы не подключены');
      if(!targets.some(d=>d.role==='customer'))warnings.push('Нет подтверждённого соответствия нашему договорному графику');
      if(!targets.some(d=>d.role==='contractor'))warnings.push('Нет подтверждённого соответствия графику подрядчика');
      let observed;try{observed=pace(p,t,asOf,i.calendar,i.windowDays||7);}catch(e){warnings.push(e.message);}
      const forecast=results?.get(t.id)||dates(p,t),requirements=targets.map(target=>({...target,calculation:target.blocked?{requiredResources:null,notice:target.notice}:requirement(i,factual.total,actual,target.date,asOf,target.latestFinish)}));
      return {taskId:t.id,name:t.name,frontId:t.frontId||'',unit:factual.volume.unit,total:factual.total,actual,remaining,forecast:forecast.finish||'',pace:observed?.rate??null,paceFrom:observed?.from||'',paceDays:observed?.days||0,assigned:P.number(i.mode==='actual'?i.physicalResources:i.resources),resourceKind:i.resourceKind||'resource',pool:i.pool||'',productivity:P.number(i.mode==='actual'?i.productivityRate:(i.productivityRate||i.rate)),schemes:schemes(p,t),targets:requirements,warnings};
    });
  }
  window.LIV_CHAIN={input,pace,contractTargets,schemes,milestoneView,requirement,overview};
})();
