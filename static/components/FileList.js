import htm from "htm";
import {
    File,
    FileArchive,
    FileAudio2,
    FileBox,
    FileChartPie,
    FileCheck2,
    FileClock,
    FileCode2,
    FileCog,
    FileDiff,
    FileImage,
    FileJson2,
    FileKey2,
    FileLock2,
    FileTerminal,
    FileText,
    FileType2,
    FileVideo2,
    Folder,
    FolderOpen,
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { getUserColor } from "../reducer.js";

const html = htm.bind(React.createElement);

/**
 * @typedef FileListProps
 * @property {string[]} files - Array of file names to display
 * @property {string} selectedFile - Currently selected file name
 * @property {(file: string) => void} onFileSelect - Callback function when a file is selected
 * @property {Object<string, Pick<import("../messages.js").UserMetadata, "id" | "name">[]>} usersInFiles - Map of file paths to users in the file
 */

/**
 * @typedef {Object} FileTreeItem
 * @property {string} [path] - If this is a file node, contains the full file path
 * @property {Object.<string, FileTreeItem>} [children] - If this is a folder node, contains child items
 * @property {Function} [icon] - The icon component to use for this file
 */

/**
 * @typedef FileTreeItemProps
 * @property {string} name - Name of the file or folder
 * @property {FileTreeItem} item - The file or folder node
 * @property {number} [level] - Indentation level (default: 0)
 * @property {string} selectedFile - Currently selected file path
 * @property {(file: string) => void} onFileSelect - Callback when a file is selected
 * @property {Object<string, Pick<import("../messages.js").UserMetadata, "id" | "name">[]>} usersInFiles - Map of file paths to users in the file
 * @property {Set<string>} openFolders - Set of folder paths that are currently open
 * @property {(folders: Set<string>) => void} setOpenFolders - Callback to update open folders
 */

/**
 * Type guard to check if a node is a folder
 * @param {FileTreeItem} node - Node to check
 * @returns {boolean} - True if the node is a folder
 */
function isFolder(node) {
    return node.children !== undefined;
}

/**
 * Type guard to check if a node is a file
 * @param {FileTreeItem} node - Node to check
 * @returns {boolean} - True if the node is a file
 */
function isFile(node) {
    return node.path !== undefined;
}

/**
 * Checks if a path matches a specific filename
 * @param {string} path - Full path to check
 * @param {string} filename - Filename to match against
 * @returns {boolean} - True if the path ends with the filename
 */
function isFilename(path, filename) {
    return path === filename || path.endsWith(`/${filename}`);
}

/**
 * Checks if a folder node only contains a single subfolder
 * @param {Object.<string, FileTreeItem>} node - Folder node to check
 * @returns {boolean} - True if the folder only contains one subfolder
 */
function isSingleFolderPath(node) {
    const entries = Object.entries(node);
    return entries.length === 1 && isFolder(entries[0][1]);
}

/**
 * Gets the single subfolder entry from a folder node
 * @param {Object.<string, FileTreeItem>} node - Folder node to get subfolder from
 * @returns {[string, FileTreeItem] | null} - Tuple of [name, node] or null if invalid
 */
function getSingleSubfolder(node) {
    if (!isSingleFolderPath(node)) return null;
    const entries = Object.entries(node);
    return entries[0];
}

// Helper function to determine which icon to use based on file extension
function getFileIcon(path) {
    // Package/Module files
    if (
        isFilename(path, "cargo.toml") ||
        isFilename(path, "composer.json") ||
        isFilename(path, "Gemfile") ||
        isFilename(path, "go.mod") ||
        isFilename(path, "package.json") ||
        isFilename(path, "requirements.txt") ||
        isFilename(path, "setup.py")
    ) {
        return FileBox;
    }

    // Lock files
    if (
        isFilename(path, "bun.lockb") ||
        isFilename(path, "cargo.lock") ||
        isFilename(path, "composer.lock") ||
        isFilename(path, "Gemfile.lock") ||
        isFilename(path, "go.sum") ||
        isFilename(path, "package-lock.json") ||
        isFilename(path, "pnpm-lock.yaml") ||
        isFilename(path, "yarn.lock")
    ) {
        return FileLock2;
    }

    // Config files
    if (
        isFilename(path, ".dockerignore") ||
        isFilename(path, ".editorconfig") ||
        isFilename(path, ".env") ||
        isFilename(path, ".env.example") ||
        isFilename(path, ".env.local") ||
        isFilename(path, ".eslintignore") ||
        isFilename(path, ".eslintrc") ||
        isFilename(path, ".gitignore") ||
        isFilename(path, ".htaccess") ||
        isFilename(path, ".npmrc") ||
        isFilename(path, ".prettierrc") ||
        isFilename(path, ".yarnrc.yml") ||
        isFilename(path, "babel.config.js") ||
        isFilename(path, "jest.config.js") ||
        isFilename(path, "nginx.conf") ||
        isFilename(path, "tsconfig.json") ||
        isFilename(path, "vite.config.js") ||
        isFilename(path, "webpack.config.js")
    ) {
        return FileCog;
    }

    // Terminal/Docker related files
    if (
        isFilename(path, "docker-compose.yaml") ||
        isFilename(path, "docker-compose.yml") ||
        isFilename(path, "Dockerfile") ||
        isFilename(path, "Makefile") ||
        isFilename(path, "Procfile")
    ) {
        return FileTerminal;
    }

    // Changelog files
    if (
        isFilename(path, "CHANGELOG.md") ||
        isFilename(path, "CHANGES.md") ||
        isFilename(path, "HISTORY.md") ||
        path.toLowerCase().includes("changelog")
    ) {
        return FileClock;
    }

    // License and legal files
    if (
        isFilename(path, "COPYING") ||
        isFilename(path, "LICENSE") ||
        isFilename(path, "LICENSE.md") ||
        isFilename(path, "LICENSE.txt") ||
        isFilename(path, "PATENTS")
    ) {
        return FileCheck2;
    }

    const ext = path.split(".").pop().toLowerCase();
    switch (ext) {
        // Audio files
        case "aac":
        case "flac":
        case "m4a":
        case "mp3":
        case "ogg":
        case "wav":
        case "wma":
            return FileAudio2;

        // Video files
        case "avi":
        case "flv":
        case "mkv":
        case "mov":
        case "mp4":
        case "webm":
        case "wmv":
            return FileVideo2;

        // Image files
        case "bmp":
        case "gif":
        case "ico":
        case "jpeg":
        case "jpg":
        case "png":
        case "svg":
        case "tiff":
        case "webp":
            return FileImage;

        // Archive files
        case "7z":
        case "bz2":
        case "gz":
        case "rar":
        case "tar":
        case "tgz":
        case "xz":
        case "zip":
            return FileArchive;

        // Data/Chart files
        case "csv":
        case "numbers":
        case "xls":
        case "xlsx":
            return FileChartPie;

        // Key/Certificate files
        case "cer":
        case "crt":
        case "key":
        case "p12":
        case "pem":
        case "pfx":
        case "pub":
            return FileKey2;

        // Diff/Patch files
        case "diff":
        case "patch":
            return FileDiff;

        // Terminal/Shell scripts
        case "bash":
        case "bat":
        case "cmd":
        case "fish":
        case "ps1":
        case "sh":
        case "zsh":
            return FileTerminal;

        // JSON files
        case "geojson":
        case "json":
        case "jsonc":
            return FileJson2;

        // Code files
        case "c":
        case "cpp":
        case "cs":
        case "go":
        case "h":
        case "hpp":
        case "java":
        case "js":
        case "jsx":
        case "kt":
        case "php":
        case "py":
        case "rb":
        case "rs":
        case "swift":
        case "ts":
        case "tsx":
            return FileCode2;

        // Text/Documentation files
        case "doc":
        case "docx":
        case "htm":
        case "html":
        case "md":
        case "org":
        case "pdf":
        case "rtf":
        case "txt":
            return FileText;

        // Style files
        case "css":
        case "less":
        case "postcss":
        case "sass":
        case "scss":
        case "styl":
            return FileType2;

        // Config files
        case "cfg":
        case "conf":
        case "config":
        case "env":
        case "ini":
        case "prop":
        case "properties":
        case "toml":
        case "yaml":
        case "yml":
            return FileCog;

        default:
            return File;
    }
}

/**
 * Converts a flat array of paths into a sorted tree structure
 * @param {string[]} files - Array of file paths
 * @returns {Object.<string, FileTreeItem>} Tree structure of files and folders
 */
function buildFileTree(files) {
    /** @type {Object.<string, FileTreeItem>} */
    const root = {};

    // First build the tree
    for (const path of files) {
        const parts = path.split("/");
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLastPart = i === parts.length - 1;

            if (isLastPart) {
                // Include the icon component when creating file nodes
                current[part] = {
                    path,
                    icon: getFileIcon(path),
                };
            } else {
                current[part] = current[part] || { children: {} };
                current = current[part].children || {};
            }
        }
    }

    // Helper function to sort a tree node's children
    function sortTreeNode(node) {
        if (!node) return node;

        if (isFile(node)) return node;

        if (node.children) {
            const sortedEntries = Object.entries(node.children).sort(([aName, aNode], [bName, bNode]) => {
                const aIsFolder = isFolder(aNode);
                const bIsFolder = isFolder(bNode);

                if (aIsFolder !== bIsFolder) {
                    return aIsFolder ? -1 : 1;
                }
                return aName.toLowerCase().localeCompare(bName.toLowerCase());
            });

            // Create new sorted children object
            const sortedChildren = {};
            for (const [name, childNode] of sortedEntries) {
                sortedChildren[name] = sortTreeNode(childNode);
            }
            node.children = sortedChildren;
        }

        return node;
    }

    // Sort the entire tree
    return sortTreeNode({ children: root }).children || {};
}

