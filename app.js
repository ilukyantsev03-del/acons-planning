const STORAGE_KEY="aconsPlanningV3";

const DEFAULT_BUILDINGS=[
"Главный корпус","Грязелечебница","Ресторан с банкетным залом","КПП","ДЭС","ТП-2","ТП-3","ТП-4","РТП. Хладоцентр","Котельная","РЧВ","Подпорные стены благоустройства","Аэрарий"
];

const DEFAULT_WORKS=["Кладка наружных стен","Вертикальное армирование","Штукатурка","Гидроизоляция балконов","Передача фронта"];

const DEMO_OBJECTS=[
"Склад (ангар) литера Д'","Нежилое здание, Корпус №10 литера Д","Нежилое здание, Корпус №9 литера Г","Нежилое здание №11 литера Е","Демонтаж «фонтана с оленем»","Аэрарий","Нежилое здание Корпус №12 литера З","Нежилое здание Корпус №1 литера Б","Котельная литера Ф'","Склад литера Б', 90:25:020102:170","Коттедж 1 литера Ш'","Парники","Коммунальная столовая литера Ц","Управление (бытовые помещения) литера Р","Теплица в ООПТ","Сауна литера Л'","Склад","Кладовая / Аккумуляторная литера Т'","Гараж литера Ж'","Гараж литера С'","Нежилое здание КТП / Диспетчерская литера П'","Нежилое здание, Корпус №4 литера В","Библиотека литера Ю","Нежилое здание Корпус №32 литера И","Спортивная площадка","Нежилое здание (Коттедж 3) литера Ц'","Приемная, спортзал литера Т (ЛФК)","Прачечная литера А (ОКН)","Нежилое здание литера У' (Склад ген.подрядчика)","Офис, нежилое здание литера Ф (штаб тех.заказчика)","Нежилое здание Корпус №35 литера Л (штаб ген.подрядчика)","Нежилое здание, Корпус №34 литера К (ООПТ)"
];

let state=loadState(), selectedFrontId=null, selectedDemoId=null;

function uid(){return crypto.randomUUID?crypto.randomUUID():(Date.now()+"-"+Math.random())}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}

function createInitialState(){
  const structures=[];
  const add=(building,block,floor,side)=>{
    if(!structures.some(x=>x.building===building&&x.block===block&&x.floor===floor&&x.side===side)) structures.push({id:uid(),building,block,floor,side});
  };
  [1,2,3,4,5,6].forEach(f=>["А / море","Г / штаб"].forEach(s=>add("Главный корпус","Блок 1",f,s)));
  [4,5,6,7].forEach(f=>["А / море","Г / штаб"].forEach(s=>add("Главный корпус","Блок 2",f,s)));
  [4,5,6,7].forEach(f=>["А / море","Г / штаб"].forEach(s=>add("Главный корпус","Блок 3",f,s)));

  const fronts=[];
  structures.forEach(st=>DEFAULT_WORKS.forEach(work=>fronts.push(makeFront(st,work))));
  const demolition=DEMO_OBJECTS.map(name=>({id:uid(),name,status:"Не начато",contractStart:"",contractEnd:"",planStart:"",planEnd:"",factStart:"",factEnd:"",predId:"",linkType:"ОН (FS)",lag:0,presented:false,accepted:false,comment:"",updatedAt:""}));
  return {buildings:[...DEFAULT_BUILDINGS],works:[...DEFAULT_WORKS],structures,fronts,demolition,factLog:[]};
}

function makeFront(st,work){
  return {
    id:uid(),
    structureId:st.id,
    building:st.building,
    block:st.block,
    floor:st.floor,
    side:st.side,
    work,
    status:"Не начато",
    fact:"",
    people:"",
    constraint:"",
    contractStart:"",
    contractEnd:"",
    planStart:"",
    planEnd:"",
    factStart:"",
    factEnd:"",
    unit:"",
    totalQty:"",
    doneQty:"",
    presented:false,
    accepted:false,
    updatedAt:""
  }
}

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw)return migrate(JSON.parse(raw))
  }catch(e){}
  return createInitialState()
}

