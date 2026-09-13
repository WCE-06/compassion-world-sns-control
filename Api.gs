function doGet(e) {
  if (e && e.parameter && (e.parameter.code || e.parameter.error) && e.parameter.state) return handleThreadsOAuthCallback_(e.parameter);
  if (e && e.parameter && e.parameter.mobile === '1') return renderMobileControl_();
  if (e && e.parameter && e.parameter.apiResult === '1') return handleWebApiResult_(e.parameter);
  return ContentService.createTextOutput('COMPASSION WORLD SNS CONTROL: https://wce-06.github.io/compassion-world-sns-control/')
    .setMimeType(ContentService.MimeType.TEXT);
}

function renderMobileControl_() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('COMPASSION WORLD SNS CONTROL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Editor-visible entry point for the full DRY RUN verification.
function runFullSystemDryRunTest() {
  return runEndToEndDryRunTest();
}

function doPost(e) {
  if (e && e.postData && e.postData.contents && String(e.postData.type || '').indexOf('application/json') === 0) {
    return handleInboundApi_(e.postData.contents);
  }
  if (e && e.parameter && e.parameter.api === '1') return handleWebApiPost_(e.parameter);
  if (e && e.parameter && e.parameter.meta_callback) return handleThreadsMetaCallback_(e.parameter);
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:'unsupported'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleInboundApi_(raw) {
  try {
    const request = JSON.parse(String(raw || '{}'));
    const providedHash = sha256Text_(String(request.apiKey || ''));
    if (!secureEqual_(providedHash, INBOUND_API_KEY_SHA256)) return jsonOutput_({ok:false,error:'UNAUTHORIZED'});
    if (request.action !== 'importDraft') return jsonOutput_({ok:false,error:'UNSUPPORTED_ACTION'}, 400);
    const data = importExternalDraft_(request.data || {});
    return jsonOutput_({ok:true,data:data});
  } catch (error) {
    return jsonOutput_({ok:false,error:error && error.message ? error.message : String(error)}, 400);
  }
}

function importExternalDraft_(input) {
  const sourceId = String(input.sourceId || '').trim();
  if (!/^[0-9A-Za-z_-]{8,120}$/.test(sourceId)) throw new Error('SOURCE_ID_INVALID');
  const lockKey = 'MEMBER_ADMIN:' + sourceId;
  const existing = readObjects_(APP.SHEETS.POSTS).filter(row => String(row['ロックキー'] || '') === lockKey);
  if (existing.length) return {imported:false,idempotent:true,postIds:existing.map(row => row['投稿ID'])};
  const payload = {brand:String(input.brand || 'COMPASSION WORLD'),type:String(input.type || '通常'),body:String(input.body || ''),imageUrl:String(input.imageUrl || ''),scheduledAt:String(input.scheduledAt || ''),channels:Array.isArray(input.channels) ? input.channels : [],_actor:{email:String(input.actor || 'member-admin'),name:'会員管理SNS連携',uid:'member-admin',role:'editor'}};
  validatePostInput_(payload);
  const level = decideApprovalLevel_(payload),now=now_(),groupId=uuid_(),createdIds=[];
  payload.channels.forEach(channel => {const row={'投稿ID':groupId+'-'+channel.toLowerCase(),'ブランド':payload.brand,'投稿種別':payload.type,'投稿本文':payload.body.trim(),'画像URL':payload.imageUrl.trim(),'投稿先':channel,'予約日時':new Date(payload.scheduledAt),'承認レベル':level,'ステータス':APP.STATUS.PENDING,'作成者':payload._actor.email,'作成日時':now,'更新日時':now,'試行回数':0,'ロックキー':lockKey};appendObject_(APP.SHEETS.POSTS,row);createdIds.push(row['投稿ID']);});
  sendApprovalRequestForIds_(createdIds,false);
  appendWebAudit_(payload._actor,'importDraft',{id:sourceId},'成功','会員管理から受信');
  return {imported:true,idempotent:false,postIds:createdIds,approvalLevel:level,status:APP.STATUS.PENDING};
}

function secureEqual_(left,right){if(!left||left.length!==right.length)return false;let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;}
function sha256Text_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function jsonOutput_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

function getDashboardData() {
  const today = Utilities.formatDate(now_(), APP.TZ, 'yyyy-MM-dd');
  const tomorrow = Utilities.formatDate(new Date(now_().getTime() + 86400000), APP.TZ, 'yyyy-MM-dd');
  const posts = readObjects_(APP.SHEETS.POSTS).map(serializePost_);
  const scheduledDay = p => p.scheduledAt ? p.scheduledAt.slice(0, 10) : '';
  return {
    app: APP.NAME, version: APP.VERSION, dryRun: isDryRun_(), health: getSystemHealth_(), threadsConnections:getThreadsConnectionStatus_(),
    today: posts.filter(p => scheduledDay(p) === today),
    pending: posts.filter(p => p.status === APP.STATUS.PENDING),
    tomorrow: posts.filter(p => scheduledDay(p) === tomorrow),
    materials: readObjects_(APP.SHEETS.MATERIALS).map(serializeMaterial_).filter(m => m.status !== '完了'),
    recentErrors: readObjects_(APP.SHEETS.ERRORS).slice(-10).reverse().map(serializeError_)
  };
}

function createPost(input) {
  validatePostInput_(input);
  const channels = Array.isArray(input.channels) ? input.channels : [input.channel];
  const level = decideApprovalLevel_(input);
  const now = now_();
  const groupId = uuid_();
  const createdIds = [];
  channels.forEach(channel => {
    const row = {
      '投稿ID': groupId + '-' + channel.toLowerCase(), 'ブランド': input.brand, '投稿種別': input.type,
      '投稿本文': input.body.trim(), '画像URL': (input.imageUrl || '').trim(),
      '投稿先': channel, '予約日時': new Date(input.scheduledAt),
      '承認レベル': level, 'ステータス': initialStatus_(level),
      '作成者': input._actor && input._actor.email ? String(input._actor.email) : (Session.getActiveUser().getEmail() || 'unknown'), '作成日時': now,
      '更新日時': now, '試行回数': 0
    };
    appendObject_(APP.SHEETS.POSTS, row);
    createdIds.push(row['投稿ID']);
  });
  sendApprovalRequestForIds_(createdIds, false);
  return {ok: true, count: channels.length, approvalLevel: level, status: initialStatus_(level)};
}

function updatePostFromWeb_(input, actor) {
  const id = String(input.id || '');
  const post = findPost_(id);
  if (!post) throw new Error('投稿が見つかりません。');
  if ([APP.STATUS.POSTING, APP.STATUS.POSTED, APP.STATUS.CANCELLED].includes(post['ステータス'])) {
    throw new Error('この投稿は編集できません。');
  }
  input.channels = Array.isArray(input.channels) ? input.channels : [input.channel];
  if (input.channels.length !== 1) throw new Error('編集時の投稿先は1つだけ選択してください。');
  validatePostInput_(input);
  const level = decideApprovalLevel_(input);
  updatePost_(post._row, {
    'ブランド':input.brand, '投稿種別':input.type, '投稿本文':input.body.trim(),
    '画像URL':String(input.imageUrl || '').trim(), '投稿先':input.channels[0],
    '予約日時':new Date(input.scheduledAt), '承認レベル':level, 'ステータス':APP.STATUS.PENDING,
    '承認者':'', '承認者UID':'', '承認者権限':'', '承認日時':'', '承認時ハッシュ':'',
    '承認依頼通知日時':'', '承認催促通知日時':'', '最終エラー':'', '更新日時':now_()
  });
  sendApprovalRequestForIds_([id], false);
  return {ok:true, id:id, approvalLevel:level, status:APP.STATUS.PENDING};
}

function validatePostInput_(p) {
  if (!p || !BRAND_ROWS.some(r => r[1] === p.brand)) throw new Error('ブランドを選択してください。');
  if (!POST_TYPES.includes(p.type)) throw new Error('投稿種別が不正です。');
  const channels = Array.isArray(p.channels) ? p.channels : [p.channel];
  if (!channels.length || channels.some(c => !APP.CHANNELS.includes(c))) throw new Error('投稿先が不正です。');
  if (!p.body || !p.body.trim()) throw new Error('投稿本文は必須です。');
  if (!p.scheduledAt || isNaN(new Date(p.scheduledAt).getTime())) throw new Error('予約日時が不正です。');
  if (channels.includes('Instagram') && !p.imageUrl) throw new Error('Instagram投稿には公開アクセス可能な画像URLが必要です。');
  if (channels.includes('Instagram')) {
    const hashtags = p.body.match(/#[^\s#]+/g) || [];
    if (hashtags.length > 5) throw new Error('Instagramのハッシュタグは最大5個です。現在: ' + hashtags.length + '個');
  }
}

function serializePost_(p) {
  return {id:p['投稿ID'], brand:p['ブランド'], type:p['投稿種別'], body:p['投稿本文'], imageUrl:p['画像URL'], channel:p['投稿先'],
    scheduledAt:p['予約日時'] ? iso_(p['予約日時']) : '', approval:p['承認レベル'], status:p['ステータス'], approver:p['承認者'], error:p['最終エラー']};
}
function serializeMaterial_(m) { return {id:m['依頼ID'],brand:m['ブランド'],due:m['必要日'] ? iso_(m['必要日']).slice(0,10):'',type:m['素材種別'],request:m['依頼内容'],owner:m['担当'],status:m['ステータス']}; }
function serializeError_(e) { return {id:e['エラーID'],postId:e['投稿ID'],at:e['発生日時'] ? iso_(e['発生日時']):'',channel:e['投稿先'],message:e['内容']}; }
