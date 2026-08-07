import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, ChevronLeft, Mail, Phone, Scale, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher, { SupportedLanguage } from '../components/LanguageSwitcher';

interface TOSContent {
  title: string;
  subtitle: string;
  version: string;
  lastUpdated: string;
  welcome1: string;
  welcome2: string;
  sec1Title: string;
  sec1Body: string;
  sec1NoteTitle: string;
  sec1NoteBody: string;
  recentUpdatesTitle: string;
  recentUpdates: string[];
  sec2Title: string;
  sec2Items: { title: string; desc: string }[];
  sec3Title: string;
  sec3Sub: string;
  sec3Cards: { title: string; desc: string }[];
  sec4Title: string;
  sec4Items: { title: string; desc: string }[];
  sec5Title: string;
  sec5Body: string;
  sec6Title: string;
  sec6Body: string;
  sec7Title: string;
  sec7Heading: string;
  sec7Body1: string;
  sec7Body2: string;
  sec8Title: string;
  sec8Body: string;
  sec9Title: string;
  sec9Body: string;
  sec9EnforceTitle: string;
  sec9EnforceBody: string;
  sec10Title: string;
  sec10Body: string;
  sec11Title: string;
  sec11Body: string;
  contactTitle: string;
  contactSub: string;
}

const TOS_ENGLISH: TOSContent = {
  title: "Terms of",
  subtitle: "Service",
  version: "Version 1.1.0",
  lastUpdated: "Last Updated: August 4, 2026",
  welcome1: "Welcome to Comfort Business Hub (\"the Platform\"). These Terms of Service (\"Terms\") govern your access to and use of our web application, marketplace tools, order tracking systems, and fulfillment services.",
  welcome2: "By signing up for an account, creating a storefront, or purchasing goods/services as a registered user or guest through the Platform, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Platform.",
  sec1Title: "01. Description of Service & Order Fulfillment",
  sec1Body: "The Platform is a business hub and multi-vendor marketplace built to allow users to sign up, create business profiles, establish customizable storefronts, and list products or services for sale. The Platform serves as an intermediary venue connecting sellers (\"Sellers\") with customers (\"Buyers\"). We provide real-time order tracking controls, 4-stage fulfillment management, and auditable transaction timestamp logs to assist Buyers and Sellers in transaction verification.",
  sec1NoteTitle: "Guest Checkout & Order Lookup Systems:",
  sec1NoteBody: "In addition to registered accounts, the Platform supports Guest Checkout and Anonymous Order Tracking modes. Guest buyers can place orders using their phone number and client-side session tokens. Guests and suppliers can track guest order progress using phone number or Order ID lookup inside the Sales and Buyer Orders Tracking control center without requiring central account creation.",
  recentUpdatesTitle: "Recent Platform & Order Tracking Updates (August 2026)",
  recentUpdates: [
    "Unified Sales & Buyer Orders Tracking: All store sales, received supplier orders, and buyer purchases (both guest and registered) are managed in a single 'Sales and Buyer Orders Tracking' hub.",
    "Real-Time Supplier Visual Order Counters: Suppliers receive real-time notification badges and badge counters in Markets/DealRoom whenever a buyer places an order.",
    "Guest Checkout & Phone Lookup: Guest buyers can complete purchases and immediately track their orders via phone number search or Order ID without mandating password creation."
  ],
  sec2Title: "02. Account Registration & Security",
  sec2Items: [
    { title: "Google Authentication:", desc: "To access certain features, you must register for an account using your Google Account. You agree to provide and maintain accurate, current, and complete profile information, including your full name, phone number, and profile image." },
    { title: "Guest Accounts and Access:", desc: "Users may opt to transact or inquire under a guest account. Personal information is not explicitly persisted on our central servers for guest access, except where required for conversion logging to provide accurate dashboard statistics." },
    { title: "Account Responsibility:", desc: "You are entirely responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account." },
    { title: "Age Restriction:", desc: "You must be at least 18 years old, or the legal age of majority in your jurisdiction, to create a storefront and sell goods or services." }
  ],
  sec3Title: "03. Storefronts and Seller Obligations",
  sec3Sub: "Sellers who create storefronts and product/service listings agree to the following conditions:",
  sec3Cards: [
    { title: "Accuracy", desc: "You must provide true, accurate, and up-to-date descriptions, pricing, and images for all listed products or services." },
    { title: "Compliance", desc: "You are solely responsible for ensuring that your products, services, listings, and business operations comply with all applicable local and international laws." },
    { title: "Fulfillment", desc: "Sellers are independently responsible for fulfilling orders, handling shipping/delivery, and addressing customer service requests." }
  ],
  sec4Title: "04. Fees and Payments",
  sec4Items: [
    { title: "Transaction Processing:", desc: "Payment handling and integration with third-party payment gateways (mobile money, local triggers) are subject to the terms of those respective providers." },
    { title: "Platform Fees:", desc: "The Platform reserves the right to charge subscription fees or percentage-based transaction fees. Applicable fees will be disclosed prior to implementation." }
  ],
  sec5Title: "05. Intellectual Property",
  sec5Body: "The web app, design elements, logos, and architecture are exclusive property of Comfort Business Hub. Users grant a license to host uploaded content for the purpose of promoting storefronts.",
  sec6Title: "06. User Conduct",
  sec6Body: "Prohibited: Fraud, scams, malicious code, reverse-engineering, or violating any local or international laws and regulations.",
  sec7Title: "07. Limitation of Liability",
  sec7Heading: "\"As-Is\" Basis",
  sec7Body1: "The Platform is provided on an \"as-is\" and \"as-available\" basis. We make no warranties regarding availability, uptime, or suitability for specific business needs.",
  sec7Body2: "Comfort Business Hub is not a party to any transaction, contract, or dispute between Buyers and Sellers. We do not guarantee quality, safety, or delivery of items.",
  sec8Title: "08. Indemnification",
  sec8Body: "You agree to indemnify and hold harmless the Platform from any claims, liabilities, or losses arising out of misuse, violation of Terms, or infringement of third-party rights.",
  sec9Title: "09. Reporting and Suspension",
  sec9Body: "We maintain a zero-tolerance policy for abuse, substandard products, misinformation, illegal content, nudity, or content promoting violence. Users are encouraged to report any infractions via the on-platform \"Report\" tools.",
  sec9EnforceTitle: "Enforcement Protocol",
  sec9EnforceBody: "Any account, storefront, or product reported three (3) times within a single month for verified violations will result in an automatic suspension of the responsible account for a duration of two weeks. Repeated violations may result in a permanent ban.",
  sec10Title: "10. Governing Law",
  sec10Body: "These Terms are governed by the laws of Zimbabwe. Disputes must be resolved in the competent courts located within Zimbabwe.",
  sec11Title: "11. Changes to Terms",
  sec11Body: "We may modify these Terms from time to time. Continued use of the Platform after changes are posted constitutes binding acceptance of updated Terms.",
  contactTitle: "Contact Support",
  contactSub: "Have questions regarding these terms?"
};

