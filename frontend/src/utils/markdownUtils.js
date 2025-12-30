/**
 * Utility functions for Markdown formatting in the text editor
 */

/**
 * Applies markdown formatting to the selected text in a textarea
 * 
 * @param {string} command - The formatting command (bold, italic, h2, quote, list, code, hr)
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {string} currentText - The current content of the textarea
 * @param {Function} setText - Callback to update the text state
 * @returns {void}
 */
export const applyMarkdownFormat = (command, textarea, currentText, setText) => {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentText;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    let newText = text;
    let newCursorPos = end;

    switch (command) {
        case 'bold':
            newText = `${before}**${selection}**${after}`;
            newCursorPos = end + 4;
            break;
        case 'italic':
            newText = `${before}*${selection}*${after}`;
            newCursorPos = end + 2;
            break;
        case 'h2':
            newText = `${before}\n## ${selection}${after}`;
            newCursorPos = end + 4;
            break;
        case 'quote':
            newText = `${before}\n> ${selection}${after}`;
            newCursorPos = end + 3;
            break;
        case 'list':
            newText = `${before}\n- ${selection}${after}`;
            newCursorPos = end + 3;
            break;
        case 'code':
            newText = `${before}\`${selection}\`${after}`;
            newCursorPos = end + 2;
            break;
        case 'hr':
            newText = `${before}\n\n---\n\n${after}`;
            newCursorPos = start + 5;
            break;
        default:
            return;
    }

    setText(newText);

    // Defer focus restoration
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
};
