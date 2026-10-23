'use strict';
(function () {
  const LEGACY='LIV-MAIN', TABLE='construction_project_snapshots', WRITERS=new Set(['admin','planner']);
  let saveTimer=null,channel=null,role='',userId='',applyingRemote=false,ready=false,activeServerId='';
  const revisions=new Map(), chains=new Map(), acknowledged=new Map(), pendingDocuments=new Map();
  const sb=()=>window.LIV_SUPABASE||null, canWrite=()=>ready&&WRITERS.has(role);
  const identity=p=>window.LIV_PROJECTS?.identity(p)||LEGACY;
  async function waitForSession(){if(!sb())return null;for(let i=0;i<20;i++){const r=await sb().auth.getSession();if(r.data?.session?.user)return r.data.session;await new Promise(r=>setTimeout(r,150));}return null;}
  async function projectRow(p){return window.LIV_PROJECTS.ensureServerProject(p);}
  async function readSnapshot(p){
    const row=await projectRow(p),id=identity(p);
    const r=await sb().from(TABLE).select('project,revision,updated_at,updated_by').eq('project_id',row.id).maybeSingle();
    if(r.error)throw r.error;
    revisions.set(id,Number(r.data?.revision||0));
    if(id===window.LIV_PROJECTS.activeId())activeServerId=row.id;
    if(r.data?.project){if(identity(r.data.project)!==id)throw Error('Сервер вернул данные другого проекта.');acknowledged.set(id,JSON.stringify(r.data.project));return r.data;}
    if(id===LEGACY){const old=await sb().from('liv_settings').select('value,updated_at,updated_by').eq('key','project_snapshot').maybeSingle();if(old.error)throw old.error;if(old.data?.value?.project){if(identity(old.data.value.project)!==id)throw Error('Исходная база имеет другой идентификатор проекта.');return {...old.data,project:old.data.value.project};}}
    return null;
  }
  async function writeSnapshot(p,ticket=window.LIV_WORKFLOW?.ticket?.(p)){
    if(!sb()||!p||!userId||!canWrite()||applyingRemote)return false;
    const id=identity(p),serialized=JSON.stringify(p);
    if(chains.has(id)&&pendingDocuments.get(id)===serialized)return chains.get(id);
    const payload=JSON.parse(serialized);
    const previous=chains.get(id)||Promise.resolve();
    const pending=previous.catch(()=>{}).then(async()=>{
      try{
        window.LIV_WORKFLOW?.serverSaving?.(payload,ticket);
        const row=await projectRow(payload);
        if(acknowledged.get(id)===serialized){const check=await sb().from(TABLE).select('revision').eq('project_id',row.id).maybeSingle();if(check.error)throw check.error;if(Number(check.data?.revision)!==revisions.get(id))throw Error('На сервере появилась новая версия. Сохраните резервную копию и перезагрузите страницу перед продолжением.');if(id===window.LIV_PROJECTS.activeId()){window.LIV_PROJECT_SAVE_ERROR='';window.LIV_PROJECTS.mount?.();}window.LIV_WORKFLOW?.serverSaved?.(payload,ticket);return true;}
        if(!revisions.has(id)){const existing=await sb().from(TABLE).select('revision').eq('project_id',row.id).maybeSingle();if(existing.error)throw existing.error;if(existing.data)throw Error('Проект уже существует на сервере. Откройте его перед сохранением.');revisions.set(id,0);}
        const revision=revisions.get(id);
        // Dedicated invoker RPC keeps RLS and compare-and-swap, with a bounded 30s budget.
        const result=await sb().rpc('save_construction_snapshot',{p_project_id:row.id,p_document:payload,p_expected_revision:revision});
        if(result.error)throw result.error;
        if(!result.data?.length)throw Error('На сервере появилась новая версия. Сохраните резервную копию и перезагрузите страницу перед продолжением.');
        acknowledged.set(id,serialized);revisions.set(id,Number(result.data[0].revision));if(id===window.LIV_PROJECTS.activeId()){window.LIV_PROJECT_SAVE_ERROR='';window.LIV_PROJECTS.mount?.();}window.LIV_WORKFLOW?.serverSaved?.(payload,ticket);return true;
      }catch(error){window.LIV_WORKFLOW?.serverFailed?.(payload,ticket,error);console.error('Planning: сохранение проекта',error);window.dispatchEvent(new CustomEvent('liv-project-save-error',{detail:{message:saveErrorMessage(error)}}));return false;}
    });chains.set(id,pending);pendingDocuments.set(id,serialized);pending.finally(()=>{if(chains.get(id)===pending){chains.delete(id);pendingDocuments.delete(id);}});return pending;
  }
  function saveErrorMessage(error){
    if(error?.code==='57014'||/statement timeout/i.test(error?.message||''))return 'Сервер не успел сохранить проект. Не закрывайте страницу. Скачайте резервную копию кнопкой «Скачать резервную копию» и повторите сохранение или переход после обновления приложения.';
    if(error?.code==='PT409')return 'На сервере появилась новая версия. Сохраните резервную копию и перезагрузите страницу перед продолжением.';
    return error?.message||'Не удалось подтвердить сохранение проекта на сервере.';
  }
  async function bootstrap(localProject){
    ready=false;const session=await waitForSession();if(!session?.user)return {project:localProject,online:false,role:''};userId=session.user.id;
    const profile=await sb().from('app_users').select('id,role,active').eq('id',userId).maybeSingle();if(profile.error)throw profile.error;if(!profile.data?.active)throw Error('Учётная запись не активна.');role=profile.data.role||'';
    const snapshot=await readSnapshot(localProject);ready=true;
    if(snapshot?.project){window.LIV_WORKFLOW?.serverLoaded?.(snapshot.project);return {project:snapshot.project,online:true,role,remoteUpdatedAt:snapshot.updated_at||''};}
    if(canWrite()&&localProject&&!await writeSnapshot(localProject))throw Error('Первое сохранение проекта не выполнено.');
    return {project:localProject,online:true,role,firstUpload:canWrite()};
  }
  function queueSave(p){if(!p||!canWrite()||applyingRemote)return;clearTimeout(saveTimer);const captured=JSON.parse(JSON.stringify(p)),ticket=window.LIV_WORKFLOW?.ticket?.(p);window.LIV_WORKFLOW?.serverQueued?.(p,ticket);saveTimer=setTimeout(()=>{saveTimer=null;writeSnapshot(captured,ticket);},500);}
  async function flush(p){clearTimeout(saveTimer);saveTimer=null;return writeSnapshot(p);}
  function subscribe(){if(!sb()||channel||!activeServerId||!ready)return;channel=sb().channel('planning-project-'+activeServerId).on('postgres_changes',{event:'*',schema:'public',table:TABLE,filter:'project_id=eq.'+activeServerId},payload=>{
    const row=payload.new||{};if(!row.project||identity(row.project)!==window.LIV_PROJECTS.activeId())return;
    if(String(row.updated_by||'')===String(userId)||Number(row.revision)<=Number(revisions.get(identity(row.project))||0))return;
    // Never acknowledge another revision before local unsaved changes have been resolved.
    if(saveTimer||chains.get(identity(row.project))||window.LIV_WORK_CATALOG_UI?.hasPendingInput?.()){window.dispatchEvent(new CustomEvent('liv-project-save-error',{detail:{message:'Проект обновлён в другом окне. Сохраните резервную копию и перезагрузите страницу.'}}));return;}
    revisions.set(identity(row.project),Number(row.revision));window.dispatchEvent(new CustomEvent('liv-remote-project',{detail:{project:row.project,updatedAt:row.updated_at||''}}));
  }).subscribe();}
  async function reconnect(p){clearTimeout(saveTimer);if(channel&&sb())await sb().removeChannel(channel);channel=null;ready=false;role='';userId='';revisions.clear();acknowledged.clear();const state=await bootstrap(p);subscribe();return state;}
  function disconnect(){clearTimeout(saveTimer);acknowledged.clear();ready=false;role='';userId='';if(channel&&sb())sb().removeChannel(channel).catch(()=>{});channel=null;}
  window.LIV_REMOTE_SYNC={bootstrap,reconnect,disconnect,queueSave,flush,subscribe,beginRemoteApply:()=>{applyingRemote=true;},endRemoteApply:()=>{applyingRemote=false;},canWrite,role:()=>role,userId:()=>userId};
  window.addEventListener('liv-project-save-error',event=>{window.LIV_PROJECT_SAVE_ERROR=event.detail.message;const host=document.getElementById('constructionProjectContext');if(host){host.textContent=event.detail.message;host.setAttribute('role','alert');host.classList.add('project-save-error');}});
})();

