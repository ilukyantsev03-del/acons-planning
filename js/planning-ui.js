'use strict';
(function(){
  const P=window.LIV_PLANNING,D=window.LIV_PLANNING_DOMAIN;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id);
  let ganttOptions=null;
  const state={gantt:{},left:'',right:'',task:'',drafts:{},links:{},preview:null,critical:null,leveled:null,scenario:0,scenarios:{},settings:null,comparisonMode:'versions',leftDate:'',rightDate:'',leftGroup:'',rightGroup:'',reportId:'',storageMessage:'',settingsProject:null,matrixRow:'place',matrixCol:'name',matrixMetric:'progress',organization:'',organizations:[],method:'average',from:new Date().toISOString().slice(0,7)+'-01',to:new Date().toISOString().slice(0,10)};
  const versionTasks=id=>(project.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===id&&t.active!==false);
  const dates=(task,type='working')=>(project.taskDates||[]).filter(d=>d.taskId===task.id&&d.type===type).slice(-1)[0]||{};
  const label=v=>[v.name||v.fileName,v.role==='customer'?'Заказчик':v.role==='contractor'?'Договор подрядчика':'Рабочий',v.effectiveDate||v.createdAt?.slice(0,10),v.isCurrent===false?'Архив':''].filter(Boolean).join(' · ');
  function host(){
    const panel=el('tab-schedule');if(!panel)return null;
    let h=el('planningTools');if(h)return h;
    h=document.createElement('section');h.id='planningTools';h.className='card planning-tools';panel.appendChild(h);
    h.addEventListener('input',liveInput);h.addEventListener('change',event=>{try{change(event);}catch(e){alert(e.message);}});h.addEventListener('click',click);return h;
  }
  function selectedInput(task){
    const front=(project.fronts||[]).find(f=>String(f.id)===String((state.drafts[task.id]||task.planning||{}).frontId||task.frontId));
    const q=(project.taskQuantities||[]).find(q=>q.taskId===task.id);
    const d=dates(task),saved=state.drafts[task.id]||task.planning||{};
    let span=null;
    if(d.start&&d.finish){span=0;for(let day=d.start;day<=d.finish;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10))if(P.workday(day,task.calendar||'7x0'))span++;}
    const input={mode:'manual',manual:task.isMilestone?0:span??task.durationAccepted,
      total:front?.totalQty??q?.quantity??'',done:front?.doneQty??0,rate:'',resources:1,start:d.start||d.finish,
      calendar:task.calendar||'7x0',actualStart:dates(task,'actual').start||front?.factStart||'',frontId:task.frontId||'',unit:front?.unit||q?.unit||task.unit||'',...saved};
    input.calendar=calendarFor(input.calendar);
    const asOf=input.asOf||new Date().toISOString().slice(0,10),volume=D.volumeAt(project,task,asOf),hasLedger=(project.quantityBaselines||[]).some(b=>b.key===D.quantityKey(task));
    if(hasLedger&&volume.total!==null)input.total=volume.total;
    if(input.frontId&&input.useJournal!==false){const factual=D.factAt(project,{...task,frontId:input.frontId},asOf);if(factual.hasFacts)input.done=factual.actual;}
    input.scopeOverrun=Number(input.done)>Number(input.total)&&P.number(input.total)!==null;
    if(Number(task.progressPercent)>=100&&!(hasLedger&&Number(input.total)>Number(input.done))){const actual=dates(task,'actual');return {...input,fixed:true,start:actual.start||d.start,finish:actual.finish||d.finish};}
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
    state.drafts[state.task]={...previous,useJournal:el('planningUseJournal')?.checked!==false,mode:el('planningMode').value,manual:el('planningManual').value,total:el('planningTotal').value,
      done:el('planningDone').value,rate:el('planningRate').value,resources:el('planningResources').value,start:el('planningStart').value,
      calendar:{week:el('planningCalendar').value,taskHolidays:parseDates(el('planningTaskHolidays')?.value||''),taskWorkingDays:parseDates(el('planningTaskWorkingDays')?.value||'')},resourceSteps:parseSteps(el('planningSteps')?.value||''),pool:el('planningPool')?.value||'',assignments:parseAssignments(el('planningAssignments')?.value||''),priority:el('planningPriority')?.value||0,weight:el('planningWeight')?.value||1,availableFrom:el('planningAvailable')?.value||'',target:el('planningTarget')?.value||'',frontId:el('planningFront').value,unit:el('planningUnit').value,asOf:el('planningAsOf').value,windowDays:el('planningWindow').value};
    if(el('planningPredecessors')){
      const previousLinks=dependenciesFor(versionTasks(state.right)).filter(d=>d.successorTaskId===state.task);
      state.links[state.task]=Array.from(el('planningPredecessors').options).filter(o=>o.selected).map(o=>previousLinks.find(d=>d.predecessorTaskId===o.value)||{predecessorTaskId:o.value,linkType:el('planningLinkType').value,lagDays:Number(el('planningLag').value)||0});
    }
    state.preview=null;state.critical=null;state.leveled=null;
  }
  function change(event){
    const id=event.target.id;
    if(id==='planningComparisonMode'||['planningLeftDate','planningRightDate','planningLeftGroup','planningRightGroup'].includes(id)){
      readDraft();state[{planningComparisonMode:'comparisonMode',planningLeftDate:'leftDate',planningRightDate:'rightDate',planningLeftGroup:'leftGroup',planningRightGroup:'rightGroup'}[id]]=event.target.value;state.preview=null;state.task='';render();return;
    }
    if(id==='planningReportSelect'){state.reportId=event.target.value;render();return;}
    if(id.startsWith('quantity')||id.startsWith('periodPlan')||id.startsWith('planningKD')||id==='planningReportTitle'||id==='planningReportKind'||id==='planningReportTemplate'||id==='planningScenarioName'||id==='planningSavedScenario')return;
    if(['planningRateSlider','planningResourcesSlider'].includes(id))return;
    if(id==='planningView'){const v=(settings().views||[]).find(v=>v.name===event.target.value);if(v){Object.assign(state,v.config);state.task='';state.preview=null;state.critical=null;state.leveled=null;render();}return;}
    if(id==='planningViewName')return;
    if(id==='planningScenario'){readDraft();storeScenario();state.scenario=Number(event.target.value);loadScenario();render();return;}
    if(id==='planningOrganization'){state.organizations=Array.from(event.target.options).filter(o=>o.selected&&o.value).map(o=>o.value);state.organization='';render();return;}
    if(['planningMatrixRow','planningMatrixCol','planningMatrixMetric','planningOrganization','planningMethod'].includes(id)){state[{planningMatrixRow:'matrixRow',planningMatrixCol:'matrixCol',planningMatrixMetric:'matrixMetric',planningOrganization:'organization',planningMethod:'method'}[id]]=event.target.value;render();return;}
    if(['planningHolidays','planningWorkingDays','planningCapacities','planningProjectDeadline'].includes(id)){readSettings();state.preview=null;state.critical=null;state.leveled=null;render();return;}
    if(id==='planningFactRecord'){const row=(project.progressFacts||[]).find(r=>r.id===event.target.value);if(row){el('planningFactDate').value=row.factDate;el('planningFactType').value=row.factType;el('planningFactQuantity').value=row.factType==='cumulative_snapshot'?row.cumulativeQty:row.quantity;el('planningFactComment').value=row.comment||'';}return;}
    if(id.startsWith('manual')||id.startsWith('editTask')||id.startsWith('planningFact'))return;
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
    const button=event.target.closest('button');if(!button||state.busy)return;state.busy=true;button.disabled=true;
    try{
      if(button.dataset.openTask){readDraft();state.task=button.dataset.openTask;render();el('planningTask')?.scrollIntoView?.({block:'center'});return;}
      if(button.dataset.quantityDecision){await decideQuantity(button.dataset.quantityDecision,button.dataset.approve==='yes');return;}
      if(button.id==='quantitySave')await saveQuantity();
      if(button.id==='periodPlanSave')await savePeriodPlan();
      if(button.id==='planningKDLinkSave')await saveKDLinks();
      if(button.id==='planningReportSave')await savePlanningReport();
      if(button.id==='planningReportPrint')printSavedReport();
      if(button.id==='planningReportCsv')downloadSavedReport();
      if(button.id==='planningScenarioStore')await saveNamedScenario();
      if(button.id==='planningScenarioLoad')loadNamedScenario();
      if(button.id==='planningVerifyStorage')await verifyStorage();
      if(button.id==='planningNewSchedule')await createManual();
      if(button.id==='planningEditTask')await editManualTask();
      if(button.id==='planningAddTask')await addManualTask();
      if(button.id==='planningBaseline')await pinBaseline();
      if(button.id==='planningViewSave')await saveView();
      if(button.id==='planningSettingsSave'){readDraft();readSettings();await P.persist(project,()=>{project.planningSettings=structuredCopy(state.settings);},()=>savePlanning());render();}
      if(button.id==='planningLevel'){readDraft();readSettings();const tasks=versionTasks(state.right),deps=dependenciesFor(tasks);state.leveled=P.levelResources(tasks,deps,selectedInput,state.settings.capacities);state.preview=state.leveled.results;state.critical=P.criticalPath(tasks,deps,state.leveled.inputs,settings().deadline);render();}
      if(button.id==='planningCalculate'){
        readDraft();state.leveled=null;const tasks=versionTasks(state.right),ids=new Set(tasks.map(t=>t.id));
        const dependencies=dependenciesFor(tasks);
        state.critical=P.criticalPath(tasks,dependencies,selectedInput,settings().deadline);state.preview=state.critical.results;render();
      }
      if(button.id==='planningSave')await saveScenario();
      if(button.id==='planningFactSave')await saveManualFact();
      if(button.id==='planningPrint')window.print();
    }catch(error){alert(error.message);}finally{state.busy=false;button.disabled=false;}
  }
  async function saveScenario(){
    if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять график.');
    if(!state.preview)throw Error('Сначала рассчитайте и проверьте прогноз.');
    const source=project.scheduleVersions.find(v=>v.id===state.right);
    if(!confirm('Сохранить расчёт как новую рабочую версию? Договорный график и предыдущие версии сохраняются.'))return;
    const now=new Date().toISOString(),id='SVER-'+crypto.randomUUID(),tasks=versionTasks(state.right),mapping=new Map(tasks.map(t=>[t.id,'TASK-'+crypto.randomUUID()]));
    const group=(source.name||source.fileName).startsWith('Прогноз: ')?(source.name||source.fileName):'Прогноз: '+(source.name||source.fileName),scheduleKey='working|'+group.toLowerCase();
    const v={...source,id,name:group,versionNo:Math.max(0,...project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).map(v=>Number(v.versionNo)||0),project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).length)+1,role:'working',registerMilestones:false,scheduleKey,status:'Тест',effectiveDate:now.slice(0,10),createdAt:now,acceptedAt:null,isCurrent:false,derivedFrom:source.id,isBaseline:false,rowsCreated:tasks.length};
    if((project.scheduleStaging||[]).length)throw Error('Сначала примите или удалите тестовый импорт, чтобы сохранить прогноз.');
    const staged=tasks.map(t=>{
      const result=state.preview.get(t.id),input=state.leveled?state.leveled.inputs(t):selectedInput(t),newId=mapping.get(t.id);
      assertQuantityConsistent(t,input);
      const ds=(project.taskDates||[]).filter(d=>d.taskId===t.id).map(d=>({...d,id:'TD-'+crypto.randomUUID(),taskId:newId}));
      const work=ds.filter(d=>d.type==='working').slice(-1)[0];if(work)Object.assign(work,{start:result.start,finish:result.finish,createdAt:now});else ds.push({id:'TD-'+crypto.randomUUID(),taskId:newId,type:'working',start:result.start,finish:result.finish,createdAt:now});
      return {task:{...t,volumeKey:D.quantityKey(t),id:newId,versionId:id,sourceImportId:id,scheduleKey,role:'working',effectiveDate:v.effectiveDate,frontId:input.frontId||'',planning:input,calendar:input.calendar,durationAccepted:result.days,isCritical:state.critical?.results.get(t.id)?.isCritical||false,totalFloat:state.critical?.results.get(t.id)?.totalFloat,parentTaskId:mapping.get(t.parentTaskId)||'',testOnly:true},
        dates:ds,quantities:P.number(input.total)===null?[]:[{id:'TQ-'+crypto.randomUUID(),taskId:newId,name:'Основной объём',quantityType:'primary',quantity:P.number(input.total),unit:input.unit}],
        dependencies:dependenciesFor(tasks).filter(d=>d.successorTaskId===t.id).map(d=>({...d,id:'DEP-'+crypto.randomUUID(),versionId:id,predecessorTaskId:mapping.get(d.predecessorTaskId),successorTaskId:newId}))};
    });
    await P.persist(project,()=>{
      project.planningSettings=structuredCopy(settings());project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);
      const accepted=project.tasks.filter(t=>t.versionId===id);for(const forecast of D.milestoneForecast(project,accepted)){const m=(project.milestones||[]).find(m=>m.id===forecast.id);if(m&&forecast.finish){m.forecastHistory=[...(m.forecastHistory||[]),{at:now,previous:m.workDate,next:forecast.finish,versionId:id,works:forecast.works}];m.workDate=forecast.finish;m.updatedAt=now;const own=accepted.find(t=>t.milestoneId===m.id);if(own)m.scheduleTaskId=own.id;}}
      for(const t of accepted)D.refreshFront(project,t);
      project.importHistory=project.importHistory||[];project.importHistory.unshift({id,type:'schedule',fileName:v.name,derivedFrom:source.id,createdAt:now,rowsCreated:tasks.length});
    },()=>savePlanning());state.right=id;state.task='';state.preview=null;renderSchedule();
  }
  function render(){
    if(typeof project==='undefined'||!project)return;
    const h=host();if(!h)return;
    const openDetails=new Set(Array.from(h.querySelectorAll('details[open]')).map(d=>d.querySelector('summary')?.textContent));
    const versions=(project.scheduleVersions||[]).filter(v=>['Принят','Архив'].includes(v.status));
    if(!versions.length){h.innerHTML=manualForm()+'<p class="muted">Создайте график вручную или загрузите файл.</p>';return;}
    if(!versions.some(v=>v.id===state.right))state.right=versions[0].id;
    if(!versions.some(v=>v.id===state.left))state.left=versions[1]?.id||state.right;
    const resolved=resolveComparison(versions);if(state.comparisonMode==='dates'){state.left=resolved.left?.id||'';state.right=resolved.right?.id||'';}
    if(!resolved.right){h.innerHTML=manualForm()+comparisonControls(versions)+'<p class="planning-late">На выбранную дату нет сохранённой версии этой группы. Выберите другую дату; будущая версия не подставляется.</p>';return;}
    if(state.ganttVersion!==state.right){state.gantt={};state.ganttVersion=state.right;}
    const tasks=versionTasks(state.right);if(!tasks.some(t=>t.id===state.task))state.task=tasks[0]?.id||'';
    const selected=tasks.find(t=>t.id===state.task);
    let input={},inputError='';if(selected){try{input=selectedInput(selected);}catch(e){input={...selected.planning,...state.drafts[selected.id]};inputError=e.message;}}
    const options=value=>versions.map(v=>'<option value="'+esc(v.id)+'" '+(v.id===value?'selected':'')+'>'+esc(label(v))+'</option>').join('');
    const comparisons=D.comparison(project,resolved.left,resolved.right,resolved.leftDate,resolved.rightDate);
    const late=comparisons.filter(r=>r.delta>0&&r.status!=='Требует сопоставления'),early=comparisons.filter(r=>r.delta<0&&r.status!=='Требует сопоставления');
    const numField=(id,label,value)=>'<label>'+label+'<input id="'+id+'" type="number" min="0" step="any" value="'+esc(value??'')+'"></label>';
    const version=versions.find(v=>v.id===state.right);
    const links=dependenciesFor(tasks).filter(d=>d.successorTaskId===state.task);
    h.innerHTML=manualForm()+`<h2>Сравнение версий и графиков сторон</h2>
      ${comparisonControls(versions)}
      <div class="planning-kpis"><span><b>${late.length}</b> работ с более поздним сроком</span><span><b>${early.length}</b> с более ранним сроком</span><span><b>${comparisons.filter(r=>r.status==='Добавлено').length}</b> добавлено</span><span><b>${comparisons.filter(r=>r.status==='Отсутствует').length}</b> отсутствует</span></div>
      <p class="muted">Сопоставление по фронту или точному сочетанию здания, работы, элемента и места. Переименованные и укрупнённые работы автоматически не объединяются. «+» — срок стал позже, «−» — раньше; календарные дни.</p>
      <button class="btn" id="planningBaseline">Закрепить выбранную версию как базовую</button><p class="muted">Базовая версия: ${esc(versions.find(v=>v.isBaseline)?.name||'не закреплена')}. Базовая — закреплённая версия графика любой стороны.</p>
      <div class="table-wrap"><table><thead><tr><th>Работа / место</th><th>Было: начало</th><th>Было: окончание</th><th>Стало: начало</th><th>Стало: окончание</th><th>Сдвиг начала</th><th>Сдвиг окончания</th><th>Объём графика было → стало</th><th>Действующий объём было → стало</th><th>Прирост факта</th><th>Остаток было → стало</th><th>Готовность</th><th>Результат</th></tr></thead><tbody>${comparisons.map(r=>`<tr><td>${esc((r.now||r.old).name)}<small>${esc(context(r.now||r.old))}</small></td><td>${esc(r.before.start||'—')}</td><td>${esc(r.before.finish||'—')}</td><td>${esc(r.after.start||'—')}</td><td>${esc(r.after.finish||'—')}</td><td>${r.status==='Требует сопоставления'?'—':signed(r.startDelta)}</td><td class="${r.delta>0?'planning-late':r.delta<0?'planning-early':''}">${r.status==='Требует сопоставления'?'—':signed(r.delta)}</td><td>${fmt(r.oldState?.versionQuantity)} → ${fmt(r.newState?.versionQuantity)}</td><td>${fmt(r.oldState?.total)} → ${fmt(r.newState?.total)} ${esc(r.newState?.volume.unit||r.oldState?.volume.unit||'')}${r.unitMismatch?'<small>Единицы различаются: объёмы не сравниваются</small>':''}</td><td>${r.unitMismatch?'—':fmt(r.actualDelta)}</td><td>${fmt(r.oldState?.remaining)} → ${fmt(r.newState?.remaining)}</td><td>${fmt(r.oldState?.progress)}% → ${fmt(r.newState?.progress)}%</td><td>${esc(r.status==='Без изменений'&&(r.volumeDelta||r.scheduleVolumeDelta)?'Изменён объём':r.status)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Расчёт оставшейся длительности</h2><p class="muted">${esc(label(version))}. Расчёт создаёт отдельный прогноз. Для нулевого остатка длительность равна нулю. Заданный темп — на один ресурс за производственный день; фактический темп — общий по фронту.</p>
      <label>Работа<select id="planningTask">${tasks.map(t=>`<option value="${esc(t.id)}" ${t.id===state.task?'selected':''}>${esc(t.name+' · '+context(t))}</option>`).join('')}</select></label>
      <div class="planning-grid">
      <label>Режим<select id="planningMode">${[['manual','Вручную'],['productivity','По выработке на ресурс'],['actual','По фактическому темпу фронта']].map(([v,l])=>`<option value="${v}" ${input.mode===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Связанный фронт<select id="planningFront"><option value="">Не выбран</option>${(project.fronts||[]).filter(f=>f.active!==false).map(f=>`<option value="${esc(f.id)}" ${f.id===input.frontId?'selected':''}>${esc(typeof frontLabel==='function'?frontLabel(f):f.name||f.id)}</option>`).join('')}</select></label>
      ${numField('planningManual','Длительность вручную, раб. дн.',input.manual)}${numField('planningTotal','Общий объём',input.total)}${numField('planningDone','Выполнено',input.done)}<label><input id="planningUseJournal" type="checkbox" ${input.useJournal!==false?'checked':''}>Брать факт связанного фронта из журнала</label>
      <label>Единица объёма<input id="planningUnit" value="${esc(input.unit||'')}"></label>
      ${numField('planningRate','Выработка на ресурс в день',input.rate)}${numField('planningResources','Количество ресурсов',input.resources)}
      <label>Начало оставшихся работ<input type="date" id="planningStart" value="${esc(input.start||'')}"></label>
      <label>Календарь<select id="planningCalendar">${[['7x0','7 дней'],['6x1','6 дней'],['5x2','5 дней']].map(([v,l])=>`<option value="${v}" ${(input.calendar?.week||input.calendar)===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Нерабочие даты этой работы<textarea id="planningTaskHolidays">${esc((input.calendar?.taskHolidays||[]).join('\n'))}</textarea></label><label>Рабочие выходные этой работы<textarea id="planningTaskWorkingDays">${esc((input.calendar?.taskWorkingDays||[]).join('\n'))}</textarea></label>
      <label>Дата факта<input type="date" id="planningAsOf" value="${esc(input.asOf||new Date().toISOString().slice(0,10))}"></label>
      ${numField('planningWindow','Окно темпа, календарных дней',input.windowDays||7)}
      <label>Предшествующие работы (несколько — с Ctrl)<select id="planningPredecessors" multiple size="4">${tasks.filter(t=>t.id!==state.task).map(t=>`<option value="${esc(t.id)}" ${links.some(d=>d.predecessorTaskId===t.id)?'selected':''}>${esc(t.name+' · '+context(t))}</option>`).join('')}</select></label>
      <label>Тип выбранных связей<select id="planningLinkType">${[['FS','Окончание → начало'],['SS','Начало → начало'],['FF','Окончание → окончание'],['SF','Начало → окончание']].map(([v,l])=>`<option value="${v}" ${links[0]?.linkType===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Задержка выбранных связей, раб. дн.<input type="number" id="planningLag" value="${esc(links[0]?.lagDays||0)}"></label>
      <label>Общая группа ресурса<input id="planningPool" value="${esc(input.pool||'')}" placeholder="Подрядчик / Буровые"></label>
      ${numField('planningPriority','Приоритет выравнивания (больше — раньше)',input.priority||0)}${numField('planningWeight','Вес работы для готовности',input.weight||1)}
      <label>Фронт доступен с<input type="date" id="planningAvailable" value="${esc(input.availableFrom||'')}"></label>
      <label>Требуемое окончание / КД<input type="date" id="planningTarget" value="${esc(input.target||dates(selected||{},'contract').finish||'')}"></label>
      <label>Количество ресурсов с даты<textarea id="planningSteps" placeholder="2026-10-26 = 4">${esc((input.resourceSteps||[]).map(r=>r.date+' = '+r.resources).join('\n'))}</textarea></label>
      <label>Дополнительные ресурсы на каждый рабочий день<textarea id="planningAssignments" placeholder="Рабочие = 10">${esc((input.assignments||[]).map(r=>r.pool+' = '+r.quantity).join('\n'))}</textarea></label>
      </div>${quantityPanel(tasks,selected,input)}${periodPlanPanel(selected)}${kdPanel(tasks,selected)}${scenarioPanel(selected,input)}${factPanel(input)}${calendarPanel()}${taskEditor(selected)}<p class="muted">Пример: сваи / установка или м³ / рабочий. Увеличение ресурса считается линейным только в этом сценарии. Технологические паузы задаются отдельными задачами и связями. Праздники и рабочие выходные задаются вручную в календаре. Выравнивание учитывает только явно назначенные общие группы ресурсов.</p>
      ${inputError?'<p class="planning-late">'+esc(inputError)+'</p>':''}
      <button class="btn primary" id="planningCalculate">Рассчитать прогноз и критический путь</button><button class="btn" id="planningLevel">Предпросмотр выравнивания ресурсов</button>
      ${state.preview?'<button class="btn" id="planningSave">Сохранить отдельную рабочую версию</button>':''}
      ${gantt(tasks)}${state.preview?'<details><summary>Расчётные сроки и резервы</summary><p>Резервы относятся к технологическим связям. «+» к исходному окончанию — календарные дни.</p>'+previewTable(tasks)+'</details>':''}
      ${volumeTable(tasks)}${reportPanel(tasks)}${storagePanel()}
      <h2>Шахматка выбранной версии</h2><p class="muted">Строки — место выполнения, столбцы — работы. Несколько записей в ячейке показаны отдельно. Приостановленные работы без заливки.</p>
      ${matrixControls()}${matrix(tasks)}<button class="btn no-print" id="planningPrint">Печать / PDF</button>`;
    if(input.frontId&&input.useJournal!==false&&el('planningDone'))el('planningDone').disabled=true;
    window.LIV_DAILY_UI?.render();
    if(window.LIV_GANTT&&ganttOptions)window.LIV_GANTT.mount(el('planningGantt'),ganttOptions,state.gantt,id=>{state.task=id;render();el('planningTask')?.scrollIntoView?.({block:'center'});});
    for(const d of h.querySelectorAll('details'))if(openDetails.has(d.querySelector('summary')?.textContent))d.setAttribute('open','');
  }
  const context=t=>[t.building,t.block,t.floor!==''&&t.floor!=null?'Этаж '+t.floor:'',t.capture,t.axis,t.zone,t.element,t.network,t.segment].filter(Boolean).join(' · ');
  function previewTable(tasks){return '<div data-calculation-preview class="table-wrap"><table><thead><tr><th>Работа</th><th>Остаток</th><th>Рабочих дней</th><th>Начало</th><th>Прогноз</th><th>К исходному окончанию</th><th>Позднее начало</th><th>Позднее окончание</th><th>Общий резерв, раб. дн.</th><th>Свободный резерв, раб. дн.</th></tr></thead><tbody>'+tasks.map(t=>{const r=state.preview.get(t.id),cp=state.critical?.results.get(t.id),delta=P.days(dates(t).finish,r.finish);return `<tr><td>${esc(t.name+' · '+context(t))}</td><td>${r.remaining??'—'}</td><td>${r.days}</td><td>${r.start}</td><td>${r.finish}</td><td>${delta===null?'—':(delta>0?'+':'')+delta+' дн.'}</td><td>${esc(cp?.lateStart||'—')}</td><td>${esc(cp?.lateFinish||'—')}</td><td class="${cp?.isCritical?'planning-late':''}">${cp?.totalFloat??'—'}${cp?.isCritical?' · Критическая':''}</td><td>${cp?.freeFloat??'—'}</td></tr>`;}).join('')+'</tbody></table></div>';}
  function volumeTable(tasks){
    if(!P.date(state.from)||!P.date(state.to)||state.to<state.from)return '<h2>Объёмы: план / факт</h2><div class="planning-grid"><label>С<input type="date" id="planningFrom" value="'+esc(state.from)+'"></label><label>По<input type="date" id="planningTo" value="'+esc(state.to)+'"></label></div><p>Укажите корректный период: окончание не раньше начала.</p>';
    return analytics(tasks);
  }
  function matrix(tasks){
    tasks=filtered(tasks).filter(t=>!(Number(t.floor)<0)&&!t.isSummary&&!t.isMilestone);
    const value=(t,f)=>f==='place'?context(t):f==='organization'?t.organizationName||'Без организации':f==='floor'?(t.floor==null||t.floor===''?'Без этажа':'Этаж '+t.floor):t[f]||'Не указано';
    const cols=[...new Set(tasks.map(t=>value(t,state.matrixCol)))],rows=[...new Set(tasks.map(t=>value(t,state.matrixRow)))];
    return '<div class="table-wrap planning-matrix"><table><thead><tr><th>Место / работа</th>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r)+'</th>'+cols.map(c=>'<td>'+tasks.filter(t=>value(t,state.matrixRow)===r&&value(t,state.matrixCol)===c).map(t=>{
      const stats=taskStats(t),suspended=/приостанов/i.test(t.status||'')||stats.total===0,progress=stats.current??Number(t.progressPercent||0),d=state.preview?.get(t.id)||dates(t),base=dates(t,'contract').finish||dates(t).finish;
      const metric=state.matrixMetric==='forecast'?d.finish||'—':state.matrixMetric==='delta'?signed(P.days(base,d.finish)):state.matrixMetric==='gain'?fmt(stats.productionGain)+' п.п.':state.matrixMetric==='scopeEffect'?fmt(stats.scopeEffect)+' п.п.':state.matrixMetric==='volume'?fmt(stats.cumulative)+' / '+fmt(stats.total)+' '+esc(stats.unit):fmt(progress)+'%';
      return `<button data-open-task="${esc(t.id)}" class="planning-cell ${suspended?'':progress>=100?'planning-complete':progress>0?'planning-started':''}"><b>${metric}</b><small>${esc(stats.total===0?'Исключено из объёма':t.status||'Не начато')}</small><small>${esc(d.start||'—')} — ${esc(d.finish||'—')}</small></button>`;
    }).join('')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  const structuredCopy=v=>JSON.parse(JSON.stringify(v));
  const fmt=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
  const signed=v=>v===null||v===undefined?'—':(v>0?'+':'')+fmt(v)+' дн.';
  function settings(){if(state.settingsProject!==project){state.settingsProject=project;state.settings=null;}return state.settings||(state.settings=structuredCopy(project.planningSettings||{holidays:[],workingDays:[],capacities:{}}));}
  function calendarFor(c){const s=settings(),own=typeof c==='object'&&c?c:{week:c||'7x0'},closed=own.taskHolidays||[],opened=own.taskWorkingDays||[];if(closed.some(d=>opened.includes(d)))throw Error('У работы дата одновременно рабочая и нерабочая.');return {...own,holidays:[...new Set([...(s.holidays||[]),...closed])],workingDays:[...new Set([...(s.workingDays||[]).filter(d=>!closed.includes(d)),...opened])]};}
  function parseDates(v){return String(v||'').split(/[;\s,]+/).filter(Boolean).map(d=>{if(!P.date(d))throw Error('Неверная дата: '+d);return P.date(d);});}
  function lines(v){return String(v||'').split(/\n/).map(s=>s.trim()).filter(Boolean);}
  function parseSteps(v){return lines(v).map(line=>{const [d,n,...rest]=line.split('=');if(rest.length||!P.date(d.trim())||!(P.number(n)>=0)||P.number(n)===null)throw Error('Ресурс с даты: используйте ДД.ММ.ГГГГ = количество.');return {date:P.date(d.trim()),resources:P.number(n)};});}
  function parseAssignments(v){return lines(v).map(line=>{const [pool,n,...rest]=line.split('=');if(rest.length||!pool.trim()||P.number(n)===null||P.number(n)<0)throw Error('Ресурс: используйте название группы = количество.');return {pool:pool.trim(),quantity:P.number(n)};});}
  function readSettings(){
    const dates=id=>lines(el(id)?.value).flatMap(s=>s.split(/[;,\s]+/)).filter(Boolean).map(d=>{if(!P.date(d))throw Error('Неверная дата исключения: '+d);return P.date(d);});
    const candidate={...settings(),deadline:P.date(el('planningProjectDeadline')?.value),holidays:dates('planningHolidays'),workingDays:dates('planningWorkingDays'),capacities:Object.fromEntries(parseAssignments(el('planningCapacities')?.value).map(a=>[a.pool,a.quantity]))};
    if(candidate.holidays.some(d=>candidate.workingDays.includes(d)))throw Error('Одна дата указана и как рабочая, и как нерабочая.');state.settings=candidate;
  }
  function calendarPanel(){const s=settings();return `<details><summary>Календарь проекта и доступные ресурсы</summary><p class="muted">Исключения применяются ко всем выбранным недельным календарям. Даты вводятся вручную; официальные праздники автоматически не загружаются. Для отдельных работ доступны свои исключения, недельный календарь и дата передачи фронта. Исключение работы имеет приоритет над общим календарём. Группы ресурсов должны включать подрядчика, если ресурсы разных организаций не взаимозаменяемы.</p><div class="planning-grid"><label>Требуемое окончание всего графика<input id="planningProjectDeadline" type="date" value="${esc(s.deadline||'')}"></label><label>Нерабочие даты<textarea id="planningHolidays" placeholder="04.11.2026">${esc((s.holidays||[]).join('\n'))}</textarea></label><label>Рабочие выходные<textarea id="planningWorkingDays">${esc((s.workingDays||[]).join('\n'))}</textarea></label><label>Доступно в день по группам<textarea id="planningCapacities" placeholder="Подрядчик / Буровые = 3\nРабочие = 25">${esc(Object.entries(s.capacities||{}).map(([k,v])=>k+' = '+v).join('\n'))}</textarea></label></div><button class="btn" id="planningSettingsSave">Сохранить календарь и лимиты</button></details>`;}
  function storeScenario(){
    state.scenarios[state.scenario]={drafts:structuredCopy(state.drafts),links:structuredCopy(state.links)};
  }
  function loadScenario(){const s=state.scenarios[state.scenario]||state.scenarios[0];state.drafts=structuredCopy(s?.drafts||{});state.links=structuredCopy(s?.links||{});state.preview=null;state.critical=null;state.leveled=null;}
  function scenarioPanel(task,input){
    if(!task)return '';
    const rate=P.number(input.rate)||0,res=P.number(input.resources)||0;
    return `<section class="planning-scenarios"><h3>Что будет, если…</h3><label>Вариант<select id="planningScenario">${['Текущий темп','Усиление','Свой вариант'].map((v,i)=>`<option value="${i}" ${state.scenario===i?'selected':''}>${v}</option>`).join('')}</select></label><div class="planning-grid"><label>Выработка: <output id="planningRateValue">${fmt(rate)}</output><input aria-label="Выработка на ресурс" id="planningRateSlider" type="range" min="0.1" max="${Math.max(10,rate*3)}" step="0.1" value="${rate||0.1}"></label><label>Люди / техника: <output id="planningResourcesValue">${fmt(res)}</output><input aria-label="Количество людей или техники" id="planningResourcesSlider" type="range" min="1" max="${Math.max(50,res*3)}" step="1" value="${res||1}"></label></div><p class="muted">Ползунки переключают выбранную работу в расчёт по выработке. Начало и окончание сценария обновляются сразу. Для пересчёта всех связей нажмите «Рассчитать прогноз и критический путь».</p><div id="planningLive">${scenarioResults(task,input)}</div></section>`;
  }
  function liveInput(event){
    const id=event.target.id;if(!['planningRateSlider','planningResourcesSlider'].includes(id))return;
    try{
      const rate=id==='planningRateSlider';el(rate?'planningRate':'planningResources').value=event.target.value;
      el(rate?'planningRateValue':'planningResourcesValue').textContent=fmt(event.target.value);el('planningMode').value='productivity';
      readDraft();storeScenario();const task=versionTasks(state.right).find(t=>t.id===state.task);el('planningLive').innerHTML=scenarioResults(task,selectedInput(task));
      // Discard stale full-schedule preview and save action until recalculated.
      el('planningSave')?.remove();for(const node of el('planningTools').querySelectorAll('[data-calculation-preview]'))node.remove();
    }catch(e){el('planningLive').textContent=e.message;}
  }
  function scenarioResults(task,input){
    const scenarios=[0,1,2].map(i=>({i,input:i===state.scenario?input:state.scenarios[i]?.drafts?.[task.id]}));
    const target=P.date(input.target)||dates(task,'contract').finish;
    const rows=scenarios.map(({i,input:s})=>{if(!s)return `<tr><td>${['Текущий темп','Усиление','Свой вариант'][i]}</td><td colspan="6">Задайте параметры этого варианта</td></tr>`;try{
      const r=P.duration({...input,...s,calendar:calendarFor(s.calendar||input.calendar)}),done=P.number(s.done)||0,total=P.number(s.total),through=target?forecastQuantity({...input,...s},r,target):null;
      return `<tr><td>${['Текущий темп','Усиление','Свой вариант'][i]}</td><td>${esc(input.actualStart||r.start)}</td><td>${r.finish}</td><td>${r.days}</td><td>${signed(P.days(target,r.finish))}</td><td>${fmt(through===null?null:Math.min(total,done+through))}</td><td>${fmt(s.rate)} × ${fmt(s.resources)}</td></tr>`;
    }catch(e){return `<tr><td>${['Текущий темп','Усиление','Свой вариант'][i]}</td><td colspan="6">${esc(e.message)}</td></tr>`;}}).join('');
    let reverse='';try{if(target){const r=P.reverse(input,target);reverse=`<p>Чтобы успеть к <b>${esc(target)}</b>: общий темп <b>${fmt(r.requiredPace)}</b> ${esc(input.unit||'ед.')}/раб. день; выработка на ресурс <b>${fmt(r.requiredRate)}</b>; при постоянном количестве ресурсов и заданной выработке требуется <b>${fmt(r.requiredResources)}</b> ресурсов.</p>`;}}catch(e){reverse='<p>'+esc(e.message)+'</p>';}
    let chart='';try{chart=scenarioChart(task,input);}catch{}
    return `<div class="table-wrap"><table><thead><tr><th>Сценарий</th><th>Начало</th><th>Окончание</th><th>Раб. дней</th><th>К сроку</th><th>Объём к сроку</th><th>Выработка × ресурс</th></tr></thead><tbody>${rows}</tbody></table></div>${reverse}${chart}${namedScenarioPanel()}`;
  }
  function forecastQuantity(input,r,day){
    if(day<(r.remainingStart||r.start))return 0;
    if(r.curve?.length)return r.curve.filter(x=>x.date<=day).reduce((sum,x)=>sum+x.quantity,0);
    if(r.remaining===null)return null;
    const n=P.workingCount(r.remainingStart||r.start,day<r.finish?day:r.finish,input.calendar);
    return Math.min(r.remaining,input.mode==='manual'?r.days?r.remaining*n/r.days:r.remaining:n*r.capacity);
  }
  function scenarioChart(task,input){
    if(!(P.number(input.total)>0))return '';
    const matched=P.compare(versionTasks(state.left),[task],t=>dates(t)).find(row=>row.now?.id===task.id&&row.old&&row.status!=='Требует сопоставления');const base=matched?matched.before:dates(task),r=P.duration(input),frontId=input.frontId;
    const facts=frontId?window.LIV_FACT_SERIES.primaryRows(project,new Set([String(frontId)])):[],series=window.LIV_FACT_SERIES.series(facts,input.asOf||state.to);
    const scenarios=[{name:'Выбранный сценарий',input,result:r,color:'#c57b19'}];
    for(let i=0;i<3;i++){const s=state.scenarios[i]?.drafts?.[task.id];if(i!==state.scenario&&s){const v={...input,...s,calendar:calendarFor(s.calendar||input.calendar)};try{scenarios.push({name:['Текущий темп','Усиление','Свой вариант'][i],input:v,result:P.duration(v),color:['#718096','#7c5fc7','#b24e7b'][i]});}catch{}}}
    const all=[base.start,base.finish,r.start,...scenarios.map(s=>s.result.finish),...series.entries.map(x=>x.date)].filter(P.date).sort(),start=all[0],finish=all.at(-1),span=Math.max(1,P.days(start,finish)),total=Number(input.total),points=[];
    for(let i=0;i<=Math.min(span,120);i++)points.push(new Date(Date.parse(start)+Math.round(span*i/Math.min(span,120))*86400000).toISOString().slice(0,10));
    const x=d=>55+P.days(start,d)/span*790,y=q=>225-Math.max(0,Math.min(1,q/total))*185;
    const path=(points,color,label)=>`<polyline fill="none" stroke="${color}" stroke-width="3" points="${points.map(([d,q])=>x(d)+','+y(q)).join(' ')}"><title>${esc(label)}</title></polyline>`;
    const plan=base.start&&base.finish?path(points.map(d=>[d,P.volumePlan(total,base.start,base.finish,start,d,input.calendar)||0]),'#98a5b4','План выбранной версии'):'';
    const fact=series.hasFacts?path(series.entries.map(row=>[row.date,window.LIV_FACT_SERIES.series(facts,row.date).actual]),'#167a68','Факт'):'';
    const forecasts=scenarios.map(s=>path(points.filter(d=>d>=(s.result.remainingStart||s.result.start)).map(d=>[d,(Number(s.input.done)||0)+(forecastQuantity(s.input,s.result,d)||0)]),s.color,s.name)).join('');
    return `<figure class="planning-chart"><svg viewBox="0 0 900 265" role="img" aria-label="Накопительный план, факт и сценарии прогноза"><path d="M55 30V225H850" fill="none" stroke="#cbd5e1"/><text x="5" y="42">${fmt(total)}</text><text x="30" y="230">0</text>${plan}${fact}${forecasts}<text x="55" y="255">${start}</text><text x="740" y="255">${finish}</text></svg><figcaption>Серый — расчётный план версии сравнения (при отсутствии соответствия — выбранной); зелёный — факт; оранжевый — выбранный сценарий; фиолетовый и розовый — сохранённые в сеансе варианты. Ед.: ${esc(input.unit||'не задана')}. Расчёт одной работы без влияния связей.</figcaption></figure>`;
  }
  function manualForm(){return `<details class="planning-manual"><summary>Создать график вручную / вставить строки из Excel</summary><div class="planning-grid"><label>Название / группа<input id="manualName" placeholder="Паркинг / договор Строитель"></label><label>Назначение<select id="manualRole"><option value="working">Рабочий</option><option value="contractor">Договор подрядчика</option><option value="customer">График Заказчика</option></select></label><label>Дата версии<input id="manualDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Организация<select id="manualOrganization"><option value="">Не выбрана</option>${(project.organizations||[]).filter(o=>o.active!==false).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></label><label>Номер договора<input id="manualContract"></label><label><input id="manualRegisterKD" type="checkbox">Зарегистрировать КД в журнале</label></div><p>Вставьте строки без шапки, столбцы разделяйте табуляцией: <b>Работа · Здание · Блок · Этаж · Элемент · Захватка · Объём · Единица · Начало · Окончание · КД (да/нет) · Готовность, %</b>. Пустые поля допустимы, обязательны работа и обе даты. Для КД даты совпадают. Даты: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД.</p><textarea id="manualRows" rows="5" placeholder="Сваи&#9;Паркинг&#9;&#9;&#9;&#9;1&#9;120&#9;шт.&#9;19.10.2026&#9;15.11.2026&#9;нет&#9;0"></textarea><button class="btn primary" id="planningNewSchedule">Создать график из строк</button></details>`;}
  function assertEdit(){if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять график.');if((project.scheduleStaging||[]).length)throw Error('Сначала завершите текущий тестовый импорт.');}
  async function createManual(){
    assertEdit();const name=el('manualName').value.trim(),role=el('manualRole').value,effectiveDate=P.date(el('manualDate').value),org=(project.organizations||[]).find(o=>o.id===el('manualOrganization').value);
    if(!name||!effectiveDate)throw Error('Укажите название графика и дату версии.');
    const id='SVER-'+crypto.randomUUID(),now=new Date().toISOString(),scheduleKey=role+'|'+name.toLowerCase();
    const rows=lines(el('manualRows').value);if(!rows.length)throw Error('Введите хотя бы одну работу.');
    const staged=rows.map((line,index)=>{const [title,building='',block='',floor='',element='',capture='',quantity='',unit='',a='',b='',kd='',progress='0']=line.split('\t'),start=P.date(a),finish=P.date(b),isMilestone=/^(да|1|кд)$/i.test(kd.trim());
      if(!title.trim()||!start||!finish||finish<start)throw Error('Строка '+(index+1)+': проверьте название и обе даты.');
      if(isMilestone&&start!==finish)throw Error('У КД начало и окончание должны совпадать.');
      if(quantity!==''&&(P.number(quantity)===null||P.number(quantity)<0))throw Error('Строка '+(index+1)+': неверный объём.');
      if(P.number(progress)===null||P.number(progress)<0||P.number(progress)>100)throw Error('Строка '+(index+1)+': готовность от 0 до 100.');
      const tid='TASK-'+crypto.randomUUID(),task={id:tid,versionId:id,sourceImportId:id,sourceTaskId:String(index+1),name:title.trim(),building,block,floor,element,capture,unit,isMilestone,progressPercent:Number(progress),organizationId:org?.id||'',organizationName:org?.name||'',role,scheduleKey,active:true,calendar:'7x0',durationAccepted:isMilestone?0:P.workingCount(start,finish,'7x0'),status:Number(progress)>=100?'Завершено':Number(progress)>0?'В работе':'Не начато'};
      task.logicalId=P.identity(task);
      return {task,dates:['working','baseline',...(role!=='working'?['contract']:[])].map(type=>({id:'TD-'+crypto.randomUUID(),taskId:tid,type,start,finish,createdAt:now})),quantities:quantity===''?[]:[{id:'TQ-'+crypto.randomUUID(),taskId:tid,quantityType:'primary',quantity:P.number(quantity),unit}],dependencies:[]};
    });
    const v={id,name,role,scheduleKey,effectiveDate,status:'Тест',versionNo:Math.max(0,...(project.scheduleVersions||[]).filter(v=>v.scheduleKey===scheduleKey).map(v=>v.versionNo||0))+1,createdAt:now,organizationId:org?.id||'',contractNo:el('manualContract').value.trim(),registerMilestones:el('manualRegisterKD').checked};
    if(new Set(staged.map(r=>r.task.logicalId)).size!==staged.length)throw Error('Повторяются одинаковые работы в одном месте. Уточните элемент или захватку.');
    await P.persist(project,()=>{for(const k of ['scheduleVersions','tasks','taskDates','taskQuantities','dependencies'])project[k]=project[k]||[];project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);},()=>savePlanning());state.right=id;state.task='';state.preview=null;state.critical=null;state.leveled=null;renderSchedule();
  }
  function taskEditor(task){if(!task)return '';const d=dates(task);return `<details><summary>Редактировать работу / добавить работу вручную</summary><div class="planning-grid">${[['Name','Работа',task.name],['Building','Здание',task.building],['Block','Блок',task.block],['Floor','Этаж',task.floor],['Element','Элемент',task.element],['Capture','Захватка',task.capture]].map(([id,label,v])=>`<label>${label}<input id="editTask${id}" value="${esc(v||'')}"></label>`).join('')}<label>Начало<input type="date" id="editTaskStart" value="${esc(d.start||'')}"></label><label>Окончание<input type="date" id="editTaskFinish" value="${esc(d.finish||'')}"></label><label>Готовность, %<input type="number" id="editTaskProgress" min="0" max="100" value="${Number(task.progressPercent)||0}"></label><label>Статус<select id="editTaskStatus">${['Не начато','В работе','Выполнено','Готово','Сдано','Завершено','СМР приостановлены'].map(v=>`<option ${task.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label><input id="editTaskMilestone" type="checkbox" ${task.isMilestone?'checked':''}>Ключевая дата</label></div><p class="muted">Объём и единицу задайте в полях расчёта выше. Сохранение создаёт новую версию выбранной группы; предыдущая остаётся в истории. Исправление договорного графика сохраняет новую редакцию договорных дат.</p><button id="planningEditTask" class="btn">Сохранить изменение новой версией</button><button id="planningAddTask" class="btn">Добавить как новую работу</button></details>`;}
  async function editManualTask(add=false){
    assertEdit();readDraft();const old=project.scheduleVersions.find(v=>v.id===state.right),tasks=versionTasks(state.right),current=tasks.find(t=>t.id===state.task);
    const start=P.date(el('editTaskStart').value),finish=P.date(el('editTaskFinish').value),name=el('editTaskName').value.trim(),isMilestone=el('editTaskMilestone').checked,progress=P.number(el('editTaskProgress').value);
    if(!name||!start||!finish||finish<start||progress===null||progress<0||progress>100)throw Error('Проверьте название, обе даты и готовность.');
    if(isMilestone&&start!==finish)throw Error('У КД начало и окончание должны совпадать.');
    if(!add)assertQuantityConsistent(current,state.drafts[current.id]||selectedInput(current));
    const edited={...current,volumeKey:D.quantityKey(current),name,building:el('editTaskBuilding').value,block:el('editTaskBlock').value,floor:el('editTaskFloor').value,element:el('editTaskElement').value,capture:el('editTaskCapture').value,status:el('editTaskStatus').value,isMilestone,progressPercent:progress,planning:structuredCopy(state.drafts[current.id]||{}),frontId:state.drafts[current.id]?.frontId||''};
    // When dates are explicitly edited, update manual duration as well.
    edited.planning.start=start;edited.planning.manual=isMilestone?0:P.workingCount(start,finish,calendarFor(edited.planning.calendar));
    if(add){edited.id='TASK-'+crypto.randomUUID();delete edited.volumeKey;edited.logicalId=P.identity({...edited,frontId:null,logicalId:null});edited.parentTaskId='';edited.milestoneId='';}
    const id='SVER-'+crypto.randomUUID(),now=new Date().toISOString(),mapping=new Map([...tasks,...(add?[edited]:[])].map(t=>[t.id,'TASK-'+crypto.randomUUID()]));
    const v={...old,id,status:'Тест',isCurrent:false,isBaseline:false,registerMilestones:old.role!=='working'&&old.registerMilestones,versionNo:Math.max(0,...project.scheduleVersions.filter(v=>v.scheduleKey===old.scheduleKey).map(v=>v.versionNo||0))+1,effectiveDate:now.slice(0,10),createdAt:now,derivedFrom:old.id};
    const staged=[...tasks,...(add?[edited]:[])].map(t=>{
      const change=t.id===edited.id,source=change?edited:t,tid=mapping.get(t.id),ds=(project.taskDates||[]).filter(d=>d.taskId===(add&&change?current.id:t.id)).map(d=>({...d,id:'TD-'+crypto.randomUUID(),taskId:tid}));
      if(change){for(const d of ds.filter(d=>d.type==='working'||(v.role!=='working'&&d.type==='contract')))Object.assign(d,{start,finish,createdAt:now});}
      const input=change?edited.planning:t.planning,quantities=change&&P.number(input.total)!==null?[{id:'TQ-'+crypto.randomUUID(),taskId:tid,quantityType:'primary',quantity:P.number(input.total),unit:input.unit}]:(project.taskQuantities||[]).filter(q=>q.taskId===t.id).map(q=>({...q,id:'TQ-'+crypto.randomUUID(),taskId:tid}));
      return {task:{...source,id:tid,sourceTaskId:tid,versionId:id,sourceImportId:id,parentTaskId:mapping.get(source.parentTaskId)||'',durationAccepted:change?edited.planning.manual:t.durationAccepted},dates:ds,quantities,dependencies:dependenciesFor(tasks).filter(d=>d.successorTaskId===t.id).map(d=>({...d,id:'DEP-'+crypto.randomUUID(),versionId:id,predecessorTaskId:mapping.get(d.predecessorTaskId),successorTaskId:tid}))};
    });
    if(new Set(staged.map(x=>P.identity(x.task))).size!==staged.length)throw Error('Совпадает фронт или работа и место. Уточните привязку.');
    await P.persist(project,()=>{project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);},()=>savePlanning());state.right=id;state.task=mapping.get(edited.id);state.preview=null;state.critical=null;state.leveled=null;renderSchedule();
  }
  async function addManualTask(){return editManualTask(true);}
  async function pinBaseline(){assertEdit();await P.persist(project,()=>{for(const v of project.scheduleVersions)v.isBaseline=v.id===state.right;},()=>savePlanning());state.left=state.right;render();}
  function filtered(tasks){const orgs=state.organizations?.length?state.organizations:state.organization?[state.organization]:[];return tasks.filter(t=>!orgs.length||orgs.includes(t.organizationId)||orgs.includes(t.organizationName));}
  function matrixControls(){const fields=[['place','Полное место'],['building','Здание'],['block','Блок'],['floor','Этаж'],['capture','Захватка'],['name','Работа'],['organization','Организация']];const select=(id,label,value,options)=>`<label>${label}<select id="${id}">${options.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select></label>`;return `<div class="planning-grid">${select('planningMatrixRow','Строки',state.matrixRow,fields)}${select('planningMatrixCol','Столбцы',state.matrixCol,fields)}${select('planningMatrixMetric','В ячейке',state.matrixMetric,[['progress','Готовность'],['forecast','Прогнозное окончание'],['delta','Отклонение окончания'],['volume','Факт / общий объём'],['gain','Прирост от выполнения'],['scopeEffect','Влияние изменения объёма']])}</div><div class="planning-grid"><label>Сохранённое представление<select id="planningView"><option value="">Выберите</option>${(settings().views||[]).map(v=>`<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('')}</select></label><label>Название представления<input id="planningViewName" placeholder="Еженедельный отчёт"></label></div><button id="planningViewSave" class="btn">Сохранить представление</button>`;}
  async function saveView(){assertEdit();const name=el('planningViewName').value.trim();if(!name)throw Error('Укажите название представления.');const config=Object.fromEntries(['matrixRow','matrixCol','matrixMetric','organization','organizations','method','from','to','left','right','comparisonMode','leftDate','rightDate','leftGroup','rightGroup'].map(k=>[k,state[k]])),s=structuredCopy(settings());s.views=[...(s.views||[]).filter(v=>v.name!==name),{name,config}];await P.persist(project,()=>{project.planningSettings=s;},()=>savePlanning());state.settings=s;render();}
  function gantt(tasks){
    if(!window.LIV_GANTT)return '<p>Модуль Ганта не загружен. Обновите страницу.</p>';
    const base=new Map(tasks.map(t=>[t.id,{...dates(t),remainingStart:dates(t).start}])),after=state.preview||base,leveled=!!(state.preview&&state.leveled),before=leveled?state.leveled.before:null;
    let beforeLoad=[],afterLoad=[],resourceError='';
    // Calculate the complete resource network even when the task list is filtered.
    try{afterLoad=P.resourceLoad(tasks,after,leveled?state.leveled.inputs:selectedInput,settings().capacities);if(before)beforeLoad=P.resourceLoad(tasks,before,selectedInput,settings().capacities);}catch(e){resourceError=e.message;}
    ganttOptions={tasks:filtered(tasks),base,before,after,leveled,calculated:!!state.preview,selected:state.task,critical:state.preview?state.critical?.results:null,dependencies:dependenciesFor(tasks),beforeLoad,afterLoad,resourceError,capacities:settings().capacities,holidays:settings().holidays,workingDays:settings().workingDays,asOf:state.to,versionLabel:label(project.scheduleVersions.find(v=>v.id===state.right)||{}),changes:leveled?state.leveled.changes:[],warnings:leveled?state.leveled.warnings:[],kdBefore:before?D.milestoneForecast(project,tasks,before):[],kdAfter:leveled?D.milestoneForecast(project,tasks,after):[]};
    // Transfer names for all changes without letting the display filter hide their impact.
    ganttOptions.allTasks=tasks;
    return '<section id="planningGantt" class="planning-gantt-workbench"></section>';
  }
  function taskStats(t){
    const input=state.drafts[t.id]||t.planning||{},frontId=input.frontId||t.frontId,work={...t,volumeKey:D.quantityKey(t),frontId},q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),unit=q?.unit||input.unit||t.unit||'',d=dates(t),period=D.periodProgress(project,work,state.from||state.to,state.to),now=period.now,before=period.before,total=now.total;
    const duplicates=frontId&&versionTasks(state.right).filter(x=>(state.drafts[x.id]?.frontId||x.frontId)===frontId&&!x.isSummary&&!x.isMilestone).length>1,ambiguous=now.fact.entries.some(r=>r.baseline&&r.date>=state.from);
    const actual=now.fact.hasFacts&&!duplicates&&!ambiguous?now.actual-(before.actual??0):null,cumulative=now.fact.hasFacts&&!duplicates?now.actual:null;
    const calendar=calendarFor(t.calendar),plan=D.periodPlan(project,t,state.from,state.to,calendar),cum=D.periodPlan(project,t,d.start,state.to,calendar),offset=t.planning?(P.number(t.planning.done)||0):0;
    return {id:t.id,key:D.quantityKey(t),total,previousTotal:before.total,previousCumulative:before.actual,original:now.volume.original,contract:now.volume.contract,versionTotal:P.number(q?.quantity??t.planning?.total),unit,plan:plan.value,planMethod:plan.method,actual,cumulative,cumPlan:cum.value===null?null:offset+cum.value,current:duplicates?null:now.progress,previous:duplicates?null:before.progress,productionGain:duplicates||ambiguous?null:period.productionGain,scopeEffect:duplicates?null:period.scopeEffect,remaining:now.remaining,overrun:now.overrun,weight:P.number(input.weight)||1,note:duplicates?'Один фронт у нескольких работ: требуется распределение':ambiguous?'Начальная отсечка внутри периода':!now.fact.hasFacts?'Факт не введён':now.overrun>0?'Факт превышает действующий объём; требуется решение':''};
  }
  function analytics(tasks){
    tasks=filtered(tasks).filter(t=>!t.isSummary&&!t.isMilestone);const rows=tasks.map(t=>({t,...taskStats(t)}));
    const comparable=rows.filter(r=>r.plan!==null&&r.actual!==null),groups=new Map();for(const r of comparable){if(!groups.has(r.unit))groups.set(r.unit,{plan:0,actual:0,cumPlan:0,cumulative:0});const g=groups.get(r.unit);for(const k of ['plan','actual','cumPlan','cumulative'])g[k]+=r[k]||0;}
    let progress;try{progress=D.aggregateReadiness(rows,state.method);}catch(e){progress={error:e.message};}
    const orgs=[...new Map(versionTasks(state.right).map(t=>[t.organizationId||t.organizationName||'',t.organizationName||'Без организации'])).entries()].filter(([id])=>id);
    return `<h2>Расширенная аналитика: объёмы и готовность</h2><div class="planning-grid"><label>С<input type="date" id="planningFrom" value="${esc(state.from)}"></label><label>По<input type="date" id="planningTo" value="${esc(state.to)}"></label><label>Организация<select id="planningOrganization" multiple size="4"><option value="">Все (или несколько с Ctrl)</option>${orgs.map(([id,name])=>`<option value="${esc(id)}" ${(state.organizations?.includes(id)||state.organization===id)?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label>Общий процент<select id="planningMethod">${[['average','Среднее по работам'],['weighted','По весам работ'],['volume','По объёму (одинаковые единицы)']].map(([v,l])=>`<option value="${v}" ${state.method===v?'selected':''}>${l}</option>`).join('')}</select></label></div><p class="muted">План выбранной версии распределён равномерно по рабочим дням. Для прогноза распределяется остаток плюс исходная отсечка. Отсутствие факта не считается нулём. В итог объёмов входят только строки с сопоставимыми планом и фактом; единицы разделены. Готовность рассчитывается на конец периода, прирост — к дате перед его началом.</p><div class="planning-kpis"><span>Готовность<b>${fmt(progress.current)}%</b></span><span>Прирост за период<b>${fmt(progress.gain)} п.п.</b></span><span>Из прироста: выполнение<b>${fmt(progress.productionGain)} п.п.</b></span><span>Из прироста: пересмотр объёма<b>${fmt(progress.scopeEffect)} п.п.</b></span><span>Работ с историей для сравнения<b>${rows.filter(r=>r.current!==null&&r.previous!==null).length} / ${rows.length}</b></span></div>${progress.error?'<p>'+esc(progress.error)+'</p>':''}<div class="table-wrap"><table><thead><tr><th>Работа</th><th>Ед.</th><th>Действующий объём</th><th>План за период</th><th>Факт за период</th><th>Факт − план</th><th>План накопительно</th><th>Факт накопительно</th><th>Готовность</th><th>Прирост, п.п.</th><th>От выполнения, п.п.</th><th>От изменения объёма, п.п.</th><th>Остаток</th><th>Примечание</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.t.name+' · '+context(r.t))}</td><td>${esc(r.unit)}</td><td>${fmt(r.total)}</td><td>${fmt(r.plan)}</td><td>${fmt(r.actual)}</td><td>${r.actual!==null&&r.plan!==null?fmt(r.actual-r.plan):'—'}</td><td>${fmt(r.cumPlan)}</td><td>${fmt(r.cumulative)}</td><td>${fmt(r.current)}%</td><td>${r.current!==null&&r.previous!==null?fmt(r.current-r.previous):'—'}</td><td>${fmt(r.productionGain)}</td><td>${fmt(r.scopeEffect)}</td><td>${fmt(r.remaining)}</td><td>${esc([r.note,r.planMethod,r.versionTotal!==r.total?'Объём версии: '+fmt(r.versionTotal):''].filter(Boolean).join(' · '))}</td></tr>`).join('')}${[...groups].map(([unit,g])=>`<tr class="liv-total-row"><th>Итого сопоставимые строки</th><td>${esc(unit)}</td><td>—</td><td>${fmt(g.plan)}</td><td>${fmt(g.actual)}</td><td>${fmt(g.actual-g.plan)}</td><td>${fmt(g.cumPlan)}</td><td>${fmt(g.cumulative)}</td><td colspan="6"></td></tr>`).join('')}</tbody></table></div>`;
  }

  function factPanel(input){
    const front=(project.fronts||[]).find(f=>f.id===input.frontId);
    if(!front)return '<p class="muted">Для ввода факта выберите существующий фронт выше. Новый фронт можно завести вручную в основном журнале работ.</p>';
    const rows=window.LIV_FACT_SERIES.primaryRows(project,new Set([String(front.id)])).filter(r=>r.active!==false).sort((a,b)=>String(b.factDate||b.date).localeCompare(String(a.factDate||a.date)));
    return `<details><summary>Внести / исправить факт по связанному фронту</summary><div class="planning-grid"><label>Запись<select id="planningFactRecord"><option value="">Новая запись</option>${rows.map(r=>`<option value="${esc(r.id)}">${esc((r.factDate||r.date)+' · '+(r.factType==='cumulative_snapshot'?'Накопительно: '+r.cumulativeQty:'За день: '+(r.quantity??r.qty)))}</option>`).join('')}</select></label><label>Дата<input id="planningFactDate" type="date" value="${esc(input.asOf||new Date().toISOString().slice(0,10))}"></label><label>Тип<select id="planningFactType"><option value="quantity">Прирост за день</option><option value="cumulative_snapshot">Накопительный итог на конец дня</option></select></label><label>Объём, ${esc(front.unit||input.unit||'ед.')}<input id="planningFactQuantity" type="number" min="0" step="any"></label><label>Комментарий<input id="planningFactComment"></label></div><p class="muted">Для исправления выберите конкретную запись и задайте её новое значение. Предыдущее значение останется в истории. Если за день уже есть факт, дополнительную новую запись здесь создавать нельзя: исправьте прежнюю.</p><button id="planningFactSave" class="btn">Сохранить факт</button></details>`;
  }
  async function saveManualFact(){
    if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять факт.');
    readDraft();const t=versionTasks(state.right).find(t=>t.id===state.task),input=selectedInput(t),front=(project.fronts||[]).find(f=>f.id===input.frontId),date=P.date(el('planningFactDate').value),qty=P.number(el('planningFactQuantity').value),type=el('planningFactType').value;
    if(!front||!date||qty===null||qty<0)throw Error('Выберите фронт и укажите корректные дату и объём.');
    const oldId=el('planningFactRecord').value,old=(project.progressFacts||[]).find(r=>r.id===oldId&&r.frontId===front.id);
    if(oldId&&!old)throw Error('Эта запись из старого журнала. Исправьте её в основном журнале факта.');
    if((project.progressFacts||[]).some(r=>r.id!==oldId&&r.frontId===front.id&&r.active!==false&&r.factDate===date))throw Error('На эту дату уже есть запись. Выберите её для исправления.');
    const now=new Date().toISOString(),id=old?.id||'FACT-'+crypto.randomUUID(),row={id,frontId:front.id,metricId:old?.metricId||'',factDate:date,factType:type,quantity:type==='quantity'?qty:null,cumulativeQty:type==='cumulative_snapshot'?qty:null,comment:el('planningFactComment').value.trim(),sourceFingerprint:old?.sourceFingerprint||'manual:'+id,createdAt:old?.createdAt||now,updatedAt:now,active:true};
    await P.persist(project,()=>{project.progressFacts=project.progressFacts||[];project.factLog=project.factLog||[];if(old)window.LIV_FACT_SERIES.replaceFact(project,old,row);else project.progressFacts.push(row);window.LIV_FACT_SERIES.refreshFront(project,front);},()=>savePlanning());
    const result=window.LIV_FACT_SERIES.series(window.LIV_FACT_SERIES.primaryRows(project,new Set([String(front.id)])),input.asOf||date);
    state.drafts[t.id]={...state.drafts[t.id],done:result.actual};state.preview=null;state.critical=null;state.leveled=null;renderSchedule();
  }

  function resolveComparison(versions){
    const left=versions.find(v=>v.id===state.left),right=versions.find(v=>v.id===state.right);
    if(!state.leftGroup)state.leftGroup=left?.scheduleKey||versions[0]?.scheduleKey||'';
    if(!state.rightGroup)state.rightGroup=right?.scheduleKey||versions[0]?.scheduleKey||'';
    if(!state.leftDate)state.leftDate=P.date(left?.effectiveDate||left?.createdAt?.slice(0,10))||state.to;
    if(!state.rightDate)state.rightDate=P.date(right?.effectiveDate||right?.createdAt?.slice(0,10))||state.to;
    return state.comparisonMode==='dates'?{left:D.resolveVersion(project,state.leftGroup,state.leftDate),right:D.resolveVersion(project,state.rightGroup,state.rightDate),leftDate:state.leftDate,rightDate:state.rightDate}:{left,right,leftDate:P.date(left?.effectiveDate||left?.createdAt?.slice(0,10))||state.to,rightDate:P.date(right?.effectiveDate||right?.createdAt?.slice(0,10))||state.to};
  }
  function comparisonControls(versions){
    const options=value=>versions.map(v=>`<option value="${esc(v.id)}" ${value===v.id?'selected':''}>${esc(label(v))}</option>`).join(''),groups=[...new Map(versions.map(v=>[v.scheduleKey,v])).values()],groupOptions=value=>groups.map(v=>`<option value="${esc(v.scheduleKey)}" ${value===v.scheduleKey?'selected':''}>${esc(v.name||v.fileName)} · ${esc(v.role==='working'?'Рабочий':v.role==='customer'?'Заказчик':'Подрядчик')}</option>`).join('');
    const resolved=resolveComparison(versions),actual=v=>v?`${label(v)}; дата версии ${v.effectiveDate||v.createdAt?.slice(0,10)}`:'Предыдущая версия на эту дату отсутствует';
    return `<div class="planning-grid"><label>Режим сравнения<select id="planningComparisonMode"><option value="versions" ${state.comparisonMode==='versions'?'selected':''}>Выбрать версии</option><option value="dates" ${state.comparisonMode==='dates'?'selected':''}>На выбранные даты</option></select></label>${state.comparisonMode==='versions'?`<label>С чем сравниваем<select id="planningLeft">${options(state.left)}</select></label><label>Выбранная версия<select id="planningRight">${options(state.right)}</select></label>`:`<label>Первый график<select id="planningLeftGroup">${groupOptions(state.leftGroup)}</select></label><label>На первую дату<input type="date" id="planningLeftDate" value="${esc(state.leftDate)}"></label><label>Второй график<select id="planningRightGroup">${groupOptions(state.rightGroup)}</select></label><label>На вторую дату<input type="date" id="planningRightDate" value="${esc(state.rightDate)}"></label>`}</div><p class="muted">Первая: ${esc(actual(resolved.left))}<br>Вторая: ${esc(actual(resolved.right))}. ${state.comparisonMode==='dates'?'Берётся последняя сохранённая версия не позднее заданной даты.':''} Факт и объёмы показаны на даты сравнения с учётом внесённых исправлений. Выпущенное ранее состояние открывается из сохранённого снимка отчёта.</p>`;
  }
  function selectedTask(){return versionTasks(state.right).find(t=>t.id===state.task);}
  function quantityPanel(tasks,selected,input){
    if(!selected)return '';
    const date=input.asOf||new Date().toISOString().slice(0,10),v=D.volumeAt(project,selected,date),history=(project.quantityChanges||[]).filter(c=>c.key===v.key).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)),closed=new Set(history.filter(c=>c.proposalId).map(c=>c.proposalId));
    const rows=filtered(tasks).filter(t=>!t.isSummary&&!t.isMilestone).map(t=>{const x=D.stateAt(project,t,date);return `<tr><td><button class="btn" data-open-task="${esc(t.id)}">${esc(t.name+' · '+context(t))}</button></td><td>${esc(x.volume.unit)}</td><td>${fmt(x.volume.original)}</td><td>${fmt(x.versionQuantity)}</td><td>${fmt(x.volume.contract)}</td><td>${fmt(x.total)}</td><td>${fmt(x.actual)}</td><td>${fmt(x.remaining)}</td><td>${x.overrun>0?'<strong class="planning-late">Факт больше объёма на '+fmt(x.overrun)+'</strong>':x.volume.proposals.length?'Есть предложения':x.versionQuantity!==null&&x.total!==x.versionQuantity?'Объём версии отличается от действующего':'—'}</td></tr>`;}).join('');
    return `<section><h2>Единая ведомость объёмов на ${esc(date)}</h2><p class="muted">Договорный объём, действующий объём для планирования и факт учитываются раздельно. Предложения не меняют остаток и прогноз до согласования. Объём в старой версии графика сохраняется.</p><div class="table-wrap"><table><thead><tr><th>Работа</th><th>Ед.</th><th>Исходный</th><th>Объём версии графика</th><th>Договорный</th><th>Действующий</th><th>Факт</th><th>Остаток</th><th>Проверка</th></tr></thead><tbody>${rows}</tbody></table></div><details><summary>Изменить объём выбранной работы / история</summary><p>${esc(selected.name)}: исходный ${fmt(v.original)}, действующий ${fmt(v.total)} ${esc(v.unit)}. Исходная дата: ${esc(v.effectiveDate)}. При добавлении номеров сохраняется перечень затронутых элементов; факт по ним автоматически не удаляется.</p><div class="planning-grid"><label>Дата действия<input type="date" id="quantityDate" value="${esc(date)}"></label><label>Изменение<select id="quantityKind"><option value="add">Добавить</option><option value="exclude">Исключить</option></select></label><label>Количество, ${esc(v.unit)}<input type="number" min="0" step="any" id="quantityAmount"></label><label>Статус<select id="quantityStatus"><option value="approved">Согласовано для планирования</option><option value="proposed">Предложение, не согласовано</option></select></label><label>Причина<input id="quantityReason" placeholder="Уточнение проектного решения"></label><label>Основание<input id="quantityDocument" placeholder="Письмо / РД / дополнительное соглашение"></label><label><input type="checkbox" id="quantityContract">Изменение согласованного договорного объёма</label><label>Номера свай / анкеров / обозначения конструкций<textarea id="quantityElements" placeholder="№12; №13; Плита БП-2"></textarea></label></div><button id="quantitySave" class="btn primary">Записать изменение объёма</button><div class="table-wrap"><table><thead><tr><th>Дата действия</th><th>Изменение</th><th>Статус</th><th>Причина и основание</th><th>Элементы</th><th>Решение</th></tr></thead><tbody>${history.map(c=>`<tr><td>${c.effectiveDate}</td><td>${c.delta>0?'+':''}${fmt(c.delta)} ${esc(v.unit)}${c.affectsContract?'<small>Также договорный объём</small>':''}</td><td>${esc(c.status==='approved'?'Согласовано':c.status==='rejected'?'Отклонено':closed.has(c.id)?'Рассмотрено':'Предложение')}</td><td>${esc(c.reason)}<small>${esc(c.document)}</small></td><td>${esc((c.elementNumbers||[]).join(', '))}</td><td>${c.status==='proposed'&&!closed.has(c.id)?`<button class="btn" data-quantity-decision="${esc(c.id)}" data-approve="yes">Согласовать</button><button class="btn" data-quantity-decision="${esc(c.id)}" data-approve="no">Отклонить</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="6">Изменений пока нет.</td></tr>'}</tbody></table></div></details></section>`;
  }
  function assertQuantityConsistent(t,input){
    const v=D.volumeAt(project,t,input.asOf||new Date().toISOString().slice(0,10)),total=P.number(input.total);
    if(v.total!==null&&total!==null&&Math.abs(v.total-total)>1e-8)throw Error('Объём изменился. Сначала оформите добавление или исключение в ведомости объёмов; затем сохраните рабочий прогноз.');
    if(v.original!==null&&input.unit&&v.unit&&input.unit!==v.unit)throw Error('Изменять единицу существующего объёма нельзя. Создайте отдельную работу.');
  }
  async function saveQuantity(){
    assertEdit();readDraft();const t=selectedTask(),input={effectiveDate:el('quantityDate').value,kind:el('quantityKind').value,quantity:el('quantityAmount').value,status:el('quantityStatus').value,reason:el('quantityReason').value,document:el('quantityDocument').value,affectsContract:el('quantityContract').checked,elementNumbers:el('quantityElements').value};
    await P.persist(project,()=>{D.recordChange(project,t,input);},()=>savePlanning());invalidateVolume(t);renderSchedule();
  }
  async function decideQuantity(id,approve){assertEdit();const t=selectedTask();await P.persist(project,()=>D.decideProposal(project,t,id,approve),()=>savePlanning());invalidateVolume(t);renderSchedule();}
  function invalidateVolume(t){for(const task of versionTasks(state.right).filter(x=>D.quantityKey(x)===D.quantityKey(t))){if(state.drafts[task.id])delete state.drafts[task.id].total;}state.preview=null;state.critical=null;state.leveled=null;}
  function periodPlanPanel(t){
    if(!t||t.isSummary||t.isMilestone)return '';
    const existing=(project.quantityPlans||[]).filter(p=>p.versionId===state.right&&p.key===D.quantityKey(t)).slice(-1)[0];
    return `<details><summary>План объёмов по периодам выбранной версии</summary><p class="muted">Одна строка: начало ; окончание ; объём. Можно задавать дни, недели или месяцы. Периоды не пересекаются и входят в даты работы. Сумма равна объёму этой версии (для прогноза — остатку). Внутри периода объём распределяется по рабочим дням. Прежние раскладки остаются в истории.</p><textarea id="periodPlanRows" rows="4" placeholder="19.10.2026 ; 25.10.2026 ; 40\n26.10.2026 ; 30.10.2026 ; 60">${esc((existing?.rows||[]).map(r=>r.from+' ; '+r.to+' ; '+r.quantity).join('\n'))}</textarea><button id="periodPlanSave" class="btn">Сохранить раскладку для этой версии</button></details>`;
  }
  async function savePeriodPlan(){assertEdit();const t=selectedTask(),rows=lines(el('periodPlanRows').value).map(line=>{const cells=line.split(';').map(s=>s.trim());if(cells.length!==3)throw Error('Период плана: начало ; окончание ; объём.');return {from:cells[0],to:cells[1],quantity:cells[2]};}),record=D.validatePlan(project,t,state.right,rows,calendarFor(t.calendar));await P.persist(project,()=>{project.quantityPlans=project.quantityPlans||[];project.quantityPlans.push(record);},()=>savePlanning());render();}
  function kdPanel(tasks,selected){
    if(!selected)return '';
    const key=D.quantityKey(selected),links=settings().milestoneLinks||[],rows=D.milestoneForecast(project,tasks,state.preview);
    return `<details><summary>Связь работ с ключевыми датами</summary><p class="muted">КД определяется наиболее поздним окончанием связанных работ. При сохранении рабочего прогноза обновляется рабочая дата КД; договорная сохраняется.</p><label>КД, для которых нужна выбранная работа (несколько — с Ctrl)<select id="planningKDTargets" multiple size="5">${(project.milestones||[]).filter(m=>m.active!==false).map(m=>`<option value="${esc(m.id)}" ${links.some(l=>l.key===key&&l.milestoneId===m.id)||selected.milestoneId===m.id?'selected':''}>${esc([m.contractNo,m.title,m.contractDate].filter(Boolean).join(' · '))}</option>`).join('')}</select></label><button id="planningKDLinkSave" class="btn">Сохранить связи выбранной работы</button>${milestoneTable(rows)}</details>`;
  }
  function milestoneTable(rows){return `<div class="table-wrap"><table><thead><tr><th>КД</th><th>Договорный срок</th><th>Начало связанных работ</th><th>Прогноз окончания</th><th>Отклонение</th><th>Определяющие работы</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.contractDate||'—')}</td><td>${esc(r.start||'—')}</td><td>${esc(r.finish||'—')}</td><td class="${r.delta>0?'planning-late':''}">${signed(r.delta)}</td><td>${esc(r.notice||r.determining.join(', '))}</td></tr>`).join('')||'<tr><td colspan="6">Связанных КД пока нет.</td></tr>'}</tbody></table></div>`;}
  async function saveKDLinks(){assertEdit();readDraft();const key=D.quantityKey(selectedTask()),ids=Array.from(el('planningKDTargets').options).filter(o=>o.selected).map(o=>o.value),s=structuredCopy(settings());s.milestoneLinks=[...(s.milestoneLinks||[]).filter(l=>l.key!==key),...ids.map(milestoneId=>({key,milestoneId}))];await P.persist(project,()=>{project.planningSettings=s;},()=>savePlanning());state.settings=s;render();}
  function namedScenarioPanel(){const list=settings().scenarios||[];return `<details><summary>Сохранённые сценарии прогноза</summary><div class="planning-grid"><label>Название<input id="planningScenarioName" placeholder="Четвёртая установка с 26 октября"></label><label>Сценарий<select id="planningSavedScenario"><option value="">Выберите</option>${list.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${esc(s.savedAt.slice(0,10))}</option>`).join('')}</select></label></div><button id="planningScenarioStore" class="btn">Сохранить параметры сценариев</button><button id="planningScenarioLoad" class="btn">Открыть сохранённый сценарий</button><p class="muted">Параметры доступны после повторного открытия. Для принятия дат в рабочий график отдельно сохраните расчёт рабочей версией.</p></details>`;}
  async function saveNamedScenario(){assertEdit();readDraft();storeScenario();const name=el('planningScenarioName').value.trim();if(!name)throw Error('Введите название сценария.');const s=structuredCopy(settings()),record={id:'SCN-'+crypto.randomUUID(),name,savedAt:new Date().toISOString(),versionId:state.right,taskId:state.task,scenario:state.scenario,scenarios:structuredCopy(state.scenarios),drafts:structuredCopy(state.drafts),links:structuredCopy(state.links)};s.scenarios=[...(s.scenarios||[]),record];await P.persist(project,()=>{project.planningSettings=s;},()=>savePlanning());state.settings=s;render();}
  function loadNamedScenario(){const saved=(settings().scenarios||[]).find(s=>s.id===el('planningSavedScenario').value);if(!saved)throw Error('Выберите сценарий.');if(!(project.scheduleVersions||[]).some(v=>v.id===saved.versionId))throw Error('Исходная версия сценария отсутствует.');state.comparisonMode='versions';Object.assign(state,{right:saved.versionId,task:saved.taskId,scenario:saved.scenario,scenarios:structuredCopy(saved.scenarios),drafts:structuredCopy(saved.drafts),links:structuredCopy(saved.links),preview:null,critical:null,leveled:null});render();}
  function reportResourceLoad(tasks){if(!window.LIV_DAILY)return [];try{const results=state.preview||new Map(tasks.map(t=>[t.id,{...dates(t),remainingStart:dates(t).start}]));return P.resourceLoad(filtered(tasks),results,t=>window.LIV_DAILY.planningInput(project,t,state.to),settings().capacities||{});}catch{return [];}}
  function buildPlanningReport(tasks){
    const version=(project.scheduleVersions||[]).find(v=>v.id===state.right),rows=filtered(tasks).filter(t=>!t.isMilestone&&!t.isSummary).map(t=>({name:t.name,place:context(t),status:t.status,frontId:t.frontId||'',start:dates(t).start,finish:dates(t).finish,forecastStart:state.preview?.get(t.id)?.start||'',forecastFinish:state.preview?.get(t.id)?.finish||'',...taskStats(t)}));
    return {template:el('planningReportTemplate')?.value||'standard',management:window.LIV_DAILY?.management(project,filtered(tasks),{from:state.from,to:state.to,results:state.preview})||[],resourceLoad:reportResourceLoad(tasks),reportType:el('planningReportTemplate')?.value==='customer-weekly'?'customer':el('planningReportTemplate')?.value==='internal-resources'?'internal':el('planningReportKind')?.value||'internal',versionId:state.right,version:structuredCopy(version),from:state.from,to:state.to,title:el('planningReportTitle')?.value.trim()||(el('planningReportTemplate')?.value==='customer-weekly'?'Еженедельный отчёт Заказчику ':el('planningReportTemplate')?.value==='internal-resources'?'Внутренний прогноз объёмов и ресурсов ':'План / факт ')+state.from+' — '+state.to,filters:{organizations:state.organizations,method:state.method},matrix:{row:state.matrixRow,column:state.matrixCol,metric:state.matrixMetric,cells:reportMatrixCells(tasks)},rows,milestones:D.milestoneForecast(project,tasks,state.preview),forecastKind:state.preview?'Предварительный расчёт':'Сроки сохранённой версии'};
  }
  function reportPanel(tasks){
    if(!P.date(state.from)||!P.date(state.to)||state.to<state.from)return '';
    const reports=(project.reportSnapshots||[]).filter(r=>r.dataSnapshot?.schema==='liv-planning/v1');if(!reports.some(r=>r.id===state.reportId))state.reportId=reports.at(-1)?.id||'';
    const selected=reports.find(r=>r.id===state.reportId);
    return `<section><h2>Зафиксированные отчёты</h2><p class="muted">Снимок сохраняет цифры, версию графика, период, объёмы и связанные КД. Последующие исправления не меняют выпущенный отчёт.</p><div class="planning-grid"><label>Форма<select id="planningReportTemplate"><option value="standard">План / факт и шахматка</option><option value="customer-weekly">Еженедельный отчёт Заказчику</option><option value="internal-resources">Внутренний прогноз объёмов и ресурсов</option></select></label><label>Вид отчёта<select id="planningReportKind"><option value="internal">Внутренний</option><option value="weekly">Еженедельный</option><option value="customer">Для Заказчика</option></select></label><label>Название отчёта<input id="planningReportTitle" placeholder="Еженедельный отчёт для Заказчика"></label><label>Открыть снимок<select id="planningReportSelect"><option value="">Выберите</option>${reports.map(r=>`<option value="${esc(r.id)}" ${r.id===state.reportId?'selected':''}>${esc(r.title)} · ${esc(r.reportDate)}</option>`).join('')}</select></label></div><button id="planningReportSave" class="btn primary">Зафиксировать отчёт за выбранный период</button>${selected?'<button id="planningReportPrint" class="btn">Печать / PDF снимка</button><button id="planningReportCsv" class="btn">Выгрузить таблицу снимка</button>'+renderReport(selected):''}</section>`;
  }
  function reportMatrixCells(tasks){
    const value=(t,f)=>f==='place'?context(t):f==='organization'?t.organizationName||'Без организации':f==='floor'?(t.floor==null||t.floor===''?'Без этажа':'Этаж '+t.floor):t[f]||'Не указано';
    return filtered(tasks).filter(t=>!t.isMilestone&&!t.isSummary&&!(Number(t.floor)<0)).map(t=>{const s=taskStats(t),d=state.preview?.get(t.id)||dates(t),base=dates(t,'contract').finish||dates(t).finish,label=state.matrixMetric==='forecast'?d.finish||'—':state.matrixMetric==='delta'?signed(P.days(base,d.finish)):state.matrixMetric==='volume'?fmt(s.cumulative)+' / '+fmt(s.total)+' '+s.unit:state.matrixMetric==='gain'?fmt(s.productionGain)+' п.п.':state.matrixMetric==='scopeEffect'?fmt(s.scopeEffect)+' п.п.':fmt(s.current??t.progressPercent)+'%';return {row:value(t,state.matrixRow),column:value(t,state.matrixCol),label,start:d.start,finish:d.finish,status:s.total===0?'Исключено из объёма':t.status||'Не начато'};});
  }
  function savedMatrix(matrix){if(!matrix?.cells?.length)return '<p>Нет данных для шахматки.</p>';const rows=[...new Set(matrix.cells.map(c=>c.row))],cols=[...new Set(matrix.cells.map(c=>c.column))];return '<div class="table-wrap"><table><thead><tr><th>Место / работа</th>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr><th>'+esc(row)+'</th>'+cols.map(col=>'<td>'+matrix.cells.filter(c=>c.row===row&&c.column===col).map(c=>'<b>'+esc(c.label)+'</b><small>'+esc(c.status)+'</small><small>'+esc(c.start||'—')+' — '+esc(c.finish||'—')+'</small>').join('<hr>')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  function renderReport(report){
    const r=report.dataSnapshot,rows=r.rows,groups=new Map();for(const row of rows.filter(r=>r.actual!==null&&r.plan!==null)){if(!groups.has(row.unit))groups.set(row.unit,{plan:0,actual:0});const g=groups.get(row.unit);g.plan+=row.plan;g.actual+=row.actual;}
    return `<article id="planningReportContent"><h2>${esc(report.title)}</h2><p>Период: ${r.from} — ${r.to}. Версия: ${esc(label(r.version))}. ${esc(r.forecastKind)}. Снимок создан ${esc(report.createdAt)}.</p><div class="table-wrap"><table><thead><tr><th>Работа / место</th><th>Начало</th><th>Окончание</th><th>Ед.</th><th>Действующий объём</th><th>План периода</th><th>Факт периода</th><th>Факт накопительно</th><th>Остаток</th><th>Готовность</th><th>От выполнения, п.п.</th><th>От объёма, п.п.</th><th>Прогноз</th><th>Примечание</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.name)}<small>${esc(row.place)}</small></td><td>${esc(row.start||'—')}</td><td>${esc(row.finish||'—')}</td><td>${esc(row.unit)}</td><td>${fmt(row.total)}</td><td>${fmt(row.plan)}</td><td>${fmt(row.actual)}</td><td>${fmt(row.cumulative)}</td><td>${fmt(row.remaining)}</td><td>${fmt(row.current)}%</td><td>${fmt(row.productionGain)}</td><td>${fmt(row.scopeEffect)}</td><td>${esc(row.forecastStart||'—')} — ${esc(row.forecastFinish||'—')}</td><td>${esc(row.note||row.planMethod)}</td></tr>`).join('')}${[...groups].map(([unit,g])=>`<tr class="liv-total-row"><th colspan="3">Итого сопоставимые строки</th><td>${esc(unit)}</td><td>—</td><td>${fmt(g.plan)}</td><td>${fmt(g.actual)}</td><td colspan="7"></td></tr>`).join('')}</tbody></table></div><h3>Ключевые даты</h3>${milestoneTable(r.milestones)}${window.LIV_DAILY_UI?.reportExtra(r)||''}<h3>Шахматка на дату отчёта</h3>${savedMatrix(r.matrix)}<p>Прирост от выполнения и влияние пересмотра объёма показаны отдельно. Неизвестный факт не принят за ноль.</p></article>`;
  }
  async function savePlanningReport(){assertEdit();const input=buildPlanningReport(versionTasks(state.right)),record=D.freezeReport(project,input);await P.persist(project,()=>{project.reportSnapshots=project.reportSnapshots||[];project.reportSnapshots.push(record);},()=>savePlanning());state.reportId=record.id;render();}
  function printSavedReport(){const report=el('planningReportContent');if(!report)throw Error('Выберите сохранённый отчёт.');let root=el('livPrintRoot'),created=false;if(!root){root=document.createElement('div');root.id='livPrintRoot';document.body.appendChild(root);created=true;}const previous=root.innerHTML;root.innerHTML=report.outerHTML;try{window.print();}finally{if(created)root.remove();else root.innerHTML=previous;}}
  function downloadSavedReport(){const report=(project.reportSnapshots||[]).find(r=>r.id===state.reportId);if(!report)throw Error('Выберите сохранённый отчёт.');const csv=D.csv([['Отчёт',report.title],['Период',report.dataSnapshot.from,report.dataSnapshot.to],['График',label(report.dataSnapshot.version)],['Снимок создан',report.createdAt],[],['Работа','Место','Начало','Окончание','Ед.','Действующий объём','План периода','Факт периода','Факт накопительно','Остаток','Готовность, %','От выполнения, п.п.','От объёма, п.п.'],...report.dataSnapshot.rows.map(r=>[r.name,r.place,r.start,r.finish,r.unit,r.total,r.plan,r.actual,r.cumulative,r.remaining,r.current,r.productionGain,r.scopeEffect])]),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='LIV_План_факт_'+report.reportDate+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function savePlanning(){
    await saveProject();state.storageMessage='Изменения сохранены на устройстве. Статус серверной синхронизации показан в верхней панели.';
  }
  function storagePanel(){return `<section class="planning-storage"><p role="status">${esc(state.storageMessage||'Сохранность можно сверить с локальной базой без загрузки файлов и без изменения серверных данных.')}</p><button id="planningVerifyStorage" class="btn">Проверить сохранённые данные на устройстве</button></section>`;}
  async function verifyStorage(){
    if(typeof dbGetKey!=='function')throw Error('Локальная база недоступна в этой среде.');
    const saved=await dbGetKey();if(!saved||JSON.stringify(D.storageProjection(saved))!==JSON.stringify(D.storageProjection(project)))throw Error('Сохранённые данные отличаются от открытых. Сохраните изменения и повторите проверку.');
    state.storageMessage='Сверка пройдена: объёмы, версии, факт, КД, настройки и снимки совпадают с локальной базой. Серверная сохранность проверяется отдельно.';render();
  }

  window.LIV_PLANNING_UI={render};
  window.LIV_PLANNING_UI.context=()=>({project,state,tasks:versionTasks(state.right),leftTasks:versionTasks(state.left),dates,taskStats,filtered,selectedInput,dependenciesFor,savePlanning,settings,esc,fmt,context,render});
  document.addEventListener('DOMContentLoaded',render,{once:true});
})();
