import os
import logging
from logging.handlers import RotatingFileHandler
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras import models, applications
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_socketio import SocketIO, emit
import cv2
import uuid
import requests
from io import BytesIO
from datetime import datetime
from werkzeug.utils import secure_filename
from scipy.ndimage import label
import time  # Thêm import time để điều khiển độ trễ

# Thiết lập logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
console_handler.setStream(open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1))
logger.addHandler(console_handler)

log_file = os.path.join(os.path.dirname(__file__), 'app.log')
file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/static/Uploads/<path:filename>')
def serve_uploaded_file(filename):
    static_dir = os.path.join(app.static_folder, 'Uploads')
    return send_from_directory(static_dir, filename)

# Định nghĩa lớp tùy chỉnh cho lung_cnn_v0
class MeanPoolLayer(tf.keras.layers.Layer):
    def call(self, inputs):
        return tf.reduce_mean(inputs, axis=-1, keepdims=True)

class MaxPoolLayer(tf.keras.layers.Layer):
    def call(self, inputs):
        return tf.reduce_max(inputs, axis=-1, keepdims=True)

# Cấu hình mô hình
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')
MODEL_PATHS = {
    'lung_cnn_v0': {
        'path': os.path.join(MODEL_DIR, 'lung_cnn_model_v0.keras'),
        'converted_path': os.path.join(MODEL_DIR, 'lung_cnn_model_v0_converted.keras')
    },
    'lung_resnet50_v1': {
        'path': os.path.join(MODEL_DIR, 'lung_resnet50_model_v1.keras'),
        'converted_path': os.path.join(MODEL_DIR, 'lung_resnet50_model_v1_converted.keras')
    },
    'lung_mobilenetv2_v1': {
        'path': os.path.join(MODEL_DIR, 'lung_mobilenetv2_model_v1.keras'),
        'converted_path': os.path.join(MODEL_DIR, 'lung_mobilenetv2_model_v1_converted.keras')
    },
    'lung_efficientnetb0_v1': {
        'path': os.path.join(MODEL_DIR, 'lung_efficientnetb0_model_v1.keras'),
        'converted_path': os.path.join(MODEL_DIR, 'lung_efficientnetb0_model_v1_converted.keras')
    }
}

MODELS_INFO = {
    'lung_resnet50_v1': {'name': 'ResNet50', 'description': 'Mô hình ResNet50'},
    'lung_mobilenetv2_v1': {'name': 'MobileNetV2', 'description': 'Mô hình MobileNetV2'},
    'lung_efficientnetb0_v1': {'name': 'EfficientNetB0', 'description': 'Mô hình EfficientNetB0'},
    'lung_cnn_v0': {'name': 'CNN tùy chỉnh', 'description': 'Mô hình CNN tự xây dựng'}
}

CLASSES = ['Normal', 'Bacterial Pneumonia', 'Corona Virus Disease', 'Tuberculosis', 'Viral Pneumonia']
CLASS_TRANSLATIONS = {
    'Normal': 'Bình thường',
    'Bacterial Pneumonia': 'Viêm phổi do vi khuẩn',
    'Corona Virus Disease': 'Bệnh do virus Corona',
    'Tuberculosis': 'Lao phổi',
    'Viral Pneumonia': 'Viêm phổi do virus'
}

IMG_HEIGHT, IMG_WIDTH, IMG_CHANNELS = 224, 224, 3

HISTORY_JSON = os.path.join(os.path.dirname(__file__), 'history.json')
history = []

if os.path.exists(HISTORY_JSON):
    try:
        with open(HISTORY_JSON, 'r', encoding='utf-8') as f:
            history = json.load(f)
        logger.info(f"Loaded {len(history)} history entries from {HISTORY_JSON}")
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in history.json: initializing empty history")
        history = []
    except Exception as e:
        logger.error(f"Error loading history.json: {str(e)}")
        history = []
