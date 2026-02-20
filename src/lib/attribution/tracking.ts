export const DEFAULT_TRACKING_REGEX = 'CAMP-[A-Z0-9]+';

export function getTrackingRegex(): RegExp {
    const pattern = process.env.WA_TRACKING_REGEX || DEFAULT_TRACKING_REGEX;
    return new RegExp(pattern, 'i'); // Case insensitive
}

export function extractTrackingCode(text: string): string | null {
    if (!text) return null;
    const regex = getTrackingRegex();
    const match = text.match(regex);
    return match ? match[0] : null;
}

export function sanitizeMessage(text: string, code: string): string {
    if (!text || !code) return text;
    // Remove code and surrounding whitespace/brackets if any
    // Simplified replacement: just remove the exact code string
    return text.replace(code, '').trim();
}