/**
 * @typedef UserCircleProps
 * @property {string} name - User's name
 * @property {string} color - Tailwind color class
 * @property {number} index - Position index for overlap
 */

/**
 * Renders a circular avatar with user's first letter
 * @param {UserCircleProps} props
 */
function UserCircle({ name, color, index }) {
    return html`
        <div
            className=${`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white dark:text-white ${color} ring-2 ring-white dark:ring-slate-800`}
            style=${{
                position: "absolute",
                right: `${index * 16}px`,
                zIndex: 10 - index,
            }}
        >
            ${name[0].toUpperCase()}
        </div>
    `;
}

/**
 * Renders a file or folder item
 * @param {FileTreeItemProps} props
 * @returns {React.ReactElement}
 */
function FileTreeItem({ name, item, level = 0, selectedFile, onFileSelect, openFolders, setOpenFolders, usersInFiles }) {
    const isOpen = openFolders.has(name);

    if (isFolder(item)) {
        // Handle single folder paths
        const singleSubfolder = getSingleSubfolder(item.children || {});
        if (singleSubfolder) {
            const [subName, subItem] = singleSubfolder;
            return html`<${FileTreeItem}
                name=${`${name}/${subName}`}
                item=${subItem}
                level=${level}
                selectedFile=${selectedFile}
                onFileSelect=${onFileSelect}
                openFolders=${openFolders}
                setOpenFolders=${setOpenFolders}
                usersInFiles=${usersInFiles}
            />`;
        }

        return html`
            <div>
                <button
                    onClick=${() => {
                        const newFolders = new Set(openFolders);
                        if (isOpen) {
                            newFolders.delete(name);
                        } else {
                            newFolders.add(name);
                        }
                        setOpenFolders(newFolders);
                    }}
                    className=${`w-full text-left px-2 py-1 text-sm rounded flex items-center gap-2
                        hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold`}
                    style=${{ paddingLeft: `${level * 16 + 8}px` }}
                >
                    <${isOpen ? FolderOpen : Folder} size=${16} />
                    ${name.split("/").pop()}
                </button>
                ${
                    isOpen
                        ? html`
                    <div className="space-y-1">
                        ${Object.entries(item.children || {}).map(
                            ([childName, childItem]) => html`<${FileTreeItem}
                                key=${childName}
                                name=${childName}
                                item=${childItem}
                                level=${level + 1}
                                selectedFile=${selectedFile}
                                onFileSelect=${onFileSelect}
                                openFolders=${openFolders}
                                setOpenFolders=${setOpenFolders}
                                usersInFiles=${usersInFiles}
                            />`,
                        )}
                    </div>
                `
                        : null
                }
            </div>
        `;
    }

    // For file nodes, use the pre-calculated icon
    const Icon = item.icon || File; // Fallback to File if icon somehow missing
    const usersInFile = item.path ? usersInFiles[item.path] || [] : [];
    return html`
        <div className="relative flex items-center">
            <button
                onClick=${() => item.path && onFileSelect(item.path)}
                className=${`w-full text-left px-2 py-1 text-sm rounded flex items-center gap-2 ${
                    selectedFile === item.path
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
                style=${{ paddingLeft: `${level * 16 + 8}px` }}
            >
                <${Icon} size=${16} />
                ${name}
            </button>
            <div
                className="absolute right-2 flex items-center"
                style=${{
                    // Add padding to accommodate overlapping circles
                    paddingRight: `${Math.max(0, (usersInFile.length - 1) * 16)}px`,
                }}
            >
                ${usersInFile.map(
                    (user, index) => html`
                    <${UserCircle}
                        key=${user.id}
                        name=${user.name}
                        color=${getUserColor(user.id, null, "bg")}
                        index=${index}
                    />
                `,
                )}
            </div>
        </div>
    `;
}

/**
 * Renders a hierarchical list of files with collapsible folders
 * @param {FileListProps} props
 * @returns {React.ReactElement}
 */
export function FileList({ files, selectedFile, onFileSelect, usersInFiles }) {
    const [openFolders, setOpenFolders] = useState(new Set());
    const fileTree = useMemo(() => buildFileTree(files), [files]);

    return html`
        <div className="p-4">
            <h2 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Files</h2>
            <div className="space-y-1">
                ${Object.entries(fileTree).map(
                    ([name, item]) => html`
                    <${FileTreeItem}
                        key=${name}
                        name=${name}
                        item=${item}
                        selectedFile=${selectedFile}
                        onFileSelect=${onFileSelect}
                        openFolders=${openFolders}
                        setOpenFolders=${setOpenFolders}
                        usersInFiles=${usersInFiles}
                    />
                `,
                )}
            </div>
        </div>
    `;
}
