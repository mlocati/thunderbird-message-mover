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
    if (typeof data.isFirstMessage === 'undefined') {
        data.isFirstMessage = true;
    }
    if (!progressListener) {
        progressListener = () => { };
    }
    while (page === null || page.id) {
        if (page === null) {
            page = await browser.messages.list(data.source.folder);
        } else {
            page = await browser.messages.continueList(page.id);
        }
        if (checkCancel()) {
            return;
        }
        for (let message of page.messages) {
            if (checkCancel()) {
                return;
            }
            if (data.isFirstMessage === false && options.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
            progressListener({ type: 'start', message: message });
            if (options.ignoreErrors) {
                try {
                    const t0 = new Date();
                    await moveMessage(browser, data, message);
                    const t1 = new Date();
                    progressListener({ type: 'done', message: message, time: t1.getTime() - t0.getTime() });
                } catch (e) {
                    progressListener({ type: 'failed', message: message, error: e });
                }
            } else {
                const t0 = new Date();
                await moveMessage(browser, data, message);
                const t1 = new Date();
                progressListener({ type: 'done', message: message, time: t1.getTime() - t0.getTime() });
            }
            data.isFirstMessage = false;
            if (checkCancel()) {
                return;
            }
        }
    }
    if (options.moveSubfolders) {
        for (let subFolder of data.source.folder.subFolders) {
            if (checkCancel()) {
                return;
            }
            const subData = await createSubData(browser, data, subFolder);
            if (checkCancel()) {
                return;
            }
            await moveMessages(browser, subData, options, checkCancel, progressListener);
            if (checkCancel()) {
                return;
            }
        }
    }
}

export default moveMessages;
