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

let currentFilename = 'untitled.html';
let fileHandle = null;
const sidebar = document.getElementById('sidebar');
const docList = document.getElementById('doc-list');

document.getElementById('menu-btn').onclick = () => {
    sidebar.classList.toggle('open');
};

document.getElementById('open-file-btn').onclick = async () => {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'Kikuyu Document', accept: { 'text/html': ['.kikdoc'] } }]
        });
        fileHandle = handle;
        const file = await handle.getFile();
        const content = await file.text();
        
        currentFilename = file.name;
        pageContainer.innerHTML = content;
        lastActiveEditor = document.getElementById('page-1');
        updateStats();
        
        // Sync to backend so it appears in sidebar
        saveContent();
        loadDocuments();
    } catch (err) {
        console.error("Open file cancelled or failed", err);
    }
};

document.getElementById('save-as-btn').onclick = async () => {
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: currentFilename.replace('.html', '').replace('.kikdoc', '') + '.kikdoc',
            types: [{ description: 'Kikuyu Document', accept: { 'text/html': ['.kikdoc'] } }]
        });
        fileHandle = handle;
        currentFilename = fileHandle.name;
        await saveToLocal();
        saveContent(); // Sync to server under new name
        loadDocuments(); // Update sidebar list
    } catch (err) {
        console.error("Save As cancelled or failed", err);
    }
};

async function saveToLocal() {
    if (!fileHandle) return;
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(pageContainer.innerHTML);
        await writable.close();
    } catch (err) {
        console.error("Failed to save locally", err);
    }
}

document.getElementById('new-doc-btn').onclick = () => {
    const name = prompt("Enter document name:");
    if (name) {
        let safeName = name.replace('.html', '').replace('.kikdoc', '');
        currentFilename = safeName + '.kikdoc';
        fileHandle = null; // Crucial: disconnect from local file so we don't overwrite it
        pageContainer.innerHTML = `
            <div id="page-1" class="a4-page" contenteditable="true" spellcheck="false" 
                 role="textbox" aria-multiline="true" title="Kikuyu Text Editor"
                 data-gramm="false" data-gramm_editor="false" data-ms-editor="false" translate="no" autocorrect="off" autocapitalize="off" autocomplete="off">
                <h1>Andiaka Gikuyu</h1>
                <p><br></p>
            </div>`;
        lastActiveEditor = document.getElementById('page-1');
        saveContent(); // Will save to backend/documents under new name
        loadDocuments();
    }
};

function loadDocuments() {
    fetch('/api/documents')
        .then(res => res.json())
        .then(files => {
            docList.innerHTML = '';
            files.forEach(file => {
                const div = document.createElement('div');
                div.className = `doc-item ${file === currentFilename ? 'active' : ''}`;
                
                const span = document.createElement('span');
                span.textContent = file;
                span.className = 'doc-title';
                span.onclick = () => openDocument(file);
                
                const delBtn = document.createElement('button');
                delBtn.className = 'doc-delete-btn';
                delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                delBtn.title = "Delete Document";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteDocument(file);
                };
                
                div.appendChild(span);
                div.appendChild(delBtn);
                docList.appendChild(div);
            });
        });
}

function deleteDocument(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}" from the sidebar cache?`)) return;
    
    fetch(`/api/documents/${filename}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (currentFilename === filename) {
                    // Start fresh if they deleted the currently open file
                    currentFilename = 'untitled.kikdoc';
                    fileHandle = null;
                    pageContainer.innerHTML = `
                        <div id="page-1" class="a4-page" contenteditable="true" spellcheck="false" 
                             role="textbox" aria-multiline="true" title="Kikuyu Text Editor">
                            <h1>Andiaka Gikuyu</h1>
                            <p><br></p>
                        </div>`;
                    lastActiveEditor = document.getElementById('page-1');
                    saveContent();
                }
                loadDocuments();
            } else {
                alert("Failed to delete file: " + data.error);
            }
        });
}

function openDocument(filename) {
    fetch(`/api/documents/${filename}`)
        .then(res => res.json())
        .then(data => {
            if (data.content) {
                currentFilename = filename;
                fileHandle = null; // Clear local connection when switching to a server-side file
                pageContainer.innerHTML = data.content;
                lastActiveEditor = document.getElementById('page-1');
                updateStats();
                loadDocuments();
            }
        });
}

// --- Initialization ---
window.onload = () => {
    loadDocuments();
    fetch(`/api/documents/${currentFilename}`)
        .then(res => {
            if(res.ok) {
                res.json().then(data => {
                    if(data.content) {
                        pageContainer.innerHTML = data.content;
                        lastActiveEditor = document.getElementById('page-1');
                        updateStats();
                    }
                });
            }
        });
    
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
                 role="textbox" aria-multiline="true" title="Kikuyu Text Editor"
                 data-gramm="false" data-gramm_editor="false" data-ms-editor="false" translate="no" autocorrect="off" autocapitalize="off" autocomplete="off">
                <h1>Andiaka Gikuyu</h1>
                <p><br></p>
            </div>`;
        lastActiveEditor = document.getElementById('page-1');
        saveContent();
        updateStats();
    }
};

