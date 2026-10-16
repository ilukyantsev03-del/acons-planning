'use strict';
(function(){
  const P=window.LIV_PLANNING;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id);
  const state={left:'',right:'',task:'',drafts:{},links:{},preview:null,from:new Date().toISOString().slice(0,7)+'-01',to:new Date().toISOString().slice(0,10)};
  const versionTasks=id=>(project.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===id&&t.active!==false);
  const dates=(task,type='working')=>(project.taskDates||[]).filter(d=>d.taskId===task.id&&d.type===type).slice(-1)[0]||{};
  const label=v=>[v.name||v.fileName,v.role==='customer'?'Заказчик':v.role==='contractor'?'Договор подрядчика':'Рабочий',v.effectiveDate||v.createdAt?.slice(0,10),v.isCurrent===false?'Архив':''].filter(Boolean).join(' · ');
  function host(){
    const panel=el('tab-schedule');if(!panel)return null;
    let h=el('planningTools');if(h)return h;
    h=document.createElement('section');h.id='planningTools';h.className='card planning-tools';panel.appendChild(h);
    h.addEventListener('change',change);h.addEventListener('click',click);return h;
  }
  function selectedInput(task){
    const front=(project.fronts||[]).find(f=>String(f.id)===String((state.drafts[task.id]||task.planning||{}).frontId||task.frontId));
    const q=(project.taskQuantities||[]).find(q=>q.taskId===task.id);
    const d=dates(task),saved=state.drafts[task.id]||task.planning||{};
    let span=null;
    if(d.start&&d.finish){span=0;for(let day=d.start;day<=d.finish;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10))if(P.workday(day,task.calendar||'7x0'))span++;}
    const input={mode:'manual',manual:task.isMilestone?0:span??task.durationAccepted,
      total:front?.totalQty??q?.quantity??'',done:front?.doneQty??0,rate:'',resources:1,start:d.start||d.finish,
      calendar:task.calendar||'7x0',frontId:task.frontId||'',unit:front?.unit||q?.unit||task.unit||'',...saved};
    if(Number(task.progressPercent)>=100){const actual=dates(task,'actual');return {...input,fixed:true,start:actual.start||d.start,finish:actual.finish||d.finish};}
    if(input.mode==='actual'){
      const asOf=input.asOf||new Date().toISOString().slice(0,10),windowDays=Number(input.windowDays)||7;
      if(!P.date(asOf)||!Number.isInteger(windowDays)||windowDays<1||windowDays>366)throw Error('Укажите дату факта и окно темпа от 1 до 366 дней.');
      const rows=window.LIV_FACT_SERIES.primaryRows(project,new Set([String(input.frontId)]));
      const series=window.LIV_FACT_SERIES.series(rows,asOf);
      let count=0,sum=0;const from=new Date(Date.parse(asOf)-(windowDays-1)*86400000).toISOString().slice(0,10);
      for(let d=from;d<=asOf;d=new Date(Date.parse(d)+86400000).toISOString().slice(0,10)){if(P.workday(d,input.calendar))count++;sum+=series.daily.get(d)||0;}
      input.rate=count?Math.max(0,sum/count):0;input.resources=1;input.done=series.actual;input.start=P.shift(asOf,1,input.calendar);
      if(!input.frontId)throw Error('Для фактического темпа выберите фронт.');
    }
    return input;
  }
  function dependenciesFor(tasks){
    const ids=new Set(tasks.map(t=>t.id));
    return [...(project.dependencies||[]).filter(d=>ids.has(d.successorTaskId)&&!Object.hasOwn(state.links,d.successorTaskId)),
      ...Object.entries(state.links).filter(([id])=>ids.has(id)).flatMap(([successorTaskId,links])=>links.map(d=>({...d,successorTaskId})))];
  }
  function readDraft(){
    if(!state.task||!el('planningMode'))return;
    const previous=state.drafts[state.task]||{};
    state.drafts[state.task]={...previous,mode:el('planningMode').value,manual:el('planningManual').value,total:el('planningTotal').value,
      done:el('planningDone').value,rate:el('planningRate').value,resources:el('planningResources').value,start:el('planningStart').value,
      calendar:el('planningCalendar').value,frontId:el('planningFront').value,unit:el('planningUnit').value,asOf:el('planningAsOf').value,windowDays:el('planningWindow').value};
    if(el('planningPredecessors')){
      const previousLinks=dependenciesFor(versionTasks(state.right)).filter(d=>d.successorTaskId===state.task);
      state.links[state.task]=Array.from(el('planningPredecessors').options).filter(o=>o.selected).map(o=>previousLinks.find(d=>d.predecessorTaskId===o.value)||{predecessorTaskId:o.value,linkType:el('planningLinkType').value,lagDays:Number(el('planningLag').value)||0});
    }
    state.preview=null;
  }
  function change(event){
    const id=event.target.id;
    if(id==='planningFrom'||id==='planningTo'){state[id==='planningFrom'?'from':'to']=event.target.value;render();return;}
    if(id==='planningLeft'||id==='planningRight'){readDraft();state[id==='planningLeft'?'left':'right']=event.target.value;state.task='';state.preview=null;}
    else if(id==='planningTask'){readDraft();state.task=event.target.value;}
    else if(id==='planningFront'){
      readDraft();const f=(project.fronts||[]).find(f=>f.id===event.target.value);
      if(f)Object.assign(state.drafts[state.task],{total:f.totalQty,done:window.LIV_FACT_SERIES.series(window.LIV_FACT_SERIES.primaryRows(project,new Set([String(f.id)])),el('planningAsOf').value).actual,unit:f.unit});
    }else if(id==='planningLinkType'||id==='planningLag'){
      readDraft();state.links[state.task]=(state.links[state.task]||[]).map(d=>({...d,linkType:el('planningLinkType').value,lagDays:Number(el('planningLag').value)||0}));
    }else if(id.startsWith('planning'))readDraft();
    render();
  }
  async function click(event){
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.id==='planningCalculate'){
        readDraft();const tasks=versionTasks(state.right),ids=new Set(tasks.map(t=>t.id));
        const dependencies=dependenciesFor(tasks);
        state.preview=P.recalculate(tasks,dependencies,selectedInput);render();
      }
      if(button.id==='planningSave')await saveScenario();
      if(button.id==='planningPrint')window.print();
    }catch(error){alert(error.message);}
  }
  async function saveScenario(){
    if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять график.');
    if(!state.preview)throw Error('Сначала рассчитайте и проверьте прогноз.');
    const source=project.scheduleVersions.find(v=>v.id===state.right);
    if(!confirm('Сохранить расчёт как новую рабочую версию? Договорный график и предыдущие версии сохраняются.'))return;
    const now=new Date().toISOString(),id='SVER-'+crypto.randomUUID(),tasks=versionTasks(state.right),mapping=new Map(tasks.map(t=>[t.id,'TASK-'+crypto.randomUUID()]));
    const group=(source.name||source.fileName).startsWith('Прогноз: ')?(source.name||source.fileName):'Прогноз: '+(source.name||source.fileName),scheduleKey='working|'+group.toLowerCase();
    const v={...source,id,name:group,versionNo:Math.max(0,...project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).map(v=>Number(v.versionNo)||0),project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).length)+1,role:'working',registerMilestones:false,scheduleKey,status:'Тест',effectiveDate:now.slice(0,10),createdAt:now,acceptedAt:null,isCurrent:false,derivedFrom:source.id,rowsCreated:tasks.length};
    if((project.scheduleStaging||[]).length)throw Error('Сначала примите или удалите тестовый импорт, чтобы сохранить прогноз.');
    const staged=tasks.map(t=>{
      const result=state.preview.get(t.id),input=selectedInput(t),newId=mapping.get(t.id);
      const ds=(project.taskDates||[]).filter(d=>d.taskId===t.id).map(d=>({...d,id:'TD-'+crypto.randomUUID(),taskId:newId}));
      const work=ds.filter(d=>d.type==='working').slice(-1)[0];if(work)Object.assign(work,{start:result.start,finish:result.finish,createdAt:now});else ds.push({id:'TD-'+crypto.randomUUID(),taskId:newId,type:'working',start:result.start,finish:result.finish,createdAt:now});
      return {task:{...t,id:newId,versionId:id,sourceImportId:id,scheduleKey,role:'working',effectiveDate:v.effectiveDate,frontId:input.frontId||'',planning:input,calendar:input.calendar,durationAccepted:result.days,parentTaskId:mapping.get(t.parentTaskId)||'',testOnly:true},
        dates:ds,quantities:P.number(input.total)===null?[]:[{id:'TQ-'+crypto.randomUUID(),taskId:newId,name:'Основной объём',quantityType:'primary',quantity:P.number(input.total),unit:input.unit}],
        dependencies:dependenciesFor(tasks).filter(d=>d.successorTaskId===t.id).map(d=>({...d,id:'DEP-'+crypto.randomUUID(),versionId:id,predecessorTaskId:mapping.get(d.predecessorTaskId),successorTaskId:newId}))};
    });
    await P.persist(project,()=>{
      project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);
      for(const t of project.tasks.filter(t=>t.versionId===id&&t.milestoneId)){const m=(project.milestones||[]).find(m=>m.id===t.milestoneId);if(m){m.workDate=dates(t).finish;m.scheduleTaskId=t.id;m.updatedAt=now;}}
      project.importHistory=project.importHistory||[];project.importHistory.unshift({id,type:'schedule',fileName:v.name,derivedFrom:source.id,createdAt:now,rowsCreated:tasks.length});
    },()=>saveProject());state.right=id;state.task='';state.preview=null;renderSchedule();
  }
  function render(){
    if(typeof project==='undefined'||!project)return;
    const h=host();if(!h)return;
    const versions=(project.scheduleVersions||[]).filter(v=>['Принят','Архив'].includes(v.status));
    if(!versions.length){h.innerHTML='<h2>Версии, прогноз и шахматка</h2><p class="muted">Появятся после принятия первого графика.</p>';return;}
    if(!versions.some(v=>v.id===state.right))state.right=versions[0].id;
    if(!versions.some(v=>v.id===state.left))state.left=versions[1]?.id||state.right;
    const tasks=versionTasks(state.right);if(!tasks.some(t=>t.id===state.task))state.task=tasks[0]?.id||'';
    const selected=tasks.find(t=>t.id===state.task);
    let input={},inputError='';if(selected){try{input=selectedInput(selected);}catch(e){input={...selected.planning,...state.drafts[selected.id]};inputError=e.message;}}
    const options=value=>versions.map(v=>'<option value="'+esc(v.id)+'" '+(v.id===value?'selected':'')+'>'+esc(label(v))+'</option>').join('');
    const comparisons=P.compare(versionTasks(state.left),tasks,t=>dates(t));
    const late=comparisons.filter(r=>r.delta>0&&r.status!=='Требует сопоставления'),early=comparisons.filter(r=>r.delta<0&&r.status!=='Требует сопоставления');
    const numField=(id,label,value)=>'<label>'+label+'<input id="'+id+'" type="number" min="0" step="any" value="'+esc(value??'')+'"></label>';
    const version=versions.find(v=>v.id===state.right);
    const links=dependenciesFor(tasks).filter(d=>d.successorTaskId===state.task);
    h.innerHTML=`<h2>Сравнение версий и графиков сторон</h2>
      <div class="planning-grid"><label>С чем сравниваем<select id="planningLeft">${options(state.left)}</select></label><label>Выбранная версия<select id="planningRight">${options(state.right)}</select></label></div>
      <div class="planning-kpis"><span><b>${late.length}</b> работ с более поздним сроком</span><span><b>${early.length}</b> с более ранним сроком</span><span><b>${comparisons.filter(r=>r.status==='Добавлено').length}</b> добавлено</span><span><b>${comparisons.filter(r=>r.status==='Отсутствует').length}</b> отсутствует</span></div>
      <p class="muted">Сопоставление по фронту или точному сочетанию здания, работы, элемента и места. Переименованные и укрупнённые работы автоматически не объединяются. «+» — срок стал позже, «−» — раньше; календарные дни.</p>
      <div class="table-wrap"><table><thead><tr><th>Работа / место</th><th>Было</th><th>Стало</th><th>Изменение срока</th><th>Готовность</th><th>Результат</th></tr></thead><tbody>${comparisons.map(r=>`<tr><td>${esc((r.now||r.old).name)}<small>${esc(context(r.now||r.old))}</small></td><td>${esc(r.before.finish||'—')}</td><td>${esc(r.after.finish||'—')}</td><td class="${r.delta>0?'planning-late':r.delta<0?'planning-early':''}">${r.status==='Требует сопоставления'?'—':r.delta===null?'—':(r.delta>0?'+':'')+r.delta+' дн.'}</td><td>${r.old?Math.round(r.old.progressPercent||0)+'%':'—'} → ${r.now?Math.round(r.now.progressPercent||0)+'%':'—'}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Расчёт оставшейся длительности</h2><p class="muted">${esc(label(version))}. Расчёт создаёт отдельный прогноз. Для нулевого остатка длительность равна нулю. Заданный темп — на один ресурс за производственный день; фактический темп — общий по фронту.</p>
      <label>Работа<select id="planningTask">${tasks.map(t=>`<option value="${esc(t.id)}" ${t.id===state.task?'selected':''}>${esc(t.name+' · '+context(t))}</option>`).join('')}</select></label>
      <div class="planning-grid">
      <label>Режим<select id="planningMode">${[['manual','Вручную'],['productivity','По выработке на ресурс'],['actual','По фактическому темпу фронта']].map(([v,l])=>`<option value="${v}" ${input.mode===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Связанный фронт<select id="planningFront"><option value="">Не выбран</option>${(project.fronts||[]).filter(f=>f.active!==false).map(f=>`<option value="${esc(f.id)}" ${f.id===input.frontId?'selected':''}>${esc(typeof frontLabel==='function'?frontLabel(f):f.name||f.id)}</option>`).join('')}</select></label>
      ${numField('planningManual','Длительность вручную, раб. дн.',input.manual)}${numField('planningTotal','Общий объём',input.total)}${numField('planningDone','Выполнено',input.done)}
      <label>Единица объёма<input id="planningUnit" value="${esc(input.unit||'')}"></label>
      ${numField('planningRate','Выработка на ресурс в день',input.rate)}${numField('planningResources','Количество ресурсов',input.resources)}
      <label>Начало оставшихся работ<input type="date" id="planningStart" value="${esc(input.start||'')}"></label>
      <label>Календарь<select id="planningCalendar">${[['7x0','7 дней'],['6x1','6 дней'],['5x2','5 дней']].map(([v,l])=>`<option value="${v}" ${input.calendar===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Дата факта<input type="date" id="planningAsOf" value="${esc(input.asOf||new Date().toISOString().slice(0,10))}"></label>
      ${numField('planningWindow','Окно темпа, календарных дней',input.windowDays||7)}
      <label>Предшествующие работы (несколько — с Ctrl)<select id="planningPredecessors" multiple size="4">${tasks.filter(t=>t.id!==state.task).map(t=>`<option value="${esc(t.id)}" ${links.some(d=>d.predecessorTaskId===t.id)?'selected':''}>${esc(t.name+' · '+context(t))}</option>`).join('')}</select></label>
      <label>Тип выбранных связей<select id="planningLinkType">${[['FS','Окончание → начало'],['SS','Начало → начало'],['FF','Окончание → окончание'],['SF','Начало → окончание']].map(([v,l])=>`<option value="${v}" ${links[0]?.linkType===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Задержка выбранных связей, раб. дн.<input type="number" id="planningLag" value="${esc(links[0]?.lagDays||0)}"></label>
      </div><p class="muted">Пример: сваи / установка или м³ / рабочий. Увеличение ресурса считается линейным только в этом сценарии. Технологические паузы задаются отдельными задачами и связями. Календарь не учитывает праздничные исключения.</p>
      ${inputError?'<p class="planning-late">'+esc(inputError)+'</p>':''}
      <button class="btn primary" id="planningCalculate">Рассчитать прогноз по связям</button>
      ${state.preview?'<button class="btn" id="planningSave">Сохранить отдельную рабочую версию</button>':''}
      ${state.preview?previewTable(tasks):''}
      ${volumeTable(tasks)}
      <h2>Шахматка выбранной версии</h2><p class="muted">Строки — место выполнения, столбцы — работы. Несколько записей в ячейке показаны отдельно. Приостановленные работы без заливки.</p>
      ${matrix(tasks)}<button class="btn no-print" id="planningPrint">Печать / PDF</button>`;
  }
  const context=t=>[t.building,t.block,t.floor!==''&&t.floor!=null?'Этаж '+t.floor:'',t.capture,t.axis,t.zone,t.element,t.network,t.segment].filter(Boolean).join(' · ');
  function previewTable(tasks){return '<div class="table-wrap"><table><thead><tr><th>Работа</th><th>Остаток</th><th>Рабочих дней</th><th>Начало</th><th>Прогноз</th><th>К исходному окончанию</th></tr></thead><tbody>'+tasks.map(t=>{const r=state.preview.get(t.id),delta=P.days(dates(t).finish,r.finish);return `<tr><td>${esc(t.name+' · '+context(t))}</td><td>${r.remaining??'—'}</td><td>${r.days}</td><td>${r.start}</td><td>${r.finish}</td><td>${delta===null?'—':(delta>0?'+':'')+delta+' дн.'}</td></tr>`;}).join('')+'</tbody></table></div>';}
  function volumeTable(tasks){
    if(!P.date(state.from)||!P.date(state.to)||state.to<state.from)return '<h2>Объёмы: план / факт</h2><div class="planning-grid"><label>С<input type="date" id="planningFrom" value="'+esc(state.from)+'"></label><label>По<input type="date" id="planningTo" value="'+esc(state.to)+'"></label></div><p>Укажите корректный период: окончание не раньше начала.</p>';
    const counts=new Map();for(const t of tasks)if(t.frontId)counts.set(t.frontId,(counts.get(t.frontId)||0)+1);
    const rows=tasks.filter(t=>!t.isMilestone&&!t.isSummary).map(t=>{
      const front=(project.fronts||[]).find(f=>f.id===t.frontId),q=(project.taskQuantities||[]).find(q=>q.taskId===t.id);
      const total=q?.quantity??t.planning?.total,unit=q?.unit||t.unit||t.planning?.unit||'',d=dates(t);
      const plannedTotal=t.planning&&P.number(total)!==null?Math.max(0,P.number(total)-(P.number(t.planning.done)||0)):total;
      const plan=P.volumePlan(plannedTotal,d.start,d.finish,state.from,state.to,t.calendar);
      let actual=null,note=P.number(total)===null?'Объём в версии не задан':'Фронт не связан';
      if(front){
        const facts=window.LIV_FACT_SERIES.primaryRows(project,new Set([String(front.id)]));
        const series=window.LIV_FACT_SERIES.series(facts,state.to),before=new Date(Date.parse(state.from)-86400000).toISOString().slice(0,10);
        if(counts.get(t.frontId)>1)note='Один фронт связан с несколькими задачами — требуется распределение';
        else if(series.entries.some(r=>r.baseline&&r.date>=state.from))note='Начальная отсечка внутри периода: прирост не определён';
        else if(!series.hasFacts)note='Факт не введён';
        else {actual=series.actual-window.LIV_FACT_SERIES.series(facts,before).actual;note='';}
      }
      const fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
      return `<tr><td>${esc(t.name+' · '+context(t))}</td><td>${esc(unit)}</td><td>${fmt(total)}</td><td>${fmt(plan)}</td><td>${fmt(actual)}</td><td>${plan!==null&&actual!==null?fmt(actual-plan):'—'}</td><td>${esc(note)}</td></tr>`;
    });
    return `<h2>Объёмы: план / факт за период</h2><div class="planning-grid"><label>С<input type="date" id="planningFrom" value="${esc(state.from)}"></label><label>По<input type="date" id="planningTo" value="${esc(state.to)}"></label></div><p class="muted">Расчётный план равномерно распределяет объём выбранной версии по её рабочим дням. Для расчётной версии распределяется оставшийся объём. Это оценка, а не договорная разбивка объёмов. Факт берётся из связанного фронта; отсутствие данных не считается нулём. Разные единицы не суммируются.</p><div class="table-wrap"><table><thead><tr><th>Работа</th><th>Ед.</th><th>Общий объём</th><th>Расчётный план</th><th>Факт</th><th>Факт − план</th><th>Примечание</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function matrix(tasks){
    tasks=tasks.filter(t=>!(Number(t.floor)<0));
    const cols=[...new Set(tasks.map(t=>t.name))],rows=[...new Set(tasks.map(t=>context(t)||'Без места'))];
    return '<div class="table-wrap planning-matrix"><table><thead><tr><th>Место</th>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r)+'</th>'+cols.map(c=>'<td>'+tasks.filter(t=>(context(t)||'Без места')===r&&t.name===c).map(t=>{
      const suspended=/приостанов/i.test(t.status||''),progress=Math.round(t.progressPercent||0),d=dates(t);
      return `<div class="planning-cell ${suspended?'':progress>=100?'planning-complete':progress>0?'planning-started':''}"><b>${progress}%</b><small>${esc(t.status||'Не начато')}</small><small>${esc(d.start||'—')} — ${esc(d.finish||'—')}</small></div>`;
    }).join('')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  window.LIV_PLANNING_UI={render};
  document.addEventListener('DOMContentLoaded',render,{once:true});
})();
