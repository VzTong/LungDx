from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from tensorflow import keras
import tensorflow as tf
import os
import numpy as np
import typing
import time
import matplotlib
matplotlib.use('Agg')
import cv2
from datetime import datetime
import json
import re

# Sử dụng các metrics từ scikit-learn để đánh giá mô hình
import sklearn
precision_score = sklearn.metrics.precision_score
recall_score = sklearn.metrics.recall_score
f1_score = sklearn.metrics.f1_score
accuracy_score = sklearn.metrics.accuracy_score

# Sử dụng decorator từ Keras để đăng ký hàm tùy chỉnh (đã sửa cho Keras 3)
from keras.saving import register_keras_serializable

# Định nghĩa và đăng ký hàm grayscale_to_rgb
@register_keras_serializable()
def grayscale_to_rgb(image):
    return tf.tile(image, [1, 1, 1, 3])

app = Flask(__name__)
socketio = SocketIO(app)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}
HISTORY_FILE = 'history.json'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Hàm đọc lịch sử từ file history.json
def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Lỗi khi đọc file {HISTORY_FILE}: {str(e)}")
            return []
    return []

# Hàm lưu lịch sử vào file history.json
def save_history(history_data):
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, ensure_ascii=False, indent=4)
        print(f"Đã lưu lịch sử vào {HISTORY_FILE}")
    except PermissionError:
        print(f"Không có quyền ghi vào {HISTORY_FILE}")
    except Exception as e:
        print(f"Lỗi khi lưu file {HISTORY_FILE}: {str(e)}")

# Khởi tạo lịch sử từ file history.json
history = load_history()

# Đọc file so sánh từ static
COMPARISON_JSON_PATH = os.path.join(app.static_folder, 'model_comparison_metrics_full.json')

