import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

// Nodemailer config using existing setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export type ParticipantRecord = {
  trackingId?: string; // If it exists in tracking table
  teamId: string;
  teamUuid: string;
  teamName: string;
  participantName: string;
  participantEmail: string;
  isCheckedIn: boolean;
  certificateSent: boolean;
  certificateSentAt?: string;
  certificateSendError?: string;
};

export const fetchParticipantsFn = createServerFn({ method: "GET" })
  .validator((data: { filter: "all" | "checked_in" | "not_sent" }) => data)
  .handler(async ({ data: { filter } }) => {
    // 1. Fetch all teams (with check-in status)
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("*");
    if (teamsError) throw teamsError;

    // 2. Fetch certificate tracking
    const { data: tracking, error: trackingError } = await supabase
      .from("certificate_tracking")
      .select("*");
    if (trackingError) throw trackingError;

    const trackingMap = new Map();
    for (const t of tracking || []) {
      // Key by team_uuid_email or just email if standalone
      const key = t.team_uuid ? `${t.team_uuid}_${t.participant_email}` : `standalone_${t.participant_email}`;
      trackingMap.set(key, t);
    }

    const participants: ParticipantRecord[] = [];
    const processedTrackingIds = new Set();

    // Combine teams and their members into flat participants array
    for (const team of teams || []) {
      const isCheckedIn = !!team.checked_in_at;
      const members = team.members as { name: string; email?: string }[];
      
      const allMembers = [];
      if (team.captain_name && team.captain_email) {
        allMembers.push({ name: team.captain_name, email: team.captain_email });
      }
      for (const m of members || []) {
        if (m.name && m.email) {
          allMembers.push({ name: m.name, email: m.email });
        }
      }

      for (const m of allMembers) {
        const track = trackingMap.get(`${team.id}_${m.email}`);
        if (track) processedTrackingIds.add(track.id);
        
        participants.push({
          trackingId: track?.id,
          teamId: team.team_id,
          teamUuid: team.id,
          teamName: team.team_name,
          participantName: m.name,
          participantEmail: m.email,
          isCheckedIn,
          certificateSent: track?.certificate_sent || false,
          certificateSentAt: track?.certificate_sent_at,
          certificateSendError: track?.certificate_send_error,
        });
      }
    }

    // Include standalone imported tracking records
    for (const t of tracking || []) {
      if (!processedTrackingIds.has(t.id)) {
        participants.push({
          trackingId: t.id,
          teamId: t.team_uuid ? "—" : "Imported",
          teamUuid: t.team_uuid || "",
          teamName: t.team_uuid ? "Unknown Team" : "Imported",
          participantName: t.participant_name,
          participantEmail: t.participant_email,
          isCheckedIn: true, // Imported are generally considered attended
          certificateSent: t.certificate_sent || false,
          certificateSentAt: t.certificate_sent_at,
          certificateSendError: t.certificate_send_error,
        });
      }
    }

    // Filter
    let filtered = participants;
    if (filter === "checked_in") {
      filtered = participants.filter((p) => p.isCheckedIn);
    } else if (filter === "not_sent") {
      filtered = participants.filter((p) => !p.certificateSent);
    }

    return { participants: filtered };
  });

async function generateCertificatePdf(name: string): Promise<Buffer> {
  const templatePath = path.resolve(process.cwd(), "src/assets/template.pdf");
  if (!fs.existsSync(templatePath)) {
    throw new Error("template.pdf not found in src/assets");
  }
  const templateBuffer = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBuffer);
  
  const fontPath = path.resolve(process.cwd(), "src/assets/Poppins-Medium.ttf");
  if (!fs.existsSync(fontPath)) {
    throw new Error("Poppins-Medium.ttf not found in src/assets");
  }
  const fontBytes = fs.readFileSync(fontPath);
  pdfDoc.registerFontkit(await import('@pdf-lib/fontkit').then(m => m.default || m));
  const font = await pdfDoc.embedFont(fontBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width } = firstPage.getSize();

  const fontSize = 28;
  const textWidth = font.widthOfTextAtSize(name, fontSize);
  const x = (width - textWidth) / 2;
  const y = 266;

  firstPage.drawText(name, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export const sendTestCertificateFn = createServerFn({ method: "POST" })
  .validator((data: { name: string; testEmail: string }) => data)
  .handler(async ({ data: { name, testEmail } }) => {
    try {
      const pdfBuffer = await generateCertificatePdf(name);
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"DietCode" <noreply@dietcode.com>',
        to: testEmail,
        subject: `Test Certificate - ${name}`,
        html: `<p>Hi ${name},</p><p>Here is your test certificate.</p>`,
        attachments: [
          {
            filename: "Certificate.pdf",
            content: pdfBuffer,
          },
        ],
      });

      // Log test send
      await supabase.from("certificate_send_log").insert({
        email: testEmail,
        status: "test",
      });

      return { success: true };
    } catch (error: any) {
      await supabase.from("certificate_send_log").insert({
        email: testEmail,
        status: "test",
        error_message: error.message,
      });
      return { success: false, error: error.message };
    }
  });

