import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const jost = Jost({ variable: "--font-jost", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Chris Moore Interior Decor — Curtains, Bed Sheets, Blinds & Rugs",
    template: "%s · Chris Moore Interior Decor",
  },
  description:
    "Shop curtains & accessories, luxury bed sheets, made-to-measure vertical blinds and rugs. Order on WhatsApp or pay securely with Paystack or Flutterwave.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable} antialiased`}>
      <body className="min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#1f1b17",
              color: "#fbf8f4",
              fontSize: "14px",
              borderRadius: "10px",
              padding: "12px 16px",
            },
            success: { iconTheme: { primary: "#a8875e", secondary: "#fbf8f4" } },
            error: { iconTheme: { primary: "#e0705a", secondary: "#fbf8f4" } },
          }}
        />
      </body>
    </html>
  );
}
