// ═══════════════════════════════════════════════════════

// STATE
// ═══════════════════════════════════════════════════════
const CAT_ORDER=['LIFESTYLE','SPORT','CHANEL','LUXURY','PREMIUM','FAST','LHB','META'];
let brandCodes={}, doorLocations=[], matrixData=[], retailers=[];
let history={};
let transposed=false, currentView='matrix';
let addMode='door_to_brands';
let ctxTarget=null;
let dataKeyState={};
let _autosaveTimer=null;

function getBrandCategory(brand){
  const row=matrixData.find(x=>x.brand===brand);
  return row ? row.category : '—';
}
function getAllBrands(){
  return [...new Set([...(matrixData||[]).map(d=>d.brand), ...Object.keys(brandCodes||{})])].filter(Boolean).sort();
}
function normalizeStatus(s){
  const v=String(s||'').trim().toLowerCase();
  if(v==='confirmed') return 'confirmed';
  if(v==='draft' || v==='tbd' || v==='under consideration') return 'tbd';
  if(v==='closed' || v==='exit' || v==='exited') return 'closed';
  return 'na';
}
function statusLabel(s){
  return ({confirmed:'Confirmed',tbd:'TBD',na:'N/A',closed:'Exit'})[normalizeStatus(s)] || 'N/A';
}
function normalizeGender(v){
  const s=String(v||'').trim().toLowerCase();
  if(s==='mens only' || s==='men only' || s==='mens' || s==="men's only" || s==="men's") return 'Mens Only';
  if(s==='ladies only' || s==='ladies' || s==='women only' || s==="women's only" || s==='womens only' || s==='womens') return 'Ladies Only';
  return 'ALL';
}

function getStateClass(s){
  return 'slot-' + normalizeStatus(s);
}
function getGradeClass(g){
  const v=String(g||'-').toUpperCase();
  if(v==='A') return 'slot-confirmed';
  if(v==='B') return 'slot-tbd';
  return 'slot-na';
}
function syncDataCellClass(el, kind){
  if(!el) return;
  el.classList.remove('status-confirmed','status-tbd','status-na','status-closed','grade-a','grade-b','grade-c','grade-none');
  if(kind==='status'||kind==='grade') refreshDataPillDropdowns(el.closest('tr')||el.parentElement);
}
function getRetailerBrandStateCounts(ret,brand){
  const counts={confirmed:0,tbd:0,na:0,closed:0};
  getRetailerDoors(ret).forEach(d=>{
    const st=getDataKeyState(ret,d.doorNumber,brand);
    counts[normalizeStatus(st ? st.status : 'na')]++;
  });
  return counts;
}
function getRetailerBrandDisplayState(ret,brand){
  const counts=getRetailerBrandStateCounts(ret,brand);
  if(counts.confirmed>0) return 'confirmed';
  if(counts.tbd>0) return 'tbd';
  if(counts.closed>0 && counts.na===0) return 'closed';
  return 'na';
}
/* ── IndexedDB autosave + restore points ──────────────────
   Two stores in the door-tracker-autosave DB:
     snapshots    — single keyed row ('latest') overwritten on every change
     restorePoints — full named/auto snapshots, retrieved as a list */
const DB_NAME='door-tracker-autosave';
const STORE_LATEST='snapshots';
const STORE_RESTORE='restorePoints';
const SAVE_KEY='latest';
const GUEST_SAVE_KEY='guest:latest';
function currentSaveKey(){ return (currentUser && currentUser.isGuest) ? GUEST_SAVE_KEY : SAVE_KEY; }
function currentSaveMode(){ return (currentUser && currentUser.isGuest) ? 'guest' : 'user'; }
const AUTOSNAP_INTERVAL_MS=5*60*1000;
const AUTOSNAP_MAX=10;
let _autosaveQueued=false, _legacyMigrated=false, _autoSnapTimer=null;
let _supabaseClient=null;

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains(STORE_LATEST)) db.createObjectStore(STORE_LATEST,{keyPath:'key'});
      if(!db.objectStoreNames.contains(STORE_RESTORE)) db.createObjectStore(STORE_RESTORE,{keyPath:'id'});
    };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
function withStore(storeName,mode,cb){
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode);
    const store=tx.objectStore(storeName);
    let result;
    Promise.resolve(cb(store,tx)).then(r=>{result=r;}).catch(reject);
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=()=>{db.close();reject(tx.error);};
    tx.onabort=()=>{db.close();reject(tx.error);};
  }));
}
function reqAsPromise(req){
  return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}

function snapshotPayload(){
  return {brandCodes,doorLocations,matrixData,retailers,history,doorAssignments,dataKeyState,storeNotes:window._storeNotes||{}};
}
function applyPayload(p){
  if(!p) return;
  if(p.brandCodes) brandCodes=p.brandCodes;
  if(p.doorLocations) doorLocations=p.doorLocations;
  if(p.matrixData) matrixData=p.matrixData;
  if(p.retailers) retailers=p.retailers;
  /* retailerInfo intentionally dropped — max doors is now derived live from
     doorLocations. Any stale field on the incoming payload is ignored. */
  history=p.history||{};
  doorAssignments=p.doorAssignments||{};
  dataKeyState=p.dataKeyState||{};
  Object.values(dataKeyState).forEach(st=>{ if(st) st.gender=normalizeGender(st.gender); });
  window._storeNotes=p.storeNotes||{};
}

function getSyncConfig(){
  const cfg=window.DOOR_TRACKER_SUPABASE || {};
  if(!cfg.url || !cfg.anonKey) return null;
  if(String(cfg.url).includes('YOUR-') || String(cfg.anonKey).includes('YOUR-')) return null;
  return {
    url:cfg.url,
    anonKey:cfg.anonKey,
    stateTable:cfg.stateTable || 'door_tracker_state',
    restoreTable:cfg.restoreTable || 'door_tracker_restore_points'
  };
}
function getSupabaseClient(){
  const cfg=getSyncConfig();
  if(!cfg || !window.supabase || !window.supabase.createClient) return null;
  if(!_supabaseClient) _supabaseClient=window.supabase.createClient(cfg.url,cfg.anonKey);
  return _supabaseClient;
}
function isSharedSyncEnabled(){ return !!getSupabaseClient() && currentUser && currentUser.authProvider==='supabase' && !currentUser.isGuest; }
function sharedStateKey(){ return currentSaveKey(); }
function sharedUserName(){ return currentUserName(); }
async function saveSharedLatest(row){
  const cfg=getSyncConfig();
  const client=getSupabaseClient();
  if(!cfg || !client) return false;
  const {error}=await client.from(cfg.stateTable).upsert({
    key:sharedStateKey(),
    mode:currentSaveMode(),
    payload:snapshotPayload(),
    saved_at:row.savedAt,
    updated_by:sharedUserName()
  },{onConflict:'key'});
  if(error) throw error;
  return true;
}
async function loadSharedLatest(){
  const cfg=getSyncConfig();
  const client=getSupabaseClient();
  if(!cfg || !client) return null;
  const {data,error}=await client.from(cfg.stateTable)
    .select('payload,saved_at,updated_by')
    .eq('key',sharedStateKey())
    .maybeSingle();
  if(error) throw error;
  return data && data.payload ? data.payload : null;
}
async function createSharedRestorePoint(row){
  const cfg=getSyncConfig();
  const client=getSupabaseClient();
  if(!cfg || !client) return false;
  const {error}=await client.from(cfg.restoreTable).insert({
    id:row.id,
    mode:row.mode,
    label:row.label,
    auto:!!row.auto,
    payload:snapshotPayload(),
    saved_at:row.savedAt,
    updated_by:sharedUserName()
  });
  if(error) throw error;
  return true;
}
async function listSharedRestorePoints(){
  const cfg=getSyncConfig();
  const client=getSupabaseClient();
  if(!cfg || !client) return null;
  const {data,error}=await client.from(cfg.restoreTable)
    .select('id,mode,label,auto,payload,saved_at,updated_by')
    .eq('mode',currentSaveMode())
    .order('saved_at',{ascending:false});
  if(error) throw error;
  return (data||[]).map(r=>Object.assign({
    id:r.id,
    mode:r.mode,
    label:r.label,
    auto:!!r.auto,
    savedAt:r.saved_at,
    updatedBy:r.updated_by
  },r.payload||{}));
}
async function deleteSharedRestorePoint(id){
  const cfg=getSyncConfig();
  const client=getSupabaseClient();
  if(!cfg || !client) return false;
  const {error}=await client.from(cfg.restoreTable).delete().eq('id',id);
  if(error) throw error;
  return true;
}
async function getSharedRestorePoint(id){
  const cfg=getSyncConfig();
  const client=getSupabaseClient();
  if(!cfg || !client) return null;
  const {data,error}=await client.from(cfg.restoreTable)
    .select('id,mode,label,auto,payload,saved_at,updated_by')
    .eq('id',id)
    .maybeSingle();
  if(error) throw error;
  if(!data) return null;
  return Object.assign({
    id:data.id,
    mode:data.mode,
    label:data.label,
    auto:!!data.auto,
    savedAt:data.saved_at,
    updatedBy:data.updated_by
  },data.payload||{});
}

function persistAutoState(){
  setSaveIndicator('saving');
  const row=Object.assign({key:currentSaveKey(),savedAt:new Date().toISOString()},snapshotPayload());
  const localSave=()=>withStore(STORE_LATEST,'readwrite',s=>reqAsPromise(s.put(row)));
  const save=isSharedSyncEnabled()
    ? saveSharedLatest(row).then(()=>localSave()).catch(err=>{ console.warn('Shared save failed; saved locally only.',err); return localSave().then(()=>Promise.reject(err)); })
    : localSave();
  return save
    .then(()=>setSaveIndicator('saved'))
    .catch(()=>setSaveIndicator('error'));
}
function queueAutosave(){
  if(_autosaveQueued) return;
  _autosaveQueued=true;
  setSaveIndicator('pending');
  clearTimeout(_autosaveTimer);
  _autosaveTimer=setTimeout(()=>{_autosaveQueued=false;persistAutoState();},250);
}
function manualSaveNow(){
  clearTimeout(_autosaveTimer);
  _autosaveQueued=false;
  return persistAutoState().then(()=>toast('Saved'));
}
let _saveIndicatorClear=null;
function setSaveIndicator(state){
  const el=document.getElementById('saveIndicator');
  if(!el) return;
  el.classList.remove('save-pending','save-saving','save-saved','save-error');
  let label='';
  if(state==='saving'){ label='Saving…'; el.classList.add('save-saving'); }
  else if(state==='pending'){ label='Unsaved changes'; el.classList.add('save-pending'); }
  else if(state==='error'){ label='Save failed'; el.classList.add('save-error'); }
  else { label='Saved'; el.classList.add('save-saved'); }
  el.textContent=label;
  clearTimeout(_saveIndicatorClear);
  if(state==='saved'){
    _saveIndicatorClear=setTimeout(()=>{
      const cur=document.getElementById('saveIndicator');
      if(cur && cur.classList.contains('save-saved')) cur.textContent='Saved';
    },2400);
  }
}
function loadAutoState(){
  if(isSharedSyncEnabled()){
    return loadSharedLatest()
      .then(payload=>{
        if(payload){ applyPayload(payload); return; }
        return withStore(STORE_LATEST,'readonly',s=>reqAsPromise(s.get(currentSaveKey()))).then(row=>{
          if(row) applyPayload(row);
          else migrateLegacyLocalStorage();
        });
      })
      .catch(err=>{
        console.warn('Shared load failed; using local IndexedDB.',err);
        return withStore(STORE_LATEST,'readonly',s=>reqAsPromise(s.get(currentSaveKey()))).then(row=>{
          if(row) applyPayload(row);
          else migrateLegacyLocalStorage();
        }).catch(()=>migrateLegacyLocalStorage());
      });
  }
  return withStore(STORE_LATEST,'readonly',s=>reqAsPromise(s.get(currentSaveKey())))
    .then(row=>{
      if(row) applyPayload(row);
      else migrateLegacyLocalStorage();
    })
    .catch(()=>migrateLegacyLocalStorage());
}
function migrateLegacyLocalStorage(){
  if(_legacyMigrated) return;
  _legacyMigrated=true;
  try{
    const raw=localStorage.getItem('doorTrackerAutosave');
    if(!raw) return;
    const p=JSON.parse(raw);
    if(!p) return;
    applyPayload(p);
    persistAutoState().then(()=>{ try{localStorage.removeItem('doorTrackerAutosave');}catch(e){} });
  }catch(e){}
}

/* ── Restore points ─────────────────────────────────────── */
function createRestorePoint(label,auto){
  const mode=currentSaveMode();
  const id=mode+':'+(auto?'auto-':'snap-')+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  const row=Object.assign({id,mode,label:label||(auto?'Auto':'Snapshot'),auto:!!auto,savedAt:new Date().toISOString()},snapshotPayload());
  if(isSharedSyncEnabled()) return createSharedRestorePoint(row).then(()=>id);
  return withStore(STORE_RESTORE,'readwrite',s=>reqAsPromise(s.put(row))).then(()=>id);
}
function listRestorePoints(){
  const mode=currentSaveMode();
  if(isSharedSyncEnabled()) return listSharedRestorePoints();
  return withStore(STORE_RESTORE,'readonly',s=>reqAsPromise(s.getAll()))
    .then(rows=>(rows||[]).filter(r=>(r.mode||'user')===mode).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt))));
}
function deleteRestorePoint(id){
  if(isSharedSyncEnabled()) return deleteSharedRestorePoint(id);
  return withStore(STORE_RESTORE,'readwrite',s=>reqAsPromise(s.delete(id)));
}
function restoreFromPoint(id){
  const lookup=isSharedSyncEnabled()
    ? getSharedRestorePoint(id)
    : withStore(STORE_RESTORE,'readonly',s=>reqAsPromise(s.get(id)));
  return lookup.then(row=>{
    if(!row){ toast('Snapshot not found'); return; }
    return createRestorePoint('Auto · before restore',true).then(()=>{
      applyPayload(row);
      ensureAllSlots();
      populateFilters();
      updateViewSpecificControls();
      render();
      persistAutoState();
      toast(`Restored: ${row.label||'snapshot'}`);
      refreshSnapshotList();
    });
  });
}
function rotateAutoSnapshots(){
  return listRestorePoints().then(all=>{
    const autos=all.filter(r=>r.auto);
    if(autos.length<=AUTOSNAP_MAX) return;
    const drop=autos.slice(AUTOSNAP_MAX);
    return Promise.all(drop.map(r=>deleteRestorePoint(r.id)));
  });
}
function scheduleAutoSnapshots(){
  if(_autoSnapTimer) clearInterval(_autoSnapTimer);
  _autoSnapTimer=setInterval(()=>{ createRestorePoint('Auto',true).then(rotateAutoSnapshots).catch(()=>{}); },AUTOSNAP_INTERVAL_MS);
}

function recordHistory(ret,brand,entry){
  const hk=k(ret,brand);
  if(!history[hk]) history[hk]=[];
  history[hk].push({
    date:new Date().toISOString(),
    scope: entry.scope || 'assignment',
    action: entry.action || 'updated',
    oldVal: entry.oldVal ?? '',
    newVal: entry.newVal ?? '',
    doorNumber: entry.doorNumber ?? '',
    user: entry.user || currentUserName(),
    note: entry.note || ''
  });
}

function getAssignmentsFor(ret,brand){
  return (doorAssignments[k(ret,brand)]||[]);
}
function getConfirmedAssignmentsFor(ret,brand){
  return getAssignmentsFor(ret,brand).filter(a=>a.status==='confirmed');
}
function getDraftAssignmentsFor(ret,brand){
  return getAssignmentsFor(ret,brand).filter(a=>a.status==='draft');
}
function getDoorInfo(ret,doorNumber){
  return doorLocations.find(d=>normalizeRetailer(d.retailer)===normalizeRetailer(ret)&&String(d.doorNumber)===String(doorNumber));
}
function getRetailerDoors(ret){
  if(_renderCache){
    const cached=_renderCache.retailerDoors.get(ret);
    if(cached) return cached;
  }
  const result=doorLocations
    .filter(d=>normalizeRetailer(d.retailer)===normalizeRetailer(ret))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  if(_renderCache) _renderCache.retailerDoors.set(ret,result);
  return result;
}
function getBrandsAtDoor(ret,doorNumber){
  const brands=[];
  getAllBrands().forEach(b=>{
    const st=getDataKeyState(ret,doorNumber,b);
    const status=normalizeStatus(st ? st.status : 'na');
    if(status!=='na') brands.push({brand:b,status:status==='tbd'?'draft':status});
  });
  return brands.sort((a,b)=>a.brand.localeCompare(b.brand));
}

let doorAssignments={}; // key(retailer,brand) -> [{doorNumber, doorName, note, status:'confirmed'|'draft', date}]
if(!window._storeNotes) window._storeNotes={};

function k(r,b){return r+'|'+b}
function esc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'):''}
function jsq(s){return JSON.stringify(String(s==null?'':s));}
function jsAttr(code){return esc(code);}
function callAttr(fn,...args){return jsAttr(`${fn}(${args.map(jsq).join(',')})`);}
function ctxAttr(r,b){return jsAttr(`cellCtx(event,${jsq(r)},${jsq(b)})`);}

/* Anonymized demo dataset for the guest sandbox — no real merchant info.
   Small enough to feel empty, big enough to demonstrate every view. */
const GUEST_SEED={
  brandCodes:{
    'BR-A':{name:'Brand Alpha',ds_active:true},
    'BR-B':{name:'Brand Beta',ds_active:true},
    'BR-C':{name:'Brand Gamma',ds_active:true}
  },
  doorLocations:[
    {retailer:'Retailer One',doorNumber:101,name:'Store 101',city:'New York',state:'NY',lat:40.7589,lng:-73.9851,tier:'A'},
    {retailer:'Retailer One',doorNumber:102,name:'Store 102',city:'Los Angeles',state:'CA',lat:34.0522,lng:-118.2437,tier:'A'},
    {retailer:'Retailer Two',doorNumber:201,name:'Store 201',city:'Chicago',state:'IL',lat:41.8781,lng:-87.6298,tier:'B'},
    {retailer:'Retailer Two',doorNumber:202,name:'Store 202',city:'Houston',state:'TX',lat:29.7604,lng:-95.3698,tier:'B'},
    {retailer:'Retailer Three',doorNumber:301,name:'Store 301',city:'Miami',state:'FL',lat:25.7617,lng:-80.1918,tier:'A'}
  ],
  matrixData:[
    {brand:'BR-A',category:'LUXURY'},
    {brand:'BR-B',category:'LIFESTYLE'},
    {brand:'BR-C',category:'PREMIUM'}
  ],
  retailers:['Retailer One','Retailer Two','Retailer Three'],
  retailerInfo:{
    'Retailer One':{brm:2,ecom:1},
    'Retailer Two':{brm:2,ecom:1},
    'Retailer Three':{brm:1,ecom:1}
  }
};
const EXTERNAL_BLANK_SEED={
  brandCodes:{},
  doorLocations:[],
  matrixData:[],
  retailers:[]
};
const GUEST_DOOR_KEY_SEED=[
  ['Retailer One','BR-A',101,'New York','confirmed','Example assignment'],
  ['Retailer One','BR-B',102,'Los Angeles','confirmed',''],
  ['Retailer Two','BR-A',201,'Chicago','tbd',''],
  ['Retailer Three','BR-C',301,'Miami','confirmed','']
];

function initFromSeed(){
  const guest=currentUser && currentUser.isGuest;
  const data=window.DOOR_TRACKER_DATA||{};
  const blankGuest=guest && window._doorTrackerBlankGuest;
  const srcSeed=blankGuest?EXTERNAL_BLANK_SEED:(guest?GUEST_SEED:(data.seed||(typeof SEED!=='undefined'?SEED:{})));
  const srcKeys=blankGuest?[]:(guest?GUEST_DOOR_KEY_SEED:(data.dataKeySeed||(typeof DOOR_KEY_SEED!=='undefined'?DOOR_KEY_SEED:[])));
  brandCodes=srcSeed.brandCodes||{};
  doorLocations=srcSeed.doorLocations||[];
  matrixData=guest?(srcSeed.matrixData||[]):((data.matrixData&&data.matrixData.length?data.matrixData:srcSeed.matrixData)||[]);
  retailers=srcSeed.retailers||[];
  /* srcSeed.retailerInfo no longer loaded — derived from doorLocations. */
  history={};
  doorAssignments={};
  dataKeyState={};

  (srcKeys||[]).forEach(row=>{
    const [ret,brand,doorNumber,location,status,note]=row;
    const normalizedDoor=(doorNumber==null || doorNumber==='' || doorNumber==='TBD') ? '-' : doorNumber;
    const doorInfo=normalizedDoor==='-' ? null : getDoorInfo(ret,normalizedDoor);
    dataKeyState[buildDataKey(ret,normalizedDoor,brand)]={status:normalizeStatus(status),grade:(doorInfo&&doorInfo.tier)||'-',note:note||'',retailer:ret,doorNumber:normalizedDoor,brand:brand};
    syncAssignmentFromDataKey(ret,normalizedDoor,brand);
    if(!brandCodes[brand]) brandCodes[brand]={name:brand,ds_active:true};
  });
  ensureAllSlots();
}

// Pre-populate N/A placeholder rows for every door × brand combination that
// doesn't already have an explicit dataKeyState entry. This ensures the Data
// view always shows a complete grid and new doors/brands are fully represented.
function ensureAllSlots(){
  const brands=getAllBrands();
  retailers.forEach(ret=>{
    getRetailerDoors(ret).forEach(door=>{
      brands.forEach(brand=>{
        const key=buildDataKey(ret,door.doorNumber,brand);
        if(!dataKeyState[key]){
          dataKeyState[key]={status:'na',grade:door.tier||'-',gender:'ALL',note:'',metric_1:'',metric_2:'',retailer:ret,doorNumber:door.doorNumber,brand:brand};
        }
      });
    });
  });
  reconcileDataKeyFromAssignments();
}

/* Heal any drift where doorAssignments declares a status that dataKeyState
   contradicts. doorAssignments is the source of truth for publish actions
   (legacy publishDraft only updated assignments). After this runs, matrix
   counts pulled from dataKeyState match what the drawer shows. */
function reconcileDataKeyFromAssignments(){
  Object.entries(doorAssignments).forEach(([ak,assigns])=>{
    const [ret,brand]=ak.split('|');
    if(!ret || !brand) return;
    const norm=normalizeRetailer(ret);
    (assigns||[]).forEach(a=>{
      if(!a || a.doorNumber==='TBD') return;
      if(!getDoorInfo(norm,a.doorNumber)) return;
      const wanted=a.status==='confirmed' ? 'confirmed' : (a.status==='draft' ? 'tbd' : null);
      if(!wanted) return;
      const key=buildDataKey(norm,a.doorNumber,brand);
      const st=dataKeyState[key];
      if(!st){
        const door=getDoorInfo(norm,a.doorNumber);
        dataKeyState[key]={status:wanted,grade:(door&&door.tier)||'-',gender:'ALL',note:a.note||'',metric_1:'',metric_2:'',retailer:norm,doorNumber:a.doorNumber,brand};
        return;
      }
      if(wanted==='confirmed' && normalizeStatus(st.status)!=='confirmed'){
        st.status='confirmed';
      }
    });
  });
}

// ═══════════════════════════════════════════════════════
// DERIVED DOOR COUNT — counts only confirmed assignments
// ═══════════════════════════════════════════════════════
function getConfirmedCount(ret,brand){
  return getRetailerDoors(ret).filter(d=>{
    const st=getDataKeyState(ret,d.doorNumber,brand);
    return normalizeStatus(st ? st.status : 'na')==='confirmed';
  }).length;
}
function getDraftCount(ret,brand){
  const ck=ret+'|'+brand;
  if(_renderCache){
    const c=_renderCache.draftCount.get(ck);
    if(c!==undefined) return c;
  }
  const ak=k(ret,brand);
  const assigns=doorAssignments[ak]||[];
  const val=assigns.filter(a=>a.status==='draft').length;
  if(_renderCache) _renderCache.draftCount.set(ck,val);
  return val;
}
function getLegacyCount(ret,brand){
  const d=matrixData.find(x=>x.brand===brand);
  return d?parseInt(d[ret]||0)||0:0;
}
function getTotalConfirmedForRetailer(ret,brand){
  return getConfirmedCount(ret,brand);
}
function getMatrixVal(ret,brand){
  const ck=ret+'|'+brand;
  if(_renderCache){
    const c=_renderCache.matrixVal.get(ck);
    if(c!==undefined) return c;
  }
  const val=getTotalConfirmedForRetailer(ret,brand);
  if(_renderCache) _renderCache.matrixVal.set(ck,val);
  return val;
}

/* Max doors per retailer is now derived: count unique door numbers in
   doorLocations for that retailer. retailerInfo.bm is ignored — it was a
   static seed value that drifted whenever doors were added/imported. */
function getMaxDoorsForRetailer(ret){
  if(_renderCache){
    const cached=_renderCache.maxDoors.get(ret);
    if(cached!==undefined) return cached;
  }
  const norm=normalizeRetailer(ret);
  const seen=new Set();
  for(const d of doorLocations){
    if(normalizeRetailer(d.retailer)!==norm) continue;
    seen.add(String(d.doorNumber));
  }
  const val=seen.size;
  if(_renderCache) _renderCache.maxDoors.set(ret,val);
  return val;
}

function getBMDoorsForRetailer(ret){
  const norm=normalizeRetailer(ret);
  const seen=new Set();
  for(const d of doorLocations){
    if(normalizeRetailer(d.retailer)!==norm) continue;
    if(isEcommerceDoor(d)) continue;
    seen.add(String(d.doorNumber));
  }
  return seen.size;
}

function getBMConfirmedCount(ret,brand){
  const norm=normalizeRetailer(ret);
  let n=0;
  for(const d of doorLocations){
    if(normalizeRetailer(d.retailer)!==norm) continue;
    if(isEcommerceDoor(d)) continue;
    const st=getDataKeyState(norm,d.doorNumber,brand);
    if(st && normalizeStatus(st.status)==='confirmed') n++;
  }
  return n;
}

// ═══════════════════════════════════════════════════════
// ALL DRAFTS
// ═══════════════════════════════════════════════════════
function getAllDrafts(){
  const drafts=[];
  for(const [key,assigns] of Object.entries(doorAssignments)){
    const [ret,brand]=key.split('|');
    assigns.forEach((a,idx)=>{
      if(a.status==='draft'){
        drafts.push({ret,brand,idx,...a});
      }
    });
  }
  return drafts;
}
function updateDraftBadge(){
  const count=getAllDrafts().length;
  document.getElementById('draftCount').textContent=count;
}

// ═══════════════════════════════════════════════════════
// FILTERS
// ═══════════════════════════════════════════════════════
function populateFilters(){
  const cats=[...new Set(matrixData.map(d=>d.category).filter(Boolean))];
  const brands=getAllBrands();
  const grades=['-','A','B','C'];
  const allRetailers=[...new Set([...retailers,...doorLocations.map(d=>normalizeRetailer(d.retailer))])].filter(Boolean).sort();
  const groups=[...new Set(allRetailers.map(retailerGroup).filter(Boolean))].sort();
  const channels=[...new Set(allRetailers.map(retailerChannel).filter(Boolean))].sort();
  fillSel('fCat',cats); fillSel('fBrand',brands); fillSel('fGrade',grades); fillSel('fRetGroup',groups); fillSel('fRetChannel',channels);
  const el=document.getElementById('fRet');
  const cv=getSelectValues(el);
  el.innerHTML='<option value="">All</option>'+allRetailers.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
  setSelectValues(el,cv);
  populateStatusGradeFilters();
  renderRefineToggles();
}
function getSelectValues(elOrId){
  const el=typeof elOrId==='string'?document.getElementById(elOrId):elOrId;
  if(!el) return [];
  if(el.multiple){
    const vals=Array.from(el.selectedOptions).map(o=>o.value).filter(Boolean);
    return vals;
  }
  return el.value ? [el.value] : [];
}
function setSelectValues(elOrId,vals){
  const el=typeof elOrId==='string'?document.getElementById(elOrId):elOrId;
  if(!el) return;
  const set=new Set((vals||[]).filter(Boolean));
  Array.from(el.options).forEach(opt=>{ opt.selected=set.size?set.has(opt.value):opt.value===''; });
}
function hasFilterValue(vals,value){ return !vals.length || vals.includes(value); }
function fillSel(id,vals){
  const el=document.getElementById(id);
  const cv=getSelectValues(el);
  el.innerHTML='<option value="">All</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  setSelectValues(el,cv);
}

function filterOptionLabel(sourceId,opt){
  if(sourceId==='fBrand'){
    const code=opt.value;
    const name=brandCodes[code] && brandCodes[code].name;
    return name || opt.textContent || code;
  }
  return opt.textContent || opt.value;
}