(function loadLivSchemesModule() {
  if (document.querySelector('script[data-liv-schemes]')) return;

  const script = document.createElement('script');
  script.src = 'js/schemes.js?v=20261022-5';
  script.async = true;
  script.dataset.livSchemes = '1';
  script.onerror = () => {
    console.error('LIV Schemes: не удалось загрузить модуль схем.');
  };
  document.head.appendChild(script);
})();

(function loadLivDataModules() {
  const modules = [
    ['liv-normalized-sync', 'js/normalized-sync.js?v=20261023-4'],
    ['liv-source-mappings', 'js/source-mappings.js?v=20261022-5'],
    ['liv-milestone-risk', 'js/milestone-risk.js?v=20261021-1'],
    ['liv-milestone-risk-groups', 'js/milestone-risk-groups.js?v=20261013-2'],
    ['liv-key-date-import', 'js/key-date-import.js?v=20261014-5'],
    ['liv-key-date-import-guard', 'js/key-date-import-guard.js?v=20261013-2'],
    ['liv-numbered-elements-v2', 'js/numbered-elements-v2.js?v=20261022-5'],
    ['liv-report-snapshots', 'js/report-snapshots.js?v=20261019-2'],
    ['liv-preflight', 'js/preflight.js?v=20261022-5']
  ];

  function loadModule(index) {
    if (index >= modules.length) return;
    const [marker, source] = modules[index];
    if (document.querySelector('script[data-' + marker + ']')) {
      loadModule(index + 1);
      return;
    }

    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.setAttribute('data-' + marker, '1');
    script.onload = () => loadModule(index + 1);
    script.onerror = () => {
      console.error('LIV: не удалось загрузить модуль ' + source);
      loadModule(index + 1);
    };
    document.head.appendChild(script);
  }

  loadModule(0);
})();
