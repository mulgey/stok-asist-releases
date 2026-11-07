if(self!==top){document.body.replaceChildren(document.createTextNode('Lisans panelini ayrı bir sekmede açın.'));throw new Error('Embedded portal unavailable');}
import {readRequestFile,offlineDownloadName,approvalPayload} from './offline-ui.mjs';
const API='https://urrzxpepdwtkodfyjmbr.supabase.co/functions/v1/license-api';
const app=document.querySelector('#app');
const preview=['localhost','127.0.0.1'].includes(location.hostname)&&new URL(location.href).searchParams.get('preview')==='1';
const fragment=new URLSearchParams(location.hash.slice(1));
const linkKind=['admin','recover','info','profile'].find(name=>fragment.has(name));
let linkToken=linkKind?fragment.get(linkKind):null;
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const state={offline:null,token:'',email:'',tab:'requests',selected:null,data:null,detail:null,busy:false,notice:'',error:false};
const pending=new Map();
const labels={pending_email:'E-posta doğrulaması bekliyor',withdrawn:'Geri çekildi',needs_review:'Yeniden değerlendirme gerekli',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',needs_info:'Ek bilgi bekleniyor',cancelled:'İptal',active:'Aktif',expired:'Süresi doldu',revoked:'İptal edildi',sent:'Gönderildi',delivered:'Teslim edildi',failed:'Gönderilemedi',sending:'Gönderiliyor',pilot:'Ücretsiz Pilot',paid:'Ücretli',sponsored:'Sponsorlu'};
const errors={email_unverified:'Yeni e-posta adresi doğrulanmalı.',profile_pending:'Bekleyen bir profil talebi var.',unauthorized:'Oturumunuzu yeniden açın.',forbidden:'Bu işlem için yönetici yetkiniz bulunmuyor.',invalid_token:'Bağlantı kullanılmış veya süresi dolmuş. Yeni bağlantı isteyin.',invalid_request:'Alanları kontrol edin.',state_conflict:'Kayıt değişti. Listeyi yenileyin.',operation_conflict:'İşlem bilgileri değişti. Listeyi yenileyin.',email_expired:'Gönderim süresi doldu. Güvenli anahtar kurtarma akışını kullanın.',mail_not_configured:'E-posta hizmeti henüz hazır değil.',rate_limited:'Çok sık deneme yapıldı. Biraz bekleyin.',service_unavailable:'Hizmete ulaşılamadı. Tekrar deneyebilirsiniz.',email_conflict:'Bu adres başka bir sorumlu kaydına bağlı. Otomatik birleştirme yapılmadı.'};
function el(tag,attrs={},...children){const node=document.createElement(tag);for(const[key,value]of Object.entries(attrs)){
 if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);else if(key==='class')node.className=value;
 else if(key==='value')node.value=value;else if(typeof value==='boolean'){if(value)node.setAttribute(key,'');}else node.setAttribute(key,value);
}for(const child of children.flat(Infinity))if(child!==null&&child!==undefined)node.append(child instanceof Node?child:document.createTextNode(String(child)));return node;}
const button=(label,fn,cls='')=>el('button',{type:'button',class:cls,disabled:state.busy,onClick:fn},label);
const pill=value=>el('span',{class:'pill'},labels[value]??value);
const field=(label,input)=>el('label',{},label,input);
const fmt=value=>value?new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(value)):'—';
const card=(...children)=>el('section',{class:'card stack'},...children);
const input=(type='text',value='',attrs={})=>el('input',{type,value,...attrs});
function notice(text,error=false){state.notice=text;state.error=error;render();}
async function request(route,data){if(preview)throw Error('Salt okunur önizleme sunucuya bağlanmaz.');const headers={'Content-Type':'application/json'};if(state.token)headers.Authorization='Bearer '+state.token;
 const response=await fetch(API+'/'+route,{method:data===undefined?'GET':'POST',headers,...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});
 const value=await response.json();if(!response.ok){if(response.status===401&&state.token){state.token='';state.data=null;state.offline=null;}throw Error(errors[value.error]??'İşlem tamamlanamadı.');}return value;}
