/* Carestep Home v10.1-J service worker · 2026-10-13 cache rollout */
const VERSION='8e87bc3e1531';
const CACHE=`carestep-home-${VERSION}`;
const ASSETS=['./home-care.js?v=8e87bc3e1531','./home.html','./carestep-home.css?v=8e87bc3e1531','./carestep-home-response-edit.css?v=10.1-J',`./carestep-home.js?v=${VERSION}`,'./date-input-guard.js?v=10.1-B','./manifest.webmanifest','./carestep-home-icon.svg','./carestep-home-icon-192.png','./carestep-home-icon-512.png'];
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
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{data={}}if(data.type==='medication'&&(!Number.isFinite(Date.parse(data.expiresAt||''))||Date.parse(data.expiresAt)<=Date.now())){event.waitUntil(Promise.resolve());return;}const title=data.title||'Carestep Home 관리 알림',options={body:data.body||'확인할 건강관리 안내가 있습니다.',icon:'./carestep-home-icon-192.png',badge:'./carestep-home-icon-192.png',tag:data.tag||'carestep-home',renotify:false,data:{url:data.url||'./home.html',followupId:data.followupId||''}};event.waitUntil(Promise.all([self.registration.showNotification(title,options),self.registration.setAppBadge?self.registration.setAppBadge(1):Promise.resolve()]))});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=new URL(event.notification.data?.url||'./home.html',self.location.href).href;event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const client of clients){if(new URL(client.url).origin!==self.location.origin)continue;if('navigate' in client)await client.navigate(target);return client.focus()}return self.clients.openWindow(target)}).then(()=>self.registration.clearAppBadge?self.registration.clearAppBadge():undefined))});
