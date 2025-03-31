import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client@latest";

// DOM Elements
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const loadingSpinner = document.getElementById("loadingSpinner");
const efficientSection = document.getElementById("efficientSection");
const denseSection = document.getElementById("denseSection");
const scrollToTopButton = document.getElementById("scrollToTop");
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const closeModal = document.getElementsByClassName("close")[0];
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");
const navLinkItems = document.querySelectorAll(".nav-link");

// Charts storage
let charts = {};

// Initialize navigation functionality
function initNavigation() {
  // Hamburger menu toggle
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    hamburger.innerHTML = navLinks.classList.contains("active")
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-bars"></i>';
  });

  // Navigation link clicks
  navLinkItems.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const sectionId = link.getAttribute("data-section");
      const section = document.getElementById(sectionId);

      // Update active link
      navLinkItems.forEach(item => item.classList.remove("active"));
      link.classList.add("active");

      // Close mobile menu if open
      if (navLinks.classList.contains("active")) {
        navLinks.classList.remove("active");
        hamburger.innerHTML = '<i class="fas fa-bars"></i>';
      }

      // Scroll to section
      if (section) {
        window.scrollTo({
          top: section.offsetTop - 80, // Account for fixed header
          behavior: "smooth"
        });
      }
    });
  });
}

// Initialize dropdown functionality
function initDropdowns() {
  // Features dropdown
  const featuresHeader = document.getElementById("featuresHeader");
  const featuresContent = document.getElementById("featuresContent");

  featuresHeader.addEventListener("click", () => {
    featuresContent.classList.toggle("show");
    const icon = featuresHeader.querySelector("i");
    icon.style.transform = featuresContent.classList.contains("show") ? "rotate(180deg)" : "rotate(0deg)";
  });

  // Abstract dropdown
  const abstractHeader = document.getElementById("abstractHeader");
  const abstractContent = document.getElementById("abstractContent");

  abstractHeader.addEventListener("click", () => {
    abstractContent.classList.toggle("show");
    const icon = abstractHeader.querySelector("i");
    icon.style.transform = abstractContent.classList.contains("show") ? "rotate(180deg)" : "rotate(0deg)";
  });

  // Diagram dropdown
  const diagramHeader = document.getElementById("diagramHeader");
  const diagramContent = document.getElementById("diagramContent");

  diagramHeader.addEventListener("click", () => {
    diagramContent.classList.toggle("show");
    const icon = diagramHeader.querySelector("i");
    icon.style.transform = diagramContent.classList.contains("show") ? "rotate(180deg)" : "rotate(0deg)";
  });
}

// Initialize modal functionality
function initModal() {
  document.querySelectorAll('.image-links img').forEach(img => {
    img.onclick = function () {
      modal.style.display = "block";
      modalImg.src = this.src;
    }
  });

  closeModal.onclick = function () {
    modal.style.display = "none";
  }

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }
}

