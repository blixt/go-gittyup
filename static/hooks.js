import { WebContainer } from "@webcontainer/api";
import { useEffect, useState } from "react";
import { CONSOLE_COLORS, log, logFromAnsi } from "./reducer.js";

/** @typedef {import("./reducer.js").State} State */

// Create a cache outside the hook to persist across renders
/** @type {Map<string, string>} */
const fileContentCache = new Map();
/** @type {Map<string, Promise<string>>} */
const pendingFetches = new Map();

/**
 * Shared function to fetch file content with caching and request deduplication
 * @param {string} repoHash - Repository hash
 * @param {string} commit - Commit hash
 * @param {string} path - File path
 * @returns {Promise<string>} File contents
 */
export async function fetchFileContent(repoHash, commit, path) {
    const cacheKey = `${repoHash}/${commit}/${path}`;

    const cachedContent = fileContentCache.get(cacheKey);
    if (typeof cachedContent === "string") {
        return cachedContent;
    }

    const pendingFetch = pendingFetches.get(cacheKey);
    if (pendingFetch) {
        return pendingFetch;
    }

    const fetchPromise = fetch(`/v1/file/${repoHash}/${commit}/${path}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then((content) => {
            fileContentCache.set(cacheKey, content);
            pendingFetches.delete(cacheKey);
            return content;
        })
        .catch((error) => {
            pendingFetches.delete(cacheKey);
            throw error;
        });

    pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
}

/**
 * @typedef {Object} WebContainerFileContent
 * @property {string} contents - The contents of the file
 *
 * @typedef {Object} WebContainerFile
 * @property {WebContainerFileContent} file - File metadata and contents
 *
 * @typedef {Object} WebContainerDirectory
 * @property {Record<string, WebContainerFile | WebContainerDirectoryWrapper>} directory - Directory contents
 *
 * @typedef {Object} WebContainerDirectoryWrapper
 * @property {Record<string, WebContainerFile | WebContainerDirectoryWrapper>} directory - Nested directory structure
 *
 * @typedef {Record<string, WebContainerFile | WebContainerDirectoryWrapper>} WebContainerFileSystem
 */

/**
 * Creates a WebContainer file system structure from a list of paths and their contents
 * @param {string} repoHash - Repository hash
 * @param {string} commit - Commit hash
 * @param {string[]} paths - List of file paths
 * @returns {Promise<WebContainerFileSystem>} WebContainer-compatible file system structure
 */
async function createFileSystem(repoHash, commit, paths) {
    /** @type {WebContainerFileSystem} */
    const files = {};

    for (const path of paths) {
        const parts = path.split("/");
        /** @type {Record<string, any>} */
        let current = files;

        // Create directory structure
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = { directory: {} };
            }
            current = current[part].directory;
        }

        // Add file with contents
        const fileName = parts[parts.length - 1];
        try {
            const contents = await fetchFileContent(repoHash, commit, path);
            current[fileName] = { file: { contents } };
        } catch (error) {
            console.error(`Failed to load file ${path}:`, error);
            current[fileName] = {
                file: {
                    contents: `// Error loading file: ${error.message}`,
                },
            };
        }
    }

    return files;
}

/**
 * Hook to manage WebContainer instance and file system
 * @param {import("./reducer.js").State} state - Application state
 * @param {(action: import("./reducer.js").Action) => void} dispatch - Dispatch function
 * @param {React.RefObject<HTMLIFrameElement>} iframeRef - Ref for preview iframe
 */
