# 従業員ログイン設定

SNS CONTROLは共有接続キーを従業員へ配らず、Firebase Authenticationで従業員ごとにログインします。

## 構成

`GitHub Pages → Firebase Authentication → Firebase Functions → GAS → Googleスプレッドシート / SNS API`

- パスワードはFirebaseだけが管理し、GASやスプレッドシートには保存しません。
- Firebase Functionsがログイン本人と権限を確認します。
- GASへ渡す共有秘密鍵はFirebase FunctionsのSecretにのみ保存します。
- 管理人、運用スタッフ、閲覧スタッフの3権限があります。

## 初回設定

1. Firebase Consoleでプロジェクトを作成します。
   - Functionsの利用には従量課金のBlazeプランと請求先登録が必要です。通常規模では無償枠内が見込まれますが、予算アラートと利用上限を必ず設定してください。
2. Authenticationのログイン方法で「メール／パスワード」を有効にします。
   - Authenticationの承認済みドメインへ`wce-06.github.io`を追加します。
3. Firestoreデータベースを作成します。本番モードを選択します。
4. Webアプリを追加し、表示された設定値を`docs/firebase-config.js`へ転記します。
5. Authenticationのユーザー画面で、最初の管理人アカウントを1件作成します。
6. `.firebaserc.example`を`.firebaserc`としてコピーし、FirebaseプロジェクトIDを設定します。
7. Functions用Secretを設定します。

```text
firebase functions:secrets:set GAS_WEB_APP_URL
firebase functions:secrets:set WEB_API_SECRET
firebase functions:secrets:set BOOTSTRAP_ADMIN_EMAIL
```

- `GAS_WEB_APP_URL`: 公開中のGAS Web App URL
- `WEB_API_SECRET`: GAS Script Propertiesの同名値
- `BOOTSTRAP_ADMIN_EMAIL`: 手順5で作った最初の管理人メールアドレス

8. `firebase deploy --only functions,firestore:rules`を実行します。
   - ゲートウェイは常時起動を行わず、最大2インスタンスに制限しています。
9. Apps Scriptを新バージョンでデプロイします。GASの入口は外部サーバーから到達できる公開設定ですが、署名が一致しない操作は拒否されます。
10. GitHubへpushし、GitHub Pagesを更新します。
11. 最初の管理人でログインします。初回ログイン時だけ自動的に管理人権限が作成されます。

## 権限

| 権限 | 閲覧 | 投稿案作成 | 最終承認 | SNS再接続 | 従業員管理 |
| --- | --- | --- | --- | --- | --- |
| 管理人 | ○ | ○ | ○ | ○ | ○ |
| 運用スタッフ | ○ | ○ | × | × | × |
| 閲覧スタッフ | ○ | × | × | × | × |

従業員の新規登録は管理画面から管理人だけが行います。一般向けの登録画面はありません。

## 移行完了後

- 従業員へ旧`WEB_API_SECRET`を知らせないでください。
- ブラウザに保存されている旧接続キーは使用されません。
- Firebaseのメール列挙保護とパスワードポリシーを有効にしてください。
- 最初の管理人以外は、SNS CONTROLの従業員管理画面から招待してください。