async function refresh(){if(preview){render();return;}state.data=await request('admin',{action:'list',input:{}});state.data.profile_changes=(await request('admin-profile',{action:'list',input:{}})).changes;if(state.selected)state.selected=(state.data[state.tab]??[]).find(row=>row.id===state.selected.id)??null;if(state.selected){const id=state.tab==='licenses'?state.selected.id:state.selected.license_id;if(id)state.detail=await request('admin',{action:'detail',input:{license_id:id}});}render();}
async function action(fn){if(state.busy)return;state.busy=true;render();try{await fn();}catch(error){state.notice=error.name==='TimeoutError'?'Yanıt alınamadı. İşlem kaydedilmiş olabilir; aynı işlemle tekrar deneyin.':error.message;state.error=true;}finally{state.busy=false;render();}}
async function operate(name,values){if(preview){notice('Salt okunur önizleme: sunucuya işlem gönderilmedi.');return;}
 const key=JSON.stringify([name,values]);const operation=pending.get(key)??crypto.randomUUID();pending.set(key,operation);
 const result=await request('admin',{action:name,input:{operation_id:operation,...values}});pending.delete(key);
 state.notice=result.mail?.status==='failed'?'İşlem kaydedildi; e-posta gönderilemedi. Gönderim geçmişinden yeniden deneyebilirsiniz.':'İşlem kaydedildi.';
 state.error=result.mail?.status==='failed';await refresh();
 if(state.selected){state.selected=(state.data[state.tab]??[]).find(row=>row.id===state.selected.id)??null;}render();}
function dayEnd(value){if(!value)return undefined;const[y,m,d]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+1,-3)).toISOString();}
function modal(title,items,submitLabel,callback){const dlg=el('dialog',{'aria-label':title});const form=el('form',{},el('h2',{},title),...items);
 form.append(el('div',{class:'row'},el('button',{class:'primary',type:'submit'},submitLabel),el('button',{type:'button',onClick:()=>dlg.close()},'Vazgeç')));
 form.addEventListener('submit',event=>{event.preventDefault();dlg.close();action(callback);});dlg.append(form);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();}
function confirmAction(name,values,title,summary){const reason=el('textarea',{required:true,maxlength:2000,placeholder:'İşlem gerekçesi'});
 modal(title,[el('p',{},summary),field('Gerekçe',reason),el('p',{class:'muted'},'İşlem geçmişi korunur. Yerel raporlar ve kurum verileri silinmez.')], 'İşlemi Onayla',()=>operate(name,{...values,reason:reason.value,confirmed:true}));}
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
function renderHeader(){return el('header',{class:'top'},el('div',{class:'brand'},el('div',{class:'logo'},'S'),el('div',{},el('h1',{},'Stok Asist'),el('p',{class:'muted'},'Lisans Yönetimi')),el('span',{class:'tag'},'Üretim')),
 state.token?el('div',{class:'row'},el('span',{class:'muted'},state.email||'Yönetici'),button('Hizmeti Kontrol Et',()=>action(checkHealth)),button('Yenile',()=>action(refresh)),button('Çıkış Yap',()=>action(async()=>{if(!preview)await request('admin-logout',{});state.token='';state.data=null;state.selected=null;state.offline=null;state.notice='Oturum kapatıldı.';}))):null);}
function renderLogin(){const address=input('email','',{required:true,autocomplete:'email',placeholder:'Yönetici e-posta adresiniz'});
 const form=el('form',{class:'stack'},el('h2',{},'Yönetici Girişi'),el('p',{class:'muted'},'İzin verilen adresinize tek kullanımlık giriş bağlantısı gönderilir.'),field('E-posta adresi',address),el('button',{type:'submit',class:'primary',disabled:state.busy},'Giriş Bağlantısı Gönder'));
 form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{await request('admin-login',{email:address.value});state.notice='Adresiniz yetkiliyse giriş bağlantısı e-postanıza gönderilir. Gelen kutunuzu ve istenmeyen postayı kontrol edin.';state.error=false;});});return el('div',{class:'login'},card(form,el('p',{class:'muted'},'Bu panel kurumun stok veya rapor içeriklerini görüntülemez.')));}
function renderLink(){if(linkKind==='profile')return card(el('h2',{},'Yeni e-posta adresinizi doğrulayın'),el('p',{},'Doğrulama sonrasında profil değişikliği yönetici onayına sunulur.'),button('E-posta Adresini Doğrula',()=>action(async()=>{await request('confirm-profile-email',{token:linkToken});linkToken=null;state.notice='E-posta doğrulandı. Değişiklik yönetici onayını bekliyor.';})));const title=linkKind==='admin'?'Yönetici girişini tamamlayın':linkKind==='recover'?'Yeni ürün anahtarı isteyin':'Başvurunuzu tamamlayın';const message=el('textarea',{required:true,maxlength:2000});
 return el('div',{class:'login'},card(el('h2',{},title),el('p',{class:'muted'},'Bağlantı yalnız bir kez kullanılabilir. İşlem düğmeye bastığınızda gerçekleşir.'),
 linkKind==='info'?field('İstenen ek bilgiler',message):null,button(linkKind==='admin'?'Girişi Tamamla':linkKind==='recover'?'Yeni Anahtar Gönder':'Bilgileri Gönder',()=>action(async()=>{
 if(!linkToken)throw Error(errors.invalid_token);
 if(linkKind==='admin'){const session=await request('admin-complete',{token:linkToken});linkToken=null;state.token=session.access_token;state.email=session.email;state.notice='Yönetici girişi tamamlandı.';await refresh();}
 else{await request(linkKind==='recover'?'complete-recovery':'complete-info',{token:linkToken,operation_id:crypto.randomUUID(),...(linkKind==='info'?{message:message.value}:{})});linkToken=null;state.notice=linkKind==='recover'?'Yeni anahtar e-posta gönderim kuyruğuna alındı.':'Bilgiler aynı başvuruya kaydedildi.';}
 }), 'primary')));}
