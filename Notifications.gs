function notificationEmail_() {
  return getProperty_('APPROVAL_NOTIFICATION_EMAIL', true).trim();
}

function approvalControlUrl_() {
  return getProperty_('SNS_CONTROL_URL', false) || 'https://wce-06.github.io/compassion-world-sns-control/';
}

function sendApprovalRequestForIds_(postIds, reminder) {
  createSheet_(ss_(), APP.SHEETS.POSTS, APP.POST_HEADERS);
  const posts = postIds.map(findPost_).filter(Boolean);
  if (!posts.length) return;
  try {
    const first = posts[0];
    const channels = posts.map(p => p['投稿先']).join('・');
    const when = first['予約日時'] ? Utilities.formatDate(new Date(first['予約日時']), APP.TZ, 'yyyy年M月d日 HH:mm') : '未設定';
    const subjectPrefix = reminder ? '【再通知・承認待ち】' : '【投稿承認のお願い】';
    const subject = subjectPrefix + first['ブランド'] + '／' + channels;
    const body = [
      'SNS CONTROLに承認待ちの投稿があります。',
      '',
      'ブランド: ' + first['ブランド'],
      '投稿先: ' + channels,
      '予約日時: ' + when,
      '注意度: ' + first['承認レベル'],
      '',
      '投稿本文:',
      first['投稿本文'],
      '',
      first['画像URL'] ? '画像: ' + first['画像URL'] : '画像: なし',
      '',
      '次の画面で本文・画像・投稿先・予約日時を確認し、「承認」を押してください。',
      approvalControlUrl_(),
      '',
      '承認されるまで自動投稿されません。'
    ].join('\n');
    const html = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Noto Sans JP\',sans-serif;line-height:1.7;color:#17223b">' +
      '<h2 style="margin:0 0 16px">SNS投稿の承認をお願いします</h2>' +
      '<p><b>ブランド:</b> ' + htmlEscape_(first['ブランド']) + '<br><b>投稿先:</b> ' + htmlEscape_(channels) + '<br><b>予約日時:</b> ' + htmlEscape_(when) + '<br><b>注意度:</b> ' + htmlEscape_(first['承認レベル']) + '</p>' +
      '<div style="white-space:pre-wrap;padding:16px;background:#f7f4ee;border-radius:10px">' + htmlEscape_(first['投稿本文']) + '</div>' +
      (first['画像URL'] ? '<p><a href="' + htmlEscape_(first['画像URL']) + '">使用画像を確認</a></p>' : '<p>画像なし</p>') +
      '<p><a href="' + htmlEscape_(approvalControlUrl_()) + '" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#ec6b4e;color:#fff;text-decoration:none;font-weight:bold">SNS CONTROLで確認する</a></p>' +
      '<p style="font-size:12px;color:#6b7280">管理画面で最終承認されるまで、この投稿は公開されません。</p></div>';
    MailApp.sendEmail({to:notificationEmail_(), subject:subject, body:body, htmlBody:html, name:APP.NAME});
    const field = reminder ? '承認催促通知日時' : '承認依頼通知日時';
    posts.forEach(p => updatePost_(p._row, {[field]:now_()}));
  } catch (err) {
    appendObject_(APP.SHEETS.ERRORS, {'エラーID':uuid_(),'投稿ID':posts.map(p => p['投稿ID']).join(','),'発生日時':now_(),'投稿先':'Email','処理':reminder?'approval-reminder':'approval-request','内容':String(err.stack || err).slice(0,4000),'再試行可':true});
  }
}

function sendPendingApprovalReminders() {
  createSheet_(ss_(), APP.SHEETS.POSTS, APP.POST_HEADERS);
  const hours = Number(getProperty_('APPROVAL_REMINDER_HOURS', false) || 3);
  const deadline = new Date(now_().getTime() + hours * 60 * 60 * 1000);
  const pending = readObjects_(APP.SHEETS.POSTS).filter(p =>
    p['ステータス'] === APP.STATUS.PENDING &&
    p['予約日時'] && new Date(p['予約日時']) <= deadline &&
    !p['承認催促通知日時']
  );
  if (!pending.length) return;
  const groups = {};
  pending.forEach(p => {
    const key = String(p['投稿ID']).replace(/-(instagram|threads|x)$/i, '');
    if (!groups[key]) groups[key] = [];
    groups[key].push(p['投稿ID']);
  });
  Object.keys(groups).forEach(key => sendApprovalRequestForIds_(groups[key], true));
}

function htmlEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
