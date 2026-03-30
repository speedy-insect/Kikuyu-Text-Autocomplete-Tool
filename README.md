# Kikuyu Docs - Smart Autocomplete Editor

A professional, Google Docs-inspired text editor designed specifically for the Kikuyu language. It features advanced real-time autocomplete (Trie-based) and contextual next-word prediction (Bigram-based).

##  Key Features
- **Floating Autocomplete**: Suggestions follow your typing cursor in real-time.
- **Smart Diacritics**: Automatically match `ĩ` and `ũ` characters even when typing on a standard keyboard (e.g., `mu` -> `mũndũ`).
- **Next-Word Prediction**: Guesses the next logical word based on 50,000+ common Kikuyu word patterns.
- **Rich Text Support**: Bold, Italic, Underline, Headers, and Text Colors.
- **Standalone Portability**: Includes optimized `msgpack` models (3.5MB total) and its own backend server.
- **Save to File**: Download your formatted work as an HTML document.


<img width="1913" height="961" alt="image" src="https://github.com/user-attachments/assets/b7d0f58d-1920-465c-9d79-edcf1a768ea6" />



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

## License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. 

### What this means:
- **You are free** to use, study, modify, and distribute this software.
- **You must** completely open-source any modifications you make if you host this software as a public service or distribute it in any way.
- **You cannot** securely rename, rebrand, or modify this software for proprietary commercial gain without open-sourcing your exact modified codebase for anyone to use freely. 

See the [LICENSE](LICENSE) file for the full legal text.
