// Checks a series of URLs, returns the first that response with 200 OK.
// Defaults to the first in the list if none responded with 200 OK.
async function select(urls) {
  if (urls.length < 2) {
    return urls[0];
  }

  let oks = urls.map(url => fetch(url, {method: 'HEAD'}).then(res => res.ok));

  for (i in urls) {
    try {
      if (await oks[i]) {
        return urls[i];
      }
    } catch (e) {
      /* Ignore network errors */
    }
  }

  // Nothing was 200 OK. Default to the first url.
  return urls[0];
}

// Common provider implementation for GitHub Pages and GitLab Pages
async function githublike(url) {
  let parsed = new URL(url);

  let user = parsed.hostname.split('.')[0];
  let site = parsed.hostname.split('.')[1]; // github or gitlab
  let repo = parsed.pathname.split('/')[1];

  let projectUrl = `https://${site}.com/${user}/${repo}`;
  let accountUrl = `https://${site}.com/${user}/${user}.github.io`;

  // Pathnames with only one slash must be from account-level pages
  if (parsed.pathname.split('/').length <= 2) {
    return accountUrl;
  }

  return select([projectUrl, accountUrl]);
}

// All known providers
const PROVIDERS = {
  'github.io': githublike,
  'gitlab.io': githublike,
  'bitbucket.io': async function (url) {
    let parsed = new URL(url);
    let account = parsed.hostname.split('.')[0];

    let ioUrl = `https://bitbucket.org/${account}/${account}.bitbucket.io`;
    let orgUrl = `https://bitbucket.org/${account}/${account}.bitbucket.org`;

    return select([ioUrl, orgUrl]);
  },
  'sourceforge.net': async function (url) {
    let parsed = new URL(url);
    let project = parsed.hostname.split('.')[0];
    return `https://sourceforge.net/projects/${project}`;
  },
};

// Look up an appropriate translation function for a URL
function provider(url) {
  let host = new URL(url).hostname;
  let base = host.substring(host.indexOf('.') + 1);

  return PROVIDERS[base];
}

// Show / hide the page action on navigation
browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
  if (changeInfo.url) {
    if (provider(changeInfo.url)) {
      browser.pageAction.show(tabId);
    } else {
      browser.pageAction.hide(tabId);
    }
  }
});

// Redirect the user when clicking on the page action
browser.pageAction.onClicked.addListener(async (info) => {
  browser.pageAction.hide(info.id);

  let lookup = provider(info.url);
  let destination = await lookup(info.url);

  browser.tabs.update(info.id, { url: destination });
});
