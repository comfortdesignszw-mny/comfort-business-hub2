import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ChevronLeft, Mail, Phone, Lock, Eye, Share2, Database, Trash2, Globe, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher, { SupportedLanguage } from '../components/LanguageSwitcher';

interface PrivacyContent {
  title: string;
  subtitle: string;
  version: string;
  lastUpdated: string;
  welcome1: string;
  welcome2: string;
  recentUpdatesTitle: string;
  recentUpdates: string[];
  sec1Title: string;
  sec1Sub: string;
  sec1A_title: string;
  sec1A_items: string[];
  sec1B_title: string;
  sec1B_body: string;
  sec1C_title: string;
  sec1C_items: string[];
  sec1D_title: string;
  sec1D_body1: string;
  sec1D_body2: string;
  sec2Title: string;
  sec2Uses: string[];
  sec3Title: string;
  sec3PublicTitle: string;
  sec3PublicBody: string;
  sec3LegalTitle: string;
  sec3LegalBody: string;
  sec4Title: string;
  sec4Body: string;
  sec5Title: string;
  sec5Body: string;
  sec6Title: string;
  sec6Body: string;
  sec7Title: string;
  sec7Body: string;
  sec8Title: string;
  sec8Body: string;
  sec9Title: string;
  sec9Body: string;
  contactTitle: string;
  contactSub: string;
}

const PRIVACY_ENGLISH: PrivacyContent = {
  title: "Privacy",
  subtitle: "Policy",
  version: "Data Protocol 1.1.0",
  lastUpdated: "Last Updated: August 4, 2026",
  welcome1: "Comfort Business Hub (\"we,\" \"our,\" or \"us\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Web Application, order tracking tools, and marketplace services (\"the Platform\").",
  welcome2: "By accessing or using the Platform, including placing guest orders or tracking delivery status, you agree to the collection and use of information in accordance with this policy.",
  recentUpdatesTitle: "Recent Data & Order Tracking Updates (August 2026)",
  recentUpdates: [
    "Order Tracking Telemetry: Order records process customer phone numbers, delivery coordinates, and product preferences to power the 4-stage fulfillment pipeline and auditable history logs.",
    "Guest Checkout Data Protocols: Guest orders store local order tokens in client-side HTML5 localStorage (`guest_deal_ids`). Phone numbers provided during guest checkout are used strictly for supplier dispatch and phone-based order status lookup.",
    "Auditable Transaction Timestamp Logs: Timestamps (`createdAt`, `updatedAt`, and stage update history) are maintained in Firestore to record order progression transparently for buyers and suppliers.",
    "Supplier Order Notification Telemetry: Unfulfilled order counts are queried in real time to generate supplier notification badges in Markets/DealRoom.",
    "Payment Method Configuration Data: Supplier payment settings (PayPal links, Stripe identifiers, EcoCash USSD codes, Cash/POD) are stored securely in profile metadata to render customized checkout options for buyers."
  ],
  sec1Title: "01. Information We Collect",
  sec1Sub: "We collect information about you in three ways: information you provide directly, information collected automatically, and information from third-party services.",
  sec1A_title: "A. Information You Provide to Us",
  sec1A_items: [
    "Account and Profile Data: When you sign up and log in using Google Authentication, we receive personal data from Google, which includes your Full Name, Email Address, and Profile Image.",
    "Storefront and Contact Data: To set up a storefront, list products/services, or complete a profile, you provide us with your Phone Number, business description, and media uploaded.",
    "Communication Data: Information provided when contacting support or submitting feedback.",
    "Reporting and Abuse Data: Details collected when reporting or being reported for infractions."
  ],
  sec1B_title: "B. Information Collected Automatically",
  sec1B_body: "Log and Usage Data: When you access the Platform, our servers automatically log standard information, such as IP address, browser type, and page views. We use cookies to maintain your login session.",
  sec1C_title: "C. Information from Third-Parties",
  sec1C_items: [
    "Google Auth: Google shares your basic profile details with us.",
    "Payment Gateways: We receive transaction confirmation tokens but do not store full credit card numbers or banking passwords."
  ],
  sec1D_title: "D. Guest Sessions & Local Sandbox Storage",
  sec1D_body1: "Local Storage Protocols: Guest profile vectors, authorization keys, and session parameters are stored strictly in client-side HTML5 local storage (localStorage) within your browser.",
  sec1D_body2: "Inquiry Analytics: For guests initiating inquiries (\"Talk\") or submitting purchase intents (\"Order Now\"), the Platform logs a conversion signal to record store volume without persisting personal email addresses.",
  sec2Title: "02. How We Use Information",
  sec2Uses: [
    "Maintain Platform Access",
    "Facilitate Communications",
    "Improve Service Logic",
    "Security & Safety Protocols",
    "Compliance with Law",
    "Automated Abuse Detection"
  ],
  sec3Title: "03. Sharing Protocol",
  sec3PublicTitle: "Public Visibility",
  sec3PublicBody: "Your business storefront (Name, Phone, Listings) will be visible to potential buyers in the Zimbabwe marketplace.",
  sec3LegalTitle: "Legal Disclosures",
  sec3LegalBody: "We may disclose information if required by law or to protect the safety/rights of our users or the public.",
  sec4Title: "04. Automated Enforcement",
  sec4Body: "To protect our community, we use automated logic to process reports. If an account is reported three (3) times within a month for verified abuse, the system will automatically suspend the account to prevent further harm.",
  sec5Title: "05. Data Security",
  sec5Body: "We implement industry-standard encryption (HTTPS) to safeguard data. While we use commercially acceptable means to protect information, no method of transmission is 100% secure.",
  sec6Title: "06. Retention",
  sec6Body: "Data is retained as long as your account is active. Deleted account data is anonymized unless required for tax compliance records or disciplinary history.",
  sec7Title: "07. Your Rights",
  sec7Body: "You have the right to access, correct, or request deletion of your personal data. Guest session users can instantly execute their right to erasure of session info by selecting \"Terminate Guest Session\" inside the dashboard.",
  sec8Title: "08. Children’s Privacy",
  sec8Body: "The Platform is not intended for individuals under 18. We do not knowingly collect personal data from children.",
  sec9Title: "09. Changes to Policy",
  sec9Body: "We periodically update this policy. Changes are notified via the \"Last Updated\" date on this page.",
  contactTitle: "Privacy Support",
  contactSub: "Contact our privacy team"
};