function migrate(s){
  s.factLog=s.factLog||[];
  s.structures=s.structures||[];
  s.buildings=s.buildings||[...DEFAULT_BUILDINGS];
  s.works=s.works||[...DEFAULT_WORKS];
  return s
}

function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state))
}

function statusClass(status){
  if(status==="Фронт готов"||status==="Готово к старту")return"status-ready";
  if(status==="В работе")return"status-work";
  if(status==="Завершено")return"status-done";
  if(status==="Приостановлено")return"status-pause";
  if(status==="Ограничение")return"status-risk";
  return"status-not"
}

function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(x=>x.classList.add("hidden"));
    document.getElementById("tab-"+btn.dataset.tab).classList.remove("hidden");

    if(btn.dataset.tab==="demo")renderDemolition();
    if(btn.dataset.tab==="history")renderHistory();
    if(btn.dataset.tab==="analytics")renderAnalytics();
    if(btn.dataset.tab==="settings")renderSettings()
  }))
}

function fillSelect(el,items,allLabel){
  const cur=el.value;
  el.innerHTML="";

  if(allLabel){
    const o=document.createElement("option");
    o.value="all";
    o.textContent=allLabel;
    el.appendChild(o)
  }

  items.forEach(v=>{
    const o=document.createElement("option");
    o.value=String(v);
    o.textContent=String(v);
    el.appendChild(o)
  });

  if([...el.options].some(o=>o.value===cur))el.value=cur
}

function unique(arr){
  return [...new Set(arr)]
}

function initAllSelects(){
  fillSelect(buildingFilter,state.buildings,"Все здания");
  buildingFilter.value=state.buildings.includes("Главный корпус")?"Главный корпус":"all";
  updateMainDependent();

  fillSelect(hBuilding,state.buildings,"Все здания");
  fillSelect(hWork,state.works,"Все виды работ");

  fillSelect(aBuilding,state.buildings,"Все здания");
  fillSelect(aWork,state.works,"Все виды работ");
  fillSelect(aBlock,unique(state.structures.map(s=>s.block)),"Все блоки");
  fillSelect(aFloor,unique(state.structures.map(s=>s.floor).sort((a,b)=>a-b)),"Все этажи");

  fillSelect(sBuilding,state.buildings);
  fillSelect(sWork,state.works)
}

function updateMainDependent(){
  const b=buildingFilter.value;
  const structs=state.structures.filter(s=>b==="all"||s.building===b);

  fillSelect(blockFilter,unique(structs.map(s=>s.block)),"Все блоки");
  fillSelect(floorFilter,unique(structs.map(s=>s.floor).filter(n=>Number(n)>=0).sort((a,b)=>a-b)),"Все этажи");
  fillSelect(sideFilter,unique(structs.map(s=>s.side)),"Все стороны")
}

function frontMatchesFilters(f){
  if(buildingFilter.value!=="all"&&f.building!==buildingFilter.value)return false;
  if(blockFilter.value!=="all"&&f.block!==blockFilter.value)return false;
  if(floorFilter.value!=="all"&&String(f.floor)!==floorFilter.value)return false;
  if(sideFilter.value!=="all"&&f.side!==sideFilter.value)return false;
  if(statusFilter.value!=="all"&&f.status!==statusFilter.value)return false;
  return Number(f.floor)>=0
}

