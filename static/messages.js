/**
 * @typedef {Object} UserMetadata
 * @property {number} id
 * @property {string} name
 * @property {string} activeFile
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} content
 */

/**
 * @typedef {Object} JoinMessage
 * @property {UserMetadata} user
 */

/**
 * @typedef {Object} LeaveMessage
 */

/**
 * @typedef {Object} LLMDeltaMessage
 * @property {string} id
 * @property {string} content
 */

/**
 * @typedef {Object} UpdateMetadataMessage
 * @property {string} [activeFile]
 * @property {string} [name]
 */

/**
 * @typedef {Object} WelcomeMessage
 * @property {Array<UserMetadata>} users
 * @property {string} repoHash
 * @property {string} currentCommit
 * @property {string[]} files
 */

/**
 * @typedef {Object} BaseEnvelope
 * @property {number} id
 */

/**
 * @typedef {BaseEnvelope & {type: "chat", message: ChatMessage}} ChatEnvelope
 * @typedef {BaseEnvelope & {type: "join", message: JoinMessage}} JoinEnvelope
 * @typedef {BaseEnvelope & {type: "leave", message: LeaveMessage}} LeaveEnvelope
 * @typedef {BaseEnvelope & {type: "llmDelta", message: LLMDeltaMessage}} LLMDeltaEnvelope
 * @typedef {BaseEnvelope & {type: "updateMetadata", message: UpdateMetadataMessage}} UpdateMetadataEnvelope
 * @typedef {BaseEnvelope & {type: "welcome", message: WelcomeMessage}} WelcomeEnvelope
 */

/** @typedef {ChatEnvelope | JoinEnvelope | LeaveEnvelope | LLMDeltaEnvelope | UpdateMetadataEnvelope | WelcomeEnvelope} Envelope */

/**
 * Parses a WebSocket message into a structured Envelope object
 * @param {string} data Raw WebSocket message data
 * @returns {Envelope}
 */
export function parseWebSocketMessage(data) {
    const firstSpace = data.indexOf(" ");
    const secondSpace = data.indexOf(" ", firstSpace + 1);
    return {
        id: Number.parseInt(data.slice(0, firstSpace), 10),
        type: data.slice(firstSpace + 1, secondSpace),
        message: JSON.parse(data.slice(secondSpace + 1)),
    };
}
