const ThemeToggle = {
  init() {
    // Tìm nút chuyển đổi giao diện (theme toggle)
    const toggleButton = document.getElementById("theme-toggle");
    if (!toggleButton) {
      console.error("Theme toggle button not found");
      return;
    }
    // Lấy giao diện hiện tại từ localStorage, mặc định là dark
    const currentTheme = localStorage.getItem("theme") || "dark";
    document.body.classList.toggle("light-mode", currentTheme === "light");
    toggleButton.innerHTML =
      currentTheme === "light"
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';

    // Xử lý sự kiện nhấp để chuyển đổi giao diện
    toggleButton.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      const newTheme = document.body.classList.contains("light-mode")
        ? "light"
        : "dark";
      localStorage.setItem("theme", newTheme);
      toggleButton.innerHTML =
        newTheme === "light"
          ? '<i class="fas fa-sun"></i>'
          : '<i class="fas fa-moon"></i>';
    });
  },
};

const FileUpload = {
  init() {
    // Tìm các phần tử giao diện liên quan đến tải file
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-upload");
    const urlInput = document.getElementById("url-input");
    const fileNameDisplay = document.getElementById("file-name");
    const previewImage = document.getElementById("preview-image");
    const filePlaceholder = document.getElementById("file-placeholder");

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

    // Xử lý kéo thả file
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        FileUpload.previewFile(files[0]);
      }
    });

    // Cho phép nhấp vào drop zone để mở file input
    dropZone.addEventListener("click", () => fileInput.click());

    // Xử lý khi chọn file
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        FileUpload.previewFile(fileInput.files[0]);
      }
    });

    // Xử lý khi nhập URL
    urlInput.addEventListener("input", () => {
      if (urlInput.value) {
        fileNameDisplay.textContent = urlInput.value.split("/").pop();
        previewImage.src = urlInput.value;
        previewImage.style.display = "block";
        filePlaceholder.style.display = "none";
      } else {
        fileNameDisplay.textContent = "";
        previewImage.style.display = "none";
        previewImage.src = "";
        filePlaceholder.style.display = "block";
      }
    });
  },

  previewFile(file) {
    // Hiển thị bản xem trước của file được chọn
    const fileNameDisplay = document.getElementById("file-name");
    const previewImage = document.getElementById("preview-image");
    const filePlaceholder = document.getElementById("file-placeholder");

    fileNameDisplay.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewImage.style.display = "block";
      filePlaceholder.style.display = "none";
    };
    reader.readAsDataURL(file);
  },

  reset() {
    // Đặt lại giao diện tải file
    const fileInput = document.getElementById("file-upload");
    const urlInput = document.getElementById("url-input");
    const fileNameDisplay = document.getElementById("file-name");
    const previewImage = document.getElementById("preview-image");
    const filePlaceholder = document.getElementById("file-placeholder");

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

const Analysis = {
  isAnalyzing: false,
  socket: null,
  currentProgress: 0,
  progressInterval: null,

  init() {
    // Tìm các phần tử giao diện liên quan đến phân tích
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

    // Kết nối SocketIO
    Analysis.socket = io();

    // Xử lý tiến trình phân tích
    Analysis.socket.on("progress", (data) => {
      console.log("Progress update:", data);
      const targetProgress = data.percentage;

      // Làm mượt thanh tiến trình
      clearInterval(Analysis.progressInterval);
      Analysis.progressInterval = setInterval(() => {
        if (Analysis.currentProgress < targetProgress) {
          Analysis.currentProgress = Math.min(
            Analysis.currentProgress + 1,
            targetProgress
          );
          progressBar.style.width = `${Analysis.currentProgress}%`;
          percentageText.textContent = `${Math.round(
            Analysis.currentProgress
          )}%`;
          statusMessage.textContent = "Đang xử lý...";
        } else {
          clearInterval(Analysis.progressInterval);
        }
      }, 20);

      // Ẩn overlay khi hoàn tất
      if (data.percentage >= 100) {
        setTimeout(() => {
          overlay.style.opacity = "0";
          setTimeout(() => {
            overlay.style.display = "none";
            overlay.style.opacity = "1";
            Analysis.currentProgress = 0;
            progressBar.style.width = "0%";
            percentageText.textContent = "0%";
            statusMessage.textContent = "";
          }, 500);
        }, 500);
      }
    });

    // Xử lý kết quả phân tích
    Analysis.socket.on("result", (data) => {
      console.log("Analysis result:", data);
      Analysis.isAnalyzing = false;
      overlay.style.display = "none";
      if (data.status === "success") {
        Analysis.showResult(data);
        FileUpload.reset();
      } else {
        Analysis.showError(data.error);
      }
    });

    // Xử lý lỗi phân tích
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

    // Xử lý submit form phân tích
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      Analysis.handleSubmit();
    });

    // Xử lý hủy phân tích
    cancelButton.addEventListener("click", () => {
      Analysis.isAnalyzing = false;
      Analysis.resetUI();
      Analysis.showError("Phân tích đã bị hủy");
      Analysis.socket.emit("cancel");
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
    overlay.style.display = "flex";
    overlay.style.opacity = "1";
    progressBar.style.width = "0%";
    percentageText.textContent = "0%";
    statusMessage.textContent = "Bắt đầu phân tích...";

    // Gửi yêu cầu phân tích
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

  showResult(data) {
    // Hiển thị kết quả phân tích
    const resultSection = document.getElementById("result");
    const resultText = document.getElementById("result-text");
    const errorSection = document.getElementById("error");

    if (!resultSection || !resultText || !errorSection) {
      console.error("Result elements missing");
      return;
    }

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

    resultText.innerHTML = `
        <strong>Kết quả:</strong> ${data.result_vn} (${data.result})<br>
        ${warning}
        <img src="${data.original_image}" alt="Original Image" class="img-thumbnail mt-2" style="max-width: 200px;">
    `;
    resultSection.style.display = "block";
    errorSection.style.display = "none";
  },

  showError(message) {
    // Hiển thị thông báo lỗi
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

  resetUI() {
    // Đặt lại giao diện phân tích
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

const HistoryPage = {
  entriesPerPage: 5,
  currentPage: 1,

  init() {
    // Tìm container chứa các mục lịch sử
    const historyEntries = document.getElementById("history-entries");
    if (!historyEntries) {
      console.error("History entries element missing");
      return;
    }

    // Khởi tạo danh sách lịch sử, phân trang, và bộ lọc
    HistoryPage.loadEntries();
    HistoryPage.setupPagination();
    HistoryPage.setupFilters();

    // Khởi tạo Magnific Popup cho ảnh
    if (typeof $.fn.magnificPopup !== "undefined") {
      $(".image-popup").magnificPopup({
        type: "image",
        gallery: { enabled: true },
      });
    } else {
      console.warn("Magnific Popup not loaded");
    }

    // Xử lý sự kiện xóa mục lịch sử
    historyEntries.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-entry")) {
        const entryId = e.target.getAttribute("data-id");
        if (confirm("Bạn có chắc chắn muốn xóa lịch sử này?")) {
          // Gửi yêu cầu xóa tới server
          fetch(`/delete_history/${entryId}`, {
            method: "DELETE",
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.message) {
                // Làm mới danh sách lịch sử từ server
                fetch("/history")
                  .then((response) => response.text())
                  .then((html) => {
                    // Cập nhật nội dung history-entries với HTML mới
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    const newHistoryEntries =
                      doc.getElementById("history-entries");
                    if (newHistoryEntries) {
                      historyEntries.innerHTML = newHistoryEntries.innerHTML;
                      // Đặt lại trang hiện tại và làm mới giao diện
                      HistoryPage.currentPage = 1;
                      HistoryPage.loadEntries();
                      HistoryPage.setupPagination(); // Đảm bảo phân trang được thiết lập lại
                      // Khởi tạo lại Magnific Popup cho các ảnh mới
                      if (typeof $.fn.magnificPopup !== "undefined") {
                        $(".image-popup").magnificPopup({
                          type: "image",
                          gallery: { enabled: true },
                        });
                      }
                    }
                  })
                  .catch((error) => {
                    console.error("Error refreshing history:", error);
                    alert(
                      "Lỗi khi làm mới danh sách lịch sử: " + error.message
                    );
                  });
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

    // Xử lý sự kiện hiển thị/ẩn chi tiết (nếu có)
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

  loadEntries() {
    // Tìm các phần tử bộ lọc và danh sách lịch sử
    const historyEntries = document.getElementById("history-entries");
    const dateFilter = document.getElementById("date-filter");
    const modelFilter = document.getElementById("model-filter");

    if (!historyEntries || !dateFilter || !modelFilter) {
      console.error("History filter elements missing");
      return;
    }

    // Lấy danh sách các mục lịch sử
    let entries = Array.from(historyEntries.children).filter((child) =>
      child.classList.contains("history-entry")
    );
    const dateValue = dateFilter.value;
    const modelValue = modelFilter.value;

    // Lọc các mục lịch sử
    entries.forEach((entry) => {
      // Lấy timestamp từ thuộc tính data-timestamp
      const timestampElement = entry.querySelector(".card-header h3");
      const timestamp = timestampElement
        ? timestampElement.getAttribute("data-timestamp")
        : "";
      const dateFromTimestamp = timestamp ? timestamp.split(" ")[0] : "";

      // Lấy danh sách mô hình từ các phần tử .model-name
      const modelElements = entry.querySelectorAll(".model-name");
      const modelNames = Array.from(modelElements).map((el) =>
        el.textContent.trim()
      );

      let matchesDate = true;
      let matchesModel = true;

      // Lọc theo ngày
      if (dateValue && dateFromTimestamp) {
        matchesDate = dateFromTimestamp === dateValue;
      }

      // Lọc theo mô hình
      if (modelValue !== "all") {
        matchesModel = modelNames.some((name) => {
          // Chuẩn hóa tên mô hình để so sánh
          const normalizedModelValue = modelValue
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();
          const normalizedModelName = name
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();
          return normalizedModelName.includes(normalizedModelValue);
        });
      }

      // Hiển thị hoặc ẩn mục lịch sử
      entry.style.display = matchesDate && matchesModel ? "" : "none";
    });

    // Cập nhật phân trang
    HistoryPage.updatePagination(entries);
  },

  setupPagination() {
    // Thiết lập sự kiện cho phân trang
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
        HistoryPage.loadEntries();
      }
    });
  },

  updatePagination(entries) {
    // Cập nhật giao diện phân trang
    const pagination = document.getElementById("pagination");
    if (!pagination) return;

    entries = entries.filter((entry) => entry.style.display !== "none");
    const totalPages = Math.ceil(entries.length / HistoryPage.entriesPerPage);
    let html = "";

    if (totalPages <= 1) {
      pagination.innerHTML = "";
      entries.forEach((entry) => {
        entry.style.display = "";
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
      entry.style.display = index >= start && index < end ? "" : "none";
    });
  },

  setupFilters() {
    // Thiết lập sự kiện cho bộ lọc
    const dateFilter = document.getElementById("date-filter");
    const modelFilter = document.getElementById("model-filter");

    if (!dateFilter || !modelFilter) {
      console.error("Filter elements missing");
      return;
    }

    dateFilter.addEventListener("change", () => {
      HistoryPage.currentPage = 1;
      HistoryPage.loadEntries();
    });

    modelFilter.addEventListener("change", () => {
      HistoryPage.currentPage = 1;
      HistoryPage.loadEntries();
    });
  },
};

const ScrollToTop = {
  init() {
    // Thiết lập nút cuộn lên đầu
    const button = document.getElementById("scroll-to-top");
    if (!button) {
      console.error("Scroll to top button missing");
      return;
    }

    window.addEventListener("scroll", () => {
      button.style.display = window.scrollY > 200 ? "block" : "none";
    });

    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  },
};

const LoadingScreen = {
  init() {
    // Thiết lập màn hình tải
    const loadingDiv = document.getElementById("loading");
    if (!loadingDiv) {
      console.error("Loading screen element missing");
      return;
    }

    loadingDiv.style.display = "flex";

    window.addEventListener("load", () => {
      setTimeout(() => {
        loadingDiv.style.opacity = "0";
        setTimeout(() => {
          loadingDiv.style.display = "none";
        }, 500);
      }, 1000);
    });

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

// Khởi tạo tất cả các module khi tải trang
document.addEventListener("DOMContentLoaded", () => {
  ThemeToggle.init();
  FileUpload.init();
  Analysis.init();
  HistoryPage.init();
  ScrollToTop.init();
  LoadingScreen.init();
});
