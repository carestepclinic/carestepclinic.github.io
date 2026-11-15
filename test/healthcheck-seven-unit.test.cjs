const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../healthcheck-record.js');
test('followup budget reserves all structured metadata and the separating newline',()=>{
 const fields={'재검 날짜':'2026-12-01','예정 검사':'혈액검사'},value=H.joinClinicalText(fields,'메모');
 const b=H.followupBudget(value);assert.equal(b.used,value.length);assert.equal(H.joinClinicalText(fields,'가'.repeat(b.maxNote)).length,8000);assert.equal(H.followupBudget('').maxNote,8000);
 assert.equal(H.followupBudget(H.joinClinicalText(fields,'가'.repeat(8000))).used,8030);
});
test('followup date shortcuts use the supplied basis and clamp month-end dates',()=>{
 assert.equal(H.followupDate('2026-11-01','7'),'2026-11-08');assert.equal(H.followupDate('2026-11-15','14'),'2026-11-29');
 assert.equal(H.followupDate('2026-01-31','month'),'2026-02-28');assert.equal(H.followupDate('2028-01-31','month'),'2028-02-29');assert.equal(H.followupDate('2026-02-30','7'),'');
});
test('prose limits match persisted text limits',()=>{assert.equal(H.proseLimit('overview'),1500);for(const k of ['summary','management','followup','questions'])assert.equal(H.proseLimit(k),8000);});
