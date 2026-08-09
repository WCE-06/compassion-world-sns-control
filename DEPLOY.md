# 配置メモ

## Apps Script画面から配置する場合

READMEの手順どおり、各ファイルを同名で登録します。`.gs` と `.html` はすべて必要です。

## claspを使う場合

1. Google Apps Script APIを有効化する。
2. このフォルダで `clasp login`。
3. 対象スプレッドシートのApps ScriptプロジェクトIDを確認する。
4. `.clasp.json` を `{"scriptId":"プロジェクトID","rootDir":"."}` として作成する。
5. `clasp push`。
6. Apps Script画面で `setupSystem` を実行する。

`.clasp.json` は環境固有のため、この配布物には含めていません。

## 更新時

既存環境でも `setupSystem` を再実行できます。不足列とトリガーを追加し、既存投稿は削除しません。Web Appは「デプロイを管理」から新バージョンへ更新してください。
