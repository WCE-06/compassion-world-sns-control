function decideApprovalLevel_(post) {
  if (post.brand === 'Kazu個人' || post.type === 'Kazu本人名義' || post.type === '攻めた投稿') return APP.APPROVAL.REQUIRED;
  if (['イベント','料金改定','緊急告知'].includes(post.type)) return APP.APPROVAL.CONFIRM;
  return APP.APPROVAL.AUTO;
}

function initialStatus_(level) {
  // 承認レベルはリスク分類として残すが、すべての投稿を最終確認へ送る。
  return APP.STATUS.PENDING;
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
  const allowed = configuredApprovers_();
  if (!allowed.length) throw new Error('管理人のメールアドレスが未設定です。Script PropertiesのAPPROVER_EMAILSを設定してください。');
  if (!email) throw new Error('承認者のGoogleアカウントを確認できません。Web Appのアクセス設定を確認してください。');
  if (!allowed.includes(email.toLowerCase())) throw new Error('このアカウントには承認権限がありません。');
  return email;
}

function assertFinalApproval_(post) {
  const allowed = configuredApprovers_();
  const approver = String(post['承認者'] || '').trim().toLowerCase();
  if (!allowed.length || !approver || !allowed.includes(approver)) {
    throw new Error('管理人の最終承認が確認できないため投稿を停止しました。');
  }
  if (!post['承認日時']) throw new Error('承認日時がないため投稿を停止しました。');
  if (!post['承認時ハッシュ'] || post['承認時ハッシュ'] !== contentHash_(post)) {
    throw new Error('承認後に内容が変更されたため再承認が必要です。');
  }
}
