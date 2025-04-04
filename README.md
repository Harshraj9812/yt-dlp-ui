# **yt-dlp UI**  

A simple, cross-platform graphical user interface (GUI) for **yt-dlp**, the powerful command-line YouTube/website downloader.  

## **Features**  
✅ **Easy-to-use interface** – No command-line knowledge required.  
✅ **Multi-platform** – Works on Windows, macOS, and Linux.  
✅ **Batch downloads** – Download multiple videos or playlists at once.  
✅ **Format selection** – Choose resolution, codec, and file type (MP4, WebM, MP3, etc.).  
✅ **Advanced options** – Customize download settings (subtitles, metadata, throttling).  
✅ **Dark/Light mode** – User-friendly theme support.  

---

## **Installation**  

### **Prerequisites**  
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (installed and in `PATH`).  
- Python 3.8+ (if running from source).  

### **Download & Run**  
#### **Windows (Standalone EXE)**  
1. Download the latest `.exe` from [Releases](https://github.com/yourusername/yt-dlp-gui/releases).  
2. Double-click to run.  

#### **macOS/Linux (From Source)**  
```bash
git clone https://github.com/yourusername/yt-dlp-gui.git
cd yt-dlp-gui
pip install -r requirements.txt
python main.py
```

---

## **Usage**  
1. **Paste a URL** (video, playlist, or channel).  
2. **Select format** (resolution, file type).  
3. **Choose output folder**.  
4. **Click "Download"**!  

### **Advanced Options**  
- **Subtitle download** (SRT, VTT).  
- **Metadata embedding** (title, thumbnail, artist).  
- **Speed limit** (avoid bandwidth throttling).  

---

## **Development**  
### **Tech Stack**  
- **Frontend**: [PyQt6](https://www.riverbankcomputing.com/software/pyqt/) (Python)  
- **Backend**: `yt-dlp` (via subprocess)  

### **Build from Source**  
```bash
git clone https://github.com/yourusername/yt-dlp-gui.git
cd yt-dlp-gui
python -m venv venv
source venv/bin/activate  # Linux/macOS | venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### **Create Standalone Executable**  
```bash
pip install pyinstaller
pyinstaller --onefile --windowed --icon=icon.ico main.py
```
*(Output in `dist/` folder.)*  

---

## **Contributing**  
Contributions are welcome!  
1. Fork the repo.  
2. Create a new branch (`git checkout -b feature/xyz`).  
3. Commit changes (`git commit -m "Add feature xyz"`).  
4. Push to the branch (`git push origin feature/xyz`).  
5. Open a **Pull Request**.  

---

## **License**  
This project is licensed under **MIT License**.  
See [LICENSE](LICENSE) for details.  

---

## **Credits**  
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) – The powerhouse behind downloads.  
- [FFmpeg](https://ffmpeg.org/) – For format conversions.  

---

**Need help?** Open an [Issue](https://github.com/Harshraj9812/yt-dlp-gui/issues).  
**Like the project?** ⭐ Star the repo!  

---

*(Replace placeholders like `yourusername`, `demo.png`, and adjust features as needed.)*
