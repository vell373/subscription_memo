/** @typedef {{ id:string, name:string, amount:number, period:'monthly'|'yearly' }} Subscription */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const form = $('#add-form');
const nameInput = $('#name');
const amountInput = $('#amount');
const listTbody = $('#list');
const sumMonthly = $('#sum-monthly');
const sumYearly = $('#sum-yearly');
const exportBtn = $('#export-csv');
const clearBtn = $('#clear-all');
const searchInput = $('#search');
const sortSelect = $('#sort');
const editModal = $('#edit-modal');
const editForm = $('#edit-form');
const editNameInput = $('#edit-name');
const editAmountInput = $('#edit-amount');
const editMonthlyRadio = $('#edit-monthly');
const editYearlyRadio = $('#edit-yearly');
const cancelEditBtn = $('#cancel-edit');
const syncEnabledCheckbox = $('#sync-enabled');
const syncStatusText = $('#sync-status-text');
const syncNowBtn = $('#sync-now');

console.log('DOM elements loaded:');
console.log('syncEnabledCheckbox:', syncEnabledCheckbox);
console.log('syncStatusText:', syncStatusText);
console.log('syncNowBtn:', syncNowBtn);

let currentEditId = null;
let syncEnabled = false;

const STORAGE_KEY = 'subscriptions';
const SYNC_SETTING_KEY = 'sync_enabled';

// 同期設定を読み込み
async function loadSyncSetting() {
  try {
    const result = await chrome.storage.local.get(SYNC_SETTING_KEY);
    return result[SYNC_SETTING_KEY] || false;
  } catch (e) {
    console.error('Failed to load sync setting:', e);
    return false;
  }
}

// 同期設定を保存
async function saveSyncSetting(enabled) {
  console.log('saveSyncSetting called with enabled:', enabled);
  try {
    await chrome.storage.local.set({ [SYNC_SETTING_KEY]: enabled });
    syncEnabled = enabled;
    console.log('Sync setting saved, syncEnabled now:', syncEnabled);
    updateSyncUI();
  } catch (e) {
    console.error('Failed to save sync setting:', e);
  }
}

// データを読み込み（同期設定に応じてlocalStorageまたはchrome.storage.syncを使用）
async function load() {
  try {
    if (syncEnabled) {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      return result[STORAGE_KEY] || [];
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (e) {
    console.error('Failed to load data:', e);
    // フォールバックとしてlocalStorageを使用
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
}

// データを保存（同期設定に応じてlocalStorageまたはchrome.storage.syncを使用）
async function save(subs) {
  try {
    if (syncEnabled) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: subs });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
    }
  } catch (e) {
    console.error('Failed to save data:', e);
    // フォールバックとしてlocalStorageを使用
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  }
}

// localStorageからchrome.storage.syncにデータを移行
async function migrateToSync() {
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const subs = JSON.parse(localData);
      await chrome.storage.sync.set({ [STORAGE_KEY]: subs });
      console.log('Data migrated to sync storage');
    }
  } catch (e) {
    console.error('Failed to migrate data to sync:', e);
  }
}

// chrome.storage.syncからlocalStorageにデータを移行
async function migrateToLocal() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const syncData = result[STORAGE_KEY];
    if (syncData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncData));
      console.log('Data migrated to local storage');
    }
  } catch (e) {
    console.error('Failed to migrate data to local:', e);
  }
}

// 同期状態を更新
function updateSyncUI() {
  console.log('updateSyncUI called, syncEnabled:', syncEnabled);
  console.log('syncEnabledCheckbox:', syncEnabledCheckbox);
  console.log('syncStatusText:', syncStatusText);
  console.log('syncNowBtn:', syncNowBtn);
  
  if (syncEnabledCheckbox) {
    syncEnabledCheckbox.checked = syncEnabled;
  }
  
  if (syncStatusText) {
    if (syncEnabled) {
      syncStatusText.textContent = '同期有効';
    } else {
      syncStatusText.textContent = '同期無効';
    }
  }
  
  if (syncNowBtn) {
    if (syncEnabled) {
      syncNowBtn.style.display = 'inline-block';
    } else {
      syncNowBtn.style.display = 'none';
    }
  }
}

