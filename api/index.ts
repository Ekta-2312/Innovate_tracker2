import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import axios from 'axios';

// MongoDB Connection (cached for serverless)
let cachedDb: typeof mongoose | null = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const db = await mongoose.connect('mongodb+srv://ektadodiya01_db_user:Ekta%402612@innovate.zqj90eb.mongodb.net/');
  cachedDb = db;
  return db;
}

const LocationSchema = new mongoose.Schema({
  address: String,
  latitude: Number,
  longitude: Number,
  accuracy: Number,
  timestamp: { type: Date, default: Date.now },
  mobileNumber: String,
  donorId: { type: String, unique: true },
  requestId: String,
  token: String,
});

const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema);

// Generate unique donor ID
function generateUniqueId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'DON' + result;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Connect to MongoDB
  await connectToDatabase();

  // Handle POST /api/save-location
  if (req.method === 'POST' && req.url?.includes('save-location')) {
    try {
      const { latitude, longitude, accuracy, mobileNumber, token, requestId } = req.body;

      console.log('Received request body:', req.body);

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Coordinates required' });
      }

      // Check geofence
      const distance = haversine(hospitalLat, hospitalLng, latitude, longitude);
      if (distance > geofenceRadiusKm) {
        return res.status(400).json({ error: 'Outside allowed area' });
      }

      // IP location cross-check
      try {
        const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
        console.log('Checking IP:', ip);

        if (ip && typeof ip === 'string') {
          const ipCheck = await axios.get(`http://ip-api.com/json/${ip.split(',')[0]}?fields=lat,lon,proxy,hosting,status`, {
            timeout: 5000
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
        }
      } catch (ipError: any) {
        console.warn('IP check failed (non-blocking):', ipError.message);
      }

      // Generate unique donor ID
      let donorId = generateUniqueId();
      while (await Location.exists({ donorId })) {
        donorId = generateUniqueId();
      }

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

      const qrData = {
        donorId,
        mobileNumber,
        latitude,
        longitude,
        timestamp: loc.timestamp,
        requestId: requestId || null,
        token: token || null
      };

      return res.json({
        message: 'Saved',
        accuracy,
        timestamp: loc.timestamp,
        donorId,
        qrData
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Default response
  return res.status(200).json({ message: 'API is running' });
}