export function useWebContainer(state, dispatch, iframeRef) {
    useEffect(() => {
        const connectionState = state.connectionState;
        const repoHash = state.repoHash;
        const currentCommit = state.currentCommit;
        const files = state.files;
        if (connectionState !== "ready" || !repoHash || !currentCommit || !files.length) {
            return;
        }

        /** @type {WebContainer|null} */
        let container = null;
        /** @type {AbortController|null} */
        let abortController = new AbortController();

        const initWebContainer = async () => {
            try {
                // Start both tasks in parallel
                dispatch(log("Loading files and booting WebContainer...", CONSOLE_COLORS.WEBCONTAINER));
                const fsPromise = createFileSystem(repoHash, currentCommit, files).then((fs) => {
                    dispatch(log("Files loaded successfully", CONSOLE_COLORS.WEBCONTAINER));
                    return fs;
                });
                container = await WebContainer.boot();
                container.on("output", async (data) => {
                    dispatch(log(data.toString(), CONSOLE_COLORS.WEBCONTAINER));
                });
                dispatch(log("WebContainer booted successfully", CONSOLE_COLORS.WEBCONTAINER));
                const fs = await fsPromise;

                // Check if we've been cleaned up while waiting
                if (!abortController || abortController.signal.aborted) {
                    return;
                }

                dispatch(log("Mounting files...", CONSOLE_COLORS.WEBCONTAINER));
                await container.mount(fs);
                dispatch(log("Files mounted successfully", CONSOLE_COLORS.WEBCONTAINER));

                // Check for package.json and install dependencies.
                if (files.includes("package.json")) {
                    dispatch(log("Installing dependencies...", CONSOLE_COLORS.WEBCONTAINER));
                    const installProcess = await container.spawn("npm", ["install"]);
                    const installExit = await installProcess.exit;

                    if (installExit !== 0) {
                        throw new Error(`npm install failed with exit code ${installExit}`);
                    }
                    dispatch(log("Dependencies installed successfully", CONSOLE_COLORS.WEBCONTAINER));
                }

                // Check for Vite config.
                if (files.includes("vite.config.js") || files.includes("vite.config.ts")) {
                    dispatch(log("Starting Vite dev server...", CONSOLE_COLORS.WEBCONTAINER));
                    const startProcess = await container.spawn("npm", ["run", "dev"]);

                    // Wait for the server to start
                    startProcess.output.pipeTo(
                        new WritableStream({
                            write(data) {
                                dispatch(logFromAnsi(data.toString()));
                            },
                        }),
                    );
                }

                container.on("server-ready", (port, url) => {
                    if (!iframeRef.current) {
                        throw new Error("No iframe ref");
                    }
                    iframeRef.current.src = url;
                });
            } catch (error) {
                if (!abortController || abortController.signal.aborted) {
                    return;
                }
                dispatch(log(`WebContainer error: ${error.message}`, CONSOLE_COLORS.ERROR));
                console.error("WebContainer error:", error);
            }
        };

        initWebContainer();

        return () => {
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
            container = null;
        };
    }, [state.connectionState, state.files, state.repoHash, state.currentCommit, dispatch, iframeRef]);
}

/**
 * @typedef {Object} FileContentState
 * @property {string} path - The path of the file
 * @property {string} content - The content of the file
 * @property {boolean} isLoading - Whether the file is currently being loaded
 */

/**
 * Custom hook to fetch and manage file content from a repository.
 * @param {string|null} repoHash - The hash/identifier of the repository
 * @param {string|null} commit - The commit hash
 * @param {string|null} path - The file path within the repository
 * @returns {FileContentState} Object containing path, content, and loading state
 */
export function useFileContent(repoHash, commit, path) {
    const [state, setState] = useState({ path: "", content: "", isLoading: false });

    useEffect(() => {
        let active = true;

        if (!path || !commit || !repoHash) {
            setState({ path: "", content: "", isLoading: false });
            return;
        }

        setState({ path, content: "", isLoading: true });

        fetchFileContent(repoHash, commit, path)
            .then((content) => {
                if (!active) return;
                setState({ path, content, isLoading: false });
            })
            .catch((error) => {
                if (!active) return;
                const errorContent = `// Error loading ${path}\n// ${error.message}`;
                setState({ path, content: errorContent, isLoading: false });
            });

        return () => {
            active = false;
        };
    }, [repoHash, path, commit]);

    return state;
}

export function clearFileContentCache() {
    fileContentCache.clear();
    pendingFetches.clear();
}
