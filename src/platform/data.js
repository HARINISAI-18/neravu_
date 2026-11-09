export const languageOptions = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' }
];

const stateOptions = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
const applicationStatusOptions = ['Yes', 'No', 'We applied and are waiting for a decision', "I'm not sure", 'Prefer to skip'];
const cancerTypeOptions = [
  'Bladder cancer', 'Bone cancer', 'Brain cancer', 'Breast cancer', 'Cervical cancer',
  'Colorectal cancer', 'Endometrial cancer', 'Esophageal cancer', 'Eye cancer',
  'Gallbladder cancer', 'Head and neck cancer', 'Hodgkin lymphoma', 'Kidney cancer',
  'Liver cancer', 'Lung cancer', 'Melanoma', 'Multiple myeloma', 'Neuroblastoma',
  'Non-Hodgkin lymphoma', 'Oral cancer', 'Ovarian cancer', 'Pancreatic cancer',
  'Prostate cancer', 'Stomach cancer', 'Thyroid cancer', 'Uterine cancer',
  'Leukemia', 'Other'
];

export const questionDefinitions = [
  { key: 'state', section: 'person', type: 'state', prompt: 'q.state', options: stateOptions, required: true },
  { key: 'cancerCareStage', section: 'cancer', type: 'select', prompt: 'intake.cancerCareStage', options: ['Waiting for tests or a diagnosis', 'Diagnosed and planning treatment', 'Treatment is ongoing', 'Treatment is complete and follow-up care is needed', "I'm not sure"], required: true },
  { key: 'cancerType', section: 'cancer', type: 'search', prompt: 'intake.cancerType', placeholder: 'intake.cancerTypePlaceholder', options: cancerTypeOptions, conditional: (answers) => answers.cancerCareStage === 'Diagnosed and planning treatment', optional: true },
  { key: 'expenses', section: 'financial', type: 'multiselect', prompt: 'intake.expenses', options: ['Tests or scans', 'Surgery', 'Chemotherapy or other cancer medicines', 'Radiation therapy', 'Hospital stay', 'Follow-up care', 'Travel or accommodation', 'Other costs', "I'm not sure yet"], required: true },
  { key: 'assistanceAmount', section: 'financial', type: 'amount', prompt: 'intake.assistanceAmount', optional: true },
  { key: 'hospitalStatus', section: 'cancer', type: 'select', prompt: 'intake.hospitalStatus', options: ['Yes, care is planned or underway there', "We're still deciding", "I'm not sure"], required: true },
  { key: 'hospitalName', section: 'cancer', type: 'hospital', prompt: 'intake.hospitalName', placeholder: 'intake.hospitalNamePlaceholder', options: [], conditional: (answers) => answers.hospitalStatus === 'Yes, care is planned or underway there', required: true },
  { key: 'hospitalType', section: 'cancer', type: 'select', prompt: 'intake.hospitalType', options: ['Government or public hospital', 'Private hospital', 'Charitable or trust hospital', "I'm not sure"], conditional: (answers) => answers.hospitalStatus === 'Yes, care is planned or underway there', required: true },
  { key: 'receivedAssistance', section: 'assistance', type: 'select', prompt: 'intake.receivedAssistance', options: applicationStatusOptions, required: true },
  { key: 'assistanceProgramme', section: 'assistance', type: 'search', prompt: 'intake.assistanceProgramme', placeholder: 'intake.assistanceProgrammePlaceholder', options: [], conditional: (answers) => ['Yes', 'We applied and are waiting for a decision'].includes(answers.receivedAssistance), optional: true }
];

export function getApplicableQuestions(definitions, answers = {}, candidates = []) {
  const candidateText = candidates.map((candidate) => [
    candidate.eligibilitySummary,
    candidate.documentsToPrepare,
    candidate.description,
    candidate.eligibility,
    candidate.what_support_offered
  ].filter(Boolean).join(' ')).join(' ');
  return definitions.filter((question) => {
    if (question.conditional && !question.conditional(answers, candidates)) return false;
    return !question.requiredIfCandidate || question.requiredIfCandidate.test(candidateText);
  });
}

export const sectionLabels = {
  person: 'section.person',
  cancer: 'section.cancer',
  assistance: 'section.assistance',
  financial: 'section.financial'
};

export const demoSchemes = [
  {
    id: 'pmjay',
    name: 'Ayushman Bharat PM-JAY',
    category: 'Government healthcare scheme',
    description: 'A national health assurance programme. Check official sources and your state’s current implementation for applicable details.',
    status: 'Demo catalogue · verify with official source',
    link: 'https://pmjay.gov.in/'
  },
  {
    id: 'pmnrf',
    name: 'Prime Minister’s National Relief Fund',
    category: 'Government financial assistance',
    description: 'A relief fund with a process and requirements that must be confirmed through official channels.',
    status: 'Demo catalogue · verify current process',
    link: 'https://pmnrf.gov.in/'
  },
  {
    id: 'hmdg',
    name: 'Health Minister’s Discretionary Grant',
    category: 'Government financial assistance',
    description: 'Assistance information is shown for discovery only. Confirm current eligibility and application steps with official sources.',
    status: 'Demo catalogue · verify current process',
    link: 'https://mohfw.gov.in/'
  },
  {
    id: 'state',
    name: 'State-specific assistance programmes',
    category: 'State government support',
    description: 'Programmes vary by state. Neravu has not connected a verified state scheme directory yet.',
    status: 'Demo catalogue · state directory not connected',
    link: null
  }
];

export const demoOrganizations = [
  { name: 'Indian Cancer Society', description: 'Example organization listing. Support availability, location coverage and current services are not verified in this demo.' },
  { name: 'Cancer Patients Aid Association', description: 'Example organization listing. Please confirm current programmes and application requirements directly.' },
  { name: 'CanSupport', description: 'Example organization listing. Services and geographic availability are not verified in this demo.' },
  { name: 'Cuddles Foundation', description: 'Example organization listing. Please confirm current support and eligibility directly.' }
];

export const baseChecklist = [
  'Government photo ID',
  'Recent medical records and diagnosis reports',
  'Hospital treatment plan and cost estimate',
  'Income certificate, if available',
  'Ration card, if available',
  'Bank account details, if requested by the programme'
];

export function normalizeAssessmentAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
  const normalized = { ...answers };
  if (normalized.annual_family_income === undefined && normalized.annualIncome !== undefined) {
    normalized.annual_family_income = normalized.annualIncome;
  }
  delete normalized.annualIncome;
  return normalized;
}