function renderMatrix(){
  matrixHead.innerHTML=
    "<tr><th>Здание</th><th>Блок</th><th>Этаж</th><th>Ось / сторона</th>"+
    state.works.map(w=>`<th>${esc(w)}</th>`).join("")+
    "</tr>";

  matrixBody.innerHTML="";

  const groups=new Map();

  state.fronts.filter(frontMatchesFilters).forEach(f=>{
    const k=[f.building,f.block,f.floor,f.side].join("|");

    if(!groups.has(k)){
      groups.set(k,{
        building:f.building,
        block:f.block,
        floor:f.floor,
        side:f.side,
        items:{}
      })
    }

    groups.get(k).items[f.work]=f
  });

  groups.forEach(g=>{
    const tr=document.createElement("tr");

    tr.innerHTML=
      `<td>${esc(g.building)}</td>`+
      `<td>${esc(g.block)}</td>`+
      `<td>${esc(g.floor)}</td>`+
      `<td>${esc(g.side)}</td>`;

    state.works.forEach(work=>{
      const f=g.items[work];
      const td=document.createElement("td");

      if(f){
        const qty=(f.totalQty!==""&&Number(f.totalQty)>0)
          ?`${esc(f.doneQty||0)} / ${esc(f.totalQty)} ${esc(f.unit||"")}`
          :"";

        const flags=`${f.presented?"📤":""}${f.accepted?"✅":""}`;

        td.innerHTML=
          `<button class="front-btn ${statusClass(f.status)}" data-front="${f.id}">
            <div class="front-status">${esc(f.status)}</div>
            <div class="front-fact">${esc(f.fact||"Факт не указан")}</div>
            ${qty?`<div class="front-fact">${qty}</div>`:""}
            ${flags?`<div class="front-flags">${flags}</div>`:""}
          </button>`
      }

      tr.appendChild(td)
    });

    matrixBody.appendChild(tr)
  });

  document.querySelectorAll("[data-front]").forEach(b=>
    b.addEventListener("click",()=>openFront(b.dataset.front))
  );

  renderMainStats()
}

function renderMainStats(){
  const a=state.fronts.filter(frontMatchesFilters);

  mainTotal.textContent=a.length;
  mainWork.textContent=a.filter(x=>x.status==="В работе").length;
  mainDone.textContent=a.filter(x=>x.status==="Завершено").length;
  mainAccepted.textContent=a.filter(x=>x.accepted).length;
  mainRisk.textContent=a.filter(x=>x.status==="Ограничение"||x.status==="Приостановлено").length
}

function openFront(id){
  const f=state.fronts.find(x=>x.id===id);
  if(!f)return;

  selectedFrontId=id;

  frontTitle.textContent=f.work;
  frontMeta.textContent=`${f.building} · ${f.block} · ${f.floor} этаж · ${f.side}`;

  frontStatus.value=f.status;
  frontFact.value=f.fact;
  frontPeople.value=f.people;
  frontConstraint.value=f.constraint;
  frontContractStart.value=f.contractStart;
  frontContractEnd.value=f.contractEnd;
  frontPlanStart.value=f.planStart;
  frontPlanEnd.value=f.planEnd;
  frontFactStart.value=f.factStart;
  frontFactEnd.value=f.factEnd;
  frontUnit.value=f.unit;
  frontTotalQty.value=f.totalQty;
  frontDoneQty.value=f.doneQty;
  frontPresented.checked=!!f.presented;
  frontAccepted.checked=!!f.accepted;

  frontEditor.classList.remove("hidden");
  frontEditor.scrollIntoView({behavior:"smooth",block:"start"})
}

function saveFront(){
  const f=state.fronts.find(x=>x.id===selectedFrontId);
  if(!f)return;

  Object.assign(f,{
    status:frontStatus.value,
    fact:frontFact.value,
    people:frontPeople.value,
    constraint:frontConstraint.value,
    contractStart:frontContractStart.value,
    contractEnd:frontContractEnd.value,
    planStart:frontPlanStart.value,
    planEnd:frontPlanEnd.value,
    factStart:frontFactStart.value,
    factEnd:frontFactEnd.value,
    unit:frontUnit.value,
    totalQty:frontTotalQty.value,
    doneQty:frontDoneQty.value,
    presented:frontPresented.checked,
    accepted:frontAccepted.checked,
    updatedAt:new Date().toISOString()
  });

  saveState();
  renderMatrix();
  frontMeta.textContent+=" · сохранено"
}

