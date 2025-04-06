document.addEventListener('DOMContentLoaded', function () {
    // Auto-detect backend URL
    const BACKEND_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:10000'
        : 'https://yt-dlp-ui-9vms.onrender.com';
    console.info("HostName - ", BACKEND_URL);

    // DOM Elements
    const urlInput = document.getElementById('youtube-url');
    const getFormatsBtn = document.getElementById('get-formats-btn');
    const downloadBtn = document.getElementById('download-btn');
    const loadingDiv = document.getElementById('loading');
    const statusMessageDiv = document.getElementById('status-message');
    const downloadSection = document.getElementById('download-section');
    const videoTitleDiv = document.getElementById('video-title');

    // State variables
    let currentVideoTitle = '';
    let currentVideoUrl = '';

    // Initialize tabs
    initTabs();

    // Event Listeners
    getFormatsBtn.addEventListener('click', handleGetFormats);
    downloadBtn.addEventListener('click', handleDownload);

    // Helper functions
    function showStatusMessage(message, type = 'error') {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `status-message ${type}`;
        statusMessageDiv.style.display = 'block';
    }

    function hideStatusMessage() {
        statusMessageDiv.style.display = 'none';
    }

    function showLoading(isLoading) {
        loadingDiv.style.display = isLoading ? 'block' : 'none';
        if (isLoading) {
            getFormatsBtn.disabled = true;
            document.querySelectorAll('.format-table-container').forEach(el => {
                el.style.display = 'none';
            });
            downloadSection.style.display = 'none';
            videoTitleDiv.style.display = 'none';
            hideStatusMessage();
        } else {
            getFormatsBtn.disabled = false;
        }
    }

    function initTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all buttons
                tabs.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Hide all tab contents
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show the selected tab content
                const tabId = this.dataset.tab + '-tab';
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function isValidYouTubeUrl(url) {
        const patterns = [
            /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]+)(?:&\S*)?$/i,
            /^https?:\/\/youtu\.be\/([\w-]+)(?:\?\S*)?$/i
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    function generateFilename(title, extension) {
        const safeTitle = title.replace(/[<>:"/\\|?*%]/g, '_').substring(0, 100);
        return `${safeTitle || 'video'}.${extension || 'mp4'}`;
    }

    async function handleGetFormats() {
        currentVideoUrl = urlInput.value.trim();
        if (!currentVideoUrl) {
            showStatusMessage('Please enter a YouTube URL.', 'error');
            return;
        }
        if (!isValidYouTubeUrl(currentVideoUrl)) {
            showStatusMessage('Please enter a valid YouTube video URL.', 'error');
            return;
        }

        showLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/get_formats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: currentVideoUrl })
            });
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            currentVideoTitle = data.title || 'Untitled Video';
            videoTitleDiv.textContent = currentVideoTitle;
            videoTitleDiv.style.display = 'block';
            
            populateFormatsTable(data.formats || []);
            hideStatusMessage();
        } catch (error) {
            console.error("Error fetching formats:", error);
            showStatusMessage(`Failed to get formats: ${error.message}`, 'error');
            document.querySelectorAll('.format-table-container').forEach(el => {
                el.style.display = 'none';
            });
            videoTitleDiv.style.display = 'none';
        } finally {
            showLoading(false);
        }
    }

    function populateFormatsTable(formats) {
        const combinedTableBody = document.getElementById('combined-format-table-body');
        const videoTableBody = document.getElementById('video-format-table-body');
        const audioTableBody = document.getElementById('audio-format-table-body');
        
        combinedTableBody.innerHTML = '';
        videoTableBody.innerHTML = '';
        audioTableBody.innerHTML = '';
        
        let combinedFormats = 0;
        let videoOnlyFormats = 0;
        let audioOnlyFormats = 0;
        
        if (!formats || formats.length === 0) {
            showStatusMessage('No downloadable formats found for this video.', 'warning');
            document.querySelectorAll('.format-table-container').forEach(container => {
                container.style.display = 'none';
            });
            return;
        }
        
        formats.forEach((format, index) => {
            if (!format.id) return;
            
            const fileSizeFormatted = format.filesize_approx ? formatBytes(format.filesize_approx) : 'N/A';
            if (fileSizeFormatted === 'N/A') return;
            
            const isAudioOnly = format.vcodec === 'none';
            const isVideoOnly = format.acodec === 'none';
            const row = document.createElement('tr');
            
            if (isAudioOnly) {
                row.innerHTML = `
                    <td><input type="checkbox" name="format_select" value="${format.id}" id="format_${index}" data-type="audio"></td>
                    <td>${format.ext || 'N/A'}</td>
                    <td>${fileSizeFormatted}</td>
                    <td>${format.acodec || '-'}</td>
                    <td>${format.abr || '-'}</td>
                    <td>${format.language || '-'}</td>
                `;
                audioTableBody.appendChild(row);
                audioOnlyFormats++;
            } else if (isVideoOnly) {
                row.innerHTML = `
                    <td><input type="checkbox" name="format_select" value="${format.id}" id="format_${index}" data-type="video"></td>
                    <td>${format.ext || 'N/A'}</td>
                    <td>${format.resolution || 'N/A'}</td>
                    <td>${format.fps || '-'}</td>
                    <td>${fileSizeFormatted}</td>
                    <td>${format.vcodec || '-'}</td>
                    <td>${format.vbr || '-'}</td>
                `;
                videoTableBody.appendChild(row);
                videoOnlyFormats++;
            } else {
                row.innerHTML = `
                    <td><input type="checkbox" name="format_select" value="${format.id}" id="format_${index}" data-type="both"></td>
                    <td>${format.ext || 'N/A'}</td>
                    <td>${format.resolution || format.note || 'N/A'}</td>
                    <td>${format.fps || '-'}</td>
                    <td>${fileSizeFormatted}</td>
                    <td>${format.vcodec || '-'}</td>
                    <td>${format.acodec || '-'}</td>
                    <td>${format.tbr || '-'}</td>
                    <td>${format.abr || '-'}</td>
                    <td>${format.vbr || '-'}</td>
                    <td>${format.language || '-'}</td>
                `;
                combinedTableBody.appendChild(row);
                combinedFormats++;
            }
            
            const checkboxInput = row.querySelector('input[type="checkbox"]');
            checkboxInput.addEventListener('change', handleCheckboxChange);
        });
        
        // Show/hide tables based on available formats
        document.getElementById('combined-tab').style.display = combinedFormats > 0 ? 'block' : 'none';
        document.getElementById('video-tab').style.display = videoOnlyFormats > 0 ? 'block' : 'none';
        document.getElementById('audio-tab').style.display = audioOnlyFormats > 0 ? 'block' : 'none';
        
        // Show "no formats" messages when needed
        document.getElementById('no-combined-formats').style.display = combinedFormats === 0 ? 'block' : 'none';
        document.getElementById('no-video-formats').style.display = videoOnlyFormats === 0 ? 'block' : 'none';
        document.getElementById('no-audio-formats').style.display = audioOnlyFormats === 0 ? 'block' : 'none';
    }

    function handleCheckboxChange(event) {
        const checkbox = event.target;
        const type = checkbox.dataset.type;
        const isChecked = checkbox.checked;
        
        if (isChecked) {
            // If selecting a combined format, deselect all others
            if (type === 'both') {
                document.querySelectorAll('input[name="format_select"]:checked').forEach(cb => {
                    if (cb !== checkbox) {
                        cb.checked = false;
                    }
                });
            }
            // If selecting video/audio, deselect any combined formats
            else {
                document.querySelectorAll('input[name="format_select"][data-type="both"]:checked').forEach(cb => {
                    cb.checked = false;
                });
            }
        }
        
        // Update download button state
        const selectedCount = document.querySelectorAll('input[name="format_select"]:checked').length;
        downloadBtn.disabled = selectedCount === 0;
        downloadSection.style.display = selectedCount > 0 ? 'block' : 'none';
    }

    async function handleDownload() {
        const selectedCheckboxes = Array.from(document.querySelectorAll('input[name="format_select"]:checked'));
        if (selectedCheckboxes.length === 0) {
            showStatusMessage("Please select at least one format.", 'warning');
            return;
        }

        // Group selected formats by type
        const selectedFormats = {
            audio: [],
            video: [],
            both: []
        };

        selectedCheckboxes.forEach(checkbox => {
            const type = checkbox.dataset.type;
            selectedFormats[type].push(checkbox.value);
        });

        // Determine the best download strategy
        let formatId;
        let extension = 'mp4';
        
        if (selectedFormats.both.length > 0) {
            // Prefer combined formats if selected
            formatId = selectedFormats.both[0];
        } else if (selectedFormats.video.length > 0 && selectedFormats.audio.length > 0) {
            // Combine best video + best audio
            formatId = `${selectedFormats.video[0]}+${selectedFormats.audio[0]}`;
        } else if (selectedFormats.video.length > 0) {
            // Video only
            formatId = selectedFormats.video[0];
        } else if (selectedFormats.audio.length > 0) {
            // Audio only
            formatId = selectedFormats.audio[0];
            extension = 'mp3';
        } else {
            showStatusMessage("No valid format selected", 'error');
            return;
        }

        const filename = generateFilename(currentVideoTitle, extension);
        
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Preparing Download...';
        hideStatusMessage();

        try {
            const response = await fetch(`${BACKEND_URL}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: currentVideoUrl,
                    format_id: formatId,
                    filename: filename
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Download failed (${response.status})`);
            }

            // Handle the download stream
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showStatusMessage('Download started!', 'success');
            setTimeout(hideStatusMessage, 5000);
        } catch (error) {
            console.error("Download error:", error);
            showStatusMessage(`Download failed: ${error.message}`, 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download Selected Format';
        }
    }
});