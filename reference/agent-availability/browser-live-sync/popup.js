const status = document.getElementById('status');
const url = document.getElementById('url');

document.getElementById('sync').addEventListener('click', async () => {
  status.textContent = 'Reading visible availability…';
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error('No active tab');
    const result = await chrome.tabs.sendMessage(tab.id, {type: 'extractAvailability'});
    if (!result) throw new Error('Unsupported page');
    const account = (await chrome.storage.local.get(['account'])).account || prompt('Account nickname (e.g. CTO — Secondary)') || 'Unassigned account';
    await chrome.storage.local.set({account});
    const payload = {...result, account, iface: result.provider === 'cto.new' ? 'Build workspace' : 'ChatGPT', id: `${result.provider}:${account}`, use: result.provider === 'cto.new' ? 'Software engineering' : 'Strategy / product / frontend'};
    const response = await fetch(`${url.value.replace(/\/$/, '')}/api/sync`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
    status.textContent = `Synced ${result.provider} · ${result.cap == null ? 'capacity not detected' : result.cap + '%'} · ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    status.textContent = `Sync failed: ${e.message}. Nothing sensitive was collected.`;
  }
});