function openFactEditor(frontId=""){
  fillFactFronts();

  if(frontId)factFrontSelect.value=frontId;

  factDate.value=new Date().toISOString().slice(0,10);

  const f=state.fronts.find(x=>x.id===factFrontSelect.value);

  factEditorMeta.textContent=f?frontLabel(f):"";
  factQty.value="";
  factCumQty.value=f?.doneQty||"";
  factPeople.value=f?.people||"";
  factStatus.value=f?.status||"В работе";
  factComment.value="";

  factEditor.classList.remove("hidden");
  factEditor.scrollIntoView({behavior:"smooth",block:"start"})
}

function fillFactFronts(){
  factFrontSelect.innerHTML=
    state.fronts.map(f=>
      `<option value="${f.id}">${esc(frontLabel(f))}</option>`
    ).join("")
}

function frontLabel(f){
  return `${f.building} / ${f.block} / ${f.floor} / ${f.side} / ${f.work}`
}

function saveFact(){
  const frontId=factFrontSelect.value;
  const f=state.fronts.find(x=>x.id===frontId);

  if(!f||!factDate.value)return;

  state.factLog.push({
    id:uid(),
    frontId,
    date:factDate.value,
    qty:Number(factQty.value)||0,
    cumQty:factCumQty.value===""?null:Number(factCumQty.value),
    people:Number(factPeople.value)||0,
    status:factStatus.value,
    comment:factComment.value,
    createdAt:new Date().toISOString()
  });

  if(factCumQty.value!==""){
    f.doneQty=Number(factCumQty.value)
  }

  f.people=Number(factPeople.value)||"";
  f.status=factStatus.value;
  f.fact=factComment.value||f.fact;

  saveState();
  renderHistory();
  renderMatrix();

  factEditorMeta.textContent="Запись сохранена"
}

function historyFilterRows(){
  return state.factLog.filter(r=>{
    const f=state.fronts.find(x=>x.id===r.frontId);

    if(!f)return false;
    if(hFrom.value&&r.date<hFrom.value)return false;
    if(hTo.value&&r.date>hTo.value)return false;
    if(hBuilding.value!=="all"&&f.building!==hBuilding.value)return false;
    if(hWork.value!=="all"&&f.work!==hWork.value)return false;

    return true
  })
}

function renderHistory(){
  fillSelect(hBuilding,state.buildings,"Все здания");
  fillSelect(hWork,state.works,"Все виды работ");

  historyBody.innerHTML="";

  historyFilterRows()
    .sort((a,b)=>b.date.localeCompare(a.date))
    .forEach(r=>{
      const f=state.fronts.find(x=>x.id===r.frontId);
      if(!f)return;

      const tr=document.createElement("tr");

      tr.innerHTML=
        `<td>${r.date}</td>`+
        `<td>${esc(frontLabel(f))}</td>`+
        `<td>${r.qty}</td>`+
        `<td>${r.cumQty??"—"}</td>`+
        `<td>${r.people}</td>`+
        `<td>${esc(r.status)}</td>`+
        `<td>${esc(r.comment||"")}</td>`;

      historyBody.appendChild(tr)
    })
}

function dayDiff(a,b){
  if(!a||!b)return null;

  return Math.round(
    (Date.parse(b+"T00:00:00Z")-
     Date.parse(a+"T00:00:00Z"))/
    86400000
  )
}

