import subprocess
import json
import re
import os
import mimetypes # To guess file type for download
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

# --- Configuration ---
# Allow running yt-dlp from a specific path if not in system PATH
YT_DLP_PATH = 'yt-dlp' 
# Or specify path: e.g., 'C:\\path\\to\\yt-dlp.exe' or '/usr/local/bin/yt-dlp'

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing for your frontend

# --- Helper Functions ---

def sanitize_filename(filename):
    """Removes potentially dangerous characters for filenames."""
    # Remove path components
    filename = os.path.basename(filename) 
    # Remove characters potentially problematic in filenames or URLs
    filename = re.sub(r'[<>:"/\\|?*%\']', '', filename)
    # Optionally replace spaces, etc.
    filename = filename.replace(' ', '_')
    return filename if filename else "download" # Ensure filename is not empty

def validate_youtube_url(url):
    """Basic check for valid YouTube video/playlist URL patterns."""
    patterns = [
        r'^https?://(www\.)?youtube\.com/watch\?v=[\w-]+(&\S*)?$',
        r'^https?://(www\.)?youtu\.be/[\w-]+(\?\S*)?$',
        # Add playlist pattern if needed, but focus on video download first
        # r'^https?://(www\.)?youtube\.com/playlist\?list=[\w-]+(&\S*)?$' 
    ]
    return any(re.match(pattern, url) for pattern in patterns)

# --- API Endpoints ---

@app.route('/get_formats', methods=['POST'])
def get_youtube_formats():
    """
    Fetches available formats for a given YouTube URL using yt-dlp.
    Uses --dump-json for reliable parsing.
    """
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'success': False, 'error': 'URL is required'}), 400

    if not validate_youtube_url(url):
         return jsonify({'success': False, 'error': 'Invalid YouTube URL format'}), 400

    try:
        # Use -J to get JSON output for a single video/playlist
        # Use --no-playlist if you strictly want only the video, not playlist items
        command = [YT_DLP_PATH, '-J', '--no-playlist', url] 
        
        # Increase timeout if needed for slow connections or long format lists
        result = subprocess.run(command, 
                                capture_output=True, 
                                text=True, 
                                check=True, # Raise error on non-zero exit code
                                timeout=60) # 60-second timeout

        video_info = json.loads(result.stdout)
        
        # Extract formats and potentially simplify them for the frontend
        formats = video_info.get('formats', [])
        title = video_info.get('title', 'video')

        # Filter/simplify format data if needed (optional)
        simplified_formats = []
        for fmt in formats:
            # Only include necessary fields for the frontend selection
            # Make sure 'format_note' or similar exists for description
            simplified_formats.append({
                'id': fmt.get('format_id'),
                'ext': fmt.get('ext'),
                'resolution': fmt.get('resolution', fmt.get('format_note', 'Audio')),
                'fps': fmt.get('fps'),
                'filesize_approx': fmt.get('filesize_approx'), # Note: Can be None
                'vcodec': fmt.get('vcodec'),
                'acodec': fmt.get('acodec'),
                'tbr': fmt.get('tbr'), # Total bitrate
                'abr': fmt.get('abr'), # Total bitrate
                'vbr': fmt.get('vbr'), # Total bitrate
                'note': fmt.get('format_note', ''),
                'is_video_only' : fmt.get('vcodec') != 'none' and fmt.get('acodec') == 'none',
                'is_audio_only' : fmt.get('vcodec') == 'none' and fmt.get('acodec') != 'none',
                'language' : fmt.get('language')
            })

        return jsonify({
            'success': True, 
            'formats': simplified_formats,
            'title': title
            })

    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Fetching formats timed out'}), 504 # Gateway Timeout
    except subprocess.CalledProcessError as e:
        error_message = f"yt-dlp failed: {e.stderr}"
        # Try to provide a more user-friendly error
        if "Unsupported URL" in e.stderr:
             error_message = "Unsupported URL or video unavailable."
        elif "video is unavailable" in e.stderr.lower():
             error_message = "This video is unavailable."
        return jsonify({'success': False, 'error': error_message}), 500
    except json.JSONDecodeError:
         return jsonify({'success': False, 'error': 'Failed to parse yt-dlp output'}), 500
    except Exception as e:
        # Catch-all for unexpected errors
        print(f"Unexpected error: {e}") # Log the real error
        return jsonify({'success': False, 'error': f'An unexpected server error occurred: {e}'}), 500


@app.route('/download', methods=['POST'])
def download_video():
    """
    Downloads the selected format and streams it directly to the user.
    """
    data = request.get_json()
    url = data.get('url')
    format_id = data.get('format_id')
    # Expecting filename like 'My_Video_Title.mp4' from frontend
    filename_suggestion = data.get('filename', 'download') 

    if not url or not format_id:
        return jsonify({'success': False, 'error': 'URL and Format ID are required'}), 400
    
    if not validate_youtube_url(url):
         return jsonify({'success': False, 'error': 'Invalid YouTube URL format'}), 400

    # Sanitize the suggested filename
    safe_filename = sanitize_filename(filename_suggestion)
    
    # Determine extension if possible, fallback based on filename
    _, potential_ext = os.path.splitext(safe_filename)
    if not potential_ext:
        # Try to infer based on format ID structure (e.g., '140' is m4a)
        # This is brittle, better if frontend sends extension too.
        # For now, use a generic extension if needed.
         safe_filename += ".dat" # Generic fallback
    
    # Guess the MIME type based on the filename extension
    mimetype, _ = mimetypes.guess_type(safe_filename)
    if not mimetype:
        mimetype = 'application/octet-stream' # Default binary stream type

    try:
        command = [
            YT_DLP_PATH,
            '-f', format_id,      # Select the specific format
            '--no-playlist',      # Ensure only the single video downloads
             # '--force-ipv4',      # Uncomment if experiencing IPv6 issues
            '-o', '-',             # Output to standard output (PIPE)
            url
        ]

        # Use Popen for streaming
        process = subprocess.Popen(command, 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE) # Capture stderr too

        # Use stream_with_context for safer streaming in Flask
        def generate_stream():
            try:
                # Read chunks from stdout
                while True:
                    chunk = process.stdout.read(4096) # Read 4KB chunks
                    if not chunk:
                        break # End of stream
                    yield chunk
            finally:
                 # Ensure resources are cleaned up
                 process.stdout.close()
                 process.stderr.close()
                 process.wait() # Wait for the process to finish

        response_headers = {
            'Content-Disposition': f'attachment; filename="{safe_filename}"',
            'Content-Type': mimetype
        }

        # Stream the response
        return Response(stream_with_context(generate_stream()), headers=response_headers)

    except subprocess.CalledProcessError as e:
         # This might not be caught if Popen fails early, but good practice
         return jsonify({'success': False, 'error': f"Download failed: {e.stderr}"}), 500
    except Exception as e:
        print(f"Streaming error: {e}") # Log the error
        # Cannot return JSON if streaming already started, might already send headers
        # Best effort is to just stop sending data. Client will see incomplete download.
        # If the error happens before streaming starts (e.g., Popen fails):
        return jsonify({'success': False, 'error': f'Failed to start download stream: {e}'}), 500


# --- Run the App ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network (use with caution)
    # Use 127.0.0.1 for local access only
    app.run(host='127.0.0.1', port=5000, debug=True) # Turn debug=False for production