/**
 * Simple line-based diffing algorithm.
 * Returns an array of objects representing lines and their status (added, removed, or unchanged).
 */
export const computeDiff = (oldStr, newStr) => {
    if (oldStr === null || oldStr === undefined) oldStr = "";
    if (newStr === null || newStr === undefined) newStr = "";

    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');

    const diff = [];
    let i = 0, j = 0;

    // Simple greedy matching for line-item diffing
    // Note: This is a basic implementation and might not handle complex shifts perfectly,
    // but it's sufficient for comparing iterations of a summary.
    while (i < oldLines.length || j < newLines.length) {
        if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
            diff.push({ type: 'unchanged', text: oldLines[i] });
            i++;
            j++;
        } else {
            // Look ahead to see if there's a match later
            let foundMatch = false;
            for (let k = 1; k < 10; k++) {
                if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
                    // Lines i to i+k-1 were removed
                    for (let m = 0; m < k; m++) {
                        diff.push({ type: 'removed', text: oldLines[i + m] });
                    }
                    i += k;
                    foundMatch = true;
                    break;
                }
                if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
                    // Lines j to j+k-1 were added
                    for (let m = 0; m < k; m++) {
                        diff.push({ type: 'added', text: newLines[j + m] });
                    }
                    j += k;
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                if (i < oldLines.length && j < newLines.length) {
                    diff.push({ type: 'removed', text: oldLines[i] });
                    diff.push({ type: 'added', text: newLines[j] });
                    i++;
                    j++;
                } else if (i < oldLines.length) {
                    diff.push({ type: 'removed', text: oldLines[i] });
                    i++;
                } else if (j < newLines.length) {
                    diff.push({ type: 'added', text: newLines[j] });
                    j++;
                }
            }
        }
    }

    return diff;
};
