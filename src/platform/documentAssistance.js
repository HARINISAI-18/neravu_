export const documentAssistance = [
  {
    id: 'aadhaar',
    category: 'identityInsurance',
    icon: 'identity',
    name: 'document.aadhaar.name',
    purpose: 'document.aadhaar.purpose',
    status: 'documents.status.conditional',
    availability: 'documents.online.available',
    requiredDetails: 'document.aadhaar.details',
    digitalCopy: 'document.aadhaar.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.aadhaar.step1',
      'document.aadhaar.step2',
      'document.aadhaar.step3',
      'document.aadhaar.step4',
      'document.aadhaar.step5',
      'document.aadhaar.step6'
    ],
    progressKey: 'Patient identity proof (Aadhaar / accepted government ID)',
    portals: [{ label: 'myAadhaar — UIDAI', url: 'https://myaadhaar.uidai.gov.in/' }],
    schemeIds: ['pmjay', 'pmnrf', 'hmdg', 'hmcpf', 'delhi-arogya-kosh', 'youwecan', 'ics-cancer-cure', 'cpaa', 'cghs'],
    ngoKeys: ['ics-cancer-cure', 'cankids', 'tata-trusts', 'cpaa'],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'health-insurance-card',
    category: 'identityInsurance',
    icon: 'insurance',
    name: 'document.insuranceCard.name',
    purpose: 'document.insuranceCard.purpose',
    status: 'documents.status.schemeSpecific',
    availability: 'documents.online.usually',
    requiredDetails: 'document.insuranceCard.details',
    digitalCopy: 'document.insuranceCard.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.insuranceCard.step1',
      'document.insuranceCard.step2',
      'document.insuranceCard.step3',
      'document.insuranceCard.step4',
      'document.insuranceCard.step5'
    ],
    progressKey: 'Other scheme / insurance details',
    portals: [],
    schemeIds: ['cghs', 'swasthya-sathi', 'atal-ayushman-uttarakhand'],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: false
  },
  {
    id: 'ayushman-card',
    category: 'identityInsurance',
    icon: 'insurance',
    name: 'document.ayushmanCard.name',
    purpose: 'document.ayushmanCard.purpose',
    status: 'documents.status.schemeSpecific',
    availability: 'documents.online.eligible',
    requiredDetails: 'document.ayushmanCard.details',
    digitalCopy: 'document.ayushmanCard.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.ayushmanCard.step1',
      'document.ayushmanCard.step2',
      'document.ayushmanCard.step3',
      'document.ayushmanCard.step4',
      'document.ayushmanCard.step5',
      'document.ayushmanCard.step6'
    ],
    portals: [{ label: 'PM-JAY Beneficiary Portal — NHA', url: 'https://beneficiary.nha.gov.in/' }],
    schemeIds: ['pmjay'],
    ngoKeys: [],
    insurance: false,
    clinicalAssistance: false
  },
  {
    id: 'ration-card',
    category: 'financial',
    icon: 'eligibility',
    name: 'document.rationCard.name',
    purpose: 'document.rationCard.purpose',
    status: 'documents.status.conditional',
    availability: 'documents.online.stateDependent',
    requiredDetails: 'document.rationCard.details',
    digitalCopy: 'document.rationCard.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.rationCard.step1',
      'document.rationCard.step2',
      'document.rationCard.step3',
      'document.rationCard.step4',
      'document.rationCard.step5'
    ],
    progressKey: 'BPL / ration card / NFSA proof',
    portals: [{ label: 'NFSA — State Food Portals', url: 'https://nfsa.gov.in/portal/State_Food_Portals' }],
    schemeIds: ['hmcpf', 'hmdg', 'delhi-arogya-kosh', 'wb-cmrf', 'swasthya-sathi', 'uttarakhand-cmrf', 'atal-ayushman-uttarakhand', 'west-bengal-governor-s-welfare-fund-medical-assistance', 'major-ailments'],
    ngoKeys: [],
    insurance: false,
    clinicalAssistance: false
  },
  {
    id: 'income-certificate',
    category: 'financial',
    icon: 'eligibility',
    name: 'document.incomeCertificate.name',
    purpose: 'document.incomeCertificate.purpose',
    status: 'documents.status.conditional',
    availability: 'documents.online.stateDependent',
    requiredDetails: 'document.incomeCertificate.details',
    digitalCopy: 'document.incomeCertificate.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.incomeCertificate.step1',
      'document.incomeCertificate.step2',
      'document.incomeCertificate.step3',
      'document.incomeCertificate.step4',
      'document.incomeCertificate.step5',
      'document.incomeCertificate.step6'
    ],
    progressKey: 'Family income certificate / income proof',
    portals: [{ label: 'Andhra Pradesh MeeSeva', url: 'https://ap.meeseva.gov.in/IMeeSeva2/IMeesevaHome.aspx' }],
    schemeIds: ['pmnrf', 'hmdg', 'hmcpf', 'delhi-arogya-kosh', 'youwecan', 'ics-cancer-cure', 'tata-trusts', 'cpaa'],
    ngoKeys: ['ics-cancer-cure', 'tata-trusts', 'cpaa'],
    insurance: false,
    clinicalAssistance: false
  },
  {
    id: 'bank-statement',
    category: 'payment',
    icon: 'payment',
    name: 'document.bankStatement.name',
    purpose: 'document.bankStatement.purpose',
    status: 'documents.status.conditional',
    availability: 'documents.online.usually',
    requiredDetails: 'document.bankStatement.details',
    digitalCopy: 'document.bankStatement.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.bankStatement.step1',
      'document.bankStatement.step2',
      'document.bankStatement.step3',
      'document.bankStatement.step4',
      'document.bankStatement.step5',
      'document.bankStatement.step6'
    ],
    progressKey: 'Bank passbook / cancelled cheque',
    portals: [],
    schemeIds: ['cpaa'],
    ngoKeys: ['cpaa'],
    insurance: true,
    clinicalAssistance: false
  },
  {
    id: 'cancelled-cheque',
    category: 'payment',
    icon: 'payment',
    name: 'document.cancelledCheque.name',
    purpose: 'document.cancelledCheque.purpose',
    status: 'documents.status.conditional',
    availability: 'documents.online.unavailable',
    requiredDetails: 'document.cancelledCheque.details',
    digitalCopy: 'document.cancelledCheque.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.cancelledCheque.step1',
      'document.cancelledCheque.step2',
      'document.cancelledCheque.step3',
      'document.cancelledCheque.step4',
      'document.cancelledCheque.step5'
    ],
    progressKey: 'Bank passbook / cancelled cheque',
    portals: [],
    schemeIds: ['cpaa'],
    ngoKeys: ['cpaa'],
    insurance: true,
    clinicalAssistance: false
  },
  {
    id: 'pan-card',
    category: 'conditional',
    icon: 'identity',
    name: 'document.pan.name',
    purpose: 'document.pan.purpose',
    status: 'documents.status.conditional',
    availability: 'documents.online.conditional',
    requiredDetails: 'document.pan.details',
    digitalCopy: 'document.pan.digital',
    alternatives: 'documents.noAssumedAlternatives',
    instructions: [
      'document.pan.step1',
      'document.pan.step2',
      'document.pan.step3',
      'document.pan.step4'
    ],
    portals: [
      { label: 'Income Tax Department e-Filing Portal', url: 'https://www.incometax.gov.in/' },
      { label: 'Protean PAN Services', url: 'https://www.protean-tinpan.com/' }
    ],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: false
  },
  {
    id: 'cancer-diagnosis',
    category: 'medical',
    icon: 'medical',
    name: 'document.cancerDiagnosis.name',
    purpose: 'document.cancerDiagnosis.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.cancerDiagnosis.details',
    provider: 'document.cancerDiagnosis.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    progressKey: 'Cancer diagnosis / histopathology / biopsy report',
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'biopsy-report',
    category: 'medical',
    icon: 'medical',
    name: 'document.biopsy.name',
    purpose: 'document.biopsy.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.biopsy.details',
    provider: 'document.biopsy.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    progressKey: 'Cancer diagnosis / histopathology / biopsy report',
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'imaging-reports',
    category: 'medical',
    icon: 'medical',
    name: 'document.imaging.name',
    purpose: 'document.imaging.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.imaging.details',
    provider: 'document.imaging.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    progressKey: 'Staging / imaging / discharge summary',
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'doctor-recommendation',
    category: 'medical',
    icon: 'medical',
    name: 'document.doctorRecommendation.name',
    purpose: 'document.doctorRecommendation.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.doctorRecommendation.details',
    provider: 'document.doctorRecommendation.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    progressKey: 'Treating oncologist prescription / treatment plan',
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'treatment-estimate',
    category: 'medical',
    icon: 'medical',
    name: 'document.treatmentEstimate.name',
    purpose: 'document.treatmentEstimate.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.treatmentEstimate.details',
    provider: 'document.treatmentEstimate.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    progressKey: 'Detailed treatment cost estimate',
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'discharge-summary',
    category: 'medical',
    icon: 'medical',
    name: 'document.dischargeSummary.name',
    purpose: 'document.dischargeSummary.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.dischargeSummary.details',
    provider: 'document.dischargeSummary.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    progressKey: 'Staging / imaging / discharge summary',
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  },
  {
    id: 'prescriptions-bills',
    category: 'medical',
    icon: 'medical',
    name: 'document.prescriptionsBills.name',
    purpose: 'document.prescriptionsBills.purpose',
    status: 'documents.status.hospitalIssued',
    availability: 'documents.online.hospitalRecord',
    requiredDetails: 'document.prescriptionsBills.details',
    provider: 'document.prescriptionsBills.provider',
    digitalCopy: 'documents.medical.digital',
    alternatives: 'documents.medical.alternatives',
    instructions: [
      'documents.medical.step1',
      'documents.medical.step2',
      'documents.medical.step3',
      'documents.medical.step4'
    ],
    portals: [],
    schemeIds: [],
    ngoKeys: [],
    insurance: true,
    clinicalAssistance: true
  }
];

export function getDocumentAssistanceForTarget(target) {
  if (!target || target.type === 'directory') return documentAssistance;
  if (target.type === 'insurance') {
    return documentAssistance.filter((document) => document.insurance);
  }
  if (target.type === 'scheme') {
    return documentAssistance.filter((document) => (
      document.schemeIds.includes(target.schemeId)
      || document.clinicalAssistance
      || document.id === 'pan-card'
    ));
  }
  if (target.type === 'ngo') {
    const name = String(target.name || '').toLocaleLowerCase();
    const ngoKeys = [
      [/indian cancer society.*cancer cure/i, 'ics-cancer-cure'],
      [/cuddles/i, 'cuddles-foundation'],
      [/cankids|can.?kids/i, 'cankids'],
      [/st\.?\s*jude/i, 'st-jude'],
      [/tata trusts?/i, 'tata-trusts'],
      [/cpaa|cancer patients aid association/i, 'cpaa']
    ].filter(([pattern]) => pattern.test(name)).map(([, key]) => key);
    return documentAssistance.filter((document) => (
      document.clinicalAssistance
      || document.ngoKeys.some((key) => ngoKeys.includes(key))
      || document.id === 'pan-card'
    ));
  }
  return [];
}
