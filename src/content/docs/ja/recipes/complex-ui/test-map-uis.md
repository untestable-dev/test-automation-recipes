---
title: 慣性つき地図UIをテストする
description: アプリのDOMやJSに一切触れずに、地図を狙ったピクセル数だけ正確にパンし、ユーザーが実際に見た画面を検証します。
sidebar:
  order: 1
  badge:
    text: 注目
    variant: tip
---

**ユースケース:** アプリに地図(Leaflet、MapLibre、Google Maps)や、パン・ズームできるcanvasが埋め込まれている。「ユーザーが左にスワイプすると、地図が滑らかにパンして隣の街で止まる」ことを、慣性まで含めてテストしたい。

## なぜ難しいのか

地図は、DOMベースのテストが前提とするものをことごとく裏切ります。

- コンテンツはcanvas上の**ピクセル**であり、`locator()` で掴める要素は存在しません。
- ドラッグには**慣性**があります。ポインタを離した後もビューは動き続けるため、「300pxドラッグ」しても実際のパン量は物理挙動に依存した*別の*値になります。
- 「地図の移動が終わった」ことを待てる信頼できるイベントはなく、`networkidle` はアニメーションフレームをカバーしません。

地図ライブラリのJS API(`map.panTo(...)`)を呼べばごまかせることも多いのですが、それでテストできるのは地図ライブラリ自体であって、ユーザーが実際に使う*ジェスチャー処理*ではありません。

## レシピ

[playwright-interactive-ui-test](https://github.com/tsuemura/playwright-interactive-ui-test) は、ユーザーと同じように画面を扱う実験的なツールキットです。観測はすべてピクセル由来(スクリーンショット + CDPスクリーンキャスト)で、DOMやアプリのJSへのアクセスは不要です。提供する機能:

- **ジェスチャー合成** — 速度プロファイル付きの `swipe` / `flick`。慣性スクロールが実際に発動します。
- **視覚的安定性の待機** — 恣意的なタイムアウトではなく「絵が止まった」ことを待ちます。
- **位相相関によるオドメトリ** — *画像*が実際に何ピクセル動いたかをサブピクセル精度で計測します。
- **閉ループ制御** — `panByPixels` がジェスチャー→計測→補正を繰り返し、慣性込みで狙った距離ちょうどまでビューを動かします。

```ts
import { test, expect } from 'playwright-interactive-ui-test';

test('スワイプで地図が慣性つきでパンする', async ({ page, interactive }) => {
  await page.goto('/map');
  await interactive.waitForStability();          // 初期タイルの描画完了を待つ

  // フリック: 高速なスワイプを速度を保ったまま離す → 慣性に引き継がれる
  await interactive.flick({ dx: -300, dy: 0 });
  await interactive.waitForStability();          // 物理挙動が静定するまで待つ

  // ビューは指の移動量より遠くまで動く — それが慣性が効いている証拠。
  // (前後のスクリーンショット間の位相相関で計測)
});

test('地図を東へ正確に400pxパンする', async ({ page, interactive }) => {
  await page.goto('/map');
  await interactive.waitForStability();

  const result = await interactive.panByPixels({ dx: -400, dy: 0 });

  expect(result.converged).toBe(true);
  expect(Math.abs(result.error.dx)).toBeLessThan(4);  // 許容誤差の範囲内
  expect(Math.abs(result.error.dy)).toBeLessThan(4);
});
```

`panByPixels` は実際に何が起きたかを返します。

```ts
interface PanResult {
  achieved: { dx: number; dy: number };  // visual odometry による計測値
  error: { dx: number; dy: number };     // 目標との残差
  iterations: PanIteration[];            // ジェスチャー→計測→補正の各ステップ
  converged: boolean;
}
```

### 到達地点のアサーション

決定論的にパンできるようになれば、到達地点の検証はふつうのビジュアルチェックになります。

```ts
await interactive.panByPixels({ dx: -400, dy: 0 });
await expect(page).toHaveScreenshot('tokyo-station-in-view.png', {
  maxDiffPixelRatio: 0.02,
});
```

CIでの決定論性のために、テストサーバーから**手続き生成したタイル**を配信してください(このライブラリのデモアプリはLeafletでこれを実装しています)。実タイルサーバーは画像が更新され、オフライン実行が壊れ、CIがレート制限に引っかかります。

## 注意点

- このツールキットは**実験的なプロトタイプ**で、APIは変わる可能性があります。ただし考え方(速度プロファイル付きジェスチャー、位相相関、ピクセル安定性待機)は安定したアイデアなので、自前のヘルパーに移植しても使えます。
- スクリーンキャストによる観測はChromium限定(CDP)です。ジェスチャーとスクリーンショットによるオドメトリはすべてのブラウザで動きます。
- 位相相関は画像の*支配的な*移動量を計測します。動かないオーバーレイUI(ヘッダーや操作ボタン)は信号を薄めるため、純粋な地図領域をクロップして計測してください。

## 関連レシピ

- [canvas描画をテストする](../test-canvas-rendering/) — 静的なcanvasコンテンツの場合。
- [トーストとちらつきを捕まえる](../catch-toasts-and-flicker/) — 一時表示UIのピクセルベース観測。
