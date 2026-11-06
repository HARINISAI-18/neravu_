import guidanceIndex from './schemeCatalog.json';

export const schemeGuidance = guidanceIndex.schemes;
export const patientDocumentChecklist = guidanceIndex.patientDocumentChecklist;
export const patientDocumentChecklistByLanguage = guidanceIndex.patientDocumentChecklistByLanguage || {};
export const schemeGuidanceSnapshot = guidanceIndex.sourceSnapshot;
export const stateTracker = guidanceIndex.stateTracker || [];
export const knownStates = stateTracker.map((record) => record.State).filter(Boolean);
export const workbookNgos = (guidanceIndex.ngoDirectory || []).map((record, index) => ({
  id: `workbook-ngo-${index}`,
  organization_name: record['Organisation Name'] || '',
  organization_type: record['Organisation Type'] || '',
  state_coverage: record['State / UT Coverage'] || '',
  city_district: record['City / District'] || '',
  support_type: record['Support Type'] || '',
  what_support_offered: record['What Support Is Offered'] || '',
  direct_financial_aid: record['Direct Financial Aid?'] || '',
  aid_amount_limit: record['Aid Amount / Limit'] || '',
  eligibility: record['Eligibility / Patient Group'] || '',
  hospital_restrictions: record['Hospital / Geographic Restrictions'] || '',
  contact_phone: record['Contact Phone'] || '',
  contact_email: record['Contact Email'] || '',
  address: record.Address || '',
  website_url: record['Official Website / Apply Link'] || '',
  application_route: record['Application / Referral Route'] || '',
  verification_status: record['Verification Status'] || '',
  last_checked: record['Last Checked'] || '',
  source_notes: record['Source / Evidence Notes'] || '',
  source_kind: 'workbook'
}));

export function filterWorkbookNgos({ search = '', state = '', directAid = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return workbookNgos.filter((ngo) => {
    const matchesSearch = !query || [
      ngo.organization_name,
      ngo.city_district,
      ngo.what_support_offered,
      ngo.support_type
    ].some((value) => value.toLocaleLowerCase().includes(query));
    const coverage = ngo.state_coverage.toLocaleLowerCase();
    const matchesState = !state
      || coverage.includes(state.toLocaleLowerCase())
      || coverage.includes('all india')
      || coverage.includes('multiple states');
    const receivesAid = ngo.direct_financial_aid.toLocaleLowerCase().startsWith('yes');
    const matchesAid = !directAid
      || (directAid === 'Yes' ? receivesAid : !receivesAid);
    return matchesSearch && matchesState && matchesAid;
  });
}

export function incomeBandRange(value) {
  const normalized = String(value || '').toLocaleLowerCase().replace(/,/g, '');
  if (!normalized || /not sure|prefer not/.test(normalized)) return null;
  const amounts = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const scale = /lakh|lac/.test(normalized) ? 100000 : 1;
  if (/below|less than|under/.test(normalized) && amounts[0] !== undefined) {
    return { minimum: 0, maximum: amounts[0] * scale };
  }
  if (/above|over|more than/.test(normalized) && amounts[0] !== undefined) {
    return { minimum: amounts[0] * scale, maximum: Number.POSITIVE_INFINITY };
  }
  if (amounts.length >= 2) {
    return { minimum: amounts[0] * scale, maximum: amounts[1] * scale };
  }
  return null;
}

function incomeThreshold(text) {
  const value = String(text || '').replace(/,/g, '');
  const patterns = [
    /(?:annual(?: family)? income|family income|income limit)[^.;\n]{0,80}?(?:up to|below|under|less than|not exceeding|maximum of)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|crore|crores)?/i,
    /(?:annual(?: family)? income|family income)[^.;\n]{0,40}?(?:of\s*)?(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|crore|crores)?\s*(?:or\s*)?(?:below|less than|not exceeding)/i
  ];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  if (!match) return null;
  const multiplier = /crore/i.test(match[2] || '') ? 10000000 : /lakh|lac/i.test(match[2] || '') ? 100000 : 1;
  return Number(match[1]) * multiplier;
}

