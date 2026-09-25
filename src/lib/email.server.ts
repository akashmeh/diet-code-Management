import { createServerFn } from "@tanstack/react-start";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { qrPayload } from "./dietcode";
import { jsPDF } from "jspdf";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendTicketEmailFn = createServerFn({ method: "POST" })
  .validator((data: { teamId: string; isTest?: boolean; testEmail?: string; organizerEmail?: string }) => data)
  .handler(async ({ data }) => {
    const { teamId, isTest, testEmail, organizerEmail } = data;

    // 1. Fetch team data
    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("team_id", teamId)
      .single();

    if (teamError || !teamData) {
      return { success: false, message: "Team not found" };
    }

    const recipient = isTest ? testEmail : teamData.captain_email;
    if (!recipient) {
      return { success: false, message: "No recipient email available" };
    }

    try {
      // 2. Generate QR
      const qrDataUrl = await QRCode.toDataURL(qrPayload(teamData.qr_token), {
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });

      // 4. Generate PDF buffer
      const doc = new jsPDF();
      doc.setFontSize(24);
      doc.text("DIET CODE TICKET", 105, 20, { align: "center" });
      doc.setFontSize(16);
      doc.text(`Team ID: ${teamData.team_id}`, 20, 40);
      doc.text(`Team Name: ${teamData.team_name}`, 20, 50);
      doc.text("Scan QR to verify attendance", 20, 70);
      
      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      // 3. Build HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div style="background-color: #800020; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 14px; opacity: 0.9;">Team:</h2>
            <h1 style="margin: 4px 0 16px 0; font-size: 28px; text-transform: uppercase;">${teamData.team_name}</h1>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">September 26, 2026<br/>9:00 AM<br/>Srm Ramapuram, MLCP Lab - 6</p>
            <div style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 16px; text-align: left;">
              <span style="font-size: 12px; opacity: 0.8; display: block;">Team ID</span>
              <span style="font-size: 20px; font-weight: bold; color: #FFFF00;">${teamData.team_id}</span>
            </div>
          </div>
          <div style="padding: 24px; text-align: center; background-color: white;">
            <img src="${qrDataUrl}" alt="QR Code" style="width: 150px; height: 150px;" />
          </div>
        </div>
      `;

      // 5. Send Email
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"DIET CODE" <noreply@dietcode.com>',
        to: recipient,
        subject: `Your Ticket for DIET CODE - Team ${teamData.team_name}`,
        html,
        attachments: [
          {
            filename: `${teamData.team_id}-ticket.pdf`,
            content: pdfBuffer,
          }
        ]
      });

      // 6. Log success
      await supabase.from("email_logs").insert({
        team_uuid: teamData.id,
        team_id: teamData.team_id,
        team_name: teamData.team_name,
        recipient_email: recipient,
        status: isTest ? "test" : "sent",
        sent_by: organizerEmail || "system",
      });

      return { success: true, message: `Email sent to ${recipient}` };
    } catch (err: any) {
      console.error("Email send failed:", err);
      // Log failure
      await supabase.from("email_logs").insert({
        team_uuid: teamData.id,
        team_id: teamData.team_id,
        team_name: teamData.team_name,
        recipient_email: recipient,
        status: "failed",
        error_message: err?.message || "Unknown error",
        sent_by: organizerEmail || "system",
      });
      return { success: false, message: err?.message || "Unknown error" };
    }
  });

export const sendBulkTicketEmailsFn = createServerFn({ method: "POST" })
  .validator((data: { teamIds: string[]; isTest?: boolean; testEmail?: string; organizerEmail?: string }) => data)
  .handler(async ({ data }) => {
    const { teamIds, isTest, testEmail, organizerEmail } = data;
    const results = [];

    // Import the single handler so we can reuse it
    // Using a simpler approach here because calling serverFn inside serverFn is tricky in some setups
    for (const teamId of teamIds) {
      const res = await sendTicketEmailFn({
        data: { teamId, isTest, testEmail, organizerEmail }
      });
      results.push({ teamId, ...res });
    }

    return results;
  });
