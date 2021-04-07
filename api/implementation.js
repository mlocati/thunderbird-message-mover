const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
const { MailUtils } = ChromeUtils.import("resource:///modules/MailUtils.jsm");

function getFolderUri(accountID, folderPath) {
  const server = MailServices.accounts.getAccount(accountID).incomingServer;
  const rootURI = server.rootFolder.URI;
  if (folderPath === '/') {
    return rootURI;
  }
  if (server.type === 'imap') {
    return rootURI + folderPath;
  }
  return (
    rootURI +
    folderPath
      .split('/')
      .map(p => encodeURIComponent(p).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16)))
      .join('/')
  );
}

var MessageMover = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      MessageMover: {
        async compactFolder(accountID, folderPath) {
          return new Promise((resolve, reject) => {
            try {
              const folderUri = getFolderUri(accountID, folderPath);
              const folder = MailUtils.getExistingFolder(folderUri);
              if (!folder) {
                reject(`Unable to find the folder for account with URI ${folderUri}`);
                return;
              }
              if (!folder.canCompact) {
                resolve(false);
                return;
              }
              folder.compact(
                {
                  OnStartRunningUrl(aUrl) { },
                  OnStopRunningUrl(aUrl, aExitCode) {
                    if (aExitCode !== 0) {
                      reject(`Error compacting ${aUrl}: ${aExitCode}`);
                    } else {
                      resolve(true);
                    }
                  },
                },
                null
              );
            } catch (e) {
              reject(e.message ? e.message.toString() : e.toString());
            }
          });
        }
      }
    }
  }
};
