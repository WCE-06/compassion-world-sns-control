function verifyFirebaseIdToken_(idToken) {
  const token = String(idToken || '');
  if (!token || token.length > 5000) throw new Error('ログイン情報がありません。');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'firebase_' + sha256Hex_(token).slice(0, 48);
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const apiKey = getProperty_('FIREBASE_WEB_API_KEY', true);
  const response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({idToken:token}), muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('ログインの有効期限が切れました。もう一度ログインしてください。');
  const body = JSON.parse(response.getContentText() || '{}');
  const user = body.users && body.users[0];
  if (!user || !user.localId || !user.email || user.disabled) throw new Error('このアカウントは利用できません。');
  const identity = {uid:String(user.localId), email:String(user.email).toLowerCase(), name:String(user.displayName || '')};
  cache.put(cacheKey, JSON.stringify(identity), 300);
  return identity;
}

function requireFirebaseActor_(action, idToken) {
  const required = WEB_ACTION_ROLES[action];
  if (!required) throw new Error('操作が不正です。');
  const identity = verifyFirebaseIdToken_(idToken);
  let staff = findStaffByUid_(identity.uid);
  if (!staff) staff = bootstrapFirstAdmin_(identity);
  if (!staff || staff['有効'] === false || String(staff['有効']).toLowerCase() === 'false') throw new Error('このアカウントは利用停止中です。');
  if (String(staff['メールアドレス'] || '').toLowerCase() !== identity.email) throw new Error('従業員情報が一致しません。');
  const role = String(staff['権限'] || 'viewer');
  if (!WEB_ROLE_LEVELS[role] || WEB_ROLE_LEVELS[role] < WEB_ROLE_LEVELS[required]) throw new Error('この操作を行う権限がありません。');
  return {uid:identity.uid, email:identity.email, name:String(staff['氏名'] || identity.name || ''), role:role};
}

function bootstrapFirstAdmin_(identity) {
  const expected = getProperty_('BOOTSTRAP_ADMIN_EMAIL', false).trim().toLowerCase();
  if (!expected || identity.email !== expected) return null;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = findStaffByUid_(identity.uid);
    if (existing) return existing;
    if (getProperty_('AUTH_BOOTSTRAPPED', false) === 'true') return null;
    appendObject_(APP.SHEETS.STAFF, {
      'ユーザーID':identity.uid, 'メールアドレス':identity.email, '氏名':identity.name || '管理人',
      '権限':'admin', '有効':true, '作成日時':now_(), '作成者':'bootstrap'
    });
    PropertiesService.getScriptProperties().setProperty('AUTH_BOOTSTRAPPED', 'true');
    return findStaffByUid_(identity.uid);
  } finally { lock.releaseLock(); }
}

function findStaffByUid_(uid) { return readObjects_(APP.SHEETS.STAFF).find(row => String(row['ユーザーID']) === String(uid)); }

function listEmployees_() {
  return {employees:readObjects_(APP.SHEETS.STAFF).map(row => ({
    uid:String(row['ユーザーID']), email:String(row['メールアドレス']), name:String(row['氏名']),
    role:String(row['権限']), active:!(row['有効'] === false || String(row['有効']).toLowerCase() === 'false')
  })).sort((a,b) => a.name.localeCompare(b.name, 'ja'))};
}

function createEmployee_(input, actor) {
  const identity = verifyFirebaseIdToken_(input.employeeToken);
  const name = String(input.name || '').trim();
  const role = String(input.role || 'editor');
  if (!name || !WEB_ROLE_LEVELS[role]) throw new Error('氏名または権限を確認してください。');
  if (findStaffByUid_(identity.uid) || readObjects_(APP.SHEETS.STAFF).some(row => String(row['メールアドレス']).toLowerCase() === identity.email)) {
    throw new Error('このメールアドレスは登録済みです。');
  }
  appendObject_(APP.SHEETS.STAFF, {
    'ユーザーID':identity.uid, 'メールアドレス':identity.email, '氏名':name, '権限':role, '有効':true,
    '作成日時':now_(), '作成者':actor.email
  });
  return {uid:identity.uid, email:identity.email};
}

function setEmployeeActive_(input, actor) {
  const uid = String(input.uid || '');
  const active = input.active === true;
  if (!uid) throw new Error('対象者を確認できません。');
  if (uid === actor.uid && !active) throw new Error('自分自身は停止できません。');
  updateStaff_(uid, {'有効':active, '更新日時':now_(), '更新者':actor.email});
  return {ok:true};
}

function setEmployeeRole_(input, actor) {
  const uid = String(input.uid || '');
  const role = String(input.role || '');
  if (!uid || !WEB_ROLE_LEVELS[role]) throw new Error('対象者または権限を確認できません。');
  if (uid === actor.uid && role !== 'admin') throw new Error('自分自身の管理人権限は解除できません。');
  updateStaff_(uid, {'権限':role, '更新日時':now_(), '更新者':actor.email});
  return {ok:true};
}

function updateStaff_(uid, changes) {
  const staff = findStaffByUid_(uid);
  if (!staff) throw new Error('従業員が見つかりません。');
  const sh = sheet_(APP.SHEETS.STAFF);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(changes).forEach(key => {
    const col = headers.indexOf(key) + 1;
    if (col > 0) sh.getRange(staff._row, col).setValue(changes[key]);
  });
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
