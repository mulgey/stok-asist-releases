// UI-only helpers; authoritative schema/signature checks remain on the server.
export async function readRequestFile(file){
 if(!file||file.size<1||file.size>16384)throw Error('Talep dosyası boş veya 16 KB sınırını aşıyor.');
 const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
 if(new TextEncoder().encode(raw).length>16384)throw Error('Talep dosyası çok büyük.');
 return raw;
}
export function offlineDownloadName(response){
 if(response?.schema!==1||response.kind!=='stok-asist-offline-response'
 ||typeof response.request_id!=='string'||!/^[A-Za-z0-9_.-]{1,128}$/.test(response.request_id)
 ||!response.permit||typeof response.permit!=='object')throw Error('Yanıt dosyası doğrulanamadı. Aynı taleple yeniden deneyin.');
 return 'stok-asist-'+response.request_id+'.stoklicresp';
}
export function approvalPayload(licenseId,raw){return {license_id:licenseId,confirmed:true,request_file:raw};}
