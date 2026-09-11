# COMPASSION WORLD SNS CONTROL — MVP v0.7

Googleスプレッドシートを台帳、GitHub Pagesを管理画面、Google Apps Scriptを投稿処理基盤として使うSNS予約投稿システムです。

HTML/CSS/JavaScriptはGitHubを正本として管理し、GitHub Actionsから既存Apps Scriptへ同期する構成です。初回設定は `GITHUB.md`、SNS認証は `SNS_CONNECTION_GUIDE.md` を参照してください。

従業員ログインはFirebase Authentication、権限検証はFirebase Functionsを使用します。共有接続キーを従業員へ配る旧方式は廃止しました。移行手順は `FIREBASE_AUTH_SETUP.md` を参照してください。

## MVPでできること

- 6ブランド、Instagram / Threads / Xの投稿予定を一元管理
- すべての投稿で管理人の最終承認が必須。L1/L2/L3は自動投稿の可否ではなく注意度の分類
- 今日の投稿、承認待ち、明日の候補、素材依頼をWeb Appで表示
- 5分ごとの予約投稿キュー、重複実行ロック、最大3回の再試行
- 投稿履歴とエラー記録
- 初期状態は `DRY_RUN=true`。APIへ送らず一連の動作を確認可能
- 1回の入力から複数SNSへ媒体別の投稿行を一括作成
- 承認後の重要項目変更を検知し、承認を自動リセット
- Firebaseの権限による管理人限定の最終承認
- 投稿案作成時の承認依頼メールと、予約時刻3時間前の未承認リマインド
- Web App上の導入状態表示と、メニューから実行できる導入診断・セルフテスト
- 従業員ごとのメールアドレス／パスワード認証
- 管理人、運用スタッフ、閲覧スタッフの役割別権限
- 従業員の招待・利用停止と操作監査ログ
- 承認レベル3種類と素材依頼を確認できるDRY RUNデモデータ

## 導入

1. 空のGoogleスプレッドシートを作成し、「拡張機能」→「Apps Script」を開く。
2. このフォルダの `.gs` / `.html` と `appsscript.json` を同名で登録する（または clasp でpushする）。
3. `setupSystem` を一度実行して権限を許可する。
4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」。実行ユーザーは自分、アクセス範囲は外部ゲートウェイから到達可能な設定にする（すべての操作は署名検証で保護される）。
5. Script Propertiesに認証情報を登録。値は絶対にシートへ書かない。
6. まずDRY RUNで投稿作成→承認→予約時刻経過→履歴記録まで確認する。
7. 確認後にScript Propertiesの `DRY_RUN` を `false` にする。

## 最短の確認手順

1. `setupSystem` を実行。
2. 「SNS CONTROL」→「セルフテスト」を実行。
3. 「SNS CONTROL」→「DRY RUNデモを追加」を実行。
4. Web Appですべての投稿が「承認待ち」になることを確認。
5. 承認後、予約時刻を過ぎると「投稿履歴」にDRY_RUN結果が入ることを確認。
6. 承認後の本文を変更し、承認がリセットされることを確認。

## 本番化チェックリスト

- Firebase Authenticationの一般登録を設けず、管理人から従業員を招待
- Firebase FunctionsとGASの共有秘密鍵をSecret／Script Propertiesへ設定
- 使用するブランド×媒体だけAPI認証情報を設定
- X Developer Consoleで課金上限・残高アラートを設定
- Metaアプリの必要権限と本番モードを確認
- DRY RUNで文面・画像URL・予約時刻を確認
- 最後に `DRY_RUN=false` へ変更

## Script Properties

ブランド接頭辞: `CW`, `OMO`, `AOZ`, `FEB`, `ART`, `KAZU`

- X: `<接頭辞>_X_ACCESS_TOKEN`
- Instagram: `<接頭辞>_META_IG_USER_ID`。同じMetaシステムユーザーで管理するブランドは `CW_META_ACCESS_TOKEN` を共有可能（ブランド別トークンも指定可能）
- Threads: `<接頭辞>_THREADS_USER_ID`, `<接頭辞>_THREADS_ACCESS_TOKEN`
- 任意: `META_GRAPH_VERSION`（未指定は `v23.0`）、`THREADS_GRAPH_VERSION`（未指定は `v1.0`）
- 必須安全設定: `DRY_RUN=true|false`
- 任意（シートから直接承認する旧運用のみ）: `APPROVER_EMAILS`（許可するGoogleアカウント。通常のWeb管理画面ではFirebaseの管理人権限を使用）
- 必須: `APPROVAL_NOTIFICATION_EMAIL`（承認依頼メールの送信先。公開コードにはメールアドレスを書かない）
- 任意: `APPROVAL_REMINDER_HOURS`（未指定は予約時刻の3時間前に再通知）
- 任意: `SNS_CONTROL_URL`（未指定は公開中のGitHub Pages）

各Xアカウントには、投稿権限を持つユーザーアクセストークンが必要です。単なるApp-only Bearer Tokenでは投稿できません。

## MVPの制約

- 1行につき1投稿先。Web Appで複数媒体を選ぶと媒体ごとに自動で行を作る。
- Instagramは公開アクセス可能な単一画像URLを必須とする。カルーセル、リール、動画は次段階。
- Threadsはテキストまたは単一画像。
- Xは本文のみ。画像アップロードは次段階。
- Metaのコンテナ作成後の処理完了待ち、長期トークン更新、Webhookは本番化前の次段階。
- APIバージョンは廃止期限があるため、Script Propertiesで更新可能にしている。

## 運用ルール

- L1/L2/L3のすべてが承認待ちになり、管理人がWeb Appから最終承認するまで投稿されない。
- Web管理画面ではFirebase上の「管理人」だけが最終承認できる。運用スタッフと閲覧スタッフは承認できない。
- 投稿案を作成すると承認依頼メールを送信し、予約時刻が近づいても未承認なら一度だけ再通知する。
- 承認後に本文・画像・媒体・日時などを変更すると承認を自動リセットする。投稿直前にも承認時ハッシュを照合する。
- `エラー` は再試行対象。3回失敗後は自動停止し、エラー記録を確認して手動対応する。

## 公式API

- X投稿: https://docs.x.com/x-api/posts/create-post
- X従量課金: https://docs.x.com/x-api/getting-started/pricing
- Instagram Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Threads Publishing: https://developers.facebook.com/docs/threads/posts/
