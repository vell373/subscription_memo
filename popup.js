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
  const subs = load().filter(s => s.id !== id);
  save(subs);
  render();
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

function render() {
  const subs = load();
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
        <td><button data-del="${s.id}">削除</button></td>
      </tr>
    `;
  }).join('');

  const { monthlyTotal, yearlyTotal } = calcSums(subs);
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
  const btn = e.target.closest('button[data-del]');
  if (!btn) return;
  deleteSubscription(btn.dataset.del);
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

document.addEventListener('DOMContentLoaded', render);
