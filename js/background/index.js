import createOptions from './createOptions.js';
import moveMessages from './moveMessages.js';

const RUNSTATE = {
  INITIALIZING: 0,
  STOPPING: 1,
  STOPPED: 2,
  STARTING: 3,
  RUNNING: 4,
};
window.MM_RUNSTATE = RUNSTATE;

let runState = RUNSTATE.INITIALIZING;
Object.defineProperty(window, 'mmRunState', { get: () => runState });
function setRunState(value) {
  runState = value;
  window.dispatchEvent(new CustomEvent('messagemover:runstate:changed'));
}

function showError(e) {
  window.dispatchEvent(new CustomEvent('messagemover:error', { detail: e }));
}
(async () => {
  const mmOptions = createOptions(browser, await browser.storage.local.get('options'));
  Object.defineProperty(window, 'mmOptions', { get: () => mmOptions });

  function startProcessing() {
    if (runState !== RUNSTATE.STOPPED) {
      return;
    }
    setRunState(RUNSTATE.STARTING);
    mmOptions.prepare()
      .then((data) => {
        setRunState(RUNSTATE.RUNNING);
        moveMessages(
          browser,
          data,
          mmOptions,
          () => runState !== RUNSTATE.RUNNING,
          (detail) => {
            window.dispatchEvent(new CustomEvent('messagemover:movingmessage', { detail }));
          }
        )
          .catch((e) => {
            showError(e);
          })
          .then((moveResult) => {
            if (moveResult === true) {
              mmOptions.setAutostart(false);
            }
          })
          .finally(() => {
            setRunState(RUNSTATE.STOPPED);
          })
          ;
      })
      .catch((e) => {
        setRunState(RUNSTATE.STOPPED);
        showError(e);
      })
      ;
  }

  function stopProcessing() {
    if (runState === RUNSTATE.RUNNING) {
      setRunState(RUNSTATE.STOPPING);
    }
  }

  window.mmStart = () => {
    startProcessing();
  };
  window.mmStop = () => {
    stopProcessing();
  };
  setRunState(RUNSTATE.STOPPED);
  if (mmOptions.autostart) {
    startProcessing();
  }
})().catch((e) => { console.error('UNCAUGHT ERROR IN MessageMover!', e); });