// 手動同期を実行
async function syncNow() {
  if (!syncEnabled) return;
  
  try {
    syncStatusText.textContent = '同期中...';
    const subs = await load();
    await save(subs);
    syncStatusText.textContent = '同期完了';
    setTimeout(() => {
      if (syncEnabled) syncStatusText.textContent = '同期有効';
    }, 2000);
    render();
  } catch (e) {
    console.error('Sync failed:', e);
    syncStatusText.textContent = '同期エラー';
    setTimeout(() => {
      if (syncEnabled) syncStatusText.textContent = '同期有効';
    }, 3000);
  }
}

function loadLegacy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('load error', e);
    return [];
  }
}

function saveLegacy(subs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

async function addSubscription(name, amount, period) {
  const subs = await load();
  subs.push({
    id: String(Date.now()) + Math.random().toString(16).slice(2),
    name,
    amount,
    period
  });
  await save(subs);
  await render();
}

async function deleteSubscription(id) {
  const subs = (await load()).filter(s => s.id !== id);
  await save(subs);
  await render();
}

async function editSubscription(id, name, amount, period) {
  const subs = await load();
  const index = subs.findIndex(s => s.id === id);
  if (index !== -1) {
    subs[index] = { ...subs[index], name, amount, period };
    await save(subs);
    await render();
  }
}

async function openEditModal(id) {
  const subs = await load();
  const sub = subs.find(s => s.id === id);
  if (!sub) return;
  
  currentEditId = id;
  editNameInput.value = sub.name;
  editAmountInput.value = sub.amount;
  
  if (sub.period === 'monthly') {
    editMonthlyRadio.checked = true;
  } else {
    editYearlyRadio.checked = true;
  }
  
  editModal.style.display = 'block';
  editNameInput.focus();
}

function closeEditModal() {
  editModal.style.display = 'none';
  currentEditId = null;
  editForm.reset();
}

function formatJPY(n) {
  // 通貨記号なし（見た目をシンプルに）、必要なら Intl で記号付きに
  return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(n);
}

function calcSums(subs) {
  let monthlyTotal = 0;
  let yearlyTotal = 0;
  
  for (const s of subs) {
    if (s.period === 'monthly') {
      monthlyTotal += s.amount;           // 月額はそのまま
      yearlyTotal += s.amount * 12;       // 月額を年額換算
    } else {
      monthlyTotal += s.amount / 12;      // 年額を月額換算
      yearlyTotal += s.amount;            // 年額はそのまま
    }
  }
  
  return { monthlyTotal, yearlyTotal };
}

function filterAndSortSubs(subs) {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const sortValue = sortSelect.value;
  
  // 検索フィルター
  let filtered = subs.filter(s => 
    s.name.toLowerCase().includes(searchTerm)
  );
  
  // 並び替え
  switch (sortValue) {
    case 'name-asc':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      filtered.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'monthly-amount-asc':
      filtered.sort((a, b) => {
        const aMonthly = a.period === 'monthly' ? a.amount : a.amount / 12;
        const bMonthly = b.period === 'monthly' ? b.amount : b.amount / 12;
        return aMonthly - bMonthly;
      });
      break;
    case 'monthly-amount-desc':
      filtered.sort((a, b) => {
        const aMonthly = a.period === 'monthly' ? a.amount : a.amount / 12;
        const bMonthly = b.period === 'monthly' ? b.amount : b.amount / 12;
        return bMonthly - aMonthly;
      });
      break;
    case 'yearly-amount-asc':
      filtered.sort((a, b) => {
        const aYearly = a.period === 'yearly' ? a.amount : a.amount * 12;
        const bYearly = b.period === 'yearly' ? b.amount : b.amount * 12;
        return aYearly - bYearly;
      });
      break;
    case 'yearly-amount-desc':
      filtered.sort((a, b) => {
        const aYearly = a.period === 'yearly' ? a.amount : a.amount * 12;
        const bYearly = b.period === 'yearly' ? b.amount : b.amount * 12;
        return bYearly - aYearly;
      });
      break;
    case 'period-monthly':
      filtered = filtered.filter(s => s.period === 'monthly');
      break;
    case 'period-yearly':
      filtered = filtered.filter(s => s.period === 'yearly');
      break;
  }
  
  return filtered;
}

async function render() {
  const allSubs = await load();
  const subs = filterAndSortSubs(allSubs);
  
  listTbody.innerHTML = subs.map(s => {
    // 換算金額を計算
    const convertedAmount = s.period === 'monthly' 
      ? s.amount * 12  // 月額を年額換算
      : s.amount / 12; // 年額を月額換算
    
    const convertedLabel = s.period === 'monthly' 
      ? `年額: ${formatJPY(convertedAmount)}円`
      : `月額: ${formatJPY(convertedAmount)}円`;
    
    return `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${formatJPY(s.amount)}円</td>
        <td>${s.period === 'monthly' ? '月額' : '年額'}</td>
        <td class="small">${convertedLabel}</td>
        <td>
          <button class="edit-btn" data-edit="${s.id}">編集</button>
          <button data-del="${s.id}">削除</button>
        </td>
      </tr>
    `;
  }).join('');

  // 合計は全データで計算（フィルターされたデータではなく）
  const { monthlyTotal, yearlyTotal } = calcSums(allSubs);
  sumMonthly.textContent = `${formatJPY(monthlyTotal)}円`;
  sumYearly.textContent = `${formatJPY(yearlyTotal)}円`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const period = /** @type {'monthly'|'yearly'} */ ($$('input[name="period"]').find(i => i.checked).value);

  if (!name || isNaN(amount) || amount < 0) return;
  await addSubscription(name, amount, period);
  form.reset();
  // デフォルトを月額に戻す
  $$('input[name="period"]').forEach(i => (i.checked = i.value === 'monthly'));
  nameInput.focus();
});

