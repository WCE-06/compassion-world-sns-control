const APP = Object.freeze({
  NAME: 'COMPASSION WORLD SNS CONTROL',
  VERSION: '0.3.0',
  TZ: 'Asia/Tokyo',
  SHEETS: {
    POSTS: '投稿管理', BRANDS: 'ブランド', HISTORY: '投稿履歴',
    ERRORS: 'エラー記録', MATERIALS: '素材依頼', SETTINGS: '設定'
  },
  STATUS: {
    DRAFT: '下書き', PENDING: '承認待ち', APPROVED: '承認済み',
    QUEUED: '予約済み', POSTING: '投稿中', POSTED: '投稿済み',
    FAILED: 'エラー', REJECTED: '差戻し', CANCELLED: '取消'
  },
  APPROVAL: { AUTO: 'L1_自動', CONFIRM: 'L2_要確認', REQUIRED: 'L3_必須承認' },
  CHANNELS: ['Instagram', 'Threads', 'X'],
  POST_HEADERS: [
    '投稿ID','ブランド','投稿種別','投稿本文','画像URL','投稿先','予約日時',
    '承認レベル','ステータス','承認者','承認日時','作成者','作成日時',
    '更新日時','投稿結果URL','試行回数','次回試行日時','最終エラー','ロックキー','承認時ハッシュ'
  ],
  MAX_ATTEMPTS: 3,
  RETRY_MINUTES: [5, 20, 60]
});

// 今回作成した実運用シート。別環境へ移す場合は空文字にしてSPREADSHEET_IDを設定します。
const DEFAULT_SPREADSHEET_ID = '1N_SOVw-CxN309pvaE0v080_sMy1U8wv8jO5PAqpAPv8';

const BRAND_ROWS = [
  ['CW','COMPASSION WORLD',true,''],
  ['OMO','おもひで商店',true,''],
  ['AOZ','Aozora Kitchen',true,''],
  ['FEB','FEBBRAIO',true,''],
  ['ART','アートリエ',true,''],
  ['KAZU','Kazu個人',true,'本人名義のため常にL3']
];

const POST_TYPES = ['通常','イベント','料金改定','Kazu本人名義','攻めた投稿','緊急告知'];

function getProperty_(key, required) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (required && !value) throw new Error('スクリプトプロパティ「' + key + '」が未設定です。');
  return value || '';
}

function isDryRun_() { return getProperty_('DRY_RUN', false) !== 'false'; }

function now_() { return new Date(); }

function iso_(date) { return Utilities.formatDate(new Date(date), APP.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function uuid_() { return Utilities.getUuid(); }

function contentHash_(post) {
  const raw = [post['ブランド'], post['投稿種別'], post['投稿本文'], post['画像URL'], post['投稿先'], iso_(post['予約日時'])].join('\n');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
