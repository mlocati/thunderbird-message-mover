function addAccount($select, account) {
    const $optgroup = $('<optgroup />').attr('label', account.name);
    $select.append($optgroup);
    for (let folder of account.folders) {
        addFolder($optgroup, account, '', folder);
    }
}

function addFolder($optgroup, account, prefix, folder) {
    const text = prefix + folder.name;
    $optgroup.append(createOption(account, folder, text));
    const subPrefix = text + ' / ';
    folder.subFolders.forEach((subFolder) => {
        addFolder($optgroup, account, subPrefix, subFolder);
    });
}

function createOption(account, folder, text) {
    return $('<option />')
        .text(text)
        .attr('title', `[${account.name}] ${text}`)
        .data('account', account)
        .data('folder', folder)
        ;
}

class FolderSelector {
    _disabled = false;
    constructor(browser, mmOptions, selector) {
        this.browser = browser;
        this.mmOptions = mmOptions;
        this.$selects = $(selector);
        this.$selects.selectpicker({
            noneSelectedText: this.browser.i18n.getMessage('pleaseSelectAFolder'),
            noneResultsText: this.browser.i18n.getMessage('noResultsForX'),
        });
        this.$selects.selectpicker('refresh');
        this.$selects.on('changed.bs.select', (e) => {
            this.save($(e.currentTarget));
        });
    }
    get disabled() {
        return this._disabled;
    }
    set disabled(value) {
        this._disabled = !!value;
        this.$selects.prop('disabled', this._disabled);
        this.$selects.selectpicker('refresh');
    }
    async refreshFolderList() {
        const accounts = await this.browser.accounts.list();
        this.$selects.empty().append($('<option value="" selected="selected" />'));
        for (let select of this.$selects) {
            const $select = $(select);
            for (let account of accounts) {
                addAccount($select, account);
            }
        }
        this.refreshSelected();
    }
    refreshSelected() {
        for (let select of this.$selects) {
            const $select = $(select);
            const which = $select.data('which');
            const accountID = this.mmOptions[`${which}Account`];
            const folderPath = this.mmOptions[`${which}Folder`];
            $select.val('');
            if (accountID !== '' && folderPath !== '') {
                for (let option of $select.find('option')) {
                    const $option = $(option);
                    const account = $option.data('account');
                    if (account && account.id === accountID) {
                        const folder = $option.data('folder');
                        if (folder && folder.path === folderPath) {
                            $option.attr('selected', 'selected');
                            break;
                        }
                    }
                }
            }
            this.save($select);
        }
        this.$selects.selectpicker('refresh');
    }
    save($select) {
        const which = $select.data('which');
        const $option = $select.find('option:selected');
        const account = $option.data('account');
        const folder = account ? $option.data('folder') : null;
        const accountID = account && folder ? account.id : '';
        const folderPath = account && folder ? folder.path : '';
        if (this.mmOptions[`${which}Account`] === accountID && this.mmOptions[`${which}Folder`] === folderPath) {
            return;
        }
        const Which = which.charAt(0).toUpperCase() + which.substr(1);
        this.mmOptions[`set${Which}`](accountID, folderPath).catch((e) => {
            console.error(`Failed to set ${Which}`, e);
        });
    }
}

export default FolderSelector;