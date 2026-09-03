import { createContext, useContext, useEffect, useState } from "react";

const translations = {
  en: { monitoring: "Monitoring", billing: "Billing", settings: "Settings", team: "Team", logout: "Logout", launch: "+ Launch New Server", active: "Active Servers", total: "Total Servers", cost: "Running Monthly Cost", servers: "Your Servers", status: "Status", region: "Region", actions: "Actions", dashboard: "Dashboard" },
  hi: { monitoring: "निगरानी", billing: "बिलिंग", settings: "सेटिंग्स", team: "टीम", logout: "लॉग आउट", launch: "+ नया सर्वर लॉन्च करें", active: "सक्रिय सर्वर", total: "कुल सर्वर", cost: "मासिक लागत", servers: "आपके सर्वर", status: "स्थिति", region: "क्षेत्र", actions: "क्रियाएं", dashboard: "डैशबोर्ड" },
};

const hindiText = {
  "Monitoring": "निगरानी", Billing: "बिलिंग", Settings: "सेटिंग्स", Team: "टीम", Compliance: "अनुपालन", Logout: "लॉग आउट", Dashboard: "डैशबोर्ड", "← Dashboard": "← डैशबोर्ड", "Save Changes": "बदलाव सहेजें", "Create API Key": "API कुंजी बनाएं", "Revoke": "रद्द करें", Active: "सक्रिय", Revoked: "रद्द", "Change Password": "पासवर्ड बदलें", "Set a Password": "पासवर्ड सेट करें", "Delete Account": "खाता हटाएं", "Launch New Server": "नया सर्वर लॉन्च करें", "Live Monitoring": "लाइव निगरानी", "Resource Usage Trend — Last 7 Days": "संसाधन उपयोग रुझान — पिछले 7 दिन", "Today's Incident Timeline": "आज की घटना समयरेखा", "Billing & Invoices": "बिलिंग और इनवॉइस", Invoices: "इनवॉइस", "Generate Invoice": "इनवॉइस बनाएं", "UPI AutoPay": "UPI ऑटोपे", "Enable AutoPay": "ऑटोपे सक्षम करें", "Save AutoPay": "ऑटोपे सहेजें", "Pay via UPI": "UPI से भुगतान", "Pay via Razorpay": "Razorpay से भुगतान", Cancel: "रद्द करें", "Download PDF": "PDF डाउनलोड करें", "Team Management": "टीम प्रबंधन", "Add team member": "टीम सदस्य जोड़ें", "Add member": "सदस्य जोड़ें", Members: "सदस्य", Remove: "हटाएं", "Account Settings": "खाता सेटिंग्स", "Profile Information": "प्रोफ़ाइल जानकारी", "API Keys": "API कुंजियां", "Key Name": "कुंजी नाम", "Welcome back": "वापसी पर स्वागत है", "Create your account": "अपना खाता बनाएं", "Your Servers": "आपके सर्वर", "Active Servers": "सक्रिय सर्वर", "Total Servers": "कुल सर्वर", "Running Monthly Cost": "मासिक चल रही लागत", Status: "स्थिति", Region: "क्षेत्र", Actions: "क्रियाएं", Restart: "पुनः आरंभ", Stop: "रोकें", Start: "शुरू करें", Delete: "हटाएं", Name: "नाम", Email: "ईमेल", Phone: "फ़ोन", GSTIN: "GSTIN", "Current Password": "वर्तमान पासवर्ड", "New Password": "नया पासवर्ड", "Confirm New Password": "नया पासवर्ड पुष्ट करें", "Confirm Delete": "हटाने की पुष्टि करें", Login: "लॉगिन", "Create Account": "खाता बनाएं"
};

function translatePage(language) {
  const nodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (nodes.nextNode()) textNodes.push(nodes.currentNode);
  textNodes.forEach((node) => {
    if (!node.__englishText) node.__englishText = node.nodeValue;
    const value = node.__englishText.trim();
    if (!value) return;
    const translated = language === "hi" ? hindiText[value] : node.__englishText;
    if (translated) node.nodeValue = node.__englishText.replace(value, translated);
  });
  document.querySelectorAll("input[placeholder]").forEach((input) => {
    if (!input.__englishPlaceholder) input.__englishPlaceholder = input.placeholder;
    input.placeholder = language === "hi" ? (hindiText[input.__englishPlaceholder] || input.__englishPlaceholder) : input.__englishPlaceholder;
  });
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("mc_language") || "en");
  function toggleLanguage() {
    const next = language === "en" ? "hi" : "en";
    localStorage.setItem("mc_language", next);
    setLanguage(next);
  }
  useEffect(() => { translatePage(language); }, [language]);
  return <LanguageContext.Provider value={{ language, toggleLanguage, t: translations[language] }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
