/**
 * Mapping of ANSI escape codes to Tailwind CSS classes
 * @type {Record<number, string>}
 */
const ANSI_TO_TAILWIND = {
    // Foreground colors
    30: "text-slate-900 dark:text-slate-200", // Black/White
    31: "text-red-600 dark:text-red-400",
    32: "text-green-600 dark:text-green-400",
    33: "text-yellow-600 dark:text-yellow-400",
    34: "text-blue-600 dark:text-blue-400",
    35: "text-purple-600 dark:text-purple-400",
    36: "text-cyan-600 dark:text-cyan-400",
    37: "text-slate-600 dark:text-slate-300",

    // Background colors
    40: "bg-slate-900 dark:bg-slate-200",
    41: "bg-red-600 dark:bg-red-400",
    42: "bg-green-600 dark:bg-green-400",
    43: "bg-yellow-600 dark:bg-yellow-400",
    44: "bg-blue-600 dark:bg-blue-400",
    45: "bg-purple-600 dark:bg-purple-400",
    46: "bg-cyan-600 dark:bg-cyan-400",
    47: "bg-slate-200 dark:bg-slate-600",

    // Bright foreground colors
    90: "text-slate-500 dark:text-slate-400",
    91: "text-red-500 dark:text-red-300",
    92: "text-green-500 dark:text-green-300",
    93: "text-yellow-500 dark:text-yellow-300",
    94: "text-blue-500 dark:text-blue-300",
    95: "text-purple-500 dark:text-purple-300",
    96: "text-cyan-500 dark:text-cyan-300",
    97: "text-slate-100 dark:text-slate-50",

    // Bright background colors
    100: "bg-slate-500 dark:bg-slate-400",
    101: "bg-red-500 dark:bg-red-300",
    102: "bg-green-500 dark:bg-green-300",
    103: "bg-yellow-500 dark:bg-yellow-300",
    104: "bg-blue-500 dark:bg-blue-300",
    105: "bg-purple-500 dark:bg-purple-300",
    106: "bg-cyan-500 dark:bg-cyan-300",
    107: "bg-white dark:bg-slate-50",
};

/**
 * Represents a segment of text with its associated styling classes and link
 * @typedef {Object} TextSegment
 * @property {string} text - The text content
 * @property {string} classes - Space-separated Tailwind CSS classes
 * @property {string} [href] - URL if this segment is part of a link
 */

/**
 * Pattern to match ANSI escape sequences:
 * - Color/style codes: \u001b\[([0-9;]*)m
 * - Cursor movement codes: \u001b\[\d*(?:;\d+)*[HJA-Za-z]
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI codes
const ANSI_PATTERN = /\u001b\[(?:[0-9;]*)m|\u001b\[\d*(?:;\d+)*[HJA-Za-z]/g;

/**
 * Pattern to match URLs
 */
const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/**
 * @typedef {Object} AnsiState
 * @property {string} color - Current text color class
 * @property {string} background - Current background color class
 * @property {boolean} bold - Whether text is bold
 * @property {boolean} dim - Whether text is dimmed
 * @property {boolean} italic - Whether text is italic
 * @property {boolean} underline - Whether text is underlined
 * @property {boolean} blink - Whether text is blinking
 * @property {boolean} inverse - Whether colors are inverted
 * @property {boolean} hidden - Whether text is hidden
 * @property {boolean} strikethrough - Whether text has strikethrough
 */

/**
 * Updates the current styling state based on ANSI codes
 * @param {AnsiState} state - Current styling state
 * @param {string} ansiCodes - Semicolon-separated ANSI codes
 */
function updateStyleState(state, ansiCodes) {
    if (!ansiCodes) return;

    const codes = ansiCodes.split(";").map(Number);
    for (const code of codes) {
        if (code === 0) {
            // Reset all styles
            state.color = "";
            state.background = "";
            state.bold = false;
            state.dim = false;
            state.italic = false;
            state.underline = false;
            state.blink = false;
            state.inverse = false;
            state.hidden = false;
            state.strikethrough = false;
        } else if (code === 39) {
            // Reset foreground color to default
            state.color = "";
        } else if (code === 49) {
            // Reset background color to default
            state.background = "";
        } else if (ANSI_TO_TAILWIND[code]) {
            if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
                state.color = ANSI_TO_TAILWIND[code];
            } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
                state.background = ANSI_TO_TAILWIND[code];
            }
        } else {
            // Handle other formatting codes
            switch (code) {
                case 1:
                    state.bold = true;
                    state.dim = false;
                    break;
                case 2:
                    state.dim = true;
                    state.bold = false;
                    break;
                case 3:
                    state.italic = true;
                    break;
                case 4:
                    state.underline = true;
                    break;
                case 5:
                case 6:
                    state.blink = true;
                    break;
                case 7:
                    state.inverse = true;
                    break;
                case 8:
                    state.hidden = true;
                    break;
                case 9:
                    state.strikethrough = true;
                    break;
                case 21:
                    state.underline = true;
                    break; // Double underline (treated as normal underline)
                case 22:
                    state.bold = false;
                    state.dim = false;
                    break;
                case 23:
                    state.italic = false;
                    break;
                case 24:
                    state.underline = false;
                    break;
                case 25:
                    state.blink = false;
                    break;
                case 27:
                    state.inverse = false;
                    break;
                case 28:
                    state.hidden = false;
                    break;
                case 29:
                    state.strikethrough = false;
                    break;
            }
        }
    }
}

