function decideApprovalLevel_(post) {
  if (post.brand === 'Kazu個人' || post.type === 'Kazu本人名義' || post.type === '攻めた投稿') return APP.APPROVAL.REQUIRED;
  if (['イベント','料金改定','緊急告知'].includes(post.type)) return APP.APPROVAL.CONFIRM;
  return APP.APPROVAL.AUTO;
}

function initialStatus_(level) {
  // 承認レベルはリスク分類として残すが、すべての投稿を最終確認へ送る。
  return APP.STATUS.PENDING;
}

function approvePost(postId, actor) {
  const post = findPost_(postId);
  if (!post) throw new Error('投稿が見つかりません。');
  if (![APP.STATUS.PENDING, APP.STATUS.REJECTED].includes(post['ステータス'])) throw new Error('承認できる状態ではありません。');
  const approver = requireApprover_(actor);
  updatePost_(post._row, {'ステータス': APP.STATUS.QUEUED, '承認者': approver.email, '承認者UID':approver.uid, '承認者権限':approver.role, '承認日時': now_(), '承認時ハッシュ': contentHash_(post), '更新日時': now_(), '最終エラー': ''});
  return {ok: true};
}

function rejectPost(postId, reason, actor) {
  requireApprover_(actor);
  const post = findPost_(postId);
  if (!post) throw new Error('投稿が見つかりません。');
  updatePost_(post._row, {'ステータス': APP.STATUS.REJECTED, '最終エラー': reason || '差戻し', '更新日時': now_()});
  return {ok: true};
}

function requireApprover_(actor) {
  const email = actor && actor.email ? String(actor.email) : Session.getActiveUser().getEmail();
  const allowed = configuredApprovers_();
  if (!email) throw new Error('承認者を確認できません。');
  if (actor && actor.role !== 'admin') throw new Error('管理人だけが最終承認できます。');
  if (actor) return {email:email.toLowerCase(), uid:String(actor.uid || ''), role:'admin'};
  if (!allowed.length || !allowed.includes(email.toLowerCase())) throw new Error('このアカウントには承認権限がありません。');
  return {email:email.toLowerCase(), uid:'legacy-google-session', role:'admin'};
}

function assertFinalApproval_(post) {
  const allowed = configuredApprovers_();
  const approver = String(post['承認者'] || '').trim().toLowerCase();
  const firebaseAdminApproval = post['承認者権限'] === 'admin' && !!post['承認者UID'];
  const legacyApproval = allowed.length && approver && allowed.includes(approver);
  if (!firebaseAdminApproval && !legacyApproval) {
    throw new Error('管理人の最終承認が確認できないため投稿を停止しました。');
  }
  if (!post['承認日時']) throw new Error('承認日時がないため投稿を停止しました。');
  if (!post['承認時ハッシュ'] || post['承認時ハッシュ'] !== contentHash_(post)) {
    throw new Error('承認後に内容が変更されたため再承認が必要です。');
  }
}
