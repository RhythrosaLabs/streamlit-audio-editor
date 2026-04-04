from setuptools import setup, find_packages

setup(
    name="streamlit-audio-editor",
    version="0.1.0",
    author="Your Name",
    author_email="you@example.com",
    description="A browser-based audio editor component for Streamlit — trim, gain, loop, export WAV",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/RhythrosaLabs/streamlit-audio-editor",
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Framework :: Streamlit",
    ],
    python_requires=">=3.8",
    install_requires=["streamlit>=1.28.0"],
)
