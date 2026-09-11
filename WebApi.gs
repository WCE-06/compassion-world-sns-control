function handleWebApi_(p) {
  const callback = String(p.callback || 'callback');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) throw new Error('callbackが不正です。');
  let result;
  try {
    verifyWebApiRequest_(p);
    const payload = p.payload ? JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.payload)).getDataAsString()) : {};
    const actor = requireWebActor_(p.action, payload._actor);
    switch (p.action) {
      case 'dashboard': result = {ok:true, data:getDashboardData()}; break;
      case 'create': result = {ok:true, data:createPost(payload)}; break;
      case 'approve': result = {ok:true, data:approvePost(payload.id, actor)}; break;
      case 'reject': result = {ok:true, data:rejectPost(payload.id, payload.reason || '', actor)}; break;
      case 'threadsAuthStart': result = {ok:true, data:startThreadsOAuth_(payload)}; break;
      default: throw new Error('操作が不正です。');
    }
    appendWebAudit_(actor, p.action, payload, '成功', '');
  } catch (err) {
    result = {ok:false, error:err && err.message ? err.message : String(err)};
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function requireWebActor_(action, actor) {
  const required = WEB_ACTION_ROLES[action];
  if (!required) throw new Error('操作が不正です。');
  if (!actor || !actor.uid || !actor.email || !WEB_ROLE_LEVELS[actor.role]) throw new Error('従業員認証情報がありません。');
  if (WEB_ROLE_LEVELS[actor.role] < WEB_ROLE_LEVELS[required]) throw new Error('この操作を行う権限がありません。');
  return {uid:String(actor.uid), email:String(actor.email).toLowerCase(), name:String(actor.name || ''), role:String(actor.role)};
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
  const secret = getProperty_('WEB_API_SECRET', true);
  const timestamp = Number(p.ts || 0);
  if (!timestamp || Math.abs(Date.now() - timestamp) > 300000) throw new Error('接続の有効時間が切れました。');
  const nonce = String(p.nonce || '');
  if (!/^[0-9a-f-]{16,80}$/i.test(nonce)) throw new Error('接続情報が不正です。');
  const canonical = [p.action || '', p.ts || '', nonce, p.payload || ''].join('|');
  const expected = Utilities.computeHmacSha256Signature(canonical, secret)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
  if (expected !== String(p.sig || '').toLowerCase()) throw new Error('接続キーが一致しません。');
  if (p.action !== 'dashboard') {
    const cache = CacheService.getScriptCache();
    const replayKey = 'webapi_' + nonce;
    if (cache.get(replayKey)) throw new Error('同じ操作は再実行できません。');
    cache.put(replayKey, '1', 600);
  }
}