else:
    logger.info("history.json not found: initializing empty history")
    history = []

loaded_models = {}

def convert_model(model_path: str, converted_path: str, model_name: str):
    try:
        logger.info(f"Đang chuyển đổi mô hình từ {model_path}...")
        if model_name == 'lung_cnn_v0':
            model = models.load_model(model_path, custom_objects={'MeanPoolLayer': MeanPoolLayer, 'MaxPoolLayer': MaxPoolLayer})
        else:
            model = models.load_model(model_path)
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        model.save(converted_path)
        logger.info(f"Đã chuyển đổi và lưu mô hình vào {converted_path}")
    except Exception as e:
        logger.error(f"Lỗi khi chuyển đổi mô hình {model_path}: {str(e)}")
        raise

def load_and_convert_models():
    for model_name in MODEL_PATHS:
        original_path = MODEL_PATHS[model_name]["path"]
        converted_path = MODEL_PATHS[model_name]["converted_path"]
        if not os.path.exists(original_path):
            logger.error(f"Model {model_name} not found at {original_path}")
            continue
        if not os.path.exists(converted_path):
            convert_model(original_path, converted_path, model_name)
        try:
            if model_name == 'lung_cnn_v0':
                model = models.load_model(converted_path, custom_objects={'MeanPoolLayer': MeanPoolLayer, 'MaxPoolLayer': MaxPoolLayer})
            else:
                model = models.load_model(converted_path)
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy']
            )
            loaded_models[model_name] = model
            logger.info(f"Loaded model {model_name} from {converted_path}")
        except Exception as e:
            logger.error(f"Error loading model {model_name} from {converted_path}: {str(e)}")
    logger.info(f"Loaded models: {list(loaded_models.keys())}")

load_and_convert_models()

