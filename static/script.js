/* Module ThemeToggle: Quản lý chuyển đổi giao diện sáng/tối */
const ThemeToggle = {
  init() {
    // Lấy nút chuyển đổi theme
    const toggleButton = document.getElementById("theme-toggle");
    if (!toggleButton) {
      console.error("Theme toggle button not found");
      return;
    }
    // Kiểm tra theme hiện tại từ localStorage, mặc định là "dark"
    const currentTheme = localStorage.getItem("theme") || "dark";
    // Áp dụng theme sáng nếu currentTheme là "light"
    document.body.classList.toggle("light-mode", currentTheme === "light");
    // Cập nhật biểu tượng nút (mặt trời cho sáng, mặt trăng cho tối)
    toggleButton.innerHTML =
      currentTheme === "light"
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';

    // Thêm sự kiện click để chuyển đổi theme
    toggleButton.addEventListener("click", () => {
      // Chuyển đổi class light-mode trên body
      document.body.classList.toggle("light-mode");
      // Xác định theme mới và lưu vào localStorage
      const newTheme = document.body.classList.contains("light-mode")
        ? "light"
        : "dark";
      localStorage.setItem("theme", newTheme);
      // Cập nhật biểu tượng nút
      toggleButton.innerHTML =
        newTheme === "light"
          ? '<i class="fas fa-sun"></i>'
          : '<i class="fas fa-moon"></i>';
    });
  },
};

/* Module FileUpload: Quản lý tải lên file ảnh và nhập URL */
const FileUpload = {
  init() {
    // Lấy các phần tử DOM liên quan đến upload
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-upload");
    const urlInput = document.getElementById("url-input");
    const fileNameDisplay = document.getElementById("file-name");
    const previewImage = document.getElementById("preview-image");
    const filePlaceholder = document.getElementById("file-placeholder");

    // Kiểm tra xem các phần tử có tồn tại không
    if (
      !dropZone ||
      !fileInput ||
      !urlInput ||
      !fileNameDisplay ||
      !previewImage ||
      !filePlaceholder
    ) {
      console.error("Upload elements missing");
      return;
    }

    // Xử lý sự kiện dragover để highlight vùng thả file
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    // Xóa highlight khi rời vùng thả
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    // Xử lý thả file vào dropZone
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files; // Gán file vào input
        FileUpload.previewFile(files[0]); // Xem trước file
      }
    });

    // Xử lý click vào dropZone để mở hộp thoại chọn file
    dropZone.addEventListener("click", (e) => {
      // Ngăn mở hộp thoại nếu click vào urlInput
      if (e.target === urlInput || urlInput.contains(e.target)) {
        return; // Thoát sớm để urlInput hoạt động bình thường
      }
      fileInput.click(); // Mở hộp thoại chọn file
    });

    // Ngăn sự kiện click từ urlInput lan truyền lên dropZone
    urlInput.addEventListener("click", (e) => {
      e.stopPropagation(); // Ngăn bubbling để không kích hoạt fileInput
    });

    // Xử lý khi chọn file qua input
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        FileUpload.previewFile(fileInput.files[0]); // Xem trước file
      }
    });

    // Xử lý nhập URL để xem trước ảnh
    urlInput.addEventListener("input", () => {
      if (urlInput.value) {
        // Hiển thị tên file từ URL và xem trước ảnh
        fileNameDisplay.textContent = urlInput.value.split("/").pop();
        previewImage.src = urlInput.value;
        previewImage.style.display = "block";
        filePlaceholder.style.display = "none";
      } else {
        // Reset khi xóa URL
        fileNameDisplay.textContent = "";
        previewImage.style.display = "none";
        previewImage.src = "";
        filePlaceholder.style.display = "block";
      }
    });
  },

  // Hàm xem trước file ảnh
  previewFile(file) {
    const fileNameDisplay = document.getElementById("file-name");
    const previewImage = document.getElementById("preview-image");
    const filePlaceholder = document.getElementById("file-placeholder");

    fileNameDisplay.textContent = file.name; // Hiển thị tên file
    const reader = new FileReader();
    reader.onload = (e) => {
      // Hiển thị ảnh xem trước
      previewImage.src = e.target.result;
      previewImage.style.display = "block";
      filePlaceholder.style.display = "none";
    };
    reader.readAsDataURL(file); // Đọc file thành data URL
  },

  // Reset giao diện upload
  reset() {
    const fileInput = document.getElementById("file-upload");
    const urlInput = document.getElementById("url-input");
    const fileNameDisplay = document.getElementById("file-name");
    const previewImage = document.getElementById("preview-image");
    const filePlaceholder = document.getElementById("file-placeholder");

    // Xóa dữ liệu input và giao diện
    if (fileInput) fileInput.value = "";
    if (urlInput) urlInput.value = "";
    if (fileNameDisplay) fileNameDisplay.textContent = "";
    if (previewImage) {
      previewImage.src = "";
      previewImage.style.display = "none";
    }
    if (filePlaceholder) filePlaceholder.style.display = "block";
  },
};

