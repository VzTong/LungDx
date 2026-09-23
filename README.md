# LungDx

<p align="center">
  <img src="https://img.shields.io/badge/LungDx-Chest%20X--Ray%20Diagnosis-0A66C2?style=for-the-badge&logo=python&logoColor=white" alt="LungDx"/>
</p>

<p align="center">
  <strong>Web application for lung disease diagnosis from chest X-ray images using Deep Learning</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#api">API</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#security">Security</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/Flask-2.3+-000000?style=flat-square&logo=flask&logoColor=white" alt="Flask"/>
  <img src="https://img.shields.io/badge/TensorFlow-2.12+-FF6F00?style=flat-square&logo=tensorflow&logoColor=white" alt="TensorFlow"/>
  <img src="https://img.shields.io/badge/OpenCV-4.8+-5C3EE8?style=flat-square&logo=opencv&logoColor=white" alt="OpenCV"/>
  <img src="https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white" alt="Bootstrap"/>
  <img src="https://img.shields.io/badge/License-Not%20Specified-lightgrey?style=flat-square" alt="License"/>
</p>

---

> ⚠️ **Disclaimer**  
> This application is a **decision-support tool only**. Results must **not** replace professional clinical diagnosis. Always consult qualified medical experts.

---

## Features

- **Image Input**: Upload chest X-ray images (drag & drop / file picker) or provide an image URL
- **Multiple Models**:
  | Model Key              | Architecture       | Description                  |
  |------------------------|--------------------|------------------------------|
  | `lung_cnn_v0`          | Custom CNN         | Built-in CNN with CBAM-style pooling layers |
  | `lung_resnet50_v1`     | ResNet50           | Transfer learning            |
  | `lung_mobilenetv2_v1`  | MobileNetV2        | Lightweight transfer learning|
  | `lung_efficientnetb0_v1`| EfficientNetB0   | Efficient transfer learning  |
- **Ensemble Prediction**: Weighted average across loaded models for more robust results
- **Pre-check**: Validates whether the input looks like a chest X-ray (aspect ratio + intensity distribution)
- **Pneumonia Feature Detection**: Heuristic check for opacity regions; issues a low-confidence warning when appropriate
- **Real-time Progress**: Live progress updates via Socket.IO
- **History Management**: Stores up to 100 diagnosis records with view / delete support
- **Modern UI**: Dark / Light mode, responsive design, Bootstrap 5

### Classification Classes

| English                    | Vietnamese                  |
|---------------------------|-----------------------------|
| Normal                    | Bình thường                 |
| Bacterial Pneumonia       | Viêm phổi do vi khuẩn       |
| Corona Virus Disease      | Bệnh do virus Corona        |
| Tuberculosis              | Lao phổi                    |
| Viral Pneumonia           | Viêm phổi do virus          |

---

## Tech Stack

<p align="left">
  <img src="https://img.shields.io/badge/Backend-Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask"/>
  <img src="https://img.shields.io/badge/Realtime-Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/Deep%20Learning-TensorFlow%20%2F%20Keras-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" alt="TensorFlow"/>
  <img src="https://img.shields.io/badge/Computer%20Vision-OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV"/>
  <img src="https://img.shields.io/badge/Frontend-Bootstrap%205-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap"/>
  <img src="https://img.shields.io/badge/Language-Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
</p>

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Backend            | Flask + Flask-SocketIO              |
| Deep Learning      | TensorFlow / Keras                  |
| Image Processing   | OpenCV, Pillow, NumPy, SciPy        |
| Frontend           | HTML5, Bootstrap 5, jQuery, Socket.IO client |
| Model Formats      | Keras (`.keras`)                    |

---

## Installation

### Prerequisites

- Python **3.9+**
- Recommended: 8 GB+ RAM (multiple models loaded simultaneously)
- GPU optional (speeds up inference)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/VzTong/LungDx.git
cd LungDx

# 2. Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### Prepare Models

Create a `model/` directory and place the trained weights with **exact filenames**:

```
model/
├── lung_cnn_model_v0.keras
├── lung_resnet50_model_v1.keras
├── lung_mobilenetv2_model_v1.keras
└── lung_efficientnetb0_model_v1.keras
```

On first run the application automatically converts each model to a `_converted.keras` version if it does not already exist.

---

## Usage

```bash
python app.py
```

Open your browser and navigate to:

```
http://localhost:5000
```

| Route       | Description                |
|-------------|----------------------------|
| `/`         | Main diagnosis page        |
| `/history`  | Diagnosis history          |

---

## API Reference

| Method | Endpoint                      | Description                              |
|--------|-------------------------------|------------------------------------------|
| `GET`  | `/`                           | Render diagnosis page                    |
| `GET`  | `/history`                    | Render history page                      |
| `POST` | `/analyze`                    | Analyze uploaded image or image URL      |
| `GET`  | `/model_status`               | Return loading status of each model      |
| `DELETE`| `/delete_history/<index>`    | Delete a history entry by index          |

### Socket.IO Events

| Event       | Direction     | Payload example                          |
|-------------|---------------|------------------------------------------|
| `progress`  | Server → Client | `{ "percentage": 75 }`                 |
| `result`    | Server → Client | Full analysis result object            |
| `error`     | Server → Client | `{ "message": "..." }`                 |
| `cancel`    | Client → Server | Cancel current analysis                |
| `connected` | Server → Client | `{ "sid": "..." }`                     |

---

## Project Structure

```
LungDx/
├── app.py                              # Main Flask + SocketIO application
├── model/                              # Place .keras model files here (not committed)
├── static/
│   ├── Architecture/                   # Model architecture diagrams
│   ├── ConfusionMatrix/                # Confusion matrix images
│   ├── TrainingPlots/                  # Training / validation curves
│   ├── Uploads/                        # Runtime uploaded images
│   ├── script.js                       # Frontend logic
│   ├── style.css                       # Styles
│   └── model_training_version_comparison_hitory.json
├── templates/
│   ├── base.html
│   ├── index.html
│   └── history.html
├── history.json                        # Runtime diagnosis history
├── app.log                             # Runtime log file
├── requirements.txt
├── .gitignore
└── README.md
```

---

## Security Notes

The current `SECRET_KEY` is hard-coded:

```python
app.config['SECRET_KEY'] = 'your-secret-key'
```

**Recommended change** for any deployment:

```python
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
```

Also ensure the following are **never committed** (already covered by `.gitignore`):

- `model/` and `*.keras` files
- `history.json`, `app.log`
- `static/Uploads/`
- `.env` files containing secrets

---

## Author

**VzTong**  
GitHub: [https://github.com/VzTong](https://github.com/VzTong)

---

## License

No license file is currently present in the repository.  
If you intend to open-source the project, please add a suitable `LICENSE` file (MIT, Apache-2.0, etc.).
