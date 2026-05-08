export type Lang = "en" | "hi" | "bn";

const t = {
  en: {
    // Navigation - Main
    dashboard: "Dashboard",
    dailyCashExpense: "Daily Cash Expense",
    dailyCashSeal: "Daily Cash Seal",
    dailyInventory: "Daily Inventory",
    menuManager: "Menu Manager",
    purchaseRequest: "Purchase Request",
    purchaseInvoices: "Purchase Invoices",
    salesInvoiceLedger: "Sales Invoice Ledger",
    dailyPnl: "Daily P&L",
    monthlyPnl: "Monthly P&L",

    // Navigation - Labour Works
    labourWorks: "Labour Works",
    employeeMaster: "Employee Master",
    musterRoll: "Muster Roll",
    salaryRegister: "Salary Register",
    baseWageRates: "Base Wage Rates",
    shiftDutyChart: "Shift Duty Chart",
    registers: "Registers",
    workmenRegister: "Workmen Register",
    formVIA: "Form VI-A (Notice)",
    bonusReturn: "Bonus Return",
    halfYearlyReturn: "Half-Yearly Return",
    leaveWithWages: "Leave With Wages",
    epfoEsic: "EPFO & ESIC Export",
    ptaxReport: "P.Tax Report",
    letterheadLetters: "Letterhead Letters",

    // Navigation - Admin / User
    admin: "Admin",
    logout: "Logout",
    home: "Home",
    expense: "Expense",
    cashSeal: "Cash Seal",
    inventory: "Inventory",
    more: "More",

    // Install banner
    installApp: "Install DJ Hospitality App",
    installDesc: "Install this app on your phone for quick access",
    installIosDesc: 'Tap the Share button below, then "Add to Home Screen"',
    installTapShare: "Tap",
    installThenAdd: 'then "Add to Home Screen"',
    installBtn: "Install App",

    // Language switcher
    language: "Language",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",

    // Canteen subtitle
    canteenManagement: "Canteen Management",
  },

  hi: {
    // Navigation - Main
    dashboard: "डैशबोर्ड",
    dailyCashExpense: "दैनिक नकद व्यय",
    dailyCashSeal: "दैनिक नकद सील",
    dailyInventory: "दैनिक स्टॉक",
    menuManager: "मेनू प्रबंधक",
    purchaseRequest: "खरीद अनुरोध",
    purchaseInvoices: "खरीद चालान",
    salesInvoiceLedger: "बिक्री चालान खाता",
    dailyPnl: "दैनिक लाभ-हानि",

    // Navigation - Labour Works
    labourWorks: "श्रम कार्य",
    employeeMaster: "कर्मचारी सूची",
    musterRoll: "मस्टर रोल",
    salaryRegister: "वेतन रजिस्टर",
    baseWageRates: "आधार वेतन दर",
    shiftDutyChart: "शिफ्ट ड्यूटी चार्ट",
    registers: "रजिस्टर",
    workmenRegister: "श्रमिक रजिस्टर",
    formVIA: "फॉर्म VI-A (नोटिस)",
    bonusReturn: "बोनस रिटर्न",
    halfYearlyReturn: "अर्धवार्षिक रिटर्न",
    leaveWithWages: "वेतन सहित छुट्टी",
    epfoEsic: "EPFO & ESIC निर्यात",
    ptaxReport: "पेशा कर रिपोर्ट",
    letterheadLetters: "लेटरहेड पत्र",

    // Navigation - Admin / User
    admin: "व्यवस्थापक",
    logout: "लॉगआउट",
    home: "होम",
    expense: "व्यय",
    cashSeal: "नकद सील",
    inventory: "स्टॉक",
    more: "अधिक",

    // Install banner
    installApp: "DJ Hospitality ऐप इंस्टॉल करें",
    installDesc: "त्वरित पहुंच के लिए इस ऐप को अपने फोन पर इंस्टॉल करें",
    installIosDesc: 'नीचे शेयर बटन दबाएं, फिर "होम स्क्रीन में जोड़ें" चुनें',
    installTapShare: "दबाएं",
    installThenAdd: 'फिर "होम स्क्रीन में जोड़ें"',
    installBtn: "ऐप इंस्टॉल करें",

    // Language switcher
    language: "भाषा",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",

    // Canteen subtitle
    canteenManagement: "कैंटीन प्रबंधन",
  },

  bn: {
    // Navigation - Main
    dashboard: "ড্যাশবোর্ড",
    dailyCashExpense: "দৈনিক নগদ ব্যয়",
    dailyCashSeal: "দৈনিক নগদ সিল",
    dailyInventory: "দৈনিক মজুদ",
    menuManager: "মেনু ম্যানেজার",
    purchaseRequest: "ক্রয় অনুরোধ",
    purchaseInvoices: "ক্রয় চালান",
    salesInvoiceLedger: "বিক্রয় চালান খতিয়ান",
    dailyPnl: "দৈনিক আয়-ব্যয়",

    // Navigation - Labour Works
    labourWorks: "শ্রম কাজ",
    employeeMaster: "কর্মী তালিকা",
    musterRoll: "মাস্টার রোল",
    salaryRegister: "বেতন রেজিস্টার",
    baseWageRates: "মূল মজুরি হার",
    shiftDutyChart: "শিফট ডিউটি চার্ট",
    registers: "রেজিস্টার",
    workmenRegister: "শ্রমিক রেজিস্টার",
    formVIA: "ফর্ম VI-A (নোটিশ)",
    bonusReturn: "বোনাস রিটার্ন",
    halfYearlyReturn: "অর্ধবার্ষিক রিটার্ন",
    leaveWithWages: "মজুরি সহ ছুটি",
    epfoEsic: "EPFO & ESIC রপ্তানি",
    ptaxReport: "পেশা কর রিপোর্ট",
    letterheadLetters: "লেটারহেড চিঠি",

    // Navigation - Admin / User
    admin: "প্রশাসন",
    logout: "লগআউট",
    home: "হোম",
    expense: "ব্যয়",
    cashSeal: "নগদ সিল",
    inventory: "মজুদ",
    more: "আরো",

    // Install banner
    installApp: "DJ Hospitality অ্যাপ ইনস্টল করুন",
    installDesc: "দ্রুত অ্যাক্সেসের জন্য এই অ্যাপটি আপনার ফোনে ইনস্টল করুন",
    installIosDesc: 'নীচে শেয়ার বোতামে ট্যাপ করুন, তারপর "হোম স্ক্রিনে যোগ করুন" বেছে নিন',
    installTapShare: "ট্যাপ করুন",
    installThenAdd: 'তারপর "হোম স্ক্রিনে যোগ করুন"',
    installBtn: "অ্যাপ ইনস্টল করুন",

    // Language switcher
    language: "ভাষা",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",

    // Canteen subtitle
    canteenManagement: "ক্যান্টিন ব্যবস্থাপনা",
  },
} as const;

export type TranslationKey = keyof (typeof t)["en"];
export type Translations = typeof t;

export default t;