export function getSchemeRecommendation(scheme, state, income) {
  const coverage = `${scheme.stateCoverage || ''} ${scheme.governmentLevel || ''}`.toLocaleLowerCase();
  const selectedState = String(state || '').toLocaleLowerCase();
  const stateRow = stateTracker.find((record) => (
    String(record.State || '').toLocaleLowerCase() === selectedState
  ));
  const stateLeads = `${stateRow?.['State Government Scheme Lead'] || ''} ${stateRow?.['Known National NGO Coverage / Leads'] || ''}`.toLocaleLowerCase();
  const name = String(scheme.official_name || scheme.name || '').toLocaleLowerCase();
  const stateLeadMatch = [name, ...(scheme.aliases || [])]
    .map((alias) => String(alias).toLocaleLowerCase().trim())
    .some((alias) => alias.length > 3 && stateLeads.includes(alias));
  const stateMatch = !selectedState
    || /central|all india|pan.?india|nationwide|participating states|multiple states/.test(coverage)
    || coverage.includes(selectedState)
    || stateLeadMatch;
  const incomeRange = incomeBandRange(income);
  const threshold = incomeThreshold(scheme.eligibilitySummary || scheme.description);
  const incomeMismatch = incomeRange && threshold !== null && incomeRange.minimum > threshold;
  return {
    stateMatch,
    incomeMismatch: Boolean(incomeMismatch),
    recommended: stateMatch && !incomeMismatch,
    hasStateOrIncomeEvidence: Boolean(selectedState || incomeRange)
  };
}

export function getNgoRecommendation(ngo, state, income) {
  const coverage = String(ngo.state_coverage || '').toLocaleLowerCase();
  const selectedState = String(state || '').toLocaleLowerCase();
  const stateMatch = !selectedState
    || /all india|pan.?india|national|multiple states|partner network/.test(coverage)
    || coverage.includes(selectedState);
  const incomeRange = incomeBandRange(income);
  const threshold = incomeThreshold(ngo.eligibility || '');
  return {
    stateMatch,
    incomeMismatch: Boolean(incomeRange && threshold !== null && incomeRange.minimum > threshold),
    recommended: stateMatch && !(incomeRange && threshold !== null && incomeRange.minimum > threshold)
  };
}

const schemeDocumentAliases = {
  pmjay: ['pmjay', 'pm-jay', 'ayushman bharat'],
  pmnrf: ['pmnrf', 'pmnrf', 'prime minister national relief fund'],
  hmdg: ['hmdg', 'health minister discretionary grant'],
  hmcpf: ['hmcpf', 'health minister cancer patient fund', 'rashtriya arogya nidhi'],
  'delhi-arogya-kosh': ['delhi arogya kosh', 'dak'],
  aas: ['aas cancer care', 'aggarwal aggregator services'],
  youwecan: ['youwecan', 'you we can'],
  'ics-parent': ['indian cancer society', 'ics'],
  cankids: ['cankids', 'can kids'],
  'tata-trusts': ['tata trusts'],
  cpaa: ['cpaa', 'cancer patients aid association'],
  'ics-cancer-cure': ['ics cancer cure', 'indian cancer society cancer cure'],
  cghs: ['cghs', 'central government health scheme'],
  'wb-cmrf': ['west bengal chief minister relief fund', 'wb cmrf'],
  'swasthya-sathi': ['swasthya sathi'],
  'uttarakhand-cmrf': ['uttarakhand chief minister relief fund'],
  'atal-ayushman-uttarakhand': ['atal ayushman uttarakhand'],
  'wb-governor-welfare': ['west bengal governor welfare fund'],
  'major-ailments': ['treatment for major ailments']
};

export function getDocumentChecklistForScheme(schemeId, language = 'en') {
  const englishRows = patientDocumentChecklist || [];
  const localizedRows = patientDocumentChecklistByLanguage[language] || englishRows;
  if (schemeId === 'aas') return [];
  const aliases = (schemeDocumentAliases[schemeId] || [schemeId])
    .map((alias) => alias.toLocaleLowerCase());
  return englishRows.flatMap((record, index) => {
    const applicable = String(record['Applicable Programmes (check official list)'] || '').toLocaleLowerCase();
    const appliesToAllClinical = /all clinical support programmes|all clinical support programs/.test(applicable);
    if (!appliesToAllClinical && !aliases.some((alias) => applicable.includes(alias))) return [];
    return [{ ...localizedRows[index], english: record }];
  });
}

