import React from 'react';
import {createRoot} from 'react-dom/client';
import {Button, Dialog, DialogTrigger, Heading, Modal} from 'react-aria-components';
import './style.css';

// A minimal integration of the real, unmodified third-party Dialog. There is
// no project-authored focus trap, key handler, or scrolling implementation.
// The correction is the explicit tab stop recommended in upstream issue 10395.
const corrected = document.documentElement.dataset.explicitTabStop === 'true';
const nativeControl = document.documentElement.dataset.nativeControl === 'true';

function ReadingPanel() {
  return <div id="reading-panel" role="region" aria-label="Reading panel" className="reading-panel" {...(corrected ? {tabIndex: 0} : {})}>
    {Array.from({length: 18}, (_, index) => <section key={index}>
      <h3>Section {index + 1}</h3>
      <p>This document demonstrates a scrollable region inside a third-party modal. The header and the close button stay in place while this reading panel scrolls. Keyboard users need to be able to reach and read every section.</p>
    </section>)}
    <p id="document-end">End of the reading document.</p>
  </div>;
}

function App() {
  return <main>
    <p className="eyebrow">Third-party component reproduction</p>
    <h1>React Aria · reading dialog</h1>
    <p>Open the reading details. Scroll the reading panel to its end using the keyboard, then close the dialog.</p>
    {nativeControl ? <div className="native-control"><Button id="open-reading">Start reading</Button><ReadingPanel /></div> : <DialogTrigger>
      <Button id="open-reading">Open reading details</Button>
      <Modal>
        <Dialog>
          {({close}) => <>
            <header><Heading slot="title">Reading details</Heading><p>The reading panel below contains the complete document.</p></header>
            <ReadingPanel />
            <footer><Button id="close-reading" onPress={close}>Close reading details</Button></footer>
          </>}
        </Dialog>
      </Modal>
    </DialogTrigger>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
