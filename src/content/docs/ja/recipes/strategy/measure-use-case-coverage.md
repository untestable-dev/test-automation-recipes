---
title: ユースケースカバレッジを測る
description: テストに「証明しているユーザーシナリオ」をタグ付けし、コードの行数ではなくプロダクトの振る舞いに対するカバレッジをレポートします。
sidebar:
  order: 3
---

**ユースケース:** リリース判定の問いは「行カバレッジ80%以上か?」ではなく「**顧客はまだチェックアウトできるのか?**」です。*ユーザーに見えるユースケース*とそれを証明するテストの対応表を作り、何にも証明されていないユースケースを炙り出したい。

> ▶ **動くサンプル**: [`measure-use-case-coverage.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/strategy/measure-use-case-coverage.spec.ts)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

コードカバレッジツールが測るのは実行された行数で、証明されたシナリオについては何も語りません: 行カバレッジ90%と「パスワードリセットが未テスト」は平気で両立します。ユースケースは仕様書と頭の中に住んでいて、ツールが数えられる成果物には存在しません — 成果物にしてやるまでは。

## レシピ

### 1. ユースケースを第一級市民に: レジストリを作る

1つのファイルを、コードと同じように所有し、コードと同じようにレビューします:

```ts
// usecases.ts — プロダクトのテスト可能な表面
export const USECASES = {
  'checkout.guest': 'Guest completes a purchase',
  'checkout.member.discount': 'Member discount applies at checkout',
  'auth.password-reset': 'User resets a forgotten password',
  'auth.passkey.login': 'User signs in with a passkey',
  'billing.invoice.pdf': 'User downloads a correct invoice PDF',
} as const;
export type UseCaseId = keyof typeof USECASES;
```

### 2. テストに「証明するユースケース」をタグ付けする

対応関係はPlaywrightのタグで持たせます(おまけに `--grep` でシナリオ単位の実行も手に入ります):

```ts
test('guest can buy a shirt', { tag: '@uc:checkout.guest' }, async ({ page }) => {
  // …
});

// 単体テストもユースケースを証明できます — 型チェックされる注釈として:
describeUseCase('checkout.member.discount', () => { /* テーブル駆動のケース */ });
```

型付きIDが効いてきます: ユースケースをリネームすれば、静かに孤児になるタグではなく、コンパイルエラーになります。

### 3. カスタムレポーターで集計する

```ts
// usecase-reporter.ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { USECASES } from './usecases';

export default class UseCaseReporter implements Reporter {
  private hits = new Map<string, { passed: number; failed: number }>();

  onTestEnd(test: TestCase, result: TestResult) {
    for (const tag of test.tags.filter((t) => t.startsWith('@uc:'))) {
      const id = tag.slice(4);
      const h = this.hits.get(id) ?? { passed: 0, failed: 0 };
      h[result.status === 'passed' ? 'passed' : 'failed']++;
      this.hits.set(id, h);
    }
  }

  onEnd() {
    const rows = Object.entries(USECASES).map(([id, title]) => {
      const h = this.hits.get(id);
      const state = !h ? '🔴 UNCOVERED' : h.failed ? `🟡 failing` : `🟢 ${h.passed} test(s)`;
      return `| ${id} | ${title} | ${state} |`;
    });
    require('node:fs').writeFileSync(
      'usecase-coverage.md',
      `| Use case | Description | Status |\n|---|---|---|\n${rows.join('\n')}`,
    );
  }
}
```

出力は、ステークホルダーが「カバレッジ」に本当に求めていたレポートそのものです:

| ユースケース | 説明 | 状態 |
|---|---|---|
| checkout.guest | ゲストが購入を完了できる | 🟢 3 test(s) |
| auth.password-reset | ユーザーが忘れたパスワードをリセットできる | 🔴 UNCOVERED |

### 4. 意味のある方向にだけ強制する

「未カバーのユースケースがあればCIを落とす」はタグの乱発を招きます。正直に守れる部分集合だけを強制しましょう: `USECASES` への新規エントリは1スプリント以内にテストを獲得すること。そして**あるユースケースの*唯一の*証明者であるテストを削除したら、即座にCIを落とす**こと。それこそが本当に問題になるリグレッションです。

## 注意点

- タグは*主張*にすぎません。そのユースケースが壊れたときテストが本当に落ちるのか、定期的に監査します(アプリへのミューテーションテスト、あるいはブランチ上での意図的な破壊)。
- レジストリの粒度は*ユーザーの意図*に保ちます(「パスワードをリセットする」)。クリック経路の粒度にしないこと — 経路は変わりますが、意図は変わりません。
- これは[E2Eテストの降格](../replace-e2e-with-unit-tests/)と組み合わさります: 証明するテストがピラミッドを下りても、カバレッジは見えたままです。

## 関連レシピ

- [E2Eテストを単体テストに置き換える](../replace-e2e-with-unit-tests/)
- [フレーキーテストを自動修復する](../auto-repair-flaky-tests/)
