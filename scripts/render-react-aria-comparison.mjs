import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const [checkPath,agentPath,...priorPaths]=process.argv.slice(2);
assert.ok(checkPath&&agentPath,'Pass deterministic results.json and live-agent summary.json');
const checks=JSON.parse(await readFile(checkPath,'utf8'));
const agents=JSON.parse(await readFile(agentPath,'utf8'));
const prior=await Promise.all(priorPaths.map(async path=>JSON.parse(await readFile(path,'utf8'))));
const allAttempts=[...prior.flatMap(summary=>summary.attempts),...agents.attempts];
const original=checks.results.filter(r=>r.condition==='original');
const corrected=checks.results.filter(r=>r.condition==='corrected');
assert.ok(original.length===3&&corrected.length===3);
assert.ok(original.every(r=>!r.passed)&&corrected.every(r=>r.passed));
assert.equal(agents.passed,true,'Do not render a successful comparison from a failed live pair');
assert.equal(agents.comparable,true,'Model, runtime configuration and source hashes must match');
const directory=resolve('docs/react-aria-2026-10-27');
await mkdir(resolve(directory,'runs'),{recursive:true});await mkdir(resolve(directory,'audits'),{recursive:true});
await writeFile(resolve(directory,'deterministic-results.json'),JSON.stringify(checks,null,2)+'\n');
await writeFile(resolve(directory,'agent-summary.json'),JSON.stringify(agents,null,2)+'\n');
await writeFile(resolve(directory,'development-attempts.json'),JSON.stringify({scope:'All live development attempts, including the earlier API timeout; not a pooled reliability benchmark.',attempts:allAttempts},null,2)+'\n');
for(const attempt of allAttempts){
  await copyFile(resolve(attempt.output,'report.json'),resolve(directory,'runs',attempt.runId+'.json'));
  await copyFile(resolve(attempt.output,'reading-audit.json'),resolve(directory,'audits',attempt.runId+'.json'));
}
const image=async label=>{
  const buffer=await readFile(resolve(dirname(checkPath),label+'-1.png'));
  await writeFile(resolve(directory,label+'.png'),buffer);
  return 'data:image/png;base64,'+buffer.toString('base64');
};
const beforeImage=await image('original'),afterImage=await image('corrected');
const before=agents.attempts[0],after=agents.attempts[1];
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const maxScroll=rows=>Math.max(...rows.flatMap(r=>r.actions.map(a=>a.state.scrollTop||0)));
const observedScroll=maxScroll(original),correctedScroll=maxScroll(corrected);
const stopLabel=reason=>({'model_reported_blockage':'Сообщил о препятствии','model_reported_completion':'Сообщил о завершении'}[reason]||reason);
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TabProof — React Aria: до и после исправления</title><style>
:root{font-family:system-ui,sans-serif;color:#203235;background:#edf2ef}*{box-sizing:border-box}body{margin:0}main{max-width:1180px;margin:auto;padding:44px 28px}h1{font-size:clamp(28px,4vw,44px);letter-spacing:-.045em;max-width:850px;margin:12px 0 20px}h2{font-size:21px}p,li{line-height:1.65}a{color:#165a57}code{font-family:ui-monospace,monospace;background:#e3ebe7;padding:3px 6px;border-radius:4px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.13em;color:#526a60}.lead{max-width:900px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}.card{background:#fff;border:1px solid #d3ded7;border-radius:12px;overflow:hidden}.card header,.card footer{padding:20px 24px}.card h2{margin:0 0 8px}.card p{margin:6px 0}.card img{width:100%;display:block;border-block:1px solid #d3ded7}.bad{color:#a13f2e}.good{color:#216c4a}table{border-collapse:collapse;width:100%;background:white;margin:24px 0}th,td{text-align:left;padding:14px;border-bottom:1px solid #d3ded7;vertical-align:top}th{background:#e2eae5}.note{padding:20px 24px;border-left:4px solid #b37a30;background:#fbf5e9}.command{display:block;white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;margin:12px 0}details{margin:20px 0}summary{cursor:pointer;font-weight:600}@media(max-width:720px){main{padding:24px 16px}.grid{grid-template-columns:1fr}th,td{padding:10px;font-size:14px}}
table{table-layout:fixed}th,td,p,code{overflow-wrap:anywhere}
</style></head><body><main><p class="eyebrow">TabProof · third-party reproduction · 27 октября 2026</p><h1>Модальное окно открывается. Прочитать его клавиатурой не получается.</h1>
<p class="lead">Воспроизведена известная проблема <strong>React Aria Components ${escape(checks.component.version)}</strong>: фокус пропускает прокручиваемую область внутри настоящего стороннего Dialog. Исправление интеграции — <code>tabIndex={0}</code> на области чтения. Пакет библиотеки в обеих версиях одинаковый и не изменён.</p>
<p><a href="https://github.com/adobe/react-spectrum/issues/10395">Исходный баг-репорт #10395</a> · <a href="https://github.com/Alizhan2/Meta-X">Репозиторий TabProof</a></p><p><a href="/before">Открыть исходный пример</a> · <a href="/after">Открыть исправленный пример</a></p>
<div class="grid"><article class="card"><header><h2 class="bad">До исправления · тест не проходит</h2><p>Прокрутка: <strong>${observedScroll} px</strong>. Tab пропускает область чтения.</p></header><img alt="Исходная версия: после End виден первый раздел, фокус на кнопке закрытия" src="${beforeImage}"><footer><p>Не проходит в ${original.length} из ${original.length} отдельных браузерных запусков.</p></footer></article>
<article class="card"><header><h2 class="good">После исправления · тест проходит</h2><p>Прокрутка: <strong>${correctedScroll} px</strong>. Конец документа достигнут.</p></header><img alt="Исправленная версия: область чтения в фокусе, виден конец документа" src="${afterImage}"><footer><p>Проходит в ${corrected.length} из ${corrected.length} отдельных браузерных запусков.</p></footer></article></div>
<h2>Проверка без модели</h2><p>Одинаковые нажатия в обеих версиях: <code>${checks.keyboardSequence.map(escape).join(' → ')}</code>. Проверяются фактический фокус, прокрутка до конца, видимость последнего абзаца, закрытие диалога и возврат фокуса на кнопку открытия.</p>
<table><thead><tr><th>Проверка</th><th>До</th><th>После</th></tr></thead><tbody><tr><td>Tab достигает области чтения</td><td>Нет</td><td>Да</td></tr><tr><td>End прокручивает документ до конца</td><td>Нет</td><td>Да</td></tr><tr><td>Escape закрывает диалог и возвращает фокус</td><td>Да</td><td>Да</td></tr><tr><td>Результат повторных проверок</td><td>0/3 проходят</td><td>3/3 проходят</td></tr></tbody></table>
<p>Контроль: мышью исходная область прокручивается на 900 px. Такая же область вне модального окна доступна через Tab без исправления. Это отделяет проблему фокусировки внутри Dialog от отсутствия прокрутки или общего ограничения браузера.</p>
<h2>Два настоящих запуска Muse Spark</h2><table><thead><tr><th>Условие</th><th>Действия агента</th><th>Остановка</th><th>Независимая проверка задачи</th></tr></thead><tbody>${[[before,'До'],[after,'После']].map(([r,label])=>`<tr><td>${label}</td><td>${escape(r.actions)}</td><td>${escape(stopLabel(r.reason))}</td><td>${r.taskVerified?'Выполнена':'Не выполнена'}</td></tr>`).join('')}</tbody></table>
<p>Агент использовал только инструменты TabProof для клавиш и ввода текста. Фокус и прокрутка измерялись отдельно в живой сессии; результаты этих измерений модели не передавались. Два запуска — демонстрация, а не оценка статистической надёжности. Всего сохранено ${allAttempts.length} попытки: ${allAttempts.filter(a=>!a.valid).length} с ошибкой API/выполнения. Предыдущие неудачи не удалены и не засчитаны как найденный дефект.</p>
<h2>Запустить воспроизводимый тест</h2><code class="command">npm ci\nnpm ci --prefix examples/react-aria-scroll --ignore-scripts\nnpx playwright install chromium\nnpm run check:third-party</code><p>Отдельно: <code>npm run check:third-party -- --condition=original</code> завершается кодом 1, <code>--condition=corrected</code> — кодом 0. Тесты не используют Meta API.</p>
<div class="note"><strong>Границы результата.</strong> Это локальное воспроизведение уже опубликованного бага стороннего пакета, а не новая находка на публичном сайте. Исправлена интеграция компонента; изменения в upstream-библиотеку не отправлялись. Проверка знает контракт этого примера и не является универсальной сертификацией доступности.</div>
<details><summary>Версии и файлы доказательств</summary><p>Chromium ${escape(checks.browserVersion)} · React Aria ${escape(checks.component.version)} · ${escape(checks.platform)} / ${escape(checks.architecture)}.</p><p>Исходные данные: <a href="deterministic-results.json">детерминированные проверки</a>, <a href="agent-summary.json">сопоставимая пара запусков</a>, <a href="development-attempts.json">все попытки, включая неудачные</a>. Полные отчёты и независимые измерения сохранены в каталогах runs и audits рядом с этим файлом.</p></details></main></body></html>`;
await writeFile(resolve(directory,'comparison.html'),html);
console.log(JSON.stringify({directory,report:resolve(directory,'comparison.html'),observedScroll,correctedScroll}));
