const THREADS_BRANDS = Object.freeze([
  {prefix:'CW', brand:'COMPASSION WORLD', username:'wce_compassion_world'},
  {prefix:'OMO', brand:'おもひで商店', username:'wce_omoide.store'},
  {prefix:'AOZ', brand:'Aozora Kitchen', username:'wce_aozora.kitchen'},
  {prefix:'FEB', brand:'FEBBRAIO', username:'wce_febbraio'},
  {prefix:'ART', brand:'アートリエ', username:'wce_artlier'}
]);

function startThreadsOAuth_(payload) {
  const target = THREADS_BRANDS.find(item => item.brand === String(payload.brand || ''));
  if (!target) throw new Error('Threads連携対象のブランドを選択してください。');
  const redirectUri = getThreadsRedirectUri_();
  const nonce = uuid_();
  CacheService.getScriptCache().put('threads_oauth_' + nonce, target.prefix, 600);
  const stateBody = Utilities.base64EncodeWebSafe(JSON.stringify({nonce:nonce,prefix:target.prefix}), Utilities.Charset.UTF_8).replace(/=+$/, '');
  const state = stateBody + '.' + hmacHex_(stateBody, getProperty_('WEB_API_SECRET', true));
  const query = {
    client_id:getProperty_('THREADS_APP_ID', true), redirect_uri:redirectUri,
    scope:'threads_basic,threads_content_publish', response_type:'code', state:state
  };
  const authUrl = 'https://threads.net/oauth/authorize?' + Object.keys(query)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key])).join('&');
  return {brand:target.brand, username:'@' + target.username, authUrl:authUrl, expiresIn:600};
}

function handleThreadsOAuthCallback_(p) {
  try {
    if (p.error) throw new Error('Threads認証がキャンセルされました: ' + (p.error_description || p.error));
    if (!p.code || !p.state) throw new Error('Threadsから認証コードを受け取れませんでした。');
    const state = verifyThreadsState_(String(p.state));
    const cacheKey = 'threads_oauth_' + state.nonce;
    const expectedPrefix = CacheService.getScriptCache().get(cacheKey);
    if (!expectedPrefix || expectedPrefix !== state.prefix) throw new Error('認証の有効時間が切れました。SNS CONTROLからもう一度開始してください。');
    CacheService.getScriptCache().remove(cacheKey);
    const target = THREADS_BRANDS.find(item => item.prefix === state.prefix);
    if (!target) throw new Error('連携先ブランドを確認できませんでした。');
    const shortToken = exchangeThreadsCode_(String(p.code));
    const longToken = exchangeThreadsLongToken_(shortToken.access_token);
    const accessToken = longToken.access_token || shortToken.access_token;
    const profile = fetchJson_('https://graph.threads.net/v1.0/me?fields=id,username&access_token=' + encodeURIComponent(accessToken), {method:'get'});
    if (!profile.id || !profile.username) throw new Error('Threadsプロフィールを取得できませんでした。');
    if (String(profile.username).toLowerCase() !== target.username.toLowerCase()) {
      throw new Error('選択されたアカウントは @' + profile.username + ' です。@' + target.username + ' に切り替えてやり直してください。');
    }
    const expiresIn = Number(longToken.expires_in || shortToken.expires_in || 0);
    const values = {};
    values[target.prefix + '_THREADS_USER_ID'] = String(profile.id);
    values[target.prefix + '_THREADS_ACCESS_TOKEN'] = String(accessToken);
    values[target.prefix + '_THREADS_USERNAME'] = String(profile.username);
    values[target.prefix + '_THREADS_CONNECTED_AT'] = iso_(now_());
    values[target.prefix + '_THREADS_TOKEN_EXPIRES_AT'] = expiresIn ? iso_(new Date(Date.now() + expiresIn * 1000)) : '';
    PropertiesService.getScriptProperties().setProperties(values);
    return threadsCallbackHtml_(true, '@' + profile.username + ' を ' + target.brand + ' に接続しました。');
  } catch (err) {
    return threadsCallbackHtml_(false, err && err.message ? err.message : String(err));
  }
}

function exchangeThreadsCode_(code) {
  return fetchJson_('https://graph.threads.net/oauth/access_token', {method:'post',payload:{
    client_id:getProperty_('THREADS_APP_ID', true), client_secret:getProperty_('THREADS_APP_SECRET', true),
    grant_type:'authorization_code', redirect_uri:getThreadsRedirectUri_(), code:code
  }});
}

function exchangeThreadsLongToken_(shortToken) {
  return fetchJson_('https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=' +
    encodeURIComponent(getProperty_('THREADS_APP_SECRET', true)) + '&access_token=' + encodeURIComponent(shortToken), {method:'get'});
}

function getThreadsRedirectUri_() { return getProperty_('THREADS_REDIRECT_URI', false) || ScriptApp.getService().getUrl(); }

function verifyThreadsState_(state) {
  const parts = state.split('.');
  if (parts.length !== 2 || parts[1] !== hmacHex_(parts[0], getProperty_('WEB_API_SECRET', true))) throw new Error('Threads認証情報を確認できませんでした。');
  return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
}

function hmacHex_(text, secret) {
  return Utilities.computeHmacSha256Signature(text, secret)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function getThreadsConnectionStatus_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return THREADS_BRANDS.map(item => ({
    brand:item.brand, username:'@' + item.username,
    connected:!!props[item.prefix + '_THREADS_USER_ID'] && !!props[item.prefix + '_THREADS_ACCESS_TOKEN'],
    connectedAt:props[item.prefix + '_THREADS_CONNECTED_AT'] || '', expiresAt:props[item.prefix + '_THREADS_TOKEN_EXPIRES_AT'] || ''
  }));
}

function threadsCallbackHtml_(ok, message) {
  const color = ok ? '#217a55' : '#a33';
  const title = ok ? 'Threads連携完了' : 'Threads連携エラー';
  const safe = String(message).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,Noto Sans JP,sans-serif;background:#f7f4ee;color:#17223b;margin:0;padding:28px"><main style="max-width:560px;margin:40px auto;background:#fff;border-radius:18px;padding:28px;border:1px solid #e7e1d7"><h1 style="color:' + color + ';font-size:24px">' + title + '</h1><p style="line-height:1.8">' + safe + '</p><p style="color:#6b7280">この画面を閉じて、SNS CONTROLの「状態を更新」を押してください。</p></main></body></html>').setTitle(title);
}
