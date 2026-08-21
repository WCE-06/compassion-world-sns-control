# COMPASSION WORLD SNS CONTROL — MVP v0.5

Googleスプレッドシートを台帳、Google Apps Script Web Appを管理画面として使うSNS予約投稿システムです。

HTML/CSS/JavaScriptはGitHubを正本として管理し、GitHub Actionsから既存Apps Scriptへ同期する構成です。初回設定は `GITHUB.md`、SNS認証は `SNS_CONNECTION_GUIDE.md` を参照してください。

## MVPでできること

- 6ブランド、Instagram / Threads / Xの投稿予定を一元管理
- すべての投稿で管理人の最終承認が必須。L1/L2/L3は自動投稿の可否ではなく注意度の分類
- 今日の投稿、承認待ち、明日の候補、素材依頼をWeb Appで表示
- 5分ごとの予約投稿キュー、重複実行ロック、最大3回の再試行
- 投稿履歴とエラー記録
- 初期状態は `DRY_RUN=true`。APIへ送らず一連の動作を確認可能
- 1回の入力から複数SNSへ媒体別の投稿行を一括作成
- 承認後の重要項目変更を検知し、承認を自動リセット
- 承認担当者のメールアドレス制限
- Web App上の導入状態表示と、メニューから実行できる導入診断・セルフテスト
- 承認レベル3種類と素材依頼を確認できるDRY RUNデモデータ

## 導入

1. 空のGoogleスプレッドシートを作成し、「拡張機能」→「Apps Script」を開く。
2. このフォルダの `.gs` / `.html` と `appsscript.json` を同名で登録する（または clasp でpushする）。
3. `setupSystem` を一度実行して権限を許可する。
4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」。実行ユーザーは自分、アクセス範囲は運用メンバーに合わせる。
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

- Web Appのアクセス範囲を運用メンバーだけに限定
- `APPROVER_EMAILS` を設定
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
- 必須: `APPROVER_EMAILS=kazu@example.com`（管理人が使用するGoogleアカウント。複数指定する場合はカンマ区切り）

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
- `APPROVER_EMAILS` に登録したGoogleアカウント以外は承認できない。
- 承認後に本文・画像・媒体・日時などを変更すると承認を自動リセットする。投稿直前にも承認時ハッシュを照合する。
- `エラー` は再試行対象。3回失敗後は自動停止し、エラー記録を確認して手動対応する。

## 公式API

- X投稿: https://docs.x.com/x-api/posts/create-post
- X従量課金: https://docs.x.com/x-api/getting-started/pricing
- Instagram Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Threads Publishing: https://developers.facebook.com/docs/threads/posts/
