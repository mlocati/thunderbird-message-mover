async function moveMessage(browser, data, message) {
    return browser.messages.move([message.id], data.destination.folder);
}
async function getOrCreateSubfolder(browser, account, parentFolder, childName) {
    for (let subFolder of parentFolder.subFolders) {
        if (subFolder.name === childName) {
            return subFolder;
        }
    }
    return await browser.folders.create(parentFolder, childName);
}
async function createSubData(browser, data, subFolder) {
    return {
        source: {
            account: data.source.account,
            folder: subFolder,
        },
        destination: {
            account: data.destination.account,
            folder: await getOrCreateSubfolder(browser, data.destination.account, data.destination.folder, subFolder.name)
        },
        isFirstMessage: typeof data.isFirstMessage === 'undefined' ? true : data.isFirstMessage,
    }
}
async function moveMessages(browser, data, options, checkCancel, progressListener) {
    let page = null;
    const failedMessageIDs = [];
    if (typeof data.isFirstMessage === 'undefined') {
        data.isFirstMessage = true;
    }
    if (!progressListener) {
        progressListener = () => { };
    }
    for (; ;) {
        if (page === null) {
            page = await browser.messages.list(data.source.folder);
        } else if (page.id) {
            page = await browser.messages.continueList(page.id);
        } else {
            page = await browser.messages.list(data.source.folder);
            if (page.messages.length <= failedMessageIDs.length) {
                break;
            }
        }
        if (checkCancel()) {
            return false;
        }
        for (let message of page.messages) {
            if (checkCancel()) {
                return false;
            }
            if (data.isFirstMessage === false && options.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
            const t0 = new Date();
            try {
                await moveMessage(browser, data, message);
                let t1 = new Date();
                progressListener({ type: 'done', message: message, time: t1.getTime() - t0.getTime() });
            } catch (e) {
                let t1 = new Date();
                progressListener({ type: 'failed', message: message, time: t1.getTime() - t0.getTime(), error: e });
                if (!options.ignoreErrors) {
                    throw e;
                }
                if (failedMessageIDs.indexOf(message.id) < 0) {
                    failedMessageIDs.push(message.id);
                }
            }
            data.isFirstMessage = false;
            if (checkCancel()) {
                return false;
            }
        }
    }
    if (options.moveSubfolders) {
        for (let subFolder of data.source.folder.subFolders) {
            if (checkCancel()) {
                return false;
            }
            const subData = await createSubData(browser, data, subFolder);
            if (checkCancel()) {
                return false;
            }
            if (await moveMessages(browser, subData, options, checkCancel, progressListener) === false) {
                return false;
            }
            if (checkCancel()) {
                return false;
            }
        }
    }
    return true;
}

export default moveMessages;
