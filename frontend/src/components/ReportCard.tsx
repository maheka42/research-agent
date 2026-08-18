"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { IconDocument, IconDownload } from "@/components/icons";

export function ReportCard({
  report,
  createdAt,
  revised = false,
}: {
  report: string;
  createdAt: number;
  revised?: boolean;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!reportRef.current || isDownloading) return;

    setIsDownloading(true);

    let pdfElement: HTMLElement | null = null;

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      // Clone the visible report so PDF styling does not affect the dark UI.
      pdfElement = reportRef.current.cloneNode(true) as HTMLElement;

      // PDF-specific styling.
      pdfElement.style.backgroundColor = "#ffffff";
      pdfElement.style.color = "#000000";
      pdfElement.style.padding = "20mm";
      pdfElement.style.width = "170mm";
      pdfElement.style.fontFamily = "Arial, Helvetica, sans-serif";
      pdfElement.style.lineHeight = "1.6";
      pdfElement.style.fontSize = "11pt";

      // Force readable PDF colours.
      pdfElement.querySelectorAll("*").forEach((element) => {
        const el = element as HTMLElement;
        el.style.color = "#000000";
        el.style.backgroundColor = "#ffffff";
      });

      // Keep the temporary PDF element outside the visible UI.
      pdfElement.style.position = "absolute";
      pdfElement.style.left = "-100000px";
      pdfElement.style.top = "0";

      document.body.appendChild(pdfElement);

      const filename = `research-report-${new Date(createdAt)
        .toISOString()
        .slice(0, 10)}.pdf`;

      const pdfOptions = {
        margin: 0,
        filename,
        image: {
          type: "jpeg",
          quality: 0.98,
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: {
          mode: ["css", "legacy"],
        },
      };

      // html2pdf supports pagebreak, but its TypeScript definition
      // does not currently include it in Html2PdfOptions.
      await html2pdf()
        .set(pdfOptions as any)
        .from(pdfElement)
        .save();
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Unable to generate the PDF. Please try again.");
    } finally {
      // Always remove the temporary PDF element.
      if (pdfElement?.parentNode) {
        pdfElement.parentNode.removeChild(pdfElement);
      }

      setIsDownloading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="rounded-xl border border-card-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border bg-accent/5 flex items-center gap-2">
          <IconDocument className="text-accent" />

          <h2 className="text-lg font-semibold text-foreground">
            {revised ? "Updated Report" : "Research Report"}
          </h2>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg border border-card-border bg-background text-sm text-muted hover:text-foreground hover:border-accent/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconDownload />

            {isDownloading ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>

        {/* Dark UI report */}
        <div
          ref={reportRef}
          className="px-6 py-6 report-content"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}