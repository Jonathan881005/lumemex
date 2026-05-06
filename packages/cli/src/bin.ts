#!/usr/bin/env node

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { ingestOneRawPath, queryQuestion, runLint, saveQueryCandidate } from '@lumemex/core';

async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} (y/N) `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function main() {
  const [, , cmd, ...args] = process.argv;

  if (!cmd) {
    console.log('Usage: lumemex <ingest|query|lint> [...args]');
    process.exit(1);
  }

  if (cmd === 'ingest') {
    const force = args.includes('--force');
    const rawPath = args.find((a) => !a.startsWith('--'));
    if (!rawPath) {
      console.log('Usage: lumemex ingest <rawPathRelativeToRepo> [--force]');
      process.exit(1);
    }
    const result = await ingestOneRawPath(rawPath, { force });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'query') {
    const question = args.join(' ').trim();
    if (!question) {
      console.log('Usage: lumemex query <question>');
      process.exit(1);
    }

    const result = await queryQuestion(question);
    console.log(result.answerMarkdown);

    if (result.saveCandidate?.should_save) {
      const ok = await askYesNo(`Save proposed answer to wiki? (slug: ${result.saveCandidate.slug})`);
      if (ok) {
        const saved = await saveQueryCandidate({ saveCandidate: result.saveCandidate });
        console.log(`Saved: ${saved.path}`);
      } else {
        console.log('Not saved (confirm-first).');
      }
    } else {
      console.log('No wiki page proposal from this query.');
    }
    return;
  }

  if (cmd === 'lint') {
    const report = await runLint();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Unknown command: ${cmd}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

