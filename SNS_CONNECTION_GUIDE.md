# SNSアカウント連携ガイド

認証情報はGoogleスプレッドシートやGitHubへ保存せず、Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」へ登録します。

## ブランド接頭辞

| ブランド | 接頭辞 |
|---|---|
| COMPASSION WORLD | `CW` |
| おもひで商店 | `OMO` |
| Aozora Kitchen | `AOZ` |
| FEBBRAIO | `FEB` |
| アートリエ | `ART` |
| Kazu個人 | `KAZU` |

## Instagram

### 前提

- Meta DeveloperアカウントとMetaアプリ
- プロアカウントとして利用できるInstagramアカウント
- 採用するInstagram Login方式に必要な公開権限
- 外部から取得できる画像URL

### 手順

1. Meta for Developersでアプリを作成。
2. Instagram APIを追加し、対象Instagramアカウントを認可。
3. Content Publishingに必要な権限を追加し、開発モードでは対象アカウントをテスター／ロールへ追加。
4. Instagram User IDとユーザーアクセストークンを取得。
5. 長期利用する場合は長期トークン化と期限管理を行う。
6. Apps Scriptのスクリプトプロパティへ登録。

```text
FEB_META_IG_USER_ID=Instagram User ID
FEB_META_ACCESS_TOKEN=アクセストークン
```

ブランドごとに接頭辞を変えて同じ2項目を登録します。

### 確認

Instagram投稿は画像URLが必須です。まずDRY RUNのまま投稿を作り、その後1ブランドだけLIVEテストします。

## Threads

### 前提

- Meta DeveloperアカウントとThreads対応アプリ
- 対象のThreadsアカウント
- Threads投稿権限を含むユーザー認可

### 手順

1. Meta for DevelopersでThreads APIを利用するアプリを作成または設定。
2. OAuth Redirect URLなどを設定。
3. 対象Threadsアカウントで認可し、Threads User IDとアクセストークンを取得。
4. 必要に応じて長期トークンへ交換し、期限を管理。
5. Apps Scriptのスクリプトプロパティへ登録。

```text
FEB_THREADS_USER_ID=Threads User ID
FEB_THREADS_ACCESS_TOKEN=アクセストークン
```

ブランドごとに接頭辞を変更します。

## X

### 前提

- X Developerアカウント
- ProjectとApp
- Pay-per-use用クレジットと利用上限設定
- 対象アカウント本人によるユーザー認可

### 推奨方式

OAuth 2.0 Authorization Code with PKCEを使用します。最低限のscopeは次のとおりです。

```text
tweet.read tweet.write users.read offline.access
```

画像投稿を追加する場合は`media.write`も必要です。

### 手順

1. X Developer ConsoleでProjectとAppを作成。
2. App permissionsをRead and Writeに設定。
3. User authenticationを有効化し、Web AppまたはAutomated App/botとして設定。
4. Callback URLを登録。OAuthの`redirect_uri`は完全一致が必要。
5. 対象Xアカウントごとに認可を行い、ユーザーアクセストークンを取得。
6. `offline.access`で得たrefresh tokenを安全に保管し、期限前にaccess tokenを更新する。
7. 現MVPでは取得済みaccess tokenをApps Scriptへ登録。

```text
FEB_X_ACCESS_TOKEN=ユーザーアクセストークン
```

App-only Bearer Tokenでは投稿できません。

## 共通の本番化手順

1. 最初は1ブランド・1媒体だけ設定。
2. Web Appの「API設定」が増えたことを確認。
3. `DRY_RUN=true`で投稿キューと承認を確認。
4. Script Propertiesの`DRY_RUN`を`false`へ変更。
5. 非公開の短いテスト投稿または削除前提の投稿を1件実行。
6. 投稿履歴とエラー記録を確認。
7. 問題がなければ残りのブランドを順番に追加。

## まだ追加実装が必要な点

- X OAuth refresh tokenの自動更新
- Meta長期トークンの期限監視
- Instagramコンテナ処理完了待ち
- X画像アップロード
- 接続テストボタンと失効通知
