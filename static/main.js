import htm from "htm";
import { Columns2, Monitor, Rows2, SquareCode } from "lucide-react";
import React, { useReducer, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConnectionForm } from "./components/ConnectionForm.js";
import { Console } from "./components/Console.js";
import { FileList } from "./components/FileList.js";
import { Loading } from "./components/Loading.js";
import { ViewportButton } from "./components/ViewportControls.js";
import { useFileContent } from "./hooks.js";
import { useWebContainer } from "./hooks.js";
import { parseWebSocketMessage } from "./messages.js";
import { CodeEditor, useSetupMonaco } from "./monaco.js";
import { CONSOLE_COLORS, initialState, log, reducer } from "./reducer.js";

/** @typedef {import("./components/ViewportControls.js").ViewportMode} ViewportMode */

const html = htm.bind(React.createElement);

/** @type {import("./components/ViewportControls.js").ViewportMode} */
const defaultViewportMode = "horizontal";

function App() {
    useSetupMonaco();
    const [state, dispatch] = useReducer(reducer, initialState);
    const logsRef = useRef(null);
    const [chatInput, setChatInput] = useState("");
    const iframeRef = useRef(null);
    const [layoutMode, setLayoutMode] = useState(defaultViewportMode);

    useWebContainer(state, dispatch, iframeRef);

    const currentFile = useFileContent(state.repoHash, state.currentCommit, state.selectedFile);

    const handleFileSelect = (path) => {
        if (!state.socket) return;
        state.socket.send(`updateMetadata ${JSON.stringify({ activeFile: path })}`);
        dispatch({ type: "SELECT_FILE", path });
    };

    useEffect(() => {
        if (!state.socket) return;

        state.socket.onmessage = (event) => {
            const envelope = parseWebSocketMessage(event.data);
            switch (envelope.type) {
                case "chat": {
                    dispatch({
                        type: "CHAT_MESSAGE",
                        userId: envelope.id,
                        content: envelope.message.content,
                    });
                    break;
                }
                case "join":
                    dispatch({ type: "USER_JOINED", user: envelope.message.user });
                    break;
                case "leave":
                    dispatch({ type: "USER_LEFT", id: envelope.id });
                    break;
                case "llmDelta":
                    dispatch({ type: "LLM_DELTA", id: envelope.message.id, content: envelope.message.content });
                    break;
                case "updateMetadata":
                    dispatch({ type: "USER_METADATA", id: envelope.id, metadata: envelope.message });
                    break;
                case "welcome": {
                    dispatch({
                        type: "INITIALIZE",
                        currentUserId: envelope.id,
                        users: envelope.message.users,
                        files: envelope.message.files,
                        repoHash: envelope.message.repoHash,
                        commit: envelope.message.currentCommit,
                    });
                    break;
                }
                default:
                    dispatch(log(event.data, CONSOLE_COLORS.SYSTEM));
            }
        };

        state.socket.onclose = (event) => {
            dispatch({ type: "DISCONNECTED", error: null });
            dispatch(log(`WebSocket connection closed (reason: ${event.reason || "n/a"}).`, CONSOLE_COLORS.SOCKET));
        };

        state.socket.onerror = () => {
            dispatch({ type: "DISCONNECTED", error: "An error occurred" });
            dispatch(log("WebSocket encountered an error.", CONSOLE_COLORS.ERROR));
        };
    }, [state.socket]);

    const handleChatSubmit = (e) => {
        e.preventDefault();
        const content = chatInput.trim();
        if (!content || !state.socket || !state.user) return;
        const message = { content };
        state.socket.send(`chat ${JSON.stringify(message)}`);
        dispatch({
            type: "CHAT_MESSAGE",
            userId: state.user.id,
            content,
        });
        setChatInput("");
    };

    return html`
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
            <div className="flex flex-1 min-h-0">
                <div className="w-80 flex flex-col border-r border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <${ConnectionForm} state=${state} dispatch=${dispatch} />

                    <div className="flex-1 overflow-y-auto">
                        <${FileList}
                            files=${state.files}
                            selectedFile=${state.selectedFile}
                            onFileSelect=${handleFileSelect}
                            usersInFiles=${state.usersInFiles}
                        />
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex gap-2 p-2 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 justify-center">
                        <${ViewportButton}
                            mode="horizontal"
                            isActive=${layoutMode === "horizontal"}
                            icon=${Columns2}
                            title="Split horizontally (50/50)"
                            onClick=${setLayoutMode}
                        />
                        <${ViewportButton}
                            mode="vertical"
                            isActive=${layoutMode === "vertical"}
                            icon=${Rows2}
                            title="Split vertically (50/50)"
                            onClick=${setLayoutMode}
                        />
                        <${ViewportButton}
                            mode="code"
                            isActive=${layoutMode === "code"}
                            icon=${SquareCode}
                            title="Show code only"
                            onClick=${setLayoutMode}
                        />
                        <${ViewportButton}
                            mode="preview"
                            isActive=${layoutMode === "preview"}
                            icon=${Monitor}
                            title="Show preview only"
                            onClick=${setLayoutMode}
                        />
                    </div>

                    <div className=${`flex min-h-0 ${layoutMode === "vertical" ? "flex-col" : "flex-row"} h-full`}>
                        <div className=${`${
                            layoutMode === "preview"
                                ? "hidden"
                                : layoutMode === "code"
                                  ? "w-full h-full"
                                  : layoutMode === "vertical"
                                    ? "h-1/2"
                                    : "w-1/2"
                        }`}>
                            ${
                                currentFile.isLoading
                                    ? html`<div className="flex items-center justify-center h-full text-slate-800 dark:text-slate-200">
                                          <${Loading} />
                                      </div>`
                                    : html`<${CodeEditor}
                                          path=${currentFile.path}
                                          value=${currentFile.content}
                                          readOnly
                                          markers=${[]}
                                      />`
                            }
                        </div>

                        <div className=${`${
                            layoutMode === "code"
                                ? "hidden"
                                : layoutMode === "preview"
                                  ? "w-full h-full"
                                  : layoutMode === "vertical"
                                    ? "h-1/2"
                                    : "w-1/2"
                        }`}>
                            <iframe
                                ref=${iframeRef}
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <${Console}
                logs=${state.logs}
                chatInput=${chatInput}
                setChatInput=${setChatInput}
                handleChatSubmit=${handleChatSubmit}
                connectionState=${state.connectionState}
                logsRef=${logsRef}
            />
        </div>
    `;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(html`<${App} />`);