function renderRefineToggles(){
  renderShowAsToggles();
  renderRefineToggleGroup('fRetGroup','refineRetGroupToggles','All groups');
  renderRetailerOrGroupToggles();
  renderRefineToggleGroup('fRetChannel','refineRetChannelToggles','All channels');
  renderRefineToggleGroup('fCat','refineCatToggles','All categories');
  renderRefineToggleGroup('fBrand','refineBrandToggles','All brands');
  renderRefineToggleGroup('fStatus','refineStatusToggles','All statuses');
  renderRefineToggleGroup('fGrade','refineGradeToggles','All grades');
  renderRefineToggleGroup('fGender','refineGenderToggles','All genders');
  renderRefineOpportunityToggle();
  updateRefineActiveState();
  updateShowAsVisibility();
}

function currentShowAs(){
  const v=document.getElementById('fShowAs')?.value || 'retailer';
  return v==='retailer_group' ? 'retailer' : v;
}

/* The "Show by Group" toggle inside the Retailer section is the single
   switch that collapses matrix columns to their parent retailer group. */
function isShowByGroupOn(){
  const el=document.getElementById('showByGroupRow');
  return !!(el && el.classList.contains('is-on'));
}
function setShowByGroup(on){
  const el=document.getElementById('showByGroupRow');
  if(!el) return;
  el.classList.toggle('is-on',!!on);
  /* The Retailer section's pill list source flips between fRet (retailers)
     and fRetGroup (parent groups). Clear the opposite source so old picks
     don't keep filtering behind the user's back. */
  if(on) setSelectValues('fRet',[]);
  else setSelectValues('fRetGroup',[]);
  try{ localStorage.setItem('door-tracker-show-by-group', on?'1':'0'); }catch(e){}
  renderRefineToggles();
  renderMapFilterClones();
  render();
}

/* Render either retailer or group pills into #refineRetToggles depending on
   whether "Show by Group" is currently on. */
function renderRetailerOrGroupToggles(){
  if(isShowByGroupOn()){
    renderRefineToggleGroup('fRetGroup','refineRetToggles','All groups');
  }else{
    renderRefineToggleGroup('fRet','refineRetToggles','All retailers');
  }
}
function toggleShowByGroupSwitch(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  setShowByGroup(!isShowByGroupOn());
}
function onShowByGroupKey(e){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  toggleShowByGroupSwitch(e);
}

function renderShowAsToggles(){
  const host=document.getElementById('refineShowAsToggles');
  const source=document.getElementById('fShowAs');
  if(!host || !source) return;
  const value=currentShowAs();
  const options=[
    ['retailer','Retailer'],
    ['channel','Channel']
  ];
  host.innerHTML=options.map(([val,label])=>`<div class="map-filter-row ${value===val?'active':''}" role="button" tabindex="0" aria-pressed="${value===val?'true':'false'}" data-show-as-value="${esc(val)}">
    <span class="map-filter-label">${esc(label)}</span>
    <span class="map-filter-switch" aria-hidden="true"></span>
  </div>`).join('');
}

function updateShowAsVisibility(){
  /* Show As was removed from the refine UI; the function is kept as a stub
     so existing call sites stay valid. The "Show by Group" toggle now owns
     matrix grouping, and Channel/Retailer/Group filter sections are always
     visible in the map filter rail. */
}

function renderRefineToggleGroup(sourceId,hostId,allLabel){
  const host=document.getElementById(hostId);
  const source=document.getElementById(sourceId);
  if(!host || !source) return;
  const values=getSelectValues(source);
  const selected=new Set(values);
  const options=Array.from(source.options).filter(opt=>opt.value);
  const rows=options.map(opt=>{
    const active=selected.has(opt.value);
    const label=filterOptionLabel(sourceId,opt);
    return `<div class="map-filter-row ${active?'active':''}" role="button" tabindex="0" aria-pressed="${active?'true':'false'}" data-refine-source="${esc(sourceId)}" data-refine-value="${esc(opt.value)}" title="${esc(opt.textContent)}">
      <span class="map-filter-label">${esc(label)}</span>
      <span class="map-filter-switch" aria-hidden="true"></span>
    </div>`;
  }).join('');
  host.innerHTML=`<div class="map-filter-all ${values.length?'':'active'}" role="button" tabindex="0" aria-pressed="${values.length?'false':'true'}" data-refine-clear="${esc(sourceId)}">
      <span class="map-filter-label">${esc(allLabel)}</span>
      <span class="map-filter-count">${options.length}</span>
    </div>${rows || '<div style="padding:6px 0;color:var(--text-dim);font-size:0.68rem">No options yet.</div>'}`;
}

function renderRefineOpportunityToggle(){
  const host=document.getElementById('refineOpportunityToggles');
  const source=document.getElementById('fOpportunities');
  if(!host || !source) return;
  const active=source.checked;
  host.innerHTML=`<div class="map-filter-row ${active?'active':''}" role="button" tabindex="0" aria-pressed="${active?'true':'false'}" data-refine-opportunity="1">
    <span class="map-filter-label">Brand can be at door</span>
    <span class="map-filter-switch" aria-hidden="true"></span>
  </div>`;
}

function toggleRefineFilterValue(sourceId,value){
  const values=new Set(getSelectValues(sourceId));
  if(values.has(value)) values.delete(value);
  else values.add(value);
  setSelectValues(sourceId,Array.from(values));
  renderRefineToggles();
  renderMapFilterClones();
  render();
}

function clearRefineFilter(sourceId){
  setSelectValues(sourceId,[]);
  renderRefineToggles();
  renderMapFilterClones();
  render();
}

function onRefineFilterKey(e,sourceId,value){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  toggleRefineFilterValue(sourceId,value);
}

function onRefineFilterClearKey(e,sourceId){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  clearRefineFilter(sourceId);
}

function toggleRefineOpportunity(){
  const source=document.getElementById('fOpportunities');
  if(!source) return;
  source.checked=!source.checked;
  renderRefineOpportunityToggle();
  updateRefineActiveState();
  render();
}

function setShowAs(value){
  const source=document.getElementById('fShowAs');
  const mode=['retailer','channel'].includes(value) ? value : 'retailer';
  if(source) source.value=mode;
  /* Show As now only chooses the matrix grouping mode; Channel and Group
     filters live behind their own toggles, so we leave their selections
     alone when Show As changes. */
  renderRefineToggles();
  renderMapFilterClones();
  render();
}

function onRefineOpportunityKey(e){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  toggleRefineOpportunity();
}

function handleRefineToggleEvent(e){
  const row=e.target.closest('[data-show-as-value],[data-refine-source],[data-refine-clear],[data-refine-opportunity]');
  if(!row || !row.closest('#refinePanel')) return;
  if(e.type==='keydown' && e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  e.stopPropagation();
  if(row.dataset.showAsValue){
    setShowAs(row.dataset.showAsValue);
  }else if(row.dataset.refineSource){
    toggleRefineFilterValue(row.dataset.refineSource,row.dataset.refineValue);
  }else if(row.dataset.refineClear){
    clearRefineFilter(row.dataset.refineClear);
  }else if(row.dataset.refineOpportunity){
    toggleRefineOpportunity();
  }
}

function getRefineActiveCount(){
  let count=0;
  ['fRetGroup','fRet','fRetChannel','fCat','fBrand','fStatus','fGrade','fGender'].forEach(id=>{ count+=getSelectValues(id).length; });
  if(document.getElementById('fOpportunities')?.checked) count++;
  if((document.getElementById('searchBox')?.value||'').trim()) count++;
  return count;
}

function updateRefineActiveState(){
  const count=getRefineActiveCount();
  const badge=document.getElementById('refineBadge');
  const clear=document.getElementById('refineClearAll');
  if(badge){
    badge.textContent=String(count);
    badge.classList.toggle('visible',count>0);
  }
  if(clear) clear.classList.toggle('visible',count>0);
}

/* Channel and Retailer Group sections render as on/off toggles. The active
   state lives on the section's `is-open` class — `getVisibleRetailers` reads
   it to decide whether to apply that filter at all. Toggling off clears any
   pill selection so the filter UI matches the data path. */
const FILTER_TOGGLE_TARGETS={channel:{groupId:'channelFilterGroup',sourceId:'fRetChannel'}};

function isFilterToggleOn(kind){
  const cfg=FILTER_TOGGLE_TARGETS[kind];
  if(!cfg) return false;
  const el=document.getElementById(cfg.groupId);
  return !!(el && el.classList.contains('is-active'));
}

function setFilterToggle(kind,on){
  const cfg=FILTER_TOGGLE_TARGETS[kind];
  if(!cfg) return;
  const el=document.getElementById(cfg.groupId);
  if(!el) return;
  /* is-active drives whether the filter is on; is-open is independent and
     controlled by toggleRefineSection (clicking the section label collapses
     pills without changing the on/off state). Turning the filter off also
     clears the pill selection so it doesn't keep filtering invisibly. */
  el.classList.toggle('is-active',!!on);
  if(on) el.classList.add('is-open');
  if(!on) setSelectValues(cfg.sourceId,[]);
  renderRefineToggles();
  renderMapFilterClones();
  render();
}

function toggleFilterSwitch(e,kind){
  e.preventDefault();
  e.stopPropagation();
  setFilterToggle(kind, !isFilterToggleOn(kind));
}

function onFilterToggleKey(e,kind){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  setFilterToggle(kind, !isFilterToggleOn(kind));
}

function clearAllRefineFilters(){
  ['fRetGroup','fRet','fRetChannel','fCat','fBrand','fStatus','fGrade','fGender'].forEach(id=>setSelectValues(id,[]));
  /* Turn the Channel filter switch off when the user clears everything. */
  const channelGroup=document.getElementById('channelFilterGroup');
  if(channelGroup) channelGroup.classList.remove('is-active');
  const opp=document.getElementById('fOpportunities');
  if(opp) opp.checked=false;
  const search=document.getElementById('searchBox');
  if(search) search.value='';
  renderRefineToggles();
  renderMapFilterClones();
  render();
}

function toggleRefineSection(label){
  const group=label?.closest('.toolbar-group');
  if(!group) return;
  const open=group.classList.toggle('is-open');
  label.setAttribute('aria-expanded',String(open));
}

function onRefineSectionKey(e,label){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  toggleRefineSection(label);
}

function getFiltered(){
  let items=matrixData;
  const fc=getSelectValues('fCat');
  const fb=getSelectValues('fBrand');
  const sq=(document.getElementById('searchBox').value||'').toLowerCase();
  if(fc.length) items=items.filter(d=>fc.includes(d.category));
  if(fb.length) items=items.filter(d=>fb.includes(d.brand));
  if(sq) items=items.filter(d=>String(d.brand||'').toLowerCase().includes(sq)||(brandCodes[d.brand]&&String(brandCodes[d.brand].name||'').toLowerCase().includes(sq)));
  return items;
}
function getVisibleRetailers(){
  const fr=getSelectValues('fRet').map(normalizeRetailer);
  const groups=getSelectValues('fRetGroup');
  /* Channel filter only applies in map mode — its UI is hidden in the data
     pane, so its selections must not silently filter the matrix/data views. */
  const channels=currentMode==='map' ? getSelectValues('fRetChannel') : [];
  const allRetailers=[...new Set([...retailers,...doorLocations.map(d=>normalizeRetailer(d.retailer))])].filter(Boolean).sort();
  return allRetailers.filter(r=>{
    const norm=normalizeRetailer(r);
    if(fr.length && !fr.includes(norm)) return false;
    if(groups.length && !groups.includes(retailerGroup(norm))) return false;
    if(channels.length && !channels.includes(retailerChannel(norm))) return false;
    return true;
  });
}

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════
/* Per-pass memo: getMatrixVal / getDraftCount / getRetailerDoors are called
   once per cell during render. Reset at the start of every render() so a
   mutation between renders never sees stale data. */
let _renderCache=null;
let _searchTimer=null;

function render(){
  _renderCache={matrixVal:new Map(),draftCount:new Map(),retailerDoors:new Map(),maxDoors:new Map()};
  try{
    const items=getFiltered();
    const visR=getVisibleRetailers();
    updateStats(items,visR);
    updateSummary(items,visR);
    updateDraftBadge();
    if(currentView==='matrix') renderMatrix(items,visR);
    else if(currentView==='compact') renderCompact(items,visR);
    else if(currentView==='tabular') renderTabular(items,visR);
    else if(currentView==='unpivoted') renderUnpivoted(items,visR);
    else if(currentView==='store') renderStore(items,visR);
    else if(currentView==='research') renderResearch();
    else if(currentView==='drafts') renderDrafts();
  }finally{
    _renderCache=null;
    updateRefineActiveState();
  }
}

/* 150 ms debounce so typing in the search box doesn't re-render per keystroke. */
function debouncedRender(){
  clearTimeout(_searchTimer);
  updateRefineActiveState();
  _searchTimer=setTimeout(render,150);
}

function updateStats(items,visR){ return; }
function updateSummary(items,visR){
  const bar=document.getElementById('summaryBar');
  bar.innerHTML='';
  bar.style.display='none';
}

function buildRetailerColumns(visR){
  if(isShowByGroupOn()){
    const groupMap=new Map();
    visR.forEach(r=>{
      const g=retailerGroup(r);
      if(!groupMap.has(g)) groupMap.set(g,[]);
      groupMap.get(g).push(r);
    });
    return [...groupMap.entries()].map(([label,members])=>({label,members,isGroup:members.length>1}));
  }
  return visR.map(r=>({label:r,members:[r],isGroup:false}));
}
function sortRetailerColumns(cols){
  cols.forEach(col=>{ col._channel=retailerChannel(col.members[0]) || 'Other'; });
  cols.sort((a,b)=>a._channel.localeCompare(b._channel) || a.label.localeCompare(b.label));
  return cols;
}
function getGroupMatrixVal(members,brand){ return members.reduce((s,r)=>s+getMatrixVal(r,brand),0); }
function getGroupBMDoors(members){ return members.reduce((s,r)=>s+getBMDoorsForRetailer(r),0); }
function getGroupBMConfirmed(members,brand){ return members.reduce((s,r)=>s+getBMConfirmedCount(r,brand),0); }


function renderMatrix(items,visR){
  const wrap=document.getElementById('mainView');
  if(!items.length){wrap.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-dim)">No data matches filters.</div>';return;}
  const brandsByCat={};
  CAT_ORDER.forEach(c=>{brandsByCat[c]=[];});
  items.forEach(d=>{
    const c=d.category||'OTHER';
    if(!brandsByCat[c]) brandsByCat[c]=[];
    if(!brandsByCat[c].includes(d.brand)) brandsByCat[c].push(d.brand);
  });
  const lu={};
  items.forEach(d=>{lu[d.brand]=d;});

  /* The "Show by Group" toggle inside the Retailer refine section
     collapses member retailers into a single summed column per group. */
  let cols=buildRetailerColumns(visR);
  /* Sort columns by channel first so the matrix reads channel-by-channel,
     then alphabetically within each channel. */
  sortRetailerColumns(cols);
  /* Bucket cols into channel chunks for the thead colspan / divider rows. */
  const channelChunks=[];
  cols.forEach(col=>{
    const last=channelChunks[channelChunks.length-1];
    if(last && last.channel===col._channel) last.cols.push(col);
    else channelChunks.push({channel:col._channel, cols:[col]});
  });
  const colMax=col=>col.members.reduce((s,r)=>s+getMaxDoorsForRetailer(r),0);
  const colVal=(col,brand)=>col.members.reduce((s,r)=>s+getMatrixVal(r,brand),0);
  const colDrafts=(col,brand)=>col.members.reduce((s,r)=>s+getDraftCount(r,brand),0);

  if(!transposed){
    let h='<table class="matrix"><thead>';
    /* Top header row: channel bands spanning their retailer columns. */
    h+='<tr><th class="rh" style="z-index:6;background:var(--surface-raised)"></th><th class="rh2" style="z-index:6;background:var(--surface-raised)"></th>';
    channelChunks.forEach(chunk=>{
      h+=`<th class="channel-header" colspan="${chunk.cols.length}">${esc(chunk.channel)}</th>`;
    });
    h+='<th class="channel-header"></th></tr>';
    /* Second header row: retailer / group names, colored to match the map pins. */
    h+='<tr><th class="rh" style="z-index:6">Code</th><th class="rh2" style="z-index:6">Brand</th>';
    cols.forEach(col=>{
      const maxDoors=colMax(col);
      const subtitle=col.isGroup
        ? `${col.members.length} retailers · ${maxDoors} doors`
        : `${maxDoors} door${maxDoors===1?'':'s'}`;
      const color=retailerColor(col.label);
      h+=`<th style="color:${color}">${esc(col.label)}<br><span style="font-weight:400;font-size:0.55rem;color:var(--text-dim)">${esc(subtitle)}</span></th>`;
    });
    h+='<th>Total</th></tr></thead><tbody>';

    CAT_ORDER.forEach(cat=>{
      const brands=brandsByCat[cat];
      if(!brands||!brands.length) return;
      h+=`<tr class="cat-row"><td colspan="${cols.length+3}">${esc(cat)}</td></tr>`;
      brands.forEach(brand=>{
        const bName=brandCodes[brand]?brandCodes[brand].name:'';
        h+=`<tr><th class="rh">${esc(brand)}</th><th class="rh2">${esc(bName)}</th>`;
        let rowTot=0;
        cols.forEach(col=>{
          const val=colVal(col,brand);
          const drafts=colDrafts(col,brand);
          const maxDoors=colMax(col);
          const atCap=maxDoors>0 && val>0 && val>=maxDoors;
          const cls=['cell'];
          if(!val) cls.push('empty');
          if(atCap) cls.push('at-cap');
          if(col.isGroup) cls.push('group-cell');
          rowTot+=val;
          const draftIndicator=drafts>0?` <span style="color:var(--draft);font-size:0.55rem">+${drafts}d</span>`:'';
          const clickAttr = col.isGroup
            ? ` onclick="${callAttr('openGroupDrawer',col.label,brand)}"`
            : ` onclick="${callAttr('cellClick',col.members[0],brand)}" oncontextmenu="${ctxAttr(col.members[0],brand)}"`;
          const titleSuffix = col.isGroup ? ` (group: ${col.members.join(', ')})` : '';
          h+=`<td class="${cls.join(' ')}" data-r="${esc(col.label)}" data-b="${esc(brand)}"${clickAttr} title="${esc(col.label)} × ${esc(brand)}: ${val} confirmed${drafts?' + '+drafts+' drafts':''}${titleSuffix}">${val||'–'}${draftIndicator}</td>`;
        });
        h+=`<td class="ret-total">${rowTot||'–'}</td></tr>`;
      });
    });

    // Total row — door count (not sum of brands)
    h+=`<tr class="total-row"><th class="rh" style="color:var(--accent)">TTL</th><th class="rh2" style="color:var(--accent)">Doors</th>`;
    let gTot=0;
    cols.forEach(col=>{
      const v=colMax(col);
      gTot+=v;
      h+=`<td>${v}</td>`;
    });
    h+=`<td>${gTot}</td></tr></tbody></table>`;
    wrap.innerHTML=h;
  } else {
    const allBrands=[];
    CAT_ORDER.forEach(cat=>{(brandsByCat[cat]||[]).forEach(b=>allBrands.push({brand:b,category:cat}));});
    let h='<table class="matrix"><thead><tr><th class="rh" style="z-index:6">Retailer</th>';
    allBrands.forEach(({brand})=>{h+=`<th>${esc(brand)}</th>`;});
    h+='<th>Doors</th></tr></thead><tbody>';
    let lastChannel=null;
    cols.forEach(col=>{
      if(col._channel!==lastChannel){
        h+=`<tr class="channel-divider"><td colspan="${allBrands.length+2}">${esc(col._channel)}</td></tr>`;
        lastChannel=col._channel;
      }
      const maxDoors=colMax(col);
      const subtitle=col.isGroup ? `${col.members.length} retailers · ${maxDoors}` : `${maxDoors}`;
      const color=retailerColor(col.label);
      h+=`<tr><th class="rh" style="color:${color}">${esc(col.label)}<br><span style="font-weight:400;font-size:0.55rem;color:var(--text-dim)">${esc(subtitle)}</span></th>`;
      allBrands.forEach(({brand})=>{
        const val=colVal(col,brand);
        const atCap=maxDoors>0 && val>0 && val>=maxDoors;
        const cls=['cell'];if(!val)cls.push('empty');if(atCap)cls.push('at-cap');
        if(col.isGroup) cls.push('group-cell');
        const clickAttr=col.isGroup
          ? ` onclick="${callAttr('openGroupDrawer',col.label,brand)}"`
          : ` onclick="${callAttr('cellClick',col.members[0],brand)}" oncontextmenu="${ctxAttr(col.members[0],brand)}"`;
        h+=`<td class="${cls.join(' ')}"${clickAttr}>${val||'–'}</td>`;
      });
      h+=`<td class="ret-total">${maxDoors||'–'}</td></tr>`;
    });
    h+='</tbody></table>';
    wrap.innerHTML=h;
  }
}



function renderCompact(items,visR){
  const wrap=document.getElementById('mainView');
  const cols=sortRetailerColumns(buildRetailerColumns(visR));
  let h='<table class="compact-table"><thead><tr><th>Brand</th><th>Name</th><th>Category</th>';
  cols.forEach(col=>{h+=`<th>${esc(col.label)}</th>`;});
  h+='<th>Perimeter</th></tr></thead><tbody>';
  items.forEach(d=>{
    const bName=brandCodes[d.brand]?brandCodes[d.brand].name:'';
    let tot=0;
    h+=`<tr><td style="font-family:var(--font-mono);font-weight:700">${esc(d.brand)}</td><td>${esc(bName)}</td><td><span class="cat-badge">${esc(d.category)}</span></td>`;
    cols.forEach(col=>{
      const v=getGroupMatrixVal(col.members,d.brand);
      tot+=v;
      const clickAttr=col.isGroup
        ? `onclick="${callAttr('openGroupDrawer',col.label,d.brand)}"`
        : `onclick="${callAttr('openStoreDrawer',col.members[0],d.brand)}"`;
      h+=`<td class="cell${col.isGroup?' group-cell':''}" style="font-family:var(--font-mono);text-align:center;cursor:pointer;${v?'':'color:var(--text-dim)'}" ${clickAttr}>${v||'–'}</td>`;
    });
    h+=`<td style="font-family:var(--font-mono);font-weight:700;text-align:center;color:var(--accent)">${tot}</td></tr>`;
  });
  h+='</tbody></table>';
  wrap.innerHTML=h;
}

function renderTabular(items,visR){
  const wrap=document.getElementById('mainView');
  let rows=[];
  const cols=sortRetailerColumns(buildRetailerColumns(visR));
  items.forEach(d=>{
    cols.forEach(col=>{
      const v=getGroupMatrixVal(col.members,d.brand);
      if(v>0){
        const bmDoors=getGroupBMDoors(col.members);
        const bmBrand=getGroupBMConfirmed(col.members,d.brand);
        rows.push({
          retailer:col.label,
          members:col.members,
          isGroup:col.isGroup,
          brand:d.brand,
          category:d.category,
          doors:v,
          bm:bmDoors,
          pct:bmDoors?Math.round(bmBrand/bmDoors*100)+'%':'–',
          name:brandCodes[d.brand]?brandCodes[d.brand].name:''
        });
      }
    });
  });
  rows.sort((a,b)=>a.retailer.localeCompare(b.retailer)||a.category.localeCompare(b.category)||a.brand.localeCompare(b.brand));
  let h='<table class="compact-table"><thead><tr><th>Retailer</th><th>Code</th><th>Brand</th><th>Category</th><th>Doors</th><th>Retailer B&M</th><th>Penetration</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const clickAttr=r.isGroup
      ? `onclick="${callAttr('openGroupDrawer',r.retailer,r.brand)}"`
      : `onclick="${callAttr('openStoreDrawer',r.members[0],r.brand)}"`;
    h+=`<tr><td>${esc(r.retailer)}</td><td style="font-family:var(--font-mono);font-weight:700">${esc(r.brand)}</td><td>${esc(r.name)}</td><td><span class="cat-badge">${esc(r.category)}</span></td><td class="cell${r.isGroup?' group-cell':''}" style="font-family:var(--font-mono);text-align:center;cursor:pointer" ${clickAttr}>${r.doors}</td><td style="font-family:var(--font-mono);text-align:center;color:var(--text-muted)">${r.bm}</td><td style="font-family:var(--font-mono);text-align:center">${r.pct}</td></tr>`;
  });
  h+='</tbody></table>';
  wrap.innerHTML=h;
}

// ═══════════════════════════════════════════════════════
// UNPIVOTED VIEW
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// STORE VIEW — editable location matrix
// ═══════════════════════════════════════════════════════
/* Data view and Store view scope to one retailer at a time to keep render
   cost predictable. `_singleRetailerScope` remembers the user's pick across
   renders; when it falls outside the current visible-retailer set we fall
   back to the first visible retailer. */
let _singleRetailerScope=null;
function getActiveSingleRetailer(visR){
  if(!visR || !visR.length) return null;
  if(_singleRetailerScope && visR.includes(_singleRetailerScope)) return _singleRetailerScope;
  return visR[0];
}
function setSingleRetailerScope(ret){
  _singleRetailerScope = ret || null;
  render();
}
function renderSingleRetailerPicker(visR, active){
  if(!visR.length) return '';
  const opts=visR.map(r=>`<option value="${esc(r)}"${r===active?' selected':''}>${esc(r)}</option>`).join('');
  const extra=visR.length>1 ? `<span class="single-retailer-note">${visR.length} retailers match the current refine — showing one at a time for performance.</span>` : '';
  return `<div class="single-retailer-picker">
    <label for="singleRetailerSel">Retailer</label>
    <select id="singleRetailerSel" onchange="setSingleRetailerScope(this.value)">${opts}</select>
    ${extra}
  </div>`;
}

function renderStore(items,visR){
  const wrap=document.getElementById('mainView');
  const activeRet=getActiveSingleRetailer(visR);
  if(!activeRet){
    wrap.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-dim)">No retailers match the current filters.</div>';
    return;
  }
  const sq=(document.getElementById('searchBox').value||'').toLowerCase();
  const doors=doorLocations
    .filter(d=>normalizeRetailer(d.retailer)===normalizeRetailer(activeRet))
    .filter(d=>{
      if(!sq) return true;
      const blob=[d.retailer,d.doorNumber,d.name,d.address,d.city,d.state,d.zip,d.tier].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(sq);
    })
    .sort((a,b)=>String(a.doorNumber).localeCompare(String(b.doorNumber),undefined,{numeric:true}));

  if(!doors.length){
    wrap.innerHTML=renderSingleRetailerPicker(visR,activeRet)+'<div style="text-align:center;padding:60px;color:var(--text-dim)">No doors match the current filters for '+esc(activeRet)+'.</div>';
    return;
  }
  const fields=[
    {key:'name',w:'minmax(160px,1.4fr)',type:'text',ph:'Store / mall name'},
    {key:'doorNumber',w:'90px',type:'text',ph:'#'},
    {key:'address',w:'minmax(160px,1.4fr)',type:'text',ph:'Street'},
    {key:'city',w:'120px',type:'text',ph:'City'},
    {key:'state',w:'70px',type:'text',ph:'State'},
    {key:'zip',w:'90px',type:'text',ph:'ZIP'},
    {key:'tier',w:'70px',type:'text',ph:'Tier'},
    {key:'lat',w:'100px',type:'number',ph:'Lat'},
    {key:'lng',w:'100px',type:'number',ph:'Lng'}
  ];
  let h='<div class="store-view">';
  h+=renderSingleRetailerPicker(visR,activeRet);
  h+='<div class="store-toolbar"><span style="color:var(--text-muted);font-size:0.78rem">'+doors.length+' door'+(doors.length===1?'':'s')+' for '+esc(activeRet)+' — edits save on blur.</span></div>';
  h+='<table class="compact-table store-table"><thead><tr><th>Retailer</th>';
  fields.forEach(f=>{ h+=`<th>${esc(f.key.charAt(0).toUpperCase()+f.key.slice(1))}</th>`; });
  h+='<th></th></tr></thead><tbody>';
  doors.forEach(d=>{
    const ret=normalizeRetailer(d.retailer);
    const row=fields.map(f=>{
      const val=d[f.key]==null?'':d[f.key];
      const attr=callAttr('updateStoreDoorField',ret,String(d.doorNumber),f.key);
      return `<td><input type="${f.type}" value="${esc(String(val))}" placeholder="${esc(f.ph)}" data-store-field="${esc(f.key)}" onchange="${attr}" oninput="this.dataset.dirty=1"></td>`;
    }).join('');
    h+=`<tr data-store-key="${esc(ret+'|'+d.doorNumber)}"><th class="rh">${esc(ret)}</th>${row}<td style="text-align:right"><button class="btn btn-sm" type="button" onclick="${callAttr('openEditDoorModal',ret,String(d.doorNumber))}" title="Open detail editor">Edit</button></td></tr>`;
  });
  h+='</tbody></table></div>';
  wrap.innerHTML=h;
}

