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

function showError(e) {
  window.dispatchEvent(new CustomEvent('messagemover:error', { detail: e }));
}
(async () => {
  const mmOptions = createOptions(browser, await browser.storage.local.get('options'));
  Object.defineProperty(window, 'mmOptions', { get: () => mmOptions });

  function setRunState(value) {
    runState = value;
    window.dispatchEvent(new CustomEvent('messagemover:runstate:changed'));
    if (runState === RUNSTATE.STOPPED && mmOptions.runEvery > 0) {
      setTimeout(() => {
        startProcessing();
      }, mmOptions.runEvery * 1000)
    }
  }

  const folderPaneMenuID = browser.menus.create({
    contexts: ['folder_pane'],
    title: browser.i18n.getMessage('moveMessagesWithMessageMover'),
    visible: mmOptions.showFolderPaneMenuItem,
    onclick: (e) => {
      if (runState === RUNSTATE.STOPPED && e && e.selectedFolder) {
        const accountID = e.selectedFolder.accountId;
        const folderPath = e.selectedFolder.path;
        if (accountID && folderPath && folderPath !== '/') {
          if (mmOptions.sourceAccount !== accountID || mmOptions.sourceFolder !== folderPath) {
            mmOptions
              .setSource(accountID, folderPath)
              .then(() => {
                browser.runtime.openOptionsPage();
                window.dispatchEvent(new CustomEvent('messagemover:sourcefolder:changed', { detail: e }));
              })
              ;
            return;
          }
        }
      }
      browser.runtime.openOptionsPage();
    },
  });
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
              mmOptions
                .setAutostart(false)
                .then(() => {
                  window.dispatchEvent(new CustomEvent('messagemover:runstate:changed'));
                })
                ;
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

  window.updateFolderPaneMenuItem = () => {
    browser.menus.update(folderPaneMenuID, {
      visible: mmOptions.showFolderPaneMenuItem,
    });
  };
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
