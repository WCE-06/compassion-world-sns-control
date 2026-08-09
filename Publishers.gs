function publishX_(post) {
  const token = getBrandSecret_(post['ブランド'], 'X_ACCESS_TOKEN');
  const payload = {text: post['投稿本文']};
  if (post['画像URL']) throw new Error('MVPのX画像アップロードは未対応です。本文のみで投稿するか拡張してください。');
  const data = fetchJson_('https://api.x.com/2/tweets', {method:'post',headers:{Authorization:'Bearer ' + token},contentType:'application/json',payload:JSON.stringify(payload)});
  return {id:data.data.id, url:'https://x.com/i/web/status/' + data.data.id};
}

function publishInstagram_(post) {
  const userId = getBrandSecret_(post['ブランド'], 'META_IG_USER_ID');
  const token = getBrandSecret_(post['ブランド'], 'META_ACCESS_TOKEN');
  const base = 'https://graph.facebook.com/' + (getProperty_('META_GRAPH_VERSION', false) || 'v23.0');
  const created = fetchJson_(base + '/' + encodeURIComponent(userId) + '/media', {method:'post',payload:{image_url:post['画像URL'],caption:post['投稿本文'],access_token:token}});
  const published = fetchJson_(base + '/' + encodeURIComponent(userId) + '/media_publish', {method:'post',payload:{creation_id:created.id,access_token:token}});
  return {id:published.id, url:'https://www.instagram.com/'};
}

function publishThreads_(post) {
  const userId = getBrandSecret_(post['ブランド'], 'THREADS_USER_ID');
  const token = getBrandSecret_(post['ブランド'], 'THREADS_ACCESS_TOKEN');
  const base = 'https://graph.threads.net/' + (getProperty_('THREADS_GRAPH_VERSION', false) || 'v1.0');
  const payload = {media_type:post['画像URL']?'IMAGE':'TEXT',text:post['投稿本文'],access_token:token};
  if (post['画像URL']) payload.image_url = post['画像URL'];
  const created = fetchJson_(base + '/' + encodeURIComponent(userId) + '/threads', {method:'post',payload:payload});
  const published = fetchJson_(base + '/' + encodeURIComponent(userId) + '/threads_publish', {method:'post',payload:{creation_id:created.id,access_token:token}});
  return {id:published.id, url:'https://www.threads.net/'};
}

function getBrandSecret_(brand, suffix) {
  const brandRow = BRAND_ROWS.find(r => r[1] === brand);
  if (!brandRow) throw new Error('ブランド設定がありません。');
  return getProperty_(brandRow[0] + '_' + suffix, true);
}

function fetchJson_(url, options) {
  const response = UrlFetchApp.fetch(url, Object.assign({muteHttpExceptions:true}, options));
  const code = response.getResponseCode();
  const text = response.getContentText();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = {raw:text}; }
  if (code < 200 || code >= 300) {
    const err = new Error('APIエラー (' + code + '): ' + text.slice(0,1000));
    err.httpCode = code; throw err;
  }
  return data;
}
