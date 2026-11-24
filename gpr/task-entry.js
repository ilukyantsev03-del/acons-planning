'use strict';
(function(root){
const order=t=>Number(t.order)||0;
function lineage(rows,id){const by=new Map(rows.map(t=>[t.id,t])),seen=new Set,out=[];for(let t=by.get(id);t&&!seen.has(t.id);t=by.get(t.parent)){seen.add(t.id);out.unshift(t);}return out;}
function below(rows,t,id){return lineage(rows,t.id).some(p=>p.id===id);}
function path(rows,id){const chain=lineage(rows,id);return chain.filter((t,i)=>i||chain.length===1).map(t=>t.name).filter(Boolean).join(' · ');}
function parents(rows,id){return rows.filter(t=>t.summary&&!t.hidden&&t.id!==id&&!lineage(rows,t.id).some(p=>p.id===id)).sort((a,b)=>order(a)-order(b));}
function inherit(rows,parent,keys){const values={};for(const t of lineage(rows,parent))for(const k of keys)if(t[k]!=null&&String(t[k])!=='')values[k]=t[k];return values;}
function siblings(rows,t,key='parent'){return rows.filter(x=>x.id!==t.id&&!x.hidden&&x[key]===t[key]).sort((a,b)=>order(a)-order(b)||(a.num||0)-(b.num||0));}
function next(rows,t,key='parent'){return siblings(rows,t,key).find(x=>order(x)>order(t))?.id||'';}
function position(rows,t,before='',key='parent'){const list=siblings(rows,t,key),index=before?list.findIndex(x=>x.id===before):list.length;if(index<0)throw Error('Выберите позицию внутри выбранного раздела.');const by=new Map(rows.map(x=>[x.id,x])),target=list[index],previous=list[index-1],maxBranch=p=>{let max=order(p);if(key==='parent')for(const x of rows){if(x.id===t.id)continue;const seen=new Set;for(let n=x;n&&!seen.has(n.id);n=by.get(n.parent)){if(n.id===p.id){max=Math.max(max,order(x));break;}seen.add(n.id);}}return max;};if(!target)return previous?maxBranch(previous)+1:1;const high=order(target),low=previous?maxBranch(previous):high-2;return low<high?(low+high)/2:high-0.001;}
function place(rows,t,before='',key='parent'){const old=rows.find(x=>x.id===t.id);if(!old||old[key]!==t[key]||next(rows,t,key)!==before)t.order=position(rows,t,before,key);return t;}
function button(id,summary=false,esc=s=>String(s)){return `<button type="button" class="entry-add ${summary?'entry-add-group':'entry-add-row'}" data-entry-add="${esc(id)}" title="${summary?'Добавить работу в этот раздел':'Добавить новую работу после этой'}" aria-label="${summary?'Добавить работу в раздел':'Добавить работу после текущей'}">${summary?'+ Работа':'+'}</button>`;}
function panel(text,esc=s=>String(s)){return `<div class="entry-context"><span>Место в графике</span><strong>${esc(text||'Выберите раздел ниже')}</strong><small>Расположение подставлено автоматически. При необходимости измените раздел и позицию.</small></div>`;}
function filterOptions(select,query){const q=String(query||'').trim().toLocaleLowerCase('ru');for(const option of select.options)option.hidden=!!q&&!option.selected&&!option.text.toLocaleLowerCase('ru').includes(q);}
root.GPR_TASK_ENTRY={lineage,below,path,parents,inherit,siblings,next,position,place,button,panel,filterOptions};if(typeof module!=='undefined')module.exports=root.GPR_TASK_ENTRY;
})(typeof window!=='undefined'?window:globalThis);
