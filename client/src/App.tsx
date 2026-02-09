// filepath: d:\Donor_Location\Donor_Location\client\src\App.tsx
import React from 'react';
import './App.css';
import QRCode from 'qrcode';

const getApiBaseUrl = () => {
  // Check if we're on a devtunnel URL
  if (window.location.hostname.includes('.devtunnels.ms')) {
    return '';
  }
  // Check if we're on Render
  if (window.location.hostname.includes('.onrender.com')) {
    return '';
  }
  // In development, React dev server runs on 3001, backend on 3000
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return ''; // Use relative URLs in production
};
const API_BASE_URL = getApiBaseUrl();

// Function to generate and download donor card PNG
const generateAndDownloadDonorCard = async (qrData: any, donorId: string, mobileNumber: string) => {
  try {
    // Extract requestId from URL path (e.g., /donor-location/68d01d1b06f6b3941cece196)
    const urlPath = window.location.pathname;
    const pathParts = urlPath.split('/');
    const currentRequestId = pathParts[pathParts.length - 1]; // Get last part of path

    // Still check for token in query params if needed
    const urlParams = new URLSearchParams(window.location.search);
    const currentToken = urlParams.get('token');

    console.log('Current URL:', window.location.href);
    console.log('URL path:', window.location.pathname);
    console.log('URL Search params:', window.location.search);
    console.log('Extracted requestId from path:', currentRequestId);
    console.log('Extracted token from query:', currentToken);
    console.log('Backend qrData:', qrData);

    // ALWAYS use current URL parameters, ignore backend values
    const updatedQrData = {
      ...qrData,
      requestId: currentRequestId, // Always use current URL value
      token: currentToken // Always use current URL value
    };

    console.log('Final QR Data being encoded:', updatedQrData);

    // Format QR data as readable text
    const qrText = `REQUEST_ID
${updatedQrData.requestId || 'N/A'}
DONOR_ID
${donorId}
Mobile:
${mobileNumber}`;

    console.log('QR Text format:', qrText);

    // Generate QR code as data URL with formatted text
    const qrCodeDataURL = await QRCode.toDataURL(qrText, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (mobile-optimized)
    canvas.width = 400;
    canvas.height = 600;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Title
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BLOOD REQUEST RESPONSE', canvas.width / 2, 50);

    // Donor ID (prominent)
    ctx.fillStyle = '#007bff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DONOR ID', canvas.width / 2, 90);

    ctx.fillStyle = '#007bff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(donorId, canvas.width / 2, 120);

    // Donor Information
    ctx.fillStyle = '#2c3e50';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';

    const leftMargin = 30;
    let yPos = 160;

    ctx.fillText('Mobile:', leftMargin, yPos);
    ctx.font = 'bold 16px Arial';
    ctx.fillText(mobileNumber, leftMargin + 70, yPos);

    // Add Request ID and Token if available
    if (updatedQrData.requestId) {
      yPos += 30;
      ctx.font = '16px Arial';
      ctx.fillText('Request ID:', leftMargin, yPos);
      ctx.font = 'bold 16px Arial';
      ctx.fillText(updatedQrData.requestId, leftMargin + 100, yPos);
    }

    if (updatedQrData.token) {
      yPos += 30;
      ctx.font = '16px Arial';
      ctx.fillText('Token:', leftMargin, yPos);
      ctx.font = 'bold 16px Arial';
      ctx.fillText(updatedQrData.token.substring(0, 8) + '...', leftMargin + 60, yPos);
    }

    // QR Code section
    yPos += 50;
    ctx.fillStyle = '#007bff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN QR CODE', canvas.width / 2, yPos);

    // Load and draw QR code
    const qrImage = new Image();
    qrImage.onload = () => {
      const qrSize = 180;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = yPos + 20;

      // QR code background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

      // Draw QR code
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // Instructions
      ctx.fillStyle = '#6c757d';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Present this response card at the donation center', canvas.width / 2, qrY + qrSize + 40);

      // Download the PNG
      const link = document.createElement('a');
      link.download = `blood-request-response-${donorId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    qrImage.src = qrCodeDataURL;

  } catch (error) {
    console.error('Error generating donor card:', error);
  }
};

// Updated: Demo version 1.1

function App() {
  const [result, setResult] = React.useState('');
  const [currentCoords, setCurrentCoords] = React.useState<{ lat: number, lng: number, acc: number } | null>(null);
  const [mobileNumber, setMobileNumber] = React.useState('');
  const [locationStatus, setLocationStatus] = React.useState<'getting' | 'success' | 'error' | 'denied'>('getting');

  // Extract requestId from URL path and token from query params
  const urlPath = window.location.pathname;
  const pathParts = urlPath.split('/');
  const requestId = pathParts[pathParts.length - 1]; // Get last part of path

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Debug URL parameters
  React.useEffect(() => {
    console.log('Component mounted - URL:', window.location.href);
    console.log('Component mounted - URL path:', window.location.pathname);
    console.log('Component mounted - Search params:', window.location.search);
    console.log('Component mounted - Extracted requestId from path:', requestId);
    console.log('Component mounted - token:', token);
  }, [token, requestId]);

  // Auto-fetch location when component mounts
  React.useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setResult("❌ Geolocation not supported.");
      setLocationStatus('error');
      return;
    }

    setResult("📍 Getting your location...");
    setLocationStatus('getting');

    // Use getCurrentPosition with high accuracy for faster single reading
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy
        };

        // If accuracy is good enough (< 50m), use it immediately
        if (coords.acc <= 50) {
          setCurrentCoords(coords);
          setLocationStatus('success');
          setResult(`
            <p>✅ Location captured successfully!</p>
            <p>Accuracy: ±${coords.acc.toFixed(2)} meters</p>
            <p>Please fill in your details below and submit.</p>
          `);
        } else {
          // If accuracy is poor, try one more time with watchPosition for better accuracy
          setResult("📍 Improving location accuracy...");

          const watchId = navigator.geolocation.watchPosition(
            pos2 => {
              const coords2 = {
                lat: pos2.coords.latitude,
                lng: pos2.coords.longitude,
                acc: pos2.coords.accuracy
              };

              // Use the better of the two readings
              const bestCoords = coords2.acc < coords.acc ? coords2 : coords;

              navigator.geolocation.clearWatch(watchId);
              setCurrentCoords(bestCoords);
              setLocationStatus('success');
              setResult(`
                <p>✅ Location captured successfully!</p>
                <p>Accuracy: ±${bestCoords.acc.toFixed(2)} meters</p>
                <p>Please fill in your details below and submit.</p>
              `);
            },
            err => {
              // If watch fails, use the first reading anyway
              navigator.geolocation.clearWatch(watchId);
              setCurrentCoords(coords);
              setLocationStatus('success');
              setResult(`
                <p>✅ Location captured!</p>
                <p>Accuracy: ±${coords.acc.toFixed(2)} meters</p>
                <p>Please fill in your details below and submit.</p>
              `);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setResult(`❌ Location access denied. Please enable location services and refresh the page.`);
        } else {
          setLocationStatus('error');
          setResult(`❌ Error getting location: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Helper function to format mobile number with country code
  const formatMobileNumber = (mobile: string): string => {
    // Remove all spaces and hyphens
    let cleaned = mobile.trim().replace(/[\s-]/g, '');

    // If it already starts with +91, return as is
    if (cleaned.startsWith('+91')) {
      return cleaned;
    }

    // If it starts with 91 (without +), add the +
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      return '+' + cleaned;
    }

    // If it starts with 0, remove it (Indian mobile numbers don't have leading 0)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Add +91 prefix
    return '+91' + cleaned;
  };

  const saveCurrentLocation = async () => {
    if (!currentCoords || !mobileNumber.trim()) {
      setResult('❌ Please enter your mobile number.');
      return;
    }

    if (!currentCoords) {
      setResult("❌ Location not available. Please refresh the page and allow location access.");
      return;
    }

    setResult("💾 Saving your location to database...");

    // Format mobile number with country code
    const formattedMobile = formatMobileNumber(mobileNumber);
    console.log('Original mobile:', mobileNumber);
    console.log('Formatted mobile:', formattedMobile);

    // Debug: Log URL parameters
    console.log('URL Parameters:', { token, requestId });

    try {
      const requestBody = {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        accuracy: currentCoords.acc,
        mobileNumber: formattedMobile,
        token,
        requestId
      };

      // Debug: Log what we're sending to backend
      console.log('Sending to backend:', requestBody);

      const res = await fetch(`${API_BASE_URL}/api/save-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();

      // Debug: Log what we received from backend
      console.log('Received from backend:', data);
      console.log('QR Data:', data.qrData);

      if (data.error) {
        setResult(`❌ ${data.error}`);
      } else {
        // Generate PNG with donor info and QR code (use formatted number)
        await generateAndDownloadDonorCard(data.qrData, data.donorId, formattedMobile);

        setResult(`
          <p>✅ Blood request response submitted!</p>
          <p><strong>Mobile:</strong> ${formattedMobile}</p>
          <p><strong>Donor ID:</strong> ${data.donorId}</p>
          <p>📥 Your response card has been downloaded automatically!</p>
          <p>🚗 Redirecting to Google Maps for directions...</p>
        `);

        // Hospital Coordinates (Must match server)
        const HOSPITAL_LAT = 22.6023;
        const HOSPITAL_LNG = 72.8205;

        // Redirect to Google Maps Directions
        const origin = `${currentCoords.lat},${currentCoords.lng}`;
        const destination = `${HOSPITAL_LAT},${HOSPITAL_LNG}`;
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

        setTimeout(() => {
          window.open(mapsUrl, '_blank');
        }, 2000); // 2 second delay to let them see the success message first

        // Clear form after successful submission
        setMobileNumber('');
        setCurrentCoords(null);
      }
    } catch (err: any) {
      setResult(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="App">
      <div className="app-container">
        <h1 className="app-title">📍 Donor Location Tracker</h1>

        {/* Blood Request Info */}
        {token && requestId && (
          <div className="card blood-request-card">
            <h3 className="blood-request-title">🩸 Blood Request Response</h3>
            <p>You're responding to Blood Request: <strong>{requestId}</strong></p>
            <p>Token: <code>{token}</code></p>
          </div>
        )}

        {/* Location Status */}
        {locationStatus === 'getting' && (
          <div className="card status-getting">
            <h3>🔍 Detecting Your Location...</h3>
            <p>Please allow location access when prompted by your browser.</p>
          </div>
        )}

        {locationStatus === 'denied' && (
          <div className="card status-denied">
            <h3>❌ Location Access Required</h3>
            <p>This app needs your location to respond to the blood request.</p>
            <button className="refresh-button" onClick={() => window.location.reload()}>
              🔄 Refresh & Try Again
            </button>
          </div>
        )}

        {locationStatus === 'success' && (
          <div className="card status-success">
            <h3>✅ Location Captured Successfully!</h3>
            <p>Please fill in your details below to respond to the blood request.</p>
          </div>
        )}

        {/* Form - Only show when location is captured */}
        {locationStatus === 'success' && (
          <div className="card form-card">
            <h3 className="form-title">📱 Enter Your Mobile Number</h3>
            <div style={{ marginBottom: '20px' }}>
              <input
                className="input-field"
                type="tel"
                placeholder="Mobile Number"
                value={mobileNumber}
                onChange={e => setMobileNumber(e.target.value)}
              />
            </div>
            <button
              className="submit-button"
              onClick={saveCurrentLocation}
              disabled={!mobileNumber.trim()}
            >
              📍 Submit My Location
            </button>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="card result-card">
            <div dangerouslySetInnerHTML={{ __html: result }} />
          </div>
        )}

        {/* Download Success Message */}
        {result && result.includes('downloaded') && (
          <div className="card status-success">
            <h3>🎉 Response Submitted!</h3>
            <p>Your blood request response card has been downloaded to your device.</p>
            <p>Present the downloaded card at the donation center.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
