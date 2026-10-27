// This is an explicit, example-specific oracle. It does not infer arbitrary
// website accessibility and never changes focus, DOM, scroll, or application state.
export const reactAriaTask='Open reading details, use the keyboard to focus the Reading panel and scroll that panel all the way to the end, then close the dialog.';

export async function readReadingState(page) {
  return page.evaluate(()=>{
    const panel=document.getElementById('reading-panel');
    const active=document.activeElement;
    const end=document.getElementById('document-end');
    const rect=end?.getBoundingClientRect(), bounds=panel?.getBoundingClientRect();
    return {focusId:active?.id||null,focusTag:active?.tagName||null,dialogOpen:!!document.querySelector('[role="dialog"]'),panelPresent:!!panel,panelFocused:!!panel&&active===panel,scrollTop:panel?.scrollTop??null,scrollHeight:panel?.scrollHeight??null,clientHeight:panel?.clientHeight??null,atEnd:!!panel&&panel.scrollHeight>panel.clientHeight&&panel.scrollTop>=panel.scrollHeight-panel.clientHeight-2,endVisible:!!rect&&!!bounds&&rect.top>=bounds.top&&rect.bottom<=bounds.bottom+2};
  });
}

export function readingContract(states) {
  return {panelReached:states.some(s=>s.panelFocused),panelScrolled:states.some(s=>s.scrollTop>0),endReached:states.some(s=>s.atEnd&&s.endVisible),dialogClosed:states.some(s=>s.dialogOpen)&&states.at(-1)?.dialogOpen===false&&states.at(-1)?.focusId==='open-reading'};
}

export async function settleReadingScroll(page) {
  let previous=null,stable=0;
  for(let i=0;i<12;i++){
    const current=await readReadingState(page);
    stable=current.scrollTop===previous?stable+1:0;
    if(stable>=2)return current;
    previous=current.scrollTop;
    await page.waitForTimeout(60);
  }
  return readReadingState(page);
}
