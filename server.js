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
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID; // Load Application SID
const client = twilio(accountSid, authToken);
const websocketURL = process.env.WS_URL;

let phoneNumber; // to store the recipient's phone number

// SSL Certificates
// const privateKey = fs.readFileSync('./certificates/key.pem', 'utf8');
// const certificate = fs.readFileSync('./certificates/cert.pem', 'utf8');

// Call the function with your Application SID and the new Voice URL
const newVoiceUrl = `${process.env.BASE_URL}/makeCall`;

// Middleware
app.use(helmet());
app.use(cors({ origin: 'http://127.0.0.1:5500' })); // adjust origin as needed
app.use(express.json());

// Function to update the Voice URL
async function updateVoiceUrl(appSid, newVoiceUrl) {
  try {
    const application = await client.applications(appSid)
      .update({ voiceUrl: newVoiceUrl });

    console.log(`Updated Voice URL to: ${application.voiceUrl}`);
  } catch (error) {
    console.error('Error updating Voice URL:', error);
  }
}


// Endpoint to generate Twilio token
app.get('/token', (req, res) => {

  updateVoiceUrl(twimlAppSid, newVoiceUrl);

  const capability = new twilio.jwt.ClientCapability({
    accountSid: accountSid,
    authToken: authToken,
  });

  // Check if the Application SID is correctly set
  if (!twimlAppSid) {
    console.error("Missing TwiML App SID. Please add it to your .env file.");
    return res.status(500).json({ error: "TwiML App SID not configured" });
  }

  capability.addScope(
    new twilio.jwt.ClientCapability.OutgoingClientScope({
      applicationSid: twimlAppSid,
    })
  );

  const token = capability.toJwt();
  res.json({ token });
});

// Store phone number from the client
app.post('/getNum', (req, res) => {
  const { number } = req.body;
  phoneNumber = number;
  res.json({ status: "Number received" });
});

// Initiate call using TwiML
app.post('/makeCall', (req, res) => {

  if (!phoneNumber) {
    return res.status(400).send('Phone number is required.');
  }

  // Generate TwiML response for the call
  const twiml = new twilio.twiml.VoiceResponse();
  start.stream({
    url: websocketURL, // WebSocket URL where the audio stream will be sent
    name: 'Call Audio Stream',
    track: 'both_tracks' // Stream both inbound and outbound audio
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

// Create HTTPS server
// const httpsServer = https.createServer(
//   {
//     key: privateKey,
//     cert: certificate,
//   },
//   app
// );

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
