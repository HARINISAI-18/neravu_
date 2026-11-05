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

export const questionDefinitions = [
  { key: 'relationship', section: 'person', type: 'select', prompt: 'q.relationship', options: ['Myself', 'Parent', 'Spouse', 'Child', 'Other family member'], required: true },
  { key: 'age', section: 'person', type: 'text', inputType: 'number', prompt: 'q.age', placeholder: 'q.agePlaceholder', optional: true },
  { key: 'state', section: 'person', type: 'select', prompt: 'q.state', options: ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'], required: true },
  { key: 'district', section: 'person', type: 'text', prompt: 'q.district', placeholder: 'q.districtPlaceholder', optional: true },
  { key: 'annual_family_income', section: 'person', type: 'select', prompt: 'q.annualIncome', options: ['Below ₹1 lakh', '₹1–3 lakh', '₹3–5 lakh', '₹5–10 lakh', 'Above ₹10 lakh', 'Not sure', 'Prefer not to say'], required: true },
  { key: 'familyCategory', section: 'person', type: 'select', prompt: 'q.familyCategory', options: ['General', 'Scheduled Caste (SC)', 'Scheduled Tribe (ST)', 'Other Backward Class (OBC)', 'Minority community', 'Other', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'diagnosed', section: 'cancer', type: 'select', prompt: 'q.diagnosed', options: ['Yes', 'No', 'Diagnosis pending', 'Not sure', 'Prefer not to say'], required: true },
  { key: 'cancerType', section: 'cancer', type: 'select', prompt: 'q.cancerType', options: ['Breast', 'Blood', 'Lung', 'Cervical', 'Oral', 'Other', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'treatmentStatus', section: 'cancer', type: 'select', prompt: 'q.treatmentStatus', options: ['Not started', 'Chemotherapy', 'Radiation', 'Surgery', 'Follow-up', 'Completed', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'hospitalType', section: 'cancer', type: 'select', prompt: 'q.hospitalType', options: ['Government', 'Private', 'Not admitted', 'Not sure', 'Prefer not to say'], required: true },
  { key: 'pmjayCard', section: 'assistance', type: 'select', prompt: 'q.pmjayCard', options: ['Yes', 'No', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'rationCard', section: 'assistance', type: 'select', prompt: 'q.rationCard', options: ['Yes', 'No', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'incomeCertificate', section: 'assistance', type: 'select', prompt: 'q.incomeCertificate', options: ['Yes', 'No', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'receivedAssistance', section: 'assistance', type: 'select', prompt: 'q.receivedAssistance', options: ['Yes', 'No', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'empanelledHospital', section: 'assistance', type: 'select', prompt: 'q.empanelledHospital', options: ['Yes', 'No', 'Not sure', 'Prefer not to say'], optional: true },
  { key: 'assistanceAmount', section: 'financial', type: 'select', prompt: 'q.assistanceAmount', options: ['Below ₹50,000', '₹50,000–₹1 lakh', '₹1–5 lakh', 'Above ₹5 lakh', 'Not sure', 'Prefer not to say'], required: true },
  { key: 'expenses', section: 'financial', type: 'multiselect', prompt: 'q.expenses', options: ['Chemotherapy', 'Surgery', 'Radiation', 'Medicines', 'Hospitalization', 'Diagnostics', 'Travel and Accommodation', 'Other'], optional: true }
];

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
