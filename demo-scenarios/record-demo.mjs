/**
 * FormBridge Demo Video Recorder
 * 
 * Records a full agent→human handoff workflow using Playwright.
 * Produces a .webm video showing:
 *   1. Landing page overview
 *   2. Agent simulation (API creates submission, fills fields)
 *   3. Human opens resume link, sees pre-filled form with attribution
 *   4. Human fills remaining fields
 *   5. Human submits
 *   6. Audit trail / events view
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const DEMO_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3000';
const SLOW = 80; // ms between keystrokes for visible typing

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🎬 Starting FormBridge demo recording...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: '/tmp/formbridge-demo-video/',
      size: { width: 1280, height: 800 },
    },
  });

  const page = await context.newPage();

  // ═══════════════════════════════════════════════
  // SCENE 1: Landing Page
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 1: Landing page');
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await sleep(2000);

  // Scroll down slowly to show features
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await sleep(1500);
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await sleep(1500);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1000);

  // ═══════════════════════════════════════════════
  // SCENE 2: Agent Simulation
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 2: Agent simulation');
  
  // Click "Simulate Agent" button
  const simulateBtn = page.locator('button:has-text("Simulate Agent")');
  await simulateBtn.scrollIntoViewIfNeeded();
  await sleep(500);
  await simulateBtn.click();
  
  // Wait for simulation to complete — look for the resume URL
  await page.waitForSelector('.demo-resume-url', { timeout: 10000 });
  await sleep(2000);

  // Scroll to show the full simulation log and resume URL
  await page.locator('.demo-resume-url').scrollIntoViewIfNeeded();
  await sleep(2500);

  // ═══════════════════════════════════════════════
  // SCENE 3: Human Opens Resume Form
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 3: Human opens resume form');

  // Click the "Open Resume Form" link
  const resumeLink = page.locator('a:has-text("Open Resume Form")');
  await resumeLink.click();
  
  // Wait for the resume form to load
  await page.waitForSelector('form, [class*="form"], [class*="resume"]', { timeout: 10000 }).catch(() => {});
  await sleep(2000);

  // Scroll through the form to show pre-filled fields with attribution badges
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await sleep(2000);
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await sleep(2000);
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await sleep(2000);

  // ═══════════════════════════════════════════════
  // SCENE 4: Human Fills Remaining Fields
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 4: Human fills remaining fields');

  // Scroll back to top of form
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1000);

  // Find empty text inputs and fill them with realistic data
  const emptyInputs = await page.locator('input[type="text"]:not([readonly]):not([disabled])').all();
  const fillData = {
    'contact_phone': '+1-555-0199',
    'phone': '+1-555-0199',
    'street': '742 Evergreen Terrace',
    'city': 'Springfield',
    'state': 'IL',
    'zip': '62704',
    'zip_code': '62704',
    'bank_name': 'First National Bank',
    'bank_account': '****4521',
    'routing': '071000013',
  };

  let filledCount = 0;
  for (const input of emptyInputs) {
    const value = await input.inputValue();
    if (value && value.trim()) continue; // Skip already-filled fields

    const name = await input.getAttribute('name') || await input.getAttribute('id') || '';
    const placeholder = await input.getAttribute('placeholder') || '';
    const label = name.toLowerCase() || placeholder.toLowerCase();

    let fillValue = null;
    for (const [key, val] of Object.entries(fillData)) {
      if (label.includes(key)) {
        fillValue = val;
        break;
      }
    }
    if (!fillValue) {
      // Generic fill for unknown fields
      if (label.includes('phone')) fillValue = '+1-555-0199';
      else if (label.includes('email')) fillValue = 'vendor@acme.com';
      else if (label.includes('name')) fillValue = 'Acme Corporation';
      else if (label.includes('street') || label.includes('address')) fillValue = '742 Evergreen Terrace';
      else if (label.includes('city')) fillValue = 'Springfield';
      else if (label.includes('state')) fillValue = 'IL';
      else if (label.includes('zip') || label.includes('postal')) fillValue = '62704';
      else if (label.includes('bank')) fillValue = 'First National Bank';
      else if (label.includes('account')) fillValue = '****4521';
      else if (label.includes('routing')) fillValue = '071000013';
      else fillValue = 'Sample Data';
    }

    try {
      await input.scrollIntoViewIfNeeded();
      await sleep(300);
      await input.click();
      await sleep(200);
      await input.type(fillValue, { delay: SLOW });
      await sleep(400);
      filledCount++;
      if (filledCount >= 8) break; // Don't fill too many, keep video reasonable
    } catch {
      // Input might not be visible/interactable
    }
  }

  // Handle any select dropdowns
  const selects = await page.locator('select').all();
  for (const select of selects) {
    try {
      const options = await select.locator('option').all();
      if (options.length > 1) {
        await select.scrollIntoViewIfNeeded();
        await sleep(300);
        // Pick the second option (first is usually placeholder)
        const value = await options[1].getAttribute('value');
        if (value) {
          await select.selectOption(value);
          await sleep(500);
        }
      }
    } catch {
      // Skip if not interactable
    }
  }

  await sleep(1000);

  // Scroll down to show filled form
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await sleep(2000);

  // ═══════════════════════════════════════════════
  // SCENE 5: Submit the Form
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 5: Submit form');

  // Find and click submit button
  const submitBtn = page.locator('button[type="submit"], button:has-text("Submit")').first();
  try {
    await submitBtn.scrollIntoViewIfNeeded();
    await sleep(1000);
    await submitBtn.click();
    await sleep(3000);
  } catch {
    console.log('  (Submit button not found or not clickable)');
  }

  // ═══════════════════════════════════════════════
  // SCENE 6: Check Events / Audit Trail via API
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 6: Show audit trail');

  // Navigate to a page that shows the result or go back to home
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  // Show the reviewer view
  const reviewerLink = page.locator('a:has-text("Reviewer")');
  try {
    await reviewerLink.click();
    await page.waitForLoadState('networkidle');
    await sleep(2000);

    // Scroll through reviewer view
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(2000);
  } catch {
    console.log('  (Reviewer page navigation failed)');
  }

  // ═══════════════════════════════════════════════
  // SCENE 7: Wizard Form (bonus)
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 7: Multi-step wizard');
  await page.goto(`${DEMO_URL}/wizard`, { waitUntil: 'networkidle' });
  await sleep(1500);

  // Fill step 1
  const wizardInputs = await page.locator('input[type="text"]').all();
  const wizardData = ['Acme Corp', 'US', '12-3456789'];
  for (let i = 0; i < Math.min(wizardInputs.length, wizardData.length); i++) {
    await wizardInputs[i].click();
    await wizardInputs[i].type(wizardData[i], { delay: SLOW });
    await sleep(300);
  }
  await sleep(1000);

  // Click Next
  const nextBtn = page.locator('button:has-text("Next")');
  try {
    await nextBtn.click();
    await sleep(1500);

    // Fill step 2
    const step2Inputs = await page.locator('input[type="text"]').all();
    const step2Data = ['contact@acme.com', '+1-555-0199'];
    for (let i = 0; i < Math.min(step2Inputs.length, step2Data.length); i++) {
      await step2Inputs[i].click();
      await step2Inputs[i].type(step2Data[i], { delay: SLOW });
      await sleep(300);
    }
    await sleep(1000);

    // Click Next again
    await nextBtn.click();
    await sleep(1500);

    // Fill step 3
    const step3Inputs = await page.locator('input[type="text"]').all();
    const step3Data = ['742 Evergreen Terrace', 'Springfield', 'IL', '62704'];
    for (let i = 0; i < Math.min(step3Inputs.length, step3Data.length); i++) {
      await step3Inputs[i].click();
      await step3Inputs[i].type(step3Data[i], { delay: SLOW });
      await sleep(300);
    }
    await sleep(1000);

    // Click Complete/Submit
    const completeBtn = page.locator('button:has-text("Complete"), button:has-text("Submit"), button:has-text("Finish")');
    await completeBtn.click();
    await sleep(2500);
  } catch (e) {
    console.log(`  (Wizard navigation: ${e.message})`);
  }

  // ═══════════════════════════════════════════════
  // DONE — Close and save video
  // ═══════════════════════════════════════════════
  console.log('\n🎬 Wrapping up...');
  await sleep(1000);
  
  await page.close();
  await context.close();
  await browser.close();

  console.log('\n✅ Demo recording complete!');
  console.log('📁 Video saved to: /tmp/formbridge-demo-video/');
  console.log('\nTo convert to MP4:');
  console.log('  ffmpeg -i /tmp/formbridge-demo-video/*.webm -c:v libx264 -preset slow -crf 22 ~/projects/formbridge/demo.mp4');
}

main().catch(err => {
  console.error('Recording failed:', err);
  process.exit(1);
});
