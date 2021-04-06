import FolderSelector from './FolderSelector.js';

const browser = window.browser.extension.getBackgroundPage().browser;
const t = browser.i18n.getMessage;
const UI_LANGUAGE = browser.i18n.getUILanguage();
const backgroundPage = window.browser.extension.getBackgroundPage();

async function getMMOptions() {
  for (; ;) {
    if (backgroundPage.mmOptions) {
      return backgroundPage.mmOptions;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function setUITexts() {
  $('label[for="source"]').text(t('sourceFolder'));
  $('label[for="destination"]').text(t('destinationFolder'));
  $('label[for="delay"').text(t('delay'));
  $('#delay-suffix').text(t('seconds'));
  $('label[for="move-subfolders"').text(t('moveSubfolders'));
  $('label[for="ignore-errors"').text(t('ignoreErrors'));
  $('label[for="autostart"').text(t('autostart'));
  $('#refresh-folders').text(t('refreshFolders'));
  $('#stop').text(t('stop'));
  $('#start').text(t('start'));
  ['author', 'date', 'subject', 'folder', 'time', 'error'].forEach((field) => {
    $(`#message-${field}`).closest('tr').find('>th').text(t(field));
  });
  $('#last-moved-message>h5').text(t('lastMovedMessage'));
}

async function main() {
  const mmOptions = await getMMOptions();
  const folderSelector = new FolderSelector(browser, mmOptions, '#source,#destination');
  await folderSelector.refreshFolderList();
  backgroundPage.addEventListener('messagemover:sourcefolder:changed', () => {
    folderSelector.refreshSelected();
  });
  $(document.body).removeClass('loading');
  $('#delay')
    .val(mmOptions.delay / 1000)
    .on('input', function () {
      mmOptions
        .setDelay(parseFloat($.trim(this.value)) * 1000)
        .catch((e) => { console.error('Error saving delay', e) })
        ;
    })
    .on('blur', function () {
      this.value = mmOptions.delay / 1000;
    })
    ;
  $('#move-subfolders')
    .prop('checked', mmOptions.moveSubfolders)
    .on('input', function () {
      mmOptions
        .setMoveSubfolders(this.checked)
        .catch((e) => { console.error('Error saving moveSubfolders', e); })
        ;
    })
    ;
  $('#ignore-errors')
    .prop('checked', mmOptions.ignoreErrors)
    .on('input', function () {
      mmOptions
        .setIgnoreErrors(this.checked)
        .catch((e) => { console.error('Error saving ignoreErrors', e); })
        ;
    })
    ;
  $('#autostart')
    .prop('checked', mmOptions.autostart)
    .on('input', function () {
      mmOptions
        .setAutostart(this.checked)
        .catch((e) => { console.error('Error saving autostart', e); })
        ;
    })
    ;

  $('#refresh-folders')
    .on('click', () => {
      folderSelector
        .refreshFolderList()
        .catch((e) => { console.error('Error refreshinf folders', e); })
    })
    ;
  $('#stop')
    .on('click', () => {
      backgroundPage.mmStop();
    })
    ;
  $('#start')
    .on('click', () => {
      backgroundPage.mmStart();
    })
    ;
  function updateState() {
    folderSelector.disabled = backgroundPage.mmRunState !== backgroundPage.MM_RUNSTATE.STOPPED;
    $('#delay,#start,#move-subfolders,#refresh-folders').prop('disabled', backgroundPage.mmRunState !== backgroundPage.MM_RUNSTATE.STOPPED);
    $('label[for="source"],label[for="destination"],label[for="delay"]').toggleClass('text-muted', backgroundPage.mmRunState !== backgroundPage.MM_RUNSTATE.STOPPED);
    $('#stop').prop('disabled', backgroundPage.mmRunState !== backgroundPage.MM_RUNSTATE.RUNNING);
  }
  updateState();
  backgroundPage.addEventListener('messagemover:runstate:changed', () => {
    updateState();
    $('#autostart').prop('checked', mmOptions.autostart);
  });
  let errorTimer = null;
  backgroundPage.addEventListener('messagemover:error', function (e) {
    if (errorTimer) {
      clearTimeout(errorTimer);
    }
    const $error = $('#error-message');
    $error
      .empty()
      .text(e.detail ? (e.detail.message || e.detail).toString() : '???')
      .removeClass('invisible')
      ;
    errorTimer = setInterval(() => {
      $error.addClass('invisible')
    }, 2000);
  });

  backgroundPage.addEventListener('messagemover:movingmessage', function (e) {
    const M = e.detail ? e.detail.message : null;
    if (!M) {
      return;
    }
    $('#message-author').text(M.author || '');
    $('#message-date').text(M.date ? (M.date.toLocaleString ? M.date.toLocaleString(UI_LANGUAGE) : M.date.toString()) : '');
    $('#message-subject').text(M.subject || '');
    $('#message-folder').text(M.folder ? M.folder.path : '');
    if (typeof e.detail.time === 'number') {
      $('#message-time').text((e.detail.time / 1000).toLocaleString(UI_LANGUAGE, { style: 'unit', unit: 'second', unitDisplay: 'long' }));
    } else {
      $('#message-time').empty();
    }
    if (e.detail.error) {
      $('#message-error').empty(e.detail.error.message || e.detail.error.toString());
    } else {
      $('#message-error').empty();
    }
    $('#last-moved-message').show();
  });
}

setUITexts();

main().catch((e) => { console.error('UNCAUGHT ERROR IN Message Mover OPTIONS!', e); });