const PRIVACY_SHONA: PrivacyContent = {
  title: "Mitemo ye",
  subtitle: "Privacy (chiShona)",
  version: "Data Protocol 1.0.2",
  lastUpdated: "Kupedzisira Kuvandudzwa: May 17, 2026",
  welcome1: "Comfort Business Hub (\"isusu\") yakazvipira kuchengetedza chivande chenyu. Mutemo wePrivacy uyu unotsanangura munganidzo yekutora, kushandisa, nekuvanza ruzivo rwenyu.",
  welcome2: "Nekushandisa Platform iyi, unobvuma kuunganidzwa nekushandiswa kweruzivo zvinoenderana nemutemo uyu.",
  recentUpdatesTitle: "Zvakavandudzwa Zvazvino reRuzivo (Chikunguru 2026)",
  recentUpdates: [
    "Ruzivo rweKubhadhara kwemutengesi: Zvirimwa zvePayPal, Stripe, EcoCash USSD, nePOD zvakachengetedzwa kuitira kuratidza nzira dzekubhadhara kune vatengi.",
    "WhatsApp App Link: \"Talk on WhatsApp\" inoshandisa zvakananga WhatsApp Business pafoni yako.",
    "Ruzivo rweLive Inventory: Kudzora zvigadzirwa paprofile nekuona huwandu hwezvinhu zviripo.",
    "Nzvimbo dzeGeo-Targeting: Kushandisa geographic location kuratidza zvitoro nemitengo zviri pedyo nemi.",
    "Neural Member Network: Profiling nekuonekwa nevatengi mu-Member Network kuitira B2B neB2C."
  ],
  sec1Title: "01. Ruzivo Rwatinounganidza",
  sec1Sub: "Tinounganidza ruzivo rwenyu munzira nhatu: rwamunopa zvakananga, rwunounganidzwa nemuchina, nerwevamwe vanhu.",
  sec1A_title: "A. Ruzivo Rwamunopa Kwatiri",
  sec1A_items: [
    "Akaunti neRuzivo rweProfile: Paunopinda neGoogle, tinogamuchira Zita Rako, Email Address, neMufananidzo kubva kuGoogle.",
    "Ruzivo rweChitoro: Kuitira kumisa chitoro, unopa Nhamba dzeFoni, Tsanangudzo yebhizimisi, nemifananidzo.",
    "Mharidzo dzerubatsiro: Ruzivo rwese rwamunotumira kuvatsigiri vedu.",
    "Ruzivo rweMhosva: Details dzevanhu vanobebera kana vamhan'arirwa mhosva."
  ],
  sec1B_title: "B. Ruzivo Rwunounganidzwa neMuchina",
  sec1B_body: "Ruzivo rwe-IP Address, browser mhando, ne-page views. Tinoshangisa cookies kuchengetedza login yako.",
  sec1C_title: "C. Ruzivo rweVamwe (Third-Parties)",
  sec1C_items: [
    "Google Auth: Google inogoverana zita ne-email yako nesu.",
    "Payment Gateways: Tinogamuchira ma-transaction tokens pasina kuchengeta ma-credit card numbers azere."
  ],
  sec1D_title: "D. VaEshanyi (Guest Sessions) ne-LocalStorage",
  sec1D_body1: "Ruzivo rwe-Guest rwunochengetedzwa mu-HTML5 LocalStorage pa-browser yefoni kana komputa yako.",
  sec1D_body2: "Kana mueni anzvengesa kutaura pa-Talk kana Order Now, chirongwa chinochengeta muenzaniso wehuwandu hwazvo pasina kuchengeta ma-email zvachose.",
  sec2Title: "02. Kushandiswa kweRuzivo",
  sec2Uses: [
    "Kupa Mukana paPlatform",
    "Kufambisa Kukurukurirana",
    "Kuvandudza Masevhisi",
    "Kuchengetedza neKudzivirira",
    "Kutevedzera Mitemo",
    "Kutsvaga Mhosva neMuchina"
  ],
  sec3Title: "03. Kugoverana Ruzivo",
  sec3PublicTitle: "Kunoonekwa neRuzhinji",
  sec3PublicBody: "Chitoro chako (Zita, Foni, Zvinhu) chingaonekwa nevatengi vese muZimbabwe.",
  sec3LegalTitle: "Zviga zveMutemo",
  sec3LegalBody: "Tinogona kuburitsa ruzivo kana zvichidiwa nemutemo wenyika kudzivirira kodzero dzevanhu.",
  sec4Title: "04. Chirango cheAutomated Enforcement",
  sec4Body: "Kudzivirira nharaunda yedu, tinomisa akaunti zvakangozvimiririra kana yakaripotiwa katatu (3) mumwedzi mumwe chete.",
  sec5Title: "05. Kuchengetedza Ruzivo",
  sec5Body: "Tinoshangisa HTTPS encryption kuchengetedza data yese.",
  sec6Title: "06. Kuchengetwa kweData",
  sec6Body: "Data inochengetwa chero akaunti yako ichiri mupenyu. Akaunti ikadzimwa, data inobviswa mazita.",
  sec7Title: "07. Kodzero Dzenyu",
  sec7Body: "Une kodzero yekuona, kugadzirisa, kana kudzimwa kwe-data yako. Vaeni vanogona kudzvanya \"Terminate Guest Session\".",
  sec8Title: "08. Kodzero dzeVana",
  sec8Body: "Platform haisi yevana vari pasi pemakore 18.",
  sec9Title: "09. Shanduko muPrivacy Policy",
  sec9Body: "Tinogadzirisa mutemo uyu nguva nenguva zvinoonekwa pazuva re-Last Updated.",
  contactTitle: "Rubatsiro rwePrivacy",
  contactSub: "Taura nechikwata chedu che-privacy"
};

