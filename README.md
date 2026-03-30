# Kikuyu Docs - Smart Autocomplete Editor

A professional, Google Docs-inspired text editor designed specifically for the Kikuyu language. It features advanced real-time autocomplete (Trie-based) and contextual next-word prediction (Bigram-based).

##  Key Features
- **Floating Autocomplete**: Suggestions follow your typing cursor in real-time.
- **Smart Diacritics**: Automatically match `ĩ` and `ũ` characters even when typing on a standard keyboard (e.g., `mu` -> `mũndũ`).
- **Next-Word Prediction**: Guesses the next logical word based on 50,000+ common Kikuyu word patterns.
- **Rich Text Support**: Bold, Italic, Underline, Headers, and Text Colors.
- **Standalone Portability**: Includes optimized `msgpack` models (3.5MB total) and its own backend server.
- **Save to File**: Download your formatted work as an HTML document.

##  Setup & Running

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Server**:
   ```bash
   python server.py
   ```

3. **Access the Editor**:
   Open your browser to: `http://127.0.0.1:5001`

## Project Structure
- `models/`: Optimized Trie and Bigram dictionaries (MessagePack format).
- `index.html`: Web editor interface.
- `style.css`: Professional "white paper" styling.
- `app.js`: Autocomplete and rich-text logic.
- `server.py`: Flask backend for search and prediction.
- `requirements.txt`: Python package dependencies.

## Credits
Developed as part of the **Kikuyu Autocomplete Project**, focusing on sub-10ms latency and high accuracy linguistic modeling.
