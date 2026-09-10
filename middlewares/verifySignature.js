import crypto from "node:crypto";
import "dotenv/config";

export const verifySignature = (req, res, next) => {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;     
  
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET is not set in environment");
    return res.status(500).json({ success: false, message: "Server misconfigured" });
  }

  if (!signature) {
    return res.status(401).json({ success: false, message: "Missing signature header" });
  }
  
  if (!req.body) {
    return res.status(400).json({ success: false, message: "Raw body not available for verification" });
  }

  const expectedSignature =
    "sha256=" + crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  
  // Must check length before timingSafeEqual — it throws on mismatched lengths
  const isValid =
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!isValid) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }
  
  next();
};