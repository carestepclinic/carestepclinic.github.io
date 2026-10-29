// Offline checks only. No browser execution, credentials, writes, or remote requests.
import {readFileSync, lstatSync} from 'node:fs';
import {resolve, basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const uiFiles = new Set([
 'clinic-navigation.js','clinic-navigation.css',
 'practice-injection.js','clinical-compact.js','clinical-efficiency.js','anesthesia-efficiency.js','anesthesia-dashboard.js','anesthesia-record.js','anesthesia-record.css',
 'practice-prescription-summary.js','practice-prescription-library.js','practice-prescription-safety.js','clinical-knowledge.js','clinical-knowledge.css','clinical-workspace.js','clinical-workspace.css','clinical-protocol-starters.js',
 'practice-calculator-flow.js','practice-calculator-settings.js',
 'practice-anesthesia.js','practice-fluid-plan.js',
 'practice-calcium-guided.js','practice-preparation.js','practice-medication-flow.js','practice-rx-workflow.js','practice-medication-assist.js',
 'practice-prescription-image.js','clinic-tab-position.js',
 'practice-potassium-mix.js','clinic-install.js','clinic-install.css','clinic.webmanifest','clinic-icon.svg','clinic-icon-192.png','clinic-icon-512.png',
  'practice-strengths.js','practice-ingredients.js','practice-strength-catalog.json',
  'practice-calculator-ease.js','practice-products.js','practice-prescription.js','practice-prescription-ui.js',
  'practice-nutrition.js','practice-calcium-transfusion.js','practice-emergency.js', 'practice-cri-presets.js',
  'practice-library.js','practice-library-dose.js',
  'practice-calculator-simple.js','practice-acid-base.js','practice-calculator-workspace.js','practice-reference.js','practice-reference-ui.js','practice-calculators.js','practice-tools.js','practice-clinic.js','practice-intake.js','practice-tools.css','intake.html',
  'training-automation.js','training-automation.css',
  'guardian-studio.js','guardian-studio.css',
  'staff-training-pdf.js','pretendard-regular-1.3.9.ttf','pdf-lib-1.17.1.min.js','pdf-fontkit-1.1.1.min.js','PDF-LIB-LICENSE.txt','PDF-FONTKIT-LICENSE.txt',
  'staff-training.js','staff-training.css','staff-training-clinic.js','staff-training-hq.js',
  'clinic-reliability.js', 'clinic-organization.js', 'clinic-organization.css', 'home-display.js', 'deployment-status.js', 'home-insights.js', 'home-insights.css', 'home-navigation.js', 'home-navigation.css', 'home-readability.css', 'pretendard-variable-1.3.9.woff2', 'PRETENDARD-LICENSE.txt',
  'home-reminders.js', 'clinic-read-flow.js', 'carestep-ui.css', 'clinic-care.js', 'home-care.js', 'index.html', 'hq-ux.js', 'hq-ux.css', 'hq.html', 'home.html', 'carestep-workflow.css', 'home-access-clinic.js', 'home-access-clinic.css', 'r61-clinic.js', 'r61-route.js', 'r65-clinic.js',
  'r83-clinic.js', 'carestep-home.js', 'date-input-guard.js', 'patient-breeds.js',
  'patient-crm.js', 'patient-timeline.js', 'sw.js', 'carestep-home.css',
  'carestep-home-response-edit.css', 'patient-crm.css', 'manifest.webmanifest',
  'carestep-home-icon.svg', 'carestep-home-icon-192.png', 'carestep-home-icon-512.png'
]);

export function readUI(root, path) {
  if (!uiFiles.has(path) || basename(path) !== path) throw Error(`UI_SCOPE_BLOCK: ${path}`);
  const full = resolve(root, path);
  const stat = lstatSync(full);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`NOT_REGULAR_FILE: ${path}`);
  const bytes = readFileSync(full);
  if (!bytes.length) throw Error(`EMPTY_FILE: ${path}`);
  return bytes;
}

function syntax(source, label, module = false) {
  const args = module ? ['--input-type=module', '--check'] : ['--check'];
  const result = spawnSync(process.execPath, args, {input: source, encoding: 'utf8', timeout: 15000});
  if (result.error || result.status !== 0) throw Error(`SYNTAX_FAIL ${label}\n${result.stderr || result.error || ''}`);
}

export function checkUI(root, paths) {
  if (!paths.length) throw Error('Provide the changed frontend filenames.');
  return [...new Set(paths)].map(path => {
    const bytes = readUI(root, path), source = bytes.toString('utf8');
    const checks = ['nonempty-regular-file'];
    if (path.endsWith('.js')) { syntax(source, path); checks.push('javascript-syntax'); }
    if (path.endsWith('.html')) {
      if (!/<html\b/i.test(source) || !/<\/html\s*>/i.test(source)) throw Error(`HTML_DOCUMENT_MISSING: ${path}`);
      let i = 0;
      for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        const attrs = match[1];
        if (/\bsrc\s*=/i.test(attrs)) continue;
        const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1]?.toLowerCase() || '';
        if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
        syntax(match[2], `${path} inline script ${++i}`, type === 'module');
      }
      checks.push(`html-wrapper-and-${i}-inline-script-syntax`);
    }
    if (path.endsWith('.webmanifest') || path.endsWith('.json')) { JSON.parse(source); checks.push('json-syntax'); }
    return {file: path, bytes: bytes.length, checks};
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify({ok: true, checks: checkUI(process.cwd(), process.argv.slice(2))}, null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
