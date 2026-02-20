import { extractTrackingCode, sanitizeMessage } from './tracking';

// Mock process.env
const originalEnv = process.env;

describe('Attribution - Tracking Code', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv, WA_TRACKING_REGEX: 'CAMP-[A-Z0-9]+' };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('extractTrackingCode finds valid code', () => {
        const text = 'Olá, gostaria de saber mais. CAMP-SUMMER2024';
        expect(extractTrackingCode(text)).toBe('CAMP-SUMMER2024');
    });

    test('extractTrackingCode returns null if no code', () => {
        const text = 'Olá, preço?';
        expect(extractTrackingCode(text)).toBeNull();
    });

    test('sanitizeMessage removes code', () => {
        const text = 'Olá CAMP-ABC 123';
        const code = 'CAMP-ABC';
        expect(sanitizeMessage(text, code)).toBe('Olá  123'); // Simple replace leaves spaces, trim happens at ends
    });

    test('sanitizeMessage trims result', () => {
        const text = 'CAMP-ABC Olá';
        const code = 'CAMP-ABC';
        expect(sanitizeMessage(text, code)).toBe('Olá');
    });
});
