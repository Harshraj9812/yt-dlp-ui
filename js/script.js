document.addEventListener('DOMContentLoaded', function () {
    // --- Configurables ---
    const BACKEND_URL = 'http://127.0.0.1:5000'; // Your Flask backend URL

    // --- DOM Elements ---
    const urlInput = document.getElementById('youtube-url');
    const getFormatsBtn = document.getElementById('get-formats-btn');
    const downloadBtn = document.getElementById('download-btn');
    const formatTable = document.getElementById('format-table');
    const formatTableBody = document.getElementById('format-table-body');
    const loadingDiv = document.getElementById('loading');
    const statusMessageDiv = document.getElementById('status-message');
    const downloadSection = document.getElementById('download-section');
    const videoTitleDiv = document.getElementById('video-title');


    // --- State Variables ---
    let currentVideoTitle = '';
    let currentVideoUrl = '';
    let availableFormats = [];
    let selectedFormatDetails = null; // To store full details of the selected format

    // --- Event Listeners ---
    getFormatsBtn.addEventListener('click', handleGetFormats);
    downloadBtn.addEventListener('click', handleDownload);

    // --- Helper Functions ---

    function showStatusMessage(message, type = 'error') {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `status-message ${type}`; // Set class for styling
        statusMessageDiv.style.display = 'block';
    }

    function hideStatusMessage() {
        statusMessageDiv.style.display = 'none';
    }

    function showLoading(isLoading) {
        loadingDiv.style.display = isLoading ? 'block' : 'none';
        if (isLoading) {
            // Disable button while loading
            getFormatsBtn.disabled = true;
            // Hide previous results
            formatTable.style.display = 'none';
            downloadSection.style.display = 'none';
            videoTitleDiv.style.display = 'none';
            hideStatusMessage();
        } else {
            getFormatsBtn.disabled = false;
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes'; // Handle null, undefined, 0

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function isValidYouTubeUrl(url) {
        // More robust regex, allows http/https, www optional, handles params
        const patterns = [
            /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]+)(?:&\S*)?$/i,
            /^https?:\/\/youtu\.be\/([\w-]+)(?:\?\S*)?$/i
            // Add playlist regex here if you want to support them later
            // /^https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=([\w-]+)(?:&\S*)?$/i
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    function generateFilename(title, extension) {
        // Basic sanitization: replace invalid file characters
        const safeTitle = title.replace(/[<>:"/\\|?*%]/g, '_').substring(0, 100); // Limit length
        return `${safeTitle || 'video'}.${extension || 'mp4'}`;
    }

    // --- Core Logic ---

    async function handleGetFormats() {
        currentVideoUrl = urlInput.value.trim();
        selectedFormatDetails = null; // Reset selection
        downloadBtn.disabled = true; // Disable download initially

        if (!currentVideoUrl) {
            showStatusMessage('Please enter a YouTube URL.', 'error');
            return;
        }
        if (!isValidYouTubeUrl(currentVideoUrl)) {
            showStatusMessage('Please enter a valid YouTube video URL (e.g., youtube.com/watch?v=... or youtu.be/...).', 'error');
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
                // Use error from backend if available, otherwise generic message
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            // Store data and populate table
            currentVideoTitle = data.title || 'Untitled Video';
            availableFormats = data.formats || [];
            videoTitleDiv.textContent = currentVideoTitle;
            videoTitleDiv.style.display = 'block';
            populateFormatsTable(availableFormats);
            hideStatusMessage(); // Clear any previous errors

        } catch (error) {
            console.error("Error fetching formats:", error);
            showStatusMessage(`Failed to get formats: ${error.message}`, 'error');
            formatTable.style.display = 'none'; // Ensure table is hidden on error
            downloadSection.style.display = 'none';
            videoTitleDiv.style.display = 'none';
        } finally {
            showLoading(false);
        }
    }

    function populateFormatsTable(formats) {
        formatTableBody.innerHTML = ''; // Clear previous entries

        if (!formats || formats.length === 0) {
            showStatusMessage('No downloadable formats found for this video.', 'warning');
            formatTable.style.display = 'none';
            downloadSection.style.display = 'none';
            return;
        }

        formats.forEach((format, index) => {
            if (!format.id) return;

            const fileSizeFormatted = format.filesize_approx ? formatBytes(format.filesize_approx) : 'N/A';
            if (fileSizeFormatted === 'N/A') return;

            const isAudioOnly = format.vcodec === 'none'; // Check if it's an audio-only format
            const isVideoOnly = format.acodec === 'none'; // Check if it's a video-only format

            const row = document.createElement('tr');
            row.innerHTML = `
    <td>
        <input type="checkbox" name="format_select" value="${format.id}" id="format_${index}" data-type="${isAudioOnly ? 'audio' : isVideoOnly ? 'video' : 'both'}">
    </td>
    <td>${format.ext || 'N/A'}</td>
    <td>${format.resolution || format.note || (isAudioOnly ? 'Audio' : 'N/A')}</td>
    <td>${format.fps || '-'}</td>
    <td>${fileSizeFormatted}</td>
    <td>${format.vcodec === 'none' ? '-' : format.vcodec}</td>
    <td>${format.acodec === 'none' ? '-' : format.acodec}</td>
    <td>${format.tbr || '-'}</td>
    <td>${format.abr || '-'}</td>
    <td>${format.vbr || '-'}</td>
    <td>${format.language || '-'}</td>
`;

            const checkboxInput = row.querySelector('input[type="checkbox"]');
            checkboxInput.addEventListener('change', () => {
                const selectedCheckboxes = Array.from(document.querySelectorAll('input[name="format_select"]:checked'));
                const selectedAudio = selectedCheckboxes.filter(input => input.dataset.type === 'audio');
                const selectedVideo = selectedCheckboxes.filter(input => input.dataset.type === 'video');

                if (checkboxInput.checked) {
                    // If an audio format is selected, remove other audio formats
                    if (checkboxInput.dataset.type === 'audio') {
                        document.querySelectorAll('input[name="format_select"][data-type="audio"]').forEach(input => {
                            if (input !== checkboxInput) {
                                input.closest('tr').style.display = 'none'; // Hide the row
                            }
                        });
                    }
                    // If a video format is selected, remove other video formats
                    if (checkboxInput.dataset.type === 'video') {
                        document.querySelectorAll('input[name="format_select"][data-type="video"]').forEach(input => {
                            if (input !== checkboxInput) {
                                input.closest('tr').style.display = 'none'; // Hide the row
                            }
                        });
                    }
                } else {
                    // If the checkbox is unselected, revert the hidden rows
                    if (checkboxInput.dataset.type === 'audio') {
                        document.querySelectorAll('input[name="format_select"][data-type="audio"]').forEach(input => {
                            input.closest('tr').style.display = ''; // Show the row
                        });
                    }
                    if (checkboxInput.dataset.type === 'video') {
                        document.querySelectorAll('input[name="format_select"][data-type="video"]').forEach(input => {
                            input.closest('tr').style.display = ''; // Show the row
                        });
                    }
                }

                // Enable the download button if at least one checkbox is selected
                if (selectedCheckboxes.length > 0) {
                    downloadBtn.disabled = false;
                    downloadSection.style.display = 'block'; // Show the download section
                } else {
                    downloadBtn.disabled = true;
                    downloadSection.style.display = 'none'; // Hide the download section
                }
            });

            formatTableBody.appendChild(row);
        });

        formatTable.style.display = 'table'; // Show the table
    }

    async function handleDownload() {
        // Get all selected checkboxes
        const selectedCheckboxes = Array.from(document.querySelectorAll('input[name="format_select"]:checked'));
        if (selectedCheckboxes.length === 0) {
            showStatusMessage("Please select at least one format.", 'warning');
            return;
        }

        // Validate URL
        if (!currentVideoUrl || !isValidYouTubeUrl(currentVideoUrl)) {
            showStatusMessage("Invalid or missing video URL. Please fetch formats again.", 'error');
            return;
        }

        // Extract selected formats (audio and video)
        const selectedFormats = selectedCheckboxes.map(checkbox => ({
            id: checkbox.value,
            type: checkbox.dataset.type
        }));

        const audioFormat = selectedFormats.find(format => format.type === 'audio');
        const videoFormat = selectedFormats.find(format => format.type === 'video');
        const bothFormat = selectedFormats.find(format => format.type === 'both');

        // If no specific format type is selected, show error
        if (!audioFormat && !videoFormat && !bothFormat) {
            showStatusMessage("Please select a valid format.", 'error');
            return;
        }

        // Generate filename based on selected formats
        const suggestedFilename = generateFilename(
            currentVideoTitle,
            videoFormat || bothFormat ? 'mp4' : (audioFormat ? 'mp3' : 'mp4')
        );

        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Preparing Download...';
        hideStatusMessage();

        try {
            // Construct request payload
            const requestBody = {
                url: currentVideoUrl,
                format_id: bothFormat ? bothFormat.id : 
                          (videoFormat && audioFormat) ? `${videoFormat.id}+${audioFormat.id}` :
                          videoFormat ? videoFormat.id :
                          audioFormat ? audioFormat.id : null,
                filename: suggestedFilename
            };

            // Remove audio/video format IDs since we're using the combined format_id
            console.log("Request Payload:", requestBody);

            // Send request to backend with selected formats
            const response = await fetch(`${BACKEND_URL}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorMsg = `Download failed with status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // Ignore if response wasn't JSON
                }
                throw new Error(errorMsg);
            }

            // --- Successful Download Stream ---
            const contentDisposition = response.headers.get('content-disposition');
            let finalFilename = suggestedFilename; // Default
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";]+)['"]?/);
                if (filenameMatch && filenameMatch[1]) {
                    finalFilename = decodeURIComponent(filenameMatch[1]);
                }
            }

            console.log(`Downloading as: ${finalFilename}`);

            // Get data as Blob
            downloadBtn.textContent = 'Downloading...';
            const blob = await response.blob();

            // Create temporary link and trigger download
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();

            // Clean up
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
            showStatusMessage(`Successfully started download: ${finalFilename}`, 'success');
            setTimeout(hideStatusMessage, 5000);

        } catch (error) {
            console.error("Download error:", error);
            showStatusMessage(`Download failed: ${error.message}`, 'error');
        } finally {
            // Re-enable button
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download Selected Format';
        }
    }

}); // End DOMContentLoaded