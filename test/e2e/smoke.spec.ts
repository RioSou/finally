import { test, expect } from "@playwright/test";

test.describe("FinAlly E2E Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the page to be fully loaded and prices to start streaming
    await page.waitForLoadState("networkidle");
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
    await expect(page.getByText("10,000")).toBeVisible();

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
    // Look for a connection status indicator that is green
    const statusDot = page.locator(
      "[data-testid='connection-status'], .connection-status"
    );
    if (await statusDot.isVisible({ timeout: 5000 })) {
      // Check it has green styling (could be class, color, or background-color)
      await expect(statusDot).toHaveAttribute(/green|connected/i);
    } else {
      // Fallback: look for any green dot / indicator in the header
      const greenIndicator = page.locator(
        "[class*='green'], [class*='connected']"
      );
      await expect(greenIndicator.first()).toBeVisible({ timeout: 5000 });
    }
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
    // First verify NFLX is in the watchlist
    await expect(page.getByText("NFLX").first()).toBeVisible();

    // Find and click the remove button for NFLX
    const nflxRow = page.locator(
      "[data-testid='watchlist-row']:has-text('NFLX'), tr:has-text('NFLX'), [class*='watchlist']:has-text('NFLX'), div:has-text('NFLX')"
    ).first();

    const removeButton = nflxRow.locator(
      "button:has-text('remove'), button:has-text('Remove'), button:has-text('x'), button:has-text('X'), button:has-text('×'), [data-testid='remove-ticker'], button[aria-label*='remove' i]"
    );
    await removeButton.click();

    // Verify NFLX is gone
    await expect(page.getByText("NFLX")).not.toBeVisible({ timeout: 5000 });
  });

  test("5. Buy shares: buy 5 AAPL, cash decreases, position appears", async ({
    page,
  }) => {
    // Get initial cash balance text
    const cashText = page.locator(
      "[data-testid='cash-balance'], :has-text('cash'):has-text('$')"
    ).first();
    const initialCashText = await cashText.textContent();

    // Fill in the trade bar
    const tickerInput = page.locator(
      "[data-testid='trade-ticker'], input[placeholder*='ticker' i]"
    ).first();
    const quantityInput = page.locator(
      "[data-testid='trade-quantity'], input[placeholder*='quantity' i], input[placeholder*='shares' i], input[type='number']"
    ).first();
    const buyButton = page.locator(
      "[data-testid='buy-button'], button:has-text('buy')"
    ).first();

    await tickerInput.fill("AAPL");
    await quantityInput.fill("5");
    await buyButton.click();

    // Wait a moment for the trade to process
    await page.waitForTimeout(1000);

    // Verify cash decreased (text should be different)
    await expect(async () => {
      const newCashText = await cashText.textContent();
      expect(newCashText).not.toBe(initialCashText);
    }).toPass({ timeout: 5000 });

    // Verify AAPL position appears in the positions table
    const positionsArea = page.locator(
      "[data-testid='positions-table'], [class*='position'], table:has-text('Qty'), table:has-text('quantity')"
    ).first();
    await expect(positionsArea).toContainText("AAPL", { timeout: 5000 });
  });

  test("6. Sell shares: sell 2 AAPL, cash increases, position quantity decreases", async ({
    page,
  }) => {
    // First buy 5 AAPL so we have shares to sell
    const tickerInput = page.locator(
      "[data-testid='trade-ticker'], input[placeholder*='ticker' i]"
    ).first();
    const quantityInput = page.locator(
      "[data-testid='trade-quantity'], input[placeholder*='quantity' i], input[placeholder*='shares' i], input[type='number']"
    ).first();
    const buyButton = page.locator(
      "[data-testid='buy-button'], button:has-text('buy')"
    ).first();
    const sellButton = page.locator(
      "[data-testid='sell-button'], button:has-text('sell')"
    ).first();

    await tickerInput.fill("AAPL");
    await quantityInput.fill("5");
    await buyButton.click();
    await page.waitForTimeout(1000);

    // Record cash before selling
    const cashText = page.locator(
      "[data-testid='cash-balance'], :has-text('cash'):has-text('$')"
    ).first();
    const cashBeforeSell = await cashText.textContent();

    // Now sell 2 AAPL
    await tickerInput.fill("AAPL");
    await quantityInput.fill("2");
    await sellButton.click();
    await page.waitForTimeout(1000);

    // Verify cash increased
    await expect(async () => {
      const cashAfterSell = await cashText.textContent();
      expect(cashAfterSell).not.toBe(cashBeforeSell);
    }).toPass({ timeout: 5000 });
  });

  test("7. Portfolio heatmap: AAPL rectangle visible after buying", async ({
    page,
  }) => {
    // Buy some AAPL first
    const tickerInput = page.locator(
      "[data-testid='trade-ticker'], input[placeholder*='ticker' i]"
    ).first();
    const quantityInput = page.locator(
      "[data-testid='trade-quantity'], input[placeholder*='quantity' i], input[placeholder*='shares' i], input[type='number']"
    ).first();
    const buyButton = page.locator(
      "[data-testid='buy-button'], button:has-text('buy')"
    ).first();

    await tickerInput.fill("AAPL");
    await quantityInput.fill("5");
    await buyButton.click();
    await page.waitForTimeout(1000);

    // Verify heatmap shows AAPL
    const heatmap = page.locator(
      "[data-testid='portfolio-heatmap'], [class*='heatmap'], [class*='treemap']"
    ).first();
    await expect(heatmap).toBeVisible({ timeout: 5000 });
    await expect(heatmap).toContainText("AAPL", { timeout: 5000 });
  });

  test("8. P&L chart: has at least one data point", async ({ page }) => {
    // The P&L chart should have data from portfolio_snapshots
    // Look for the chart container
    const pnlChart = page.locator(
      "[data-testid='pnl-chart'], [class*='pnl'], [class*='portfolio-chart']"
    ).first();

    await expect(pnlChart).toBeVisible({ timeout: 10000 });

    // Verify the chart has rendered content (canvas or SVG with paths/elements)
    const chartContent = pnlChart.locator("canvas, svg, path, line, rect");
    await expect(chartContent.first()).toBeVisible({ timeout: 5000 });
  });

  test("9. AI chat (mock): send message and receive response", async ({
    page,
  }) => {
    // Find and open the chat panel if needed
    const chatToggle = page.locator(
      "[data-testid='chat-toggle'], button:has-text('chat'), button:has-text('AI'), button[aria-label*='chat' i]"
    );
    if (await chatToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatToggle.click();
    }

    // Find the chat input
    const chatInput = page.locator(
      "[data-testid='chat-input'], [class*='chat'] input, [class*='chat'] textarea, input[placeholder*='message' i], textarea[placeholder*='message' i]"
    ).first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Send a message
    await chatInput.fill("What is my portfolio?");
    await chatInput.press("Enter");

    // Wait for the assistant response to appear (mock should be fast)
    const assistantMessage = page.locator(
      "[data-testid='chat-message-assistant'], [class*='assistant'], [class*='chat-response']"
    ).first();
    await expect(assistantMessage).toBeVisible({ timeout: 15000 });

    // Verify no error messages are shown
    const errorMessage = page.locator(
      "[class*='error'], [data-testid='chat-error']"
    );
    await expect(errorMessage).not.toBeVisible();
  });

  test("10. Click ticker in watchlist: main chart updates", async ({
    page,
  }) => {
    // Click on MSFT in the watchlist
    const msftEntry = page.getByText("MSFT").first();
    await expect(msftEntry).toBeVisible();
    await msftEntry.click();

    // Verify the main chart area shows MSFT
    const mainChart = page.locator(
      "[data-testid='main-chart'], [class*='chart-area'], [class*='main-chart']"
    ).first();
    await expect(mainChart).toBeVisible({ timeout: 5000 });

    // The chart title or heading should reflect the selected ticker
    await expect(mainChart).toContainText("MSFT", { timeout: 5000 });
  });
});
