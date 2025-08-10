const STORAGE_KEY = 'subscriptions'; // localStorage key

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

let currentEditId = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('load error', e);
    return [];
  }
}

function save(subs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

function addSubscription(name, amount, period) {
  const subs = load();
  subs.push({
    id: String(Date.now()) + Math.random().toString(16).slice(2),
    name,
    amount,
    period
  });
  save(subs);
  render();
}

function deleteSubscription(id) {
  const subs = load();
  const sub = subs.find(s => s.id === id);
  
  if (!sub) return;
  
  if (!confirm(`「${sub.name}」を削除しますか？\n\nこの操作は元に戻せません。`)) {
    return;
  }
  
  const filteredSubs = subs.filter(s => s.id !== id);
  save(filteredSubs);
  render();
}

function editSubscription(id, name, amount, period) {
  const subs = load();
  const index = subs.findIndex(s => s.id === id);
  if (index !== -1) {
    subs[index] = { ...subs[index], name, amount, period };
    save(subs);
    render();
  }
}

function openEditModal(id) {
  const subs = load();
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

function render() {
  const allSubs = load();
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

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const period = /** @type {'monthly'|'yearly'} */ ($$('input[name="period"]').find(i => i.checked).value);

  if (!name || isNaN(amount) || amount < 0) return;
  addSubscription(name, amount, period);
  form.reset();
  // デフォルトを月額に戻す
  $$('input[name="period"]').forEach(i => (i.checked = i.value === 'monthly'));
  nameInput.focus();
});

listTbody.addEventListener('click', (e) => {
  const delBtn = e.target.closest('button[data-del]');
  if (delBtn) {
    deleteSubscription(delBtn.dataset.del);
    return;
  }
  
  const editBtn = e.target.closest('button[data-edit]');
  if (editBtn) {
    openEditModal(editBtn.dataset.edit);
    return;
  }
});

exportBtn.addEventListener('click', () => {
  /** @type {Subscription[]} */
  const subs = load();
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

clearBtn.addEventListener('click', () => {
  if (!confirm('全件を削除します。よろしいですか？')) return;
  save([]);
  render();
});

// 検索・並び替えのイベントリスナー
searchInput.addEventListener('input', render);
sortSelect.addEventListener('change', render);

// 編集フォームのイベントリスナー
editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentEditId) return;
  
  const name = editNameInput.value.trim();
  const amount = parseFloat(editAmountInput.value);
  const period = $$('input[name="edit-period"]').find(i => i.checked).value;
  
  if (!name || isNaN(amount) || amount < 0) return;
  
  editSubscription(currentEditId, name, amount, period);
  closeEditModal();
});

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

document.addEventListener('DOMContentLoaded', render);
