// Dependency-free integrity checks. Does not substitute for a Unity editor compile/build.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
const json = file => JSON.parse(read(file));
assert.match(read('ProjectSettings/ProjectVersion.txt'), /2022\.3\.62f3/);
const manifest = json('Packages/manifest.json');
assert.equal(manifest.dependencies['com.unity.ugui'], '1.0.0');
for (const version of Object.values(manifest.dependencies)) assert.match(version, /^\d+\.\d+\.\d+$/);
const config = json('Assets/Resources/Config/game-config.json');
assert.ok([4, 5].includes(config.boardSize));
assert.equal(config.turnSeconds, 300);
assert.equal(config.handLimit, 5);
const demo = json('Assets/Resources/Data/demo-cards.json');
assert.equal(demo.cards.length, 5);
assert.equal(new Set(demo.cards.map(c => c.demoEffect)).size, 5);
for (const card of demo.cards) assert.ok(card.id.startsWith('demo_') && card.effect.length > 0);
const catalog = json('Assets/Resources/Data/web-card-catalog.json');
assert.equal(catalog.defaultCardIds.length, 60);
assert.equal(new Set(catalog.cards.map(c => c.id)).size, catalog.cards.length);
for (const card of catalog.cards) {
  assert.match(card.id, /^0[1-3][1-5]\d{2}$/);
  assert.ok(Number.isInteger(card.baseAttack) && card.baseAttack >= 0);
  for (const field of ['name', 'camp', 'rarity', 'skill', 'effect']) assert.ok(card[field]?.length > 0);
}
for (const camp of ['01', '02', '03']) assert.equal(catalog.defaultCardIds.filter(id => id.startsWith(camp)).length, 20);
const allGuids = new Set();
let assets = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.meta')) continue;
    const full = path.join(directory, entry.name);
    const meta = fs.readFileSync(full + '.meta', 'utf8');
    const guid = meta.match(/^guid: ([a-f0-9]{32})$/m)?.[1];
    assert.ok(guid && !allGuids.has(guid), `Missing/duplicate metadata GUID: ${full}`);
    allGuids.add(guid); assets++;
    if (entry.isDirectory()) walk(full);
    else if (/\.(json|asmdef)$/.test(entry.name)) JSON.parse(fs.readFileSync(full, 'utf8'));
    else if (entry.name.endsWith('.cs')) assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /[A-Z]:\\Users\\|C:\\codex_card/);
  }
}
walk(path.join(project, 'Assets'));
const font = fs.readFileSync(path.join(project, 'Assets/Resources/Fonts/NotoSansSC-Regular.otf'));
assert.equal(font.toString('ascii', 0, 4), 'OTTO');
const provenance = json('Documentation/font-provenance.json');
assert.equal(crypto.createHash('sha256').update(font).digest('hex'), provenance.sha256);
assert.match(read('Assets/Resources/Fonts/OFL.txt'), /SIL OPEN FONT LICENSE/);
assert.match(read('Assets/Scenes/Main.unity'), /GameObject:/);
const sceneGuid = read('Assets/Scenes/Main.unity.meta').match(/^guid: ([a-f0-9]+)$/m)[1];
assert.ok(read('ProjectSettings/EditorBuildSettings.asset').includes(sceneGuid));
assert.ok(read('.gitignore').includes('/[Ll]ibrary/'));
assert.ok(json('Assets/Scripts/Runtime/CardDemo.Runtime.asmdef').references.includes('UnityEngine.UI'));
const lock = json('Packages/packages-lock.json').dependencies;
for (const [name, version] of Object.entries(manifest.dependencies)) assert.equal(lock[name]?.version, version);
console.log(`PASS: ${assets} asset entries, unique metadata, ${catalog.cards.length} reference cards, config, packages, scene and font checksum.`);
