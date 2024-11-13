require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs');

const app = express();

// Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
const client = twilio(accountSid, authToken);
const websocketURL = process.env.WS_URL;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Function to update the Voice URL with phone number
async function updateVoiceUrl(appSid, phoneNumber) {
  const newVoiceUrl = `${process.env.BASE_URL}/makeCall?phone=${encodeURIComponent(phoneNumber)}`;
  
  try {
    const application = await client.applications(appSid)
      .update({ voiceUrl: newVoiceUrl });

    console.log(`Updated Voice URL to: ${application.voiceUrl}`);
    return true;
  } catch (error) {
    console.error('Error updating Voice URL:', error);
    return false;
  }
}

// Endpoint to generate Twilio token
app.get('/token', async (req, res) => {
  const phoneNumber = req.query.phone;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  // Check if the Application SID is correctly set
  if (!twimlAppSid) {
    console.error("Missing TwiML App SID. Please add it to your .env file.");
    return res.status(500).json({ error: "TwiML App SID not configured" });
  }

  // Update Voice URL with the phone number
  const updated = await updateVoiceUrl(twimlAppSid, phoneNumber);
  if (!updated) {
    return res.status(500).json({ error: "Failed to update Voice URL" });
  }

  const capability = new twilio.jwt.ClientCapability({
    accountSid: accountSid,
    authToken: authToken,
  });

  capability.addScope(
    new twilio.jwt.ClientCapability.OutgoingClientScope({
      applicationSid: twimlAppSid,
    })
  );

  const token = capability.toJwt();
  res.json({ token });
});

// Initiate call using TwiML
app.post('/makeCall', (req, res) => {
  const phoneNumber = req.query.phone;

  if (!phoneNumber) {
    return res.status(400).send('Phone number is required.');
  }

  // Generate TwiML response for the call
  const twiml = new twilio.twiml.VoiceResponse();

  const start = twiml.start();
  start.stream({
    url: websocketURL,
    name: 'Call Audio Stream',
    track: 'both'
  });
  
  twiml.dial({ callerId: twilioPhoneNumber }, phoneNumber);

  // Send TwiML response as XML to Twilio
  res.type('text/xml');
  res.send(twiml.toString());
});

// Simple home route
app.get('/', (req, res) => {
  res.send('Twilio Browser-to-Phone Call Service');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});