document.getElementById('export-word-btn').onclick = () => {
    const content = pageContainer.innerHTML;
    
    // Show a loading state
    const btn = document.getElementById('export-word-btn');
    const originalText = btn.textContent;
    btn.textContent = "Exporting...";
    
    fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: content })
    })
    .then(res => {
        if (!res.ok) throw new Error("Export failed on server");
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFilename.replace('.html', '').replace('.kikdoc', '') + '.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        btn.textContent = originalText;
    })
    .catch(err => {
        alert("Export failed. Make sure your document formatting is valid.");
        console.error(err);
        btn.textContent = originalText;
    });
};

document.getElementById('save-pdf-btn').onclick = () => {
    // Rely on @media print CSS to generate a perfect PDF layout
    window.print();
};

// --- Autocomplete & Pagination Logic ---

pageContainer.addEventListener('input', (e) => {
    const editor = e.target.closest('.a4-page');
    if (!editor) return;
    lastActiveEditor = editor;

    // Auto-capitalize specific letters typed at the start of a sentence
    if (e.inputType === 'insertText' && e.data && e.data.length === 1 && /[a-z]/.test(e.data)) {
        const textBeforeAll = getTextBeforeCursor();
        const textBefore = textBeforeAll.slice(0, -1).trim();
        if (textBefore.length === 0 || /[.!?]/.test(textBefore.slice(-1))) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
                    // Temporarily select the lowercase letter and overwrite it
                    range.setStart(range.startContainer, range.startOffset - 1);
                    document.execCommand('insertText', false, e.data.toUpperCase());
                    return; // Stop here; the uppercase letter triggers the next events
                }
            }
        }
    }

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

    if (e.data === " " || textBefore.match(/[\s.,!?]$/)) {
        const words = textBefore.trim().split(/[\s.,!?]+/);
        const lastWord = words[words.length - 1];
        if (lastWord) {
            fetchPredictions(lastWord);
            checkAutocorrectAndSpell(lastWord, container, offset - 1);
        }
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
    }, 150);
});

