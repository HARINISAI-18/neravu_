import research from '../../backend/app/data/hospitalResearch.json';

const normalize = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const schemeAliases = [
  { key: 'pmjay', patterns: [/pm ?jay/, /ayushman bharat/] },
  { key: 'ntr-vaidya-seva', patterns: [/ntr vaidya seva/, /aarogyasri/] },
  { key: 'hmcpf', patterns: [/hmcpf/, /rashtriya arogya nidhi/, /\bran\b/] },
  { key: 'hmdg', patterns: [/hmdg/, /health minister.*discretionary/] },
  { key: 'pmnrf', patterns: [/pmnrf/, /prime minister.*national relief/] },
  { key: 'cghs', patterns: [/\bcghs\b/, /central government health scheme/] },
  { key: 'tata-trusts', patterns: [/tata trusts?/] },
  { key: 'delhi-arogya-kosh', patterns: [/delhi arogya kosh/] },
  { key: 'ics-cancer-cure', patterns: [/indian cancer society.*cancer cure/, /ics cancer cure/] },
  { key: 'cpaa', patterns: [/\bcpaa\b/, /cancer patients aid association/] },
  { key: 'cankids', patterns: [/cankids/, /can kids/] },
  { key: 'cuddles-foundation', patterns: [/cuddles foundation/] },
  { key: 'st-jude', patterns: [/st jude/] }
];

const ngoAliases = [
  { key: 'ics-cancer-cure', patterns: [/indian cancer society.*cancer cure/, /ics cancer cure/] },
  { key: 'cuddles-foundation', patterns: [/cuddles foundation/] },
  { key: 'cankids', patterns: [/cankids/, /can kids/] },
  { key: 'st-jude', patterns: [/st jude/] },
  { key: 'cpaa', patterns: [/cpaa/, /cancer patients aid association/] },
  { key: 'cansupport', patterns: [/cansupport/] },
  { key: 'pallium-india', patterns: [/pallium/] },
  { key: 'dhanvantari-cancer-foundation', patterns: [/dhanvantari/] },
  { key: 'bengal-cancer-foundation', patterns: [/bengal cancer foundation/] },
  { key: 'kdfcc', patterns: [/kalpana datta/, /kdfcc/] },
  { key: 'garia-welfare-society', patterns: [/garia welfare society/] },
  { key: 'hitaishini', patterns: [/hitaishini/] },
  { key: 'kamlesh-cancer-foundation', patterns: [/kamlesh cancer foundation/] },
  { key: 'ganga-prem-hospice', patterns: [/ganga prem/] },
  { key: 'can-protect-foundation', patterns: [/can protect/] },
  { key: 'him-samvad', patterns: [/him samvad/] }
];

function keysFromAliases(value, aliases) {
  const normalized = normalize(value);
  if (!normalized) return [];
  return aliases
    .filter(({ patterns }) => patterns.some((pattern) => pattern.test(normalized)))
    .map(({ key }) => key);
}

function forProgrammeKeys(keys) {
  const selected = new Set(keys);
  return {
    mappings: research.hospitalMappings.filter((record) => (
      record.programmeKeys.some((key) => selected.has(key))
    )),
    rules: research.programmeRules.filter((record) => (
      record.programmeKeys.some((key) => selected.has(key))
    ))
  };
}

export function getHospitalResearchForScheme(schemeId, programmeName = '') {
  const id = normalize(schemeId);
  const aliases = keysFromAliases(programmeName, schemeAliases);
  const idKeys = keysFromAliases(id, schemeAliases);
  const guidanceKeys = [
    'pmjay', 'ntr-vaidya-seva', 'hmcpf', 'hmdg', 'pmnrf', 'cghs',
    'tata-trusts', 'delhi-arogya-kosh', 'ics-cancer-cure', 'cpaa', 'cankids'
  ];
  const directKey = guidanceKeys.find((key) => id.replaceAll(' ', '-') === key);
  return forProgrammeKeys([...new Set([...aliases, ...idKeys, ...(directKey ? [directKey] : [])])]);
}

export function getHospitalResearchForNgo(organizationName) {
  return forProgrammeKeys(keysFromAliases(organizationName, ngoAliases));
}

export const hospitalResearchSource = research.sourceWorkbook;
