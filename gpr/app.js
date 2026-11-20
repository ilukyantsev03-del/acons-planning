
(function(){
const DAY=86400000;
const MON=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const MONF=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const dn=s=>Math.round(Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/DAY);
const isoOf=n=>new Date(n*DAY).toISOString().slice(0,10);
const dOf=n=>new Date(n*DAY);
const dateNumber=s=>s?dn(s):null;
const startOf=(t,r)=>t.finishOnly?null:r?.s;
const finishOf=(t,r)=>t.finishOnly?dn(t.finishOnly):r?.f;
const fmt=n=>{if(n==null)return '—';const d=dOf(n);return String(d.getUTCDate()).padStart(2,'0')+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+String(d.getUTCFullYear()).slice(2)};
const now=new Date();
let TODAY=Math.round(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/DAY);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(x,d=1)=>x==null||isNaN(x)?'—':(Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('ru-RU');
const $=id=>document.getElementById(id);

let db=null, canWrite=false, downloads=null;
let stages={}, tasks={}, settings={projectStart:'2026-09-20',title:'График фасадных работ'}, baseline={items:{}};
let loaded={tasks:false,stages:false};
let S={}; // schedule results
const ui={group:'stage',zoom:'month',cat:'',stage:'',type:'',con:'',q:'',kpi:'',collapsed:new Set(),links:false,sel:null,crit:'off',sort:'gpr'};
let FL={}, ORD=[];let facadeView='gantt',cutState=null,cutBusy=false;
const PX={week:26,month:6.2,year:2.3};
let T0=0,T1=0,px=6.2;

// ---------- schedule ----------
let cycles=new Set();
function compute(){
  S={}; cycles=new Set(); ORD=[];
  const PS=dn(settings.projectStart||'2026-09-20');
  const vis=new Set();
  function calc(id){
    if(id in S) return S[id];
    const t=tasks[id]; if(t?.finishOnly){const f=dn(t.finishOnly);S[id]={s:f,f};ORD.push(id);return S[id];} if(!t||(!t.ms&&!(t.dur>0)&&!t.stretch)||(t.ms&&!t.cons&&!(t.preds||[]).length)){S[id]=null;return null}
    if(vis.has(id)){cycles.add(id);return null}
    vis.add(id);
    let sr=Math.max(PS,t.cons?dn(t.cons):PS), fr=null; const d=Math.max(1,+t.dur||1);
    for(const p of (t.preds||[])){
      const r=calc(p.id); if(!r) continue;
      const lag=+p.lag||0;
      if(p.type==='НН') sr=Math.max(sr,r.s+lag);
      else if(p.type==='ОО'||p.type==='НО'){const v=(p.type==='ОО'?r.f:r.s)+lag; fr=fr==null?v:Math.max(fr,v)}
      else sr=Math.max(sr,r.f+(tasks[p.id]?.ms?0:1)+lag);
    }
    vis.delete(id);
    let st,f;
    if(t.stretch){st=sr;f=Math.max(fr!=null?fr:st+d-1,st)}
    else{st=fr!=null?Math.max(sr,fr-d+1):sr;f=st+d-1}
    if(t.ms)f=st; S[id]={s:st,f}; ORD.push(id); return S[id];
  }
  for(const id in tasks) calc(id);
  // metrics
  for(const id in tasks){
    const t=tasks[id], r=S[id];
    const facts=t.facts||{}; let fsum=0; for(const k in facts)if(k<=isoOf(TODAY))fsum+=+facts[k]||0;
    const done=(+t.open||0)+fsum;
    const vol=+t.vol||0;
    const manual=t.progressMode==='percent',pct=t.factProgressOpening&&isoOf(TODAY)<t.factProgressOpening.from?t.factProgressOpening.percent/100:manual?Math.max(0,Math.min(1,(+t.manualPercent||0)/100)):vol?Math.min(1,done/vol):(t.closed?1:Math.max(0,Math.min(1,(+t.openingPercent||0)/100)));
    const complete=t.factProgressOpening&&isoOf(TODAY)<t.factProgressOpening.from?pct>=1:manual?pct>=1:vol?done>=vol-1e-9:!!t.closed;
    let plan=null, st='nodate';
    if(r){
      plan=vol&&t.dur>0?vol*Math.max(0,Math.min(1,(TODAY-r.s+1)/t.dur)):null;
      if(complete) st='done';
      else if(r.f<TODAY) st='over';
      else if(r.s>TODAY) st='future';
      else if(vol&&done<plan-Math.max(vol*0.05,0.5)) st='late';
      else st='run';
    } else if(complete) st='done';
    const b=baseline.items&&baseline.items[id];
    t._m={done,fsum,vol,manual,pct,complete,plan,st,bs:dateNumber(b?.[0]),bf:dateNumber(b?.[1])};
  }
  cpm();
}
// критический путь: обратный проход, резерв = позднее окончание − раннее окончание
function cpm(){
  FL={};
  const mode=ui.crit==='stage'?'stage':'project';
  const ids=ORD.filter(i=>S[i]); if(!ids.length) return;
  let end=-1e9; const stEnd={};
  for(const i of ids){end=Math.max(end,S[i].f);const g=tasks[i].stage;stEnd[g]=Math.max(stEnd[g]??-1e9,S[i].f)}
  const projEnd=settings.deadline?dn(settings.deadline):end;
  const succ={}; ids.forEach(i=>succ[i]=[]);
  for(const i of ids) for(const p of (tasks[i].preds||[])) if(succ[p.id]) succ[p.id].push([i,p]);
  const LF={};
  for(let k=ids.length-1;k>=0;k--){
    const i=ids[k], r=S[i], d=r.f-r.s+1;
    let lf=mode==='stage'?stEnd[tasks[i].stage]:projEnd;
    for(const [x,p] of succ[i]){
      const rx=S[x], LFx=LF[x], LSx=LFx-(rx.f-rx.s), lag=+p.lag||0;
      const v=p.type==='НН'?LSx-lag+d-1:p.type==='ОО'?LFx-lag:p.type==='НО'?LFx-lag+d-1:LSx-(tasks[i].ms?0:1)-lag;
      if(v<lf) lf=v;
    }
    LF[i]=lf; FL[i]=lf-r.f;
  }
}
const isCrit=t=>FL[t.id]!=null&&FL[t.id]<=0&&!t._m.complete;
function wouldCycle(tid,pid){
  const seen=new Set();const st=[pid];
  while(st.length){const x=st.pop();if(x===tid)return true;if(seen.has(x))continue;seen.add(x);
    for(const p of (tasks[x]?.preds||[])) st.push(p.id);}
  return false;
}

// ---------- filtering ----------
function stageOf(t){return stages[t.stage]}
function stOrder(t){return stageOf(t)?.order??999}
const W=window.GPR_WORKSPACE;
const validFacadeDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&+s.slice(0,4)>=1900&&+s.slice(0,4)<=2200;
function facadePeriod(){
  const a=$('facadeRangeStart').value,b=$('facadeRangeEnd').value;
  return validFacadeDate(a)&&validFacadeDate(b)&&a<=b&&dn(b)-dn(a)<730?{start:dn(a),finish:dn(b)}:null;
}
function inFacadePeriod(r){
  const p=facadePeriod();
  return !$('facadePeriodOnly').checked||!p||!!r&&r.s<=p.finish&&r.f>=p.start;
}
function filtered(ignoreKpi,dates=S){
  const q=ui.q.trim().toLowerCase();
  return Object.values(tasks).filter(t=>{
    if(!W.accepts(t)||!inFacadePeriod(dates[t.id]))return false;
    if(ui.cat&&t.cat!==ui.cat) return false;
    if(ui.stage&&t.stage!==ui.stage) return false;
    if(ui.type&&t.type!==ui.type) return false;
    if(ui.con){ if(ui.con==='__none'){ if(t.contractor) return false } else if(t.contractor!==ui.con) return false }
    if(q&&!((t.name||'').toLowerCase().includes(q)||(t.contractor||'').toLowerCase().includes(q)||(stageOf(t)?.name||'').toLowerCase().includes(q)||('#'+t.num)===q)) return false;
    const horizon=+$('lookAhead').value,r=dates[t.id];if(horizon){const a=dn($('cutDate').value||isoOf(TODAY));if(!r||!((r.s<=a+horizon-1&&r.f>=a)||($('includeOverdue').checked&&!t._m.complete&&r.f<a)))return false;}
    if(!ignoreKpi&&ui.kpi&&!kpiTest(ui.kpi,t)) return false;
    return true;
  });
}
const KPIS=[
  ['crit','Критический путь','k-crit'],['run','Идёт сейчас','k-run'],['late','Отстаёт от плана','k-late'],['over','Срок прошёл, не закрыто','k-over'],
  ['soon','Старт в ближайшие 14 дней','k-soon'],['nocon','Без подрядчика','k-nocon'],['nodate','Без сроков','k-nodate'],['done','Выполнено','k-done'],['all','Всего в выборке','k-all']];
function kpiTest(k,t){
  const m=t._m, r=S[t.id];
  switch(k){
    case 'crit': return isCrit(t);
    case 'run': return r&&!m.complete&&r.s<=TODAY&&r.f>=TODAY;
    case 'late': return m.st==='late';
    case 'over': return m.st==='over';
    case 'soon': return r&&r.s>TODAY&&r.s<=TODAY+14;
    case 'nocon': return !t.contractor;
    case 'nodate': return !r;
    case 'done': return m.complete;
    default: return true;
  }
}
function renderKpis(){
  const base=filtered(true);
  $('kpis').innerHTML=KPIS.map(([k,l,c])=>{
    const n=base.filter(t=>kpiTest(k,t)).length;
    const on=(ui.kpi===k)||(k==='all'&&!ui.kpi);
    return `<button class="kpi ${c}${on?' on':''}" data-k="${k}"><b>${n}</b><span>${l}</span></button>`;
  }).join('');
}
function fillSelect(el,opts,cur,allLabel){
  el.innerHTML=`<option value="">${allLabel}</option>`+opts.map(([v,l])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(l)}</option>`).join('');
}
function renderFilters(){
  W.options(Object.values(tasks));
  const st=Object.values(stages).sort((a,b)=>a.order-b.order);
  fillSelect($('fStage'),st.map(s=>[s.id,s.short||s.name]),ui.stage,'Все этапы');
  const types=[...new Set(Object.values(tasks).map(t=>t.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  fillSelect($('fType'),types.map(x=>[x,x]),ui.type,'Все виды работ');
  const cons=[...new Set(Object.values(tasks).map(t=>t.contractor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  fillSelect($('fCon'),[['__none','Без подрядчика'],...cons.map(x=>[x,x])],ui.con,'Все подрядчики');
  $('fCat').value=ui.cat;
}

// ---------- gantt ----------
function range(){
  const p=facadePeriod();if(p){T0=p.start;T1=p.finish;return;}
  if($('lookAhead').value){T0=dn($('cutDate').value||isoOf(TODAY))-1;T1=T0+28;return;}
  let mn=dn(settings.projectStart||'2026-09-20'),mx=mn+200;
  for(const id in S){const r=S[id];if(!r)continue;mn=Math.min(mn,r.s);mx=Math.max(mx,r.f)}
  for(const id in tasks){const m=tasks[id]._m;if(m&&m.bf!=null)mx=Math.max(mx,m.bf)}
  if(settings.deadline) mx=Math.max(mx,dn(settings.deadline));
  mx=Math.max(mx,TODAY+30);
  const a=dOf(mn-7), b=dOf(mx+21);
  T0=Math.round(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1)/DAY);
  T1=Math.round(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+1,1)/DAY)-1;
}
const X=n=>(n-T0)*px;
function sortTasks(arr){
  if(ui.sort==='gpr') return arr.sort((a,b)=>stOrder(a)-stOrder(b)||(a.order||0)-(b.order||0)||(a.num||0)-(b.num||0));
  return arr.sort((a,b)=>{
    const ra=S[a.id],rb=S[b.id];
    if(!!ra!==!!rb) return ra?-1:1;
    if(ra&&rb&&ra.s!==rb.s) return ra.s-rb.s;
    if(stOrder(a)!==stOrder(b)) return stOrder(a)-stOrder(b);
    return (a.order||0)-(b.order||0);
  });
}
function groups(list){
  if(ui.group==='none') return [{key:'',label:null,items:sortTasks(list)}];
  const map=new Map();
  for(const t of list){
    let k,l,o;
    if(ui.group==='stage'){const s=stageOf(t);k=t.stage;l=s?s.name:'Без этапа';o=s?s.order:999;var gn=s&&s.note}
    else if(ui.group==='type'){k=t.type||'Прочее';l=k;o=0}
    else {k=t.contractor||'';l=t.contractor||'Без подрядчика';o=t.contractor?0:-1}
    if(!map.has(k)) map.set(k,{key:k,label:l,o,items:[],note:ui.group==='stage'?gn:''});
    map.get(k).items.push(t);
  }
  const gs=[...map.values()];for(const g of gs)g.percent=g.items.reduce((sum,t)=>sum+t._m.pct*100,0)/(g.items.length||1);
  gs.forEach(g=>{sortTasks(g.items);const ss=g.items.map(t=>S[t.id]).filter(Boolean);g.s=ss.length?Math.min(...ss.map(r=>r.s)):null;g.f=ss.length?Math.max(...ss.map(r=>r.f)):null});
  gs.sort((a,b)=>ui.group==='stage'?a.o-b.o:ui.group==='contractor'?(a.o-b.o||a.label.localeCompare(b.label,'ru')):((a.s??1e9)-(b.s??1e9)));
  return gs;
}
function pctClass(t){const st=t._m.st;return st==='done'?'ok':st==='over'?'bad':st==='late'?'warn':''}
function subtitle(t){
  const parts=[];
  if(ui.group!=='stage') parts.push(stageOf(t)?.short||'');
  if(t.section) parts.push(t.section);
  if(ui.group!=='type') parts.push(t.type);
  if(ui.group!=='contractor'&&t.contractor) parts.push(t.contractor);
  const r=S[t.id]; if(r&&innerWidth<=760) parts.push(t.finishOnly?'Завершено '+fmt(r.f):fmt(r.s)+'–'+fmt(r.f));
  return parts.filter(Boolean).join(', ');
}
let rowY={}, visibleIds=[];
function render(){
  if(!loaded.tasks||!loaded.stages) return;
  document.documentElement.style.setProperty('--lw',((+$('nameWidth').value||460)+520+(window.GPR_WORKSPACE.quantity()?130:0))+'px');
  compute(); renderKpis(); renderFilters();if(window.GPR_WORKSPACE.facts()){range();window.GPR_WORKSPACE.calendar($('gwrap'),filtered(false).map(t=>({...t,context:subtitle(t),percentLabel:nf(t._m.pct*100)+'%'})),$('lookAhead').value?$('cutDate').value:isoOf(T0),$('lookAhead').value?isoOf(dn($('cutDate').value)+ +$('lookAhead').value-1):isoOf(T1),canWrite,saveCalendarFact);return;}if(facadeView==='cut'){renderFacadeCut();return;}
  $('ttl').textContent=settings.title||'График фасадных работ';
  range(); px=PX[ui.zoom];
  const W=(T1-T0+1)*px;
  const list=filtered(false);
  const gs=groups(list);
  // header
  let mh='',dh='';
  for(let d=T0;d<=T1;){
    const dt=dOf(d), y=dt.getUTCFullYear(), m=dt.getUTCMonth();
    const end=Math.round(Date.UTC(y,m+1,1)/DAY);
    const w=(Math.min(end,T1+1)-d)*px;
    const label=ui.zoom==='year'?MON[m]+(m===0?' '+y:''):(ui.zoom==='week'?MONF[m]+' '+y:MON[m]+' '+y);
    mh+=`<div class="mcell" style="left:${X(d)}px;width:${w}px">${w>24?label:''}</div>`;
    d=end;
  }
  if(ui.zoom==='week'){
    for(let d=T0;d<=T1;d++){const wd=dOf(d).getUTCDay();dh+=`<div class="dcell${wd===0?' sunday-date':''}" style="left:${X(d)}px;width:${px}px">${dOf(d).getUTCDate()}</div>`}
  } else if(ui.zoom==='month'){
    for(let d=T0;d<=T1;d++){if(dOf(d).getUTCDay()===1)dh+=`<div class="dcell" style="left:${X(d)}px;width:${7*px}px;text-align:left;padding-left:3px">${dOf(d).getUTCDate()}</div>`}
  }
  // load strip
  const byType={};
  for(const t of list){const r=S[t.id];if(!r||t._m.complete)continue;const a=byType[t.type]||(byType[t.type]=new Array(T1-T0+1).fill(0));for(let d=Math.max(r.s,T0);d<=Math.min(r.f,T1);d++)a[d-T0]++}
  const cnt=new Array(T1-T0+1).fill(0), who=new Array(T1-T0+1).fill('');
  for(const k in byType){const a=byType[k];for(let d=0;d<a.length;d++){if(a[d]>=2)who[d]+=(who[d]?', ':'')+k+' ×'+a[d];if(a[d]>cnt[d])cnt[d]=a[d]}}
  const lvOf=c=>c>=3?3:c>=2?2:0;
  let ld='';let i=0;
  while(i<cnt.length){const lv=lvOf(cnt[i]);let j=i;while(j<cnt.length&&lvOf(cnt[j])===lv&&who[j]===who[i])j++;
    if(lv>0)ld+=`<div class="lseg" style="left:${i*px}px;width:${(j-i)*px}px;background:var(--l${lv})" title="${fmt(T0+i)}–${fmt(T0+j-1)}: ${esc(who[i])}"></div>`;i=j}
  // body
  let body='',y=0; rowY={}; visibleIds=[];
  const RH=$('compact').checked?38:48, GH=$('compact').checked?34:44;
  for(const g of gs){
    if(g.label!==null){
      const closed=ui.collapsed.has(g.key);
      const done=g.items.filter(t=>t._m.complete).length;
      body+=`<div class="row grp${ui.group==='stage'?' stage-group':''}${closed?' closed':''}" data-g="${esc(g.key)}"><div class="lab"><span class="caret">▾</span><div class="t"><div class="n" title="${esc(g.label)}${g.note?'\nПримечание: '+esc(g.note):''}">${esc(g.label)} <span class="cnt">${g.items.length} работ, выполнено ${done}${g.note?', есть примечание':''}</span></div></div><span class="cr"></span><span class="cr"></span><span class="cr fact-rate"></span><span class="cd">${g.s!=null?fmt(g.s):''}</span><span class="cd">${g.f!=null?fmt(g.f):''}</span><span class="cn">${g.s!=null?g.f-g.s+1:''}</span><span class="p" title="Средняя готовность работ группы">${nf(g.percent,1)}%</span>${window.GPR_WORKSPACE.quantity()?'<span class="quantity-facade"></span>':''}</div><div class="trk" style="width:${W}px">${g.s!=null?`<div class="gbar" style="left:${X(g.s)}px;width:${(g.f-g.s+1)*px}px"></div>`:''}</div></div>`;
      y+=GH; if(closed) continue;
    }
    for(const t of g.items){
      const r=S[t.id], m=t._m;
      rowY[t.id]=y+RH/2; visibleIds.push(t.id);
      const pc=Math.round(m.pct*100)+'%';
      let tr='';
      const crit=ui.crit!=='off'&&isCrit(t), dim=ui.crit!=='off'&&!crit;
      if(r&&t.ms){
        tr+=`<div class="ms${crit?' crit':''}${dim?' dim':''}" data-id="${t.id}" style="left:${X(r.s)+px/2-6.5}px" title="${esc(t.name)}"></div>`;
      } else if(r&&!t.finishOnly){
        const cls=['bar',crit?'crit':'',dim?'dim':'',t.cat==='glass'?'gla':t.cat==='prep'?'pre':t.cat==='other'?'oth':'',m.st==='over'?'over':'',m.st==='late'?'late':'',cycles.has(t.id)?'cyc':'',ui.sel===t.id?'sel':'',canWrite?'':'ro'].filter(Boolean).join(' ');
        tr+=`<div class="${cls}" data-id="${t.id}" style="left:${X(r.s)}px;width:${Math.max(t.dur*px,3)}px"><div class="dn" style="width:${m.pct*100}%"></div><div class="rz"></div></div>`;
      } else if(!t.finishOnly) tr+=`<div class="nodate" style="left:${X(TODAY)+8}px">сроки не заданы</div>`;
      if(m.bs!=null) tr+=`<div class="bl" style="left:${X(m.bs)}px;width:${(m.bf-m.bs+1)*px}px"></div>`;
      body+=`<div class="row${ui.sel===t.id?' sel':''}" data-id="${t.id}"><div class="lab"><div class="t"><div class="n" title="${esc(t.name)}">${esc(t.name)}</div><div class="s">${esc(subtitle(t))}</div></div>${crit&&FL[t.id]<0?`<span class="fl" title="Отрицательный резерв: не успевает к сроку">${FL[t.id]}</span>`:''}<span class="cr calc" title="${esc(rateUnit(t))}">${rateCalc(t)!=null?nf(rateCalc(t),1):'—'}<small class="rate-unit">${!t.ms&&t.vol?esc(rateUnit(t)):''}</small></span><span class="cr">${t.vol?(canWrite?`<input class="ratein${t.rateExp>0?' set':''}" type="number" step="any" min="0" data-id="${t.id}" value="${t.rateExp??''}" placeholder="" aria-label="Выработка подрядчика" title="${rateFact(t)!=null?'По факту сейчас: '+nf(rateFact(t),1)+' '+esc(rateUnit(t))+'. ':''}Введите свою выработку, ${esc(rateUnit(t))}">`:(t.rateExp>0?nf(t.rateExp,1):'—')):''}</span><span class="cr fact-rate" title="Средний темп по дневным записям, от первой записи до выбранной даты. Ранее выполненный объём не включён.">${rateFact(t)!=null?nf(rateFact(t),1):'—'}<small class="rate-unit">${!t.ms&&t.vol?esc(rateUnit(t)):''}</small></span><span class="cd">${fmt(startOf(t,r))}</span><span class="cd">${fmt(finishOf(t,r))}</span><span class="cn">${canWrite&&!t.stretch&&!t.ms&&!t.finishOnly?`<input class="durin" type="number" min="1" data-id="${t.id}" value="${t.dur??''}" aria-label="Длительность, дней" title="Длительность, календарных дней — измените и нажмите Enter">`:(r&&!t.finishOnly?(r.f-r.s+1):'—')}</span><span class="p ${pctClass(t)}">${canWrite?`<input class="percentin" type="number" min="0" max="100" step="0.1" data-id="${t.id}" value="${Number((m.pct*100).toFixed(1))}" aria-label="Готовность, %">`:pc}</span>${window.GPR_WORKSPACE.quantity()?`<span class="quantity-facade">${nf(m.done,1)} / ${t.vol??'—'} ${esc(t.unit)}</span>`:''}</div><div class="trk" style="width:${W}px">${tr}</div></div>`;
      y+=RH;
    }
  }
  // overlays
  let ov='';
  for(let d=T0;d<=T1;){const dt=dOf(d);const end=Math.round(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,1)/DAY);ov+=`<div class="gridl m" style="left:${X(d)}px"></div>`;d=end}
  for(let d=T0;d<=T1;d++){if(dOf(d).getUTCDay()===0)ov+=`<div class="wkend sunday-band" style="left:${X(d)}px;width:${px}px"></div>`}
  if(TODAY>=T0&&TODAY<=T1) ov+=`<div class="tline" style="left:${X(TODAY)+px/2-1}px"></div>`;
  if(settings.deadline){const dd=dn(settings.deadline);if(dd>=T0&&dd<=T1) ov+=`<div class="dline" style="left:${X(dd+1)}px" title="Срок сдачи ${fmt(dd)}"></div>`}
  const gw=$('gwrap'); const sl=gw.scrollLeft, stp=gw.scrollTop;
  const empty=!list.length?`<div class="empty">${Object.keys(tasks).length?'Под фильтр не попала ни одна работа. Сбросьте фильтры, чтобы увидеть весь график.':'В графике пока нет работ.'+(canWrite?' Нажмите «+ Работа», чтобы добавить первую.':'')}</div>`:'';
  gw.innerHTML=`<div class="ginner" style="width:calc(var(--lw) + ${W}px)">
    <div class="ghead"><div class="corner"><div class="chead"><span class="t">${list.length} работ</span><span class="cr" title="Выработка расчётная: объём ÷ длительность, ед. в день">Расчётная</span><span class="cr" title="Выработка подрядчика из файла, ед. в день">Подрядчик</span><span class="cr fact-rate" title="Выработка фактическая по дневным записям">Фактическая</span><span class="cd">Начало</span><span class="cd">Оконч.</span><span class="cn">Дн.</span><span class="p">%</span>${window.GPR_WORKSPACE.quantity()?'<span class="quantity-facade">Выполнено / объём</span>':''}</div></div><div class="scale" style="width:${W}px"><div class="mrow">${mh}</div>${dh?`<div class="drow">${dh}</div>`:''}<div class="load">${ld}</div>${TODAY>=T0&&TODAY<=T1?`<div class="tline" style="left:${X(TODAY)+px/2-1}px"></div>`:''}</div></div>
    <div class="gbody" id="gbody">${body}<div id="ovl" style="position:absolute;top:0;bottom:0;left:var(--lw);width:${W}px;pointer-events:none;z-index:1">${ov}</div><svg class="links" id="links" style="left:var(--lw)" width="${W}" height="${y}"></svg></div>${empty}</div>`;
  gw.scrollLeft=sl; gw.scrollTop=stp;
  drawLinks();
  if(!render._scrolled&&list.length){render._scrolled=1;requestAnimationFrame(scrollToday)}
  $('bLinks').textContent=ui.links?'Скрыть связи':'Показать связи';
  $('bLinks').setAttribute('aria-pressed',ui.links);
  $('bCollapse').textContent=ui.collapsed.size?'Развернуть все':'Свернуть все';
  if(ui.sel&&$('drawer').classList.contains('open')) refreshDrawerStats();
}
function drawLinks(){
  const svg=$('links'); if(!svg) return;
  let out='<defs><marker id="ar" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0L6,3L0,6z" class="arrowhead" fill="context-stroke" stroke="none"/></marker></defs>';
  const vis=new Set(visibleIds);
  for(const id of visibleIds){
    const t=tasks[id], r=S[id]; if(!r) continue;
    for(const p of (t.preds||[])){
      if(!vis.has(p.id)) continue;
      const hl=ui.sel&&(ui.sel===id||ui.sel===p.id);
      const cr=ui.crit!=='off'&&isCrit(t)&&tasks[p.id]&&isCrit(tasks[p.id]);
      if(!ui.links&&!hl&&!cr) continue;
      const pr=S[p.id]; if(!pr) continue;
      const box=(task,result)=>({start:X(result.s),end:X(result.f+1),y:rowY[task.id],milestone:!!task.ms,startDay:result.s,finishDay:result.f,dayWidth:px});
      const link=window.GPR_LINKS.route(box(tasks[p.id],pr),box(t,r),p.type,+p.lag||0);
      const source=link.reversed?t:tasks[p.id], target=link.reversed?tasks[p.id]:t;
      const title=`${source.name} → ${target.name} · ${link.type}${p.lag?' · лаг '+p.lag+' дн.':''}${link.reversed?' · обратная запись, показано по ходу событий':''}`;
      out+=`<path class="dependency ${hl?'hl':cr?'cr':''}" data-from="${esc(source.id)}" data-to="${esc(target.id)}" data-type="${link.type}" data-reversed="${link.reversed}" d="${link.d}" marker-end="url(#ar)"><title>${esc(title)}</title></path>`;
    }
  }
  svg.innerHTML=out;
}

// ---------- tooltip ----------
const tip=$('tip');
function showTip(e,id){
  const t=tasks[id],r=S[id],m=t._m;
  const stl={done:'выполнено',over:'срок прошёл, не закрыто',late:'отстаёт от плана',run:'идёт',future:'не начато',nodate:'без сроков'}[m.st];
  tip.innerHTML=`<b>#${t.num} ${esc(t.name)}</b><br>${esc(stageOf(t)?.short||'')}${t.contractor?', '+esc(t.contractor):''}<br>${t.finishOnly?'Завершено '+fmt(dn(t.finishOnly)):r?fmt(r.s)+' – '+fmt(r.f)+', '+(r.f-r.s+1)+' дн.':'сроки не заданы'}<br>`+
   (m.manual?`Готовность задана вручную: ${nf(m.pct*100)}%<br>`:'')+(m.vol?`Учтённый объём: выполнено ${nf(m.done)} из ${nf(m.vol)} ${esc(t.unit)} (${Math.round(m.pct*100)}%)<br>План на ${fmt(TODAY)}: ${nf(m.plan)}<br>`:'')+
   (m.bf!=null&&r?`Сдвиг к базовому плану: ${r.f-m.bf>0?'+':''}${r.f-m.bf} дн.<br>`:'')+(FL[id]!=null?`Резерв времени: ${FL[id]} дн.${FL[id]<=0?' — критическая':''}<br>`:'')+`Статус: ${stl}`+(t.note?`<br><i>${esc(t.note.slice(0,160))}</i>`:'');
  tip.style.display='block'; moveTip(e);
}
function moveTip(e){const w=tip.offsetWidth,h=tip.offsetHeight;let x=e.clientX+14,y=e.clientY+14;if(x+w>innerWidth-8)x=e.clientX-w-14;if(y+h>innerHeight-8)y=e.clientY-h-14;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.style.display='none'}

// ---------- events on gantt ----------
const gw=$('gwrap');
gw.addEventListener('click',e=>{
  const g=e.target.closest('.row.grp');
  if(g){const k=g.dataset.g;ui.collapsed.has(k)?ui.collapsed.delete(k):ui.collapsed.add(k);render();return}
  if(e.target.closest('input')) return;
  const msd=e.target.closest('.ms'); if(msd){openDrawer(msd.dataset.id);return}
  const lab=e.target.closest('.row[data-id] .lab');
  if(lab){openDrawer(lab.parentElement.dataset.id)}
});
gw.addEventListener('change',async e=>{const input=e.target.closest('.percentin');if(!input||!canWrite)return;if(dirty){toast('Сначала сохраните или закройте карточку.');render();return;}const t=tasks[input.dataset.id],n=+input.value;if(!t||!Number.isFinite(n)||n<0||n>100){toast('Процент — число от 0 до 100.');render();return;}const next=clone(t);next.progressMode='percent';next.manualPercent=n;next.closed=n>=100;await saveTask(next,'Готовность и проценты групп обновлены');});
gw.addEventListener('mouseover',e=>{const b=e.target.closest('.bar,.ms');if(b&&!drag)showTip(e,b.dataset.id)});
gw.addEventListener('mousemove',e=>{if(tip.style.display==='block')moveTip(e)});
gw.addEventListener('mouseout',e=>{if(e.target.closest('.bar,.ms'))hideTip()});
gw.addEventListener('change',e=>{
  const inp=e.target.closest('.durin'); if(!inp||!canWrite) return;
  const v=Number(inp.value), t=tasks[inp.dataset.id]; if(!t) return;
  if(!Number.isInteger(v)||v<1){inp.value=t.dur??'';toast('Длительность — целое число дней, не меньше 1');return}
  if(v===t.dur) return;
  const c=clone(t); c.dur=v; saveTask(c,`«${t.name.slice(0,40)}»: ${v} дн.`);
});
gw.addEventListener('keydown',e=>{if(e.target.classList&&(e.target.classList.contains('durin')||e.target.classList.contains('ratein')||e.target.classList.contains('percentin'))&&e.key==='Enter')e.target.blur()});
gw.addEventListener('change',e=>{
  const inp=e.target.closest('.ratein'); if(!inp||!canWrite) return;
  const t=tasks[inp.dataset.id]; if(!t) return;
  const raw=inp.value.trim(), v=raw===''?null:parseFloat(raw.replace(',','.'));
  if(v!==null&&(isNaN(v)||v<=0)){inp.value=t.rateExp??'';toast('Выработка должна быть положительным числом в выбранной единице расчёта');return}
  if(v===(t.rateExp??null)) return;
  const c=clone(t); c.rateExp=v; const nd=durFromRate(c,v);
  saveTask(c, v==null?'Выработка очищена':`Выработка ${nf(v,1)} ${rateUnit(t)}${nd&&nd!==t.dur?` — по ней длительность была бы ${nd} дн. вместо ${t.dur}. Пересчитать можно в «Выработки» или в карточке работы`:''}`);
});
let drag=null;
gw.addEventListener('pointerdown',e=>{
  const b=e.target.closest('.bar'); if(!b) return;
  const id=b.dataset.id;
  drag={id,el:b,x0:e.clientX,mode:e.target.classList.contains('rz')&&canWrite?'rz':'mv',l0:b.offsetLeft,w0:b.offsetWidth,moved:false};
  b.setPointerCapture(e.pointerId);
});
gw.addEventListener('pointermove',e=>{
  if(!drag) return; const dx=e.clientX-drag.x0;
  if(Math.abs(dx)>4) drag.moved=true;
  if(!drag.moved||!canWrite) return;
  hideTip();
  const dd=Math.round(dx/px);
  if(drag.mode==='mv') drag.el.style.left=(drag.l0+dd*px)+'px';
  else drag.el.style.width=Math.max(px,drag.w0+dd*px)+'px';
});
gw.addEventListener('pointerup',e=>{
  if(!drag) return; const d=drag; drag=null;
  if(!d.moved||!canWrite){openDrawer(d.id);return}
  const dd=Math.round((e.clientX-d.x0)/px); if(!dd){render();return}
  const t=clone(tasks[d.id]), r=S[d.id];
  if(d.mode==='rz'){ if(t.stretch){toast('Окончание этой работы задают связи — длительность меняется через них');render();return} t.dur=Math.max(1,(+t.dur||1)+dd);saveTask(t,`Длительность: ${t.dur} дн.`)}
  else{
    const ns=r.s+dd; t.cons=isoOf(ns);
    tasks[d.id]=t; compute();
    const got=S[d.id].s;
    saveTask(t,got!==ns?`Начало ограничено связью: раньше ${fmt(got)} работа начаться не может`:`Начало не ранее ${fmt(ns)}`);
  }
});
gw.addEventListener('pointercancel',()=>{drag=null;render()});

// ---------- controls ----------
function seg(id,key){$(id).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;ui[key]=b.dataset.v;[...$(id).children].forEach(x=>x.classList.toggle('on',x===b));if(key==='group')ui.collapsed.clear();render();if(key==='zoom')scrollToday()})}
seg('segGroup','group'); seg('segZoom','zoom');
$('kpis').addEventListener('click',e=>{const b=e.target.closest('.kpi');if(!b)return;const k=b.dataset.k;ui.kpi=(k==='all'||ui.kpi===k)?'':k;if(ui.kpi==='crit'&&ui.crit==='off'){ui.crit='project';$('fCrit').value='project'}render()});
$('fCrit').onchange=e=>{ui.crit=e.target.value;if(ui.crit==='off'&&ui.kpi==='crit')ui.kpi='';render()};
$('fSort').onchange=e=>{ui.sort=e.target.value;render()};
$('deadline').onchange=async e=>{
  if(!canWrite){e.target.value=settings.deadline||'';toast('У вас доступ только на просмотр');return}
  const v=e.target.value||null; settings.deadline=v; render();
  try{await db.doc('meta/settings').set(Object.assign({},settings,{deadline:v}));toast(v?'Срок сдачи: '+fmt(dn(v)):'Срок сдачи убран')}catch(err){handleWriteErr(err)}
};
$('fCat').onchange=e=>{ui.cat=e.target.value;render()};
$('fStage').onchange=e=>{ui.stage=e.target.value;render()};
$('fType').onchange=e=>{ui.type=e.target.value;render()};
$('fCon').onchange=e=>{ui.con=e.target.value;render()};
let qt;$('fSearch').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{ui.q=e.target.value;render()},150)};
$('bToday').onclick=scrollToday;
$('bCtl').onclick=()=>{const c=$('ctl').classList.toggle('show');$('bCtl').setAttribute('aria-expanded',c)};
$('bLinks').onclick=()=>{ui.links=!ui.links;render()};
$('bCollapse').onclick=()=>{
  if(ui.collapsed.size) ui.collapsed.clear();
  else { groups(filtered(false)).forEach(g=>{if(g.label!==null)ui.collapsed.add(g.key)}) }
  render();
};
$('bReset').onclick=()=>{Object.assign(ui,{cat:'',stage:'',type:'',con:'',q:'',kpi:''});$('fSearch').value='';$('facadeRangeStart').value='';$('facadeRangeEnd').value='';$('facadePeriodOnly').checked=false;$('facadePeriodNotice').textContent='';render()};
$('statusDate').value=isoOf(TODAY);
$('statusDate').onchange=e=>{if(e.target.value){TODAY=dn(e.target.value);render();scrollToday()}};
function scrollToday(){const target=X(TODAY)-gw.clientWidth*0.3;gw.scrollLeft=Math.max(0,target)}

