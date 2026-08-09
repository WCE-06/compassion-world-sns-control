# GitHubをHTMLの正本にする

このフォルダ全体を1つのGitHubリポジトリとして管理します。`Index.html`、`Styles.html`、`Client.html`を含む変更が`main`へ入ると、GitHub Actionsが既存のApps Scriptプロジェクトへ自動反映します。

## 初回だけ必要な設定

1. GitHubに非公開リポジトリを作る。
2. このフォルダの内容をリポジトリ直下へpushする。
3. ローカルPCでGoogle claspへログインする。
4. claspが作成した認証ファイルの内容を、GitHubリポジトリのActions secret `CLASPRC_JSON` に登録する。
5. Actionsの「Deploy Apps Script」を手動実行する。
6. Apps Script側で新しいバージョンを作り、既存Web Appデプロイをそのバージョンへ更新する。

## 日常運用

- HTML/CSS/JavaScriptを直接Apps Script画面で編集しない。
- GitHub上で変更し、レビュー後に`main`へ反映する。
- `main`への反映でApps ScriptのHEADが更新される。
- 公開Web Appへ反映する際は、Apps Scriptのデプロイバージョンも更新する。

## 注意

- `CLASPRC_JSON`はGoogleアカウントへアクセスできる秘密情報。コードやIssueへ貼らない。
- リポジトリは当面private推奨。
- APIトークンはGitHubへ置かず、Apps ScriptのScript Propertiesだけに保存する。
- `.clasp.json`のScript IDは秘密鍵ではないが、公開リポジトリには運用構成が露出するため注意する。
