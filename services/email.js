import nodemailer from "nodemailer";
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendFailureEmail({ project, deploymentId, error, detailsUrl }) {
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #de5b5bff; color: #ffffff; padding: 16px 24px;">
            <h2 style="margin: 0; font-size: 18px;">Deployment Failed</h2>
            </div>

            <div style="padding: 24px; color: #333333;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                <td style="padding: 6px 0; color: #777777;">Project</td>
                <td style="padding: 6px 0; font-weight: bold;">${project.name}</td>
                </tr>
                <tr>
                <td style="padding: 6px 0; color: #777777;">Commit</td>
                <td style="padding: 6px 0; font-family: monospace;">${deploymentId.slice(0, 7)}</td>
                </tr>
            </table>

            <div style="margin-top: 16px; padding: 12px 16px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px; font-size: 13px; color: #991b1b; word-break: break-word;">
                ${error}
            </div>

            <a href="${detailsUrl}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
                View Run Details
            </a>
            </div>
        </div>
    `;

  try {
    await transporter.sendMail({
      from: `"CI/CD Server" <${process.env.SMTP_USER}>`,
      to: project.notifyEmail,
      subject: `Deployment Failed: ${project.name}`,
      html,
    });
    console.log(`[EMAIL] Deployment Failed notification sent for ${project.name} `);
  } catch (err) {
    console.error(`[EMAIL] Failed to send notification:`, err.message);
  }
}