/**
 * Converts an AnsiState to a space-separated class string
 * @param {AnsiState} state
 * @returns {string}
 */
function stateToClasses(state) {
    const classes = [];
    if (state.color) classes.push(state.color);
    if (state.background) classes.push(state.background);
    if (state.bold) classes.push("font-bold");
    if (state.dim) classes.push("opacity-75");
    if (state.italic) classes.push("italic");
    if (state.underline) classes.push("underline");
    if (state.strikethrough) classes.push("line-through");
    if (state.blink) classes.push("animate-pulse");
    if (state.hidden) classes.push("invisible");
    if (state.inverse) {
        // Swap background and text colors using CSS custom properties
        classes.push("mix-blend-difference");
    }
    return classes.join(" ");
}

/**
 * Creates text segments with appropriate styling and URL detection
 * @param {string} text - The input text containing ANSI escape sequences
 * @returns {TextSegment[]} An array of text segments with their associated styles
 */
export function parseAnsiString(text) {
    if (!text) return [{ text: "", classes: "" }];

    /** @type {TextSegment[]} */
    const result = [];
    /** @type {AnsiState} */
    const currentState = {
        color: "",
        background: "",
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        blink: false,
        inverse: false,
        hidden: false,
        strikethrough: false,
    };

    let cleanText = "";
    /** @type {{start: number, end: number, state: AnsiState}[]} */
    const segmentMap = [];

    // Split and process the text based on ANSI codes
    const parts = text.split(ANSI_PATTERN);
    const matches = text.match(ANSI_PATTERN) || [];

    // First pass: Process ANSI codes and build clean text
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part) {
            const start = cleanText.length;
            cleanText += part;
            segmentMap.push({
                start,
                end: cleanText.length,
                state: { ...currentState },
            });
        }

        // Process the following ANSI code if any
        if (i < matches.length) {
            const ansiCode = matches[i];
            const codes = ansiCode.match(/\[([0-9;]*)m/)?.[1];
            if (codes) {
                updateStyleState(currentState, codes);
            }
        }
    }

    // Find URLs in clean text
    const urlMatches = Array.from(cleanText.matchAll(URL_PATTERN));

    // If no URLs, return the segments as is
    if (!urlMatches.length) {
        return segmentMap
            .map(({ start, end, state }) => ({
                text: cleanText.slice(start, end),
                classes: stateToClasses(state),
            }))
            .filter((segment) => segment.text);
    }

    // Process each segment, splitting if it overlaps with URLs
    for (const { start: segStart, end: segEnd, state } of segmentMap) {
        let lastPos = segStart;
        const segmentText = cleanText.slice(segStart, segEnd);
        const baseClasses = stateToClasses(state);

        // Skip empty segments
        if (!segmentText) continue;

        let hasOverlappingUrl = false;

        // Check if this segment overlaps with any URLs
        for (const match of urlMatches) {
            const urlStart = match.index ?? 0;
            const urlEnd = urlStart + match[0].length;

            // Skip if URL is after this segment
            if (urlStart >= segEnd) continue;
            // Skip if URL is before this segment
            if (urlEnd <= segStart) continue;

            hasOverlappingUrl = true;

            // Add text before URL in this segment (if any)
            if (urlStart > lastPos && urlStart > segStart) {
                const textBefore = segmentText.slice(Math.max(0, lastPos - segStart), urlStart - segStart);
                if (textBefore) {
                    result.push({
                        text: textBefore,
                        classes: baseClasses,
                    });
                }
            }

            // Add URL portion that falls within this segment
            const urlText = segmentText.slice(Math.max(0, urlStart - segStart), Math.min(segEnd - segStart, urlEnd - segStart));
            if (urlText) {
                result.push({
                    text: urlText,
                    classes: `underline ${baseClasses}`,
                    href: match[0],
                });
            }

            lastPos = Math.min(segEnd, urlEnd);
        }

        // If no URLs overlapped with this segment, add it as-is
        if (!hasOverlappingUrl) {
            result.push({
                text: segmentText,
                classes: baseClasses,
            });
        }
        // Add remaining text after last URL in this segment (if any)
        else if (lastPos < segEnd) {
            const textAfter = segmentText.slice(Math.max(0, lastPos - segStart));
            if (textAfter) {
                result.push({
                    text: textAfter,
                    classes: baseClasses,
                });
            }
        }
    }

    return result;
}