const guidanceUi = {
  en: {
    trackerEyebrow: 'YOUR JOURNEY',
    trackerTitle: 'Application tracker',
    trackerDescription: 'Follow the supplied programme steps, keep track of what you have completed, and see what to do if you get stuck.',
    selectJourney: 'Select a programme',
    loading: 'Loading programme steps…',
    localProgress: 'Your checked steps are saved with your Neravu progress.',
    step: 'Step {step}',
    progress: '{done} of {total} steps complete',
    done: 'Done',
    notStarted: 'Not started',
    responsible: 'Who does this',
    action: 'What to do',
    output: 'Evidence or output to keep',
    stuck: 'If this step gets stuck',
    sourceSnapshot: 'WORKBOOK RESEARCH SNAPSHOT',
    sourceNotice: 'This is translated workbook guidance, not an official decision. Confirm current eligibility, intake, documents, contacts and hospital participation directly with the programme.',
    programmeDetails: 'Eligibility, documents and application details',
    eligibility: 'Eligibility',
    documents: 'Documents to prepare',
    whereToApply: 'Where to apply and who to contact',
    officialLinks: 'Official links and forms',
    noSteps: 'The supplied workbook does not include numbered application steps for this programme. Check the programme detail page for the available application route.',
    selectAProgramme: 'Select a programme to see its application steps.'
  },
  mr: {
    trackerEyebrow: 'तुमचा अर्ज प्रवास',
    trackerTitle: 'अर्ज ट्रॅकर',
    trackerDescription: 'दिलेल्या कार्यक्रमाच्या पायऱ्या पाहा, पूर्ण केलेल्या पायऱ्या नोंदवा आणि अडचण आल्यास काय करायचे ते जाणून घ्या.',
    selectJourney: 'कार्यक्रम निवडा',
    loading: 'कार्यक्रमाच्या पायऱ्या लोड होत आहेत…',
    localProgress: 'निवडलेल्या पायऱ्या तुमच्या Neravu प्रगतीसोबत जतन केल्या जातात.',
    step: 'पायरी {step}',
    progress: '{total} पैकी {done} पायऱ्या पूर्ण',
    done: 'पूर्ण',
    notStarted: 'सुरू नाही',
    responsible: 'हे कोण करते',
    action: 'काय करावे',
    output: 'जतन करायचा पुरावा किंवा परिणाम',
    stuck: 'या पायरीत अडचण आल्यास',
    sourceSnapshot: 'कार्यपुस्तिकेतील संशोधनाचा आढावा',
    sourceNotice: 'ही अनुवादित कार्यपुस्तिका मार्गदर्शक माहिती आहे, अधिकृत निर्णय नाही. सध्याची पात्रता, अर्जस्वीकृती, कागदपत्रे, संपर्क आणि रुग्णालय सहभाग कार्यक्रमाकडून थेट तपासा.',
    programmeDetails: 'पात्रता, कागदपत्रे आणि अर्जाची माहिती',
    eligibility: 'पात्रता',
    documents: 'तयार ठेवायची कागदपत्रे',
    whereToApply: 'अर्ज कुठे करावा आणि कोणाशी संपर्क साधावा',
    officialLinks: 'अधिकृत दुवे आणि अर्ज',
    noSteps: 'दिलेल्या कार्यपुस्तिकेत या कार्यक्रमासाठी क्रमांकित अर्जाच्या पायऱ्या नाहीत. उपलब्ध अर्ज मार्गासाठी कार्यक्रमाचे तपशील पृष्ठ पहा.',
    selectAProgramme: 'अर्जाच्या पायऱ्या पाहण्यासाठी कार्यक्रम निवडा.'
  },
  bn: {
    trackerEyebrow: 'আপনার আবেদন যাত্রা',
    trackerTitle: 'আবেদন ট্র্যাকার',
    trackerDescription: 'প্রদত্ত কর্মসূচির ধাপগুলি অনুসরণ করুন, সম্পন্ন ধাপগুলি চিহ্নিত করুন এবং আটকে গেলে কী করবেন দেখুন।',
    selectJourney: 'একটি কর্মসূচি বেছে নিন',
    loading: 'কর্মসূচির ধাপ লোড হচ্ছে…',
    localProgress: 'চিহ্নিত ধাপগুলি আপনার Neravu অগ্রগতির সঙ্গে সংরক্ষিত হয়।',
    step: 'ধাপ {step}',
    progress: '{total}টির মধ্যে {done}টি ধাপ সম্পন্ন',
    done: 'সম্পন্ন',
    notStarted: 'শুরু হয়নি',
    responsible: 'কে করবেন',
    action: 'করণীয়',
    output: 'যে প্রমাণ বা ফলাফল রাখবেন',
    stuck: 'এই ধাপে আটকে গেলে',
    sourceSnapshot: 'ওয়ার্কবুক গবেষণার সারাংশ',
    sourceNotice: 'এটি অনূদিত ওয়ার্কবুক নির্দেশিকা, সরকারি সিদ্ধান্ত নয়। বর্তমান যোগ্যতা, আবেদন গ্রহণ, নথি, যোগাযোগ এবং হাসপাতালের অংশগ্রহণ কর্মসূচির সঙ্গে সরাসরি নিশ্চিত করুন।',
    programmeDetails: 'যোগ্যতা, নথি ও আবেদনের তথ্য',
    eligibility: 'যোগ্যতা',
    documents: 'প্রস্তুত রাখার নথি',
    whereToApply: 'কোথায় আবেদন করবেন এবং কার সঙ্গে যোগাযোগ করবেন',
    officialLinks: 'সরকারি লিঙ্ক ও ফর্ম',
    noSteps: 'সরবরাহ করা ওয়ার্কবুকে এই কর্মসূচির নম্বরযুক্ত আবেদন ধাপ নেই। উপলভ্য আবেদন পথের জন্য কর্মসূচির বিস্তারিত পৃষ্ঠা দেখুন।',
    selectAProgramme: 'আবেদনের ধাপ দেখতে একটি কর্মসূচি বেছে নিন।'
  },
  kn: {
    trackerEyebrow: 'ನಿಮ್ಮ ಅರ್ಜಿ ಪ್ರಯಾಣ',
    trackerTitle: 'ಅರ್ಜಿ ಟ್ರ್ಯಾಕರ್',
    trackerDescription: 'ಒದಗಿಸಿದ ಕಾರ್ಯಕ್ರಮದ ಹಂತಗಳನ್ನು ಅನುಸರಿಸಿ, ಪೂರ್ಣಗೊಂಡ ಹಂತಗಳನ್ನು ಗುರುತಿಸಿ ಮತ್ತು ಸಮಸ್ಯೆಯಾದರೆ ಏನು ಮಾಡಬೇಕೆಂದು ನೋಡಿ.',
    selectJourney: 'ಕಾರ್ಯಕ್ರಮವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    loading: 'ಕಾರ್ಯಕ್ರಮದ ಹಂತಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…',
    localProgress: 'ಗುರುತಿಸಿದ ಹಂತಗಳು ನಿಮ್ಮ Neravu ಪ್ರಗತಿಯೊಂದಿಗೆ ಉಳಿಸಲಾಗುತ್ತವೆ.',
    step: 'ಹಂತ {step}',
    progress: '{total}ರಲ್ಲಿ {done} ಹಂತಗಳು ಪೂರ್ಣ',
    done: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    notStarted: 'ಪ್ರಾರಂಭವಾಗಿಲ್ಲ',
    responsible: 'ಯಾರು ಮಾಡುತ್ತಾರೆ',
    action: 'ಏನು ಮಾಡಬೇಕು',
    output: 'ಉಳಿಸಬೇಕಾದ ಪುರಾವೆ ಅಥವಾ ಫಲಿತಾಂಶ',
    stuck: 'ಈ ಹಂತದಲ್ಲಿ ತೊಂದರೆಯಾದರೆ',
    sourceSnapshot: 'ವರ್ಕ್‌ಬುಕ್ ಸಂಶೋಧನಾ ಸಾರಾಂಶ',
    sourceNotice: 'ಇದು ಅನುವಾದಿತ ವರ್ಕ್‌ಬುಕ್ ಮಾರ್ಗದರ್ಶನ; ಅಧಿಕೃತ ನಿರ್ಧಾರವಲ್ಲ. ಪ್ರಸ್ತುತ ಅರ್ಹತೆ, ಅರ್ಜಿ ಸ್ವೀಕಾರ, ದಾಖಲೆಗಳು, ಸಂಪರ್ಕಗಳು ಮತ್ತು ಆಸ್ಪತ್ರೆಯ ಪಾಲ್ಗೊಳ್ಳುವಿಕೆಯನ್ನು ಕಾರ್ಯಕ್ರಮದೊಂದಿಗೆ ನೇರವಾಗಿ ದೃಢೀಕರಿಸಿ.',
    programmeDetails: 'ಅರ್ಹತೆ, ದಾಖಲೆಗಳು ಮತ್ತು ಅರ್ಜಿ ವಿವರಗಳು',
    eligibility: 'ಅರ್ಹತೆ',
    documents: 'ಸಿದ್ಧಪಡಿಸಬೇಕಾದ ದಾಖಲೆಗಳು',
    whereToApply: 'ಎಲ್ಲಿ ಅರ್ಜಿ ಸಲ್ಲಿಸಬೇಕು ಮತ್ತು ಯಾರನ್ನು ಸಂಪರ್ಕಿಸಬೇಕು',
    officialLinks: 'ಅಧಿಕೃತ ಲಿಂಕ್‌ಗಳು ಮತ್ತು ಅರ್ಜಿಗಳು',
    noSteps: 'ಒದಗಿಸಿದ ವರ್ಕ್‌ಬುಕ್‌ನಲ್ಲಿ ಈ ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ಸಂಖ್ಯೆಯ ಅರ್ಜಿ ಹಂತಗಳಿಲ್ಲ. ಲಭ್ಯವಿರುವ ಅರ್ಜಿ ಮಾರ್ಗಕ್ಕಾಗಿ ಕಾರ್ಯಕ್ರಮದ ವಿವರ ಪುಟವನ್ನು ನೋಡಿ.',
    selectAProgramme: 'ಅರ್ಜಿ ಹಂತಗಳನ್ನು ನೋಡಲು ಕಾರ್ಯಕ್ರಮವನ್ನು ಆಯ್ಕೆಮಾಡಿ.'
  },
  hi: {
    trackerEyebrow: 'आपकी आवेदन यात्रा',
    trackerTitle: 'आवेदन ट्रैकर',
    trackerDescription: 'दिए गए कार्यक्रम के चरण देखें, पूरे किए गए चरण दर्ज करें और अटकने पर क्या करना है जानें।',
    selectJourney: 'कार्यक्रम चुनें',
    loading: 'कार्यक्रम के चरण लोड हो रहे हैं…',
    localProgress: 'चुने गए चरण आपकी Neravu प्रगति के साथ सहेजे जाते हैं।',
    step: 'चरण {step}',
    progress: '{total} में से {done} चरण पूरे',
    done: 'पूरा',
    notStarted: 'शुरू नहीं हुआ',
    responsible: 'यह कौन करेगा',
    action: 'क्या करें',
    output: 'सहेजने योग्य प्रमाण या परिणाम',
    stuck: 'इस चरण में अटकने पर',
    sourceSnapshot: 'वर्कबुक शोध सारांश',
    sourceNotice: 'यह अनूदित वर्कबुक मार्गदर्शन है, आधिकारिक निर्णय नहीं। मौजूदा पात्रता, आवेदन की उपलब्धता, दस्तावेज़, संपर्क और अस्पताल की भागीदारी कार्यक्रम से सीधे सत्यापित करें।',
    programmeDetails: 'पात्रता, दस्तावेज़ और आवेदन की जानकारी',
    eligibility: 'पात्रता',
    documents: 'तैयार रखने वाले दस्तावेज़',
    whereToApply: 'कहाँ आवेदन करें और किससे संपर्क करें',
    officialLinks: 'आधिकारिक लिंक और फ़ॉर्म',
    noSteps: 'दी गई वर्कबुक में इस कार्यक्रम के लिए क्रमांकित आवेदन चरण नहीं हैं। उपलब्ध आवेदन मार्ग के लिए कार्यक्रम का विवरण पृष्ठ देखें।',
    selectAProgramme: 'आवेदन चरण देखने के लिए कोई कार्यक्रम चुनें।'
  },
  te: {
    trackerEyebrow: 'మీ దరఖాస్తు ప్రయాణం',
    trackerTitle: 'దరఖాస్తు ట్రాకర్',
    trackerDescription: 'ఇచ్చిన కార్యక్రమ దశలను అనుసరించండి, పూర్తయిన దశలను గుర్తించండి, అడ్డంకి వస్తే ఏమి చేయాలో చూడండి.',
    selectJourney: 'కార్యక్రమాన్ని ఎంచుకోండి',
    loading: 'కార్యక్రమ దశలు లోడ్ అవుతున్నాయి…',
    localProgress: 'గుర్తించిన దశలు మీ Neravu పురోగతితో సేవ్ అవుతాయి.',
    step: 'దశ {step}',
    progress: '{total}లో {done} దశలు పూర్తయ్యాయి',
    done: 'పూర్తయింది',
    notStarted: 'ప్రారంభం కాలేదు',
    responsible: 'ఎవరు చేస్తారు',
    action: 'ఏం చేయాలి',
    output: 'దాచుకోవాల్సిన ఆధారం లేదా ఫలితం',
    stuck: 'ఈ దశలో ఇబ్బంది ఎదురైతే',
    sourceSnapshot: 'వర్క్‌బుక్ పరిశోధన సారాంశం',
    sourceNotice: 'ఇది అనువదించిన వర్క్‌బుక్ మార్గదర్శకం మాత్రమే, అధికారిక నిర్ణయం కాదు. ప్రస్తుత అర్హత, దరఖాస్తుల స్వీకరణ, పత్రాలు, సంప్రదింపు వివరాలు, ఆసుపత్రి భాగస్వామ్యాన్ని కార్యక్రమం ద్వారా నేరుగా నిర్ధారించండి.',
    programmeDetails: 'అర్హత, పత్రాలు మరియు దరఖాస్తు వివరాలు',
    eligibility: 'అర్హత',
    documents: 'సిద్ధం చేసుకోవాల్సిన పత్రాలు',
    whereToApply: 'ఎక్కడ దరఖాస్తు చేయాలి, ఎవరిని సంప్రదించాలి',
    officialLinks: 'అధికారిక లింకులు మరియు ఫారాలు',
    noSteps: 'ఇచ్చిన వర్క్‌బుక్‌లో ఈ కార్యక్రమానికి సంఖ్యలతో కూడిన దరఖాస్తు దశలు లేవు. అందుబాటులో ఉన్న దరఖాస్తు విధానం కోసం కార్యక్రమ వివరాల పేజీని చూడండి.',
    selectAProgramme: 'దరఖాస్తు దశలను చూడటానికి ఒక కార్యక్రమాన్ని ఎంచుకోండి.'
  },
  ur: {
    trackerEyebrow: 'آپ کے درخواست کا سفر',
    trackerTitle: 'درخواست ٹریکر',
    trackerDescription: 'دیے گئے پروگرام کے مراحل دیکھیں، مکمل مراحل درج کریں اور رکاوٹ آنے پر اگلا قدم جانیں۔',
    selectJourney: 'پروگرام منتخب کریں',
    loading: 'پروگرام کے مراحل لوڈ ہو رہے ہیں…',
    localProgress: 'منتخب مراحل آپ کی Neravu پیش رفت کے ساتھ محفوظ ہوتے ہیں۔',
    step: 'مرحلہ {step}',
    progress: '{total} میں سے {done} مراحل مکمل',
    done: 'مکمل',
    notStarted: 'شروع نہیں ہوا',
    responsible: 'یہ کون کرے گا',
    action: 'کیا کرنا ہے',
    output: 'محفوظ رکھنے کا ثبوت یا نتیجہ',
    stuck: 'اس مرحلے میں رکاوٹ آئے تو',
    sourceSnapshot: 'ورک بک تحقیق کا خلاصہ',
    sourceNotice: 'یہ ترجمہ شدہ ورک بک رہنمائی ہے، سرکاری فیصلہ نہیں۔ موجودہ اہلیت، درخواستوں کی دستیابی، دستاویزات، رابطے اور اسپتال کی شمولیت کی پروگرام سے براہ راست تصدیق کریں۔',
    programmeDetails: 'اہلیت، دستاویزات اور درخواست کی تفصیل',
    eligibility: 'اہلیت',
    documents: 'تیار رکھنے کی دستاویزات',
    whereToApply: 'کہاں درخواست دیں اور کس سے رابطہ کریں',
    officialLinks: 'سرکاری روابط اور فارم',
    noSteps: 'فراہم کردہ ورک بک میں اس پروگرام کے لیے نمبر وار درخواست کے مراحل موجود نہیں ہیں۔ دستیاب درخواست کے طریقے کے لیے پروگرام کی تفصیل دیکھیں۔',
    selectAProgramme: 'درخواست کے مراحل دیکھنے کے لیے پروگرام منتخب کریں۔'
  },
  pa: {
    trackerEyebrow: 'ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਯਾਤਰਾ',
    trackerTitle: 'ਅਰਜ਼ੀ ਟ੍ਰੈਕਰ',
    trackerDescription: 'ਦਿੱਤੇ ਪ੍ਰੋਗਰਾਮ ਦੇ ਪੜਾਅ ਵੇਖੋ, ਪੂਰੇ ਕੀਤੇ ਪੜਾਅ ਨਿਸ਼ਾਨ ਲਗਾਓ ਅਤੇ ਰੁਕਾਵਟ ਆਉਣ ਤੇ ਅਗਲਾ ਕਦਮ ਜਾਣੋ।',
    selectJourney: 'ਪ੍ਰੋਗਰਾਮ ਚੁਣੋ',
    loading: 'ਪ੍ਰੋਗਰਾਮ ਦੇ ਪੜਾਅ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…',
    localProgress: 'ਚੁਣੇ ਪੜਾਅ ਤੁਹਾਡੀ Neravu ਤਰੱਕੀ ਨਾਲ ਸੰਭਾਲੇ ਜਾਂਦੇ ਹਨ।',
    step: 'ਪੜਾਅ {step}',
    progress: '{total} ਵਿੱਚੋਂ {done} ਪੜਾਅ ਪੂਰੇ',
    done: 'ਪੂਰਾ',
    notStarted: 'ਸ਼ੁਰੂ ਨਹੀਂ ਹੋਇਆ',
    responsible: 'ਇਹ ਕੌਣ ਕਰੇਗਾ',
    action: 'ਕੀ ਕਰਨਾ ਹੈ',
    output: 'ਸੰਭਾਲਣ ਵਾਲਾ ਸਬੂਤ ਜਾਂ ਨਤੀਜਾ',
    stuck: 'ਇਸ ਪੜਾਅ ਤੇ ਅਟਕਣ ਤੇ',
    sourceSnapshot: 'ਵਰਕਬੁੱਕ ਖੋਜ ਦਾ ਸਾਰ',
    sourceNotice: 'ਇਹ ਅਨੁਵਾਦ ਕੀਤੀ ਵਰਕਬੁੱਕ ਜਾਣਕਾਰੀ ਹੈ, ਸਰਕਾਰੀ ਫ਼ੈਸਲਾ ਨਹੀਂ। ਮੌਜੂਦਾ ਯੋਗਤਾ, ਅਰਜ਼ੀ ਸਵੀਕਾਰਤਾ, ਦਸਤਾਵੇਜ਼, ਸੰਪਰਕ ਅਤੇ ਹਸਪਤਾਲ ਦੀ ਭਾਗੀਦਾਰੀ ਪ੍ਰੋਗਰਾਮ ਨਾਲ ਸਿੱਧੀ ਪੱਕੀ ਕਰੋ।',
    programmeDetails: 'ਯੋਗਤਾ, ਦਸਤਾਵੇਜ਼ ਅਤੇ ਅਰਜ਼ੀ ਜਾਣਕਾਰੀ',
    eligibility: 'ਯੋਗਤਾ',
    documents: 'ਤਿਆਰ ਰੱਖਣ ਵਾਲੇ ਦਸਤਾਵੇਜ਼',
    whereToApply: 'ਕਿੱਥੇ ਅਰਜ਼ੀ ਦੇਣੀ ਹੈ ਅਤੇ ਕਿਸ ਨਾਲ ਸੰਪਰਕ ਕਰਨਾ ਹੈ',
    officialLinks: 'ਅਧਿਕਾਰਤ ਲਿੰਕ ਅਤੇ ਫਾਰਮ',
    noSteps: 'ਦਿੱਤੀ ਵਰਕਬੁੱਕ ਵਿੱਚ ਇਸ ਪ੍ਰੋਗਰਾਮ ਲਈ ਨੰਬਰ ਵਾਲੇ ਅਰਜ਼ੀ ਪੜਾਅ ਨਹੀਂ ਹਨ। ਉਪਲਬਧ ਅਰਜ਼ੀ ਰਸਤੇ ਲਈ ਪ੍ਰੋਗਰਾਮ ਦਾ ਵੇਰਵਾ ਪੰਨਾ ਵੇਖੋ।',
    selectAProgramme: 'ਅਰਜ਼ੀ ਦੇ ਪੜਾਅ ਵੇਖਣ ਲਈ ਪ੍ਰੋਗਰਾਮ ਚੁਣੋ।'
  }
};

