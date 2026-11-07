import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { getServerEnv } from '../api/src/config/env';
import { createInfrastructure } from '../api/src/wiring';
import { runEvaluation } from './runner';
import {
  evalCaseSchema,
  evalResultSchema,
  gradeSchema,
  parseJsonl,
  scoreEvaluation,
  type Grade,
} from './score';

const USAGE = `Uso:
  npm run eval -- run --cases <casos.jsonl> --out <resultados.jsonl>
  npm run eval -- score --results <resultados.jsonl> [--grades <notas.jsonl>]`;

function required(value: string | undefined, name: string): string {
  if (value === undefined) throw new Error(`Falta --${name}\n${USAGE}`);
  return value;
}

async function run(casesPath: string, outPath: string): Promise<void> {
  const cases = parseJsonl(readFileSync(casesPath, 'utf8'), evalCaseSchema);
  const { embedder, search, generator } = createInfrastructure(getServerEnv());
  const results = await runEvaluation(cases, { embedder, search, generator }, (result) => {
    console.info(`${result.id}: ${result.status}`);
  });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${results.map((r) => JSON.stringify(r)).join('\n')}\n`);
  console.info(`${results.length} resultados en ${outPath}`);
}

function score(resultsPath: string, gradesPath: string | undefined): boolean {
  const results = parseJsonl(readFileSync(resultsPath, 'utf8'), evalResultSchema);
  const grades: Grade[] =
    gradesPath === undefined ? [] : parseJsonl(readFileSync(gradesPath, 'utf8'), gradeSchema);
  const report = scoreEvaluation(results, grades);
  console.info(JSON.stringify(report, null, 2));
  console.info(report.passed ? 'SUPERA el criterio de lanzamiento' : 'NO supera el criterio');
  return report.passed;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      cases: { type: 'string' },
      out: { type: 'string' },
      results: { type: 'string' },
      grades: { type: 'string' },
    },
  });
  const command = positionals[0];
  if (command === 'run') {
    await run(required(values.cases, 'cases'), required(values.out, 'out'));
    process.exit(0);
  }
  if (command === 'score') {
    process.exit(score(required(values.results, 'results'), values.grades) ? 0 : 1);
  }
  throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
