// Checks the serialized handoff files without pretending to run Unity or render its UI.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'Assets/CardPageTemplate';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const guid = file => read(file + '.meta').match(/^guid: ([a-f0-9]{32})$/m)?.[1];
const asset = read(`${base}/Samples/ExampleCardPage.asset`);
const scene = read(`${base}/Scenes/CardPagePreview.unity`);

assert.ok(asset.includes(`m_Script: {fileID: 11500000, guid: ${guid(`${base}/Runtime/CardPageData.cs`)}, type: 3}`));
assert.ok(scene.includes(`m_Script: {fileID: 11500000, guid: ${guid(`${base}/Runtime/CardPagePreview.cs`)}, type: 3}`));
assert.ok(scene.includes(`content: {fileID: 11400000, guid: ${guid(`${base}/Samples/ExampleCardPage.asset`)}, type: 2}`));
for (const file of ['Scenes/CardPagePreview.unity', 'Samples/ExampleCardPage.asset']) {
  const value = read(`${base}/${file}`);
  const definitions = [...value.matchAll(/^--- !u!\d+ &(\d+)$/gm)].map(match => match[1]);
  assert.equal(new Set(definitions).size, definitions.length, 'serialized object IDs must be unique');
  for (const match of value.matchAll(/\{fileID: (\d+)\}/g))
    assert.ok(match[1] === '0' || definitions.includes(match[1]), `unresolved local object: ${file} ${match[1]}`);
}
const dataCode = read(`${base}/Runtime/CardPageData.cs`);
for (const field of ['pageTitle','pageSubtitle','cardId','cardName','faction','rarity','power','artwork','artworkPlaceholder',
  'skillTitle','skillDescription','extraTitle','extraFields','showAction','actionLabel','footer','backgroundColor',
  'surfaceColor','artworkBackgroundColor','accentColor','textColor','mutedTextColor','buttonTextColor',
  'cardWidth','artworkHeight','titleFontSize','bodyFontSize']) {
  assert.match(asset, new RegExp(`^  ${field}:`, 'm'));
  assert.match(dataCode, new RegExp(`public [\\w\\[\\]]+ ${field}\\b`));
}
for (const field of ['pageTitle','cardId','cardName','skillDescription'])
  assert.ok(JSON.parse(asset.match(new RegExp(`^  ${field}: (".*")$`, 'm'))[1]).length > 0);
const number = field => Number(asset.match(new RegExp(`^  ${field}: ([0-9.]+)$`, 'm'))[1]);
assert.ok(number('cardWidth') >= 360 && number('cardWidth') <= 960);
assert.ok(number('artworkHeight') >= 100 && number('artworkHeight') <= 600);
const runtime = JSON.parse(read(`${base}/Runtime/CardDemo.CardPage.asmdef`));
assert.ok(runtime.references.includes('CardDemo.Core') && runtime.references.includes('UnityEngine.UI'));
const editor = JSON.parse(read(`${base}/Editor/CardDemo.CardPage.Editor.asmdef`));
assert.ok(editor.includePlatforms.includes('Editor') && editor.references.includes(runtime.name));
const tests = JSON.parse(read(`${base}/Tests/CardDemo.CardPage.Tests.asmdef`));
assert.ok(tests.includePlatforms.includes('Editor') && tests.optionalUnityReferences.includes('TestAssemblies'));
for (const name of ['CardPageData','CardPageView','CardPageFactory','CardPagePreview'])
  assert.doesNotMatch(read(`${base}/Runtime/${name}.cs`), /^using UnityEditor/m);
assert.ok(read(`${base}/Editor/CardPageTools.cs`).includes('AssetDatabase.GenerateUniqueAssetPath'));
console.log('PASS card page: scene/script/asset GUIDs, serialized references, sample fields, separate runtime/editor/test assemblies.');
