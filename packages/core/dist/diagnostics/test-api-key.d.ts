export type ApiKeyTestResult = {
    ok: true;
    model: string;
    providerBaseUrl: string;
    text: string;
} | {
    ok: false;
    model: string;
    providerBaseUrl: string;
    statusCode?: number;
    errorBody: unknown;
};
export declare function testApiKey(): Promise<ApiKeyTestResult>;
