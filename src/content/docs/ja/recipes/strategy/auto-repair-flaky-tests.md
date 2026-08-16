---
title: フレーキーテストを自動修復する
description: フレーキーテストを検出し、視覚的な原因を診断し、AIエージェントで修正案を作り、再実行で修正を証明するループを構築します。
sidebar:
  order: 1
---

**ユースケース:** テストスイートの2%がフレーキーで、赤いビルドを見ても「本物の失敗かどうか」判断できない。リトライは問題を隠すだけで、人間は同じ3パターンのフレークを延々と直し続けている。この「修正」自体を自動化したい。

> ▶ **動くサンプル**: [`auto-repair-flaky-tests.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/strategy/auto-repair-flaky-tests.spec.ts)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

フレーキーテストはコード変更なしに失敗するため、失敗そのものからは「何を直せばいいか」が分かりません。原因の多くは**スクリーンショットには写らないタイミングの問題**です: 遅れて流れ込んでくるコンテンツ、クリックを横取りするトースト、`locator()` と `click()` の間にボタンを動かす段階的レンダリング。診断には*画面が時間とともにどう動いたか*の証拠が必要で、その先に修正候補の生成と、修正が効いたことの統計的な証明が要ります。

## レシピ

ループはこうです: **検出 → 証拠収集 → 診断と修正(エージェント) → 反復実行で検証 → PR**。

### 1. 検出: リトライをフレークのセンサーにする

`retries` を有効にしていれば、「リトライで通った」こと自体がフレークの信号です。カスタムレポーターで拾います:

```ts
// flaky-reporter.ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export default class FlakyReporter implements Reporter {
  private flaky: string[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed' && result.retry > 0) this.flaky.push(test.id);
  }
  onEnd() {
    require('node:fs').writeFileSync('flaky.json', JSON.stringify(this.flaky));
  }
}
```

### 2. 診断に値する証拠を集める

トレースが示すのは*Playwrightが何をしたか*であって、アクションの合間に**画面**が何をしていたかではありません — そしてフレークが棲んでいるのは後者です。[agent-screen-observer](https://www.npmjs.com/package/agent-screen-observer) のパッシブモードは、テスト実行中は待ち時間ゼロでフレームを記録し、**失敗したときだけ**解析して、視覚イベント(遅発のレイアウトシフト、クリック地点に重なったトースト、段階的レンダリングのバースト)をコンパクトなテキスト+切り抜き画像として添付します:

```ts
// playwright.config.ts — 通常のtrace設定に加えて
import { test } from 'agent-screen-observer/playwright';
test.use({
  screenObserverOptions: { mode: 'passive', attach: 'retain-on-failure' },
});
```

「*画面が落ち着いたように見えた後、+1.8秒でレイアウトがシフトした*」というレポートが得られれば、「謎のタイムアウト」は名前のついた修正可能な欠陥に変わります。

### 3. エージェントで診断とパッチ

コーディングエージェント(ヘッドレスモードのClaude Codeなど)に、証拠を詰めた簡潔なプロンプトを渡します:

```sh
claude -p "テスト '$TEST_ID' はフレーキーです(リトライで成功)。
証拠:
- 失敗した試行のエラー + トレース要約: trace.txt
- 画面観察レポート: observer-report.json
最も可能性の高い原因を特定し、テストに最小の修正を適用してください
(ロケーターが曖昧な場合はアプリへの data-testid 追加も可)。
ルール: waitForTimeout 禁止。web-firstアサーション優先。テストを弱めないこと。"
```

修正の探索空間は絞り込みます — 典型的な修復は小さく機械的です:

| フレークのパターン(証拠から) | 機械的な修正 |
| --- | --- |
| 遅発のレイアウトシフトがクリック対象を動かす | まず*原因*をアサート(画像やリストのロード完了)してからクリック |
| トーストがボタンに重なる | 一時表示要素の消滅を待つ(領域はレポートに載っている) |
| データロードとの競合 | テキストのアサートを `expect.poll` / `toPass` によるAPI状態の確認に置き換え |
| 曖昧なロケーターが2要素にマッチ | role+name に絞るかテストIDを付与 |

### 4. 反復実行で検証 — 省略不可のステップ

反復実行による証明のないフレーク修正は、ただの迷信です:

```sh
npx playwright test $TEST_FILE --repeat-each=30 --workers=4
```

これをPRのゲートにします。30回連続グリーンなら、証拠を添えてPRを作成します:

```sh
gh pr create --title "fix(flaky): stabilize $TEST_ID" \
  --body "原因: 画面観察レポートによる遅発レイアウトシフト(+1.8s)。30/30リピートでグリーン。"
```

人間がレビューするのは*検証済み・証拠付き*の1行diffです — 再現に費やす午後ではなく、数分で済みます。

## 注意点

- ループには上限を設けます。エージェントの修正が `--repeat-each` を通らなければ、延々とイテレーションせず、集めた証拠とともに人間へエスカレーションします。
- 「フレーキーテスト」の一部は**アプリ側の本物のレース**です。オブザーバーの証拠を見ればどちら側のバグかは大抵分かります — そちらはバグトラッカーに回し、テストを「安定化」してバグを握りつぶさないこと。
- 修復はCI上でスケジュール実行(`flaky.json` を対象にナイトリー)し、PRビルドの中では回さないこと — 人間のためのフィードバックループは速いまま保ちます。

## 関連レシピ

- [トーストとちらつきを捕まえる](../../complex-ui/catch-toasts-and-flicker/) — このレシピが依存する観察レイヤー。
- [E2Eテストを単体テストに置き換える](../replace-e2e-with-unit-tests/) — 最良のフレーキーE2Eテストとは、もはやE2Eである必要のないテストです。
