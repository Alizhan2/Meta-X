import {readFile,writeFile} from 'node:fs/promises';
import {basename,dirname,resolve} from 'node:path';
import {renderReport} from '../src/report.mjs';
import {compareRuns} from '../src/comparison.mjs';

const [originalPath,correctedPath]=process.argv.slice(2);
if(!originalPath||!correctedPath)throw new Error('Usage: npm run compare -- original/report.json corrected/report.json');
const original=JSON.parse(await readFile(originalPath,'utf8'));
const corrected=JSON.parse(await readFile(correctedPath,'utf8'));
const run=basename(dirname(resolve(correctedPath)));
if(!/^agent-\d+$/.test(run)||resolve(originalPath)===resolve(correctedPath))throw new Error('Runs must be distinct agent reports');
original.correctedComparison={run,steps:corrected.steps.length,...compareRuns(original,corrected),source:'Fresh adaptive Meta agent run; separate from exact-key replay.'};
await writeFile(originalPath,JSON.stringify(original,null,2));
await writeFile(resolve(dirname(originalPath),'report.html'),renderReport(original));
console.log(JSON.stringify(original.correctedComparison));
