<div align="center">

# 🎚️ streamlit-audio-editor

**A professional-grade audio editor as a Streamlit component — waveform display, trimming, effects, and mic recording right in your Python app**

![PyPI](https://img.shields.io/pypi/v/streamlit-audio-editor?style=flat&logo=pypi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=flat&logo=streamlit&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

</div>

---

`streamlit-audio-editor` is a fully-featured audio editing Streamlit component. Drop it into any Python app to give users a professional waveform editor — complete with click-to-seek, zoom, loop playback, draggable trim handles, a real-time effects rack, microphone input, and clean 16-bit WAV export. All processing is client-side via the Web Audio API.

## ✨ Features

- **PCM waveform rendering** — high-fidelity waveform display
- **Click-to-seek** — jump to any position by clicking the waveform
- **Zoom** — zoom in on regions of interest
- **Loop playback** — loop any selection
- **Draggable trim handles** — non-destructive in-out point selection
- **16-bit WAV export** — clean audio export from the browser
- **Real-time effects rack** — EQ, reverb, and more via Web Audio API
- **Microphone routing** — record and edit live mic input
- **Jam session recording** — capture live sessions

## 🚀 Quick Start

```bash
pip install streamlit-audio-editor
```

```python
import streamlit as st
from streamlit_audio_editor import audio_editor

result = audio_editor(src="path/to/audio.wav")
st.write(result)
```

## 🛠️ Tech Stack

- **React + TypeScript** — frontend component
- **Web Audio API** — client-side audio processing
- **Python / Streamlit** — backend integration
- **PyPI** — distributed as `streamlit-audio-editor`

## 🤝 Contributing

PRs welcome. Open an issue first for major changes.

## 📄 License

MIT

## 💛 Support

If this saves you hours of audio tooling work, consider supporting development:

👉 [Donate via PayPal](https://paypal.me/noodlebake) — @noodlebake

🌐 [Portfolio: rhythrosalabs.github.io](https://rhythrosalabs.github.io) (more apps, music and sound design)

---
<div align="center">Made with ❤️ by <a href="https://github.com/RhythrosaLabs">RhythrosaLabs</a></div>