def save_history():
    try:
        if os.path.exists(HISTORY_JSON):
            import shutil
            shutil.copy(HISTORY_JSON, HISTORY_JSON + '.backup')
        if not os.access(HISTORY_JSON, os.W_OK):
            logger.error(f"No write permission for {HISTORY_JSON}")
            raise PermissionError(f"No write permission for {HISTORY_JSON}")
        while len(history) > 100:
            history.pop(0)
            logger.debug("Removed oldest history entry to maintain limit of 100")
        json.dumps(history)  # Kiểm tra JSON hợp lệ
        with open(HISTORY_JSON, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        logger.debug(f"Saved {len(history)} history entries to {HISTORY_JSON}")
    except Exception as e:
        logger.error(f"Error saving history.json: {str(e)}")
        raise

def check_file_extension(filename: str) -> bool:
    allowed_extensions = {'jpg', 'jpeg', 'png'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def preprocess_image(image, model_name):
    try:
        socketio.emit('progress', {'percentage': 10})
        if len(image.shape) not in [2, 3]:
            raise ValueError(f"Invalid image dimensions: {image.shape}")
        if len(image.shape) == 3 and image.shape[2] not in [1, 3, 4]:
            raise ValueError(f"Invalid number of channels: {image.shape[2]}")

        if len(image.shape) == 2 or (len(image.shape) == 3 and image.shape[2] == 1):
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB) if len(image.shape) == 2 else cv2.cvtColor(image[:, :, 0], cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)

        socketio.emit('progress', {'percentage': 30})
        image = cv2.resize(image, (IMG_WIDTH, IMG_HEIGHT))
        img = img_to_array(image)

        if np.any(img < 0) or np.any(img > 255):
            logger.warning(f"Invalid pixel values in image: min={np.min(img)}, max={np.max(img)}")
            img = np.clip(img, 0, 255)

        socketio.emit('progress', {'percentage': 50})
        if model_name == 'lung_resnet50_v1':
            img = applications.resnet50.preprocess_input(img)
        elif model_name == 'lung_mobilenetv2_v1':
            img = applications.mobilenet_v2.preprocess_input(img)
        elif model_name == 'lung_efficientnetb0_v1':
            img = applications.efficientnet.preprocess_input(img)
        else:
            img = img / 255.0

        img = np.expand_dims(img, axis=0)
        socketio.emit('progress', {'percentage': 70})
        logger.debug(f"Image shape: {img.shape}, Min/max values: {np.min(img)}, {np.max(img)}")
        return img, image
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        socketio.emit('error', {'message': f"Lỗi tiền xử lý hình ảnh: {str(e)}"})
        raise

def download_image(url):
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            raise ValueError(f"Cannot download image from {url}, status code: {response.status_code}")
        if not response.headers.get('content-type', '').startswith('image/'):
            raise ValueError(f"URL {url} does not point to an image, content-type: {response.headers.get('content-type')}")
        img = np.array(load_img(BytesIO(response.content)))
        socketio.emit('progress', {'percentage': 30})
        return img
    except Exception as e:
        logger.error(f"Error downloading image from URL {url}: {str(e)}")
        socketio.emit('error', {'message': f"Lỗi tải ảnh từ URL: {str(e)}"})
        raise

def is_chest_xray(image):
    height, width = image.shape[:2]
    aspect_ratio = width / height
    if aspect_ratio < 0.5 or aspect_ratio > 2.0:
        logger.warning(f"Invalid aspect ratio for chest X-ray: {aspect_ratio}")
        return False

    if len(image.shape) == 3:
        image_gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        image_gray = image

    mean_intensity = np.mean(image_gray)
    std_intensity = np.std(image_gray)
    if mean_intensity > 220 or std_intensity < 15:
        logger.warning(f"Invalid intensity distribution: mean={mean_intensity}, std={std_intensity}")
        return False

    if np.any(image_gray < 0) or np.any(image_gray > 255):
        logger.warning(f"Invalid pixel values in image: min={np.min(image_gray)}, max={np.max(image_gray)}")
        return False

    return True

def detect_pneumonia_features(image):
    """Phân tích đặc trưng viêm phổi: phát hiện vùng mờ hoặc kính mờ."""
    try:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)
        _, thresh = cv2.threshold(blurred, 150, 255, cv2.THRESH_BINARY)
        labeled_array, num_features = label(thresh)

        feature_sizes = np.bincount(labeled_array.ravel())[1:]
        large_features = len([s for s in feature_sizes if s > (IMG_HEIGHT * IMG_WIDTH * 0.05)])

        return large_features > 0
    except Exception as e:
        logger.warning(f"Error detecting pneumonia features: {str(e)}")
        return False