export function guidanceText(language, key, values = {}) {
  let text = guidanceUi[language]?.[key] || guidanceUi.en[key] || key;
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

const guidanceLoaders = import.meta.glob('./schemeGuidance/*.json');
const normalizeName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function getSchemeGuidanceIndex(schemeId) {
  return schemeGuidance.find((scheme) => scheme.id === schemeId);
}

export async function loadSchemeGuidance(schemeId) {
  const load = guidanceLoaders[`./schemeGuidance/${schemeId}.json`];
  if (!load) throw new Error(`No guidance file exists for programme "${schemeId}".`);
  const module = await load();
  return module.default;
}

export function findSchemeGuidance(scheme) {
  const names = [scheme?.official_name, scheme?.name, scheme?.programme_code]
    .map(normalizeName)
    .filter(Boolean);
  return schemeGuidance.find((entry) => entry.aliases.some((alias) => names.includes(normalizeName(alias))));
}

export function buildSchemeCards(publishedSchemes = [], language = 'en') {
  const matchedIds = new Set();
  const cards = schemeGuidance.map((entry) => {
    const published = publishedSchemes.find((scheme) => findSchemeGuidance(scheme)?.id === entry.id);
    if (published) matchedIds.add(published.id);
    const summary = entry.journeySummary?.[0] || {};
    const government = entry.governmentRecords?.[0] || {};
    const localized = entry.translations?.[language] || {};
    const localizedSummary = localized.journeySummary?.[0] || {};
    return {
      ...published,
      id: published?.id || entry.id,
      official_name: localizedSummary.Programme || localized.name || published?.official_name || entry.name,
      aliases: entry.aliases,
      programme_type: localizedSummary['Programme Type'] || localized.programmeType || published?.programme_type || entry.programmeType,
      description: localizedSummary['Who May Apply / Eligibility Snapshot']
        || localized.description
        || published?.description
        || summary['Who May Apply / Eligibility Snapshot']
        || government['Eligibility Summary']
        || '',
      eligibilitySummary: entry.eligibilitySummary || government['Eligibility Summary'] || '',
      documentsToPrepare: entry.documentsToPrepare || summary['Documents to Prepare'] || government['Documents Commonly Required'] || '',
      stateCoverage: entry.stateCoverage || government['State / UT Coverage'] || '',
      governmentLevel: entry.governmentLevel || government['Government Level'] || '',
      guidanceSlug: entry.id,
      isWorkbook: true,
      liveSchemeId: published?.id || '',
      link: entry.officialLinks[0] || ''
    };
  });
  return cards.concat(publishedSchemes.filter((scheme) => !matchedIds.has(scheme.id)));
}
