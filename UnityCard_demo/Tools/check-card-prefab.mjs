// Serialized prefab integrity, not a Unity import/render test.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'Assets/CardPageTemplate';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const guid = file => read(file + '.meta').match(/^guid: ([a-f0-9]{32})$/m)?.[1];
// Verified against Unity's public uGUI source: Runtime/UGUI/UI/Core/{Image,Text}.cs.meta.
const imageGuid = 'fe87c0e1cc204ed48ad3b37840f39efc';
const textGuid = '5f7201a12d95ffc409449d95f23cf332';
const viewGuid = guid(`${base}/Runtime/CardPrefabView.cs`);
const fontGuid = guid('Assets/Resources/Fonts/NotoSansSC-Regular.otf');
const prefab = read(`${base}/Prefabs/EditableCard.prefab`);
const blocks = [...prefab.matchAll(/^--- !u!(\d+) &(\d+)\r?\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)];
const byId = new Map(blocks.map(m => [m[2], { type: Number(m[1]), body: m[3] }]));
assert.equal(byId.size, blocks.length, 'unique local object IDs');
assert.equal(blocks.filter(m => m[1] === '1').length, 16, '16 real editable child/root objects, including country badge');
for (const match of prefab.matchAll(/\{fileID: (\d+)\}/g))
  assert.ok(match[1] === '0' || byId.has(match[1]), `unresolved local reference: ${match[1]}`);
for (const object of byId.values()) {
  assert.ok([1, 114, 222, 224].includes(object.type), 'only GameObject, MonoBehaviour, CanvasRenderer, RectTransform');
  if (object.type !== 1) {
    const owner = object.body.match(/m_GameObject: \{fileID: (\d+)\}/)?.[1];
    assert.equal(byId.get(owner)?.type, 1, 'component owner must be a GameObject');
  } else {
    for (const component of object.body.matchAll(/component: \{fileID: (\d+)\}/g))
      assert.ok([114, 222, 224].includes(byId.get(component[1])?.type), 'every attached component exists');
  }
  if (object.type === 114) {
    const scriptGuid = object.body.match(/m_Script: \{fileID: 11500000, guid: ([a-f0-9]+), type: 3\}/)?.[1];
    assert.ok([imageGuid, textGuid, viewGuid].includes(scriptGuid), 'no automatic layout controllers or missing script GUID');
    if (scriptGuid === textGuid) {
      assert.ok(object.body.includes(`m_Font: {fileID: 12800000, guid: ${fontGuid}, type: 3}`));
      assert.match(object.body, /m_BestFit: 0/);
      assert.match(object.body, /m_RichText: 0/);
    }
  }
}
for (const match of prefab.matchAll(/m_Children:\r?\n((?:  - \{fileID: \d+\}\r?\n)+)/g))
  for (const child of match[1].matchAll(/fileID: (\d+)/g)) assert.equal(byId.get(child[1])?.type, 224);
const binding = [...byId.values()].find(o => o.type === 114 && o.body.includes(`guid: ${viewGuid}`));
assert.ok(binding);
for (const name of ['cardName', 'cardId', 'faction', 'rarity', 'power', 'artwork', 'countryBadge', 'artworkPlaceholder', 'skillTitle', 'skillDescription', 'extensionSlot']) {
  const ref = binding.body.match(new RegExp(`^  ${name}: \\{fileID: (\\d+)\\}`, 'm'))?.[1];
  assert.equal(byId.get(ref)?.type, name === 'extensionSlot' ? 224 : 114, `bound ${name}`);
}
const runtime = read(`${base}/Runtime/CardPrefabView.cs`);
assert.doesNotMatch(runtime, /\bvoid\s+(Start|Awake|Update|OnValidate)\s*\(/, 'no automatic rebinding');
assert.doesNotMatch(runtime, /\.(anchorMin|anchorMax|anchoredPosition|sizeDelta|fontSize|color)\s*=/, 'content binding must preserve appearance');
const editor = read(`${base}/Editor/CardPrefabTools.cs`);
assert.match(editor, /PrefabUtility\.InstantiatePrefab/);
assert.match(editor, /AssetDatabase\.GenerateUniqueAssetPath/);
assert.match(byId.get('1153').body, /m_PreserveAspect: 1/);
assert.match(byId.get('1153').body, /m_RaycastTarget: 0/);
console.log('PASS card prefab: 16 editable objects, country badge binding, script/font references, no automatic layout or style overwrite.');
