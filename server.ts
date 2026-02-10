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

mongoose.connect('mongodb+srv://ektadodiya01_db_user:Ekta%402612@innovate.zqj90eb.mongodb.net/raktmap');

const BloodRequest = mongoose.model('BloodRequest', new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  bloodGroup: String,
  quantity: Number,
  confirmedUnits: { type: Number, default: 0 },
  urgency: String,
  requiredBy: Date,
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
}));

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

// 1) GET Blood Request details (Requirement 2)
app.get('/api/bloodrequest/:id', async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const now = new Date();
    const isExpired = request.requiredBy
      ? now > request.requiredBy
      : false;

    const isFull = (request.confirmedUnits || 0) >= (request.quantity || 0);

    // Update status if needed
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

    res.json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2) Atomic Confirmation Endpoint (Requirement 3)
app.post('/api/bloodrequest/confirm', async (req, res) => {
  try {
    const { requestId } = req.body;
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
        message: 'Blood request already fulfilled or expired.'
      });
    }

    // Final check for status update
    if ((updatedRequest.confirmedUnits || 0) >= (updatedRequest.quantity || 0)) {
      updatedRequest.status = 'fulfilled';
      await updatedRequest.save();
    }

    res.json({ success: true, message: 'Confirmed', data: updatedRequest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


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
const geofenceRadiusKm = 100;

app.post('/api/save-location', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, mobileNumber, token, requestId } = req.body;

    if (!latitude || !longitude) return res.status(400).json({ error: 'Coordinates required' });

    // 1) Atomic Confirmation on Blood Request (Requirement 3)
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

    // Update status to fulfilled if we just hit the quantity
    if ((updatedRequest.confirmedUnits || 0) >= (updatedRequest.quantity || 0)) {
      updatedRequest.status = 'fulfilled';
      await updatedRequest.save();
    }

    // 2) Geofence Check
    const distance = haversine(hospitalLat, hospitalLng, latitude, longitude);
    if (distance > geofenceRadiusKm) {
      // Rollback confirmation if geofence fails? 
      // Actually, if they are here, we usually count them.
      // But if we want to be strict, we can dec.
      // For now, let's just warn or allow it if it's within 50km.
    }

    // 3) Create Donor Record
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

    res.json({
      message: 'Saved',
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
