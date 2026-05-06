#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:readline/promises"));
const node_process_1 = require("node:process");
const core_1 = require("@lumemex/core");
async function askYesNo(question) {
    const rl = promises_1.default.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
    try {
        const answer = await rl.question(`${question} (y/N) `);
        return /^y(es)?$/i.test(answer.trim());
    }
    finally {
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
        const result = await (0, core_1.ingestOneRawPath)(rawPath, { force });
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    if (cmd === 'query') {
        const question = args.join(' ').trim();
        if (!question) {
            console.log('Usage: lumemex query <question>');
            process.exit(1);
        }
        const result = await (0, core_1.queryQuestion)(question);
        console.log(result.answerMarkdown);
        if (result.saveCandidate?.should_save) {
            const ok = await askYesNo(`Save proposed answer to wiki? (slug: ${result.saveCandidate.slug})`);
            if (ok) {
                const saved = await (0, core_1.saveQueryCandidate)({ saveCandidate: result.saveCandidate });
                console.log(`Saved: ${saved.path}`);
            }
            else {
                console.log('Not saved (confirm-first).');
            }
        }
        else {
            console.log('No wiki page proposal from this query.');
        }
        return;
    }
    if (cmd === 'lint') {
        const report = await (0, core_1.runLint)();
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
//# sourceMappingURL=bin.js.map