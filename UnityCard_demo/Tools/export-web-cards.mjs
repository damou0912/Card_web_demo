// Optional reference snapshot only. Excel is authoritative; never overwrite generated game data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(project, '..'));
function readArray(filename, variable) {
  const text = fs.readFileSync(path.join(source, filename), 'utf8');
  const match = text.match(new RegExp(`const ${variable} = (\\[[\\s\\S]*?\\n\\]);`));
  if (!match) throw new Error(`Cannot find JSON array ${variable} in ${filename}`);
  return JSON.parse(match[1]); // Never execute the browser scripts.
}
const defaults = readArray('card-info.js', 'CARD_INFO');
const replacement = readArray('replacement-cards.js', 'REPLACEMENT_CARDS');
const ids = new Set();
const cards = [...defaults, ...replacement].map(card => {
  if (!/^0[1-3][1-5]\d{2}$/.test(card.id) || ids.has(card.id) || !Number.isInteger(card.baseAttack) || card.baseAttack < 0)
    throw new Error(`Invalid or duplicate card: ${card.id}`);
  ids.add(card.id);
  for (const field of ['name', 'camp', 'rarity', 'skill', 'effect'])
    if (typeof card[field] !== 'string' || !card[field].trim()) throw new Error(`Missing ${field}: ${card.id}`);
  return { id: card.id, name: card.name, camp: card.camp, rarity: card.rarity,
    baseAttack: card.baseAttack, skill: card.skill, effect: card.effect };
});
const schema = fs.readFileSync(path.join(source, 'card-info.js'), 'utf8').match(/CARD_INFO_SCHEMA_VERSION\s*=\s*"([^"]+)"/);
const target = path.join(project, 'Artifacts/Imports/web-card-catalog.import.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify({ schemaVersion: 1, sourceSchema: schema?.[1] || 'unknown',
  usage: 'Reference only. Production skills are not implemented in this demo.',
  defaultCardIds: defaults.map(c => c.id), cards }, null, 2) + '\n');
console.log(`Exported ${defaults.length} default + ${replacement.length} replacement cards to ${target}. Review and copy changes into the Excel sources; game outputs were not changed.`);
