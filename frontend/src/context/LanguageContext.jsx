import { createContext, useContext, useState } from "react";

const translations = {
  en: { monitoring: "Monitoring", billing: "Billing", settings: "Settings", team: "Team", logout: "Logout", launch: "+ Launch New Server", active: "Active Servers", total: "Total Servers", cost: "Running Monthly Cost", servers: "Your Servers", status: "Status", region: "Region", actions: "Actions", dashboard: "Dashboard" },
  hi: { monitoring: "निगरानी", billing: "बिलिंग", settings: "सेटिंग्स", team: "टीम", logout: "लॉग आउट", launch: "+ नया सर्वर लॉन्च करें", active: "सक्रिय सर्वर", total: "कुल सर्वर", cost: "मासिक लागत", servers: "आपके सर्वर", status: "स्थिति", region: "क्षेत्र", actions: "क्रियाएं", dashboard: "डैशबोर्ड" },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("mc_language") || "en");
  function toggleLanguage() {
    const next = language === "en" ? "hi" : "en";
    localStorage.setItem("mc_language", next);
    setLanguage(next);
  }
  return <LanguageContext.Provider value={{ language, toggleLanguage, t: translations[language] }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
