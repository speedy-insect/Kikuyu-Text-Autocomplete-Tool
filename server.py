from flask import Flask, request, jsonify, send_from_directory
import msgpack
import os
import sys
from functools import lru_cache
import re

# Ensure UTF-8
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

app = Flask(__name__, static_folder='frontend')

def normalize_kikuyu(text):
    if not isinstance(text, str): return ""
    text = text.lower()
    text = text.replace('ĩ', 'i').replace('ũ', 'u')
    return text

class TrieNode:
    def __init__(self):
        self.children = {}
        self.actual_words = {}  
        self.max_freq_in_subtree = 0  

    @staticmethod
    def from_dict(d):
        node = TrieNode()
        node.actual_words = d['w']
        node.max_freq_in_subtree = d['m']
        for char, child_dict in d['c'].items():
            node.children[char] = TrieNode.from_dict(child_dict)
        return node

class KikuyuTrie:
    def __init__(self):
        self.root = TrieNode()

    @staticmethod
    def load(file_path):
        with open(file_path, 'rb') as f:
            data = msgpack.unpack(f, raw=False)
        trie = KikuyuTrie()
        trie.root = TrieNode.from_dict(data)
        return trie

    def insert(self, word):
        norm_word = normalize_kikuyu(word)
        node = self.root
        for char in norm_word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        if word not in node.actual_words:
            node.actual_words[word] = 1

    def contains(self, word):
        norm_word = normalize_kikuyu(word)
        node = self.root
        for char in norm_word:
            if char not in node.children: return False
            node = node.children[char]
        return len(node.actual_words) > 0

    def autocorrect(self, word):
        norm_word = normalize_kikuyu(word)
        node = self.root
        for char in norm_word:
            if char not in node.children: return None
            node = node.children[char]
        if not node.actual_words: return None
        if word in node.actual_words: return None
        best_word = max(node.actual_words.items(), key=lambda x: x[1])[0]
        if best_word == word: return None
        return best_word

    @lru_cache(maxsize=2048)
    def search(self, prefix, top_n=5):
        norm_prefix = normalize_kikuyu(prefix)
        node = self.root
        for char in norm_prefix:
            if char not in node.children: return []
            node = node.children[char]
        
        results = []
        self._dfs(node, results)
        results.sort(key=lambda x: x[1], reverse=True)
        return [word for word, freq in results[:top_n]]

    def _dfs(self, node, results):
        if node.actual_words:
            results.extend(list(node.actual_words.items()))
        for char, child_node in node.children.items():
            self._dfs(child_node, results)

# Load the models locally from the models/ folder
BASE_DIR = os.path.dirname(__file__)
TRIE_PATH = os.path.join(BASE_DIR, 'models', 'kikuyu_trie.msgpack')
BIGRAM_PATH = os.path.join(BASE_DIR, 'models', 'kikuyu_bigrams.msgpack')
USER_DICT_PATH = os.path.join(BASE_DIR, 'user_dictionary.txt')

print("Loading Kikuyu Autocomplete Models...")
trie = KikuyuTrie.load(TRIE_PATH)

if os.path.exists(USER_DICT_PATH):
    print("Loading user dictionary...")
    with open(USER_DICT_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            w = line.strip()
            if w: trie.insert(w)

with open(BIGRAM_PATH, 'rb') as f:
    bigrams = msgpack.unpack(f, raw=False)
print("Standalone Web Server Ready.")

@app.route('/suggest', methods=['GET'])
def suggest():
    query = request.args.get('q', '').lower()
    if not query: return jsonify([])
    return jsonify(trie.search(query, top_n=5))

@app.route('/check_word', methods=['GET'])
def check_word():
    word = request.args.get('w', '').strip()
    if not word: return jsonify({"valid": True})
    if re.match(r'^[\d\W_]+$', word):
        return jsonify({"valid": True})
    return jsonify({"valid": trie.contains(word)})

@app.route('/learn_word', methods=['POST'])
def learn_word():
    data = request.get_json()
    if not data or 'word' not in data:
        return jsonify({"success": False}), 400
    
    word = data['word'].strip()
    if word:
        trie.insert(word)
        trie.search.cache_clear()
        with open(USER_DICT_PATH, 'a', encoding='utf-8') as f:
            f.write(word + '\n')
    return jsonify({"success": True})

@lru_cache(maxsize=2048)
def get_cached_prediction(prev_word):
    if prev_word in bigrams:
        return bigrams[prev_word]
    norm_prev = normalize_kikuyu(prev_word)
    if norm_prev in bigrams:
        return bigrams[norm_prev]
    return []

@app.route('/predict', methods=['GET'])
def predict():
    prev_word = request.args.get('prev', '').lower()
    return jsonify(get_cached_prediction(prev_word))

@app.route('/autocorrect', methods=['GET'])
def autocorrect_endpoint():
    word = request.args.get('w', '').strip()
    if not word: return jsonify({"correction": None})
    if re.match(r'^[\d\W_]+$', word): return jsonify({"correction": None})
    correction = trie.autocorrect(word)
    return jsonify({"correction": correction})

# --- Document Management API ---
DOCS_DIR = os.path.join(BASE_DIR, 'documents')
os.makedirs(DOCS_DIR, exist_ok=True)

@app.route('/api/documents', methods=['GET'])
def list_documents():
    files = [f for f in os.listdir(DOCS_DIR) if f.endswith('.html')]
    return jsonify(files)

@app.route('/api/documents/<filename>', methods=['GET'])
def get_document(filename):
    if not filename.endswith('.html'): return jsonify({"error": "Invalid file"}), 400
    try:
        with open(os.path.join(DOCS_DIR, filename), 'r', encoding='utf-8') as f:
            return jsonify({"content": f.read()})
    except FileNotFoundError:
        return jsonify({"error": "Not found"}), 404

@app.route('/api/documents/<filename>', methods=['POST'])
def save_document(filename):
    if not filename.endswith('.html'): return jsonify({"error": "Invalid file"}), 400
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({"error": "No content"}), 400
    with open(os.path.join(DOCS_DIR, filename), 'w', encoding='utf-8') as f:
        f.write(data['content'])
    return jsonify({"success": True})

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('frontend', path)

if __name__ == '__main__':
    # Defaulting to 5001 to avoid collision with the main script if both are open
    app.run(host='0.0.0.0', port=5001, debug=True)
