import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";

// ── GOOGLE SHEETS DATA PIPELINE ───────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYw3DNfteGUApE97zpPScPgVCrHjNXTU-kuwabwQNviLmsaW4gSEd6hqY1FoTJsxu4HQ/exec";
const getURLParam = (key) => { try { return new URLSearchParams(window.location.search).get(key)||""; } catch { return ""; } };
const autoFileNo  = () => { const yy=String(new Date().getFullYear()).slice(-2); return `CIBS-${yy}-${String(Math.floor(Math.random()*9000)+1000)}`; };

// ════════════════════════════════════════════════════════════════
// AGE GROUP DETECTION
// Groups: pre=<6, pri=6–10, sec=11–15, hig=16–18
// Priority: DOB field > Age (years) field
// ════════════════════════════════════════════════════════════════
function detectAgeGroup(ci) {
  let ageYears = null;

  if (ci.dob) {
    const dob  = new Date(ci.dob);
    const today = new Date();
    const ms   = today - dob;
    if (!isNaN(ms) && ms > 0) {
      ageYears = ms / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  if (ageYears === null && ci.age) {
    const parsed = parseFloat(ci.age);
    if (!isNaN(parsed) && parsed > 0) ageYears = parsed;
  }

  if (ageYears === null)   return { group: "pri", label: "Primary (6–10 yrs)", age: null };
  if (ageYears < 6)        return { group: "pre", label: "Pre-school (< 6 yrs)",        age: ageYears };
  if (ageYears <= 10)      return { group: "pri", label: "Primary (6–10 yrs)",           age: ageYears };
  if (ageYears <= 15)      return { group: "sec", label: "Secondary (11–15 yrs)",        age: ageYears };
  if (ageYears <= 18)      return { group: "hig", label: "Higher Secondary (16–18 yrs)", age: ageYears };
  return                          { group: "hig", label: "Higher Secondary (16–18 yrs)", age: ageYears };
}

const GROUP_BADGE = {
  pre: { bg:"#fef9c3", color:"#854d0e", border:"#fde047", icon:"🧸" },
  pri: { bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe", icon:"✏️" },
  sec: { bg:"#f0fdf4", color:"#15803d", border:"#86efac", icon:"📚" },
  hig: { bg:"#faf5ff", color:"#7c3aed", border:"#d8b4fe", icon:"🎓" },
};

// ════════════════════════════════════════════════════════════════
// TRANSLATIONS
// ════════════════════════════════════════════════════════════════
const T = {
  en: {
    appTitle:"eSMART-P", appSubtitle:"Parent / Caregiver Screening Questionnaire",
    appOrg:"Central Institute of Behavioural Sciences, Nagpur",
    steps:["Child Info","Perinatal History","Behaviour","Report"],
    childInfo:"Child / Subject Information",
    childName:"Child's Full Name", childAge:"Age (years)", childGender:"Gender",
    dob:"Date of Birth (optional)",
    fileNo:"CIBS File No.", regNo:"Registration No.", school:"School / Institution",
    examiner:"Examiner / Clinician", dateAssessment:"Date of Assessment",
    informantDetails:"Informant Details",
    informantName:"Informant Name", relation:"Relationship to Child",
    genderM:"Male", genderF:"Female", genderO:"Other",
    relMother:"Mother", relFather:"Father", relGrand:"Grandparent",
    relGuard:"Guardian", relTeacher:"Teacher", relOther:"Other Caregiver",
    selectDots:"Select...",
    instChild:"Instructions: This questionnaire is to be filled by the parent or primary caregiver. Please answer based on your observations over the past 6 months. Responses are used only for clinical screening and remain confidential.",
    nextPerinatal:"Next: Perinatal History →", back:"← Back",
    nextBehaviour:"Next: Behaviour →", generateReport:"Generate Report →",
    submittedDB:"✅ Submitted to CIBS Databank",
    instPerinatal:"Recollect the birth period of your child and mark YES, NO, or DON'T KNOW. You may seek help of your spouse, paediatrician, or records for accuracy.",
    yes:"YES", no:"NO", dontKnow:"DON'T KNOW", answered:"answered",
    ageGroupDetected:"Age group detected",
    ageGroupNote:"Questions have been automatically selected for this age group.",
    ageGroupManual:"Age not entered — using Primary (6–10) by default. Enter age or date of birth for accurate questions.",
    instBehaviour:"Read each statement carefully. Choose the option that best describes your child's behaviour over the past 6 months.",
    notTrue:"Not True", rarelyTrue:"Rarely True", sometimesTrue:"Sometimes True",
    mostlyTrue:"Mostly True", absolutelyTrue:"Absolutely True",
    reportTitle:"eSMART-P Assessment Report", forParent:"Summary for Parents", forClinician:"Clinician Report",
    domainChart:"Domain Score Chart — Clinician View",
    normalMedian:"Normal Median", atRiskLine:"At-Risk Threshold", probableLine:"Probable Threshold",
    probableDSM:"Probable DSM-5 / ICD-11 Categories",
    perinatalRisk:"Perinatal Risk Profile", futureRisk:"Future Risk Indicators",
    screenerNote:"Screening tool only. All flags require clinical confirmation.",
    suicideFlag:"SUICIDE / SELF-HARM RISK FLAG TRIGGERED",
    suicideFlagDesc:"Pattern: ADHD (Mild+) + MDD (Moderate+, ≥4) + ODD or CD (Moderate/Severe). Indicates elevated impulsivity, emotional pain, and interpersonal conflict. Immediate safety assessment mandatory.",
    openMini:"▼ Open Safety Assessment Mini-Module", closeMini:"▲ Close",
    miniNote:"For trained clinicians / counsellors only. Use calm, normalising tone.",
    severeImmediate:"Any positive response = SEVERE / IMMEDIATE RISK. Specialist referral within 24–48 hours mandatory.",
    exportSave:"Export & Save", printPDF:"🖨️ Print / Save PDF", downloadCSV:"📊 Download CSV",
    sendSheets:"Send to Google Sheets (CIBS Research Database)",
    sheetsPlaceholder:"Paste Google Apps Script URL here", send:"Send",
    newAssessment:"🔄 New Assessment", editResponses:"← Edit Responses",
    disclaimer:"Safety Disclaimer: eSMART-P is a screening tool, not a diagnostic instrument. Risk flags require clinical interview and family consultation. Suicidal ideation must be separately assessed. CIBS Nagpur — Dr. Shailesh Pangaonkar, Director and Consultant Psychiatrist.",
    severity:{ Normal:"Normal", Mild:"Mild", Moderate:"Moderate", Severe:"Severe" },
    riskActions:{
      0:"No clinical concern identified. Reassure family. Re-screen after 6 months if concerns persist.",
      1:"Strengthen home & school supports. Psychoeducation for parents. Re-screen after 3–6 months.",
      2:"Refer to school psychologist / paediatrician for detailed evaluation within 4–6 weeks.",
      3:"Urgent child mental health professional assessment within 1–2 weeks. Safety evaluation mandatory.",
    },
    parentSummary:{
      0:"No significant concerns were identified at this time. Continue to support healthy development and re-screen if concerns arise.",
      1:"One area of mild concern was identified. Strengthen support at home and school; re-check in 3–6 months.",
      2:"Areas of concern were identified. A specialist evaluation is recommended within 4–6 weeks.",
      3:"Multiple significant concerns were identified. Urgent evaluation by a child mental health professional within 1–2 weeks is strongly recommended. Please do not delay.",
    },
  },
  hi: {
    appTitle:"eSMART-P", appSubtitle:"माता-पिता / देखभालकर्ता जांच प्रश्नावली",
    appOrg:"केंद्रीय व्यावहारिक विज्ञान संस्थान, नागपुर",
    steps:["बच्चे की जानकारी","जन्म इतिहास","व्यवहार","रिपोर्ट"],
    childInfo:"बच्चे की जानकारी",
    childName:"बच्चे का पूरा नाम", childAge:"आयु (वर्ष)", childGender:"लिंग",
    dob:"जन्म तिथि (वैकल्पिक)",
    fileNo:"CIBS फाइल नंबर", regNo:"पंजीकरण नंबर", school:"विद्यालय / संस्था",
    examiner:"परीक्षक / चिकित्सक", dateAssessment:"मूल्यांकन की तिथि",
    informantDetails:"सूचनादाता की जानकारी",
    informantName:"सूचनादाता का नाम", relation:"बच्चे से संबंध",
    genderM:"पुरुष", genderF:"स्त्री", genderO:"अन्य",
    relMother:"माँ", relFather:"पिता", relGrand:"दादा/दादी/नाना/नानी",
    relGuard:"अभिभावक", relTeacher:"शिक्षक", relOther:"अन्य देखभालकर्ता",
    selectDots:"चुनें...",
    instChild:"निर्देश: यह प्रश्नावली माता-पिता या प्राथमिक देखभालकर्ता द्वारा भरी जानी है। पिछले 6 महीनों की अपनी टिप्पणियों के आधार पर उत्तर दें।",
    nextPerinatal:"आगे: जन्म इतिहास →", back:"← वापस",
    nextBehaviour:"आगे: व्यवहार →", generateReport:"रिपोर्ट बनाएं →",
    submittedDB:"✅ CIBS डेटाबैंक में जमा किया",
    instPerinatal:"अपने बच्चे के जन्म काल को याद करें और हाँ, नहीं या पता नहीं चिह्नित करें।",
    yes:"हाँ", no:"नहीं", dontKnow:"पता नहीं", answered:"उत्तर दिए",
    ageGroupDetected:"पहचाना गया आयु समूह",
    ageGroupNote:"इस आयु समूह के लिए प्रश्न स्वतः चुने गए हैं।",
    ageGroupManual:"आयु दर्ज नहीं — प्राथमिक (6–10) उपयोग किया जा रहा है। सटीक प्रश्नों के लिए आयु या जन्म तिथि दर्ज करें।",
    instBehaviour:"प्रत्येक कथन ध्यान से पढ़ें। वह विकल्प चुनें जो पिछले 6 महीनों में आपके बच्चे के व्यवहार का सबसे अच्छा वर्णन करता है।",
    notTrue:"सच नहीं", rarelyTrue:"शायद ही", sometimesTrue:"कभी-कभी",
    mostlyTrue:"अक्सर सच", absolutelyTrue:"बिल्कुल सच",
    reportTitle:"eSMART-P मूल्यांकन रिपोर्ट", forParent:"माता-पिता के लिए सारांश", forClinician:"चिकित्सक रिपोर्ट",
    domainChart:"डोमेन स्कोर चार्ट — चिकित्सक दृश्य",
    normalMedian:"सामान्य माध्यिका", atRiskLine:"जोखिम सीमा", probableLine:"संभावित सीमा",
    probableDSM:"संभावित DSM-5 / ICD-11 वर्गीकरण",
    perinatalRisk:"जन्म जोखिम प्रोफाइल", futureRisk:"भविष्य के जोखिम संकेतक",
    screenerNote:"केवल जांच उपकरण। सभी संकेतों के लिए नैदानिक पुष्टि आवश्यक।",
    suicideFlag:"आत्मघात / स्वयं-हानि जोखिम चेतावनी",
    suicideFlagDesc:"पैटर्न: ADHD (हल्का+) + MDD (मध्यम+, ≥4) + ODD या CD (मध्यम/गंभीर)। तत्काल सुरक्षा मूल्यांकन अनिवार्य।",
    openMini:"▼ सुरक्षा मूल्यांकन मॉड्यूल खोलें", closeMini:"▲ बंद करें",
    miniNote:"केवल प्रशिक्षित चिकित्सकों के लिए।",
    severeImmediate:"कोई भी सकारात्मक उत्तर = तत्काल जोखिम। 24-48 घंटे में विशेषज्ञ को रेफर करें।",
    exportSave:"निर्यात और सहेजें", printPDF:"🖨️ प्रिंट / PDF सहेजें", downloadCSV:"📊 CSV डाउनलोड करें",
    sendSheets:"Google Sheets को भेजें",
    sheetsPlaceholder:"Google Apps Script URL यहाँ डालें", send:"भेजें",
    newAssessment:"🔄 नया मूल्यांकन", editResponses:"← उत्तर संपादित करें",
    disclaimer:"सुरक्षा अस्वीकरण: eSMART-P एक जांच उपकरण है, निदान नहीं। CIBS नागपुर — डॉ. शैलेश पानगावकर।",
    severity:{ Normal:"सामान्य", Mild:"हल्का", Moderate:"मध्यम", Severe:"गंभीर" },
    riskActions:{ 0:"कोई नैदानिक चिंता नहीं। परिवार को आश्वस्त करें। 6 महीने बाद पुनः जांच।", 1:"घर और विद्यालय में सहायता मजबूत करें। 3–6 महीने में पुनः जांच।", 2:"4–6 सप्ताह में विशेषज्ञ मूल्यांकन।", 3:"1–2 सप्ताह में तत्काल बाल मानसिक स्वास्थ्य मूल्यांकन।" },
    parentSummary:{ 0:"इस समय कोई महत्वपूर्ण चिंता नहीं मिली।", 1:"हल्की चिंता का एक क्षेत्र मिला। घर और विद्यालय में सहायता बढ़ाएं।", 2:"चिंता के क्षेत्र मिले। 4–6 सप्ताह में विशेषज्ञ से मिलें।", 3:"कई महत्वपूर्ण चिंताएं मिलीं। 1–2 सप्ताह में बाल मनोचिकित्सक से मिलना अनिवार्य।" },
  },
  mr: {
    appTitle:"eSMART-P", appSubtitle:"पालक / काळजीवाहू तपासणी प्रश्नावली",
    appOrg:"केंद्रीय वर्तणूक विज्ञान संस्था, नागपूर",
    steps:["मुलाची माहिती","जन्म इतिहास","वर्तन","अहवाल"],
    childInfo:"मुलाची माहिती",
    childName:"मुलाचे पूर्ण नाव", childAge:"वय (वर्षे)", childGender:"लिंग",
    dob:"जन्मतारीख (पर्यायी)",
    fileNo:"CIBS फाईल क्र.", regNo:"नोंदणी क्र.", school:"शाळा / संस्था",
    examiner:"परीक्षक / वैद्य", dateAssessment:"मूल्यांकनाची तारीख",
    informantDetails:"माहिती देणाऱ्याची माहिती",
    informantName:"माहिती देणाऱ्याचे नाव", relation:"मुलाशी संबंध",
    genderM:"पुरुष", genderF:"स्त्री", genderO:"इतर",
    relMother:"आई", relFather:"वडील", relGrand:"आजी / आजोबा",
    relGuard:"पालक", relTeacher:"शिक्षक", relOther:"इतर काळजीवाहू",
    selectDots:"निवडा...",
    instChild:"सूचना: ही प्रश्नावली पालक किंवा प्राथमिक काळजीवाहूने भरायची आहे. गेल्या 6 महिन्यांच्या निरीक्षणांवर आधारित उत्तरे द्या.",
    nextPerinatal:"पुढे: जन्म इतिहास →", back:"← मागे",
    nextBehaviour:"पुढे: वर्तन →", generateReport:"अहवाल तयार करा →",
    submittedDB:"✅ CIBS डेटाबँकमध्ये सबमिट केले",
    instPerinatal:"आपल्या मुलाच्या जन्म काळाची आठवण करा आणि होय, नाही किंवा माहीत नाही असे चिन्हांकित करा.",
    yes:"होय", no:"नाही", dontKnow:"माहीत नाही", answered:"उत्तरे दिली",
    ageGroupDetected:"वय गट ओळखला",
    ageGroupNote:"या वय गटासाठी प्रश्न आपोआप निवडले गेले आहेत.",
    ageGroupManual:"वय दिलेले नाही — प्राथमिक (6–10) वापरत आहे. अचूक प्रश्नांसाठी वय किंवा जन्मतारीख द्या.",
    instBehaviour:"प्रत्येक विधान काळजीपूर्वक वाचा. गेल्या 6 महिन्यांत आपल्या मुलाच्या वर्तनाचे सर्वोत्तम वर्णन करणारा पर्याय निवडा.",
    notTrue:"खरे नाही", rarelyTrue:"क्वचितच", sometimesTrue:"कधी-कधी",
    mostlyTrue:"बहुतेक खरे", absolutelyTrue:"पूर्णपणे खरे",
    reportTitle:"eSMART-P मूल्यांकन अहवाल", forParent:"पालकांसाठी सारांश", forClinician:"वैद्यकीय अहवाल",
    domainChart:"डोमेन गुण आलेख — वैद्यकीय दृश्य",
    normalMedian:"सामान्य मध्यक", atRiskLine:"जोखीम उंबरठा", probableLine:"संभाव्य उंबरठा",
    probableDSM:"संभाव्य DSM-5 / ICD-11 वर्गीकरण",
    perinatalRisk:"जन्म जोखीम प्रोफाइल", futureRisk:"भविष्यातील जोखीम निर्देशक",
    screenerNote:"केवळ तपासणी साधन. सर्व संकेतांसाठी वैद्यकीय पुष्टी आवश्यक.",
    suicideFlag:"आत्मघात / स्वयं-हानी जोखीम सूचना",
    suicideFlagDesc:"नमुना: ADHD (सौम्य+) + MDD (मध्यम+, ≥4) + ODD किंवा CD (मध्यम/तीव्र). तत्काळ सुरक्षा मूल्यांकन अनिवार्य.",
    openMini:"▼ सुरक्षा मूल्यांकन मॉड्यूल उघडा", closeMini:"▲ बंद करा",
    miniNote:"केवळ प्रशिक्षित वैद्यांसाठी.",
    severeImmediate:"कोणताही सकारात्मक प्रतिसाद = तत्काळ जोखीम. 24–48 तासांत तज्ज्ञाकडे पाठवणे अनिवार्य.",
    exportSave:"निर्यात आणि जतन करा", printPDF:"🖨️ प्रिंट / PDF जतन करा", downloadCSV:"📊 CSV डाउनलोड करा",
    sendSheets:"Google Sheets ला पाठवा",
    sheetsPlaceholder:"Google Apps Script URL येथे टाका", send:"पाठवा",
    newAssessment:"🔄 नवीन मूल्यांकन", editResponses:"← उत्तरे संपादित करा",
    disclaimer:"सुरक्षा अस्वीकरण: eSMART-P हे तपासणी साधन आहे, निदान नाही. CIBS नागपूर — डॉ. शैलेश पानगावकर.",
    severity:{ Normal:"सामान्य", Mild:"सौम्य", Moderate:"मध्यम", Severe:"तीव्र" },
    riskActions:{ 0:"कोणतीही वैद्यकीय चिंता नाही. कुटुंबाला आश्वस्त करा. 6 महिन्यांनंतर पुन्हा तपासणी.", 1:"घर आणि शाळेत सहाय्य मजबूत करा. 3–6 महिन्यांत पुन्हा तपासणी.", 2:"4–6 आठवड्यांत तज्ज्ञ मूल्यांकन.", 3:"1–2 आठवड्यांत तातडीने बालमानसिक आरोग्य मूल्यांकन." },
    parentSummary:{ 0:"सध्या कोणतीही महत्त्वाची चिंता आढळली नाही.", 1:"सौम्य चिंतेचे एक क्षेत्र आढळले. घर आणि शाळेत सहाय्य वाढवा.", 2:"चिंतेची क्षेत्रे आढळली. 4–6 आठवड्यांत तज्ज्ञांशी भेट घ्या.", 3:"अनेक महत्त्वाच्या चिंता आढळल्या. 1–2 आठवड्यांत बालमनोचिकित्सकाशी भेट अनिवार्य." },
  },
};

// ════════════════════════════════════════════════════════════════
// PERINATAL ITEMS (common across all age groups)
// ════════════════════════════════════════════════════════════════
const PERINATAL = [
  { id:1,  en:"Difficult Pregnancy / Complications during Pregnancy",                      hi:"गर्भावस्था में तकलीफें / उपचार की आवश्यकता",                     mr:"गर्भावस्थेत समस्या / उपचारांची आवश्यकता" },
  { id:2,  en:"Born much before expected date / Preterm birth",                             hi:"प्रसूति अपेक्षित तारीख से पहले हुई",                              mr:"अपेक्षित तारखेपूर्वी जन्म / अकाली जन्म" },
  { id:3,  en:"Birth process complicated / Difficult Delivery",                             hi:"प्रसूति के दौरान जटिलताएं / कठिन प्रसव",                          mr:"प्रसूतीदरम्यान गुंतागुंत / कठीण प्रसव" },
  { id:4,  en:"Twins or more pregnancies",                                                  hi:"जुड़वा या अधिक शिशुओं का एक साथ जन्म",                            mr:"जुळे किंवा अधिक बाळांचा एकत्र जन्म" },
  { id:5,  en:"Assisted delivery / Foetal distress / Meconium passed",                      hi:"सीजर / फोटल डिस्ट्रेस / मिकोनियम",                                mr:"सिझेरियन / गर्भस्थ शिशू संकट / मेकोनियम" },
  { id:6,  en:"Did not cry for some time after birth / Breathing difficulty",               hi:"जन्म के बाद काफी देर तक नहीं रोया / सांस की परेशानी",            mr:"जन्मानंतर बराच वेळ रडले नाही / श्वासाचा त्रास" },
  { id:7,  en:"Baby hospitalised for more than 7 days in ICU",                             hi:"शिशु को ७ दिन से अधिक ICU में रखा गया",                            mr:"बाळाला ७ दिवसांपेक्षा जास्त ICU मध्ये दाखल" },
  { id:8,  en:"Needed ventilator / artificial breathing support",                           hi:"वेंटिलेटर / कृत्रिम सांसों की आवश्यकता",                          mr:"व्हेंटिलेटर / कृत्रिम श्वासाची गरज" },
  { id:9,  en:"Had convulsions, lung infections or other medical problems",                 hi:"मिर्गी, फेफड़ों का संक्रमण या अन्य बीमारियां",                     mr:"झटके, फुफ्फुसांचा संसर्ग किंवा इतर आरोग्य समस्या" },
  { id:10, en:"Delayed social smile, speech or social connectivity",                        hi:"मुस्कान, बोलना, सामाजिक जुड़ाव में देरी",                          mr:"हास्य, बोलणे, सामाजिक जोडणीस उशीर" },
  { id:11, en:"Delayed neck holding, crawling, or walking",                                 hi:"गर्दन संभालना, रेंगना, चलना — सब देर से",                         mr:"मान उचलणे, रांगणे, चालणे — सर्व उशिरा" },
  { id:12, en:"Not toilet trained / Late toilet control",                                   hi:"पेशाब-शौच पर नियंत्रण देर से आया",                                mr:"लघवी-शौचावर नियंत्रण उशिरा" },
  { id:13, en:"Has visual, speech, or movement problems",                                   hi:"दृष्टि, बोली या शारीरिक दमखम की कमी",                             mr:"दृष्टी, बोलणे किंवा शारीरिक क्षमतेची कमतरता" },
  { id:14, en:"Since birth — long-term medication or recurrent hospitalisation",            hi:"जन्म से ही लंबे समय तक दवाइयाँ या बार-बार अस्पताल",              mr:"जन्मापासून दीर्घकालीन औषधे किंवा वारंवार रुग्णालयात" },
];

// ════════════════════════════════════════════════════════════════
// AGE-STRATIFIED BEHAVIOURAL ITEMS
// Same 26 item IDs and domain mapping across all groups.
// Only question TEXT changes — scoring algorithm is identical.
// ════════════════════════════════════════════════════════════════
const BXITEMS = {

  // ── PRE-SCHOOL  < 6 years ──────────────────────────────────
  pre: [
    { id:"CI2",  domain:"IDD",  seq:1,
      en:"Learns new skills (sorting shapes, matching pictures, pretend play) much more slowly than other children the same age",
      hi:"हमउम्र बच्चों की तुलना में नई चीजें (आकृतियाँ मिलाना, तस्वीरें पहचानना, खेलना) सीखने में बहुत धीमा है",
      mr:"समवयस्क मुलांपेक्षा नवीन कौशल्ये (आकार जुळवणे, चित्रे ओळखणे, खेळणे) शिकण्यात खूप मंद आहे" },
    { id:"CI3",  domain:"IDD",  seq:2,
      en:"Needs an adult to guide and repeat step-by-step before mastering simple tasks like using a spoon, drinking from a cup, or putting on shoes",
      hi:"खाना खाने, कप से पीने या जूते पहनने जैसे सरल कामों के लिए बार-बार बड़े की मदद और मार्गदर्शन की जरूरत पड़ती है",
      mr:"जेवण करणे, कप मधून पिणे किंवा बूट घालणे यासारख्या साध्या कामांसाठी वारंवार मोठ्यांच्या मार्गदर्शनाची गरज आहे" },
    { id:"SI6",  domain:"IDD",  seq:3,
      en:"Does not reliably follow simple 2-step instructions like 'pick up the ball and give it to me'",
      hi:"'गेंद उठाओ और मुझे दो' जैसे सरल 2-चरणीय निर्देशों को ठीक से नहीं समझ पाता",
      mr:"'बॉल उचल आणि मला दे' यासारख्या साध्या 2-पायऱ्यांच्या सूचना नीट समजत नाहीत" },
    { id:"SI7",  domain:"IDD",  seq:4,
      en:"Uses far fewer words, sounds, or gestures to communicate than other children the same age",
      hi:"हमउम्र बच्चों की तुलना में बातचीत के लिए बहुत कम शब्दों, ध्वनियों या इशारों का उपयोग करता है",
      mr:"समवयस्क मुलांपेक्षा बोलण्यासाठी खूप कमी शब्द, आवाज किंवा हावभाव वापरतो/वापरते" },
    { id:"ADD27",domain:"ADHD", seq:5,
      en:"Cannot sit still even during a favourite short activity, song, or story for more than 2–3 minutes",
      hi:"पसंदीदा छोटी गतिविधि, गाने या कहानी के दौरान भी 2–3 मिनट से ज्यादा शांत नहीं बैठ सकता",
      mr:"आवडती छोटी क्रिया, गाणे किंवा गोष्ट असतानाही 2–3 मिनिटांपेक्षा जास्त शांत बसू शकत नाही" },
    { id:"ADD29",domain:"ADHD", seq:6,
      en:"Moves from one toy or activity to another without completing any",
      hi:"एक खिलौने या गतिविधि से दूसरे की तरफ जाता है, कोई भी पूरी नहीं करता",
      mr:"एका खेळणीवरून दुसऱ्याकडे जातो/जाते, कोणतेही पूर्ण करत नाही" },
    { id:"ASD14",domain:"ASD",  seq:7,
      en:"Does not make eye contact with familiar people — parents, siblings, or regular caregivers",
      hi:"माता-पिता, भाई-बहन या रोज देखभाल करने वालों से भी आँखें नहीं मिलाता",
      mr:"आई-बाबा, भावंडे किंवा नेहमीचे काळजीवाहू यांच्याशीही नजर मिळवत नाही" },
    { id:"SLD34",domain:"SLD",  seq:8,
      en:"Has difficulty with simple spatial tasks: putting shapes in correct holes, building a tower of blocks in order, following 'put it on top'",
      hi:"सरल स्थानिक कामों में परेशानी: सही छेद में आकृति डालना, क्रम से ब्लॉक लगाना, 'ऊपर रखो' जैसे निर्देश समझना",
      mr:"साध्या स्थानिक कामांत अडचण: योग्य छिद्रात आकार घालणे, क्रमाने ब्लॉक रचणे, 'वर ठेव' यासारख्या सूचना समजणे" },
    { id:"MDD44",domain:"MDD",  seq:9,
      en:"Appears persistently sad, cries easily, or has noticeably lost interest and joy in play and favourite activities",
      hi:"लगातार उदास रहता है, जल्दी रोता है, या खेलने और पसंदीदा गतिविधियों में रुचि और खुशी खो दी है",
      mr:"सतत दुखी दिसतो/दिसते, सहज रडतो/रडते, किंवा खेळणे आणि आवडत्या क्रियांमध्ये रस आणि आनंद गमावला आहे" },
    { id:"ANX49",domain:"ANX",  seq:10,
      en:"Becomes very distressed when separated from caregiver — cries intensely, refuses to stay with others, or clings excessively",
      hi:"देखभालकर्ता से अलग होने पर बहुत परेशान हो जाता है — जोर से रोता है, दूसरों के साथ रहने से मना करता है, या बहुत चिपका रहता है",
      mr:"काळजीवाहूपासून वेगळे केल्यावर खूप अस्वस्थ होतो/होते — जोरात रडतो/रडते, इतरांसोबत राहण्यास नकार देतो/देते" },
    { id:"PI10", domain:"IDD",  seq:11,
      en:"Still needs full adult help with eating, dressing, and toilet — well beyond what is expected for their age",
      hi:"खाना, कपड़े पहनना और शौचालय के लिए अभी भी पूरी बड़े की मदद चाहिए — उम्र के हिसाब से बहुत ज्यादा",
      mr:"खाणे, कपडे घालणे आणि शौचालयासाठी अजूनही पूर्ण मोठ्यांची मदत लागते — वयाच्या मानाने खूपच जास्त" },
    { id:"PI11", domain:"IDD",  seq:12,
      en:"Shows behaviour that frequently upsets, harms, or deeply disturbs other children or adults around them",
      hi:"अक्सर ऐसा व्यवहार करता है जो आसपास के बच्चों या बड़ों को परेशान करता है, नुकसान पहुंचाता है या बहुत परेशान करता है",
      mr:"अनेकदा असे वर्तन करतो/करते जे आजूबाजूच्या मुलांना किंवा मोठ्यांना त्रास देते, दुखवते किंवा खूप अस्वस्थ करते" },
    { id:"ASD18",domain:"ASD",  seq:13,
      en:"Repeatedly flaps hands, rocks body, spins in circles, or lines up objects in a fixed pattern",
      hi:"बार-बार हाथ हिलाता है, शरीर झुकाता है, गोल-गोल घूमता है, या चीजों को एक निश्चित तरीके से लाइन में रखता है",
      mr:"वारंवार हात हलवतो/हलवते, शरीर हलवतो/हलवते, गोल फिरतो/फिरते, किंवा वस्तू एका विशिष्ट पद्धतीने रांगेत ठेवतो/ठेवते" },
    { id:"ADD31",domain:"ADHD", seq:14,
      en:"Constantly loses or misplaces toys, clothing, cups, or other personal belongings",
      hi:"खिलौने, कपड़े, कप या अन्य सामान लगातार खो देता या गलत जगह रख देता है",
      mr:"खेळणी, कपडे, कप किंवा इतर वस्तू सतत हरवतो/हरवते किंवा चुकीच्या ठिकाणी ठेवतो/ठेवते" },
    { id:"SLD37",domain:"SLD",  seq:15,
      en:"Cannot recall simple sequences such as nursery rhyme words, counting 1–5, or morning routine steps in order",
      hi:"नर्सरी राइम के शब्द, 1–5 तक गिनती, या सुबह की दिनचर्या के चरणों को क्रम से याद नहीं कर पाता",
      mr:"नर्सरी राइमचे शब्द, 1–5 मोजणे, किंवा सकाळच्या नित्यक्रमाच्या पायऱ्या क्रमाने आठवत नाहीत" },
    { id:"MDD46",domain:"MDD",  seq:16,
      en:"Has lost the ability to smile, show happiness, or enjoy play — appears flat, withdrawn, or disinterested for weeks at a time",
      hi:"हँसने, खुशी दिखाने या खेलने का आनंद लेने की क्षमता खो दी है — हफ्तों तक उदास, दूरी बनाने वाला, या उदासीन दिखता है",
      mr:"हसणे, आनंद दाखवणे किंवा खेळण्याचा आनंद घेण्याची क्षमता गमावली आहे — आठवडे उदास, दूर किंवा अनासक्त दिसतो/दिसते" },
    { id:"ANX60",domain:"ANX",  seq:17,
      en:"Clings to caregiver or shows intense fear of ordinary things (dark, strangers, dogs, loud sounds) beyond what is typical for their age",
      hi:"देखभालकर्ता से चिपका रहता है या उम्र के हिसाब से असाधारण डर दिखाता है (अंधेरा, अजनबी, कुत्ते, तेज आवाजें)",
      mr:"काळजीवाहूला घट्ट धरतो/धरते किंवा वयाच्या मानाने असाधारण भीती दाखवतो/दाखवते (अंधार, अनोळखी, कुत्रे, मोठे आवाज)" },
    { id:"PI12", domain:"IDD",  seq:18,
      en:"Must be watched every moment — unsafe without constant adult supervision due to poor judgment about danger",
      hi:"हर पल नजर रखनी पड़ती है — खतरे की समझ कम होने के कारण बड़े की लगातार निगरानी के बिना असुरक्षित है",
      mr:"दर क्षणी नजर ठेवावी लागते — धोक्याची समज कमी असल्यामुळे सतत मोठ्यांच्या देखरेखीशिवाय असुरक्षित आहे" },
    { id:"ASD21",domain:"ASD",  seq:19,
      en:"Becomes very distressed when routine changes — insists on the same sequence for meals, bath, bedtime, or travel route",
      hi:"दिनचर्या बदलने पर बहुत परेशान हो जाता है — खाने, नहाने, सोने या यात्रा के रास्ते का एक ही क्रम चाहता है",
      mr:"नित्यक्रम बदलल्यावर खूप अस्वस्थ होतो/होते — जेवण, आंघोळ, झोपणे किंवा प्रवासाच्या मार्गाचा एकच क्रम हवा असतो" },
    { id:"ADD33",domain:"ADHD", seq:20,
      en:"Cannot slow down or stop moving even at bedtime — constantly running, climbing, or touching everything",
      hi:"सोने के समय भी नहीं रुक पाता — लगातार दौड़ता, चढ़ता, या हर चीज छूता रहता है",
      mr:"झोपण्याच्या वेळीही थांबू शकत नाही — सतत धावतो/धावते, चढतो/चढते किंवा सर्व काही हात लावतो/लावते" },
    { id:"ASD25",domain:"ASD",  seq:21,
      en:"Has not reached learning milestones expected for age — not yet pointing, doing pretend play, or learning colours and shapes",
      hi:"उम्र के अनुसार अपेक्षित सीखने के पड़ाव नहीं पहुंचे — इशारा नहीं करता, नाटक नहीं खेलता, या रंग और आकृतियाँ नहीं सीख पाया",
      mr:"वयानुसार अपेक्षित शिकण्याचे टप्पे गाठलेले नाहीत — अजून बोट दाखवत नाही, नाटक खेळत नाही, किंवा रंग व आकार शिकलेले नाही" },
    { id:"SLD41",domain:"SLD",  seq:22,
      en:"Has difficulty with age-expected fine motor tasks — holding a crayon, turning pages, threading beads, or using child scissors",
      hi:"उम्र के अनुसार अपेक्षित बारीक मोटर कामों में परेशानी — क्रेयॉन पकड़ना, पन्ने पलटना, मोती पिरोना, या बच्चों की कैंची चलाना",
      mr:"वयानुसार अपेक्षित बारीक मोटर कामांत अडचण — क्रेयॉन धरणे, पाने उलटणे, मणी ओवणे, किंवा मुलांची कात्री वापरणे" },
    { id:"ANX62",domain:"ANX",  seq:23,
      en:"Has repeated stomach aches, headaches, or body complaints without medical cause — especially before new situations, school, or separation",
      hi:"नई स्थितियों, स्कूल या अलगाव से पहले खासतौर पर बार-बार पेट दर्द, सिरदर्द, या शरीर की शिकायतें बिना किसी चिकित्सीय कारण के",
      mr:"नवीन परिस्थिती, शाळा किंवा वेगळे केल्यापूर्वी विशेषतः वारंवार पोटदुखी, डोकेदुखी किंवा कोणत्याही वैद्यकीय कारणाशिवाय शरीराच्या तक्रारी" },
    { id:"ODD51",domain:"ODD",  seq:24,
      en:"Has intense, prolonged tantrums and persistently refuses or defies caregiver instructions beyond what is typical for age",
      hi:"वयोचित से परे तीव्र, लंबे नखरे और लगातार देखभालकर्ता के निर्देशों का मना करना या विरोध करना",
      mr:"वयाच्या मानाने अत्यंत तीव्र, दीर्घ हट्ट आणि सतत काळजीवाहूंच्या सूचना नाकारणे किंवा विरोध करणे" },
    { id:"CD53", domain:"CD",   seq:25,
      en:"Deliberately hurts other children or animals, destroys property, or takes others' belongings without remorse",
      hi:"जानबूझकर अन्य बच्चों या जानवरों को चोट पहुंचाता है, संपत्ति नष्ट करता है, या दूसरों का सामान बिना पछतावे के ले लेता है",
      mr:"जाणूनबुजून इतर मुलांना किंवा प्राण्यांना दुखवतो/दुखवते, मालमत्ता नष्ट करतो/करते, किंवा पश्चात्तापाशिवाय इतरांच्या वस्तू घेतो/घेते" },
    { id:"CD55", domain:"CD",   seq:26,
      en:"Shows deliberate aggression toward others — hits, bites, kicks, or intimidates — without apparent reason",
      hi:"दूसरों पर जानबूझकर आक्रामकता दिखाता है — बिना किसी स्पष्ट कारण के मारता, काटता, लात मारता या धमकाता है",
      mr:"इतरांवर जाणूनबुजून आक्रमकता दाखवतो/दाखवते — कोणत्याही स्पष्ट कारणाशिवाय मारतो/मारते, चावतो/चावते, लाथ मारतो/मारते" },
  ],

  // ── PRIMARY  6–10 years ────────────────────────────────────
  pri: [
    { id:"CI2",  domain:"IDD",  seq:1,
      en:"Lags behind classmates in learning across all school subjects",
      hi:"कक्षा में हर विषय में हमउम्र बच्चों से पिछड़ा है",
      mr:"वर्गातील सर्व विषयांत समवयस्कांपेक्षा मागे आहे" },
    { id:"CI3",  domain:"IDD",  seq:2,
      en:"Needs extra support and more time to learn new things compared to classmates",
      hi:"नई चीज सीखने में हमजमात बच्चों की तुलना में ज्यादा समय और सहारे की जरूरत",
      mr:"नवीन गोष्टी शिकण्यासाठी वर्गमित्रांच्या तुलनेत अतिरिक्त वेळ आणि आधार हवा" },
    { id:"SI6",  domain:"IDD",  seq:3,
      en:"Has difficulty understanding what others mean, feel, or expect in conversations",
      hi:"बातचीत में दूसरों का मतलब, भावना या अपेक्षाएं समझने में परेशानी",
      mr:"संभाषणात इतरांचा अर्थ, भावना किंवा अपेक्षा समजण्यात अडचण" },
    { id:"SI7",  domain:"IDD",  seq:4,
      en:"Communicates and interacts noticeably differently from children of the same age",
      hi:"हमउम्र बच्चों की तुलना में स्पष्ट रूप से अलग तरह से बातचीत और मेलजोल करता है",
      mr:"त्याच वयाच्या मुलांपेक्षा स्पष्टपणे वेगळ्या पद्धतीने संवाद आणि संपर्क करतो/करते" },
    { id:"ADD27",domain:"ADHD", seq:5,
      en:"Has difficulty keeping attention on tasks, homework, or classroom activities",
      hi:"काम, होमवर्क या कक्षा की गतिविधियों पर ध्यान बनाए रखने में कठिनाई",
      mr:"काम, गृहपाठ किंवा वर्गातील क्रियांवर लक्ष केंद्रित ठेवण्यात अडचण" },
    { id:"ADD29",domain:"ADHD", seq:6,
      en:"Cannot finish schoolwork, homework, or chores once started",
      hi:"शुरू करने के बाद स्कूल का काम, होमवर्क या घर का काम पूरा नहीं कर पाता",
      mr:"एकदा सुरू केल्यावर शाळेचे काम, गृहपाठ किंवा घरकाम पूर्ण करू शकत नाही" },
    { id:"ASD14",domain:"ASD",  seq:7,
      en:"Has poor eye contact with people during conversation or play",
      hi:"बातचीत या खेल के दौरान लोगों से ठीक से आँखें नहीं मिलाता",
      mr:"संभाषण किंवा खेळादरम्यान लोकांशी नीट नजर मिळवत नाही" },
    { id:"SLD34",domain:"SLD",  seq:8,
      en:"Has difficulty finding his or her place when reading, or locating belongings or positions",
      hi:"पढ़ते समय अपनी जगह खोजने में परेशानी, या अपना सामान या स्थान ढूंढने में दिक्कत",
      mr:"वाचताना स्वतःची जागा शोधण्यात अडचण, किंवा सामान किंवा स्थान शोधण्यात अडचण" },
    { id:"MDD44",domain:"MDD",  seq:9,
      en:"Often appears sad or unhappy over a prolonged period — not just occasional bad days",
      hi:"लंबे समय तक अक्सर उदास या दुखी दिखता है — सिर्फ कभी-कभी बुरे दिन नहीं",
      mr:"दीर्घ कालावधीत बऱ्याचदा उदास किंवा दुखी दिसतो/दिसते — फक्त अधून मधून वाईट दिवस नाही" },
    { id:"ANX49",domain:"ANX",  seq:10,
      en:"Worries a lot about bad things that might happen — to self, family, or at school",
      hi:"खुद, परिवार, या स्कूल में होने वाली बुरी चीजों की बहुत चिंता करता है",
      mr:"स्वतःला, कुटुंबाला किंवा शाळेत होणाऱ्या वाईट गोष्टींची खूप काळजी करतो/करते" },
    { id:"PI10", domain:"IDD",  seq:11,
      en:"Needs extra adult help with eating, dressing, toilet use, and hygiene beyond what is normal for age",
      hi:"खाने, कपड़े पहनने, शौचालय और साफ-सफाई में उम्र के हिसाब से ज्यादा बड़े की मदद चाहिए",
      mr:"जेवण, कपडे, शौचालय आणि स्वच्छता यासाठी वयाच्या मानाने जास्त मोठ्यांची मदत लागते" },
    { id:"PI11", domain:"IDD",  seq:12,
      en:"Shows behaviour that causes problems, conflict, or embarrassment in social settings",
      hi:"ऐसा व्यवहार करता है जो सामाजिक परिस्थितियों में समस्या, विवाद या शर्मिंदगी पैदा करता है",
      mr:"सामाजिक परिस्थितीत समस्या, संघर्ष किंवा लाज निर्माण करणारे वर्तन करतो/करते" },
    { id:"ASD18",domain:"ASD",  seq:13,
      en:"Flaps hands, rocks body, or spins in circles repeatedly in ways that attract attention",
      hi:"बार-बार हाथ हिलाता है, शरीर झुकाता है, या गोल-गोल घूमता है जिससे ध्यान जाता है",
      mr:"वारंवार हात हलवतो/हलवते, शरीर हलवतो/हलवते, किंवा गोल फिरतो/फिरते ज्यामुळे लोकांचे लक्ष जाते" },
    { id:"ADD31",domain:"ADHD", seq:14,
      en:"Frequently loses belongings, stationery, books, or personal items",
      hi:"अपना सामान, स्टेशनरी, किताबें, या व्यक्तिगत चीजें बार-बार खो देता है",
      mr:"सामान, स्टेशनरी, पुस्तके किंवा वैयक्तिक वस्तू वारंवार हरवतो/हरवते" },
    { id:"SLD37",domain:"SLD",  seq:15,
      en:"Cannot remember sequences of words, or has difficulty with reading, spelling, or word-based maths",
      hi:"शब्दों के क्रम याद नहीं रख पाता, या पढ़ने, लिखने की वर्तनी, या शाब्दिक गणित में परेशानी",
      mr:"शब्दांचा क्रम लक्षात ठेवू शकत नाही, किंवा वाचणे, स्पेलिंग, किंवा शब्द-आधारित गणितात अडचण" },
    { id:"MDD46",domain:"MDD",  seq:16,
      en:"Often appears down, hopeless, or has lost enjoyment in activities they previously liked",
      hi:"अक्सर निराश, हताश दिखता है, या पहले पसंद की गतिविधियों में आनंद खो दिया है",
      mr:"बऱ्याचदा निराश, हताश दिसतो/दिसते, किंवा आधी आवडत्या क्रियांमध्ये आनंद गमावला आहे" },
    { id:"ANX60",domain:"ANX",  seq:17,
      en:"Lives with a constant feeling that something bad is about to happen — hard to reassure",
      hi:"हमेशा यह भावना रहती है कि कुछ बुरा होने वाला है — आश्वस्त करना मुश्किल है",
      mr:"नेहमी काहीतरी वाईट होणार अशी भावना असते — आश्वस्त करणे कठीण असते" },
    { id:"PI12", domain:"IDD",  seq:18,
      en:"Needs constant supervision and reminders to complete daily tasks safely and appropriately",
      hi:"रोजमर्रा के कामों को सुरक्षित और सही तरीके से पूरा करने के लिए लगातार निगरानी और याद दिलाने की जरूरत",
      mr:"दैनंदिन कामे सुरक्षितपणे आणि योग्यरित्या पूर्ण करण्यासाठी सतत देखरेख आणि आठवण करून देण्याची गरज" },
    { id:"ASD21",domain:"ASD",  seq:19,
      en:"Must follow fixed routines at home and school — becomes very upset when disrupted",
      hi:"घर और स्कूल में एक निश्चित दिनचर्या का पालन करना जरूरी है — बाधित होने पर बहुत परेशान हो जाता है",
      mr:"घरी आणि शाळेत ठराविक नित्यक्रम पाळणे आवश्यक — विस्कळीत झाल्यावर खूप अस्वस्थ होतो/होते" },
    { id:"ADD33",domain:"ADHD", seq:20,
      en:"Always full of energy but without focus or direction — cannot stop even when asked",
      hi:"हमेशा ऊर्जा से भरा लेकिन बिना ध्यान या दिशा के — कहने पर भी नहीं रुकता",
      mr:"नेहमी उत्साहाने भरलेला/भरलेली पण दिशा किंवा लक्ष नाही — सांगितले तरी थांबत नाही" },
    { id:"ASD25",domain:"ASD",  seq:21,
      en:"Shows delayed learning or thinking skills compared to same-age classmates",
      hi:"हमउम्र सहपाठियों की तुलना में सीखने या सोचने की क्षमता देर से विकसित हुई है",
      mr:"त्याच वयाच्या वर्गमित्रांच्या तुलनेत शिकण्याची किंवा विचार करण्याची क्षमता उशिरा विकसित झाली आहे" },
    { id:"SLD41",domain:"SLD",  seq:22,
      en:"Has poor motor control or difficulty with hand-eye coordination — messy writing, poor drawing",
      hi:"मोटर नियंत्रण कम है या हाथ-आँख के तालमेल में परेशानी — गंदी लिखावट, खराब चित्रकारी",
      mr:"मोटर नियंत्रण कमी किंवा हात-डोळा समन्वयात अडचण — अव्यवस्थित लेखन, खराब चित्रकला" },
    { id:"ANX62",domain:"ANX",  seq:23,
      en:"Has stomach upsets, breathlessness, restlessness, or irritability linked to worry or school",
      hi:"चिंता या स्कूल से जुड़े पेट दर्द, सांस फूलना, बेचैनी, या चिड़चिड़ापन",
      mr:"काळजी किंवा शाळेशी संबंधित पोटदुखी, श्वास लागणे, अस्वस्थपणा किंवा चिडचिडेपणा" },
    { id:"ODD51",domain:"ODD",  seq:24,
      en:"Frequently argues with or talks back to parents, teachers, and other adults",
      hi:"माता-पिता, शिक्षकों और अन्य बड़ों के साथ बार-बार बहस करता है या उलटा जवाब देता है",
      mr:"पालक, शिक्षक आणि इतर वडीलधाऱ्यांशी वारंवार वाद घालतो/घालते किंवा उलट उत्तर देतो/देते" },
    { id:"CD53", domain:"CD",   seq:25,
      en:"Repeatedly does things that are clearly not permitted — steals, lies, bullies, or damages property",
      hi:"बार-बार साफ मना की हुई चीजें करता है — चोरी, झूठ, धमकाना, या संपत्ति नुकसान पहुंचाना",
      mr:"वारंवार स्पष्टपणे परवानगी नसलेल्या गोष्टी करतो/करते — चोरी, खोटे बोलणे, दादागिरी, किंवा मालमत्तेचे नुकसान" },
    { id:"CD55", domain:"CD",   seq:26,
      en:"Is rude, disrespectful, physically aggressive, or threatening with people around",
      hi:"आसपास के लोगों के साथ असभ्य, अनादरजनक, शारीरिक रूप से आक्रामक, या धमकी देने वाला है",
      mr:"आजूबाजूच्या लोकांशी असभ्य, अनादरकारक, शारीरिकदृष्ट्या आक्रमक किंवा धमकी देणारा/देणारी आहे" },
  ],

  // ── SECONDARY  11–15 years ─────────────────────────────────
  sec: [
    { id:"CI2",  domain:"IDD",  seq:1,
      en:"Falls noticeably behind peers in academic learning and general reasoning",
      hi:"शैक्षणिक शिक्षण और सामान्य तर्क में साथियों से स्पष्ट रूप से पीछे है",
      mr:"शैक्षणिक शिकणे आणि सामान्य तर्कात समवयस्कांपेक्षा स्पष्टपणे मागे आहे" },
    { id:"CI3",  domain:"IDD",  seq:2,
      en:"Needs significant adult support and much more time to grasp new academic concepts",
      hi:"नई शैक्षणिक अवधारणाओं को समझने के लिए काफी बड़े की मदद और बहुत ज्यादा समय चाहिए",
      mr:"नवीन शैक्षणिक संकल्पना समजण्यासाठी लक्षणीय मोठ्यांचा आधार आणि खूप जास्त वेळ लागतो" },
    { id:"SI6",  domain:"IDD",  seq:3,
      en:"Struggles to understand implied meanings, sarcasm, social cues, or what others are thinking",
      hi:"निहित अर्थ, व्यंग्य, सामाजिक संकेत, या दूसरे क्या सोच रहे हैं यह समझने में कठिनाई",
      mr:"अव्यक्त अर्थ, उपहास, सामाजिक संकेत किंवा इतर काय विचार करत आहेत हे समजण्यात अडचण" },
    { id:"SI7",  domain:"IDD",  seq:4,
      en:"Communicates and interacts in ways that are noticeably different from peers at school and social settings",
      hi:"स्कूल और सामाजिक परिस्थितियों में साथियों से स्पष्ट रूप से अलग तरह से बातचीत और मेलजोल करता है",
      mr:"शाळेत आणि सामाजिक परिस्थितीत समवयस्कांपेक्षा स्पष्टपणे वेगळ्या पद्धतीने संवाद करतो/करते" },
    { id:"ADD27",domain:"ADHD", seq:5,
      en:"Has difficulty sustaining attention on schoolwork, projects, or extended conversations",
      hi:"स्कूल के काम, प्रोजेक्ट, या लंबी बातचीत पर ध्यान बनाए रखने में कठिनाई",
      mr:"शाळेचे काम, प्रकल्प किंवा दीर्घ संभाषणावर लक्ष टिकवण्यात अडचण" },
    { id:"ADD29",domain:"ADHD", seq:6,
      en:"Cannot complete assignments, projects, or chores once started — frequent incomplete work",
      hi:"शुरू करने के बाद असाइनमेंट, प्रोजेक्ट, या काम पूरा नहीं कर पाता — काम अक्सर अधूरा रहता है",
      mr:"एकदा सुरू केल्यावर असाइनमेंट, प्रकल्प किंवा काम पूर्ण करू शकत नाही — काम वारंवार अपूर्ण राहते" },
    { id:"ASD14",domain:"ASD",  seq:7,
      en:"Has poor or inconsistent eye contact in social situations and conversations",
      hi:"सामाजिक स्थितियों और बातचीत में आँख का संपर्क कम या असंगत है",
      mr:"सामाजिक परिस्थिती आणि संभाषणात नजरेचा संपर्क कमी किंवा असंगत आहे" },
    { id:"SLD34",domain:"SLD",  seq:8,
      en:"Has a poor sense of direction, loses place in text or notes, or gets disoriented in familiar settings",
      hi:"दिशा की समझ कम है, पाठ या नोट्स में जगह खो देता है, या परिचित जगहों में भी खो जाता है",
      mr:"दिशेची समज कमी आहे, मजकूर किंवा नोट्समध्ये जागा हरवते, किंवा परिचित ठिकाणीही दिशाभूल होते" },
    { id:"MDD44",domain:"MDD",  seq:9,
      en:"Often appears sad, unhappy, or tearful without a clear reason for prolonged periods",
      hi:"बिना किसी स्पष्ट कारण के लंबे समय तक अक्सर उदास, दुखी, या रोने वाला दिखता है",
      mr:"कोणत्याही स्पष्ट कारणाशिवाय दीर्घ काळ बऱ्याचदा उदास, दुखी किंवा रडवेला/रडवेली दिसतो/दिसते" },
    { id:"ANX49",domain:"ANX",  seq:10,
      en:"Worries excessively about exams, friendships, family, or future — hard to reassure",
      hi:"परीक्षाओं, दोस्तों, परिवार, या भविष्य की अत्यधिक चिंता — आश्वस्त करना मुश्किल",
      mr:"परीक्षा, मैत्री, कुटुंब किंवा भविष्याबद्दल अत्यधिक काळजी — आश्वस्त करणे कठीण" },
    { id:"PI10", domain:"IDD",  seq:11,
      en:"Needs regular assistance with self-care tasks — hygiene, organisation, meals — beyond what is typical for age",
      hi:"स्वयं की देखभाल — स्वच्छता, संगठन, भोजन — के लिए उम्र के हिसाब से ज्यादा नियमित मदद चाहिए",
      mr:"स्वत:ची काळजी — स्वच्छता, संघटन, जेवण — यासाठी वयाच्या मानाने जास्त नियमित मदत लागते" },
    { id:"PI11", domain:"IDD",  seq:12,
      en:"Shows behaviour that causes social problems, embarrassment, or conflict in peer and school settings",
      hi:"ऐसा व्यवहार करता है जो साथियों और स्कूल में सामाजिक समस्याएं, शर्मिंदगी या विवाद पैदा करता है",
      mr:"समवयस्क आणि शाळेत सामाजिक समस्या, लाज किंवा संघर्ष निर्माण करणारे वर्तन करतो/करते" },
    { id:"ASD18",domain:"ASD",  seq:13,
      en:"Shows repetitive body movements or self-stimulatory behaviours that are difficult to interrupt",
      hi:"दोहराए जाने वाले शारीरिक हरकतें या स्व-उत्तेजक व्यवहार दिखाता है जिन्हें रोकना मुश्किल है",
      mr:"वारंवार शारीरिक हालचाली किंवा स्व-उत्तेजक वर्तन दाखवतो/दाखवते जे थांबवणे कठीण आहे" },
    { id:"ADD31",domain:"ADHD", seq:14,
      en:"Frequently loses or misplaces belongings, homework, important documents, or stationery",
      hi:"सामान, होमवर्क, महत्वपूर्ण कागज, या स्टेशनरी बार-बार खो देता या गलत जगह रख देता है",
      mr:"सामान, गृहपाठ, महत्त्वाची कागदपत्रे किंवा स्टेशनरी वारंवार हरवते किंवा चुकीच्या ठिकाणी ठेवले जाते" },
    { id:"SLD37",domain:"SLD",  seq:15,
      en:"Has difficulty with sequencing, word problems, or mathematical reasoning in class-level work",
      hi:"कक्षा स्तर के काम में क्रम, शाब्दिक समस्याओं, या गणितीय तर्क में कठिनाई",
      mr:"वर्ग स्तरावरील कामात क्रम, शब्द समस्या किंवा गणितीय तर्कात अडचण" },
    { id:"MDD46",domain:"MDD",  seq:16,
      en:"Often seems persistently low in mood, hopeless, or feels that nothing matters or will improve",
      hi:"अक्सर लगातार मूड खराब, हताश, या लगता है कि कुछ मायने नहीं रखता या सुधरेगा नहीं",
      mr:"बऱ्याचदा सतत मनःस्थिती खालावलेली, हताश किंवा काहीही महत्त्वाचे नाही किंवा सुधारणार नाही असे वाटते" },
    { id:"ANX60",domain:"ANX",  seq:17,
      en:"Is consumed by persistent, hard-to-control worry or dread — often cannot say exactly what they fear",
      hi:"लगातार, नियंत्रण में मुश्किल चिंता या डर से ग्रसित है — अक्सर ठीक से नहीं बता पाता कि क्या डर है",
      mr:"सतत, नियंत्रण करणे कठीण अशा काळजीने किंवा भीतीने ग्रस्त — अनेकदा नेमकी काय भीती आहे हे सांगता येत नाही" },
    { id:"PI12", domain:"IDD",  seq:18,
      en:"Needs regular supervision or reminders to complete daily tasks safely and appropriately",
      hi:"दैनिक कार्यों को सुरक्षित और उचित तरीके से पूरा करने के लिए नियमित निगरानी या याद दिलाने की जरूरत",
      mr:"दैनंदिन कामे सुरक्षितपणे आणि योग्यरित्या पूर्ण करण्यासाठी नियमित देखरेख किंवा आठवण करून देण्याची गरज" },
    { id:"ASD21",domain:"ASD",  seq:19,
      en:"Insists on rigid routines or specific ways of doing things — intense distress when disrupted",
      hi:"चीजों को करने के कठोर तरीके या विशेष दिनचर्या पर जोर देता है — बाधित होने पर तीव्र परेशानी",
      mr:"गोष्टी करण्याच्या कठोर नित्यक्रमावर किंवा विशिष्ट पद्धतीवर आग्रह — विस्कळीत झाल्यावर तीव्र संकट" },
    { id:"ADD33",domain:"ADHD", seq:20,
      en:"Feels constantly restless, fidgety, or unable to slow down — internal motor that won't stop",
      hi:"लगातार बेचैनी, छटपटाहट, या धीमा होने में असमर्थ — एक आंतरिक मोटर जो रुकती नहीं",
      mr:"सतत अस्वस्थ, चुळबुळ किंवा मंद होण्यास असमर्थ — न थांबणारी आंतरिक मोटर" },
    { id:"ASD25",domain:"ASD",  seq:21,
      en:"Shows clearly slower processing speed or learning pace compared to peers — without other obvious explanation",
      hi:"साथियों की तुलना में स्पष्ट रूप से धीमी प्रसंस्करण गति या सीखने की गति — बिना किसी अन्य स्पष्ट कारण के",
      mr:"समवयस्कांच्या तुलनेत स्पष्टपणे मंद प्रक्रिया गती किंवा शिकण्याचा वेग — इतर कोणत्याही स्पष्ट कारणाशिवाय" },
    { id:"SLD41",domain:"SLD",  seq:22,
      en:"Has poor handwriting, difficulty with fine motor tasks, or poor hand-eye coordination",
      hi:"लिखावट खराब है, बारीक मोटर कामों में कठिनाई है, या हाथ-आँख का तालमेल कम है",
      mr:"लेखन अव्यवस्थित आहे, बारीक मोटर कामांत अडचण आहे, किंवा हात-डोळा समन्वय कमी आहे" },
    { id:"ANX62",domain:"ANX",  seq:23,
      en:"Has physical anxiety symptoms — nausea, headaches, breathlessness, restlessness, or irritability",
      hi:"शारीरिक चिंता के लक्षण — जी मचलाना, सिरदर्द, सांस फूलना, बेचैनी, या चिड़चिड़ापन",
      mr:"शारीरिक चिंतेची लक्षणे — मळमळ, डोकेदुखी, श्वास लागणे, अस्वस्थपणा किंवा चिडचिडेपणा" },
    { id:"ODD51",domain:"ODD",  seq:24,
      en:"Frequently argues with, defies, or refuses reasonable requests from parents and teachers",
      hi:"माता-पिता और शिक्षकों के उचित अनुरोधों पर अक्सर बहस करता है, अवज्ञा करता है, या मना करता है",
      mr:"पालक आणि शिक्षकांच्या वाजवी विनंत्यांना वारंवार वाद घालतो/घालते, अवज्ञा करतो/करते किंवा नकार देतो/देते" },
    { id:"CD53", domain:"CD",   seq:25,
      en:"Repeatedly breaks serious rules, lies, steals, bullies, or behaves in ways that harm others",
      hi:"बार-बार महत्वपूर्ण नियम तोड़ता है, झूठ बोलता है, चोरी करता है, धमकाता है, या दूसरों को नुकसान पहुंचाने वाला व्यवहार करता है",
      mr:"वारंवार महत्त्वाचे नियम मोडतो/मोडते, खोटे बोलतो/बोलते, चोरी करतो/करते, दादागिरी करतो/करते किंवा इतरांना दुखवणारे वर्तन करतो/करते" },
    { id:"CD55", domain:"CD",   seq:26,
      en:"Is persistently rude, threatening, or physically aggressive towards peers or adults",
      hi:"साथियों या बड़ों के प्रति लगातार असभ्य, धमकी देने वाला, या शारीरिक रूप से आक्रामक है",
      mr:"समवयस्कांशी किंवा मोठ्यांशी सतत असभ्य, धमकावणारा/धमकावणारी किंवा शारीरिकदृष्ट्या आक्रमक आहे" },
  ],

  // ── HIGHER SECONDARY  16–18 years ─────────────────────────
  hig: [
    { id:"CI2",  domain:"IDD",  seq:1,
      en:"Falls significantly behind peers in academic performance, reasoning, and learning across all subjects",
      hi:"सभी विषयों में शैक्षणिक प्रदर्शन, तर्क और सीखने में साथियों से काफी पीछे है",
      mr:"सर्व विषयांत शैक्षणिक कामगिरी, तर्क आणि शिकण्यात समवयस्कांपेक्षा लक्षणीयरित्या मागे आहे" },
    { id:"CI3",  domain:"IDD",  seq:2,
      en:"Requires ongoing adult support and much longer time to understand new ideas, skills, or concepts",
      hi:"नए विचारों, कौशल, या अवधारणाओं को समझने के लिए निरंतर बड़े की मदद और बहुत ज्यादा समय चाहिए",
      mr:"नवीन कल्पना, कौशल्ये किंवा संकल्पना समजण्यासाठी सतत मोठ्यांचा आधार आणि खूप जास्त वेळ लागतो" },
    { id:"SI6",  domain:"IDD",  seq:3,
      en:"Has difficulty understanding abstract concepts, implied meanings, or what others think and feel",
      hi:"अमूर्त अवधारणाओं, निहित अर्थ, या दूसरे क्या सोचते और महसूस करते हैं यह समझने में कठिनाई",
      mr:"अमूर्त संकल्पना, अव्यक्त अर्थ किंवा इतर काय विचार करतात आणि काय वाटते हे समजण्यात अडचण" },
    { id:"SI7",  domain:"IDD",  seq:4,
      en:"Shows marked differences from peers in how they communicate, form relationships, and socially connect",
      hi:"साथियों से स्पष्ट रूप से अलग तरह से संवाद करता है, रिश्ते बनाता है, और सामाजिक रूप से जुड़ता है",
      mr:"समवयस्कांपेक्षा स्पष्टपणे वेगळ्या पद्धतीने संवाद करतो/करते, नाती जोडतो/जोडते आणि सामाजिकरित्या संपर्क साधतो/साधते" },
    { id:"ADD27",domain:"ADHD", seq:5,
      en:"Has significant difficulty maintaining concentration on studies, tasks, or responsibilities for adequate time",
      hi:"पर्याप्त समय के लिए पढ़ाई, काम, या जिम्मेदारियों पर ध्यान बनाए रखने में काफी कठिनाई",
      mr:"पुरेसा वेळ अभ्यास, काम किंवा जबाबदाऱ्यांवर लक्ष केंद्रित ठेवण्यात लक्षणीय अडचण" },
    { id:"ADD29",domain:"ADHD", seq:6,
      en:"Leaves most tasks, assignments, or responsibilities incomplete — persistent poor follow-through",
      hi:"अधिकांश काम, असाइनमेंट, या जिम्मेदारियां अधूरी छोड़ देता है — लगातार काम पूरा न करना",
      mr:"बहुतेक कामे, असाइनमेंट किंवा जबाबदाऱ्या अपूर्ण सोडतो/सोडते — सतत काम पूर्ण न होणे" },
    { id:"ASD14",domain:"ASD",  seq:7,
      en:"Avoids or has significant difficulty maintaining eye contact in social situations and conversations",
      hi:"सामाजिक स्थितियों और बातचीत में आँखों का संपर्क बनाए रखने से बचता है या काफी कठिनाई होती है",
      mr:"सामाजिक परिस्थिती आणि संभाषणात नजरेचा संपर्क टाळतो/टाळते किंवा टिकवण्यात लक्षणीय अडचण" },
    { id:"SLD34",domain:"SLD",  seq:8,
      en:"Has difficulty with spatial organisation — loses place in text or notes, struggles with directions or layouts",
      hi:"स्थानिक संगठन में कठिनाई — पाठ या नोट्स में जगह खो देता है, दिशाओं या लेआउट से संघर्ष करता है",
      mr:"स्थानिक संघटनात अडचण — मजकूर किंवा नोट्समध्ये जागा हरवते, दिशा किंवा मांडणीत संघर्ष" },
    { id:"MDD44",domain:"MDD",  seq:9,
      en:"Often appears emotionally flat, sad, or has lost interest in activities and people they once enjoyed",
      hi:"अक्सर भावनात्मक रूप से सपाट, उदास दिखता है, या उन गतिविधियों और लोगों में रुचि खो दी है जो पहले पसंद थे",
      mr:"बऱ्याचदा भावनिकदृष्ट्या सपाट, उदास दिसतो/दिसते, किंवा आधी आवडलेल्या क्रिया आणि लोकांमध्ये रस गमावला आहे" },
    { id:"ANX49",domain:"ANX",  seq:10,
      en:"Worries intensely and persistently about academic performance, future, health, or relationships",
      hi:"शैक्षणिक प्रदर्शन, भविष्य, स्वास्थ्य, या रिश्तों के बारे में गहरी और लगातार चिंता",
      mr:"शैक्षणिक कामगिरी, भविष्य, आरोग्य किंवा नात्यांबद्दल तीव्र आणि सतत काळजी" },
    { id:"PI10", domain:"IDD",  seq:11,
      en:"Requires support with self-care, personal organisation, or daily living skills beyond age expectations",
      hi:"स्वयं की देखभाल, व्यक्तिगत संगठन, या दैनिक जीवन कौशल में उम्र की अपेक्षाओं से परे मदद चाहिए",
      mr:"स्वत:ची काळजी, वैयक्तिक संघटन किंवा दैनंदिन जीवन कौशल्यांसाठी वयाच्या अपेक्षेपलीकडे आधार लागतो" },
    { id:"PI11", domain:"IDD",  seq:12,
      en:"Exhibits behaviour that creates significant social difficulties, conflict, or isolation among peers",
      hi:"ऐसा व्यवहार करता है जो साथियों में महत्वपूर्ण सामाजिक कठिनाइयां, विवाद, या अलगाव पैदा करता है",
      mr:"समवयस्कांमध्ये लक्षणीय सामाजिक अडचणी, संघर्ष किंवा एकटेपणा निर्माण करणारे वर्तन करतो/करते" },
    { id:"ASD18",domain:"ASD",  seq:13,
      en:"Engages in repetitive movements, rituals, or self-stimulatory behaviours that are persistent and intrusive",
      hi:"लगातार और दखल देने वाली दोहराव वाली हरकतें, अनुष्ठान, या स्व-उत्तेजक व्यवहार में लगा रहता है",
      mr:"सतत आणि व्यत्यय आणणाऱ्या वारंवार हालचाली, विधी किंवा स्व-उत्तेजक वर्तनात गुंतलेला/गुंतलेली असतो/असते" },
    { id:"ADD31",domain:"ADHD", seq:14,
      en:"Consistently loses or misplaces important items — phone, notes, keys, identity cards, stationery",
      hi:"महत्वपूर्ण चीजें — फोन, नोट्स, चाबियाँ, पहचान पत्र, स्टेशनरी — लगातार खो देता या गलत जगह रख देता है",
      mr:"महत्त्वाच्या वस्तू — फोन, नोट्स, चाव्या, ओळखपत्र, स्टेशनरी — सतत हरवतात किंवा चुकीच्या ठिकाणी ठेवल्या जातात" },
    { id:"SLD37",domain:"SLD",  seq:15,
      en:"Has persistent difficulty with complex reasoning, word problems, or mathematical thinking",
      hi:"जटिल तर्क, शाब्दिक समस्याओं, या गणितीय सोच में लगातार कठिनाई",
      mr:"जटिल तर्क, शब्द समस्या किंवा गणितीय विचारात सतत अडचण" },
    { id:"MDD46",domain:"MDD",  seq:16,
      en:"Frequently feels or expresses hopelessness, worthlessness, or a persistently severe low mood",
      hi:"अक्सर निराशा, निरर्थकता, या लगातार गहरे खराब मूड की भावना या अभिव्यक्ति करता है",
      mr:"वारंवार हतबलता, नालायकपणाची भावना किंवा सतत तीव्र उदास मनःस्थिती जाणवते किंवा व्यक्त केली जाते" },
    { id:"ANX60",domain:"ANX",  seq:17,
      en:"Is overwhelmed by constant, uncontrollable worry or dread — about life, studies, health, or the future",
      hi:"जीवन, पढ़ाई, स्वास्थ्य, या भविष्य के बारे में लगातार, अनियंत्रणीय चिंता या डर से अभिभूत है",
      mr:"जीवन, अभ्यास, आरोग्य किंवा भविष्याबद्दल सतत, अनियंत्रित काळजी किंवा भीतीने व्यापलेला/व्यापलेली आहे" },
    { id:"PI12", domain:"IDD",  seq:18,
      en:"Requires regular reminders, supervision, or support to manage daily responsibilities and stay safe",
      hi:"दैनिक जिम्मेदारियों को संभालने और सुरक्षित रहने के लिए नियमित याद दिलाने, निगरानी, या मदद की जरूरत",
      mr:"दैनंदिन जबाबदाऱ्या सांभाळण्यासाठी आणि सुरक्षित राहण्यासाठी नियमित आठवण, देखरेख किंवा आधाराची गरज" },
    { id:"ASD21",domain:"ASD",  seq:19,
      en:"Demands strict routines or patterns in daily life — any unexpected change causes intense distress or meltdown",
      hi:"दैनिक जीवन में कठोर दिनचर्या या पैटर्न की मांग करता है — कोई भी अप्रत्याशित बदलाव तीव्र संकट पैदा करता है",
      mr:"दैनंदिन जीवनात कठोर नित्यक्रम किंवा पॅटर्नची मागणी करतो/करते — कोणताही अनपेक्षित बदल तीव्र संकट निर्माण करतो" },
    { id:"ADD33",domain:"ADHD", seq:20,
      en:"Experiences persistent inner restlessness, cannot relax or switch off — feels driven by a constant internal motor",
      hi:"लगातार आंतरिक बेचैनी का अनुभव करता है, आराम नहीं कर सकता — एक लगातार आंतरिक मोटर से संचालित महसूस करता है",
      mr:"सतत आंतरिक अस्वस्थता जाणवते, आराम करू शकत नाही किंवा स्विच ऑफ करू शकत नाही — सतत आंतरिक मोटरने चालवल्यासारखे वाटते" },
    { id:"ASD25",domain:"ASD",  seq:21,
      en:"Demonstrates noticeably slower information processing or learning speed compared to peers without an obvious cause",
      hi:"बिना किसी स्पष्ट कारण के साथियों की तुलना में स्पष्ट रूप से धीमी जानकारी प्रसंस्करण या सीखने की गति",
      mr:"कोणत्याही स्पष्ट कारणाशिवाय समवयस्कांच्या तुलनेत स्पष्टपणे मंद माहिती प्रक्रिया किंवा शिकण्याचा वेग" },
    { id:"SLD41",domain:"SLD",  seq:22,
      en:"Has difficulty with fine motor tasks, quality of handwriting, or hand-eye coordination in daily activities",
      hi:"दैनिक गतिविधियों में बारीक मोटर काम, लिखावट की गुणवत्ता, या हाथ-आँख तालमेल में कठिनाई",
      mr:"दैनंदिन क्रियांमध्ये बारीक मोटर काम, लेखनाची गुणवत्ता किंवा हात-डोळा समन्वयात अडचण" },
    { id:"ANX62",domain:"ANX",  seq:23,
      en:"Experiences physical symptoms of anxiety: palpitations, nausea, breathlessness, trembling, or persistent restlessness",
      hi:"चिंता के शारीरिक लक्षण अनुभव करता है: धड़कन, जी मचलाना, सांस फूलना, कांपना, या लगातार बेचैनी",
      mr:"चिंतेची शारीरिक लक्षणे अनुभवतो/अनुभवते: धडधडणे, मळमळ, श्वास लागणे, थरथरणे किंवा सतत अस्वस्थपणा" },
    { id:"ODD51",domain:"ODD",  seq:24,
      en:"Persistently argues with, refuses, or openly defies authority figures — parents, teachers, or employers",
      hi:"माता-पिता, शिक्षकों, या नियोक्ताओं जैसे अधिकार के प्रतीकों के साथ लगातार बहस करता है, मना करता है, या खुलकर अवज्ञा करता है",
      mr:"पालक, शिक्षक किंवा नियोक्ते यांसारख्या अधिकाऱ्यांशी सतत वाद घालतो/घालते, नकार देतो/देते किंवा उघडपणे अवज्ञा करतो/करते" },
    { id:"CD53", domain:"CD",   seq:25,
      en:"Engages in deliberate rule-breaking, dishonesty, aggression, or behaviour that seriously harms others",
      hi:"जानबूझकर नियम तोड़ना, बेईमानी, आक्रामकता, या दूसरों को गंभीर नुकसान पहुंचाने वाले व्यवहार में शामिल है",
      mr:"जाणूनबुजून नियम मोडणे, अप्रामाणिकता, आक्रमकता किंवा इतरांना गंभीरपणे दुखवणाऱ्या वर्तनात सहभागी होतो/होते" },
    { id:"CD55", domain:"CD",   seq:26,
      en:"Shows bullying, intimidation, or aggression — disregard for others' safety, wellbeing, or rights",
      hi:"दूसरों की सुरक्षा, भलाई, या अधिकारों की अनदेखी करते हुए धमकाना, डराना, या आक्रामकता दिखाता है",
      mr:"इतरांची सुरक्षितता, कल्याण किंवा हक्कांकडे दुर्लक्ष करून दादागिरी, धमकावणे किंवा आक्रमकता दाखवतो/दाखवते" },
  ],
};

const LIKERT = [
  { v:0, en:"Not True",        hi:"सच नहीं",    mr:"खरे नाही",     bg:"#dcfce7", border:"#86efac", text:"#166534" },
  { v:1, en:"Rarely True",     hi:"शायद ही",    mr:"क्वचितच",      bg:"#fef9c3", border:"#fde047", text:"#854d0e" },
  { v:2, en:"Sometimes True",  hi:"कभी-कभी",    mr:"कधी-कधी",      bg:"#ffedd5", border:"#fdba74", text:"#9a3412" },
  { v:3, en:"Mostly True",     hi:"अक्सर सच",   mr:"बहुतेक खरे",   bg:"#fee2e2", border:"#fca5a5", text:"#991b1b" },
  { v:4, en:"Absolutely True", hi:"बिल्कुल सच", mr:"पूर्णपणे खरे", bg:"#fecaca", border:"#ef4444", text:"#7f1d1d" },
];

// Evidence-based cutoffs from CIBS dataset (Normal N=55, Clinical N=281)
const DCFG = {
  IDD:  { items:["CI2","CI3","SI6","SI7","PI10","PI11","PI12"], max:28, color:"#7c3aed", atRisk:7,  prob:12, sev:18, dsm5:"Intellectual Disability",                   icd11:"6A00" },
  ADHD: { items:["ADD27","ADD29","ADD31","ADD33"],               max:16, color:"#2563eb", atRisk:5,  prob:8,  sev:12, dsm5:"ADHD",                                       icd11:"6A05" },
  ASD:  { items:["ASD14","ASD18","ASD21","ASD25"],               max:16, color:"#0891b2", atRisk:4,  prob:7,  sev:12, dsm5:"Autism Spectrum Disorder",                   icd11:"6A02" },
  SLD:  { items:["SLD34","SLD37","SLD41"],                       max:12, color:"#0d9488", atRisk:3,  prob:6,  sev:9,  dsm5:"Specific Learning Disorder",                 icd11:"6A03" },
  MDD:  { items:["MDD44","MDD46"],                               max:8,  color:"#dc2626", atRisk:4,  prob:5,  sev:7,  dsm5:"Major Depressive Disorder",                  icd11:"6A70" },
  ANX:  { items:["ANX49","ANX60","ANX62"],                       max:12, color:"#ea580c", atRisk:3,  prob:5,  sev:9,  dsm5:"Generalised / Social / Separation Anxiety",   icd11:"6B00" },
  ODD:  { items:["ODD51"],                                       max:4,  color:"#b45309", atRisk:3,  prob:4,  sev:4,  dsm5:"Oppositional Defiant Disorder",               icd11:"6C90" },
  CD:   { items:["CD53","CD55"],                                 max:8,  color:"#9f1239", atRisk:4,  prob:6,  sev:7,  dsm5:"Conduct Disorder",                            icd11:"6C91" },
};

const SM = [
  { id:"sm1", en:"Has your child talked about wanting to hurt themselves?",              hi:"क्या बच्चे ने खुद को नुकसान पहुंचाने की बात की है?",            mr:"मुलाने स्वतःला इजा करण्याबद्दल बोलले का?" },
  { id:"sm2", en:"Has your child said they wish they were dead or not alive?",           hi:"क्या बच्चे ने मरना चाहने की बात की है?",                         mr:"मुलाने मरण्याची इच्छा बोलून दाखवली का?" },
  { id:"sm3", en:"Any attempt to hurt themselves intentionally?",                        hi:"क्या बच्चे ने जानबूझकर खुद को नुकसान पहुंचाने की कोशिश की?",   mr:"मुलाने जाणूनबुजून स्वतःला दुखवण्याचा प्रयत्न केला का?" },
  { id:"sm4", en:"Have they mentioned how they would hurt themselves?",                  hi:"क्या उन्होंने बताया कि वह खुद को कैसे नुकसान पहुंचाएंगे?",       mr:"त्यांनी स्वतःला कसे दुखवणार हे सांगितले का?" },
  { id:"sm5", en:"Does your child have access to medicines, sharp objects, or poisons?", hi:"क्या बच्चे के पास दवाइयाँ, धारदार वस्तुएं या ज़हर तक पहुँच है?", mr:"मुलाकडे औषधे, धारदार वस्तू किंवा विष मिळण्याचा मार्ग आहे का?" },
  { id:"sm6", en:"Are caregivers aware and able to provide close monitoring?",           hi:"क्या देखभालकर्ता निकट निगरानी कर सकते हैं?",                    mr:"काळजीवाहू जागरूक आहेत आणि जवळून देखरेख करू शकतात का?" },
];

// ════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ════════════════════════════════════════════════════════════════
function getSeverity(total, cfg) {
  if (total < cfg.atRisk) return "Normal";
  if (total < cfg.prob)   return "Mild";
  if (total < cfg.sev)    return "Moderate";
  return "Severe";
}
function computeScores(bx) {
  const s = {};
  for (const [d, c] of Object.entries(DCFG)) {
    const total = c.items.reduce((a, id) => a + (Number(bx[id]) || 0), 0);
    s[d] = { total, sev:getSeverity(total,c), pct:Math.round((total/c.max)*100), max:c.max, color:c.color,
             atRiskPct:Math.round((c.atRisk/c.max)*100), probPct:Math.round((c.prob/c.max)*100) };
  }
  return s;
}
function getRiskLevel(s, t) {
  const aff = Object.entries(s).filter(([,x]) => x.sev !== "Normal");
  const n = aff.length, dn = aff.map(([d]) => d);
  if (n===0) return { lv:0, label:"Normal Development",        tag:"NORMAL",  color:"#16a34a", bg:"#dcfce7", border:"#86efac", action:t.riskActions[0], domains:[] };
  if (n===1) return { lv:1, label:"Mild Risk — Monitor",       tag:"LEVEL 1", color:"#65a30d", bg:"#f7fee7", border:"#bef264", action:t.riskActions[1], domains:dn };
  if (n===2) return { lv:2, label:"Moderate Risk — Refer",     tag:"LEVEL 2", color:"#d97706", bg:"#fffbeb", border:"#fcd34d", action:t.riskActions[2], domains:dn };
  return           { lv:3, label:"High Risk — Urgent",         tag:"LEVEL 3", color:"#dc2626", bg:"#fef2f2", border:"#fca5a5", action:t.riskActions[3], domains:dn };
}
function getSuicideFlag(s) {
  return s.ADHD?.sev!=="Normal" && (s.MDD?.total||0)>=4 &&
    (s.ODD?.sev==="Moderate"||s.ODD?.sev==="Severe"||s.CD?.sev==="Moderate"||s.CD?.sev==="Severe");
}
function getPeriRisk(p) {
  const n = Object.values(p).filter(v=>v==="yes").length;
  if (n===0) return { n, level:"None",     color:"#16a34a", bg:"#dcfce7" };
  if (n<=2)  return { n, level:"Low",      color:"#65a30d", bg:"#f7fee7" };
  if (n<=5)  return { n, level:"Moderate", color:"#d97706", bg:"#fffbeb" };
  return      { n, level:"High",    color:"#dc2626", bg:"#fef2f2" };
}
function getFutureRisks(s, rl, sf) {
  const cdP = s.CD?.sev==="Moderate"||s.CD?.sev==="Severe";
  const oddP = s.ODD?.sev==="Moderate"||s.ODD?.sev==="Severe";
  const mddAR = s.MDD?.sev!=="Normal";
  return [
    { label:"Deliberate Self-Harm (DSH)",           icon:"🔪", up: sf||(mddAR&&oddP) },
    { label:"Suicidal Behaviour",                    icon:"⚡", up: sf },
    { label:"Delinquency",                           icon:"⚖️", up: cdP&&oddP },
    { label:"Conduct Problems",                      icon:"🔥", up: cdP||oddP },
    { label:"Substance Use Disorder (future risk)",  icon:"💊", up: rl.lv>=3&&cdP },
  ];
}

// ════════════════════════════════════════════════════════════════
// CSV EXPORT
// ════════════════════════════════════════════════════════════════
function makeCSV(ci, ageInfo, p, bx, S, RL, SF, sm) {
  const ts = new Date().toISOString();
  const hP = PERINATAL.map(i=>`P${i.id}`).join(",");
  const hB = BXITEMS.pri.map(i=>i.id).join(",");  // IDs are same across groups
  const hD = Object.keys(DCFG).map(d=>`${d}_score,${d}_sev`).join(",");
  const hS = SM.map(i=>i.id).join(",");
  const header = `Timestamp,AgeGroup,AgYears,FileNo,RegNo,Name,DOB,Age,Gender,School,Examiner,Informant,Relation,${hP},${hB},${hD},RiskTag,SuicideFlag,${hS}`;
  const rP = PERINATAL.map(i=>p[i.id]||"").join(",");
  const rB = BXITEMS.pri.map(i=>bx[i.id]??"").join(",");
  const rD = Object.entries(S).map(([,x])=>`${x.total},${x.sev}`).join(",");
  const rS = SM.map(i=>sm[i.id]?"YES":"NO").join(",");
  const ageYrs = ageInfo.age ? ageInfo.age.toFixed(1) : "";
  const row = [ts,ageInfo.group,ageYrs,ci.fileNo,ci.regNo,ci.name,ci.dob,ci.age,ci.gender,ci.school,ci.examiner,ci.informantName,ci.relation,rP,rB,rD,RL.tag,SF?"FLAGGED":"Clear",rS].join(",");
  const blob = new Blob([header+"\n"+row],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`eSMART_P_${ci.fileNo||"rec"}_${ts.slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════
// BAR CHART
// ════════════════════════════════════════════════════════════════
// ── CIBS DATABANK SUBMISSION ────────────────────────────────────────────────
function submitToDatabank_P(ci, ageInfo, p, bx, S, RL, SF, sm) {
  if (!ci.fileNo) return false;
  const data = {
    source: "eSMART-P",
    fileNo: ci.fileNo,
    timestamp: new Date().toISOString(),
    childInfo: ci,
    ageGroup: ageInfo.group,
    ageYrs: ageInfo.age,
    perinatal: p,
    behaviourItems: bx,
    domainScores: Object.fromEntries(
      Object.entries(S).map(([d,v])=>[d,{total:v.total,sev:v.sev,pct:v.pct}])
    ),
    riskLevel: { tag:RL.tag, lv:RL.lv, label:RL.label },
    suicideFlag: SF,
    safetyModule: sm,
  };
  try {
    localStorage.setItem(`CIBS_PENDING_P_${ci.fileNo}`, JSON.stringify(data));
    return true;
  } catch(e) { return false; }
}


function BarChart({s,t}) {
  const doms=Object.entries(DCFG), W=680,H=310,PL=44,PB=62,PT=28,PR=16;
  const cW=W-PL-PR, cH=H-PT-PB, bW=Math.floor(cW/doms.length)-10, gap=Math.floor(cW/doms.length);
  const sevCol={Normal:"#86efac",Mild:"#fde047",Moderate:"#fb923c",Severe:"#f87171"};
  return (
    <div style={{overflowX:"auto"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}>
        {[0,25,50,75,100].map(pct=>{const y=PT+cH-(pct/100)*cH; return <g key={pct}><line x1={PL} y1={y} x2={PL+cW} y2={y} stroke="#f1f5f9" strokeWidth={1}/><text x={PL-4} y={y+4} fontSize={10} textAnchor="end" fill="#94a3b8">{pct}%</text></g>;})}
        <line x1={PL} y1={PT+cH-(4/100)*cH} x2={PL+cW} y2={PT+cH-(4/100)*cH} stroke="#16a34a" strokeWidth={2} strokeDasharray="6 4"/>
        <text x={PL+cW+4} y={PT+cH-(4/100)*cH+4} fontSize={9} fill="#16a34a">NM</text>
        {doms.map(([d,c],i)=>{
          const sc=s[d]; const bH=(sc.pct/100)*cH; const x=PL+i*gap+(gap-bW)/2; const y=PT+cH-bH;
          const arY=PT+cH-(sc.atRiskPct/100)*cH; const prY=PT+cH-(sc.probPct/100)*cH;
          return <g key={d}>
            <line x1={x} y1={arY} x2={x+bW} y2={arY} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2"/>
            <line x1={x} y1={prY} x2={x+bW} y2={prY} stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 2"/>
            <rect x={x} y={Math.min(y,PT+cH-2)} width={bW} height={Math.max(bH,2)} rx={4} fill={c.color} opacity={0.82}/>
            <rect x={x} y={PT+cH} width={bW} height={6} rx={2} fill={sevCol[sc.sev]}/>
            {sc.pct>8 && <text x={x+bW/2} y={y-5} fontSize={10} textAnchor="middle" fill={c.color} fontWeight="700">{sc.pct}%</text>}
            <text x={x+bW/2} y={PT+cH+20} fontSize={11} textAnchor="middle" fill="#374151" fontWeight="700">{d}</text>
            <text x={x+bW/2} y={PT+cH+34} fontSize={8} textAnchor="middle" fill="#6b7280">{sc.sev}</text>
          </g>;
        })}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke="#cbd5e1" strokeWidth={1.5}/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke="#cbd5e1" strokeWidth={1.5}/>
        {[{l:t.normalMedian,c:"#16a34a",d:"6 4"},{l:t.atRiskLine,c:"#fbbf24",d:"3 2"},{l:t.probableLine,c:"#f97316",d:"3 2"}].map((leg,i)=>(
          <g key={leg.l} transform={`translate(${PL+i*170},${H-12})`}><line x1={0} y1={-4} x2={20} y2={-4} stroke={leg.c} strokeWidth={1.5} strokeDasharray={leg.d}/><text x={24} y={0} fontSize={9} fill="#6b7280">{leg.l}</text></g>
        ))}
        {[{l:"Normal",c:"#86efac"},{l:"Mild",c:"#fde047"},{l:"Moderate",c:"#fb923c"},{l:"Severe",c:"#f87171"}].map((sv,i)=>(
          <g key={sv.l} transform={`translate(${PL+i*95},${H-28})`}><rect x={0} y={-8} width={12} height={8} rx={2} fill={sv.c}/><text x={16} y={0} fontSize={9} fill="#6b7280">{sv.l}</text></g>
        ))}
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PROGRESS BAR
// ════════════════════════════════════════════════════════════════
function PBar({step,steps}) {
  return (
    <div style={{padding:"0 24px 24px"}}>
      <div style={{display:"flex",alignItems:"center"}}>
        {steps.map((lbl,i)=>{
          const n=i+1,done=step>n,active=step===n;
          return <div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?"#0d9488":active?"#fff":"rgba(255,255,255,0.12)",border:active?"2px solid #fff":done?"none":"2px solid rgba(255,255,255,0.25)",color:done?"#fff":active?"#0d5c6e":"rgba(255,255,255,0.45)",fontWeight:700,fontSize:12}}>
                {done?"✓":n}
              </div>
              <span style={{fontSize:9,color:active?"#fff":done?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.35)",fontWeight:active?700:400,whiteSpace:"nowrap"}}>{lbl}</span>
            </div>
            {i<steps.length-1&&<div style={{flex:1,height:2,background:done?"#0d9488":"rgba(255,255,255,0.18)",margin:"0 6px",marginBottom:20}}/>}
          </div>;
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// INSTRUCTION LETTERS — per role, per language
// Role: "informant" (parent/caregiver) | "clinician"
// ════════════════════════════════════════════════════════════════
const LETTERS = {
  informant: {
    en: {
      heading: "Dear Parent / Caregiver",
      from:    "Dr. Shailesh Pangaonkar, Director and Consultant Psychiatrist\nCentral Institute of Behavioural Sciences (CIBS), Nagpur",
      body: [
        "Thank you for taking the time to fill in this questionnaire. Your honest responses will help us understand your child better and identify any areas where additional support may be beneficial.",
        "eSMART-P is a carefully developed screening questionnaire for children aged 3 to 18 years. It consists of a short set of questions about your child's development, behaviour, emotions, and daily functioning. The questions are based on internationally recognised criteria (DSM-5 and ICD-11) and have been validated on thousands of children in Central India.",
        "This questionnaire is NOT a diagnosis. It is a screening tool — like a thermometer that tells you there may be a fever, not what the illness is. The results will be reviewed by a trained clinician who will discuss the findings with you.",
        "Please answer every question as honestly as possible based on what you have observed over the past 6 months. If a question does not apply, you may mark 'Not True'. There are no right or wrong answers.",
        "All information you provide is strictly confidential and will be used only for the purpose of supporting your child's wellbeing.",
      ],
      closing: "With warm regards and best wishes for your child's health.",
    },
    hi: {
      heading: "प्रिय माता-पिता / देखभालकर्ता",
      from:    "डॉ. शैलेश पानगावकर, निदेशक एवं परामर्शी मनोचिकित्सक\nकेंद्रीय व्यावहारिक विज्ञान संस्थान (CIBS), नागपुर",
      body: [
        "इस प्रश्नावली को भरने का समय निकालने के लिए आपका हृदय से धन्यवाद। आपके ईमानदार उत्तर हमें आपके बच्चे को बेहतर समझने और उन क्षेत्रों की पहचान करने में मदद करेंगे जहाँ अतिरिक्त सहायता की आवश्यकता हो सकती है।",
        "eSMART-P 3 से 18 वर्ष की आयु के बच्चों के लिए एक सावधानीपूर्वक विकसित जांच प्रश्नावली है। इसमें आपके बच्चे के विकास, व्यवहार, भावनाओं और दैनिक कार्यप्रणाली के बारे में प्रश्नों का एक छोटा समूह शामिल है। ये प्रश्न अंतरराष्ट्रीय स्तर पर मान्यता प्राप्त मानदंडों (DSM-5 और ICD-11) पर आधारित हैं।",
        "यह प्रश्नावली कोई निदान (Diagnosis) नहीं है। यह एक जांच उपकरण है — जैसे थर्मामीटर बुखार की संभावना बताता है, बीमारी का नाम नहीं। परिणामों की समीक्षा एक प्रशिक्षित चिकित्सक करेंगे।",
        "कृपया पिछले 6 महीनों में आपने जो देखा है उसके आधार पर हर सवाल का ईमानदारी से जवाब दें। यदि कोई प्रश्न लागू नहीं होता, तो 'सच नहीं' चुनें। सही या गलत उत्तर जैसा कुछ नहीं है।",
        "आपके द्वारा प्रदान की गई सभी जानकारी पूर्णतः गोपनीय है।",
      ],
      closing: "आपके बच्चे के स्वास्थ्य के लिए शुभकामनाओं सहित।",
    },
    mr: {
      heading: "प्रिय पालक / काळजीवाहू",
      from:    "डॉ. शैलेश पानगावकर, संचालक व सल्लागार मनोचिकित्सक\nकेंद्रीय वर्तणूक विज्ञान संस्था (CIBS), नागपूर",
      body: [
        "ही प्रश्नावली भरण्यासाठी वेळ काढल्याबद्दल आपले मनःपूर्वक आभार. आपल्या प्रामाणिक उत्तरांमुळे आम्हाला आपल्या मुलाला अधिक चांगल्या प्रकारे समजून घेण्यास आणि अतिरिक्त मदतीची आवश्यकता असलेल्या क्षेत्रांची ओळख करण्यात मदत होईल.",
        "eSMART-P ही 3 ते 18 वर्षे वयाच्या मुलांसाठी काळजीपूर्वक विकसित केलेली तपासणी प्रश्नावली आहे. यात आपल्या मुलाच्या विकास, वर्तन, भावना आणि दैनंदिन कार्यक्षमतेबद्दल प्रश्न आहेत. हे प्रश्न आंतरराष्ट्रीय निकषांवर (DSM-5 आणि ICD-11) आधारित आहेत.",
        "ही प्रश्नावली म्हणजे निदान नव्हे. हे तपासणी साधन आहे — जसे थर्मामीटर ताप आहे का ते सांगतो, आजार काय आहे ते नाही. निकालांचा आढावा प्रशिक्षित वैद्यकांद्वारे घेतला जाईल.",
        "कृपया गेल्या 6 महिन्यांत आपण जे पाहिले त्यावर आधारित प्रत्येक प्रश्नाचे प्रामाणिकपणे उत्तर द्या. प्रश्न लागू नसल्यास 'खरे नाही' निवडा. बरोबर किंवा चुकीची उत्तरे नाहीत.",
        "आपण दिलेली सर्व माहिती पूर्णपणे गोपनीय राहील.",
      ],
      closing: "आपल्या मुलाच्या आरोग्यासाठी शुभेच्छांसह.",
    },
  },
  clinician: {
    en: {
      heading: "Dear Clinician / Researcher / School Counsellor",
      from:    "Dr. Shailesh Pangaonkar, Director and Consultant Psychiatrist\nCentral Institute of Behavioural Sciences (CIBS), Nagpur",
      body: [
        "Welcome to eSMART-P — the Parent/Caregiver Module of the CIBS Integrated Assessment Platform. This tool is designed for use in clinical, school, and community settings to facilitate early identification of neurodevelopmental, emotional, and behavioural difficulties in children and adolescents aged 3–18 years.",
        "The questionnaire employs a validated 26-item short form (item selection based on ROC analysis, AUC > 0.65, Cronbach's α = 0.78–0.91) covering eight diagnostic domains: Intellectual Developmental Disorder (IDD), ADHD, Autism Spectrum Disorder (ASD), Specific Learning Disorder (SLD), Major Depressive Disorder (MDD), Anxiety Disorders (ANX), Oppositional Defiant Disorder (ODD), and Conduct Disorder (CD).",
        "Domain thresholds are evidence-based, derived from a normative sample of N=55 and a clinical sample of N=281 from CIBS Nagpur. Severity classification (Normal / Mild / Moderate / Severe) is based on normal 90th percentile and clinical 75th percentile cut-points. The Suicide/Self-Harm risk flag requires concurrent ADHD (Mild+) + MDD (Moderate+, ≥4) + ODD or CD (Moderate/Severe).",
        "Questions are automatically age-stratified into four groups (Pre-school <6, Primary 6–10, Secondary 11–15, Higher Secondary 16–18) to ensure developmental appropriateness without compromising psychometric properties.",
        "IMPORTANT: This is a SCREENING TOOL, not a diagnostic instrument. All risk flags must be followed up with a full clinical interview, collateral information, and standardised assessment. The tool supports — but does not replace — clinical judgement.",
        "All data submitted through this platform is stored securely in the CIBS research database and may contribute to ongoing standardisation, validation, and research publications.",
      ],
      closing: "Thank you for your contribution to evidence-based child mental health care in India.",
    },
    hi: {
      heading: "प्रिय चिकित्सक / शोधकर्ता / स्कूल परामर्शदाता",
      from:    "डॉ. शैलेश पानगावकर, निदेशक एवं परामर्शी मनोचिकित्सक\nकेंद्रीय व्यावहारिक विज्ञान संस्थान (CIBS), नागपुर",
      body: [
        "eSMART-P में आपका स्वागत है — CIBS एकीकृत मूल्यांकन मंच का माता-पिता/देखभालकर्ता मॉड्यूल। यह उपकरण 3–18 वर्ष के बच्चों और किशोरों में न्यूरोडेवलपमेंटल, भावनात्मक और व्यवहार संबंधी कठिनाइयों की प्रारंभिक पहचान के लिए डिज़ाइन किया गया है।",
        "प्रश्नावली एक मान्य 26-आइटम संक्षिप्त फॉर्म का उपयोग करती है (ROC विश्लेषण, AUC > 0.65, Cronbach's α = 0.78–0.91) जो आठ नैदानिक क्षेत्रों को कवर करती है: IDD, ADHD, ASD, SLD, MDD, ANX, ODD और CD।",
        "डोमेन थ्रेशोल्ड साक्ष्य-आधारित हैं, CIBS नागपुर के N=55 के सामान्य और N=281 के नैदानिक नमूने से प्राप्त किए गए हैं। गंभीरता वर्गीकरण (सामान्य/हल्का/मध्यम/गंभीर) 90वें प्रतिशत सामान्य और 75वें प्रतिशत नैदानिक कट-पॉइंट पर आधारित है।",
        "महत्वपूर्ण: यह एक जांच उपकरण है, नैदानिक उपकरण नहीं। सभी जोखिम संकेतों के बाद पूर्ण नैदानिक साक्षात्कार आवश्यक है।",
      ],
      closing: "भारत में साक्ष्य-आधारित बाल मानसिक स्वास्थ्य देखभाल में आपके योगदान के लिए धन्यवाद।",
    },
    mr: {
      heading: "प्रिय वैद्य / संशोधक / शाळा समुपदेशक",
      from:    "डॉ. शैलेश पानगावकर, संचालक व सल्लागार मनोचिकित्सक\nकेंद्रीय वर्तणूक विज्ञान संस्था (CIBS), नागपूर",
      body: [
        "eSMART-P मध्ये आपले स्वागत आहे — CIBS एकीकृत मूल्यांकन व्यासपीठाचे पालक/काळजीवाहू मॉड्यूल. हे साधन 3–18 वर्षे वयाच्या मुलांमध्ये न्यूरोडेव्हलपमेंटल, भावनिक आणि वर्तणुकीशी संबंधित अडचणींची लवकर ओळख करण्यासाठी डिझाइन केले आहे.",
        "प्रश्नावली एक प्रमाणित 26-आयटम संक्षिप्त फॉर्म वापरते (ROC विश्लेषण, AUC > 0.65, Cronbach's α = 0.78–0.91) जी आठ निदान क्षेत्रांचा समावेश करते: IDD, ADHD, ASD, SLD, MDD, ANX, ODD आणि CD.",
        "डोमेन उंबरठे पुरावा-आधारित आहेत, CIBS नागपूरच्या N=55 सामान्य आणि N=281 नैदानिक नमुन्यांमधून प्राप्त केले आहेत. तीव्रता वर्गीकरण (सामान्य/सौम्य/मध्यम/तीव्र) 90व्या सामान्य आणि 75व्या नैदानिक शतमान आधारावर आहे.",
        "महत्त्वाचे: हे तपासणी साधन आहे, निदान साधन नाही. सर्व जोखीम संकेतांनंतर पूर्ण नैदानिक मुलाखत आवश्यक आहे.",
      ],
      closing: "भारतातील पुरावा-आधारित बालमानसिक आरोग्य सेवेतील आपल्या योगदानाबद्दल आभार.",
    },
  },
};

const DISCLAIMER_TEXT = {
  en: {
    title: "Important Notice — Screening Tool Disclaimer",
    points: [
      "eSMART-P is a SCREENING TOOL designed to identify the probability of problems and risks in a child or adolescent. It is NOT a diagnostic instrument.",
      "Results from this tool suggest areas that may warrant further clinical investigation. They do not constitute a clinical diagnosis under DSM-5 or ICD-11.",
      "All risk flags generated by this tool — including the Suicide/Self-Harm flag — must be followed up with a full clinical interview by a qualified mental health professional.",
      "This tool supports therapists, counsellors, and clinicians in their decision-making. It does not replace professional clinical judgement.",
      "Data collected through this platform is stored securely and used solely for the purpose of supporting the subject's wellbeing and for research at CIBS, in accordance with ICMR ethical guidelines.",
      "By proceeding, you confirm that you have read and understood this notice.",
    ],
    agree: "I have read and understood the above. I wish to proceed.",
    proceed: "Proceed to Questionnaire →",
  },
  hi: {
    title: "महत्वपूर्ण सूचना — जांच उपकरण अस्वीकरण",
    points: [
      "eSMART-P एक जांच उपकरण है जो किसी बच्चे या किशोर में समस्याओं और जोखिमों की संभावना की पहचान करने के लिए डिज़ाइन किया गया है। यह कोई नैदानिक उपकरण (Diagnostic Tool) नहीं है।",
      "इस उपकरण के परिणाम उन क्षेत्रों का सुझाव देते हैं जिन पर आगे नैदानिक जांच की आवश्यकता हो सकती है। ये DSM-5 या ICD-11 के तहत कोई नैदानिक निदान नहीं हैं।",
      "इस उपकरण द्वारा उत्पन्न सभी जोखिम संकेतों — जिसमें आत्मघात/स्वयं-हानि संकेत भी शामिल है — के बाद एक योग्य मानसिक स्वास्थ्य पेशेवर द्वारा पूर्ण नैदानिक साक्षात्कार आवश्यक है।",
      "यह उपकरण चिकित्सकों के निर्णय में सहायता करता है। यह पेशेवर नैदानिक निर्णय का स्थान नहीं लेता।",
      "आगे बढ़कर आप पुष्टि करते हैं कि आपने यह सूचना पढ़ और समझ ली है।",
    ],
    agree: "मैंने उपरोक्त पढ़ और समझ लिया है। मैं आगे बढ़ना चाहता/चाहती हूँ।",
    proceed: "प्रश्नावली की ओर आगे बढ़ें →",
  },
  mr: {
    title: "महत्त्वाची सूचना — तपासणी साधन अस्वीकरण",
    points: [
      "eSMART-P हे एक तपासणी साधन आहे जे मुल किंवा किशोरवयीन व्यक्तीतील समस्या आणि जोखमींची शक्यता ओळखण्यासाठी डिझाइन केले आहे. हे निदान साधन (Diagnostic Tool) नाही.",
      "या साधनाचे निकाल अशा क्षेत्रांची सूचना देतात ज्यांना पुढील नैदानिक तपासणीची आवश्यकता असू शकते. हे DSM-5 किंवा ICD-11 अंतर्गत नैदानिक निदान नाही.",
      "या साधनाद्वारे निर्माण होणाऱ्या सर्व जोखीम संकेतांनंतर — आत्मघात/स्वयं-हानी संकेतासह — पात्र मानसिक आरोग्य व्यावसायिकाद्वारे पूर्ण नैदानिक मुलाखत आवश्यक आहे.",
      "हे साधन वैद्यांच्या निर्णयात मदत करते. हे व्यावसायिक नैदानिक निर्णयाची जागा घेत नाही.",
      "पुढे जाऊन आपण पुष्टी करतो की आपण ही सूचना वाचली आणि समजली आहे.",
    ],
    agree: "मी वरील वाचले आणि समजले आहे. मला पुढे जायचे आहे.",
    proceed: "प्रश्नावलीकडे पुढे जा →",
  },
};

// ════════════════════════════════════════════════════════════════
// SHARE UTILITIES
// ════════════════════════════════════════════════════════════════
function shareVia(method, childName, lang) {
  const url  = window.location.href.split("?")[0];
  const msgs = {
    en: `CIBS eSMART-P — Child Behavioural Screening${childName ? " for " + childName : ""}.\nPlease open this link to fill in the questionnaire:\n${url}`,
    hi: `CIBS eSMART-P — बाल व्यवहार जांच${childName ? " — " + childName : ""}।\nकृपया प्रश्नावली भरने के लिए यह लिंक खोलें:\n${url}`,
    mr: `CIBS eSMART-P — बालक वर्तन तपासणी${childName ? " — " + childName : ""}.\nकृपया प्रश्नावली भरण्यासाठी हा दुवा उघडा:\n${url}`,
  };
  const msg = msgs[lang] || msgs.en;
  const enc = encodeURIComponent(msg);
  if (method === "whatsapp") window.open(`https://wa.me/?text=${enc}`, "_blank");
  if (method === "email")    window.open(`mailto:?subject=eSMART-P Questionnaire&body=${enc}`, "_blank");
  if (method === "sms")      window.open(`sms:?body=${enc}`, "_blank");
  if (method === "copy") {
    navigator.clipboard.writeText(`${msg}`).then(() => alert("Link and message copied to clipboard!")).catch(() => alert("Please copy manually: " + url));
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  componentDidCatch(error) { this.setState({ error: error.toString() }); }
  render() {
    if (this.state.error) return (
      <div style={{padding:20,background:"#fef2f2",minHeight:"100vh",fontFamily:"monospace"}}>
        <h2 style={{color:"#dc2626"}}>Error — please send this to Dev:</h2>
        <pre style={{whiteSpace:"pre-wrap",fontSize:12,color:"#991b1b"}}>{this.state.error}</pre>
      </div>
    );
    return this.props.children;
  }
}

function AppInner() {
  const [lang,   setLang]   = useState(null);
  const [screen, setScreen] = useState("lang"); // "lang" | "role" | "letter" | "disclaimer" | "form"
  const [role,   setRole]   = useState(null);   // "informant" | "clinician"
  const [agreed, setAgreed] = useState(false);
  const [step,   setStep]   = useState(1);
  const [ci,    setCi]    = useState({ name:"",age:"",gender:"",fileNo:getURLParam("reg")||"",regNo:"",school:"",examiner:getURLParam("assessor")||"",date:new Date().toISOString().slice(0,10),dob:"",informantName:"",relation:"",mobile:"" });
  const [p,     setP]     = useState({});
  const [bx,    setBx]    = useState({});
  const [sm,    setSm]    = useState({});
  const [smEx,  setSmEx]  = useState(false);
  const [tab,   setTab]   = useState("parent");
  const [shUrl, setShUrl] = useState("");
  const [shSt,  setShSt]  = useState("");
  const [dbSubmitted, setDbSubmitted] = useState(false);

  const t       = lang ? T[lang] : T.en;
  const gl      = (item) => (lang && item[lang]) ? item[lang] : item.en;
  const gll     = (opt)  => lang==="hi"?opt.hi : lang==="mr"?opt.mr : opt.en;

  // Auto-detect age group from DOB or age field
  const ageInfo = useMemo(() => detectAgeGroup(ci), [ci.dob, ci.age]);
  const items   = BXITEMS[ageInfo.group];
  const badge   = GROUP_BADGE[ageInfo.group];

  const updCi  = (k,v) => setCi(x=>({...x,[k]:v}));
  const updP   = (id,v) => setP(x=>({...x,[id]:v}));
  const updBx  = (id,v) => setBx(x=>({...x,[id]:v}));
  const updSm  = (id,v) => setSm(x=>({...x,[id]:v}));

  const S   = computeScores(bx);
  const RL  = getRiskLevel(S, t);
  const SF  = getSuicideFlag(S);

  // Auto-submit to databank when report is viewed (step >= reportStep)
  const [autoSent, setAutoSent] = useState(false);
  useEffect(() => {
    if (step >= 7 && !autoSent && APPS_SCRIPT_URL && !APPS_SCRIPT_URL.startsWith("PASTE_")
        && S && RL && typeof getSuicideFlag === "function") {
      setAutoSent(true);
      const fileNo = (ci.fileNo || autoFileNo()).trim();
      fetch(APPS_SCRIPT_URL, { method:"POST", mode:"no-cors", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          tool:"eSMART-P", timestamp:new Date().toISOString(), mode: role||"informant",
          fileNo, uid:"", name:ci.examiner||"", dob:"", age:"", gender:"",
          mobile:ci.mobile||"", education:"", occupation:ci.informantOccupation||"",
          referral:"", assessor:ci.examiner||"", notes:"",
          child_name:ci.name||"", child_dob:ci.dob||"", child_age:ci.age||"",
          child_gender:ci.gender||"", school:ci.school||"", grade:ci.grade||"",
          parent_name:ci.informantName||"", relationship_to_child:ci.relation||"",
          informant_occupation:ci.informantOccupation||"",
          age_band:ageInfo.group||"",
          total_score:Object.values(S).reduce((a,v)=>a+(v.total||0),0)||"",
          percentile:"", risk_level:RL.tag||"", risk_label:RL.label||"",
          suicide_flag:getSuicideFlag(S)?"FLAGGED":"Clear",
          idd_score:S.IDD?.total||"", idd_sev:S.IDD?.sev||"",
          adhd_score:S.ADHD?.total||"", adhd_sev:S.ADHD?.sev||"",
          asd_score:S.ASD?.total||"", asd_sev:S.ASD?.sev||"",
          sld_score:S.SLD?.total||"", sld_sev:S.SLD?.sev||"",
          mdd_score:S.MDD?.total||"", mdd_sev:S.MDD?.sev||"",
          anx_score:S.ANX?.total||"", anx_sev:S.ANX?.sev||"",
          odd_score:S.ODD?.total||"", odd_sev:S.ODD?.sev||"",
          cd_score:S.CD?.total||"", cd_sev:S.CD?.sev||"",
        })
      }).catch(()=>{});
    }
  }, [step]);
  const PR  = getPeriRisk(p);
  const FR  = getFutureRisks(S, RL, SF);
  const ANS = Array.isArray(items) ? items.filter(i => bx[i.id] !== undefined).length : 0;
  const AFF = S ? Object.entries(S).filter(([,x]) => x.sev !== "Normal") : [];
  const SPO = Object.values(sm).some(v => v === true);

  const sevC = {Normal:"#16a34a",Mild:"#65a30d",Moderate:"#d97706",Severe:"#dc2626"};
  const sevB = {Normal:"#dcfce7",Mild:"#f7fee7",Moderate:"#fffbeb",Severe:"#fef2f2"};

  function reset() {
    setStep(1); setScreen("lang"); setLang(null); setRole(null); setAgreed(false);
    setCi({name:"",age:"",gender:"",fileNo:"",regNo:"",school:"",examiner:"",date:new Date().toISOString().slice(0,10),dob:"",informantName:"",relation:""});
    setP({}); setBx({}); setSm({}); setSmEx(false); setTab("parent");
  }

  function sendSheets() {
    const url = APPS_SCRIPT_URL;
    if (!url || url.startsWith("PASTE_")) { setShSt("⚠️ Apps Script URL not configured."); return; }
    const fileNo = (ci.fileNo || autoFileNo()).trim();
    setShSt("⏳ Sending...");
    fetch(url, { method:"POST", mode:"no-cors", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        tool:"eSMART-P", timestamp:new Date().toISOString(), mode: role||"informant",
        fileNo, uid:"", name:ci.examiner||"", dob:"", age:"", gender:"",
        mobile:ci.mobile||"", education:"", occupation:ci.informantOccupation||"",
        referral:"", assessor:ci.examiner||"", notes:"",
        // Child info
        child_name:ci.name||"", child_dob:ci.dob||"", child_age:ci.age||"",
        child_gender:ci.gender||"", school:ci.school||"", grade:ci.grade||"",
        // Informant info
        parent_name:ci.informantName||"", relationship_to_child:ci.relation||"",
        informant_occupation:ci.informantOccupation||"",
        // Age band & risk
        age_band:ageInfo.group||"",
        total_score:Object.values(S).reduce((a,v)=>a+(v.total||0),0)||"",
        percentile:"",
        risk_level:RL.tag||"", risk_label:RL.label||"",
        suicide_flag:getSuicideFlag(S)?"FLAGGED":"Clear",
        // Domain scores — DSM-5 aligned
        idd_score:S.IDD?.total||"", idd_sev:S.IDD?.sev||"",
        adhd_score:S.ADHD?.total||"", adhd_sev:S.ADHD?.sev||"",
        asd_score:S.ASD?.total||"", asd_sev:S.ASD?.sev||"",
        sld_score:S.SLD?.total||"", sld_sev:S.SLD?.sev||"",
        mdd_score:S.MDD?.total||"", mdd_sev:S.MDD?.sev||"",
        anx_score:S.ANX?.total||"", anx_sev:S.ANX?.sev||"",
        odd_score:S.ODD?.total||"", odd_sev:S.ODD?.sev||"",
        cd_score:S.CD?.total||"", cd_sev:S.CD?.sev||"",
      })
    }).then(()=>setShSt("✅ Sent to Google Sheets!")).catch(()=>setShSt("❌ Failed. Check URL."));
  }

  // fields rendered inline below

  const btn = (lbl,fn,col="#0d5c6e",disabled=false) => (
    <button onClick={fn} disabled={disabled} style={{padding:"11px 28px",borderRadius:9,background:disabled?"#e2e8f0":col,color:disabled?"#94a3b8":"#fff",border:"none",fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer"}}>{lbl}</button>
  );

  // ── SCREEN: LANGUAGE SELECTION ───────────────────────────
  if (screen === "lang" || !lang) return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"linear-gradient(135deg,#0d3b47,#0d9488)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,maxWidth:460,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
        <div style={{width:72,height:72,borderRadius:16,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
            <rect width="72" height="72" rx="14" fill="#0d5c6e"/>
            <circle cx="36" cy="22" r="5.5" fill="#5DCAA5"/>
            <circle cx="22" cy="32" r="4" fill="#9FE1CB"/>
            <circle cx="50" cy="32" r="4" fill="#9FE1CB"/>
            <circle cx="28" cy="46" r="5" fill="#1D9E75"/>
            <circle cx="44" cy="46" r="5" fill="#1D9E75"/>
            <line x1="36" y1="27" x2="22" y2="32" stroke="#9FE1CB" strokeWidth="1.2" opacity="0.8"/>
            <line x1="36" y1="27" x2="50" y2="32" stroke="#9FE1CB" strokeWidth="1.2" opacity="0.8"/>
            <line x1="22" y1="36" x2="28" y2="46" stroke="#5DCAA5" strokeWidth="1.2" opacity="0.7"/>
            <line x1="50" y1="36" x2="44" y2="46" stroke="#5DCAA5" strokeWidth="1.2" opacity="0.7"/>
            <line x1="22" y1="36" x2="44" y2="46" stroke="#9FE1CB" strokeWidth="0.8" opacity="0.3"/>
            <line x1="50" y1="36" x2="28" y2="46" stroke="#9FE1CB" strokeWidth="0.8" opacity="0.3"/>
            <text x="36" y="63" fontFamily="'Segoe UI',system-ui,sans-serif" fontSize="10" fontWeight="800" fill="#E1F5EE" textAnchor="middle" letterSpacing="1.5">CIBS</text>
          </svg>
        </div>
        <h1 style={{fontSize:26,fontWeight:900,color:"#0d3b47",margin:"0 0 4px"}}>eSMART-P</h1>
        <p style={{color:"#64748b",fontSize:13,margin:"0 0 4px"}}>Parent / Caregiver Screening Questionnaire</p>
        <p style={{color:"#94a3b8",fontSize:12,margin:"0 0 32px"}}>CIBS Nagpur · Dr. Shailesh Pangaonkar</p>
        <h2 style={{fontSize:15,fontWeight:700,color:"#374151",margin:"0 0 16px"}}>Choose Language / भाषा चुनें / भाषा निवडा</h2>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[{c:"en",l:"English",s:"Continue in English",f:"🇬🇧"},{c:"hi",l:"हिन्दी",s:"हिन्दी में जारी रखें",f:"🇮🇳"},{c:"mr",l:"मराठी",s:"मराठीत पुढे जा",f:"🟠"}].map(o=>(
            <button key={o.c} onClick={()=>{setLang(o.c);setScreen("role");}} style={{padding:"14px 20px",borderRadius:12,border:"2px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}
              onMouseOver={e=>{e.currentTarget.style.borderColor="#0d9488";e.currentTarget.style.background="#f0fdfa";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
              <span style={{fontSize:28}}>{o.f}</span>
              <div><div style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>{o.l}</div><div style={{fontSize:12,color:"#64748b"}}>{o.s}</div></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const ltr = (LETTERS[role] || LETTERS.informant)[lang] || LETTERS[role||"informant"].en;
  const dis = DISCLAIMER_TEXT[lang] || DISCLAIMER_TEXT.en;

  // ── SCREEN: ROLE SELECTION ────────────────────────────────
  if (screen === "role") return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"linear-gradient(135deg,#0d3b47,#0d9488)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"#0d3b47",margin:"0 0 6px"}}>🧠 eSMART-P</h2>
          <p style={{color:"#64748b",fontSize:13,margin:0}}>
            {lang==="hi" ? "आप इस प्रश्नावली को किस रूप में भर रहे हैं?" : lang==="mr" ? "आपण ही प्रश्नावली कोणत्या भूमिकेत भरत आहात?" : "Who is filling this questionnaire?"}
          </p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            { r:"informant", icon:"👨‍👩‍👧", en:"Parent / Caregiver / Guardian", hi:"माता-पिता / देखभालकर्ता / अभिभावक", mr:"पालक / काळजीवाहू / पालकत्व",
              sub_en:"I am the parent or primary caregiver of the child", sub_hi:"मैं बच्चे का माता-पिता या प्राथमिक देखभालकर्ता हूँ", sub_mr:"मी मुलाचा पालक किंवा प्राथमिक काळजीवाहू आहे" },
            { r:"clinician", icon:"🩺", en:"Clinician / Teacher / Researcher", hi:"चिकित्सक / शिक्षक / शोधकर्ता", mr:"वैद्य / शिक्षक / संशोधक",
              sub_en:"I am a health professional, teacher, or researcher", sub_hi:"मैं स्वास्थ्य पेशेवर, शिक्षक या शोधकर्ता हूँ", sub_mr:"मी आरोग्य व्यावसायिक, शिक्षक किंवा संशोधक आहे" },
          ].map(o=>(
            <button key={o.r} onClick={()=>{setRole(o.r);setScreen("letter");}} style={{padding:"18px 20px",borderRadius:12,border:"2px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",display:"flex",alignItems:"center",gap:16,textAlign:"left"}}
              onMouseOver={e=>{e.currentTarget.style.borderColor="#0d9488";e.currentTarget.style.background="#f0fdfa";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
              <span style={{fontSize:36}}>{o.icon}</span>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{lang==="hi"?o.hi:lang==="mr"?o.mr:o.en}</div>
                <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{lang==="hi"?o.sub_hi:lang==="mr"?o.sub_mr:o.sub_en}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={()=>setScreen("lang")} style={{marginTop:20,padding:"8px 16px",borderRadius:8,background:"#f1f5f9",color:"#64748b",border:"none",fontSize:12,cursor:"pointer",width:"100%"}}>
          ← {lang==="hi"?"भाषा बदलें":lang==="mr"?"भाषा बदला":"Change Language"}
        </button>
      </div>
    </div>
  );

  // ── SCREEN: INSTRUCTION LETTER ────────────────────────────
  if (screen === "letter") return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f0f4f8",minHeight:"100vh",padding:"24px 16px"}}>
      <div style={{maxWidth:680,margin:"0 auto"}}>
        {/* Letterhead */}
        <div style={{background:"linear-gradient(135deg,#0d5c6e,#0d9488)",borderRadius:"14px 14px 0 0",padding:"24px 32px",color:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <div style={{width:50,height:50,borderRadius:10,background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="13" r="4" fill="#5DCAA5"/>
                <circle cx="12" cy="20" r="3" fill="#9FE1CB"/>
                <circle cx="28" cy="20" r="3" fill="#9FE1CB"/>
                <circle cx="16" cy="30" r="3.5" fill="#1D9E75"/>
                <circle cx="24" cy="30" r="3.5" fill="#1D9E75"/>
                <line x1="20" y1="17" x2="12" y2="20" stroke="#9FE1CB" strokeWidth="1" opacity="0.9"/>
                <line x1="20" y1="17" x2="28" y2="20" stroke="#9FE1CB" strokeWidth="1" opacity="0.9"/>
                <line x1="12" y1="23" x2="16" y2="30" stroke="#5DCAA5" strokeWidth="1" opacity="0.8"/>
                <line x1="28" y1="23" x2="24" y2="30" stroke="#5DCAA5" strokeWidth="1" opacity="0.8"/>
                <line x1="12" y1="23" x2="24" y2="30" stroke="#9FE1CB" strokeWidth="0.7" opacity="0.35"/>
                <line x1="28" y1="23" x2="16" y2="30" stroke="#9FE1CB" strokeWidth="0.7" opacity="0.35"/>
              </svg>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:18,fontWeight:900}}>eSMART-P</h1>
              <p style={{margin:0,fontSize:11,opacity:0.75}}>Central Institute of Behavioural Sciences, Nagpur</p>
            </div>
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.25)",paddingTop:14}}>
            <h2 style={{margin:"0 0 4px",fontSize:16,fontWeight:700}}>{ltr.heading}</h2>
            <p style={{margin:0,fontSize:11,opacity:0.8,whiteSpace:"pre-line"}}>{ltr.from}</p>
          </div>
        </div>
        {/* Letter body */}
        <div style={{background:"#fff",padding:"28px 32px",borderLeft:"1px solid #e2e8f0",borderRight:"1px solid #e2e8f0",lineHeight:1.8}}>
          {ltr.body.map((para, i) => (
            <p key={i} style={{margin:"0 0 16px",fontSize:14,color:"#374151",lineHeight:1.8}}>{para}</p>
          ))}
          <p style={{margin:"24px 0 0",fontSize:14,color:"#374151",fontStyle:"italic"}}>{ltr.closing}</p>
          <div style={{marginTop:24,paddingTop:16,borderTop:"1px solid #f1f5f9"}}>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:"#0d5c6e"}}>Dr. Shailesh Pangaonkar</p>
            <p style={{margin:"2px 0 0",fontSize:12,color:"#64748b"}}>Director and Consultant Psychiatrist · CIBS Nagpur</p>
            <p style={{margin:"2px 0 0",fontSize:12,color:"#64748b"}}>MBBS, DPM, DNB, MSc BA</p>
          </div>
        </div>
        {/* Footer actions */}
        <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"0 0 14px 14px",padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={()=>setScreen("role")} style={{padding:"10px 20px",borderRadius:8,background:"#f1f5f9",color:"#64748b",border:"none",fontSize:13,cursor:"pointer"}}>← {lang==="hi"?"वापस":lang==="mr"?"मागे":"Back"}</button>
          <button onClick={()=>setScreen("disclaimer")} style={{padding:"12px 28px",borderRadius:10,background:"#0d5c6e",color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            {lang==="hi"?"आगे: अस्वीकरण →":lang==="mr"?"पुढे: अस्वीकरण →":"Next: Disclaimer →"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── SCREEN: DISCLAIMER ────────────────────────────────────
  if (screen === "disclaimer") return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f0f4f8",minHeight:"100vh",padding:"24px 16px",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{maxWidth:640,width:"100%",background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.1)"}}>
        {/* Header */}
        <div style={{background:"#fff7ed",borderBottom:"2px solid #fed7aa",padding:"20px 28px",display:"flex",gap:14,alignItems:"flex-start"}}>
          <span style={{fontSize:28,flexShrink:0}}>⚖️</span>
          <div>
            <h2 style={{margin:0,fontSize:16,fontWeight:800,color:"#9a3412"}}>{dis.title}</h2>
            <p style={{margin:"4px 0 0",fontSize:12,color:"#c2410c"}}>
              {lang==="hi"?"कृपया आगे बढ़ने से पहले ध्यान से पढ़ें":lang==="mr"?"कृपया पुढे जाण्यापूर्वी काळजीपूर्वक वाचा":"Please read carefully before proceeding"}
            </p>
          </div>
        </div>
        {/* Points */}
        <div style={{padding:"24px 28px"}}>
          {dis.points.map((pt, i) => (
            <div key={i} style={{display:"flex",gap:12,marginBottom:14,alignItems:"flex-start"}}>
              <div style={{minWidth:24,height:24,borderRadius:"50%",background:i===0||i===1?"#fef2f2":"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:i===0||i===1?"#dc2626":"#16a34a",flexShrink:0,marginTop:1}}>{i+1}</div>
              <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.6}}>{pt}</p>
            </div>
          ))}
          {/* CIBS Seal */}
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"12px 16px",marginTop:16,display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:20}}>🏥</span>
            <div>
              <p style={{margin:0,fontSize:12,fontWeight:700,color:"#1d4ed8"}}>Central Institute of Behavioural Sciences (CIBS), Nagpur</p>
              <p style={{margin:0,fontSize:11,color:"#64748b"}}>Ethics Committee Approved · ICMR Guidelines Compliant · ICH-GCP Standards</p>
            </div>
          </div>
          {/* Agree checkbox */}
          <label style={{display:"flex",gap:12,alignItems:"flex-start",marginTop:20,cursor:"pointer",padding:"14px 16px",background:agreed?"#f0fdf4":"#f8fafc",borderRadius:10,border:`2px solid ${agreed?"#86efac":"#e2e8f0"}`,transition:"all 0.2s"}}>
            <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{width:18,height:18,marginTop:1,cursor:"pointer",accentColor:"#0d9488"}}/>
            <span style={{fontSize:13,fontWeight:600,color:agreed?"#15803d":"#374151",lineHeight:1.5}}>{dis.agree}</span>
          </label>
        </div>
        {/* Footer */}
        <div style={{background:"#f8fafc",borderTop:"1px solid #e2e8f0",padding:"14px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={()=>setScreen("letter")} style={{padding:"10px 20px",borderRadius:8,background:"#f1f5f9",color:"#64748b",border:"none",fontSize:13,cursor:"pointer"}}>← {lang==="hi"?"वापस":lang==="mr"?"मागे":"Back"}</button>
          <button onClick={()=>{ if(agreed){ setScreen("form"); setStep(1); } }} disabled={!agreed}
            style={{padding:"12px 28px",borderRadius:10,background:agreed?"#0d5c6e":"#e2e8f0",color:agreed?"#fff":"#94a3b8",border:"none",fontSize:14,fontWeight:700,cursor:agreed?"pointer":"not-allowed",transition:"all 0.2s"}}>
            {dis.proceed}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f0f4f8",minHeight:"100vh"}}>
      <style>{`@media print{body{background:white!important}button{display:none!important}}`}</style>

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(135deg,#0d3b47 0%,#0d5c6e 55%,#0d9488 100%)",padding:"20px 24px 0",boxShadow:"0 4px 20px rgba(0,0,0,0.25)"}}>
        <div style={{maxWidth:880,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
            <div style={{width:46,height:46,borderRadius:10,background:"rgba(255,255,255,0.14)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="9" r="3.5" fill="#5DCAA5"/>
                <circle cx="8"  cy="16" r="2.5" fill="#9FE1CB"/>
                <circle cx="24" cy="16" r="2.5" fill="#9FE1CB"/>
                <circle cx="11" cy="24" r="3" fill="#1D9E75"/>
                <circle cx="21" cy="24" r="3" fill="#1D9E75"/>
                <line x1="16" y1="12" x2="8"  y2="16" stroke="#9FE1CB" strokeWidth="1" opacity="0.9"/>
                <line x1="16" y1="12" x2="24" y2="16" stroke="#9FE1CB" strokeWidth="1" opacity="0.9"/>
                <line x1="8"  y1="18" x2="11" y2="24" stroke="#5DCAA5" strokeWidth="1" opacity="0.8"/>
                <line x1="24" y1="18" x2="21" y2="24" stroke="#5DCAA5" strokeWidth="1" opacity="0.8"/>
                <line x1="8"  y1="18" x2="21" y2="24" stroke="#9FE1CB" strokeWidth="0.7" opacity="0.3"/>
                <line x1="24" y1="18" x2="11" y2="24" stroke="#9FE1CB" strokeWidth="0.7" opacity="0.3"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <h1 style={{margin:0,fontSize:20,fontWeight:900,color:"#fff"}}>{t.appTitle}</h1>
              <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.65)"}}>{t.appSubtitle} · {t.appOrg}</p>
            </div>
            <div style={{display:"flex",gap:5}}>
              {["en","hi","mr"].map(l=>(
                <button key={l} onClick={()=>setLang(l)} style={{padding:"4px 9px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",background:lang===l?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.15)",color:lang===l?"#0d5c6e":"#fff",border:"none"}}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <PBar step={step} steps={t.steps}/>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{maxWidth:880,margin:"0 auto",padding:"24px 16px"}}>
        <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 2px 12px rgba(0,0,0,0.07)",border:"1px solid #e2e8f0"}}>

          {/* ══ STEP 1 — CHILD INFO ══ */}
          {step===1 && <div>
            <div style={{background:"#f8fafc",borderRadius:12,padding:18,marginBottom:14,border:"1px solid #e2e8f0"}}>
              <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700,color:"#0d5c6e"}}>👶 {t.childInfo}</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {<div style={{gridColumn:"1/-1"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.childName}</label><input type="text" value={ci['name']} onChange={e=>updCi('name',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.childAge}</label><input type="number" value={ci['age']} onChange={e=>updCi('age',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                <div>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.dob}</label>
                  <input type="date" value={ci.dob} onChange={e=>updCi("dob",e.target.value)}
                    style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.childGender}</label>
                  <select value={ci.gender} onChange={e=>updCi("gender",e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",background:"#fff"}}>
                    <option value="">{t.selectDots}</option>
                    {[t.genderM,t.genderF,t.genderO].map(g=><option key={g}>{g}</option>)}
                  </select>
                </div>
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.fileNo}</label><input type="text" value={ci['fileNo']} onChange={e=>updCi('fileNo',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.regNo}</label><input type="text" value={ci['regNo']} onChange={e=>updCi('regNo',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.school}</label><input type="text" value={ci['school']} onChange={e=>updCi('school',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.dateAssessment}</label><input type="date" value={ci['date']} onChange={e=>updCi('date',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.examiner}</label><input type="text" value={ci['examiner']} onChange={e=>updCi('examiner',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
              </div>
            </div>

            {/* Age group preview — live feedback */}
            {(ci.dob||ci.age) && (
              <div style={{background:badge.bg,border:`1.5px solid ${badge.border}`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>{badge.icon}</span>
                <div>
                  <p style={{margin:0,fontSize:12,color:badge.color,fontWeight:700}}>{t.ageGroupDetected}: <strong>{ageInfo.label}</strong>{ageInfo.age ? ` (${ageInfo.age.toFixed(1)} yrs)`:""}</p>
                  <p style={{margin:0,fontSize:11,color:badge.color,opacity:0.8}}>{t.ageGroupNote}</p>
                </div>
              </div>
            )}

            <div style={{background:"#f8fafc",borderRadius:12,padding:18,marginBottom:14,border:"1px solid #e2e8f0"}}>
              <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700,color:"#0d5c6e"}}>🧑‍🤝‍🧑 {t.informantDetails}</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {<div style={{gridColumn:"auto"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.informantName}</label><input type="text" value={ci['informantName']} onChange={e=>updCi('informantName',e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"}}/></div>}
                <div>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{t.relation}</label>
                  <select value={ci.relation} onChange={e=>updCi("relation",e.target.value)} style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",background:"#fff"}}>
                    <option value="">{t.selectDots}</option>
                    {[t.relMother,t.relFather,t.relGrand,t.relGuard,t.relTeacher,t.relOther].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:12,marginBottom:14,fontSize:13,color:"#1e40af"}}>📋 {t.instChild}</div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>{btn(t.nextPerinatal,()=>setStep(2),"#0d5c6e",!ci.name||!ci.age||!ci.gender)}</div>
          </div>}

          {/* ══ STEP 2 — PERINATAL ══ */}
          {step===2 && <div>
            <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:10,padding:12,marginBottom:14,fontSize:13,color:"#92400e"}}>📌 {t.instPerinatal}</div>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
              {PERINATAL.map((item,idx)=>(
                <div key={item.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 16px",borderBottom:"1px solid #f1f5f9",background:p[item.id]==="yes"?"#fffbeb":idx%2===0?"#fff":"#fafafa"}}>
                  <span style={{minWidth:24,height:24,borderRadius:"50%",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#64748b",flexShrink:0,marginTop:2}}>{item.id}</span>
                  <div style={{flex:1}}>
                    <p style={{margin:"0 0 8px",fontSize:14,color:"#1e293b",fontWeight:500,lineHeight:1.4}}>{gl(item)}</p>
                    <div style={{display:"flex",gap:8}}>
                      {[["yes",t.yes,"#d97706","#fffbeb"],["no",t.no,"#16a34a","#f0fdf4"],["dk",t.dontKnow,"#64748b","#f8fafc"]].map(([v,l,c,bg])=>(
                        <button key={v} onClick={()=>updP(item.id,v)} style={{padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",background:p[item.id]===v?bg:"#fff",border:`1.5px solid ${p[item.id]===v?c:"#e2e8f0"}`,color:p[item.id]===v?c:"#94a3b8"}}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:20}}>
              {btn(t.back,()=>setStep(1),"#64748b")}
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:12,color:"#94a3b8"}}>{Object.keys(p).length}/{PERINATAL.length} {t.answered}</span>
                {btn(t.nextBehaviour,()=>setStep(3))}
              </div>
            </div>
          </div>}

          {/* ══ STEP 3 — BEHAVIOUR (age-adaptive, seamless) ══ */}
          {step===3 && <div>
            {/* Age group banner */}
            <div style={{background:badge.bg,border:`1.5px solid ${badge.border}`,borderRadius:10,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>{badge.icon}</span>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:13,color:badge.color,fontWeight:700}}>{t.ageGroupDetected}: {ageInfo.label}</p>
                <p style={{margin:0,fontSize:11,color:badge.color,opacity:0.8}}>{t.ageGroupNote}</p>
              </div>
              {!ci.dob && !ci.age && <p style={{margin:0,fontSize:11,color:"#d97706"}}>{t.ageGroupManual}</p>}
            </div>
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:12,marginBottom:14,fontSize:13,color:"#1e40af"}}>
              📝 {t.instBehaviour}
              <div style={{marginTop:8,display:"flex",gap:5,flexWrap:"wrap"}}>
                {LIKERT.map(o=><span key={o.v} style={{padding:"2px 7px",borderRadius:8,fontSize:10,fontWeight:600,background:o.bg,color:o.text,border:`1px solid ${o.border}`}}>{o.v} = {gll(o)}</span>)}
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"1px solid #e2e8f0"}}>
              {items.map((item,idx)=>(
                <div key={item.id} style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",background:idx%2===0?"#fff":"#fafafa"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                    <span style={{minWidth:26,height:26,borderRadius:"50%",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#64748b",flexShrink:0,marginTop:1}}>{item.seq}</span>
                    <p style={{margin:0,fontSize:14,color:"#1e293b",fontWeight:500,lineHeight:1.4}}>{gl(item)}</p>
                  </div>
                  <div style={{display:"flex",gap:5,paddingLeft:36,flexWrap:"wrap"}}>
                    {LIKERT.map(o=>(
                      <button key={o.v} onClick={()=>updBx(item.id,o.v)} style={{flex:1,minWidth:0,padding:"6px 3px",borderRadius:6,cursor:"pointer",background:bx[item.id]===o.v?o.bg:"#f8fafc",border:`1.5px solid ${bx[item.id]===o.v?o.border:"#e2e8f0"}`,color:bx[item.id]===o.v?o.text:"#94a3b8",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:800,color:bx[item.id]===o.v?o.text:"#cbd5e1"}}>{o.v}</div>
                        <div style={{fontSize:8,lineHeight:1.2}}>{gll(o)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:20}}>
              {btn(t.back,()=>setStep(2),"#64748b")}
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:12,color:ANS===items.length?"#16a34a":"#94a3b8",fontWeight:600}}>{ANS}/{items.length} {t.answered}</span>
                {btn(t.generateReport,()=>{ setStep(4); const ok=submitToDatabank_P(ci,ageInfo,p,bx,S,RL,SF,sm); setDbSubmitted(ok); })}
              </div>
            </div>
          </div>}

          {/* ══ STEP 4 — REPORT ══ */}
          {step===4 && <div>
            {/* Report header */}
            <div style={{background:"linear-gradient(135deg,#0d5c6e,#0d9488)",borderRadius:12,padding:20,marginBottom:14,color:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <h2 style={{margin:0,fontSize:17,fontWeight:800}}>{t.reportTitle}</h2>
                  <p style={{margin:"3px 0 0",fontSize:11,opacity:0.7}}>{t.appOrg}</p>
                  <div style={{marginTop:6,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",borderRadius:8,padding:"4px 10px"}}>
                    <span style={{fontSize:14}}>{badge.icon}</span>
                    <span style={{fontSize:12,fontWeight:600}}>{ageInfo.label}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",fontSize:11,opacity:0.8}}><p style={{margin:0}}>{ci.date}</p><p style={{margin:"2px 0 0"}}>{ci.examiner||"—"}</p></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {[[t.childName,ci.name],[`${t.childAge}/${t.childGender}`,`${ci.age}y / ${ci.gender}`],[t.dob,ci.dob||"—"],[t.fileNo,ci.fileNo||"—"],[t.regNo,ci.regNo||"—"],[t.school,ci.school||"—"],[t.examiner,ci.examiner||"—"],[t.informantName,`${ci.informantName||"—"} (${ci.relation||"—"})`]].map(([l,v])=>(
                  <div key={l} style={{background:"rgba(255,255,255,0.14)",borderRadius:7,padding:"7px 10px"}}>
                    <p style={{margin:0,fontSize:9,opacity:0.65}}>{l}</p>
                    <p style={{margin:0,fontSize:12,fontWeight:700}}>{v||"—"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab switcher */}
            <div style={{display:"flex",marginBottom:14,background:"#f1f5f9",borderRadius:10,padding:4}}>
              {[["parent","📋 "+t.forParent],["clinician","🩺 "+t.forClinician]].map(([tb,lbl])=>(
                <button key={tb} onClick={()=>setTab(tb)} style={{flex:1,padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:tab===tb?"#fff":"transparent",color:tab===tb?"#0d5c6e":"#64748b",boxShadow:tab===tb?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{lbl}</button>
              ))}
            </div>

            {/* ── PARENT TAB ── */}
            {tab==="parent" && <>
              <div style={{background:RL.bg,border:`2px solid ${RL.border}`,borderRadius:12,padding:16,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:50,height:50,borderRadius:"50%",background:RL.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{["✅","🟡","🟠","🔴"][RL.lv]}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                      <span style={{padding:"3px 10px",borderRadius:20,background:RL.color,color:"#fff",fontSize:11,fontWeight:800}}>{RL.tag}</span>
                      <strong style={{fontSize:15,color:RL.color}}>{RL.label}</strong>
                    </div>
                    <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.5}}>{RL.action}</p>
                    {RL.domains.length>0&&<p style={{margin:"5px 0 0",fontSize:12,color:"#6b7280"}}>Affected: {RL.domains.join(", ")}</p>}
                  </div>
                </div>
              </div>

              {SF && <div style={{background:"#fff1f2",border:"2px solid #f43f5e",borderRadius:12,padding:16,marginBottom:14}}>
                <div style={{display:"flex",gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>🚨</span>
                  <div style={{flex:1}}>
                    <h4 style={{margin:"0 0 5px",fontSize:14,fontWeight:800,color:"#be123c"}}>{t.suicideFlag}</h4>
                    <p style={{margin:0,fontSize:13,color:"#9f1239",lineHeight:1.5}}>{t.suicideFlagDesc}</p>
                    <button onClick={()=>setSmEx(!smEx)} style={{marginTop:10,padding:"5px 12px",background:"#be123c",color:"#fff",border:"none",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>{smEx?t.closeMini:t.openMini}</button>
                    {smEx && <div style={{marginTop:12,background:"#fff",borderRadius:9,padding:14,border:"1px solid #fda4af"}}>
                      <p style={{margin:"0 0 10px",fontSize:11,color:"#6b7280",fontStyle:"italic"}}>{t.miniNote}</p>
                      {SM.map(item=>(
                        <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                          <span style={{fontSize:13,color:"#374151",flex:1}}>{gl(item)}</span>
                          <div style={{display:"flex",gap:5,marginLeft:10}}>
                            {[["YES",true,"#dc2626","#fef2f2"],["NO",false,"#16a34a","#f0fdf4"]].map(([l,v,c,bg])=>(
                              <button key={l} onClick={()=>updSm(item.id,v)} style={{padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",background:sm[item.id]===v?bg:"#f8fafc",border:`1.5px solid ${sm[item.id]===v?c:"#e2e8f0"}`,color:sm[item.id]===v?c:"#94a3b8"}}>{l}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {SPO&&<div style={{marginTop:10,padding:10,background:"#fef2f2",borderRadius:7,border:"1px solid #fca5a5"}}><strong style={{color:"#dc2626",fontSize:12}}>⚠️ {t.severeImmediate}</strong></div>}
                    </div>}
                  </div>
                </div>
              </div>}

              {AFF.length>0 && <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:14}}>
                <h4 style={{margin:"0 0 5px",fontSize:14,fontWeight:700,color:"#374151"}}>🏥 {t.probableDSM}</h4>
                <p style={{margin:"0 0 10px",fontSize:11,color:"#94a3b8",fontStyle:"italic"}}>{t.screenerNote}</p>
                {AFF.map(([d,sc])=>{const cfg=DCFG[d];const sv=sc.sev; return (
                  <div key={d} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:cfg.color,flexShrink:0}}/>
                    <span style={{fontSize:13,color:"#374151",flex:1,fontWeight:500}}>{cfg.dsm5}</span>
                    <span style={{fontSize:11,color:"#94a3b8",marginRight:6}}>ICD-11: {cfg.icd11}</span>
                    <span style={{padding:"3px 9px",borderRadius:12,fontSize:11,fontWeight:700,background:sevB[sv],color:sevC[sv]}}>{t.severity[sv]}</span>
                  </div>
                );})}
              </div>}

              <div style={{background:PR.bg,border:`1.5px solid ${PR.color}40`,borderRadius:12,padding:14,marginBottom:14}}>
                <h4 style={{margin:"0 0 8px",fontSize:14,fontWeight:700,color:PR.color}}>🤰 {t.perinatalRisk}</h4>
                <p style={{margin:"0 0 6px",fontSize:13,color:"#374151"}}><strong>{PR.n}</strong> of 14 perinatal risk factors reported</p>
                <span style={{padding:"3px 10px",borderRadius:12,background:PR.color,color:"#fff",fontSize:11,fontWeight:700}}>{PR.level} Perinatal Risk</span>
                {PERINATAL.filter(i=>p[i.id]==="yes").map(i=><p key={i.id} style={{margin:"4px 0 0",fontSize:12,color:"#6b7280"}}>• {gl(i)}</p>)}
              </div>

              <div style={{background:"#faf5ff",border:"1.5px solid #d8b4fe",borderRadius:12,padding:14,marginBottom:14}}>
                <h4 style={{margin:"0 0 10px",fontSize:14,fontWeight:700,color:"#7c3aed"}}>⚠️ {t.futureRisk}</h4>
                {FR.map(r=>(
                  <div key={r.label} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #ede9fe"}}>
                    <span>{r.icon}</span><span style={{fontSize:13,color:"#374151",flex:1}}>{r.label}</span>
                    <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,background:r.up?"#fef2f2":"#f0fdf4",color:r.up?"#dc2626":"#16a34a"}}>{r.up?"⬆ Elevated":"✓ Not indicated"}</span>
                  </div>
                ))}
              </div>

              <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:12,padding:16,marginBottom:14}}>
                <h4 style={{margin:"0 0 8px",fontSize:14,fontWeight:700,color:"#15803d"}}>📋 {t.forParent}</h4>
                <p style={{margin:0,fontSize:14,color:"#166534",lineHeight:1.7}}>
                  <strong>{ci.name||"Your child"}</strong> ({ageInfo.label}) — <strong>{RL.label}</strong>.<br/>
                  {t.parentSummary[RL.lv]}
                  {SF&&" ⚠️ An important safety concern was also identified — please speak with the clinician immediately."}
                </p>
              </div>
            </>}

            {/* ── CLINICIAN TAB ── */}
            {tab==="clinician" && <>
              <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:14}}>
                <h4 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:"#374151"}}>📊 {t.domainChart}</h4>
                <BarChart s={S} t={t}/>
              </div>
              <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,overflow:"hidden",marginBottom:14}}>
                <div style={{background:"#0d5c6e",padding:"9px 16px",display:"grid",gridTemplateColumns:"1fr 2fr 60px 60px 70px 90px",gap:8}}>
                  {["Domain","Disorder","Score","Max","%","Severity"].map(h=><span key={h} style={{fontSize:11,fontWeight:700,color:"#fff"}}>{h}</span>)}
                </div>
                {Object.entries(DCFG).map(([d,c])=>{const sc=S[d];const sv=sc.sev; return (
                  <div key={d} style={{padding:"9px 16px",display:"grid",gridTemplateColumns:"1fr 2fr 60px 60px 70px 90px",gap:8,alignItems:"center",borderBottom:"1px solid #f1f5f9"}}>
                    <span style={{fontSize:13,fontWeight:700,color:c.color}}>{d}</span>
                    <span style={{fontSize:12,color:"#374151"}}>{c.dsm5}</span>
                    <span style={{fontSize:13,fontWeight:700}}>{sc.total}</span>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{c.max}</span>
                    <span style={{fontSize:12}}>{sc.pct}%</span>
                    <span style={{padding:"3px 9px",borderRadius:10,fontSize:11,fontWeight:700,background:sevB[sv],color:sevC[sv]}}>{t.severity[sv]}</span>
                  </div>
                );})}
              </div>
              <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,overflow:"hidden",marginBottom:14}}>
                <div style={{background:"#374151",padding:"9px 16px"}}><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Risk Classification Summary</span></div>
                {[
                  {l:"Overall Risk",v:RL.label,c:RL.color,bg:RL.bg},
                  {l:"Age Group",v:ageInfo.label,c:badge.color,bg:badge.bg},
                  {l:"Suicide / Self-Harm Flag",v:SF?"⚠️ FLAGGED — Immediate Action":"Not triggered",c:SF?"#dc2626":"#16a34a",bg:SF?"#fef2f2":"#dcfce7"},
                  {l:"Perinatal Risk",v:`${PR.level} (${PR.n}/14)`,c:PR.color,bg:PR.bg},
                  {l:"Probable Diagnoses",v:AFF.map(([d])=>`${d}[${t.severity[S[d].sev]}]`).join(", ")||"None",c:"#374151",bg:"#f8fafc"},
                ].map(r=>(
                  <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid #f1f5f9"}}>
                    <span style={{fontSize:13,color:"#6b7280",fontWeight:500}}>{r.l}</span>
                    <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:8,background:r.bg,color:r.c}}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:14,marginBottom:14}}>
                <h4 style={{margin:"0 0 10px",fontSize:14,fontWeight:700,color:"#374151"}}>⚠️ {t.futureRisk}</h4>
                {FR.map(r=>(
                  <div key={r.label} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #f1f5f9"}}>
                    <span>{r.icon}</span><span style={{fontSize:13,color:"#374151",flex:1}}>{r.label}</span>
                    <span style={{padding:"3px 9px",borderRadius:10,fontSize:11,fontWeight:700,background:r.up?"#fef2f2":"#f0fdf4",color:r.up?"#dc2626":"#16a34a"}}>{r.up?"⬆ Elevated":"✓ Not indicated"}</span>
                  </div>
                ))}
              </div>
              <div style={{padding:12,background:"#f8fafc",borderRadius:9,border:"1px solid #e2e8f0",fontSize:11,color:"#64748b",lineHeight:1.7,marginBottom:14}}>
                <strong>Algorithm Notes:</strong> Age group auto-detected from DOB (priority) or Age field. Groups: Pre-school &lt;6y · Primary 6–10y · Secondary 11–15y · Higher 16–18y. All 26 items share identical item IDs and scoring algorithm across groups — only question wording adapts. Cutoffs: Normal N=55, Clinical N=281 from CIBS dataset. atRisk = Normal_p90+1; prob = Clinical_p75; sev = max(Clinical_p75+1, 75% of max). MDD atRisk=4/8 (prevents false-positive from single sad item). Suicide flag: ADHD(Mild+) + MDD(≥4) + ODD/CD(Moderate/Severe).
              </div>
            </>}

            {/* ── EXPORT & SHARE ── */}
            <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:14}}>
              <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"#374151"}}>💾 {t.exportSave}</h4>

              {/* Download row */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                <button onClick={()=>window.print()} style={{padding:"10px 18px",borderRadius:8,background:"#0d5c6e",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.printPDF}</button>
                <button onClick={()=>makeCSV(ci,ageInfo,p,bx,S,RL,SF,sm)} style={{padding:"10px 18px",borderRadius:8,background:"#16a34a",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.downloadCSV}</button>
              </div>

              {/* Share panel */}
              <div style={{borderTop:"1px solid #e2e8f0",paddingTop:14,marginBottom:14}}>
                <p style={{margin:"0 0 10px",fontSize:12,color:"#64748b",fontWeight:700}}>
                  📲 {lang==="hi"?"इस प्रश्नावली को शेयर करें":lang==="mr"?"ही प्रश्नावली शेअर करा":"Share this questionnaire"}
                </p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[
                    { method:"whatsapp", label:"WhatsApp",  bg:"#25d366", icon:"💬" },
                    { method:"email",    label:"Email",     bg:"#ea580c", icon:"📧" },
                    { method:"sms",      label:"SMS",       bg:"#7c3aed", icon:"📱" },
                    { method:"copy",     label:lang==="hi"?"लिंक कॉपी करें":lang==="mr"?"लिंक कॉपी करा":"Copy Link", bg:"#0891b2", icon:"🔗" },
                  ].map(s=>(
                    <button key={s.method} onClick={()=>shareVia(s.method, ci.name, lang)} style={{padding:"8px 14px",borderRadius:8,background:s.bg,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
                <p style={{margin:"8px 0 0",fontSize:11,color:"#94a3b8"}}>
                  {lang==="hi"?"शेयर करने पर एक संक्षिप्त संदेश और लिंक भेजा जाएगा।":lang==="mr"?"शेअर केल्यावर एक संक्षिप्त संदेश आणि दुवा पाठवला जाईल.":"Sharing will compose a brief message with the tool link for the recipient."}
                </p>
              </div>

              {/* Google Sheets sync */}
              <div style={{borderTop:"1px solid #e2e8f0",paddingTop:12}}>
                <p style={{margin:"0 0 6px",fontSize:12,color:"#64748b",fontWeight:600}}>📡 {t.sendSheets}</p>
                <div style={{display:"flex",gap:8}}>
                  <input type="text" placeholder={t.sheetsPlaceholder} value={shUrl} onChange={e=>setShUrl(e.target.value)} style={{flex:1,padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:12,color:"#1e293b",outline:"none"}}/>
                  <button onClick={sendSheets} style={{padding:"8px 14px",borderRadius:8,background:"#0d9488",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.send}</button>
                  {ci.fileNo && (
                    <a href={`https://esmart-report.vercel.app?reg=${ci.fileNo}&mode=family&lang=${lang||"en"}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{padding:"8px 14px",borderRadius:8,
                        background:"linear-gradient(135deg,#0d9488,#10b981)",
                        color:"#fff",border:"none",fontSize:13,fontWeight:700,
                        cursor:"pointer",textDecoration:"none",display:"inline-block"}}>
                      📋 {t.familyReport||"Family Report"} →
                    </a>
                  )}
                </div>
                {shSt&&<p style={{margin:"5px 0 0",fontSize:12,color:shSt.includes("✅")?"#16a34a":"#dc2626"}}>{shSt}</p>}
              </div>
            </div>

            {/* Enhanced disclaimer box */}
            <div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:18,flexShrink:0}}>⚖️</span>
                <div>
                  <p style={{margin:"0 0 4px",fontSize:12,fontWeight:700,color:"#9a3412"}}>{lang==="hi"?"सुरक्षा अस्वीकरण":lang==="mr"?"सुरक्षा अस्वीकरण":"Safety Disclaimer"}</p>
                  <p style={{margin:0,fontSize:11,color:"#c2410c",lineHeight:1.6}}>{t.disclaimer}</p>
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={reset} style={{padding:"9px 18px",borderRadius:8,background:"#f1f5f9",color:"#475569",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>{t.newAssessment}</button>
              {dbSubmitted&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderRadius:8,background:"#f0fdf4",border:"1px solid #86efac",fontSize:12,fontWeight:700,color:"#15803d"}}>✅ Data submitted to CIBS Databank (File: {ci.fileNo})</div>}
              <button onClick={()=>setStep(3)} style={{padding:"9px 18px",borderRadius:8,background:"#f1f5f9",color:"#475569",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>{t.editResponses}</button>
              <button onClick={()=>{setScreen("lang");setLang(null);}} style={{padding:"9px 18px",borderRadius:8,background:"#f1f5f9",color:"#475569",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>🌐 Language</button>
            </div>
          </div>}

        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}