def load_comparison_data():
    if os.path.exists(COMPARISON_JSON_PATH):
        try:
            with open(COMPARISON_JSON_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Lỗi khi đọc file {COMPARISON_JSON_PATH}: {str(e)}")
            return {}
    return {}

models_info = {
    "lung_cnn_v1": {
        "path": "model/lung_cnn_model_v1.keras",
        "converted_path": "model/lung_cnn_model_v1_converted.keras",
        "description": "Mô hình Lung CNN v1 với CBAM để phân loại 5 tình trạng phổi.",
        "details": {
            "Đầu vào": {
                "Kích thước ảnh": "224x224 pixels, grayscale",
                "Tiền xử lý": {
                    "Ngưỡng otsu": "Tự động tách nền khỏi ảnh X-quang",
                    "Normalization": "Zero-mean và unit-variance (μ = 0, σ = 1)",
                    "Tăng cường dữ liệu": "Lật ngang, xoay (-15° đến 15°), thay đổi độ sáng (±20%)"
                }
            },
            "Cấu trúc mô hình": {
                "model_type": "CNN nhiều tầng với CBAM Attention Mechanism",
                "num_conv_blocks": 3,
                "each_block": {
                    "2 lớp Conv2D": "kernel 3x3, stride 1x1, activation ReLU",
                    "BatchNormalization": "Chuẩn hóa các giá trị đầu vào của mỗi lớp",
                    "CBAM Attention": "Kết hợp Channel Attention và Spatial Attention để làm nổi bật các đặc trưng quan trọng",
                    "MaxPooling2D": "Kích thước 2x2, stride 2, giảm kích thước đặc trưng",
                    "GlobalMaxPooling2D + GlobalAveragePooling2D": "Kết hợp kết quả từ cả GlobalMaxPooling và GlobalAveragePooling để trích xuất thông tin mạnh mẽ hơn"
                }
            },
            "dense_layers": {
                "dense_512": "512 nơ-ron, Dropout 0.6, activation ReLU",
                "dense_256": "256 nơ-ron, Dropout 0.6, activation ReLU"
            },
            "output_layer": {
                "num_neurons": 5,
                "activation": "Softmax"
            },
            "training": {
                "optimizer": "Adam (lr=0.0001)",
                "loss_function": "sparse_categorical_crossentropy",
                "epochs": 50,
                "mixed_precision": "float16",
                "mini_batch_size": 32,
                "lr_scheduler": "ReduceLROnPlateau (factor=0.5, patience=3)",
                "early_stopping": "patience=5"
            },
            "Hiệu suất": {
                "test_accuracy": "87.06%",
                "best_val_accuracy": "85.89% (Epoch 49)"
            }
        },
        "accuracy_plot": "v1_training_plots.png",
        "confusion_matrix": "v1_confusion_matrix.png",
        "architecture": "lung_cnn_model_v1_architecture.png"
    },
    "lung_resnet50_v2": {
        "path": "model/lung_resnet50_model_v2.keras",
        "converted_path": "model/lung_resnet50_model_v2_converted.keras",
        "description": "Mô hình ResNet50 cải tiến với CBAM để phân loại 5 tình trạng phổi từ ảnh X-quang.",
        "details": {
            "Đầu vào": {
                "Kích thước ảnh": "224x224 pixels, grayscale",
                "Tiền xử lý": {
                    "Ngưỡng Otsu": "Tự động tách nền khỏi ảnh X-quang bằng phương pháp Otsu",
                    "Normalization": "Zero-mean và unit-variance (μ = 0, σ = 1)",
                    "Tăng cường dữ liệu": "Lật ngang ngẫu nhiên, dịch chuyển ngẫu nhiên (height_factor=0.1, width_factor=0.1)"
                }
            },
            "Cấu trúc mô hình": {
                "model_type": "ResNet50 với CBAM Attention Mechanism",
                "base_model": "ResNet50 pre-trained trên ImageNet, đóng băng các tầng trừ conv5_block để fine-tune",
                "input_conversion": "Chuyển ảnh grayscale sang RGB (3 kênh) để phù hợp với ResNet50",
                "cbam_block": {
                    "Channel Attention": "Tập trung vào các kênh quan trọng với ratio=8",
                    "Spatial Attention": "Tập trung vào các vùng không gian quan trọng với kernel 7x7",
                    "Position": "Áp dụng sau ResNet50 để tăng cường trích xuất đặc trưng"
                },
                "pooling": "GlobalAveragePooling2D để giảm kích thước đặc trưng"
            },
            "dense_layers": {
                "dense_512": "512 nơ-ron, Dropout 0.6, activation ReLU, L2 regularization (0.001)",
                "dense_256": "256 nơ-ron, Dropout 0.6, activation ReLU, L2 regularization (0.001)"
            },
            "output_layer": {
                "num_neurons": 5,
                "activation": "Softmax"
            },
            "training": {
                "optimizer": "Adam (lr=1e-5)",
                "loss_function": "sparse_categorical_crossentropy",
                "epochs": 70,
                "mixed_precision": "float16",
                "mini_batch_size": 16,
                "train_steps_per_epoch": 190,
                "val_steps_per_epoch": 64,
                "lr_scheduler": "ReduceLROnPlateau (factor=0.5, patience=7, min_lr=1e-7)",
                "early_stopping": "patience=15, dựa trên val_loss",
                "checkpoint": "Lưu mô hình tốt nhất dựa trên val_accuracy"
            },
            "Hiệu suất": {
                "test_accuracy": "85.23%",
                "best_val_accuracy": "85.94% (Epoch 69)",
                "best_val_loss": "1.1270 (Epoch 69)"
            }
        },
        "accuracy_plot": "training_plots_resnet50_v2.png",
        "confusion_matrix": "confusion_matrix_resnet50_v2.png",
        "architecture": "lung_resnet50_model_v2_architecture.png"
    }
}

loaded_models: typing.Dict[str, typing.Any] = {}
classes = ["Normal", "Bacterial Pneumonia", "Corona Virus", "Tuberculosis", "Viral Pneumonia"]
class_translations = {
    "Normal": "Bình thường",
    "Bacterial Pneumonia": "Viêm phổi do vi khuẩn",
    "Corona Virus": "Virus Corona",
    "Tuberculosis": "Lao phổi",
    "Viral Pneumonia": "Viêm phổi do virus"
}

def convert_model(model_path: str, converted_path: str):
    try:
        print(f"Đang chuyển đổi mô hình từ {model_path}...")
        model = keras.models.load_model(model_path)
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        model.save(converted_path)
        print(f"Đã chuyển đổi và lưu mô hình vào {converted_path}")
    except Exception as e:
        print(f"Lỗi khi chuyển đổi mô hình {model_path}: {str(e)}")
        raise

def load_and_convert_models():
    for model_name in models_info:
        original_path = models_info[model_name]["path"]
        converted_path = models_info[model_name]["converted_path"]
        if not os.path.exists(original_path):
            print(f"Tệp mô hình không tồn tại: {original_path}")
            continue
        if not os.path.exists(converted_path):
            convert_model(original_path, converted_path)
        try:
            loaded_models[model_name] = keras.models.load_model(converted_path)
            loaded_models[model_name].compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy']
            )
            print(f"Đã tải mô hình: {model_name} từ {converted_path}")
        except Exception as e:
            print(f"Lỗi khi tải mô hình {model_name} từ {converted_path}: {str(e)}")

