import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

export async function downloadTicketAsPdf(teamId: string, teamName: string) {
  const element = document.getElementById(`ticket-${teamId}`);
  
  if (!element) {
    toast.error("Could not find the ticket element on the page.");
    return;
  }

  try {
    toast.loading("Generating PDF...", { id: `pdf-${teamId}` });
    
    // Use toPng for lossless crisp text and pixelRatio: 4 for ultra-high resolution
    const dataUrl = await toPng(element, { 
      pixelRatio: 4, 
    });
    
    const rect = element.getBoundingClientRect();
    const pdfWidth = Math.max(1, rect.width);
    const pdfHeight = Math.max(1, rect.height);
    
    // Create PDF with the exact dimensions of the element
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [pdfWidth, pdfHeight]
    });
    
    pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${teamName}-Ticket.pdf`);
    
    toast.success("PDF downloaded!", { id: `pdf-${teamId}` });
  } catch (error: any) {
    console.error("PDF Generation Error:", error);
    toast.error(`Failed: ${error?.message || "Unknown error"}`, { id: `pdf-${teamId}`, duration: 10000 });
  }
}
