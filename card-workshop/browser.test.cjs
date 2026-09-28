'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createServer } = require('./server.cjs');
const { chromium } = require(process.env.WORKSHOP_PLAYWRIGHT || 'playwright');
const M = require('./model.js');
const PRESETS = require('./presets.js');

(async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.WORKSHOP_BROWSER ? { executablePath: process.env.WORKSHOP_BROWSER } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => dialog.accept());
    await page.goto(origin); await page.locator('.graph-node').first().waitFor();
    assert.equal(await page.locator('#card-select option').count(), 90);
    assert.match(await page.locator('#catalog-summary').innerText(), /90 \/ 90/);
    assert.equal(await page.locator('#export-library').isEnabled(), false);
    assert.equal(await page.locator('#export-card').isEnabled(), false);
    await page.locator('#camp-filter').selectOption('魏');
    assert.equal(await page.locator('#card-select option:not([disabled])').count(), 30);
    await page.locator('#card-search').fill('曹操');
    assert.equal(await page.locator('#card-select option:not([disabled])').count(), 1);
    await page.locator('#card-select').selectOption(String(PRESETS.cards.findIndex(c => c.source.id === '02416')));
    assert.equal(await page.locator('#card-name').inputValue(), '曹操');
    assert.equal(await page.locator('#skill-tabs .skill-tab').count(), 2);
    assert.match(await page.locator('#preview-skills').innerText(), /魏武天命令/);
    await page.locator('#card-search').fill(''); await page.locator('#camp-filter').selectOption('');
    await page.locator('#card-select').selectOption(String(PRESETS.cards.findIndex(c => c.source.id === '01211')));
    await page.locator('#preview-start').click();
    while (await page.locator('#preview-next').isEnabled()) await page.locator('#preview-next').click();
    assert.equal(await page.locator('#reference-choices').isVisible(), true);
    await page.locator('#reference-yes').click();
    while (await page.locator('#preview-next').isEnabled()) await page.locator('#preview-next').click();
    assert.match(await page.locator('#trace').innerText(), /自身本回合战力 \+2/);
    assert.doesNotMatch(await page.locator('#trace').innerText(), /其他己方卡牌本回合战力 \+1/);
    assert.equal(await page.locator('#export-card').isEnabled(), false);
    await page.locator('#card-select').selectOption(String(PRESETS.cards.findIndex(c => c.source.id === '01102')));
    assert.equal(await page.locator('#export-card').isEnabled(), true);
    const oneDownloadPromise = page.waitForEvent('download'); await page.locator('#export-card').click();
    const oneDownload = await oneDownloadPromise;
    const oneCard = JSON.parse(await fs.readFile(await oneDownload.path(), 'utf8'));
    assert.equal(oneCard.cards[0].id, 'workshop_web_01102'); M.validateLibrary(oneCard);
    // Existing editor regression suite runs against an explicitly imported one-card project.
    await page.locator('#import-file').setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(M.sample())) });
    await page.waitForFunction(() => document.querySelector('#card-name').value === '战旗卫士');
    assert.equal(await page.locator('.graph-node').count(), 5);
    assert.equal(await page.locator('#export-library').isEnabled(), true);
    await page.locator('#help-button').click(); assert.equal(await page.locator('#help-dialog').isVisible(), true); await page.locator('#close-help').click();
    await page.locator('#card-name').fill('测试·卫士'); await page.locator('#card-name').press('Tab');
    assert.equal(await page.locator('#preview-name').innerText(), '测试·卫士');

    // Edits survive reload, graph layout is draggable, and undo/redo includes movement.
    await page.reload(); assert.equal(await page.locator('#card-name').inputValue(), '测试·卫士');
    const header = page.locator('.node-header').first(), box = await header.boundingBox();
    await page.mouse.move(box.x + 40, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 50, { steps: 10 }); await page.mouse.up();
    assert.equal(await page.locator('#undo').isEnabled(), true);
    await page.locator('#undo').click(); await page.locator('#redo').click(); await page.locator('#fit').click();

    await page.locator('[data-operation="DrawCards"]').click();
    assert.equal(await page.locator('.graph-node').count(), 6);
    assert.equal(await page.locator('[data-field="operation"]').inputValue(), 'DrawCards');
    await page.locator('[data-field="amount"]').fill('2'); await page.locator('[data-field="amount"]').press('Tab');
    assert.match(await page.locator('#preview-skills').innerText(), /抽 2 张/);
    await page.locator('[data-field="amount"]').fill('6'); await page.locator('[data-field="amount"]').press('Tab');
    assert.equal(await page.locator('[data-field="amount"]').inputValue(), '2');
    await page.locator('#fit').click();

    // Disconnected graphs block export, but retain drafts. Reconnect using accessible ports.
    await page.locator('[data-action="disconnect"]').click();
    assert.equal(await page.locator('#export-library').isEnabled(), false);
    assert.match(await page.locator('#validation').innerText(), /连线未完成/);
    await page.getByRole('button', { name: '抽取卡牌出口', exact: true }).click();
    await page.getByRole('button', { name: '结束入口', exact: true }).click();
    assert.equal(await page.locator('#export-library').isEnabled(), true);
    // Dragging a port uses the same connection semantics, including pointer capture.
    await page.locator('[data-action="disconnect"]').click();
    const fromPort = await page.getByRole('button', { name: '抽取卡牌出口', exact: true }).boundingBox();
    const toPort = await page.getByRole('button', { name: '结束入口', exact: true }).boundingBox();
    await page.mouse.move(fromPort.x + fromPort.width / 2, fromPort.y + fromPort.height / 2);
    await page.mouse.down(); await page.mouse.move(toPort.x + toPort.width / 2, toPort.y + toPort.height / 2, { steps: 10 }); await page.mouse.up();
    assert.equal(await page.locator('#export-library').isEnabled(), true);

    // Both pass and fail paths are stepped without claiming actual battle effects.
    await page.locator('#sim-adjacent').uncheck(); await page.locator('#preview-start').click();
    await page.locator('#preview-next').click(); assert.match(await page.locator('#trace').innerText(), /条件不满足/);
    await page.locator('#preview-next').click(); assert.equal(await page.locator('#preview-next').isEnabled(), false);
    await page.locator('#sim-adjacent').check(); await page.locator('#preview-start').click();
    while (await page.locator('#preview-next').isEnabled()) await page.locator('#preview-next').click();
    assert.match(await page.locator('#trace').innerText(), /抽 2 张/);
    assert.match(await page.locator('#trace').innerText(), /实际目标/);

    // Exported data is checked against the actual C# WorkshopValidation (optional SDK check).
    const downloadPromise = page.waitForEvent('download'); await page.locator('#export-library').click();
    const download = await downloadPromise;
    const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    M.validateLibrary(exported); assert.equal(exported.cards[0].abilities[0].steps.length, 3);
    const compat = path.join(__dirname, 'compat/bin/Release/net8.0/WorkshopCompat.dll');
    if (await fs.stat(compat).catch(() => null)) {
      const result = spawnSync('dotnet', [compat], { input: JSON.stringify(exported), encoding: 'utf8', windowsHide: true });
      assert.equal(result.status, 0, result.stderr || result.error?.message); console.log(result.stdout.trim());
      const mapped = M.compileProject({ format: 'card-workshop-project', version: 1, cards: PRESETS.cards.filter(e => e.source.execution === 'vocabulary'), decks: [] });
      const mappedResult = spawnSync('dotnet', [compat], { input: JSON.stringify(mapped), encoding: 'utf8', windowsHide: true });
      assert.equal(mappedResult.status, 0, mappedResult.stderr || mappedResult.error?.message); console.log(mappedResult.stdout.trim());
    }
    const projectDownloadPromise = page.waitForEvent('download'); await page.locator('#save-project').click();
    const projectDownload = await projectDownloadPromise;
    const projectText = await fs.readFile(await projectDownload.path(), 'utf8'); M.parseProject(JSON.parse(projectText));
    await page.locator('#new-card').click(); assert.equal(await page.locator('#card-select option').count(), 2);
    assert.equal(await page.locator('.graph-node').count(), 0);
    await page.locator('#add-skill').click(); assert.equal(await page.locator('.graph-node').count(), 4);
    await page.locator('#import-file').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(projectText) });
    await page.waitForFunction(() => document.querySelectorAll('#card-select option').length === 1);
    assert.equal(await page.locator('#card-name').inputValue(), '测试·卫士');
    assert.equal(await page.locator('.graph-node').count(), 6);

    // Malformed import is non-destructive; actual Unity library retains all deck references.
    await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"invalid"}') });
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('导入失败'));
    assert.equal(await page.locator('#card-name').inputValue(), '测试·卫士');
    const original = await fs.readFile(path.join(__dirname, '../UnityCard_demo/Assets/Resources/Data/workshop-library.json'));
    await page.locator('#import-file').setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: original });
    await page.waitForFunction(() => document.querySelectorAll('#card-select option').length === 4);
    await page.locator('#card-id').fill('workshop_renamed'); await page.locator('#card-id').press('Tab');
    const renamed = JSON.parse(await page.evaluate(() => localStorage.getItem('card-workshop.project.v1')));
    assert.ok(renamed.decks.every(deck => !deck.cardIds.includes('workshop_banner')));
    await page.locator('#delete-card').click(); assert.equal(await page.locator('#card-select option').count(), 4);

    // User-provided text is literal, never HTML.
    await page.locator('#card-name').fill('<img src=x onerror=alert(1)>'); await page.locator('#card-name').press('Tab');
    assert.equal(await page.locator('#preview-name img').count(), 0);
    assert.match(await page.locator('#preview-name').innerText(), /<img/);

    // Restore polished sample for visual checks; test responsive page at browser-zoom equivalent widths.
    await page.locator('#import-file').setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(M.sample())) });
    await page.waitForFunction(() => document.querySelector('#card-name').value === '战旗卫士');
    await page.locator('.graph-node[data-type="effect"]').first().locator('.node-header').click();
    const screenshots = process.env.WORKSHOP_SCREENSHOTS || path.join(os.tmpdir(), 'card-workshop-screenshots');
    await fs.mkdir(screenshots, { recursive: true });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 }); await page.locator('#fit').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `page overflow at ${width}`);
      assert.equal(await page.locator('#export-library').isEnabled(), true);
      await page.screenshot({ path: path.join(screenshots, `workshop-${width}.png`), fullPage: true });
    }
    await page.locator('#restore-presets').click();
    assert.equal(await page.locator('#card-select option').count(), 91);
    await page.reload(); assert.equal(await page.locator('#card-select option').count(), 91);
    await page.locator('#restore-presets').click(); assert.equal(await page.locator('#card-select option').count(), 91);
    await page.locator('#card-select').selectOption(String(PRESETS.cards.findIndex(c => c.source.id === '01211') + 1));
    await page.locator('#fit').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: path.join(screenshots, 'presets-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.locator('#fit').click();
    await page.screenshot({ path: path.join(screenshots, 'presets-desktop.png'), fullPage: true });
    // Simulate a second tab changing local storage: no silent overwrite.
    const other = await context.newPage(); await other.goto(origin);
    await other.locator('#card-name').fill('另一个窗口'); await other.locator('#card-name').press('Tab');
    await page.waitForFunction(() => document.querySelector('#save-state').textContent.includes('暂停'));
    assert.match(await page.locator('#save-state').innerText(), /暂停/);
    // Upgrade a legacy saved draft in a separate context: exact backup and edits survive.
    const legacyContext = await browser.newContext(), legacyPage = await legacyContext.newPage();
    const legacy = M.sample(); legacy.cards[0].card.name = '迁移前自制卡';
    await legacyContext.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: 'card-workshop.project.v1', value: JSON.stringify(legacy) });
    await legacyPage.goto(origin); await legacyPage.locator('#card-select').waitFor();
    assert.equal(await legacyPage.locator('#card-select option').count(), 91);
    assert.equal(await legacyPage.locator('#card-name').inputValue(), '迁移前自制卡');
    const backup = await legacyPage.evaluate(() => localStorage.getItem('card-workshop.project.v1.before-production-presets'));
    assert.equal(backup, JSON.stringify(legacy)); await legacyPage.reload();
    assert.equal(await legacyPage.locator('#card-select option').count(), 91);
    await legacyContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS browser: 90 presets, camp/search, reference branches, single-card export, legacy migration backup, no duplicate reseeding, plus original editor regression and 5 viewport sizes.');
    console.log('Screenshots: ' + screenshots);
  } finally {
    if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
