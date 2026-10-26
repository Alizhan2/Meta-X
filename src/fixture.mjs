export const variants = Object.freeze(['correct', 'unreachable_button', 'calendar_keyboard', 'modal_dismissal', 'focus_loss']);
export const expected = Object.freeze({name: 'Alex Tester', email: 'alex@example.test', date: '2026-10-30', time: '15:00'});

export function bookingPage(variant) {
  const badButton = variant === 'unreachable_button';
  const badCalendar = variant === 'calendar_keyboard';
  const badModal = variant === 'modal_dismissal';
  const badFocus = variant === 'focus_loss';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Book a studio session</title><link rel="stylesheet" href="/style.css"><body>
  <header><a href="/booking" aria-label="Studio home">Fieldwork <span>Studio</span></a><span>Booking desk</span></header>
  <main><section class="intro"><p class="small">A little room for your next idea.</p><h1 id="title" tabindex="-1">Make time<br>to make things.</h1><p>Reserve a 30-minute studio introduction. Pick a date, review your details, and confirm your session.</p><div class="session"><span class="dot"></span><div><strong>Studio introduction</strong><br>30 minutes · Online · No payment needed</div></div><p class="footnote">All times shown in Aqtobe time (UTC+5).</p></section>
  <section class="booking" aria-labelledby="form-title"><h2 id="form-title">Your session</h2><p class="muted">A few details, then you're booked.</p>
  <form id="booking-form"><label for="name">Full name</label><input id="name" name="name" autocomplete="off" autofocus required placeholder="Your name"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="off" required placeholder="you@example.com">
  <label id="date-label">Session date</label><button type="button" id="date-trigger" aria-labelledby="date-label date-trigger" aria-expanded="false" aria-controls="calendar">Choose a date</button>
  <section id="calendar" aria-label="Available dates" hidden><p>October 2026</p><div class="dates">${[29,30,31].map(day => `<${badCalendar ? 'span role="button" tabindex="-1"' : 'button type="button"'} class="date" data-day="${day}" aria-label="October ${day}, 2026"><span>${['Thu','Fri','Sat'][day-29]}</span><strong>${day}</strong></${badCalendar ? 'span' : 'button'}>`).join('')}</div><p class="hint">Choose a day. Escape closes this list.</p></section>
  <fieldset class="times"><legend>Session time</legend><label><input type="radio" id="time-14" name="time" value="14:00" checked> 14:00</label><label><input type="radio" id="time-15" name="time" value="15:00" > 15:00</label><label><input type="radio" id="time-16" name="time" value="16:00" > 16:00</label></fieldset>
  <button type="button" id="review" class="secondary">Review details</button><p id="review-status" class="hint">Review your details before confirming.</p><button type="button" id="book" ${badButton ? 'tabindex="-1"' : ''} class="primary">Confirm booking</button><p id="status" role="status" aria-live="polite"></p></form></section>
  <dialog id="review-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title" tabindex="-1" autofocus>Review your session</h2><p id="summary"></p><p>Close this window to return and confirm your booking.</p><button id="close-review" ${badModal ? 'tabindex="-1"' : ''}>Close review</button></dialog>
  </main><footer>Fieldwork Studio <span>Good work starts with a little space.</span></footer>
  <script>
  (() => {
    const $=id=>document.getElementById(id); let date='', reviewed=false;
    const calendar=$('calendar'), trigger=$('date-trigger'), dialog=$('review-dialog');
    function closeCalendar(){calendar.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus()}
    trigger.addEventListener('click',()=>{calendar.hidden=!calendar.hidden;trigger.setAttribute('aria-expanded',String(!calendar.hidden))});
    calendar.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeCalendar()}});
    document.querySelectorAll('[data-day]').forEach(item=>item.addEventListener('click',()=>{date='2026-10-'+item.dataset.day;trigger.textContent='October '+item.dataset.day+', 2026';reviewed=false;$('review-status').textContent='Review your details before confirming.';closeCalendar();${badFocus ? "$('title').focus();" : ''}}));
    document.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{reviewed=false;$('review-status').textContent='Review your details before confirming.'}));
    $('booking-form').addEventListener('submit',e=>e.preventDefault());
    $('review').addEventListener('click',()=>{if(!$('name').value||!$('email').validity.valid||!$('email').value||!date){$('status').textContent='Enter your name, a valid email, and a date first.';return} $('status').textContent='';$('summary').textContent=$('name').value+' · '+$('email').value+' · '+date+' at '+document.querySelector('input[name=time]:checked').value;dialog.showModal()});
    dialog.addEventListener('cancel',e=>{${badModal ? 'e.preventDefault();' : ''}});
    $('close-review').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{reviewed=true;$('review-status').textContent='Details reviewed. Ready to confirm.';$('review').focus()});
    $('book').addEventListener('click',async()=>{if(!reviewed){$('status').textContent='Review your details before confirming.';return}const data={name:$('name').value,email:$('email').value,date,time:document.querySelector('input[name=time]:checked').value};try{const response=await fetch('/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});$('status').textContent=response.ok?'Your session is booked. See you at the studio.':'Please check your details and try again.';}catch{$('status').textContent='Connection failed. Please try again.'}});
  })();
  </script></body></html>`;
}
