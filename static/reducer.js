import { produce } from "immer";
import { parseAnsiString } from "./ansi.js";

/** @typedef {"disconnected" | "connecting" | "waitingForInit" | "ready"} ConnectionState */

/**
 * @typedef {Object} ConnectingAction
 * @property {"CONNECTING"} type
 * @property {string} repoURL
 * @property {WebSocket} socket
 */

/**
 * @typedef {Object} InitializeAction
 * @property {"INITIALIZE"} type
 * @property {number} currentUserId
 * @property {import("./messages.js").UserMetadata[]} users
 * @property {string[]} files
 * @property {string} repoHash
 * @property {string} commit
 */

/**
 * @typedef {Object} DisconnectedAction
 * @property {"DISCONNECTED"} type
 * @property {string|null} error
 */

/**
 * @typedef {Object} LogAction
 * @property {"LOG"} type
 * @property {import("./ansi.js").TextSegment[]} segments
 */

/**
 * @typedef {Object} SelectFileAction
 * @property {"SELECT_FILE"} type
 * @property {string} path
 */

/**
 * @typedef {Object} RepoStateAction
 * @property {"REPO_STATE"} type
 * @property {string[]} files
 * @property {string} repoHash
 * @property {string} commit
 */

/**
 * @typedef {Object} UserMetadataAction
 * @property {"USER_METADATA"} type
 * @property {number} id
 * @property {Partial<UserMetadata>} metadata
 */

/**
 * @typedef {Object} UserJoinedAction
 * @property {"USER_JOINED"} type
 * @property {UserMetadata} user
 */

/**
 * @typedef {Object} UserLeftAction
 * @property {"USER_LEFT"} type
 * @property {number} id
 */

/**
 * @typedef {Object} ChatMessageAction
 * @property {"CHAT_MESSAGE"} type
 * @property {number} userId
 * @property {string} content
 */

/**
 * @typedef {Object} LLMDeltaAction
 * @property {"LLM_DELTA"} type
 * @property {string} id
 * @property {string} content
 */

/** @typedef {ConnectingAction | InitializeAction | DisconnectedAction | LogAction | SelectFileAction | RepoStateAction | UserMetadataAction | UserJoinedAction | UserLeftAction | ChatMessageAction | LLMDeltaAction} Action */

/**
 * @typedef {import("./messages.js").UserMetadata} UserMetadata
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} [id]
 * @property {import("./ansi.js").TextSegment[]} segments - The message to display as an array of formatted segments
 */

/**
 * @typedef {Object} State
 * @property {ConnectionState} connectionState
 * @property {LogEntry[]} logs
 * @property {string[]} files
 * @property {string|null} selectedFile
 * @property {string|null} repoHash
 * @property {string|null} repoURL
 * @property {string|null} currentCommit
 * @property {string|null} error
 * @property {UserMetadata|null} user
 * @property {Object<number, UserMetadata>} users
 * @property {Object<string, Pick<UserMetadata, "id" | "name">[]>} usersInFiles
 * @property {WebSocket|null} socket
 */

/** @type {State} */
export const initialState = {
    connectionState: "disconnected",
    logs: [],
    files: [],
    selectedFile: null,
    repoHash: null,
    repoURL: null,
    currentCommit: null,
    error: null,
    user: null,
    users: {},
    usersInFiles: {},
    socket: null,
};

// Console message colors using Tailwind classes
/**
 * @type {Record<string, string>}
 */
export const CONSOLE_COLORS = {
    SYSTEM: "text-slate-500 dark:text-slate-400",
    ERROR: "text-red-600 dark:text-red-400",
    WEBCONTAINER: "text-slate-800 dark:text-slate-200 font-mono",
    SOCKET: "text-emerald-600 dark:text-emerald-400",
    CURRENT_USER: "text-cyan-600 dark:text-cyan-400",
};

/** @type {Array<{text: string, bg: string}>} */
const USER_COLORS = [
    {
        text: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-600 dark:bg-blue-600",
    },
    {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-600 dark:bg-amber-600",
    },
    {
        text: "text-pink-600 dark:text-pink-400",
        bg: "bg-pink-600 dark:bg-pink-600",
    },
    {
        text: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-600 dark:bg-teal-600",
    },
    {
        text: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-600 dark:bg-indigo-600",
    },
];

/**
 * Generates a consistent color for a user based on their ID
 * @param {number} userId - The user's ID
 * @param {number|null} currentUserId - The current user's ID
 * @param {"text"|"bg"} [type="text"] - Whether to return text or background color
 * @returns {string} Tailwind color class
 */
export function getUserColor(userId, currentUserId = null, type = "text") {
    if (userId === currentUserId) {
        return CONSOLE_COLORS.CURRENT_USER;
    }

    const colorSet = USER_COLORS[userId % USER_COLORS.length];
    return colorSet[type];
}

/**
 * Creates a log entry with the given message and color.
 * @param {string} message
 * @param {string} color
 * @returns {LogAction}
 */