// A4 Pagination Enforcement
function checkPagination(page) {
    if (page.scrollHeight > page.clientHeight && page.clientHeight > 0) {
        let nextPage = page.nextElementSibling;
        if (!nextPage || !nextPage.classList.contains('a4-page')) {
            nextPage = document.createElement('div');
            nextPage.className = 'a4-page';
            nextPage.setAttribute('contenteditable', 'true');
            nextPage.setAttribute('spellcheck', 'false');
            nextPage.setAttribute('data-gramm', 'false');
            nextPage.setAttribute('data-gramm_editor', 'false');
            nextPage.setAttribute('data-ms-editor', 'false');
            nextPage.setAttribute('translate', 'no');
            nextPage.setAttribute('autocorrect', 'off');
            nextPage.setAttribute('autocapitalize', 'off');
            nextPage.setAttribute('autocomplete', 'off');
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

function getTextBeforeCursor() {
    const editor = getEditor();
    if (!editor) return "";
    const selection = window.getSelection();
    if (!selection.rangeCount) return "";
    
    const range = selection.getRangeAt(0);
    // Ensure the cursor is inside the currently active editor
    if (!editor.contains(range.startContainer)) return "";

    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString();
}

function isSentenceStart(queryLength = 0) {
    let textBefore = getTextBeforeCursor();
    // Exclude the current word if we're evaluating autocomplete
    if (textBefore.length >= queryLength) {
        textBefore = textBefore.substring(0, textBefore.length - queryLength).trim();
    }
    
    if (textBefore.length === 0) return true;
    
    // Check if the character right before the word is sentence-terminating
    return /[.!?]/.test(textBefore.slice(-1));
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

    const capitalize = isSentenceStart(lastQuery.length);
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
    const content = pageContainer.innerHTML;
    fetch(`/api/documents/${currentFilename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });
    
    if (fileHandle) {
        saveToLocal();
    }
}

document.addEventListener('mousedown', (e) => {
    const editor = getEditor();
    if (!suggestionsContainer.contains(e.target) && (!editor || !editor.contains(e.target))) {
        hideSuggestions();
    }
});

// --- Spellchecker & Context Menu ---

function saveCaretPosition(context) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(context);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
}

function restoreCaretPosition(context, caretOffset) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(context, 0);
    range.collapse(true);

    const nodeStack = [context];
    let node, foundStart = false, stop = false;
    let charIndex = 0;

    while (!stop && (node = nodeStack.pop())) {
        if (node.nodeType === Node.TEXT_NODE) {
            const nextCharIndex = charIndex + node.length;
            if (!foundStart && caretOffset >= charIndex && caretOffset <= nextCharIndex) {
                range.setStart(node, caretOffset - charIndex);
                foundStart = true;
                stop = true;
            }
            charIndex = nextCharIndex;
        } else {
            let i = node.childNodes.length;
            while (i--) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

function checkAutocorrectAndSpell(word, textNode, endOffset) {
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const cleanWord = word.replace(/[^a-zA-ZĩũĨŨ\']/g, '');
    if (cleanWord.length < 2) return;

    fetch(`/autocorrect?w=${encodeURIComponent(cleanWord)}`)
        .then(res => res.json())
        .then(data => {
            const exactStart = textNode.textContent.lastIndexOf(cleanWord, endOffset);
            if (exactStart === -1) return;
            const editor = getEditor();

            if (data.correction) {
                const savedCaret = saveCaretPosition(editor);
                const range = document.createRange();
                range.setStart(textNode, exactStart);
                range.setEnd(textNode, exactStart + cleanWord.length);
                range.deleteContents();
                
                let replacement = data.correction;
                if (cleanWord.charAt(0) === cleanWord.charAt(0).toUpperCase()) {
                    replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
                }
                
                const newText = document.createTextNode(replacement);
                range.insertNode(newText);
                
                restoreCaretPosition(editor, savedCaret + (replacement.length - cleanWord.length));
            } else {
                checkSpelling(cleanWord, textNode, exactStart, editor);
            }
        }).catch(err => console.error("Autocorrect error", err));
}

function checkSpelling(cleanWord, textNode, exactStart, editor) {
    fetch(`/check_word?w=${encodeURIComponent(cleanWord)}`)
        .then(res => res.json())
        .then(data => {
            if (!data.valid) {
                const savedCaret = saveCaretPosition(editor);
                const range = document.createRange();
                range.setStart(textNode, exactStart);
                range.setEnd(textNode, exactStart + cleanWord.length);
                
                const span = document.createElement('span');
                span.className = 'spell-error';
                span.dataset.word = cleanWord;
                span.textContent = cleanWord;
                
                range.deleteContents();
                range.insertNode(span);
                
                restoreCaretPosition(editor, savedCaret);
            }
        }).catch(err => console.error("Spellcheck error", err));
}

const contextMenu = document.createElement('div');
contextMenu.className = 'custom-context-menu';
contextMenu.innerHTML = `<div class="context-menu-item" id="add-to-dict-btn">Add to Dictionary</div>`;
document.body.appendChild(contextMenu);

let currentSpellNode = null;

document.addEventListener('contextmenu', (e) => {
    if (e.target && e.target.classList.contains('spell-error')) {
        e.preventDefault();
        currentSpellNode = e.target;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.display = 'block';
    } else {
        contextMenu.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
        contextMenu.style.display = 'none';
    }
});

document.getElementById('add-to-dict-btn').addEventListener('click', () => {
    if (currentSpellNode) {
        const word = currentSpellNode.dataset.word;
        fetch('/learn_word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.querySelectorAll(`.spell-error[data-word="${word}"]`).forEach(span => {
                    const textNode = document.createTextNode(span.textContent);
                    span.parentNode.replaceChild(textNode, span);
                });
            }
        });
        contextMenu.style.display = 'none';
    }
});
