function handleWebApiPost_(p) {
  const origin = String(p.origin || '');
  if (!['https://wce-06.github.io','http://localhost:8080','http://127.0.0.1:8080'].includes(origin)) {
    throw new Error('許可されていないアクセスです。');
  }
  const requestId = String(p.requestId || '');
  if (!/^[0-9a-f-]{16,80}$/i.test(requestId)) throw new Error('リクエスト情報が不正です。');
  const result = executeWebApi_(p);
  CacheService.getScriptCache().put('api_result_' + requestId, JSON.stringify(result), 60);
  const message = JSON.stringify({type:'cw_api_result', requestId:requestId, result:result}).replace(/</g, '\\u003c');
  const targetOrigin = JSON.stringify(origin);
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' + message + ',' + targetOrigin + ');<\/script>'
  );
}

function handleWebApiResult_(p) {
  const callback = String(p.callback || 'callback');
  const requestId = String(p.requestId || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback) || !/^[0-9a-f-]{16,80}$/i.test(requestId)) {
    throw new Error('結果取得情報が不正です。');
  }
  const cache = CacheService.getScriptCache();
  const key = 'api_result_' + requestId;
  const stored = cache.get(key);
  const result = stored ? JSON.parse(stored) : {pending:true};
  if (stored) cache.remove(key);
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function executeWebApi_(p) {
  let actor = null;
  let payload = {};
  try {
    verifyWebApiRequest_(p);
    payload = p.payload ? JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.payload)).getDataAsString()) : {};
    actor = requireFirebaseActor_(p.action, p.idToken);
    payload._actor = actor;
    let data;
    switch (p.action) {
      case 'dashboard': data = getDashboardData(); data.session = actor; break;
      case 'create': data = createPost(payload); break;
      case 'update': data = updatePostFromWeb_(payload, actor); break;
      case 'approve': data = approvePost(payload.id, actor); break;
      case 'reject': data = rejectPost(payload.id, payload.reason || '', actor); break;
      case 'threadsAuthStart': data = startThreadsOAuth_(payload); break;
      case 'listEmployees': data = listEmployees_(); break;
      case 'createEmployee': data = createEmployee_(payload, actor); break;
      case 'setEmployeeActive': data = setEmployeeActive_(payload, actor); break;
      case 'setEmployeeRole': data = setEmployeeRole_(payload, actor); break;
      default: throw new Error('操作が不正です。');
    }
    appendWebAudit_(actor, p.action, payload, '成功', '');
    return {ok:true, data:data};
  } catch (err) {
    if (actor) appendWebAudit_(actor, p.action || 'unknown', payload, '失敗', err && err.message ? err.message : String(err));
    return {ok:false, error:err && err.message ? err.message : String(err)};
  }
}

function appendWebAudit_(actor, action, payload, result, detail) {
  try {
    appendObject_(APP.SHEETS.AUDIT, {
      '監査ID':uuid_(), '日時':now_(), 'ユーザーID':actor.uid, 'メールアドレス':actor.email,
      '氏名':actor.name, '権限':actor.role, '操作':action,
      '対象ID':String(payload.id || payload.uid || ''), '結果':result, '詳細':String(detail || '').slice(0,1000)
    });
  } catch (_) {}
}

function verifyWebApiRequest_(p) {
  const timestamp = Number(p.ts || 0);
  if (!timestamp || Math.abs(Date.now() - timestamp) > 300000) throw new Error('接続の有効時間が切れました。');
  const nonce = String(p.nonce || '');
  if (!/^[0-9a-f-]{16,80}$/i.test(nonce)) throw new Error('接続情報が不正です。');
  if (p.action !== 'dashboard') {
    const cache = CacheService.getScriptCache();
    const replayKey = 'webapi_' + nonce;
    if (cache.get(replayKey)) throw new Error('同じ操作は再実行できません。');
    cache.put(replayKey, '1', 600);
  }
}