// ---------- toast ----------
let tt;function toast(m){const el=$('toast');el.textContent=m;el.style.display='block';clearTimeout(tt);tt=setTimeout(()=>el.style.display='none',3200)}
const clone=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==='_m'?undefined:v));

// ---------- saving ----------
let readOnlyHit=false;
async function saveTask(t,msg){
  if(!canWrite){toast('Доступ только на просмотр');return false;}
  const body=clone(t);
  try{await db.collection('tasks').doc(t.id).set(body);if(msg)toast(msg);return true;}catch(e){handleWriteErr(e);return false;}
}
function handleWriteErr(e){
  if(store&&store.scheduleId){useData(store.snapshot());render();}
  $('saveStatus').textContent='Изменения не сохранены';
  banner('Не удалось сохранить: '+(e?.message||'ошибка соединения')+'. Карточка остаётся открытой; обновите график перед повтором.');toast('Изменения не сохранены');
}

// ---------- drawer ----------
let draft=null, dirty=false;
function openDrawer(id,isNew){
  ui.sel=id; draft=isNew?isNew:clone(tasks[id]); dirty=!!isNew;
  renderDrawer(); $('drawer').classList.add('open'); render();
}
function closeDrawer(){
  if(dirty&&canWrite&&!confirm('Изменения не сохранены. Закрыть без сохранения?')) return;
  $('drawer').classList.remove('open'); ui.sel=null; draft=null; dirty=false; render();
}
function taskOpts(exclude){
  return Object.values(tasks).filter(t=>t.id!==exclude).sort((a,b)=>stOrder(a)-stOrder(b)||a.num-b.num)
    .map(t=>`<option value="${t.id}">#${t.num} ${esc(t.name.slice(0,48))} (${esc(stageOf(t)?.short||'')})</option>`).join('');
}
function renderDrawer(){
  const t=draft, ro=!canWrite, dis=ro?' disabled':'';
  const st=Object.values(stages).sort((a,b)=>a.order-b.order);
  const types=[...new Set(Object.values(tasks).map(x=>x.type).filter(Boolean))].sort();
  const cons=[...new Set(Object.values(tasks).map(x=>x.contractor).filter(Boolean))].sort();
  const succ=Object.values(tasks).filter(x=>(x.preds||[]).some(p=>p.id===t.id));
  const facts=Object.entries(t.facts||{}).sort((a,b)=>b[0].localeCompare(a[0]));
  const isNew=!tasks[t.id];
  $('drawer').innerHTML=`
  <div class="dh"><h2>${isNew?'Новая работа':'#'+t.num+' '+esc(t.name)}</h2><button class="x" id="dClose" aria-label="Закрыть">✕</button></div>
  <div class="db">
    ${t.sys?`<div class="sysn">Пометка при переносе из Excel: ${esc(t.sys)}</div>`:''}
    ${cycles.has(t.id)?'<div class="warnbox">Работа попала в замкнутую цепочку связей — уберите одну из связей.</div>':''}
    <div class="stats" id="dStats"></div>
    <div class="sect">Работа</div>
    <div class="f"><label>Название</label><input id="dName" value="${esc(t.name)}"${dis}></div>
    <div class="g2">
      <div class="f"><label>Этап</label><select id="dStage"${dis}>${st.map(s=>`<option value="${s.id}"${s.id===t.stage?' selected':''}>${esc(s.short||s.name)}</option>`).join('')}</select></div>
      <div class="f"><label>Вид работ</label><input id="dType" list="dlTypes" value="${esc(t.type)}"${dis}></div>
    </div>
    <div class="g2">
      <div class="f"><label>Подрядчик</label><input id="dCon" list="dlCons" value="${esc(t.contractor)}" placeholder="не назначен"${dis}></div>
      <div class="f"><label>Категория</label><select id="dCat"${dis}><option value="facade"${t.cat==='facade'?' selected':''}>Фасад</option><option value="glass"${t.cat==='glass'?' selected':''}>Светопрозрачные</option><option value="prep"${t.cat==='prep'?' selected':''}>Леса и подготовка</option><option value="other"${t.cat==='other'?' selected':''}>Смежные работы и вехи</option></select></div>
    </div>
    <div class="f"><label>Раздел внутри этапа</label><input id="dSec" list="dlSecs" value="${esc(t.section||'')}" placeholder="например, Завершение СМР"${dis}></div>
    <datalist id="dlSecs"><option value="Завершение СМР"></datalist>
    <datalist id="dlTypes">${types.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    <datalist id="dlCons">${cons.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    <div class="g3">
      <div class="f"><label>Ед. изм.</label><input id="dUnit" value="${esc(t.unit)}"${dis}></div>
      <div class="f"><label>Объём</label><input id="dVol" type="number" step="any" value="${t.vol??''}"${dis}></div>
      <div class="f"><label>Выполнено ранее</label><input id="dOpen" type="number" step="any" value="${t.open||''}" title="Объём, сделанный до подённого учёта"${dis}></div>
    </div>
    <div class="g2"><div class="f"><label>Готовность, %</label><input id="dPercent" type="number" min="0" max="100" step="0.1" value="${t.progressMode==='percent'?t.manualPercent??0:Math.round((tasks[t.id]?._m?.pct||0)*100)}"${dis}></div><div class="f"><label><input type="checkbox" id="dProgressByFacts" ${t.progressMode!=='percent'?'checked':''}${dis} style="width:auto"> Считать по факту объёма</label></div></div>
    ${!t.vol?`<div class="f"><label><input type="checkbox" id="dClosed"${t.closed?' checked':''}${dis} style="width:auto"> Работа закрыта (для работ без объёма)</label></div>`:''}
    ${t.vol&&!t.stretch&&!t.ms?`<div class="sect">Выработка</div>
    <div class="g2"><div class="f"><label>Единица расчёта</label><select id="dRateBasis"${dis}>${[['day','Общий темп за день'],['person','На человека за день'],['crew','На бригаду за день']].map(([v,l])=>`<option value="${v}" ${(t.rateBasis||'day')===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="f"><label id="dResourceLabel">${t.rateBasis==='crew'?'Бригад':t.rateBasis==='person'?'Рабочих':'Количество ресурса'}</label><input id="dRateResources" type="number" min="1" step="1" value="${t.rateResources??''}" ${!t.rateBasis||t.rateBasis==='day'?'disabled':dis} placeholder="Укажите количество"></div></div><p class="rnote" id="dRateHelp">${esc(rateUnit(t))}. ${resourceFactor(t)?'Общий темп = заданная выработка × количество ресурса.':'Для расчёта укажите количество рабочих или бригад.'} Дни — календарные. Факт на человека требует отдельной истории численности.</p>
    <div class="g3">
      <div class="f"><label>Расчётная, ${esc(rateUnit(t))}</label><input value="${rateCalc(t)!=null?nf(rateCalc(t),2):'—'}" disabled></div>
      <div class="f"><label>Темп по дневному журналу</label><input value="${rateFact(t)!=null?nf(rateFact(t),2):'—'}" disabled></div>
      <div class="f"><label>Подрядчик, ${esc(rateUnit(t))}</label><input id="dRate" type="number" step="any" min="0" value="${t.rateExp??''}"${dis}></div>
    </div>
    ${ro?'':`<button class="btn" id="dRateApply">Пересчитать длительность по выработке</button>`}`:''}
    <div class="sect">Сроки и связи</div>
    <div class="g2">
      <div class="f"><label>Длительность, календ. дней</label><input id="dDur" type="number" min="1" value="${t.dur||''}"${dis}${t.stretch?' title="Для растягиваемой работы — длительность по умолчанию, если окончание не задано связью"':''}></div>
      <div class="f"><label>Начало не ранее</label><input id="dCons" type="date" value="${t.cons||''}"${dis}></div>
    </div>
    ${t.finishOnly?`<div class="f"><label>Только дата завершения</label><input id="dFinishOnly" type="date" value="${esc(t.finishOnly)}"${dis}></div>`:''}
    <label class="chk"><input type="checkbox" id="dStretch"${t.stretch?' checked':''}${dis}><span>Растягивать по связям: начало задают связи ОН/НН, окончание — связи ОО/НО</span></label>
    <label class="chk"><input type="checkbox" id="dMs"${t.ms?' checked':''}${dis}><span>Веха (контрольное событие, ромб на графике)</span></label>
    <div class="f"><label>Предшественники. ОН — начать после окончания; НН — начать от начала; ОО — закончить от окончания; НО — закончить от начала. Лаг в днях, может быть отрицательным.</label></div>
    <div id="dPreds">${(t.preds||[]).map((p,i)=>`<div class="predrow" data-i="${i}"><select class="pId"${dis}>${taskOpts(t.id).replace(`value="${p.id}"`,`value="${p.id}" selected`)}</select><select class="pType"${dis}>${['ОН','НН','ОО','НО'].map(x=>`<option${x===p.type?' selected':''}>${x}</option>`).join('')}</select><input class="pLag" type="number" value="${p.lag||0}"${dis}><button class="x pDel"${dis} aria-label="Удалить связь">✕</button></div>`).join('')||'<div class="note-ro">Связей нет — работа начинается с даты «Начало не ранее» или с начала графика.</div>'}</div>
    ${ro?'':'<button class="btn" id="dAddPred">+ Связь</button>'}
    ${succ.length?`<div class="f" style="margin-top:10px"><label>От этой работы зависят</label><div class="succ">${succ.map(s=>`<a data-id="${s.id}">#${s.num} ${esc(s.name)} (${esc(stageOf(s)?.short||'')})</a>`).join('')}</div></div>`:''}
    <div class="sect">Факт по дням</div>
    ${ro?'':`<div class="factadd"><input type="date" id="fDate" value="${isoOf(TODAY)}"><input type="number" step="any" id="fVal" placeholder="${esc(t.unit||'объём')}"><button class="btn" id="fAdd">Внести</button></div>`}
    <div class="facts">${facts.length?`<table>${facts.map(([d,v])=>`<tr><td>${fmt(dn(d))}</td><td class="v">${nf(+v,2)} ${esc(t.unit)}</td><td style="width:28px">${ro?'':`<button class="x fDel" data-d="${d}" aria-label="Удалить">✕</button>`}</td></tr>`).join('')}</table>`:'<div class="note-ro" style="padding:8px">Фактических записей пока нет.</div>'}</div>
    <div class="sect">Примечание (комментарий из ГПР)</div>
    <div class="f"><textarea id="dNote" rows="3"${dis}>${esc(t.note)}</textarea></div>
    ${!isNew&&!ro?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" id="dUp">↑ Выше в этапе</button><button class="btn" id="dDown">↓ Ниже в этапе</button></div>`:''}
    ${!isNew&&!ro?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dDup">Дублировать</button><button class="btn" id="dDel" style="color:var(--red)">Удалить работу</button></div>`:''}
  </div>
  ${ro?'':`<div class="df"><button class="btn dark" id="dSave">${isNew?'Добавить работу':'Сохранить изменения'}</button><button class="btn" id="dCancel">Отмена</button><span class="dirty" id="dDirty">${dirty?'есть несохранённые изменения':''}</span></div>`}`;
  refreshDrawerStats();
  bindDrawer();
}
function refreshDrawerStats(){
  const el=$('dStats'); if(!el||!draft) return;
  const real=tasks[draft.id];
  // compute stats on draft
  const saved=tasks[draft.id]; tasks[draft.id]=draft; compute();
  const r=S[draft.id], m=draft._m, FLd=FL[draft.id]??null;
  if(saved) tasks[draft.id]=saved; else delete tasks[draft.id];
  compute();
  if(!m){el.innerHTML='';return}
  const rate=r&&m.vol&&TODAY>=r.s&&m.done>0?m.done/(TODAY-r.s+1):null;
  const fc=r&&m.vol?(m.complete?null:(rate?TODAY+Math.ceil((m.vol-m.done)/rate):null)):null;
  const need=r&&m.vol&&!m.complete?(m.vol-m.done)/Math.max(1,r.f-TODAY):null;
  const dev=m.plan!=null?m.done-m.plan:null;
  const shift=r&&m.bf!=null?r.f-m.bf:null;
  const fl=FLd;
  el.innerHTML=`
    <div><span>Начало</span>${fmt(startOf(draft,r))}</div><div><span>Окончание</span>${draft.finishOnly?fmt(dn(draft.finishOnly)):r?fmt(r.f)+' ('+(r.f-r.s+1)+' дн.)':'—'}</div>
    <div><span>Выполнено</span>${m.vol?nf(m.done)+' из '+nf(m.vol)+' ('+Math.round(m.pct*100)+'%)':(m.complete?'закрыто':'—')}</div>
    <div><span>План на ${fmt(TODAY)}</span>${m.plan!=null?nf(m.plan):'—'}</div>
    <div><span>Отклонение от плана</span><b class="${dev==null?'':dev<-0.5?'bad':'ok'}">${dev==null?'—':(dev>0?'+':'')+nf(dev)}</b></div>
    <div><span>Нужный темп в день</span>${need!=null?nf(need):'—'}</div>
    <div><span>Прогноз окончания</span><b class="${fc&&r&&fc>r.f?'bad':''}">${fc?fmt(fc):(m.complete?'готово':'—')}</b></div>
    <div><span>Резерв времени${ui.crit==='stage'?' (до конца этапа)':' (до срока сдачи)'}</span><b class="${fl==null?'':fl<=0?'bad':fl<=5?'warn':'ok'}">${fl==null?'—':fl+' дн.'+(fl<=0?' — критическая':'')}</b></div>
    <div><span>Сдвиг к базовому плану</span><b class="${shift>0?'bad':shift<0?'ok':''}">${shift==null?'—':(shift>0?'+':'')+shift+' дн.'}</b></div>`;
}
function readDraft(){
  const v=id=>$(id)?$(id).value:undefined;
  const t=draft;
  t.name=v('dName').trim(); t.stage=v('dStage'); t.type=v('dType').trim(); t.contractor=v('dCon').trim(); t.cat=v('dCat');
  t.unit=v('dUnit').trim();
  const vol=parseFloat(v('dVol')); t.vol=isNaN(vol)?null:vol;
  const op=parseFloat(v('dOpen')); t.open=isNaN(op)?0:op;
  const du=Number(v('dDur')); t.dur=!Number.isInteger(du)||du<1?null:du;
  t.cons=v('dCons')||null;if($('dFinishOnly')){if(t.cons){delete t.finishOnly;t.dur=t.dur||1;}else{t.finishOnly=v('dFinishOnly')||null;t.dur=0;}}
  if($('dClosed')) t.closed=$('dClosed').checked;if($('dPercent')){const n=Number(v('dPercent'));if(Number.isFinite(n)&&n>=0&&n<=100){t.manualPercent=n;t.progressMode=$('dProgressByFacts').checked?'volume':'percent';}}
  t.note=v('dNote');
  if($('dRateBasis')){t.rateBasis=$('dRateBasis').value;t.rateResources=Number($('dRateResources').value)||null;}
  if($('dRate')){const rv=parseFloat(($('dRate').value||'').replace(',','.')); t.rateExp=isNaN(rv)||rv<=0?null:rv}
  t.section=(v('dSec')||'').trim(); t.stretch=$('dStretch').checked; t.ms=$('dMs').checked;
  if(t.ms) t.dur=0;
  t.preds=[...document.querySelectorAll('#dPreds .predrow')].map(r=>({id:r.querySelector('.pId').value,type:r.querySelector('.pType').value,lag:parseInt(r.querySelector('.pLag').value)||0}));
}
function markDirty(){dirty=true;const d=$('dDirty');if(d)d.textContent='есть несохранённые изменения';readDraft();refreshDrawerStats()}
function bindDrawer(){
  $('dClose').onclick=closeDrawer;
  document.querySelectorAll('.succ a').forEach(a=>a.onclick=()=>{if(dirty&&!confirm('Изменения не сохранены. Перейти без сохранения?'))return;dirty=false;openDrawer(a.dataset.id)});
  if(!canWrite) return;
  $('drawer').querySelectorAll('.db input,.db select,.db textarea').forEach(el=>{if(el.id==='fDate'||el.id==='fVal')return;el.addEventListener('input',markDirty);el.addEventListener('change',markDirty)});
  if($('dPercent'))$('dPercent').addEventListener('input',()=>{$('dProgressByFacts').checked=false;markDirty();});
  if($('dRateBasis')) $('dRateBasis').addEventListener('change',()=>{readDraft();draft.rateExp=null;dirty=true;renderDrawer();});
  if($('dRateApply')) $('dRateApply').onclick=()=>{
    readDraft(); if(!resourceFactor(draft)){toast('Укажите количество рабочих или бригад');return;} const rate=draft.rateExp||rateFact(draft);
    if(!(rate>0)){toast('Введите выработку в поле «Фактическая / экспертная»');return}
    const saved=tasks[draft.id]; tasks[draft.id]=draft; compute(); const nd=durFromRate(draft,rate); if(saved)tasks[draft.id]=saved; compute();
    if(!nd){toast('Работа уже выполнена — пересчитывать нечего');return}
    $('dDur').value=nd; draft.dur=nd; markDirty(); toast(`Длительность ${nd} дн. по выработке ${nf(rate,1)} ${rateUnit(draft)} — нажмите «Сохранить изменения»`);
  };
  $('dAddPred').onclick=()=>{readDraft();const opts=Object.values(tasks).filter(x=>x.id!==draft.id);if(!opts.length)return;draft.preds.push({id:opts[0].id,type:'ОН',lag:0});dirty=true;renderDrawer()};
  document.querySelectorAll('.pDel').forEach(b=>b.onclick=()=>{readDraft();draft.preds.splice(+b.closest('.predrow').dataset.i,1);dirty=true;renderDrawer()});
  $('fAdd').onclick=()=>{
    readDraft();const d=$('fDate').value,val=parseFloat($('fVal').value);
    if(!d||isNaN(val)){toast('Укажите дату и объём');return}
    draft.facts=draft.facts||{}; draft.facts[d]=(+draft.facts[d]||0)+val; dirty=true;
    if(tasks[draft.id]) { doSave('Факт внесён: '+nf(val,2)+' '+(draft.unit||'')+' за '+fmt(dn(d))) } else renderDrawer();
  };
  document.querySelectorAll('.fDel').forEach(b=>b.onclick=()=>{readDraft();delete draft.facts[b.dataset.d];dirty=true;if(tasks[draft.id])doSave('Запись факта удалена');else renderDrawer()});
  $('dSave').onclick=()=>{readDraft();doSave(tasks[draft.id]?'Сохранено':'Работа добавлена')};
  $('dCancel').onclick=()=>{dirty=false;closeDrawer()};
  const mv=async dir=>{
    if(dirty&&!confirm('Изменения не сохранены. Переместить без сохранения?'))return;
    const me=tasks[draft.id]; const sib=Object.values(tasks).filter(x=>x.stage===me.stage).sort((a,b)=>(a.order||0)-(b.order||0)||a.num-b.num);
    const i=sib.findIndex(x=>x.id===me.id), j=i+dir; if(j<0||j>=sib.length){toast(dir<0?'Работа уже первая в этапе':'Работа уже последняя в этапе');return}
    [sib[i],sib[j]]=[sib[j],sib[i]];
    const changed=[]; sib.forEach((x,k)=>{if(x.order!==k){const c=clone(x);c.order=k;tasks[c.id]=c;changed.push(c)}});
    dirty=false; render();
    try{ for(const c of changed) await db.collection('tasks').doc(c.id).set(clone(c)); if(ui.sort!=='gpr')toast('Порядок изменён — он виден в режиме «Порядок как в ГПР»'); }
    catch(e){handleWriteErr(e)}
    draft=clone(tasks[me.id]); renderDrawer();
  };
  if($('dUp')) $('dUp').onclick=()=>mv(-1);
  if($('dDown')) $('dDown').onclick=()=>mv(1);
  if($('dDup')) $('dDup').onclick=()=>{
    if(dirty&&!confirm('Изменения не сохранены. Продолжить без сохранения?'))return;
    const n=clone(tasks[draft.id]); n.id=db.collection('tasks').doc().id; n.num=nextNum(); n.name=n.name+' (копия)'; n.facts={}; n.open=0; n.closed=false; n.sys=''; n.order=(n.order||0)+0.5;
    dirty=false; openDrawer(n.id,n);
  };
  if($('dDel')) $('dDel').onclick=async()=>{
    const id=draft.id, deps=Object.values(tasks).filter(x=>(x.preds||[]).some(p=>p.id===id));
    if(!confirm(`Удалить работу «${draft.name}»?`+(deps.length?` От неё зависят ${deps.length} работ — связи с ней будут убраны.`:'')))return;
    try{
      for(const d of deps){const c=clone(d);c.preds=c.preds.filter(p=>p.id!==id);await db.collection('tasks').doc(c.id).set(c)}
      await db.collection('tasks').doc(id).delete();
      dirty=false;$('drawer').classList.remove('open');ui.sel=null;draft=null;toast('Работа удалена');
    }catch(e){handleWriteErr(e)}
  };
}
// ---- выработки ----
function rateUnit(t){const u=t.unit||'ед.';return u+({day:'/день',person:'/чел.-день',crew:'/бриг.-день'}[t.rateBasis||'day']||'/день')}
function resourceFactor(t){return !t.rateBasis||t.rateBasis==='day'?1:(+t.rateResources>0?+t.rateResources:null)}
function rateCalc(t){if(t.finishOnly)return null;const v=+t.vol||0,r=S[t.id],d=r?r.f-r.s+1:(+t.dur||0),k=resourceFactor(t);return v&&d&&k?v/d/k:null}
function rateFact(t){if(t.rateBasis&&t.rateBasis!=='day')return null;const rows=Object.entries(t.facts||{}).filter(([d,q])=>d<=isoOf(TODAY)&&Number.isFinite(+q)).sort();if(!rows.length)return null;const n=TODAY-dn(rows[0][0])+1;return n>0?rows.reduce((a,[,q])=>a+(+q),0)/n:null}
function durFromRate(t,rate){rate=rate??t.rateExp;const v=+t.vol||0,k=resourceFactor(t);if(!(rate>0)||!v||!k||t.stretch||t.ms)return null;const m=t._m,r=S[t.id];if(m&&m.complete)return null;const pace=rate*k;if(r&&TODAY>r.s&&m&&m.done>0){const elapsed=TODAY-r.s;return Math.max(elapsed+1,elapsed+Math.ceil(Math.max(0,v-m.done)/pace))}return Math.max(1,Math.ceil(Math.max(0,v-(m?m.done:0))/pace))}
function nextNum(){return Math.max(0,...Object.values(tasks).map(t=>t.num||0))+1}
async function doSave(msg){
  const t=draft;
  if(!t.name){toast('Введите название работы');return}
  if(t.rateBasis!=='day'&&t.rateBasis&&t.rateExp>0&&!resourceFactor(t)){toast('Для выработки на ресурс укажите количество');return}
  for(const p of t.preds){ if(wouldCycle(t.id,p.id)){toast(`Связь с #${tasks[p.id]?.num} создаст замкнутый круг — выберите другую работу`);return} }
  const seen=new Set();t.preds=t.preds.filter(p=>!seen.has(p.id)&&seen.add(p.id));
  if(!await saveTask(clone(t),msg)){dirty=true;renderDrawer();return;}
  dirty=false;draft=clone(tasks[t.id]||t);renderDrawer();
}
$('bAdd').onclick=()=>{
  const st=ui.stage||Object.values(stages).sort((a,b)=>a.order-b.order)[0]?.id;
  const id=db.collection('tasks').doc().id;
  openDrawer(id,{id,num:nextNum(),stage:st,order:999,name:'',unit:'м²',vol:null,open:0,facts:{},preds:[],cons:isoOf(TODAY),dur:5,type:ui.type||'',cat:ui.cat||'facade',contractor:'',closed:false,note:'',sys:'',section:'',stretch:false,ms:false});
};

// ---------- stages modal ----------
function openStages(){
  const list=Object.values(stages).sort((a,b)=>a.order-b.order);
  const cnt=id=>Object.values(tasks).filter(t=>t.stage===id).length;
  $('modal').innerHTML=`<div class="dh"><h2>Порядок этапов</h2><button class="x" id="mClose" aria-label="Закрыть">✕</button></div>
  <div class="db" id="mList">${list.map((s,i)=>`<div class="strow" data-id="${s.id}"><span class="num">${i+1}</span><input value="${esc(s.name)}" aria-label="Название этапа"><button class="btn mUp"${i===0?' disabled':''} aria-label="Выше">↑</button><button class="btn mDn"${i===list.length-1?' disabled':''} aria-label="Ниже">↓</button><button class="x mDel" title="${cnt(s.id)?'В этапе есть работы — сначала перенесите их':'Удалить этап'}"${cnt(s.id)?' disabled':''}>✕</button></div>`).join('')}
  <button class="btn" id="mAdd">+ Этап</button></div>
  <div class="df"><button class="btn dark" id="mSave">Сохранить</button><button class="btn" id="mCancel">Отмена</button></div>`;
  $('modalBg').style.display='flex';
  const rows=()=>[...document.querySelectorAll('#mList .strow')];
  const renum=()=>rows().forEach((r,i,a)=>{r.querySelector('.num').textContent=i+1;r.querySelector('.mUp').disabled=i===0;r.querySelector('.mDn').disabled=i===a.length-1});
  $('mList').onclick=e=>{
    const r=e.target.closest('.strow');
    if(e.target.classList.contains('mUp')&&r.previousElementSibling){r.parentNode.insertBefore(r,r.previousElementSibling);renum()}
    if(e.target.classList.contains('mDn')&&r.nextElementSibling?.classList.contains('strow')){r.parentNode.insertBefore(r.nextElementSibling,r);renum()}
    if(e.target.classList.contains('mDel')){r.dataset.del='1';r.style.display='none'}
    if(e.target.id==='mAdd'){const id=db.collection('stages').doc().id;const d=document.createElement('div');d.className='strow';d.dataset.id=id;d.dataset.new='1';d.innerHTML=`<span class="num"></span><input value="Новый этап" aria-label="Название этапа"><button class="btn mUp">↑</button><button class="btn mDn">↓</button><button class="x mDel">✕</button>`;e.target.before(d);renum()}
  };
  const close=()=>{$('modalBg').style.display='none'};
  $('mClose').onclick=close; $('mCancel').onclick=close;
  $('mSave').onclick=async()=>{
    try{
      let i=0;
      for(const r of rows()){
        const id=r.dataset.id;
        if(r.dataset.del){ if(stages[id]) await db.collection('stages').doc(id).delete(); continue }
        const name=r.querySelector('input').value.trim()||'Без названия';
        const m=name.match(/^Этап\s*([\d.]+)/); const short=m?'Этап '+m[1]:name.slice(0,24);
        const old=stages[id];
        if(!old||old.name!==name||old.order!==i) await db.collection('stages').doc(id).set({id,name,short,order:i});
        i++;
      }
      close(); toast('Этапы сохранены');
    }catch(e){handleWriteErr(e)}
  };
}
$('bStages').onclick=openStages;
// ---- сводная по выработкам ----
function rateGroups(){
  compute(); const map=new Map();
  for(const t of Object.values(tasks)){
    if(!(+t.vol>0)||t.stretch||t.ms) continue;
    const u=rateUnit(t); const k=(t.type||'Прочее')+'|'+u; if(!map.has(k)) map.set(k,{type:t.type||'Прочее',unit:u||'—',items:[]});
    map.get(k).items.push(t);
  }
  const out=[];
  for(const g of map.values()){
    let vol=0,dur=0,fd=0,fdays=0,nExp=0,volExp=0,durExpOnly=0,curDur=0,newDur=0,changed=0;
    const exps=new Set();
    for(const t of g.items){
      const r=S[t.id]; const d=r?r.f-r.s+1:(+t.dur||0); const k=resourceFactor(t);if(k){vol+=+t.vol;dur+=d*k;}
      const m=t._m; const observed=rateFact(t);if(observed!=null){fd+=observed;fdays++;}
      if(t.rateExp>0&&resourceFactor(t)){nExp++;exps.add(t.rateExp);volExp+=+t.vol;durExpOnly+=(+t.vol)/t.rateExp}
      const nd=durFromRate(t); if(nd&&t.dur){curDur+=t.dur;newDur+=nd;if(nd!==t.dur)changed++}
    }
    out.push(Object.assign(g,{n:g.items.length,vol,dur,rCalc:dur?vol/dur:null,rFact:fdays?fd/fdays:null,nExp,rExp:durExpOnly?volExp/durExpOnly:null,single:exps.size===1&&nExp===g.items.length?[...exps][0]:null,curDur,newDur,changed}));
  }
  return out.sort((a,b)=>a.type.localeCompare(b.type,'ru'));
}
function openRates(){
  const gs=rateGroups(); const ro=!canWrite;
  const tot=gs.reduce((a,g)=>({changed:a.changed+g.changed,cur:a.cur+g.curDur,nw:a.nw+g.newDur}),{changed:0,cur:0,nw:0});
  const pct=(a,b)=>a!=null&&b?`<span class="${a<b?'up':'dn'}">${a>=b?'+':''}${Math.round((a/b-1)*100)}%</span>`:'';
  $('modal').className='modal wide';
  $('modal').innerHTML=`<div class="dh"><h2>Сводная по выработкам, по видам работ</h2><button class="x" id="mClose" aria-label="Закрыть">✕</button></div>
  <div class="db">
    <p class="rnote">Расчётная — объём ÷ длительность по графику. Темп по факту рассчитывается только из дневных записей: от первой записи до отчётной даты. Начальный накопительный остаток в этот темп не входит. Экспертная — то, что вы ввели: в колонке «Заданная» у работы или здесь сразу на весь вид работ. Единица расчёта указана в каждой группе: за день, на человека или на бригаду. Группы с разными единицами не смешиваются.</p>
    <div style="overflow-x:auto"><table class="rtab"><thead><tr><th>Вид работ</th><th>Ед.</th><th>Работ</th><th>Объём</th><th>Выр. расчётная</th><th>Выр. по факту</th><th>Факт к расч.</th><th>Выр. экспертная</th><th>Экспертная к расч.</th>${ro?'':'<th>Задать на весь вид</th>'}<th>Сумма дней сейчас → по эксп.</th></tr></thead><tbody>
    ${gs.map((g,i)=>`<tr><td class="nm">${esc(g.type)}</td><td>${esc(g.unit)}</td><td>${g.n}</td><td>${nf(g.vol,0)}</td><td>${nf(g.rCalc,1)}</td><td>${g.rFact!=null?nf(g.rFact,1):'—'}</td><td>${pct(g.rFact,g.rCalc)}</td>
      <td>${g.rExp!=null?nf(g.rExp,1)+(g.nExp<g.n?` <span style="color:var(--muted)">(${g.nExp} из ${g.n})</span>`:''):'—'}</td><td>${pct(g.rExp,g.rCalc)}</td>
      ${ro?'':`<td><input type="number" step="any" min="0" data-g="${i}" class="gRate" value="${g.single??''}" placeholder="${g.rFact!=null?nf(g.rFact,1):''}"></td>`}
      <td>${g.curDur?`${g.curDur} → <b class="${g.newDur>g.curDur?'up':g.newDur<g.curDur?'dn':''}">${g.newDur}</b>`:'—'}</td></tr>`).join('')}
    </tbody></table></div>
  </div>
  ${ro?'':`<div class="df"><button class="btn" id="mSetRates">Сохранить выработки по видам</button><button class="btn dark" id="mApply"${tot.changed?'':' disabled'}>Пересчитать длительности по экспертным выработкам (${tot.changed} работ)</button><button class="btn" id="mClear">Очистить экспертные выработки</button><button class="btn" id="mCancel">Закрыть</button></div>`}`;
  $('modalBg').style.display='flex';
  const close=()=>{$('modalBg').style.display='none';$('modal').className='modal'};
  $('mClose').onclick=close; if($('mCancel'))$('mCancel').onclick=close;
  if(ro) return;
  $('mSetRates').onclick=async()=>{
    const ch=[];
    document.querySelectorAll('.gRate').forEach(inp=>{const g=gs[+inp.dataset.g]; const raw=inp.value.trim(); if(raw==='')return; const v=parseFloat(raw.replace(',','.')); if(!(v>0))return;
      for(const t of g.items){ if(t.rateExp!==v){const c=clone(t);c.rateExp=v;ch.push(c)} }});
    if(!ch.length){toast('Введите выработку хотя бы для одного вида работ');return}
    for(const c of ch){tasks[c.id]=c} render(); toast(`Сохраняю выработки: ${ch.length} работ…`);
    try{for(const c of ch) await db.collection('tasks').doc(c.id).set(clone(c)); toast(`Экспертные выработки сохранены для ${ch.length} работ`)}catch(e){handleWriteErr(e)}
    openRates();
  };
  $('mApply').onclick=async()=>{
    const ch=[]; for(const g of gs) for(const t of g.items){const nd=durFromRate(t); if(nd&&nd!==t.dur){const c=clone(t);c.dur=nd;ch.push(c)}}
    if(!ch.length) return;
    if(!confirm(`Изменить длительность ${ch.length} работ по экспертным выработкам? Сумма дней по этим работам: ${tot.cur} → ${tot.nw}. Связанные работы сдвинутся автоматически.`)) return;
    const endBefore=Math.max(...Object.values(S).filter(Boolean).map(r=>r.f));
    for(const c of ch){tasks[c.id]=c} render();
    const endAfter=Math.max(...Object.values(S).filter(Boolean).map(r=>r.f));
    try{for(const c of ch) await db.collection('tasks').doc(c.id).set(clone(c)); toast(`Длительности пересчитаны: ${ch.length} работ. Окончание графика ${fmt(endBefore)} → ${fmt(endAfter)}`)}catch(e){handleWriteErr(e)}
    openRates();
  };
  $('mClear').onclick=async()=>{
    const ch=Object.values(tasks).filter(t=>t.rateExp!=null).map(t=>{const c=clone(t);c.rateExp=null;return c});
    if(!ch.length){toast('Экспертных выработок нет');return}
    if(!confirm(`Очистить экспертные выработки у ${ch.length} работ? Длительности не изменятся.`))return;
    for(const c of ch){tasks[c.id]=c} render();
    try{for(const c of ch) await db.collection('tasks').doc(c.id).set(clone(c)); toast('Экспертные выработки очищены')}catch(e){handleWriteErr(e)}
    openRates();
  };
}
$('bRates').onclick=openRates;
$('modalBg').addEventListener('click',e=>{if(e.target===$('modalBg'))$('modalBg').style.display='none'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('modalBg').style.display==='flex'){$('modalBg').style.display='none';$('modal').className='modal'}else if($('drawer').classList.contains('open'))closeDrawer()}});

// ---------- shared working view and baseline cut ----------
function cutSchedule(data){const by=Object.fromEntries(data.tasks.map(t=>[t.id,t])),out={},active=new Set,ps=dn(data.settings.projectStart||'2026-09-20');function visit(id){if(id in out)return out[id];const t=by[id];if(!t||active.has(id))return null;if(t.finishOnly){const f=dn(t.finishOnly);return out[id]={s:f,f};}if((!t.ms&&!(t.dur>0)&&!t.stretch)||(t.ms&&!t.cons&&!t.preds?.length))return out[id]=null;active.add(id);let start=Math.max(ps,t.cons?dn(t.cons):ps),finish=null,dur=Math.max(1,+t.dur||1);for(const p of t.preds||[]){const r=visit(p.id);if(!r)continue;const lag=+p.lag||0;if(p.type==='НН')start=Math.max(start,r.s+lag);else if(p.type==='ОО'||p.type==='НО'){const n=(p.type==='ОО'?r.f:r.s)+lag;finish=finish===null?n:Math.max(finish,n);}else start=Math.max(start,r.f+(by[p.id]?.ms?0:1)+lag);}active.delete(id);if(t.stretch)return out[id]={s:start,f:Math.max(finish??start+dur-1,start)};start=finish!==null?Math.max(start,finish-dur+1):start;return out[id]={s:start,f:t.ms?start:start+dur-1};}data.tasks.forEach(t=>visit(t.id));return out;}
async function refreshCut(){if(cutBusy)return;if(dirty){toast('Сначала сохраните или закройте карточку.');return;}cutBusy=true;const day=$('cutDate').value,now=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());try{if(!day)throw Error('Укажите дату среза.');cutState=day<now?await store.asOf(day):null;$('cutNotice').textContent=day<now?'Сохранённое состояние на '+day+' относительно действующего базового плана.':'Текущий график относительно базового плана'+(baseline.date?' от '+baseline.date:'')+'.';render();}catch(e){cutState=false;$('cutNotice').textContent=e.message;if(facadeView==='cut')$('gwrap').innerHTML='<div class="empty">'+esc(e.message)+'</div>';}finally{cutBusy=false;}}
function renderFacadeCut(){if(cutState===false){$('gwrap').innerHTML='<div class="empty">На выбранную дату сохранённого состояния нет. Выберите текущую дату или более позднюю сохранённую редакцию.</div>';return;}const data=cutState||snapshot(),dates=cutState?cutSchedule(data):S,selected=new Set(filtered(false,dates).map(t=>t.id));let rows=data.tasks.filter(t=>(selected.has(t.id)||cutState&&!tasks[t.id])&&inFacadePeriod(dates[t.id]));const horizon=+$('lookAhead').value;if(horizon){const a=dn($('cutDate').value);rows=rows.filter(t=>dates[t.id]&&dates[t.id].s<=a+horizon-1&&dates[t.id].f>=a);}const delta=n=>n==null?'—':(n>0?'+':'')+n+' дн.';const cell=n=>`<td class="${n>0?'bad':n<0?'good':''}">${delta(n)}</td>`;const body=rows.map(t=>{const r=dates[t.id],b=baseline.items[t.id];return `<tr><td class="cut-name"><b>${esc(t.name)}</b><small>${esc(stages[t.stage]?.short||stages[t.stage]?.name||'')}${t.contractor?' · '+esc(t.contractor):''}</small></td><td>${!cutState&&canWrite&&!t.ms&&!t.stretch&&!t.finishOnly?`<input class="durin" type="number" min="1" data-id="${esc(t.id)}" value="${t.dur}" aria-label="Длительность, дней">`:r&&!t.finishOnly?r.f-r.s+1:'—'}</td><td>${b?fmt(dateNumber(b[0])):'—'}</td><td>${b?fmt(dateNumber(b[1])):'—'}</td><td>${fmt(startOf(t,r))}</td><td>${fmt(finishOf(t,r))}</td>${cell(r&&b&&b[0]&&!t.finishOnly?r.s-dn(b[0]):null)}${cell(r&&b&&b[1]?r.f-dn(b[1]):null)}</tr>`;}).join('');$('gwrap').innerHTML=`<table class="facade-cut"><thead><tr><th>Работа / местоположение</th><th>Дней</th><th>Базовое начало</th><th>Базовое окончание</th><th>Текущее начало</th><th>Текущее окончание</th><th>Сдвиг начала</th><th>Сдвиг окончания</th></tr></thead><tbody>${body}</tbody></table>`;}
$('cutDate').value=isoOf(TODAY);$('compact').onchange=()=>{document.body.classList.toggle('compact-rows',$('compact').checked);render();};document.body.classList.add('compact-rows');$('nameWidth').oninput=()=>{document.documentElement.style.setProperty('--name-width',$('nameWidth').value+'px');updateRateColumns();render();};function updateRateColumns(){const on=$('showActualRate').checked;document.body.classList.toggle('hide-actual-rate',!on);document.documentElement.style.setProperty('--lw',((+$('nameWidth').value||460)+362+(on?80:0))+'px');}
$('showActualRate').onchange=()=>{updateRateColumns();render();};updateRateColumns();
function showFacadeGroups(){
  if(ui.group==='none'){ui.group='stage';$('segGroup').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==='stage'));}
  ui.collapsed.clear();$('segGroup').querySelectorAll('button').forEach(b=>b.disabled=false);
}
$('lookAhead').onchange=()=>{
  $('facadeRangeStart').value='';$('facadeRangeEnd').value='';$('facadePeriodNotice').textContent='';
  if($('lookAhead').value){showFacadeGroups();ui.zoom='week';$('segZoom').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==='week'));}
  render();
};
let facadePeriodTimer;
function applyFacadePeriod(){
  const a=$('facadeRangeStart').value,b=$('facadeRangeEnd').value;
  const ok=facadePeriod();
  if((a||b)&&!ok){$('facadePeriodNotice').textContent=validFacadeDate(a)&&validFacadeDate(b)?'Укажите начало не позже окончания и период не более 730 дней.':'Введите обе даты полностью, включая четырёхзначный год.';return;}
  $('facadePeriodNotice').textContent='';
  if(ok){$('lookAhead').value='';showFacadeGroups();}
  render();gw.scrollLeft=0;
}
for(const id of ['facadeRangeStart','facadeRangeEnd'])$(id).onchange=()=>{
  clearTimeout(facadePeriodTimer);facadePeriodTimer=setTimeout(applyFacadePeriod,450);
};
$('facadePeriodOnly').onchange=applyFacadePeriod;
$('includeOverdue').onchange=render;$('refreshCut').onclick=refreshCut;$('cutDate').onchange=refreshCut;
$('facadeViews').querySelectorAll('button').forEach(b=>b.onclick=()=>{facadeView=b.dataset.view;$('facadeViews').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));if(facadeView==='cut')refreshCut();else render();});
async function saveCalendarFact(id,day,raw){if(dirty)throw Error('Сначала сохраните карточку');const t=clone(tasks[id]);if(!t||!(t.vol>0))throw Error('Задайте общий объём и единицу в карточке работы');if(raw!==''&&(!Number.isFinite(+raw)||+raw<0))throw Error('Объём — число ≥ 0');window.GPR_WORKSPACE.putFact(t,day,raw,isoOf(TODAY),(tasks[id]._m?.pct||0)*100);if(day<=isoOf(TODAY))t.closed=window.GPR_WORKSPACE.done(t)>=t.vol;if(!await saveTask(t,'Дневной факт сохранён'))throw Error('Факт не сохранён. Проверьте сообщение об ошибке.');}
function facadePrintRows(){const data=cutState&&facadeView==='cut'?cutState:snapshot(),dates=cutState&&facadeView==='cut'?cutSchedule(data):S,by=new Map(data.tasks.map(t=>[t.id,t])),rows=[];for(const g of groups(filtered(false))){if(g.label!==null)rows.push({id:'print-group-'+g.key,name:g.label,summary:true,start:g.s==null?null:isoOf(g.s),finish:g.f==null?null:isoOf(g.f),duration:g.s==null?'—':g.f-g.s+1,progress:nf(g.percent,1)+'%'});if($('printScope').value==='visible'&&ui.collapsed.has(g.key)&&facadeView!=='cut')continue;for(const liveTask of g.items){const t=by.get(liveTask.id);if(!t)continue;const r=dates[t.id],b=baseline.items[t.id];rows.push({id:t.id,parent:g.label!==null?'print-group-'+g.key:null,facts:t.facts,unit:t.unit,quantity:window.GPR_WORKSPACE.done(t)+' / '+(t.vol??'—'),preds:(t.preds||[]).map(p=>({...p,label:tasks[p.id]?.name||p.id})),name:t.name,zone:stages[t.stage]?.short||stages[t.stage]?.name||'',context:[stages[t.stage]?.short,t.contractor].filter(Boolean).join(' · '),start:startOf(t,r)==null?null:isoOf(startOf(t,r)),finish:finishOf(t,r)==null?null:isoOf(finishOf(t,r)),baseStart:b?.[0],baseFinish:b?.[1],duration:t.finishOnly?'—':r?r.f-r.s+1:'—',progress:t.factProgressOpening&&isoOf(TODAY)<t.factProgressOpening.from?nf(t.factProgressOpening.percent)+'%':t.progressMode==='percent'?nf(t.manualPercent||0)+'%':t.vol?nf(Math.min(100,100*((+t.open||0)+Object.entries(t.facts||{}).filter(([d])=>d<=isoOf(TODAY)).reduce((a,[,b])=>a+(+b||0),0))/t.vol))+'%':t.closed?'100%':'—',milestone:t.ms,category:t.cat==='glass'?'row-engineering':''});}}return window.GPR_REPORT.filterRows(rows,facadePrintOptions());}
function facadePrintOptions(){return{span:$('printScale').value==='fit'?dn($('printEnd').value)-dn($('printStart').value)+1:+$('printScale').value,mode:window.GPR_WORKSPACE.facts()?'facts':facadeView==='cut'?'cut':'gantt',showLinks:$('printLinks').checked,...window.GPR_WORKSPACE.printOptions(settings.title),date:fmt(dn($('cutDate').value)),baseline:baseline.date||'не задан',paper:$('paper').value,start:$('printStart').value,end:$('printEnd').value};}
function estimatePrint(){try{const rows=facadePrintRows(),o=facadePrintOptions();$('printEstimate').textContent=window.GPR_WORKSPACE.pageEstimate(rows,o);}catch(e){$('printEstimate').textContent=e.message;}}
window.GPR_WORKSPACE.mount(document.querySelector('.top'),render);window.GPR_WORKSPACE.printControls();
$('bPrint').onclick=()=>{window.GPR_WORKSPACE.configurePrint({mode:window.GPR_WORKSPACE.facts()?'facts':facadeView==='cut'?'cut':'gantt',context:true,quantityAvailable:Object.values(tasks).some(t=>t.vol>0),profile:'facade'});$('printScaleLabel').hidden=facadeView==='cut';compute();if(facadeView==='cut'&&cutState===false){toast('Нет сохранённого состояния для печати.');return;}const selected=filtered(false).map(t=>S[t.id]).filter(Boolean);if(!selected.length){toast('Нет работ со сроками для печати.');return;}$('printStart').value=isoOf(facadePeriod()?.start??($('lookAhead').value?dn($('cutDate').value):Math.min(...selected.map(t=>t.s))));$('printEnd').value=isoOf(facadePeriod()?.finish??($('lookAhead').value?dn($('cutDate').value)+ +$('lookAhead').value-1:Math.max(...selected.map(t=>t.f))));estimatePrint();$('printDialog').showModal();};$('printDialog').addEventListener('change',estimatePrint);
$('doPrint').onclick=async()=>{const button=$('doPrint');button.disabled=true;button.textContent='Подготовка…';try{await new Promise(resolve=>setTimeout(resolve,0));window.GPR_REPORT.preview(document,facadePrintRows(),facadePrintOptions());$('printDialog').close();}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent='Открыть печать';}};
// ---------- optional Sunday allowance ----------
$('bSundays').onclick=()=>{if(dirty){toast('Сначала сохраните или закройте карточку.');return;}compute();const list=filtered(false),plans=list.map(t=>({...window.GPR_FACADE_OPTIONS.proposal(t,S[t.id],t._m.complete),start:S[t.id]?.s,finish:S[t.id]?.f,task:t}));$('modal').className='modal sunday-modal';$('modal').innerHTML=`<div class="dh"><h2>Воскресенья в текущей выборке</h2><button class="x" id="sundayClose">✕</button></div><div class="db"><p>Расчёт по текущему интервалу каждой работы, включая начало и окончание. Можно добавить найденное количество воскресений к длительности. После применения связанные сроки пересчитаются. Повторно уже применённая прибавка не предлагается.</p><table class="sunday-table"><thead><tr><th></th><th>Работа</th><th>Сейчас, дн.</th><th>Воскресений</th><th>Предложение, дн.</th></tr></thead><tbody>${plans.map(p=>`<tr><td><input type="checkbox" data-sunday="${esc(p.id)}" ${canWrite&&p.eligible?'checked':'disabled'}></td><td>${esc(p.task.name)}${p.reason?`<small>${esc(p.reason)}</small>`:''}</td><td>${p.duration}</td><td>${p.count}</td><td>${p.eligible?p.proposed:'—'}</td></tr>`).join('')}</tbody></table></div><div class="df"><button class="btn" id="sundayCancel">Закрыть</button>${canWrite?'<button class="btn dark" id="sundayApply">Применить выбранные</button>':''}<span id="sundayStatus" role="status"></span></div>`;$('modalBg').style.display='flex';const close=()=>{$('modalBg').style.display='none';$('modal').className='modal';};$('sundayClose').onclick=$('sundayCancel').onclick=close;if(!canWrite)return;$('sundayApply').onclick=async()=>{const selected=[...document.querySelectorAll('[data-sunday]:checked')].map(x=>plans.find(p=>p.id===x.dataset.sunday)).filter(p=>p?.eligible);if(!selected.length){$('sundayStatus').textContent='Выберите работы';return;}const button=$('sundayApply');button.disabled=true;let saved=0;try{for(const p of selected){const current=tasks[p.id];if(!current||current.dur!==p.duration)throw Error('Длительность изменилась. Откройте расчёт заново.');const next=clone(current);next.dur=p.proposed;next.sundayAdjustment={baseDuration:p.duration,added:p.count,appliedDuration:p.proposed,sourceStart:isoOf(p.start),sourceFinish:isoOf(p.finish),at:new Date().toISOString()};await db.collection('tasks').doc(next.id).set(next);saved++;$('sundayStatus').textContent=`Сохранено ${saved} из ${selected.length}`;}close();toast(`Воскресенья добавлены: ${saved} работ`);}catch(e){$('sundayStatus').textContent=`Сохранено ${saved} из ${selected.length}. ${e.message}`;}finally{button.disabled=false;}};};
// ---------- baseline ----------
$('bBase').onclick=async()=>{
  if(!confirm('Сохранить текущие сроки всех работ как новый базовый план? Старый базовый план будет заменён.'))return;
  const items={}; for(const id in S){if(S[id])items[id]=[startOf(tasks[id],S[id])==null?null:isoOf(startOf(tasks[id],S[id])),isoOf(finishOf(tasks[id],S[id]))]}
  try{await db.doc('meta/baseline').set({date:isoOf(TODAY),items,links:Object.fromEntries(Object.values(tasks).map(t=>[t.id,clone(t.preds||[])]))});toast('Базовый план зафиксирован на '+fmt(TODAY))}catch(e){handleWriteErr(e)}
};

