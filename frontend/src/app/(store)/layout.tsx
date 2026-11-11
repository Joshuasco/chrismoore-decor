import Footer from "@/components/store/Footer";
import Header from "@/components/store/Header";
import TopBar from "@/components/store/TopBar";
import WhatsAppFab from "@/components/store/WhatsAppFab";
import { getCategories, getSettings } from "@/lib/api";
import { withContactDefaults } from "@/lib/contact";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [rawSettings, categories] = await Promise.all([getSettings(), getCategories()]);
  const settings = withContactDefaults(rawSettings);
  return (
    <>
      <TopBar announcement={settings.announcement} phone={settings.contact_phone} />
      <Header categories={categories} />
      <main>{children}</main>
      <Footer settings={settings} categories={categories} />
      <WhatsAppFab number={settings.whatsapp_number} />
    </>
  );
}
