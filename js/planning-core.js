'use strict';
/* Pure planning calculations. Dates are UTC calendar dates; no contract dates are mutated. */
(function () {
  const text = v => String(v ?? '').trim();
  const key = v => text(v).toLowerCase().replace(/ё/g,'е').replace(/[\s.,_–—-]+/g,' ').trim();
  function number(v) { if (v === '' || v == null) return null; const n=Number(text(v).replace(/\s/g,'').replace(',','.')); return Number.isFinite(n)?n:null; }
  function date(v) {
    if(v instanceof Date){if(Number.isNaN(v.getTime()))return '';v=v.toISOString().slice(0,10);}
    if(typeof v==='number' && v>20000 && v<80000) v=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
    let s=text(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
    if(!m){const r=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s.*)?$/);if(!r)return '';m=['',r[3].length===2?'20'+r[3]:r[3],r[2],r[1]];}
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
    return d.getUTCFullYear()===+m[1] && d.getUTCMonth()===+m[2]-1 && d.getUTCDate()===+m[3]?d.toISOString().slice(0,10):'';
  }
  const days = (a,b) => date(a)&&date(b)?Math.round((Date.parse(date(b))-Date.parse(date(a)))/86400000):null;
  const next = (d,n=1) => new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
  function workday(d,calendar='7x0') {
    d=date(d);if(!d)return false;
    const c=typeof calendar==='object'&&calendar?calendar:{week:calendar};
    if((c.workingDays||[]).includes(d))return true;
    if((c.holidays||[]).includes(d))return false;
    const w=new Date(d).getUTCDay();return c.week==='5x2'?w!==0&&w!==6:c.week==='6x1'?w!==0:true;
  }
  function shift(d,n,calendar='7x0') {d=date(d);if(!d||!Number.isFinite(n)||Math.abs(n)>36500)throw Error('Некорректная дата или слишком большая длительность.');const sign=n<0?-1:1;for(let left=Math.ceil(Math.abs(n)),guard=0;left>0;){if(++guard>73000)throw Error('Календарь не содержит достаточно рабочих дней.');d=next(d,sign);if(workday(d,calendar))left--;}return d;}
  function startDay(d,calendar) {d=date(d);if(!d)throw Error('Укажите дату начала.');for(let guard=0;!workday(d,calendar);guard++){if(guard>73000)throw Error('Нет рабочих дней в календаре.');d=next(d);}return d;}
  function duration(input) {
    const total=number(input.total),done=number(input.done)??0,rate=number(input.rate),resources=number(input.resources),manual=number(input.manual);
    const remaining=total===null?null:Math.max(0,total-done);
    if(done<0 || (total!==null && total<0))throw Error('Объём не может быть отрицательным.');
    let count;
    if(input.mode==='manual') {if(manual===null||manual<0)throw Error('Укажите длительность не менее нуля.');count=Math.ceil(manual);}
    else {if(remaining===null)throw Error('Укажите общий объём.');if(remaining===0)count=0;else {if(!(rate>0)||!(resources>0)&&!((input.resourceSteps||[]).some(r=>number(r.resources)>0)))throw Error('Выработка и количество ресурсов должны быть больше нуля.');count=(input.resourceSteps||[]).length?0:Math.ceil(remaining/(rate*resources));}}
    const start=startDay(input.availableFrom&&input.availableFrom>input.start?input.availableFrom:input.start,input.calendar);
    let finish=count?shift(start,count-1,input.calendar):start,curve=[];
    if(input.mode!=='manual'&&remaining>0&&(input.resourceSteps||[]).length){
      let left=remaining,day=start;count=0;
      for(let guard=0;left>1e-9;guard++,day=next(day)){
        if(guard>36500)throw Error('Остаток не выполняется за 100 лет: проверьте ресурсы.');
        if(!workday(day,input.calendar))continue;
        const capacity=resourceAt(input,day)*rate;if(capacity<0)throw Error('Ресурс не может быть отрицательным.');
        const quantity=Math.min(left,capacity);left-=quantity;count++;finish=day;curve.push({date:day,quantity,resources:resourceAt(input,day)});
      }
    }
    return {remaining,days:count,start,remainingStart:start,finish,capacity:input.mode==='manual'?null:rate*resources,curve};
  }
  function identity(t) {
    if(t.frontId)return 'front:'+t.frontId;
    if(t.logicalId)return t.logicalId;
    return JSON.stringify([t.building,t.block,t.floor,t.axis,t.capture,t.zone,t.network,t.segment,t.element,t.name].map(key));
  }
  function compare(a,b,dateFor) {
    const sharedFronts=new Set(a.filter(t=>t.frontId&&b.some(u=>u.frontId===t.frontId)).map(t=>t.frontId));
    const comparisonKey=t=>sharedFronts.has(t.frontId)?'front:'+t.frontId:(t.logicalId||identity({...t,frontId:null}));
    const groups=rows=>{const m=new Map();rows.forEach(t=>{const k=comparisonKey(t);if(!m.has(k))m.set(k,[]);m.get(k).push(t);});return m;};
    const left=groups(a),right=groups(b),rows=[];
    for(const k of new Set([...left.keys(),...right.keys()])) {
      const aa=left.get(k)||[],bb=right.get(k)||[],old=aa[0],now=bb[0];
      const before=old?dateFor(old):{},after=now?dateFor(now):{};
      const ambiguous=aa.length>1||bb.length>1;
      const delta=days(before.finish,after.finish);
      rows.push({old,now,before,after,delta,startDelta:days(before.start,after.start),status:ambiguous?'Требует сопоставления':!old?'Добавлено':!now?'Отсутствует':before.start!==after.start||before.finish!==after.finish||old.progressPercent!==now.progressPercent?'Изменено':'Без изменений'});
    }
    return rows;
  }
  function currentTasks(project) {
    const versions=project.scheduleVersions||[],current=new Set(versions.filter(v=>v.status==='Принят'&&v.isCurrent!==false).map(v=>v.id));
    return (project.tasks||[]).filter(t=>t.active!==false&&(!t.sourceImportId||current.has(t.versionId||t.sourceImportId)));
  }
  function registerMilestones(project,version,tasks) {
    if(!version.registerMilestones||version.role==='working')return;
    const org=(project.organizations||[]).find(o=>o.id===version.organizationId);
    if(!org||!text(version.contractNo))throw Error('Для регистрации КД выберите организацию и укажите номер договора.');
    project.contracts=project.contracts||[];project.milestones=project.milestones||[];
    let contract=project.contracts.find(c=>c.organizationId===org.id&&key(c.number)===key(version.contractNo));
    const now=new Date().toISOString();
    if(!contract){contract={id:'CTR-'+crypto.randomUUID(),organizationId:org.id,number:version.contractNo,name:version.contractNo,active:true,createdAt:now,updatedAt:now};project.contracts.push(contract);}
    const importedKeys=new Set();
    for(const task of tasks.filter(t=>t.isMilestone)){
      const milestoneNo=text(task.name.match(/(?:ключев[а-яё]*|контрольн[а-яё]*)\s+дат[а-яё]*\s*№?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1]);
      const importedKey=milestoneNo||key(task.name);
      if(importedKeys.has(importedKey))throw Error('Повторная КД в одном графике: '+task.name);
      importedKeys.add(importedKey);
      const candidates=project.milestones.filter(m=>m.organizationId===org.id&&(m.contractId===contract.id||key(m.contractNo)===key(contract.number))&&(milestoneNo?text(m.milestoneNo)===milestoneNo:key(m.title)===key(task.name)));
      if(candidates.length>1)throw Error('В журнале неоднозначная КД №'+milestoneNo+'. Сначала устраните дубли.');
      let m=candidates[0];
      const d=(project.taskDates||[]).filter(d=>d.taskId===task.id&&d.type==='contract').slice(-1)[0]||{};
      if(!d.finish)throw Error('Не определён договорный срок КД: '+task.name);
      if(!m){m={id:'M-'+crypto.randomUUID(),correspondence:[],createdAt:now,active:true,status:'Не наступила'};project.milestones.push(m);}
      if(m.contractDate&&m.contractDate!==d.finish)m.revisions=[...(m.revisions||[]),{contractDate:m.contractDate,title:m.title,source:m.source,replacedAt:now}];
      const building=(project.buildings||[]).find(b=>key(b.name)===key(task.building));
      Object.assign(m,{organizationId:org.id,contractId:contract.id,contractNo:contract.number,milestoneNo,title:task.name,contractDate:d.finish,
        workDate:m.workDate||d.finish,buildingId:building?.id||m.buildingId||'',scheduleTaskId:task.id,contractScheduleTaskId:task.id,updatedAt:now,
        source:{batchId:version.id,file:version.fileName,sheet:version.sheetName,row:task.sourceRow,importedAt:now}});
      task.milestoneId=m.id;
    }
  }
  function accept(project,versionId) {
    const v=project.scheduleVersions.find(v=>v.id===versionId),staged=project.scheduleStaging||[];
    if(!v||!staged.length||staged.some(x=>x.task.sourceImportId!==versionId))throw Error('Тестовая версия не найдена.');
    if(staged.some(x=>(project.tasks||[]).some(t=>t.id===x.task.id)))throw Error('Задачи этой версии уже записаны.');
    if(v.status!=='Тест')throw Error('Эта версия уже принята.');
    // A version of one schedule never replaces another contractor/customer schedule.
    for(const old of project.scheduleVersions) if(old.id!==v.id&&old.scheduleKey===v.scheduleKey&&old.status==='Принят') {old.isCurrent=false;old.status='Архив';}
    for(const item of staged){project.tasks.push({...item.task,versionId,logicalId:item.task.logicalId||identity(item.task),testOnly:false});project.taskDates.push(...item.dates);project.taskQuantities.push(...item.quantities);}
    const seen=new Set();for(const item of staged)for(const dep of item.dependencies||[]){if(!seen.has(dep.id)){seen.add(dep.id);project.dependencies.push(dep);}}
    registerMilestones(project,v,project.tasks.filter(t=>t.versionId===versionId));
    v.status='Принят';v.isCurrent=true;v.acceptedAt=new Date().toISOString();project.scheduleStaging=[];
  }
  function recalculate(tasks,dependencies,inputs) {
    const byId=new Map(tasks.map(t=>[t.id,t])),results=new Map(),visiting=new Set();
    // Validate every edge even if a completed task keeps its actual dates fixed.
    const checked=new Set(),checking=new Set();
    function validate(id){if(checking.has(id))throw Error('Циклическая связь в графике.');if(checked.has(id))return;if(!byId.has(id))throw Error('Связь с отсутствующей задачей.');checking.add(id);for(const d of dependencies.filter(d=>d.successorTaskId===id))validate(d.predecessorTaskId);checking.delete(id);checked.add(id);}
    for(const d of dependencies){if(!byId.has(d.successorTaskId))throw Error('Связь с отсутствующей задачей.');if(!['FS','SS','FF','SF',undefined].includes(d.linkType))throw Error('Неизвестный тип связи.');if(!Number.isInteger(Number(d.lagDays||0)))throw Error('Задержка связи должна быть целым числом рабочих дней.');}
    tasks.forEach(t=>{validate(t.id);let node=t,seen=new Set();while(node?.parentTaskId){if(seen.has(node.id))throw Error('Цикл в иерархии работ.');seen.add(node.id);node=byId.get(node.parentTaskId);if(!node)throw Error('Отсутствует родительская задача.');}});
    function visit(id) {
      if(results.has(id))return results.get(id);
      if(visiting.has(id))throw Error('Циклическая связь в графике.');
      const t=byId.get(id);if(!t)throw Error('Связь с отсутствующей задачей.');
      visiting.add(id);
      const children=tasks.filter(child=>child.parentTaskId===id);
      if(t.isSummary&&children.length){
        if(dependencies.some(d=>d.successorTaskId===id))throw Error('Перенесите входящую связь суммарной задачи на конкретную работу: '+(t.name||id));
        const values=children.map(child=>visit(child.id)),start=values.map(r=>r.start).sort()[0],finish=values.map(r=>r.finish).sort().slice(-1)[0];
        const result={start,finish,days:days(start,finish)+1,remaining:null};visiting.delete(id);results.set(id,result);return result;
      }
      const input=inputs(t),calendar=input.calendar||'7x0';
      if(input.fixed){const r={start:date(input.start),finish:date(input.finish),days:input.manual||0,remaining:0};if(!r.start||!r.finish)throw Error('У завершённой задачи отсутствуют фактические даты: '+t.name);visiting.delete(id);results.set(id,r);return r;}
      let r;try{r=duration(input);}catch(e){throw Error(t.name+': '+e.message);}
      for(const dep of dependencies.filter(d=>d.successorTaskId===id)) {
        const p=visit(dep.predecessorTaskId),lag=number(dep.lagDays)??0;
        let minimum;
        if(dep.linkType==='SS') minimum=shift(p.start,lag,calendar);
        else if(dep.linkType==='FF'||dep.linkType==='SF') {const end=shift(dep.linkType==='FF'?p.finish:p.start,lag,calendar);minimum=shift(end,-Math.max(0,r.days-1),calendar);}
        else minimum=shift(p.finish,lag+(p.days>0?1:0),calendar);
        if(minimum>r.start)r=duration({...input,start:minimum});
      }
      if(input.actualStart){r.remainingStart=r.start;r.start=date(input.actualStart)||r.start;}
      visiting.delete(id);results.set(id,r);return r;
    }
    tasks.forEach(t=>visit(t.id));return results;
  }
  function volumePlan(total,start,finish,from,to,calendar='7x0') {
    total=number(total);start=date(start);finish=date(finish);from=date(from);to=date(to);
    if(total===null||total<0||!start||!finish||!from||!to||finish<start||to<from)return null;
    let all=0,period=0;
    for(let day=start;day<=finish;day=next(day))if(workday(day,calendar)){all++;if(day>=from&&day<=to)period++;}
    return all?total*period/all:null;
  }
  async function persist(current,mutation,save){
    const names=['fronts','progressFacts','factLog','history','planningSettings','tasks','taskDates','taskQuantities','dependencies','scheduleVersions','scheduleStaging','importHistory','contracts','milestones'];
    const before=Object.fromEntries(names.map(k=>[k,JSON.parse(JSON.stringify(current[k]||(k==='planningSettings'?{}:[])))]));
    try{mutation();await save();}catch(error){for(const k of names)current[k]=before[k];throw error;}
  }

  function resourceAt(input,day){
    let value=number(input.resources)??0;
    for(const row of [...(input.resourceSteps||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)))){
      if(!date(row.date)||number(row.resources)===null||number(row.resources)<0)throw Error('Проверьте дату и количество ресурса.');
      if(row.date<=day)value=number(row.resources);
    }
    return value;
  }
  function workingCount(from,to,calendar){
    if(!date(from)||!date(to)||days(from,to)>36500)throw Error('Укажите период не более 100 лет.');
    let count=0;for(let d=from;d<=to;d=next(d))if(workday(d,calendar))count++;return count;
  }
  function reverse(input,deadline){
    deadline=date(deadline);const start=startDay(input.availableFrom&&input.availableFrom>input.start?input.availableFrom:input.start,input.calendar),remaining=Math.max(0,(number(input.total)||0)-(number(input.done)||0));
    if(!deadline||deadline<start)throw Error('Требуемое окончание раньше начала.');
    const count=workingCount(start,deadline,input.calendar);
    if(!count)throw Error('В периоде нет рабочих дней.');
    let resourceDays=0;for(let d=start;d<=deadline;d=next(d))if(workday(d,input.calendar))resourceDays+=resourceAt(input,d);
    const rate=number(input.rate);
    return {days:count,requiredPace:remaining/count,requiredRate:resourceDays?remaining/resourceDays:null,requiredResources:rate>0?Math.ceil(remaining/(count*rate)):null};
  }
  // Backward pass in date space: each candidate is tested with the same calendar,
  // lag and variable-resource duration as the forward pass. No calendar-day slack approximation.
  function criticalPath(tasks,dependencies,inputs,deadline){
    if(dependencies.some(d=>tasks.some(t=>t.isSummary&&(t.id===d.predecessorTaskId||t.id===d.successorTaskId))))throw Error('Для критического пути задайте связи между конкретными работами, а не суммарными строками.');
    const early=recalculate(tasks,dependencies,inputs),late=new Map(),visiting=new Set();
    const end=date(deadline)||[...early.values()].map(r=>r.finish).sort().slice(-1)[0];
    if(!end)return {results:early,finish:'',deadline:'',critical:[]};
    const byId=new Map(tasks.map(t=>[t.id,t]));
    function latest(id){
      if(late.has(id))return late.get(id);
      if(visiting.has(id))throw Error('Цикл критического пути.');visiting.add(id);
      const t=byId.get(id),input=inputs(t),e=early.get(id),out=dependencies.filter(d=>d.predecessorTaskId===id);
      const children=tasks.filter(c=>c.parentTaskId===id);
      if(t.isSummary&&children.length){const rs=children.map(c=>latest(c.id));const r={...e,lateStart:rs.map(x=>x.lateStart).sort()[0],lateFinish:rs.map(x=>x.lateFinish).sort().slice(-1)[0],totalFloat:Math.min(...rs.map(x=>x.totalFloat)),isCritical:rs.some(x=>x.isCritical)};late.set(id,r);visiting.delete(id);return r;}
      const successors=out.map(d=>({dep:d,result:latest(d.successorTaskId)}));
      if(input.fixed){const r={...e,lateStart:e.start,lateFinish:e.finish,totalFloat:null,isCritical:false,completed:true};late.set(id,r);visiting.delete(id);return r;}
      const feasible=start=>{
        const r=duration({...input,start,actualStart:undefined});
        if(r.finish>end)return false;
        for(const {dep,result:s} of successors){
          if(s.completed)continue;
          const cal=inputs(byId.get(dep.successorTaskId)).calendar,lag=number(dep.lagDays)||0,type=dep.linkType||'FS';
          const anchor=type==='SS'||type==='SF'?(input.actualStart||r.start):r.finish;
          const bound=shift(anchor,lag+(type==='FS'&&r.days>0?1:0),cal);
          if((type==='FS'||type==='SS')?startDay(bound,cal)>(s.remainingStart? s.lateRemainingStart:s.lateStart):bound>s.lateFinish)return false;
        }return true;
      };
      let origin=e.remainingStart||e.start,lo=-Math.min(36500,Math.max(366,Math.abs(days(origin,end))+e.days*3)),hi=Math.min(36500,days(origin,end)+1);
      while(!feasible(next(origin,lo))&&lo>-36500)lo=Math.max(-36500,lo*2);
      if(!feasible(next(origin,lo)))throw Error('Требуемый срок несовместим с доступностью фронта или ресурсами.');
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(feasible(next(origin,mid)))lo=mid;else hi=mid-1;}
      let ls=next(origin,lo);while(!workday(ls,input.calendar))ls=next(ls,-1);
      const lr=duration({...input,start:ls}),float=ls>=origin?workingCount(origin,ls,input.calendar)-1:-(workingCount(ls,origin,input.calendar)-1);
      const r={...e,lateStart:input.actualStart||ls,lateRemainingStart:ls,lateFinish:lr.finish,totalFloat:float,isCritical:float<=0};
      late.set(id,r);visiting.delete(id);return r;
    }
    tasks.forEach(t=>latest(t.id));
    for(const t of tasks){
      const r=late.get(t.id),input=inputs(t);r.earlyStart=r.start;r.earlyFinish=r.finish;
      if(t.isSummary||input.fixed){r.freeFloat=null;continue;}
      const origin=r.remainingStart||r.start,out=dependencies.filter(d=>d.predecessorTaskId===t.id);
      const feasible=start=>{const candidate=duration({...input,start});if(candidate.finish>(out.length?end:[...early.values()].map(v=>v.finish).sort().slice(-1)[0]))return false;
        return out.every(dep=>{const successor=early.get(dep.successorTaskId),cal=inputs(byId.get(dep.successorTaskId)).calendar,type=dep.linkType||'FS',anchor=type==='SS'||type==='SF'?(input.actualStart||candidate.start):candidate.finish,bound=shift(anchor,(number(dep.lagDays)||0)+(type==='FS'&&candidate.days>0?1:0),cal);return type==='FS'||type==='SS'?startDay(bound,cal)<=(successor.remainingStart||successor.start):bound<=successor.finish;});};
      let lo=0,hi=Math.max(0,Math.min(36500,days(origin,end)));while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(feasible(next(origin,mid)))lo=mid;else hi=mid-1;}
      let latestFree=next(origin,lo);while(!workday(latestFree,input.calendar))latestFree=next(latestFree,-1);r.freeFloat=Math.max(0,workingCount(origin,latestFree,input.calendar)-1);
    }
    return {results:late,finish:[...early.values()].map(r=>r.finish).sort().slice(-1)[0],deadline:end,critical:tasks.filter(t=>late.get(t.id).isCritical&&!t.isSummary).map(t=>t.id)};
  }
  function assignments(input,day){
    const rows=(input.assignments||[]).map(a=>({pool:text(a.pool),quantity:number(a.quantity)}));
    if(input.pool)rows.push({pool:text(input.pool),quantity:resourceAt(input,day)});
    const totals=new Map();for(const a of rows){if(!a.pool||a.quantity===null||a.quantity<0)throw Error('Проверьте назначение ресурсов.');totals.set(a.pool,(totals.get(a.pool)||0)+a.quantity);}
    return [...totals].map(([pool,quantity])=>({pool,quantity}));
  }
  function resourceLoad(tasks,results,inputs,capacities={}){
    const map=new Map();
    for(const t of tasks){if(t.isSummary||t.isMilestone)continue;const r=results.get(t.id),input=inputs(t);if(!r)continue;
      for(let d=r.remainingStart||r.start;d<=r.finish;d=next(d))if(workday(d,input.calendar))for(const a of assignments(input,d)){
        const k=d+'|'+a.pool;if(!map.has(k))map.set(k,{date:d,pool:a.pool,used:0,capacity:number(capacities[a.pool]),tasks:[]});
        const row=map.get(k);row.used+=a.quantity;row.tasks.push(t.id);
      }
    }
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.pool.localeCompare(b.pool)).map(r=>({...r,overload:r.capacity!==null?Math.max(0,r.used-r.capacity):null}));
  }
  // Deterministic serial schedule generation; priority first among eligible tasks.
  // All predecessor/successor constraints are recalculated after a shift.
  function levelResources(tasks,deps,inputs,capacities){
    if(deps.some(d=>tasks.some(t=>t.isSummary&&(t.id===d.predecessorTaskId||t.id===d.successorTaskId))))throw Error('Для выравнивания перенесите связи суммарных строк на конкретные работы.');
    const starts=new Map(),wrapped=t=>({...inputs(t),...(starts.has(t.id)?{start:starts.get(t.id)}:{})});
    const before=recalculate(tasks,deps,inputs);let result=before;
    const pending=new Set(tasks.filter(t=>!t.isSummary).map(t=>t.id)),ordered=[];
    while(pending.size){const eligible=tasks.filter(t=>pending.has(t.id)&&!deps.some(d=>d.successorTaskId===t.id&&pending.has(d.predecessorTaskId)));
      if(!eligible.length)throw Error('Ресурсное выравнивание требует связи между конкретными работами.');
      eligible.sort((a,b)=>(number(inputs(b).priority)||0)-(number(inputs(a).priority)||0)||before.get(a.id).start.localeCompare(before.get(b.id).start)||String(a.id).localeCompare(String(b.id)));
      const t=eligible[0];ordered.push(t);pending.delete(t.id);
    }
    const reserved=tasks.filter(t=>inputs(t).fixed&&!t.isSummary),warnings=[];
    for(const t of ordered){const input=wrapped(t);if(input.fixed||t.isMilestone)continue;
      let fit=false;
      for(let guard=0;guard<36500;guard++){
        result=recalculate(tasks,deps,wrapped);const r=result.get(t.id);
        const loads=resourceLoad([...reserved,t],result,wrapped,capacities);
        if(loads.some(row=>row.capacity===null&&row.tasks.includes(t.id)))throw Error('Укажите доступный ресурс для всех назначенных групп.');
        let intrinsic=false;
        for(let day=r.remainingStart||r.start;day<=r.finish;day=next(day))if(workday(day,input.calendar))for(const a of assignments(input,day))if(a.quantity>number(capacities[a.pool]))intrinsic=true;
        if(intrinsic)throw Error('Работе «'+(t.name||t.id)+'» требуется больше ресурса, чем доступно в группе.');
        if(!loads.some(row=>row.overload>0&&row.tasks.includes(t.id))){fit=true;break;}
        starts.set(t.id,shift(r.remainingStart||r.start,1,input.calendar));
      }
      if(!fit)throw Error('Не удалось выровнять ресурсы в пределах 100 лет.');reserved.push(t);
    }
    result=recalculate(tasks,deps,wrapped);
    const load=resourceLoad(tasks,result,wrapped,capacities);if(load.some(r=>r.overload>0))warnings.push('Фиксированный факт содержит перегрузку ресурсов.');
    return {results:result,inputs:wrapped,load,warnings,changes:tasks.filter(t=>before.get(t.id).start!==result.get(t.id).start||before.get(t.id).finish!==result.get(t.id).finish).map(t=>({id:t.id,before:before.get(t.id),after:result.get(t.id)}))};
  }
  function readiness(rows,method='weighted'){
    const valid=rows.filter(r=>number(r.current)!==null&&number(r.previous)!==null);
    if(!valid.length)return {current:null,previous:null,gain:null};
    if(method==='volume'&&new Set(valid.map(r=>r.unit)).size>1)throw Error('Готовность по объёму требует одинаковых единиц измерения.');
    let weight=0,current=0,previous=0;
    for(const r of valid){const w=method==='average'?1:method==='volume'?number(r.total):number(r.weight);if(!(w>0))continue;weight+=w;current+=Math.max(0,Math.min(100,r.current))*w;previous+=Math.max(0,Math.min(100,r.previous))*w;}
    return weight?{current:current/weight,previous:previous/weight,gain:(current-previous)/weight}:{current:null,previous:null,gain:null};
  }

  window.LIV_PLANNING={resourceAt,workingCount,reverse,criticalPath,assignments,resourceLoad,levelResources,readiness,persist,date,number,days,workday,shift,duration,identity,compare,currentTasks,accept,recalculate,volumePlan};
})();
