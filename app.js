const pageContainer = document.getElementById('page-container');
const suggestionsContainer = document.getElementById('suggestions');
const headerSelect = document.getElementById('header-select');
const colorPicker = document.getElementById('color-picker');
const wordCountDisplay = document.getElementById('word-count');
const charCountDisplay = document.getElementById('char-count');
const pageCountDisplay = document.getElementById('page-count');

let debounceTimer;
let selectedIndex = -1;
let currentSuggestions = [];
let lastQuery = '';

let lastActiveEditor = document.getElementById('page-1');

function getEditor() {
    const active = document.activeElement;
    if (active && active.classList.contains('a4-page')) {
        lastActiveEditor = active;
        return active;
    }
    return lastActiveEditor || document.querySelector('.a4-page');
}

// --- Initialization ---
window.onload = () => {
    loadSavedContent();
    updateStats();
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
    }
};

// --- Editor Formatting ---
function executeCommand(command, value = null) {
    document.execCommand(command, false, value);
    const ed = getEditor();
    if (ed) ed.focus();
    updateStats();
}

document.getElementById('bold-btn').onclick = () => executeCommand('bold');
document.getElementById('italic-btn').onclick = () => executeCommand('italic');
document.getElementById('underline-btn').onclick = () => executeCommand('underline');

headerSelect.onchange = () => {
    executeCommand('formatBlock', headerSelect.value);
    headerSelect.value = 'p';
};

colorPicker.oninput = () => {
    executeCommand('foreColor', colorPicker.value);
};

document.getElementById('theme-btn').onclick = () => {
    document.body.classList.toggle('dark-mode');
};

document.getElementById('clear-btn').onclick = () => {
    if (confirm('Clear entire document?')) {
        pageContainer.innerHTML = `
            <div id="page-1" class="a4-page" contenteditable="true" spellcheck="false" 
                 role="textbox" aria-multiline="true" title="Kikuyu Text Editor">
                <h1>Mũratatara wa Gĩkũyũ</h1>
                <p><br></p>
            </div>`;
        lastActiveEditor = document.getElementById('page-1');
        saveContent();
        updateStats();
    }
};

