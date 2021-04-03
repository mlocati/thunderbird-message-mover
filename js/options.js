(() => {
  'use strict';

  const browser = window.browser.extension.getBackgroundPage().browser;
  const t = browser.i18n.getMessage;
  const UI_LANGUAGE = browser.i18n.getUILanguage();
  const backgroundPage = window.browser.extension.getBackgroundPage();

  new Promise((resolve) => {
    function go() {
      if (backgroundPage.mmOptions) {
        resolve(backgroundPage.mmOptions);
      } else {
        setTimeout(go, 100);
      }
    }
    go();
  }).then((mmOptions) => {
    $('label[for="source"]').text(t('sourceFolder'));
    $('label[for="destination"]').text(t('destinationFolder'));
    function createOption(which, account, folder, text) {
      const $option = $('<option />')
        .text(text)
        .attr('title', `[${account.name}] ${text}`)
        .data('account', account)
        .data('folder', folder)
        ;
      if (account.id === mmOptions[which + 'Account']) {
        if (folder.path === mmOptions[which + 'Folder']) {
          $option.attr('selected', 'selected');
        }
      }
      return $option;
    }
    function addAccount(which, $folder, account) {
      const $optgroup = $('<optgroup />').attr('label', account.name);
      $folder.append($optgroup);
      account.folders.forEach((folder) => {
        addFolder(which, $optgroup, account, '', folder);
      });
    }
    function addFolder(which, $optgroup, account, prefix, folder) {
      const text = prefix + folder.name;
      $optgroup.append(createOption(which, account, folder, text));
      const subPrefix = text + ' / ';
      folder.subFolders.forEach((subFolder) => {
        addFolder(which, $optgroup, account, subPrefix, subFolder);
      });
    }
    browser.accounts.list().then((accounts) => {
      const $source = $('#source');
      const $destination = $('#destination');
      accounts.forEach((account) => {
        addAccount('source', $source, account);
        addAccount('destination', $destination, account);
      });
      $source.add($destination)
        .selectpicker({
          noneSelectedText: t('pleaseSelectAFolder'),
          noneResultsText: t('noResultsForX'),
        })
        .selectpicker('refresh')
        ;
      $source.on('changed.bs.select', () => {
        const $option = $source.find('option:selected');
        if ($option.length !== 1) {
          return;
        }
        const account = $option.data('account');
        const folder = account ? $option.data('folder') : null;
        mmOptions
          .setSource(account ? account.id : '', folder ? folder.path : '')
          .catch((e) => { console.error('Error saving source', e) })
          ;
      });
      $destination.on('changed.bs.select', () => {
        const $option = $destination.find('option:selected');
        if ($option.length !== 1) {
          return;
        }
        const account = $option.data('account');
        const folder = account ? $option.data('folder') : null;
        mmOptions
          .setDestination(account ? account.id : '', folder ? folder.path : '')
          .catch((e) => { console.error('Error saving destination', e) })
          ;
      });
      $(document.body).removeClass('loading');
    });
    $('label[for="delay"').text(t('delay'));
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
    $('#delay-suffix').text(t('seconds'));
    $('label[for="move-subfolders"').text(t('moveSubfolders'));
    $('#move-subfolders')
      .prop('checked', mmOptions.moveSubfolders)
      .on('input', function () {
        mmOptions
          .setMoveSubfolders(this.checked)
          .catch((e) => { console.error('Error saving moveSubfolders', e) })
          ;
      })
      ;
    $('label[for="ignore-errors"').text(t('ignoreErrors'));
    $('#ignore-errors')
      .prop('checked', mmOptions.ignoreErrors)
      .on('input', function () {
        mmOptions
          .setIgnoreErrors(this.checked)
          .catch((e) => { console.error('Error saving ignoreErrors', e) })
          ;
      })
      ;
    $('label[for="autostart"').text(t('autostart'));
    $('#autostart')
      .prop('checked', mmOptions.autostart)
      .on('input', function () {
        mmOptions
          .setAutostart(this.checked)
          .catch((e) => { console.error('Error saving autostart', e) })
          ;
      })
      ;

    $('#stop')
      .text(t('stop'))
      .on('click', () => {
        backgroundPage.mmStop();
      })
      ;
    $('#start')
      .text(t('start'))
      .on('click', () => {
        backgroundPage.mmStart();
      })
      ;
    function updateState() {
      $('#source,#destination,#delay,#start,#move-subfolders,#ignore-errors').prop('disabled', backgroundPage.mmRunState !== backgroundPage.MM_RUNSTATE.STOPPED);
      $('label[for="source"],label[for="destination"],label[for="delay"]').toggleClass('text-muted', backgroundPage.mmRunState !== backgroundPage.MM_RUNSTATE.STOPPED);
      $('#source,#destination').selectpicker('refresh');
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

    ['author', 'date', 'subject', 'folder', 'time', 'error'].forEach((field) => {
      $(`#message-${field}`).closest('tr').find('>th').text(t(field));
    });

    $('#last-moved-message>h5').text(t('lastMovedMessage'));
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
  });
})();
