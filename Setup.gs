function onOpen() {
  SpreadsheetApp.getUi().createMenu('SNS CONTROL')
    .addItem('初期セットアップ', 'setupSystem')
    .addItem('Web Appを開く', 'showWebAppUrl')
    .addSeparator()
    .addItem('投稿キューを実行', 'processQueue')
    .addItem('トリガーを再作成', 'installTriggers')
    .addItem('導入診断', 'showSystemHealth')
    .addItem('セルフテスト', 'showSelfTest')
    .addItem('DRY RUNデモを追加', 'seedDemoData')
    .addToUi();
}

function setupSystem() {
  const ss = ss_();
  createSheet_(ss, APP.SHEETS.POSTS, APP.POST_HEADERS);
  createSheet_(ss, APP.SHEETS.BRANDS, ['ブランドID','ブランド名','有効','メモ']);
  createSheet_(ss, APP.SHEETS.HISTORY, ['履歴ID','投稿ID','ブランド','投稿先','実行日時','結果','外部ID','投稿URL','レスポンス要約']);
  createSheet_(ss, APP.SHEETS.ERRORS, ['エラーID','投稿ID','発生日時','投稿先','処理','HTTPコード','内容','再試行可','解決日時']);
  createSheet_(ss, APP.SHEETS.MATERIALS, ['依頼ID','ブランド','必要日','素材種別','依頼内容','担当','ステータス','素材URL','作成日時']);
  createSheet_(ss, APP.SHEETS.SETTINGS, ['キー','値','説明']);
  seedBrands_();
  seedSettings_();
  applyValidations_();
  formatSheets_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  if (!PropertiesService.getScriptProperties().getProperty('DRY_RUN')) {
    PropertiesService.getScriptProperties().setProperty('DRY_RUN', 'true');
  }
  installTriggers();
  console.log('初期化完了。DRY_RUN=true のため、まだ実投稿はされません。');
}

function createSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  headers.forEach(header => {
    if (!existing.includes(header)) sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
  });
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#16213e').setFontColor('#ffffff');
  return sh;
}

function seedBrands_() {
  const sh = sheet_(APP.SHEETS.BRANDS);
  if (sh.getLastRow() === 1) sh.getRange(2, 1, BRAND_ROWS.length, BRAND_ROWS[0].length).setValues(BRAND_ROWS);
}

function seedSettings_() {
  const sh = sheet_(APP.SHEETS.SETTINGS);
  if (sh.getLastRow() > 1) return;
  const rows = [
    ['DRY_RUN','true','実投稿を止める安全スイッチ。Script Propertiesを正とする'],
    ['QUEUE_INTERVAL_MIN','5','投稿キュー確認間隔'],
    ['DEFAULT_APPROVER','','承認担当メール（任意）'],
    ['NOTE','認証情報はシートに保存しない','Script Propertiesを使用']
  ];
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

function applyValidations_() {
  const sh = sheet_(APP.SHEETS.POSTS);
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  validation_(sh.getRange(2, 2, rows, 1), BRAND_ROWS.map(r => r[1]));
  validation_(sh.getRange(2, 3, rows, 1), POST_TYPES);
  validation_(sh.getRange(2, 6, rows, 1), APP.CHANNELS);
  validation_(sh.getRange(2, 8, rows, 1), Object.values(APP.APPROVAL));
  validation_(sh.getRange(2, 9, rows, 1), Object.values(APP.STATUS));
}

function validation_(range, values) {
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build());
}

function formatSheets_() {
  const sh = sheet_(APP.SHEETS.POSTS);
  sh.setColumnWidth(4, 420); sh.setColumnWidth(5, 260); sh.setColumnWidth(7, 160);
  sh.getRange('G:G').setNumberFormat('yyyy/mm/dd hh:mm');
  sh.getRange('K:K').setNumberFormat('yyyy/mm/dd hh:mm');
  sh.getRange('M:N').setNumberFormat('yyyy/mm/dd hh:mm');
  sh.getDataRange().setVerticalAlignment('top');
}