function updateStoreDoorField(ret,doorNumber,field,el){
  el = el || (event && event.target);
  if(!el) return;
  const norm=normalizeRetailer(ret);
  const d=doorLocations.find(x=>normalizeRetailer(x.retailer)===norm && String(x.doorNumber)===String(doorNumber));
  if(!d) return;
  let value=el.value;
  let next=value;
  if(field==='lat' || field==='lng'){
    if(String(value).trim()==='') next=undefined;
    else { const n=parseFloat(value); next=Number.isNaN(n)?undefined:n; }
  }else if(field==='doorNumber'){
    next=/^\d+$/.test(String(value).trim()) ? parseInt(value,10) : String(value).trim();
  }else if(field==='state' || field==='tier'){
    next=String(value||'').trim().toUpperCase();
  }else{
    next=String(value||'').trim();
  }
  const oldVal=d[field]==null?'':d[field];
  if(String(oldVal)===String(next==null?'':next)) return;
  d[field]=next;
  el.classList.add('store-saved');
  setTimeout(()=>el.classList.remove('store-saved'),900);
  if(field==='doorNumber'){
    const oldNum=String(doorNumber);
    const newNum=String(next);
    if(oldNum!==newNum) remapDoorNumberKeys(norm,oldNum,newNum);
  }
  const user=currentUserName();
  recordHistory(norm,'__door__',{action:'edit',doorNumber:String(d.doorNumber),scope:'door',oldVal:String(oldVal),newVal:String(next==null?'':next),date:new Date().toISOString(),user,note:`${field} changed`});
  queueAutosave();
}

/* When a door # is edited in the Store view, follow the change through
   dataKeyState and doorAssignments so existing brand records stay intact. */
function remapDoorNumberKeys(ret,oldNum,newNum){
  const norm=normalizeRetailer(ret);
  Object.keys(dataKeyState).forEach(key=>{
    const st=dataKeyState[key];
    if(!st || st.retailer!==norm) return;
    if(String(st.doorNumber)!==String(oldNum)) return;
    const newKey=buildDataKey(norm,newNum,st.brand);
    st.doorNumber=newNum;
    if(newKey!==key){ dataKeyState[newKey]=st; delete dataKeyState[key]; }
  });
  Object.keys(doorAssignments).forEach(ak=>{
    const [r]=ak.split('|');
    if(normalizeRetailer(r)!==norm) return;
    (doorAssignments[ak]||[]).forEach(a=>{
      if(String(a.doorNumber)===String(oldNum)) a.doorNumber=newNum;
    });
  });
}

function dataRowMatchesSearch(row,sq,brandName){
  if(!sq) return true;
  return [
    row.retailer,row.doorNumber,row.doorName,row.brand,brandName,row.category,row.location,
    row.status,row.grade,row.gender,row.note,row.metric_1,row.metric_2,row.key
  ].some(v=>String(v||'').toLowerCase().includes(sq));
}