listTbody.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('button[data-del]');
  if (delBtn) {
    await deleteSubscription(delBtn.dataset.del);
    return;
  }
  
  const editBtn = e.target.closest('button[data-edit]');
  if (editBtn) {
    await openEditModal(editBtn.dataset.edit);
    return;
  }
});

exportBtn.addEventListener('click', async () => {
  /** @type {Subscription[]} */
  const subs = await load();
  const header = ['name','amount','period'];
  const rows = subs.map(s => [s.name, String(s.amount), s.period]);
  const csv = [header, ...rows]
    .map(cols => cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subscriptions_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('全件を削除します。よろしいですか？')) return;
  await save([]);
  await render();
});

// 検索・並び替えのイベントリスナー
searchInput.addEventListener('input', render);
sortSelect.addEventListener('change', render);

// 編集フォームのイベントリスナー
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentEditId) return;
  
  const name = editNameInput.value.trim();
  const amount = parseFloat(editAmountInput.value);
  const period = $$('input[name="edit-period"]').find(i => i.checked).value;
  
  if (!name || isNaN(amount) || amount < 0) return;
  
  await editSubscription(currentEditId, name, amount, period);
  closeEditModal();
});

// 同期機能のイベントリスナー
syncEnabledCheckbox.addEventListener('change', async (e) => {
  console.log('Sync checkbox changed, checked:', e.target.checked);
  const enabled = e.target.checked;
  
  if (enabled) {
    console.log('Enabling sync, migrating to sync storage...');
    // 同期を有効にする前にローカルデータを同期ストレージに移行
    await migrateToSync();
  } else {
    console.log('Disabling sync, migrating to local storage...');
    // 同期を無効にする前に同期データをローカルに移行
    await migrateToLocal();
  }
  
  await saveSyncSetting(enabled);
});

syncNowBtn.addEventListener('click', syncNow);

// モーダルのイベントリスナー
cancelEditBtn.addEventListener('click', closeEditModal);

// モーダルの背景クリックで閉じる
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

// ESCキーでモーダルを閉じる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editModal.style.display === 'block') {
    closeEditModal();
  }
});

// 初期化処理
async function initialize() {
  console.log('Initializing...');
  
  // 同期設定を読み込み
  syncEnabled = await loadSyncSetting();
  console.log('Loaded sync setting:', syncEnabled);
  
  updateSyncUI();
  
  // データを表示
  await render();
  
  console.log('Initialization complete');
}

document.addEventListener('DOMContentLoaded', initialize);
