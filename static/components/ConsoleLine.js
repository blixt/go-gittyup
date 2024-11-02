import htm from "htm";
import React from "react";

const html = htm.bind(React.createElement);

/**
 * Renders a single console log entry with ANSI color support
 * @param {Object} props
 * @param {import("../reducer.js").LogEntry} props.entry - The log entry to display
 * @returns {import("react").ReactElement} A React element representing the console line
 */
export function ConsoleLine({ entry }) {
    return html`
        <div className="whitespace-pre-wrap break-words">
            ${entry.segments.map((segment, index) =>
                segment.href
                    ? html`<a
                        key=${index}
                        href=${segment.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className=${segment.classes}
                      >${segment.text}</a>`
                    : html`<span key=${index} className=${segment.classes}>${segment.text}</span>`,
            )}
        </div>
    `;
}
