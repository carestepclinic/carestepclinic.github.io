/* Carestep Home v10.1-J service worker · 2026-10-13 cache rollout */
const VERSION='fullcourse-20261017';
const CACHE=`carestep-home-${VERSION}`;
const ASSETS=['./home-care.js?v=fullcourse-20261017','./home.html','./carestep-home.css?v=fullcourse-20261017','./carestep-home-response-edit.css?v=10.1-J',`./carestep-home.js?v=${VERSION}`,'./date-input-guard.js?v=10.1-B','./manifest.webmanifest','./carestep-home-icon.svg','./carestep-home-icon-192.png','./carestep-home-icon-512.png'];
const HOME_PATHS=new Set(['/home-care.js','/home.html','/carestep-home.css','/carestep-home-response-edit.css','/carestep-home.js','/date-input-guard.js','/manifest.webmanifest','/carestep-home-icon.svg','/carestep-home-icon-192.png','/carestep-home-icon-512.png']);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('carestep-home-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_VERSION')event.source?.postMessage({type:'CARESTEP_SW_VERSION',version:VERSION,cache:CACHE});
});

async function networkFirst(request,fallback){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok)await cache.put(fallback||request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(fallback||request);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    if(url.pathname!=='/home.html')return;
    event.respondWith(networkFirst(request,'./home.html'));
    return;
  }
  if(!HOME_PATHS.has(url.pathname))return;
  event.respondWith(networkFirst(request));
});
function safeNotificationURL(value){try{const u=new URL(value||'./home.html',self.location.href);return u.origin===new URL(self.location.href).origin&&u.pathname==='/home.html'?u.href:new URL('./home.html',self.location.href).href;}catch{return new URL('./home.html',self.location.href).href;}}
async function notificationStore(mode,action){if(typeof indexedDB==='undefined')return [];const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('carestep-notifications',1);r.onupgradeneeded=()=>r.result.createObjectStore('recent',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('recent',mode),store=tx.objectStore('recent');let result=[];tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);action(store,v=>result=v);});}finally{db.close();}}
async function rememberNotification(data){if(!['medication','preventive','followup','consultation_reply','medication_registered','material_published'].includes(data.type))return;const now=Date.now(),record={id:now+'-'+Math.random().toString(36).slice(2),type:data.type,url:safeNotificationURL(data.url),receivedAt:new Date(now).toISOString()};await notificationStore('readwrite',(store,done)=>{store.put(record);const r=store.getAll();r.onsuccess=()=>{const rows=r.result.sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));rows.forEach((x,i)=>{if(i>=50||Date.parse(x.receivedAt)<now-7*86400000)store.delete(x.id);});done([]);};});}
self.addEventListener('message',event=>{if(event.data?.type==='GET_RECENT_NOTIFICATIONS'&&event.ports?.[0])event.waitUntil(notificationStore('readonly',(store,done)=>{const r=store.getAll();r.onsuccess=()=>done(r.result.filter(x=>Date.parse(x.receivedAt)>=Date.now()-7*86400000).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)));}).then(items=>event.ports[0].postMessage({items})).catch(()=>event.ports[0].postMessage({items:[],error:true})));});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{data={}}if(data.type==='medication'&&(!Number.isFinite(Date.parse(data.expiresAt||''))||Date.parse(data.expiresAt)<=Date.now())){event.waitUntil(Promise.resolve());return;}const title=data.title||'Carestep Home 관리 알림',options={body:data.body||'확인할 건강관리 안내가 있습니다.',icon:'./carestep-home-icon-192.png',badge:'./carestep-home-icon-192.png',tag:data.tag||'carestep-home',renotify:false,data:{url:safeNotificationURL(data.url),followupId:data.followupId||''}};event.waitUntil(Promise.all([self.registration.showNotification(title,options).then(()=>rememberNotification(data).catch(()=>{})),self.registration.setAppBadge?self.registration.setAppBadge(1):Promise.resolve()]))});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=safeNotificationURL(event.notification.data?.url);event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const client of clients){if(new URL(client.url).origin!==self.location.origin)continue;if('navigate' in client)await client.navigate(target);return client.focus()}return self.clients.openWindow(target)}).then(()=>self.registration.clearAppBadge?self.registration.clearAppBadge():undefined))});