const TOS_SHONA: TOSContent = {
  title: "Mitemo ye",
  subtitle: "Sevhisi (chiShona)",
  version: "Shanduro 1.0.4",
  lastUpdated: "Kupedzisira Kuvandudzwa: May 17, 2026",
  welcome1: "Ragamana paComfort Business Hub (\"Platform\"). Mitemo iyi inotonga kushandiswa kwe web application yedu, mhando dzedu nemasevhisi edu.",
  welcome2: "Nokunyoresa akaunti, kugadzira chitoro, kana kutenga zvinhu/masevhisi paPlatform, unobvuma kutevedzera Mitemo iyi. Kana usiri kubvuma, usashandise Platform iyi.",
  sec1Title: "01. Tsanangudzo yeSevhisi",
  sec1Body: "Platform inzvimbo yebhizimisi nevatengesi vakawanda yakavakirwa kubvumidza vashandisi kunyoresa, kugadzira maprofile ebhizimisi, kumisa zvitoro, nekuisa zvigadzirwa kana masevhisi ekutengesa. Hatitengese kana kubata zvigadzirwa zvinotsikiswa nevatengesi.",
  sec1NoteTitle: "Maitiro eVasina Akaunti (Guest Mode):",
  sec1NoteBody: "Pamusoro pekuva nhengo izere, Platform inotsigira maitiro eGuest Access. Vashandisi vanokwanisa kuongorora zvitoro zvezvinhu, kutumira mharidzo dzekubvunza, nekuongorora maitiro e-Order Now vasina kunyoresa zvachose.",
  recentUpdatesTitle: "Zvakavandudzwa Zvazvino (Nyamavhuvhu 2026)",
  recentUpdates: [
    "Kugadziriswa Kwekubhadhara Kakawanda: Vatengesi vanokwanisa kusarudza nzira dzekubhadhara dzinosanganisira PayPal, Stripe, EcoCash USSD, Cash on Delivery, nePayNow.",
    "Bhatani reWhatsApp: Bhatani re \"Talk on WhatsApp\" rinovhura zvakananga WhatsApp Business kana yeMazuva Ese pafoni yako."
  ],
  sec2Title: "02. Kunyoresa Akaunti neKuchengeteka",
  sec2Items: [
    { title: "Google Authentication:", desc: "Kupinda pachirongwa kunoda kusevenzesa Google Account yako. Unobvuma kupa ruzivo rwechokwadi nenzira yakazara." },
    { title: "Akaunti dzevaEshanyi (Guest):", desc: "Vashandisi vanogona kuongorora nekubvunza pasi pe-Guest Session pasina kuchengetedza ruzivo pama-servers edu makuru." },
    { title: "Basa reAkaunti:", desc: "Iwe ndiwe unotarisira kuchengetedza password nekuva nemhosva pane zvinoitwa neakaunti yako." },
    { title: "Zera Anotenderwa:", desc: "Unofanira kunge uine makore 18 zvichikwira kuti ugadzire chitoro nekuutengesa zvitoro paPlatform." }
  ],
  sec3Title: "03. Zvitoro neMitemo yeVatengesi",
  sec3Sub: "Vatengesi vanogadzira zvitoro nekuikisa zvinhu vanobvuma zvakatarwa izvi:",
  sec3Cards: [
    { title: "Chokwadi", desc: "Unofanira kupa tsanangudzo yechokwadi, mitengo, nemifananidzo pazuva pane zvese zvinotengiswa." },
    { title: "Kutevedzera Mutemo", desc: "Iwe ndiwe une mutoro wekuona kuti zvitoro ne zvinhu zvako zvinotevedzera mitemo yese yeZimbabwe neyepasichigare." },
    { title: "Kuendesa Zvinhu", desc: "Vatengesi vanoona nezvekuendesa zvinhu kune vatengi nekupindura mibvunzo yevatengi panguva." }
  ],
  sec4Title: "04. Mipfuno neKubhadhara",
  sec4Items: [
    { title: "Nzira dzeKubhadhara:", desc: "Kubhadhara nekuunganidza mari nekushandisa mobile money kunoenderana nemitemo yevemakambani iwayo." },
    { title: "Mifuno yePlatform:", desc: "Platform inochengetedza kodzero yekubhadharisa mari yebasa, izvo zvinoziviswa pamberi." }
  ],
  sec5Title: "05. Kodzero dzeZvinhu neZviumbwa",
  sec5Body: "Web app, mapurogiramu, nemalogo ndezve Comfort Business Hub. Vashandisi vanopa mvumo yekushambadza zvinhu zvavo paplatform.",
  sec6Title: "06. Maitiro eMushandisi",
  sec6Body: "Zvakarambidzwa: Hutsotsi, scams, macode anokuvadza, kana kutyora mitemo yenyika neyepasi rose.",
  sec7Title: "07. Mipaniro yeMhosva",
  sec7Heading: "Paiyiyo Nguva (\"As-Is\")",
  sec7Body1: "Platform inopihwa sezvairi. Hativimbisei kuti chirongwa chichagara chiripo panguva dzese pasina kumbomira.",
  sec7Body2: "Comfort Business Hub haisi chikamu chekondirakiti kana kukakavadzana pakati peMuitengi neMutengesi.",
  sec8Title: "08. Dziviriro nemhosva",
  sec8Body: "Unobvuma kudzivirira nekusapomera Platform mhosva dzinovapo nekuda kwekushandisa zvisizvo kana kutyora mitemo.",
  sec9Title: "09. Kuratidza Mhosva neKumiswa kweAkaunti",
  sec9Body: "Tine mutemo wakaoma pane zvekubira, mashoko enhema, zvisina kururama, kana zvinokurudzira mhirizhonga.",
  sec9EnforceTitle: "Matanho eKurova Chirango",
  sec9EnforceBody: "Akaunti, chitoro, kana chigadzirwa chinoripotiwa katatu (3) mumwedzi mumwe chete pamusaka pekutyora mitemo chichamiswa zvakangotanga pasina kunonoka kwemavhiki maviri (2).",
  sec10Title: "10. Mutemo Unotongwa",
  sec10Body: "Mitemo iyi inotongwa pasi pemitemo yeZimbabwe. Matongero aninoitwa matare emuZimbabwe.",
  sec11Title: "11. Shanduko yeMitemo",
  sec11Body: "Tinogona kuvandudza mitemo iyi panguva nepadzimwe. Kunoenderera mberi uchishandisa Platform zvinoreva kubvuma shanduko dzacho.",
  contactTitle: "Taura Nesu",
  contactSub: "Une mibvunzo maererano nemitemo iyi?"
};

