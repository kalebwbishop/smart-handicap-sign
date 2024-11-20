const admin = require("firebase-admin");

// Initialize Firebase Admin SDK only if it hasn't been initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Sends a push notification using Firebase Cloud Messaging.
 *
 * @param {string} token - The device token to which the notification
 * will be sent.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body text of the notification.
 * @return {Promise<Object>} A promise that resolves to an object
 * indicating the success or failure of the notification send operation.
 */
async function sendPushNotification(token, title, body) {
  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Notification sent successfully:", response);
    return {success: true, response};
  } catch (error) {
    console.error("Error sending notification:", error);
    return {success: false, error};
  }
}

module.exports = {sendPushNotification};
