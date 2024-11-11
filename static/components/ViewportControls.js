import htm from "htm";
import React from "react";

const html = htm.bind(React.createElement);

/**
 * @typedef {'horizontal' | 'vertical' | 'code' | 'preview'} ViewportMode
 */

/**
 * Single viewport control button
 * @param {object} props
 * @param {ViewportMode} props.mode
 * @param {boolean} props.isActive
 * @param {import("react").ComponentType} props.icon
 * @param {string} props.title
 * @param {(mode: ViewportMode) => void} props.onClick
 */
export function ViewportButton({ mode, isActive, icon: Icon, title, onClick }) {
    const className = `p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${
        isActive ? "text-blue-600 dark:text-blue-400 bg-slate-100 dark:bg-slate-700" : "text-slate-600 dark:text-slate-300"
    }`;

    return html`
        <button onClick=${() => onClick(mode)} className=${className} title=${title}>
            <${Icon} size=${16} />
        </button>
    `;
}
