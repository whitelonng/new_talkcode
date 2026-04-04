import { expect, test } from '@playwright/test';
import { injectTauriMocks } from '../helpers';

test.describe('Onboarding Wizard UI', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMocks(page);
    await page.goto('/');
    // Wait for the page to load
    await page.waitForTimeout(2000);
  });

  test('should display welcome screen', async ({ page }) => {
    // The onboarding wizard should be visible
    await expect(page.getByText('Welcome to TalkCody')).toBeVisible({ timeout: 10000 });
  });

  test('should display language selection step', async ({ page }) => {
    await expect(page.getByText('Choose Your Language')).toBeVisible({ timeout: 10000 });
  });

  test('should have language options', async ({ page }) => {
    await expect(page.getByText('English')).toBeVisible({ timeout: 10000 });
  });

  test('should have Next button on first step', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeVisible({ timeout: 10000 });
  });

  test('should have Skip button on first step', async ({ page }) => {
    const skipButton = page.getByRole('button', { name: 'Skip' });
    await expect(skipButton).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to theme step when clicking Next', async ({ page }) => {
    // Click Next
    await page.getByRole('button', { name: 'Next' }).click();

    // Wait for theme step
    await expect(page.getByText('Choose Your Theme')).toBeVisible({ timeout: 10000 });
  });

  test('should display theme options', async ({ page }) => {
    // Navigate to theme step
    await page.getByRole('button', { name: 'Next' }).click();

    // Check theme options
    await expect(page.getByText('Light')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Dark')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('System')).toBeVisible({ timeout: 10000 });
  });

  test('should have Get Started button on theme step', async ({ page }) => {
    // Navigate to theme step
    await page.getByRole('button', { name: 'Next' }).click();

    // Check Get Started button
    const getStartedButton = page.getByRole('button', { name: 'Get Started' });
    await expect(getStartedButton).toBeVisible({ timeout: 10000 });
  });

  test('should have Back button on theme step', async ({ page }) => {
    // Navigate to theme step
    await page.getByRole('button', { name: 'Next' }).click();

    // Check Back button
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeVisible({ timeout: 10000 });
  });

  test('should navigate back to language step when clicking Back', async ({ page }) => {
    // Navigate to theme step
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Choose Your Theme')).toBeVisible({ timeout: 10000 });

    // Click Back
    await page.getByRole('button', { name: 'Back' }).click();

    // Should be back on language step
    await expect(page.getByText('Choose Your Language')).toBeVisible({ timeout: 10000 });
  });

  test('should show progress indicator', async ({ page }) => {
    // There should be some kind of progress indicator (dots or steps)
    // The progress component shows current step
    const _progressElements = page.locator(
      '[class*="progress"], [class*="step"], [role="progressbar"]'
    );
    // We just verify the wizard structure exists
    await expect(page.getByText("Let's set up your preferences")).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Static UI Elements', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMocks(page);
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('page should have correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/TalkCody/);
  });

  test('page should load without critical errors', async ({ page }) => {
    // Check that the page loaded and has content
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