/* Module Analysis: Quản lý quá trình phân tích ảnh X-quang */
const Analysis = {
  isAnalyzing: false, // Trạng thái phân tích
  socket: null, // SocketIO instance
  currentProgress: 0, // Tiến trình hiện tại
  progressInterval: null, // Interval để làm mượt thanh tiến trình

  init() {
    // Lấy các phần tử DOM
    const form = document.getElementById("upload-form");
    const overlay = document.getElementById("analyzing-overlay");
    const progressBar = document.getElementById("progress");
    const percentageText = document.getElementById("percentage");
    const statusMessage = document.getElementById("status-message");
    const cancelButton = document.getElementById("cancel-button");

    if (
      !form ||
      !overlay ||
      !progressBar ||
      !percentageText ||
      !statusMessage ||
      !cancelButton
    ) {
      console.error("Analysis elements missing");
      return;
    }

    // Khởi tạo SocketIO
    Analysis.socket = io();

    // Xử lý cập nhật tiến trình từ server
    Analysis.socket.on("progress", (data) => {
      console.log("Progress update:", data);
      const targetProgress = data.percentage;

      // Làm mượt thanh tiến trình
      clearInterval(Analysis.progressInterval);
      Analysis.progressInterval = setInterval(() => {
        if (Analysis.currentProgress < targetProgress) {
          Analysis.currentProgress = Math.min(Analysis.currentProgress + 1, targetProgress);
          progressBar.style.width = `${Analysis.currentProgress}%`;
          percentageText.textContent = `${Math.round(Analysis.currentProgress)}%`;
          statusMessage.textContent = "Đang xử lý...";
        } else {
          clearInterval(Analysis.progressInterval);
        }
      }, 20); // Cập nhật mỗi 20ms

      // Xử lý khi đạt 100%
      if (data.percentage >= 100) {
        setTimeout(() => {
          overlay.style.opacity = '0'; // Mờ dần overlay
          setTimeout(() => {
            // Ẩn overlay và reset UI
            overlay.style.display = 'none';
            overlay.style.opacity = '1';
            Analysis.currentProgress = 0;
            progressBar.style.width = '0%';
            percentageText.textContent = '0%';
            statusMessage.textContent = '';
          }, 500); // Chờ hiệu ứng mờ
        }, 500); // Giữ 500ms sau 100%
      }
    });

    // Xử lý kết quả phân tích
    Analysis.socket.on("result", (data) => {
      console.log("Analysis result:", data);
      Analysis.isAnalyzing = false;
      overlay.style.display = "none";
      if (data.status === "success") {
        Analysis.showResult(data); // Hiển thị kết quả
        FileUpload.reset(); // Reset giao diện upload
      } else {
        Analysis.showError(data.error); // Hiển thị lỗi
      }
    });

    // Xử lý lỗi từ server
    Analysis.socket.on("error", (data) => {
      console.log("Analysis error:", data);
      Analysis.isAnalyzing = false;
      overlay.style.display = "none";
      Analysis.showError(data.message);
    });

    // Khởi tạo giao diện
    overlay.style.display = "none";
    progressBar.style.width = "0%";
    percentageText.textContent = "0%";
    statusMessage.textContent = "";

    // Xử lý submit form
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      Analysis.handleSubmit();
    });

    // Xử lý nút hủy
    cancelButton.addEventListener("click", () => {
      Analysis.isAnalyzing = false;
      Analysis.resetUI();
      Analysis.showError("Phân tích đã bị hủy");
      Analysis.socket.emit("cancel"); // Gửi yêu cầu hủy đến server
    });

    // Kiểm tra trạng thái mô hình
    console.log("Checking model status...");
    fetch("/model_status")
      .then((response) => response.json())
      .then((data) => {
        console.log("Model status:", data);
        if (data.error) {
          Analysis.showError("Lỗi tải mô hình: " + data.error);
        } else {
          // Vô hiệu hóa mô hình không khả dụng
          Object.keys(data).forEach((model) => {
            if (!data[model]) {
              const option = document.querySelector(
                `#model-select option[value="${model}"]`
              );
              if (option) option.disabled = true;
            }
          });
        }
      })
      .catch((error) => {
        console.error("Error checking model status:", error);
        Analysis.showError("Lỗi kiểm tra trạng thái mô hình: " + error.message);
      });
  },

  // Xử lý submit form phân tích
  handleSubmit() {
    // Ngăn gửi nhiều yêu cầu phân tích cùng lúc
    if (Analysis.isAnalyzing) {
      console.log("Analysis already in progress");
      return;
    }

    // Tìm các phần tử form
    const fileInput = document.getElementById("file-upload");
    const urlInput = document.getElementById("url-input");
    const modelSelect = document.getElementById("model-select");

    if (!fileInput || !urlInput || !modelSelect) {
      console.error("Form elements missing");
      Analysis.showError("Lỗi giao diện: Thiếu thành phần biểu mẫu");
      return;
    }

    // Kiểm tra xem có file hoặc URL hay không
    if (!fileInput.files.length && !urlInput.value) {
      Analysis.showError("Vui lòng chọn file hoặc nhập URL");
      return;
    }

    // Hiển thị overlay phân tích
    Analysis.isAnalyzing = true;
    const overlay = document.getElementById("analyzing-overlay");
    const progressBar = document.getElementById("progress");
    const percentageText = document.getElementById("percentage");
    const statusMessage = document.getElementById("status-message");
    // Hiển thị overlay phân tích
    overlay.style.display = "flex";
    overlay.style.opacity = "1";
    progressBar.style.width = "0%";
    percentageText.textContent = "0%";
    statusMessage.textContent = "Bắt đầu phân tích...";

    // Tạo form data để gửi lên server
    const formData = new FormData();
    formData.append("model", modelSelect.value);
    formData.append("sid", Analysis.socket.id);
    if (fileInput.files.length) formData.append("file", fileInput.files[0]);
    if (urlInput.value) formData.append("url", urlInput.value);

    console.log("Sending /analyze request:", {
      model: modelSelect.value,
      file: fileInput.files[0]?.name,
      url: urlInput.value,
    });
    // Gửi yêu cầu phân tích
    fetch("/analyze", {
      method: "POST",
      body: formData,
    }).catch((error) => {
      console.error("Analysis error:", error);
      Analysis.isAnalyzing = false;
      overlay.style.display = "none";
      progressBar.style.width = "0%";
      percentageText.textContent = "0%";
      statusMessage.textContent = "";
      Analysis.showError("Lỗi kết nối: " + error.message);
    });
  },

  // Hiển thị kết quả phân tích
  showResult(data) {
    const resultSection = document.getElementById("result");
    const resultText = document.getElementById("result-text");
    const errorSection = document.getElementById("error");

    if (!resultSection || !resultText || !errorSection) {
      console.error("Result elements missing");
      return;
    }

    // Xử lý cảnh báo cho viêm phổi
    let warning = "";
    if (data.warning) {
      warning = `<p style="color: orange;"><em>${data.warning}</em></p>`;
    } else if (
      data.result === "Bacterial Pneumonia" ||
      data.result === "Viral Pneumonia"
    ) {
      warning =
        '<p style="color: orange;"><em>Lưu ý: Dự đoán cho Viêm phổi do vi khuẩn hoặc virus có thể không chính xác do hạn chế của mô hình.</em></p>';
    }

    // Hiển thị kết quả và ảnh
    resultText.innerHTML = `
        <strong>Kết quả:</strong> ${data.result_vn} (${data.result})<br>
        ${warning}
        <img src="${data.original_image}" alt="Original Image" class="img-thumbnail mt-2" style="max-width: 200px;">
    `;
    resultSection.style.display = "block";
    errorSection.style.display = "none";
  },

  // Hiển thị thông báo lỗi
  showError(message) {
    const errorSection = document.getElementById("error");
    const errorMessage = document.getElementById("error-message");

    if (!errorSection || !errorMessage) {
      console.error("Error elements missing");
      return;
    }

    errorMessage.textContent = message;
    errorSection.style.display = "block";
    const resultSection = document.getElementById("result");
    if (resultSection) resultSection.style.display = "none";
  },

  // Reset giao diện phân tích
  resetUI() {
    const overlay = document.getElementById("analyzing-overlay");
    const progressBar = document.getElementById("progress");
    const percentageText = document.getElementById("percentage");
    const statusMessage = document.getElementById("status-message");

    if (overlay) {
      overlay.style.display = "none";
      overlay.style.opacity = "1";
    }
    if (progressBar) progressBar.style.width = "0%";
    if (percentageText) percentageText.textContent = "0%";
    if (statusMessage) statusMessage.textContent = "";
  },
};

