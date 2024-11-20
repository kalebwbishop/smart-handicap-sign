/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const {sendPushNotification} = require("./notify");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

exports.sendPushNotification = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method Not Allowed"});
  }

  const {token, title, body} = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({error: "Missing required parameters"});
  }

  const result = await sendPushNotification(token, title, body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json({error: result.error});
  }
});
