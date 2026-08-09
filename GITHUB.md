# GitHubをHTMLの正本にする

このフォルダ全体を1つのGitHubリポジトリとして管理します。`Index.html`、`Styles.html`、`Client.html`を含む変更が`main`へ入ると、GitHub Actionsが既存のApps Scriptプロジェクトへ自動反映します。

## 初回だけ必要な設定

1. GitHubに非公開リポジトリを作る。
2. このフォルダの内容をリポジトリ直下へpushする。
3. ローカルPCでGoogle claspへログインする。
4. claspが作成した認証ファイルの内容を、GitHubリポジトリのActions secret `CLASPRC_JSON` に登録する。
5. Google Apps Scriptの設定で「Google Apps Script API」をオンにする。
6. Actionsの「Deploy Apps Script」を手動実行し、成功を確認する。

## 日常運用

- HTML/CSS/JavaScriptを直接Apps Script画面で編集しない。
- GitHub上で変更し、レビュー後に`main`へ反映する。
- `main`への反映でApps ScriptのHEADと公開Web Appが順番に更新される。

## 注意

- `CLASPRC_JSON`はGoogleアカウントへアクセスできる秘密情報。コードやIssueへ貼らない。
- リポジトリは当面private推奨。
- APIトークンはGitHubへ置かず、Apps ScriptのScript Propertiesだけに保存する。
- `.clasp.json`のScript IDは秘密鍵ではないが、公開リポジトリには運用構成が露出するため注意する。
- `main`へ対象ファイルを反映すると、Apps Scriptへのpushに続いて既存Webアプリのデプロイも更新される。公開URLは変わらない。
