---
title: パスキー（WebAuthn）をテストする
description: Chromiumの仮想認証器を使い、指紋リーダーなしでCIからパスキーの登録とサインインをテストします。
sidebar:
  order: 1
---

**ユースケース:** アプリがパスキーによる登録・ログイン（WebAuthn）に対応している。セキュリティキーを挿さず、Touch IDのプロンプトも出さずに、「ユーザーがパスキーを登録し、それで再ログインできる」ことをCIで証明したい。

> ▶ **動くサンプル**: [`test-passkeys-webauthn.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/auth/test-passkeys-webauthn.spec.ts)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

WebAuthnは意図的に*ハードウェア*（プラットフォーム認証器やセキュリティキー）と、どんな自動化からもクリックできないブラウザネイティブのプロンプトを介して通信します。Playwrightにはパスキー用のAPIがなく、ヘッドレス環境では `navigator.credentials.create()` は単に応答を返さなくなります。

## レシピ

ChromiumにはCDP経由で使える**仮想認証器**が用意されています。テストから制御できるソフトウェア版セキュリティキーです:

```ts
import { test, expect } from '@playwright/test';

test('register a passkey, then sign in with it', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',            // プラットフォーム認証器（Touch ID相当）
      hasResidentKey: true,             // パスキーはディスカバラブルクレデンシャル
      hasUserVerification: true,
      isUserVerified: true,             // 「指紋が一致した」状態
      automaticPresenceSimulation: true // プロンプトを自動承認
    },
  });

  // 登録
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByText('Passkey added')).toBeVisible();

  // （仮想）デバイス上にクレデンシャルが実際に存在することを確認:
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials).toHaveLength(1);

  // サインアウトし、パスキーで再サインイン
  await page.goto('/logout');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(page).toHaveURL('/dashboard');
});
```

### 異常系のテスト

仮想認証器が本領を発揮するのは、実機ではスクリプト化できない異常系です:

```ts
// ユーザーがキャンセル / 検証に失敗（違う指でタッチ）:
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });

// クレデンシャルが入っていないデバイス（買い替え直後のPC）:
await cdp.send('WebAuthn.removeCredential', { authenticatorId, credentialId });

// プラットフォーム認証器ではなくローミング型セキュリティキー:
// transport: 'usb', hasResidentKey: false
```

UIが適切にフォールバックすること — エラーメッセージ、パスワードへの切り替え、再登録フロー — をアサートしましょう。

## 注意点

- 仮想認証器は**Chromium限定**です。Firefox/WebKitにはPlaywrightから触れる同等機能がありません。サーバー側のWebAuthnセレモニーを下位レイヤーのテスト（例: `@simplewebauthn/server` のテストヘルパー）でカバーしてください。
- WebAuthnには**セキュアコンテキスト**（`https://` または `localhost`）が必須です。CIでは `localhost` を使うか、開発用証明書を信頼させてください。
- クレデンシャルはRP ID（ドメイン）にスコープされます。`staging.example.com` に対するテストが通っても、`example.com` のオリジン/サブドメイン設定が正しいことの証明にはなりません。

## 関連レシピ

- [TOTP二要素ログインをテストする](../test-totp-2fa/) — もう一つの第二要素。