document.getElementById('save-btn').onclick = () => {
    let fullContent = "";
    document.querySelectorAll('.a4-page').forEach(page => {
        fullContent += page.innerHTML;
    });
    const blob = new Blob([`<html><body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: auto;">${fullContent}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Kikuyu_Document.html';
    a.click();
    URL.revokeObjectURL(url);
};

// --- Autocomplete & Pagination Logic ---

pageContainer.addEventListener('input', (e) => {
    const editor = e.target.closest('.a4-page');
    if (!editor) return;
    lastActiveEditor = editor;

    // A4 Pagination Engine
    checkPagination(editor);

    clearTimeout(debounceTimer);
    updateStats();
    saveContent();
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const offset = range.startOffset;

    let textBefore = "";
    if (container.nodeType === Node.TEXT_NODE) {
        textBefore = container.textContent.substring(0, offset);
    }

    if (e.data === " " || textBefore.endsWith(" ")) {
        const words = textBefore.trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        if (lastWord) fetchPredictions(lastWord);
        else hideSuggestions();
        return;
    }

    const words = textBefore.split(/\s+/);
    const currentWord = words[words.length - 1];

    if (currentWord.length < 1) {
        hideSuggestions();
        return;
    }

    debounceTimer = setTimeout(() => {
        fetchSuggestions(currentWord);
    }, 50);
});

// A4 Pagination Enforcement
function checkPagination(page) {
    if (page.scrollHeight > page.clientHeight && page.clientHeight > 0) {
        let nextPage = page.nextElementSibling;
        if (!nextPage || !nextPage.classList.contains('a4-page')) {
            nextPage = document.createElement('div');
            nextPage.className = 'a4-page';
            nextPage.contentEditable = true;
            nextPage.spellcheck = false;
            page.parentNode.insertBefore(nextPage, page.nextSibling);
        }
        
        let movedFocus = false;
        const sel = window.getSelection();
        const activeNode = sel.anchorNode;

        while (page.scrollHeight > page.clientHeight && page.lastChild) {
            const nodeToMove = page.lastChild;
            if (activeNode && (nodeToMove === activeNode || nodeToMove.contains(activeNode))) {
                movedFocus = true;
            }
            if (nextPage.firstChild) {
                nextPage.insertBefore(nodeToMove, nextPage.firstChild);
            } else {
                nextPage.appendChild(nodeToMove);
            }
        }

        if (movedFocus) {
            // Restore selection caret
            const newRange = document.createRange();
            newRange.selectNodeContents(nextPage);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            nextPage.focus();
        }
    }
}

function isAtStartOfNode(parent, node) {
    let current = node;
    while(current && current !== parent) {
        if (current.previousSibling) return false;
        current = current.parentNode;
    }
    return true;
}

pageContainer.addEventListener('keydown', (e) => {
    const editor = e.target.closest('.a4-page');
    if (!editor) return;
    
    // Page Merge Logic
    if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (range.startOffset === 0 && range.endOffset === 0 && isAtStartOfNode(editor, range.startContainer)) {
                const prevPage = editor.previousElementSibling;
                if (prevPage && prevPage.classList.contains('a4-page')) {
                    e.preventDefault();
                    
                    const newRange = document.createRange();
                    newRange.selectNodeContents(prevPage);
                    newRange.collapse(false); // end of prev page
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    
                    while (editor.firstChild) {
                        prevPage.appendChild(editor.firstChild);
                    }
                    editor.remove();
                    prevPage.focus();
                    checkPagination(prevPage);
                    return;
                }
            }
        }
    }

    // Autocomplete Navigation
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

function isSentenceStart() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    
    const editor = getEditor();
    if (!editor) return false;

    const textSoFar = editor.innerText.substring(0, editor.innerText.length - lastQuery.length).trim();
    if (textSoFar.length === 0) return true;
    
    const lastChar = textSoFar[textSoFar.length - 1];
    return /[.!?]/.test(lastChar);
}

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

    const capitalize = isSentenceStart();
    const processedSuggestions = suggestions.map(s => 
        capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s
    );

    suggestionsContainer.innerHTML = '';
    selectedIndex = 0; 
    currentSuggestions = processedSuggestions;

    processedSuggestions.forEach((word, index) => {
        const div = document.createElement('div');
        div.className = `suggestion-item ${type} ${index === 0 ? 'selected' : ''}`;
        div.textContent = word;
        div.role = "option";
        div.id = `suggestion-${index}`;
        div.onclick = (e) => {
            e.preventDefault();
            applySuggestion(word, type);
        };
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
    const editor = getEditor();
    if (!editor) return;

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    if (type === 'completion') {
        const container = range.startContainer;
        if (container.nodeType === Node.TEXT_NODE) {
            range.setStart(container, Math.max(0, range.startOffset - lastQuery.length));
            range.deleteContents();
        }
    }
    
    const textNode = document.createTextNode(word + ' ');
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    hideSuggestions();
    editor.focus();
    updateStats();
    saveContent();
    
    fetchPredictions(word);
}

function updateSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function hideSuggestions() {
    suggestionsContainer.style.display = 'none';
    suggestionsContainer.innerHTML = '';
    selectedIndex = -1;
}

function updateStats() {
    let charCount = 0;
    let wordCount = 0;
    const pages = document.querySelectorAll('.a4-page');
    
    pages.forEach(page => {
        const text = page.innerText || "";
        charCount += text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        wordCount += words.length;
    });

    wordCountDisplay.textContent = `${wordCount} words`;
    charCountDisplay.textContent = `${charCount} characters`;

    if (pageCountDisplay) {
        pageCountDisplay.textContent = pages.length === 1 ? '1 Page' : `${pages.length} Pages`;
    }
}

function saveContent() {
    let content = "";
    document.querySelectorAll('.a4-page').forEach(page => {
        content += page.innerHTML + "<!-- PAGE_BREAK -->";
    });
    localStorage.setItem('kikuyu_docs_content', content);
}

function loadSavedContent() {
    const saved = localStorage.getItem('kikuyu_docs_content');
    if (saved) {
        const parts = saved.split("<!-- PAGE_BREAK -->").filter(p => p.trim() !== "");
        if (parts.length > 0) {
           pageContainer.innerHTML = '';
           parts.forEach((p, idx) => {
               const div = document.createElement('div');
               div.id = `page-${idx+1}`;
               div.className = 'a4-page';
               div.contentEditable = true;
               div.innerHTML = p;
               pageContainer.appendChild(div);
           });
           lastActiveEditor = document.getElementById('page-1');
        }
    }
}

document.addEventListener('mousedown', (e) => {
    const editor = getEditor();
    if (!suggestionsContainer.contains(e.target) && (!editor || !editor.contains(e.target))) {
        hideSuggestions();
    }
});