const TOS_NDEBELE: TOSContent = {
  title: "Imithetho ye",
  subtitle: "Sevisi (isiNdebele)",
  version: "Inguqulo 1.0.4",
  lastUpdated: "Kugcina ukulungiswa: May 17, 2026",
  welcome1: "Siyakwamukela eComfort Business Hub (\"I-Platform\"). Imithetho le ilawula ukusetshenziswa kwakho kwewebhu yethu lamasevisi ethu.",
  welcome2: "Ngokubhalisa i-akhawunti, ukwakha isitolo, kumbe ukuthenga impahla e-Platform, uyavuma ukuhambisana lemithetho le.",
  sec1Title: "01. Incazelo yeSevisi",
  sec1Body: "I-Platform iyipulatifomu yebhizinisi labathengisi abanengi eyakhelwe ukulungiselela abasebenzisi ukuthi babhalise, bakhe izitolo baye bakhiphe impahla kumbe amasevisi azathengiswa. Katithengisi amaphahla ezitolo ezizimeleyo.",
  sec1NoteTitle: "Indlela yoLuhlu ye-Guest (Guest Session):",
  sec1NoteBody: "Ngaphandle kwabantu ababhalise ngokugcweleyo, i-Platform isekela indlela ye-Guest Access lapho abantu abangena kumalinki abangahlola izitolo bathumele imilayezo ye-Talk kumbe Order Now pasina ukungena nge-Google Auth.",
  recentUpdatesTitle: "Okusanda Kwelulwa (August 2026)",
  recentUpdates: [
    "Ukulungiswa kweziNdlela zokubhadhala: Abathengisi bangakhetha PayPal, Stripe, EcoCash USSD, Cash on Delivery, le-PayNow.",
    "Inkinobho ye-WhatsApp: Inkinobho \"Talk on WhatsApp\" ivula khona lapho WhatsApp Business kumbe eyeNjwayelo efoni yakho."
  ],
  sec2Title: "02. Ukubhalisa I-Akhawunti Nokuvikeleka",
  sec2Items: [
    { title: "Google Authentication:", desc: "Ukungena kudinga ukusebenzisa i-Google Account yakho yeqiniso." },
    { title: "Izimo ze-Guest Session:", desc: "Abasebenzisi bangabuza babuzisise ngaphandle kokugcina imininingwane kuma-server ethu amakhulu." },
    { title: "Ukulawula I-Akhawunti:", desc: "Nguwe obophelekileyo ukugcina i-password yakho iyimfihlo." },
    { title: "Iminyaka eVunyelweyo:", desc: "Kumele ube leminyaka engu-18 kumbe ngaphezulu ukuze uvule isitolo sokuthengisa." }
  ],
  sec3Title: "03. Izitolo Nezibopho Zabathengisi",
  sec3Sub: "Abathengisi abavula izitolo lezinto zokuthengisa bavuma lokhu:",
  sec3Cards: [
    { title: "Istafula seQiniso", desc: "Kumele unikeze incazelo yeqiniso, intengo, lemifanekiso ye-impahla yonke." },
    { title: "Ukulandela Umthetho", desc: "Nguwe olomthwalo wokuqinisekisa ukuthi amabhizinisi akho ayawuhlonipha umthetho weZimbabwe." },
    { title: "Ukuhambisa Impahla", desc: "Abathengisi ngibo ababophelekileyo ekusetshenzisweni kokuhambisa impahla kubathengi." }
  ],
  sec4Title: "04. Imali leziNdlela zoKubhadhala",
  sec4Items: [
    { title: "Inkhokhelo ze-Transaction:", desc: "Ukubhadhala mobile money kuhambisana lemithetho yamakhampani lawo." },
    { title: "Imadlana ye-Platform:", desc: "I-Platform ingabiza imali yesevisi lapho kudingeka khona ngokwazisa abantu kuqala." }
  ],
  sec5Title: "05. Amalungelo eze-Propaty",
  sec5Body: "I-web application, amalogo, kanye nesakhiwo kuka-Comfort Business Hub. Abasebenzisi banikeza imvumo yokusebenzisa imifanekiso yabo.",
  sec6Title: "06. Ukuziphatha kuka-Msebenzisi",
  sec6Body: "Akwamukeleki: Ubuqili, amanga, amakhodi alimazayo, kumbe ukulimaza imithetho yomhlaba.",
  sec7Title: "07. Imingcele Yecala",
  sec7Heading: "Njengoba Injalo (\"As-Is\")",
  sec7Body1: "I-Platform inikezwa njengoba injalo. Kasithembisi ukuthi iyehluleki nxa iyini.",
  sec7Body2: "Comfort Business Hub kayiyomxhaso wakho kulokulwa phakathi kuka-Mthengi lo-Mthengisi.",
  sec8Title: "08. Ukuzivikela eMhosveni",
  sec8Body: "Uyavuma ukuthi i-Platform ngeke imiswe ngemfanelo ngenxa yeziphambeko zakho.",
  sec9Title: "09. Ukubika le-Suspension ye-Akhawunti",
  sec9Body: "Siyaquma kakhulu konke okukhohlakeleyo, izinto ezingaqondanga, kumbe ubuqili.",
  sec9EnforceTitle: "Ukuthatha Inyathelo",
  sec9EnforceBody: "I-akhawunti kumbe isitolo esibikwe kathathu (3) enyangeni eyodwa ngamacala asekelweyo sizagidwa kuze kuphele amaviki amabili (2).",
  sec10Title: "10. Umthetho oLawulayo",
  sec10Body: "Imithetho le ilawulwa ngemithetho ye-Zimbabwe kuphela.",
  sec11Title: "11. Ukutshintsha kweMithetho",
  sec11Body: "Singalungisa imithetho le ngezikhathi ezitshiyeneyo. Ukusebenzisa i-Platform kuveza ukuthi uyavuma.",
  contactTitle: "Xhumana Nathi",
  contactSub: "Ulemibuzo ngemithetho le?"
};

