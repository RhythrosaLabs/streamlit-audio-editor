from setuptools import setup, find_packages

setup(
    name="streamlit-audio-editor",
    version="0.4.0",
    author="Dan Sheils",
    author_email="",
    description="Browser-based audio editor & jam-session recorder for Streamlit — full effects rack, mic input, real-time recording",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/RhythrosaLabs/streamlit-audio-editor",
    project_urls={
        "Bug Tracker": "https://github.com/RhythrosaLabs/streamlit-audio-editor/issues",
        "Changelog": "https://github.com/RhythrosaLabs/streamlit-audio-editor/blob/main/CHANGELOG.md",
    },
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=["streamlit>=1.28.0"],
)