function renderUnpivoted(items,visR){
  const wrap=document.getElementById('mainView');
  const activeRet=getActiveSingleRetailer(visR);
  if(!activeRet){
    wrap.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-dim)">No retailers match the current filters.</div>';
    return;
  }
  /* Data view scopes to a single retailer at a time. */
  const scopedVisR=[activeRet];
  let rows=[];
  const fc=getSelectValues('fCat');
  const fb=getSelectValues('fBrand');
  const fs=getSelectValues('fStatus');
  const fg=getSelectValues('fGrade');
  const fgen=getSelectValues('fGender');
  const opportunitiesOnly=!!document.getElementById('fOpportunities')?.checked;
  const sq=(document.getElementById('searchBox').value||'').toLowerCase();
  const brands=getAllBrands();

  scopedVisR.forEach(ret=>{
    getRetailerDoors(ret).forEach(door=>{
      brands.forEach(brand=>{
        const category=getBrandCategory(brand);
        const brandName=(brandCodes[brand]&&brandCodes[brand].name)||'';
        if(!hasFilterValue(fc,category)) return;
        if(!hasFilterValue(fb,brand)) return;
        const state=getDataKeyState(ret,door.doorNumber,brand) || {};
        const row={
          retailer:ret,
          doorNumber:String(door.doorNumber),
          doorName:door.name||'—',
          brand,
          category,
          location:`${door.city||'-'}, ${door.state||'-'}`,
          status:normalizeStatus(state.status || 'na'),
          grade:state.grade || door.tier || '-',
          gender:normalizeGender(state.gender),
          note:state.note || '',
          metric_1:state.metric_1 ?? '',
          metric_2:state.metric_2 ?? '',
          key:buildDataKey(ret,door.doorNumber,brand)
        };
        if(!dataRowMatchesSearch(row,sq,brandName)) return;
        if(opportunitiesOnly && row.status!=='na') return;
        if(!hasFilterValue(fs,row.status)) return;
        if(!hasFilterValue(fg,row.grade)) return;
        if(!hasFilterValue(fgen,row.gender)) return;
        rows.push(row);
      });
    });
  });

  for(const [aKey,assigns] of Object.entries(doorAssignments)){
    const [ret,brand]=aKey.split('|');
    if(!scopedVisR.includes(ret)) continue;
    const category=getBrandCategory(brand);
    const brandName=(brandCodes[brand]&&brandCodes[brand].name)||'';
    if(!hasFilterValue(fc,category)) continue;
    if(!hasFilterValue(fb,brand)) continue;
    assigns.forEach(a=>{
      const rawDoor=a.doorNumber;
      const hasMappedDoor=String(rawDoor)!=='-' && !!getDoorInfo(ret,rawDoor);
      if(hasMappedDoor) return;
      const state=getDataKeyState(ret,'-',brand) || {status:normalizeStatus(a.status),grade:'-',note:a.note||''};
      const row={
        retailer:ret,
        doorNumber:'-',
        doorName:'-',
        brand,
        category,
        location:'-',
        status:normalizeStatus(state.status || 'na'),
        grade:state.grade || '-',
        gender:normalizeGender(state.gender),
        note:state.note || '',
        metric_1:state.metric_1 ?? '',
        metric_2:state.metric_2 ?? '',
        key:buildDataKey(ret,'-',brand)
      };
      if(!dataRowMatchesSearch(row,sq,brandName)) return;
      if(opportunitiesOnly && row.status!=='na') return;
      if(!hasFilterValue(fs,row.status)) return;
      if(!hasFilterValue(fg,row.grade)) return;
      if(!hasFilterValue(fgen,row.gender)) return;
      rows.push(row);
    });
  }

  rows.sort((a,b)=>a.retailer.localeCompare(b.retailer)||((a.doorNumber==='-'?Number.MAX_SAFE_INTEGER:Number(a.doorNumber))-(b.doorNumber==='-'?Number.MAX_SAFE_INTEGER:Number(b.doorNumber)))||a.brand.localeCompare(b.brand));
  let h=renderSingleRetailerPicker(visR,activeRet);
  h+='<table class="compact-table"><thead><tr><th>Retailer</th><th>Door Number</th><th>Brand</th><th>Location</th><th>Status</th><th>Category</th><th>Grade</th><th>Gender</th><th>Metric 1</th><th>Metric 2</th><th>Notes</th><th>Key</th></tr></thead><tbody>';
  if(!rows.length){
    h+=`<tr><td colspan="12" style="text-align:center;color:var(--text-dim);padding:40px">${opportunitiesOnly?'No open brand-door opportunities matched the current filters.':'No door-brand slots matched the current filters.'}</td></tr>`;
  }
  rows.forEach(r=>{
    const statusPillCls = r.status==='confirmed'?'status-confirmed': r.status==='tbd'?'status-tbd': r.status==='closed'?'status-closed':'status-na';
    const gradePillCls = String(r.grade).toUpperCase()==='A'?'grade-a': String(r.grade).toUpperCase()==='B'?'grade-b': String(r.grade).toUpperCase()==='C'?'grade-c':'grade-none';
    h+=`<tr>
      <td>${esc(r.retailer)}</td>
      <td style="font-family:var(--font-mono)">${r.doorNumber==='-'?'-':esc(String(r.doorNumber))+' '+esc(r.doorName)}</td>
      <td style="font-family:var(--font-mono);font-weight:700">${esc(r.brand)}</td>
      <td>${esc(r.location)}</td>
      <td>
        <select class="data-pill-select statusSel ${statusPillCls}" onchange='updateDataKeyField(${jsq(r.retailer)},${jsq(r.doorNumber)},${jsq(r.brand)},"status",this.value,this);refreshDataPillDropdowns(this.closest("tr"))'>
          ${['confirmed','tbd','na','closed'].map(v=>`<option value="${v}" ${r.status===v?'selected':''}>${statusLabel(v)}</option>`).join('')}
        </select>
      </td>
      <td><span class="cat-badge">${esc(r.category)}</span></td>
      <td>
        <select class="data-pill-select gradeSel ${gradePillCls}" onchange='updateDataKeyField(${jsq(r.retailer)},${jsq(r.doorNumber)},${jsq(r.brand)},"grade",this.value,this);refreshDataPillDropdowns(this.closest("tr"))'>
          ${['-','A','B','C'].map(v=>`<option value="${v}" ${String(r.grade)===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="data-pill-select genderSel" onchange='updateDataKeyField(${jsq(r.retailer)},${jsq(r.doorNumber)},${jsq(r.brand)},"gender",this.value,this)'>
          ${['ALL','Mens Only','Ladies Only'].map(v=>`<option value="${v}" ${r.gender===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </td>
      <td><input class="data-cell-note" type="number" step="any" value="${esc(r.metric_1)}" oninput='updateDataKeyField(${jsq(r.retailer)},${jsq(r.doorNumber)},${jsq(r.brand)},"metric_1",this.value,this)' title="metric_1: first selling metric for this retailer-door-brand row"></td>
      <td><input class="data-cell-note" type="number" step="any" value="${esc(r.metric_2)}" oninput='updateDataKeyField(${jsq(r.retailer)},${jsq(r.doorNumber)},${jsq(r.brand)},"metric_2",this.value,this)' title="metric_2: second selling metric for this retailer-door-brand row"></td>
      <td><textarea class="data-cell-note" rows="1" oninput='updateDataKeyField(${jsq(r.retailer)},${jsq(r.doorNumber)},${jsq(r.brand)},"note",this.value,this)'>${esc(r.note)}</textarea></td>
      <td style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim)">${esc(r.key)}</td>
    </tr>`;
  });
  h+='</tbody></table>';
  wrap.innerHTML=h;
}

// ═══════════════════════════════════════════════════════
// DRAFTS VIEW
// ═══════════════════════════════════════════════════════
function renderDrafts(){
  const wrap=document.getElementById('mainView');
  const drafts=getAllDrafts();
  let h='<div style="padding:16px 0"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div style="font-family:var(--font-display);font-size:1.1rem;color:var(--draft)">Draft Entries</div>';
  if(drafts.length) h+=`<button class="btn btn-sm btn-accent" onclick="publishAllDrafts()">Publish All (${drafts.length})</button>`;
  h+='</div>';

  if(!drafts.length){
    h+='<div style="text-align:center;padding:40px;color:var(--text-dim)">No draft entries. Add new door entries — they start as drafts until published.</div>';
  } else {
    h+='<table class="compact-table"><thead><tr><th>Retailer</th><th>Door Number</th><th>Brand</th><th>Category</th><th>Note</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
    drafts.forEach((d,i)=>{
      const bName=brandCodes[d.brand]?brandCodes[d.brand].name:'';
      const catEntry=matrixData.find(m=>m.brand===d.brand);
      const cat=catEntry?catEntry.category:'—';
      h+=`<tr>
        <td>${esc(d.ret)}</td>
        <td style="font-family:var(--font-mono)">${d.doorNumber==='TBD'?'<span style="color:var(--draft);font-style:italic">TBD</span>':'#'+d.doorNumber+' '+esc(d.doorName)}</td>
        <td style="font-family:var(--font-mono);font-weight:700">${esc(d.brand)} <span style="font-weight:400;color:var(--text-muted)">${esc(bName)}</span></td>
        <td><span class="cat-badge">${esc(cat)}</span></td>
        <td style="color:var(--text-muted);font-size:0.68rem">${esc(d.note)}</td>
        <td style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-dim)">${d.date||'—'}</td>
        <td>
          <div style="display:flex;gap:4px">
            ${d.doorNumber==='TBD'?`<button class="btn btn-sm" onclick="assignDoorToDraft('${esc(d.ret)}','${esc(d.brand)}',${d.idx})">Assign Door</button>`:`<button class="btn btn-sm btn-accent" onclick="publishDraft('${esc(d.ret)}','${esc(d.brand)}',${d.idx})">Publish</button>`}
            <button class="btn btn-sm" style="color:var(--danger)" onclick="removeDraft('${esc(d.ret)}','${esc(d.brand)}',${d.idx})">✕</button>
          </div>
        </td>
      </tr>`;
    });
    h+='</tbody></table>';
  }
  h+='</div>';
  wrap.innerHTML=h;
}

function publishDraft(ret,brand,idx){
  const ak=k(ret,brand);
  const assigns=doorAssignments[ak];
  if(!assigns||!assigns[idx]) return;
  if(assigns[idx].doorNumber==='TBD'){
    toast('Assign a real door before publishing.');return;
  }
  assigns[idx].status='confirmed';
  assigns[idx].date=new Date().toISOString().slice(0,10);
  /* Keep dataKeyState in lockstep with doorAssignments — getConfirmedCount
     reads from dataKeyState, so publishing must update both. */
  const state=ensureDataKeyState(ret,assigns[idx].doorNumber,brand);
  state.status='confirmed';
  recordHistory(ret,brand,{
    scope:'data',
    action:'published confirmed key',
    oldVal:'DRAFT',
    newVal:buildDataKey(ret,assigns[idx].doorNumber,brand),
    doorNumber:assigns[idx].doorNumber,
    user:currentUserName(),
    note:'Draft promoted into Data'
  });
  queueAutosave();
  render();
  toast(`Published: ${brand} → #${assigns[idx].doorNumber} at ${ret}`);
}

function publishAllDrafts(){
  const drafts=getAllDrafts();
  let published=0;
  drafts.forEach(d=>{
    if(d.doorNumber!=='TBD'){
      const ak=k(d.ret,d.brand);
      const doorNum=doorAssignments[ak][d.idx].doorNumber;
      doorAssignments[ak][d.idx].status='confirmed';
      doorAssignments[ak][d.idx].date=new Date().toISOString().slice(0,10);
      const state=ensureDataKeyState(d.ret,doorNum,d.brand);
      state.status='confirmed';
      recordHistory(d.ret,d.brand,{
        scope:'data',
        action:'published confirmed key',
        oldVal:'DRAFT',
        newVal:buildDataKey(d.ret,doorNum,d.brand),
        doorNumber:doorNum,
        user:currentUserName(),
        note:'Bulk publish into Data'
      });
      published++;
    }
  });
  queueAutosave();
  render();
  toast(`Published ${published} entries` + (drafts.length-published>0 ? ` (${drafts.length-published} still need door assignment)` : ''));
}

async function assignDoorToDraft(ret,brand,idx){
  const ak=k(ret,brand);
  const assigns=doorAssignments[ak];
  if(!assigns||!assigns[idx]) return;
  const rDoors=doorLocations.filter(d=>normalizeRetailer(d.retailer)===ret).sort((a,b)=>a.name.localeCompare(b.name));
  let opts=rDoors.map(d=>`#${d.doorNumber} — ${d.name}`).join('\n');
  const pick=window.fashionPrompt
    ? await window.fashionPrompt(opts, { title:'Assign Door', confirmLabel:'Assign', defaultValue:'' })
    : prompt('Enter door number to assign:\n'+opts);
  if(!pick) return;
  const num=parseInt(pick.replace('#',''));
  if(isNaN(num)){toast('Invalid door number');return;}
  const di=rDoors.find(d=>d.doorNumber==num);
  if(!di){toast('Door not found');return;}
  // Check duplicate
  if(assigns.some((a,i)=>i!==idx&&a.doorNumber==num)){toast('This door is already assigned.');return;}
  const priorDoor=assigns[idx].doorNumber;
  assigns[idx].doorNumber=num;
  assigns[idx].doorName=di.name;
  recordHistory(ret,brand,{
    scope:'assignment',
    action:'door assigned to draft',
    oldVal:priorDoor,
    newVal:buildDataKey(ret,num,brand),
    doorNumber:num,
    user:currentUserName(),
    note:`Draft door updated to ${num}`
  });
  render();
  toast(`Door assigned: #${num} ${di.name}. Ready to publish.`);
}

function removeDraft(ret,brand,idx){
  const ak=k(ret,brand);
  const assigns=doorAssignments[ak];
  if(!assigns||!assigns[idx]) return;
  const removed=assigns[idx];
  recordHistory(ret,brand,{
    scope:'assignment',
    action:'draft removed',
    oldVal:removed.doorNumber==='TBD'?'TBD':buildDataKey(ret,removed.doorNumber,brand),
    newVal:'REMOVED',
    doorNumber:removed.doorNumber,
    user:currentUserName(),
    note:'Draft removed before publish'
  });
  assigns.splice(idx,1);
  render();
  toast('Draft removed');
}

// ═══════════════════════════════════════════════════════
// DOOR RESEARCH
// ═══════════════════════════════════════════════════════
/* Soft cap so the door list renders quickly even when a retailer has
   hundreds of doors. Users can click "Load all" to see the rest. */
const DOOR_LIST_PAGE_SIZE=100;
let _resShowAll=false;
let _resSearchTimer=null;

function renderResearch(){
  const wrap=document.getElementById('mainView');
  const retVals=getSelectValues('fRet');
  const groupVals=getSelectValues('fRetGroup');
  const channelVals=getSelectValues('fRetChannel');
  const retLabel=retVals.length ? retVals.join(', ') : (groupVals.length ? groupVals.join(', ') : (channelVals.length ? channelVals.join(', ') : 'All retailers'));
  const shellExists=!!document.getElementById('resMap');
  if(!shellExists){
    const prevSearch=(document.getElementById('resSearch')||{}).value||'';
    wrap.innerHTML=`
      <div class="research-map-shell">
        <div id="resMap"></div>
        <div class="map-filter-rail">
          <details class="map-filter-section" open>
            <summary>Channels</summary>
            <div class="map-filter-body" id="mapRetailerChannelFilter"></div>
          </details>
          <details class="map-filter-section" open>
            <summary>Retailers</summary>
            <div class="map-filter-body" id="mapRetailerFilter"></div>
          </details>
          <details class="map-filter-section" open>
            <summary>Brands</summary>
            <div class="map-filter-body" id="mapBrandFilter"></div>
          </details>
        </div>
        <div class="map-store-panel">
          <details class="map-filter-section" ${window._doorListCollapsed===true?'':'open'}>
            <summary>Stores</summary>
            <div class="map-filter-body">
              <input type="text" class="search-box" id="resSearch" placeholder="Search stores..." oninput="onResSearchInput()" value="${esc(prevSearch)}">
              <button class="btn btn-sm" id="doorListToggleBtn" onclick="toggleDoorListCollapse()" title="Show or hide matching stores" style="margin-bottom:8px">${window._doorListCollapsed===true?'Show stores':'Hide stores'}</button>
              <div class="door-list" id="doorList" style="${window._doorListCollapsed===true?'display:none':''}"></div>
            </div>
          </details>
        </div>
        <div class="door-detail" id="doorDetail"></div>
      </div>
    `;
    renderMapFilterClones();
    /* Map was destroyed when the shell got nuked by another view; create fresh. */
    _resMap=null;
    _resMapStyleReady=false;
    _resMapRetailer=null;
    initResearchMap();
  }else{
    const lbl=document.getElementById('resRetailerLabel');
    if(lbl) lbl.textContent=retLabel;
    renderMapFilterClones();
    updateResearchMapData();
  }
  _resShowAll=false;
  renderResearchList();
  setTimeout(()=>{ if(_resMap) _resMap.resize(); },0);
}

function toggleDoorListCollapse(){
  window._doorListCollapsed=!window._doorListCollapsed;
  const list=document.getElementById('doorList');
  const btn=document.getElementById('doorListToggleBtn');
  if(list)  list.style.display=window._doorListCollapsed?'none':'';
  if(btn)   btn.textContent=window._doorListCollapsed?'Show stores':'Hide stores';
}

function renderMapFilterClones(){
  const showAsHost=document.getElementById('mapShowAsFilter');
  const retHost=document.getElementById('mapRetailerFilter');
  const channelHost=document.getElementById('mapRetailerChannelFilter');
  const brandHost=document.getElementById('mapBrandFilter');
  if(showAsHost) showAsHost.innerHTML=renderMapShowAsFilter();
  if(retHost) retHost.innerHTML=renderMapRetailerOrGroupFilter();
  if(channelHost) channelHost.innerHTML=renderMapToggleFilter('fRetChannel','channel');
  if(brandHost) brandHost.innerHTML=renderMapToggleFilter('fBrand','brand');
  updateShowAsVisibility();
}

function renderMapRetailerOrGroupFilter(){
  const on=isShowByGroupOn();
  return `<div class="retailer-group-toggle map-embedded ${on?'is-on':''}" role="button" tabindex="0" data-map-group-toggle="1" aria-pressed="${on?'true':'false'}" title="Swap retailer pills for parent group pills">
      <span>Show by Group</span>
      <span class="refine-switch" aria-hidden="true"><span class="refine-switch-knob"></span></span>
    </div>` + renderMapToggleFilter(on?'fRetGroup':'fRet', on?'retailer-group':'retailer');
}

function renderMapToggleFilter(sourceId,filterKind){
  const source=document.getElementById(sourceId);
  if(!source) return '';
  const values=getSelectValues(source);
  const selected=new Set(values);
  const options=Array.from(source.options).filter(opt=>opt.value);
  const allActive=!values.length;
  const allLabel=filterKind==='retailer-group' ? 'All groups' : (filterKind==='retailer' ? 'All retailers' : (filterKind==='channel' ? 'All channels' : 'All brands'));
  const rows=options.map(opt=>{
    const active=selected.has(opt.value);
    const label=filterOptionLabel(sourceId,opt);
    return `<div class="map-filter-row ${active?'active':''}" role="button" tabindex="0" aria-pressed="${active?'true':'false'}" data-map-source="${esc(sourceId)}" data-map-value="${esc(opt.value)}" title="${esc(opt.textContent)}">
      <span class="map-filter-label">${esc(label)}</span>
      <span class="map-filter-switch" aria-hidden="true"></span>
    </div>`;
  }).join('');
  return `<div class="map-filter-all ${allActive?'active':''}" role="button" tabindex="0" aria-pressed="${allActive?'true':'false'}" data-map-clear="${esc(sourceId)}">
      <span class="map-filter-label">${allLabel}</span>
      <span class="map-filter-count">${options.length}</span>
    </div>
    <div class="map-filter-options">${rows || '<div style="padding:6px 2px;color:var(--text-dim);font-size:0.68rem">No options yet.</div>'}</div>`;
}

function toggleMapFilterValue(sourceId,value){
  const values=new Set(getSelectValues(sourceId));
  if(values.has(value)) values.delete(value);
  else values.add(value);
  setSelectValues(sourceId,Array.from(values));
  renderRefineToggles();
  renderMapFilterClones();
  updateResearchMapData();
  _resShowAll=false;
  renderResearchList();
}

function clearMapFilter(sourceId){
  setSelectValues(sourceId,[]);
  renderRefineToggles();
  renderMapFilterClones();
  updateResearchMapData();
  _resShowAll=false;
  renderResearchList();
}

function onMapFilterKey(e,sourceId,value){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  toggleMapFilterValue(sourceId,value);
}

function onMapFilterClearKey(e,sourceId){
  if(e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  clearMapFilter(sourceId);
}

function handleMapFilterEvent(e){
  const row=e.target.closest('[data-map-show-as],[data-map-source],[data-map-clear],[data-map-group-toggle]');
  if(!row || !row.closest('.map-filter-rail')) return;
  if(e.type==='keydown' && e.key!=='Enter' && e.key!==' ') return;
  e.preventDefault();
  e.stopPropagation();
  if(row.dataset.mapGroupToggle){
    toggleShowByGroupSwitch(e);
  }else if(row.dataset.mapShowAs){
    setShowAs(row.dataset.mapShowAs);
  }else if(row.dataset.mapSource){
    toggleMapFilterValue(row.dataset.mapSource,row.dataset.mapValue);
  }else if(row.dataset.mapClear){
    clearMapFilter(row.dataset.mapClear);
  }
}

function renderMapShowAsFilter(){
  const value=currentShowAs();
  return [['retailer_group','Retailer Group'],['retailer','Retailer'],['channel','Channel']]
    .map(([val,label])=>`<div class="map-filter-row ${value===val?'active':''}" role="button" tabindex="0" aria-pressed="${value===val?'true':'false'}" data-map-show-as="${esc(val)}">
      <span class="map-filter-label">${esc(label)}</span>
      <span class="map-filter-switch" aria-hidden="true"></span>
    </div>`).join('');
}

function onResSearchInput(){
  clearTimeout(_resSearchTimer);
  _resSearchTimer=setTimeout(()=>{ _resShowAll=false; renderResearchList(); },150);
}

function doorHasBrandAssignment(ret,doorNumber,brand){
  const assignments=doorAssignments[k(normalizeRetailer(ret),brand)]||[];
  return assignments.some(a=>String(a.doorNumber)===String(doorNumber));
}

function renderResearchList(){
  const visibleRetailers=new Set(getVisibleRetailers().map(normalizeRetailer));
  const hasRetailerScope=getSelectValues('fRet').length || getSelectValues('fRetGroup').length || getSelectValues('fRetChannel').length;
  const brandVals=getSelectValues('fBrand');
  const sq=(document.getElementById('resSearch')?.value||'').toLowerCase();
  const allRetailers=!hasRetailerScope;
  let doors=doorLocations.filter(d=>visibleRetailers.has(normalizeRetailer(d.retailer)));
  if(brandVals.length){
    doors=doors.filter(d=>{
      const doorRet=normalizeRetailer(d.retailer);
      return brandVals.some(brand=>{
        return doorHasBrandAssignment(doorRet,d.doorNumber,brand);
      });
    });
  }
  if(sq) doors=doors.filter(d=>(d.name||'').toLowerCase().includes(sq)||(d.city||'').toLowerCase().includes(sq)||(d.state||'').toLowerCase().includes(sq)||String(d.doorNumber).includes(sq));
  doors.sort((a,b)=>(a.tier||'Z').localeCompare(b.tier||'Z')||String(a.name||'').localeCompare(String(b.name||'')));
  const list=document.getElementById('doorList');
  if(!list) return;
  window._resDoors=doors;
  if(!doors.length){ list.innerHTML='<div style="padding:16px;color:var(--text-dim);font-size:0.78rem">No doors match. Try a different retailer or clear the brand filter.</div>'; return; }
  const visible=(_resShowAll || doors.length<=DOOR_LIST_PAGE_SIZE) ? doors : doors.slice(0,DOOR_LIST_PAGE_SIZE);
  const items=visible.map((d,i)=>{
    const cls=['door-item']; if(isDoorIncomplete(d)) cls.push('incomplete');
    const doorRet=normalizeRetailer(d.retailer);
    const coordWarn=doorNeedsCoordinateWarning(d);
    const warnBtn=coordWarn ? `<button type="button" class="door-warning-btn" title="Missing coordinates. Edit door details." onclick="${jsAttr(`event.stopPropagation();openEditDoorModal(${jsq(doorRet)},${jsq(String(d.doorNumber))})`)}">&#9888;</button>` : '';
    return `<div class="${cls.join(' ')}" style="--retailer-color:${esc(retailerColor(doorRet))}" onclick="${jsAttr(`selectDoor(${i},${jsq(doorRet)})`)}" data-idx="${i}"><div><div class="door-name">#${esc(String(d.doorNumber))} — ${esc(d.name||'(no name)')}${warnBtn}</div><div class="door-meta">${allRetailers?esc(doorRet)+' · ':''}${esc(d.city||'')}${d.state?', '+esc(d.state):''}${!d.city && !d.state ? '(no location)' : ''}</div></div><div>${d.tier?`<span class="tier-badge ${d.tier}">${d.tier}</span>`:''}</div></div>`;
  }).join('');
  const more=doors.length-visible.length;
  const footer=more>0
    ? `<div style="padding:10px 12px;text-align:center;border-top:1px solid var(--border);background:var(--surface-raised);font-size:0.74rem;color:var(--text-muted)">Showing ${visible.length} of ${doors.length} — <a href="#" onclick="event.preventDefault();_resShowAll=true;renderResearchList()" style="color:var(--accent);font-weight:600">Load all ${doors.length}</a></div>`
    : '';
  list.innerHTML=items+footer;
}

function isEcommerceDoor(d){
  const name=String((d&&d.name)||'').trim().toUpperCase().replace(/[\s_]+/g,'-');
  /* Match the door if its name is one of the standard e-commerce labels.
     The store name field is the source of truth — anything starting with
     E-COM or ECOM (with or without -MERCE) counts. */
  return /^(E-?COMMERCE|E-?COM|ECOM|E-?STORE|ONLINE)$/.test(name);
}

function doorNeedsCoordinateWarning(d){
  if(!d || isEcommerceDoor(d)) return false;
  const latRaw=d.lat;
  const lngRaw=d.lng;
  if(latRaw==null || lngRaw==null || String(latRaw).trim()==='' || String(lngRaw).trim()==='') return true;
  const lat=Number(latRaw);
  const lng=Number(lngRaw);
  return Number.isNaN(lat) || Number.isNaN(lng);
}

/* A door is "incomplete" when it still has the auto-generated "Door N",
   lacks location detail, or is missing coordinates. E-COMMERCE is a valid
   non-mapped door and does not need coordinates. */
function isDoorIncomplete(d){
  if(!d) return true;
  if(isEcommerceDoor(d)) return false;
  const placeholder=/^Door\s+\S+$/i.test(String(d.name||''));
  const noLocation=!(d.city||d.state||d.address);
  return placeholder || noLocation || doorNeedsCoordinateWarning(d);
}
const RETAILER_COLORS={
  'DLL':'#48CAE4',
  "Dillard's":'#48CAE4',
  'BLM':'#FF4D6D',
  'Bloomingdales':'#FF4D6D',
  'NRD':'#F6C562',
  'Nordstrom':'#F6C562',
  'Kohls':'#800033',
  'Kohl':'#800033',
  "Kohl's":'#800033',
  'BELK':'#008FD5',
  'Belk':'#008FD5',
  'Holt':'#FF7F0E',
  'Holt Renfrew':'#FF7F0E',
  'Von Maur':'#922DF5',
  'Webster':'#C9184A',
  'The Webster':'#C9184A',
  'Neiman Marcus':'#8a8f98',
  'Saks Fifth Ave':'#8a8f98',
  'Saks Fifth Avenue':'#8a8f98',
  'Bergdorf Goodman':'#8a8f98'
};
function retailerColor(retailer){
  const norm=normalizeRetailer(retailer);
  return RETAILER_COLORS[norm] || '#8a8f98';
}
function selectDoor(idx,ret){
  const d=window._resDoors[idx];
  if(!d) return;
  document.querySelectorAll('.door-item').forEach(el=>el.classList.remove('active'));
  document.querySelector(`.door-item[data-idx="${idx}"]`)?.classList.add('active');
  renderDoorDetail(d,ret);
}

function renderDoorDetail(d,ret){
  const norm=normalizeRetailer(ret);
  const retColor=retailerColor(norm);
  const doorNum=d.doorNumber;
  const brandFilters=getSelectValues('fBrand');

  const brandsAtDoor=[];
  const brandsAtRetailer=[];
  for(const [key,assigns] of Object.entries(doorAssignments)){
    const [r,b]=key.split('|');
    if(r===norm){
      const hasConfirmed=assigns.some(a=>a.status==='confirmed');
      if(hasConfirmed) brandsAtRetailer.push(b);
      assigns.forEach(a=>{
        if(a.doorNumber==doorNum){
          const state=getDataKeyState(norm,doorNum,b) || {};
          brandsAtDoor.push({brand:b,status:a.status,metric_1:state.metric_1 ?? '',metric_2:state.metric_2 ?? ''});
        }
      });
    }
  }
  matrixData.forEach(m=>{ if((m[norm]||0)>0 && !brandsAtRetailer.includes(m.brand)){ brandsAtRetailer.push(m.brand); } });

  const allBrands=(brandFilters.length ? matrixData.map(m=>m.brand).filter(b=>brandFilters.includes(b)) : matrixData.map(m=>m.brand))
    .sort((a,b)=>{
      const ap=brandsAtRetailer.includes(a)?0:1;
      const bp=brandsAtRetailer.includes(b)?0:1;
      return ap-bp || a.localeCompare(b);
    });
  const det=document.getElementById('doorDetail');
  if(!det) return;
  const incomplete=isDoorIncomplete(d);
  const addrParts=[d.address, d.city, d.state, d.zip].filter(Boolean).join(', ');
  const hasCoords=d.lat!=null && d.lng!=null && !Number.isNaN(Number(d.lat)) && !Number.isNaN(Number(d.lng));
  const coordsText=hasCoords ? Number(d.lat).toFixed(4)+', '+Number(d.lng).toFixed(4) : 'No coordinates';
  let html=`
    <h4><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(retColor)};margin-right:6px"></span>${esc(d.name||'(no name)')} <span class="tier-badge ${d.tier||''}">${d.tier||'–'}</span></h4>
    <div class="addr">${addrParts ? esc(addrParts) : '<span style="color:var(--text-dim);font-style:italic">No address on file</span>'}</div>
    <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim);margin:4px 0 12px">${esc(norm)} · Door #${esc(String(d.doorNumber))} · ${esc(coordsText)}</div>
  `;
  if(incomplete){
    const missing=[];
    if(/^Door\s+\S+$/i.test(String(d.name||''))) missing.push('store name');
    if(!d.address) missing.push('address');
    if(!d.city) missing.push('city');
    if(!d.state) missing.push('state');
    if(!hasCoords) missing.push('coordinates');
    html+=`<div class="door-warn-callout">
      <div class="door-warn-msg"><strong>Incomplete door</strong>Missing: ${missing.join(', ')}. ${hasCoords ? '' : 'This door won\'t appear on the map until it has coordinates. '}Fill these in to make the door browseable.</div>
      <button class="btn btn-sm btn-accent" onclick="${callAttr('openEditDoorModal',ret,String(d.doorNumber))}">Edit details</button>
    </div>`;
  }

  const tradeMetrics=getDoorTradeAreaMetrics(d,norm);
  if(tradeMetrics){
    html+=`<div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px;margin-top:12px">Trade Area</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div class="brand-pill" title="ACS B01003_001E within configured trade area">Population: ${esc(formatMarketValue(tradeMetrics.population,'integer'))}</div>
        <div class="brand-pill" title="ACS B19013_001E weighted within configured trade area">Income: ${esc(formatMarketValue(tradeMetrics.median_household_income,'currency'))}</div>
        <div class="brand-pill" title="Households with income above $150K when ACS income bands are available">Affluent HHs: ${esc(formatMarketValue(tradeMetrics.affluent_households,'integer'))}</div>
        <div class="brand-pill" title="Existing mapped doors in the same trade area">Nearby Doors: ${esc(formatMarketValue(tradeMetrics.nearby_door_count ?? tradeMetrics.existing_door_count,'integer'))}</div>
        <div class="brand-pill" title="0-100 normalized market score">Opportunity: ${esc(formatMarketValue(tradeMetrics.opportunity_score,'score'))}</div>
      </div>`;
  }else if(_marketMetadata){
    html+=`<div style="font-size:0.72rem;color:var(--text-dim);margin:8px 0 10px;font-style:italic">No trade-area metrics found for this door in the static Census layer.</div>`;
  }

  const visibleBrandsAtDoor=(brandFilters.length ? brandsAtDoor.filter(x=>brandFilters.includes(x.brand)) : brandsAtDoor)
    .sort((a,b)=>a.brand.localeCompare(b.brand));
  if(visibleBrandsAtDoor.length){
    html+=`<div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px">Brands at This Door</div>`;
    html+=`<div class="brand-pills">${visibleBrandsAtDoor.map(({brand,status,metric_1,metric_2})=>{
      const bName=brandCodes[brand]?brandCodes[brand].name:'';
      const isDraft=status==='draft';
      const metricText=(metric_1!==''||metric_2!=='')?` · m1: ${metric_1||'-'} · m2: ${metric_2||'-'}`:'';
      return `<div class="brand-pill${isDraft?' draft':''}" style="${isDraft?'border-color:var(--draft);color:var(--draft)':''}" title="${bName} — ${status}${metricText}">${brand}${isDraft?' (draft)':''}${metricText?` <span style="opacity:.75">${esc(metricText)}</span>`:''}</div>`;
    }).join('')}</div>`;
  } else {
    html+=`<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:8px;font-style:italic">No brands specifically assigned to this door yet.</div>`;
  }

  html+=`<div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px;margin-top:12px">All Brands at ${esc(norm)} (retailer level)</div>`;
  html+=`<div class="brand-pills">${allBrands.map(b=>{
    const present=brandsAtRetailer.includes(b);
    const bName=brandCodes[b]?brandCodes[b].name:'';
    const count=getMatrixVal(norm,b);
    return `<div class="brand-pill${present?'':' absent'}" title="${bName}: ${count} doors">${b}${present?' ('+count+')':''}</div>`;
  }).join('')}</div>`;

  det.innerHTML=html;
  highlightDoorOnMap(d.doorNumber,norm);
}

/* ── Edit-door modal: lets the user fill in (or correct) info inline so
   doors with placeholder names / missing coords don't break the experience. */
let _editDoorTarget=null;
function openEditDoorModal(ret,doorNumber){
  const norm=normalizeRetailer(ret);
  const d=doorLocations.find(x=>normalizeRetailer(x.retailer)===norm && String(x.doorNumber)===String(doorNumber));
  if(!d){ toast('Door not found.'); return; }
  _editDoorTarget={ret:norm, doorNumber:d.doorNumber};
  document.getElementById('editDoorDesc').textContent=`#${d.doorNumber} at ${norm}`;
  document.getElementById('edName').value=d.name||'';
  document.getElementById('edAddress').value=d.address||'';
  document.getElementById('edCity').value=d.city||'';
  document.getElementById('edState').value=d.state||'';
  document.getElementById('edZip').value=d.zip||'';
  document.getElementById('edTier').value=d.tier||'';
  document.getElementById('edLat').value=(d.lat==null||Number.isNaN(Number(d.lat)))?'':d.lat;
  document.getElementById('edLng').value=(d.lng==null||Number.isNaN(Number(d.lng)))?'':d.lng;
  document.getElementById('ovEditDoor').classList.add('open');
  document.getElementById('mEditDoor').classList.add('open');
  setTimeout(()=>document.getElementById('edName').focus(),50);
}
function closeEditDoorModal(){
  _editDoorTarget=null;
  document.getElementById('ovEditDoor').classList.remove('open');
  document.getElementById('mEditDoor').classList.remove('open');
}
function saveEditDoor(){
  if(!_editDoorTarget) return;
  const {ret, doorNumber}=_editDoorTarget;
  const d=doorLocations.find(x=>normalizeRetailer(x.retailer)===ret && String(x.doorNumber)===String(doorNumber));
  if(!d){ closeEditDoorModal(); return; }
  const next={
    name:document.getElementById('edName').value.trim(),
    address:document.getElementById('edAddress').value.trim(),
    city:document.getElementById('edCity').value.trim(),
    state:document.getElementById('edState').value.trim(),
    zip:document.getElementById('edZip').value.trim(),
    tier:document.getElementById('edTier').value.trim().toUpperCase(),
    lat:document.getElementById('edLat').value.trim(),
    lng:document.getElementById('edLng').value.trim()
  };
  const latNum=next.lat===''?undefined:parseFloat(next.lat);
  const lngNum=next.lng===''?undefined:parseFloat(next.lng);
  if(next.lat!=='' && Number.isNaN(latNum)){ toast('Latitude must be a number.'); return; }
  if(next.lng!=='' && Number.isNaN(lngNum)){ toast('Longitude must be a number.'); return; }
  /* Capture what changed so it lands in the change history. */
  const before={name:d.name||'',address:d.address||'',city:d.city||'',state:d.state||'',zip:d.zip||'',tier:d.tier||'',lat:d.lat==null?'':d.lat,lng:d.lng==null?'':d.lng};
  d.name=next.name||d.name||`Door ${d.doorNumber}`;
  d.address=next.address;
  d.city=next.city;
  d.state=next.state;
  d.zip=next.zip;
  d.tier=next.tier;
  d.lat=latNum;
  d.lng=lngNum;
  for(const [key,assigns] of Object.entries(doorAssignments)){
    const [r]=key.split('|');
    if(r!==ret) continue;
    assigns.forEach(a=>{
      if(String(a.doorNumber)===String(doorNumber)) a.doorName=d.name;
    });
  }
  const changes=Object.keys(before).filter(k=>String(before[k])!==String(k==='lat'?(latNum==null?'':latNum):(k==='lng'?(lngNum==null?'':lngNum):next[k])));
  /* Record a single rolled-up history entry against every brand currently
     tied to this door, so the audit log captures who fixed the door. */
  if(changes.length){
    const touchedBrands=new Set();
    for(const [key,assigns] of Object.entries(doorAssignments)){
      const [r,b]=key.split('|');
      if(r===ret && assigns.some(a=>String(a.doorNumber)===String(doorNumber))) touchedBrands.add(b);
    }
    if(!touchedBrands.size) touchedBrands.add('—');
    touchedBrands.forEach(b=>{
      recordHistory(ret,b,{scope:'door',action:'door details updated',oldVal:'',newVal:changes.join(', '),doorNumber:d.doorNumber});
    });
  }
  const drawerToRefresh=(document.getElementById('drawer')?.classList.contains('open') && activeStoreDrawer) ? {...activeStoreDrawer} : null;
  closeEditDoorModal();
  populateFilters();
  render();
  if(drawerToRefresh) openStoreDrawer(drawerToRefresh.ret,drawerToRefresh.brand);
  queueAutosave();
  /* Re-open the same door's detail to show the now-complete view. */
  const idx=(window._resDoors||[]).findIndex(x=>String(x.doorNumber)===String(doorNumber));
  if(idx>=0) selectDoor(idx, ret);
  toast(`Updated door #${doorNumber}.`);
}

/* Mapbox public token — URL-restrict to cloonk.com in the Mapbox dashboard. */
const MAPBOX_TOKEN='pk.eyJ1IjoiY2xvb25rIiwiYSI6ImNtb3hkNnkxNjA3bWIydG9lNTk4MzlydXYifQ.4fY2vNlTwCF0VyUdRpbiSQ';
if(window.mapboxgl) mapboxgl.accessToken=MAPBOX_TOKEN;

/* ── Multi-door research map (urban-retail-access style) ──────
   One persistent Mapbox instance per Research-view entry. Three toggleable
   layers backed by a single GeoJSON source:
     doors-clusters  zoomed-out store clusters with counts
     doors-heatmap   store density
     doors-brands    color by brand count at each door
     doors-circle    plain gold pin (default)
   A doors-selected layer paints a white ring on the currently-picked door.
*/
let _resMap=null;
let _resMapStyleReady=false;
let _resMapRetailer=null;
let _layerVisible={doors:true,brands:false,heat:false};
let _clusterEnabled=true;
let _marketLayerMetric='none';
let _marketHexData={type:'FeatureCollection',features:[]};
let _doorTradeAreaData={type:'FeatureCollection',features:[]};
let _marketMetadata=null;
let _marketDataPromise=null;
let _marketPopup=null;
const LAYER_IDS={doors:['doors-clusters','doors-cluster-count','doors-circle'],brands:['doors-brands'],heat:['doors-heatmap']};
const RESEARCH_MAP_LAYER_ORDER=['doors-selected','doors-circle','doors-brands','doors-cluster-count','doors-clusters','doors-heatmap'];
const MARKET_HEX_SOURCE_ID='market-hexes';
const MARKET_HEX_LAYER_ID='market-hex-fill';
const MARKET_HEX_OUTLINE_LAYER_ID='market-hex-outline';
const MARKET_DATA_PATHS={
  hex:'data/hex_market_data.geojson',
  trade:'data/door_trade_area_metrics.geojson',
  metadata:'data/market_metadata.json'
};
const MARKET_METRIC_CONFIG={
  median_household_income:{label:'Median Household Income',format:'currency',colorStops:['#fff7bc','#fec44f','#fe9929','#ec7014','#cc4c02']},
  population_density:{label:'Population Density',format:'density',colorStops:['#edf8fb','#b2e2e2','#66c2a4','#2ca25f','#006d2c']},
  affluent_households:{label:'Affluent Households',format:'integer',colorStops:['#f7fcfd','#bfd3e6','#8c96c6','#8856a7','#810f7c']},
  opportunity_score:{label:'Opportunity Score',format:'score',colorStops:['#ffffcc','#c2e699','#78c679','#31a354','#006837']}
};

function fetchJsonQuiet(url){
  return fetch(url,{cache:'no-cache'}).then(r=>{
    if(!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  });
}

function loadMarketData(){
  if(_marketDataPromise) return _marketDataPromise;
  _marketDataPromise=Promise.all([
    fetchJsonQuiet(MARKET_DATA_PATHS.hex).catch(()=>({type:'FeatureCollection',features:[]})),
    fetchJsonQuiet(MARKET_DATA_PATHS.trade).catch(()=>({type:'FeatureCollection',features:[]})),
    fetchJsonQuiet(MARKET_DATA_PATHS.metadata).catch(()=>null)
  ]).then(([hex,trade,metadata])=>{
    _marketHexData=(hex && hex.type==='FeatureCollection') ? hex : {type:'FeatureCollection',features:[]};
    _doorTradeAreaData=(trade && trade.type==='FeatureCollection') ? trade : {type:'FeatureCollection',features:[]};
    _marketMetadata=metadata;
    updateMarketMetaChip();
    if(_resMap && _resMapStyleReady) {
      addMarketMapLayers();
      updateMarketLayerPaint();
    }
    return {hex:_marketHexData,trade:_doorTradeAreaData,metadata:_marketMetadata};
  });
  return _marketDataPromise;
}

function updateMarketMetaChip(){
  const chip=document.getElementById('marketMetaChip');
  if(!chip) return;
  const refreshed=_marketMetadata && (_marketMetadata.date_refreshed || _marketMetadata.refreshed_at);
  const year=_marketMetadata && (_marketMetadata.acs_year || _marketMetadata.year);
  const count=(_marketHexData.features||[]).length;
  chip.textContent=count ? `ACS ${year || '5-Year'} · ${refreshed || 'refresh date unknown'}` : 'Market data not loaded';
}

function getMarketMetricRange(metric){
  const values=(_marketHexData.features||[])
    .map(f=>Number(f.properties && f.properties[metric]))
    .filter(Number.isFinite);
  if(!values.length) return {min:0,max:1};
  const min=Math.min(...values);
  const max=Math.max(...values);
  return max>min ? {min,max} : {min,max:min+1};
}

function getHexOpacity(metricValue,minValue,maxValue){
  const minOpacity=0.05;
  const maxOpacity=0.75;
  const value=Number(metricValue);
  if(!Number.isFinite(value)) return 0;
  const span=Math.max(Number(maxValue)-Number(minValue),1);
  const t=Math.max(0,Math.min(1,(value-Number(minValue))/span));
  return minOpacity + (maxOpacity-minOpacity)*t;
}

function getZoomOpacityMultiplier(){
  if(!_resMap) return 1;
  const z=_resMap.getZoom();
  if(z<5) return 0.72;
  if(z>9) return 1.12;
  return 0.88 + ((z-5)/4)*0.24;
}

function formatMarketValue(value,format){
  const n=Number(value);
  if(!Number.isFinite(n)) return 'n/a';
  if(format==='currency') return '$'+Math.round(n).toLocaleString();
  if(format==='density') return Math.round(n).toLocaleString()+' / sq mi';
  if(format==='score') return Math.round(n).toLocaleString();
  return Math.round(n).toLocaleString();
}

function marketMetricColorExpression(metric){
  const cfg=MARKET_METRIC_CONFIG[metric] || MARKET_METRIC_CONFIG.opportunity_score;
  const {min,max}=getMarketMetricRange(metric);
  const stops=cfg.colorStops;
  const step=(max-min)/Math.max(stops.length-1,1);
  const expr=['interpolate',['linear'],['coalesce',['to-number',['get',metric]],min]];
  stops.forEach((color,i)=>expr.push(min+(step*i),color));
  return expr;
}

function marketMetricOpacityExpression(metric){
  const {min,max}=getMarketMetricRange(metric);
  const zoomMultiplier=getZoomOpacityMultiplier();
  const stops=[0,0.25,0.5,0.75,1].map(t=>{
    const value=min+((max-min)*t);
    return [value,Math.min(0.82,getHexOpacity(value,min,max)*zoomMultiplier)];
  });
  const expr=['interpolate',['linear'],['coalesce',['to-number',['get',metric]],min]];
  stops.forEach(([value,opacity])=>expr.push(value,opacity));
  return expr;
}

function addMarketMapLayers(){
  if(!_resMap) return;
  if(!_resMap.getSource(MARKET_HEX_SOURCE_ID)){
    _resMap.addSource(MARKET_HEX_SOURCE_ID,{type:'geojson',data:_marketHexData});
  }else{
    const src=_resMap.getSource(MARKET_HEX_SOURCE_ID);
    if(src) src.setData(_marketHexData);
  }
  const beforeId=_resMap.getLayer('doors-heatmap') ? 'doors-heatmap' : undefined;
  if(!_resMap.getLayer(MARKET_HEX_LAYER_ID)){
    _resMap.addLayer({
      id:MARKET_HEX_LAYER_ID,
      type:'fill',
      source:MARKET_HEX_SOURCE_ID,
      layout:{visibility:_marketLayerMetric==='none'?'none':'visible'},
      paint:{'fill-color':'#31a354','fill-opacity':0.05}
    },beforeId);
  }
  if(!_resMap.getLayer(MARKET_HEX_OUTLINE_LAYER_ID)){
    _resMap.addLayer({
      id:MARKET_HEX_OUTLINE_LAYER_ID,
      type:'line',
      source:MARKET_HEX_SOURCE_ID,
      layout:{visibility:_marketLayerMetric==='none'?'none':'visible'},
      paint:{'line-color':'rgba(255,255,255,0.18)','line-width':['interpolate',['linear'],['zoom'],4,0.15,10,0.7],'line-opacity':0.38}
    },beforeId);
  }
  bindMarketMapInteractions();
}

function updateMarketLayerPaint(){
  if(!_resMap || !_resMap.getLayer(MARKET_HEX_LAYER_ID)) return;
  const visible=_marketLayerMetric && _marketLayerMetric!=='none';
  [MARKET_HEX_LAYER_ID,MARKET_HEX_OUTLINE_LAYER_ID].forEach(id=>{
    if(_resMap.getLayer(id)) _resMap.setLayoutProperty(id,'visibility',visible?'visible':'none');
  });
  if(!visible) return;
  _resMap.setPaintProperty(MARKET_HEX_LAYER_ID,'fill-color',marketMetricColorExpression(_marketLayerMetric));
  _resMap.setPaintProperty(MARKET_HEX_LAYER_ID,'fill-opacity',marketMetricOpacityExpression(_marketLayerMetric));
}

function setMarketLayer(metric){
  _marketLayerMetric=MARKET_METRIC_CONFIG[metric] ? metric : 'none';
  const select=document.getElementById('marketLayerSelect');
  if(select && select.value!==_marketLayerMetric) select.value=_marketLayerMetric;
  try{ localStorage.setItem('door-tracker-market-layer',_marketLayerMetric); }catch(e){}
  loadMarketData().then(()=>updateMarketLayerPaint());
}

function restoreMarketLayerState(){
  try{ _marketLayerMetric=localStorage.getItem('door-tracker-market-layer') || 'none'; }catch(e){ _marketLayerMetric='none'; }
  if(!MARKET_METRIC_CONFIG[_marketLayerMetric]) _marketLayerMetric='none';
  const select=document.getElementById('marketLayerSelect');
  if(select) select.value=_marketLayerMetric;
  updateMarketMetaChip();
}

function bindMarketMapInteractions(){
  if(!_resMap || !_resMap.getLayer(MARKET_HEX_LAYER_ID) || _resMap._marketInteractionsBound) return;
  _resMap._marketInteractionsBound=true;
  const show=e=>{
    const f=e.features && e.features[0];
    if(!f) return;
    const p=f.properties || {};
    if(_marketPopup) _marketPopup.remove();
    _marketPopup=new mapboxgl.Popup({closeButton:false,closeOnClick:false,offset:12})
      .setLngLat(e.lngLat)
      .setHTML(marketPopupHtml(p))
      .addTo(_resMap);
  };
  _resMap.on('mousemove',MARKET_HEX_LAYER_ID,show);
  _resMap.on('click',MARKET_HEX_LAYER_ID,show);
  _resMap.on('mouseenter',MARKET_HEX_LAYER_ID,()=>{ _resMap.getCanvas().style.cursor='pointer'; });
  _resMap.on('mouseleave',MARKET_HEX_LAYER_ID,()=>{
    _resMap.getCanvas().style.cursor='';
    if(_marketPopup){ _marketPopup.remove(); _marketPopup=null; }
  });
}

function marketPopupHtml(p){
  return `<strong>Market Hex</strong>
    <div>Population: ${esc(formatMarketValue(p.population,'integer'))}</div>
    <div>Median HH Income: ${esc(formatMarketValue(p.median_household_income,'currency'))}</div>
    <div>Population Density: ${esc(formatMarketValue(p.population_density,'density'))}</div>
    <div>Affluent HHs: ${esc(formatMarketValue(p.affluent_households,'integer'))}</div>
    <div>Existing Doors: ${esc(formatMarketValue(p.existing_door_count,'integer'))}</div>
    <div>Opportunity Score: ${esc(formatMarketValue(p.opportunity_score,'score'))}</div>`;
}

function doorTradeAreaKey(retailer,doorNumber){
  return `${normalizeRetailer(retailer)}|${String(doorNumber)}`;
}

function getDoorTradeAreaMetrics(d,ret){
  const key=doorTradeAreaKey(ret || d.retailer,d.doorNumber);
  const feature=(_doorTradeAreaData.features||[]).find(f=>{
    const p=f.properties || {};
    const fKey=p.door_key || doorTradeAreaKey(p.retailer,p.door_number || p.doorNumber);
    return fKey===key;
  });
  return feature ? (feature.properties || {}) : null;
}

function onResearchClusterClick(e){
  const feature=e.features && e.features[0];
  if(!feature || !_resMap) return;
  const clusterId=feature.properties.cluster_id;
  const source=_resMap.getSource('doors');
  if(!source || typeof source.getClusterExpansionZoom!=='function') return;
  source.getClusterExpansionZoom(clusterId,(err,zoom)=>{
    if(err) return;
    _resMap.easeTo({
      center:feature.geometry.coordinates,
      zoom,
      duration:650,
      essential:true
    });
  });
}

function initResearchMap(){
  const el=document.getElementById('resMap');
  if(!el) return;
  if(_resMap) return;
  if(!window.mapboxgl){
    el.innerHTML='<div class="helper-text" style="padding:20px">Mapbox failed to load.</div>';
    return;
  }
  _resMap=new mapboxgl.Map({
    container:el,
    style:mapStyleForTheme(),
    center:[-95,39],
    zoom:3,
    preserveDrawingBuffer:true,
    attributionControl:false
  });
  _resMap.addControl(new mapboxgl.AttributionControl({compact:true}));
  _resMap.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
  _resMap.on('zoomend',()=>updateMarketLayerPaint());
  _resMap.on('load',()=>{
    addResearchMapLayers();
    _resMapStyleReady=true;
    loadMarketData();
    updateResearchMapData();
  });
}

function addResearchMapLayers(){
  addMarketMapLayers();
  if(!_resMap.getSource('doors')){
    const sourceConfig={
      type:'geojson',
      data:{type:'FeatureCollection',features:[]}
    };
    if(_clusterEnabled){
      sourceConfig.cluster=true;
      sourceConfig.clusterMaxZoom=8;
      sourceConfig.clusterRadius=46;
    }
    _resMap.addSource('doors',sourceConfig);
  }
  if(!_resMap.getLayer('doors-heatmap')){
    _resMap.addLayer({
      id:'doors-heatmap',type:'heatmap',source:'doors',
      maxzoom:14,
      layout:{visibility:_layerVisible.heat?'visible':'none'},
      paint:{
        'heatmap-weight':['coalesce',['get','point_count'],1],
        'heatmap-intensity':['interpolate',['linear'],['zoom'],0,0.6,12,1.4],
        'heatmap-radius':['interpolate',['linear'],['zoom'],0,8,12,36],
        'heatmap-opacity':['interpolate',['linear'],['zoom'],11,0.8,14,0]
      }
    });
  }
  if(!_resMap.getLayer('doors-clusters')){
    _resMap.addLayer({
      id:'doors-clusters',type:'circle',source:'doors',
      filter:['has','point_count'],
      layout:{visibility:(_layerVisible.doors && _clusterEnabled)?'visible':'none'},
      paint:{
        'circle-radius':['step',['get','point_count'],15,10,19,25,24,50,30],
        'circle-color':['step',['get','point_count'],'#e8b931',10,'#d99b25',25,'#c66a2e',50,'#b5442d'],
        'circle-opacity':0.92,
        'circle-stroke-width':2,
        'circle-stroke-color':'rgba(255,255,255,0.78)'
      }
    });
  }
  if(!_resMap.getLayer('doors-cluster-count')){
    _resMap.addLayer({
      id:'doors-cluster-count',type:'symbol',source:'doors',
      filter:['has','point_count'],
      layout:{
        visibility:(_layerVisible.doors && _clusterEnabled)?'visible':'none',
        'text-field':['get','point_count_abbreviated'],
        'text-font':['DIN Offc Pro Medium','Arial Unicode MS Bold'],
        'text-size':['step',['get','point_count'],12,25,13,50,14],
        'text-allow-overlap':true,
        'text-ignore-placement':true
      },
      paint:{
        'text-color':'#111111',
        'text-halo-color':'rgba(255,255,255,0.35)',
        'text-halo-width':0.75
      }
    });
  }
  if(!_resMap.getLayer('doors-brands')){
    _resMap.addLayer({
      id:'doors-brands',type:'circle',source:'doors',
      filter:['!',['has','point_count']],
      layout:{visibility:_layerVisible.brands?'visible':'none'},
      paint:{
        'circle-radius':['interpolate',['linear'],['get','brandCount'],0,4,5,8,15,14,30,20],
        'circle-color':['get','retailerColor'],
        'circle-opacity':0.88,
        'circle-stroke-width':1,
        'circle-stroke-color':'rgba(255,255,255,0.35)'
      }
    });
  }
  if(!_resMap.getLayer('doors-circle')){
    _resMap.addLayer({
      id:'doors-circle',type:'circle',source:'doors',
      filter:['!',['has','point_count']],
      layout:{visibility:_layerVisible.doors?'visible':'none'},
      paint:{
        'circle-radius':['interpolate',['linear'],['zoom'],3,3,12,8],
        'circle-color':['get','retailerColor'],
        'circle-opacity':0.9,
        'circle-stroke-width':1,
        'circle-stroke-color':'rgba(0,0,0,0.4)'
      }
    });
  }
  if(!_resMap.getLayer('doors-selected')){
    _resMap.addLayer({
      id:'doors-selected',type:'circle',source:'doors',
      filter:['==',['get','doorNumber'],'__none__'],
      paint:{
        'circle-radius':['interpolate',['linear'],['zoom'],3,9,12,18],
        'circle-color':'rgba(0,0,0,0)',
        'circle-stroke-width':3,
        'circle-stroke-color':'#ffffff'
      }
    });
  }
  /* Click → drive selectDoor() so the right-side panel updates and the door
     gets the white highlight ring. */
  const onDoorClick=e=>{
    const f=e.features && e.features[0];
    if(!f) return;
    const doorNumber=f.properties.doorNumber;
    const ret=f.properties.retailer;
    const idx=(window._resDoors||[]).findIndex(d=>String(d.doorNumber)===String(doorNumber) && normalizeRetailer(d.retailer)===ret);
    if(idx>=0){ selectDoor(idx,ret); }
    else {
      const door=doorLocations.find(d=>String(d.doorNumber)===String(doorNumber) && normalizeRetailer(d.retailer)===ret);
      if(door) renderDoorDetail(door,ret);
      else highlightDoorOnMap(doorNumber,ret);
    }
  };
  ['doors-circle','doors-brands'].forEach(id=>{
    _resMap.off('click',id,onDoorClick);
    _resMap.on('click',id,onDoorClick);
    _resMap.on('mouseenter',id,()=>{ _resMap.getCanvas().style.cursor='pointer'; });
    _resMap.on('mouseleave',id,()=>{ _resMap.getCanvas().style.cursor=''; });
  });
  _resMap.off('click','doors-clusters',onResearchClusterClick);
  _resMap.on('click','doors-clusters',onResearchClusterClick);
  _resMap.on('mouseenter','doors-clusters',()=>{ _resMap.getCanvas().style.cursor='pointer'; });
  _resMap.on('mouseleave','doors-clusters',()=>{ _resMap.getCanvas().style.cursor=''; });
}

function rebuildResearchMapSource(){
  if(!_resMap || !_resMapStyleReady) return;
  RESEARCH_MAP_LAYER_ORDER.forEach(id=>{
    if(_resMap.getLayer(id)) _resMap.removeLayer(id);
  });
  if(_resMap.getSource('doors')) _resMap.removeSource('doors');
  addResearchMapLayers();
  updateResearchMapData();
  highlightDoorOnMap('__none__','__all__');
}

function updateResearchMapData(){
  if(!_resMap || !_resMapStyleReady) return;
  if(_marketLayerMetric!=='none') loadMarketData().then(()=>updateMarketLayerPaint());
  const retVals=getVisibleRetailers().map(normalizeRetailer);
  const hasRetailerScope=getSelectValues('fRet').length || getSelectValues('fRetGroup').length || getSelectValues('fRetChannel').length;
  const brandVals=getSelectValues('fBrand');
  const allRetailers=!hasRetailerScope;
  const norm=allRetailers?'__all__':retVals.join('|');
  const doors=doorLocations.filter(d=>{
    const doorRet=normalizeRetailer(d.retailer);
    if(!allRetailers && !retVals.includes(doorRet)) return false;
    if(brandVals.length){
      const hasBrand=brandVals.some(brand=>{
        return doorHasBrandAssignment(doorRet,d.doorNumber,brand);
      });
      if(!hasBrand) return false;
    }
    const lat=Number(d.lat), lng=Number(d.lng);
    return d.lat!=null && d.lng!=null && !Number.isNaN(lat) && !Number.isNaN(lng);
  });
  /* Pre-tally brand counts per doorNumber in a single pass through
     doorAssignments — beats O(doors × brands) lookups. */
  const brandCountByDoor=new Map();
  for(const [key,assigns] of Object.entries(doorAssignments)){
    const [r,b]=key.split('|');
    if(!allRetailers && !retVals.includes(r)) continue;
    if(brandVals.length && !brandVals.includes(b)) continue;
    const seen=new Set();
    for(const a of assigns){
      const dn=String(a.doorNumber);
      if(dn==='TBD' || seen.has(dn)) continue;
      seen.add(dn);
      const countKey=(allRetailers?r+'|':'')+dn;
      brandCountByDoor.set(countKey,(brandCountByDoor.get(countKey)||0)+1);
    }
  }
  const features=doors.map(d=>({
    type:'Feature',
    geometry:{type:'Point',coordinates:[Number(d.lng),Number(d.lat)]},
    properties:{
      doorNumber:String(d.doorNumber),
      name:d.name||'',
      retailer:normalizeRetailer(d.retailer),
      retailerColor:retailerColor(d.retailer),
      tier:d.tier||'',
      brandCount:brandCountByDoor.get((allRetailers?normalizeRetailer(d.retailer)+'|':'')+String(d.doorNumber))||0
    }
  }));
  const src=_resMap.getSource('doors');
  if(src) src.setData({type:'FeatureCollection',features});
  /* Auto-fit when the retailer changes (don't yank the map while just
     filtering brands or searching). */
  if(_resMapRetailer!==norm && features.length){
    const first=features[0].geometry.coordinates;
    const bounds=features.reduce((b,f)=>b.extend(f.geometry.coordinates), new mapboxgl.LngLatBounds(first,first));
    _resMap.fitBounds(bounds,{padding:40,duration:800,maxZoom:9});
  }
  _resMapRetailer=norm;
}

function highlightDoorOnMap(doorNumber,retailer){
  if(!_resMap || !_resMap.getLayer('doors-selected')) return;
  const normRetailer=retailer ? normalizeRetailer(retailer) : _resMapRetailer;
  const filter=normRetailer && normRetailer!=='__all__'
    ? ['all',['==',['get','doorNumber'],String(doorNumber)],['==',['get','retailer'],normRetailer]]
    : ['==',['get','doorNumber'],String(doorNumber)];
  _resMap.setFilter('doors-selected',filter);
  const door=doorLocations.find(d=>String(d.doorNumber)===String(doorNumber) && (!normRetailer || normRetailer==='__all__' || normalizeRetailer(d.retailer)===normRetailer));
  if(door && door.lat!=null && door.lng!=null){
    const lat=Number(door.lat), lng=Number(door.lng);
    if(!Number.isNaN(lat) && !Number.isNaN(lng)){
      _resMap.flyTo({center:[lng,lat],zoom:Math.max(_resMap.getZoom(),11),duration:700,essential:true});
    }
  }
}

function toggleResearchLayer(name){
  _layerVisible[name]=!_layerVisible[name];
  syncMapLayerToggles();
  if(!_resMap) return;
  (LAYER_IDS[name]||[]).forEach(id=>{
    const isClusterLayer=id==='doors-clusters' || id==='doors-cluster-count';
    const visible=_layerVisible[name] && (!isClusterLayer || _clusterEnabled);
    if(_resMap.getLayer(id)) _resMap.setLayoutProperty(id,'visibility',visible?'visible':'none');
  });
}
function toggleResearchClustering(){
  _clusterEnabled=!_clusterEnabled;
  try{ localStorage.setItem('door-tracker-map-clusters', _clusterEnabled?'1':'0'); }catch(e){}
  syncMapLayerToggles();
  rebuildResearchMapSource();
}
function syncMapLayerToggles(){
  document.querySelectorAll('.toggle-pill[data-layer]').forEach(p=>{
    const name=p.dataset.layer;
    if(p.dataset.layer===name) p.classList.toggle('inactive',!_layerVisible[name]);
  });
  document.querySelectorAll('.toggle-pill[data-cluster-toggle]').forEach(p=>{
    p.classList.toggle('inactive',!_clusterEnabled);
    p.setAttribute('aria-pressed',_clusterEnabled?'true':'false');
  });
}
async function copyMapScreenshot(){
  if(!_resMap){
    toast('Switch to Map mode before taking a screenshot.');
    return;
  }
  try{
    _resMap.resize();
    _resMap.triggerRepaint();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const canvas=_resMap.getCanvas();
    const blob=await new Promise((resolve,reject)=>{
      try{
        canvas.toBlob(b=>b?resolve(b):reject(new Error('Map screenshot failed.')),'image/png');
      }catch(err){ reject(err); }
    });
    if(navigator.clipboard && window.ClipboardItem){
      try{
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        toast('Map screenshot copied.');
      }catch(copyErr){
        console.warn(copyErr);
        downloadMapScreenshot(blob);
        toast('Clipboard copy was blocked, so the map screenshot was downloaded.');
      }
      return;
    }
    downloadMapScreenshot(blob);
    toast('Clipboard image copy is unavailable here, so the map screenshot was downloaded.');
  }catch(err){
    console.warn(err);
    toast('Browser blocked copying the map screenshot.');
  }
}
function downloadMapScreenshot(blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='door-map-screenshot.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function mapStyleForTheme(){
  return document.body.classList.contains('light')
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11';
}
function renderDoorMap(d){
  const el=document.getElementById("doorMap");
  if(!el) return;
  if(!window.mapboxgl){ el.innerHTML='<div class="helper-text" style="padding:12px">Mapbox failed to load.</div>'; return; }
  const lat=d ? Number(d.lat) : NaN;
  const lng=d ? Number(d.lng) : NaN;
  if(!d || d.lat==null || d.lng==null || Number.isNaN(lat) || Number.isNaN(lng)){
    el.innerHTML='<div class="helper-text" style="padding:12px">No coordinates on file — map unavailable for this door.</div>';
    return;
  }
  if(window._doorMap){ try{window._doorMap.remove();}catch(e){} window._doorMap=null; }
  el.innerHTML='';
  const map=new mapboxgl.Map({
    container:el,
    style:mapStyleForTheme(),
    center:[d.lng,d.lat],
    zoom:4,
    attributionControl:false
  });
  window._doorMap=map;
  map.addControl(new mapboxgl.AttributionControl({compact:true}));
  map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
  map.on('load',()=>{
    new mapboxgl.Marker({color:retailerColor(d.retailer)})
      .setLngLat([d.lng,d.lat])
      .setPopup(new mapboxgl.Popup({offset:18}).setHTML(`<strong>${esc(d.name)}</strong><br>Door #${esc(String(d.doorNumber))}`))
      .addTo(map)
      .togglePopup();
    map.flyTo({center:[d.lng,d.lat],zoom:13,duration:1800,essential:true});
  });
}

function normalizeRetailer(raw){
  const key=String(raw||'').trim();
  const upper=key.toUpperCase();
  const map={'DLL':"Dillard's",'DILLARDS':"Dillard's",'DILLARD’S':"Dillard's","DILLARD'S":"Dillard's",'BLM':'Bloomingdales','BLOOMINGDALES':'Bloomingdales','NRD':'Nordstrom','NORDSTROM':'Nordstrom','NEIMAN MARCUS':'Neiman Marcus','SAKS FIFTH AVENUE':'Saks Fifth Ave','SAKS FIFTH AVE':'Saks Fifth Ave','HOLTRENFREW':'Holt','HOLT RENFREW':'Holt','BERGDORF GOODMAN':'Bergdorf Goodman','BELK':'BELK','KOHLS':'Kohl',"KOHL'S":'Kohl','VON MAUR':'Von Maur','WEBSTER':'Webster','THE WEBSTER':'Webster'};
  return map[key]||map[upper]||key;
}
const RETAILER_GROUPS={
  'Saks Fifth Ave':'Saks Global',
  'Neiman Marcus':'Saks Global',
  'Bergdorf Goodman':'Saks Global'
};
function retailerGroup(retailer){
  const norm=normalizeRetailer(retailer);
  return RETAILER_GROUPS[norm] || norm;
}
const RETAILER_CHANNELS={
  "Dillard's":'Luxury',
  'Bloomingdales':'Luxury',
  'Nordstrom':'Luxury',
  'Saks Fifth Ave':'Luxury',
  'Neiman Marcus':'Luxury',
  'Bergdorf Goodman':'Luxury',
  'Holt':'Luxury',
  'Von Maur':'Luxury',
  'Webster':'Luxury',
  'BELK':'STARS',
  'Kohl':'STARS'
};
function retailerChannel(retailer){
  const norm=normalizeRetailer(retailer);
  return RETAILER_CHANNELS[norm] || 'Luxury';
}
function buildDataKey(ret,doorNumber,brand){
  return String(ret||'').replace(/[^A-Za-z0-9]/g,'') + String(doorNumber||'') + String(brand||'').replace(/[^A-Za-z0-9]/g,'');
}
function getDataKeyState(ret,doorNumber,brand){
  return dataKeyState[buildDataKey(ret,doorNumber,brand)] || null;
}
function ensureDataKeyState(ret,doorNumber,brand){
  const key=buildDataKey(ret,doorNumber,brand);
  if(!dataKeyState[key]){
    const doorInfo=(String(doorNumber)==='-'?null:getDoorInfo(ret,doorNumber));
    dataKeyState[key]={status:'na',grade:(doorInfo&&doorInfo.tier)||'-',gender:'ALL',note:'',metric_1:'',metric_2:'',retailer:ret,doorNumber:doorNumber,brand:brand};
  }
  return dataKeyState[key];
}
function upsertAssignment(ret,brand,doorNumber,status,note){
  if(String(doorNumber)==='-' || !getDoorInfo(ret,doorNumber)) return;
  const ak=k(ret,brand);
  if(!doorAssignments[ak]) doorAssignments[ak]=[];
  const idx=doorAssignments[ak].findIndex(a=>String(a.doorNumber)===String(doorNumber));
  if(status==='confirmed' || status==='tbd'){
    const info=getDoorInfo(ret,doorNumber);
    const rec={doorNumber:doorNumber,doorName:(info&&info.name) || `Door ${doorNumber}`,note:note||'',status:status==='confirmed'?'confirmed':'draft',date:new Date().toISOString().slice(0,10)};
    if(idx>=0) doorAssignments[ak][idx]=rec; else doorAssignments[ak].push(rec);
  }else if(idx>=0){
    doorAssignments[ak].splice(idx,1);
  }
}
function syncAssignmentFromDataKey(ret,doorNumber,brand){
  const state=getDataKeyState(ret,doorNumber,brand) || {};
  upsertAssignment(ret,brand,doorNumber,normalizeStatus(state.status),state.note||'');
}
function updateDataKeyField(ret,doorNumber,brand,field,value,el){
  const state=ensureDataKeyState(ret,doorNumber,brand);
  const oldVal=(state[field]??'');
  if(field==='status') state.status=normalizeStatus(value);
  else if(field==='grade') state.grade=value||'-';
  else if(field==='gender') state.gender=normalizeGender(value);
  else if(field==='note') state.note=value||'';
  else if(field==='metric_1' || field==='metric_2') state[field]=value===''?'':Number(value);
  else state[field]=value;
  syncAssignmentFromDataKey(ret,doorNumber,brand);
  if(el && (field==='status' || field==='grade')) syncDataCellClass(el,field);
  recordHistory(ret,brand,{scope:'data',action:`${field} updated`,oldVal:oldVal,newVal:state[field],doorNumber:doorNumber});
  queueAutosave();
}

// ═══════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════
function cellClick(r,b){window._drawerShowAllUnassigned=false;openStoreDrawer(r,b);}

/* Group drawer: when a Retailer Group cell is clicked, surface a combined
   read-out of every retailer in the group with its assigned and unassigned
   doors plus the buildDataKey value, then let the user jump into the
   single-retailer drawer for actual edits. */
function openGroupDrawer(group, brand){
  activeStoreDrawer={ret:group,brand,isGroup:true};
  const bName=brandCodes[brand]?brandCodes[brand].name:brand;
  const allRetailers=[...new Set([...retailers,...doorLocations.map(d=>normalizeRetailer(d.retailer))])].filter(Boolean);
  const members=allRetailers.filter(r=>retailerGroup(r)===group).sort();
  document.getElementById('drTitle').textContent=`${bName} at ${group}`;
  let totalConfirmed=0, totalDraft=0, totalDoors=0;
  members.forEach(r=>{
    totalConfirmed+=getMatrixVal(r,brand);
    totalDraft+=getDraftCount(r,brand);
    totalDoors+=getMaxDoorsForRetailer(r);
  });
  document.getElementById('drSub').textContent=`${members.length} retailers · ${totalConfirmed} confirmed${totalDraft?' + '+totalDraft+' drafts':''} of ${totalDoors} doors`;
  let html='<div class="group-drawer">';
  if(!members.length){
    html+='<div class="helper-text">No retailers found under this group.</div>';
  }
  members.forEach(ret=>{
    const norm=normalizeRetailer(ret);
    const rDoors=getRetailerDoors(norm);
    const bmDoors=getBMDoorsForRetailer(norm);
    const confirmedCt=getMatrixVal(norm,brand);
    const draftCt=getDraftCount(norm,brand);
    const penPct=bmDoors ? Math.round(getBMConfirmedCount(norm,brand)/bmDoors*100) : null;

    /* Group drawer shows one summary row per retailer — door-level lists
       only appear when the user drills into the per-retailer drawer. */
    html+=`<div class="group-drawer-section summary" onclick="${callAttr('openStoreDrawer',norm,brand)}" role="button" tabindex="0">
      <div class="group-drawer-section-header">
        <div>
          <div class="group-drawer-retailer">${esc(norm)}</div>
          <div class="group-drawer-meta">${confirmedCt} confirmed${draftCt?' + '+draftCt+' drafts':''} of ${rDoors.length} door${rDoors.length===1?'':'s'}${penPct!=null?` · ${penPct}% B&M penetration`:''}</div>
        </div>
        <button class="btn btn-sm" type="button" onclick="event.stopPropagation();openStoreDrawer('${esc(norm)}','${esc(brand)}')">Open →</button>
      </div>
    </div>`;
  });
  html+='</div>';
  document.getElementById('drContent').innerHTML=html;
  document.getElementById('ovDraw').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}
function openStoreDrawer(ret,brand){
  activeStoreDrawer={ret,brand};
  const bName=brandCodes[brand]?brandCodes[brand].name:brand;
  document.getElementById('drTitle').textContent=bName+' at '+ret;
  const count=getMatrixVal(ret,brand);
  const draftCt=getDraftCount(ret,brand);
  const norm=ret;
  const rDoors=getRetailerDoors(ret).slice().sort((a,b)=>(a.tier||'Z').localeCompare(b.tier||'Z')||String(a.name||'').localeCompare(String(b.name||'')));
  const ak=k(ret,brand);
  const assigns=(doorAssignments[ak]||[]);
  const assignedNums=new Set(assigns.filter(a=>a.doorNumber!=='TBD').map(a=>String(a.doorNumber)));
  const confirmedNums=new Set(assigns.filter(a=>a.status==='confirmed' && a.doorNumber!=='TBD').map(a=>String(a.doorNumber)));
  const draftNums=new Set(assigns.filter(a=>a.status==='draft' && a.doorNumber!=='TBD').map(a=>String(a.doorNumber)));
  const unassignedDoors=rDoors.filter(dl=>!assignedNums.has(String(dl.doorNumber)));

  document.getElementById('drSub').textContent=count+' confirmed doors'+(draftCt?' + '+draftCt+' drafts':'')+' carrying '+brand+' · '+unassignedDoors.length+' unassigned available';

  let html='';

  html+='<div style="display:grid;grid-template-columns:1fr;gap:14px">';
  html+=`<div class="multi-mode-toggle" style="margin:0 0 2px 0">
    <button class="btn btn-sm active" id="drawerAssignedToggle" type="button" onclick="setDrawerDoorPanel('assigned')">Assigned Doors <span class="draft-badge" style="margin-left:6px">${assigns.length}</span></button>
    <button class="btn btn-sm" id="drawerUnassignedToggle" type="button" onclick="setDrawerDoorPanel('unassigned')">Unassigned Doors <span class="draft-badge" style="margin-left:6px">${unassignedDoors.length}</span></button>
  </div>`;
  html+=`<input class="search-box" id="drawerDoorSearch" type="search" placeholder="Search doors..." oninput="filterDrawerDoors()" style="width:100%;margin:0 0 2px 0">`;

  html+='<div id="drawerAssignedPanel">';
  html+='<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px;margin-top:4px">Assigned Doors</div>';
  if(assigns.length){
    html+=`<div class="helper-text" style="margin-bottom:8px">Click X to stage a door change, choose Exit or TBD, then commit.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
      <button class="btn btn-sm" id="drawerAssignedSelectAllBtn" onclick="toggleDrawerDoorSelection('remove')">Select All</button>
      <select id="drawerRemoveMode" onchange="collectDrawerPendingAdds()" style="width:auto;min-width:120px">
        <option value="closed">Exit</option>
        <option value="tbd">TBD</option>
      </select>
      <span id="drawerAssignedCommitState" style="font-size:0.72rem;color:var(--text-muted);margin-left:auto">No pending changes</span>
    </div>`;
    html+='<div class="drawer-door-list" id="drawerAssignedList">';
    assigns.forEach((a,i)=>{
      const isDraft=a.status==='draft';
      const keyVal=(a.doorNumber!=='TBD')?buildDataKey(ret,a.doorNumber,brand):'Pending key until door is assigned';
      const assignedDoor=a.doorNumber!=='TBD' ? getDoorInfo(ret,a.doorNumber) : null;
      const assignedName=assignedDoor ? assignedDoor.name : a.doorName;
      const assignedLocation=assignedDoor ? [assignedDoor.address,assignedDoor.city,assignedDoor.state,assignedDoor.zip].filter(Boolean).join(' ') : '';
      const assignedSearch=[a.doorNumber,assignedName,keyVal,a.note,assignedLocation,a.status].filter(Boolean).join(' ');
      const assignedWarn=assignedDoor && doorNeedsCoordinateWarning(assignedDoor)
        ? `<button type="button" class="door-warning-btn" title="Missing coordinates. Edit door details." onclick="${jsAttr(`event.stopPropagation();openEditDoorModal(${jsq(ret)},${jsq(String(a.doorNumber))})`)}">&#9888;</button>`
        : '';
      const isTBD=a.doorNumber==='TBD';
      const stagingRow = !isTBD
        ? `<input type="checkbox" class="drawerRemoveChk drawer-door-hidden-input" value="${a.doorNumber}" onchange="syncDrawerDoorChecks();collectDrawerPendingAdds()">`
        : '';
      const trailingAction = isTBD
        ? `<button type="button" class="drawer-door-check assigned-remove" title="Remove TBD draft" onclick="${jsAttr(`event.stopPropagation();removeDraft(${jsq(ret)},${jsq(brand)},${i});openStoreDrawer(${jsq(ret)},${jsq(brand)})`)}">✕</button>`
        : `<button type="button" class="drawer-door-check assigned-remove" title="Stage Exit/TBD" onclick="event.stopPropagation();toggleDrawerCheckbox(this.closest('.drawer-door-row').querySelector('.drawerRemoveChk'))">✕</button>`;
      const publishOrAssign = isDraft && !isTBD
        ? `<button class="btn btn-sm btn-accent" onclick="event.stopPropagation();${jsAttr(`publishFromDrawer(${jsq(ret)},${jsq(brand)},${i})`)}">Publish</button>`
        : (isDraft && isTBD
            ? `<button class="btn btn-sm" onclick="event.stopPropagation();${jsAttr(`assignDoorToDraft(${jsq(ret)},${jsq(brand)},${i});openStoreDrawer(${jsq(ret)},${jsq(brand)})`)}">Assign</button>`
            : '');
      html+=`<div class="drawer-door-row clickable${isDraft?' is-draft':''}" data-door-row="1" data-search="${esc(assignedSearch.toLowerCase())}" onclick="onDrawerRowClick(event, 'remove')">
        ${stagingRow}
        <div class="drawer-door-meta">
          <div style="font-weight:600;${isDraft?'color:var(--draft);font-style:italic':''}">${isTBD?'TBD — Pending door':'#'+a.doorNumber+' — '+esc(assignedName||'(no name)')}${assignedWarn} <span style="font-size:0.6rem;padding:1px 5px;border-radius:3px;${isDraft?'background:var(--draft-dim);color:var(--draft)':'background:rgba(39,174,96,0.15);color:var(--success)'}">${a.status.toUpperCase()}</span></div>
          <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-dim);margin-top:2px">${esc(keyVal)}</div>
          ${a.note?'<div style="color:var(--text-muted);font-size:0.7rem;margin-top:2px">'+esc(a.note)+'</div>':''}
          <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-dim)">${a.date||''}</div>
        </div>
        <div class="drawer-door-actions">
          ${publishOrAssign}
          ${trailingAction}
        </div>
      </div>`;
    });
    html+='</div>';
  }else{
    html+='<div class="helper-text" style="padding:10px 0;border-bottom:1px solid var(--border)">No assigned doors yet for this brand-retailer combination.</div>';
  }
  html+='</div>';

  html+='<div id="drawerUnassignedPanel" style="display:none;margin-top:4px">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">Unassigned Doors Available to Add</div><div style="font-size:0.68rem;color:var(--text-dim)">'+unassignedDoors.length+' doors</div></div>';
  if(unassignedDoors.length){
    html+=`<div class="helper-text" style="margin-bottom:8px">Stage additions or removals here, choose Assign or TBD for unassigned doors, then click Commit Change. Exiting without committing discards all staged selections.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
      <button class="btn btn-sm" id="drawerUnassignedSelectAllBtn" onclick="toggleDrawerDoorSelection('add')">Select All</button>
      <select id="drawerAddMode" onchange="collectDrawerPendingAdds()" style="width:auto;min-width:120px">
        <option value="confirmed">Assign</option>
        <option value="tbd">TBD</option>
      </select>
      <span id="drawerCommitState" style="font-size:0.72rem;color:var(--text-muted);margin-left:auto">No pending changes</span>
    </div>
    <div class="drawer-door-list" id="drawerUnassignedList">`;
    unassignedDoors.forEach(dl=>{
      const keyVal=buildDataKey(ret,dl.doorNumber,brand);
      const searchText=[dl.doorNumber,dl.name,dl.address,dl.city,dl.state,dl.zip,dl.tier,keyVal].filter(Boolean).join(' ');
      const warnBtn=doorNeedsCoordinateWarning(dl)
        ? `<button type="button" class="door-warning-btn" title="Missing coordinates. Edit door details." onclick="${jsAttr(`event.stopPropagation();openEditDoorModal(${jsq(ret)},${jsq(String(dl.doorNumber))})`)}">&#9888;</button>`
        : '';
      html+=`<div class="drawer-door-row clickable" data-door-row="1" data-search="${esc(searchText.toLowerCase())}" onclick="onDrawerRowClick(event, 'add')">
        <input type="checkbox" class="drawerAddChk drawer-door-hidden-input" value="${dl.doorNumber}" onchange="syncDrawerDoorChecks();collectDrawerPendingAdds()">
        <div class="drawer-door-meta">
          <div style="font-weight:600">#${dl.doorNumber} — ${esc(dl.name||'(no name)')}${warnBtn} <span style="font-size:0.6rem;padding:1px 5px;border-radius:3px;background:transparent;color:var(--text-dim);border:1px solid var(--border)">UNASSIGNED</span></div>
          <div style="color:var(--text-muted);font-size:0.7rem;margin-top:2px">${esc(dl.address||'')} ${dl.city||dl.state?'· ':''}${esc(dl.city||'')}${dl.city&&dl.state?', ':''}${esc(dl.state||'')}</div>
          <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-dim);margin-top:2px">${esc(keyVal)}</div>
        </div>
        <button type="button" class="drawer-door-check unassigned-check" onclick="event.stopPropagation();toggleDrawerCheckbox(this.closest('.drawer-door-row').querySelector('.drawerAddChk'))">✓</button>
      </div>`;
    });
    html+='</div>';
  }else{
    html+='<div class="helper-text" style="padding:10px 0;border-bottom:1px solid var(--border)">All known doors for this retailer are already assigned to this brand.</div>';
  }
  html+='</div>';

  const noteKey='note_'+ak;
  const existingNote=window._storeNotes&&window._storeNotes[noteKey]||'';
  html+=`<div style="margin-top:2px"><label style="display:block;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:4px">Notes</label>
  <textarea style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-xs);font-family:var(--font-body);font-size:0.78rem;color:var(--text);resize:vertical;min-height:60px;outline:none" placeholder="Add notes for ${esc(brand)} at ${esc(ret)}…" onchange="${jsAttr(`saveStoreNote(${jsq(noteKey)},this.value)`)}">${esc(existingNote)}</textarea></div>`;
  html+=`<div class="drawer-commit-bar">
    <button class="btn" onclick="${callAttr('openHistoryDrawer',ret,brand)}">⟳ History</button>
    <button class="btn btn-accent" id="drawerBottomCommitBtn" onclick="${callAttr('commitDrawerChanges',ret,brand)}" disabled>Commit Change</button>
  </div>`;
  html+='</div>';

  document.getElementById('drContent').innerHTML=html;
  document.getElementById('ovDraw').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  resetDrawerPendingChanges();
  filterDrawerDoors();
}

function publishFromDrawer(ret,brand,idx){
  publishDraft(ret,brand,idx);
  openStoreDrawer(ret,brand);
}


let drawerPendingAdds = [];
let drawerPendingRemoves = [];
let drawerPendingMode = 'confirmed';
let drawerPendingRemoveMode = 'closed';
let activeStoreDrawer = null;

function syncDrawerDoorChecks(){
  document.querySelectorAll('.drawer-door-row[data-door-row]').forEach(row=>{
    const addChk=row.querySelector('.drawerAddChk');
    const removeChk=row.querySelector('.drawerRemoveChk');
    if(addChk) row.classList.toggle('selected', addChk.checked);
    if(removeChk) row.classList.toggle('selected', removeChk.checked);
  });
  updateDrawerSelectionButtons();
}
function onDrawerRowClick(e, kind){
  if(e.target.closest('button')||e.target.closest('select')||e.target.tagName==='INPUT') return;
  const row=e.currentTarget;
  const chk=row.querySelector(kind==='add'?'.drawerAddChk':'.drawerRemoveChk');
  if(chk){ chk.checked=!chk.checked; syncDrawerDoorChecks(); collectDrawerPendingAdds(); }
}
function toggleDrawerCheckbox(chk){
  if(!chk) return;
  chk.checked=!chk.checked;
  syncDrawerDoorChecks();
  collectDrawerPendingAdds();
}
function filterDrawerDoors(){
  const input=document.getElementById('drawerDoorSearch');
  const q=(input?.value||'').trim().toLowerCase();
  ['drawerAssignedList','drawerUnassignedList'].forEach(listId=>{
    const list=document.getElementById(listId);
    if(!list) return;
    const rows=[...list.querySelectorAll('.drawer-door-row[data-door-row]')];
    let shown=0;
    rows.forEach(row=>{
      const match=!q || (row.dataset.search||row.textContent||'').toLowerCase().includes(q);
      row.style.display=match?'flex':'none';
      if(match) shown++;
    });
    let empty=list.querySelector('.drawer-door-empty');
    if(!empty){
      empty=document.createElement('div');
      empty.className='drawer-door-empty';
      empty.textContent='No doors match this search.';
      list.appendChild(empty);
    }
    empty.style.display=(q && !shown) ? 'block' : 'none';
  });
  updateDrawerSelectionButtons();
}
function refreshDataPillDropdowns(scope){
  if(!scope) scope=document;
  scope.querySelectorAll('select.data-pill-select').forEach(el=>{
    el.classList.remove('status-confirmed','status-tbd','status-na','status-closed','grade-a','grade-b','grade-c','grade-none');
    if(el.classList.contains('statusSel')){
      const v=el.value.toLowerCase();
      if(v==='confirmed') el.classList.add('status-confirmed');
      else if(v==='tbd') el.classList.add('status-tbd');
      else if(v==='closed') el.classList.add('status-closed');
      else el.classList.add('status-na');
    }else if(el.classList.contains('gradeSel')){
      const v=el.value.toUpperCase();
      if(v==='A') el.classList.add('grade-a');
      else if(v==='B') el.classList.add('grade-b');
      else if(v==='C') el.classList.add('grade-c');
      else el.classList.add('grade-none');
    }
  });
}


function resetDrawerPendingChanges(){
  drawerPendingAdds = [];
  drawerPendingRemoves = [];
  document.querySelectorAll('.drawerAddChk,.drawerRemoveChk').forEach(el => { el.checked = false; });
  const mode = document.getElementById('drawerAddMode');
  if(mode) drawerPendingMode = mode.value || 'confirmed';
  const removeMode = document.getElementById('drawerRemoveMode');
  if(removeMode) drawerPendingRemoveMode = removeMode.value || 'closed';
  syncDrawerDoorChecks();
  updateDrawerCommitState();
}
function updateDrawerCommitState(){
  const addBadge = document.getElementById('drawerCommitState');
  const assignedBadge = document.getElementById('drawerAssignedCommitState');
  const bottomBtn = document.getElementById('drawerBottomCommitBtn');
  const addCount = drawerPendingAdds.length;
  const removeCount = drawerPendingRemoves.length;
  const total = addCount + removeCount;
  const mode = document.getElementById('drawerAddMode');
  const modeLabel = mode ? (mode.value === 'tbd' ? 'TBD' : 'Assign') : 'Assign';
  const removeMode = document.getElementById('drawerRemoveMode');
  const removeModeLabel = removeMode ? (removeMode.value === 'tbd' ? 'TBD' : 'Exit') : 'Exit';
  let parts = [];
  if(addCount) parts.push(`${addCount} ${modeLabel}`);
  if(removeCount) parts.push(`${removeCount} ${removeModeLabel}`);
  if (addBadge) addBadge.textContent = total ? parts.join(' · ') : 'No pending changes';
  if (assignedBadge) assignedBadge.textContent = removeCount ? `${removeCount} ${removeModeLabel}` : 'No pending changes';
  if (bottomBtn) bottomBtn.disabled = total === 0;
  updateDrawerSelectionButtons();
}
function collectDrawerPendingAdds(){
  drawerPendingAdds = [...document.querySelectorAll('.drawerAddChk:checked')].map(el => String(el.value));
  drawerPendingRemoves = [...document.querySelectorAll('.drawerRemoveChk:checked')].map(el => String(el.value));
  const mode = document.getElementById('drawerAddMode');
  drawerPendingMode = mode ? mode.value : 'confirmed';
  const removeMode = document.getElementById('drawerRemoveMode');
  drawerPendingRemoveMode = removeMode ? removeMode.value : 'closed';
  updateDrawerCommitState();
}
function commitDrawerChanges(ret, brand){
  const addPicks = drawerPendingAdds.slice();
  const removePicks = drawerPendingRemoves.slice();
  if(!addPicks.length && !removePicks.length){ toast('Select at least one change.'); return; }
  const mode = drawerPendingMode || 'confirmed';
  const removeMode = drawerPendingRemoveMode || 'closed';
  let changed = 0;

  removePicks.forEach(val=>{
    const state = ensureDataKeyState(ret, val, brand);
    const oldStatus = normalizeStatus(state.status);
    state.status = removeMode === 'tbd' ? 'tbd' : 'closed';
    state.note = state.note || (removeMode === 'tbd' ? 'Moved to TBD from assigned doors list' : 'Exited from assigned doors list');
    syncAssignmentFromDataKey(ret, val, brand);
    recordHistory(ret,brand,{
      scope:'data',
      action: removeMode === 'tbd' ? 'tbd from assigned list' : 'exited from assigned list',
      oldVal: oldStatus,
      newVal: buildDataKey(ret,val,brand),
      doorNumber: val,
      user:currentUserName(),
      note: state.note
    });
    changed++;
  });

  addPicks.forEach(val=>{
    const state = ensureDataKeyState(ret, val, brand);
    const oldStatus = normalizeStatus(state.status);
    state.status = mode;
    state.note = state.note || (mode==='tbd' ? 'Under consideration from unassigned door list' : 'Confirmed from unassigned door list');
    syncAssignmentFromDataKey(ret, val, brand);
    recordHistory(ret,brand,{
      scope:'data',
      action: mode==='tbd' ? 'tbd from unassigned list' : 'confirmed from unassigned list',
      oldVal: oldStatus,
      newVal: buildDataKey(ret,val,brand),
      doorNumber: val,
      user:currentUserName(),
      note: state.note
    });
    changed++;
  });

  resetDrawerPendingChanges();
  populateFilters(); render(); openStoreDrawer(ret,brand);
  const msg = [];
  if(addPicks.length) msg.push(`${addPicks.length} ${mode==='tbd'?'TBD':'assigned'}`);
  if(removePicks.length) msg.push(`${removePicks.length} ${removeMode==='tbd'?'TBD':'exited'}`);
  toast(msg.length ? msg.join(' · ') : `Updated ${changed} door${changed===1?'':'s'}`);
}

function setDrawerDoorPanel(panel){
  const assigned=document.getElementById('drawerAssignedPanel');
  const unassigned=document.getElementById('drawerUnassignedPanel');
  const assignedBtn=document.getElementById('drawerAssignedToggle');
  const unassignedBtn=document.getElementById('drawerUnassignedToggle');
  const showAssigned=panel!=='unassigned';
  if(assigned) assigned.style.display=showAssigned?'block':'none';
  if(unassigned) unassigned.style.display=showAssigned?'none':'block';
  if(assignedBtn) assignedBtn.classList.toggle('active',showAssigned);
  if(unassignedBtn) unassignedBtn.classList.toggle('active',!showAssigned);
  filterDrawerDoors();
}

function toggleDrawerDoorSelection(kind){
  const selector = kind === 'remove' ? '.drawerRemoveChk' : '.drawerAddChk';
  const checks = [...document.querySelectorAll(selector)].filter(el=>el.closest('.drawer-door-row')?.style.display!=='none');
  if(!checks.length) return;
  const shouldSelect = !checks.every(el=>el.checked);
  checks.forEach(el=>{ el.checked=shouldSelect; });
  syncDrawerDoorChecks();
  collectDrawerPendingAdds();
}

function updateDrawerSelectionButtons(){
  const assignedBtn=document.getElementById('drawerAssignedSelectAllBtn');
  const unassignedBtn=document.getElementById('drawerUnassignedSelectAllBtn');
  if(assignedBtn){
    const checks=[...document.querySelectorAll('.drawerRemoveChk')].filter(el=>el.closest('.drawer-door-row')?.style.display!=='none');
    assignedBtn.textContent=checks.length && checks.every(el=>el.checked) ? 'Deselect All' : 'Select All';
  }
  if(unassignedBtn){
    const checks=[...document.querySelectorAll('.drawerAddChk')].filter(el=>el.closest('.drawer-door-row')?.style.display!=='none');
    unassignedBtn.textContent=checks.length && checks.every(el=>el.checked) ? 'Deselect All' : 'Select All';
  }
}



function saveStoreNote(key,val){if(!window._storeNotes) window._storeNotes={};window._storeNotes[key]=val;}

function removeAssignment(ret,brand,idx){
  const ak=k(ret,brand);
  const assigns=doorAssignments[ak];
  if(!assigns||!assigns[idx]) return;
  const removed=assigns[idx];
  const state = ensureDataKeyState(ret, removed.doorNumber, brand);
  const oldStatus = normalizeStatus(state.status);
  state.status = 'na';
  state.note = state.note || 'Unassigned from assigned doors list';
  syncAssignmentFromDataKey(ret, removed.doorNumber, brand);
  recordHistory(ret,brand,{
    scope:'data',
    action:'unassigned from assigned list',
    oldVal:oldStatus,
    newVal:buildDataKey(ret,removed.doorNumber,brand),
    doorNumber:removed.doorNumber,
    user:currentUserName(),
    note:state.note
  });
  render();
  openStoreDrawer(ret,brand);
  toast('Door unassigned');
}
function cellCtx(e,r,b){e.preventDefault();ctxTarget={r,b};const m=document.getElementById('ctxMenu');m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';m.style.display='block';}
document.addEventListener('click',()=>{document.getElementById('ctxMenu').style.display='none';});
function ctxE(){}
function ctxH(){if(ctxTarget)openHistoryDrawer(ctxTarget.r,ctxTarget.b);}
function ctxC(){if(ctxTarget)openCloseModal(ctxTarget.r,ctxTarget.b);}

let editT=null;
function setEditMode(mode){
  const addPanel=document.getElementById('editAddPanel');
  const removePanel=document.getElementById('editRemovePanel');
  const addBtn=document.getElementById('editModeAdd');
  const removeBtn=document.getElementById('editModeRemove');
  const hidden=document.getElementById('editMode');
  if(hidden) hidden.value=mode;
  if(addPanel) addPanel.style.display = mode==='add' ? 'block' : 'none';
  if(removePanel) removePanel.style.display = mode==='remove' ? 'block' : 'none';
  if(addBtn) addBtn.classList.toggle('active', mode==='add');
  if(removeBtn) removeBtn.classList.toggle('active', mode==='remove');
}
function openEditModal(r,b){
  editT={r,b};
  const confirmed=getConfirmedCount(r,b);
  const legacy=getLegacyCount(r,b);
  const rDoors=getRetailerDoors(r);
  const assigned=new Set(getAssignmentsFor(r,b).map(a=>String(a.doorNumber)));
  document.getElementById('editDesc').textContent=`${r} × ${b}${brandCodes[b]?' ('+brandCodes[b].name+')':''}`;
  document.getElementById('editCount').innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><span class="metric-chip">Verified: ${confirmed}</span><span class="metric-chip">Legacy total: ${legacy}</span><span class="metric-chip">Displayed total: ${getMatrixVal(r,b)}</span></div>
  <div class="helper-text">First choose whether you want to <strong>add</strong> or <strong>subtract</strong> doors, then select the specific doors to adjust.</div>
  <input type="hidden" id="editMode" value="add">
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    <button type="button" class="btn active" id="editModeAdd" onclick="setEditMode('add')">＋ Add Doors</button>
    <button type="button" class="btn" id="editModeRemove" onclick="setEditMode('remove')">－ Subtract Doors</button>
  </div>
  <div style="margin-top:12px">
    <div class="pick-panel" id="editAddPanel">
      <h4>Add available doors</h4>
      <div class="helper-text" style="margin-bottom:8px">Select the retailer door numbers you want to add for ${b} at ${r}.</div>
      <div class="pick-list" id="editAddList">${
        rDoors.filter(d=>!assigned.has(String(d.doorNumber))).length
          ? rDoors.filter(d=>!assigned.has(String(d.doorNumber))).map(d=>`<label class="pick-item"><input type="checkbox" class="editAddChk" value="${d.doorNumber}"><span><strong>#${d.doorNumber}</strong> — ${esc(d.name)} <span style="color:var(--text-dim)">(${esc(d.city)}, ${esc(d.state)})</span></span></label>`).join('')
          : '<div class="helper-text">No unassigned retailer doors remain.</div>'
      }</div>
    </div>
    <div class="pick-panel" id="editRemovePanel" style="display:none">
      <h4>Subtract existing assignments</h4>
      <div class="helper-text" style="margin-bottom:8px">Select the current retailer door numbers you want to remove for ${b} at ${r}.</div>
      <div class="pick-list" id="editRemoveList">${
        getAssignmentsFor(r,b).length
          ? getAssignmentsFor(r,b).map((a,i)=>`<label class="pick-item"><input type="checkbox" class="editRemoveChk" value="${i}"><span><strong>${a.doorNumber==='TBD'?'TBD':'#'+a.doorNumber}</strong> — ${esc(a.doorName||'')} <span class="status-badge ${a.status==='confirmed'?'confirmed':'draft'}">${a.status}</span></span></label>`).join('')
          : '<div class="helper-text">No explicit assignments on file.</div>'
      }</div>
    </div>
  </div>`;
  document.getElementById('ovEdit').classList.add('open');
  document.getElementById('mEdit').classList.add('open');
  setEditMode('add');
}
function closeEdit(){document.getElementById('ovEdit').classList.remove('open');document.getElementById('mEdit').classList.remove('open');editT=null;}
function saveEdit(){
  if(!editT)return;
  const {r,b}=editT;
  const user=currentUserName();
  const ak=k(r,b);
  if(!doorAssignments[ak]) doorAssignments[ak]=[];
  const mode=(document.getElementById('editMode')?.value)||'add';
  const removeIdx=mode==='remove'
    ? [...document.querySelectorAll('.editRemoveChk:checked')].map(el=>parseInt(el.value,10)).filter(v=>!Number.isNaN(v)).sort((a,b)=>b-a)
    : [];
  const addDoors=mode==='add'
    ? [...document.querySelectorAll('.editAddChk:checked')].map(el=>el.value)
    : [];
  let removed=0, added=0;
  removeIdx.forEach(idx=>{
    if(doorAssignments[ak][idx]){
      const removedDoor=doorAssignments[ak][idx];
      if(!history[ak]) history[ak]=[];
      history[ak].push({date:new Date().toISOString(),oldVal:removedDoor.doorNumber,newVal:'REMOVED',user,note:`Removed specific door assignment ${removedDoor.doorNumber}`});
      doorAssignments[ak].splice(idx,1);
      removed++;
    }
  });
  addDoors.forEach(doorVal=>{
    if(doorAssignments[ak].some(a=>String(a.doorNumber)===String(doorVal))) return;
    const di=getDoorInfo(r,doorVal);
    doorAssignments[ak].push({doorNumber:parseInt(doorVal,10),doorName:di?di.name:'',note:'',status:'draft',date:new Date().toISOString().slice(0,10)});
    if(!history[ak]) history[ak]=[];
    history[ak].push({date:new Date().toISOString(),oldVal:getMatrixVal(r,b),newVal:`DRAFT #${doorVal}`,user,note:`Added specific door assignment ${doorVal}`});
    added++;
  });
  closeEdit();populateFilters();updateViewSpecificControls();render();
  const verb = mode==='add' ? `Added ${added} door${added===1?'':'s'}` : `Subtracted ${removed} door${removed===1?'':'s'}`;
  toast(`${verb} for ${b} at ${r}`);
}

let closeT=null;
function openCloseModal(r,b){closeT={r,b};document.getElementById('closeDesc').textContent=`Mark ${r} × ${b} as closed`;document.getElementById('closeDate').value=new Date().toISOString().slice(0,10);document.getElementById('closeReason').value='';document.getElementById('ovClose').classList.add('open');document.getElementById('mClose').classList.add('open');}
function closeCM(){document.getElementById('ovClose').classList.remove('open');document.getElementById('mClose').classList.remove('open');closeT=null;}
function confirmClose(){
  if(!closeT)return;const{r,b}=closeT;
  let d=matrixData.find(x=>x.brand===b);if(!d){closeCM();return;}
  const ov=d[r]||0;d[r]=0;
  recordHistory(r,b,{
    scope:'data',
    action:'closed',
    oldVal:ov,
    newVal:'CLOSED',
    user:currentUserName(),
    note:document.getElementById('closeReason').value.trim()
  });
  queueAutosave();
  closeCM();render();toast(`${r} × ${b} closed`);
}

function openHistoryDrawer(r,b){
  activeStoreDrawer=null;
  window.__drawerRet=arguments[0]; window.__drawerBrand=arguments[1];
  const hk=k(r,b);const entries=history[hk]||[];
  document.getElementById('drTitle').textContent='Assignment & Data History';
  document.getElementById('drSub').textContent=`${r} × ${b}${brandCodes[b]?' — '+brandCodes[b].name:''}`;
  document.getElementById('drContent').innerHTML=entries.length?entries.slice().reverse().map(e=>`<div class="history-entry"><div class="history-date">${new Date(e.date).toLocaleString()}</div><div><span class="history-new">${esc((e.scope||'assignment').toUpperCase())}</span> · ${esc(e.action||'updated')}${e.doorNumber!==''?` · Door ${esc(String(e.doorNumber))}`:''}</div><div>${e.oldVal!==''||e.newVal!==''?`<span class="history-old">${esc(String(e.oldVal))}</span> → <span class="history-new">${esc(String(e.newVal))}</span>`:''}${e.note?' — '+esc(e.note):''}</div><div class="history-user">${esc(e.user||'System')}</div></div>`).join(''):'<p style="color:var(--text-dim);margin-top:16px">No assignment/data changes recorded.</p>';
  document.getElementById('ovDraw').classList.add('open');document.getElementById('drawer').classList.add('open');
}
function closeDrawer(){resetDrawerPendingChanges();activeStoreDrawer=null;window._drawerShowAllUnassigned=false;document.getElementById('ovDraw').classList.remove('open');document.getElementById('drawer').classList.remove('open');}

function closeAdd(){document.getElementById('ovAdd').classList.remove('open');document.getElementById('mAdd').classList.remove('open');}

function toggleSelectAll(selector, checked){
  document.querySelectorAll(selector).forEach(el=>{ el.checked=checked; });
}

async function openNewBrandPrompt(){
  const rawCode=window.fashionPrompt
    ? await window.fashionPrompt('Enter new brand code, for example CH.', { title:'New Brand Code', confirmLabel:'Next' })
    : prompt('Enter new brand code (for example CH):');
  const code=(rawCode||'').trim().toUpperCase();
  if(!code) return;
  const rawName=window.fashionPrompt
    ? await window.fashionPrompt('Enter brand name.', { title:'New Brand Name', confirmLabel:'Add' })
    : prompt('Enter brand name:');
  const name=(rawName||'').trim();
  if(!name){ toast('Brand name is required.'); return; }
  if(!brandCodes[code]) brandCodes[code]={name, ds_active:true};
  else { brandCodes[code].name=name || brandCodes[code].name; brandCodes[code].ds_active=true; }
  if(!matrixData.find(x=>x.brand===code)) matrixData.push({brand:code, category:'LUXURY'});
  ensureAllSlots();
  populateFilters();
  queueAutosave();
  render();
  toast(`Brand ${code} added.`);
  openAddModal();
}

async function openNewDoorPrompt(){
  const ret=document.getElementById('aRet').value;
  if(!ret){ toast('Select a retailer first.'); return; }
  const doorRaw=((window.fashionPrompt
    ? await window.fashionPrompt('Enter retailer-assigned door number.', { title:'New Door Number', confirmLabel:'Next' })
    : prompt('Enter retailer-assigned door number:'))||'').trim();
  if(!doorRaw) return;
  const name=((window.fashionPrompt
    ? await window.fashionPrompt('Enter door/store name.', { title:'Door Name', confirmLabel:'Next' })
    : prompt('Enter door/store name:'))||'').trim();
  if(!name){ toast('Door name is required.'); return; }
  const city=((window.fashionPrompt ? await window.fashionPrompt('Enter city.', { title:'Door City', confirmLabel:'Next' }) : prompt('Enter city:'))||'').trim();
  const state=((window.fashionPrompt ? await window.fashionPrompt('Enter state / province.', { title:'Door State', confirmLabel:'Next' }) : prompt('Enter state / province:'))||'').trim();
  const address=((window.fashionPrompt ? await window.fashionPrompt('Enter street address, optional.', { title:'Door Address', confirmLabel:'Next' }) : prompt('Enter street address (optional):'))||'').trim();
  const zip=((window.fashionPrompt ? await window.fashionPrompt('Enter ZIP / postal code, optional.', { title:'Door ZIP', confirmLabel:'Next' }) : prompt('Enter ZIP / postal code (optional):'))||'').trim();
  const latStr=((window.fashionPrompt ? await window.fashionPrompt('Enter latitude for the map, optional.', { title:'Door Latitude', confirmLabel:'Next' }) : prompt('Enter latitude for the map (optional):'))||'').trim();
  const lngStr=((window.fashionPrompt ? await window.fashionPrompt('Enter longitude for the map, optional.', { title:'Door Longitude', confirmLabel:'Next' }) : prompt('Enter longitude for the map (optional):'))||'').trim();
  const tier=((window.fashionPrompt ? await window.fashionPrompt('Enter tier, optional, e.g. A/B/C.', { title:'Door Tier', confirmLabel:'Add' }) : prompt('Enter tier (optional, e.g. A/B/C):'))||'').trim().toUpperCase();
  const norm=normalizeRetailer(ret);
  if(doorLocations.some(d=>normalizeRetailer(d.retailer)===norm && String(d.doorNumber)===doorRaw)){ toast('That door already exists for this retailer.'); return; }
  const doorNumber = /^\d+$/.test(doorRaw) ? parseInt(doorRaw,10) : doorRaw;
  doorLocations.push({retailer:norm,doorNumber,name,zip,tier,address,city,state,lat:latStr?parseFloat(latStr):undefined,lng:lngStr?parseFloat(lngStr):undefined});
  ensureAllSlots();
  populateFilters();
  queueAutosave();
  render();
  toast(`Door ${doorRaw} added for ${norm}.`);
  populateAddDoors();
  renderAddSelectionPanels();
}

function setAddMode(mode){
  addMode=mode;
  document.getElementById('modeDoorToBrands').classList.toggle('active',mode==='door_to_brands');
  document.getElementById('modeBrandToDoors').classList.toggle('active',mode==='brand_to_doors');
  document.getElementById('modeDeleteDoor').classList.toggle('active',mode==='delete_door');
  document.getElementById('doorToBrandsWrap').style.display=mode==='door_to_brands'?'block':'none';
  document.getElementById('brandToDoorsWrap').style.display=mode==='brand_to_doors'?'block':'none';
  document.getElementById('deleteDoorWrap').style.display=mode==='delete_door'?'block':'none';
  const hint=document.getElementById('modifyDoorStepHint');
  if(hint){
    const intent=mode==='delete_door'?'delete a door':(mode==='brand_to_doors'?'add a brand to doors':'add a new door assignment');
    hint.textContent=`Step 1: ${intent}. Step 2: choose retailer. Step 3: choose ${mode==='brand_to_doors'?'brand and doors':(mode==='delete_door'?'door to delete':'door and brands')}.`;
  }
  const submit=document.getElementById('modifyDoorSubmitBtn');
  if(submit){
    submit.textContent=mode==='delete_door'?'Delete Door':'Add as Draft';
    submit.classList.toggle('btn-draft',mode!=='delete_door');
    submit.style.borderColor=mode==='delete_door'?'var(--danger)':'';
    submit.style.color=mode==='delete_door'?'var(--danger)':'';
  }
  renderAddSelectionPanels();
}

function renderAddSelectionPanels(){
  const ret=document.getElementById('aRet').value;
  const brandList=document.getElementById('aBrandMulti');
  const doorList=document.getElementById('aDoorMulti');
  const doorCurrent=document.getElementById('aDoorCurrent');
  const brandCurrent=document.getElementById('aBrandCurrent');
  const delDoorCurrent=document.getElementById('delDoorCurrent');
  if(!brandList||!doorList||!doorCurrent||!brandCurrent||!delDoorCurrent) return;
  brandList.innerHTML=''; doorList.innerHTML=''; doorCurrent.innerHTML=''; brandCurrent.innerHTML=''; delDoorCurrent.innerHTML='';
  if(!ret){
    const msg='<div class="helper-text">Select a retailer first.</div>';
    brandList.innerHTML=msg; doorList.innerHTML=msg; doorCurrent.innerHTML=msg; brandCurrent.innerHTML=msg; delDoorCurrent.innerHTML=msg;
    return;
  }

  const dsB=Object.entries(brandCodes).filter(([c,v])=>v.ds_active).sort((a,b)=>a[0].localeCompare(b[0]));
  dsB.forEach(([c,v])=>{
    brandList.innerHTML+=`<label class="pick-item"><input type="checkbox" class="aBrandChk" value="${c}"><span><strong>${c}</strong> — ${esc(v.name)}</span></div>`;
  });

  const doors=getRetailerDoors(ret);
  if(!doors.length){
    doorList.innerHTML='<div class="helper-text">No retailer doors found.</div>';
  }else{
    doors.forEach(d=>{
      doorList.innerHTML+=`<label class="pick-item"><input type="checkbox" class="aDoorChk" value="${d.doorNumber}"><span><strong>#${d.doorNumber}</strong> — ${esc(d.name)} <span style="color:var(--text-dim)">(${esc(d.city)}, ${esc(d.state)})</span></span></div>`;
    });
  }

  const selectedDoor=document.getElementById('aDoor').value;
  if(selectedDoor){
    const brandsAtDoor=getBrandsAtDoor(ret,selectedDoor);
    if(brandsAtDoor.length){
      brandsAtDoor.forEach(b=>{
        doorCurrent.innerHTML+=`<div class="pick-item"><span><strong>${esc(b.brand)}</strong> <span class="status-badge ${b.status==='confirmed'?'confirmed':'draft'}">${b.status}</span></span></div>`;
      });
    }else{
      doorCurrent.innerHTML='<div class="helper-text">No brands currently assigned to this door.</div>';
    }
  }else{
    doorCurrent.innerHTML='<div class="helper-text">Select a door to inspect current brand assignments.</div>';
  }

  const selectedBrand=document.getElementById('aBrand').value;
  if(selectedBrand){
    const assignments=getAssignmentsFor(ret,selectedBrand).slice().sort((a,b)=>String(a.doorNumber).localeCompare(String(b.doorNumber)));
    if(assignments.length){
      assignments.forEach(a=>{
        brandCurrent.innerHTML+=`<div class="pick-item"><span><strong>${a.doorNumber==='TBD'?'TBD':'#'+esc(String(a.doorNumber))}</strong> — ${esc(a.doorName||'')} <span class="status-badge ${a.status==='confirmed'?'confirmed':'draft'}">${a.status}</span></span></div>`;
      });
    }else{
      brandCurrent.innerHTML='<div class="helper-text">No doors currently assigned to this brand at this retailer.</div>';
    }
  }else{
    brandCurrent.innerHTML='<div class="helper-text">Select a brand to inspect current door assignments.</div>';
  }

  const selectedDeleteDoor=document.getElementById('delDoor').value;
  if(selectedDeleteDoor){
    const brandsAtDeleteDoor=getBrandsAtDoor(ret,selectedDeleteDoor);
    if(brandsAtDeleteDoor.length){
      brandsAtDeleteDoor.forEach(b=>{
        delDoorCurrent.innerHTML+=`<div class="pick-item"><span><strong>${esc(b.brand)}</strong> <span class="status-badge ${b.status==='confirmed'?'confirmed':'draft'}">${b.status}</span></span></div>`;
      });
    }else{
      delDoorCurrent.innerHTML='<div class="helper-text">No brand assignments are tied to this door.</div>';
    }
  }else{
    delDoorCurrent.innerHTML='<div class="helper-text">Select a door to preview affected assignments.</div>';
  }
}

function populateAddDoors(){
  const ret=document.getElementById('aRet').value;
  const doorSel=document.getElementById('aDoor');
  const delDoorSel=document.getElementById('delDoor');
  const norm=normalizeRetailer(ret);
  const rDoors=doorLocations.filter(d=>normalizeRetailer(d.retailer)===norm);
  doorSel.innerHTML='<option value="">— Select a door —</option><option value="TBD">TBD — Not yet confirmed</option>';
  if(delDoorSel) delDoorSel.innerHTML='<option value="">— Select a door —</option>';
  rDoors.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  rDoors.forEach(d=>{
    const opt=`<option value="${esc(String(d.doorNumber))}">#${esc(String(d.doorNumber))} — ${esc(d.name)} (${esc(d.city)}, ${esc(d.state)})</option>`;
    doorSel.innerHTML+=opt;
    if(delDoorSel) delDoorSel.innerHTML+=opt;
  });
}

async function addEntry(){
  if(addMode==='delete_door'){ await deleteDoorFromModify(); return; }
  const ret=document.getElementById('aRet').value;
  const note=document.getElementById('aNote').value.trim();
  if(!ret){toast('Retailer is required.');return;}
  const norm=normalizeRetailer(ret);

  let pairs=[];
  if(addMode==='door_to_brands'){
    const doorVal=document.getElementById('aDoor').value;
    const brands=[...document.querySelectorAll('.aBrandChk:checked')].map(el=>el.value);
    if(!doorVal){toast('Door selection is required.');return;}
    if(!brands.length){toast('Select at least one brand.');return;}
    brands.forEach(brand=>pairs.push({brand,doorVal}));
  }else{
    const brand=document.getElementById('aBrand').value;
    const doorVals=[...document.querySelectorAll('.aDoorChk:checked')].map(el=>el.value);
    if(!brand){toast('Brand selection is required.');return;}
    if(!doorVals.length){toast('Select at least one door.');return;}
    doorVals.forEach(doorVal=>pairs.push({brand,doorVal}));
  }

  let added=0, skipped=0;
  pairs.forEach(({brand,doorVal})=>{
    const isTBD=doorVal==='TBD';
    const doorNum=isTBD?'TBD':parseInt(doorVal);
    let doorName='TBD';
    if(!isTBD){
      const di=getDoorInfo(norm,doorNum);
      if(di) doorName=di.name;
    }
    const ak=k(norm,brand);
    if(!doorAssignments[ak]) doorAssignments[ak]=[];
    if(!isTBD && doorAssignments[ak].some(a=>String(a.doorNumber)===String(doorNum))){
      skipped++;
      return;
    }
    doorAssignments[ak].push({doorNumber:doorNum,doorName,note,status:'draft',date:new Date().toISOString().slice(0,10)});
    if(!isTBD){
      recordHistory(norm,brand,{
        scope:'assignment',
        action:'added draft',
        oldVal:'',
        newVal:buildDataKey(norm,doorNum,brand),
        doorNumber:doorNum,
        user:currentUserName(),
        note:note||'Added from Modify Door'
      });
    }
    let d=matrixData.find(x=>x.brand===brand);
    if(!d){
      d={brand,category:'LUXURY'};
      matrixData.push(d);
    }
    if(!retailers.includes(norm)) retailers.push(norm);
    added++;
  });

  populateFilters();
  render();
  renderAddSelectionPanels();
  if(added){
    toast(`Added ${added} draft ${added===1?'assignment':'assignments'}${skipped?` • ${skipped} skipped as duplicates`:''}`);
    closeAdd();
  }else{
    toast(skipped?'Everything selected was already assigned.':'No assignments were added.');
  }
}

async function deleteDoorFromModify(){
  const ret=document.getElementById('aRet').value;
  const doorVal=document.getElementById('delDoor').value;
  const note=document.getElementById('aNote').value.trim();
  if(!ret){ toast('Retailer is required.'); return; }
  if(!doorVal){ toast('Door selection is required.'); return; }
  const norm=normalizeRetailer(ret);
  const door=doorLocations.find(d=>normalizeRetailer(d.retailer)===norm && String(d.doorNumber)===String(doorVal));
  if(!door){ toast('Door not found.'); return; }
  const affected=[];
  for(const [key,assigns] of Object.entries(doorAssignments)){
    const [r,b]=key.split('|');
    if(r!==norm) continue;
    assigns.forEach(a=>{
      if(String(a.doorNumber)===String(doorVal)) affected.push({brand:b,status:a.status,doorName:a.doorName||door.name||''});
    });
  }
  const label=`#${door.doorNumber} — ${door.name || '(no name)'}`;
  const msg=`Delete ${label} from ${norm}? This will remove ${affected.length} brand assignment${affected.length===1?'':'s'} tied to this door.`;
  const confirmed=window.fashionConfirm
    ? await window.fashionConfirm(msg, { title:'Delete Door', confirmLabel:'Delete' })
    : confirm(msg);
  if(!confirmed) return;

  doorLocations=doorLocations.filter(d=>!(normalizeRetailer(d.retailer)===norm && String(d.doorNumber)===String(doorVal)));
  for(const [key,assigns] of Object.entries(doorAssignments)){
    const [r,b]=key.split('|');
    if(r!==norm) continue;
    const kept=assigns.filter(a=>String(a.doorNumber)!==String(doorVal));
    if(kept.length!==assigns.length){
      doorAssignments[key]=kept;
      recordHistory(norm,b,{
        scope:'door',
        action:'door deleted',
        oldVal:buildDataKey(norm,doorVal,b),
        newVal:'DELETED',
        doorNumber:doorVal,
        user:currentUserName(),
        note:note || `Deleted ${label} from Modify Door`
      });
    }
  }
  Object.keys(dataKeyState).forEach(key=>{
    const st=dataKeyState[key] || {};
    if(normalizeRetailer(st.retailer)===norm && String(st.doorNumber)===String(doorVal)) delete dataKeyState[key];
  });

  populateFilters();
  populateAddDoors();
  render();
  renderAddSelectionPanels();
  queueAutosave();
  toast(`Deleted ${label} from ${norm}.`);
}

function openAddModal(){
  const el=document.getElementById('aRet');
  el.innerHTML='<option value="">— Select retailer —</option>';
  const allRet=[...new Set([...retailers,...doorLocations.map(d=>normalizeRetailer(d.retailer))])].sort();
  allRet.forEach(r=>{el.innerHTML+=`<option value="${esc(r)}">${esc(r)}</option>`;});
  const bel=document.getElementById('aBrand');
  bel.innerHTML='<option value="">— Select brand —</option>';
  const dsB=Object.entries(brandCodes).filter(([c,v])=>v.ds_active).sort((a,b)=>a[0].localeCompare(b[0]));
  dsB.forEach(([c,v])=>{bel.innerHTML+=`<option value="${c}">${c} — ${esc(v.name)}</option>`;});
  document.getElementById('aNote').value='';
  document.getElementById('aDoor').innerHTML='<option value="">— Select retailer first —</option><option value="TBD">TBD — Not yet confirmed</option>';
  document.getElementById('delDoor').innerHTML='<option value="">— Select retailer first —</option>';
  document.getElementById('ovAdd').classList.add('open');
  document.getElementById('mAdd').classList.add('open');
  setAddMode('door_to_brands');
  renderAddSelectionPanels();
}

// Info modal
function openInfoModal(){
  populateInfoRetailerCoverage();
  document.getElementById('ovInfo').classList.add('open');
  document.getElementById('mInfo').classList.add('open');
}
function closeInfo(){document.getElementById('ovInfo').classList.remove('open');document.getElementById('mInfo').classList.remove('open');}
document.querySelectorAll('#mInfo .info-modal-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('#mInfo .info-modal-tab').forEach(t=>t.classList.toggle('active', t===tab));
    document.querySelectorAll('#mInfo .info-modal-pane').forEach(p=>p.classList.toggle('active', p.id==='modal-tab-'+tab.dataset.tab));
  });
});