const PRIVACY_NDEBELE: PrivacyContent = {
  title: "Imithetho ye",
  subtitle: "Privacy (isiNdebele)",
  version: "Data Protocol 1.0.2",
  lastUpdated: "Kugcina ukulungiswa: May 17, 2026",
  welcome1: "Comfort Business Hub (\"isisebenzi\") izibophezele ekuvikela imfihlo yakho. I-Privacy Policy le ichaza indlela esoqoqa, sisebenzise, sondeze i-data yakho.",
  welcome2: "Ngokusebenzisa i-Platform le, uyavuma ukuqoqwa lokusebenziswa kwemininingwane le.",
  recentUpdatesTitle: "Okusanda Kwelulwa kwi-Data (July 2026)",
  recentUpdates: [
    "Imininingwane yeziNdlela zokuBhadhala: I-PayPal, Stripe, EcoCash USSD, le-POD ezigcinwe kumetadata kuze abathengi babone ngezifanele.",
    "WhatsApp Uplink: Inkinobho \"Talk on WhatsApp\" ivula WhatsApp Business khona lapho efoni yakho.",
    "Live Inventory Telemetry: Ukulawula nohlobanisa impahla ezitolo ezitshiyeneyo.",
    "Geo-Targeting le-Location: Ukusebenzisa i-location yakho ukukhomba izitolo eziseduze nawe.",
    "Neural Member Network: Izitolo zakho zingabonakala phakathi kwabantu ababhalisileyo."
  ],
  sec1Title: "01. Imininingwane Esoyigoqa",
  sec1Sub: "Siqoqa imininingwane ngezindlela ezintathu: oyonikeza uqobo, eyingena ngokwayo, le evela kwamanye amakhampani.",
  sec1A_title: "A. Imininingwane Oyinikezayo",
  sec1A_items: [
    "Akaunti le-Profile Data: Nxa ungena nge-Google Auth, samukela Ibizo Lakho, I-Email, le-Mfanekiso.",
    "Ruzivo rwe-Isitolo: Ukusekela isitolo unika Inombolo yeFoni, Incazelo, le-Mifanekiso.",
    "Mharidzo ze-Support: Imininingwane oyinika nxa ukhuluma labasizi bethu.",
    "Ukubika la-Amacala: Imininingwane etholakala nxa kubikwa iziphambeko."
  ],
  sec1B_title: "B. Imininingwane Eyisikwa Ngenkompuyutha",
  sec1B_body: "IP Address, uhlobo lwe-browser, le-page views. Sisebenzisa ama-cookies ukugcina ukungena kwakho.",
  sec1C_title: "C. Imininingwane eVela ku-Third Parties",
  sec1C_items: [
    "Google Auth: I-Google yabelana imininingwane yakho thina.",
    "Payment Gateways: Samukela ama-transaction tokens pasina ukugcina ama-credit card numbers."
  ],
  sec1D_title: "D. Izimo ze-Guest Session le-LocalStorage",
  sec1D_body1: "I-data ye-Guest igcinwa kuphela kwi-LocalStorage ye-browser yakho.",
  sec1D_body2: "Nxa i-Guest icindezela \"Talk\" kumbe \"Order Now\", isistimu ibhalisa umbiko pasina ukugcina i-email yomuntu.",
  sec2Title: "02. Ukusebenzisa Imininingwane",
  sec2Uses: [
    "Ukugcina Ukungena kwi-Platform",
    "Ukulula Ukukhulumisana",
    "Ukuthuthukisa Isevisi",
    "Amasu okuVikela",
    "Ukulandela Umthetho",
    "Ukuthola Amacala nge-AI"
  ],
  sec3Title: "03. Ukwabelana nge-Data",
  sec3PublicTitle: "Okubonwa Ngabantu Bonke",
  sec3PublicBody: "Isitolo sakho (Ibizo, Inombolo, Impahla) sizabonakala kubathengi bonke eZimbabwe.",
  sec3LegalTitle: "Ukudalulwa koMthetho",
  sec3LegalBody: "Singadalula imininingwane nxa kudingeka emthethweni kusekelwa amalungelo aluntu.",
  sec4Title: "04. Ukutshaya Inyathelo nge-Automation",
  sec4Body: "Ukuvikela umphakathi wethu, i-akhawunti ebikwe kathathu (3) enyangeni eyodwa izamiswa ngokwayo.",
  sec5Title: "05. Ukuvikela I-Data",
  sec5Body: "Sisebenzisa i-HTTPS encryption ukuvikela konke okubhalwe ku-Platform.",
  sec6Title: "06. Ukugcinwa kwe-Data",
  sec6Body: "I-data igcinwa nxa i-akhawunti yakho isasebenza. Nxa icitshwa, amabizo ayasuswa.",
  sec7Title: "07. Amalungelo Wakho",
  sec7Body: "Ulamalungelo okubona, ukulungisa kumbe ukucitha i-data yakho. Ama-Guest angaqeda ngo \"Terminate Guest Session\".",
  sec8Title: "08. Amalungelo Abantwana",
  sec8Body: "I-Platform kayenzelwanga abantwana abangaphansi kweminyaka engu-18.",
  sec9Title: "09. Ukutshintsha kwe-Policy",
  sec9Body: "Siyayilungisa i-policy le ngezikhathi ezitshiyeneyo ngokukhomba i-Last Updated date.",
  contactTitle: "I-Privacy Support",
  contactSub: "Xhumana leqembu lethu le-privacy"
};

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicAIContent, setDynamicAIContent] = useState<string | null>(null);

  const getContent = (): PrivacyContent => {
    if (currentLang === 'sn') return PRIVACY_SHONA;
    if (currentLang === 'nr') return PRIVACY_NDEBELE;
    return PRIVACY_ENGLISH;
  };

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    setCurrentLang(lang);
    setDynamicAIContent(null);
  };

  const triggerAITranslationRefine = async () => {
    if (currentLang === 'en') return;
    setIsLoading(true);
    try {
      const contentToTranslate = JSON.stringify(getContent(), null, 2);
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: contentToTranslate,
          targetLanguage: currentLang === 'sn' ? 'Shona' : 'Ndebele'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translatedText) {
          setDynamicAIContent(data.translatedText);
        }
      }
    } catch (err) {
      console.error('AI translation trigger error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const content = getContent();

  return (
    <div className="min-h-screen bg-[#05070a] pt-24 pb-20 px-6 sm:px-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors group"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest italic">Return to Terminal</span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={triggerAITranslationRefine}
            disabled={isLoading || currentLang === 'en'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 text-[10px] font-black uppercase text-gray-300 hover:text-white transition-all shadow-lg"
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin text-primary" : "text-primary"} />
            <span>{isLoading ? "AI Translating..." : "Refine with Gemini AI"}</span>
          </motion.button>
        </div>

        {/* Language Switcher Component */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <LanguageSwitcher 
            currentLanguage={currentLang} 
            onLanguageChange={handleLanguageChange}
            isLoading={isLoading}
          />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <header className="space-y-4 border-b border-white/5 pb-12">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-[0_0_20px_rgba(0,242,254,0.15)]">
              <Lock size={32} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
              {content.title} <span className="text-primary">{content.subtitle}</span>
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                {content.version}
              </span>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">{content.lastUpdated}</p>
            </div>
          </header>

          <div className="grid gap-12 text-gray-400 font-medium leading-relaxed">
            <section className="space-y-4">
              <p className="text-sm">{content.welcome1}</p>
              <p className="text-sm">{content.welcome2}</p>
            </section>

            <section className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-4 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] relative overflow-hidden group hover:border-primary/30 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all pointer-events-none"></div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_10px_rgba(0,242,254,0.2)]">
                    <ShieldAlert size={16} />
                  </div>
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">{content.recentUpdatesTitle}</h2>
                </div>
                <ul className="space-y-3 text-sm text-gray-400 font-medium leading-relaxed relative z-10 list-disc list-inside">
                  {content.recentUpdates.map((up, idx) => (
                    <li key={idx}>{up}</li>
                  ))}
                </ul>
              </div>

              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">01.</span> {content.sec1Title.replace(/^01\.\s*/, '')}
              </h2>
              <p className="text-sm italic text-gray-500">{content.sec1Sub}</p>

              <div className="grid gap-6">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    {content.sec1A_title}
                  </h3>
                  <div className="grid gap-4 text-xs">
                    {content.sec1A_items.map((item, idx) => (
                      <p key={idx}>{item}</p>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    {content.sec1B_title}
                  </h3>
                  <p className="text-xs">{content.sec1B_body}</p>
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    {content.sec1C_title}
                  </h3>
                  <div className="text-xs space-y-2">
                    {content.sec1C_items.map((item, idx) => (
                      <p key={idx}>{item}</p>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    {content.sec1D_title}
                  </h3>
                  <p className="text-xs leading-relaxed">
                    {content.sec1D_body1}
                    <br/><br/>
                    {content.sec1D_body2}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:rotate-12 transition-transform">
                <Eye size={80} />
              </div>
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">02.</span> {content.sec2Title.replace(/^02\.\s*/, '')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {content.sec2Uses.map((item, i) => (
                  <div key={i} className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">03.</span> {content.sec3Title.replace(/^03\.\s*/, '')}
              </h2>
              <div className="grid gap-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 text-white border border-white/10">
                    <Globe size={18} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider italic">{content.sec3PublicTitle}</h3>
                    <p className="text-xs">{content.sec3PublicBody}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 text-white border border-white/10">
                    <Share2 size={18} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider italic">{content.sec3LegalTitle}</h3>
                    <p className="text-xs">{content.sec3LegalBody}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 bg-red-500/5 p-8 rounded-[2.5rem] border border-red-500/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-red-500 text-2xl">04.</span> {content.sec4Title.replace(/^04\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec4Body}</p>
            </section>

            <section className="space-y-4 bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">05.</span> {content.sec5Title.replace(/^05\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec5Body}</p>
            </section>

            <div className="grid sm:grid-cols-2 gap-6">
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <Database size={16} />
                  <h3 className="text-sm font-black uppercase tracking-wider italic">{content.sec6Title}</h3>
                </div>
                <p className="text-xs leading-relaxed">{content.sec6Body}</p>
              </section>
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <Trash2 size={16} />
                  <h3 className="text-sm font-black uppercase tracking-wider italic">{content.sec7Title}</h3>
                </div>
                <p className="text-xs leading-relaxed">{content.sec7Body}</p>
              </section>
            </div>

            <section className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">08.</span> {content.sec8Title.replace(/^08\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec8Body}</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">09.</span> {content.sec9Title.replace(/^09\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec9Body}</p>
            </section>

            {dynamicAIContent && (
              <div className="bg-primary/10 border border-primary/30 p-6 rounded-3xl space-y-3">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-xs">
                  <Sparkles size={16} /> Gemini AI Refined Legal Translation Output ({currentLang.toUpperCase()}):
                </div>
                <p className="text-xs text-gray-200 font-mono whitespace-pre-wrap leading-relaxed">{dynamicAIContent}</p>
              </div>
            )}

            <section className="mt-12 p-8 bg-gradient-to-br from-[#0d1117] to-[#05070a] rounded-[3rem] border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8">
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">{content.contactTitle}</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">{content.contactSub}</p>
              </div>
              <div className="flex flex-col gap-4">
                <a href="mailto:comfort.designszw@gmail.com" className="flex items-center gap-3 text-xs font-black text-white uppercase tracking-widest hover:text-primary transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Mail size={14} />
                  </div>
                  comfort.designszw@gmail.com
                </a>
                <a href="tel:+263772824132" className="flex items-center gap-3 text-xs font-black text-white uppercase tracking-widest hover:text-primary transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Phone size={14} />
                  </div>
                  +263 772 824 132
                </a>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