def check_model_layers():
    for model_name in loaded_models:
        print(f"\nKiến trúc của mô hình {model_name}:")
        loaded_models[model_name].summary()

load_and_convert_models()
check_model_layers()

def check_file_extension(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def assess_image_quality(image: np.ndarray) -> tuple:
    mean_brightness = np.mean(image)
    std_dev = np.std(image)
    return mean_brightness, std_dev

def preprocess_image(image_path: str) -> tuple:
    try:
        socketio.emit('progress', {'percentage': 10})

        if not os.path.exists(image_path):
            raise ValueError(f"File không tồn tại: {image_path}")

        original_image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if original_image is None:
            raise ValueError(f"Không thể đọc ảnh từ {image_path}")

        print(f"Shape ảnh gốc: {original_image.shape}")
        display_image = original_image.copy()

        image = tf.convert_to_tensor(original_image, dtype=tf.float32)
        image = tf.expand_dims(image, axis=-1)

        socketio.emit('progress', {'percentage': 20})
        image = tf.image.resize(image, [224, 224], method='area')
        print(f"Shape sau khi resize: {image.shape}")

        socketio.emit('progress', {'percentage': 30})
        mean = tf.reduce_mean(image)
        std_dev = tf.math.reduce_std(image)
        image = (image - mean) / (std_dev if std_dev > 0 else 1.0)

        socketio.emit('progress', {'percentage': 40})
        img_for_threshold = image[:, :, 0]
        image_scaled = (img_for_threshold - tf.reduce_min(img_for_threshold)) / (
            tf.reduce_max(img_for_threshold) - tf.reduce_min(img_for_threshold) + 1e-6
        ) * 255.0
        hist = tf.histogram_fixed_width(image_scaled, [0.0, 256.0], nbins=256)
        hist = tf.cast(hist, tf.float32)
        bin_centers = tf.range(256, dtype=tf.float32)
        total = tf.reduce_sum(hist)
        weight_background = tf.cumsum(hist)
        weight_foreground = total - weight_background
        mean_background = tf.cumsum(hist * bin_centers) / (weight_background + 1e-6)
        mean_foreground = (tf.reduce_sum(hist * bin_centers) - tf.cumsum(hist * bin_centers)) / (weight_foreground + 1e-6)
        class_variance = weight_background * weight_foreground * (mean_background - mean_foreground) ** 2
        threshold = tf.argmax(class_variance)
        binary_mask = tf.cast(image_scaled >= tf.cast(threshold, tf.float32), tf.float32)

        socketio.emit('progress', {'percentage': 50})
        kernel = np.ones((5, 5), np.float32)
        binary_mask = cv2.dilate(binary_mask.numpy(), kernel, iterations=1)
        binary_mask = cv2.erode(binary_mask, kernel, iterations=1)
        binary_mask = tf.convert_to_tensor(binary_mask, dtype=tf.float32)

        image = image * binary_mask[..., tf.newaxis]

        socketio.emit('progress', {'percentage': 60})
        if np.random.random() > 0.5:
            image = tf.image.random_flip_left_right(image)
        translation_layer = tf.keras.layers.RandomTranslation(
            height_factor=0.1, width_factor=0.1, fill_mode='nearest'
        )
        image = translation_layer(image, training=True)

        image = tf.ensure_shape(image, [224, 224, 1])
        image = tf.expand_dims(image, axis=0)

        socketio.emit('progress', {'percentage': 80})
        if image.shape != (1, 224, 224, 1):
            raise ValueError(f"Shape của ảnh sau tiền xử lý không đúng: {image.shape}, cần (1, 224, 224, 1)")

        display_image = cv2.resize(display_image, (224, 224), interpolation=cv2.INTER_AREA)
        return image.numpy(), display_image
    except Exception as e:
        socketio.emit('error', {'message': f"Lỗi tiền xử lý hình ảnh: {str(e)}"})
        raise

def analyze_image(image_path: str, model_name: str) -> tuple:
    start_time = time.time()
    try:
        if model_name not in loaded_models:
            raise ValueError(f"Mô hình {model_name} chưa được tải.")

        model = loaded_models[model_name]
        preprocess_start = time.time()
        processed_image, original_image = preprocess_image(image_path)
        print(f"Tiền xử lý mất: {time.time() - preprocess_start:.2f} giây")

        socketio.emit('progress', {'percentage': 90})
        predict_start = time.time()
        processed_image_tensor = tf.convert_to_tensor(processed_image, dtype=tf.float32)
        prediction = model.predict(processed_image_tensor, verbose=0)
        print(f"Dự đoán mất: {time.time() - predict_start:.2f} giây")
        socketio.emit('progress', {'percentage': 100})

        class_index = np.argmax(prediction[0])
        confidence = float(np.max(prediction[0]) * 100)
        result = classes[class_index]
        result_vn = class_translations[result]

        filename = os.path.basename(image_path)

        history_entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "result": f"{result} ({result_vn})",
            "confidence": confidence,
            "model": model_name,
            "original_image": f"/uploads/{filename}",
            "input_details": models_info[model_name]["details"]["Đầu vào"],
            "architecture": models_info[model_name]["details"]["Cấu trúc mô hình"],
            "dense_layers": models_info[model_name]["details"]["dense_layers"],
            "output_layer": models_info[model_name]["details"]["output_layer"],
            "training": models_info[model_name]["details"]["training"],
            "performance": models_info[model_name]["details"]["Hiệu suất"]
        }

        history.append(history_entry)
        save_history(history)

        return result, confidence, original_image
    except Exception as e:
        error_msg = f"Lỗi chuẩn đoán: {str(e)}"
        print(error_msg)
        socketio.emit('error', {'message': error_msg})
        raise

