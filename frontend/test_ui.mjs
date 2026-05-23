import { chromium } from 'playwright';
import path from 'path';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to Register Upload...');
        await page.goto('http://localhost:3000/reconciliation', { waitUntil: 'networkidle' });
        
        console.log('Uploading Purchase Register...');
        const [regFileChooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.locator('input[type="file"]').evaluate(node => node.click())
        ]);
        await regFileChooser.setFiles(path.resolve('../sample_data/acme/purchase_register_v3.xlsx'));
        
        console.log('Waiting for Register to process...');
        await page.waitForTimeout(2000);
        await page.click('button:has-text("START RECONCILIATION ENGINE")');
        
        console.log('Navigating to Voucher Inbox...');
        await page.waitForURL('http://localhost:3000/vouching', { timeout: 10000 });
        
        console.log('Uploading Invoice...');
        const [invFileChooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.locator('input[type="file"]').evaluate(node => node.click())
        ]);
        await invFileChooser.setFiles(path.resolve('../sample_data/acme/invoices/AC_2026_001.pdf'));
        
        console.log('Waiting for OCR, Extraction, and Reconciliation... (15s)');
        // The table will auto-refresh every 5s and eventually show MATCHED
        await page.waitForTimeout(15000);
        
        // Take screenshot of the result!
        await page.screenshot({ path: '../artifacts/final_test_result.png', fullPage: true });
        console.log('Screenshot saved to final_test_result.png');

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await browser.close();
    }
})();
