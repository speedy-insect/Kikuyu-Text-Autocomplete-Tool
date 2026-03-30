from flask import Flask, request, jsonify, send_from_directory
import msgpack
import os
import sys

# Ensure UTF-8
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

app = Flask(__name__, static_folder='.')

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

print("Loading Kikuyu Autocomplete Models...")
trie = KikuyuTrie.load(TRIE_PATH)
with open(BIGRAM_PATH, 'rb') as f:
    bigrams = msgpack.unpack(f, raw=False)
print("Standalone Web Server Ready.")

@app.route('/suggest', methods=['GET'])
def suggest():
    query = request.args.get('q', '').lower()
    if not query: return jsonify([])
    return jsonify(trie.search(query, top_n=5))

@app.route('/predict', methods=['GET'])
def predict():
    prev_word = request.args.get('prev', '').lower()
    if prev_word in bigrams:
        return jsonify(bigrams[prev_word])
    return jsonify([])

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    # Defaulting to 5001 to avoid collision with the main script if both are open
    app.run(host='0.0.0.0', port=5001, debug=True)