/* Module HistoryPage: Quản lý hiển thị lịch sử phân tích */
const HistoryPage = {
  entriesPerPage: 4, // Số mục hiển thị mỗi trang
  currentPage: 1, // Trang hiện tại
  isLoading: false, // Trạng thái để ngăn vòng lặp tải

  init() {
    // Lấy container lịch sử
    const historyEntries = document.getElementById("history-entries");
    if (!historyEntries) {
      console.error("History entries element missing");
      return;
    }

    // Tải danh sách lịch sử
    HistoryPage.loadEntries();
    HistoryPage.setupPagination(); // Thiết lập phân trang
    HistoryPage.setupFilters(); // Thiết lập bộ lọc

    // Khởi tạo Magnific Popup cho ảnh
    if (typeof $.fn.magnificPopup !== "undefined") {
      $(".image-popup").magnificPopup({
        type: "image",
        gallery: { enabled: true },
      });
    } else {
      console.warn("Magnific Popup not loaded");
    }

    // Xử lý xóa mục lịch sử
    historyEntries.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-entry")) {
        const entryId = e.target.getAttribute("data-id");
        if (confirm("Bạn có chắc chắn muốn xóa lịch sử này?")) {
          fetch(`/delete_history/${entryId}`, {
            method: "DELETE",
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.message) {
                HistoryPage.loadEntries(); // Tải lại lịch sử sau khi xóa
              } else {
                alert(data.error || "Lỗi khi xóa lịch sử");
              }
            })
            .catch((error) => {
              alert("Lỗi khi xóa: " + error.message);
            });
        }
      }
    });

    // Xử lý hiển thị/ẩn chi tiết lịch sử
    historyEntries.addEventListener("click", (e) => {
      if (e.target.classList.contains("toggle-details")) {
        const entryId = e.target.getAttribute("data-id");
        const detailsDiv = document.getElementById(`details-${entryId}`);
        if (detailsDiv) {
          detailsDiv.style.display =
            detailsDiv.style.display === "none" ? "block" : "none";
        }
      }
    });
  },

  // Tải và hiển thị danh sách lịch sử
  loadEntries() {
    // Ngăn gọi lại nếu đang tải
    if (HistoryPage.isLoading) {
      console.log("LoadEntries already in progress, skipping...");
      return;
    }
    HistoryPage.isLoading = true;

    const historyEntries = document.getElementById("history-entries");
    const dateFilter = document.getElementById("date-filter");
    const modelFilter = document.getElementById("model-filter");

    // Kiểm tra các phần tử DOM cần thiết
    if (!historyEntries || !dateFilter || !modelFilter) {
      console.error("History filter elements missing");
      HistoryPage.isLoading = false;
      return;
    }

    // Lấy danh sách các mục lịch sử
    let entries = Array.from(historyEntries.children).filter((child) =>
      child.classList.contains("history-entry")
    );

    // Sắp xếp lịch sử theo thời gian giảm dần (mới nhất trên cùng) dựa trên data-timestamp
    entries.sort((a, b) => {
      try {
        const timestampA = a.querySelector(".card-header h3").getAttribute("data-timestamp") || "1970-01-01 00:00:00";
        const timestampB = b.querySelector(".card-header h3").getAttribute("data-timestamp") || "1970-01-01 00:00:00";
        console.log(`Sorting: ${timestampA} vs ${timestampB}`); // Debug timestamp
        return new Date(timestampB).getTime() - new Date(timestampA).getTime(); // So sánh giảm dần
      } catch (e) {
        console.error("Error sorting timestamps:", e);
        return 0; // Giữ nguyên nếu lỗi
      }
    });

    // Cập nhật thứ tự DOM mà không xóa sự kiện
    const fragment = document.createDocumentFragment();
    entries.forEach(entry => fragment.appendChild(entry));
    historyEntries.appendChild(fragment);

    // Áp dụng bộ lọc ngày và mô hình
    const dateValue = dateFilter.value; // Giá trị dạng YYYY-MM-DD
    const modelValue = modelFilter.value; // Giá trị mô hình hoặc "all"

    entries.forEach((entry) => {
      // Lấy timestamp đầy đủ từ data-timestamp
      const fullTimestamp = entry.querySelector(".card-header h3").getAttribute("data-timestamp") || "";
      // Chỉ lấy phần ngày (YYYY-MM-DD) để so sánh với dateFilter
      const timestampDate = fullTimestamp ? fullTimestamp.split(" ")[0] : "";

      // Lấy danh sách mô hình từ .model-name
      const modelNames = Array.from(entry.querySelectorAll(".model-name")).map(
        (el) => el.textContent.trim() // Loại bỏ khoảng trắng thừa
      );

      let matchesDate = true;
      let matchesModel = true;

      // So sánh ngày từ timestamp với dateFilter
      if (dateValue) {
        matchesDate = timestampDate === dateValue;
      }

      // So sánh mô hình với modelFilter
      if (modelValue !== "all") {
        matchesModel = modelNames.includes(modelValue);
      }

      // Hiển thị/ẩn mục dựa trên bộ lọc
      entry.style.display = matchesDate && matchesModel ? "block" : "none";
    });

    // Kiểm tra nếu không có mục nào hiển thị sau khi lọc
    const visibleEntries = entries.filter(entry => entry.style.display === "block");
    const noResultsMessage = document.getElementById("no-filter-results");
    if (visibleEntries.length === 0 && (dateValue || modelValue !== "all")) {
      if (!noResultsMessage) {
        const message = document.createElement("p");
        message.id = "no-filter-results";
        message.textContent = "Không tìm thấy kết quả phù hợp.";
        historyEntries.appendChild(message);
      }
    } else {
      if (noResultsMessage) {
        noResultsMessage.remove();
      }
    }

    // Cập nhật phân trang
    HistoryPage.updatePagination(entries);

    // Kết thúc tải
    HistoryPage.isLoading = false;
  },

  // Thiết lập sự kiện cho phân trang
  setupPagination() {
    const pagination = document.getElementById("pagination");
    if (!pagination) {
      console.error("Pagination element missing");
      return;
    }

    pagination.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        e.preventDefault();
        const page = parseInt(e.target.getAttribute("data-page"));
        HistoryPage.currentPage = page;
        HistoryPage.loadEntries(); // Tải lại lịch sử cho trang mới
      }
    });
  },

  // Cập nhật giao diện phân trang
  updatePagination(entries) {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;

    // Lọc các mục hiển thị
    entries = entries.filter((entry) => entry.style.display === "block");
    const totalPages = Math.ceil(entries.length / HistoryPage.entriesPerPage);
    let html = "";

    // Nếu chỉ có 1 trang, xóa phân trang
    if (totalPages <= 1) {
      pagination.innerHTML = "";
      entries.forEach((entry) => {
        entry.style.display = "block";
      });
      return;
    }

    // Tạo nút "Trước"
    html += `<li class="page-item ${
      HistoryPage.currentPage === 1 ? "disabled" : ""
    }">
                    <a class="page-link" href="#" data-page="${
                      HistoryPage.currentPage - 1
                    }">«</a>
                 </li>`;

    // Tạo các nút trang
    for (let i = 1; i <= totalPages; i++) {
      html += `<li class="page-item ${
        HistoryPage.currentPage === i ? "active" : ""
      }">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                     </li>`;
    }

    // Tạo nút "Sau"
    html += `<li class="page-item ${
      HistoryPage.currentPage === totalPages ? "disabled" : ""
    }">
                    <a class="page-link" href="#" data-page="${
                      HistoryPage.currentPage + 1
                    }">»</a>
                 </li>`;

    pagination.innerHTML = html;

    // Hiển thị các mục trong trang hiện tại
    entries.forEach((entry, index) => {
      const start = (HistoryPage.currentPage - 1) * HistoryPage.entriesPerPage;
      const end = start + HistoryPage.entriesPerPage;
      entry.style.display = index >= start && index < end ? "block" : "none";
    });
  },

  // Thiết lập bộ lọc ngày và mô hình
  setupFilters() {
    // Thiết lập sự kiện cho bộ lọc
    const dateFilter = document.getElementById("date-filter");
    const modelFilter = document.getElementById("model-filter");

    if (!dateFilter || !modelFilter) {
      console.error("Filter elements missing");
      return;
    }

    // Ngăn vòng lặp bằng cách kiểm tra thay đổi giá trị
    let lastDateValue = dateFilter.value;
    let lastModelValue = modelFilter.value;

    dateFilter.addEventListener("change", () => {
      if (dateFilter.value !== lastDateValue) {
        lastDateValue = dateFilter.value;
        HistoryPage.currentPage = 1;
        HistoryPage.loadEntries();
      }
    });

    modelFilter.addEventListener("change", () => {
      if (modelFilter.value !== lastModelValue) {
        lastModelValue = modelFilter.value;
        HistoryPage.currentPage = 1;
        HistoryPage.loadEntries();
      }
    });
  },
};

