if(self!==top){document.body.replaceChildren(document.createTextNode('Lisans panelini ayrı bir sekmede açın.'));throw new Error('Embedded portal unavailable');}
import {readRequestFile,offlineDownloadName,approvalPayload} from './offline-ui.mjs';
const API='https://urrzxpepdwtkodfyjmbr.supabase.co/functions/v1/license-api';
const app=document.querySelector('#app');
const preview=['localhost','127.0.0.1'].includes(location.hostname)&&new URL(location.href).searchParams.get('preview')==='1';
const fragment=new URLSearchParams(location.hash.slice(1));
const linkKind=['admin','recover','info','profile'].find(name=>fragment.has(name));
let linkToken=linkKind?fragment.get(linkKind):null;
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const state={offline:null,token:'',email:'',tab:'requests',selected:null,data:null,recordPage:null,archived:false,offset:0,detail:null,busy:false,notice:'',error:false};
const pending=new Map();
const labels={pending_email:'E-posta doğrulaması bekliyor',withdrawn:'Geri çekildi',needs_review:'Yeniden değerlendirme gerekli',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',needs_info:'Ek bilgi bekleniyor',cancelled:'İptal',active:'Aktif',expired:'Süresi doldu',revoked:'İptal edildi',sent:'Gönderildi',delivered:'Teslim edildi',failed:'Gönderilemedi',sending:'Gönderiliyor',pilot:'Ücretsiz Pilot',paid:'Ücretli',sponsored:'Sponsorlu'};
const statusTones=new Map(Object.entries({
 approved:'success',active:'success',sent:'success',delivered:'success',
 pending:'warning',needs_info:'warning',pending_email:'warning',needs_review:'warning',expired:'warning',sending:'warning',
 rejected:'danger',cancelled:'danger',withdrawn:'danger',revoked:'danger',failed:'danger',
}));
const errors={email_unverified:'Yeni e-posta adresi doğrulanmalı.',profile_pending:'Bekleyen bir profil talebi var.',unauthorized:'Oturumunuzu yeniden açın.',forbidden:'Bu işlem için yönetici yetkiniz bulunmuyor.',invalid_token:'Bağlantı kullanılmış veya süresi dolmuş. Yeni bağlantı isteyin.',invalid_request:'Alanları kontrol edin.',state_conflict:'Kayıt değişti. Listeyi yenileyin.',operation_conflict:'İşlem bilgileri değişti. Listeyi yenileyin.',email_expired:'Gönderim süresi doldu. Güvenli anahtar kurtarma akışını kullanın.',mail_not_configured:'E-posta hizmeti henüz hazır değil.',rate_limited:'Çok sık deneme yapıldı. Biraz bekleyin.',service_unavailable:'Hizmete ulaşılamadı. Tekrar deneyebilirsiniz.',email_conflict:'Bu adres başka bir sorumlu kaydına bağlı. Otomatik birleştirme yapılmadı.'};
function el(tag,attrs={},...children){const node=document.createElement(tag);for(const[key,value]of Object.entries(attrs)){
 if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);else if(key==='class')node.className=value;
 else if(key==='value')node.value=value;else if(typeof value==='boolean'){if(value)node.setAttribute(key,'');}else node.setAttribute(key,value);
}for(const child of children.flat(Infinity))if(child!==null&&child!==undefined)node.append(child instanceof Node?child:document.createTextNode(String(child)));return node;}
const button=(label,fn,cls='')=>el('button',{type:'button',class:cls,disabled:state.busy,onClick:fn},label);
function pill(value,extraClass=''){
 const tone=statusTones.get(value);
 return el('span',{class:['pill',tone&&'pill-'+tone,extraClass].filter(Boolean).join(' ')},labels[value]??value);
}
const field=(label,input)=>el('label',{},label,input);
const fmt=value=>value?new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(value)):'—';
const card=(...children)=>el('section',{class:'card stack'},...children);
const input=(type='text',value='',attrs={})=>el('input',{type,value,...attrs});
function notice(text,error=false){state.notice=text;state.error=error;render();}
async function request(route,data){if(preview)throw Error('Salt okunur önizleme sunucuya bağlanmaz.');const headers={'Content-Type':'application/json'};if(state.token)headers.Authorization='Bearer '+state.token;
 const response=await fetch(API+'/'+route,{method:data===undefined?'GET':'POST',headers,...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});
 const value=await response.json();if(!response.ok){if(response.status===401&&state.token){state.token='';state.data=null;state.offline=null;}throw Error(errors[value.error]??'İşlem tamamlanamadı.');}return value;}
const pageSize=100;
const visiblePage=()=>state.archived||state.offset?state.recordPage:state.data;
const visibleRows=()=>visiblePage()?.[state.tab]??[];
function closeRecord(){
 Object.assign(state,{selected:null,detail:null,offline:null,installRelease:null,installHistory:null,installEmails:[]});
}
async function showRecords(archived,offset){
 const page=archived||offset?await request('admin-records',{action:'list',archived,page_offset:offset}):null;
 state.archived=archived;
 state.offset=offset;
 state.recordPage=page;
 closeRecord();
}
async function refresh(){
 if(state.tab==='mail_templates'){await loadMailTemplates();render();return;}
 if(preview){if(state.tab==='installations')await loadInstallations();render();return;}
 state.data=await request('admin-records',{action:'list',archived:false,page_offset:0});
 if(state.archived||state.offset)state.recordPage=await request('admin-records',{action:'list',archived:state.archived,page_offset:state.offset});
 if(state.selected){
  const row=visibleRows().slice(0,pageSize).find(row=>row.id===state.selected.id);
  if(!row)closeRecord();
  else{
   state.selected=row;
   if(state.tab==='installations')await loadInstallationHistory();
   else if(state.tab!=='profile_changes')await loadLicenseDetail(row);
  }
 }
 if(state.tab==='installations')await loadInstallations();
 render();
}
async function action(fn){if(state.busy)return;state.busy=true;render();try{await fn();}catch(error){state.notice=error.name==='TimeoutError'?'Yanıt alınamadı. İşlem kaydedilmiş olabilir; aynı işlemle tekrar deneyin.':error.message;state.error=true;}finally{state.busy=false;render();}}
async function operate(name,values){if(preview){notice('Salt okunur önizleme: sunucuya işlem gönderilmedi.');return;}
 const key=JSON.stringify([name,values]);const operation=pending.get(key)??crypto.randomUUID();pending.set(key,operation);
 const result=await request('admin',{action:name,input:{operation_id:operation,...values}});pending.delete(key);
 state.notice=result.no_changes?'Değişen bilgi yok. E-posta gönderilmedi.':result.mail?.status==='failed'?'İşlem kaydedildi; e-posta gönderilemedi. Gönderim geçmişinden yeniden deneyebilirsiniz.':'İşlem kaydedildi.';
 state.error=result.mail?.status==='failed';await refresh();}