function table(rows){const headers=state.tab==='requests'?['Kurum / Sorumlu','Durum','Başvuru']:['Kurum / Sorumlu','Lisans','Cihaz'];
 return el('div',{class:'scroll',tabindex:'0','aria-label':'Lisans kayıtları'},el('table',{},el('thead',{},el('tr',{},...headers.map(h=>el('th',{},h)),el('th',{},'İşlem'))),el('tbody',{},...rows.map(row=>el('tr',{class:state.selected?.id===row.id?'selected':''},
 el('td',{},el('strong',{},row.institution_name),el('div',{class:'muted'},row.email)),el('td',{},pill(row.status??row.lifecycle)),
 el('td',{},state.tab==='requests'?fmt(row.created_at):`${row.active_devices} / ${row.device_limit}`),el('td',{},button('İncele',()=>action(async()=>{state.selected=row;state.detail=null;if(preview){state.detail={devices:[{id:'sample-device',device_name:'Eczane Bilgisayarı',short_id:'ornek-cihaz',os_name:'Windows',app_version:'Test',last_checked_at:'2026-11-02T09:00:00Z',active:true}],emails:[{id:'sample-mail',status:'failed',created_at:'2026-11-02T09:00:00Z'}]};return;}const id=state.tab==='licenses'?row.id:row.license_id;if(id)state.detail=await request('admin',{action:'detail',input:{license_id:id}});}), 'small')))))));}
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
function licenseDetail(row){const detail=state.detail??{devices:[],emails:[]};return card(el('h2',{},row.institution_name),el('div',{class:'meta'},el('div',{},row.email),el('div',{},labels[row.plan]??row.plan),el('div',{},'Geçerlilik: '+fmt(row.valid_until)),pill(row.lifecycle)),
 el('div',{class:'row'},button('Süreyi Uzat',()=>{const until=input('date','',{required:true});modal('Lisans Süresini Uzat',[field('Yeni son geçerli gün (Türkiye)',until)],'Uzatmayı Onayla',()=>operate('extend',{license_id:row.id,valid_until:dayEnd(until.value)}));}),
 button(row.lifecycle==='revoked'?'İptali Geri Al':'Lisansı İptal Et',()=>confirmAction(row.lifecycle==='revoked'?'restore':'revoke',{license_id:row.id},row.lifecycle==='revoked'?'İptali Geri Al':'Lisansı İptal Et',`${row.institution_name} · ${row.active_devices} etkin cihaz. Yeni hesaplama yetkisi, doğrulanmış iptal bilgisini alan cihazlarda durur.`),'danger')),
 el('div',{class:'row'},button('Sorumlu E-postasını Değiştir',()=>{const value=input('email','',{required:true});modal('Sorumlu E-postası',[el('p',{},'Yalnız bu lisansın sorumlu bağı değişir.'),field('Yeni e-posta',value)],'Değişikliği Onayla',()=>operate('change_email',{license_id:row.id,email:value.value}));}),
 button('Başka Kuruma Taşı',()=>{const value=input('text','',{required:true,maxlength:200});modal('Lisansın Kurum Bağını Değiştir',[el('p',{},'Yerel kurum verileri taşınmaz, silinmez veya birleştirilmez.'),field('Yeni kurum adı',value)],'Kurum Değişikliğini Onayla',()=>operate('change_institution',{license_id:row.id,institution_name:value.value}));})),
 el('div',{class:'row'},button('Kurum Bilgilerini Düzelt',()=>{
  const name=input('text',row.institution_name,{required:true,maxlength:200});
  const city=input('text',row.city??'',{maxlength:80});
  modal('Kurum Adı ve Şehir',[field('Kurum adı',name),field('Şehir',city)],
   'Düzeltmeyi Onayla',()=>operate('correct_institution',{
    license_id:row.id,institution_name:name.value,city:city.value}));
 })),
 offlineSection(row),
 el('h3',{},'Uzatma Talepleri'),el('div',{class:'list'},...(detail.extension_requests??[]).map(ext=>el('div',{class:'mail'},pill(ext.status),el('p',{class:'muted'},fmt(ext.created_at)),ext.status==='pending'?button('Talebi Reddet',()=>{const reason=el('textarea',{required:true,maxlength:2000});modal('Uzatma Talebini Reddet',[field('Kullanıcıya gerekçe',reason)],'Reddi Onayla',()=>operate('reject_extension',{extension_id:ext.id,reason:reason.value}));},'small'):null))),
 el('h3',{},'Cihazlar'),el('div',{class:'list'},...(detail.devices.length?detail.devices.map(d=>el('div',{class:'device stack'},el('strong',{},d.device_name||'Adlandırılmamış cihaz'),el('p',{class:'muted'},d.short_id+' · '+d.os_name+' · '+d.app_version),el('p',{class:'muted'},'Son doğrulama: '+fmt(d.last_checked_at)),el('div',{class:'row'},pill(d.active?'active':'revoked'),d.active?button('Cihazı Pasifleştir',()=>confirmAction('deactivate_device',{activation_id:d.id},'Cihazı Pasifleştir',`${d.device_name||d.short_id}: çevrimdışı cihazın mevcut izni bitene kadar çalışabileceğini unutmayın.`),'small'):null))):[el('p',{class:'muted'},'Etkinleştirilmiş cihaz yok.')])),
 el('h3',{},'E-posta Geçmişi'),el('div',{class:'list'},...(detail.emails.length?detail.emails.map(mail=>el('div',{class:'mail'},el('div',{class:'row'},pill(mail.status),el('span',{class:'muted'},fmt(mail.created_at)),['failed','pending','sent'].includes(mail.status)?button('Yeniden Gönder',()=>action(()=>operate('retry_email',{email_job_id:mail.id})),'small'):null))):[el('p',{class:'muted'},'Gönderim kaydı yok.')])));
}
const profileLabels={institution_name:'Kurum',city:'Şehir',beds:'Yatak sayısı',first_name:'İsim',last_name:'Soyisim',role_name:'Görev',email:'E-posta'};
async function decideProfile(actionName,row,reason=''){
 const key=JSON.stringify(['profile',actionName,row.id,reason]);
 const operation=pending.get(key)??crypto.randomUUID();pending.set(key,operation);
 const result=await request('admin-profile',{action:actionName,input:{operation_id:operation,change_id:row.id,...(reason?{reason}:{})}});
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
   row.status==='pending'?button('Talebi Onayla',()=>modal('Profil Değişikliğini Onayla',[
    el('p',{},'Yukarıdaki değişiklikler onaylı profile uygulanacak. Kurum alanları aynı kurum kimliğine bağlı diğer lisanslara da yansır.')],
    'Onayla',()=>decideProfile('approve',row))):el('p',{},'Yeni e-posta adresinin doğrulanması bekleniyor.'),
   button('Talebi Reddet',()=>{const reason=el('textarea',{required:true,maxlength:2000});modal('Profil Talebini Reddet',[field('Gerekçe',reason)],'Reddet',()=>decideProfile('reject',row,reason.value));},'danger')):null);
}
function profileChangeList(rows){return el('div',{class:'list'},...rows.map(row=>el('div',{class:'device'},
 el('strong',{},row.original.institution_name),el('p',{},row.original.email),pill(row.status),
 button('İncele',()=>{state.selected=row;render();},'small'))));}