// ---------- export ----------
function snapshot(){return {tasks:Object.values(tasks).map(clone),stages:Object.values(stages).map(clone),settings:clone(settings),baseline:clone(baseline)}}
function downloadFile(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('bDl').onclick=()=>downloadFile('LIV_фасады_'+isoOf(TODAY)+'.json',JSON.stringify({kind:'liv-facade-artifact-v1',reportDate:isoOf(TODAY),data:snapshot()},null,2),'application/json');
$('bCsv').onclick=()=>{compute();const rows=[['ID','Этап','Работа','Ед. объёма','Объём','Выполнено','Выработка расчётная','Выработка подрядчика','Выработка фактическая','Ед. выработки','Количество ресурса','Начало','Окончание','Предшественники','Примечание'],...filtered(true).map(t=>[t.num,stageOf(t)?.short,t.name,t.unit,t.vol,t._m.done,rateCalc(t),t.rateExp,rateFact(t),rateUnit(t),t.rateResources,startOf(t,S[t.id])==null?'':isoOf(startOf(t,S[t.id])),finishOf(t,S[t.id])==null?'':isoOf(finishOf(t,S[t.id])),t.preds.map(p=>'#'+tasks[p.id]?.num+' '+p.type+(p.lag>=0?'+':'')+p.lag).join('; '),t.note])];const cell=v=>{let s=String(v??'');if(/^[=+@-]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};downloadFile('LIV_фасады.csv','\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8')};
// ---------- init ----------
function setEditUi(){['bAdd','bStages','bBase'].forEach(id=>$(id).hidden=!canWrite);$('deadline').disabled=!canWrite;$('bDl').hidden=false;}
function banner(m,...btns){const b=$('banner');b.textContent=m;for(const [label,fn] of btns){const x=document.createElement('button');x.textContent=label;x.onclick=fn;b.appendChild(x)}b.style.display=m?'block':'none'}
function useData(sd){
  tasks={};for(const t of sd.tasks||[])tasks[t.id]=clone(t);
  stages={};for(const s of sd.stages||[])stages[s.id]=clone(s);
  settings=Object.assign({projectStart:'2026-11-01',title:'График работ'},sd.settings||{});
  baseline=sd.baseline||{items:{}};loaded.tasks=loaded.stages=true;$('deadline').value=settings.deadline||'';
}
const client=window.supabase.createClient(window.GPR_CONFIG.url,window.GPR_CONFIG.publishableKey,{auth:{storageKey:'gpr-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const store=new window.GPR_DATA.Store(client);
let scheduleList=[],session=null,loadingSchedule=false,refreshingAuth=false;
function updateAccess(){
  const changed=canWrite!==(store.canEdit&&!loadingSchedule);canWrite=store.canEdit&&!loadingSchedule;
  setEditUi();$('accessStatus').textContent=canWrite?'Владелец · редактирование':session?'Вы вошли · только просмотр':'Только просмотр · вход не требуется';
  $('loginButton').hidden=!!session;$('logoutButton').hidden=!session;if(changed&&loaded.tasks)render();
}
function applyConfirmed(){useData(store.snapshot());render();updateAccess();}
function makeServerDb(){
  const kind=col=>col==='tasks'?'task':col==='stages'?'stage':'meta';
  const ref=(col,id)=>({id,
    set:async data=>{if(!canWrite)throw Error('Доступ только на просмотр.');$('saveStatus').textContent='Сохранение…';try{await store.save(kind(col),id,clone(data));applyConfirmed();$('saveStatus').textContent='Сохранено';}catch(e){$('saveStatus').textContent='Не сохранено';throw e;}},
    delete:async()=>{if(!canWrite)throw Error('Доступ только на просмотр.');$('saveStatus').textContent='Удаление…';try{await store.remove(kind(col),id);applyConfirmed();$('saveStatus').textContent='Сохранено';}catch(e){$('saveStatus').textContent='Не сохранено';throw e;}}
  });
  return {collection:col=>({doc:id=>ref(col,id||'gpr-'+crypto.randomUUID())}),doc:path=>{const [col,id]=path.split('/');return ref(col,id);}};
}
db=makeServerDb();
async function loadSchedule(id){
  if(['mockup-block2','finishing-main','parking-main','lifts-main'].includes(id)){location.href='mockup.html?v=20261116-progress9&schedule='+encodeURIComponent(id);return;}
  if(loadingSchedule)return;
  if(store.writing)throw Error('Дождитесь завершения сохранения.');
  if(dirty&&!confirm('В карточке есть несохранённые изменения. Обновить график без них?')){$('scheduleSelect').value=store.scheduleId;return;}
  loadingSchedule=true;canWrite=false;store.canEdit=false;setEditUi();$('scheduleSelect').disabled=true;$('reloadSchedule').disabled=true;$('saveStatus').textContent='Загрузка…';
  try{
    const data=await store.load(id);dirty=false;draft=null;ui.sel=null;ui.collapsed.clear();ui.stage='';ui.type='';ui.con='';$('drawer').classList.remove('open');
    cutState=null;useData(data);render();const url=new URL(location.href);url.searchParams.set('schedule',id);history.replaceState(null,'',url);$('scheduleSelect').value=id;
    $('saveStatus').textContent='Данные загружены';banner('');requestAnimationFrame(scrollToday);
  }catch(error){banner('График не загружен: '+(error.message||'ошибка соединения'));$('saveStatus').textContent='Ошибка загрузки';throw error;}
  finally{loadingSchedule=false;$('scheduleSelect').disabled=false;$('reloadSchedule').disabled=false;updateAccess();}
}
async function loadScheduleList(){
  scheduleList=await store.schedules();const select=$('scheduleSelect');select.replaceChildren();
  for(const s of scheduleList){const option=document.createElement('option');option.value=s.id;option.textContent=s.title;select.appendChild(option);}
  if(!scheduleList.length)throw Error('Нет доступных графиков. Войдите, если график закрыт.');
  return scheduleList;
}
async function refreshAuth(){
  if(refreshingAuth)return;refreshingAuth=true;
  try{const r=await client.auth.getSession();if(r.error)throw r.error;session=r.data.session;await loadScheduleList();if(store.scheduleId){await store.permission();updateAccess();}else{const requested=new URL(location.href).searchParams.get('schedule');await loadSchedule(scheduleList.find(s=>s.id===requested)?.id||scheduleList.find(s=>s.id==='facade-main')?.id||scheduleList[0].id);}}
  catch(error){banner(error.message||'Не удалось подключиться к графику');$('saveStatus').textContent='Нет подключения';}
  finally{refreshingAuth=false;updateAccess();}
}
$('scheduleSelect').onchange=event=>loadSchedule(event.target.value).catch(e=>toast(e.message));
$('reloadSchedule').onclick=()=>loadSchedule(store.scheduleId||$('scheduleSelect').value).catch(e=>toast(e.message));
$('loginButton').onclick=()=>{$('loginError').textContent='';$('loginDialog').showModal();$('loginEmail').focus();};
$('loginCancel').onclick=()=>{$('loginDialog').close();$('loginPassword').value='';};
$('loginForm').onsubmit=async event=>{
  event.preventDefault();const button=$('loginSubmit');button.disabled=true;$('loginError').textContent='';
  try{const r=await client.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(r.error)throw r.error;$('loginPassword').value='';$('loginDialog').close();await refreshAuth();if(!canWrite)toast('Вход выполнен. У этого аккаунта нет права редактировать график.');}
  catch(error){$('loginError').textContent=error.message||'Не удалось войти';}
  finally{button.disabled=false;}
};
$('logoutButton').onclick=async()=>{if(store.writing){toast('Дождитесь сохранения');return;}if(dirty&&!confirm('Выйти без сохранения изменений карточки?'))return;const r=await client.auth.signOut({scope:'local'});if(r.error){toast(r.error.message);return;}canWrite=false;store.canEdit=false;dirty=false;draft=null;$('drawer').classList.remove('open');await refreshAuth();};
client.auth.onAuthStateChange(()=>{setTimeout(()=>refreshAuth(),0);});
window.addEventListener('beforeunload',event=>{if(dirty||store.writing){event.preventDefault();event.returnValue='';}});
window.GPR_EDITOR={rateUnit,resourceFactor,rateCalc,rateFact,durFromRate,compute,snapshot,openDrawer,getTasks:()=>tasks,getSchedule:()=>S,refresh:()=>loadSchedule(store.scheduleId)};
refreshAuth();

})();