// Handle file upload
imageInput.addEventListener("change", async function (event) {
  const file = event.target.files[0];
  if (file) {
    // Show loading spinner
    loadingSpinner.style.display = "block";

    // Show hidden sections with animation
    efficientSection.style.display = "block";
    denseSection.style.display = "block";
    setTimeout(() => {
      efficientSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    // Preview image
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);

    try {
      await Promise.all([
        sendImageToAPI(file, "A2-Group/ovarian-cancer-efficientNetB0", "Efficient"),
        sendImageToAPI(file, "A2-Group/ovarian-cancer-densNet121", "Dense")
      ]);
    } catch (error) {
      console.error("Error processing both models:", error);
      document.getElementById(`errorEfficient`).innerText = "Error processing image. Please try again.";
      document.getElementById(`errorDense`).innerText = "Error processing image. Please try again.";
    } finally {
      loadingSpinner.style.display = "none";
    }
  }
});

// Scroll to top button
window.addEventListener("scroll", () => {
  scrollToTopButton.style.display = window.scrollY > 300 ? "flex" : "none";
});

scrollToTopButton.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Send image to API and process results
async function sendImageToAPI(file, model, prefix) {
  const resultElement = document.getElementById(`result${prefix}`);
  const errorElement = document.getElementById(`error${prefix}`);
  const imagesContainer = document.getElementById(`images${prefix}`);

  resultElement.innerHTML = `<div class="loading-spinner"></div><p>Analyzing image...</p>`;
  errorElement.innerText = "";
  imagesContainer.innerHTML = "";

  try {
    const client = await Client.connect(model);
    const result = await client.predict("/predict", { image: handle_file(file) });
    const prediction = result.data[0];
    const confidences = prediction.confidences || [];

    // Format prediction result
    const isMalignant = !prediction.label.toLowerCase().includes('benign');
    const resultClass = isMalignant ? 'malignant' : 'benign';

    const confidenceObj = confidences.find(c => c.label === prediction.label);
    const confidence = confidenceObj ? (confidenceObj.confidence * 100).toFixed(2) : "Please input Tissue Image!";

    resultElement.innerHTML = `
      <p>Diagnosis:</p>
      <div class="prediction-result ${resultClass}">
        ${prediction.label || "Invalid image"} <span class="confidence-value">(${confidence}%)</span>
      </div>
      <p>Top features detected:</p>
      <ul style="text-align: left; margin-left: 20px;">
        ${confidences.length > 0 ? confidences.slice(0, 3).map(c =>
          `<li>${c.label}: <strong>${(c.confidence * 100).toFixed(2)}%</strong></li>`
        ).join('') : "<li>No valid features detected</li>"}
      </ul>
    `;

    // Update charts
    updateCharts(prefix,
      confidences.map(c => c.label),
      confidences.map(c => c.confidence * 100)
    );

    // Display related images
    result.data.forEach(item => {
      if (item.url && item.url.endsWith(".webp")) {
        const imgContainer = document.createElement("div");
        imgContainer.className = "tooltip";

        const img = document.createElement("img");
        img.src = item.url;
        img.loading = "lazy";
        img.alt = "Similar case";

        const tooltip = document.createElement("span");
        tooltip.className = "tooltiptext";
        tooltip.textContent = "Click to enlarge";

        imgContainer.appendChild(img);
        imgContainer.appendChild(tooltip);
        imagesContainer.appendChild(imgContainer);
      }
    });

    // Re-initialize modal for new images
    initModal();

  } catch (error) {
    errorElement.innerText = "Analysis error: Please Try with Tissue Image";
    console.error(`${prefix}Net Error:`, error);
    if (prefix == "Efficient") {
      showPopup('The entered Image is not valid! Please Input Histopathology tissue image!', "Efficient Input Issue");
    }
    else if (prefix == "Dense") {
      showPopup('The entered Image is not valid! Please Input Histopathology tissue image!', "DensNet Input Issue");
    }
    else {
      showPopup('The entered Image is not valid! Please Input Histopathology tissue image!', "Error");
    }
  }
}

// Update charts with new data
function updateCharts(prefix, labels, values) {
  const barCanvas = document.getElementById(`chart${prefix}`).getContext("2d");
  const pieCanvas = document.getElementById(`pie${prefix}`).getContext("2d");

  // Destroy old charts if they exist
  if (charts[`bar${prefix}`]) charts[`bar${prefix}`].destroy();
  if (charts[`pie${prefix}`]) charts[`pie${prefix}`].destroy();

  // Create bar chart
  charts[`bar${prefix}`] = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Confidence (%)",
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
          'rgba(255, 159, 64, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.raw.toFixed(2)}%`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: "#333",
            callback: value => value + '%'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          ticks: {
            color: "#333",
            font: {
              weight: 'bold'
            }
          },
          grid: {
            display: false
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });

  // Create pie chart
  charts[`pie${prefix}`] = new Chart(pieCanvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
          'rgba(255, 159, 64, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: "#333",
            font: {
              weight: '500'
            }
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.raw.toFixed(2)}%`
          }
        }
      },
      cutout: '60%',
      animation: {
        animateScale: true,
        animateRotate: true
      }
    }
  });
}

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initDropdowns();

  // Set initial active nav link based on scroll position
  window.addEventListener("scroll", () => {
    const scrollPosition = window.scrollY + 100;

    document.querySelectorAll("section, div[id]").forEach(section => {
      const sectionId = section.id;
      if (sectionId && document.querySelector(`.nav-link[data-section="${sectionId}"]`)) {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          navLinkItems.forEach(link => link.classList.remove("active"));
          document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add("active");
        }
      }
    });
  });
});

function showPopup(message, model) {
  document.getElementById('popupMessage').innerText = message;
  document.getElementById('popup-title').innerText = model;
  document.getElementById('popupContainer').style.display = 'flex';
}

function closePopup() {
  document.getElementById('popupContainer').style.display = 'none';
}

document.getElementById('closePopupBtn').addEventListener('click', closePopup);