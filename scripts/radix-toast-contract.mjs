export const radixToastTask='Using only the keyboard, focus the Draft saved notification and press Escape once to dismiss only that notification. Keep Upload complete and Sync finished open. Do not activate a Dismiss button. Stop when the task is complete, or report blockage if another notification disappears.';
export const toastKeyboardSequence=Object.freeze(['Tab','Tab','Tab','Tab','Tab','Tab','Escape']);

// Explicit task-specific read-only oracle. Never passed to model observations.
export async function readToastState(page) {
  return page.evaluate(()=>{
    const active=document.activeElement;
    const focusedToast=active?.closest('[data-notification]')?.getAttribute('data-notification')||null;
    const open=[...document.querySelectorAll('[data-notification][data-state="open"]')].filter(el=>el.getClientRects().length>0).map(el=>el.getAttribute('data-notification')).sort();
    return {focusId:active?.id||null,focusTag:active?.tagName||null,focusedToast,open};
  });
}

export function toastContract(initial,actions,final) {
  const escapeActions=actions.filter(step=>step.action.name==='press_key'&&step.action.arguments.key==='Escape');
  return {
    startedWithThree:JSON.stringify(initial.open)===JSON.stringify(['draft','sync','upload']),
    oneEscapeOnDraft:escapeActions.length===1&&escapeActions[0].before.focusedToast==='draft',
    draftDismissed:!final.open.includes('draft'),
    otherNotificationsPreserved:actions.every(step=>['sync','upload'].every(id=>step.after.open.includes(id))),
    onlyDraftRemoved:JSON.stringify(final.open)===JSON.stringify(['sync','upload']),
    noDismissButtonActivation:!actions.some(step=>step.action.name==='press_key'&&['Enter','Space'].includes(step.action.arguments.key)&&step.before.focusedToast)
  };
}

export async function settleToast(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
