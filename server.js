const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS so your frontend index.html can talk to this backend
app.use(cors());

// CHOOSE YOUR MEDIA DIRECTORY HERE (Update this path to your actual movie/show folder)
const MEDIA_DIR = path.join(__dirname, 'my_media'); 

// Create the directory if it doesn't exist yet for testing
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR);
}

// Statically serve the video files so the browser video player can stream them
app.use('/stream', express.static(MEDIA_DIR));

/**
 * Recursively scans folders and maps files into a Plex-style JSON object
 */
function scanDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);
    const result = [];

    items.forEach(item => {
        // Skip hidden files/system folders (like .DS_Store or Thumbs.db)
        if (item.startsWith('.')) return;

        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            result.push({
                name: item,
                type: 'folder',
                children: scanDirectory(fullPath)
            });
        } else {
            const ext = path.extname(item).toLowerCase();
            // Only add common video file types
            if (['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext)) {
                
                // Calculate the streaming URL relative to our static server route
                const relativePath = path.relative(MEDIA_DIR, fullPath).replace(/\\/g, '/');
                const streamUrl = `http://localhost:${PORT}/stream/${encodeURIComponent(relativePath)}`;

                // Auto-parse rudimentary metadata directly from the filename
                const yearMatch = item.match(/\((19\d\d|20\d\d)\)/); // Looks for (2024), etc.
                const year = yearMatch ? yearMatch[1] : "Unknown";
                const cleanName = item.replace(ext, '').replace(/\s*\(\d{4}\)/, '');

                result.push({
                    name: item,
                    type: 'video',
                    url: streamUrl,
                    genre: dirPath.toLowerCase().includes('movies') ? 'Movie' : 'TV Show',
                    year: year,
                    plot: `Local media file streamed automatically from: /${relativePath}`
                });
            }
        }
    });

    return result;
}

// API Endpoint your frontend app will hit to fetch the payload
app.get('/api/media', (req, res) => {
    try {
        const mediaTree = scanDirectory(MEDIA_DIR);
        res.json(mediaTree);
    } catch (error) {
        res.status(500).json({ error: "Failed to index media files", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🎬 Plex-Light server running at http://localhost:${PORT}`);
    console.log(`📁 Indexing media from path: ${MEDIA_DIR}`);
});
