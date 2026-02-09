import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import axios from 'axios';

// MongoDB Connection (cached for serverless)
let cachedDb: typeof mongoose | null = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  // Use the same database as server.ts
  const db = await mongoose.connect('mongodb+srv://ektadodiya01_db_user:Ekta%402612@innovate.zqj90eb.mongodb.net/raktmap');
  cachedDb = db;
  return db;
}

const BloodRequestSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  bloodGroup: String,
  quantity: Number,
  confirmedUnits: { type: Number, default: 0 },
  urgency: String,
  requiredBy: Date,
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const BloodRequest = mongoose.models.BloodRequest || mongoose.model('BloodRequest', BloodRequestSchema);

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
const geofenceRadiusKm = 100; // Relaxed for Vercel demo

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

  const url = req.url || '';

  // 1) Handle GET /api/bloodrequest/:id
  if (req.method === 'GET' && url.includes('bloodrequest')) {
    try {
      const parts = url.split('/');
      const id = parts[parts.length - 1];

      const request = await BloodRequest.findById(id);
      if (!request) return res.status(404).json({ error: 'Request not found' });

      const now = new Date();
      const isExpired = now > new Date(request.requiredBy);
      const isFull = (request.confirmedUnits || 0) >= (request.quantity || 0);

      if (request.status === 'active') {
        if (isFull) {
          request.status = 'fulfilled';
          await request.save();
        } else if (isExpired) {
          request.status = 'expired';
          await request.save();
        }
      }

      if (request.status !== 'active' || isFull || isExpired) {
        return res.json({
          status: 'closed',
          message: 'Blood request fulfilled. Thank you.'
        });
      }

      return res.json(request);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2) Handle POST /api/save-location (Integrated Confirmation)
  if (req.method === 'POST' && url.includes('save-location')) {
    try {
      const { latitude, longitude, accuracy, mobileNumber, token, requestId } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Coordinates required' });
      }

      // Atomic confirmation logic
      const now = new Date();
      const updatedRequest = await BloodRequest.findOneAndUpdate(
        {
          _id: requestId,
          status: 'active',
          $expr: { $lt: ['$confirmedUnits', '$quantity'] },
          requiredBy: { $gte: now }
        },
        { $inc: { confirmedUnits: 1 } },
        { new: true }
      );

      if (!updatedRequest) {
        return res.status(400).json({
          error: 'Blood request already fulfilled or expired.'
        });
      }

      // Update status if full
      if ((updatedRequest.confirmedUnits || 0) >= (updatedRequest.quantity || 0)) {
        updatedRequest.status = 'fulfilled';
        await updatedRequest.save();
      }

      // Geofence check (optional, matching server.ts logic)
      const distance = haversine(hospitalLat, hospitalLng, latitude, longitude);

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

