const editor = document.getElementById('editor');
const suggestionsContainer = document.getElementById('suggestions');
const headerSelect = document.getElementById('header-select');
const colorPicker = document.getElementById('color-picker');

let debounceTimer;
let selectedIndex = -1;
let currentSuggestions = [];
let lastQuery = '';

// --- Editor Formatting ---

function executeCommand(command, value = null) {
    document.execCommand(command, false, value);
    editor.focus();
}

document.getElementById('bold-btn').onclick = () => executeCommand('bold');
document.getElementById('italic-btn').onclick = () => executeCommand('italic');
document.getElementById('underline-btn').onclick = () => executeCommand('underline');

headerSelect.onchange = () => {
    executeCommand('formatBlock', headerSelect.value);
    headerSelect.value = 'p'; // Reset to default
};

colorPicker.oninput = () => {
    executeCommand('foreColor', colorPicker.value);
};

document.getElementById('clear-btn').onclick = () => {
    if (confirm('Clear entire document?')) {
        editor.innerHTML = '<p><br></p>';
    }
};

document.getElementById('save-btn').onclick = () => {
    const content = editor.innerHTML;
    const blob = new Blob([`<html><body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: auto;">${content}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Kikuyu_Document.html';
    a.click();
    URL.revokeObjectURL(url);
};

// --- Autocomplete Logic ---

editor.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    
    // Get the current word under the cursor
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const textBefore = range.startContainer.textContent.substring(0, range.startOffset);
    const words = textBefore.split(/\s+/);
    const currentWord = words[words.length - 1];
    
    // If space was just pressed
    if (textBefore.endsWith(' ')) {
        const lastWord = words[words.length - 2];
        if (lastWord) fetchPredictions(lastWord);
        return;
    }

    if (currentWord.length < 1) {
        hideSuggestions();
        return;
    }

    debounceTimer = setTimeout(() => {
        fetchSuggestions(currentWord);
    }, 50);
});

editor.addEventListener('keydown', (e) => {
    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
    
    if (suggestionsContainer.style.display === 'block') {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection(items);
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    }
});

async function fetchSuggestions(query) {
    lastQuery = query;
    try {
        const response = await fetch(`/suggest?q=${encodeURIComponent(query)}`);
        const suggestions = await response.json();
        displaySuggestions(suggestions, 'completion');
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

async function fetchPredictions(prevWord) {
    try {
        const response = await fetch(`/predict?prev=${encodeURIComponent(prevWord)}`);
        const predictions = await response.json();
        if (predictions.length > 0) {
            displaySuggestions(predictions, 'prediction');
        } else {
            hideSuggestions();
        }
    } catch (error) {
        console.error('Error fetching predictions:', error);
    }
}

function displaySuggestions(suggestions, type) {
    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }

    suggestionsContainer.innerHTML = '';
    selectedIndex = -1;

    suggestions.forEach((word) => {
        const div = document.createElement('div');
        div.className = `suggestion-item ${type}`;
        div.textContent = word;
        div.onclick = () => applySuggestion(word, type);
        suggestionsContainer.appendChild(div);
    });

    positionSuggestions();
}

function positionSuggestions() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length > 0) {
        const rect = rects[0];
        suggestionsContainer.style.left = `${rect.left}px`;
        suggestionsContainer.style.top = `${rect.bottom + window.scrollY + 5}px`;
        suggestionsContainer.style.display = 'block';
    }
}

function applySuggestion(word, type) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    if (type === 'completion') {
        // Move back to delete the typed fragment
        range.setStart(range.startContainer, range.startOffset - lastQuery.length);
        range.deleteContents();
    }
    
    // Insert the new word
    const textNode = document.createTextNode(word + ' ');
    range.insertNode(textNode);
    
    // Move cursor to end of inserted word
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    hideSuggestions();
    editor.focus();
    
    // Trigger next predictions
    fetchPredictions(word);
}

function updateSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function hideSuggestions() {
    suggestionsContainer.style.display = 'none';
    selectedIndex = -1;
}

// Close on click elsewhere
document.addEventListener('mousedown', (e) => {
    if (!suggestionsContainer.contains(e.target) && e.target !== editor) {
        hideSuggestions();
    }
});
