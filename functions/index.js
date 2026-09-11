const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const crypto=require('crypto');

initializeApp();
const db=getFirestore();
const gasWebAppUrl=defineSecret('GAS_WEB_APP_URL');
const webApiSecret=defineSecret('WEB_API_SECRET');
const bootstrapAdminEmail=defineSecret('BOOTSTRAP_ADMIN_EMAIL');
const allowedOrigins=new Set(['https://wce-06.github.io','http://localhost:8080','http://127.0.0.1:8080']);
const roles={viewer:1,editor:2,admin:3};
const actionRoles={dashboard:'viewer',create:'editor',approve:'admin',reject:'admin',threadsAuthStart:'admin',listEmployees:'admin',createEmployee:'admin',setEmployeeActive:'admin',setEmployeeRole:'admin'};

exports.snsControlApi=onRequest({region:'asia-northeast1',memory:'256MiB',timeoutSeconds:30,minInstances:0,maxInstances:2,secrets:[gasWebAppUrl,webApiSecret,bootstrapAdminEmail]},async(req,res)=>{
  let actor=null;
  const origin=req.headers.origin||'';
  if(allowedOrigins.has(origin)){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin')}
  res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.set('Access-Control-Allow-Methods','POST, OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).send('');
  if(req.method!=='POST'||!allowedOrigins.has(origin))return reply(res,403,'許可されていないアクセスです。');
  try{
    const idToken=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!idToken)throw httpError(401,'ログインが必要です。');
    const decoded=await getAuth().verifyIdToken(idToken,true);
    await ensureBootstrapAdmin(decoded);
    const staffSnap=await db.collection('staff').doc(decoded.uid).get();
    if(!staffSnap.exists||staffSnap.data().active===false)throw httpError(403,'このアカウントは利用できません。');
    const staff=staffSnap.data();const role=staff.role||'viewer';
    const action=String(req.body&&req.body.action||'');const required=actionRoles[action];
    if(!required||!roles[role]||roles[role]<roles[required])throw httpError(403,'この操作を行う権限がありません。');
    actor={uid:decoded.uid,email:decoded.email||staff.email||'',name:staff.name||decoded.name||'',role};
    let data;
    if(action==='listEmployees')data=await listEmployees();
    else if(action==='createEmployee')data=await createEmployee(req.body.payload||{},actor);
    else if(action==='setEmployeeActive')data=await setEmployeeActive(req.body.payload||{},actor);
    else if(action==='setEmployeeRole')data=await setEmployeeRole(req.body.payload||{},actor);
    else data=await callGas(action,Object.assign({},req.body.payload||{},{_actor:actor}));
    if(action==='dashboard')data.session=actor;
    await audit(actor,action,req.body&&req.body.payload||{},true);
    res.json({ok:true,data});
  }catch(err){
    const status=err.status||500;
    try{await audit(actor,String(req.body&&req.body.action||'unknown'),req.body&&req.body.payload||{},false,err.message)}catch(_){}
    reply(res,status,status>=500?'処理中にエラーが発生しました。':err.message);
  }
});

async function callGas(action,payload){
  const ts=Date.now().toString();const nonce=crypto.randomUUID();const body=base64url(JSON.stringify(payload));
  const canonical=[action,ts,nonce,body].join('|');const sig=crypto.createHmac('sha256',webApiSecret.value()).update(canonical).digest('hex');
  const callback='gatewayCallback';const url=new URL(gasWebAppUrl.value());
  Object.entries({api:'1',action,ts,nonce,payload:body,sig,callback}).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url);if(!response.ok)throw new Error('GASへの接続に失敗しました。');
  const text=await response.text();const prefix=callback+'(';if(!text.startsWith(prefix)||!text.endsWith(');'))throw new Error('GASの応答形式が不正です。');
  const parsed=JSON.parse(text.slice(prefix.length,-2));if(!parsed.ok)throw httpError(400,parsed.error||'GAS処理エラー');return parsed.data;
}
function base64url(value){return Buffer.from(value).toString('base64url')}

async function ensureBootstrapAdmin(decoded){
  const expected=bootstrapAdminEmail.value().trim().toLowerCase();
  if(!expected||String(decoded.email||'').toLowerCase()!==expected)return;
  const staffRef=db.collection('staff').doc(decoded.uid);const markerRef=db.collection('system').doc('bootstrap');
  await db.runTransaction(async tx=>{
    const [staff,marker]=await Promise.all([tx.get(staffRef),tx.get(markerRef)]);
    if(staff.exists||marker.data()&&marker.data().completed)return;
    tx.set(staffRef,{email:expected,name:decoded.name||'管理人',role:'admin',active:true,createdAt:FieldValue.serverTimestamp(),createdBy:'bootstrap'});
    tx.set(markerRef,{completed:true,uid:decoded.uid,email:expected,at:FieldValue.serverTimestamp()});
  });
}

async function listEmployees(){const snap=await db.collection('staff').orderBy('name').get();return{employees:snap.docs.map(d=>Object.assign({uid:d.id},d.data()))}}
async function createEmployee(input,actor){
  const email=String(input.email||'').trim().toLowerCase();const name=String(input.name||'').trim();const role=String(input.role||'editor');
  if(!email||!name||!roles[role])throw httpError(400,'氏名、メールアドレス、権限を確認してください。');
  const password=crypto.randomBytes(32).toString('base64url')+'Aa1!';
  const user=await getAuth().createUser({email,displayName:name,password,emailVerified:false,disabled:false});
  try{await db.collection('staff').doc(user.uid).set({email,name,role,active:true,createdAt:FieldValue.serverTimestamp(),createdBy:actor.email})}
  catch(err){try{await getAuth().deleteUser(user.uid)}catch(_){}throw err}
  return{uid:user.uid,email};
}
async function setEmployeeActive(input,actor){
  const uid=String(input.uid||'');const active=input.active===true;if(!uid)throw httpError(400,'対象者を確認できません。');
  if(uid===actor.uid&&!active)throw httpError(400,'自分自身は停止できません。');
  await getAuth().updateUser(uid,{disabled:!active});await db.collection('staff').doc(uid).update({active,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.email});
  if(!active)await getAuth().revokeRefreshTokens(uid);return{ok:true};
}
async function setEmployeeRole(input,actor){
  const uid=String(input.uid||'');const role=String(input.role||'');
  if(!uid||!roles[role])throw httpError(400,'対象者または権限を確認できません。');
  if(uid===actor.uid&&role!=='admin')throw httpError(400,'自分自身の管理人権限は解除できません。');
  await db.collection('staff').doc(uid).update({role,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.email});return{ok:true};
}
async function audit(actor,action,payload,success,error=''){await db.collection('auditLogs').add({uid:actor&&actor.uid||'',email:actor&&actor.email||'',role:actor&&actor.role||'',action,targetId:payload.id||payload.uid||'',success,error:String(error||'').slice(0,1000),at:FieldValue.serverTimestamp()})}
function httpError(status,message){const e=new Error(message);e.status=status;return e}
function reply(res,status,message){return res.status(status).json({ok:false,error:message})}
