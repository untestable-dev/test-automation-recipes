# Windows native app sample (FlaUI)

Runnable counterpart of the [Test Windows native apps](https://recipes.untestable.dev/recipes/beyond-browser/test-windows-native-apps/) recipe. **Windows only** — requires the .NET 8 SDK and an unlocked interactive desktop session.

```powershell
# 1. Build the demo app (a tiny WinForms point-of-sale window)
dotnet build DemoApp

# 2. Run the FlaUI test against it
dotnet test Tests
```

The test launches `DemoApp.exe`, types into `AmountInput`, invokes `ChargeButton` and asserts on `ReceiptView` — all located by **AutomationId** through UI Automation. Inspect the app's UIA tree with [Accessibility Insights for Windows](https://accessibilityinsights.io/docs/windows/overview/).

> Note: this sample is not exercised by this repository's CI (which runs on Linux); it is verified manually on Windows.