def analyze_image(image, model_name, socketio_session_id):
    try:
        if model_name not in loaded_models:
            raise ValueError(f"Model {model_name} not loaded")

        logger.info(f"Starting image analysis with model: {model_name}, session_id: {socketio_session_id}")
        socketio.emit('progress', {'percentage': 0}, room=socketio_session_id)

        if not is_chest_xray(image):
            error_msg = 'Đây không phải là ảnh X-quang ngực'
            socketio.emit('error', {'message': error_msg}, room=socketio_session_id)
            return {
                'status': 'error',
                'error': error_msg
            }

        socketio.emit('progress', {'percentage': 10}, room=socketio_session_id)
        processed_image, original_image = preprocess_image(image, model_name)

        # Ensemble prediction cho các mô hình
        socketio.emit('progress', {'percentage': 80}, room=socketio_session_id)
        logger.debug(f"Predicting with model {model_name}...")
        predictions = []
        weights = {
            'lung_resnet50_v1': 0.4,
            'lung_mobilenetv2_v1': 0.3,
            'lung_efficientnetb0_v1': 0.3,
            'lung_cnn_v0': 0.2
        }

        num_models = len(loaded_models)
        for i, m_name in enumerate(loaded_models):
            try:
                model = loaded_models[m_name]
                pred = model.predict(processed_image, verbose=0)[0]
                if np.any(np.isnan(pred)) or np.any(np.isinf(pred)):
                    logger.warning(f"Invalid prediction from model {m_name}: {pred}")
                    continue
                weight = weights.get(m_name, 0.2) if (m_name == model_name or m_name == 'lung_cnn_v0') else weights.get(m_name, 0.3)
                predictions.append(pred * weight)
                # Cập nhật tiến trình chi tiết hơn trong quá trình dự đoán
                progress = 80 + (i + 1) * (10 / num_models)  # Tăng dần từ 80% đến 90%
                socketio.emit('progress', {'percentage': progress}, room=socketio_session_id)
                time.sleep(0.1)  # Độ trễ nhỏ để frontend xử lý
            except Exception as e:
                logger.warning(f"Error predicting with model {m_name}: {str(e)}")
                continue

        if not predictions:
            raise ValueError("No valid predictions from any model")

        # Tính trung bình dự đoán
        final_prediction = np.mean(predictions, axis=0)

        if np.any(np.isnan(final_prediction)) or np.any(np.isinf(final_prediction)):
            raise ValueError(f"Invalid final prediction: {final_prediction}")

        socketio.emit('progress', {'percentage': 92}, room=socketio_session_id)
        time.sleep(0.1)
        class_index = np.argmax(final_prediction)
        result = CLASSES[class_index]
        result_vn = CLASS_TRANSLATIONS[result]
        confidence = final_prediction.tolist()

        # Kiểm tra đặc trưng viêm phổi và độ tin cậy
        socketio.emit('progress', {'percentage': 94}, room=socketio_session_id)
        time.sleep(0.1)
        warning = None
        if result in ['Bacterial Pneumonia', 'Viral Pneumonia']:
            has_pneumonia_features = detect_pneumonia_features(original_image)
            max_confidence = max(confidence)
            if max_confidence < 0.7 or not has_pneumonia_features:
                warning = "Dự đoán có độ tin cậy thấp hoặc không phát hiện đặc trưng viêm phổi rõ ràng. Khuyến nghị kiểm tra thêm bởi bác sĩ."

        socketio.emit('progress', {'percentage': 96}, room=socketio_session_id)
        time.sleep(0.1)
        static_dir = os.path.join(app.static_folder, 'Uploads')
        os.makedirs(static_dir, exist_ok=True)
        image_filename = f"{uuid.uuid4().hex}.jpg"
        image_save_path = os.path.join(static_dir, image_filename)
        cv2.imwrite(image_save_path, cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR))

        socketio.emit('progress', {'percentage': 98}, room=socketio_session_id)
        time.sleep(0.1)
        history_entry = {
            'model': model_name,
            'result': result,
            'result_vn': result_vn,
            'original_image': f"/static/Uploads/{image_filename}",
            'source_url': request.form.get('url', ''),
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'warning': warning
        }
        history.append(history_entry)
        save_history()

        socketio.emit('progress', {'percentage': 100}, room=socketio_session_id)
        time.sleep(0.1)
        logger.info(f"Analysis completed: model={model_name}, result={result}")
        return {
            'result': result,
            'result_vn': result_vn,
            'original_image': f"/static/Uploads/{image_filename}",
            'confidence': confidence,
            'warning': warning,
            'status': 'success'
        }
    except Exception as e:
        error_msg = f"Prediction error: {str(e)}"
        logger.error(error_msg)
        socketio.emit('error', {'message': error_msg}, room=socketio_session_id)
        return {
            'status': 'error',
            'error': error_msg
        }

@app.route('/')
def index():
    return render_template('index.html', models=MODELS_INFO)

@app.route('/history')
def history_page():
    response = render_template('history.html', models=MODELS_INFO, history=history)
    response = app.make_response(response)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/analyze', methods=['POST'])