function dayEnd(value){if(!value)return undefined;const[y,m,d]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+1,-3)).toISOString();}
function modal(title,items,submitLabel,callback){const dlg=el('dialog',{'aria-label':title});const form=el('form',{},el('h2',{},title),...items);
 form.append(el('div',{class:'row'},el('button',{class:'primary',type:'submit'},submitLabel),el('button',{type:'button',onClick:()=>dlg.close()},'Vazgeç')));
 form.addEventListener('submit',event=>{event.preventDefault();dlg.close();action(callback);});dlg.append(form);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();}
function confirmAction(name,values,title,summary){const reason=el('textarea',{required:true,maxlength:2000,placeholder:'İşlem gerekçesi'});
 modal(title,[el('p',{},summary),field(name==='revoke'?'Kullanıcıya iletilecek gerekçe':'Gerekçe',reason),el('p',{class:'muted'},'İşlem geçmişi korunur. Yerel raporlar ve kurum verileri silinmez.')], 'İşlemi Onayla',()=>operate(name,{...values,reason:reason.value,confirmed:true}));}
async function checkHealth(){
 if(preview){notice('Salt okunur önizleme: hizmet kontrolü gönderilmedi.');return;}
 const result=await request('admin-health',{});
 const trustedKeys={"production-2e85a957-f720-49b2-b3d7-056499aa79a9": "vUiL6qEduGJxxjn3BOQ1EqJXKt4txMbjRrHmbUvl7iE="};
 const encodedKey=trustedKeys[result.key_id];
 if(!Object.hasOwn(trustedKeys,result.key_id))throw Error('İmza anahtarı güvenilir üretim anahtarlarıyla eşleşmedi.');
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(encodedKey),c=>c.charCodeAt(0)),{name:'Ed25519'},false,['verify']);
 const valid=await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(result.signature),c=>c.charCodeAt(0)),new TextEncoder().encode('StokAsist-Health-v1\0'+result.payload));
 if(!valid||(JSON.parse(result.payload).purpose!=='license-service-check'||JSON.parse(result.payload).environment!=='production'))throw Error('Hizmet yanıtının imzası doğrulanamadı.');
 state.notice='API, veritabanı, yönetici yetkisi ve imzalı üretim yanıtı doğrulandı. Bu kontrol Supabase duraklamama garantisi değildir.';state.error=false;
}
function headerButton(label,icon,callback,cls){
 const node=button(label,callback,'header-action '+cls);
 const paths={
  unplug:[
   'm19 5 3-3', 'm2 22 3-3',
   'M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z',
   'M7.5 13.5 10 11', 'M10.5 16.5 13 14',
   'm12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z',
  ],
  refresh:['M3 10a9 9 0 0 1 15-6l3 3','M21 3v4h-4','M21 14a9 9 0 0 1-15 6l-3-3','M3 21v-4h4'],
  'archive-arrow-up':['M3 5h18v4H3z','M5 9v11h14V9','M12 17v-5','m9 15 3-3 3 3'],
  search:['M21 21l-4.34-4.34','M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'],
  'refresh-cw':['M3 10a9 9 0 0 1 15-6l3 3','M21 3v4h-4','M21 14a9 9 0 0 1-15 6l-3-3','M3 21v-4h4'],
  'log-out':['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','M16 17l5-5-5-5','M21 12H9']
 };
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false','data-icon':icon}))svg.setAttribute(key,value);
 for(const d of paths[icon]){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}
 node.append(svg);return node;
}
const inspectButton=onClick=>headerButton('İncele','search',onClick,'small primary inspect-button');
function renderHeader(){return el('header',{class:'top'},el('div',{class:'brand'},el('div',{class:'logo'},'S'),el('div',{},el('h1',{},'Stok Asist'),el('p',{class:'muted'},'Lisans Yönetimi')),el('span',{class:'tag'},'Üretim')),
 state.token?el('div',{class:'row'},el('span',{class:'muted'},state.email||'Yönetici'),headerButton('Hizmet Kontrolü','unplug',()=>action(checkHealth),'primary'),headerButton('Yenile','refresh-cw',()=>action(refresh),'primary'),headerButton('Çıkış Yap','log-out',()=>action(async()=>{if(!preview)await request('admin-logout',{});state.token='';state.data=null;await showRecords(false,0);state.notice='Oturum kapatıldı.';}),'header-danger')):null);}
function renderLogin(){const address=input('email','',{required:true,autocomplete:'email',placeholder:'Yönetici e-posta adresiniz'});
 const form=el('form',{class:'stack'},el('h2',{},'Yönetici Girişi'),el('p',{class:'muted'},'İzin verilen adresinize tek kullanımlık giriş bağlantısı gönderilir.'),field('E-posta adresi',address),el('button',{type:'submit',class:'primary',disabled:state.busy},'Giriş Bağlantısı Gönder'));
 form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{await request('admin-login',{email:address.value});state.notice='Adresiniz yetkiliyse giriş bağlantısı e-postanıza gönderilir. Gelen kutunuzu ve istenmeyen postayı kontrol edin.';state.error=false;});});return el('div',{class:'login'},card(form,el('p',{class:'muted'},'Bu panel kurumun stok veya rapor içeriklerini görüntülemez.')));}
