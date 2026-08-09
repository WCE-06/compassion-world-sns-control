function ss_() {
  const id = getProperty_('SPREADSHEET_ID', false) || DEFAULT_SPREADSHEET_ID;
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。初期セットアップを実行してください。');
  return sh;
}

function readObjects_(sheetName) {
  const sh = sheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => {
    const obj = {_row: i + 2};
    headers.forEach((h, j) => obj[h] = row[j]);
    return obj;
  }).filter(obj => Object.keys(obj).some(k => k !== '_row' && obj[k] !== ''));
}

function appendObject_(sheetName, obj) {
  const sh = sheet_(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(h => Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : ''));
}

function updatePost_(row, changes) {
  const sh = sheet_(APP.SHEETS.POSTS);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(changes).forEach(key => {
    const col = headers.indexOf(key) + 1;
    if (col > 0) sh.getRange(row, col).setValue(changes[key]);
  });
}

function findPost_(id) { return readObjects_(APP.SHEETS.POSTS).find(p => p['投稿ID'] === id); }