function renderDemolition(){
  demoBody.innerHTML="";

  state.demolition.forEach(d=>{
    const basis=d.factEnd||d.planEnd;
    const delta=dayDiff(d.contractEnd,basis);

    let deltaText="—";
    let cls="neutral";

    if(delta!==null){
      deltaText=delta>0?`+${delta} дн.`:delta<0?`${delta} дн.`:"0 дн.";
      cls=delta>0?"late":delta<0?"early":"neutral"
    }

    const pred=state.demolition.find(x=>x.id===d.predId);
    const tr=document.createElement("tr");

    tr.innerHTML=
      `<td><button class="mini-btn demo-open" data-id="${d.id}">${esc(d.name)}</button></td>`+
      `<td><span class="badge">${esc(d.status)}</span></td>`+
      `<td>${esc(d.contractStart||"—")} → ${esc(d.contractEnd||"—")}</td>`+
      `<td>${esc(d.planStart||"—")} → ${esc(d.planEnd||"—")}</td>`+
      `<td>${esc(d.factStart||"—")} → ${esc(d.factEnd||"—")}</td>`+
      `<td>${pred?esc(pred.name):"—"}${pred?` · ${esc(d.linkType)} ${d.lag||0}д`:""}</td>`+
      `<td>${d.accepted?"✅ Сдано":d.presented?"📤 Предъявлено":"—"}</td>`+
      `<td class="${cls}">${deltaText}</td>`;

    demoBody.appendChild(tr)
  });

  document.querySelectorAll(".demo-open").forEach(b=>
    b.addEventListener("click",()=>openDemo(b.dataset.id))
  );

  demoTotal.textContent=state.demolition.length;
  demoWork.textContent=state.demolition.filter(x=>x.status==="В работе").length;
  demoDone.textContent=state.demolition.filter(x=>x.status==="Завершено").length;
  demoAccepted.textContent=state.demolition.filter(x=>x.accepted).length;

  demoLate.textContent=state.demolition.filter(x=>{
    const basis=x.factEnd||x.planEnd;
    const d=dayDiff(x.contractEnd,basis);
    return d!==null&&d>0
  }).length
}

function openDemo(id){
  const d=state.demolition.find(x=>x.id===id);
  if(!d)return;

  selectedDemoId=id;

  demoTitle.textContent=d.name;
  demoMeta.textContent="Карточка объекта демонтажа";

  demoStatus.value=d.status;
  demoContractStart.value=d.contractStart;
  demoContractEnd.value=d.contractEnd;
  demoPlanStart.value=d.planStart;
  demoPlanEnd.value=d.planEnd;
  demoFactStart.value=d.factStart;
  demoFactEnd.value=d.factEnd;
  demoLinkType.value=d.linkType;
  demoLag.value=d.lag;
  demoPresented.checked=!!d.presented;
  demoAccepted.checked=!!d.accepted;
  demoComment.value=d.comment;

  demoPred.innerHTML=
    '<option value="">Нет связи</option>'+
    state.demolition
      .filter(x=>x.id!==id)
      .map(x=>`<option value="${x.id}">${esc(x.name)}</option>`)
      .join("");

  demoPred.value=d.predId||"";

  demoEditor.classList.remove("hidden");
  demoEditor.scrollIntoView({behavior:"smooth",block:"start"})
}

function saveDemo(){
  const d=state.demolition.find(x=>x.id===selectedDemoId);
  if(!d)return;

  Object.assign(d,{
    status:demoStatus.value,
    contractStart:demoContractStart.value,
    contractEnd:demoContractEnd.value,
    planStart:demoPlanStart.value,
    planEnd:demoPlanEnd.value,
    factStart:demoFactStart.value,
    factEnd:demoFactEnd.value,
    predId:demoPred.value,
    linkType:demoLinkType.value,
    lag:Number(demoLag.value)||0,
    presented:demoPresented.checked,
    accepted:demoAccepted.checked,
    comment:demoComment.value,
    updatedAt:new Date().toISOString()
  });

  saveState();
  renderDemolition();

  demoMeta.textContent="Карточка объекта демонтажа · сохранено"
}