function renderLink(){if(linkKind==='profile')return card(el('h2',{},'Yeni e-posta adresinizi doğrulayın'),el('p',{},'Doğrulama sonrasında profil değişikliği yönetici onayına sunulur.'),button('E-posta Adresini Doğrula',()=>action(async()=>{await request('confirm-profile-email',{token:linkToken});linkToken=null;state.notice='E-posta doğrulandı. Değişiklik yönetici onayını bekliyor.';})));const title=linkKind==='admin'?'Yönetici girişini tamamlayın':linkKind==='recover'?'Yeni ürün anahtarı isteyin':'Başvurunuzu tamamlayın';const message=el('textarea',{required:true,maxlength:2000});
 return el('div',{class:'login'},card(el('h2',{},title),el('p',{class:'muted'},'Bağlantı yalnız bir kez kullanılabilir. İşlem düğmeye bastığınızda gerçekleşir.'),
 linkKind==='info'?field('İstenen ek bilgiler',message):null,button(linkKind==='admin'?'Girişi Tamamla':linkKind==='recover'?'Yeni Anahtar Gönder':'Bilgileri Gönder',()=>action(async()=>{
 if(!linkToken)throw Error(errors.invalid_token);
 if(linkKind==='admin'){const session=await request('admin-complete',{token:linkToken});linkToken=null;state.token=session.access_token;state.email=session.email;await showRecords(false,0);state.notice='Yönetici girişi tamamlandı.';await refresh();}
 else{await request(linkKind==='recover'?'complete-recovery':'complete-info',{token:linkToken,operation_id:crypto.randomUUID(),...(linkKind==='info'?{message:message.value}:{})});linkToken=null;state.notice=linkKind==='recover'?'Yeni anahtar e-posta gönderim kuyruğuna alındı.':'Bilgiler aynı başvuruya kaydedildi.';}
 }), 'primary')));}
