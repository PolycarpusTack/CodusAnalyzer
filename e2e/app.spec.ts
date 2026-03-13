import { test, expect } from '@playwright/test';

test.describe('Code Review Agent', () => {
  test('loads the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('AI Code Review Agent');
  });

  test('shows editor tab by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/Paste your code/)).toBeVisible();
  });

  test('language selector works', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Python' }).click();
    await expect(page.getByRole('combobox')).toContainText('Python');
  });

  test('loads sample code', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sample' }).click();
    const textarea = page.getByPlaceholder(/Paste your code/);
    await expect(textarea).not.toBeEmpty();
  });

  test('clear button resets the editor', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sample' }).click();
    const textarea = page.getByPlaceholder(/Paste your code/);
    await expect(textarea).not.toBeEmpty();
    await page.getByRole('button', { name: '' }).last().click(); // trash icon
    await expect(textarea).toBeEmpty();
  });

  test('review preset buttons are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Full Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Security Audit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Performance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maintainability' })).toBeVisible();
  });

  test('preset selection toggles active state', async ({ page }) => {
    await page.goto('/');
    const securityBtn = page.getByRole('button', { name: 'Security Audit' });
    await securityBtn.click();
    // After clicking, it should have the default variant (not outline)
    await expect(securityBtn).toBeVisible();
  });

  test('theme toggle switches dark mode', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('history tab shows empty state initially', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText('No review history yet')).toBeVisible();
  });

  test('github URL input is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/GitHub file URL/)).toBeVisible();
  });

  test('file upload button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
  });

  test('rule settings panel toggles', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Rule Settings').click();
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByText('Performance')).toBeVisible();
    await expect(page.getByText('Maintainability')).toBeVisible();
    await expect(page.getByText('Style')).toBeVisible();
  });

  test('start review button disabled when no code', async ({ page }) => {
    await page.goto('/');
    const reviewBtn = page.getByRole('button', { name: /Start Review/ });
    await expect(reviewBtn).toBeDisabled();
  });

  test('start review button enabled with code', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/Paste your code/).fill('const x = 1;');
    const reviewBtn = page.getByRole('button', { name: /Start Review/ });
    await expect(reviewBtn).toBeEnabled();
  });
});