function installTriggers() {
  ScriptApp.getProjectTriggers().filter(t => ['processQueue','handlePostEdit'].includes(t.getHandlerFunction())).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('handlePostEdit').forSpreadsheet(ss_()).onEdit().create();
}

function showWebAppUrl() {
  SpreadsheetApp.getUi().alert(ScriptApp.getService().getUrl() || '先に「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を実行してください。');
}

function showSystemHealth() {
  const health = getSystemHealth_();
  const lines = [
    'バージョン: ' + health.version,
    'モード: ' + (health.dryRun ? 'DRY RUN' : 'LIVE'),
    '投稿トリガー: ' + (health.queueTrigger ? 'OK' : '未設定'),
    '編集監視: ' + (health.editTrigger ? 'OK' : '未設定'),
    '承認者制限: ' + (health.approverRestricted ? '設定済み' : '未設定（アクセスユーザー全員）'),
    'API設定: ' + health.configuredConnections + '/' + health.totalConnections
  ];
  SpreadsheetApp.getUi().alert('SNS CONTROL 導入診断', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function showSelfTest() {
  const result = runSelfTest();
  SpreadsheetApp.getUi().alert(result.ok ? 'セルフテスト成功' : 'セルフテスト要確認', result.ok ? '基本構成と承認ルールは正常です。' : result.errors.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function seedDemoData() {
  if (!isDryRun_()) throw new Error('デモデータはDRY_RUN=trueのときだけ追加できます。');
  const base = new Date(now_().getTime() + 15 * 60000);
  const samples = [
    {brand:'COMPASSION WORLD',type:'通常',body:'【DRY RUN】通常投稿の動作確認です。',channels:['Threads','X'],scheduledAt:base.toISOString(),imageUrl:''},
    {brand:'FEBBRAIO',type:'料金改定',body:'【DRY RUN】料金改定投稿。承認フロー確認用です。',channels:['Threads'],scheduledAt:new Date(base.getTime()+5*60000).toISOString(),imageUrl:''},
    {brand:'Kazu個人',type:'攻めた投稿',body:'【DRY RUN】Kazu本人名義・必須承認の確認用です。',channels:['X'],scheduledAt:new Date(base.getTime()+10*60000).toISOString(),imageUrl:''}
  ];
  samples.forEach(createPost);
  appendObject_(APP.SHEETS.MATERIALS, {'依頼ID':uuid_(),'ブランド':'FEBBRAIO','必要日':new Date(now_().getTime()+86400000),'素材種別':'投稿画像','依頼内容':'【DRY RUN】料金改定告知の画像','担当':'未定','ステータス':'未着手','作成日時':now_()});
  SpreadsheetApp.getUi().alert('DRY RUNデモを追加しました。Web Appで承認待ちと素材依頼を確認してください。');
}

function handlePostEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== APP.SHEETS.POSTS || e.range.getRow() < 2) return;
  const protectedColumns = [2, 3, 4, 5, 6, 7];
  const editedColumns = Array.from({length:e.range.getNumColumns()}, (_, i) => e.range.getColumn() + i);
  if (!editedColumns.some(col => protectedColumns.includes(col))) return;
  const posts = readObjects_(APP.SHEETS.POSTS);
  for (let row = e.range.getRow(); row < e.range.getRow() + e.range.getNumRows(); row++) {
    const post = posts.find(p => p._row === row);
    if (!post || [APP.STATUS.POSTED, APP.STATUS.CANCELLED].includes(post['ステータス'])) continue;
    const level = decideApprovalLevel_({brand:post['ブランド'], type:post['投稿種別']});
    updatePost_(row, {'承認レベル':level,'ステータス':initialStatus_(level),'承認者':'','承認日時':'','承認時ハッシュ':level === APP.APPROVAL.AUTO ? contentHash_(post) : '','更新日時':now_(),'最終エラー':level === APP.APPROVAL.AUTO ? '' : '内容変更のため再承認が必要です。'});
  }
}
