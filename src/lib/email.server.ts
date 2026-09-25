import { createServerFn } from "@tanstack/react-start";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { qrPayload } from "./dietcode";
import fs from "fs";
import path from "path";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** Read the email.html template from src/assets and inject team-specific values */
function buildEmailHtml(opts: {
  teamName: string;
  teamId: string;
  qrCid: string;
}): string {
  const templatePath = path.resolve(
    process.cwd(),
    "src/assets/email.html"
  );
  let html = fs.readFileSync(templatePath, "utf-8");

  // Replace team name
  html = html.replace(/Spam chandra/g, opts.teamName);

  // Replace team ID
  html = html.replace(/DC001/g, opts.teamId);

  // Replace the external QR image URL with the inline CID reference
  html = html.replace(
    /https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/[^"']*/g,
    `cid:${opts.qrCid}`
  );

  return html;
}

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
      // 2. Generate QR as PNG buffer for inline embedding
      const qrBuffer = await QRCode.toBuffer(qrPayload(teamData.qr_token), {
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const qrCid = `qr-${teamData.team_id}@dietcode`;

      // 3. Build HTML from template
      const html = buildEmailHtml({
        teamName: teamData.team_name,
        teamId: teamData.team_id,
        qrCid,
      });

      // 4. Send Email with QR as inline CID attachment
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"DIET CODE" <noreply@dietcode.com>',
        to: recipient,
        subject: `Your Ticket for DIET CODE - Team ${teamData.team_name}`,
        html,
        attachments: [
          {
            filename: "qr.png",
            content: qrBuffer,
            cid: qrCid,
          },
        ],
      });

      // 5. Log success
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

    for (const teamId of teamIds) {
      const res = await sendTicketEmailFn({
        data: { teamId, isTest, testEmail, organizerEmail },
      });
      results.push({ teamId, ...res });
    }

    return results;
  });
