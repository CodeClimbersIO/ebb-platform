const sgMail = require('@sendgrid/mail');
const axios = require('axios');

const SENDGRID_KEY = process.env.SENDGRID_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const TARGET_URL = process.env.TARGET_URL || 'http://ebb-platform:8001/health';
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 1 minute default
const INITIAL_DELAY = parseInt(process.env.INITIAL_DELAY) || 120000; // 2 minutes default

const ONE_HOUR = 3600000;

// Set your SendGrid API key
sgMail.setApiKey(SENDGRID_KEY);
let lastEmailSentTime = null;

// Function to check if the application is healthy
async function checkApplicationHealth() {
  try {
    console.log(`Checking health at ${TARGET_URL}`);
    
    // Make a request to the health endpoint with a timeout
    const response = await axios.get(TARGET_URL, {
      timeout: 10000, // 10 second timeout
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Accept only 2xx status codes
      }
    });

    console.log(`Health check passed: ${response.status}`);
    return true;
  } catch (error) {
    console.error('Health check failed:', error.message);
    
    // Check if an email was already sent within the last hour
    if (!lastEmailSentTime || Date.now() - lastEmailSentTime >= ONE_HOUR) {
      console.log('Sending alert email...');
      
      // Send an email using SendGrid
      const msg = {
        to: NOTIFY_EMAIL,
        from: 'rphovley+uptime@gmail.com',
        subject: 'Alert: EBB Platform may be down',
        text: `The EBB Platform health check failed at ${new Date().toISOString()}.\n\nError: ${error.message}\n\nPlease check the status of your application.`,
        html: `
          <h2>EBB Platform Health Check Failed</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Target URL:</strong> ${TARGET_URL}</p>
          <p>Please check the status of your application.</p>
        `
      };
      
      try {
        await sgMail.send(msg);
        console.log('Alert email sent successfully');
        // Update the last email sent time
        lastEmailSentTime = Date.now();
      } catch (emailError) {
        console.error('Failed to send alert email:', emailError);
      }
    } else {
      console.log('Email already sent within the last hour, skipping...');
    }
    
    return false;
  }
}

// Start monitoring after initial delay
setTimeout(() => {
  console.log('Starting EBB Platform uptime monitoring...');
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Check interval: ${CHECK_INTERVAL}ms`);
  
  // Run initial check
  checkApplicationHealth();
  
  // Run the health check function at regular intervals
  setInterval(checkApplicationHealth, CHECK_INTERVAL);
}, INITIAL_DELAY);

console.log(`Uptime monitor will start in ${INITIAL_DELAY}ms...`);
