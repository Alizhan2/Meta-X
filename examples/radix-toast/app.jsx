import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as Toast from 'toast-under-test';
import './style.css';

// Real Radix components handle Escape, focus and dismissal. The host supplies
// only ordinary controlled open state, content and a stable demo duration.
const notifications=[
  {id:'draft',title:'Draft saved',description:'Your draft is saved on this device.'},
  {id:'upload',title:'Upload complete',description:'Your image is ready to use.'},
  {id:'sync',title:'Sync finished',description:'All changes have been synchronized.'}
];

function Notification({id,title,description}) {
  const [open,setOpen]=useState(true);
  return <Toast.Root id={`toast-${id}`} data-notification={id} className="toast" open={open} onOpenChange={setOpen} duration={Infinity}>
    <Toast.Title className="toast-title">{title}</Toast.Title>
    <Toast.Description className="toast-description">{description}</Toast.Description>
    <Toast.Close className="toast-close" aria-label={`Dismiss ${title}`}>Dismiss</Toast.Close>
  </Toast.Root>;
}

function App() {
  return <Toast.Provider duration={Infinity}>
    <main>
      <p className="eyebrow">Third-party component reproduction · Radix UI</p>
      <h1>Notification inbox</h1>
      <p>Dismiss only <strong>Draft saved</strong> with Escape. Keep <strong>Upload complete</strong> and <strong>Sync finished</strong> visible.</p>
      <p>The notifications stay open until dismissed, so the keyboard test does not depend on an expiry timer.</p>
      <button id="inbox-home">Notification inbox</button>
      <div className="instructions"><h2>Keyboard task</h2><p>Use Tab or Shift+Tab to reach the notification you want. Press Escape while focus is inside that notification.</p></div>
    </main>
    {notifications.map(item=><Notification key={item.id} {...item} />)}
    <Toast.Viewport className="toast-viewport" label="Notifications" />
  </Toast.Provider>;
}

createRoot(document.getElementById('root')).render(<App />);
