import base64
import streamlit as st
from streamlit_audio_editor import st_audio_editor

st.set_page_config(page_title="Audio Editor Demo", layout="wide")
st.title("🎛️ streamlit-audio-editor demo")
st.caption("Load any audio file using the button inside the editor, then trim, adjust gain, and export.")

result = st_audio_editor(key="demo_editor")

if result:
    col1, col2, col3 = st.columns(3)
    col1.metric("Trim start", f"{result['trimStart']:.3f}s")
    col2.metric("Trim end",   f"{result['trimEnd']:.3f}s")
    col3.metric("Duration",   f"{result['trimEnd'] - result['trimStart']:.3f}s")

    wav_bytes = base64.b64decode(result["wavBase64"])
    st.audio(wav_bytes, format="audio/wav")
    st.download_button("⬇ Download trimmed WAV", wav_bytes, "trimmed.wav", "audio/wav")
