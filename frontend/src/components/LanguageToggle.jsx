import { useLanguage } from "../context/LanguageContext";

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  return <button className="btn btn-ghost" onClick={toggleLanguage} aria-label="Change language">{language === "en" ? "हिन्दी" : "English"}</button>;
}