/* Populate the Info modal's coverage table from live state. Lists every
   retailer that has either brand activity or door records, sorted by total
   doors descending. Counts brands with non-zero confirmed assignments. */
function populateInfoRetailerCoverage(){
  const host=document.getElementById('infoRetailerCoverage');
  if(!host) return;
  /* One pass to count doors per retailer. */
  const doorsByRetailer=new Map();
  for(const d of doorLocations){
    const r=normalizeRetailer(d.retailer);
    if(!doorsByRetailer.has(r)) doorsByRetailer.set(r,new Set());
    doorsByRetailer.get(r).add(String(d.doorNumber));
  }
  /* Union of matrix retailers and any retailers seen only in door records. */
  const allRetailers=new Set([...retailers.map(normalizeRetailer), ...doorsByRetailer.keys()]);
  const allBrands=getAllBrands();
  const rows=Array.from(allRetailers).map(r=>{
    const doors=(doorsByRetailer.get(r)||new Set()).size;
    let brands=0;
    allBrands.forEach(b=>{ if(getTotalConfirmedForRetailer(r,b)>0) brands++; });
    return { retailer:r, brands, doors };
  }).filter(x=>x.doors>0||x.brands>0)
    .sort((a,b)=>b.doors-a.doors||b.brands-a.brands||a.retailer.localeCompare(b.retailer));
  if(!rows.length){
    host.innerHTML='<span style="color:var(--text-dim)">No retailers yet — import a matrix file or door-location file to populate.</span>';
    return;
  }
  host.innerHTML=rows.map(r=>{
    const brandText=`${r.brands} brand${r.brands===1?'':'s'}`;
    const doorText=`${r.doors.toLocaleString()} door${r.doors===1?'':'s'}`;
    return `<div><strong style="color:var(--text);font-family:var(--font-body);font-weight:600">${esc(r.retailer)}</strong>: <span style="color:var(--accent)">${brandText}</span> / <span style="color:var(--accent)">${doorText}</span></div>`;
  }).join('');
}