def analyze():
    socketio_session_id = request.form.get('sid', str(uuid.uuid4()))
    logger.info(f"Received /analyze request: model={request.form.get('model')}, has_file={'file' in request.files}, url={request.form.get('url', '')}, session_id={socketio_session_id}, form_data={dict(request.form)}")
    try:
        model_name = request.form.get('model')
        if not model_name or model_name not in MODEL_PATHS:
            logger.warning(f"Invalid model: {model_name}")
            socketio.emit('error', {'message': 'Mô hình không hợp lệ'}, room=socketio_session_id)
            return jsonify({'status': 'error', 'error': 'Invalid model selected'}), 400

        socketio.emit('progress', {'percentage': 0}, room=socketio_session_id)
        if 'file' in request.files and request.files['file'].filename:
            file = request.files['file']
            if not file.content_type.startswith('image/'):
                logger.error(f"Invalid file type: {file.content_type}")
                socketio.emit('error', {'message': 'Loại tệp không hợp lệ, chỉ cho phép ảnh'}, room=socketio_session_id)
                return jsonify({'status': 'error', 'error': 'Invalid file type, only images are allowed'}), 400

            filename = secure_filename(file.filename)
            if not check_file_extension(filename):
                logger.error(f"Unsupported file extension: {filename}")
                socketio.emit('error', {'message': 'Định dạng tệp không được hỗ trợ, chỉ cho phép jpg, jpeg và png'}, room=socketio_session_id)
                return jsonify({'status': 'error', 'error': 'Unsupported file extension, only jpg, jpeg, and png are allowed'}), 400

            upload_dir = os.path.join(app.static_folder, 'Uploads')
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, f"{uuid.uuid4().hex}_{filename}")
            file.save(file_path)
            logger.debug(f"Saved uploaded file to {file_path}")

            image = cv2.imread(file_path)
            if image is None:
                logger.error(f"Cannot read image from {file_path}")
                os.remove(file_path)
                error_msg = 'Không thể đọc ảnh đã tải lên, vui lòng đảm bảo đây là tệp ảnh hợp lệ'
                socketio.emit('error', {'message': error_msg}, room=socketio_session_id)
                return jsonify({'status': 'error', 'error': error_msg}), 400

            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        elif 'url' in request.form and request.form['url']:
            url = request.form['url']
            logger.debug(f"Downloading image from {url}")
            image = download_image(url)
        else:
            logger.warning("No file or URL provided")
            socketio.emit('error', {'message': 'Vui lòng cung cấp tệp hoặc URL'}, room=socketio_session_id)
            return jsonify({'status': 'error', 'error': 'Please provide file or URL'}), 400

        result = analyze_image(image, model_name, socketio_session_id)
        socketio.emit('result', result, room=socketio_session_id)
        return jsonify(result)
    except Exception as e:
        error_msg = f"Lỗi phân tích: {str(e)}"
        logger.error(error_msg)
        socketio.emit('error', {'message': error_msg}, room=socketio_session_id)
        return jsonify({'status': 'error', 'error': error_msg}), 500

@app.route('/model_status', methods=['GET'])
def model_status():
    try:
        status = {name: bool(name in loaded_models) for name in MODEL_PATHS}
        logger.debug(f"Model status: {status}")
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error checking model status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_history/<int:index>', methods=['DELETE'])
def delete_history(index):
    try:
        if 0 <= index < len(history):
            deleted_entry = history.pop(index)
            save_history()
            logger.info(f"Deleted history entry at index {index}: {deleted_entry['result']}")
            return jsonify({'message': 'History entry deleted'})
        logger.warning(f"Invalid history index: {index}")
        return jsonify({'error': 'History entry not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    logger.info(f"SocketIO client connected: {request.sid}")
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"SocketIO client disconnected: {request.sid}")

@socketio.on('cancel')
def handle_cancel():
    logger.info(f"Analysis cancelled by client: {request.sid}")
    emit('progress', {'percentage': 0, 'message': 'Phân tích đã bị hủy'}, room=request.sid)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)