/* Module ScrollToTop: Nút cuộn lên đầu trang */
const ScrollToTop = {
  init() {
    // Thiết lập nút cuộn lên đầu
    const button = document.getElementById("scroll-to-top");
    if (!button) {
      console.error("Scroll to top button missing");
      return;
    }

    // Hiển thị/ẩn nút dựa trên vị trí cuộn
    window.addEventListener("scroll", () => {
        window.scrollY > 50 ? button.classList.add("show") : button.classList.remove("show");
    });

    // Cuộn mượt lên đầu khi click
    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  },
};

/* Module LoadingScreen: Màn hình loading khi tải trang */
const LoadingScreen = {
  init() {
    // Thiết lập màn hình tải
    const loadingDiv = document.getElementById("loading");
    if (!loadingDiv) {
      console.error("Loading screen element missing");
      return;
    }

    loadingDiv.style.display = "flex";

    // Ẩn màn hình loading sau khi trang tải xong
    window.addEventListener("load", () => {
      setTimeout(() => {
        loadingDiv.style.opacity = "0";
        setTimeout(() => {
          loadingDiv.style.display = "none";
        }, 500);
      }, 1000);
    });

    // Ẩn sau 5s nếu trang không tải xong
    setTimeout(() => {
      if (loadingDiv.style.display === "flex") {
        loadingDiv.style.opacity = "0";
        setTimeout(() => {
          loadingDiv.style.display = "none";
        }, 500);
      }
    }, 5000);
  },
};

// Khởi tạo các module khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
  ThemeToggle.init();
  FileUpload.init();
  Analysis.init();
  HistoryPage.init();
  ScrollToTop.init();
  LoadingScreen.init();
});