function periodMetrics(from,to,filters){
  const fronts=state.fronts.filter(f=>
    (filters.building==="all"||f.building===filters.building)&&
    (filters.work==="all"||f.work===filters.work)&&
    (filters.block==="all"||f.block===filters.block)&&
    (filters.floor==="all"||String(f.floor)===filters.floor)
  );

  const ids=new Set(fronts.map(f=>f.id));

  const logs=state.factLog.filter(r=>
    ids.has(r.frontId)&&
    (!from||r.date>=from)&&
    (!to||r.date<=to)
  );

  const qty=logs.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const peopleDays=logs.reduce((s,r)=>s+(Number(r.people)||0),0);

  const planStarts=fronts.filter(f=>
    f.planStart&&
    (!from||f.planStart>=from)&&
    (!to||f.planStart<=to)
  ).length;

  const factStarts=fronts.filter(f=>
    f.factStart&&
    (!from||f.factStart>=from)&&
    (!to||f.factStart<=to)
  ).length;

  const planEnds=fronts.filter(f=>
    f.planEnd&&
    (!from||f.planEnd>=from)&&
    (!to||f.planEnd<=to)
  ).length;

  const factEnds=fronts.filter(f=>
    f.factEnd&&
    (!from||f.factEnd>=from)&&
    (!to||f.factEnd<=to)
  ).length;

  const accepted=fronts.filter(f=>
    f.accepted&&
    f.factEnd&&
    (!from||f.factEnd>=from)&&
    (!to||f.factEnd<=to)
  ).length;

  return {
    fronts,
    logs,
    qty,
    peopleDays,
    planStarts,
    factStarts,
    planEnds,
    factEnds,
    accepted
  }
}

function renderAnalytics(){
  fillSelect(aBuilding,state.buildings,"Все здания");
  fillSelect(aWork,state.works,"Все виды работ");
  fillSelect(aBlock,unique(state.structures.map(s=>s.block)),"Все блоки");
  fillSelect(aFloor,unique(state.structures.map(s=>s.floor).sort((a,b)=>a-b)),"Все этажи");

  calculateAnalytics()
}

function deltaText(v){
  return (v>0?"+":"")+Number(v||0).toFixed(2)
}

function metricsHtml(m){
  return `
    <div class="analytics-item"><span>Факт объема за период</span><strong>${m.qty.toFixed(2)}</strong></div>
    <div class="analytics-item"><span>Человеко-дни</span><strong>${m.peopleDays}</strong></div>
    <div class="analytics-item"><span>Плановые старты</span><strong>${m.planStarts}</strong></div>
    <div class="analytics-item"><span>Фактические старты</span><strong>${m.factStarts}</strong></div>
    <div class="analytics-item"><span>Плановые окончания</span><strong>${m.planEnds}</strong></div>
    <div class="analytics-item"><span>Фактические окончания</span><strong>${m.factEnds}</strong></div>
    <div class="analytics-item"><span>Сдано</span><strong>${m.accepted}</strong></div>
  `
}

function calculateAnalytics(){
  const filters={
    building:aBuilding.value,
    work:aWork.value,
    block:aBlock.value,
    floor:aFloor.value
  };

  const A=periodMetrics(a1From.value,a1To.value,filters);
  const B=periodMetrics(a2From.value,a2To.value,filters);

  cQtyA.textContent=A.qty.toFixed(2);
  cQtyB.textContent=B.qty.toFixed(2);
  cQtyDelta.textContent="Δ "+deltaText(B.qty-A.qty);

  cPeopleA.textContent=A.peopleDays;
  cPeopleB.textContent=B.peopleDays;
  cPeopleDelta.textContent="Δ "+deltaText(B.peopleDays-A.peopleDays);

  cAcceptedA.textContent=A.accepted;
  cAcceptedB.textContent=B.accepted;
  cAcceptedDelta.textContent="Δ "+deltaText(B.accepted-A.accepted);

  analyticsA.innerHTML=metricsHtml(A);
  analyticsB.innerHTML=metricsHtml(B)
}

