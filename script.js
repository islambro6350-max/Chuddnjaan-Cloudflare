// =====================================
// CHUDDNJAAN - CLOUDFLARE VIDEO LOADER (FIXED)
// =====================================

const API_URL = "https://silent-woochuddnjaan-api.islambro6350.workers.dev";

// HTML सुरक्षित दिखाने के लिए
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// =====================================
// LOAD VIDEOS
// =====================================

async function loadVideos() {
    const container = document.getElementById("videosContainer");

    if (!container) return; 
    container.classList.add("videos-grid"); 
    container.innerHTML = '<div class="loading">⏳ वीडियो लोड हो रहे हैं...</div>'; 

    try { 
        const response = await fetch(`${API_URL}/api/videos`); 
        if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
}
        
        const result = await response.json(); 
        
        // 🛠️ सुधार यहाँ किया गया है: Worker सीधा Array भेजता है
        const videos = Array.isArray(result) ? result : (result.videos || []); 

        if (videos.length === 0) { 
            container.innerHTML = '<div class="loading">😊 अभी कोई वीडियो नहीं है</div>'; 
            return; 
        } 

        container.innerHTML = videos.map(video => { 
            const title = escapeHTML(video.title || "बिना नाम का वीडियो"); 
            const description = escapeHTML(video.description || ""); 
            const thumbnail = escapeHTML(video.thumbnail_url || ""); 
            const id = Number(video.id); 
            const clickCount = video.click_count || 0; // क्लिक काउंट भी जोड़ दिया

            return ` 
                <div class="video-card"> 
                    ${ 
                        thumbnail 
                            ? `<img src="${thumbnail}" alt="${title}" class="video-thumbnail" loading="lazy" onclick="watchVideo(${id})">` 
                            : `<div class="video-thumbnail" style="display:flex;align-items:center;justify-content:center;font-size:45px;cursor:pointer;" onclick="watchVideo(${id})">🎬</div>` 
                    } 
                    <div class="video-info"> 
                        <h3 class="video-title">${title}</h3> 
                        ${description ? `<p class="video-description">${description}</p>` : "" } 
                        
                        <!-- वॉच बटन और व्यूज़ काउंट -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                            <button class="watch-btn" type="button" onclick="watchVideo(${id})"> 
                                ▶ WATCH VIDEO 
                            </button>
                            <span style="color: #888; font-size: 14px;">👁️ ${clickCount}</span>
                        </div>
                    </div> 
                </div> 
            `; 
        }).join(""); 
    } catch (error) { 
        console.error("Video loading error:", error); 
        container.innerHTML = ` 
            <div class="loading"> 
                ❌ वीडियो लोड नहीं हो पाए। 
                <br><br> 
                ${escapeHTML(error.message)} 
            </div> 
        `; 
    } 
}

// =====================================
// WATCH VIDEO + CLICK COUNT
// =====================================

async function watchVideo(videoId) {
    try {
        // डेटा फिर से फेच करके लिंक निकालें
        const response = await fetch(`${API_URL}/api/videos`);
        if (!response.ok) throw new Error("वीडियो सूची नहीं मिली।");

        const result = await response.json(); 
        const videos = Array.isArray(result) ? result : (result.videos || []);
        
        const video = videos.find(v => Number(v.id) === Number(videoId)); 

        if (!video || !video.flezen_link) { 
            alert("वीडियो लिंक उपलब्ध नहीं है।"); 
            return; 
        } 

        // वीडियो तुरंत नए टैब में खोलें
        window.open(video.flezen_link, "_blank", "noopener"); 

        // क्लिक की गिनती डेटाबेस में भेजें
        fetch(`${API_URL}/api/click`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ video_id: Number(videoId) }) 
        }).catch(error => console.error("Click tracking error:", error)); 

    } catch (error) { 
        console.error(error); 
        alert("वीडियो खोलने में समस्या हुई।"); 
    } 
}

// =====================================
// START
// =====================================
document.addEventListener("DOMContentLoaded", loadVideos);
