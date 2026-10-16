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
  function workday(d,calendar='7x0') {const w=new Date(d).getUTCDay();return calendar==='5x2'?w!==0&&w!==6:calendar==='6x1'?w!==0:true;}
  function shift(d,n,calendar='7x0') {d=date(d);if(!d||!Number.isFinite(n)||Math.abs(n)>36500)throw Error('Некорректная дата или слишком большая длительность.');const sign=n<0?-1:1;for(let left=Math.ceil(Math.abs(n));left>0;){d=next(d,sign);if(workday(d,calendar))left--;}return d;}
  function startDay(d,calendar) {d=date(d);if(!d)throw Error('Укажите дату начала.');while(!workday(d,calendar))d=next(d);return d;}
  function duration(input) {
    const total=number(input.total),done=number(input.done)??0,rate=number(input.rate),resources=number(input.resources),manual=number(input.manual);
    const remaining=total===null?null:Math.max(0,total-done);
    if(done<0 || (total!==null && total<0))throw Error('Объём не может быть отрицательным.');
    let count;
    if(input.mode==='manual') {if(manual===null||manual<0)throw Error('Укажите длительность не менее нуля.');count=Math.ceil(manual);}
    else {if(remaining===null)throw Error('Укажите общий объём.');if(remaining===0)count=0;else {if(!(rate>0)||!(resources>0))throw Error('Выработка и количество ресурсов должны быть больше нуля.');count=Math.ceil(remaining/(rate*resources));}}
    const start=startDay(input.start,input.calendar),finish=count?shift(start,count-1,input.calendar):start;
    return {remaining,days:count,start,finish,capacity:input.mode==='manual'?null:rate*resources};
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
      rows.push({old,now,before,after,delta,status:ambiguous?'Требует сопоставления':!old?'Добавлено':!now?'Отсутствует':before.start!==after.start||before.finish!==after.finish||old.progressPercent!==now.progressPercent?'Изменено':'Без изменений'});
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
    tasks.forEach(t=>validate(t.id));
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
    const names=['tasks','taskDates','taskQuantities','dependencies','scheduleVersions','scheduleStaging','importHistory','contracts','milestones'];
    const before=Object.fromEntries(names.map(k=>[k,JSON.parse(JSON.stringify(current[k]||[]))]));
    try{mutation();await save();}catch(error){for(const k of names)current[k]=before[k];throw error;}
  }
  window.LIV_PLANNING={persist,date,number,days,workday,shift,duration,identity,compare,currentTasks,accept,recalculate,volumePlan};
})();