function archiveButton(row){
 if(preview)return null;
 const recordKind=state.tab;
 const archive=!state.archived;
 const label=archive?'Arşivle':'Arşivden Çıkar';
 const name=row.institution_name??row.institution??row.original?.institution_name??row.name??row.email;
 const confirm=()=>modal(label,[
  el('p',{},el('strong',{},name),el('br'),row.email??row.original?.email),
  el('p',{class:'muted'},archive?'Kayıt ana listeden Arşivlenenler görünümüne taşınır. Lisanslar, indirme bağlantıları ve işlem geçmişi korunur.':'Kayıt ana listede yeniden görünür.'),
 ],label,async()=>{
  await request('admin-records',{action:'archive',record_kind:recordKind,record_id:row.id,archive});
  closeRecord();
  state.offset=0;
  state.notice=archive?'Kayıt arşivlendi.':'Kayıt arşivden çıkarıldı.';
  state.error=false;
  await refresh();
 });
 return archive?headerButton(label,'archive-arrow-up',confirm,'small archive-button archive-primary'):
  button(label,confirm,'small archive-button');
}
function recordFilters(){
 if(preview)return null;
 return el('div',{class:'row record-filters',role:'group','aria-label':'Kayıt görünümü'},
  ...[[false,'Kayıtlar'],[true,'Arşivlenenler']].map(([archived,label])=>el('button',{
   type:'button',class:'small','aria-pressed':String(state.archived===archived),disabled:state.busy,
   onClick:()=>{if(state.archived!==archived)action(()=>showRecords(archived,0));},
  },label)));
}
function recordPagination(rows){
 const hasNext=rows.length>pageSize;
 if(!state.offset&&!hasNext)return null;
 return el('nav',{class:'row','aria-label':'Kayıt sayfaları'},
  state.offset?button('Önceki Sayfa',()=>action(()=>showRecords(state.archived,state.offset-pageSize)),'small'):null,
  el('span',{class:'muted'},'Sayfa '+(state.offset/pageSize+1)),
  hasNext?button('Sonraki Sayfa',()=>action(()=>showRecords(state.archived,state.offset+pageSize)),'small'):null);
}
function emptyRecords(message){
 return el('p',{class:'empty'},state.archived?'Arşivlenmiş kayıt bulunmuyor.':message);
}
async function loadLicenseDetail(row){
 const id=state.tab==='licenses'?row.id:row.license_id;
 state.detail=id?await request('admin',{action:'detail',input:{license_id:id}}):null;
}
function table(rows){
 const requests=state.tab==='requests';
 const headers=requests?['Kurum / Sorumlu','Durum','Başvuru']:['Kurum / Sorumlu','Lisans','Cihaz'];
 return el('div',{class:'scroll',tabindex:'0','aria-label':'Lisans kayıtları'},
  el('table',{class:'installation-table'},
   el('thead',{},el('tr',{},...headers.map(h=>el('th',{},h)),el('th',{},'İşlem'))),
   el('tbody',{},...rows.map(row=>{
    const inspect=inspectButton(()=>action(async()=>{
     state.selected=row;
     if(preview){state.detail={devices:[{id:'sample-device',device_name:'Eczane Bilgisayarı',short_id:'ornek-cihaz',os_name:'Windows',app_version:'Test',last_checked_at:'2026-11-02T09:00:00Z',active:true}],emails:[{id:'sample-mail',status:'failed',created_at:'2026-11-02T09:00:00Z'}]};return;}
     state.detail=null;
     await loadLicenseDetail(row);
    }));
    return el('tr',{class:state.selected?.id===row.id?'selected':''},
     el('td',{},el('strong',{},row.institution_name),el('div',{class:'muted'},row.email)),el('td',{},pill(row.status??row.lifecycle)),
     el('td',{},requests?fmt(row.created_at):`${row.active_devices} / ${row.device_limit}`),
     el('td',{},el('div',{class:'row record-actions'},inspect,archiveButton(row))));
   }))));
}
function requestDetail(row){const message=el('textarea',{maxlength:2000},row.user_message??'');const note=el('textarea',{maxlength:2000},row.admin_note??'');const until=input('date');const slots=input('number','2',{min:1,max:100});
 return card(el('h2',{},row.institution_name),el('div',{class:'meta'},el('div',{},row.first_name+' '+row.last_name),el('div',{},row.email),el('div',{},row.city+' · '+row.role_name),pill(row.status)),
 field('Kullanıcıya mesaj',message),field('Yönetici notu',note),el('div',{class:'two'},field('Son geçerli gün (Türkiye)',until),field('Cihaz sınırı',slots)),el('p',{class:'muted'},'Tarih boş bırakılırsa onay anından itibaren 90 gün pilot verilir.'),
 el('div',{class:'actions'},...(['pending','needs_info'].includes(row.status)?[
 button('Başvuruyu Onayla',()=>action(()=>operate('approve',{request_id:row.id,message:message.value,admin_note:note.value,device_limit:Number(slots.value),...(until.value?{valid_until:dayEnd(until.value)}:{})})),'primary'),
 button('Ek Bilgi İste',()=>action(()=>operate('needs_info',{request_id:row.id,message:message.value,admin_note:note.value}))),
 button('Reddet',()=>action(()=>operate('reject',{request_id:row.id,message:message.value,admin_note:note.value})),'danger')]:[el('p',{class:'muted'},'Bu başvuru sonuçlandırılmış. Lisans işlemleri için Lisanslar bölümünü kullanın.')])));
}
function downloadOffline(){
 const response=state.offline?.response;if(!response)return;
 const filename=offlineDownloadName(response);
 const url=URL.createObjectURL(new Blob([JSON.stringify(response)],{type:'application/json'}));
 const link=el('a',{href:url,download:filename});document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
 notice('Yanıt dosyasının indirmesi başlatıldı. Aynı dosyayı ilgili bilgisayara taşıyın.');
}
function offlineSection(row){
 const current=state.offline?.licenseId===row.id?state.offline:null;
 const chooser=input('file','',{accept:'.stoklicreq',disabled:state.busy,'aria-label':'Lisans talep dosyası'});
 chooser.addEventListener('change',()=>{
  const file=chooser.files?.[0];if(!file)return;
  action(async()=>{
   state.offline=null;
   const raw=await readRequestFile(file);
   if(preview)throw Error('Önizleme dosyayı sunucuya göndermez.');
   const result=await request('admin-offline-preview',{license_id:row.id,request_file:raw});
   state.offline={licenseId:row.id,raw,preview:result,response:null};
   state.notice='Talep dosyasının imzası doğrulandı. Kurum ve cihaz bilgilerini inceleyin; henüz onay verilmedi.';state.error=false;
  });
 });
 const p=current?.preview;
 const review=p?el('div',{class:'offline-summary stack'},
  el('p',{},p.operation==='activate'?'Yeni cihaz aktivasyonu':'Cihaz doğrulamasını yenileme'),
  el('p',{class:'code'},'Cihaz: '+p.installation_id),
  el('p',{class:'code'},'Talep: '+p.request_id),
  el('p',{class:'code'},'Cihaz anahtar izi: '+p.device_key_fingerprint),
  p.activation_id?el('p',{class:'code'},'Aktivasyon: '+p.activation_id):null,
  el('p',{class:'muted'},'Dosyanın öz imzası kurum yetkisini kanıtlamaz. Bu cihazın seçili kuruma ait olduğunu kontrol edin. İlk anahtar kaydı da bu onayla yapılır; kayıtlı anahtar değiştirilemez.'),
  current.response?el('div',{class:'row'},button('İmzalı Yanıtı İndir',downloadOffline,'primary')):
   button('Talebi İncele ve Onayla',()=>{
    const reviewed=current;
    modal('Kapalı Ağ Lisans Talebini Onayla',[
     el('p',{},row.institution_name+' · '+row.email),
     el('p',{},p.operation==='activate'?'Yeni cihaz bu lisansın kotasına eklenecek.':'Mevcut cihazın doğrulama izni yenilenecek.'),
     el('p',{class:'code'},'Cihaz: '+p.installation_id),
     el('p',{class:'code'},'Talep: '+p.request_id),
     el('p',{class:'code'},'Anahtar izi: '+p.device_key_fingerprint),
     el('p',{class:'muted'},'İzin, sunucu doğrulamasından itibaren en fazla 30 gündür; lisans daha erken biterse o tarih geçerlidir. Aynı talep tekrarlandığında yeni süre veya cihaz oluşturulmaz.')
    ],'Cihazı ve Kurumu Doğruladım, Onayla',async()=>{
     if(preview){notice('Salt okunur önizleme: onay gönderilmedi.');return;}
     const response=await request('admin-offline',approvalPayload(row.id,reviewed.raw));
     offlineDownloadName(response);
     if(response.request_id!==p.request_id)throw Error('Yanıt bu taleple eşleşmiyor. Aynı taleple tekrar deneyin.');
     reviewed.response=response;state.offline=reviewed;
     state.notice='Onay kaydedildi. İmzalı yanıtı indirip talebi oluşturan bilgisayara yükleyin.';state.error=false;
     await refresh();
    });
   },'primary')):null;
 return el('section',{class:'stack'},el('h3',{},'Kapalı Ağ Dosya İşlemi'),
  el('p',{class:'muted'},'Bu lisansa ait bilgisayarda üretilmiş talep dosyasını seçin. Dosyayı seçmek cihazı etkinleştirmez.'),
  field('Talep dosyası (.stoklicreq)',chooser),review);
}
function reviewLicenseUpdate(title,items,operation,values){
 const note=el('textarea',{maxlength:2000,rows:3});
 modal(title,[...items,field('Yönetici Notu (isteğe bağlı, e-postada görünür)',note)],'E-postayı Önizle',async()=>{
  if(preview){notice('Salt okunur önizleme: sunucuya işlem gönderilmedi.');return;}
  const input={...values(),notification_note:note.value};
  const review=await request('admin',{action:operation,input,preview:true});
  if(review.no_changes){notice('Değişen bilgi yok. E-posta gönderilmedi.');return;}
  const content=el('textarea',{readonly:true,rows:10,'aria-label':'Lisans değişikliği e-postası'},review.text);
  modal('Lisans Değişikliği E-postası',[el('p',{},'Alıcı: '+review.recipient),field(review.subject,content)],'Değişikliği Onayla',
   ()=>operate(operation,{...input,expected_update:review.expected_update}));
 });
}
function licenseDetail(row){const detail=state.detail??{devices:[],emails:[]};return card(el('h2',{},row.institution_name),el('div',{class:'meta'},el('div',{},row.email),el('div',{},labels[row.plan]??row.plan),el('div',{},'Geçerlilik: '+fmt(row.valid_until)),pill(row.lifecycle)),
 el('div',{class:'row'},button('Süreyi Uzat',()=>{const until=input('date','',{required:true});modal('Lisans Süresini Uzat',[field('Yeni son geçerli gün (Türkiye)',until)],'Uzatmayı Onayla',()=>operate('extend',{license_id:row.id,valid_until:dayEnd(until.value)}));}),
 button(row.lifecycle==='revoked'?'İptali Geri Al':'Lisansı İptal Et',()=>confirmAction(row.lifecycle==='revoked'?'restore':'revoke',{license_id:row.id},row.lifecycle==='revoked'?'İptali Geri Al':'Lisansı İptal Et',`${row.institution_name} · ${row.active_devices} etkin cihaz. Yeni hesaplama yetkisi, doğrulanmış iptal bilgisini alan cihazlarda durur.`),'danger')),
 el('div',{class:'row'},button('Sorumlu E-postasını Değiştir',()=>{const value=input('email','',{required:true});reviewLicenseUpdate('Sorumlu E-postası',[el('p',{},'Yalnız bu lisansın sorumlu bağı değişir.'),field('Yeni e-posta',value)],'change_email',()=>({license_id:row.id,email:value.value}));}),
 button('Başka Kuruma Taşı',()=>{const value=input('text','',{required:true,maxlength:200});reviewLicenseUpdate('Lisansın Kurum Bağını Değiştir',[el('p',{},'Yerel kurum verileri taşınmaz, silinmez veya birleştirilmez.'),field('Yeni kurum adı',value)],'change_institution',()=>({license_id:row.id,institution_name:value.value}));})),
 el('div',{class:'row'},button('Kurum Bilgilerini Düzelt',()=>{
  const name=input('text',row.institution_name,{required:true,maxlength:200});
  const city=input('text',row.city??'',{maxlength:80});
  reviewLicenseUpdate('Kurum Adı ve Şehir',[field('Kurum adı',name),field('Şehir',city)],
   'correct_institution',()=>({license_id:row.id,institution_name:name.value,city:city.value}));
 })),
 offlineSection(row),
 el('h3',{},'Uzatma Talepleri'),el('div',{class:'list'},...(detail.extension_requests??[]).map(ext=>el('div',{class:'mail'},pill(ext.status),el('p',{class:'muted'},fmt(ext.created_at)),ext.status==='pending'?button('Talebi Reddet',()=>{const reason=el('textarea',{required:true,maxlength:2000});modal('Uzatma Talebini Reddet',[field('Kullanıcıya gerekçe',reason)],'Reddi Onayla',()=>operate('reject_extension',{extension_id:ext.id,reason:reason.value}));},'small'):null))),
 el('h3',{},'Cihazlar'),el('div',{class:'list'},...(detail.devices.length?detail.devices.map(d=>el('div',{class:'device stack'},el('strong',{},d.device_name||'Adlandırılmamış cihaz'),el('p',{class:'muted'},d.short_id+' · '+d.os_name+' · '+d.app_version),el('p',{class:'muted'},'Son doğrulama: '+fmt(d.last_checked_at)),el('div',{class:'row'},pill(d.active?'active':'revoked'),d.active?button('Cihazı Pasifleştir',()=>confirmAction('deactivate_device',{activation_id:d.id},'Cihazı Pasifleştir',`${d.device_name||d.short_id}: çevrimdışı cihazın mevcut izni bitene kadar çalışabileceğini unutmayın.`),'small'):null))):[el('p',{class:'muted'},'Etkinleştirilmiş cihaz yok.')])),
 el('h3',{},'E-posta Geçmişi'),el('div',{class:'list'},...(detail.emails.length?detail.emails.map(mail=>el('div',{class:'mail'},el('div',{class:'row'},pill(mail.status),el('span',{class:'muted'},fmt(mail.created_at)),['failed','pending','sent'].includes(mail.status)?button('Yeniden Gönder',()=>action(()=>operate('retry_email',{email_job_id:mail.id})),'small'):null))):[el('p',{class:'muted'},'Gönderim kaydı yok.')])));
}
const profileLabels={institution_name:'Kurum',city:'Şehir',beds:'Yatak sayısı',first_name:'İsim',last_name:'Soyisim',role_name:'Görev',email:'E-posta'};
async function decideProfile(actionName,row,details={}){
 const key=JSON.stringify(['profile',actionName,row.id,details]);
 const operation=pending.get(key)??crypto.randomUUID();pending.set(key,operation);
 const result=await request('admin-profile',{action:actionName,input:{operation_id:operation,change_id:row.id,...details}});
 pending.delete(key);
 state.notice=result.status==='needs_review'?'Onaylı bilgiler değişmiş. Kullanıcı güncel bilgilerle yeni talep oluşturmalı.':'Profil talebi kaydedildi.';
 if(result.mail?.status==='failed')state.notice+=' Karar kaydedildi; bilgilendirme e-postası gönderilemedi. Lisansın gönderim geçmişinden yeniden deneyebilirsiniz.';
 state.error=result.mail?.status==='failed';await refresh();
}
function profileChangeDetail(row){
 return card(el('h2',{},'Profil Değişiklik Talebi'),pill(row.status),
  el('p',{},row.original.institution_name+' · '+row.original.email),
  el('p',{class:'muted'},'Talep cihazı: '+row.activation_id+' · '+fmt(row.created_at)),
  el('div',{class:'list'},...Object.entries(profileLabels).filter(([key])=>row.original[key]!==row.proposed[key]).map(([key,label])=>
   el('div',{class:'stack'},el('strong',{},label),el('span',{},'Mevcut: '+(row.original[key]||'Boş')),el('span',{},'Talep: '+(row.proposed[key]||'Boş'))))),
  el('p',{class:'muted'},row.explanation||'Açıklama eklenmedi.'),row.reason?el('p',{},row.reason):null,
  el('p',{class:'muted'},'Kurum kimliği korunarak düzeltme yapılır. Başka hastaneye geçiş için talebi reddedip kurum taşıma akışını kullanın.'),
  ['pending','pending_email'].includes(row.status)?el('div',{class:'row'},
   row.status==='pending'?button('Talebi Onayla',()=>{
    const note=el('textarea',{maxlength:2000,rows:3});
    modal('Profil Değişikliğini Onayla',[
     el('p',{},'Kurum alanları aynı kurum kimliğine bağlı diğer lisanslara da yansır. Onaylanan değişiklikler kullanıcıya e-postayla iletilir.'),
     field('Yönetici Notu (isteğe bağlı, e-postada görünür)',note)],
    'Onayla',()=>decideProfile('approve',row,{notification_note:note.value}));
   }):el('p',{},'Yeni e-posta adresinin doğrulanması bekleniyor.'),
   button('Talebi Reddet',()=>{const reason=el('textarea',{required:true,maxlength:2000});modal('Profil Talebini Reddet',[field('Kullanıcıya iletilecek gerekçe',reason)],'Reddet',()=>decideProfile('reject',row,{reason:reason.value}));},'danger')):null);
}
function profileChangeList(rows){return el('div',{class:'list'},...rows.map(row=>el('div',{class:'device'},
 el('strong',{},row.original.institution_name),el('p',{},row.original.email),el('div',{class:'row profile-list-actions'},pill(row.status),
 el('div',{class:'row record-actions'},inspectButton(()=>{state.selected=row;render();}),archiveButton(row))))));}
