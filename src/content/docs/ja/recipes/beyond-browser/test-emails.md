---
title: トランザクションメールをテストする
description: サインアップ確認・マジックリンク・パスワードリセットのメールが実際に届くことを検証し、本文中のリンクをクリックして先へ進みます。
sidebar:
  order: 1
---

**ユースケース:** サインアップすると確認リンクが送られ、パスワードリセットはトークンを送り、注文すると領収書が届く。ユーザージャーニーが*ブラウザの外へ出ていく* — テストはそれを受信箱まで追いかけ、また戻ってこなければならない。

## なぜ難しいのか

Playwrightの守備範囲はブラウザまでです。メールはSMTP経由でアプリから出ていき、`locator()` で触れるものは何もありません。CIから本物のメールを送るのはさらに悪手です。遅く、レート制限があり、スパムフィルタに引っかかり、テストのトラフィックが実プロバイダに漏れます。

## レシピ

**キャプチャ用SMTPサーバー**を立て、アプリが送ったメールをREST APIで読み取ります。[Mailpit](https://mailpit.axllent.org/)（MailHogの後継）が現在の定番です:

```yaml
# docker-compose.test.yml
services:
  mailpit:
    image: axllent/mailpit
    ports:
      - '1025:1025'   # SMTP — アプリの送信先をここに向ける
      - '8025:8025'   # Web UI + REST API
```

テスト対象アプリの送信先を `smtp://localhost:1025` に向けたうえで:

```ts
import { test, expect } from '@playwright/test';

const MAILPIT = 'http://localhost:8025/api/v1';

async function waitForEmail(request, to: string, subject: RegExp) {
  return expect
    .poll(async () => {
      const res = await request.get(`${MAILPIT}/search?query=to:${to}`);
      const { messages } = await res.json();
      return messages?.find((m) => subject.test(m.Subject)) ?? null;
    }, { timeout: 15_000 })
    .not.toBeNull()
    .then(async () => {
      const res = await request.get(`${MAILPIT}/search?query=to:${to}`);
      const { messages } = await res.json();
      return messages.find((m) => subject.test(m.Subject));
    });
}

test('signup confirmation link works', async ({ page, request }) => {
  const email = `user-${Date.now()}@example.test`;

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign up' }).click();

  // メッセージを見つけて…
  const msg = await waitForEmail(request, email, /confirm your account/i);

  // …HTML本文からリンクを抽出し…
  const detail = await (await request.get(`${MAILPIT}/message/${msg.ID}`)).json();
  const link = detail.HTML.match(/href="([^"]*\/confirm[^"]*)"/)?.[1];
  expect(link).toBeTruthy();

  // …ブラウザに戻ってジャーニーを完結させる。
  await page.goto(link!);
  await expect(page.getByText('Account confirmed')).toBeVisible();
});
```

### 何をアサートすべきか

- **到達と宛先** — 正しい受信者、正しい件名。テストごとに一意のアドレス（`user-${Date.now()}@…`）を使えば実行同士が独立します。
- **リンクの往復** — メール内のトークンが実際に機能し、一度しか使えず、期限切れになること。
- **本文の内容** — 名前や金額などのデータは部分一致でアサートし、本文全体のスナップショットは避けます。テンプレートは頻繁に変わります。
- **ネガティブケース** — 配信停止が守られること、サインアップ失敗時にメールが送られないこと。少し待ってから `GET /api/v1/messages` を叩けば「何も送られていない」ことを証明できます。

### レンダリングの検証

MailpitはHTML本文のスクリーンショットも撮れるので、ビジュアルテストのフローに流し込めばテンプレートのリグレッションを検出できます。実クライアント（Outlookなど）でのレンダリング検証は専門サービス（Litmusなど）の領分で、CIでやることではありません。

## 注意点

- テスト間でMailpitをリセットする（`DELETE /api/v1/messages`）か、すべてのクエリを受信者でスコープしてください。
- アプリがコンテナ内で動いている場合、SMTPホストは `localhost` ではなく `mailpit:1025` です。
- 実プロバイダ（SES、SendGrid）経由で送信しているステージング環境も、送信先をMailpitのSMTPに差し替えられることが多いです。同じアサーションコードがデプロイ前にも後にも使えます。

## 関連レシピ

- [TOTP二要素ログインをテストする](../../auth/test-totp-2fa/) — メールコードログインは、このレシピ+正規表現ひとつで実現できます。
- [PDF出力をテストする](../test-pdf-output/) — 領収書はメール添付で届くことが多いです（Mailpitは添付ファイルもAPIで取得できます）。
