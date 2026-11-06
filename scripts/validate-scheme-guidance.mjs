import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const indexUrl = new URL('../src/platform/schemeCatalog.json', import.meta.url);
const guidance = JSON.parse(await readFile(fileURLToPath(indexUrl), 'utf8'));
const records = await Promise.all(guidance.schemes.map(async ({ id }) => {
  const fileUrl = new URL(`../src/platform/schemeGuidance/${id}.json`, import.meta.url);
  return JSON.parse(await readFile(fileURLToPath(fileUrl), 'utf8'));
}));

assert.equal(guidance.counts.journeyProgrammes, 12, 'all workbook journey programmes must be included');
assert.equal(guidance.counts.applicationJourneys, 94, 'all application steps must be included');
assert.equal(guidance.counts.governmentDirectoryEntries, 10, 'all government directory entries must be included');
assert.equal(guidance.counts.researchProgrammes, 13, 'all detailed research records, including CGHS, must be included');
assert.equal(guidance.schemes.length, 19, 'overlapping workbook records must be merged without losing unique programmes');
assert.equal(guidance.patientDocumentChecklist.length, 16, 'all reusable patient checklist entries must be included');
assert.equal(guidance.ngoDirectory.length, 16, 'all NGO directory records must be included in the offline catalogue');
assert.equal(guidance.stateTracker.length, 28, 'all state tracker records must be included in the offline catalogue');
assert.equal(guidance.schemes.find((scheme) => scheme.id === 'delhi-arogya-kosh')?.stateCoverage, 'Delhi');
assert.equal(guidance.sourceSheetCounts.supportDirectory['NGO Directory'], 16);
assert.equal(guidance.sourceSheetCounts.supportDirectory['State Tracker'], 28);
assert.equal(guidance.sourceSheetCounts.supportDirectory['Source Register'], 16);
const locales = ['mr', 'bn', 'kn', 'hi', 'te', 'ur', 'pa'];
for (const locale of locales) {
  assert.ok(guidance.patientDocumentChecklistByLanguage[locale]?.length === 16, `${locale} patient checklist must be complete`);
}

const byId = new Map(records.map((scheme) => [scheme.id, scheme]));
for (const organization of guidance.ngoDirectory) {
  assert.ok(organization['Organisation Name'], 'each NGO entry needs its workbook organisation name');
  assert.ok(organization['What Support Is Offered'], `${organization['Organisation Name']} needs support details`);
}
assert.equal(byId.get('pmjay').applicationSteps.length, 7);
assert.equal(byId.get('pmnrf').applicationSteps.length, 7);
assert.equal(byId.get('hmdg').applicationSteps.length, 8);
assert.equal(byId.get('hmcpf').applicationSteps.length, 8);
assert.equal(byId.get('delhi-arogya-kosh').applicationSteps.length, 8);
assert.equal(byId.get('aas').applicationSteps.length, 7);
assert.equal(byId.get('youwecan').applicationSteps.length, 8);
assert.equal(byId.get('ics-parent').applicationSteps.length, 7);
assert.equal(byId.get('cankids').applicationSteps.length, 8);
assert.equal(byId.get('tata-trusts').applicationSteps.length, 9);
assert.equal(byId.get('cpaa').applicationSteps.length, 9);
assert.equal(byId.get('ics-cancer-cure').applicationSteps.length, 8);
assert.equal(byId.get('cghs').researchDetails.length, 65);
assert.ok(byId.get('hmcpf').sourceVerifications.length > 0, 'HMCPF source caveats must be preserved');
assert.ok(byId.get('wb-cmrf').governmentRecords.length > 0, 'state government schemes must be included');
assert.equal(records.filter((scheme) => scheme.researchDetails.length === 65).length, 13);

for (const locale of locales) {
  const localizedJourneyCount = records.reduce((sum, scheme) => (
    sum + (scheme.translations?.[locale]?.applicationSteps?.length || 0)
  ), 0);
  assert.equal(localizedJourneyCount, 94, `${locale} must include all translated application steps`);
  assert.equal(byId.get('pmjay').translations[locale].researchDetails.length, 65);
  assert.equal(
    byId.get('pmjay').translations[locale].sourceVerifications.length,
    byId.get('pmjay').sourceVerifications.length,
    `${locale} must preserve all PM-JAY source verification records`
  );
  assert.ok(byId.get('pmjay').translations[locale].applicationSteps[0]['What to Do']);
  assert.ok(byId.get('pmjay').translations[locale].labels.applicationSteps['What to Do']);
  assert.notEqual(byId.get('pmjay').translations[locale].applicationSteps[0]['Step / Action'], byId.get('pmjay').applicationSteps[0]['Step / Action']);
}

for (const scheme of records) {
  assert.ok(scheme.name, `scheme ${scheme.id} needs a display name`);
  assert.ok(scheme.aliases.length > 0, `scheme ${scheme.id} needs source aliases`);
  for (const step of scheme.applicationSteps || []) {
    assert.ok(step['Step No.'], `${scheme.id} has a step without its workbook step number`);
    assert.ok(step['If This Step Gets Stuck'], `${scheme.id} has a step without its workbook troubleshooting field`);
    assert.ok(step['What to Do'], `${scheme.id} has a step without its workbook instructions`);
  }
}

console.log(`Validated ${guidance.schemes.length} programme records and ${guidance.counts.applicationJourneys} application steps.`);