@app.route('/')
def home():
    return render_template('index.html', models=models_info)

@app.route('/history')
def history_page():
    global history
    history = load_history()
    history.sort(key=lambda x: x['timestamp'], reverse=True)
    # Chỉ trả về 10 mục mới nhất
    limited_history = history[:10]
    # Đọc dữ liệu so sánh từ file JSON trong thư mục static
    comparison_data = load_comparison_data()
    return render_template('history.html', history=limited_history, models=models_info, comparison_data=comparison_data)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/delete_history/<int:index>', methods=['DELETE'])
def delete_history(index):
    global history
    try:
        # Group entries by image and result to match the frontend grouping
        grouped_entries = {}
        for i, entry in enumerate(history):
            key = entry['original_image'] + '|' + entry['result']
            if key not in grouped_entries:
                grouped_entries[key] = []
            grouped_entries[key].append(i)

        # Get the group corresponding to the index
        group_keys = list(grouped_entries.keys())
        if 0 <= index < len(group_keys):
            group_key = group_keys[index]
            group_indices = grouped_entries[group_key]

            # Delete all entries in the group
            for group_index in sorted(group_indices, reverse=True):
                entry = history[group_index]
                if entry.get('original_image'):
                    image_path = os.path.join(app.config['UPLOAD_FOLDER'], entry['original_image'].split('/')[-1])
                    if os.path.exists(image_path):
                        os.remove(image_path)
                        print(f"Đã xóa file ảnh: {image_path}")
                    else:
                        print(f"File ảnh không tồn tại: {image_path}")
                history.pop(group_index)

            save_history(history)
            return jsonify({'message': 'Đã xóa nhóm lịch sử thành công'}), 200
        else:
            return jsonify({'error': 'Chỉ số không hợp lệ'}), 400
    except Exception as e:
        return jsonify({'error': f'Lỗi khi xóa: {str(e)}'}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        print("Dữ liệu request:", request.files)
        print("Form data:", request.form)
        if 'file' not in request.files:
            return jsonify({'error': 'Không có tệp nào được chọn'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Không có tệp nào được chọn'}), 400

        if not check_file_extension(file.filename):
            return jsonify({'error': 'Định dạng tệp không hợp lệ'}), 400

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        model_name = request.form.get('model', 'lung_cnn_v1')
        if model_name not in models_info:
            return jsonify({'error': 'Mô hình không hợp lệ'}), 400

        result, confidence, original_image = analyze_image(filepath, model_name)
        result_data = {
            'result': result,
            'confidence': confidence,
            'original_image': f"/uploads/{filename}",
        }
        print(f"Dữ liệu gửi qua SocketIO: {result_data}")
        socketio.emit('result', result_data)
        return jsonify({'filename': filename})
    except Exception as e:
        socketio.emit('error', {'message': f'Lỗi xử lý: {str(e)}'})
        return jsonify({'error': f'Lỗi xử lý: {str(e)}'}), 500

@socketio.on('cancel_analysis')
def handle_cancel_analysis():
    try:
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Lỗi xóa tệp: {e}")
        emit('analysis_cancelled', {'message': 'Đã hủy chuẩn đoán'})
    except Exception as e:
        print(f"Lỗi hủy: {e}")

if __name__ == '__main__':
    socketio.run(app, debug=True)