function openImportModal(){document.getElementById('ovImport').classList.add('open');document.getElementById('mImport').classList.add('open');}
function closeImport(){document.getElementById('ovImport').classList.remove('open');document.getElementById('mImport').classList.remove('open');}
function closeHeaderMenus(){
  document.querySelectorAll('.header-menu.open').forEach(menu=>{
    menu.classList.remove('open');
    const btn=menu.querySelector('.menu-trigger');
    if(btn) btn.setAttribute('aria-expanded','false');
  });
}
function toggleHeaderMenu(id){
  const menu=document.getElementById(id);
  if(!menu) return;
  const wasOpen=menu.classList.contains('open');
  closeHeaderMenus();
  menu.classList.toggle('open', !wasOpen);
  const btn=menu.querySelector('.menu-trigger');
  if(btn) btn.setAttribute('aria-expanded', wasOpen?'false':'true');
}
function closeRefinePanel(){
  const wrap=document.getElementById('refineWrap');
  if(!wrap) return;
  wrap.classList.remove('open');
  document.body.classList.remove('refine-open');
  const btn=wrap.querySelector('button');
  if(btn){
    btn.setAttribute('aria-expanded','false');
    btn.classList.remove('active');
  }
}
function toggleRefinePanel(){
  const wrap=document.getElementById('refineWrap');
  if(!wrap) return;
  const open=!wrap.classList.contains('open');
  wrap.classList.toggle('open',open);
  document.body.classList.toggle('refine-open',open);
  const btn=wrap.querySelector('button');
  if(btn){
    btn.setAttribute('aria-expanded',open?'true':'false');
    btn.classList.toggle('active',open);
  }
}
function handleDrop(e){e.preventDefault();e.currentTarget.classList.remove('dragover');const f=e.dataTransfer.files[0];if(f)processImp(f);}
function handleImpFile(e){const f=e.target.files[0];if(f)processImp(f);e.target.value='';}
function handleDoorDrop(e){e.preventDefault();e.currentTarget.classList.remove('dragover');const f=e.dataTransfer.files[0];if(f)processDoorImp(f);}
function handleImpDoorFile(e){const f=e.target.files[0];if(f)processDoorImp(f);e.target.value='';}
function workbookRows(wb, preferredSheet){
  const sheetName=wb.SheetNames.find(n=>String(n).toLowerCase()===String(preferredSheet).toLowerCase()) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
}
function isSheetJsReady(){
  if(typeof XLSX!=='undefined') return true;
  toast('Spreadsheet tools are unavailable. Reload the page and try again.');
  return false;
}
function getTemplateDemoRows(){
  return {
    matrixRows:[
      {Retailer:'Retailer A',Brand:'BR-A',Category:'LIFESTYLE',Doors:2,'Door Number':101,Status:'confirmed',Grade:'A',Gender:'ALL',metric_1:128,metric_2:0.62,Notes:'Example: units and sell-through'},
      {Retailer:'Retailer A',Brand:'BR-A',Category:'LIFESTYLE',Doors:2,'Door Number':102,Status:'confirmed',Grade:'B',Gender:'Mens Only',metric_1:74,metric_2:0.48,Notes:'Example: units and sell-through'},
      {Retailer:'Retailer B',Brand:'BR-A',Category:'LIFESTYLE',Doors:1,'Door Number':201,Status:'confirmed',Grade:'A',Gender:'Ladies Only',metric_1:92,metric_2:0.55,Notes:'Example: units and sell-through'},
      {Retailer:'Retailer A',Brand:'BR-B',Category:'PREMIUM',Doors:1,'Door Number':101,Status:'confirmed',Grade:'A',Gender:'ALL',metric_1:43,metric_2:0.34,Notes:'Example: units and sell-through'},
      {Retailer:'Retailer C',Brand:'BR-C',Category:'SPORT',Doors:2,'Door Number':301,Status:'confirmed',Grade:'A',Gender:'ALL',metric_1:156,metric_2:0.71,Notes:'Example: units and sell-through'},
      {Retailer:'Retailer C',Brand:'BR-C',Category:'SPORT',Doors:2,'Door Number':302,Status:'confirmed',Grade:'B',Gender:'Mens Only',metric_1:88,metric_2:0.53,Notes:'Example: units and sell-through'},
      {Retailer:'Retailer B',Brand:'BR-C',Category:'SPORT',Doors:1,'Door Number':202,Status:'confirmed',Grade:'B',Gender:'ALL',metric_1:67,metric_2:0.41,Notes:'Example: units and sell-through'}
    ],
    doorRows:[
      {Retailer:'Retailer A','Door Number':101,Name:'Example Store 101',Address:'100 Main St',City:'New York',State:'NY',ZIP:'10001',Lat:40.7505,Lng:-73.9965,Tier:'A'},
      {Retailer:'Retailer A','Door Number':102,Name:'Example Store 102',Address:'200 Market St',City:'Los Angeles',State:'CA',ZIP:'90015',Lat:34.0407,Lng:-118.2468,Tier:'B'},
      {Retailer:'Retailer A','Door Number':103,Name:'Example Store 103',Address:'300 Harbor Dr',City:'San Diego',State:'CA',ZIP:'92101',Lat:32.7157,Lng:-117.1611,Tier:'C'},
      {Retailer:'Retailer B','Door Number':201,Name:'Example Store 201',Address:'400 Lake St',City:'Chicago',State:'IL',ZIP:'60601',Lat:41.8853,Lng:-87.6216,Tier:'A'},
      {Retailer:'Retailer B','Door Number':202,Name:'Example Store 202',Address:'500 Congress Ave',City:'Austin',State:'TX',ZIP:'78701',Lat:30.2672,Lng:-97.7431,Tier:'B'},
      {Retailer:'Retailer C','Door Number':301,Name:'Example Store 301',Address:'600 Biscayne Blvd',City:'Miami',State:'FL',ZIP:'33132',Lat:25.7781,Lng:-80.1868,Tier:'A'},
      {Retailer:'Retailer C','Door Number':302,Name:'Example Store 302',Address:'700 Peachtree St',City:'Atlanta',State:'GA',ZIP:'30308',Lat:33.7711,Lng:-84.3877,Tier:'B'}
    ]
  };
}
function reconcileMatrixTotalsFromDoors(){
  matrixData.forEach(row=>{
    const brand=row.brand;
    if(!brand) return;
    retailers.forEach(ret=>{
      const target=parseInt(row[ret]||0,10)||0;
      if(target<=0) return;
      const hasExplicitDoorMetrics=Object.keys(dataKeyState).some(key=>{
        const s=dataKeyState[key];
        return s && normalizeRetailer(s.retailer)===normalizeRetailer(ret) && s.brand===brand && (s.metric_1!==undefined || s.metric_2!==undefined || s.note);
      });
      if(hasExplicitDoorMetrics) return;
      const doors=getRetailerDoors(ret);
      let confirmed=getConfirmedCount(ret,brand);
      for(const door of doors){
        if(confirmed>=target) break;
        const state=ensureDataKeyState(ret,door.doorNumber,brand);
        if(normalizeStatus(state.status)==='na'){
          state.status='confirmed';
          state.grade=state.grade || door.tier || '-';
          state.note=state.note || 'Created from matrix import total';
          syncAssignmentFromDataKey(ret,door.doorNumber,brand);
          confirmed++;
        }
      }
    });
  });
}
async function startExternalWorkspace(){
  window._doorTrackerBlankGuest=true;
  currentUser={ username:'guest', name:'External Guest', isGuest:true };
  saveSession();
  try{ await withStore(STORE_LATEST,'readwrite',s=>reqAsPromise(s.delete(GUEST_SAVE_KEY))); }catch(e){}
  hideLoginModal();
  updateUserChip();
  await bootApp();
}
async function processLoginImport(file, kind){
  if(!file) return;
  await startExternalWorkspace();
  if(kind==='door') processDoorImp(file);
  else processImp(file);
}
function handleLoginMatrixDrop(e){e.preventDefault();e.currentTarget.classList.remove('dragover');processLoginImport(e.dataTransfer.files[0],'matrix');}
function handleLoginMatrixFile(e){const f=e.target.files[0];processLoginImport(f,'matrix');e.target.value='';}
function handleLoginDoorDrop(e){e.preventDefault();e.currentTarget.classList.remove('dragover');processLoginImport(e.dataTransfer.files[0],'door');}
function handleLoginDoorFile(e){const f=e.target.files[0];processLoginImport(f,'door');e.target.value='';}
function hasWorkbookSheet(wb, sheetName){
  return wb.SheetNames.some(n=>String(n).toLowerCase()===String(sheetName).toLowerCase());
}
function importMatrixRows(rows){
  let n=0;
  rows.forEach(row=>{
    const ret=row.Retailer||row.retailer||'';
    const brand=(row.Brand||row.brand||'').toUpperCase();
    if(!ret||!brand)return;
    let d=matrixData.find(x=>x.brand===brand);
    if(!d){d={brand,category:row.Category||row.category||'LUXURY'};matrixData.push(d);}
    if(!brandCodes[brand]) brandCodes[brand]={name:row['Brand Name']||row.brandName||brand,ds_active:true};
    d[ret]=parseInt(row.Doors||row.doors||0)||0;
    if(!retailers.includes(ret))retailers.push(ret);
    const doorRaw=row['Door Number']||row.door_number||row.DoorNumber||row.Door||'';
    if(doorRaw!=='' && doorRaw!==null && doorRaw!==undefined){
      const state=ensureDataKeyState(ret,doorRaw,brand);
      const status=row.Status||row.status;
      if(status) state.status=normalizeStatus(status);
      if(row.Grade||row.grade) state.grade=row.Grade||row.grade;
      if(row.Gender!==undefined || row.gender!==undefined) state.gender=normalizeGender(row.Gender ?? row.gender);
      if(row.Note||row.Notes||row.note) state.note=row.Note||row.Notes||row.note;
      if(row.metric_1!==undefined || row.Metric_1!==undefined || row['Metric 1']!==undefined) state.metric_1=row.metric_1 ?? row.Metric_1 ?? row['Metric 1'] ?? '';
      if(row.metric_2!==undefined || row.Metric_2!==undefined || row['Metric 2']!==undefined) state.metric_2=row.metric_2 ?? row.Metric_2 ?? row['Metric 2'] ?? '';
      syncAssignmentFromDataKey(ret,doorRaw,brand);
    }
    n++;
  });
  return n;
}
function importDoorRows(rows){
  const pick=(row, keys)=>{ for(const k of keys){ const v=row[k]; if(v!==undefined && v!==null && v!=='') return v; } return ''; };
  let added=0, updated=0, skipped=0;
  rows.forEach(row=>{
    const retRaw=pick(row,['Retailer','retailer','RETAILER']);
    const doorRaw=pick(row,['Door Number','Door No','Door#','Door','Number','door','door_number','DoorNumber']);
    const name=String(pick(row,['Name','Door Name','Store Name','name'])||'').trim();
    if(!retRaw || (!doorRaw && doorRaw!==0)){ skipped++; return; }
    const ret=normalizeRetailer(String(retRaw).trim());
    const doorRawStr=String(doorRaw).trim();
    const doorNumber=/^\d+$/.test(doorRawStr)?parseInt(doorRawStr,10):doorRawStr;
    const address=String(pick(row,['Address','address','Street','Street Address'])||'').trim();
    const city=String(pick(row,['City','city'])||'').trim();
    const state=String(pick(row,['State','state','Province'])||'').trim();
    const zip=String(pick(row,['ZIP','Zip','zip','Postal','Postal Code'])||'').trim();
    const latRaw=pick(row,['Lat','lat','Latitude','latitude']);
    const lngRaw=pick(row,['Lng','lng','Lon','Longitude','longitude']);
    const lat=latRaw===''?undefined:parseFloat(latRaw);
    const lng=lngRaw===''?undefined:parseFloat(lngRaw);
    const tier=String(pick(row,['Tier','tier','Grade','grade'])||'').trim().toUpperCase();
    const existing=doorLocations.find(d=>normalizeRetailer(d.retailer)===ret && String(d.doorNumber)===String(doorNumber));
    if(existing){
      if(name) existing.name=name;
      if(address) existing.address=address;
      if(city) existing.city=city;
      if(state) existing.state=state;
      if(zip) existing.zip=zip;
      if(!Number.isNaN(lat) && lat!==undefined) existing.lat=lat;
      if(!Number.isNaN(lng) && lng!==undefined) existing.lng=lng;
      if(tier) existing.tier=tier;
      updated++;
    }else{
      doorLocations.push({retailer:ret,doorNumber,name:name||`Door ${doorNumber}`,address,city,state,zip,lat:Number.isNaN(lat)?undefined:lat,lng:Number.isNaN(lng)?undefined:lng,tier});
      if(!retailers.includes(ret)) retailers.push(ret);
      added++;
    }
  });
  return {added,updated,skipped};
}
function finishImport(){
  ensureAllSlots();
  reconcileMatrixTotalsFromDoors();
  closeImport();
  populateFilters();
  updateViewSpecificControls();
  render();
  queueAutosave();
}
function processImp(file){
  if(!isSheetJsReady()) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const n=importMatrixRows(workbookRows(wb,'Matrix'));
      let doorSummary=null;
      if(hasWorkbookSheet(wb,'Door Locations')) doorSummary=importDoorRows(workbookRows(wb,'Door Locations'));
      finishImport();
      toast(doorSummary?`Imported ${n} matrix entries and ${doorSummary.added+doorSummary.updated} door locations`:`Imported ${n} matrix entries`);
    }catch(err){toast('Error: '+err.message);}
  };
  reader.readAsArrayBuffer(file);
}

