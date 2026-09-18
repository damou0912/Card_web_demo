// Create deterministic Unity GUIDs only for missing .meta files. Existing GUIDs are never changed.
// After importing in Unity, always retain the importer settings written by Unity itself.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.endsWith('.meta') || entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    const relative = path.relative(project, full).replaceAll('\\', '/');
    if (!fs.existsSync(full + '.meta')) {
      const guid = crypto.createHash('sha256').update('UnityCard_demo/' + relative).digest('hex').slice(0, 32);
      let text = `fileFormatVersion: 2\nguid: ${guid}\n`;
      if (entry.isDirectory()) text += 'folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
      else if (entry.name.endsWith('.cs')) text += 'MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
      else if (entry.name.endsWith('.otf')) text += 'TrueTypeFontImporter:\n  externalObjects: {}\n  serializedVersion: 4\n  fontSize: 24\n  forceTextureCase: -2\n  characterSpacing: 0\n  characterPadding: 1\n  includeFontData: 1\n  fontName: Noto Sans SC\n  fontNames:\n  - Noto Sans SC\n  fallbackFontReferences: []\n  customCharacters: \n  fontRenderingMode: 0\n  ascentCalculationMode: 1\n  useLegacyBoundsCalculation: 0\n  shouldRoundAdvanceValue: 1\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n';
      fs.writeFileSync(full + '.meta', text.replace(/[ \t]+$/gm, '')); count++;
    }
    if (entry.isDirectory()) walk(full);
  }
}
walk(path.join(project, 'Assets'));
console.log(`Created ${count} missing metadata files.`);
