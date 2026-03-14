const express = require('express');
const router = express.Router();
const https = require('https');
const url = require('url');

router.get('/proxy-image', (req, res) => {
  const imageUrl = req.query.url;
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Only allow Google image URLs
  if (!imageUrl.startsWith('https://lh3.googleusercontent.com/')) {
    return res.status(403).json({ error: 'Invalid image source' });
  }

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'http://localhost:5173'
    }
  };

  https.get(imageUrl, options, (response) => {
    // Set appropriate headers
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    
    // Pipe the image to the response
    response.pipe(res);
  }).on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch image' });
  });
});

module.exports = router;