function renderSettings(){
  settingsBuildings.innerHTML=
    state.buildings.map((b,i)=>
      `<div class="setting-item">
        <span>${esc(b)}</span>
        <button class="mini-btn del-building" data-i="${i}">Удалить</button>
      </div>`
    ).join("");

  settingsWorks.innerHTML=
    state.works.map((w,i)=>
      `<div class="setting-item">
        <span>${esc(w)}</span>
        <button class="mini-btn del-work" data-i="${i}">Удалить</button>
      </div>`
    ).join("");

  document.querySelectorAll(".del-building").forEach(b=>
    b.addEventListener("click",()=>{
      const name=state.buildings[Number(b.dataset.i)];

      if(confirm(`Удалить "${name}" из справочника?`)){
        state.buildings.splice(Number(b.dataset.i),1);
        saveState();
        renderSettings();
        initAllSelects()
      }
    })
  );

  document.querySelectorAll(".del-work").forEach(b=>
    b.addEventListener("click",()=>{
      const w=state.works[Number(b.dataset.i)];

      if(confirm(`Удалить "${w}" из справочника отображения?`)){
        state.works.splice(Number(b.dataset.i),1);
        saveState();
        renderSettings();
        renderMatrix()
      }
    })
  );

  fillSelect(sBuilding,state.buildings);
  fillSelect(sWork,state.works);

  structureList.innerHTML=
    state.structures.map(s=>
      `<div class="setting-item">
        <span>${esc(s.building)} · ${esc(s.block)} · этаж ${esc(s.floor)} · ${esc(s.side)}</span>
        <button class="mini-btn del-structure" data-id="${s.id}">Удалить</button>
      </div>`
    ).join("");

  document.querySelectorAll(".del-structure").forEach(b=>
    b.addEventListener("click",()=>deleteStructure(b.dataset.id))
  )
}

function addBuilding(){
  const v=newBuilding.value.trim();

  if(!v)return;

  if(!state.buildings.includes(v)){
    state.buildings.push(v)
  }

  newBuilding.value="";

  saveState();
  renderSettings();
  initAllSelects()
}

function addWork(){
  const v=newWork.value.trim();

  if(!v)return;

  if(!state.works.includes(v)){
    state.works.push(v)
  }

  newWork.value="";

  saveState();
  renderSettings();
  initAllSelects();
  renderMatrix()
}

function addStructure(){
  const building=sBuilding.value;
  const block=sBlock.value.trim()||"Без блока";
  const floor=Number(sFloor.value);
  const side=sSide.value.trim()||"Без зоны";

  if(!building||Number.isNaN(floor)){
    return alert("Укажи здание и этаж")
  }

  let st=state.structures.find(x=>
    x.building===building&&
    x.block===block&&
    x.floor===floor&&
    x.side===side
  );

  if(!st){
    st={
      id:uid(),
      building,
      block,
      floor,
      side
    };

    state.structures.push(st)
  }

  const works=sWorkMode.value==="all"
    ?state.works
    :[sWork.value];

  works.forEach(work=>{
    if(!state.fronts.some(f=>
      f.structureId===st.id&&
      f.work===work
    )){
      state.fronts.push(makeFront(st,work))
    }
  });

  saveState();
  renderSettings();
  initAllSelects();
  renderMatrix()
}

function deleteStructure(id){
  if(!confirm("Удалить эту разбивку и связанные фронты?"))return;

  state.structures=state.structures.filter(x=>x.id!==id);

  const frontIds=state.fronts
    .filter(f=>f.structureId===id)
    .map(f=>f.id);

  state.fronts=state.fronts.filter(f=>f.structureId!==id);

  state.factLog=state.factLog.filter(r=>!frontIds.includes(r.frontId));

  saveState();
  renderSettings();
  renderMatrix()
}

function exportData(){
  const blob=new Blob(
    [JSON.stringify(state,null,2)],
    {type:"application/json"}
  );

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download="acons-planning-backup.json";
  a.click();

  URL.revokeObjectURL(url)
}

