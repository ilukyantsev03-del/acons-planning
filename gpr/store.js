'use strict';
(function(root){
  const copy=v=>JSON.parse(JSON.stringify(v));
  class Store {
    constructor(client){this.client=client;this.scheduleId='';this.rows=new Map();this.chains=new Map();this.writing=0;this.canEdit=false;}
    key(kind,id){return kind+'\u0000'+id;}
    async schedules(){const r=await this.client.from('gpr_schedules').select('id,title,building,public_read,sort_order').eq('archived',false).order('sort_order').order('id');if(r.error)throw r.error;return r.data||[];}
    async permission(){const r=await this.client.rpc('gpr_role',{p_schedule:this.scheduleId});if(r.error)throw r.error;this.canEdit=r.data==='owner';return this.canEdit;}
    async load(scheduleId){
      if(this.writing)throw Error('Дождитесь завершения сохранения.');
      const rows=[];for(let start=0;;start+=500){const r=await this.client.from('gpr_items').select('kind,id,data,version,updated_at').eq('schedule_id',scheduleId).order('kind').order('id').range(start,start+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;}
      if(!rows.length)throw Error('График пуст или недоступен для просмотра.');
      const cache=new Map(rows.map(r=>[this.key(r.kind,r.id),copy(r)]));
      const result={tasks:[],stages:[],settings:{},baseline:{items:{}}};
      for(const r of rows){if(r.kind==='task')result.tasks.push({...copy(r.data),id:r.id});if(r.kind==='stage')result.stages.push({...copy(r.data),id:r.id});if(r.kind==='meta'&&r.id==='settings')result.settings=copy(r.data);if(r.kind==='meta'&&r.id==='baseline')result.baseline=copy(r.data);}
      validate(result);
      this.scheduleId=scheduleId;this.rows=cache;this.canEdit=false;
      await this.permission();return result;
    }
    snapshot(){const result={tasks:[],stages:[],settings:{},baseline:{items:{}}};for(const r of this.rows.values()){if(r.kind==='task')result.tasks.push({...copy(r.data),id:r.id});if(r.kind==='stage')result.stages.push({...copy(r.data),id:r.id});if(r.kind==='meta'&&r.id==='settings')result.settings=copy(r.data);if(r.kind==='meta'&&r.id==='baseline')result.baseline=copy(r.data);}return result;}
    serialize(kind,id,operation){
      const scheduleId=this.scheduleId,key=this.key(kind,id),previous=this.chains.get(key)||Promise.resolve();
      this.writing++;
      const next=previous.catch(()=>{}).then(async()=>{if(!this.canEdit)throw Error('Редактирование доступно только владельцу.');if(scheduleId!==this.scheduleId)throw Error('Выбран другой график.');return operation(key,scheduleId);}).finally(()=>{this.writing--;if(this.chains.get(key)===next)this.chains.delete(key);});
      this.chains.set(key,next);return next;
    }
    save(kind,id,data){
      const payload=copy(data);delete payload._m;
      return this.serialize(kind,id,async(key,scheduleId)=>{
        const old=this.rows.get(key);let query;
        if(old)query=this.client.from('gpr_items').update({data:payload}).eq('schedule_id',scheduleId).eq('kind',kind).eq('id',id).eq('version',old.version);
        else query=this.client.from('gpr_items').insert({schedule_id:scheduleId,kind,id,data:payload});
        const r=await query.select('kind,id,data,version,updated_at');if(r.error)throw r.error;
        if(r.data?.length!==1)throw Error('Запись уже изменена в другом окне или доступ отозван. Обновите график перед повтором.');
        this.rows.set(key,copy(r.data[0]));return copy(r.data[0]);
      });
    }
    remove(kind,id){return this.serialize(kind,id,async(key,scheduleId)=>{const old=this.rows.get(key);if(!old)throw Error('Запись уже отсутствует. Обновите график.');const r=await this.client.from('gpr_items').delete().eq('schedule_id',scheduleId).eq('kind',kind).eq('id',id).eq('version',old.version).select('id');if(r.error)throw r.error;if(r.data?.length!==1)throw Error('Запись изменилась. Обновите график перед удалением.');this.rows.delete(key);});}
  }
  function validate(data){
    if(!Array.isArray(data.tasks)||!Array.isArray(data.stages))throw Error('Некорректный формат графика.');
    const byId=new Map(data.tasks.map(t=>[t.id,t])),stages=new Set(data.stages.map(s=>s.id));
    if(byId.size!==data.tasks.length||stages.size!==data.stages.length)throw Error('Повторяются идентификаторы графика.');
    const seen=new Set(),active=new Set();
    function visit(id){if(active.has(id))throw Error('В связях графика есть замкнутый круг.');if(seen.has(id))return;const t=byId.get(id);if(!t)throw Error('Связь с отсутствующей работой.');if(!stages.has(t.stage))throw Error('Для работы не найден этап.');active.add(id);for(const p of t.preds||[]){if(!['ОН','НН','ОО','НО'].includes(p.type)||!Number.isInteger(Number(p.lag||0)))throw Error('Некорректный тип или задержка связи.');visit(p.id);}active.delete(id);seen.add(id);}
    data.tasks.forEach(t=>visit(t.id));return true;
  }
  root.GPR_DATA={Store,validate};if(typeof module!=='undefined')module.exports={Store,validate};
})(typeof window!=='undefined'?window:globalThis);
