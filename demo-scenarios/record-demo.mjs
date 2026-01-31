/**
 * FormBridge Expanded Demo Video Recorder
 *
 * Records a comprehensive feature walkthrough using Playwright.
 * Produces a .webm video (~2-3 min) showing:
 *   1. Landing page → Launch Full Demo
 *   2. Agent fills insurance claim fields (visible log)
 *   3. Idempotency demo (duplicate request, same ID)
 *   4. Human opens resume form with pre-filled fields
 *   5. Conditional fields (police report checkbox → reveals field)
 *   6. File upload areas
 *   7. Human fills remaining fields
 *   8. Submit → "Pending Approval" status
 *   9. Reviewer approves the submission
 *  10. Event stream audit trail
 */

import { chromium } from 'playwright';
import fs from 'fs';

const DEMO_URL = 'http://localhost:3001';
const SLOW = 60; // ms between keystrokes

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrollSmooth(page, dy) {
  await page.evaluate((amount) => window.scrollBy({ top: amount, behavior: 'smooth' }), dy);
  await sleep(800);
}

async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(600);
}

async function main() {
  console.log('🎬 Starting FormBridge expanded demo recording...\n');

  // Clean output dir
  const outDir = '/tmp/formbridge-demo-video/';
  if (fs.existsSync(outDir)) {
    for (const f of fs.readdirSync(outDir)) fs.unlinkSync(`${outDir}${f}`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: outDir,
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

  // Scroll to show the "Full Feature Demo" section
  await scrollSmooth(page, 300);
  await sleep(1000);

  // ═══════════════════════════════════════════════
  // SCENE 2: Launch Full Demo
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 2: Launch full demo');
  const launchBtn = page.locator('a:has-text("Launch Full Demo")');
  await launchBtn.scrollIntoViewIfNeeded();
  await sleep(500);
  await launchBtn.click();
  await page.waitForURL('**/insurance-demo', { timeout: 5000 });
  await sleep(1500);

  // Scroll through the intro steps
  await scrollSmooth(page, 200);
  await sleep(1000);

  // ═══════════════════════════════════════════════
  // SCENE 3: Start agent simulation
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 3: Agent simulation');
  const startBtn = page.locator('button:has-text("Start Demo")');
  await startBtn.scrollIntoViewIfNeeded();
  await sleep(500);
  await startBtn.click();

  // Wait for simulation to complete (look for log entries)
  await page.waitForSelector('text=Handoff ready', { timeout: 15000 });
  await sleep(1500);

  // Scroll to see the full log
  const logOutput = page.locator('.demo-log-output');
  await logOutput.scrollIntoViewIfNeeded();
  await sleep(2000);

  // ═══════════════════════════════════════════════
  // SCENE 4: Idempotency demo
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 4: Idempotency test');
  const idemBtn = page.locator('button:has-text("Test Idempotency")');
  await idemBtn.scrollIntoViewIfNeeded();
  await sleep(500);
  await idemBtn.click();

  // Wait for idempotency result
  await page.waitForSelector('text=Idempotency Verified', { timeout: 10000 });
  await sleep(2000);

  // Scroll to show result
  await page.locator('text=Idempotency Verified').scrollIntoViewIfNeeded();
  await sleep(2000);

  // ═══════════════════════════════════════════════
  // SCENE 5: Open resume form
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 5: Resume form');
  const resumeBtn = page.locator('button:has-text("Continue to Resume Form")');
  await resumeBtn.scrollIntoViewIfNeeded();
  await sleep(500);
  await resumeBtn.click();

  // Wait for form to render
  await page.waitForSelector('text=Human Completes the Form', { timeout: 10000 });
  await sleep(1500);

  // Scroll through to show pre-filled fields with agent badges
  await scrollSmooth(page, 300);
  await sleep(1500);
  await scrollSmooth(page, 300);
  await sleep(1500);

  // ═══════════════════════════════════════════════
  // SCENE 6: Conditional fields — police report
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 6: Conditional fields');

  // Scroll to the police report section
  const policeSection = page.locator('text=Police Report').first();
  try {
    await policeSection.scrollIntoViewIfNeeded();
    await sleep(1000);

    // Check "police report filed" checkbox
    const policeCheckbox = page.locator('#field-police_report_filed');
    await policeCheckbox.click();
    await sleep(1000);

    // Fill the conditionally revealed field
    const reportNum = page.locator('#field-police_report_number');
    if (await reportNum.isVisible()) {
      await reportNum.click();
      await reportNum.type('PR-2024-SF-48291', { delay: SLOW });
      await sleep(500);
    }

    const policeDept = page.locator('#field-police_department');
    if (await policeDept.isVisible()) {
      await policeDept.click();
      await policeDept.type('SFPD - Central Station', { delay: SLOW });
      await sleep(500);
    }
  } catch (e) {
    console.log(`  (Police section: ${e.message})`);
  }

  // ═══════════════════════════════════════════════
  // SCENE 7: File upload areas
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 7: File upload areas');
  try {
    const docsSection = page.locator('text=Documents').first();
    await docsSection.scrollIntoViewIfNeeded();
    await sleep(2000);
    // Show the drag & drop areas
    await scrollSmooth(page, 100);
    await sleep(1500);
  } catch (e) {
    console.log(`  (Docs section: ${e.message})`);
  }

  // ═══════════════════════════════════════════════
  // SCENE 8: Fill remaining human fields
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 8: Fill remaining fields');

  // Scroll to vehicle info section
  await scrollToTop(page);
  await sleep(500);

  // Scroll to vehicle section
  try {
    const vehicleSection = page.locator('text=Vehicle Information').first();
    await vehicleSection.scrollIntoViewIfNeeded();
    await sleep(800);

    // Fill vehicle fields
    const makeField = page.locator('#field-vehicle\\.make');
    if (await makeField.isVisible()) {
      await makeField.click();
      await makeField.type('Toyota', { delay: SLOW });
      await sleep(300);
    }

    const modelField = page.locator('#field-vehicle\\.model');
    if (await modelField.isVisible()) {
      await modelField.click();
      await modelField.type('Camry', { delay: SLOW });
      await sleep(300);
    }

    const yearField = page.locator('#field-vehicle\\.year');
    if (await yearField.isVisible()) {
      await yearField.click();
      await yearField.type('2022', { delay: SLOW });
      await sleep(300);
    }
  } catch (e) {
    console.log(`  (Vehicle fields: ${e.message})`);
  }

  // Fill damage areas
  try {
    const damageSection = page.locator('text=Damage Assessment').first();
    await damageSection.scrollIntoViewIfNeeded();
    await sleep(500);

    const damageAreas = page.locator('#field-damage_areas');
    if (await damageAreas.isVisible()) {
      await damageAreas.click();
      await damageAreas.type('Rear bumper, trunk lid, tail lights', { delay: SLOW });
      await sleep(300);
    }

    const repairCost = page.locator('#field-estimated_repair_cost');
    if (await repairCost.isVisible()) {
      await repairCost.click();
      await repairCost.type('4500', { delay: SLOW });
      await sleep(300);
    }
  } catch (e) {
    console.log(`  (Damage fields: ${e.message})`);
  }

  await sleep(1000);

  // ═══════════════════════════════════════════════
  // SCENE 9: Submit → Pending Approval
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 9: Submit form');

  // Scroll to submit button
  const submitBtn = page.locator('button:has-text("Submit Claim for Review")');
  try {
    await submitBtn.scrollIntoViewIfNeeded();
    await sleep(1000);
    await submitBtn.click();

    // Wait for the "Pending Approval" state
    await page.waitForSelector('text=Pending Approval', { timeout: 10000 });
    await sleep(2500);
  } catch (e) {
    console.log(`  (Submit: ${e.message})`);
  }

  // ═══════════════════════════════════════════════
  // SCENE 10: Reviewer view → Approve
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 10: Reviewer approval');

  const reviewerBtn = page.locator('button:has-text("Go to Reviewer View")');
  try {
    await reviewerBtn.scrollIntoViewIfNeeded();
    await sleep(500);
    await reviewerBtn.click();
    await sleep(1500);

    // Scroll through reviewer data
    await scrollSmooth(page, 300);
    await sleep(1500);

    // Click approve
    const approveBtn = page.locator('button:has-text("Approve Claim")');
    await approveBtn.scrollIntoViewIfNeeded();
    await sleep(1000);
    await approveBtn.click();

    // Wait for approval confirmation
    await page.waitForSelector('text=Claim approved', { timeout: 10000 });
    await sleep(2000);
  } catch (e) {
    console.log(`  (Reviewer: ${e.message})`);
  }

  // ═══════════════════════════════════════════════
  // SCENE 11: Event stream / Audit trail
  // ═══════════════════════════════════════════════
  console.log('📍 Scene 11: Audit trail');

  const auditBtn = page.locator('button:has-text("View Audit Trail")');
  try {
    await auditBtn.scrollIntoViewIfNeeded();
    await sleep(500);
    await auditBtn.click();

    // Wait for events to load
    await page.waitForSelector('text=submission.created', { timeout: 10000 });
    await sleep(1500);

    // Scroll through the event stream
    await scrollSmooth(page, 200);
    await sleep(1500);
    await scrollSmooth(page, 200);
    await sleep(1500);

    // Show the "Demo Complete" message
    const demoComplete = page.locator('text=Demo Complete');
    if (await demoComplete.isVisible()) {
      await demoComplete.scrollIntoViewIfNeeded();
      await sleep(3000);
    }
  } catch (e) {
    console.log(`  (Audit trail: ${e.message})`);
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
  console.log(`📁 Video saved to: ${outDir}`);
  console.log('\nTo convert to MP4:');
  console.log('  ffmpeg -y -i /tmp/formbridge-demo-video/*.webm -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p ~/projects/formbridge/demo-expanded.mp4');
}

main().catch(err => {
  console.error('Recording failed:', err);
  process.exit(1);
});