function importData(file){
  const r=new FileReader();

  r.onload=()=>{
    try{
      state=migrate(JSON.parse(r.result));
      saveState();
      location.reload()
    }catch(e){
      alert("Не удалось прочитать JSON")
    }
  };

  r.readAsText(file)
}
// Явно связываем HTML-элементы по id с JavaScript.
// Не полагаемся на автоматические глобальные переменные браузера.
document.querySelectorAll("[id]").forEach(el => {
  window[el.id] = el;
});
setupTabs();
initAllSelects();
renderMatrix();

[
  buildingFilter,
  blockFilter,
  floorFilter,
  sideFilter,
  statusFilter
].forEach(el=>el.addEventListener("change",()=>{
  if(el===buildingFilter)updateMainDependent();
  renderMatrix()
}));

saveFrontBtn.addEventListener("click",saveFront);

closeFrontEditor.addEventListener("click",()=>{
  frontEditor.classList.add("hidden")
});

addFactFromFrontBtn.addEventListener("click",()=>{
  document.querySelector('[data-tab="history"]').click();
  openFactEditor(selectedFrontId)
});

newFactBtn.addEventListener("click",()=>openFactEditor());

closeFactEditor.addEventListener("click",()=>{
  factEditor.classList.add("hidden")
});

saveFactBtn.addEventListener("click",saveFact);

factFrontSelect.addEventListener("change",()=>{
  const f=state.fronts.find(x=>x.id===factFrontSelect.value);
  factEditorMeta.textContent=f?frontLabel(f):""
});

applyHistoryFilter.addEventListener("click",renderHistory);

saveDemoBtn.addEventListener("click",saveDemo);

closeDemoEditor.addEventListener("click",()=>{
  demoEditor.classList.add("hidden")
});

applyAnalytics.addEventListener("click",calculateAnalytics);

addBuildingBtn.addEventListener("click",addBuilding);
addWorkBtn.addEventListener("click",addWork);
addStructureBtn.addEventListener("click",addStructure);

exportBtn.addEventListener("click",exportData);

importInput.addEventListener("change",e=>{
  if(e.target.files[0])importData(e.target.files[0])
});

resetBtn.addEventListener("click",()=>{
  if(confirm("Сбросить все локальные данные и вернуть демо-версию?")){
    localStorage.removeItem(STORAGE_KEY);
    location.reload()
  }
});
  }

  updateStats();
}

function openEditor(front) {

  selectedFront = front;

  editorTitle.textContent = front.work;

  editorMeta.textContent =
    `${front.block} · ${front.floor} этаж · Ось ${front.side}`;

  statusInput.value = front.status;
  factInput.value = front.fact;
  peopleInput.value = front.people;
  constraintInput.value = front.constraint;

  editor.classList.remove("hidden");

  editor.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function saveFront() {

  if (!selectedFront) return;

  selectedFront.status = statusInput.value;
  selectedFront.fact = factInput.value;
  selectedFront.people = peopleInput.value;
  selectedFront.constraint = constraintInput.value;

  renderMatrix();

  editorMeta.textContent += " · сохранено";
}

function updateStats() {

  document.getElementById("doneCount").textContent =
    fronts.filter(x => x.status === "Завершено").length;

  document.getElementById("workCount").textContent =
    fronts.filter(x => x.status === "В работе").length;

  document.getElementById("riskCount").textContent =
    fronts.filter(
      x =>
        x.status === "Ограничение" ||
        x.status === "Приостановлено"
    ).length;

  document.getElementById("notCount").textContent =
    fronts.filter(x => x.status === "Не начато").length;
}

document
  .getElementById("saveBtn")
  .addEventListener("click", saveFront);

document
  .getElementById("closeEditor")
  .addEventListener("click", () => {
    editor.classList.add("hidden");
  });

blockFilter.addEventListener("change", renderMatrix);
sideFilter.addEventListener("change", renderMatrix);

renderMatrix();