// ARUNIKA — Island Hop Flight: the hand-in program.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Standard library only; deterministic, so two
// runs write the same bytes.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Summary for the submitter: what went in, so a bad hand-in is obvious.
const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true });
const shotFiles = readdirSync(join(outDir, 'screenshots')).sort();
console.log(`ARUNIKA handed in: ${outDir} (${dossier.length} byte dossier)`);
console.log(`  game/: ${gameFiles.length} entries; screenshots/: ${shotFiles.join(', ')}`);
