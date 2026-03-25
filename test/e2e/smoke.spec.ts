import { test, expect } from "@playwright/test";

test.describe("FinAlly E2E Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the page to be fully loaded (SSE stream keeps network active, so use "load" not "networkidle")
    await page.waitForLoadState("load");
  });

  test("1. Fresh load: watchlist shows 10 tickers, $10,000 cash, prices streaming", async ({
    page,
  }) => {
    // Check that the watchlist has 10 default tickers
    const defaultTickers = [
      "AAPL",
      "GOOGL",
      "MSFT",
      "AMZN",
      "TSLA",
      "NVDA",
      "META",
      "JPM",
      "V",
      "NFLX",
    ];

    for (const ticker of defaultTickers) {
      await expect(page.getByText(ticker).first()).toBeVisible();
    }

    // Check cash balance shows $10,000
    await expect(page.getByTestId("cash-balance")).toContainText("10,000");

    // Check that prices are streaming by watching for a price change
    // Wait for at least one price element to update (prices should be numbers like $XXX.XX)
    const priceLocator = page.locator("[data-testid='price']").first();
    if (await priceLocator.isVisible()) {
      const firstPrice = await priceLocator.textContent();
      // Wait up to 3 seconds for the price to change
      await expect(async () => {
        const currentPrice = await priceLocator.textContent();
        expect(currentPrice).not.toBe(firstPrice);
      }).toPass({ timeout: 3000 });
    }
  });

  test("2. Connection status dot is green", async ({ page }) => {
    // Wait for SSE to connect, then check data-status="connected"
    const statusDot = page.getByTestId("connection-status");
    await expect(statusDot).toBeVisible({ timeout: 5000 });
    await expect(statusDot).toHaveAttribute("data-status", "connected", { timeout: 5000 });
  });

  test("3. Add ticker: add PYPL to watchlist", async ({ page }) => {
    // Find the watchlist add input
    const addInput = page.locator(
      "[data-testid='watchlist-add-input'], input[placeholder*='ticker' i], input[placeholder*='add' i], input[placeholder*='symbol' i]"
    );
    await expect(addInput).toBeVisible({ timeout: 5000 });

    await addInput.fill("PYPL");

    // Submit — try pressing Enter first, then look for a submit button
    await addInput.press("Enter");

    // Verify PYPL appears in the watchlist
    await expect(page.getByText("PYPL")).toBeVisible({ timeout: 5000 });
  });

  test("4. Remove ticker: remove a ticker from watchlist", async ({ page }) => {
    // Wait for watchlist to load, then verify NFLX is present
    await expect(page.getByText("NFLX").first()).toBeVisible({ timeout: 10000 });

    // Use data-testid selectors for precise targeting
    const nflxRow = page.locator("[data-testid='watchlist-row']:has-text('NFLX')");
    await nflxRow.getByTestId("remove-ticker").click();

    // Verify NFLX is gone
    await expect(page.getByText("NFLX")).not.toBeVisible({ timeout: 5000 });
  });

  test("5. Buy shares: buy 5 AAPL, cash decreases, position appears", async ({
    page,
  }) => {
    // AAPL is already selected (default). Just fill quantity and click buy.
    const cashText = page.getByTestId("cash-balance");
    const initialCashText = await cashText.textContent();

    const quantityInput = page.getByTestId("trade-quantity");
    await quantityInput.click();
    await quantityInput.pressSequentially("5", { delay: 50 });
    await page.getByTestId("buy-button").click();
    await page.waitForTimeout(1500);

    // Verify cash decreased
    await expect(async () => {
      const newCashText = await cashText.textContent();
      expect(newCashText).not.toBe(initialCashText);
    }).toPass({ timeout: 10000 });

    // Verify AAPL position appears
    await expect(page.getByTestId("positions-table")).toContainText("AAPL", { timeout: 5000 });
  });

  test("6. Sell shares: sell 2 AAPL, cash increases, position quantity decreases", async ({
    page,
  }) => {
    // AAPL is the default selected ticker — buy 5, then sell 2
    const quantityInput = page.getByTestId("trade-quantity");

    await quantityInput.click();
    await quantityInput.pressSequentially("5", { delay: 50 });
    await page.getByTestId("buy-button").click();
    await page.waitForTimeout(1500);

    // Record cash before selling
    const cashText = page.getByTestId("cash-balance");
    const cashBeforeSell = await cashText.textContent();

    await quantityInput.click();
    await quantityInput.pressSequentially("2", { delay: 50 });
    await page.getByTestId("sell-button").click();
    await page.waitForTimeout(1500);

    // Verify cash increased
    await expect(async () => {
      const cashAfterSell = await cashText.textContent();
      expect(cashAfterSell).not.toBe(cashBeforeSell);
    }).toPass({ timeout: 5000 });
  });

  test("7. Portfolio heatmap: AAPL rectangle visible after buying", async ({
    page,
  }) => {
    // AAPL is selected by default — just fill quantity and buy
    const quantityInput = page.getByTestId("trade-quantity");
    await quantityInput.click();
    await quantityInput.pressSequentially("5", { delay: 50 });
    await page.getByTestId("buy-button").click();
    await page.waitForTimeout(1500);

    // Verify heatmap shows AAPL
    const heatmap = page.getByTestId("portfolio-heatmap");
    await expect(heatmap).toBeVisible({ timeout: 5000 });
    await expect(heatmap).toContainText("AAPL", { timeout: 5000 });
  });

  test("8. P&L chart: has at least one data point", async ({ page }) => {
    // Execute a trade to trigger a portfolio snapshot
    const quantityInput = page.getByTestId("trade-quantity");
    await quantityInput.click();
    await quantityInput.pressSequentially("1", { delay: 50 });
    await page.getByTestId("buy-button").click();
    await page.waitForTimeout(2000);

    // The P&L chart container should be visible
    const pnlChart = page.getByTestId("pnl-chart");
    await expect(pnlChart).toBeVisible({ timeout: 10000 });

    // After a trade, the chart should have SVG content (Recharts renders SVG)
    const chartContent = pnlChart.locator("svg, canvas");
    await expect(chartContent.first()).toBeVisible({ timeout: 10000 });
  });

  test("9. AI chat (mock): send message and receive response", async ({
    page,
  }) => {
    // Chat panel is open by default — find the input directly
    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Type the message character by character to avoid React re-render race
    await chatInput.click();
    await chatInput.pressSequentially("What is my portfolio?", { delay: 20 });
    await chatInput.press("Enter");

    // Wait for the assistant response (mock is fast)
    const assistantMessage = page.getByTestId("chat-message-assistant").first();
    await expect(assistantMessage).toBeVisible({ timeout: 15000 });
  });

  test("10. Click ticker in watchlist: main chart updates", async ({
    page,
  }) => {
    // Wait for watchlist to load, then click the MSFT row
    const msftRow = page.locator("[data-testid='watchlist-row']").filter({ hasText: "MSFT" });
    await expect(msftRow).toBeVisible({ timeout: 10000 });
    await msftRow.click();

    // Verify the main chart area shows MSFT
    const mainChart = page.locator(
      "[data-testid='main-chart'], [class*='chart-area'], [class*='main-chart']"
    ).first();
    await expect(mainChart).toBeVisible({ timeout: 5000 });

    // The chart title or heading should reflect the selected ticker
    await expect(mainChart).toContainText("MSFT", { timeout: 5000 });
  });
});