export const sendCertificatesFn = createServerFn({ method: "POST" })
  .validator((data: { participants: ParticipantRecord[] }) => data)
  .handler(async ({ data: { participants } }) => {
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const p of participants) {
      // Small throttle
      await new Promise((r) => setTimeout(r, 500));

      let trackingId = p.trackingId;

      if (!trackingId) {
        // Upsert tracking record if it doesn't exist
        const { data: inserted, error: insertError } = await supabase
          .from("certificate_tracking")
          .upsert(
            {
              team_uuid: p.teamUuid,
              participant_name: p.participantName,
              participant_email: p.participantEmail,
              certificate_sent: false,
            },
            { onConflict: "team_uuid,participant_email" }
          )
          .select()
          .single();
        
        if (insertError || !inserted) {
          failed++;
          results.push({ email: p.participantEmail, status: "failed", error: "Could not create tracking record" });
          continue;
        }
        trackingId = inserted.id;
      }

      try {
        const pdfBuffer = await generateCertificatePdf(p.participantName);
        
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"DietCode" <noreply@dietcode.com>',
          to: p.participantEmail,
          subject: `Your DIET CODE Certificate - ${p.participantName}`,
          html: `<p>Hi ${p.participantName},</p><p>Congratulations on participating! Please find your certificate attached.</p>`,
          attachments: [
            {
              filename: `${p.participantName}-Certificate.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        await supabase.from("certificate_tracking").update({
          certificate_sent: true,
          certificate_sent_at: new Date().toISOString(),
          certificate_send_error: null,
        }).eq("id", trackingId);

        await supabase.from("certificate_send_log").insert({
          tracking_id: trackingId,
          email: p.participantEmail,
          status: "success",
        });

        sent++;
        results.push({ email: p.participantEmail, status: "success" });
      } catch (error: any) {
        await supabase.from("certificate_tracking").update({
          certificate_sent: false,
          certificate_send_error: error.message,
        }).eq("id", trackingId);

        await supabase.from("certificate_send_log").insert({
          tracking_id: trackingId,
          email: p.participantEmail,
          status: "failed",
          error_message: error.message,
        });

        failed++;
        results.push({ email: p.participantEmail, status: "failed", error: error.message });
      }
    }

    return { sent, failed, results };
  });

export const importCertificatesFn = createServerFn({ method: "POST" })
  .validator((data: { participants: { name: string; email: string }[] }) => data)
  .handler(async ({ data: { participants } }) => {
    let imported = 0;
    let failed = 0;
    
    for (const p of participants) {
      if (!p.name || !p.email) {
        failed++;
        continue;
      }
      const { error } = await supabase
        .from("certificate_tracking")
        .insert({
          participant_name: p.name,
          participant_email: p.email,
          certificate_sent: false,
          team_uuid: null,
        });
      
      if (error) {
        if (error.code === "23505") {
          failed++; // Just a duplicate
        } else {
          throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
        }
      } else {
        imported++;
      }
    }
    return { imported, failed };
  });

export const deleteCertificatesFn = createServerFn({ method: "POST" })
  .validator((data: { trackingIds: string[] }) => data)
  .handler(async ({ data: { trackingIds } }) => {
    if (!trackingIds.length) return { success: true };
    const { error } = await supabase
      .from("certificate_tracking")
      .delete()
      .in("id", trackingIds);
    if (error) throw new Error(error.message);
    return { success: true };
  });

