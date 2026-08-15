---
title: TOTP二要素ログインをテストする
description: 認証アプリの6桁コードをテスト内で生成し、スマホなしで2FAを突破します。
sidebar:
  order: 2
---

**ユースケース:** 自分のアプリ（あるいはテストの前段でログインが必要なアプリ）のアカウントが認証アプリ — Google Authenticator形式の6桁コード — で保護されている。テストはこの画面を通過しなければならない。

## なぜ難しいのか

コードは30秒ごとに変わり、スマホの中にあります。しかしTOTPは公開されたアルゴリズム（RFC 6238）です。スマホが知っているのは**共有シークレット**だけ — テストも同じシークレットを知っていれば、同じコードを計算できます。

## レシピ

```sh
npm install -D otplib
```

### 登録時にシークレットを取得する

2FAセットアップ時に表示されるQRコードには、シークレットを含む `otpauth://` URIがエンコードされています。ほぼすべてのアプリが「スキャンできない場合は手動で入力」用の文字列も表示するので、それを取得します:

```ts
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test('enroll TOTP and log in with it', async ({ page }) => {
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Enable 2FA' }).click();

  // QRコードの横にある手動入力用シークレット。
  const secret = (await page.getByTestId('totp-secret').innerText()).replace(/\s/g, '');

  // 認証アプリと同じ要領で登録を確定する。
  await page.getByLabel('Verification code').fill(authenticator.generate(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Two-factor enabled')).toBeVisible();

  // 以後のログインはコードを再計算するだけ。
  await page.goto('/logout');
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Verification code').fill(authenticator.generate(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL('/dashboard');
});
```

事前にプロビジョニング済みのテストアカウントなら、シークレットをパスワードと一緒にシークレットマネージャーに保存しておけば、登録画面のスクレイピングは不要です。

### 毎回UIからログインしない

2FAはUIログインを*高コスト*にします。セットアッププロジェクトで一度だけログインし、認証状態(storageState)を使い回しましょう:

```ts
// auth.setup.ts — 一度だけ実行される
await page.context().storageState({ path: 'playwright/.auth/user.json' });

// playwright.config.ts
use: { storageState: 'playwright/.auth/user.json' },
```

2FAのUI全体を通しで検証するテストをちょうど1本だけ残し、それ以外はログイン済みの状態から始めます。

### 30秒の崖

ウィンドウの29秒目に生成されたコードは、送信中に期限切れになることがあります。ウィンドウの早い段階で生成することでこのフレークを回避します:

```ts
const msLeft = authenticator.timeRemaining() * 1000;
if (msLeft < 3000) await page.waitForTimeout(msLeft); // 次のウィンドウまで待つ
await page.getByLabel('Verification code').fill(authenticator.generate(secret));
```

## 注意点

- 登録画面がQR画像しか表示しない（手動入力用文字列がない）場合は、要素をスクリーンショットしてQRライブラリ（例: `jsqr`）でデコードし、`otpauth://` URIをパースしてください。
- サーバーの時計のずれはTOTPを双方向に壊します。多くのサーバーは±1ウィンドウを許容します。CIでコードが「ランダムに」失敗する場合は、まずランナーのNTP同期を確認してください。
- SMSベースの2FAは別のレシピです（TwilioのようなテストSMS受信箱を使います）。テストアカウントには無料でオフラインでも動くTOTPを推奨します。

## 関連レシピ

- [パスキー（WebAuthn）をテストする](../test-passkeys-webauthn/)
- [トランザクションメールをテストする](../../beyond-browser/test-emails/) — メールコードによるログインは、同じパターン+受信箱APIで実現できます。
