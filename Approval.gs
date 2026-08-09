function decideApprovalLevel_(post) {
  if (post.brand === 'Kazu個人' || post.type === 'Kazu本人名義' || post.type === '攻めた投稿') return APP.APPROVAL.REQUIRED;
  if (['イベント','料金改定','緊急告知'].includes(post.type)) return APP.APPROVAL.CONFIRM;
  return APP.APPROVAL.AUTO;
}

function initialStatus_(level) {
  return level === APP.APPROVAL.AUTO ? APP.STATUS.QUEUED : APP.STATUS.PENDING;
}

function approvePost(postId) {
  const post = findPost_(postId);
  if (!post) throw new Error('投稿が見つかりません。');
  if (![APP.STATUS.PENDING, APP.STATUS.REJECTED].includes(post['ステータス'])) throw new Error('承認できる状態ではありません。');
  const email = requireApprover_();
  updatePost_(post._row, {'ステータス': APP.STATUS.QUEUED, '承認者': email, '承認日時': now_(), '承認時ハッシュ': contentHash_(post), '更新日時': now_(), '最終エラー': ''});
  return {ok: true};
}

function rejectPost(postId, reason) {
  requireApprover_();
  const post = findPost_(postId);
  if (!post) throw new Error('投稿が見つかりません。');
  updatePost_(post._row, {'ステータス': APP.STATUS.REJECTED, '最終エラー': reason || '差戻し', '更新日時': now_()});
  return {ok: true};
}

function requireApprover_() {
  const email = Session.getActiveUser().getEmail();
  const allowed = getProperty_('APPROVER_EMAILS', false).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!email) throw new Error('承認者のGoogleアカウントを確認できません。Web Appのアクセス設定を確認してください。');
  if (allowed.length && !allowed.includes(email.toLowerCase())) throw new Error('このアカウントには承認権限がありません。');
  return email;
}
