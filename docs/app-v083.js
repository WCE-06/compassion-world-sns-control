const firebaseConfig=window.FIREBASE_CONFIG||{};
const initializeApp=(config,name)=>firebase.initializeApp(config,name);
const deleteApp=app=>app.delete();
const getAuth=app=>app.auth();
const onAuthStateChanged=(auth,callback)=>auth.onAuthStateChanged(callback);
const signInWithEmailAndPassword=(auth,email,password)=>auth.signInWithEmailAndPassword(email,password);
const createUserWithEmailAndPassword=(auth,email,password)=>auth.createUserWithEmailAndPassword(email,password);
const updateProfile=(user,profile)=>user.updateProfile(profile);
const deleteUser=user=>user.delete();
const signOut=auth=>auth.signOut();
const sendPasswordResetEmail=(auth,email)=>auth.sendPasswordResetEmail(email);

const BRANDS=['COMPASSION WORLD','おもひで商店','Aozora Kitchen','FEBBRAIO','アートリエ','Kazu個人'];
const TYPES=['通常','イベント','料金改定','Kazu本人名義','攻めた投稿','緊急告知'];
const CHANNELS=['Instagram','Threads','X'];
const ROLE_LABELS={admin:'管理人',editor:'運用スタッフ',viewer:'閲覧スタッフ'};
const configured=firebaseConfig.apiKey&&firebaseConfig.apiKey!=='REPLACE_ME'&&firebaseConfig.projectId&&firebaseConfig.projectId!=='REPLACE_ME';
const firebaseApp=configured?initializeApp(firebaseConfig):null;
const auth=configured?getAuth(firebaseApp):null;
const API='https://script.google.com/macros/s/AKfycbwKfxQIgiEHbruUR5XXaVx5GToWDOKDORqykYAo9rON-3XaePm06QNajQx5k5vCL7Ga/exec';
let state={},view='today',currentThreadsBrand='',currentThreadsAuthUrl='',session=null;
const pendingRequests=new Map();
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function initializeUi(){
  fill('brand',BRANDS);fill('type',TYPES);
  $('#channels').innerHTML=CHANNELS.map((v,i)=>`<label><input type="checkbox" name="channels" value="${v}" ${i?'':'checked'}>${v}</label>`).join('');
  const d=new Date(Date.now()+3600000);d.setMinutes(0,0,0);$('[name=scheduledAt]').value=localDate(d);
  if(!configured){$('#firebaseNotice').hidden=false;$('#mode').textContent='設定待ち';return;}
  window.SNS_CONTROL_READY=true;setLoginBusy(false);
  onAuthStateChanged(auth,async user=>{if(!user)return showLogin();try{await connect()}catch(e){showLogin();fail(e)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeUi);else initializeUi();

function fill(n,v){$(`[name=${n}]`).innerHTML=v.map(x=>`<option>${esc(x)}</option>`).join('')}
function localDate(d){const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function setLoginBusy(busy,label){const button=$('#loginButton');button.disabled=busy;button.textContent=label||(busy?'ログイン中…':'ログイン')}
function showLogin(){$('#login').hidden=false;$('#app').hidden=true;$('#mode').textContent='ログアウト';setLoginBusy(false)}

$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!configured)return;const fd=new FormData(e.target);setLoginBusy(true);$('#firebaseNotice').hidden=true;try{await signInWithEmailAndPassword(auth,String(fd.get('email')).trim(),String(fd.get('password')));setLoginBusy(true,'管理画面を読み込み中…')}catch(err){setLoginBusy(false);const code=String(err&&err.code||'');const message=code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found')?'メールアドレスまたはパスワードを確認してください。':code.includes('network-request-failed')?'通信できませんでした。SafariまたはChromeで開き直してください。':'ログイン処理に失敗しました。もう一度お試しください。';fail(new Error(message))}});
$('#resetPassword').onclick=async()=>{if(!configured)return;const email=$('#loginForm [name=email]').value.trim();if(!email)return toast('先にメールアドレスを入力してください');try{await sendPasswordResetEmail(auth,email);toast('パスワード再設定メールを送信しました')}catch(_){toast('入力内容を確認してください')}};
$('#showPassword').onchange=e=>{$('#loginPassword').type=e.target.checked?'text':'password'};
$('#logout').onclick=()=>signOut(auth);

async function api(action,payload={}){
  const user=auth.currentUser;if(!user)throw new Error('もう一度ログインしてください。');
  const token=await user.getIdToken();
  const requestId=crypto.randomUUID(),nonce=crypto.randomUUID(),iframe=document.createElement('iframe'),form=document.createElement('form');
  iframe.name='cw_api_'+requestId.replaceAll('-','');iframe.hidden=true;form.hidden=true;form.method='post';form.action=API;form.target=iframe.name;
  const fields={api:'1',action,ts:Date.now().toString(),nonce,idToken:token,payload:b64json(payload),origin:location.origin,requestId};
  Object.entries(fields).forEach(([name,value])=>{const input=document.createElement('input');input.name=name;input.value=value;form.appendChild(input)});
  document.body.append(iframe,form);
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>finishRequest(requestId,new Error('サーバーへの接続がタイムアウトしました。SafariまたはChromeで再読み込みしてください。')),60000);pendingRequests.set(requestId,{resolve,reject,timer,iframe,form});const body=new URLSearchParams(fields);fetch(API,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()}).catch(()=>form.submit());setTimeout(()=>pollResult(requestId),700)});
}
function b64json(value){const bytes=new TextEncoder().encode(JSON.stringify(value||{}));let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function finishRequest(id,error,result){const request=pendingRequests.get(id);if(!request)return;clearTimeout(request.timer);request.form.remove();request.iframe.remove();pendingRequests.delete(id);error?request.reject(error):request.resolve(result)}
window.addEventListener('message',event=>{
  if(!/^https:\/\/(script\.google\.com|[^/]+\.googleusercontent\.com)$/.test(event.origin))return;
  const message=event.data;
  if(!message||message.type!=='cw_api_result'||!pendingRequests.has(message.requestId))return;
  const result=message.result||{};
  result.ok?finishRequest(message.requestId,null,result.data):finishRequest(message.requestId,new Error(result.error||'APIエラー'));
});
function pollResult(requestId){if(!pendingRequests.has(requestId))return;const callback='cw_result_'+requestId.replaceAll('-',''),script=document.createElement('script');const cleanup=()=>{delete window[callback];script.remove()};window[callback]=result=>{cleanup();if(result.pending){setTimeout(()=>pollResult(requestId),600);return}result.ok?finishRequest(requestId,null,result.data):finishRequest(requestId,new Error(result.error||'APIエラー'))};script.onerror=()=>{cleanup();setTimeout(()=>pollResult(requestId),1000)};script.src=API+'?'+new URLSearchParams({apiResult:'1',requestId,callback});document.head.appendChild(script)}

async function connect(){
  state=await api('dashboard');session=state.session;
  $('#login').hidden=true;$('#app').hidden=false;
  $('#currentUser').textContent=session.name||session.email;$('#currentRole').textContent=ROLE_LABELS[session.role]||session.role;
  document.body.classList.toggle('readonly',session.role==='viewer');$('#mode').textContent=state.dryRun?'DRY RUN（実投稿なし）':'LIVE';
  renderHealth();renderThreadsConnections();render();
  if(session.role==='admin'){$('#staffPanel').hidden=false;await loadStaff()}else{$('#staffPanel').hidden=true}
}
function renderHealth(){const h=state.health;const parts=[[h.queueTrigger&&h.editTrigger,'自動処理 '+(h.queueTrigger&&h.editTrigger?'OK':'要設定')],[true,'最終承認 管理人のみ'],[h.notificationEmailConfigured,'承認メール '+(h.notificationEmailConfigured?'設定済み':'未設定')],[state.dryRun||h.configuredConnections===h.totalConnections,'API設定 '+h.configuredConnections+'/'+h.totalConnections]];$('#health').innerHTML=parts.map(p=>`<span class="${p[0]?'':'warn'}">${esc(p[1])}</span>`).join('')}
function renderThreadsConnections(){const items=state.threadsConnections||[];$('#threadsAccounts').innerHTML=items.map(item=>`<article class="connection ${item.connected?'connected':''}"><div><b>${esc(item.brand)}</b><small>${esc(item.username)}</small></div><span>${item.connected?'接続済み':'未接続'}</span>${item.connected||session.role!=='admin'?'':`<button type="button" onclick="window.startThreadsConnect('${esc(item.brand)}')">接続する</button>`}</article>`).join('')}

window.startThreadsConnect=async brand=>{try{const result=await api('threadsAuthStart',{brand});const browserUrl=new URL('threads-auth.html',location.href);browserUrl.searchParams.set('auth',result.authUrl);currentThreadsBrand=brand;currentThreadsAuthUrl=browserUrl.href;$('#threadsQrPanel').hidden=false;$('#threadsQrTitle').textContent=result.brand+' '+result.username;$('#threadsAuthLink').href=browserUrl.href;const box=$('#threadsQr');box.innerHTML='';if(window.QRCode){new QRCode(box,{text:browserUrl.href,width:196,height:196,colorDark:'#17223b',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}else{box.innerHTML='<p>QRコードを読み込めませんでした。</p>'}$('#threadsQrPanel').scrollIntoView({behavior:'smooth',block:'center'})}catch(e){fail(e)}};
$('#refreshThreads').onclick=connect;
$('#copyThreadsAuthUrl').onclick=async()=>{if(!currentThreadsAuthUrl)return toast('先に接続するアカウントを選んでください');try{await navigator.clipboard.writeText(currentThreadsAuthUrl);toast('認証URLをコピーしました')}catch(_){prompt('このURLをコピーしてください',currentThreadsAuthUrl)}};
$('#regenerateThreadsQr').onclick=()=>{if(currentThreadsBrand)window.startThreadsConnect(currentThreadsBrand)};
$('#closeThreadsQr').onclick=()=>{$('#threadsQrPanel').hidden=true};

function render(){['today','pending','tomorrow','materials'].forEach(k=>$(`#${k}Count`).textContent=(state[k]||[]).length);document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));const items=state[view]||[];$('#list').innerHTML=items.length?items.map(view==='materials'?materialCard:postCard).join(''):'<div class="empty">該当する項目はありません</div>';$('#errors').innerHTML=(state.recentErrors||[]).length?'<b>最近のエラー</b><br>'+state.recentErrors.map(e=>`${esc(e.at)} ${esc(e.channel)}: ${esc(e.message)}`).join('<br>'):''}
function postCard(p){const canApprove=session.role==='admin'&&p.status==='承認待ち';const canEdit=session.role!=='viewer'&&!['投稿中','投稿済み','取消'].includes(p.status);const buttons=`<div class="actions">${canEdit?`<button class="subtle" onclick="window.editPost('${p.id}')">編集</button>`:''}${canApprove?`<button onclick="window.approve('${p.id}')">承認</button><button class="reject" onclick="window.rejectPost('${p.id}')">差戻し</button>`:''}</div>`;return `<article class="post"><div class="meta"><b>${esc(p.scheduledAt.replace('T',' ').slice(0,16))}</b><br>${esc(p.brand)}<br><span class="pill">${esc(p.channel)}</span><span class="pill">${esc(p.approval)}</span><span class="pill">${esc(p.status)}</span></div><div class="body">${esc(p.body)}</div>${canEdit||canApprove?buttons:''}</article>`}
function materialCard(m){return `<article class="post"><div class="meta"><b>${esc(m.due)}</b><br>${esc(m.brand)}<br><span class="pill">${esc(m.status)}</span></div><div><b>${esc(m.type)}</b><div class="body">${esc(m.request)}</div></div><div class="meta">${esc(m.owner)}</div></article>`}
$('nav').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b){view=b.dataset.view;render()}});
$('#postForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target),input=Object.fromEntries(fd);input.channels=fd.getAll('channels');if(!input.channels.length)return toast('投稿先を選択してください');try{if(input.id){const r=await api('update',input);toast(`修正して承認待ち（${r.approvalLevel}）へ戻しました`)}else{const r=await api('create',input);toast(`${r.count}件を承認待ち（${r.approvalLevel}）で追加しました`)}resetComposer();await connect()}catch(x){fail(x)}});
function allVisiblePosts(){return [...(state.today||[]),...(state.pending||[]),...(state.tomorrow||[])].filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i)}
window.editPost=id=>{const p=allVisiblePosts().find(x=>x.id===id);if(!p)return toast('投稿を再読み込みしてください');const f=$('#postForm');f.elements.id.value=p.id;f.elements.brand.value=p.brand;f.elements.type.value=p.type;f.elements.body.value=p.body;f.elements.imageUrl.value=p.imageUrl||'';f.elements.scheduledAt.value=p.scheduledAt.slice(0,16);f.querySelectorAll('[name=channels]').forEach(x=>x.checked=x.value===p.channel);$('#composerTitle').textContent='投稿を修正';$('#savePost').textContent='修正して再承認へ';$('#cancelEdit').hidden=false;f.scrollIntoView({behavior:'smooth',block:'start'})};
function resetComposer(){const f=$('#postForm');f.elements.id.value='';f.elements.body.value='';f.elements.imageUrl.value='';$('#composerTitle').textContent='投稿を追加';$('#savePost').textContent='承認待ちに追加';$('#cancelEdit').hidden=true}
$('#cancelEdit').onclick=resetComposer;
window.approve=async id=>{if(!confirm('この本文・画像・投稿先・予約日時で公開してよいですか？'))return;try{await api('approve',{id});toast('最終承認しました。予約時刻に投稿されます');await connect()}catch(e){fail(e)}};
window.rejectPost=async id=>{const reason=prompt('差戻し理由');if(reason===null)return;try{await api('reject',{id,reason});toast('差戻しました');await connect()}catch(e){fail(e)}};