function processDoorImp(file){
  if(!isSheetJsReady()) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const {added,updated,skipped}=importDoorRows(workbookRows(wb,'Door Locations'));
      let matrixCount=0;
      if(hasWorkbookSheet(wb,'Matrix')) matrixCount=importMatrixRows(workbookRows(wb,'Matrix'));
      finishImport();
      const parts=[];
      if(added) parts.push(`${added} added`);
      if(updated) parts.push(`${updated} updated`);
      if(skipped) parts.push(`${skipped} skipped`);
      if(matrixCount) parts.push(`${matrixCount} matrix entries`);
      toast(parts.length?`Door locations: ${parts.join(', ')}`:'No rows found — check the column headers.');
    }catch(err){toast('Error: '+err.message);}
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════════════
// EXPORT / PERSISTENCE
// ═══════════════════════════════════════════════════════
function downloadJSON(){
  const payload={brandCodes,doorLocations,matrixData,retailers,history,doorAssignments,dataKeyState,storeNotes:window._storeNotes||{},exportDate:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='door-data.json';a.click();URL.revokeObjectURL(a.href);
  toast('JSON saved');
}
function loadJSON(e){
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      const p=JSON.parse(ev.target.result);
      if(p.matrixData){matrixData=p.matrixData;brandCodes=p.brandCodes||brandCodes;doorLocations=p.doorLocations||doorLocations;retailers=p.retailers||retailers;history=p.history||{};doorAssignments=p.doorAssignments||{};dataKeyState=p.dataKeyState||{};window._storeNotes=p.storeNotes||{};ensureAllSlots();populateFilters();updateViewSpecificControls();render();queueAutosave();toast(`Loaded ${matrixData.length} brands`);}
    }catch(err){toast('Error parsing JSON');}
  };
  reader.readAsText(f);e.target.value='';
}

