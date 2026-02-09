import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    /https:\/\/.*\.devtunnels\.ms/,  // Allow all devtunnel URLs
    /https:\/\/.*\.vercel\.app/,     // Allow all Vercel URLs
    /https:\/\/.*\.onrender\.com/    // Allow all Render URLs
  ],
  credentials: true
}));
app.use(express.json());

// Serve static files from public folder
// Serve static files from public folder
// Check both possible locations: root (dev) and one level up (prod/dist)
const publicPathLocal = path.join(__dirname, 'public');
const publicPathProd = path.join(__dirname, '..', 'public');
const publicPath = require('fs').existsSync(publicPathLocal) ? publicPathLocal : publicPathProd;

console.log('Serving static files from:', publicPath);

if (require('fs').existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

mongoose.connect('mongodb+srv://ektadodiya01_db_user:Ekta%402612@innovate.zqj90eb.mongodb.net/');

const Location = mongoose.model('Location', new mongoose.Schema({
  address: String,
  latitude: Number,
  longitude: Number,
  accuracy: Number,
  timestamp: { type: Date, default: Date.now },
  mobileNumber: String,
  donorId: { type: String, unique: true }, // Unique alphanumeric donor ID
  requestId: String, // Blood request ID from URL token
  token: String, // SMS token for verification
}));

// Generate unique donor ID (alphanumeric)
function generateUniqueId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'DON' + result; // e.g., DON4B7X9K2A
}

// Haversine function
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const hospitalLat = 22.6023;
const hospitalLng = 72.8205;
const geofenceRadiusKm = 50;

app.post('/api/save-location', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, mobileNumber, token, requestId } = req.body;

    console.log('Received request body:', req.body);
    console.log('Extracted token:', token);
    console.log('Extracted requestId:', requestId);

    if (!latitude || !longitude) return res.status(400).json({ error: 'Coordinates required' });

    // Check geofence
    const distance = haversine(hospitalLat, hospitalLng, latitude, longitude);
    if (distance > geofenceRadiusKm) {
      return res.status(400).json({ error: 'Outside allowed area' });
    }

    // IP location cross-check (optional - won't block if it fails)
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log('Checking IP:', ip);

      const ipCheck = await axios.get(`http://ip-api.com/json/${ip}?fields=lat,lon,proxy,hosting,status`, {
        timeout: 5000 // 5 second timeout
      });
      const ipData = ipCheck.data as any;

      console.log('IP Check result:', ipData);

      if (ipData.status === 'success') {
        if (ipData.proxy || ipData.hosting) {
          return res.status(400).json({ error: 'VPN/Proxy detected' });
        }
        const ipDistance = haversine(ipData.lat, ipData.lon, latitude, longitude);
        console.log('IP Distance:', ipDistance, 'km');
        if (ipDistance > 200) {
          return res.status(400).json({ error: 'IP and GPS mismatch' });
        }
      }
    } catch (ipError: any) {
      // Log the error but don't block the submission
      console.warn('IP check failed (non-blocking):', ipError.message);
    }

    // Generate unique donor ID
    let donorId = generateUniqueId();
    // Ensure uniqueness by checking database
    while (await Location.exists({ donorId })) {
      donorId = generateUniqueId();
    }

    // Create formatted address field
    const address = `Mobile: ${mobileNumber} - Current Location: ${latitude}, ${longitude}`;

    const loc = new Location({
      address,
      latitude,
      longitude,
      accuracy,
      mobileNumber,
      donorId,
      requestId: requestId || null,
      token: token || null
    });
    await loc.save();

    // Return enhanced response with donor data for QR generation
    const qrData = {
      donorId,
      mobileNumber,
      latitude,
      longitude,
      timestamp: loc.timestamp,
      requestId: requestId || null,
      token: token || null
    };

    res.json({
      message: 'Saved',
      accuracy,
      timestamp: loc.timestamp,
      donorId,
      qrData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the React app for the root route
app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('API is running. Frontend not built. Run npm start in client folder for dev.');
  }
});

// Handle any other routes by serving the React app
app.use((req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on ${port}`));
