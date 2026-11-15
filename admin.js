// =====================================
// CHUDDNJAAN ADMIN - CLOUDFLARE WORKER
// =====================================

const API_URL = "https://silent-woochuddnjaan-api.islambro6350.workers.dev";

let adminToken = sessionStorage.getItem("chuddnjaan_admin_token") || "";
let editingVideoId = null;

const $ = id => document.getElementById(id);

function showMessage(id, message, color = "#fff") {
    const element = $(id);
    if (element) {
        element.textContent = message;
        element.style.color = color;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || data.message || "सर्वर से अनुरोध पूरा नहीं हुआ।");
    }

    return data;
}

// =====================================
// LOGIN
// =====================================

async function login(event) {
    event.preventDefault();

    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;

    showMessage("loginMessage", "⏳ Login हो रहा है...");

    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        adminToken = data.token || data.access_token || "";

        if (!adminToken) {
            throw new Error("Login Token नहीं मिला। Worker के Login Response की जाँच करें।");
        }

        sessionStorage.setItem("chuddnjaan_admin_token", adminToken);

        showDashboard();
        await loadAdminVideos();

    } catch (error) {
        showMessage("loginMessage", "❌ " + error.message, "#ff5555");
    }
}

// =====================================
// VERIFY LOGIN
// =====================================

async function verifyLogin() {
    if (!adminToken) {
        showLogin();
        return;
    }

    try {
        await apiRequest("/api/admin/verify");
        showDashboard();
        await loadAdminVideos();
    } catch (error) {
        adminToken = "";
        sessionStorage.removeItem("chuddnjaan_admin_token");
        showLogin();
    }
}

function showLogin() {
    $("loginSection").style.display = "block";
    $("dashboardSection").style.display = "none";
}

function showDashboard() {
    $("loginSection").style.display = "none";
    $("dashboardSection").style.display = "block";
}

// =====================================
// LOGOUT
// =====================================

async function logout() {
    try {
        await apiRequest("/api/logout", {
            method: "POST",
            body: JSON.stringify({})
        });
    } catch (error) {
        console.log("Logout:", error.message);
    }

    adminToken = "";
    sessionStorage.removeItem("chuddnjaan_admin_token");
    showLogin();
}

// =====================================
// LOAD ADMIN VIDEOS
// =====================================

async function loadAdminVideos() {
    const container = $("adminVideosContainer");

    container.innerHTML = '<p class="loading">⏳ वीडियो लोड हो रहे हैं...</p>';

    try {
        const data = await apiRequest("/api/admin/videos");
        const videos = data.videos || [];

        $("totalVideos").textContent =
            data.total_videos ?? videos.length;

        $("totalClicks").textContent =
            data.total_clicks ?? 0;

        if (videos.length === 0) {
            container.innerHTML =
                '<p class="loading">अभी कोई वीडियो नहीं जोड़ा गया है।</p>';
            return;
        }

        container.innerHTML = videos.map(video => {
            const id = Number(video.id);

            return `
                <div class="video-card">
                    ${
                        video.thumbnail_url
                        ? `<img class="video-thumbnail"
                               src="${escapeHTML(video.thumbnail_url)}"
                               alt="Thumbnail">`
                        : `<div class="video-thumbnail"
                               style="display:flex;align-items:center;justify-content:center;font-size:40px;">
                               🎬
                           </div>`
                    }

                    <div class="video-info">
                        <h3 class="video-title">
                            ${escapeHTML(video.title)}
                        </h3>

                        <p class="video-description">
                            ${escapeHTML(video.description || "")}
                        </p>

                        <p>👁️ Clicks: ${Number(video.clicks || 0)}</p>

                        <div class="admin-actions">
                            <button class="btn btn-warning"
                                onclick="editVideo(${id})">
                                Edit
                            </button>

                            <button class="btn btn-danger"
                                onclick="deleteVideo(${id})">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        container.innerHTML =
            `<p class="loading">❌ ${escapeHTML(error.message)}</p>`;
    }
}

// =====================================
// ADD / UPDATE VIDEO
// =====================================

async function saveVideo(event) {
    event.preventDefault();

    const video = {
        title: $("videoTitle").value.trim(),
        thumbnail_url: $("thumbnailUrl").value.trim() || null,
        flezen_link: $("flezenLink").value.trim(),
        description: $("videoDescription").value.trim() || null
    };

    if (!video.title || !video.flezen_link) {
        showMessage("videoMessage", "❌ Title और Flezen Link जरूरी हैं।", "#ff5555");
        return;
    }

    const button = $("saveVideoBtn");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
        if (editingVideoId !== null) {
            await apiRequest(`/api/admin/videos/${editingVideoId}`, {
                method: "PUT",
                body: JSON.stringify(video)
            });

            showMessage("videoMessage", "✅ वीडियो अपडेट हो गया!", "#2ecc71");
        } else {
            await apiRequest("/api/admin/videos", {
                method: "POST",
                body: JSON.stringify(video)
            });

            showMessage("videoMessage", "✅ नया वीडियो जुड़ गया!", "#2ecc71");
        }

        resetForm();
        await loadAdminVideos();

    } catch (error) {
        showMessage("videoMessage", "❌ " + error.message, "#ff5555");
    } finally {
        button.disabled = false;
        button.textContent = "Save Video";
    }
}

// =====================================
// EDIT VIDEO
// =====================================

async function editVideo(id) {
    try {
        const data = await apiRequest("/api/admin/videos");
        const video = (data.videos || []).find(v => Number(v.id) === Number(id));

        if (!video) {
            alert("वीडियो नहीं मिला।");
            return;
        }

        editingVideoId = id;

        $("videoTitle").value = video.title || "";
        $("thumbnailUrl").value = video.thumbnail_url || "";
        $("flezenLink").value = video.flezen_link || "";
        $("videoDescription").value = video.description || "";

        $("formHeading").textContent = "✏️ Edit Video";
        $("saveVideoBtn").textContent = "Update Video";
        $("cancelEditBtn").style.display = "inline-block";

        $("videoForm").scrollIntoView({ behavior: "smooth" });

    } catch (error) {
        alert(error.message);
    }
}

// =====================================
// DELETE VIDEO
// =====================================

async function deleteVideo(id) {
    if (!confirm("क्या आप यह वीडियो डिलीट करना चाहते हैं?")) {
        return;
    }

    try {
        await apiRequest(`/api/admin/videos/${id}`, {
            method: "DELETE"
        });

        alert("✅ वीडियो डिलीट हो गया।");
        await loadAdminVideos();

    } catch (error) {
        alert("❌ " + error.message);
    }
}

// =====================================
// RESET FORM
// =====================================

function resetForm() {
    $("videoForm").reset();

    editingVideoId = null;

    $("formHeading").textContent = "➕ Add New Video";
    $("saveVideoBtn").textContent = "Save Video";
    $("cancelEditBtn").style.display = "none";
}

// =====================================
// START
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    $("loginForm").addEventListener("submit", login);
    $("logoutBtn").addEventListener("click", logout);
    $("videoForm").addEventListener("submit", saveVideo);
    $("cancelEditBtn").addEventListener("click", resetForm);

    verifyLogin();
});
