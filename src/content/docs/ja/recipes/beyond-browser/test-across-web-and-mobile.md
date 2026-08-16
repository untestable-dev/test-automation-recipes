---
title: Webとモバイルを横断するテスト
description: ブラウザと実機アプリを1つのテストで操作する——ディープリンクの受け渡し、QRログイン、Webで始まりアプリで完結するサインアップ。
sidebar:
  order: 4
---

**ユースケース:** プロダクトの本当のユーザージャーニーがデバイスをまたぐ——Webでサインアップしてスマホで認証する。デスクトップやTVの画面のQRコードをアプリでスキャンしてログインする。キャンペーンページのディープリンクをタップするとネイティブアプリに着地する。それぞれ単体では動くのに、**バグは受け渡しの瞬間に住んでいます**。

> ▶ **動くサンプル**: [`test-across-web-and-mobile.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/beyond-browser/test-across-web-and-mobile.spec.ts)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

- **2つのエコシステムに共通のランナーがない。** Playwrightはネイティブアプリを操作できず、Appiumはデスクトップブラウザが苦手。どちらもジャーニー全体を所有できません。
- 受け渡しの成果物——QRコード、マジックリンク、ワンタイムコード——は片側で*生成*され、もう片側で*消費*されるため、単体ではどちらのツールも検証できません。
- セッションと状態はバックエンドにあり、2つのUIはそれを覗く2つの窓にすぎません。

## レシピ

### オーケストレーターは1つ、ドライバーは2つ

Playwrightをテストランナーとして維持し、テスト内から[WebdriverIO](https://webdriver.io/)クライアント経由でAppiumセッションを接続します。テストファイル1つ、レポート1つで両デバイスをカバー:

```ts
import { test, expect } from '@playwright/test';
import { remote, type Browser as Wdio } from 'webdriverio';

let app: Wdio;

test.beforeAll(async () => {
  app = await remote({
    hostname: 'localhost', port: 4723,          // Appiumサーバー
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:app': process.env.APP_APK,        // iOSなら XCUITest
    },
  });
});
test.afterAll(async () => { await app?.deleteSession(); });

test('Webで始めたサインアップがアプリで完結する', async ({ page }) => {
  // Web側
  const email = `user-${Date.now()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText('Check your phone')).toBeVisible();

  // 受け渡し: 継続用リンクを取得(テスト用インボックスやテストAPIから)
  const link = await fetchMagicLink(email);     // メールテストのレシピ参照

  // アプリ側: ディープリンクから入る
  await app.execute('mobile: deepLink', { url: link, package: 'com.example.app' });
  const welcome = app.$('~welcome-banner');     // accessibility id
  await welcome.waitForDisplayed({ timeout: 15_000 });
  await expect(page.getByText('Connected to your phone')).toBeVisible(); // Web側も反応する
});
```

### QRコードの受け渡し

受け渡しがビジュアルなら、目視ではなくデコードします。要素をスクリーンショット→Nodeでデコード→ペイロードをデバイスに渡す:

```ts
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const shot = await page.locator('#login-qr').screenshot();
const png = PNG.sync.read(shot);
const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
await app.execute('mobile: deepLink', { url: qr!.data, package: 'com.example.app' });
```

これは同時に**QRが読み取り可能であることの証明**にもなります。コントラスト低下やクワイエットゾーンの欠けといった描画リグレッションは、デコードの段階で落ちます。

### 受け渡しの検証はUIではなくバックエンドで

最も強いアサーションは「両側が1つのセッションを共有している」ことの確認です:

```ts
await expect
  .poll(() => api.get(`/test/sessions?email=${email}`).then((r) => r.json()))
  .toMatchObject({ devices: ['web', 'android'], linked: true });
```

## 注意点

- これはあなたが持つ**最も高価なテスト**です。デバイス横断ジャーニーは1〜2本に絞り、残りはプラットフォーム別のテストに押し下げてください。
- CIではブラウザの隣にエミュレータが必要です(GitHub Actionsなら `reactivecircus/android-emulator-runner`、またはデバイスクラウド)。起動はジョブごとに1回、テストごとにはしない。
- アプリ側の操作が単純なら、同じテストからCLIで起動する[Maestro](https://maestro.mobile.dev/)フローが、フルのAppiumセッションより軽い代替になります。
- モバイル**Web**は別の(ずっと安い)問題です。Playwrightのデバイスエミュレーションはビューポートとタッチを再現しますが、アプリへの受け渡しは実行できません。

## 関連レシピ

- [トランザクションメールのテスト](../test-emails/) — `fetchMagicLink` の中身はこちら。
- [ユースケースカバレッジの計測](../../strategy/measure-use-case-coverage/) — デバイス横断ジャーニーこそ追跡する価値のあるユースケースです。
