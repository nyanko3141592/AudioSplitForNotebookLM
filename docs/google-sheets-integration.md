# Googleフォーム/Apps Script 連携ガイド

議事録をGoogleフォームやApps ScriptのWebアプリに送信することで、Googleスプレッドシートへサーバー無しで保存できます。ここではGoogleフォームを推奨しつつ、Apps Scriptの代替手順も併記します。

## Googleフォームを送信先にする

1. **フォーム作成**: Googleフォームで「企業・チーム名」「会議日」「議事録本文」など必要な短文回答フィールドを追加します。
2. **formResponse URL取得**: フォーム右上の「送信」→リンクをコピーし、URL末尾の`formResponse`を控えます。例: `https://docs.google.com/forms/d/e/<FORM_ID>/formResponse`
3. **entry IDの確認**: Chromeのデベロッパーツールなどでフォームを実際に送信し、Networkタブから各フィールドに割り当てられている `entry.########` をメモします。
4. **アプリ設定**: 「議事録履歴」画面で設定モーダルを開き、送付先を登録します。
   - URL: 上記 `formResponse` URL
   - トークン: 空欄のままでOK
   - 項目マッピング: `entry.########` を「企業名」「議事録本文」などに入力
5. **同期**: 議事録詳細ビューで送付先を選び「議事録を同期」を押すとGoogleフォームに回答が送信され、シートに蓄積されます。

## Apps Scriptを使う場合（任意）

1. スプレッドシートでApps Scriptを開き、以下のような`doPost`を作成してWebアプリにデプロイします（アクセス権は"Anyone"）。

```ts
const SHEET_NAME = 'Sheet1';
const TOKEN = 'change-me';

function doPost(e) {
  const params = e?.parameter || {};
  if ((params.token || '') !== TOKEN) {
    return ContentService.createTextOutput('NG').setResponseCode(401);
  }
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  sheet.appendRow([
    new Date(),
    params.companyName || '',
    params.meetingDate || '',
    params.title || '',
    params.summary || ''
  ]);
  return ContentService.createTextOutput('OK');
}
```

2. アプリ側の送付先として `https://script.google.com/macros/s/.../exec` を登録し、必要ならトークン欄に`TOKEN`を入力します。

## 注意

- 送信は `application/x-www-form-urlencoded` 形式です。GoogleフォームもApps Scriptも追加のCORS設定無しで動作します。
- フィールドが空欄の場合は送信されないため、必須項目には最小限のプレースホルダーを入力してください。
- URLやentry IDはブラウザごとに保存されるので、ブラウザ/PCが変わる場合は再設定が必要です。