async function loadInstallations(){
 if(preview){state.installReleases=[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',version:'Örnek Test Sürümü',filename:'Ornek-Test.exe'}];state.installHistory=[];state.data.installations=[{id:'example-install',name:'Deniz Örnek',institution:'Örnek Eğitim ve Araştırma Hastanesi',email:'ornek@example.invalid',status:['pending','approved','rejected'].includes(new URL(location.href).searchParams.get('install_status'))?new URL(location.href).searchParams.get('install_status'):'pending',created_at:'2026-11-21T10:00:00Z'}];return;}
 state.installReleases=(await request('admin-installations',{action:'catalog'})).releases;
}
async function loadInstallationHistory(){
 state.installEmails=[];
 if(preview){
  state.installRevocationAvailable=true;
  state.installHistory=(new URL(location.href).searchParams.get('install_history')==='1'?[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',release_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',new_link:false,version:'Örnek Test Sürümü',created_at:'2026-11-21T10:00:00Z',expires_at:new Date(Date.now()+86400000).toISOString(),status:'prepared'},{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',version:'Örnek Test Sürümü',created_at:'2026-11-20T10:00:00Z',expires_at:'2026-11-27T10:00:00Z',status:'failed',email_job_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]:[]);
  return;
 }
 const result=await request('admin-installations',{action:'history',request_id:state.selected.id});
 state.installHistory=result.deliveries;
 state.installEmails=result.emails??[];
 state.installRevocationAvailable=result.revocation_available===true;
}
async function previewInstallation(newLink,existingOperation){
 const row=state.selected,release=(state.installReleases??[]).find(r=>r.id===state.installRelease);
 if(!release)return;
 const key=JSON.stringify(['install',row.id,release.id,newLink,row.decision_revision??0]);
 const operation=existingOperation??pending.get(key)??crypto.randomUUID();pending.set(key,operation);
 const input={operation_id:operation,request_id:row.id,release_id:release.id,new_link:newLink};
 const response=preview?{subject:'Stok Asist — Kurulum bağlantınız hazır',text:'Sayın '+row.name+',\n\nKurulum erişimi talebiniz onaylandı.\n\nSürüm: '+release.version+'\nBağlantı 7 gün geçerlidir.\n\nDosyayı İndir: https://example.invalid/ornek-baglanti\n\nStok Asist\nHastane ilaç envanteri yönetim asistanı\ndestek@stokasist.com'}:await request('admin-installations',{action:'preview',...input});
 if(response.already_queued){notice('Bu işlem daha önce kaydedildi. Gönderim geçmişini kontrol edin.');await loadInstallationHistory();return;}
 if(!preview)await loadInstallationHistory();
 const text=el('textarea',{readonly:true,rows:12,'aria-label':'E-posta önizlemesi'},response.text);
 modal('Kurulum Bağlantısı Önizlemesi',[el('p',{},'Alıcı: '+row.email),el('p',{},'Sürüm: '+release.version),field(response.subject,text),el('p',{class:'muted'},'Link 7 gün geçerlidir. Kurulum erişimi onaylanır; lisans oluşturulmaz.')], 'Onayla ve Gönder',async()=>{
 if(preview){notice('Salt okunur önizleme: e-posta gönderilmedi.');return;}
 const result=await request('admin-installations',{action:'send',...input,template_revision:response.template_revision});pending.delete(key);
 state.notice=result.mail?.status==='sent'?'Kurulum erişimi onaylandı; e-posta sağlayıcı tarafından kabul edildi.':'Kurulum erişimi onaylandı; gönderim tamamlanamadı. Gönderim geçmişinden yeniden deneyebilirsiniz.';
 state.error=result.mail?.status!=='sent';await refresh();
 });
}
function revokeInstallationLink(item){
 const requestId=state.selected.id;
 modal('İndirme Bağlantısını İptal Et',[el('p',{},'Bu bağlantı artık dosyayı indirmek için kullanılamayacak. Gerekirse yeni bir bağlantı oluşturabilirsin.')], 'Bağlantıyı İptal Et',async()=>{
  if(preview){notice('Salt okunur önizleme: bağlantı iptal edilmedi.');return;}
  await request('admin-installations',{action:'revoke',request_id:requestId,delivery_id:item.id});
  await loadInstallationHistory();
  notice('İndirme bağlantısı iptal edildi.');
 });
}
function installationHistoryItem(item){
 const active=!item.revoked_at&&item.status!=='superseded'&&Date.parse(item.expires_at)>Date.now();
 const status=item.revoked_at?'Bağlantı iptal edildi':labels[item.status]??({prepared:'Önizleme hazır',superseded:'Önizleme geçersiz',expired:'Süresi doldu'}[item.status]??item.status);
 let mailAction=null;
 if(!item.revoked_at&&item.status==='prepared')mailAction=button('Hazırlanan Linki Önizle',()=>{state.installRelease=item.release_id;action(()=>previewInstallation(item.new_link,item.id));},'small');
 if(!item.revoked_at&&['failed','pending','sent'].includes(item.status))mailAction=button('E-postayı Yeniden Dene',()=>action(async()=>{
  if(preview){notice('Salt okunur önizleme.');return;}
  await operate('retry_email',{email_job_id:item.email_job_id});
 }),'small');
 const revokeAction=active&&state.installRevocationAvailable?button('Linki İptal Et',()=>revokeInstallationLink(item),'small danger'):null;
 return el('div',{class:'mail install-history-item'},el('p',{},item.version+' · '+status),
  el('p',{class:'muted'},fmt(item.created_at)+' · Son geçerlilik: '+fmt(item.expires_at)),
  mailAction||revokeAction?el('div',{class:'row install-history-actions'},mailAction,revokeAction):null);
}
function installationDeliveryControls(){
 const releases=state.installReleases??[],history=state.installHistory??[],row=state.selected;
 const reviewed=history.some(item=>item.status!=='superseded');
 return el('div',{class:'stack'},row.status!=='rejected'?el('div',{class:'stack'},el('h3',{},'Kurulum Sürümü'),
 releases.length?el('div',{class:'list',role:'group','aria-label':'Kurulum sürümleri'},...releases.map(release=>el('button',{type:'button',disabled:state.busy,'aria-pressed':String(state.installRelease===release.id),class:'install-release'+(state.installRelease===release.id?' primary':''),onClick:()=>{state.installRelease=release.id;render();}},release.version+' · '+release.filename))):el('p',{class:'muted'},'Gönderime açık, onaylı kurulum sürümü bulunmuyor.'),
 releases.length?el('button',{type:'button',class:'primary',disabled:state.busy||!state.installRelease,onClick:()=>action(()=>previewInstallation(reviewed))},reviewed?'Yeni Link Oluştur ve Önizle':'Linki Önizle'):null):null,
 el('h3',{},'Gönderim Geçmişi'),history.length?el('div',{class:'list'},...history.map(installationHistoryItem)):el('p',{class:'muted'},'Henüz gönderim kaydı bulunmuyor.'));
}
function reviewInstallationDecision(row,kind){
 const needsInfo=kind==='needs_info';
 const message=el('textarea',{required:true,maxlength:2000,rows:5});
 modal(needsInfo?'Kurulum Talebi İçin Ek Bilgi İste':'Kurulum Talebini Reddet',[
  el('p',{class:'muted'},'Alıcı: '+row.email),
  field(needsInfo?'Talep Detayı':'Gerekçe Notu',message),
 ],needsInfo?'Ek Bilgi Talebini Gönder':'Ret Bildirimini Gönder',async()=>{
  if(preview){notice('Salt okunur önizleme: e-posta gönderilmedi.');return;}
  const expected_revision=row.decision_revision??0;
  const key=JSON.stringify(['install-decision',kind,row.id,expected_revision,message.value.trim()]);
  const operation_id=pending.get(key)??crypto.randomUUID();pending.set(key,operation_id);
  const result=await request('admin-installations',{action:kind,operation_id,request_id:row.id,expected_revision,message:message.value});
  pending.delete(key);
  const sent=result.mail?.status==='sent';
  state.notice=sent?'Karar kaydedildi ve e-posta gönderildi.':'Karar kaydedildi. E-posta gönderim durumunu Bildirim Geçmişi’nde kontrol edebilirsiniz.';
  state.error=!sent;
  await refresh();
 });
}
function installationEmailHistory(){
 const titles={install_received:'Talep alındı',install_needs_info:'Ek bilgi istendi',install_rejected:'Talep reddedildi'};
 const emails=state.installEmails??[];
 return el('div',{class:'stack'},el('h3',{},'Bildirim Geçmişi'),
  emails.length?el('div',{class:'list'},...emails.map(item=>el('div',{class:'mail install-history-item'},
   el('p',{},titles[item.kind]+' · '+(labels[item.status]??item.status)),
   el('p',{class:'muted'},fmt(item.created_at)),
   item.can_retry?button('Bildirimi Yeniden Dene',()=>action(async()=>{
    const result=await request('admin-installations',{action:'retry_request_email',request_id:state.selected.id,email_job_id:item.email_job_id});
    const sent=result.mail?.status==='sent';
    state.notice=sent?'Bildirim gönderildi.':'Bildirim gönderilemedi.';
    state.error=!sent;
    await loadInstallationHistory();
   }),'small'):null))):el('p',{class:'muted'},'Henüz bildirim kaydı bulunmuyor.'));
}
const installationPill=status=>pill(status,'install-state');
function renderInstallations(){
 const rows=visibleRows();
 const selected=state.selected;
 return el('div',{class:'grid'},card(el('h2',{},'Kurulum Talepleri'),el('p',{class:'muted'},'Kurulum erişimi talepleri lisans başvurularından ayrıdır.'),
 headerButton('Listeyi Yenile','refresh',()=>action(refresh),'small primary'),recordFilters(),
 rows.length?el('div',{class:'scroll',tabindex:'0','aria-label':'Kurulum kayıtları'},
  el('table',{class:'installation-table'},
   el('thead',{},el('tr',{},...['Kurum / Başvuran','Durum','Başvuru','İşlem'].map(t=>el('th',{},t)))),
   el('tbody',{},...rows.slice(0,pageSize).map(row=>{
    const inspect=inspectButton(()=>{closeRecord();state.selected=row;action(loadInstallationHistory);});
    return el('tr',{},
     el('td',{},el('strong',{},row.institution),el('div',{},row.name),el('div',{class:'muted'},row.email)),
     el('td',{},installationPill(row.status)),el('td',{},fmt(row.created_at)),
     el('td',{},el('div',{class:'row record-actions'},inspect,archiveButton(row))));
   })))):emptyRecords('Henüz kurulum talebi bulunmuyor.'),recordPagination(rows)),
 selected?card(el('h2',{},selected.institution),el('div',{class:'meta'},el('p',{},selected.name),el('p',{},selected.email),installationPill(selected.status),el('p',{},fmt(selected.created_at))),el('p',{class:'muted'},'Bu talep kurulum dosyasına erişim içindir. Lisans başvurusu uygulama üzerinden ayrıca alınır.'),
 ['pending','needs_info'].includes(selected.status)?el('div',{class:'row'},
  button('Ek Bilgi İste',()=>reviewInstallationDecision(selected,'needs_info')),
  button('Talebi Reddet',()=>reviewInstallationDecision(selected,'reject'),'danger')):null,
 installationDeliveryControls(),installationEmailHistory()):card(el('h2',{},'Talep Ayrıntısı'),el('p',{class:'empty'},'İncelemek istediğiniz kurulum talebini seçin.')));
}
function selectMailTemplate(kind){
 const template=state.mailTemplates?.find(item=>item.kind===kind);
 state.mailDraft=template?{...template}:null;
 state.mailPreview=null;
}
async function loadMailTemplates(){
 if(preview)return;
 state.mailTemplates=(await request('admin-mail-templates',{action:'list'})).templates;
 selectMailTemplate(state.mailDraft?.kind??state.mailTemplates[0]?.kind);
}
function mailPreviewContent(mail){
 if(!mail)return [el('p',{class:'empty'},'Örnek verilerle e-postayı önizleyebilirsiniz.')];
 return [
  el('p',{},mail.subject),
  el('iframe',{class:'mail-preview-frame',title:'HTML e-posta önizlemesi',sandbox:'',referrerpolicy:'no-referrer',srcdoc:mail.html}),
  el('details',{},el('summary',{},'Düz metin'),el('textarea',{'aria-label':'Düz metin önizlemesi',readonly:true,rows:8,value:mail.text})),
 ];
}
function renderMailTemplates(){
 const draft=state.mailDraft;
 if(!draft)return card(el('h2',{},'E-posta Şablonları'),el('p',{class:'muted'},preview?'Şablonları düzenlemek için yönetici girişi gerekir.':
  state.busy?'Şablonlar yükleniyor.':'Şablonlar alınamadı. Yenile ile tekrar deneyin.'));
 const selector=el('select',{id:'mail-template-kind',disabled:state.busy},
  ...state.mailTemplates.map(item=>el('option',{value:item.kind,selected:item.kind===draft.kind},item.title)));
 selector.addEventListener('change',()=>{selectMailTemplate(selector.value);render();document.getElementById('mail-template-kind')?.focus();});
 const subject=input('text',draft.subject,{required:true,maxlength:160,disabled:state.busy});
 const body=el('textarea',{value:draft.body,required:true,maxlength:4000,rows:8,disabled:state.busy});
 const sample=card(el('h2',{},'Önizleme'),...mailPreviewContent(state.mailPreview));
 const send=async(save)=>{
  const payload={kind:draft.kind,subject:subject.value,body:body.value};
  if(save){
   const saved=await request('admin-mail-templates',{action:'save',...payload,expected_revision:draft.revision});
   Object.assign(state.mailTemplates.find(item=>item.kind===draft.kind),saved);
   selectMailTemplate(draft.kind);
   notice('Şablon kaydedildi.');
  }else state.mailPreview=await request('admin-mail-templates',{action:'preview',...payload});
 };
 function keepDraft(){
  draft.subject=subject.value;
  draft.body=body.value;
  if(state.mailPreview){state.mailPreview=null;sample.replaceChildren(el('h2',{},'Önizleme'),...mailPreviewContent(null));}
 }
 subject.addEventListener('input',keepDraft);
 body.addEventListener('input',keepDraft);
 const form=el('form',{class:'stack'},field('Konu',subject),field('E-posta metni',body),
  el('div',{class:'row'},button('E-postayı Önizle',()=>{if(form.reportValidity())action(()=>send(false));}),
   el('button',{class:'primary',type:'submit',disabled:state.busy},'Şablonu Kaydet')));
 form.addEventListener('submit',event=>{event.preventDefault();action(()=>send(true));});
 return el('div',{class:'grid'},card(el('h2',{},'E-posta Şablonları'),field('Şablon',selector),
  el('p',{class:'muted'},draft.revision?'Sürüm '+draft.revision:'Varsayılan metin'),
  el('p',{class:'muted'},'Ürün anahtarı, tarihler, işlem bağlantıları, simgeler ve imza otomatik eklenir.'),form),sample);
}
function renderDashboard(){
 const count=tab=>state.data?.pending_counts?.[tab]??(preview?state.data?.[tab]?.filter(row=>row.status==='pending').length??0:0);
 const rows=visibleRows();
 const displayed=rows.slice(0,pageSize);
 const tabs=[['installations',`Kurulum Talepleri (${count('installations')})`],['requests',`Başvurular (${count('requests')})`],['licenses',`Lisanslar (${count('licenses')})`],['profile_changes',`Profil Talepleri (${count('profile_changes')})`],['mail_templates','E-posta Şablonları']];
 const navigation=el('nav',{class:'row tabs','aria-label':'Yönetim bölümleri'},...tabs.map(([tab,label])=>el('button',{
  type:'button','aria-selected':String(state.tab===tab),disabled:state.busy,onClick:()=>action(async()=>{
   state.tab=tab;
   await showRecords(false,0);
   if(tab==='installations')await loadInstallations();
   if(tab==='mail_templates')await loadMailTemplates();
  }),
 },label)));
 if(state.tab==='installations')return el('div',{},navigation,renderInstallations());
 if(state.tab==='mail_templates')return el('div',{},navigation,renderMailTemplates());
 const title=state.tab==='requests'?'Lisans Başvuruları':state.tab==='licenses'?'Kurum Lisansları':'Profil Değişiklik Talepleri';
 return el('div',{},navigation,el('div',{class:'grid'},
  card(el('h2',{},title),el('p',{class:'muted'},new Intl.DateTimeFormat('tr-TR',{timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date())),
   recordFilters(),displayed.length?
   (state.tab==='profile_changes'?profileChangeList(displayed):table(displayed)):emptyRecords('Henüz kayıt bulunmuyor.'),recordPagination(rows)),
  state.selected?(state.tab==='requests'?requestDetail(state.selected):state.tab==='licenses'?licenseDetail(state.selected):profileChangeDetail(state.selected)):
   card(el('h2',{},'Kayıt Ayrıntısı'),el('p',{class:'empty'},'İncelemek istediğiniz kaydı seçin.'))));
}
function render(){app.replaceChildren(renderHeader(),el('main',{class:'wrap'},preview?el('p',{class:'preview'},'Yerel salt okunur taslak · örnek veriler'):null,state.notice?el('div',{class:'notice'+(state.error?' error':''),role:state.error?'alert':'status'},state.notice):null,
 linkToken?renderLink():state.token?renderDashboard():renderLogin(),el('p',{class:'footer'},'Stok Asist · Kurum verileri cihazda kalır. Bu panel lisans yönetimi içindir.')));}
if(preview){state.token='preview';state.email='Örnek yönetici';state.data={requests:[{id:'sample-request',institution_name:'Örnek Eğitim ve Araştırma Hastanesi',email:'ornek@example.invalid',first_name:'Örnek',last_name:'Kullanıcı',city:'Konya',role_name:'Eczacı',status:'pending',created_at:'2026-11-02T09:00:00Z'}],licenses:[{id:'sample-license',institution_name:'Örnek Devlet Hastanesi',email:'lisans@example.invalid',plan:'pilot',lifecycle:'active',valid_until:'2027-01-31T21:00:00Z',device_limit:2,active_devices:1}]};state.selected=state.data.requests[0];}
if(preview&&new URL(location.href).searchParams.get('offline')==='1'){
 state.tab='licenses';state.selected=state.data.licenses[0];state.detail={devices:[],emails:[]};
 state.offline={licenseId:state.selected.id,raw:'',response:null,preview:{operation:'activate',request_id:'ornek-talep',
 installation_id:'ornek-cihaz',device_key_fingerprint:'0'.repeat(64),activation_id:null}};
}

if(preview&&new URL(location.href).searchParams.get('profile')==='1'){
 const original={institution_id:'sample-institution',institution_name:'Örnek Eğitim ve Araştırma Hastanesi',city:'Konya',beds:'0-150',first_name:'Örnek',last_name:'Kullanıcı',role_name:'Eczacı',email:'ornek@example.invalid',version:'b'.repeat(64)};
 state.data.profile_changes=[{id:'sample-change',license_id:'sample-license',activation_id:'sample-device',created_at:'2026-11-07T09:00:00Z',status:'pending',original,proposed:{...original,city:'Ankara',beds:'151-300'},explanation:'Kurum kaydındaki bilgilerin düzeltilmesini rica ediyoruz.',reason:''}];
 state.tab='profile_changes';state.selected=state.data.profile_changes[0];
}

render();
