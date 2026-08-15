function doGet(e) {
  if (e && e.parameter && (e.parameter.code || e.parameter.error) && e.parameter.state) return handleThreadsOAuthCallback_(e.parameter);
  if (e && e.parameter && e.parameter.api === '1') return handleWebApi_(e.parameter);
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(APP.NAME).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

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
  channels.forEach(channel => {
    const row = {
      '投稿ID': groupId + '-' + channel.toLowerCase(), 'ブランド': input.brand, '投稿種別': input.type,
      '投稿本文': input.body.trim(), '画像URL': (input.imageUrl || '').trim(),
      '投稿先': channel, '予約日時': new Date(input.scheduledAt),
      '承認レベル': level, 'ステータス': initialStatus_(level),
      '作成者': Session.getActiveUser().getEmail() || 'unknown', '作成日時': now,
      '更新日時': now, '試行回数': 0
    };
    if (level === APP.APPROVAL.AUTO) row['承認時ハッシュ'] = contentHash_(row);
    appendObject_(APP.SHEETS.POSTS, row);
  });
  return {ok: true, count: channels.length, approvalLevel: level, status: initialStatus_(level)};
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
