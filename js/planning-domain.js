'use strict';
/* Immutable quantity decisions, dated views and frozen planning reports. */
(function(){
  const P=window.LIV_PLANNING,clone=v=>JSON.parse(JSON.stringify(v));
  const today=()=>new Date().toISOString().slice(0,10);
  const id=prefix=>prefix+'-'+crypto.randomUUID();
  const dayBefore=d=>new Date(Date.parse(d)-86400000).toISOString().slice(0,10);
  function quantityKey(t){return t.volumeKey||(t.frontId?'front:'+t.frontId:'work:'+(t.scheduleKey||t.role||'')+'|'+(t.logicalId||P.identity(t)));}
  function taskVersion(project,t){return (project.scheduleVersions||[]).find(v=>v.id===(t.versionId||t.sourceImportId));}
  function taskDates(project,t,type='working'){return (project.taskDates||[]).filter(d=>d.taskId===t.id&&d.type===type).slice(-1)[0]||{};}
  function resolveVersion(project,group,asOf){
    if(!P.date(asOf))return null;
    return (project.scheduleVersions||[]).filter(v=>['Принят','Архив'].includes(v.status)&&v.scheduleKey===group&&P.date(v.effectiveDate||v.createdAt?.slice(0,10))&&P.date(v.effectiveDate||v.createdAt?.slice(0,10))<=asOf)
      .sort((a,b)=>String(b.effectiveDate||b.createdAt?.slice(0,10)).localeCompare(String(a.effectiveDate||a.createdAt?.slice(0,10)))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))||(Number(b.versionNo)||0)-(Number(a.versionNo)||0))[0]||null;
  }
  function seed(project,t){
    const key=quantityKey(t),saved=(project.quantityBaselines||[]).find(b=>b.key===key);if(saved)return saved;
    const candidates=(project.tasks||[]).filter(x=>quantityKey(x)===key).map(x=>{const q=(project.taskQuantities||[]).find(q=>q.taskId===x.id),v=taskVersion(project,x),date=P.date(v?.effectiveDate||x.effectiveDate||v?.createdAt?.slice(0,10));return {task:x,quantity:P.number(q?.quantity??x.planning?.total),unit:q?.unit||x.planning?.unit||x.unit||'',date,version:v};}).filter(x=>x.quantity!==null&&x.date).sort((a,b)=>a.date.localeCompare(b.date)||String(a.version?.createdAt||'').localeCompare(String(b.version?.createdAt||'')));
    const first=candidates[0],front=(project.fronts||[]).find(f=>f.id===t.frontId),q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),v=taskVersion(project,t);
    return {key,quantity:first?.quantity??P.number(q?.quantity??front?.totalQty??t.planning?.total),unit:first?.unit||q?.unit||front?.unit||t.unit||'',effectiveDate:first?.date||P.date(v?.effectiveDate||v?.createdAt?.slice(0,10))||today(),sourceTaskId:first?.task.id||t.id,sourceVersionId:first?.version?.id||v?.id||'',contract:first?['customer','contractor'].includes(first.version?.role||first.task.role):['customer','contractor'].includes(v?.role||t.role)};
  }
  function approvedChanges(project,key,asOf){return (project.quantityChanges||[]).filter(c=>c.key===key&&c.status==='approved'&&c.effectiveDate<=asOf).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||a.recordedAt.localeCompare(b.recordedAt)||(a.sequence||0)-(b.sequence||0));}
  function volumeAt(project,t,asOf=today()){
    const b=seed(project,t),key=b.key,known=b.quantity!==null&&b.effectiveDate<=asOf;
    let total=known?b.quantity:null,contract=b.contract&&known?b.quantity:null;const changes=approvedChanges(project,key,asOf),warnings=[];
    for(const c of changes){if(total===null){warnings.push('Нет исходного объёма на выбранную дату');continue;}total+=c.delta;if(c.affectsContract&&contract!==null)contract+=c.delta;}
    const resolved=new Set((project.quantityChanges||[]).filter(c=>c.proposalId).map(c=>c.proposalId));
    const proposals=(project.quantityChanges||[]).filter(c=>c.key===key&&c.status==='proposed'&&!resolved.has(c.id)&&c.effectiveDate<=asOf);
    if(total!==null&&total<0)warnings.push('Объём меньше нуля: проверьте решения');
    return {key,original:b.quantity,originalContract:b.contract?b.quantity:null,contract,total,unit:b.unit,effectiveDate:b.effectiveDate,changes,proposals,warnings,known};
  }
  function validateChange(project,t,input){
    const b=seed(project,t),date=P.date(input.effectiveDate),qty=P.number(input.quantity),reason=String(input.reason||'').trim(),document=String(input.document||'').trim(),kind=input.kind,status=input.status||'approved';
    if(!date||!['add','exclude'].includes(kind)||qty===null||qty<=0||!reason||!document||!['approved','proposed'].includes(status))throw Error('Укажите дату, положительный объём, добавление/исключение, причину и основание.');
    if(b.quantity===null||date<b.effectiveDate)throw Error('Сначала задайте исходный объём; изменение не может быть раньше его даты.');
    if(input.unit&&input.unit!==b.unit)throw Error('Единицу измерения нельзя менять решением об объёме.');
    if(input.affectsContract&&!b.contract)throw Error('Для изменения договорного объёма нужен исходный договорный объём.');
    const delta=kind==='exclude'?-qty:qty,row={id:id('QV'),key:b.key,effectiveDate:date,recordedAt:new Date().toISOString(),sequence:(project.quantityChanges||[]).length,kind,delta,status,reason,document,affectsContract:input.affectsContract===true,baseTotal:volumeAt(project,t,date).total,elementNumbers:String(input.elementNumbers||'').split(/[;,\n]+/).map(s=>s.trim()).filter(Boolean)};
    const elements=(project.numberedElements||[]).filter(e=>e.frontId===t.frontId),normal=v=>String(v||'').replace(/^№\s*/,'').trim().toLowerCase();row.elementIds=[];
    for(const token of row.elementNumbers){const found=elements.filter(e=>normal(e.elementNo)===normal(token)||normal(e.elementType+':'+e.elementNo)===normal(token));if(found.length>1)throw Error('Номер элемента неоднозначен: '+token+'. Укажите тип:номер.');if(found.length===1)row.elementIds.push(found[0].id);else if(elements.length&&kind==='exclude')throw Error('Элемент не найден в выбранном фронте: '+token);}
    if(new Set(row.elementIds).size!==row.elementIds.length)throw Error('Один элемент указан несколько раз.');
    if(status==='approved'&&kind==='exclude'&&row.elementIds.some(id=>elementScope(project,{id},date).excluded))throw Error('Один из элементов уже исключён на выбранную дату.');
    if(input.proposalId){const proposal=(project.quantityChanges||[]).find(c=>c.id===input.proposalId&&c.key===b.key&&c.status==='proposed');if(!proposal||(project.quantityChanges||[]).some(c=>c.proposalId===proposal.id))throw Error('Предложение уже рассмотрено или не найдено.');row.proposalId=proposal.id;}
    if(status==='approved'){
      const trial={...project,quantityBaselines:[...(project.quantityBaselines||[]).filter(c=>c.key!==b.key),b],quantityChanges:[...(project.quantityChanges||[]),row]};
      for(const elementId of row.elementIds){let excluded=false;for(const decision of approvedChanges(trial,b.key,'9999-12-31').filter(c=>c.elementIds?.includes(elementId))){if(decision.kind==='exclude'&&excluded)throw Error('Элемент повторно исключается в истории изменений.');excluded=decision.kind==='exclude';}}
      for(const d of new Set([date,...approvedChanges(trial,b.key,'9999-12-31').map(c=>c.effectiveDate)])){const v=volumeAt(trial,t,d);if(v.total<0||v.contract!==null&&v.contract<0)throw Error('Исключение делает объём отрицательным на '+d+'.');}
    }
    return {baseline:b,row};
  }
  function recordChange(project,t,input){
    const {baseline,row}=validateChange(project,t,input);project.quantityBaselines=project.quantityBaselines||[];project.quantityChanges=project.quantityChanges||[];
    if(!project.quantityBaselines.some(b=>b.key===baseline.key))project.quantityBaselines.push(clone(baseline));project.quantityChanges.push(row);
    for(const e of project.numberedElements||[])if(row.elementIds?.includes(e.id))e.customData={...(e.customData||{}),quantityScopeHistory:(project.quantityChanges||[]).filter(c=>c.status==='approved'&&c.elementIds?.includes(e.id)).map(c=>({eventId:c.id,effectiveDate:c.effectiveDate,excluded:c.kind==='exclude',document:c.document}))};
    refreshFront(project,t);return row;
  }
  function decideProposal(project,t,proposalId,approve){
    const proposal=(project.quantityChanges||[]).find(c=>c.id===proposalId&&c.key===quantityKey(t)&&c.status==='proposed');
    if(!proposal||(project.quantityChanges||[]).some(c=>c.proposalId===proposalId))throw Error('Предложение уже рассмотрено или не найдено.');
    if(approve&&proposal.baseTotal!==undefined&&volumeAt(project,t,proposal.effectiveDate).total!==proposal.baseTotal)throw Error('Предложение устарело: объём уже изменён другим решением. Отклоните его и оформите актуальное изменение.');
    if(approve)return recordChange(project,t,{effectiveDate:proposal.effectiveDate,kind:proposal.kind,quantity:Math.abs(proposal.delta),reason:proposal.reason,document:proposal.document,affectsContract:proposal.affectsContract,elementNumbers:proposal.elementNumbers.join(';'),proposalId});
    const row={...clone(proposal),id:id('QV'),status:'rejected',proposalId,recordedAt:new Date().toISOString(),sequence:(project.quantityChanges||[]).length};project.quantityChanges.push(row);return row;
  }
  function factAt(project,t,asOf){
    if(!t.frontId)return {actual:null,hasFacts:false,entries:[],daily:new Map()};
    const rows=window.LIV_FACT_SERIES.primaryRows(project,new Set([String(t.frontId)])),result=window.LIV_FACT_SERIES.series(rows,asOf);return {...result,actual:result.hasFacts?result.actual:null};
  }
  function elementScope(project,element,asOf=today()){
    const changes=(project.quantityChanges||[]).filter(c=>c.status==='approved'&&c.effectiveDate<=asOf&&c.elementIds?.includes(element.id)).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||(a.sequence||0)-(b.sequence||0));const last=changes.at(-1);return {excluded:last?.kind==='exclude',effectiveDate:last?.effectiveDate||'',document:last?.document||''};
  }
  function frontView(project,front,asOf=today()){ 
    const t=(project.tasks||[]).find(t=>t.frontId===front.id&&(project.quantityBaselines||[]).some(b=>b.key===quantityKey(t)))||((project.quantityBaselines||[]).some(b=>b.key==='front:'+front.id)?{id:front.id,frontId:front.id}:null);
    if(!t)return front;
    const state=stateAt(project,t,asOf);return {...front,totalQty:state.total??front.totalQty,doneQty:state.actual??front.doneQty,scopeExcluded:state.total===0,scopeOverrun:state.overrun,quantityAsOf:asOf};
  }
  function refreshFront(project,t){
    const front=(project.fronts||[]).find(f=>f.id===t.frontId);if(!front||!(project.quantityBaselines||[]).some(b=>b.key===quantityKey(t)))return;
    const v=volumeAt(project,t);if(v.total!==null){front.totalQty=v.total;for(const m of project.workMetrics||[])if(m.frontId===front.id&&m.isPrimary&&m.active!==false)m.targetQty=v.total;}
    front.customData={...(front.customData||{}),quantityLedger:{baseline:clone(seed(project,t)),changes:clone((project.quantityChanges||[]).filter(c=>c.key===v.key))}};
    window.LIV_FACT_SERIES.refreshFront(project,front);
  }
  function stateAt(project,t,asOf){const volume=volumeAt(project,t,asOf),fact=factAt(project,t,asOf),actual=fact.actual,total=volume.total;
    const q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),versionQuantity=P.number(q?.quantity??t.planning?.total),versionUnit=q?.unit||t.unit||volume.unit;
    return {key:volume.key,volume,versionUnit,versionQuantity,actual,total,remaining:total===null||actual===null?null:Math.max(0,total-actual),progress:total>0&&actual!==null?Math.min(100,actual/total*100):total===0&&actual===0?100:null,overrun:total!==null&&actual!==null?Math.max(0,actual-total):null,fact};}
  function periodProgress(project,t,from,to){
    const before=stateAt(project,t,dayBefore(from)),now=stateAt(project,t,to),base=before.total;
    return {before,now,gain:before.progress!==null&&now.progress!==null?now.progress-before.progress:null,
      productionGain:base>0&&before.actual!==null&&now.actual!==null?Math.min(100,now.actual/base*100)-Math.min(100,before.actual/base*100):null,
      scopeEffect:base>0&&now.total>0&&now.actual!==null?Math.min(100,now.actual/now.total*100)-Math.min(100,now.actual/base*100):null};
  }
  function comparison(project,left,right,leftDate,rightDate){
    const a=(project.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===left?.id&&t.active!==false),b=(project.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===right?.id&&t.active!==false);
    if(!left||!right)return [];
    const rows=window.LIV_DAILY?window.LIV_DAILY.compareTasks(project,a,b,t=>taskDates(project,t)):P.compare(a,b,t=>taskDates(project,t));
    return rows.map(row=>{const old=row.oldMembers?window.LIV_DAILY.aggregateState(project,row.oldMembers,leftDate):row.old?stateAt(project,row.old,leftDate):null,now=row.newMembers?window.LIV_DAILY.aggregateState(project,row.newMembers,rightDate):row.now?stateAt(project,row.now,rightDate):null;
      return {...row,oldState:old,newState:now,scheduleVolumeDelta:old?.versionQuantity!==null&&now?.versionQuantity!==null&&old&&now?now.versionQuantity-old.versionQuantity:null,volumeDelta:old?.total!==null&&now?.total!==null&&old&&now?now.total-old.total:null,actualDelta:old?.actual!==null&&now?.actual!==null&&old&&now?now.actual-old.actual:null,unitMismatch:!!old&&!!now&&(old.versionUnit||old.volume.unit)!==(now.versionUnit||now.volume.unit)};});
  }
  function validatePlan(project,t,versionId,rows,calendar){
    if(!rows.length)throw Error('Введите хотя бы один период плана.');
    const d=taskDates(project,t),clean=rows.map(r=>({from:P.date(r.from),to:P.date(r.to),quantity:P.number(r.quantity)})).sort((a,b)=>a.from.localeCompare(b.from));
    for(let i=0;i<clean.length;i++){const r=clean[i];if(!r.from||!r.to||r.to<r.from||r.quantity===null||r.quantity<0||r.from<d.start||r.to>d.finish||!P.workingCount(r.from,r.to,calendar))throw Error('Проверьте периоды плана: даты внутри графика, объём неотрицательный и есть рабочие дни.');if(i&&r.from<=clean[i-1].to)throw Error('Периоды плана пересекаются.');}
    const total=P.number((project.taskQuantities||[]).find(q=>q.taskId===t.id)?.quantity??t.planning?.total),offset=P.number(t.planning?.done)||0,expected=total===null?null:Math.max(0,total-offset),sum=clean.reduce((s,r)=>s+r.quantity,0);
    if(expected===null||Math.abs(sum-expected)>1e-6*Math.max(1,expected))throw Error('Сумма периодов должна совпадать с объёмом выбранной версии: '+expected+'. Сначала сохраните новый объём в рабочую версию.');
    return {id:id('QP'),key:quantityKey(t),versionId,taskId:t.id,unit:seed(project,t).unit,rows:clean,total:sum,calendar:clone(calendar),recordedAt:new Date().toISOString()};
  }
  function periodPlan(project,t,from,to,calendar){
    const versionId=t.versionId||t.sourceImportId,record=(project.quantityPlans||[]).filter(p=>p.versionId===versionId&&p.key===quantityKey(t)).slice(-1)[0];
    if(record)return {value:record.rows.reduce((sum,r)=>sum+(P.volumePlan(r.quantity,r.from,r.to,from,to,record.calendar)||0),0),method:'Периодный план',record};
    const q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),total=P.number(q?.quantity??t.planning?.total),offset=t.planning?(P.number(t.planning.done)||0):0,d=taskDates(project,t);
    return {value:P.volumePlan(total===null?null:Math.max(0,total-offset),d.start,d.finish,from,to,calendar),method:'Равномерный расчёт',record:null};
  }
  function milestoneForecast(project,tasks,results){
    const links=(project.planningSettings?.milestoneLinks||[]),out=[];
    for(const m of (project.milestones||[]).filter(m=>m.active!==false)){
      const keys=new Set(links.filter(l=>l.milestoneId===m.id).map(l=>l.key)),matching=tasks.filter(t=>t.milestoneId===m.id||keys.has(quantityKey(t)));
      if(!matching.length)continue;
      const rows=matching.map(t=>({taskId:t.id,key:quantityKey(t),name:t.name,start:results?.get(t.id)?.start||taskDates(project,t).start,finish:results?.get(t.id)?.finish||taskDates(project,t).finish}));
      const missing=rows.some(r=>!r.finish),finish=missing?'':rows.map(r=>r.finish).sort().slice(-1)[0],start=rows.map(r=>r.start).filter(Boolean).sort()[0]||'';
      out.push({id:m.id,title:m.title,contractDate:m.contractDate,start,finish,delta:finish?P.days(m.contractDate,finish):null,missing,works:rows,determining:rows.filter(r=>r.finish===finish).map(r=>r.name),notice:missing?'Не у всех связанных работ задано окончание':''});
    }return out;
  }
  function reviewImportedVolumes(project,version,tasks){
    for(const t of tasks.filter(t=>!t.isMilestone&&!t.isSummary)){
      const key=quantityKey(t),older=(project.tasks||[]).some(x=>(x.versionId||x.sourceImportId)!==version.id&&quantityKey(x)===key);if(!older)continue;
      const q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),quantity=P.number(q?.quantity);if(quantity===null)continue;
      const v=volumeAt(project,t,version.effectiveDate||today());if(v.total===null)continue;
      if(q.unit&&v.unit&&q.unit!==v.unit){t.quantityWarning='Единица новой версии отличается от ведомости. Требуется отдельная работа или подтверждённое сопоставление.';continue;}
      const delta=quantity-v.total;if(Math.abs(delta)<1e-8)continue;
      const decision=(project.quantityChanges||[]).find(c=>c.id===t.quantityDecisionId&&c.key===key&&c.status==='proposed');if(decision&&Math.abs(decision.baseTotal+decision.delta-quantity)<1e-8)continue;
      const change=recordChange(project,t,{effectiveDate:version.effectiveDate||today(),kind:delta>0?'add':'exclude',quantity:Math.abs(delta),status:'proposed',reason:'Объём из новой версии графика',document:version.fileName||version.name||version.id});change.sourceVersionId=version.id;t.quantityWarning='Объём версии отличается от согласованного. Создано предложение в ведомости объёмов.';
    }
  }
  function quantityMetadata(project,t){const key=quantityKey(t);return {key,baseline:(project.quantityBaselines||[]).find(b=>b.key===key)||null,changes:(project.quantityChanges||[]).filter(c=>c.key===key),plans:(project.quantityPlans||[]).filter(p=>p.key===key&&(p.versionId===(t.versionId||t.sourceImportId)))};}
  function freezeReport(project,input){
    if(!input.versionId||!P.date(input.from)||!P.date(input.to)||input.to<input.from)throw Error('Выберите версию и корректный период отчёта.');
    return {id:id('RPT'),reportType:['weekly','customer','internal'].includes(input.reportType)?input.reportType:'internal',reportDate:input.to,previousReportDate:dayBefore(input.from),title:String(input.title||'План / факт').trim(),createdAt:new Date().toISOString(),filters:clone(input.filters||{}),dataSnapshot:clone({schema:'liv-planning/v1',...input,quantityHistory:(project.quantityChanges||[]).filter(c=>input.rows.some(r=>r.key===c.key)),createdAt:new Date().toISOString()})};
  }
  function aggregateReadiness(rows,method='average'){
    const valid=rows.filter(r=>r.current!==null&&r.previous!==null);if(!valid.length)return {current:null,previous:null,gain:null,productionGain:null,scopeEffect:null};
    if(method==='volume'){
      if(new Set(valid.map(r=>r.unit)).size>1)throw Error('Готовность по объёму требует одинаковых единиц.');
      const nowTotal=valid.reduce((s,r)=>s+r.total,0),oldTotal=valid.reduce((s,r)=>s+r.previousTotal,0);if(!(nowTotal>0&&oldTotal>0))return {current:null,previous:null,gain:null};
      const current=valid.reduce((s,r)=>s+Math.min(r.total,r.cumulative),0)/nowTotal*100,previous=valid.reduce((s,r)=>s+Math.min(r.previousTotal,r.previousCumulative),0)/oldTotal*100,atOldScope=valid.reduce((s,r)=>s+Math.min(r.previousTotal,r.cumulative),0)/oldTotal*100;
      return {current,previous,gain:current-previous,productionGain:atOldScope-previous,scopeEffect:current-atOldScope};
    }
    const result=P.readiness(valid,method);let weight=0,productionGain=0,scopeEffect=0;
    for(const r of valid){const w=method==='average'?1:(P.number(r.weight)||0);if(w<=0)continue;if(r.productionGain===null||r.scopeEffect===null)return {...result,productionGain:null,scopeEffect:null};weight+=w;productionGain+=r.productionGain*w;scopeEffect+=r.scopeEffect*w;}
    return {...result,productionGain:weight?productionGain/weight:null,scopeEffect:weight?scopeEffect/weight:null};
  }
  function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');}
  function storageProjection(project){return Object.fromEntries(['workKinds','works','structures','buildings','organizations','contracts','resources','viewBuilder','planningEdits','scheduleMatches','quantityBaselines','quantityChanges','quantityPlans','workMetrics','numberedElements','planningSettings','scheduleVersions','tasks','taskDates','taskQuantities','dependencies','milestones','fronts','progressFacts','reportSnapshots'].map(k=>[k,project[k]||(['planningSettings','viewBuilder'].includes(k)?{}:[])]));}
  window.LIV_PLANNING_DOMAIN={quantityKey,elementScope,reviewImportedVolumes,seed,frontView,refreshFront,resolveVersion,volumeAt,recordChange,decideProposal,factAt,stateAt,periodProgress,comparison,validatePlan,periodPlan,milestoneForecast,quantityMetadata,freezeReport,aggregateReadiness,csv,storageProjection};
})();
