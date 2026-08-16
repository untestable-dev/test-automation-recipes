// Recipe: https://recipes.untestable.dev/recipes/beyond-browser/test-windows-native-apps/
using FlaUI.Core;
using FlaUI.UIA3;
using NUnit.Framework;

namespace Tests;

public class PosTests
{
    [Test]
    public void Charging_an_amount_prints_a_receipt()
    {
        // Adjust the path if you build DemoApp elsewhere.
        var appPath = Path.GetFullPath(Path.Combine(
            TestContext.CurrentContext.TestDirectory,
            @"..\..\..\..\DemoApp\bin\Debug\net8.0-windows\DemoApp.exe"));

        using var app = Application.Launch(appPath);
        using var automation = new UIA3Automation();
        var window = app.GetMainWindow(automation);

        window.FindFirstDescendant(cf => cf.ByAutomationId("AmountInput"))!
              .AsTextBox().Enter("1980");
        window.FindFirstDescendant(cf => cf.ByAutomationId("ChargeButton"))!
              .AsButton().Invoke();

        var receipt = window.FindFirstDescendant(cf => cf.ByAutomationId("ReceiptView"))!;
        Assert.That(receipt.Name, Does.Contain("¥1,980"));

        app.Close();
    }
}