async function loadStaff(){const result=await api('listEmployees');renderStaff(result.employees||[])}
function renderStaff(items){$('#staffList').innerHTML=items.map(item=>`<article class="staffRow"><div><b>${esc(item.name||'名称未設定')}</b><br><small>${item.active?'利用中':'停止中'}</small></div><div>${esc(item.email)}</div><select aria-label="${esc(item.name)}の権限" onchange="window.setEmployeeRole('${esc(item.uid)}',this.value)" ${item.uid===session.uid?'disabled':''}>${Object.entries(ROLE_LABELS).map(([value,label])=>`<option value="${value}" ${item.role===value?'selected':''}>${label}</option>`).join('')}</select>${item.uid===session.uid?'':`<button class="${item.active?'danger':'subtle'}" onclick="window.setEmployeeActive('${esc(item.uid)}',${!item.active})">${item.active?'停止':'再開'}</button>`}</article>`).join('')||'<div class="empty">登録済み従業員はいません</div>'}
$('#refreshStaff').onclick=loadStaff;
$('#staffForm').addEventListener('submit',async e=>{e.preventDefault();const input=Object.fromEntries(new FormData(e.target));if(input.role==='admin'&&!confirm('この従業員を管理人として登録しますか？ 管理人は投稿承認・SNS連携・従業員管理を行えます。'))return;let secondaryApp,employeeUser,registered=false;try{secondaryApp=initializeApp(firebaseConfig,'employee-'+crypto.randomUUID());const employeeAuth=getAuth(secondaryApp);const credential=await createUserWithEmailAndPassword(employeeAuth,input.email,temporaryPassword());employeeUser=credential.user;await updateProfile(employeeUser,{displayName:input.name});input.employeeToken=await employeeUser.getIdToken(true);await api('createEmployee',input);registered=true;await signOut(employeeAuth);try{await sendPasswordResetEmail(auth,input.email);toast('従業員を登録し、パスワード設定メールを送信しました')}catch(_){toast('登録しました。パスワード再設定メールはログイン画面から再送してください')}e.target.reset();await loadStaff()}catch(err){if(employeeUser&&!registered)try{await deleteUser(employeeUser)}catch(_){}fail(err)}finally{if(secondaryApp)await deleteApp(secondaryApp)}});
window.setEmployeeActive=async(uid,active)=>{if(!confirm(active?'この従業員の利用を再開しますか？':'この従業員を利用停止しますか？'))return;try{await api('setEmployeeActive',{uid,active});toast(active?'利用を再開しました':'利用を停止しました');await loadStaff()}catch(e){fail(e)}};
window.setEmployeeRole=async(uid,role)=>{if(!confirm(`この従業員の権限を「${ROLE_LABELS[role]}」へ変更しますか？`)){await loadStaff();return}try{await api('setEmployeeRole',{uid,role});toast('権限を変更しました');await loadStaff()}catch(e){fail(e);await loadStaff()}};
function toast(s){const t=$('#toast');t.textContent=s;t.style.display='block';setTimeout(()=>t.style.display='none',3000)}
function fail(e){toast(e.message||String(e))}
function temporaryPassword(){const bytes=crypto.getRandomValues(new Uint8Array(24));return Array.from(bytes,b=>String.fromCharCode(33+(b%90))).join('')+'Aa1!'}
