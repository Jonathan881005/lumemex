import type { IngestResult } from '@lumemex/shared';
export declare function ingestOneRawPath(rawPathRelativeToRepo: string, options?: {
    force?: boolean;
}): Promise<IngestResult>;
