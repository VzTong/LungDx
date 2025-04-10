const socket = io();
let analysisInProgress = false;
let fakeProgressInterval;

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

if (themeToggle) {
    console.log('Theme toggle button found, attaching event listener');
    themeToggle.addEventListener('click', () => {
        console.log('Theme toggle clicked');
        body.classList.toggle('dark-mode');
        body.classList.toggle('light-mode');
        const isDarkMode = body.classList.contains('dark-mode');
        themeToggle.innerHTML = isDarkMode
            ? '<i class="fas fa-moon"></i>'
            : '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        console.log('Theme set to:', isDarkMode ? 'dark' : 'light');
    });
} else {
    console.error('Theme toggle button not found');
}

// Load Theme from Local Storage
const savedTheme = localStorage.getItem('theme') || 'dark';
console.log('Applying theme:', savedTheme);
body.classList.add(savedTheme + '-mode');
if (themeToggle) {
    themeToggle.innerHTML = body.classList.contains('dark-mode')
        ? '<i class="fas fa-moon"></i>'
        : '<i class="fas fa-sun"></i>';
}

// Scroll to Top Button
const scrollToTopBtn = document.getElementById('scroll-to-top');
if (scrollToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
} else {
    console.error('Scroll to top button not found');
}

// Navbar Transparency on Scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
});

// Hide Loading Screen
window.addEventListener('load', () => {
    setTimeout(() => {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }, 1500);
});

// Fallback: Hide loading screen after 5 seconds if 'load' event fails
setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
}, 5000);

// Preview Image
const fileUpload = document.getElementById('file-upload');
if (fileUpload) {
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const preview = document.getElementById('preview-image');
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        }
    });
}

// SocketIO for Analysis (Index Page)
if (document.getElementById('upload-form')) {
    socket.on('connect', () => {
        console.log('Đã kết nối tới SocketIO server');
    });

    socket.on('result', (data) => {
        console.log('Dữ liệu nhận từ backend:', data);
        displayResult(data);
    });

    socket.on('progress', (data) => {
        const progress = document.getElementById('progress');
        const percentageText = document.getElementById('percentage');
        progress.style.width = `${data.percentage}%`;
        percentageText.textContent = `${data.percentage}%`;
        if (fakeProgressInterval) {
            clearInterval(fakeProgressInterval);
        }
        if (data.percentage < 100) {
            let fakeProgress = data.percentage;
            fakeProgressInterval = setInterval(() => {
                if (fakeProgress < Math.min(data.percentage + 10, 99)) {
                    fakeProgress += 0.5;
                    progress.style.width = `${fakeProgress}%`;
                    percentageText.textContent = `${Math.round(fakeProgress)}%`;
                }
            }, 50);
        }
    });

    socket.on('error', (data) => {
        displayResult({ error: data.message });
    });

    socket.on('analysis_cancelled', (data) => {
        console.log(data.message);
        displayResult({ error: 'Phân tích đã bị hủy' });
    });

    document.getElementById('upload-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (analysisInProgress) return;

        const overlay = document.getElementById('analyzing-overlay');
        const progress = document.getElementById('progress');
        const percentageText = document.getElementById('percentage');

        overlay.style.display = 'flex';
        progress.style.width = '0%';
        percentageText.textContent = '0%';

        analysisInProgress = true;
        const formData = new FormData(e.target);

        fetch('/analyze', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                displayResult({ error: data.error });
            }
        })
        .catch(error => {
            displayResult({ error: `Lỗi gửi yêu cầu: ${error.message}` });
        });
    });

    function displayResult(data) {
        console.log('Hiển thị kết quả:', data);
        const overlay = document.getElementById('analyzing-overlay');
        const resultDiv = document.getElementById('result');
        const errorDiv = document.getElementById('error');
        const resultText = document.getElementById('result-text');
        const errorMessage = document.getElementById('error-message');

        overlay.style.display = 'none';
        if (fakeProgressInterval) clearInterval(fakeProgressInterval);
        analysisInProgress = false;

        if (data.error) {
            errorMessage.textContent = `Lỗi: ${data.error}`;
            errorDiv.style.display = 'block';
            resultDiv.style.display = 'none';
        } else {
            const isHealthy = data.result === 'Normal';
            resultText.textContent = isHealthy
                ? 'Không phát hiện bệnh phổi'
                : `Phát hiện bệnh: ${data.result} (Độ tin cậy: ${data.confidence.toFixed(2)}%)`;

            // Thêm class để định dạng màu sắc
            resultDiv.classList.remove('result-healthy', 'result-disease');
            resultDiv.classList.add(isHealthy ? 'result-healthy' : 'result-disease');

            resultDiv.style.display = 'block';
            errorDiv.style.display = 'none';
        }
    }

    document.getElementById('cancel-button').addEventListener('click', () => {
        if (analysisInProgress) {
            socket.emit('cancel_analysis');
            document.getElementById('analyzing-overlay').style.display = 'none';
            if (fakeProgressInterval) clearInterval(fakeProgressInterval);
            analysisInProgress = false;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && analysisInProgress) {
            socket.emit('cancel_analysis');
            document.getElementById('analyzing-overlay').style.display = 'none';
            if (fakeProgressInterval) clearInterval(fakeProgressInterval);
            analysisInProgress = false;
        }
    });
}

