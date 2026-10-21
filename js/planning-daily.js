'use strict';
(function(){
  const P=window.LIV_PLANNING,D=window.LIV_PLANNING_DOMAIN,F=window.LIV_FACT_SERIES,copy=v=>JSON.parse(JSON.stringify(v)),uid=p=>p+'-'+crypto.randomUUID();
  const fields=[['name','Работа','text'],['building','Здание','text'],['block','Блок','text'],['floor','Этаж','text'],['capture','Захватка','text'],['status','Статус','status'],['start','Начало','date'],['finish','Окончание','date'],['quantity','Действующий объём','number'],['unit','Единица','text'],['factDelta','Прирост факта','number'],['factCumulative','Накопительный факт','number'],['mode','Длительность','mode'],['rate','Выработка / ресурс','number'],['resources','Ресурсов','number'],['pool','Общая группа ресурса','text'],['priority','Приоритет','number']];
  const names=['tasks','taskDates','taskQuantities','dependencies','scheduleVersions','scheduleStaging','quantityBaselines','quantityChanges','quantityPlans','progressFacts','factLog','fronts','workMetrics','numberedElements','contracts','milestones','planningSettings','planningEdits','history'];
  const allowedStatuses=['Не начато','В работе','Выполнено','Готово','Сдано','Завершено','СМР приостановлены'];
  function tasksFor(project,id){return (project.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===id&&t.active!==false);}
  function dates(project,t,type='working'){return (project.taskDates||[]).filter(d=>d.taskId===t.id&&d.type===type).at(-1)||{};}
  function calendar(project,c){const own=typeof c==='object'&&c?c:{week:c||'7x0'},s=project.planningSettings||{};return {...own,holidays:[...new Set([...(s.holidays||[]),...(own.taskHolidays||[])])],workingDays:[...new Set([...(s.workingDays||[]).filter(d=>!(own.taskHolidays||[]).includes(d)),...(own.taskWorkingDays||[])])]};}
  function rowValues(project,t,asOf){const d=dates(project,t),v=D.volumeAt(project,t,asOf),q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),input=t.planning||{};return {name:t.name||'',building:t.building||'',block:t.block||'',floor:t.floor??'',capture:t.capture||'',status:t.status||'Не начато',start:d.start||'',finish:d.finish||'',quantity:v.total??q?.quantity??'',unit:v.unit||q?.unit||t.unit||'',factDelta:'',factCumulative:'',mode:input.mode||'manual',rate:(input.mode==='actual'?input.productivityRate:input.rate)??'',resources:input.mode==='actual'?(input.physicalResources??''):(input.resources??1),pool:input.pool||'',priority:input.priority||0};}
  function fingerprint(project){return JSON.stringify(Object.fromEntries(names.map(k=>[k,project[k]||(k==='planningSettings'?{}:[])])));}
  function parseTSV(text){return String(text||'').replace(/\r/g,'').replace(/\n$/,'').split('\n').map(row=>row.split('\t'));}
  function validatePatch(project,t,patch,asOf){
    const value={...rowValues(project,t,asOf),...patch};for(const key of Object.keys(patch))if(!fields.some(f=>f[0]===key))throw Error('Неизвестное поле: '+key);
    const start=P.date(value.start),finish=P.date(value.finish);if(!String(value.name).trim()||!start||!finish||finish<start)throw Error('Работа «'+(t.name||t.id)+'»: проверьте название и обе даты.');
    if(Object.hasOwn(patch,'quantity')&&P.number(value.quantity)===null)throw Error('Объём не может быть пустым. Для полного исключения укажите 0 с основанием.');
    if(t.isMilestone&&value.start!==value.finish)throw Error('У КД начало и окончание должны совпадать.');
    if(!allowedStatuses.includes(value.status)&&Object.hasOwn(patch,'status'))throw Error('Неизвестный статус работы.');
    if(Number(value.floor)<0)throw Error('Подземные этажи не включаются в эту шахматку.');
    if(!['manual','finish','productivity','actual'].includes(value.mode))throw Error('Выберите режим длительности.');
    for(const key of ['quantity','factDelta','factCumulative','rate','resources','priority'])if(value[key]!==''&&(P.number(value[key])===null||P.number(value[key])<0))throw Error('Поле «'+fields.find(f=>f[0]===key)[1]+'» должно быть неотрицательным числом.');
    if(value.factDelta!==''&&value.factCumulative!=='')throw Error('Укажите прирост или накопительный факт, а не оба сразу.');
    if((value.factDelta!==''||value.factCumulative!=='')&&!t.frontId)throw Error('Для ввода факта сначала свяжите работу с фронтом.');
    const seed=D.seed(project,t);if(seed.quantity!==null&&seed.unit&&value.unit!==seed.unit)throw Error('Единицу существующей работы нельзя изменить: нужна отдельная работа.');
    return {...value,start,finish};
  }
  function applyFact(project,t,value,options){
    if(value.factDelta===''&&value.factCumulative==='')return null;
    const factDate=P.date(options.factDate);if(!factDate)throw Error('Укажите дату факта.');
    const metric=(project.workMetrics||[]).find(m=>m.frontId===t.frontId&&m.isPrimary&&m.active!==false),rows=(project.progressFacts||[]).filter(f=>f.frontId===t.frontId&&f.factDate===factDate&&f.active!==false&&(!f.metricId||f.metricId===metric?.id));
    if(rows.length>1)throw Error('На эту дату несколько записей факта. Исправьте нужную запись в журнале.');
    if(rows.length&&!options.replaceFacts)throw Error('На дату уже есть факт. Разрешите исправление существующей записи или выберите другую дату.');
    const previous=rows[0],now=new Date().toISOString(),id=previous?.id||uid('FACT'),type=value.factCumulative!==''?'cumulative_snapshot':'quantity',row={id,frontId:t.frontId,metricId:previous?.metricId||metric?.id||'',factDate,factType:type,quantity:type==='quantity'?P.number(value.factDelta):null,cumulativeQty:type==='cumulative_snapshot'?P.number(value.factCumulative):null,comment:options.reason||'Табличный ввод',createdAt:previous?.createdAt||now,updatedAt:now,sourceFingerprint:previous?.sourceFingerprint||'grid:'+id,active:true};
    project.progressFacts=project.progressFacts||[];project.factLog=project.factLog||[];if(previous)F.replaceFact(project,previous,row);else project.progressFacts.push(row);
    const front=(project.fronts||[]).find(f=>f.id===t.frontId);if(front)F.refreshFront(project,front);return {id,before:previous?copy(previous.revisions?.at(-1)||null):null,after:copy(row)};
  }
  function planningInput(project,t,asOf){
    if(window.LIV_CHAIN)return window.LIV_CHAIN.input(project,t,asOf);
    const input={mode:'manual',resources:1,...t.planning},d=dates(project,t),cal=calendar(project,input.calendar||t.calendar),fact=D.factAt(project,t,asOf),v=D.volumeAt(project,t,asOf),front=(project.fronts||[]).find(f=>f.id===t.frontId);
    Object.assign(input,{calendar:cal,total:v.total??input.total,done:fact.hasFacts?fact.actual:(P.number(input.done)||0),start:input.start||d.start,actualStart:dates(project,t,'actual').start||front?.factStart||'',asOf,frontId:t.frontId||''});
    input.manual=t.isMilestone?0:input.manual??P.workingCount(d.start,d.finish,cal);
    if(input.mode==='actual'){
      if(!t.frontId)throw Error('Для фактического темпа нужен фронт.');const n=Number(input.windowDays)||7,from=new Date(Date.parse(asOf)-(n-1)*86400000).toISOString().slice(0,10),days=P.workingCount(from,asOf,cal),sum=[...fact.daily].filter(([date])=>date>=from&&date<=asOf).reduce((s,[,v])=>s+v,0);input.rate=days?Math.max(0,sum/days):0;input.resources=1;input.start=P.shift(asOf,1,cal);
    }
    if(Number(t.progressPercent)>=100&&(!v.total||input.done>=v.total)){input.fixed=true;input.start=dates(project,t,'actual').start||d.start;input.finish=dates(project,t,'actual').finish||d.finish;}
    return input;
  }
  function prepareEdits(project,versionId,patches,options={}){
    const source=(project.scheduleVersions||[]).find(v=>v.id===versionId);if(!source||!['Принят','Архив'].includes(source.status))throw Error('Выберите сохранённую версию.');
    if((project.scheduleStaging||[]).length)throw Error('Сначала завершите тестовый импорт.');
    const effectiveDate=P.date(options.effectiveDate);if(!effectiveDate||effectiveDate<(source.effectiveDate||''))throw Error('Дата рабочей версии должна быть не раньше исходной версии.');
    if(options.factDate&&(!P.date(options.factDate)||options.factDate>effectiveDate))throw Error('Дата факта должна быть не позже даты рабочей версии.');
    if(options.quantityDate&&(!P.date(options.quantityDate)||options.quantityDate>effectiveDate))throw Error('Дата изменения объёма должна быть не позже даты рабочей версии.');
    const tasks=tasksFor(project,versionId),ids=new Set(tasks.map(t=>t.id));if(!Object.keys(patches).length)throw Error('Нет изменений для сохранения.');
    if(Object.keys(patches).some(id=>!ids.has(id)))throw Error('Изменяемая работа отсутствует в выбранной версии.');
    const baseFingerprint=fingerprint(project),candidate={...project};for(const k of names)candidate[k]=copy(project[k]||(k==='planningSettings'?{}:[]));
    const values=new Map(),decisions=new Map(),facts=[],seenFacts=new Set(),now=new Date().toISOString();
    for(const t of tasks){const patch=patches[t.id];if(!patch)continue;const value=validatePatch(candidate,t,patch,effectiveDate);values.set(t.id,value);
      if(t.isSummary&&['start','finish','quantity','factDelta','factCumulative'].some(k=>Object.hasOwn(patch,k)))throw Error('Даты и объём суммарной строки задаются дочерними работами.');
      const total=D.volumeAt(candidate,t,options.quantityDate||effectiveDate).total,next=P.number(value.quantity);
      if(Object.hasOwn(patch,'quantity')&&total!==null&&next!==total){const delta=next-total,row=D.recordChange(candidate,t,{effectiveDate:options.quantityDate||effectiveDate,kind:delta>0?'add':'exclude',quantity:Math.abs(delta),status:options.quantityStatus||'proposed',reason:options.reason,document:options.document});decisions.set(t.id,row.id);}
      if(value.factDelta!==''||value.factCumulative!==''){if(seenFacts.has(t.frontId))throw Error('Факт одного фронта указан в нескольких строках.');seenFacts.add(t.frontId);facts.push(applyFact(candidate,t,value,options));}
    }
    const id=uid('SVER'),mapping=new Map(tasks.map(t=>[t.id,uid('TASK')])),scheduleKey=source.editorGroup||'working|editor|'+source.scheduleKey,name=source.editorGroup?source.name:'Рабочий: '+(source.name||source.fileName),v={...source,id,name,scheduleKey,editorGroup:scheduleKey,derivedFrom:source.id,role:'working',registerMilestones:false,isBaseline:false,status:'Тест',isCurrent:false,effectiveDate,createdAt:now,acceptedAt:null,versionNo:Math.max(0,...candidate.scheduleVersions.filter(v=>v.scheduleKey===scheduleKey).map(v=>Number(v.versionNo)||0))+1};
    const dependencies=(candidate.dependencies||[]).filter(d=>ids.has(d.predecessorTaskId)&&ids.has(d.successorTaskId));
    const staged=tasks.map(t=>{
      const value=values.get(t.id)||rowValues(candidate,t,effectiveDate),newId=mapping.get(t.id),input={...t.planning,...(value.mode==='actual'?{productivityRate:P.number(value.rate)}:{}),mode:value.mode,manualFinish:value.mode==='finish'?value.finish:(t.planning?.manualFinish||''),rate:P.number(value.rate),physicalResources:P.number(value.resources),resources:P.number(value.resources),pool:value.pool,priority:P.number(value.priority),start:value.start,manual:t.isMilestone?0:P.workingCount(value.start,value.finish,calendar(candidate,t.planning?.calendar||t.calendar)),unit:value.unit},quantity=P.number(value.quantity);
      const task={...t,id:newId,sourceTaskId:newId,versionId:id,sourceImportId:id,volumeKey:D.quantityKey(t),logicalId:t.logicalId||P.identity(t),scheduleKey,role:'working',effectiveDate,name:String(value.name).trim(),building:value.building,block:value.block,floor:value.floor,capture:value.capture,status:value.status,unit:value.unit,parentTaskId:mapping.get(t.parentTaskId)||'',planning:input,quantityDecisionId:decisions.get(t.id)||t.quantityDecisionId};
      const datesRows=(candidate.taskDates||[]).filter(d=>d.taskId===t.id).map(d=>({...d,id:uid('TD'),taskId:newId})),working=datesRows.filter(d=>d.type==='working').at(-1);if(working)Object.assign(working,{start:value.start,finish:value.finish,createdAt:now});else datesRows.push({id:uid('TD'),taskId:newId,type:'working',start:value.start,finish:value.finish,createdAt:now});
      return {task,dates:datesRows,quantities:quantity===null?[]:[{id:uid('TQ'),taskId:newId,quantityType:'primary',quantity,unit:value.unit}],dependencies:dependencies.filter(d=>d.successorTaskId===t.id).map(d=>({...d,id:uid('DEP'),versionId:id,predecessorTaskId:mapping.get(d.predecessorTaskId),successorTaskId:newId}))};
    });
    candidate.scheduleVersions.unshift(v);candidate.scheduleStaging=staged;P.accept(candidate,id);
    const accepted=tasksFor(candidate,id),newDeps=candidate.dependencies.filter(d=>d.versionId===id),inputs=new Map(accepted.map(t=>[t.id,planningInput(candidate,t,effectiveDate)]));
    const results=P.recalculate(accepted,newDeps,t=>inputs.get(t.id));
    for(const t of accepted){const r=results.get(t.id),work=(candidate.taskDates||[]).filter(d=>d.taskId===t.id&&d.type==='working').at(-1);Object.assign(work,{start:r.start,finish:r.finish});t.planning=inputs.get(t.id);t.durationAccepted=r.days;const f=D.factAt(candidate,t,effectiveDate),total=D.volumeAt(candidate,t,effectiveDate).total;if(f.hasFacts&&total>0)t.progressPercent=Math.min(100,f.actual/total*100);}
    for(const forecast of D.milestoneForecast(candidate,accepted,results)){const m=(candidate.milestones||[]).find(m=>m.id===forecast.id);if(m&&forecast.finish){m.forecastHistory=[...(m.forecastHistory||[]),{at:now,previous:m.workDate,next:forecast.finish,versionId:id,works:forecast.works}];m.workDate=forecast.finish;m.updatedAt=now;}}
    const audit={id:uid('EDIT'),at:now,sourceVersionId:versionId,versionId:id,reason:options.reason||'',changes:tasks.filter(t=>patches[t.id]).map(t=>({sourceTaskId:t.id,taskId:mapping.get(t.id),name:t.name,before:rowValues(project,t,effectiveDate),after:rowValues(candidate,accepted.find(x=>x.id===mapping.get(t.id)),effectiveDate),patch:copy(patches[t.id])})),facts,quantityDecisionIds:[...decisions.values()]};candidate.planningEdits.push(audit);
    return {candidate,versionId:id,baseFingerprint,changes:audit.changes,results:[...results].map(([taskId,r])=>({taskId,...r})),sourceVersionId:versionId,audit};
  }
  function commitPrepared(project,prepared){if(fingerprint(project)!==prepared.baseFingerprint)throw Error('Данные изменились после предпросмотра. Подготовьте изменения заново.');for(const k of names)project[k]=copy(prepared.candidate[k]);}
  function member(t){return {name:[t.name,t.building,t.block,t.floor!==''&&t.floor!=null?'Этаж '+t.floor:'',t.capture].filter(Boolean).join(' · '),logicalId:t.logicalId||P.identity(t),key:D.quantityKey(t),originalId:t.id};}
  function memberMatches(t,m){return t.id===m.originalId||(D.quantityKey(t)===m.key&&(t.logicalId||P.identity(t))===m.logicalId);}
  function activeMatches(project,leftGroup,rightGroup){return (project.scheduleMatches||[]).filter(m=>m.active!==false&&((m.leftGroup===leftGroup&&m.rightGroup===rightGroup)||(m.leftGroup===rightGroup&&m.rightGroup===leftGroup)));}
  function confirmMatch(project,leftVersionId,rightVersionId,leftIds,rightIds,reason){
    const a=tasksFor(project,leftVersionId).filter(t=>leftIds.includes(t.id)),b=tasksFor(project,rightVersionId).filter(t=>rightIds.includes(t.id)),left=(project.scheduleVersions||[]).find(v=>v.id===leftVersionId),right=(project.scheduleVersions||[]).find(v=>v.id===rightVersionId);
    if(!left||!right||leftVersionId===rightVersionId||a.length!==leftIds.length||b.length!==rightIds.length||!a.length||!b.length||!String(reason||'').trim())throw Error('Выберите работы двух разных версий и укажите основание соответствия.');
    if(a.some(t=>t.isSummary)||b.some(t=>t.isSummary))throw Error('Сопоставляйте конкретные работы, без суммарных строк.');
    if(new Set([...a,...b].map(t=>t.isMilestone===true)).size>1)throw Error('КД сопоставляется с КД, работа — с работой.');
    const units=new Set([...a,...b].map(t=>(project.taskQuantities||[]).find(q=>q.taskId===t.id)?.unit||t.unit||D.seed(project,t).unit).filter(Boolean));if(units.size>1)throw Error('Для сопоставления объёмов нужны одинаковые единицы.');
    const existing=activeMatches(project,left.scheduleKey,right.scheduleKey);
    for(const m of existing){const forward=m.leftGroup===left.scheduleKey,aa=forward?m.left:m.right,bb=forward?m.right:m.left;if(a.some(t=>aa.some(x=>memberMatches(t,x)))||b.some(t=>bb.some(x=>memberMatches(t,x))))throw Error('Работа уже входит в подтверждённое соответствие. Сначала отмените прежнее соответствие.');}
    const record={id:uid('MATCH'),leftVersionId,rightVersionId,leftGroup:left.scheduleKey,rightGroup:right.scheduleKey,left:a.map(member),right:b.map(member),reason:String(reason).trim(),createdAt:new Date().toISOString(),active:true};project.scheduleMatches=project.scheduleMatches||[];project.scheduleMatches.push(record);return record;
  }
  function revokeMatch(project,id){const m=(project.scheduleMatches||[]).find(m=>m.id===id&&m.active!==false);if(!m)throw Error('Соответствие не найдено.');m.active=false;m.revokedAt=new Date().toISOString();}
  function compareTasks(project,a,b,dateFor){
    const av=(project.scheduleVersions||[]).find(v=>v.id===(a[0]?.versionId||a[0]?.sourceImportId)),bv=(project.scheduleVersions||[]).find(v=>v.id===(b[0]?.versionId||b[0]?.sourceImportId));if(!av||!bv)return P.compare(a,b,dateFor);
    const consumedA=new Set(),consumedB=new Set(),rows=[];
    for(const match of activeMatches(project,av.scheduleKey,bv.scheduleKey)){
      const forward=match.leftGroup===match.rightGroup?!(match.leftVersionId===bv.id&&match.rightVersionId===av.id):match.leftGroup===av.scheduleKey,ma=forward?match.left:match.right,mb=forward?match.right:match.left,aa=a.filter(t=>ma.some(m=>memberMatches(t,m))),bb=b.filter(t=>mb.some(m=>memberMatches(t,m)));
      if(aa.length!==ma.length||bb.length!==mb.length||!ma.every(m=>aa.filter(t=>memberMatches(t,m)).length===1)||!mb.every(m=>bb.filter(t=>memberMatches(t,m)).length===1)||aa.some(t=>consumedA.has(t.id))||bb.some(t=>consumedB.has(t.id)))continue;
      aa.forEach(t=>consumedA.add(t.id));bb.forEach(t=>consumedB.add(t.id));const range=ts=>{const ds=ts.map(dateFor);return {start:ds.every(d=>d.start)?ds.map(d=>d.start).sort()[0]:'',finish:ds.every(d=>d.finish)?ds.map(d=>d.finish).sort().at(-1):''};},before=range(aa),after=range(bb),joined=ts=>({...ts[0],name:ts.map(t=>t.name).join(' + ')});
      rows.push({old:joined(aa),now:joined(bb),oldMembers:aa,newMembers:bb,before,after,startDelta:P.days(before.start,after.start),delta:P.days(before.finish,after.finish),status:aa.length===1&&bb.length===1?'Соответствие подтверждено':'Укрупнённое соответствие',matchId:match.id});
    }
    return [...rows,...P.compare(a.filter(t=>!consumedA.has(t.id)),b.filter(t=>!consumedB.has(t.id)),dateFor)];
  }
  function aggregateState(project,tasks,asOf){
    const states=tasks.map(t=>D.stateAt(project,t,asOf)),unit=states[0]?.volume.unit||'',units=new Set(states.map(s=>s.volume.unit)),unique=[...new Map(states.map(s=>[s.key,s])).values()],fronts=[...new Map(tasks.filter(t=>t.frontId).map(t=>[t.frontId,t])).values()],facts=fronts.map(t=>D.factAt(project,t,asOf));
    const sum=(rows,k)=>rows.every(r=>r[k]!==null)?rows.reduce((s,r)=>s+r[k],0):null,total=units.size===1?sum(unique,'total'):null,actual=fronts.length&&tasks.every(t=>t.frontId)&&facts.every(f=>f.hasFacts)?facts.reduce((s,f)=>s+f.actual,0):null;
    return {total,actual,versionUnit:unit,versionQuantity:units.size===1?sum(states,'versionQuantity'):null,remaining:total!==null&&actual!==null?Math.max(0,total-actual):null,progress:total>0&&actual!==null?Math.min(100,actual/total*100):null,volume:{unit,total},notice:tasks.length!==unique.length?'Общий фронт учтён один раз':''};
  }
  function suggestions(project,a,b){const tokens=v=>new Set(String(v||'').toLowerCase().replace(/[^а-яёa-z0-9]+/g,' ').split(' ').filter(w=>w.length>2)),rows=[];for(const left of a.filter(t=>!t.isSummary)){const l=tokens(left.name);for(const right of b.filter(t=>!t.isSummary&&!!t.isMilestone===!!left.isMilestone)){const r=tokens(right.name),intersection=[...l].filter(x=>r.has(x)).length,score=intersection/Math.max(1,new Set([...l,...r]).size)+(left.building&&left.building===right.building?0.2:0);if(score>=0.4&&D.seed(project,left).unit===D.seed(project,right).unit)rows.push({leftId:left.id,rightId:right.id,score});}}return rows.sort((a,b)=>b.score-a.score).slice(0,8);}
  function impacts(project,tasks,deps,id){const reachable=new Set([id]);let changed=true;while(changed){changed=false;for(const d of deps)if(reachable.has(d.predecessorTaskId)&&!reachable.has(d.successorTaskId)){reachable.add(d.successorTaskId);changed=true;}}const keys=new Set(tasks.filter(t=>reachable.has(t.id)).map(D.quantityKey)),links=project.planningSettings?.milestoneLinks||[];return (project.milestones||[]).filter(m=>m.active!==false&&(links.some(l=>l.milestoneId===m.id&&keys.has(l.key))||tasks.some(t=>reachable.has(t.id)&&t.milestoneId===m.id))).map(m=>({id:m.id,title:m.title,contractDate:m.contractDate}));}
  function management(project,tasks,options){
    const {from,to,results}=options,network=tasksFor(project,tasks[0]?.versionId||tasks[0]?.sourceImportId),all=network.length?network:tasks,deps=(project.dependencies||[]).filter(d=>all.some(t=>t.id===d.predecessorTaskId)&&all.some(t=>t.id===d.successorTaskId)),capacities=project.planningSettings?.capacities||{};
    let load=[];try{const map=results||new Map(all.map(t=>[t.id,{...dates(project,t),remainingStart:dates(project,t).start}]));load=P.resourceLoad(all,map,t=>planningInput(project,t,to),capacities);}catch{}
    return tasks.filter(t=>!t.isSummary&&!t.isMilestone).map(t=>{
      const s=D.stateAt(project,t,to),cal=calendar(project,t.planning?.calendar||t.calendar),contract=dates(project,t,'contract'),baseline=dates(project,t,'baseline'),work=results?.get(t.id)||dates(project,t),target=contract.finish||baseline.finish||dates(project,t).finish,delay=P.days(target,work.finish),plan=D.periodPlan(project,t,dates(project,t).start,to,cal).value,overload=load.filter(l=>l.date>=to&&l.tasks.includes(t.id)&&l.overload>0),problems=[],causes=[],actions=[];
      if(delay>0){problems.push('Окончание позже срока на '+delay+' дн.');causes.push('Расчётный срок '+work.finish+' против '+target);}
      if(s.actual!==null&&plan!==null&&s.actual<plan){problems.push('Объём ниже плана на '+(plan-s.actual).toLocaleString('ru-RU')+' '+s.volume.unit);causes.push('Сравнение накопительного факта с планом версии');}
      if(s.actual===null||s.total===null){problems.push('Недостаточно данных');actions.push(s.total===null?'Задать исходный объём':'Связать фронт и внести факт');}
      if(overload.length){problems.push('Перегрузка ресурса');causes.push([...new Set(overload.map(l=>l.pool))].join(', '));actions.push('Проверить назначения и выполнить выравнивание');}
      const input=planningInputSafe(project,t,to),available=P.date(input.availableFrom);if(available&&available>to){causes.push('Фронт доступен с '+available);actions.push('Подтвердить передачу фронта');}
      if(s.volume.changes.length)causes.push('Объём уточнялся: '+s.volume.original+' → '+s.total+' '+s.volume.unit);
      let required=null;try{if(s.remaining!==null&&target){required=P.reverse({...input,total:s.total,done:s.actual,start:P.shift(to,1,cal)},target);if(required.requiredResources!==null&&required.requiredResources>Number((input.mode==='actual'?input.physicalResources:input.resources)||0))actions.push('Для срока нужно '+required.requiredResources+' ресурсов при заданной выработке');else if(delay>0)actions.push('Проверить последовательность работ и фактический темп');}}catch{if(delay>0)actions.push('Срок истёк: согласовать компенсирующие мероприятия');}
      const assigned=(project.planningSettings?.actions||[]).filter(a=>a.key===D.quantityKey(t)&&a.active!==false).at(-1);
      return {taskId:t.id,key:D.quantityKey(t),name:t.name,organization:t.organizationName||'',unit:s.volume.unit,total:s.total,actual:s.actual,remaining:s.remaining,plan,start:work.start,finish:work.finish,target,delay,problems,causes:assigned?.cause?[assigned.cause,...causes]:causes,actions,required,resources:P.number(input.mode==='actual'?input.physicalResources:input.resources),rate:P.number(input.mode==='actual'?input.productivityRate:input.rate),pool:input.pool||'',impacts:impacts(project,all,deps,t.id),assigned:assigned?copy(assigned):null,severity:overload.length||delay>0?'risk':s.actual===null||s.total===null?'unknown':problems.length?'attention':'ok'};
    });
  }
  function planningInputSafe(project,t,asOf){try{return planningInput(project,t,asOf);}catch{return {...t.planning,calendar:calendar(project,t.calendar)};}}
  function recordAction(project,t,input){if(!String(input.text||'').trim()||!String(input.owner||'').trim()||!P.date(input.due))throw Error('Укажите действие, ответственного и срок.');const settings=project.planningSettings=project.planningSettings||{},key=D.quantityKey(t),prior=(settings.actions||[]).filter(a=>a.key===key&&a.active!==false);prior.forEach(a=>{a.active=false;});const row={id:uid('ACTION'),key,text:String(input.text).trim(),owner:String(input.owner).trim(),cause:String(input.cause||'').trim(),due:P.date(input.due),status:['Открыто','В работе','Выполнено'].includes(input.status)?input.status:'Открыто',at:new Date().toISOString(),active:true,previousIds:prior.map(a=>a.id)};settings.actions=[...(settings.actions||[]),row];return row;}
  function canonical(value){return JSON.stringify(sort(value));function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}}
  async function probeStorage(client){
    if(!client)throw Error('Подключение к серверу недоступно.');
    const user=await client.auth.getUser();if(user.error||!user.data?.user)throw Error('Для проверки серверного сохранения войдите в приложение.');
    const key='liv_planning_probe_'+crypto.randomUUID(),nonce=crypto.randomUUID(),payload={kind:'isolated-planning-probe',nonce,project:{tasks:[{id:'test-work',name:'Контрольная работа'}],taskQuantities:[{taskId:'test-work',quantity:120,unit:'шт.'}],progressFacts:[{frontId:'test-front',factDate:'2026-10-18',factType:'cumulative_snapshot',cumulativeQty:40}]}},row={key,value:payload,updated_by:user.data.user.id,updated_at:new Date().toISOString()};
    let failure=null,result=null;
    try{const write=await client.from('liv_settings').insert(row);if(write.error)throw write.error;const read=await client.from('liv_settings').select('value').eq('key',key).single();if(read.error)throw read.error;if(canonical(read.data?.value)!==canonical(payload))throw Error('Контрольный пример прочитан с расхождениями.');result={key,verified:true,method:'authenticated-client',checkedAt:new Date().toISOString()};}catch(e){failure=e;}
    let cleanup;try{cleanup=await client.from('liv_settings').delete().eq('key',key);}catch(e){throw Error('Удаление контрольной записи не подтверждено: '+key+'. '+e.message);}if(cleanup.error)throw Error('Не удалось удалить только контрольную запись '+key+': '+cleanup.error.message);
    const remaining=await client.from('liv_settings').select('key').eq('key',key).maybeSingle();if(remaining.error||remaining.data)throw Error('Удаление контрольной записи не подтверждено: '+key);
    if(failure)throw Error(failure.message||String(failure));return {...result,cleaned:true};
  }
  window.LIV_DAILY={probeStorage,canonical,fields,allowedStatuses,tasksFor,rowValues,parseTSV,validatePatch,prepareEdits,commitPrepared,confirmMatch,revokeMatch,compareTasks,aggregateState,suggestions,management,recordAction,planningInput,calendar};
})();
