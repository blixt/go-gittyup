import htm from "htm";
import React, { useEffect, useRef } from "react";
import { ConsoleLine } from "./ConsoleLine.js";

const html = htm.bind(React.createElement);

/**
 * Console component that displays logs and chat input
 * @param {Object} props
 * @param {import("../reducer.js").LogEntry[]} props.logs - Array of log entries to display
 * @param {string} props.chatInput - Current chat input value
 * @param {(value: string) => void} props.setChatInput - Chat input update handler
 * @param {(e: React.FormEvent) => void} props.handleChatSubmit - Chat submit handler
 * @param {import("../reducer.js").ConnectionState} props.connectionState - Current connection state
 * @param {React.RefObject<HTMLDivElement>} props.logsRef - Ref for logs container
 */
export function Console({ logs, chatInput, setChatInput, handleChatSubmit, connectionState, logsRef }) {
    // Track if we were scrolled to bottom before update
    const wasScrolledToBottom = useRef(true);

    // biome-ignore lint/correctness/useExhaustiveDependencies: We want to rerun this when logs change.
    useEffect(() => {
        const logsContainer = logsRef.current;
        if (logsContainer && wasScrolledToBottom.current) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
    }, [logs]);

    // Update wasScrolledToBottom when user scrolls
    const handleScroll = (e) => {
        const target = e.target;
        const isScrolledToBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 1;
        wasScrolledToBottom.current = isScrolledToBottom;
    };

    return html`
        <div className="border-t border-slate-300 dark:border-slate-700">
            <div className="flex flex-col h-64">
                <div
                    ref=${logsRef}
                    onScroll=${handleScroll}
                    className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                >
                    ${logs.map((log, index) => html`<${ConsoleLine} key=${index} entry=${log} />`)}
                </div>
                <form
                    onSubmit=${handleChatSubmit}
                    className="flex border-t border-slate-300 dark:border-slate-700"
                >
                    <input
                        type="text"
                        value=${chatInput}
                        onChange=${(e) => setChatInput(e.target.value)}
                        placeholder="Type a message..."
                        disabled=${connectionState === "disconnected"}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 text-sm focus:outline-none text-slate-900 dark:text-slate-200 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                    />
                </form>
            </div>
        </div>
    `;
}
