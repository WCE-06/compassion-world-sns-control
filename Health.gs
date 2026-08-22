function getSystemHealth_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const triggers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  let configured = 0;
  const connections = [];
  BRAND_ROWS.forEach(brand => {
    const prefix = brand[0];
    const checks = [
      {channel:'X', ok:!!props[prefix + '_X_ACCESS_TOKEN']},
      {channel:'Instagram', ok:!!props[prefix + '_META_IG_USER_ID'] && !!(props[prefix + '_META_ACCESS_TOKEN'] || props.CW_META_ACCESS_TOKEN || props.META_ACCESS_TOKEN)},
      {channel:'Threads', ok:!!props[prefix + '_THREADS_USER_ID'] && !!props[prefix + '_THREADS_ACCESS_TOKEN']}
    ];
    checks.forEach(c => { if (c.ok) configured++; connections.push({brand:brand[1],channel:c.channel,configured:c.ok}); });
  });
  return {
    version:APP.VERSION,
    dryRun:isDryRun_(),
    spreadsheet:!!props.SPREADSHEET_ID,
    queueTrigger:triggers.includes('processQueue'),
    editTrigger:triggers.includes('handlePostEdit'),
    approverRestricted:configuredApprovers_().length > 0,
    notificationEmailConfigured:!!props.APPROVAL_NOTIFICATION_EMAIL,
    configuredConnections:configured,
    totalConnections:connections.length,
    connections:connections
  };
}

function runSelfTest() {
  const errors = [];
  Object.values(APP.SHEETS).forEach(name => { try { sheet_(name); } catch (e) { errors.push(e.message); } });
  const headers = sheet_(APP.SHEETS.POSTS).getRange(1,1,1,sheet_(APP.SHEETS.POSTS).getLastColumn()).getValues()[0];
  APP.POST_HEADERS.forEach(h => { if (!headers.includes(h)) errors.push('投稿管理に列「' + h + '」がありません。'); });
  const cases = [
    [{brand:'COMPASSION WORLD',type:'通常'},APP.APPROVAL.AUTO],
    [{brand:'FEBBRAIO',type:'料金改定'},APP.APPROVAL.CONFIRM],
    [{brand:'Kazu個人',type:'通常'},APP.APPROVAL.REQUIRED],
    [{brand:'COMPASSION WORLD',type:'攻めた投稿'},APP.APPROVAL.REQUIRED]
  ];
  cases.forEach(c => { if (decideApprovalLevel_(c[0]) !== c[1]) errors.push('承認ルールが不正: ' + JSON.stringify(c[0])); });
  cases.forEach(c => { if (initialStatus_(c[1]) !== APP.STATUS.PENDING) errors.push('すべての投稿が承認待ちになっていません: ' + JSON.stringify(c[0])); });
  const health = getSystemHealth_();
  if (!health.queueTrigger) errors.push('投稿キュートリガーがありません。');
  if (!health.editTrigger) errors.push('編集監視トリガーがありません。');
  if (!health.approverRestricted) errors.push('APPROVER_EMAILSに管理人のメールアドレスを設定してください。');
  if (!getProperty_('APPROVAL_NOTIFICATION_EMAIL', false)) errors.push('APPROVAL_NOTIFICATION_EMAILに承認依頼メールの送信先を設定してください。');
  return {ok:errors.length===0, errors:errors, health:health};
}
