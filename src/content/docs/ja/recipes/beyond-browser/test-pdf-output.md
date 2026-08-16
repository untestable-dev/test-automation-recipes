---
title: PDF出力をテストする
description: アプリが生成する請求書PDFをダウンロードし、テキスト・データ・レイアウトをアサートします。
sidebar:
  order: 2
---

**ユースケース:** アプリがPDF — 請求書、レポート、チケット、契約書 — を生成する。「*請求書をダウンロード*をクリックすると正しいPDFが得られる」は立派なユーザージャーニーであり、ここでのリグレッションは紙になって顧客の手元に届いてしまう。

> ▶ **動くサンプル**: [`test-pdf-output.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/beyond-browser/test-pdf-output.spec.ts) / [デモを触る](https://demo.untestable.dev/apps/invoice/)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

ブラウザはファイルをダウンロードする（＝画面に何もレンダリングされずアサート対象がない）か、Playwrightが中を覗けないネイティブPDFビューアで表示するかのどちらかです。いずれにせよ、コンテンツはDOMではなくバイナリファイルの中にあります。

## レシピ

### ダウンロードを捕まえる

```ts
import { test, expect } from '@playwright/test';

test('invoice PDF contains the right data', async ({ page }) => {
  await page.goto('/orders/1042');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download invoice' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  // …以下で `path` に対してアサートする
});
```

PDFがダウンロードではなくインライン表示される場合は、ページのCookieを使って直接取得します: `const pdf = await page.request.get(url).then(r => r.body())`。

### テキストをアサートする

```sh
npm install -D pdf-parse
```

```ts
import pdf from 'pdf-parse';
import { readFileSync } from 'node:fs';

const { text, numpages } = await pdf(readFileSync(path));

expect(numpages).toBe(1);
expect(text).toContain('Invoice #1042');
expect(text).toContain('Total: $1,337.00');
expect(text).not.toContain('undefined');   // テンプレートバグの定番
```

`pdf-parse` はレイアウトを平坦化します。段組や表は読み上げ順で出てくるので、文書全体の完全一致ではなく断片でアサートしてください。

### レイアウトをアサートする（ビジュアル）

テキストのチェックではレイアウト崩れ — 重なった段組、2ページ目に押し出されたロゴ — を見逃します。ラスタライズしてPlaywrightのビジュアル比較を再利用しましょう:

```sh
# poppler-utils。CIでは: apt-get install poppler-utils / brew install poppler
pdftoppm -png -r 100 invoice.pdf out/invoice
```

```ts
import { execFileSync } from 'node:child_process';

execFileSync('pdftoppm', ['-png', '-r', '100', path, 'out/invoice']);
expect(readFileSync('out/invoice-1.png')).toMatchSnapshot('invoice-page1.png', {
  maxDiffPixelRatio: 0.02,
});
```

先に動的な領域（日付、請求書番号）を安定させてください。テストデータを固定するか、比較前に `sharp` で既知の安定領域を切り出します。

### 必要ならさらに深く

- **機械可読請求書**（ZUGFeRD/Factur-X）はXMLを内包しています。抽出してスキーマ検証しましょう。
- アーカイブ用文書の**PDF/A準拠**: CIで `verapdf` を実行。
- **アクセシビリティ**（タグ付きPDF）: 最低限、テキストが抽出可能であることをアサートします（スキャン画像だけのPDFは `text` が空になります —「PDFライブラリを乗り換えたら」の後に起きがちな、れっきとしたリグレッションです）。

## 注意点

- PDF生成はサーバー側で非同期のことが多いです。ボタンクリックと競争せず、ダウンロードエンドポイントをポーリングしてください。
- フォント置換のせいでラスタライズ結果はマシン間で異なります。ベースラインはCIと同じDockerイメージで生成しましょう。
- Playwrightの `page.pdf()` はWebページのPDFを*作る*機能（Chromium限定）で、アプリが生成したPDFのアサーションとは無関係です。

## 関連レシピ

- [トランザクションメールをテストする](../test-emails/) — PDFはメール添付で届くことが多いです。