function downloadTemplate(){
  if(!isSheetJsReady()) return;
  const demo=getTemplateDemoRows();
  const matrixRows=[
    {Retailer:'',Brand:'',Category:'',Doors:'','Door Number':'',Status:'',Grade:'',Gender:'ALL',metric_1:'',metric_2:'',Notes:''},
    ...demo.matrixRows
  ];
  const doorRows=[
    {Retailer:'','Door Number':'',Name:'',Address:'',City:'',State:'',ZIP:'',Lat:'',Lng:'',Tier:''},
    ...demo.doorRows
  ];
  const matrixWs=XLSX.utils.json_to_sheet(matrixRows);
  matrixWs['!cols']=Object.keys(matrixRows[0]).map(k=>({wch:Math.max(k.length+2,14)}));
  const doorWs=XLSX.utils.json_to_sheet(doorRows);
  doorWs['!cols']=Object.keys(doorRows[0]).map(k=>({wch:Math.max(k.length+2,16)}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,matrixWs,'Matrix');
  XLSX.utils.book_append_sheet(wb,doorWs,'Door Locations');
  XLSX.writeFile(wb,'Door_Tracker_Template.xlsx');
  toast('Template downloaded with example rows');
}
function downloadDemoData(){
  if(!isSheetJsReady()) return;
  const {matrixRows,doorRows}=getTemplateDemoRows();
  const matrixWs=XLSX.utils.json_to_sheet(matrixRows);
  matrixWs['!cols']=Object.keys(matrixRows[0]).map(k=>({wch:Math.max(k.length+2,14)}));
  const doorWs=XLSX.utils.json_to_sheet(doorRows);
  doorWs['!cols']=Object.keys(doorRows[0]).map(k=>({wch:Math.max(k.length+2,16)}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,matrixWs,'Matrix');
  XLSX.utils.book_append_sheet(wb,doorWs,'Door Locations');
  XLSX.writeFile(wb,'Door_Tracker_Demo_Data.xlsx');
  toast('Demo data downloaded');
}

function populateStatusGradeFilters(){
  const gradeSel=document.getElementById('fGrade');
  if(!gradeSel) return;
  const current=getSelectValues(gradeSel);
  const grades=new Set();
  doorLocations.forEach(d=>{ if(d.tier) grades.add(String(d.tier)); });
  gradeSel.innerHTML='<option value="">All</option>'+Array.from(grades).sort().map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
  setSelectValues(gradeSel,current);
}

function updateViewSpecificControls(){
  const isData=currentView==='unpivoted';
  const sg=document.getElementById('statusFilterGroup');
  const gg=document.getElementById('gradeFilterGroup');
  const gen=document.getElementById('genderFilterGroup');
  const og=document.getElementById('opportunityFilterGroup');
  const div=document.getElementById('statusGradeDivider');
  if(sg) sg.style.display=isData?'block':'none';
  if(gg) gg.style.display=isData?'block':'none';
  if(gen) gen.style.display=isData?'block':'none';
  if(og) og.style.display=isData?'block':'none';
  if(div) div.style.display=isData?'block':'none';
  renderRefineToggles();
}

function exportCurrentView(){
  if(typeof XLSX==='undefined'){toast('SheetJS not loaded');return;}
  if(currentView==='research'){ exportResearchView(); return; }
  const main=document.getElementById('mainView');
  const table=main?main.querySelector('table'):null;
  if(!table){toast('Nothing visible to export on this screen.');return;}
  const wb=XLSX.utils.table_to_book(table,{sheet:currentView==='unpivoted'?'Data':(currentView.charAt(0).toUpperCase()+currentView.slice(1))});
  XLSX.writeFile(wb,`Door_Distribution_${currentView}_${new Date().toISOString().slice(0,10)}.xlsx`);
  const rowCount=table.querySelectorAll('tbody tr').length || 0;
  toast(`Exported current ${currentView} view (${rowCount} rows)`);
}

/* Research view exports door-location records, respecting the same retailer,
   brand and door-search filters that the on-screen list is rendered from. */
function exportResearchView(){
  const doors=Array.isArray(window._resDoors) ? window._resDoors : doorLocations.slice();
  if(!doors.length){ toast('No doors match the current filters — nothing to export.'); return; }
  const rows=doors.map(d=>({
    Retailer:d.retailer||'',
    'Door Number':d.doorNumber,
    Name:d.name||'',
    Address:d.address||'',
    City:d.city||'',
    State:d.state||'',
    ZIP:d.zip||'',
    Lat:(d.lat===undefined||d.lat===null||Number.isNaN(d.lat))?'':d.lat,
    Lng:(d.lng===undefined||d.lng===null||Number.isNaN(d.lng))?'':d.lng,
    Tier:d.tier||''
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=Object.keys(rows[0]).map(k=>({wch:Math.max(k.length+2,14)}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Door Locations');
  XLSX.writeFile(wb,`Door_Distribution_research_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Exported ${rows.length} door location${rows.length===1?'':'s'}.`);
}
function exportXLSX(){ exportCurrentView(); }

/* Two-sheet workbook export of the entire loaded dataset:
   Sheet 1 = unpivoted matrix rows (retailer × brand × door),
   Sheet 2 = door location records. */
function exportFullData(){
  if(!isSheetJsReady()){ toast('Spreadsheet engine not ready yet.'); return; }
  const matrixRows=[];
  const brands=getAllBrands();
  const allRetailers=[...new Set([...retailers,...doorLocations.map(d=>normalizeRetailer(d.retailer))])].filter(Boolean).sort();
  allRetailers.forEach(ret=>{
    const doors=getRetailerDoors(ret);
    brands.forEach(brand=>{
      const bName=(brandCodes[brand]&&brandCodes[brand].name)||'';
      const category=getBrandCategory(brand)||'';
      doors.forEach(door=>{
        const state=getDataKeyState(ret,door.doorNumber,brand) || {};
        const status=normalizeStatus(state.status);
        if(status==='na') return;
        matrixRows.push({
          Retailer: ret,
          'Door Number': door.doorNumber,
          'Door Name': door.name||'',
          Brand: brand,
          'Brand Name': bName,
          Category: category,
          Status: status||'',
          Grade: state.grade||'',
          Gender: normalizeGender(state.gender),
          metric_1: state.metric_1||'',
          metric_2: state.metric_2||'',
          Notes: state.note||'',
          Key: buildDataKey(ret,door.doorNumber,brand)
        });
      });
    });
  });
  const doorRows=doorLocations.map(d=>({
    Retailer: normalizeRetailer(d.retailer),
    'Door Number': d.doorNumber,
    Name: d.name||'',
    Address: d.address||'',
    City: d.city||'',
    State: d.state||'',
    ZIP: d.zip||'',
    Lat: d.lat==null?'':d.lat,
    Lng: d.lng==null?'':d.lng,
    Tier: d.tier||''
  }));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrixRows.length?matrixRows:[{}]), 'Matrix');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(doorRows.length?doorRows:[{}]), 'Doors');
  const stamp=new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `door-tracker-data-${stamp}.xlsx`);
  toast(`Exported ${matrixRows.length} matrix rows, ${doorRows.length} doors.`);
}

// ═══════════════════════════════════════════════════════
// VIEW CONTROLS
// ═══════════════════════════════════════════════════════
let dataStatusPrimed=false;
let currentMode='data'; // 'data' | 'map'

/* Top-level framework toggle. Data mode owns the tabular views (matrix /
   compact / tabular / unpivoted / drafts); Map mode owns the Brand-Door
   Research map. The two modes share the underlying state — just paint it
   differently. */
function setMode(m){
  if(m!=='data' && m!=='map') return;
  currentMode=m;
  document.body.classList.toggle('mode-map', m==='map');
  document.body.classList.toggle('mode-data', m==='data');
  document.querySelectorAll('#mode-toggle .mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===m));
  syncMapLayerToggles();
  const tabs=document.getElementById('viewTabs');
  if(tabs) tabs.style.display = m==='map' ? 'none' : '';
  const tBtn=document.getElementById('tBtn');
  if(m==='map'){
    if(tBtn) tBtn.style.display='none';
    currentView='research';
    closeRefinePanel();
  }else{
    if(currentView==='research') currentView='matrix';
    document.querySelectorAll('.view-tab').forEach(t=>t.classList.toggle('active', t.dataset.v===currentView));
    if(tBtn) tBtn.style.display = currentView==='matrix' ? 'inline-flex' : 'none';
  }
  try{ localStorage.setItem('door-tracker-mode', m); }catch(e){}
  updateViewSpecificControls();
  render();
}

function setView(v){
  if(currentMode==='map' && v!=='research'){
    /* Picking a tabular view from anywhere implicitly switches back to Data mode. */
    currentMode='data';
    try{ localStorage.setItem('door-tracker-mode','data'); }catch(e){}
    document.body.classList.remove('mode-map');
    document.body.classList.add('mode-data');
    document.querySelectorAll('#mode-toggle .mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode==='data'));
    const tabs=document.getElementById('viewTabs');
    if(tabs) tabs.style.display='';
  }
  currentView=v;
  document.querySelectorAll('.view-tab').forEach(t=>t.classList.toggle('active',t.dataset.v===v));
  document.getElementById('tBtn').style.display=v==='matrix'?'inline-flex':'none';
  if(v==='unpivoted'){
    const fs=document.getElementById('fStatus');
    if(fs && (!dataStatusPrimed || !getSelectValues(fs).length)){
      setSelectValues(fs,['confirmed']);
      dataStatusPrimed=true;
    }
  }
  updateViewSpecificControls();
  render();
}
function toggleTranspose(){transposed=!transposed;const btn=document.getElementById('tBtn');if(btn){btn.classList.toggle('active',transposed);btn.setAttribute('aria-pressed',transposed?'true':'false');} render();}
function applyThemeToMaps(){
  if(window._doorMap){ try{window._doorMap.setStyle(mapStyleForTheme());}catch(e){} }
  if(_resMap){
    try{
      _resMapStyleReady=false;
      _resMap._marketInteractionsBound=false;
      _resMap.setStyle(mapStyleForTheme());
      _resMap.once('idle',()=>{
        addResearchMapLayers();
        _resMapStyleReady=true;
        loadMarketData();
        updateResearchMapData();
      });
    }catch(e){}
  }
}
/* Theme swap is one viewport-level cross-fade via the View Transitions API
   — the per-element animated rule that fashion.css ships staggers across
   thousands of nodes on big tools. theme-switching (defined in style.css)
   suppresses individual element transitions for the duration. */
let _themePending=0;
function _settleThemeSwitch(){
  if(--_themePending<=0){_themePending=0;document.documentElement.classList.remove('theme-switching');}
}
function _swapTheme(toLight){
  const root=document.documentElement;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('theme-switching');
  _themePending++;
  const apply=()=>{
    document.body.classList.toggle('light',toLight);
    try{localStorage.setItem('cloonk-theme',toLight?'light':'dark')}catch(e){}
    applyThemeToMaps();
  };
  if(typeof document.startViewTransition==='function' && !reduce){
    document.startViewTransition(apply).finished.finally(_settleThemeSwitch);
  } else {
    apply();
    requestAnimationFrame(()=>requestAnimationFrame(_settleThemeSwitch));
  }
}
function toggleTheme(){ _swapTheme(!document.body.classList.contains('light')); }
window.addEventListener('storage',e=>{
  if(e.key!=='cloonk-theme') return;
  _swapTheme(e.newValue==='light');
});

/* ── Global history feed ─────────────────────────────────── */
let _historyActiveTypes=new Set();
let _historyAllEntries=[];

function _historyEntryType(e){
  /* Bucket each entry by scope so the filter feels stable even as
     individual action verbs proliferate over time. */
  const scope=String(e.scope||'assignment').toLowerCase();
  if(scope==='door') return 'door';
  if(scope==='matrix') return 'matrix';
  const action=String(e.action||'').toLowerCase();
  if(/add|publish|new/.test(action)) return 'add';
  if(/remove|subtract|delete|close|exit/.test(action)) return 'remove';
  if(/edit|update|change|grade|status|metric|note/.test(action)) return 'edit';
  return 'other';
}

const HISTORY_TYPE_LABELS={add:'Add',remove:'Remove',edit:'Edit',door:'Door details',matrix:'Matrix',other:'Other'};

function openGlobalHistory(){
  _historyAllEntries=[];
  Object.keys(history||{}).forEach(hk=>{
    const [ret,brand]=hk.split('|');
    (history[hk]||[]).forEach((e,idx)=>_historyAllEntries.push(Object.assign({_ret:ret,_brand:brand,_key:hk,_idx:idx},e)));
  });
  _historyAllEntries.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  _historyActiveTypes=new Set();
  document.getElementById('drTitle').textContent='All Changes';
  renderGlobalHistory();
  document.getElementById('ovDraw').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function renderGlobalHistory(){
  const entries=_historyAllEntries;
  const present=new Set(entries.map(_historyEntryType));
  const orderedTypes=['add','remove','edit','door','matrix','other'].filter(t=>present.has(t));
  const filtered=_historyActiveTypes.size
    ? entries.filter(e=>_historyActiveTypes.has(_historyEntryType(e)))
    : entries;
  document.getElementById('drSub').textContent=`${filtered.length.toLocaleString()} of ${entries.length.toLocaleString()} change${entries.length===1?'':'s'} across ${Object.keys(history||{}).length.toLocaleString()} pair${Object.keys(history||{}).length===1?'':'s'}`;
  const filterPills=`<div class="history-filter-bar">
    <span style="font-size:0.66rem;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase">Type</span>
    <button class="history-filter-pill ${_historyActiveTypes.size===0?'active':''}" type="button" onclick="toggleHistoryFilter('')">All <span class="history-filter-count">${entries.length}</span></button>
    ${orderedTypes.map(t=>{
      const n=entries.filter(e=>_historyEntryType(e)===t).length;
      const active=_historyActiveTypes.has(t);
      return `<button class="history-filter-pill ${active?'active':''}" type="button" onclick="toggleHistoryFilter('${esc(t)}')">${esc(HISTORY_TYPE_LABELS[t]||t)} <span class="history-filter-count">${n}</span></button>`;
    }).join('')}
  </div>`;
  const limit=400;
  const slice=filtered.slice(0,limit);
  const itemsHtml=slice.length
    ? slice.map(e=>{
        const type=_historyEntryType(e);
        const canRevert=type==='door' && (String(e.oldVal||'')!==String(e.newVal||''));
        const revertBtn=canRevert
          ? `<button class="history-revert" type="button" onclick="event.stopPropagation();revertHistoryEntry('${esc(e._key)}',${e._idx})" title="Set this field back to its previous value">↶ Revert</button>`
          : `<button class="history-revert disabled" type="button" disabled title="For assignment or matrix changes, use Restore Points">↶ Revert</button>`;
        return `<div class="history-feed-item history-type-${esc(type)}" onclick="${callAttr('openHistoryDrawer',e._ret,e._brand)}">
          <div class="history-feed-pair">${esc(e._ret)} × ${esc(e._brand)}${brandCodes[e._brand]?' — '+esc(brandCodes[e._brand].name):''}</div>
          <div class="history-date" style="margin-top:2px">${new Date(e.date).toLocaleString()}</div>
          <div style="margin-top:4px"><span class="history-new">${esc(String(e.scope||'assignment').toUpperCase())}</span> · ${esc(e.action||'updated')}${e.doorNumber!==''?` · Door ${esc(String(e.doorNumber))}`:''}</div>
          ${(e.oldVal!==''||e.newVal!=='')?`<div><span class="history-old">${esc(String(e.oldVal))}</span> → <span class="history-new">${esc(String(e.newVal))}</span></div>`:''}
          ${e.note?`<div style="margin-top:2px;color:var(--text-muted)">${esc(e.note)}</div>`:''}
          <div class="history-row-footer"><span class="history-user">${esc(e.user||'System')}</span>${revertBtn}</div>
        </div>`;
      }).join('') + (filtered.length>limit?`<p style="color:var(--text-dim);text-align:center;margin-top:10px">Showing latest ${limit} of ${filtered.length.toLocaleString()}.</p>`:'')
    : '<p style="color:var(--text-dim);margin-top:16px">No changes match the current filter.</p>';
  document.getElementById('drContent').innerHTML = filterPills + itemsHtml;
}

function toggleHistoryFilter(type){
  if(!type){ _historyActiveTypes=new Set(); }
  else if(_historyActiveTypes.has(type)) _historyActiveTypes.delete(type);
  else _historyActiveTypes.add(type);
  renderGlobalHistory();
}

function revertHistoryEntry(key,idx){
  const entries=(history||{})[key]||[];
  const entry=entries[idx];
  if(!entry){ toast('Entry not found.'); return; }
  if(String(entry.scope||'').toLowerCase()!=='door'){
    toast('Only door-detail edits can be reverted from here. Use Restore Points for assignment changes.');
    return;
  }
  const [ret]=key.split('|');
  const norm=normalizeRetailer(ret);
  const door=doorLocations.find(d=>normalizeRetailer(d.retailer)===norm && String(d.doorNumber)===String(entry.doorNumber));
  if(!door){ toast('Door no longer exists.'); return; }
  const field=String(entry.note||'').replace(/\s+changed$/,'').trim();
  if(!field || !(field in door) && !['name','address','city','state','zip','tier','lat','lng','doorNumber'].includes(field)){
    toast('Could not detect which field to revert.');
    return;
  }
  const newField = field;
  const oldVal=entry.oldVal;
  let restore=oldVal;
  if(newField==='lat'||newField==='lng'){
    if(String(oldVal).trim()==='') restore=undefined;
    else { const n=parseFloat(oldVal); restore=Number.isNaN(n)?undefined:n; }
  }
  door[newField]=restore;
  recordHistory(norm,'__door__',{action:'revert',doorNumber:String(door.doorNumber),scope:'door',oldVal:String(entry.newVal||''),newVal:String(restore==null?'':restore),date:new Date().toISOString(),user:currentUserName(),note:`${newField} reverted`});
  queueAutosave();
  render();
  toast(`Reverted ${newField} on door ${door.doorNumber}.`);
  /* Re-open history with the same filter set after the new entry lands. */
  openGlobalHistory();
}

/* ── Snapshots UI ────────────────────────────────────────── */
function openSnapshotsModal(){
  document.getElementById('ovSnap').classList.add('open');
  document.getElementById('mSnap').classList.add('open');
  document.getElementById('snapLabel').value='';
  refreshSnapshotList();
}
function closeSnapshotsModal(){
  document.getElementById('ovSnap').classList.remove('open');
  document.getElementById('mSnap').classList.remove('open');
}
function createManualSnapshot(){
  const label=(document.getElementById('snapLabel').value||'').trim() || 'Snapshot';
  createRestorePoint(label,false).then(()=>{
    document.getElementById('snapLabel').value='';
    toast(`Snapshot saved: ${label}`);
    refreshSnapshotList();
  }).catch(()=>toast('Could not save snapshot.'));
}
function refreshSnapshotList(){
  const host=document.getElementById('snapList');
  if(!host) return;
  host.innerHTML='<p style="color:var(--text-dim);font-size:0.78rem">Loading…</p>';
  listRestorePoints().then(rows=>{
    if(!rows.length){ host.innerHTML='<p style="color:var(--text-dim);font-size:0.78rem">No snapshots yet. Create one above, or wait for the auto-snapshot in ~5 minutes.</p>'; return; }
    host.innerHTML=rows.map(r=>{
      const when=new Date(r.savedAt).toLocaleString();
      const counts=`${Object.keys(r.history||{}).length.toLocaleString()} pairs · ${Object.keys(r.dataKeyState||{}).length.toLocaleString()} cells`;
      return `<div class="snap-item${r.auto?' auto':''}">
        <div>
          <div class="snap-label">${esc(r.label||'Snapshot')}${r.auto?' <span style="color:var(--text-dim);font-weight:400;font-size:0.7rem">· auto</span>':''}</div>
          <div class="snap-meta">${esc(when)} · ${counts}</div>
        </div>
        <button class="btn btn-sm" onclick='restoreFromPoint(${jsq(r.id)})' title="Replace current state with this snapshot. A before-restore snapshot is auto-created.">↶ Restore</button>
        <button class="btn btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick='deleteRestorePoint(${jsq(r.id)}).then(refreshSnapshotList)' title="Delete this snapshot">✕</button>
      </div>`;
    }).join('');
  }).catch(()=>{ host.innerHTML='<p style="color:var(--danger);font-size:0.78rem">Could not load snapshots.</p>'; });
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),2800);}

document.addEventListener('click',e=>{
  if(!e.target.closest('.header-menu')) closeHeaderMenus();
  const path=typeof e.composedPath==='function' ? e.composedPath() : [];
  const inRefine=path.some(el=>el && el.id==='refineWrap') || e.target.closest('#refineWrap');
  if(!inRefine) closeRefinePanel();
});
document.getElementById('refinePanel')?.addEventListener('click',handleRefineToggleEvent);
document.getElementById('refinePanel')?.addEventListener('keydown',handleRefineToggleEvent);
document.addEventListener('click',handleMapFilterEvent);
document.addEventListener('keydown',handleMapFilterEvent);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeHeaderMenus();closeRefinePanel();if(document.getElementById('mLogin').classList.contains('open')) return; closeEdit();closeCM();closeAdd();closeImport();closeInfo();closeSnapshotsModal();closeEditDoorModal();closeDrawer();}});

// INIT
try{
  const t=localStorage.getItem('cloonk-theme')||localStorage.getItem('door-theme');
  if(t==='light'){
    document.body.classList.add('light');
    if(t!==localStorage.getItem('cloonk-theme')){ try{localStorage.setItem('cloonk-theme','light');}catch(e){} }
  }
}catch(e){}

/* ── Auth wall ────────────────────────────────────────────
   Client-side identification only. The private roster lives in
   data/door-tracker-user-roster.local.js, which is ignored by git. */
const USER_ROSTER=window.DOOR_TRACKER_USER_ROSTER || {};
const SESSION_KEY='cloonk-doortracker-user';
let currentUser=null;
let _appBooted=false;

function currentUserName(){ return currentUser ? (currentUser.name || currentUser.username) : 'Unknown'; }
function normalizeEmail(v){ return String(v||'').trim().toLowerCase(); }

async function sha256Hex(text){
  const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

function loadSession(){
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const p=JSON.parse(raw);
    if(!p || !p.username) return null;
    if(p.authProvider==='supabase') return null;
    if(p.isGuest) return { username:'guest', name:p.name || 'Guest', isGuest:true };
    if(!USER_ROSTER[p.username]) return null;
    return { username:p.username, name:USER_ROSTER[p.username].name };
  }catch(e){ return null; }
}
function saveSession(){
  if(!currentUser) return;
  if(currentUser.authProvider==='supabase') return;
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify({username:currentUser.username, name:currentUser.name, isGuest:!!currentUser.isGuest, loginAt:new Date().toISOString()})); }catch(e){}
}
function clearSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }

async function getSupabaseRosterUser(email){
  const client=getSupabaseClient();
  if(!client) return null;
  const normalized=normalizeEmail(email);
  const {data,error}=await client.from('door_tracker_allowed_users')
    .select('email,display_name')
    .eq('email',normalized)
    .maybeSingle();
  if(error) throw error;
  return data ? { username:data.email, name:data.display_name || data.email, authProvider:'supabase' } : null;
}
async function loadSupabaseSession(){
  const client=getSupabaseClient();
  if(!client) return null;
  const {data,error}=await client.auth.getSession();
  if(error || !data || !data.session || !data.session.user) return null;
  const user=data.session.user;
  const rosterUser=await getSupabaseRosterUser(user.email);
  if(!rosterUser){
    await client.auth.signOut().catch(()=>{});
    return null;
  }
  return rosterUser;
}

function showLoginModal(){
  document.getElementById('ovLogin').classList.add('open');
  document.getElementById('mLogin').classList.add('open');
  document.body.classList.add('locked');
  setTimeout(()=>{ const u=document.getElementById('loginUser'); if(u) u.focus(); },50);
}
function hideLoginModal(){
  document.getElementById('ovLogin').classList.remove('open');
  document.getElementById('mLogin').classList.remove('open');
  document.body.classList.remove('locked');
}

function updateUserChip(){
  const chip=document.getElementById('userChip');
  if(!chip) return;
  if(currentUser){
    chip.style.display='inline-flex';
    document.getElementById('userChipName').textContent=currentUser.name;
    chip.classList.toggle('guest', !!currentUser.isGuest);
    const label=chip.querySelector('.signed-as');
    if(label) label.textContent=currentUser.isGuest ? 'Guest preview' : 'Signed in as';
  }else{
    chip.style.display='none';
  }
}

async function enterGuestMode(){
  window._doorTrackerBlankGuest=false;
  currentUser={ username:'guest', name:'Guest', isGuest:true };
  saveSession();
  /* Reset guest sandbox to a fresh anonymized template on each entry. */
  try{ await withStore(STORE_LATEST,'readwrite',s=>reqAsPromise(s.delete(GUEST_SAVE_KEY))); }catch(e){}
  document.getElementById('loginPass').value='';
  document.getElementById('loginError').style.display='none';
  hideLoginModal();
  updateUserChip();
  bootApp();
}

async function handleLogin(){
  const username=(document.getElementById('loginUser').value||'').trim().toLowerCase();
  const password=document.getElementById('loginPass').value||'';
  const errEl=document.getElementById('loginError');
  const btn=document.getElementById('loginBtn');
  errEl.style.display='none';
  if(!username || !password){ errEl.textContent='Enter username and password.'; errEl.style.display='block'; return; }
  btn.disabled=true;
  try{
    const client=getSupabaseClient();
    if(client){
      const {data,error}=await client.auth.signInWithPassword({email:username,password});
      if(error) throw error;
      const rosterUser=await getSupabaseRosterUser(data.user && data.user.email);
      if(!rosterUser){
        await client.auth.signOut().catch(()=>{});
        errEl.textContent='This email is not on the door tracker user roster.';
        errEl.style.display='block';
        btn.disabled=false;
        return;
      }
      window._doorTrackerBlankGuest=false;
      currentUser=rosterUser;
      document.getElementById('loginPass').value='';
      hideLoginModal();
      updateUserChip();
      bootApp();
      return;
    }
    const user=USER_ROSTER[username];
    if(!user){ errEl.textContent='Unknown username.'; errEl.style.display='block'; btn.disabled=false; return; }
    const inputHash=await sha256Hex(password);
    if(inputHash!==user.hash){ errEl.textContent='Wrong password.'; errEl.style.display='block'; btn.disabled=false; return; }
    window._doorTrackerBlankGuest=false;
    currentUser={ username, name:user.name };
    saveSession();
    document.getElementById('loginPass').value='';
    hideLoginModal();
    updateUserChip();
    bootApp();
  }catch(e){
    errEl.textContent='Sign-in failed: '+(e.message||e);
    errEl.style.display='block';
    btn.disabled=false;
  }
}

async function signOut(){
  const wasGuest=currentUser && currentUser.isGuest;
  const wasSupabase=currentUser && currentUser.authProvider==='supabase';
  clearSession();
  if(wasSupabase){
    const client=getSupabaseClient();
    if(client) await client.auth.signOut().catch(()=>{});
  }
  window._doorTrackerBlankGuest=false;
  currentUser=null;
  _appBooted=false;
  updateUserChip();
  const u=document.getElementById('loginUser'); if(u) u.value='';
  const p=document.getElementById('loginPass'); if(p) p.value='';
  const errEl=document.getElementById('loginError'); if(errEl) errEl.style.display='none';
  if(wasGuest){
    /* Wipe the guest sandbox so the next guest sees a blank template. */
    withStore(STORE_LATEST,'readwrite',s=>reqAsPromise(s.delete(GUEST_SAVE_KEY))).catch(()=>{});
  }
  toast('Signed out.');
  showLoginModal();
}

function bootApp(){
  if(_appBooted) return Promise.resolve();
  _appBooted=true;
  initFromSeed();
  const tBtn=document.getElementById('tBtn'); if(tBtn) tBtn.style.display='inline-flex';
  /* Restore the Data/Map mode pick from the previous session. */
  let savedMode='data';
  try{ savedMode=localStorage.getItem('door-tracker-mode')||'data'; }catch(e){}
  return loadAutoState().finally(()=>{
    ensureAllSlots();
    populateFilters();
    applyDefaultDSBrandFilter();
    applyDefaultLuxuryChannel();
    restoreShowByGroupState();
    restoreResearchClusterState();
    restoreMarketLayerState();
    loadMarketData();
    setMode(savedMode==='map'?'map':'data');
    persistAutoState();
    scheduleAutoSnapshots();
  });
}

/* First load: default the Channel filter to Luxury and turn the toggle on. */
function applyDefaultLuxuryChannel(){
  try{
    if(localStorage.getItem('door-tracker-luxury-default-applied')==='1') return;
    const fc=document.getElementById('fRetChannel');
    if(!fc) return;
    if(getSelectValues(fc).length) return;
    const hasLuxury=Array.from(fc.options).some(o=>o.value==='Luxury');
    if(!hasLuxury) return;
    setSelectValues(fc,['Luxury']);
    const group=document.getElementById('channelFilterGroup');
    if(group){
      group.classList.add('is-active');
      group.classList.add('is-open');
    }
    try{ localStorage.setItem('door-tracker-luxury-default-applied','1'); }catch(e){}
  }catch(e){}
}

function restoreShowByGroupState(){
  try{
    const v=localStorage.getItem('door-tracker-show-by-group');
    const el=document.getElementById('showByGroupRow');
    if(el && v==='1'){
      el.classList.add('is-on');
      /* Re-render the Retailer pill list so it shows groups instead of
         individual retailers when the toggle was persisted as on. */
      renderRefineToggles();
    }
  }catch(e){}
}

function restoreResearchClusterState(){
  try{
    const v=localStorage.getItem('door-tracker-map-clusters');
    _clusterEnabled = v !== '0';
    syncMapLayerToggles();
  }catch(e){}
}

/* Default load: matrix view with DS-active brands selected. */
function applyDefaultDSBrandFilter(){
  try{
    if(localStorage.getItem('door-tracker-ds-default-applied')==='1') return;
    const fb=document.getElementById('fBrand');
    if(!fb) return;
    if(getSelectValues(fb).length) return;
    const ds=Object.entries(brandCodes).filter(([code,v])=>v && v.ds_active).map(([code])=>code);
    if(ds.length){
      setSelectValues(fb,ds);
      currentView='matrix';
      try{ localStorage.setItem('door-tracker-ds-default-applied','1'); }catch(e){}
    }
  }catch(e){}
}

/* Boot: resume session or show the login wall. */
(async function bootGate(){
  const stored=await loadSupabaseSession().catch(()=>null) || loadSession();
  if(stored){
    currentUser=stored;
    updateUserChip();
    bootApp();
  }else{
    showLoginModal();
  }
})();