export function log(message, color) {
    return {
        type: "LOG",
        segments: [{ text: message, classes: color }],
    };
}

/**
 * Creates a log entry from an ANSI string.
 * @param {string} message
 * @returns {LogAction}
 */
export function logFromAnsi(message) {
    return {
        type: "LOG",
        segments: parseAnsiString(message),
    };
}

/**
 * Reducer function to manage state transitions.
 * @param {State} state
 * @param {Action} action
 * @returns {State}
 */
export function reducer(state, action) {
    return produce(state, (/** @type {State} */ draft) => {
        switch (action.type) {
            case "CONNECTING":
                draft.connectionState = "connecting";
                draft.logs.push(log(`Connecting to ${action.repoURL}...`, CONSOLE_COLORS.SOCKET));
                draft.repoURL = action.repoURL;
                draft.error = null;
                draft.socket = action.socket;
                break;

            case "INITIALIZE": {
                draft.connectionState = "ready";
                draft.users = Object.fromEntries(action.users.map((user) => [user.id, user]));
                const currentUser = draft.users[action.currentUserId];
                if (!currentUser) {
                    throw new Error(`Current user ${action.currentUserId} not found in users list`);
                }
                draft.user = currentUser;
                draft.files = action.files;
                draft.repoHash = action.repoHash;
                draft.currentCommit = action.commit;
                draft.logs.push(log(`Connected to repository at commit ${action.commit}`, CONSOLE_COLORS.SYSTEM));
                draft.error = null;
                break;
            }

            case "DISCONNECTED":
                draft.connectionState = "disconnected";
                draft.error = action.error;
                draft.files = [];
                draft.selectedFile = null;
                draft.repoHash = null;
                draft.repoURL = null;
                draft.currentCommit = null;
                draft.user = null;
                draft.users = {};
                draft.socket = null;
                break;

            case "LLM_DELTA": {
                const existingLog = draft.logs.find((log) => log.id === action.id);
                if (existingLog) {
                    existingLog.segments.push({ text: action.content, classes: CONSOLE_COLORS.SYSTEM });
                } else {
                    draft.logs.push({ id: action.id, segments: [{ text: action.content, classes: CONSOLE_COLORS.SYSTEM }] });
                }
                break;
            }

            case "LOG":
                draft.logs.push({ segments: action.segments });
                break;

            case "SELECT_FILE":
                draft.selectedFile = action.path;
                break;

            case "REPO_STATE":
                draft.files = action.files;
                draft.repoHash = action.repoHash;
                draft.currentCommit = action.commit;
                // Clear selected file if it's no longer in the files list
                if (draft.selectedFile && !action.files.includes(draft.selectedFile)) {
                    draft.selectedFile = null;
                }
                break;

            case "USER_METADATA": {
                const existingMetadata = draft.users[action.id];
                if (!existingMetadata) {
                    console.error(`User metadata for ${action.id} not found`);
                    return;
                }
                if (action.metadata.name && action.metadata.name !== existingMetadata.name) {
                    draft.logs.push(log(`${existingMetadata.name} is now known as ${action.metadata.name}`, CONSOLE_COLORS.SYSTEM));
                }
                Object.assign(existingMetadata, action.metadata);
                if (action.id === draft.user?.id) {
                    Object.assign(draft.user, action.metadata);
                }
                break;
            }

            case "USER_JOINED":
                if (draft.users[action.user.id]) {
                    console.error(`User ${action.user.id} already exists in users list`);
                    return;
                }
                draft.users[action.user.id] = action.user;
                console.log("set", action.user, "to", draft.users);
                draft.logs.push(
                    log(`${action.user.name} (id: ${action.user.id}) joined the room`, getUserColor(action.user.id, draft.user?.id || null)),
                );
                break;

            case "USER_LEFT": {
                const leavingUser = draft.users[action.id];
                if (!leavingUser) {
                    console.error(`User ${action.id} not found in users list`);
                    return;
                }
                delete draft.users[action.id];
                draft.logs.push(
                    log(`${leavingUser.name} (id: ${leavingUser.id}) left the room`, getUserColor(leavingUser.id, draft.user?.id || null)),
                );
                break;
            }

            case "CHAT_MESSAGE": {
                const user = draft.users[action.userId];
                if (!user) {
                    console.error(`User ${action.userId} not found in users list`);
                    return;
                }
                draft.logs.push(log(`<${user.name}> ${action.content}`, getUserColor(action.userId, draft.user?.id || null)));
                break;
            }
        }
        console.log(draft.users);
        // Update usersInFiles object based on current users and their active files
        draft.usersInFiles = {};
        for (const userIdString in draft.users) {
            const user = draft.users[userIdString];
            // Skip current user and users without an active file
            if (user.id === draft.user?.id || !user.activeFile) {
                continue;
            }
            const file = user.activeFile;
            const userInfo = {
                id: user.id,
                name: user.name,
            };
            if (!draft.usersInFiles[file]) {
                draft.usersInFiles[file] = [];
            }
            draft.usersInFiles[file].push(userInfo);
        }
    });
}
