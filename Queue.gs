function processQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const now = now_();
    readObjects_(APP.SHEETS.POSTS).filter(p => {
      const due = p['予約日時'] && new Date(p['予約日時']) <= now;
      const retryDue = !p['次回試行日時'] || new Date(p['次回試行日時']) <= now;
      return due && retryDue && [APP.STATUS.APPROVED, APP.STATUS.QUEUED, APP.STATUS.FAILED].includes(p['ステータス']) && Number(p['試行回数'] || 0) < APP.MAX_ATTEMPTS;
    }).forEach(post => processOne_(post));
  } finally { lock.releaseLock(); }
}

function processOne_(post) {
  if (!post['承認時ハッシュ'] || post['承認時ハッシュ'] !== contentHash_(post)) {
    updatePost_(post._row, {'ステータス':APP.STATUS.PENDING,'承認者':'','承認日時':'','承認時ハッシュ':'','最終エラー':'承認後に内容が変更されたため再承認が必要です。','更新日時':now_()});
    return;
  }
  updatePost_(post._row, {'ステータス': APP.STATUS.POSTING, '更新日時': now_(), 'ロックキー': uuid_()});
  try {
    const result = publishPost_(post);
    const url = result.url || '';
    updatePost_(post._row, {'ステータス': APP.STATUS.POSTED, '投稿結果URL': url, '更新日時': now_(), '最終エラー': '', '次回試行日時': '', 'ロックキー': ''});
    appendObject_(APP.SHEETS.HISTORY, {'履歴ID':uuid_(),'投稿ID':post['投稿ID'],'ブランド':post['ブランド'],'投稿先':post['投稿先'],'実行日時':now_(),'結果':isDryRun_()?'DRY_RUN':'成功','外部ID':result.id || '','投稿URL':url,'レスポンス要約':JSON.stringify(result).slice(0,1000)});
  } catch (err) {
    const attempts = Number(post['試行回数'] || 0) + 1;
    const retryable = attempts < APP.MAX_ATTEMPTS;
    const next = retryable ? new Date(now_().getTime() + APP.RETRY_MINUTES[Math.min(attempts - 1, APP.RETRY_MINUTES.length - 1)] * 60000) : '';
    updatePost_(post._row, {'ステータス': APP.STATUS.FAILED, '試行回数': attempts, '次回試行日時': next, '最終エラー': String(err.message || err), '更新日時': now_(), 'ロックキー': ''});
    appendObject_(APP.SHEETS.ERRORS, {'エラーID':uuid_(),'投稿ID':post['投稿ID'],'発生日時':now_(),'投稿先':post['投稿先'],'処理':'publish','HTTPコード':err.httpCode || '','内容':String(err.stack || err).slice(0,4000),'再試行可':retryable});
  }
}

function publishPost_(post) {
  if (isDryRun_()) return {id:'dry-' + post['投稿ID'], url:'', dryRun:true};
  if (post['投稿先'] === 'X') return publishX_(post);
  if (post['投稿先'] === 'Instagram') return publishInstagram_(post);
  if (post['投稿先'] === 'Threads') return publishThreads_(post);
  throw new Error('未対応の投稿先です。');
}