// Handle Model Selection and Display Details
const modelSelect = document.getElementById('model-select');
if (modelSelect) {
    modelSelect.addEventListener('change', function () {
        const selectedModel = this.value;
        const accordionItems = document.querySelectorAll('#outerModelAccordion .accordion-item');

        accordionItems.forEach(item => {
            const modelName = item.querySelector('.model-title').textContent.trim();
            if (modelName === selectedModel) {
                item.classList.add('show');
                item.querySelector('.accordion-collapse').classList.add('show');
            } else {
                item.classList.remove('show');
                item.querySelector('.accordion-collapse').classList.remove('show');
            }
        });
    });

    window.addEventListener('load', () => {
        const defaultModel = modelSelect.value;
        const accordionItems = document.querySelectorAll('#outerModelAccordion .accordion-item');
        accordionItems.forEach(item => {
            const modelName = item.querySelector('.model-title').textContent.trim();
            if (modelName === defaultModel) {
                item.classList.add('show');
                item.querySelector('.accordion-collapse').classList.add('show');
            } else {
                item.classList.remove('show');
                item.querySelector('.accordion-collapse').classList.remove('show');
            }
        });
    });
}

// History Page Functionality
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('history-entries')) {
        console.log('History entries found, initializing pagination, image modal, and delete functionality');
        const entriesPerPage = 3;
        const historyContainer = document.getElementById('history-entries');
        let entries = Array.from(document.querySelectorAll('.history-entry'));
        const totalEntries = entries.length;
        const totalPages = Math.ceil(totalEntries / entriesPerPage);
        let currentPage = 1;

        function sortEntriesByTimestamp() {
            entries.sort((a, b) => {
                const timestampA = a.querySelector('h3')?.textContent.replace('Phân tích lúc: ', '').trim() || '';
                const timestampB = b.querySelector('h3')?.textContent.replace('Phân tích lúc: ', '').trim() || '';
                return new Date(timestampB) - new Date(timestampA);
            });

            entries.forEach(entry => historyContainer.removeChild(entry));
            entries.forEach(entry => historyContainer.appendChild(entry));
        }

        function showPage(page) {
            console.log('Showing page:', page);
            entries.forEach((entry, index) => {
                entry.style.display = (index >= (page - 1) * entriesPerPage && index < page * entriesPerPage) ? 'block' : 'none';
            });

            const pagination = document.getElementById('pagination');
            pagination.innerHTML = '';

            const prevLi = document.createElement('li');
            prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
            prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">«</span></a>`;
            prevLi.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentPage > 1) {
                    currentPage--;
                    showPage(currentPage);
                }
            });
            pagination.appendChild(prevLi);

            for (let i = 1; i <= totalPages; i++) {
                const li = document.createElement('li');
                li.className = 'page-item' + (i === page ? ' active' : '');
                li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
                li.addEventListener('click', (e) => {
                    e.preventDefault();
                    currentPage = i;
                    showPage(currentPage);
                });
                pagination.appendChild(li);
            }

            const nextLi = document.createElement('li');
            nextLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
            nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">»</span></a>`;
            nextLi.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentPage < totalPages) {
                    currentPage++;
                    showPage(currentPage);
                }
            });
            pagination.appendChild(nextLi);
        }

        if (totalEntries > 0) {
            sortEntriesByTimestamp();
            showPage(currentPage);
        } else {
            console.warn('No history entries found');
        }

        // Toggle Details Section
        document.querySelectorAll('.toggle-details').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-id');
                const detailsSection = document.getElementById(`details-${id}`);
                if (detailsSection.style.display === 'none' || detailsSection.style.display === '') {
                    detailsSection.style.display = 'block';
                    button.textContent = 'Ẩn so sánh mô hình';
                } else {
                    detailsSection.style.display = 'none';
                    button.textContent = 'Xem so sánh mô hình';
                }
            });
        });

        // Image Popup with Magnific Popup
        $('.image-popup').magnificPopup({
            type: 'image',
            closeOnContentClick: true,
            closeBtnInside: false,
            fixedContentPos: true,
            mainClass: 'mfp-no-margins mfp-with-zoom',
            gallery: {
                enabled: true,
                navigateByImgClick: true,
                preload: [0, 1]
            },
            image: {
                verticalFit: true
            },
            zoom: {
                enabled: true,
                duration: 300
            }
        });

        // Delete History Entry
        const deleteButtons = document.querySelectorAll('.delete-entry');
        if (deleteButtons.length > 0) {
            console.log('Found', deleteButtons.length, 'delete buttons, attaching click events');
            deleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const index = parseInt(button.getAttribute('data-id'));
                    if (confirm('Bạn có chắc chắn muốn xóa mục này?')) {
                        fetch(`/delete_history/${index}`, {
                            method: 'DELETE'
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.message) {
                                alert(data.message);
                                const entry = document.querySelector(`.history-entry[data-id="${index}"]`);
                                if (entry) {
                                    entry.remove();
                                    entries = Array.from(document.querySelectorAll('.history-entry'));
                                    if (entries.length === 0) {
                                        historyContainer.innerHTML = '<p class="text-center">Không có dữ liệu lịch sử phân tích.</p>';
                                    } else {
                                        sortEntriesByTimestamp();
                                        showPage(currentPage);
                                    }
                                }
                            } else if (data.error) {
                                alert('Lỗi: ' + data.error);
                            }
                        })
                        .catch(error => {
                            console.error('Lỗi khi xóa:', error);
                            alert('Lỗi không xác định khi xóa mục lịch sử');
                        });
                    }
                });
            });
        } else {
            console.warn('No delete buttons found');
        }
    }

    // Handle Upload Box Click and Drag & Drop
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-upload');
    const fileNameDisplay = document.getElementById('file-name');

    if (dropZone && fileInput && fileNameDisplay) {
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                fileNameDisplay.textContent = files[0].name;
                const preview = document.getElementById('preview-image');
                preview.src = URL.createObjectURL(files[0]);
                preview.style.display = 'block';
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                const preview = document.getElementById('preview-image');
                preview.src = URL.createObjectURL(file);
                preview.style.display = 'block';
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    } else {
        console.error('Drop zone, file input, or file name display not found');
    }
});