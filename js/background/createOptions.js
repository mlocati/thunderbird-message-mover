const MAX_INT = 2147483647;
const DEFAULT_DELAY = 0;
const DEFAULT_MOVE_SUBFOLDERS = true;
const DEFAULT_IGNORE_ERRORS = false;
const DEFAULT_SHOWFOLDERPANEMENUITEM = true;
const DEFAULT_AUTOSTART = false;
const FIELDS = [
    'sourceAccount',
    'sourceFolder',
    'destinationAccount',
    'destinationFolder',
    'messagesFrom',
    'messagesTo',
    'delay',
    'moveSubfolders',
    'ignoreErrors',
    'showFolderPaneMenuItem',
    'autostart',
];

function parse(field, value) {
    switch (field) {
        case 'sourceAccount':
        case 'sourceFolder':
        case 'destinationAccount':
        case 'destinationFolder':
            return typeof value === 'string' ? value : '';
        case 'delay':
            value = typeof value === 'number' && isFinite(value) ? Math.round(value) : null;
            return value === null || value < 0 ? DEFAULT_DELAY : Math.min(MAX_INT, value);
        case 'moveSubfolders':
            return typeof value === 'boolean' ? value : DEFAULT_MOVE_SUBFOLDERS;
        case 'ignoreErrors':
            return typeof value === 'boolean' ? value : DEFAULT_IGNORE_ERRORS;
        case 'showFolderPaneMenuItem':
            return typeof value === 'boolean' ? value : DEFAULT_SHOWFOLDERPANEMENUITEM;
        case 'autostart':
            return typeof value === 'boolean' ? value : DEFAULT_AUTOSTART;
        case 'messagesFrom':
        case 'messagesTo':
            let date = null;
            if (value instanceof Date) {
                date = new Date();
                date.setTime(value.valueOf());
            } else if (typeof value === 'string') {
                const match = /^(?<y>\d{4})-(?<m>[0-1]?\d)-(?<d>[0-3]?\d)(T|$)/.exec(value);
                if (match) {
                    date = new Date(
                        parseInt(match.groups.y, 10),
                        parseInt(match.groups.m, 10) - 1,
                        parseInt(match.groups.d, 10)
                    );
                }
            }
            if (date === null) {
                return null;
            }
            date.setHours(field === 'messagesTo' ? 23 : 0);
            date.setMinutes(field === 'messagesTo' ? 59 : 0);
            date.setSeconds(field === 'messagesTo' ? 59 : 0);
            date.setMilliseconds(field === 'messagesTo' ? 999 : 0);
            return date;
    }
    throw new Error(`Unrecognized field: ${field}`);
}

function lookForFolder(path, folders, notFoundErrorMessage) {
    if (path === '') {
        throw new Error(notFoundErrorMessage);
    }
    const walk = function (path, folders) {
        for (let folder of folders) {
            if (folder.path === path) {
                return folder;
            }
            let result = walk(path, folder.subFolders, false, notFoundErrorMessage);
            if (result !== null) {
                return result;
            }
        }
        return null;
    }
    const result = walk(path, folders);
    if (result === null) {
        throw new Error(notFoundErrorMessage);
    }
    return result;
}

function folderContainsFolder(parent, child) {
    if (parent === child || parent.subFolders.indexOf(child) >= 0) {
        return true;
    }
    for (let subParent of parent.subFolders) {
        if (folderContainsFolder(subParent, child)) {
            return true;
        }
    }
    return false;
}

export default function createOptions(browser, rawOptionValues) {
    const t = browser.i18n.getMessage;
    const optionValues = rawOptionValues && typeof rawOptionValues === 'object' && rawOptionValues.options && typeof rawOptionValues.options === 'object' ? rawOptionValues.options : {};
    const current = Object.create(null);
    const result = Object.create(null);
    let savingDepth = 0;
    async function prepare() {
        if (current.sourceAccount === '' || current.sourceFolder === '') {
            throw new Error(t('specifySource'));
        }
        if (current.destinationAccount === '' || current.destinationFolder === '') {
            throw new Error(t('specifyDestination'));
        }
        const result = {
            source: null,
            destination: null,
        };
        const accounts = await browser.accounts.list();
        accounts.forEach((account) => {
            ['source', 'destination'].forEach((which) => {
                if (account.id !== current[`${which}Account`]) {
                    return;
                }
                result[which] = {
                    account: account,
                    folder: lookForFolder(current[`${which}Folder`], account.folders, t(`${which}FolderNotFound`)),
                };
            });
        });
        if (result.source === null) {
            throw new Error(t('sourceFolderNotFound'));
        }
        if (result.destination === null) {
            throw new Error(t('destinationFolderNotFound'));
        }
        if (result.source.account === result.destination.account) {
            if (result.source.folder === result.destination.folder) {
                throw new Error(t('sourceEqualsDestination'));
            }
            if (current.moveSubfolders) {
                if (folderContainsFolder(result.source.folder, result.destination.folder)) {
                    throw new Error(t('sourceContainsDestination'));
                }
            }
        }
        if (current.messagesFrom !== null && current.messagesTo !== null && current.messagesFrom > current.messagesTo) {
            throw new Error(t('endDateBeforeStartDate'));
        }
        return result;
    }
    FIELDS.forEach((field) => {
        current[field] = parse(field, optionValues[field]);
        Object.defineProperty(
            result,
            field,
            {
                get: () => current[field],
            }
        );
        if (['sourceAccount', 'sourceFolder', 'destinationAccount', 'destinationFolder'].indexOf(field) < 0) {
            Object.defineProperty(
                result,
                'set' + field.charAt(0).toUpperCase() + field.substr(1),
                {
                    get: () => function (value) {
                        current[field] = parse(field, value);
                        savingDepth++;
                        const promise = browser.storage.local.set({ options: current });
                        promise.finally(() => {
                            savingDepth--;
                        });
                        return promise;
                    },
                }
            );
        }
    });
    Object.defineProperty(
        result,
        'setSource',
        {
            get: () => function (account, folder) {
                current.sourceAccount = parse('sourceAccount', account);
                current.sourceFolder = parse('sourceFolder', folder);
                savingDepth++;
                const promise = browser.storage.local.set({ options: current });
                promise.finally(() => {
                    savingDepth--;
                });
                return promise;
            },
        }
    );
    Object.defineProperty(
        result,
        'setDestination',
        {
            get: () => function (account, folder) {
                current.destinationAccount = parse('destinationAccount', account);
                current.destinationFolder = parse('destinationFolder', folder);
                savingDepth++;
                const promise = browser.storage.local.set({ options: current });
                promise.finally(() => {
                    savingDepth--;
                });
                return promise;
            },
        }
    );
    Object.defineProperty(
        result,
        'busy',
        {
            get: () => savingDepth > 0,
        }
    );
    Object.defineProperty(
        result,
        'prepare',
        {
            get: () => function () {
                return prepare();
            },
        }
    );

    return result;
}