function renderDashboard(){const data=state.data??{requests:[],licenses:[]};const rows=data[state.tab]??[];
 return el('div',{},el('nav',{class:'row tabs','aria-label':'Yönetim bölümleri'},...['requests','licenses','profile_changes'].map(tab=>el('button',{type:'button','aria-selected':String(state.tab===tab),disabled:state.busy,onClick:()=>{state.tab=tab;state.selected=null;state.detail=null;render();}},tab==='requests'?`Başvurular (${data.requests.length})`:tab==='licenses'?`Lisanslar (${data.licenses.length})`:`Profil Talepleri (${(data.profile_changes??[]).length})`))),
 el('div',{class:'grid'},card(el('h2',{},state.tab==='requests'?'Lisans Başvuruları':state.tab==='licenses'?'Kurum Lisansları':'Profil Değişiklik Talepleri'),el('p',{class:'muted'},'Son 100 kayıt · '+new Intl.DateTimeFormat('tr-TR',{timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date())),rows.length?(state.tab==='profile_changes'?profileChangeList(rows):table(rows)):el('p',{class:'empty'},'Henüz kayıt bulunmuyor.')),
 state.selected?(state.tab==='requests'?requestDetail(state.selected):state.tab==='licenses'?licenseDetail(state.selected):profileChangeDetail(state.selected)):card(el('h2',{},'Kayıt Ayrıntısı'),el('p',{class:'empty'},'İncelemek istediğiniz kaydı seçin.'))));}
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
