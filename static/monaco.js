import { useMonaco } from "@monaco-editor/react";
import Editor from "@monaco-editor/react";
import htm from "htm";
import { useLayoutEffect } from "react";
import React from "react";
import { Loading } from "./components/Loading.js";

const html = htm.bind(React.createElement);

/**
 * Light theme configuration for Monaco editor
 * @type {import("monaco-editor").editor.IStandaloneThemeData}
 */
const lightTheme = {
    base: "vs",
    inherit: true,
    rules: [
        { token: "comment", foreground: "64748b" }, // slate-500
        { token: "keyword", foreground: "6366f1" }, // indigo-500
        { token: "string", foreground: "16a34a" }, // green-600
        { token: "number", foreground: "d97706" }, // amber-600
        { token: "type", foreground: "2563eb" }, // blue-600
    ],
    colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#0f172a", // slate-900
        "editorLineNumber.foreground": "#64748b", // slate-500
        "editor.selectionBackground": "#e2e8f0", // slate-200
        "editor.lineHighlightBackground": "#f1f5f9", // slate-100
    },
};

/**
 * Dark theme configuration for Monaco editor
 * @type {import("monaco-editor").editor.IStandaloneThemeData}
 */
const darkTheme = {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "comment", foreground: "64748b" }, // slate-500
        { token: "keyword", foreground: "818cf8" }, // indigo-400
        { token: "string", foreground: "4ade80" }, // green-400
        { token: "number", foreground: "fbbf24" }, // amber-400
        { token: "type", foreground: "60a5fa" }, // blue-400
    ],
    colors: {
        "editor.background": "#0f172a", // slate-900
        "editor.foreground": "#e2e8f0", // slate-200
        "editorLineNumber.foreground": "#64748b", // slate-500
        "editor.selectionBackground": "#334155", // slate-700
        "editor.lineHighlightBackground": "#1e293b", // slate-800
    },
};

/**
 * Hook to detect dark mode preference
 * @returns {boolean}
 */
function useDarkMode() {
    const [isDark, setIsDark] = React.useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e) => setIsDark(e.matches);

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    return isDark;
}

/**
 * Maps file extensions to Monaco editor language identifiers
 * @param {string} path - File path to detect language from
 * @returns {string} Monaco language identifier
 */
const getLanguageFromPath = (path) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const languageMap = {
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        py: "python",
        go: "go",
        rs: "rust",
        java: "java",
        cpp: "cpp",
        c: "c",
        h: "c",
        hpp: "cpp",
        css: "css",
        html: "html",
        json: "json",
        md: "markdown",
    };
    return languageMap[ext] || "plaintext";
};

/**
 * Hook to initialize Monaco editor with custom theme and TypeScript configuration
 * @returns {void}
 */
export function useSetupMonaco() {
    const monaco = useMonaco();
    useLayoutEffect(() => {
        if (!monaco) return;

        monaco.editor.defineTheme("lightTheme", lightTheme);
        monaco.editor.defineTheme("darkTheme", darkTheme);

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            moduleDetection: 3,
        });

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            isolatedModules: true,
            moduleDetection: 3,
        });
    }, [monaco]);
}

/**
 * Props for the CodeEditor component
 * @typedef {Object} CodeEditorProps
 * @property {string} path - File path of the code being edited
 * @property {string} [language] - Optional override for the programming language
 * @property {string} value - Current value/content of the editor
 * @property {(value: string) => void} [onChange] - Callback when editor content changes
 * @property {boolean} [readOnly=false] - Whether the editor is in read-only mode
 * @property {unknown[]} [markers=[]] - Array of diagnostic markers to display
 * @property {() => void} [onSave] - Callback when save action is triggered
 */

/**
 * Monaco editor component with custom theme and configuration
 * @param {CodeEditorProps} props
 * @returns {import("react").ReactElement}
 */
export function CodeEditor({ path, language, value, onChange, readOnly = false, markers = [], onSave }) {
    const monaco = useMonaco();
    const isDark = useDarkMode();
    const detectedLanguage = language || getLanguageFromPath(path);

    const handleEditorDidMount = (editor, monaco) => {
        editor.addAction({
            id: "myapp.save",
            label: "Save",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            async run() {
                onSave?.();
            },
        });

        const model = editor.getModel();
        if (model) {
            monaco.editor.setModelMarkers(model, "gittyup.custom", markers);
        }
    };

    React.useEffect(() => {
        if (!monaco) return;
        const model = monaco.editor.getModel(monaco.Uri.parse(path));
        if (model) {
            monaco.editor.setModelMarkers(model, "gittyup.custom", markers);
        }
    }, [monaco, markers, path]);

    return html`
        <${Editor}
            height="100%"
            path=${path}
            language=${detectedLanguage}
            value=${value}
            theme=${isDark ? "darkTheme" : "lightTheme"}
            loading=${html`<${Loading} />`}
            onMount=${handleEditorDidMount}
            onChange=${(value) => onChange?.(value || "")}
            options=${{
                minimap: { enabled: false },
                fontSize: 14,
                readOnly,
                renderValidationDecorations: "on",
            }}
        />
    `;
}
