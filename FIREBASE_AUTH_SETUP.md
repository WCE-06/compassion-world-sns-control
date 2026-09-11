# 従業員ログイン設定（無料構成）

SNS CONTROLはFirebase Authenticationの無料枠で従業員ごとのログインを行い、認証確認・権限管理・投稿処理は既存のGoogle Apps Scriptで行います。Firebase Functions、Firestore、Firebase Hostingは使用せず、請求先登録も不要です。

## 構成

`GitHub Pages → Firebase Authentication（ログインのみ）→ GAS → Googleスプレッドシート / SNS API`

- パスワードはFirebaseだけが管理し、GASやスプレッドシートには保存しません。
- GASはFirebase公式REST APIへIDトークンを照会し、ログイン本人を確認します。
- GASはスプレッドシートの従業員台帳を使って権限を確認します。
- 管理人、運用スタッフ、閲覧スタッフの3権限があります。

## 初回設定

1. Firebase ConsoleでSpark（無料）プランのプロジェクトを作成します。Google Analyticsは不要です。
2. Authenticationの「ログイン方法」で「メール／パスワード」を有効にします。
3. Authenticationの承認済みドメインへ`wce-06.github.io`を追加します。
4. Webアプリを追加し、表示された設定値を`docs/firebase-config.js`へ転記します。
5. Authenticationのユーザー画面で、最初の管理人アカウントを1件作成します。
6. Apps Scriptのスクリプトプロパティへ次を設定します。

```text
FIREBASE_WEB_API_KEY=Webアプリ設定に表示されたapiKey
BOOTSTRAP_ADMIN_EMAIL=手順5で作った管理人メールアドレス
```

7. Apps Scriptで`setupSystem`を一度実行し、「従業員」「監査ログ」シートを作ります。
8. Apps Scriptを新バージョンでデプロイします。実行ユーザーは自分、アクセスできるユーザーは全員です。GAS側はFirebaseログインと従業員権限の両方を確認します。
9. GitHubへpushし、GitHub Pagesを更新します。
10. 最初の管理人でログインします。初回ログイン時だけ管理人として従業員台帳へ登録されます。

## 権限

| 権限 | 閲覧 | 投稿案作成 | 最終承認 | SNS再接続 | 従業員管理 |
| --- | --- | --- | --- | --- | --- |
| 管理人 | ○ | ○ | ○ | ○ | ○ |
| 運用スタッフ | ○ | ○ | × | × | × |
| 閲覧スタッフ | ○ | × | × | × | × |

従業員の新規登録は管理画面から管理人だけが行います。一般向けの登録画面はありません。利用停止にすると、FirebaseへログインできてもSNS CONTROLのデータや操作にはアクセスできません。

## 費用

- Firebase Authenticationのメール／パスワード認証はSparkプランの無料枠を使用します。
- Firebase Functions、Firestore、Firebase Hostingは使用しません。
- GitHub Pages、GAS、Googleスプレッドシートはそれぞれの無料利用枠内で運用します。
- X APIなど、SNS側で別途発生するAPI料金はこの構成変更の対象外です。
