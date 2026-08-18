function handleWebApi_(p) {
  const callback = String(p.callback || 'callback');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) throw new Error('callbackが不正です。');
  let result;
  try {
    verifyWebApiRequest_(p);
    const payload = p.payload ? JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.payload)).getDataAsString()) : {};
    switch (p.action) {
      case 'dashboard': result = {ok:true, data:getDashboardData()}; break;
      case 'create': result = {ok:true, data:createPost(payload)}; break;
      case 'approve': result = {ok:true, data:approvePost(payload.id)}; break;
      case 'reject': result = {ok:true, data:rejectPost(payload.id, payload.reason || '')}; break;
      case 'threadsAuthStart': result = {ok:true, data:startThreadsOAuth_(payload)}; break;
      default: throw new Error('操作が不正です。');
    }
  } catch (err) {
    result = {ok:false, error:err && err.message ? err.message : String(err)};
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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