export default function TermsOfService() {
  const navigate = useNavigate();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicAIContent, setDynamicAIContent] = useState<string | null>(null);

  const getContent = (): TOSContent => {
    if (currentLang === 'sn') return TOS_SHONA;
    if (currentLang === 'nr') return TOS_NDEBELE;
    return TOS_ENGLISH;
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
            <span className="text-xs font-black uppercase tracking-widest italic">Return Home</span>
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

        {/* Language Switcher Control */}
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
              <Shield size={32} />
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

            <section className="space-y-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:rotate-12 transition-transform">
                <Scale size={80} />
              </div>
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">01.</span> {content.sec1Title.replace(/^01\.\s*/, '')}
              </h2>
              <p className="text-sm relative z-10 leading-loose">{content.sec1Body}</p>
              <div className="h-px bg-white/10 w-full relative z-10" />
              <p className="text-xs text-gray-500 relative z-10 leading-relaxed italic">
                <span className="text-white font-bold uppercase tracking-wider not-italic">{content.sec1NoteTitle} </span>
                {content.sec1NoteBody}
              </p>
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
                    <li key={idx} className="leading-relaxed">{up}</li>
                  ))}
                </ul>
              </div>

              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">02.</span> {content.sec2Title.replace(/^02\.\s*/, '')}
              </h2>
              <ul className="grid gap-6">
                {content.sec2Items.map((item, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm"><span className="text-white font-bold">{item.title} </span>{item.desc}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">03.</span> {content.sec3Title.replace(/^03\.\s*/, '')}
              </h2>
              <div className="grid gap-6">
                <p className="text-sm italic text-gray-500">{content.sec3Sub}</p>
                <div className="grid gap-4">
                  {content.sec3Cards.map((card, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-xs font-bold text-white uppercase mb-1">{card.title}</p>
                      <p className="text-xs">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">04.</span> {content.sec4Title.replace(/^04\.\s*/, '')}
              </h2>
              <div className="grid gap-6">
                {content.sec4Items.map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm"><span className="text-white font-bold">{item.title} </span>{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid sm:grid-cols-2 gap-6">
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <h3 className="text-sm font-black text-white uppercase tracking-wider italic">{content.sec5Title}</h3>
                <p className="text-xs leading-relaxed">{content.sec5Body}</p>
              </section>
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <h3 className="text-sm font-black text-white uppercase tracking-wider italic">{content.sec6Title}</h3>
                <p className="text-xs leading-relaxed">{content.sec6Body}</p>
              </section>
            </div>

            <section className="space-y-6 bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">07.</span> {content.sec7Title.replace(/^07\.\s*/, '')}
              </h2>
              <div className="space-y-4">
                <p className="text-sm font-bold text-white italic">{content.sec7Heading}</p>
                <p className="text-sm">{content.sec7Body1}</p>
                <div className="h-px bg-white/10 w-full" />
                <p className="text-sm">{content.sec7Body2}</p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">08.</span> {content.sec8Title.replace(/^08\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec8Body}</p>
            </section>

            <section className="space-y-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">09.</span> {content.sec9Title.replace(/^09\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec9Body}</p>
              <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 mt-4">
                <p className="text-xs font-black text-red-500 uppercase flex items-center gap-2 mb-2">
                   <ShieldAlert size={14} /> {content.sec9EnforceTitle}
                </p>
                <p className="text-xs text-gray-300 leading-relaxed italic">
                  {content.sec9EnforceBody}
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">10.</span> {content.sec10Title.replace(/^10\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec10Body}</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">11.</span> {content.sec11Title.replace(/^11\.\s*/, '')}
              </h2>
              <p className="text-sm">{content.sec11Body}</p>
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
