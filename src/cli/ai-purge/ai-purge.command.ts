import { AiPurgeRefusedError } from '../../modules/ai-assist/public/ai-purge.errors';
import { AiPurgeApi } from '../../modules/ai-assist/public/ai-purge.api';
import { defineCommand, errorName, runInNestContext, writeCliFailure as fail } from '../run-command';
import { AI_PURGE_USAGE, AiPurgeArgumentError, parseAiPurgeArguments } from './ai-purge.arguments';
import { exitOf, reportOf } from './ai-purge.report';

/** `node dist/cli.js ai-purge` (`pnpm ops:ai-purge`, alias `dist/ai-purge-cli.js`). */
export const aiPurgeCommand = defineCommand({
  usage: AI_PURGE_USAGE,
  parse: parseAiPurgeArguments,
  argumentError: AiPurgeArgumentError,
  crashed: (error) => `The purge failed: ${errorName(error)}`,
  execute: ({ command }) =>
    runInNestContext({
      // The graph validates the database settings only.
      graph: () => import('./ai-purge-cli.module').then((m) => m.AiPurgeCliModule),
      work: async (app) => {
        const result = await app.get(AiPurgeApi).purge(command);
        process.stdout.write(`${reportOf(result).join('\n')}\n`);

        return exitOf(result);
      },
      failed: (error) => {
        if (error instanceof AiPurgeRefusedError) return fail(`Refused (${error.problem}). Nothing was deleted.`);

        return fail(
          `The purge failed: ${errorName(error)}. Run again: a purge already applied is resumed, never doubled.`,
        );
      },
    }),
});
