import htm from "htm";
import React from "react";

const html = htm.bind(React.createElement);

export function Loading() {
    return html`<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>`;
}
